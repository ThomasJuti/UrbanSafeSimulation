# Documentación del simulador de arquitecturas para UrbanSafe

Actividad 9, Ingeniería Aplicada. **Resultados = estimaciones del modelo, no mediciones reales.**

- Enlace de la app desplegada (Vercel): https://urbansafe-simulation.vercel.app
- Código: `/Users/thomasjutinico/Documents/UrbanSafe/Simulation`

## 1. Qué es y qué problema resuelve

UrbanSafe calcula rutas seguras para domiciliarios en Bogotá. Hoy es un monolito modular (Hono + Socket.IO + node-cron) sobre PostgreSQL/PostGIS/pgRouting en Supabase (São Paulo). El simulador compara cuatro alternativas y entrega una **cadena verificable: entradas → fórmulas → indicadores calculados → recomendación**. Nada está predefinido: todo número sale del código del modelo (`src/lib/model`), y la página Resultados muestra la traza de cálculo paso a paso.

Alternativas:

| ID | Alternativa | Idea |
|---|---|---|
| A1 | Monolito modular (actual) | 1 instancia, bus en memoria, PostGIS hace el cómputo |
| A2 | Monolito replicado | N instancias tras un balanceador, Redis para Socket.IO, réplica de lectura de la base |
| A3 | Microservicios en contenedores | Gateway y servicios (ruteo, incidentes, riesgo, alertas, ingesta) en Kubernetes |
| A4 | Orientada a eventos | Broker; riesgo y alertas asíncronos; ruteo síncrono con workers; reportes particionados |

## 2. Variables de entrada (14)

| Variable | Unidad | Rango | Referencia |
|---|---|---|---|
| Usuarios concurrentes | usuarios | 1–5 000 | 30 |
| Intervalo entre pedidos de ruta | s | 1–120 | 10 |
| Reportes por usuario por hora | 1/h | 0–60 | 6 |
| Factor de ráfaga | × | 1–20 | 1 |
| Tiempo de cómputo de una ruta en la base | ms | 10–5 000 | 120 |
| Núcleos de la base | vCPU | 1–64 | 2 |
| Nodos de aplicación | nodos | 1–50 | 1 |
| vCPU por nodo | vCPU | 1–32 | 2 |
| Latencia de red API↔base (ida y vuelta) | ms | 0,1–300 | 150 |
| Llamadas internas por operación | llamadas | 0–10 | 3 |
| Disponibilidad por componente | % | 90–99,999 | 99,9 |
| Cifrado interno (mTLS) | sí/no | | sí |
| Costo por nodo | USD/mes | 1–2 000 | 25 |
| Costo por vCPU de la base | USD/mes | 1–2 000 | 25 |

Cada una tiene justificación ligada a un requisito en la página Escenarios (`src/lib/model/variables.ts`). Un escenario puede además sobrescribir requisitos del proyecto (p. ej. el presupuesto en "Lanzamiento").

**Requisitos obligatorios por defecto:** p95 de ruteo ≤ 1 500 ms; p95 de reporte→socket ≤ 1 000 ms; disponibilidad ≥ 99,5 % (ruta crítica de ruteo); **presupuesto ≤ 150 USD/mes** (supuesto del equipo, editable); utilización ≤ 80 %; cifrado en tránsito obligatorio (100 % de canales cifrados).

## 3. Modelo y fórmulas

Colas de dos niveles (aplicación y base) y una cola serializada por el advisory lock de reportes.

**Demanda:** λ_ruta = usuarios / intervalo × ráfaga; λ_rep = usuarios × reportes/h / 3600 × ráfaga; λ_pos = usuarios × 1 posición/s.

**Servicio:** S_app = base × overhead_a + saltos × (c_serialización + c_TLS·[mTLS]); S_bd,ruta = 3 × t_ruta; S_bd,rep = CPU del insert.

**Capacidad efectiva (Ley de Escalabilidad Universal, USL):** C(N) = N / (1 + σ(N−1) + κN(N−1)); c_eff = vCPU × (1 − overhead_plataforma) × C(N); N* = √((1−σ)/κ). A1 fija N = 1. La base usa vCPU × (1 + réplicas).

**Espera:** ρ = Σλ·S / c_eff. W_q ≈ S·ρ^(√(2(c+1))−1) / (c(1−ρ)) (Sakasegawa) × (1+cv²)/2 (Allen-Cunneen). P(W_q > t) = P_w·e^(−θt), θ = (cμ−λ)·2/(1+cv²), con P_w = ρ^(√(2(c+1))−1); W_q,95 = ln(P_w/0,05)/θ.

**Saturación (ρ ≥ 1):** la espera queda en el tope cola_máx·S/c (cola de ruteo = 30, `ROUTING_MAX_QUEUE`; reportes: cola = usuarios), el rendimiento es c/S y se rechaza 1 − 1/ρ (503). Nunca se muestran NaN ni Infinity.

**Lock de reportes:** cola con S_lock = 120 ms (3,6 s / 30 reportes medidos); c_lock = 1 en A1-A3 (el lock está en la base) y 8 particiones en A4.

**Latencia:** p95_ruteo = latencia × 2 viajes + saltos·t_salto + S_app + W_q95,app + S_bd·(1 + 1,645·cv) + W_q95,bd. p95_reporte = latencia × 1 + saltos·t_salto + S_app + W_q95,app + S_lock + W_q95,lock.

**Disponibilidad**, con rep(a, r) = 1 − (1−a)^r y razonamiento **por ruta**:

| Alt. | Ruta síncrona crítica (ruteo) — usada por el requisito obligatorio | Ruta de reporte/alertas |
|---|---|---|
| A1 | a · A_bd | a · A_bd |
| A2 | A_lb · rep(a,N) · rep(A_bd,2) (no depende de Redis; hay réplica) | A_lb · rep(a,N) · A_redis · A_bd |
| A3 | rep(a,N)² · A_ctrl · A_bd | rep(a,N)⁴ · A_ctrl · A_bd |
| A4 | rep(a,N)² · A_bd (**no depende del broker**) | rep(a,N) · A_broker · rep(a,N) · A_bd (**depende del broker**) |

Se informan ambas y los minutos de caída al mes. **El requisito obligatorio de disponibilidad usa la ruta crítica síncrona (ruteo).**

**Costo:** N·costo_nodo + vCPU_bd·(1+réplicas)·costo_vCPU + extras (A2: balanceador 18 + Redis 15; A3: plano de control 73; A4: broker 30).

**Otros:** contenedores y memoria; cobertura de cifrado y superficie de ataque (canales internos); puntaje de seguridad; complejidad operativa (1–10); escalabilidad C(2N)/C(N) y N*.

Todos los parámetros están en `src/lib/model/params.ts` y `alternatives.ts`, cada uno con su fuente por clave (`spec`: medido en UrbanSafe; `[1]`–`[4]`: artículos del curso; `supuesto`: supuesto del equipo, con el artículo que motiva su dirección; `conv`: constante matemática), y se muestran en la página Modelo. Los métodos (colas M/M/c, aproximación de Sakasegawa, Ley de Escalabilidad Universal) se nombran como métodos; los valores de los parámetros y las afirmaciones cualitativas se apoyan en [1]–[4] y en `docs/spec.md` de UrbanSafe.

### Cómo informa cada artículo al modelo

- **[1] Tapia et al. (2020).** Compara el mismo aplicativo como monolito en una VM y como microservicios en contenedores, con el mismo hardware. Los microservicios dieron más peticiones por segundo (3,1 frente a 2,5 en la prueba corta; 1,4 frente a 1,2 en la larga) y un promedio menor (936 frente a 1 150 ms), pero con más CPU (7,85 frente a 2,39) y más red, y menos memoria. En el modelo respalda que el overhead de plataforma de los contenedores (A3 0,20; A4 0,12) sea mayor que el del monolito (0,05). No se traslada su ventaja de rendimiento porque mezcla arquitectura con despliegue (VM frente a contenedores).
- **[2] Blinowski et al. (2022).** En una sola máquina el monolito rinde mejor por el paso de peticiones entre componentes (1,37 a 2 veces más peticiones con un servicio corto; solo un poco más con uno de cómputo intenso). Escalar en vertical es más rentable que en horizontal en Azure, y escalar más allá de cierto número de instancias degrada el rendimiento (ganancias hasta 3-6 instancias con servicios cortos, sin mejora cerca de 10-15 y caída con 20). En el modelo respalda el costo por salto entre servicios (`cSerializacionMs`, `tSaltoMs`) y la calibración de κ de la USL, de modo que N* quede entre 9 y 15 (antes 31 a 58, sin respaldo).
- **[3] Al-Debagy y Martinek (2018).** Con JHipster, el monolito rindió 6 % más en la prueba de concurrencia, sin diferencia significativa en carga (0,87 %), y Consul superó a Eureka por cerca de 4 %. En el modelo fija el multiplicador del servicio de la aplicación de A3 en 1,06. Nota: la guía del curso describe este artículo como una comparación de arquitectura orientada a eventos con medidas de CPU, memoria y paquetes; el PDF no contiene eso (compara monolito y microservicios con gateway, midiendo rendimiento y tiempo de respuesta), y así se usa aquí.
- **[4] Sunardi y Suharjito (2019).** Slim (liviano) fue más rápido que Laravel con 1, 100 y 500 muestras (promedio 67 frente a 197 ms; 368 frente a 1 841 ms; 2 812 frente a 11 622 ms). Respalda que un stack liviano paga menos sobrecarga por petición (CPU de aplicación pequeño en el API Hono de UrbanSafe) y que la variabilidad crece con la carga.

**Advertencia (guía del curso):** los resultados de estos estudios provienen de una sola máquina o de un entorno de prueba concreto y no deben generalizarse a UrbanSafe (Supabase en São Paulo, usuarios en Bogotá). Se usan para fijar la dirección y el orden de magnitud de las sobrecargas, no como predicción. Ninguno evalúa una arquitectura orientada a eventos, por lo que los parámetros de A4 son supuestos del equipo.

### Parámetros recalibrados con los artículos

| Parámetro | Antes | Ahora | Fuente |
|---|---|---|---|
| A3 `overheadApp` | 1,30 | 1,06 | [3] (6 % del monolito) |
| A4 `overheadApp` | 1,20 | 1,08 | [3] más 2 % por eventos (supuesto) |
| A2 `overheadApp` | 1,10 | 1,04 | Supuesto motivado por [2] y [3] |
| A2 κ (N*) | 0,001 (30,7) | 0,012 (8,8) | [2] |
| A3 κ (N*) | 0,0004 (49,2) | 0,006 (12,7) | [2] |
| A4 κ (N*) | 0,0003 (57,2) | 0,0045 (14,7) | [2] |

Se conserva la calibración de UrbanSafe (A1 no cambia: sostenido 1 320 ms, ráfaga con ruteo 5 964 ms y reporte 4 290 ms).

### Calibración

| Medición de UrbanSafe (spec) | Modelo (A1) |
|---|---|
| Ruteo en la base 80–280 ms por ruta | t_ruta = 120 ms × 3 rutas |
| Local de punta a punta 0,6–0,9 s | 0,70 s medio sin carga |
| Sostenida 30 usuarios: p95 1 380 ms | 1 320 ms |
| Ráfaga: p95 3,5–10,6 s | 5 964 ms |
| Reporte→socket en ráfaga: p95 3,6 s | 4 290 ms |

El p95 de ruteo en reposo (≈0,9 s) incluye el cuantil del servicio.

## 4. Decisión

1. **Filtro de obligatorios:** se descarta cada alternativa que incumpla un requisito, con la razón.
2. **Puntaje ponderado:** 8 criterios (p95 de ruteo y reporte, capacidad, disponibilidad, costo, seguridad, complejidad, escalabilidad) con pesos de 0 a 10 y normalización min-max (beneficio/costo) entre las candidatas.
3. **Explicación generada:** aportes por criterio, ventajas (mejor en), limitaciones (peor en), margen frente a la segunda, supuestos y sensibilidad (qué peso al duplicarse cambia el ganador).
4. **Sin candidatas:** se recomienda la menos mala (menor violación relativa acumulada), se indica qué requisito falla y qué variable ajustar.

## 5. Resultados de referencia

Escenario de referencia (30 usuarios, intervalo 10 s, base 2 vCPU, 150 ms, 1 nodo):

| Alt. | p95 ruteo (ms) | p95 reporte (ms) | Capacidad (pedidos/s) | Usuarios hasta ρ=1 | Disp. ruteo (%) | Disp. reporte (%) | Costo (USD/mes) |
|---|---|---|---|---|---|---|---|
| A1 | 1 320 | 285 | 5,5 | 55 | 99,800 | 99,800 | 75 |
| A2 | 894 | 294 | 11,1 | 111 | 99,850 | 99,650 | 158 |
| A3 | 1 339 | 302 | 5,5 | 55 | 99,650 | 99,451 | 148 |
| A4 | 1 332 | 299 | 5,5 | 55 | 99,700 | 99,601 | 105 |

Recomendaciones con los pesos por defecto:

| Escenario | Recomendada | Modo |
|---|---|---|
| Referencia | A1 | cumple obligatorios (candidatas A1, A3, A4; A2 excede el presupuesto de 150) |
| Ráfaga de la demo | A2 | ninguna cumple; la menos mala. Falla ruteo, reporte, presupuesto y utilización: hay que subir los vCPU de la base |
| Lanzamiento en Bogotá (1 000 usuarios, presupuesto 1 500) | A2 | cumple obligatorios (las 4) |
| Recursos limitados con cifrado obligatorio (presupuesto 90) | A1 | cumple obligatorios (candidatas A1 y A4) |

Lectura: el cuello de botella dominante es la CPU de la base, por eso solo A2 (réplica de lectura) mejora el ruteo; A4 mejora el reporte en ráfaga (852 ms frente a 4 290 ms) al repartir el lock; A3 paga saltos de red y baja disponibilidad serie.

## 6. Pruebas (12) y resultados

Las ejecuta Vitest (`npm run test`) y la página `/pruebas` en el navegador, con el mismo código (`src/lib/model/testCases.ts`). Resultado: **12 de 12 aprobadas** (24 de 24 con las pruebas adicionales).

| # | Prueba | Obtenido | Resultado |
|---|---|---|---|
| 1 | Erlang C(2,1) = 1/3 y Sakasegawa ≈ Erlang C (ρ 0,7–0,9) | C(2,1) = 0,3333; error máx. 16,2 % | ✔ |
| 2 | USL: C(1)=1, C(N)≤N, máximo en N* | N* (A2) = 8,8 | ✔ |
| 3 | Latencia monótona con los usuarios | No decrece en A1–A4 | ✔ |
| 4 | Carga baja y 1 nodo: A1 más rápido que A3/A4 | A1 878 ms; A3 896; A4 889 | ✔ |
| 5 | Carga alta y muchos nodos: A2/A3 > A1 en capacidad | A1 859; A2 2 329; A3 1 776 usuarios | ✔ |
| 6 | ρ ≥ 1 marca saturación y rechazo | ρ_bd 1 081 %; rechazo 91 %; rendimiento = capacidad | ✔ |
| 7 | Más réplicas, más disponibilidad | A2 99,450→99,950; A3 98,854→99,850; A4 98,903→99,900 | ✔ |
| 8 | mTLS sube latencia y seguridad | A3 1 332→1 339 ms, seguridad 15→64 | ✔ |
| 9 | El filtro excluye lo que incumple | Presupuesto 100: candidatas solo A1 | ✔ |
| 10 | Cambiar pesos cambia la recomendación | Escalabilidad→A4, el resto→A1 | ✔ |
| 11 | El validador rechaza negativos, NaN, vacíos y fuera de rango | 7 de 7 | ✔ |
| 12 | Calibración | Sostenido 1 320 ms; sin carga 700 ms; ráfaga ruteo 5 964 ms y reporte 4 290 ms (> 1 s) | ✔ |

## 7. Instrucciones de uso

`npm install`, `npm run dev` (o abrir la URL de Vercel). Navegación: Proyecto → Alternativas → Escenarios → Resultados → Decisión → Modelo → Pruebas. El menú **Datos** exporta e importa JSON, imprime el informe y restaura valores. Los cambios se guardan en el navegador. Las entradas inválidas muestran el error junto al campo y bloquean la ejecución.

## 8. Guion de demo (sustentación)

1. **Cargar la referencia** (Escenarios, "Referencia") y mostrar la demanda derivada λ = 3 pedidos/s.
2. **Ejecutar:** ir a Resultados; comparar la tabla y señalar que el p95 de A1 (1 320 ms) reproduce el medido (1 380 ms).
3. **Cambiar usuarios, nodos y núcleos de la base:** duplicar los usuarios a 60 y ver cómo la base llega a ρ ≈ 1; subir `vcpuBd` a 4 y ver que el p95 se recupera.
4. **Ver el cruce y la recomendación:** en la curva p95 vs carga ver dónde las curvas se separan; en Decisión mostrar la recomendación, el margen y la sensibilidad. Cambiar un peso (escalabilidad) y ver que cambia a A4.
5. **Explicar la traza:** abrir "Traza de cálculo" de A1: λ → S → c_eff → ρ → W_q → p95, y la disponibilidad y el costo.
6. Mostrar la ráfaga: ninguna cumple, se recomienda la menos mala y se indica qué ajustar. Ejecutar `/pruebas` (12 de 12) y la demo de validación con un valor -5.

## 9. Limitaciones y supuestos

- Llegadas Poisson, fallos independientes, sin caché de rutas, red constante.
- Parámetros de sobrecarga (σ, κ, overhead, costos extra) tomados de los artículos [1]–[4] o supuestos del equipo; **no medidos en UrbanSafe**. Los resultados de los artículos no se generalizan: son de una sola máquina o de un entorno de prueba.
- Modelo en estado estable; las ráfagas se representan con un factor de pico y un tope de cola.
- Sakasegawa sobrestima la espera con ρ bajo y muchos servidores; es fiable con ρ ≥ 0,7.
- El p95 combina la media del servicio con el cuantil de la espera.
- Puntaje de decisión relativo (min-max).
- [1] mezcla arquitectura y despliegue (VM frente a contenedores); [2], [3] y [4] no incluyen una base remota; ninguno evalúa arquitectura orientada a eventos.

## 10. Qué datos harían falta para validarlo en un entorno real

- Pruebas de carga con k6 o JMeter sobre cada alternativa desplegada con las mismas entradas.
- Métricas de CPU y conexiones de Supabase (pg_stat_statements) para medir el servicio real por ruta e insert.
- Trazas distribuidas (OpenTelemetry) para medir saltos internos y el costo de mTLS.
- Disponibilidad medida de cada componente durante semanas, y facturas reales de los proveedores.

## 11. Referencias

Formato IEEE. Las citas en el texto usan las claves [1]–[4]; `spec` es la especificación de UrbanSafe.

[1] F. Tapia, M. Á. Mora, W. Fuertes, H. Aules, E. Flores y T. Toulkeridis, "From Monolithic Systems to Microservices: A Comparative Study of Performance," *Applied Sciences*, vol. 10, n.º 17, art. 5797, 2020, doi: 10.3390/app10175797.

[2] G. Blinowski, A. Ojdowska y A. Przybyłek, "Monolithic vs. Microservice Architecture: A Performance and Scalability Evaluation," *IEEE Access*, vol. 10, pp. 20357–20374, 2022, doi: 10.1109/ACCESS.2022.3152803.

[3] O. Al-Debagy y P. Martinek, "A Comparative Review of Microservices and Monolithic Architectures," en *Proc. 18th IEEE Int. Symp. Computational Intelligence and Informatics (CINTI)*, Budapest, Hungría, nov. 2018, pp. 149–154.

[4] A. Sunardi y Suharjito, "MVC Architecture: A Comparative Study Between Laravel Framework and Slim Framework in Freelancer Project Monitoring System Web Based," *Procedia Computer Science*, vol. 157, pp. 134–141, 2019, doi: 10.1016/j.procs.2019.08.150.

spec: Equipo UrbanSafe, "UrbanSafe: especificación del MVP y mediciones de carga," `docs/spec.md`, repositorio UrbanSafeApp, 2026.

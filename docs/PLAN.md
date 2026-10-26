# Plan — Simulador de arquitecturas para UrbanSafe (Actividad 9, Ingeniería Aplicada)

## Contexto

La Actividad 9 pide una **app web de simulación** que compare alternativas de arquitectura para el proyecto del curso, **UrbanSafe** (github.com/ThomasJuti/UrbanSafeApp). UrbanSafe calcula rutas seguras para domiciliarios en Bogotá. Hoy es un **monolito modular**: una sola instancia del API (Hono + Socket.IO + node-cron) sobre PostgreSQL/PostGIS/pgRouting en Supabase. El cómputo pesado (Dijkstra con riesgo) corre en la base de datos.

El criterio que más pesa en la evaluación es que haya una **relación verificable entre entradas → fórmulas → indicadores → recomendación**. Por eso el modelo:

- es código puro y probado,
- muestra su traza de cálculo,
- se calibra con las **mediciones reales de `docs/spec.md`**: ruteo en base 80–280 ms; carga sostenida de 30 usuarios con p50 474 ms y p95 1 380 ms; ráfaga con p95 de 3,5 a 10,6 s; reportes serializados por un advisory lock con p95 de 3,6 s.

Los resultados se presentan como **estimaciones del modelo**, no como mediciones.

Decisiones del usuario: **Astro** (web interactiva), despliegue en **Vercel**, proyecto analizado = **UrbanSafe**.

## Qué tendrá la web terminada (vista funcional)

Barra superior con 7 secciones. El estado se guarda solo en el navegador. Se puede exportar e importar en JSON e imprimir el informe.

| Página | Qué ve y qué puede hacer el usuario |
|---|---|
| **Proyecto** (`/`) | Ficha de UrbanSafe editable: descripción, stack, tabla de usuarios previstos, requisitos de calidad con prioridad, requisitos obligatorios numéricos (p95, disponibilidad, presupuesto, cifrado) y restricciones. Validación en vivo, botones de restaurar, exportar e importar |
| **Alternativas** | 4 tarjetas (monolito modular actual, monolito replicado, microservicios, orientada a eventos). Cada una con diagrama, descripción, ventajas y limitaciones citando los artículos, y la tabla de parámetros del modelo que la distinguen |
| **Escenarios** | Lista lateral de escenarios (referencia + 3 predefinidos + los que cree el usuario) y un editor con las 14 variables: unidad, rango, ayuda y justificación. Muestra la demanda derivada (λ) en vivo, resalta lo que cambió frente a la referencia y tiene los botones nuevo, duplicar, eliminar, marcar como referencia y ejecutar todos |
| **Resultados** | Selector de escenario y tabla comparativa de alternativas × indicadores (p95 de ruteo, p95 de reporte, capacidad, utilización, disponibilidad, costo, seguridad, contenedores, complejidad). Gráficos de barras, radar y curva p95 frente a carga. Tabla escenarios × alternativas con diferencias frente a la referencia. **Traza de cálculo** paso a paso por alternativa |
| **Decisión** | Sliders de pesos por criterio y tabla de cumplimiento de obligatorios (✔/✘ con la razón). Ranking con barra de puntaje y tarjeta de **recomendación explicada**: por qué gana, aportes por criterio, ventajas, limitaciones, supuestos, margen frente a la segunda y qué peso cambiaría la decisión. También la recomendación de cada escenario |
| **Modelo** | Documentación dentro de la app: ecuaciones, tabla de parámetros con su fuente (spec de UrbanSafe o artículo), supuestos, limitaciones y qué datos harían falta para validar en un entorno real |
| **Pruebas** | Botón que corre en el navegador las 12 pruebas del modelo, con ✔/✘, valores esperados y obtenidos, y una demo de validación de entradas inválidas |

## Stack

- **Astro 5** (salida estática) + **islas React** con TypeScript estricto. El equipo ya usa React en UrbanSafe.
- **nanostores** + `@nanostores/persistent`: comparte el estado entre islas y páginas y lo guarda en localStorage.
- **Chart.js** (react-chartjs-2) para los gráficos.
- **Vitest** para las pruebas del modelo, igual que en UrbanSafe.
- CSS propio con tokens, **diseño de escritorio (desktop-first)** con media queries hacia abajo. En escritorio, barra de navegación superior y layouts de varias columnas (formulario + resultados lado a lado). En tablet y celular se apila en una columna y el menú se vuelve desplegable.
- Proyecto en `/Users/thomasjutinico/Documents/UrbanSafe/Simulation` (ya tiene `git init`).

## Estructura

```
src/
  lib/model/            # modelo puro, sin DOM (núcleo verificable)
    types.ts            # Entradas, Alternativa, Resultado, Proyecto, Pesos
    params.ts           # constantes calibradas (sin números mágicos), con su fuente
    alternatives.ts     # 4 alternativas documentadas + parámetros
    queueing.ts         # Erlang C, aproximación M/M/c, USL
    simulate.ts         # simulate(entradas, alternativa) → indicadores + traza
    decision.ts         # filtro de obligatorios, ponderación, explicación, sensibilidad
    validation.ts       # rangos y reglas cruzadas de entradas y proyecto
    scenarios.ts        # escenario de referencia + 3 predefinidos
    testCases.ts        # casos de prueba compartidos (Vitest + página /pruebas)
    *.test.ts
  stores/state.ts       # proyecto, escenarios, referencia, pesos (persistente)
  components/           # islas React: ProjectForm, AlternativesView, ScenarioEditor,
                        # ResultsView, DecisionView, TestRunner, charts/*
  layouts/Base.astro    # navegación responsive, tema claro/oscuro
  pages/                # index (proyecto), alternativas, escenarios, resultados,
                        # decision, modelo (documentación), pruebas
docs/DOCUMENTACION.md   # entregable escrito (punto 11)
README.md
```

## 1. Configuración del proyecto (req. 1)

Formulario precargado con UrbanSafe y editable. Validado; se puede exportar e importar en JSON.

- **Características:** nombre, descripción, dominio y stack actual.
- **Usuarios previstos (tabla editable):** domiciliarios (30 en la demo), reporteros comunitarios, sistema de ingesta y simulador de pedidos.
- **Requisitos de calidad con prioridad:** rendimiento del ruteo, tiempo real, disponibilidad, privacidad (RN-03), costo y mantenibilidad.
- **Requisitos obligatorios (se usan en la decisión):**
  - p95 de ruteo ≤ 1 500 ms
  - p95 de reporte → socket ≤ 1 000 ms
  - disponibilidad ≥ 99,5 %
  - presupuesto ≤ X USD/mes
  - utilización máxima 80 %
  - cifrado en tránsito obligatorio (Supabase exige `sslmode=require`)
- **Restricciones (texto):** equipo estudiantil, sin Docker en desarrollo, Supabase solo como base de datos, plazo del semestre.

## 2. Alternativas (req. 2)

Cuatro alternativas, cada una con descripción, diagrama simple, ventajas y limitaciones según los artículos, y parámetros visibles:

| ID | Alternativa | Idea |
|---|---|---|
| A1 | **Monolito modular (actual)** | 1 instancia de API, bus de eventos en memoria, PostGIS hace el cómputo |
| A2 | **Monolito replicado** | N instancias detrás de un balanceador, adaptador Redis para Socket.IO, réplica de lectura de la base (la ruta de crecimiento que ya prevé AGENTS.md) |
| A3 | **Microservicios en contenedores** | Servicios ruteo, incidentes/reportes, riesgo, alertas/tiempo real e ingesta en Kubernetes, con API gateway y llamadas por red |
| A4 | **Orientada a eventos** | Broker (p. ej. Redis Streams o Kafka). `incident.created` → riesgo → alertas asíncronas; ruteo síncrono con workers |

## 3. Variables de entrada (req. 3)

Cada variable tiene unidad, rango, validación y una justificación ligada a un requisito:

| Variable | Rango | Requisito al que se liga |
|---|---|---|
| Usuarios concurrentes (domiciliarios) | 1–5 000 | Concurrencia |
| Intervalo medio entre pedidos de ruta (s) | 1–120 | Ruteo |
| Reportes por usuario por hora | 0–60 | Tiempo real |
| Factor de ráfaga (pico/promedio) | 1–20 | Ráfaga al aceptar |
| Tiempo de cómputo de ruta en la base (ms) | 10–5 000 | Calibrado en 180 ms |
| Núcleos de la base de datos (vCPU) | 1–64 | Cuello de botella principal |
| Nodos de aplicación | 1–50 | Escalabilidad |
| vCPU por nodo | 1–32 | Capacidad |
| Latencia de red cliente/API ↔ base (ms) | 0,1–300 | São Paulo ≈ 150 ms |
| Llamadas internas entre servicios por operación | 0–10 | Overhead de microservicios |
| Disponibilidad por componente (%) | 90–99,999 | Disponibilidad |
| Cifrado interno (mTLS) | sí/no | Seguridad |
| Costo por nodo (USD/mes) | 1–2 000 | Presupuesto |
| Costo por vCPU de base (USD/mes) | 1–2 000 | Presupuesto |

## 4. Modelo de simulación (req. 4)

Es un modelo de **colas de dos niveles** (aplicación y base de datos), con tres clases de carga propias de UrbanSafe: **ruteo**, **reporte** y **posición/alerta**.

**Demanda**

- λ_ruta = usuarios / intervalo × ráfaga
- λ_rep = usuarios × reportes/h / 3600 × ráfaga
- λ_pos = usuarios × 1 posición/s

**Tiempo de servicio por clase y alternativa**

- S_app = base × overhead_a + llamadas_remotas × c_serialización + enlaces × c_TLS
- S_bd = 3 rutas × t_ruta, más el insert del reporte
- A4 saca de la ruta crítica el recálculo de riesgo y las alertas (pasan a una cola asíncrona).

**Capacidad efectiva**

Ley de Escalabilidad Universal (Gunther):

- C(N) = N / (1 + σ(N−1) + κN(N−1))
- c_eff = vCPU × (1 − overhead_plataforma) × C(N)

Los valores de σ y κ varían por alternativa: el monolito tiene más contención y los microservicios y eventos menos. A1 queda fija en N = 1.

**Espera**

- Utilización: ρ = Σλ·S / c_eff
- Espera en cola M/M/c con la aproximación de Sakasegawa: W_q ≈ S · ρ^(√(2(c+1))−1) / (c(1−ρ)). Se valida contra Erlang C exacto.
- Los reportes que comparten el advisory lock se modelan como una cola M/M/1 serializada (explica el p95 de 3,6 s medido).
- Si ρ ≥ 1, el sistema está saturado: se reporta el throughput máximo y el porcentaje de rechazo (la cola de ruteo responde 503).

**Latencias**

- R = latencia de red × viajes + S_app + W_q,app + S_bd + W_q,bd
- p95: se usa la cola exponencial, P(W_q > t) = P_w · e^(−(cμ−λ)t), y la cola del servicio.

**Disponibilidad**

Se combina en serie y en paralelo, con rep(a, r) = 1 − (1−a)^r:

- A1 = a · A_bd
- A2 = rep(a, N) · A_bd · A_redis
- A3 = Π rep(a, r) de los servicios en la ruta síncrona · A_orquestador · A_bd
- A4 = la ruta síncrona más corta · A_broker

También se reportan los minutos de caída por mes.

**Costo/mes**

Nodos + vCPU de la base + plano de control (A3), broker (A4) o Redis (A2).

**Otros indicadores**

- Contenedores y memoria estimados
- Superficie de ataque (canales internos) y cobertura de cifrado
- Índice de complejidad operativa (1–10)
- Escalabilidad: C(2N)/C(N) y nodos óptimos N* = √((1−σ)/κ)

Todo parámetro vive en `params.ts` con su fuente (spec o artículo) y se muestra en `/modelo`. Supuestos y limitaciones documentados:

- llegadas Poisson
- fallos independientes
- sin caché de rutas
- red constante
- parámetros de overhead tomados de la literatura, no medidos en UrbanSafe

## 5. Escenarios (req. 5)

- **Referencia:** demo del curso con 30 usuarios, intervalo de 10 s, base de 2 vCPU, red de 150 ms y 1 nodo.
- **Predefinidos:**
  1. Ráfaga de la demo (30 aceptan a la vez)
  2. Lanzamiento en Bogotá (1 000 domiciliarios)
  3. Recursos limitados con cifrado obligatorio y presupuesto bajo
- Se pueden crear, duplicar, renombrar y eliminar escenarios, y marcar uno como referencia.
- El editor resalta los cambios frente a la referencia.
- Botón **Ejecutar todos los escenarios**.

## 6. Indicadores (req. 6, al menos 4)

- p95 del ruteo
- p95 de reporte → socket
- throughput y capacidad máxima
- utilización de la aplicación y de la base
- disponibilidad y caída/mes
- escalabilidad
- costo/mes
- cifrado y superficie de ataque
- contenedores
- complejidad operativa

## 7. Comparación (req. 7)

En `/resultados`:

- Tabla de alternativas × indicadores bajo las mismas entradas.
- Barras de p95, capacidad frente a demanda, disponibilidad y costo.
- Radar con los puntajes normalizados.
- **Curva de p95 frente a carga** (de 0,1× a 3× la demanda), que muestra dónde se cruza el monolito con las demás.
- Tabla de escenarios × alternativas.
- **Traza de cálculo** desplegable con los valores intermedios: λ, S, c_eff, ρ, W_q.

## 8. Apoyo a la decisión (req. 8)

1. **Filtro de obligatorios:** se descarta cada alternativa que incumpla un requisito, con la razón.
2. **Puntaje ponderado:** pesos editables con sliders; normalización min-max por criterio (beneficio o costo).
3. **Explicación generada a partir de los números:**
   - aportes por criterio
   - ventajas: criterios donde la alternativa es la mejor
   - limitaciones: criterios donde es la peor
   - margen frente a la segunda
   - supuestos
   - **sensibilidad:** qué peso, al duplicarse, cambiaría la recomendación
4. Si ninguna cumple, se recomienda la menos mala, se dice qué requisito falla y qué variable ajustar.

## 9. Interfaz (req. 9)

Web de escritorio normal, pensada primero para pantallas de 1280 px o más, y responsiva hasta 360 px:

- Las tablas se desplazan dentro de su contenedor.
- Las columnas se apilan en pantallas pequeñas.
- La interfaz es accesible (labels y foco) y tiene tema oscuro.

## 10. Validación y pruebas (req. 10)

**`validation.ts`** revisa:

- rangos
- enteros
- campos vacíos o NaN
- reglas cruzadas, por ejemplo: llamadas internas > 0 con A1 se ignoran (aviso); pesos todos en 0 da error; presupuesto ≤ 0 da error

Los errores aparecen junto al campo y bloquean la ejecución.

**Pruebas Vitest (al menos 10)**, compartidas con la página `/pruebas`, que las corre en el navegador para la sustentación:

1. Erlang C(2, 1) = 1/3 y Sakasegawa ≈ Erlang C dentro de la tolerancia
2. USL: C(1) = 1 y C(N) ≤ N
3. La latencia crece de forma monótona con los usuarios
4. Con 1 nodo y carga baja, el monolito tiene menor latencia que los microservicios (coherente con los artículos)
5. Con carga alta y muchos nodos, A2/A3 superan en capacidad a A1
6. ρ ≥ 1 marca la saturación y el rechazo
7. Más réplicas implica más disponibilidad
8. Activar mTLS sube la latencia y la puntuación de seguridad
9. El filtro de obligatorios excluye la alternativa que incumple
10. Cambiar los pesos puede cambiar la recomendación
11. El validador rechaza entradas negativas, NaN y fuera de rango
12. **Calibración:** el escenario de referencia reproduce el orden de magnitud medido en UrbanSafe (p95 de ruteo sostenido ~1–2 s; la ráfaga no cumple 1,5 s)

## 11. Documentación (req. 11)

- **`docs/DOCUMENTACION.md`** (en español): descripción del modelo, variables, fórmulas, parámetros con su fuente, criterios de decisión, instrucciones de uso, las 12 pruebas con sus resultados, limitaciones, **qué datos harían falta para validarlo en real** (pruebas de carga con k6/JMeter sobre cada alternativa, métricas de CPU de Supabase, trazas distribuidas) y el enlace de Vercel.
- La página `/modelo` presenta lo mismo dentro de la app.
- `README.md` explica cómo correr el proyecto.

## 12. Sustentación (req. 12)

Guion de demo en `DOCUMENTACION.md`:

1. Cargar la referencia.
2. Ejecutar.
3. Cambiar usuarios, nodos y núcleos de la base.
4. Ver cómo cambian el cruce y la recomendación.
5. Explicar la traza.

## Verificación

1. `npm run test`: todas las pruebas Vitest pasan.
2. `npm run build`: el build estático de Astro termina sin errores. `astro check` para los tipos.
3. `npm run dev` y revisión en Chrome (claude-in-chrome) a 390 px y 1280 px: recorrer las 7 páginas, ejecutar los escenarios, cambiar variables y comprobar que cambian los indicadores y la recomendación; probar entradas inválidas; correr `/pruebas`.
4. Desplegar en Vercel (`vercel deploy --prod`, tras confirmar con el usuario), verificar la URL pública y agregarla a la documentación.

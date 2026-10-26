/** Las 4 alternativas de arquitectura, con los parámetros que las distinguen. */
import type { AltId, Entradas, Param, RefKey } from './types';
import { K, type ParamKey } from './params';

const lit = (refs: RefKey[], valor: number, unidad: string, descripcion: string, fuente: string): Param => ({
  valor, unidad, descripcion, fuente, refs, tipo: 'literatura',
});
const sup = (valor: number, unidad: string, descripcion: string, fuente = 'validar con pruebas de carga.', motiva: RefKey[] = []): Param => ({
  valor, unidad, descripcion, fuente: `Supuesto del equipo: ${fuente}`, refs: ['supuesto', ...motiva], tipo: 'supuesto',
});
const spec = (valor: number, unidad: string, descripcion: string, fuente: string): Param => ({
  valor, unidad, descripcion, fuente, refs: ['spec'], tipo: 'medido',
});
const conv = (valor: number, unidad: string, descripcion: string, fuente: string): Param => ({
  valor, unidad, descripcion, fuente, refs: ['conv'], tipo: 'convencion',
});

const SIGMA_FUENTE = 'la contención USL no se midió; se toma de menor a mayor según cuánto estado compartido hay entre instancias. [2] muestra que repartir carga cuesta CPU.';
const KAPPA_FUENTE = (nStar: string) =>
  `Calibrado con [2]: el rendimiento escala bien de 1 a 6 instancias, deja de mejorar cerca de 10-15 y cae con 20. κ se elige para que N* ≈ ${nStar}.`;

/** Disponibilidad de r réplicas en paralelo: 1 − (1−a)^r. */
export const rep = (a: number, r: number): number => 1 - Math.pow(1 - a, r);

export interface TerminoDisp {
  etiqueta: string;
  formula: string;
  valor: number; // fracción 0..1
}

export interface Alternativa {
  id: AltId;
  nombre: string;
  corto: string;
  descripcion: string;
  flujo: string[];
  ventajas: string[];
  limitaciones: string[];
  referencias: RefKey[];
  params: Record<string, Param>;
  /** Valores numéricos de `params`. */
  k: Record<string, number>;
  /** Nodos de aplicación que usa realmente (A1 fija N = 1). */
  nodosUsados(e: Entradas): number;
  saltosRuta(e: Entradas): number;
  saltosReporte(e: Entradas): number;
  canalesInternos(e: Entradas): number;
  contenedores(n: number): number;
  dispRuta(a: number, n: number, bd: number): TerminoDisp[];
  dispReporte(a: number, n: number, bd: number): TerminoDisp[];
  /** Costos fijos extra (clave de params globales). */
  extras: { etiqueta: string; param: ParamKey }[];
}

function def(a: Omit<Alternativa, 'k'>): Alternativa {
  return { ...a, k: Object.fromEntries(Object.entries(a.params).map(([n, p]) => [n, p.valor])) };
}

const pct = (x: number) => x / 100;

const A1 = def({
  id: 'A1',
  nombre: 'Monolito modular (actual)',
  corto: 'Monolito',
  descripcion:
    'Una sola instancia del API (Hono + Socket.IO + node-cron) con bus de eventos en memoria. PostgreSQL/PostGIS/pgRouting en Supabase hace el cómputo pesado. Es la arquitectura que UrbanSafe tiene hoy.',
  flujo: ['Cliente', 'API único (Hono + Socket.IO)', 'Supabase (PostGIS + pgRouting)'],
  ventajas: [
    'Cero saltos de red internos: la latencia es la mínima posible.',
    'Menor costo y menor complejidad operativa (un solo despliegue).',
    'Superficie de ataque mínima: sin canales internos que cifrar.',
    'Con una sola máquina o pocos usuarios simultáneos el monolito rinde igual o mejor que los microservicios ([2], [3]).',
    'Encaja con un equipo estudiantil: un solo despliegue y sin Docker en desarrollo.',
  ],
  limitaciones: [
    'Una sola instancia: punto único de falla en la disponibilidad.',
    'No escala horizontalmente; el límite lo pone una máquina.',
    'Los reportes se serializan por el advisory lock global de la base.',
  ],
  referencias: ['[2]', '[3]', 'spec'],
  params: {
    sigma: conv(0, 'σ', 'Contención USL (N fijo en 1, no influye)', 'A1 fija N = 1: la USL no aplica.'),
    kappa: conv(0, 'κ', 'Coherencia USL (N fijo en 1, no influye)', 'A1 fija N = 1: la USL no aplica.'),
    overheadApp: conv(1, '×', 'Multiplicador del servicio en la aplicación (línea base)', 'Línea base: [2] y [3] comparan los microservicios contra el monolito.'),
    overheadPlataforma: sup(0.05, 'fracción', 'vCPU consumidos por sistema operativo y recolector de basura', 'orden típico de un proceso Node.js sin contenedores. [1] mide un CPU bajo (2,4 %) para el monolito.', ['[1]']),
    replicasBd: sup(0, 'réplicas', 'Réplicas de lectura de la base'),
    particionesLock: spec(1, 'locks', 'Advisory lock global de reportes', 'UrbanSafe docs/spec.md: "un advisory lock global, no por celda"'),
    complejidadBase: sup(2, 'puntos', 'Complejidad operativa base (1-10)'),
    memoriaContenedorMb: sup(512, 'MB', 'Memoria por contenedor'),
  },
  nodosUsados: () => 1,
  saltosRuta: () => 0,
  saltosReporte: () => 0,
  canalesInternos: () => 0,
  contenedores: () => 1,
  dispRuta: (a, _n, bd) => [
    { etiqueta: 'API (1 instancia)', formula: 'a', valor: a },
    { etiqueta: 'Base de datos', formula: 'A_bd', valor: bd },
  ],
  dispReporte: (a, _n, bd) => [
    { etiqueta: 'API (1 instancia)', formula: 'a', valor: a },
    { etiqueta: 'Base de datos', formula: 'A_bd', valor: bd },
  ],
  extras: [],
});

const A2 = def({
  id: 'A2',
  nombre: 'Monolito replicado',
  corto: 'Replicado',
  descripcion:
    'N instancias del mismo API detrás de un balanceador, adaptador Redis para Socket.IO y una réplica de lectura de la base. Es la ruta de crecimiento que ya prevé el AGENTS.md de UrbanSafe.',
  flujo: ['Cliente', 'Balanceador', 'N instancias del API', 'Redis (Socket.IO)', 'Supabase + réplica de lectura'],
  ventajas: [
    'Disponibilidad por redundancia: rep(a, N) en la ruta síncrona.',
    'Escala el ruteo: la réplica de lectura duplica la capacidad de la base para rutas.',
    'Mantiene el código del monolito; cambio incremental.',
    'Pasar de 1 a 3 y de 3 a 6 instancias es donde [2] observa las mayores ganancias de rendimiento al escalar en horizontal.',
  ],
  limitaciones: [
    'El advisory lock global de reportes sigue siendo un solo cuello de botella (está en la base).',
    'Costo extra de balanceador, Redis y réplica.',
    'Contención y coherencia (σ, κ) crecen con N: hay un N óptimo (N* ≈ 9). [2] observa que escalar más allá de cierto número de instancias degrada el rendimiento.',
    '[2]: escalar en vertical (nodos más grandes) fue más rentable que en horizontal en Azure; conviene probar vcpuNodo antes de sumar nodos.',
  ],
  referencias: ['[2]', '[3]', 'spec'],
  params: {
    sigma: sup(0.06, 'σ', 'Contención USL del monolito replicado (estado compartido, sesiones)', SIGMA_FUENTE, ['[2]']),
    kappa: lit(['[2]'], 0.012, 'κ', 'Coherencia USL (difusión Redis entre instancias)', KAPPA_FUENTE('9')),
    overheadApp: sup(1.04, '×', 'Servicio extra por el adaptador Redis y el balanceador', 'menor que el 6 % de microservicios de [3], porque no hay paso de peticiones entre servicios; [2] indica que repartir la carga consume CPU.', ['[2]', '[3]']),
    overheadPlataforma: sup(0.08, 'fracción', 'vCPU consumidos por agente del balanceador y cliente Redis', 'intermedio entre A1 y los contenedores de A3.', ['[1]']),
    replicasBd: sup(1, 'réplicas', 'Réplicas de lectura de la base (ruta de crecimiento del AGENTS.md)'),
    particionesLock: spec(1, 'locks', 'El advisory lock vive en la base: las réplicas de la API no lo reparten', 'UrbanSafe docs/spec.md'),
    complejidadBase: sup(4, 'puntos', 'Complejidad operativa base (1-10)'),
    memoriaContenedorMb: sup(512, 'MB', 'Memoria por contenedor'),
  },
  nodosUsados: (e) => e.nodos,
  saltosRuta: () => 1,
  saltosReporte: () => 2,
  canalesInternos: () => 2,
  contenedores: (n) => n,
  dispRuta: (a, n, bd) => [
    { etiqueta: 'Balanceador', formula: 'A_lb', valor: pct(K.dispLbPct) },
    { etiqueta: `Instancias del API (${n})`, formula: 'rep(a, N) = 1−(1−a)^N', valor: rep(a, n) },
    { etiqueta: 'Base (primaria o réplica de lectura)', formula: 'rep(A_bd, 2)', valor: rep(bd, 2) },
  ],
  dispReporte: (a, n, bd) => [
    { etiqueta: 'Balanceador', formula: 'A_lb', valor: pct(K.dispLbPct) },
    { etiqueta: `Instancias del API (${n})`, formula: 'rep(a, N)', valor: rep(a, n) },
    { etiqueta: 'Redis (fan-out Socket.IO)', formula: 'A_redis', valor: pct(K.dispRedisPct) },
    { etiqueta: 'Base primaria (escritura)', formula: 'A_bd', valor: bd },
  ],
  extras: [
    { etiqueta: 'Balanceador', param: 'costoLbUsd' },
    { etiqueta: 'Redis', param: 'costoRedisUsd' },
  ],
});

const A3 = def({
  id: 'A3',
  nombre: 'Microservicios en contenedores',
  corto: 'Microservicios',
  descripcion:
    'Servicios de ruteo, incidentes/reportes, riesgo, alertas/tiempo real e ingesta en Kubernetes, con API gateway y llamadas por red entre servicios.',
  flujo: ['Cliente', 'API gateway', 'Ruteo · Incidentes · Riesgo · Alertas · Ingesta', 'Supabase'],
  ventajas: [
    'Cada servicio escala y se despliega por separado.',
    'Aislamiento de fallos entre servicios y poca contención (σ, κ bajos).',
    'Equipos independientes por servicio (no aplica a un equipo de 4).',
    '[1] midió más peticiones por segundo con microservicios en contenedores (3,1 frente a 2,5) que con el monolito en una VM, aunque con más CPU.',
  ],
  limitaciones: [
    'Cada llamada interna suma latencia, serialización y, con mTLS, cifrado. En una sola máquina, [2] mide que el monolito atiende entre 1,37 y 2 veces más peticiones cuando el servicio es corto.',
    '[3]: el monolito tuvo 6 % más de rendimiento en concurrencia; en carga normal no hubo diferencia significativa.',
    '[1]: los contenedores usaron más CPU (7,9 frente a 2,4) y más red que el monolito.',
    'Disponibilidad en serie: la ruta síncrona depende de varios servicios.',
    'Plano de control de Kubernetes: costo fijo y complejidad operativa alta.',
    'Mayor superficie de ataque (muchos canales internos).',
  ],
  referencias: ['[1]', '[2]', '[3]'],
  params: {
    sigma: sup(0.03, 'σ', 'Contención USL de servicios desacoplados', SIGMA_FUENTE, ['[2]']),
    kappa: lit(['[2]'], 0.006, 'κ', 'Coherencia USL de servicios desacoplados', KAPPA_FUENTE('13')),
    overheadApp: lit(['[3]'], 1.06, '×', 'Servicio extra por gateway, validaciones y envoltorios entre servicios', '[3]: el monolito rindió 6 % más en concurrencia, así que el servicio de la aplicación se multiplica por 1,06. Los saltos se cobran aparte (cSerializacionMs, tSaltoMs).'),
    overheadPlataforma: sup(0.2, 'fracción', 'vCPU consumidos por kubelet, kube-proxy y sidecars', 'en [1] los contenedores usaron unas 3,3 veces más CPU que el monolito (7,85 frente a 2,39); se toma el mayor overhead de plataforma de las cuatro alternativas.', ['[1]']),
    replicasBd: sup(0, 'réplicas', 'Réplicas de lectura de la base'),
    particionesLock: spec(1, 'locks', 'El servicio de incidentes sigue usando el advisory lock global', 'UrbanSafe docs/spec.md'),
    servicios: sup(6, 'servicios', 'Pods por nodo: gateway, ruteo, incidentes, riesgo, alertas, ingesta'),
    serviciosRutaSincrona: sup(2, 'servicios', 'Servicios en serie en el ruteo: gateway y ruteo'),
    serviciosReporteSincrono: sup(4, 'servicios', 'Servicios en serie en el reporte: gateway, incidentes, riesgo, alertas'),
    canalesBase: sup(6, 'canales', 'Canales internos base: gateway→5 servicios (más las llamadas entre servicios)'),
    complejidadBase: sup(8, 'puntos', 'Complejidad operativa base (1-10)'),
    memoriaContenedorMb: sup(320, 'MB', 'Memoria por pod (incluye sidecar)'),
  },
  nodosUsados: (e) => e.nodos,
  saltosRuta: (e) => 1 + e.llamadasInternas,
  saltosReporte: (e) => 1 + e.llamadasInternas,
  canalesInternos: (e) => A3.k.canalesBase + e.llamadasInternas,
  contenedores: (n) => A3.k.servicios * n,
  dispRuta: (a, n, bd) => {
    const s = A3.k.serviciosRutaSincrona;
    return [
      { etiqueta: `Servicios en la ruta síncrona (${s}, ${n} réplicas c/u)`, formula: 'rep(a, N)^s', valor: Math.pow(rep(a, n), s) },
      { etiqueta: 'Plano de control K8s', formula: 'A_ctrl', valor: pct(K.dispPlanoControlPct) },
      { etiqueta: 'Base de datos', formula: 'A_bd', valor: bd },
    ];
  },
  dispReporte: (a, n, bd) => {
    const s = A3.k.serviciosReporteSincrono;
    return [
      { etiqueta: `Servicios en la ruta de reporte (${s}, ${n} réplicas c/u)`, formula: 'rep(a, N)^s', valor: Math.pow(rep(a, n), s) },
      { etiqueta: 'Plano de control K8s', formula: 'A_ctrl', valor: pct(K.dispPlanoControlPct) },
      { etiqueta: 'Base de datos', formula: 'A_bd', valor: bd },
    ];
  },
  extras: [{ etiqueta: 'Plano de control Kubernetes', param: 'costoPlanoControlUsd' }],
});

const A4 = def({
  id: 'A4',
  nombre: 'Arquitectura orientada a eventos',
  corto: 'Eventos',
  descripcion:
    'Un broker (p. ej. Redis Streams o Kafka). incident.created dispara el riesgo y las alertas de forma asíncrona; el ruteo sigue síncrono con workers.',
  flujo: ['Cliente', 'API', 'Broker de eventos', 'Workers (ruteo · riesgo · alertas)', 'Supabase'],
  ventajas: [
    'Saca de la ruta crítica el recálculo de riesgo y las alertas.',
    'Los reportes se pueden particionar por celda y dejar de usar un lock global.',
    'El broker absorbe ráfagas y desacopla productores de consumidores.',
  ],
  limitaciones: [
    'El ruteo no se acelera: sigue acotado por la CPU de la base.',
    'Consistencia eventual y más piezas que operar (broker, workers).',
    'La disponibilidad de la ruta de reporte y alertas depende del broker; la de ruteo, no.',
    'Ninguno de los 4 artículos evalúa una arquitectura orientada a eventos: sus parámetros son supuestos del equipo, solo con la dirección del sobrecosto distribuido tomada de [2] y [3].',
  ],
  referencias: ['[2]', '[3]', 'supuesto'],
  params: {
    sigma: sup(0.02, 'σ', 'Contención USL de workers desacoplados', SIGMA_FUENTE, ['[2]']),
    kappa: lit(['[2]'], 0.0045, 'κ', 'Coherencia USL de workers desacoplados', KAPPA_FUENTE('15')),
    overheadApp: sup(1.08, '×', 'Servicio extra por publicar y consumir eventos', 'el 6 % de [3] por ser un sistema distribuido, más cerca de 2 % por publicar y consumir eventos.', ['[3]']),
    overheadPlataforma: sup(0.12, 'fracción', 'vCPU consumidos por clientes del broker y contenedores', 'menor que A3 (menos contenedores por nodo); dirección de [1].', ['[1]']),
    replicasBd: sup(0, 'réplicas', 'Réplicas de lectura de la base'),
    particionesLock: sup(8, 'particiones', 'Particiones del broker por celda: reemplazan el lock global', 'diseño propuesto; la spec usa un lock global "no por celda", así que el reparto por celda es una decisión del equipo.'),
    contenedoresPorNodo: sup(3, 'contenedores', 'Contenedores por nodo: API, worker de ruteo, worker de eventos'),
    canalesBase: sup(3, 'canales', 'Canales internos: API→broker, broker→workers, workers→broker'),
    complejidadBase: sup(7, 'puntos', 'Complejidad operativa base (1-10)'),
    memoriaContenedorMb: sup(384, 'MB', 'Memoria por contenedor'),
  },
  nodosUsados: (e) => e.nodos,
  saltosRuta: () => 2,
  saltosReporte: () => 3,
  canalesInternos: () => A4.k.canalesBase,
  contenedores: (n) => A4.k.contenedoresPorNodo * n,
  dispRuta: (a, n, bd) => [
    { etiqueta: `API y worker de ruteo (2 servicios, ${n} réplicas c/u)`, formula: 'rep(a, N)^2', valor: Math.pow(rep(a, n), 2) },
    { etiqueta: 'Base de datos', formula: 'A_bd', valor: bd },
  ],
  dispReporte: (a, n, bd) => [
    { etiqueta: 'API productora', formula: 'rep(a, N)', valor: rep(a, n) },
    { etiqueta: 'Broker', formula: 'A_broker', valor: pct(K.dispBrokerPct) },
    { etiqueta: 'Worker consumidor', formula: 'rep(a, N)', valor: rep(a, n) },
    { etiqueta: 'Base de datos', formula: 'A_bd', valor: bd },
  ],
  extras: [{ etiqueta: 'Broker de eventos', param: 'costoBrokerUsd' }],
});

export const ALTERNATIVAS: Record<AltId, Alternativa> = { A1, A2, A3, A4 };
export const LISTA_ALTERNATIVAS: Alternativa[] = [A1, A2, A3, A4];

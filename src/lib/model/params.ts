/**
 * Parámetros globales del modelo. Ningún número mágico fuera de este archivo
 * y de `alternatives.ts`. Cada uno declara su fuente con una clave corta:
 *  - spec: UrbanSafe, docs/spec.md (UrbanSafeApp), mediciones propias
 *  - [1]..[4]: artículos del curso (ver REFERENCIAS en references.ts)
 *  - supuesto: decisión del equipo, a validar con pruebas reales; puede llevar
 *    además el artículo que motiva su dirección o magnitud
 *  - conv: constante matemática o convención
 */
import type { Param, RefKey } from './types';

const SPEC = 'UrbanSafe docs/spec.md';
/** Medido en UrbanSafe (spec). */
const m = (valor: number, unidad: string, descripcion: string, fuente: string): Param => ({
  valor, unidad, descripcion, fuente, refs: ['spec'], tipo: 'medido',
});
/** Supuesto del equipo; `motiva` indica el artículo que fija la dirección o el orden de magnitud. */
const s = (valor: number, unidad: string, descripcion: string, fuente: string, motiva: RefKey[] = []): Param => ({
  valor, unidad, descripcion, fuente: `Supuesto del equipo: ${fuente}`, refs: ['supuesto', ...motiva], tipo: 'supuesto',
});
/** Constante matemática o convención. */
const c = (valor: number, unidad: string, descripcion: string, fuente: string): Param => ({
  valor, unidad, descripcion, fuente, refs: ['conv'], tipo: 'convencion',
});

export const PARAMS = {
  // --- Carga y servicio (UrbanSafe) ---
  rutasPorPedido: m(3, 'rutas', 'Rutas por pedido: rápida, balanceada y segura (α = 0, 1, 5)', `${SPEC}, Ruteo parte 2`),
  viajesBdRuta: m(2, 'viajes', 'Viajes a la base por pedido de ruta (la consulta + averiguar los vértices)', `${SPEC}: "averiguar los vértices suma un viaje a la base"`),
  viajesBdReporte: m(1, 'viajes', 'Viajes a la base por reporte (una sola función SQL transaccional)', `${SPEC}: submit_community_report`),
  posicionesPorUsuarioS: m(1, '1/s', 'Posiciones por usuario y segundo (ticker de 1 Hz)', `${SPEC}: "un único ticker a 1 Hz"`),
  colaMaxRuteo: m(30, 'pedidos', 'Cola acotada del ruteo (ROUTING_MAX_QUEUE); sobre ese tope responde 503', `${SPEC}: "cabe en la cola de 30"`),
  tLockReporteMs: m(120, 'ms', 'Tiempo de la función de reporte bajo el advisory lock global', `${SPEC}: 30 reportes serializados dan p95 3,6 s, 3 600 ms / 30 = 120 ms`),
  cvBd: m(0.3, 'cv', 'Variabilidad del cómputo de ruta (80-280 ms alrededor de ~180: σ ≈ 0,3 de la media)', `${SPEC}: "entre 80 y 280 ms por ruta"`),
  // --- Servicio en la aplicación ---
  tAppRutaMs: s(40, 'ms', 'CPU de la aplicación por pedido de ruta (armar 3 respuestas con geometría y riesgo)', 'medir con perfilado del API. Un API liviano (Hono) paga poca sobrecarga por petición, en la dirección de [4] (Slim, más liviano, atiende más rápido que Laravel).', ['[4]']),
  tAppReporteMs: s(15, 'ms', 'CPU de la aplicación por reporte (validar, emitir por Socket.IO)', 'medir con perfilado del API; misma lógica de stack liviano que [4].', ['[4]']),
  tAppPosicionMs: s(0.4, 'ms', 'CPU de la aplicación por posición (avanzar sesión y emitir)', 'medir con perfilado del API.'),
  tCpuReporteBdMs: s(25, 'ms', 'CPU de la base por reporte (insert, deduplicación geoespacial)', 'medir con pg_stat_statements.'),
  cvApp: s(0.5, 'cv', 'Variabilidad del servicio en la aplicación', 'en [4] la desviación estándar crece con la carga (79,8 ms a 100 muestras y 1 430 ms a 500 en Slim); se toma 0,5 como valor intermedio.', ['[4]']),
  cvLock: c(1, 'cv', 'Variabilidad bajo el lock (cola M/M/1 serializada)', 'Cola M/M/1: servicio exponencial, cv = 1 (PLAN.md).'),
  // --- Colas ---
  cuantil: m(0.95, 'p', 'Cuantil de latencia reportado (p95)', `${SPEC}: los requisitos de ruteo y tiempo real se expresan en p95`),
  z95: c(1.645, 'z', 'Cuantil normal del 95 % (cola del servicio)', 'Distribución normal estándar.'),
  // --- Red y seguridad ---
  tSaltoMs: s(1.5, 'ms', 'Latencia de un salto interno en el mismo centro de datos', 'el paso de peticiones entre el gateway y los servicios deteriora el rendimiento ([2]) y obliga a pasar por el gateway ([3]); el valor en ms es una estimación.', ['[2]', '[3]']),
  tTlsMs: s(1.5, 'ms', 'Latencia extra por salto con mTLS (registro TLS, handshake amortizado)', 'orden de ms en red interna; medir con k6.'),
  cSerializacionMs: s(0.8, 'ms', 'CPU por llamada remota (serialización JSON, cliente HTTP)', 'en [2], con servicios cortos el CPU de pasar los datos es del orden del CPU del propio servicio (el monolito atiende 1,37 a 2 veces más peticiones); la magnitud se estima.', ['[2]']),
  cTlsCpuMs: s(0.3, 'ms', 'CPU por enlace cifrado con mTLS', 'cifrado simétrico por hardware (AES-NI); medir.'),
  canalesExternos: m(2, 'canales', 'Canales externos cifrados: cliente↔API y API↔base (sslmode=require)', `${SPEC}: Supabase exige TLS`),
  pesoCoberturaSeg: s(0.6, 'peso', 'Peso de la cobertura de cifrado en el puntaje de seguridad (el resto es superficie de ataque)', 'decisión de ponderación del modelo.'),
  canalesRefSeg: s(10, 'canales', 'Canales internos que llevan la superficie de ataque a su máximo (puntaje 0)', 'decisión de escala del modelo.'),
  // --- Disponibilidad ---
  dispBdPct: s(99.9, '%', 'Disponibilidad de la base administrada (Supabase)', 'Supabase solo da SLA en planes de pago.'),
  dispLbPct: s(99.95, '%', 'Disponibilidad del balanceador administrado', 'orden de magnitud de los SLA públicos de balanceadores en nube, con margen de prudencia.'),
  dispRedisPct: s(99.9, '%', 'Disponibilidad de Redis administrado', 'orden de magnitud de un servicio administrado pequeño.'),
  dispBrokerPct: s(99.9, '%', 'Disponibilidad del broker de eventos administrado', 'orden de magnitud de un servicio administrado pequeño.'),
  dispPlanoControlPct: s(99.95, '%', 'Disponibilidad del plano de control de Kubernetes administrado', 'orden de magnitud del SLA público de un plano de control administrado.'),
  minutosMes: c(43200, 'min', 'Minutos de un mes de 30 días', '30 × 24 × 60.'),
  // --- Costos ---
  costoLbUsd: s(18, 'USD/mes', 'Balanceador de aplicación administrado', 'precio público de referencia en nube (16-22 USD).'),
  costoRedisUsd: s(15, 'USD/mes', 'Redis pequeño administrado', 'planes pequeños de 13-15 USD.'),
  costoPlanoControlUsd: s(73, 'USD/mes', 'Plano de control de Kubernetes administrado', 'precio público de referencia: 0,10 USD/h × 730 h. [2] añade que escalar verticalmente es más barato que horizontalmente en Azure; el costo de los nodos lo fija el usuario.', ['[2]']),
  costoBrokerUsd: s(30, 'USD/mes', 'Broker de eventos administrado de tamaño pequeño', 'precio público de referencia de un broker pequeño.'),
  // --- Operación ---
  memoriaBaseMb: s(512, 'MB', 'Memoria de un contenedor de aplicación (referencia)', 'tamaño típico de una instancia de Node.js. [1] midió menos memoria en microservicios en contenedores que en el monolito en VM.', ['[1]']),
  complejidadPorContenedor: s(0.05, 'puntos', 'Complejidad operativa por contenedor adicional', 'escala propia del modelo (1-10).'),
  complejidadPorCanalCifrado: s(0.05, 'puntos', 'Complejidad por canal con mTLS (certificados, rotación)', 'escala propia del modelo (1-10).'),
  complejidadMtlsBase: s(0.4, 'puntos', 'Complejidad por operar mTLS cuando hay canales internos', 'escala propia del modelo (1-10).'),
} satisfies Record<string, Param>;

export type ParamKey = keyof typeof PARAMS;

/** Valores numéricos directos: K.tLockReporteMs, K.z95, ... */
export const K = Object.fromEntries(
  Object.entries(PARAMS).map(([k, p]) => [k, p.valor]),
) as { [key in ParamKey]: number };

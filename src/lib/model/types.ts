/** Tipos del modelo. Núcleo puro: sin DOM ni dependencias de UI. */

export type AltId = 'A1' | 'A2' | 'A3' | 'A4';
export const ALT_IDS: AltId[] = ['A1', 'A2', 'A3', 'A4'];

/** Las 14 variables de entrada del escenario. */
export interface Entradas {
  usuarios: number; // domiciliarios concurrentes
  intervaloRutaS: number; // s entre pedidos de ruta por usuario
  reportesPorUsuarioHora: number;
  factorRafaga: number; // pico / promedio
  tRutaBdMs: number; // ms de cómputo de UNA ruta en la base
  vcpuBd: number;
  nodos: number; // nodos de aplicación
  vcpuNodo: number;
  latenciaRedMs: number; // API <-> base (un sentido de viaje completo, ida y vuelta)
  llamadasInternas: number; // entre servicios, por operación
  disponibilidadComponentePct: number;
  mtls: boolean;
  costoNodoUsd: number;
  costoVcpuBdUsd: number;
}

export type EntradaNum = Exclude<keyof Entradas, 'mtls'>;

/** Requisitos obligatorios del proyecto (se usan como filtro de decisión). */
export interface Requisitos {
  p95RuteoMs: number;
  p95ReporteMs: number;
  disponibilidadPct: number;
  presupuestoUsd: number;
  utilizacionMaxPct: number;
  cifradoObligatorio: boolean;
}

export interface UsuarioPrevisto {
  rol: string;
  cantidad: number;
  descripcion: string;
}

export interface CalidadReq {
  id: string;
  nombre: string;
  prioridad: number; // 1 (baja) a 5 (alta)
}

export interface Proyecto {
  nombre: string;
  descripcion: string;
  dominio: string;
  stack: string;
  usuarios: UsuarioPrevisto[];
  calidad: CalidadReq[];
  requisitos: Requisitos;
  restricciones: string;
}

export interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  entradas: Entradas;
  /** Sobrescribe requisitos del proyecto solo para este escenario (p. ej. presupuesto). */
  requisitos?: Partial<Requisitos>;
  predefinido?: boolean;
}

/** Un paso de la traza de cálculo (entrada -> fórmula -> valor). */
export interface PasoTraza {
  grupo: string;
  etiqueta: string;
  formula: string;
  valor: number;
  unidad: string;
  nota?: string;
}

export interface Indicadores {
  // Latencia
  p95RuteoMs: number;
  mediaRuteoMs: number;
  p95ReporteMs: number;
  // Demanda y capacidad
  demandaRutaRps: number;
  demandaReporteRps: number;
  capacidadRutaRps: number;
  capacidadReporteRps: number;
  usuariosMax: number;
  rechazoRutaPct: number;
  throughputRutaRps: number;
  // Utilización
  utilizacionAppPct: number;
  utilizacionBdPct: number;
  utilizacionLockPct: number;
  utilizacionMaxPct: number;
  saturadoRuta: boolean;
  saturadoReporte: boolean;
  // Disponibilidad por ruta
  dispRutaPct: number;
  dispReportePct: number;
  caidaRutaMinMes: number;
  caidaReporteMinMes: number;
  // Costos
  costoMesUsd: number;
  // Seguridad y operación
  seguridad: number; // 0-100
  coberturaCifradoPct: number;
  superficieAtaque: number;
  contenedores: number;
  memoriaMb: number;
  complejidad: number; // 1-10
  // Escalabilidad
  escalabilidad: number; // C(2N)/C(N)
  nodosEfectivos: number; // C(N)
  nOptimo: number; // N* = sqrt((1-sigma)/kappa)
}

export interface Resultado {
  alt: AltId;
  nombre: string;
  indicadores: Indicadores;
  traza: PasoTraza[];
  advertencias: string[];
}

export type CriterioId =
  | 'p95Ruteo'
  | 'p95Reporte'
  | 'capacidad'
  | 'disponibilidad'
  | 'costo'
  | 'seguridad'
  | 'complejidad'
  | 'escalabilidad';

export type Pesos = Record<CriterioId, number>;

/** Claves de fuente: artículos del curso [1]-[4], la spec de UrbanSafe, supuesto del equipo o convención matemática. */
export type RefKey = '[1]' | '[2]' | '[3]' | '[4]' | 'spec' | 'supuesto' | 'conv';

export interface Param {
  valor: number;
  unidad: string;
  descripcion: string;
  /** Justificación breve de dónde sale el valor o qué lo motiva. */
  fuente: string;
  /** Claves de fuente. Un supuesto puede llevar, además de 'supuesto', el artículo que motiva su dirección. */
  refs: RefKey[];
  /** medido = spec de UrbanSafe; literatura = valor tomado o calibrado de un artículo; supuesto = del equipo; convencion = constante matemática. */
  tipo: 'medido' | 'literatura' | 'supuesto' | 'convencion';
}

export interface CasoPrueba {
  id: number;
  nombre: string;
  descripcion: string;
  esperado: string;
  obtenido: string;
  ok: boolean;
}

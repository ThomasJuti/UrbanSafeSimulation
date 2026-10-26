/** Apoyo a la decisión: filtro de obligatorios, puntaje ponderado y explicación. */
import type { AltId, CriterioId, Indicadores, Pesos, Requisitos, Resultado } from './types';
import { ALT_IDS } from './types';
import { ALTERNATIVAS } from './alternatives';

export interface Criterio {
  id: CriterioId;
  nombre: string;
  tipo: 'beneficio' | 'costo';
  unidad: string;
  valor: (i: Indicadores) => number;
}

export const CRITERIOS: Criterio[] = [
  { id: 'p95Ruteo', nombre: 'p95 de ruteo', tipo: 'costo', unidad: 'ms', valor: (i) => i.p95RuteoMs },
  { id: 'p95Reporte', nombre: 'p95 de reporte → socket', tipo: 'costo', unidad: 'ms', valor: (i) => i.p95ReporteMs },
  { id: 'capacidad', nombre: 'Capacidad (usuarios hasta ρ = 1)', tipo: 'beneficio', unidad: 'usuarios', valor: (i) => i.usuariosMax },
  { id: 'disponibilidad', nombre: 'Disponibilidad del ruteo', tipo: 'beneficio', unidad: '%', valor: (i) => i.dispRutaPct },
  { id: 'costo', nombre: 'Costo mensual', tipo: 'costo', unidad: 'USD/mes', valor: (i) => i.costoMesUsd },
  { id: 'seguridad', nombre: 'Seguridad', tipo: 'beneficio', unidad: '/100', valor: (i) => i.seguridad },
  { id: 'complejidad', nombre: 'Complejidad operativa', tipo: 'costo', unidad: '/10', valor: (i) => i.complejidad },
  { id: 'escalabilidad', nombre: 'Escalabilidad C(2N)/C(N)', tipo: 'beneficio', unidad: '×', valor: (i) => i.escalabilidad },
];

export const PESOS_DEFECTO: Pesos = {
  p95Ruteo: 8, p95Reporte: 6, capacidad: 6, disponibilidad: 7,
  costo: 7, seguridad: 5, complejidad: 5, escalabilidad: 3,
};

export type ReqId = 'p95Ruteo' | 'p95Reporte' | 'disponibilidad' | 'presupuesto' | 'utilizacion' | 'cifrado';

export interface Cumplimiento {
  id: ReqId;
  nombre: string;
  ok: boolean;
  valor: string;
  umbral: string;
  razon: string;
  /** Violación relativa (0 si cumple); sirve para elegir la "menos mala". */
  violacion: number;
  sugerencia: string;
}

const f0 = (x: number) => Math.round(x).toLocaleString('es-CO');
const f1 = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const f2 = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const f3 = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: 3, minimumFractionDigits: 3 });
export const fmt = { f0, f1, f2, f3 };

/** Evalúa los requisitos obligatorios contra los indicadores de una alternativa. */
export function evaluarRequisitos(r: Resultado, req: Requisitos): Cumplimiento[] {
  const i = r.indicadores;
  const out: Cumplimiento[] = [];
  const maxReq = (id: ReqId, nombre: string, v: number, u: number, unidad: string, sug: string) => {
    const ok = v <= u;
    out.push({
      id, nombre, ok, valor: `${f0(v)} ${unidad}`, umbral: `≤ ${f0(u)} ${unidad}`, violacion: ok ? 0 : v / u - 1,
      razon: ok ? `${f0(v)} ${unidad} ≤ ${f0(u)} ${unidad}` : `${f0(v)} ${unidad} supera el máximo de ${f0(u)} ${unidad}`,
      sugerencia: sug,
    });
  };
  maxReq('p95Ruteo', 'p95 de ruteo', i.p95RuteoMs, req.p95RuteoMs, 'ms',
    'Aumente los núcleos de la base (vcpuBd), baje el tiempo de ruta o la latencia de red, o reduzca usuarios/ráfaga.');
  maxReq('p95Reporte', 'p95 de reporte → socket', i.p95ReporteMs, req.p95ReporteMs, 'ms',
    'Reduzca reportes por usuario o el factor de ráfaga, o elija una alternativa que reparta el lock de reportes (A4).');
  const dok = i.dispRutaPct >= req.disponibilidadPct;
  const dViol = dok ? 0 : (100 - i.dispRutaPct) / Math.max(1e-9, 100 - req.disponibilidadPct) - 1;
  out.push({
    id: 'disponibilidad', nombre: 'Disponibilidad (ruta crítica de ruteo)', ok: dok,
    valor: `${f3(i.dispRutaPct)} %`, umbral: `≥ ${f3(req.disponibilidadPct)} %`, violacion: dViol,
    razon: dok
      ? `${f3(i.dispRutaPct)} % ≥ ${f3(req.disponibilidadPct)} %`
      : `${f3(i.dispRutaPct)} % queda bajo el mínimo de ${f3(req.disponibilidadPct)} % (${f0(i.caidaRutaMinMes)} min de caída al mes)`,
    sugerencia: 'Aumente los nodos (réplicas) o la disponibilidad por componente.',
  });
  maxReq('presupuesto', 'Presupuesto', i.costoMesUsd, req.presupuestoUsd, 'USD/mes',
    'Reduzca nodos o vCPU de la base, baje los costos unitarios o suba el presupuesto.');
  maxReq('utilizacion', 'Utilización máxima', i.utilizacionMaxPct, req.utilizacionMaxPct, '%',
    'Aumente los núcleos de la base o los nodos, o reduzca usuarios y ráfaga.');
  const cok = !req.cifradoObligatorio || i.coberturaCifradoPct >= 99.999;
  out.push({
    id: 'cifrado', nombre: 'Cifrado en tránsito', ok: cok,
    valor: `${f0(i.coberturaCifradoPct)} % de canales`, umbral: req.cifradoObligatorio ? '100 % de canales' : 'no obligatorio',
    violacion: cok ? 0 : (100 - i.coberturaCifradoPct) / 100,
    razon: cok ? 'todos los canales van cifrados' : `solo ${f0(i.coberturaCifradoPct)} % de los canales va cifrado`,
    sugerencia: 'Active mTLS (cifrado interno).',
  });
  return out;
}

export interface Aporte {
  criterio: CriterioId;
  nombre: string;
  valor: number;
  normalizado: number; // 0..1
  peso: number;
  puntos: number; // aporte al puntaje (0..100)
}

export interface FilaRanking {
  alt: AltId;
  nombre: string;
  cumple: boolean;
  violacion: number;
  puntaje: number | null; // null: no entra al puntaje (no candidata)
  aportes: Aporte[];
}

export interface Sensibilidad {
  criterio: CriterioId;
  nombre: string;
  ganador: AltId;
  cambia: boolean;
}

export interface Explicacion {
  titulo: string;
  porQue: string[];
  ventajas: string[];
  limitaciones: string[];
  margen: string;
  supuestos: string[];
  sensibilidad: Sensibilidad[];
  sensibilidadTexto: string;
  faltas: { alt: AltId; req: string; razon: string; sugerencia: string }[];
}

export interface Decision {
  cumplimiento: Record<AltId, Cumplimiento[]>;
  candidatas: AltId[];
  modo: 'normal' | 'menos-mala';
  ranking: FilaRanking[];
  recomendada: AltId;
  explicacion: Explicacion;
}

export function validarPesos(p: Pesos): string | null {
  const vals = Object.values(p);
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return 'Los pesos deben ser números no negativos.';
  if (vals.every((v) => v === 0)) return 'Todos los pesos están en 0: asigne peso a al menos un criterio.';
  return null;
}

/** Puntajes min-max ponderados sobre un conjunto de alternativas. */
export function puntuar(resultados: Resultado[], pesos: Pesos): Map<AltId, { puntaje: number; aportes: Aporte[] }> {
  const sumaPesos = CRITERIOS.reduce((a, c) => a + pesos[c.id], 0);
  const out = new Map<AltId, { puntaje: number; aportes: Aporte[] }>();
  const norm = CRITERIOS.map((c) => {
    const vs = resultados.map((r) => c.valor(r.indicadores));
    return { min: Math.min(...vs), max: Math.max(...vs) };
  });
  for (const r of resultados) {
    const aportes = CRITERIOS.map((c, k) => {
      const v = c.valor(r.indicadores);
      const { min, max } = norm[k];
      const n = max === min ? 1 : c.tipo === 'beneficio' ? (v - min) / (max - min) : (max - v) / (max - min);
      return { criterio: c.id, nombre: c.nombre, valor: v, normalizado: n, peso: pesos[c.id], puntos: (100 * pesos[c.id] * n) / sumaPesos };
    });
    out.set(r.alt, { puntaje: aportes.reduce((a, x) => a + x.puntos, 0), aportes });
  }
  return out;
}

function ganador(resultados: Resultado[], pesos: Pesos, violacion: Map<AltId, number>, modo: 'normal' | 'menos-mala'): AltId {
  const pts = puntuar(resultados, pesos);
  const orden = [...resultados].sort((a, b) =>
    modo === 'menos-mala' && violacion.get(a.alt) !== violacion.get(b.alt)
      ? (violacion.get(a.alt) ?? 0) - (violacion.get(b.alt) ?? 0)
      : (pts.get(b.alt)?.puntaje ?? 0) - (pts.get(a.alt)?.puntaje ?? 0) || ALT_IDS.indexOf(a.alt) - ALT_IDS.indexOf(b.alt),
  );
  return orden[0].alt;
}

export function decidir(resultados: Resultado[], req: Requisitos, pesos: Pesos): Decision {
  const cumplimiento = {} as Record<AltId, Cumplimiento[]>;
  const violacion = new Map<AltId, number>();
  for (const r of resultados) {
    cumplimiento[r.alt] = evaluarRequisitos(r, req);
    violacion.set(r.alt, cumplimiento[r.alt].reduce((a, c) => a + c.violacion, 0));
  }
  const candidatas = resultados.filter((r) => cumplimiento[r.alt].every((c) => c.ok)).map((r) => r.alt);
  const modo = candidatas.length > 0 ? 'normal' : 'menos-mala';
  const conjunto = modo === 'normal' ? resultados.filter((r) => candidatas.includes(r.alt)) : resultados;
  const pts = puntuar(conjunto, pesos);
  const gan = ganador(conjunto, pesos, violacion, modo);

  const fila = (r: Resultado): FilaRanking => ({
    alt: r.alt, nombre: r.nombre, cumple: candidatas.includes(r.alt), violacion: violacion.get(r.alt) ?? 0,
    puntaje: pts.get(r.alt)?.puntaje ?? null, aportes: pts.get(r.alt)?.aportes ?? [],
  });
  const filas = resultados.map(fila).sort((a, b) => {
    if (modo === 'menos-mala') return a.violacion - b.violacion || (b.puntaje ?? 0) - (a.puntaje ?? 0);
    if (a.cumple !== b.cumple) return a.cumple ? -1 : 1;
    return (b.puntaje ?? 0) - (a.puntaje ?? 0) || ALT_IDS.indexOf(a.alt) - ALT_IDS.indexOf(b.alt);
  });
  // La recomendada debe encabezar el ranking.
  const ranking = [filas.find((x) => x.alt === gan)!, ...filas.filter((x) => x.alt !== gan)];

  return {
    cumplimiento, candidatas, modo, ranking, recomendada: gan,
    explicacion: explicar(resultados, conjunto, ranking, cumplimiento, pesos, violacion, modo),
  };
}

function explicar(
  todos: Resultado[], conjunto: Resultado[], ranking: FilaRanking[], cumplimiento: Record<AltId, Cumplimiento[]>,
  pesos: Pesos, violacion: Map<AltId, number>, modo: 'normal' | 'menos-mala',
): Explicacion {
  const top = ranking[0];
  const res = todos.find((r) => r.alt === top.alt)!;
  const nombreAlt = (id: AltId) => `${id} (${ALTERNATIVAS[id].nombre})`;

  // Aportes: los tres mayores.
  const aportes = [...top.aportes].filter((a) => a.peso > 0).sort((a, b) => b.puntos - a.puntos);
  const porQue = aportes.slice(0, 3).map(
    (a) => `${a.nombre}: ${f2(a.puntos)} puntos (peso ${a.peso}, normalizado ${f2(a.normalizado)}).`,
  );

  // Ventajas / limitaciones: mejor y peor entre el conjunto comparado.
  const ventajas: string[] = [];
  const limitaciones: string[] = [];
  if (conjunto.length > 1) {
    for (const c of CRITERIOS) {
      const vs = conjunto.map((r) => ({ alt: r.alt, v: c.valor(r.indicadores) }));
      const mejor = Math.max(...vs.map((x) => (c.tipo === 'beneficio' ? x.v : -x.v)));
      const peor = Math.min(...vs.map((x) => (c.tipo === 'beneficio' ? x.v : -x.v)));
      if (mejor === peor) continue;
      const mi = top.aportes.find((a) => a.criterio === c.id)!;
      const sig = c.tipo === 'beneficio' ? mi.valor : -mi.valor;
      const txt = `${c.nombre}: ${f2(mi.valor)} ${c.unidad}`;
      if (sig === mejor) ventajas.push(`Mejor en ${txt}.`);
      else if (sig === peor) limitaciones.push(`Peor en ${txt}.`);
    }
  }
  limitaciones.push(...res.advertencias);
  if (ventajas.length === 0) ventajas.push('No es la mejor en ningún criterio individual: gana por equilibrio.');
  if (limitaciones.length === 0) limitaciones.push('No es la peor en ningún criterio individual.');

  // Margen frente a la segunda.
  let margen: string;
  const segunda = ranking.find((x, k) => k > 0 && (modo === 'menos-mala' || x.cumple));
  if (modo === 'menos-mala') {
    margen = segunda
      ? `Incumple menos que ${nombreAlt(segunda.alt)} (violación relativa acumulada ${f2(top.violacion)} frente a ${f2(segunda.violacion)}).`
      : 'Única alternativa evaluada.';
  } else if (!segunda) {
    margen = 'Es la única alternativa que cumple todos los requisitos obligatorios; no hay con quién compararla en el puntaje.';
  } else {
    margen = `Supera a ${nombreAlt(segunda.alt)} por ${f2((top.puntaje ?? 0) - (segunda.puntaje ?? 0))} puntos (${f2(top.puntaje ?? 0)} frente a ${f2(segunda.puntaje ?? 0)}).`;
  }

  // Sensibilidad: duplicar cada peso y ver si cambia el ganador.
  const violMap = violacion;
  const sensibilidad: Sensibilidad[] = CRITERIOS.filter((c) => pesos[c.id] > 0).map((c) => {
    const g = ganador(conjunto, { ...pesos, [c.id]: pesos[c.id] * 2 }, violMap, modo);
    return { criterio: c.id, nombre: c.nombre, ganador: g, cambia: g !== top.alt };
  });
  const cambian = sensibilidad.filter((s) => s.cambia);
  const sensibilidadTexto = conjunto.length < 2
    ? 'Con una sola alternativa en comparación, los pesos no cambian la recomendación.'
    : cambian.length === 0
      ? 'Robusta: duplicar el peso de cualquier criterio no cambia la recomendación.'
      : `Duplicar el peso de ${cambian.map((s) => `"${s.nombre}" (pasa a ${s.ganador})`).join(', ')} cambia la recomendación.`;

  const faltas = modo === 'menos-mala'
    ? cumplimiento[top.alt].filter((c) => !c.ok).map((c) => ({ alt: top.alt, req: c.nombre, razon: c.razon, sugerencia: c.sugerencia }))
    : [];

  const supuestos = [
    'Resultados = estimaciones del modelo, no mediciones reales.',
    'Llegadas Poisson, fallos independientes, sin caché de rutas y red constante.',
    'Parámetros de sobrecarga tomados de los artículos [1]-[4] o supuestos del equipo, no medidos en UrbanSafe.',
    `Pesos usados: ${CRITERIOS.map((c) => `${c.nombre} ${pesos[c.id]}`).join('; ')}.`,
    'Normalización min-max entre las alternativas comparadas: el puntaje es relativo, no absoluto.',
  ];

  const titulo = modo === 'normal'
    ? `Se recomienda ${nombreAlt(top.alt)}`
    : `Ninguna alternativa cumple todos los obligatorios; la menos mala es ${nombreAlt(top.alt)}`;
  return { titulo, porQue, ventajas, limitaciones, margen, supuestos, sensibilidad, sensibilidadTexto, faltas };
}

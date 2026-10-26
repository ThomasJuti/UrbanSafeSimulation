/** Validación de entradas, proyecto y pesos. Los errores bloquean la ejecución. */
import type { Entradas, Pesos, Proyecto } from './types';
import { VARIABLES } from './variables';
import { validarPesos } from './decision';

export interface Validacion {
  errores: Record<string, string>;
  avisos: string[];
  ok: boolean;
}

const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function validarEntradas(e: Partial<Record<keyof Entradas, unknown>>): Validacion {
  const errores: Record<string, string> = {};
  const avisos: string[] = [];
  for (const v of VARIABLES) {
    const x = e[v.clave];
    if (v.clave === 'mtls') {
      if (typeof x !== 'boolean') errores.mtls = 'Elija sí o no.';
      continue;
    }
    if (x === '' || x === null || x === undefined) errores[v.clave] = 'Campo obligatorio.';
    else if (!esNumero(x)) errores[v.clave] = 'Debe ser un número válido.';
    else if (v.entero && !Number.isInteger(x)) errores[v.clave] = 'Debe ser un número entero.';
    else if (x < v.min || x > v.max) errores[v.clave] = `Fuera de rango: ${v.min} a ${v.max} ${v.unidad}.`;
  }
  const ll = e.llamadasInternas;
  if (esNumero(ll) && ll > 0) avisos.push('Las llamadas internas solo afectan a A3; A1, A2 y A4 las ignoran.');
  const nodos = e.nodos;
  if (esNumero(nodos) && nodos > 1) avisos.push('A1 es una sola instancia: ignora los nodos adicionales.');
  const ci = e.vcpuBd;
  if (esNumero(ci) && esNumero(e.usuarios) && esNumero(e.intervaloRutaS) && esNumero(e.tRutaBdMs) && esNumero(e.factorRafaga)) {
    const rho = ((e.usuarios / e.intervaloRutaS) * e.factorRafaga * 3 * e.tRutaBdMs) / 1000 / ci;
    if (rho >= 1) avisos.push('La base quedará saturada con esta demanda (ρ ≥ 1): se verá rechazo de pedidos.');
  }
  return { errores, avisos, ok: Object.keys(errores).length === 0 };
}

export function validarProyecto(p: Proyecto): Validacion {
  const errores: Record<string, string> = {};
  const avisos: string[] = [];
  if (!p.nombre.trim()) errores.nombre = 'El nombre es obligatorio.';
  if (!p.descripcion.trim()) errores.descripcion = 'La descripción es obligatoria.';
  const r = p.requisitos;
  const chk = (k: string, v: unknown, min: number, max: number, u: string) => {
    if (!esNumero(v)) errores[k] = 'Debe ser un número válido.';
    else if (v <= min && min === 0) errores[k] = `Debe ser mayor que 0 ${u}.`;
    else if (v < min || v > max) errores[k] = `Fuera de rango: ${min} a ${max} ${u}.`;
  };
  chk('p95RuteoMs', r.p95RuteoMs, 0, 60000, 'ms');
  chk('p95ReporteMs', r.p95ReporteMs, 0, 60000, 'ms');
  chk('disponibilidadPct', r.disponibilidadPct, 50, 100, '%');
  chk('presupuestoUsd', r.presupuestoUsd, 0, 1e7, 'USD/mes');
  chk('utilizacionMaxPct', r.utilizacionMaxPct, 0, 100, '%');
  p.usuarios.forEach((u, k) => {
    if (!u.rol.trim()) errores[`usuarios.${k}.rol`] = 'Escriba el rol.';
    if (!esNumero(u.cantidad) || u.cantidad < 0 || !Number.isInteger(u.cantidad)) errores[`usuarios.${k}.cantidad`] = 'Entero ≥ 0.';
  });
  p.calidad.forEach((c, k) => {
    if (!esNumero(c.prioridad) || c.prioridad < 1 || c.prioridad > 5) errores[`calidad.${k}.prioridad`] = 'Prioridad de 1 a 5.';
  });
  if (r.disponibilidadPct >= 100) avisos.push('Una disponibilidad de 100 % no es alcanzable por ninguna alternativa.');
  return { errores, avisos, ok: Object.keys(errores).length === 0 };
}

export function validarPesosUI(p: Pesos): Validacion {
  const msg = validarPesos(p);
  return { errores: msg ? { pesos: msg } : {}, avisos: [], ok: !msg };
}

/** Ejecución completa de un escenario: simulación + decisión. */
import type { Escenario, Pesos, Proyecto, Requisitos, Resultado } from './types';
import { simulateAll } from './simulate';
import { decidir, type Decision } from './decision';
import { validarEntradas, validarProyecto } from './validation';

export interface Ejecucion {
  valido: boolean;
  errores: Record<string, string>;
  requisitos: Requisitos;
  resultados: Resultado[];
  decision: Decision | null;
}

export function requisitosEfectivos(p: Proyecto, e: Escenario): Requisitos {
  return { ...p.requisitos, ...e.requisitos };
}

/** Si las entradas son inválidas no se ejecuta (los errores bloquean). */
export function ejecutar(e: Escenario, p: Proyecto, pesos: Pesos): Ejecucion {
  const v = validarEntradas(e.entradas);
  const vp = validarProyecto(p);
  const requisitos = requisitosEfectivos(p, e);
  if (!v.ok || !vp.ok) {
    return { valido: false, errores: { ...vp.errores, ...v.errores }, requisitos, resultados: [], decision: null };
  }
  const resultados = simulateAll(e.entradas);
  return { valido: true, errores: {}, requisitos, resultados, decision: decidir(resultados, requisitos, pesos) };
}

/** Estado de la app: persistente en localStorage y compartido entre islas. */
import { persistentAtom } from '@nanostores/persistent';
import { atom } from 'nanostores';
import type { Entradas, Escenario, Pesos, Proyecto } from '../lib/model/types';
import { PROYECTO_DEFECTO } from '../lib/model/project';
import { ESCENARIOS_PREDEFINIDOS, ID_REFERENCIA } from '../lib/model/scenarios';
import { PESOS_DEFECTO } from '../lib/model/decision';
import { validarEntradas, validarProyecto } from '../lib/model/validation';

const clone = <T,>(x: T): T => structuredClone(x);

function persistente<T>(clave: string, defecto: T) {
  return persistentAtom<T>(`urbansafe-sim:${clave}`, clone(defecto), {
    encode: JSON.stringify,
    decode: (s: string) => {
      try {
        return JSON.parse(s) as T;
      } catch {
        return clone(defecto);
      }
    },
  });
}

export const $proyecto = persistente<Proyecto>('proyecto', PROYECTO_DEFECTO);
export const $escenarios = persistente<Escenario[]>('escenarios', ESCENARIOS_PREDEFINIDOS);
export const $refId = persistente<string>('referencia', ID_REFERENCIA);
export const $pesos = persistente<Pesos>('pesos', PESOS_DEFECTO);
export const $activoId = persistente<string>('activo', ID_REFERENCIA);
/** Escenarios ejecutados con "Ejecutar todos" (solo sesión). */
export const $ejecutadoTodos = atom(false);

export function escenarioActivo(escs: Escenario[], id: string): Escenario {
  return escs.find((e) => e.id === id) ?? escs[0] ?? ESCENARIOS_PREDEFINIDOS[0];
}

export function referencia(escs: Escenario[], refId: string): Escenario {
  return escs.find((e) => e.id === refId) ?? escs[0] ?? ESCENARIOS_PREDEFINIDOS[0];
}

const nuevoId = () => `esc-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export function actualizarEscenario(id: string, cambio: Partial<Escenario>) {
  $escenarios.set($escenarios.get().map((e) => (e.id === id ? { ...e, ...cambio } : e)));
}

export function actualizarEntradas(id: string, entradas: Entradas) {
  actualizarEscenario(id, { entradas });
}

export function crearEscenario(desde?: Escenario): Escenario {
  const base = desde ?? referencia($escenarios.get(), $refId.get());
  const e: Escenario = {
    id: nuevoId(),
    nombre: desde ? `${desde.nombre} (copia)` : 'Escenario nuevo',
    descripcion: desde ? desde.descripcion : 'Escenario creado por el usuario.',
    entradas: clone(base.entradas),
    requisitos: desde?.requisitos ? clone(desde.requisitos) : undefined,
  };
  $escenarios.set([...$escenarios.get(), e]);
  $activoId.set(e.id);
  return e;
}

/** Elimina un escenario; los predefinidos y el de referencia no se eliminan. */
export function eliminarEscenario(id: string): boolean {
  const escs = $escenarios.get();
  const e = escs.find((x) => x.id === id);
  if (!e || e.predefinido || id === $refId.get() || escs.length <= 1) return false;
  $escenarios.set(escs.filter((x) => x.id !== id));
  if ($activoId.get() === id) $activoId.set($refId.get());
  return true;
}

export function restaurarTodo() {
  $proyecto.set(clone(PROYECTO_DEFECTO));
  $escenarios.set(clone(ESCENARIOS_PREDEFINIDOS));
  $refId.set(ID_REFERENCIA);
  $pesos.set(clone(PESOS_DEFECTO));
  $activoId.set(ID_REFERENCIA);
}

export const VERSION_ARCHIVO = 1;

export function exportarEstado(): string {
  return JSON.stringify(
    {
      app: 'simulador-urbansafe', version: VERSION_ARCHIVO,
      proyecto: $proyecto.get(), escenarios: $escenarios.get(), referenciaId: $refId.get(), pesos: $pesos.get(),
    },
    null, 2,
  );
}

/** Importa un JSON exportado; valida antes de reemplazar el estado. */
export function importarEstado(texto: string): { ok: boolean; error?: string } {
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  const o = d as Partial<{ app: string; proyecto: Proyecto; escenarios: Escenario[]; referenciaId: string; pesos: Pesos }>;
  if (!o || o.app !== 'simulador-urbansafe') return { ok: false, error: 'El archivo no es una exportación de este simulador.' };
  if (!o.proyecto || !Array.isArray(o.escenarios) || o.escenarios.length === 0 || !o.pesos) {
    return { ok: false, error: 'Faltan proyecto, escenarios o pesos.' };
  }
  const vp = validarProyecto(o.proyecto);
  if (!vp.ok) return { ok: false, error: `Proyecto inválido: ${Object.values(vp.errores)[0]}` };
  for (const e of o.escenarios) {
    if (!e || typeof e.id !== 'string' || !e.entradas) return { ok: false, error: 'Un escenario no tiene la forma esperada.' };
    const v = validarEntradas(e.entradas);
    if (!v.ok) return { ok: false, error: `Escenario "${e.nombre}" inválido: ${Object.values(v.errores)[0]}` };
  }
  $proyecto.set(o.proyecto);
  $escenarios.set(o.escenarios);
  $refId.set(o.escenarios.some((e) => e.id === o.referenciaId) ? (o.referenciaId as string) : o.escenarios[0].id);
  $pesos.set({ ...PESOS_DEFECTO, ...o.pesos });
  $activoId.set($refId.get());
  return { ok: true };
}

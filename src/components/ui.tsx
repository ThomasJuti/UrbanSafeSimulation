import { useStore } from '@nanostores/react';
import { $activoId, $escenarios, $pesos, $proyecto, $refId, escenarioActivo, referencia } from '../stores/state';
import type { AltId, Param } from '../lib/model/types';
import { ALTERNATIVAS } from '../lib/model/alternatives';
import { ETIQUETA_REF } from '../lib/model/references';
import { tokenCss } from './charts/setup';

export const fmt = (x: number, dec = 0) =>
  Number.isFinite(x) ? x.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

/** Aviso fijo: todo resultado es una estimación del modelo. */
export function AvisoModelo() {
  return (
    <div className="aviso-modelo" role="note">
      Resultados = estimaciones del modelo, no mediciones reales
    </div>
  );
}

export function useEstado() {
  const proyecto = useStore($proyecto);
  const escenarios = useStore($escenarios);
  const refId = useStore($refId);
  const pesos = useStore($pesos);
  const activoId = useStore($activoId);
  return {
    proyecto, escenarios, refId, pesos, activoId,
    activo: escenarioActivo(escenarios, activoId),
    ref: referencia(escenarios, refId),
  };
}

export function SelectorEscenario({ etiqueta = 'Escenario' }: { etiqueta?: string }) {
  const { escenarios, activoId, refId } = useEstado();
  return (
    <div className="field no-print" style={{ maxWidth: 460 }}>
      <label htmlFor="sel-esc">{etiqueta}</label>
      <select id="sel-esc" value={escenarioActivo(escenarios, activoId).id} onChange={(e) => $activoId.set(e.target.value)}>
        {escenarios.map((e) => (
          <option key={e.id} value={e.id}>{e.nombre}{e.id === refId ? ' (referencia)' : ''}</option>
        ))}
      </select>
    </div>
  );
}

export function AltTag({ id }: { id: AltId }) {
  return (
    <span className="th-alt">
      <span className={`dot ${id}`} aria-hidden="true" />
      {id} {ALTERNATIVAS[id].corto}
    </span>
  );
}

/** Color de la serie de cada alternativa (token --alt-N, igual en todos los gráficos). */
export const colorAlt = (id: AltId): string => tokenCss(`--alt-${id.slice(1)}`);

/** Fuentes de un parámetro: una etiqueta por clave ([1], spec, supuesto...) y la justificación. */
export function Fuente({ p }: { p: Param }) {
  return (
    <>
      <span className="refs">
        {p.refs.map((r) => (
          <span key={r} className={`tag ${r === 'spec' ? 'medido' : r === 'supuesto' ? 'supuesto' : r === 'conv' ? 'convencion' : 'literatura'}`} title={ETIQUETA_REF[r]}>{r}</span>
        ))}
      </span>
      <span className="small">{p.fuente}</span>
    </>
  );
}

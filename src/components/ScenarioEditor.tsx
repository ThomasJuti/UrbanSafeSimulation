import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $activoId, $ejecutadoTodos, $refId, actualizarEscenario, actualizarEntradas, crearEscenario, eliminarEscenario,
} from '../stores/state';
import { VARIABLES } from '../lib/model/variables';
import { validarEntradas } from '../lib/model/validation';
import type { Entradas } from '../lib/model/types';
import { K } from '../lib/model/params';
import { fmt, useEstado } from './ui';
import ScenarioMatrix from './ScenarioMatrix';

type Draft = Record<string, string | boolean>;
const aDraft = (e: Entradas): Draft => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === 'boolean' ? v : String(v)]));
const aEntradas = (d: Draft): Record<string, unknown> =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'boolean' ? v : v.trim() === '' ? '' : Number(v)]));

export default function ScenarioEditor() {
  const { escenarios, activo, ref, refId } = useEstado();
  const todos = useStore($ejecutadoTodos);
  const [draft, setDraft] = useState<Draft>(() => aDraft(activo.entradas));
  // Última versión escrita por este editor; si el store cambia por otra vía (restaurar, importar) se recarga el borrador.
  const ultima = useRef(JSON.stringify(activo.entradas));
  useEffect(() => {
    const actual = JSON.stringify(activo.entradas);
    if (actual !== ultima.current) {
      ultima.current = actual;
      setDraft(aDraft(activo.entradas));
    }
  }, [activo.entradas]);
  useEffect(() => {
    ultima.current = JSON.stringify(activo.entradas);
    setDraft(aDraft(activo.entradas));
  }, [activo.id]);

  const candidatas = useMemo(() => aEntradas(draft), [draft]);
  const val = useMemo(() => validarEntradas(candidatas), [candidatas]);
  const efectivas = val.ok ? (candidatas as unknown as Entradas) : activo.entradas;

  function cambiar(k: string, v: string | boolean) {
    const nuevo = { ...draft, [k]: v };
    setDraft(nuevo);
    const c = aEntradas(nuevo);
    if (validarEntradas(c).ok) {
      ultima.current = JSON.stringify(c);
      actualizarEntradas(activo.id, c as unknown as Entradas);
    }
  }

  const lamRuta = (efectivas.usuarios / efectivas.intervaloRutaS) * efectivas.factorRafaga;
  const lamRep = ((efectivas.usuarios * efectivas.reportesPorUsuarioHora) / 3600) * efectivas.factorRafaga;
  const lamPos = efectivas.usuarios * K.posicionesPorUsuarioS;
  const cambios = VARIABLES.filter((v) => activo.entradas[v.clave] !== ref.entradas[v.clave]).length;

  return (
    <div>
      <div className="layout-side">
        <aside className="card" aria-label="Lista de escenarios">
          <h2>Escenarios</h2>
          <ul className="sc-list">
            {escenarios.map((e) => (
              <li key={e.id}>
                <button type="button" aria-current={e.id === activo.id} onClick={() => $activoId.set(e.id)}>
                  {e.nombre}
                  <div className="hint">{e.id === refId ? 'Referencia' : e.predefinido ? 'Predefinido' : 'Propio'}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => crearEscenario()}>Nuevo</button>
            <button type="button" onClick={() => crearEscenario(activo)}>Duplicar</button>
            <button type="button" className="danger" disabled={activo.predefinido || activo.id === refId}
              title={activo.predefinido ? 'Los predefinidos no se eliminan' : activo.id === refId ? 'Cambie la referencia antes de eliminarlo' : ''}
              onClick={() => { if (confirm(`¿Eliminar "${activo.nombre}"?`)) eliminarEscenario(activo.id); }}>Eliminar</button>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" disabled={activo.id === refId} onClick={() => $refId.set(activo.id)}>Marcar como referencia</button>
            <button type="button" className="primary" onClick={() => $ejecutadoTodos.set(true)}>Ejecutar todos</button>
          </div>
        </aside>

        <section className="card" aria-labelledby="h-edit">
          <h2 id="h-edit">Editor del escenario</h2>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="e-nombre">Nombre</label>
              <input id="e-nombre" type="text" value={activo.nombre} onChange={(x) => actualizarEscenario(activo.id, { nombre: x.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="e-desc">Descripción</label>
              <input id="e-desc" type="text" value={activo.descripcion} onChange={(x) => actualizarEscenario(activo.id, { descripcion: x.target.value })} />
            </div>
          </div>

          <div className="card-inset" aria-live="polite">
            <h3>Demanda derivada (en vivo)</h3>
            <div className="kv">
              <span>λ ruteo = usuarios / intervalo × ráfaga</span><strong>{fmt(lamRuta, 2)} pedidos/s</strong>
              <span>λ reporte = usuarios × reportes/h / 3600 × ráfaga</span><strong>{fmt(lamRep, 3)} reportes/s</strong>
              <span>λ posición = usuarios × 1 posición/s</span><strong>{fmt(lamPos, 0)} posiciones/s</strong>
            </div>
            <p className="hint" style={{ margin: '8px 0 0' }}>
              {activo.id === ref.id ? 'Este es el escenario de referencia.' : `${cambios} variable(s) distinta(s) de la referencia (resaltadas).`}
              {activo.requisitos && Object.keys(activo.requisitos).length > 0 && (
                <> Requisitos propios de este escenario: {Object.entries(activo.requisitos).map(([k, v]) => `${k} = ${v}`).join(', ')}.</>
              )}
            </p>
          </div>

          {!val.ok && (
            <div className="alert bad" role="alert" style={{ marginTop: 12 }}>
              Hay {Object.keys(val.errores).length} error(es). Mientras no se corrijan, los resultados siguen usando los últimos valores válidos.
            </div>
          )}
          {val.avisos.map((a) => <div key={a} className="alert warn" style={{ marginTop: 12 }}>{a}</div>)}

          <div className="fields-grid" style={{ marginTop: 16 }}>
            {VARIABLES.map((v) => {
              const err = val.errores[v.clave];
              const cambio = activo.id !== ref.id && activo.entradas[v.clave] !== ref.entradas[v.clave];
              const id = `v-${v.clave}`;
              return (
                <div key={v.clave} className={`field${cambio ? ' changed' : ''}`}>
                  <label htmlFor={id}>{v.etiqueta}</label>
                  {v.clave === 'mtls' ? (
                    <select id={id} value={draft.mtls ? 'si' : 'no'} onChange={(x) => cambiar('mtls', x.target.value === 'si')}>
                      <option value="si">Sí</option><option value="no">No</option>
                    </select>
                  ) : (
                    <div className="input-unit">
                      <input id={id} type="number" inputMode="decimal" step={v.paso} value={String(draft[v.clave] ?? '')}
                        aria-invalid={!!err} aria-describedby={`${id}-h`} onChange={(x) => cambiar(v.clave, x.target.value)} />
                      <span className="u">{v.unidad}</span>
                    </div>
                  )}
                  <div id={`${id}-h`}>
                    {err ? <div className="err">{err}</div> : (
                      <div className="hint">
                        {v.clave !== 'mtls' && <>Rango {v.min}–{v.max}. </>}{v.ayuda}
                        {cambio && <> Referencia: <strong>{typeof ref.entradas[v.clave] === 'boolean' ? (ref.entradas[v.clave] ? 'sí' : 'no') : String(ref.entradas[v.clave])}</strong>.</>}
                      </div>
                    )}
                    <details><summary className="hint">Justificación</summary><div className="hint">{v.justificacion}</div></details>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="hint">
            <a href="/resultados">Ver resultados de este escenario</a> · <a href="/decision">Ver la decisión</a>
          </p>
        </section>
      </div>
      {todos && <div style={{ marginTop: 16 }}><ScenarioMatrix /></div>}
    </div>
  );
}

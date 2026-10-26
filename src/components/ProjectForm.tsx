import { useMemo } from 'react';
import { $proyecto } from '../stores/state';
import { validarProyecto } from '../lib/model/validation';
import { PROYECTO_DEFECTO } from '../lib/model/project';
import type { Proyecto, Requisitos } from '../lib/model/types';
import { useEstado } from './ui';

export default function ProjectForm() {
  const { proyecto: p } = useEstado();
  const val = useMemo(() => validarProyecto(p), [p]);
  const set = (cambio: Partial<Proyecto>) => $proyecto.set({ ...p, ...cambio });
  const setReq = (k: keyof Requisitos, v: number | boolean) => set({ requisitos: { ...p.requisitos, [k]: v } });
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const e = val.errores;

  const reqs: { k: Exclude<keyof Requisitos, 'cifradoObligatorio'>; etiqueta: string; unidad: string; ayuda: string }[] = [
    { k: 'p95RuteoMs', etiqueta: 'p95 de ruteo (3 opciones) ≤', unidad: 'ms', ayuda: 'spec §7: menos de 1,5 s.' },
    { k: 'p95ReporteMs', etiqueta: 'p95 de reporte → socket ≤', unidad: 'ms', ayuda: 'spec §7: menos de 1 s.' },
    { k: 'disponibilidadPct', etiqueta: 'Disponibilidad de la ruta crítica (ruteo) ≥', unidad: '%', ayuda: 'Se evalúa sobre la ruta síncrona de ruteo.' },
    { k: 'presupuestoUsd', etiqueta: 'Presupuesto ≤', unidad: 'USD/mes', ayuda: 'Por defecto 150 USD/mes (supuesto del equipo: base administrada + 1-2 nodos pequeños); editable.' },
    { k: 'utilizacionMaxPct', etiqueta: 'Utilización máxima ≤', unidad: '%', ayuda: 'Holgura: por encima de 80 % las colas crecen rápido.' },
  ];

  return (
    <div className="layout-form">
      <div>
        <section className="card" aria-labelledby="h-ficha">
          <h2 id="h-ficha">Ficha del proyecto</h2>
          <div className="field">
            <label htmlFor="p-nombre">Nombre</label>
            <input id="p-nombre" type="text" value={p.nombre} aria-invalid={!!e.nombre} aria-describedby="e-nombre" onChange={(x) => set({ nombre: x.target.value })} />
            {e.nombre && <div id="e-nombre" className="err">{e.nombre}</div>}
          </div>
          <div className="field">
            <label htmlFor="p-desc">Descripción</label>
            <textarea id="p-desc" value={p.descripcion} aria-invalid={!!e.descripcion} onChange={(x) => set({ descripcion: x.target.value })} />
            {e.descripcion && <div className="err">{e.descripcion}</div>}
          </div>
          <div className="field">
            <label htmlFor="p-dom">Dominio</label>
            <input id="p-dom" type="text" value={p.dominio} onChange={(x) => set({ dominio: x.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="p-stack">Stack actual</label>
            <textarea id="p-stack" value={p.stack} onChange={(x) => set({ stack: x.target.value })} />
          </div>
        </section>

        <section className="card" aria-labelledby="h-usr">
          <h2 id="h-usr">Usuarios previstos</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rol</th><th className="num">Cantidad</th><th>Descripción</th><th><span className="sr-only">Quitar</span></th></tr></thead>
              <tbody>
                {p.usuarios.map((u, k) => (
                  <tr key={k}>
                    <td>
                      <input type="text" aria-label={`Rol ${k + 1}`} value={u.rol} aria-invalid={!!e[`usuarios.${k}.rol`]}
                        onChange={(x) => set({ usuarios: p.usuarios.map((y, j) => (j === k ? { ...y, rol: x.target.value } : y)) })} />
                      {e[`usuarios.${k}.rol`] && <div className="err">{e[`usuarios.${k}.rol`]}</div>}
                    </td>
                    <td style={{ minWidth: 90 }}>
                      <input type="number" aria-label={`Cantidad ${k + 1}`} value={Number.isFinite(u.cantidad) ? u.cantidad : ''} aria-invalid={!!e[`usuarios.${k}.cantidad`]}
                        onChange={(x) => set({ usuarios: p.usuarios.map((y, j) => (j === k ? { ...y, cantidad: num(x.target.value) } : y)) })} />
                      {e[`usuarios.${k}.cantidad`] && <div className="err">{e[`usuarios.${k}.cantidad`]}</div>}
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <input type="text" aria-label={`Descripción ${k + 1}`} value={u.descripcion}
                        onChange={(x) => set({ usuarios: p.usuarios.map((y, j) => (j === k ? { ...y, descripcion: x.target.value } : y)) })} />
                    </td>
                    <td><button type="button" aria-label={`Quitar ${u.rol}`} onClick={() => set({ usuarios: p.usuarios.filter((_, j) => j !== k) })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => set({ usuarios: [...p.usuarios, { rol: 'Nuevo rol', cantidad: 1, descripcion: '' }] })}>Agregar fila</button>
            <button type="button" onClick={() => set({ usuarios: PROYECTO_DEFECTO.usuarios })}>Restaurar usuarios</button>
          </div>
        </section>

        <section className="card" aria-labelledby="h-cal">
          <h2 id="h-cal">Requisitos de calidad y prioridad</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Requisito</th><th>Prioridad (1 baja – 5 alta)</th></tr></thead>
              <tbody>
                {p.calidad.map((c, k) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td style={{ minWidth: 200 }}>
                      <div className="input-unit">
                        <input type="range" min={1} max={5} step={1} value={c.prioridad} aria-label={`Prioridad de ${c.nombre}`}
                          onChange={(x) => set({ calidad: p.calidad.map((y, j) => (j === k ? { ...y, prioridad: Number(x.target.value) } : y)) })} />
                        <strong>{c.prioridad}</strong>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>La prioridad documenta la intención del equipo; los pesos de la decisión se ajustan en la página Decisión.</p>
        </section>
      </div>

      <div>
        <section className="card" aria-labelledby="h-req">
          <h2 id="h-req">Requisitos obligatorios</h2>
          <p className="hint">Una alternativa que incumpla alguno se descarta en la decisión, con la razón.</p>
          {reqs.map((r) => (
            <div className="field" key={r.k}>
              <label htmlFor={`r-${r.k}`}>{r.etiqueta}</label>
              <div className="input-unit">
                <input id={`r-${r.k}`} type="number" step="any" value={Number.isFinite(p.requisitos[r.k]) ? p.requisitos[r.k] : ''}
                  aria-invalid={!!e[r.k]} aria-describedby={`h-${r.k}`}
                  onChange={(x) => setReq(r.k, num(x.target.value))} />
                <span className="u">{r.unidad}</span>
              </div>
              {e[r.k] ? <div className="err" id={`h-${r.k}`}>{e[r.k]}</div> : <div className="hint" id={`h-${r.k}`}>{r.ayuda}</div>}
            </div>
          ))}
          <div className="field">
            <label>
              <input type="checkbox" checked={p.requisitos.cifradoObligatorio} onChange={(x) => setReq('cifradoObligatorio', x.target.checked)} />{' '}
              Cifrado en tránsito obligatorio
            </label>
            <div className="hint">Supabase exige sslmode=require. Exige 100 % de canales cifrados (mTLS interno si hay canales internos).</div>
          </div>
          <button type="button" onClick={() => set({ requisitos: PROYECTO_DEFECTO.requisitos })}>Restaurar requisitos</button>
        </section>

        <section className="card" aria-labelledby="h-res">
          <h2 id="h-res">Restricciones</h2>
          <label htmlFor="p-restr" className="sr-only">Restricciones, una por línea</label>
          <textarea id="p-restr" value={p.restricciones} onChange={(x) => set({ restricciones: x.target.value })} />
          <p className="hint">Una por línea.</p>
        </section>

        <section className="card" aria-live="polite">
          <h2>Validación</h2>
          {val.ok ? <div className="alert ok">Proyecto válido.</div> : (
            <div className="alert bad">Hay {Object.keys(e).length} error(es). Los escenarios no usarán estos requisitos hasta corregirlos.</div>
          )}
          {val.avisos.map((a) => <div key={a} className="alert warn">{a}</div>)}
        </section>
      </div>
    </div>
  );
}

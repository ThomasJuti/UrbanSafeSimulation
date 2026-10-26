import { useMemo } from 'react';
import { $pesos } from '../stores/state';
import { ejecutar } from '../lib/model/run';
import { CRITERIOS, PESOS_DEFECTO, validarPesos, fmt as fmtD } from '../lib/model/decision';
import { ALT_IDS } from '../lib/model/types';
import { ALTERNATIVAS } from '../lib/model/alternatives';
import { AltTag, AvisoModelo, SelectorEscenario, fmt, useEstado } from './ui';

export default function DecisionView() {
  const { activo, proyecto, pesos, escenarios } = useEstado();
  const run = useMemo(() => ejecutar(activo, proyecto, pesos), [activo, proyecto, pesos]);
  const errPesos = validarPesos(pesos);
  const d = run.decision;
  const todos = useMemo(
    () => escenarios.map((e) => ({ e, x: ejecutar(e, proyecto, pesos) })),
    [escenarios, proyecto, pesos],
  );

  return (
    <div>
      <AvisoModelo />
      <SelectorEscenario />

      <div className="layout-form">
        <section className="card no-print" aria-labelledby="h-pesos">
          <h2 id="h-pesos">Pesos por criterio</h2>
          <p className="hint">0 = no importa, 10 = máxima importancia. El puntaje normaliza cada criterio con min-max entre las alternativas candidatas.</p>
          <div className="weights">
            {CRITERIOS.map((c) => (
              <div className="field" key={c.id}>
                <label htmlFor={`w-${c.id}`}>{c.nombre} <span className="tag">{c.tipo === 'costo' ? 'menor es mejor' : 'mayor es mejor'}</span></label>
                <div className="input-unit">
                  <input id={`w-${c.id}`} type="range" min={0} max={10} step={1} value={pesos[c.id]}
                    onChange={(x) => $pesos.set({ ...pesos, [c.id]: Number(x.target.value) })} />
                  <strong style={{ minWidth: 22, textAlign: 'right' }}>{pesos[c.id]}</strong>
                </div>
              </div>
            ))}
          </div>
          {errPesos && <div className="alert bad" role="alert">{errPesos}</div>}
          <button type="button" onClick={() => $pesos.set({ ...PESOS_DEFECTO })}>Restaurar pesos</button>
        </section>

        <section className="card" aria-labelledby="h-req">
          <h2 id="h-req">Cumplimiento de obligatorios</h2>
          {!run.valido ? (
            <div className="alert bad" role="alert">Entradas o requisitos inválidos: {Object.values(run.errores)[0]}</div>
          ) : d && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Requisito</th>{ALT_IDS.map((a) => <th key={a}><AltTag id={a} /></th>)}</tr></thead>
                <tbody>
                  {d.cumplimiento.A1.map((c, k) => (
                    <tr key={c.id}>
                      <td>{c.nombre}<div className="hint">{c.umbral}</div></td>
                      {ALT_IDS.map((a) => {
                        const x = d.cumplimiento[a][k];
                        return (
                          <td key={a} className={x.ok ? '' : 'fail'}>
                            <span aria-label={x.ok ? 'cumple' : 'no cumple'}>{x.ok ? '✔' : '✘'}</span>{' '}
                            <span className="small">{x.razon}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {run.valido && d && !errPesos && (
        <>
          <section className={`card reco ${d.modo}`} style={{ marginTop: 16 }} aria-labelledby="h-reco">
            <p className="hint">Recomendación para: {activo.nombre}</p>
            <h2 id="h-reco">{d.explicacion.titulo}</h2>
            {d.modo === 'menos-mala' && (
              <div className="alert warn" role="alert">
                <strong>Ninguna alternativa cumple todos los requisitos obligatorios.</strong> Se muestra la que menos los incumple.
                <ul className="tight" style={{ marginTop: 6 }}>
                  {d.explicacion.faltas.map((f) => <li key={f.req}><strong>{f.req}:</strong> {f.razon}. <em>Qué ajustar:</em> {f.sugerencia}</li>)}
                </ul>
              </div>
            )}
            <div className="grid cols-2" style={{ gap: 16 }}>
              <div>
                <h3>Por qué</h3>
                <ul className="tight">{d.explicacion.porQue.map((t) => <li key={t}>{t}</li>)}</ul>
                <p><strong>Margen:</strong> {d.explicacion.margen}</p>
                <p><strong>Sensibilidad:</strong> {d.explicacion.sensibilidadTexto}</p>
              </div>
              <div>
                <h3>Ventajas</h3>
                <ul className="tight">{d.explicacion.ventajas.map((t) => <li key={t}>{t}</li>)}</ul>
                <h3>Limitaciones</h3>
                <ul className="tight">{d.explicacion.limitaciones.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
            <details>
              <summary>Supuestos y sensibilidad por criterio</summary>
              <ul className="tight">{d.explicacion.supuestos.map((t) => <li key={t}>{t}</li>)}</ul>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Si se duplica el peso de…</th><th>Recomendación</th><th>¿Cambia?</th></tr></thead>
                  <tbody>
                    {d.explicacion.sensibilidad.map((s) => (
                      <tr key={s.criterio}><td>{s.nombre}</td><td>{s.ganador}</td><td>{s.cambia ? <span className="tag warn">sí</span> : <span className="tag ok">no</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="hint"><strong>Resultados = estimaciones del modelo, no mediciones reales.</strong></p>
          </section>

          <section className="card" aria-labelledby="h-rank">
            <h2 id="h-rank">Ranking</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Alternativa</th><th>Estado</th><th style={{ minWidth: 220 }}>Puntaje (0-100)</th><th>Aportes por criterio (puntos)</th></tr></thead>
                <tbody>
                  {d.ranking.map((f, k) => (
                    <tr key={f.alt}>
                      <td>{k + 1}</td>
                      <td><AltTag id={f.alt} /><div className="hint">{f.nombre}</div></td>
                      <td>{f.cumple ? <span className="tag ok">cumple</span> : <span className="tag bad">no cumple</span>}{d.modo === 'menos-mala' && <div className="hint">violación {fmt(f.violacion, 2)}</div>}</td>
                      <td>
                        {f.puntaje === null ? <span className="muted">Descartada</span> : (
                          <>
                            <div className="bar-track" role="img" aria-label={`Puntaje ${fmt(f.puntaje, 1)} de 100`}><div className="bar-fill" style={{ width: `${f.puntaje}%`, background: `var(--alt-${f.alt.slice(1)})` }} /></div>
                            <strong>{fmt(f.puntaje, 1)}</strong>
                          </>
                        )}
                      </td>
                      <td className="small">{f.aportes.filter((a) => a.peso > 0).map((a) => `${a.nombre}: ${fmtD.f1(a.puntos)}`).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="card" aria-labelledby="h-todos">
        <h2 id="h-todos">Recomendación por escenario</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Escenario</th><th>Recomendada</th><th>Modo</th><th>Candidatas</th><th>Margen / razón</th></tr></thead>
            <tbody>
              {todos.map(({ e, x }) => (
                <tr key={e.id}>
                  <td>{e.nombre}</td>
                  {x.decision ? (
                    <>
                      <td><AltTag id={x.decision.recomendada} /><div className="hint">{ALTERNATIVAS[x.decision.recomendada].nombre}</div></td>
                      <td>{x.decision.modo === 'normal' ? <span className="tag ok">cumple obligatorios</span> : <span className="tag warn">menos mala</span>}</td>
                      <td>{x.decision.candidatas.join(', ') || 'ninguna'}</td>
                      <td className="small">{x.decision.explicacion.margen}</td>
                    </>
                  ) : <td colSpan={4} className="err">Entradas inválidas</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errPesos && <p className="err">{errPesos}</p>}
      </section>
    </div>
  );
}

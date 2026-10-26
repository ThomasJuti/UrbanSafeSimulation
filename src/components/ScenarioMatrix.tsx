import { useMemo, useState } from 'react';
import { ejecutar } from '../lib/model/run';
import type { Indicadores, AltId } from '../lib/model/types';
import { ALT_IDS } from '../lib/model/types';
import { ALTERNATIVAS } from '../lib/model/alternatives';
import { AltTag, fmt, useEstado } from './ui';

const METRICAS: { id: string; nombre: string; unidad: string; dec: number; v: (i: Indicadores) => number; menorMejor: boolean }[] = [
  { id: 'p95r', nombre: 'p95 de ruteo', unidad: 'ms', dec: 0, v: (i) => i.p95RuteoMs, menorMejor: true },
  { id: 'p95p', nombre: 'p95 de reporte → socket', unidad: 'ms', dec: 0, v: (i) => i.p95ReporteMs, menorMejor: true },
  { id: 'cap', nombre: 'Usuarios hasta ρ = 1', unidad: 'usuarios', dec: 0, v: (i) => i.usuariosMax, menorMejor: false },
  { id: 'disp', nombre: 'Disponibilidad del ruteo', unidad: '%', dec: 3, v: (i) => i.dispRutaPct, menorMejor: false },
  { id: 'costo', nombre: 'Costo mensual', unidad: 'USD/mes', dec: 0, v: (i) => i.costoMesUsd, menorMejor: true },
];

/** Tabla escenarios × alternativas con diferencia frente a la referencia. */
export default function ScenarioMatrix() {
  const { escenarios, proyecto, pesos, ref } = useEstado();
  const [m, setM] = useState('p95r');
  const metrica = METRICAS.find((x) => x.id === m) ?? METRICAS[0];
  const filas = useMemo(
    () => escenarios.map((e) => ({ e, x: ejecutar(e, proyecto, pesos) })),
    [escenarios, proyecto, pesos],
  );
  const base = filas.find((f) => f.e.id === ref.id)?.x;
  const valor = (x: typeof base, a: AltId) => x?.resultados.find((r) => r.alt === a)?.indicadores;

  return (
    <section className="card" aria-labelledby="h-matriz">
      <h2 id="h-matriz">Escenarios × alternativas</h2>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="m-metrica">Indicador</label>
        <select id="m-metrica" value={m} onChange={(e) => setM(e.target.value)}>
          {METRICAS.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.unidad})</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Escenario</th>
              {ALT_IDS.map((a) => <th key={a} className="num"><AltTag id={a} /></th>)}
              <th>Recomendación</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ e, x }) => (
              <tr key={e.id}>
                <td>{e.nombre}{e.id === ref.id && <> <span className="tag">referencia</span></>}</td>
                {ALT_IDS.map((a) => {
                  const i = valor(x, a);
                  const i0 = valor(base, a);
                  if (!i) return <td key={a} className="num muted">—</td>;
                  const v = metrica.v(i);
                  const d = i0 && e.id !== ref.id && metrica.v(i0) !== 0 ? ((v - metrica.v(i0)) / metrica.v(i0)) * 100 : null;
                  const peor = d !== null && (metrica.menorMejor ? d > 0.05 : d < -0.05);
                  const mejor = d !== null && (metrica.menorMejor ? d < -0.05 : d > 0.05);
                  return (
                    <td key={a} className="num">
                      {fmt(v, metrica.dec)}
                      {d !== null && <div className="hint" style={{ color: peor ? 'var(--danger)' : mejor ? 'var(--safe)' : undefined }}>
                        {d > 0 ? '+' : ''}{fmt(d, 1)} % vs ref.
                      </div>}
                    </td>
                  );
                })}
                <td>
                  {!x.valido ? <span className="tag bad">entradas inválidas</span> : x.decision && (
                    <>
                      <strong>{x.decision.recomendada}</strong> {ALTERNATIVAS[x.decision.recomendada].corto}
                      {x.decision.modo === 'menos-mala' && <> <span className="tag warn">menos mala</span></>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Resultados = estimaciones del modelo, no mediciones reales. La diferencia es frente al escenario de referencia.</p>
    </section>
  );
}

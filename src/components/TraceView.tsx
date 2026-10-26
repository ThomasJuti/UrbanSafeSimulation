import { useState } from 'react';
import type { Resultado } from '../lib/model/types';
import { AltTag, AvisoModelo, fmt } from './ui';

/** Traza de cálculo paso a paso de una alternativa. */
export default function TraceView({ resultados }: { resultados: Resultado[] }) {
  const [id, setId] = useState(resultados[0]?.alt ?? 'A1');
  const r = resultados.find((x) => x.alt === id) ?? resultados[0];
  if (!r) return null;
  const grupos = [...new Set(r.traza.map((p) => p.grupo))];
  return (
    <section className="card" aria-labelledby="h-traza">
      <h2 id="h-traza">Traza de cálculo</h2>
      <AvisoModelo />
      <p className="muted">Cada fila muestra la fórmula y el valor calculado con las entradas del escenario y los parámetros de <a href="/modelo">Modelo</a>. Nada está predefinido.</p>
      <div className="btn-row no-print" role="tablist" aria-label="Alternativa de la traza" style={{ marginBottom: 12 }}>
        {resultados.map((x) => (
          <button key={x.alt} type="button" role="tab" aria-selected={x.alt === id} onClick={() => setId(x.alt)}>
            {x.alt}
          </button>
        ))}
      </div>
      <h3><AltTag id={r.alt} /> · {r.nombre}</h3>
      {r.advertencias.map((a) => <div key={a} className="alert warn">{a}</div>)}
      {grupos.map((g) => (
        <details key={g} open={g.startsWith('1.') || g.startsWith('4.') || g.startsWith('5.')}>
          <summary>{g}</summary>
          <div className="table-wrap" style={{ marginBottom: 8 }}>
            <table>
              <thead><tr><th>Magnitud</th><th>Fórmula</th><th className="num">Valor</th><th>Unidad</th></tr></thead>
              <tbody>
                {r.traza.filter((p) => p.grupo === g).map((p, k) => (
                  <tr key={k}>
                    <td>{p.etiqueta}{p.nota && <div className="hint">{p.nota}</div>}</td>
                    <td className="mono">{p.formula}</td>
                    <td className="num"><strong>{fmt(p.valor, Math.abs(p.valor) < 10 ? 3 : Math.abs(p.valor) < 1000 ? 1 : 0)}</strong></td>
                    <td>{p.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}

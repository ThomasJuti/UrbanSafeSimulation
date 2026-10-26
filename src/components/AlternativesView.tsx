import { LISTA_ALTERNATIVAS } from '../lib/model/alternatives';
import { ETIQUETA_REF } from '../lib/model/references';
import { Fuente, fmt } from './ui';

export default function AlternativesView() {
  return (
    <div className="grid cols-2">
      {LISTA_ALTERNATIVAS.map((a) => (
        <article key={a.id} className="card" style={{ marginTop: 0 }} aria-labelledby={`alt-${a.id}`}>
          <h2 id={`alt-${a.id}`}><span className={`dot ${a.id}`} aria-hidden="true" />{a.id} · {a.nombre}</h2>
          <p>{a.descripcion}</p>
          <div className="flow" role="img" aria-label={`Diagrama: ${a.flujo.join(' a ')}`}>
            {a.flujo.map((f, k) => (
              <span key={f} style={{ display: 'contents' }}>
                {k > 0 && <span className="arrow" aria-hidden="true">→</span>}
                <span className="box">{f}</span>
              </span>
            ))}
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div>
              <h3>Ventajas</h3>
              <ul className="tight">{a.ventajas.map((v) => <li key={v}>{v}</li>)}</ul>
            </div>
            <div>
              <h3>Limitaciones</h3>
              <ul className="tight">{a.limitaciones.map((v) => <li key={v}>{v}</li>)}</ul>
            </div>
          </div>
          <p className="small muted"><strong>Fuentes:</strong> {a.referencias.map((r) => ETIQUETA_REF[r] + (r.startsWith('[') ? ` ${r}` : '')).join(' · ')}. Citas completas en <a href="/modelo#referencias">Modelo, Referencias</a>.</p>
          <details>
            <summary>Parámetros del modelo que la distinguen</summary>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Parámetro</th><th className="num">Valor</th><th>Fuente</th></tr></thead>
                <tbody>
                  {Object.entries(a.params).map(([k, p]) => (
                    <tr key={k}>
                      <td>{p.descripcion}<div className="hint mono">{k}</div></td>
                      <td className="num">{fmt(p.valor, p.valor < 1 && p.valor > 0 ? 4 : 2).replace(/,?0+$/, '')} {p.unidad}</td>
                      <td><Fuente p={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}

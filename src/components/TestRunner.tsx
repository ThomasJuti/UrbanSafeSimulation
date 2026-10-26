import { useMemo, useState } from 'react';
import { ejecutarCasos } from '../lib/model/testCases';
import type { CasoPrueba, Entradas } from '../lib/model/types';
import { validarEntradas } from '../lib/model/validation';
import { ENTRADAS_REFERENCIA } from '../lib/model/scenarios';
import { VARIABLES } from '../lib/model/variables';

export default function TestRunner() {
  const [casos, setCasos] = useState<CasoPrueba[] | null>(null);
  const [clave, setClave] = useState<keyof Entradas>('usuarios');
  const [texto, setTexto] = useState('-5');
  const v = VARIABLES.find((x) => x.clave === clave)!;

  const val = useMemo(() => {
    const valor: unknown = clave === 'mtls' ? (texto === 'si') : texto.trim() === '' ? '' : Number(texto);
    return validarEntradas({ ...ENTRADAS_REFERENCIA, [clave]: valor });
  }, [clave, texto]);

  const aprobadas = casos?.filter((c) => c.ok).length ?? 0;
  return (
    <div className="layout-form">
      <section className="card" aria-labelledby="h-tests">
        <h2 id="h-tests">Pruebas del modelo</h2>
        <p className="muted">Son las mismas 12 pruebas que corre Vitest (<code>npm run test</code>), ejecutadas aquí en el navegador con el mismo código del modelo.</p>
        <button type="button" className="primary" onClick={() => setCasos(ejecutarCasos())}>Ejecutar las 12 pruebas</button>
        {casos && (
          <>
            <div className={`alert ${aprobadas === casos.length ? 'ok' : 'bad'}`} role="status" style={{ marginTop: 12 }}>
              {aprobadas} de {casos.length} pruebas aprobadas.
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Prueba</th><th>Esperado</th><th>Obtenido</th><th>Resultado</th></tr></thead>
                <tbody>
                  {casos.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td><strong>{c.nombre}</strong><div className="hint">{c.descripcion}</div></td>
                      <td className="small">{c.esperado}</td>
                      <td className="small">{c.obtenido}</td>
                      <td className={c.ok ? 'best' : 'fail'}><span aria-label={c.ok ? 'aprobada' : 'fallida'}>{c.ok ? '✔' : '✘'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="h-val">
        <h2 id="h-val">Demo de validación de entradas</h2>
        <p className="muted">Pruebe un valor inválido sobre la referencia: el validador bloquea la ejecución y explica el motivo. Pruebe con -5, vacío, abc, 2,5 en un entero o un valor fuera de rango.</p>
        <div className="field">
          <label htmlFor="d-var">Variable</label>
          <select id="d-var" value={clave} onChange={(e) => { setClave(e.target.value as keyof Entradas); setTexto(''); }}>
            {VARIABLES.map((x) => <option key={x.clave} value={x.clave}>{x.etiqueta}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-val">Valor ({v.unidad}; rango {v.min}–{v.max})</label>
          {clave === 'mtls' ? (
            <select id="d-val" value={texto} onChange={(e) => setTexto(e.target.value)}><option value="si">Sí</option><option value="no">No</option><option value="">(vacío)</option></select>
          ) : (
            <input id="d-val" type="text" inputMode="decimal" value={texto} aria-invalid={!val.ok} onChange={(e) => setTexto(e.target.value)} />
          )}
        </div>
        {val.ok ? (
          <div className="alert ok" role="status">Entrada válida: la ejecución se permite.</div>
        ) : (
          <div className="alert bad" role="alert">Ejecución bloqueada. {Object.values(val.errores).join(' ')}</div>
        )}
        {val.avisos.map((a) => <div key={a} className="alert warn">{a}</div>)}
      </section>
    </div>
  );
}

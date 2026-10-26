import { useMemo } from 'react';
import { ejecutar } from '../lib/model/run';
import { simulateAll } from '../lib/model/simulate';
import { CRITERIOS, puntuar } from '../lib/model/decision';
import { ALT_IDS, type Indicadores } from '../lib/model/types';
import { ALTERNATIVAS } from '../lib/model/alternatives';
import { tokenCss } from './charts/setup';
import { AltTag, AvisoModelo, colorAlt, SelectorEscenario, fmt, useEstado } from './ui';
import BarChart from './charts/BarChart';
import RadarChart from './charts/RadarChart';
import LineChart from './charts/LineChart';
import TraceView from './TraceView';
import ScenarioMatrix from './ScenarioMatrix';

interface Fila {
  nombre: string;
  v: (i: Indicadores) => number;
  dec: number;
  unidad: string;
  menorMejor?: boolean;
  mayorMejor?: boolean;
  falla?: (i: Indicadores, r: ReturnType<typeof ejecutar>['requisitos']) => boolean;
}

const FILAS: Fila[] = [
  { nombre: 'p95 de ruteo', v: (i) => i.p95RuteoMs, dec: 0, unidad: 'ms', menorMejor: true, falla: (i, r) => i.p95RuteoMs > r.p95RuteoMs },
  { nombre: 'p95 de reporte → socket', v: (i) => i.p95ReporteMs, dec: 0, unidad: 'ms', menorMejor: true, falla: (i, r) => i.p95ReporteMs > r.p95ReporteMs },
  { nombre: 'Latencia media de ruteo', v: (i) => i.mediaRuteoMs, dec: 0, unidad: 'ms', menorMejor: true },
  { nombre: 'Demanda de ruteo', v: (i) => i.demandaRutaRps, dec: 2, unidad: 'pedidos/s' },
  { nombre: 'Capacidad máx. de ruteo', v: (i) => i.capacidadRutaRps, dec: 1, unidad: 'pedidos/s', mayorMejor: true },
  { nombre: 'Capacidad máx. de reportes (lock)', v: (i) => i.capacidadReporteRps, dec: 1, unidad: 'reportes/s', mayorMejor: true },
  { nombre: 'Usuarios hasta ρ = 1', v: (i) => i.usuariosMax, dec: 0, unidad: 'usuarios', mayorMejor: true },
  { nombre: 'Rechazo de ruteo (503)', v: (i) => i.rechazoRutaPct, dec: 1, unidad: '%', menorMejor: true },
  { nombre: 'Utilización de la aplicación', v: (i) => i.utilizacionAppPct, dec: 0, unidad: '%', menorMejor: true },
  { nombre: 'Utilización de la base', v: (i) => i.utilizacionBdPct, dec: 0, unidad: '%', menorMejor: true, falla: (i, r) => i.utilizacionBdPct > r.utilizacionMaxPct },
  { nombre: 'Utilización del lock de reportes', v: (i) => i.utilizacionLockPct, dec: 0, unidad: '%', menorMejor: true },
  { nombre: 'Disponibilidad del ruteo (ruta crítica)', v: (i) => i.dispRutaPct, dec: 3, unidad: '%', mayorMejor: true, falla: (i, r) => i.dispRutaPct < r.disponibilidadPct },
  { nombre: 'Disponibilidad de reporte/alertas', v: (i) => i.dispReportePct, dec: 3, unidad: '%', mayorMejor: true },
  { nombre: 'Caída al mes (ruteo)', v: (i) => i.caidaRutaMinMes, dec: 0, unidad: 'min', menorMejor: true },
  { nombre: 'Costo mensual', v: (i) => i.costoMesUsd, dec: 0, unidad: 'USD', menorMejor: true, falla: (i, r) => i.costoMesUsd > r.presupuestoUsd },
  { nombre: 'Seguridad', v: (i) => i.seguridad, dec: 0, unidad: '/100', mayorMejor: true },
  { nombre: 'Cobertura de cifrado', v: (i) => i.coberturaCifradoPct, dec: 0, unidad: '%', mayorMejor: true },
  { nombre: 'Superficie de ataque (canales internos)', v: (i) => i.superficieAtaque, dec: 0, unidad: 'canales', menorMejor: true },
  { nombre: 'Contenedores', v: (i) => i.contenedores, dec: 0, unidad: 'u.', menorMejor: true },
  { nombre: 'Memoria estimada', v: (i) => i.memoriaMb, dec: 0, unidad: 'MB', menorMejor: true },
  { nombre: 'Complejidad operativa', v: (i) => i.complejidad, dec: 1, unidad: '/10', menorMejor: true },
  { nombre: 'Escalabilidad C(2N)/C(N)', v: (i) => i.escalabilidad, dec: 2, unidad: '×', mayorMejor: true },
  { nombre: 'N óptimo (USL)', v: (i) => i.nOptimo, dec: 0, unidad: 'nodos' },
];

const MULT = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export default function ResultsView() {
  // Series de dos métricas (no son alternativas): primario y gris de la paleta de gráficos.
  const S1 = tokenCss('--chart-4');
  const S2 = tokenCss('--chart-5');
  const { activo, proyecto, pesos } = useEstado();
  const run = useMemo(() => ejecutar(activo, proyecto, pesos), [activo, proyecto, pesos]);
  const rs = run.resultados;

  const curva = useMemo(() => {
    if (!run.valido) return null;
    const por = ALT_IDS.map((a) => MULT.map((m) => {
      const r = simulateAll({ ...activo.entradas, usuarios: Math.max(1, activo.entradas.usuarios * m) }).find((x) => x.alt === a)!;
      return Math.min(r.indicadores.p95RuteoMs, 15000);
    }));
    return por;
  }, [activo, run.valido]);

  const radar = useMemo(() => {
    if (!run.valido) return null;
    const pts = puntuar(rs, Object.fromEntries(CRITERIOS.map((c) => [c.id, 1])) as typeof pesos);
    return ALT_IDS.map((a) => pts.get(a)!.aportes.map((x) => x.normalizado));
  }, [rs, run.valido]);

  return (
    <div>
      <AvisoModelo />
      <SelectorEscenario />
      <p className="muted">{activo.descripcion}</p>

      {!run.valido ? (
        <div className="alert bad" role="alert">
          Las entradas o los requisitos son inválidos y bloquean la ejecución: {Object.values(run.errores)[0]} Corríjalos en <a href="/escenarios">Escenarios</a> o <a href="/">Proyecto</a>.
        </div>
      ) : (
        <>
          <section className="card" aria-labelledby="h-comp">
            <h2 id="h-comp">Comparación de alternativas</h2>
            <p className="hint">En verde, la mejor alternativa por fila; en rojo, el valor que incumple un requisito obligatorio.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Indicador</th>{rs.map((r) => <th key={r.alt} className="num"><AltTag id={r.alt} /></th>)}<th>Unidad</th></tr>
                </thead>
                <tbody>
                  {FILAS.map((f) => {
                    const vs = rs.map((r) => f.v(r.indicadores));
                    const mejor = f.menorMejor ? Math.min(...vs) : f.mayorMejor ? Math.max(...vs) : null;
                    const hayDif = Math.max(...vs) !== Math.min(...vs);
                    return (
                      <tr key={f.nombre}>
                        <td>{f.nombre}</td>
                        {rs.map((r, k) => {
                          const falla = f.falla?.(r.indicadores, run.requisitos);
                          return <td key={r.alt} className={`num ${falla ? 'fail' : mejor !== null && hayDif && vs[k] === mejor ? 'best' : ''}`}>{fmt(vs[k], f.dec)}</td>;
                        })}
                        <td className="muted">{f.unidad}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rs.some((r) => r.advertencias.length > 0) && (
              <div style={{ marginTop: 12 }}>
                {rs.flatMap((r) => r.advertencias.map((a) => <div key={r.alt + a} className="alert warn"><strong>{r.alt}:</strong> {a}</div>))}
              </div>
            )}
            <p className="hint">Disponibilidad del requisito = ruta crítica síncrona (ruteo). Para A2 el ruteo no depende de Redis y para A4 no depende del broker; la ruta de reporte/alertas sí, y se muestra aparte.</p>
          </section>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <section className="card" style={{ marginTop: 0 }} aria-labelledby="h-g1">
              <h2 id="h-g1">p95 de latencia</h2>
              <BarChart titulo="p95 de ruteo y de reporte por alternativa" yTitle="ms" labels={rs.map((r) => r.alt)}
                series={[
                  { label: 'p95 ruteo', data: rs.map((r) => r.indicadores.p95RuteoMs), color: S1 },
                  { label: 'p95 reporte', data: rs.map((r) => r.indicadores.p95ReporteMs), color: S2 },
                ]} />
              <p className="hint">Requisitos: ruteo ≤ {fmt(run.requisitos.p95RuteoMs)} ms, reporte ≤ {fmt(run.requisitos.p95ReporteMs)} ms.</p>
            </section>
            <section className="card" style={{ marginTop: 0 }} aria-labelledby="h-g2">
              <h2 id="h-g2">Capacidad frente a demanda</h2>
              <BarChart titulo="Capacidad máxima de ruteo frente a demanda" yTitle="pedidos/s" labels={rs.map((r) => r.alt)}
                series={[
                  { label: 'Capacidad (ρ = 1)', data: rs.map((r) => r.indicadores.capacidadRutaRps), color: S1 },
                  { label: 'Demanda', data: rs.map((r) => r.indicadores.demandaRutaRps), color: S2 },
                ]} />
            </section>
            <section className="card" style={{ marginTop: 0 }} aria-labelledby="h-g3">
              <h2 id="h-g3">Disponibilidad (caída al mes)</h2>
              <BarChart titulo="Minutos de caída al mes por alternativa" yTitle="min/mes" labels={rs.map((r) => r.alt)}
                series={[
                  { label: 'Ruteo', data: rs.map((r) => r.indicadores.caidaRutaMinMes), color: S1 },
                  { label: 'Reporte/alertas', data: rs.map((r) => r.indicadores.caidaReporteMinMes), color: S2 },
                ]} />
            </section>
            <section className="card" style={{ marginTop: 0 }} aria-labelledby="h-g4">
              <h2 id="h-g4">Costo mensual</h2>
              <BarChart titulo="Costo mensual por alternativa" yTitle="USD/mes" labels={rs.map((r) => r.alt)}
                series={[{ label: 'USD/mes', data: rs.map((r) => r.indicadores.costoMesUsd), color: rs.map((r) => colorAlt(r.alt)) }]} />
              <p className="hint">Presupuesto: {fmt(run.requisitos.presupuestoUsd)} USD/mes.</p>
            </section>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <section className="card" style={{ marginTop: 0 }} aria-labelledby="h-radar">
              <h2 id="h-radar">Radar de puntajes normalizados</h2>
              {radar && <RadarChart titulo="Puntajes normalizados por criterio" labels={CRITERIOS.map((c) => c.nombre)}
                series={ALT_IDS.map((a, k) => ({ label: `${a} ${ALTERNATIVAS[a].corto}`, data: radar[k], color: colorAlt(a) }))} />}
              <p className="hint">1 = mejor alternativa en ese criterio, 0 = peor (min-max entre las 4).</p>
            </section>
            <section className="card" style={{ marginTop: 0 }} aria-labelledby="h-curva">
              <h2 id="h-curva">p95 de ruteo frente a la carga</h2>
              {curva && <LineChart titulo="p95 de ruteo según la carga relativa" xTitle="Carga (× usuarios del escenario)" yTitle="p95 ruteo (ms, tope 15 000)"
                labels={MULT.map((m) => `${m}×`)} limite={{ valor: run.requisitos.p95RuteoMs, etiqueta: 'Requisito' }}
                series={ALT_IDS.map((a, k) => ({ label: `${a} ${ALTERNATIVAS[a].corto}`, data: curva[k], color: colorAlt(a), dash: a === 'A3' ? [4, 3] : a === 'A4' ? [8, 3] : undefined }))} />}
              <p className="hint">Varía los usuarios de 0,1× a 3×. Donde las curvas se separan o se cruzan cambia la mejor alternativa.</p>
            </section>
          </div>

          <div style={{ marginTop: 16 }}><TraceView resultados={rs} /></div>
        </>
      )}
      <div style={{ marginTop: 16 }}><ScenarioMatrix /></div>
    </div>
  );
}

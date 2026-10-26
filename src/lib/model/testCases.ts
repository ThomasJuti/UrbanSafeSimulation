/**
 * Casos de prueba del modelo: datos + funciones puras.
 * No importa vitest: lo usan `*.test.ts` (Vitest) y la página /pruebas (navegador).
 */
import type { CasoPrueba, Entradas, AltId } from './types';
import { ALT_IDS } from './types';
import { erlangC, erlangCWq, sakasegawaWq, usl, uslNOptimo } from './queueing';
import { simulate, simulateAll } from './simulate';
import { ALTERNATIVAS } from './alternatives';
import { ENTRADAS_REFERENCIA } from './scenarios';
import { PROYECTO_DEFECTO } from './project';
import { decidir, PESOS_DEFECTO, CRITERIOS } from './decision';
import { validarEntradas } from './validation';
import type { Pesos } from './types';

const ref = ENTRADAS_REFERENCIA;
const ind = (alt: AltId, patch: Partial<Entradas> = {}) => simulate({ ...ref, ...patch }, alt).indicadores;
const n0 = (x: number) => x.toFixed(0);
const n3 = (x: number) => x.toFixed(3);

type Evaluacion = Omit<CasoPrueba, 'id'>;

const CASOS: { nombre: string; descripcion: string; run: () => { esperado: string; obtenido: string; ok: boolean } }[] = [
  {
    nombre: 'Erlang C y Sakasegawa',
    descripcion: 'Erlang C(c=2, a=1) = 1/3 y Sakasegawa ≈ Erlang C exacto (error relativo de la espera ≤ 20 %) en c ∈ {1,2,4,8}, ρ ∈ {0,7; 0,8; 0,9}, donde la aproximación está pensada para operar (con ρ bajo sobrestima una espera ya despreciable).',
    run: () => {
      const c2 = erlangC(2, 1);
      let peor = 0;
      for (const c of [1, 2, 4, 8]) for (const rho of [0.7, 0.8, 0.9]) {
        const ex = erlangCWq(1, c, rho);
        peor = Math.max(peor, Math.abs(sakasegawaWq(1, c, rho) - ex) / ex);
      }
      return {
        esperado: 'C(2,1) = 0,3333 y error máximo ≤ 20 %',
        obtenido: `C(2,1) = ${c2.toFixed(4)}; error máximo = ${(peor * 100).toFixed(1)} %`,
        ok: Math.abs(c2 - 1 / 3) < 1e-9 && peor <= 0.2,
      };
    },
  },
  {
    nombre: 'Ley de Escalabilidad Universal',
    descripcion: 'C(1) = 1 y C(N) ≤ N para N = 1..64; C alcanza su máximo cerca de N* = √((1−σ)/κ).',
    run: () => {
      const { sigma, kappa } = ALTERNATIVAS.A2.k;
      let cota = true;
      for (const x of ALT_IDS.slice(1)) {
        const k = ALTERNATIVAS[x].k;
        for (let n = 1; n <= 64; n++) if (usl(n, k.sigma, k.kappa) > n + 1e-12) cota = false;
      }
      const nStar = uslNOptimo(sigma, kappa);
      const mejor = Math.round(nStar);
      const pico = usl(mejor, sigma, kappa) >= usl(mejor - 3, sigma, kappa) && usl(mejor, sigma, kappa) >= usl(mejor + 3, sigma, kappa);
      return { esperado: 'C(1) = 1; C(N) ≤ N; máximo en N*', obtenido: `C(1) = ${usl(1, sigma, kappa)}; C(N) ≤ N: ${cota}; N* (A2) = ${nStar.toFixed(1)}, pico: ${pico}`,
        ok: usl(1, sigma, kappa) === 1 && cota && pico };
    },
  },
  {
    nombre: 'Latencia monótona con los usuarios',
    descripcion: 'El p95 de ruteo y de reporte no disminuye al subir los usuarios (10 → 2 000) en las 4 alternativas.',
    run: () => {
      let ok = true;
      let detalle = '';
      for (const alt of ALT_IDS) {
        let a = -1, b = -1;
        for (const u of [10, 30, 60, 100, 200, 400, 800, 1500, 2000]) {
          const i = ind(alt, { usuarios: u });
          if (i.p95RuteoMs < a - 1e-9 || i.p95ReporteMs < b - 1e-9) { ok = false; detalle = ` (falla ${alt} en ${u})`; }
          a = i.p95RuteoMs; b = i.p95ReporteMs;
        }
      }
      return { esperado: 'No decrece en ninguna alternativa', obtenido: ok ? 'No decrece en A1-A4' : `Decrece${detalle}`, ok };
    },
  },
  {
    nombre: 'Con carga baja y 1 nodo, el monolito es más rápido',
    descripcion: 'Coherente con los artículos: los saltos de red entre servicios cuestan. A1 < A3 y A1 < A4 en p95 de ruteo.',
    run: () => {
      const p = { usuarios: 5, nodos: 1 };
      const [a1, a3, a4] = [ind('A1', p), ind('A3', p), ind('A4', p)];
      return { esperado: 'p95(A1) < p95(A3) y p95(A4)',
        obtenido: `A1 ${n0(a1.p95RuteoMs)} ms; A3 ${n0(a3.p95RuteoMs)} ms; A4 ${n0(a4.p95RuteoMs)} ms`,
        ok: a1.p95RuteoMs < a3.p95RuteoMs && a1.p95RuteoMs < a4.p95RuteoMs };
    },
  },
  {
    nombre: 'Con carga alta y muchos nodos, A2/A3 superan a A1 en capacidad',
    descripcion: '3 000 usuarios, base de 64 vCPU y 20 nodos de 4 vCPU: usuarios hasta ρ = 1 de A2 y A3 mayores que los de A1.',
    run: () => {
      const p = { usuarios: 3000, vcpuBd: 64, nodos: 20, vcpuNodo: 4 };
      const [a1, a2, a3] = [ind('A1', p), ind('A2', p), ind('A3', p)];
      return { esperado: 'A2 > A1 y A3 > A1',
        obtenido: `A1 ${n0(a1.usuariosMax)}; A2 ${n0(a2.usuariosMax)}; A3 ${n0(a3.usuariosMax)} usuarios`,
        ok: a2.usuariosMax > a1.usuariosMax && a3.usuariosMax > a1.usuariosMax };
    },
  },
  {
    nombre: 'ρ ≥ 1 marca saturación y rechazo',
    descripcion: 'Con ráfaga de 20× la base se satura: se marca saturación, hay rechazo y el rendimiento queda en la capacidad (sin NaN ni Infinity).',
    run: () => {
      const s = ind('A1', { factorRafaga: 20 });
      const bajo = ind('A1', { usuarios: 5 });
      const finito = Object.values(s).every((v) => typeof v !== 'number' || Number.isFinite(v));
      return { esperado: 'saturado = sí, rechazo > 0, rendimiento = capacidad; con 5 usuarios sin saturación',
        obtenido: `ρ_bd = ${n0(s.utilizacionBdPct)} %; rechazo ${n0(s.rechazoRutaPct)} %; rendimiento ${s.throughputRutaRps.toFixed(2)} vs capacidad ${s.capacidadRutaRps.toFixed(2)}; 5 usuarios: saturado = ${bajo.saturadoRuta}`,
        ok: s.saturadoRuta && s.rechazoRutaPct > 0 && Math.abs(s.throughputRutaRps - s.capacidadRutaRps) < 1e-6 && !bajo.saturadoRuta && bajo.rechazoRutaPct === 0 && finito };
    },
  },
  {
    nombre: 'Más réplicas, más disponibilidad',
    descripcion: 'Al pasar de 1 a 3 nodos sube la disponibilidad de ruteo en A2, A3 y A4 (componente 99,5 %).',
    run: () => {
      const p = { disponibilidadComponentePct: 99.5 };
      const filas = (['A2', 'A3', 'A4'] as AltId[]).map((a) => [a, ind(a, { ...p, nodos: 1 }).dispRutaPct, ind(a, { ...p, nodos: 3 }).dispRutaPct] as const);
      return { esperado: 'A(3 nodos) > A(1 nodo)',
        obtenido: filas.map(([a, x, y]) => `${a}: ${n3(x)} → ${n3(y)} %`).join('; '),
        ok: filas.every(([, x, y]) => y > x) };
    },
  },
  {
    nombre: 'mTLS sube la latencia y la seguridad',
    descripcion: 'Activar mTLS aumenta el p95 de ruteo y el puntaje de seguridad en A2, A3 y A4.',
    run: () => {
      const filas = (['A2', 'A3', 'A4'] as AltId[]).map((a) => ({ a, off: ind(a, { mtls: false }), on: ind(a, { mtls: true }) }));
      return { esperado: 'p95 y seguridad mayores con mTLS',
        obtenido: filas.map((f) => `${f.a}: ${n0(f.off.p95RuteoMs)}→${n0(f.on.p95RuteoMs)} ms, seg ${n0(f.off.seguridad)}→${n0(f.on.seguridad)}`).join('; '),
        ok: filas.every((f) => f.on.p95RuteoMs > f.off.p95RuteoMs && f.on.seguridad > f.off.seguridad) };
    },
  },
  {
    nombre: 'El filtro de obligatorios excluye lo que incumple',
    descripcion: 'Con presupuesto de 100 USD/mes en la referencia, A2 y A3 (>100 USD) quedan fuera con la razón de presupuesto; A1 sigue como candidata.',
    run: () => {
      const req = { ...PROYECTO_DEFECTO.requisitos, presupuestoUsd: 100 };
      const d = decidir(simulateAll(ref), req, PESOS_DEFECTO);
      const razon = d.cumplimiento.A3.find((c) => c.id === 'presupuesto');
      return { esperado: 'A2 y A3 excluidas por presupuesto; A1 candidata',
        obtenido: `candidatas: ${d.candidatas.join(', ')}; A3: ${razon?.razon ?? '—'}`,
        ok: !d.candidatas.includes('A2') && !d.candidatas.includes('A3') && d.candidatas.includes('A1') && razon?.ok === false };
    },
  },
  {
    nombre: 'Cambiar los pesos puede cambiar la recomendación',
    descripcion: 'Poniendo todo el peso en un solo criterio (uno por vez) se obtienen al menos dos recomendaciones distintas.',
    run: () => {
      const res = simulateAll(ref);
      const gan = new Map<string, string>();
      for (const c of CRITERIOS) {
        const p = Object.fromEntries(CRITERIOS.map((x) => [x.id, x.id === c.id ? 10 : 0])) as Pesos;
        gan.set(c.id, decidir(res, PROYECTO_DEFECTO.requisitos, p).recomendada);
      }
      const dist = new Set(gan.values());
      return { esperado: '≥ 2 ganadores distintos', obtenido: [...gan].map(([k, v]) => `${k}→${v}`).join(', '), ok: dist.size >= 2 };
    },
  },
  {
    nombre: 'El validador rechaza entradas inválidas',
    descripcion: 'Negativos, NaN, vacíos, fuera de rango y no enteros generan error; las entradas de referencia son válidas.',
    run: () => {
      const malos: Partial<Record<keyof Entradas, unknown>>[] = [
        { usuarios: -5 }, { usuarios: NaN }, { usuarios: '' }, { vcpuBd: 100 }, { nodos: 2.5 }, { disponibilidadComponentePct: 50 }, { latenciaRedMs: -1 },
      ];
      const rechazados = malos.filter((m) => !validarEntradas({ ...ref, ...m }).ok).length;
      const refOk = validarEntradas(ref).ok;
      return { esperado: '7 de 7 rechazadas; referencia válida', obtenido: `${rechazados} de ${malos.length} rechazadas; referencia válida: ${refOk}`,
        ok: rechazados === malos.length && refOk };
    },
  },
  {
    nombre: 'Calibración con las mediciones de UrbanSafe',
    descripcion: 'Referencia: p95 de ruteo sostenido en 1-2 s (medido 1,38 s) y latencia media sin carga en 0,6-0,9 s. Ráfaga: A1 no cumple 1,5 s de ruteo (medido 3,5-10,6 s) y su p95 de reporte supera 1 s (medido 3,6 s).',
    run: () => {
      const s = ind('A1');
      const sinCarga = ind('A1', { usuarios: 1 });
      const r = ind('A1', { factorRafaga: 20, reportesPorUsuarioHora: 60 });
      const ok = s.p95RuteoMs >= 1000 && s.p95RuteoMs <= 2000 && sinCarga.mediaRuteoMs >= 600 && sinCarga.mediaRuteoMs <= 900 &&
        r.p95RuteoMs > 1500 && r.p95ReporteMs > 1000;
      return { esperado: 'sostenido 1 000-2 000 ms; sin carga 600-900 ms; ráfaga ruteo > 1 500 ms y reporte > 1 000 ms',
        obtenido: `sostenido ${n0(s.p95RuteoMs)} ms; sin carga ${n0(sinCarga.mediaRuteoMs)} ms; ráfaga ruteo ${n0(r.p95RuteoMs)} ms, reporte ${n0(r.p95ReporteMs)} ms`, ok };
    },
  },
];

function ejecutar(c: (typeof CASOS)[number], id: number): CasoPrueba {
  try {
    const r = c.run();
    return { id, nombre: c.nombre, descripcion: c.descripcion, ...r };
  } catch (err) {
    const e: Evaluacion = { nombre: c.nombre, descripcion: c.descripcion, esperado: 'sin excepciones', obtenido: `Excepción: ${String(err)}`, ok: false };
    return { id, ...e };
  }
}

/** Ejecuta los 12 casos y devuelve esperado/obtenido/ok. */
export function ejecutarCasos(): CasoPrueba[] {
  return CASOS.map((c, k) => ejecutar(c, k + 1));
}

/**
 * simulate(entradas, alternativa) -> indicadores + traza.
 * Modelo de colas de dos niveles (aplicación y base) más la cola serializada
 * del advisory lock de reportes. Todo valor sale de las entradas, de
 * `params.ts` y de `alternatives.ts`.
 */
import type { AltId, Entradas, Indicadores, PasoTraza, Resultado } from './types';
import { K } from './params';
import { ALTERNATIVAS } from './alternatives';
import { colaTier, usl, uslNOptimo } from './queueing';

/** Evita NaN/Infinity en cualquier valor que llegue a la UI. */
const fin = (x: number, resp = 0): number => (Number.isFinite(x) ? x : resp);
const MS = 1000;

export function simulate(entrada: Entradas, id: AltId): Resultado {
  const alt = ALTERNATIVAS[id];
  const e = entrada;
  const traza: PasoTraza[] = [];
  const adv: string[] = [];
  const t = (grupo: string, etiqueta: string, formula: string, valor: number, unidad: string, nota?: string) =>
    traza.push({ grupo, etiqueta, formula, valor: fin(valor, 0), unidad, nota });

  // 1. Demanda ---------------------------------------------------------
  const lamRuta = (e.usuarios / e.intervaloRutaS) * e.factorRafaga;
  const lamRep = ((e.usuarios * e.reportesPorUsuarioHora) / 3600) * e.factorRafaga;
  const lamPos = e.usuarios * K.posicionesPorUsuarioS;
  t('1. Demanda', 'λ ruteo', 'usuarios / intervalo × ráfaga', lamRuta, 'pedidos/s');
  t('1. Demanda', 'λ reporte', 'usuarios × reportes/h / 3600 × ráfaga', lamRep, 'reportes/s');
  t('1. Demanda', 'λ posición', 'usuarios × posiciones/s', lamPos, 'posiciones/s');

  // 2. Servicio en la aplicación ---------------------------------------
  const hR = alt.saltosRuta(e);
  const hP = alt.saltosReporte(e);
  const cSalto = K.cSerializacionMs + (e.mtls ? K.cTlsCpuMs : 0);
  const sAppRuta = K.tAppRutaMs * alt.k.overheadApp + hR * cSalto;
  const sAppRep = K.tAppReporteMs * alt.k.overheadApp + hP * cSalto;
  const sAppPos = K.tAppPosicionMs * alt.k.overheadApp;
  t('2. Servicio en la aplicación', 'Saltos internos (ruteo / reporte)', 'según la alternativa', hR, 'saltos', `reporte: ${hP}`);
  t('2. Servicio en la aplicación', 'CPU por salto', 'c_serialización + c_TLS (si mTLS)', cSalto, 'ms');
  t('2. Servicio en la aplicación', 'S_app ruteo', 'base × overhead_a + saltos × CPU por salto', sAppRuta, 'ms');
  t('2. Servicio en la aplicación', 'S_app reporte', 'base × overhead_a + saltos × CPU por salto', sAppRep, 'ms');
  t('2. Servicio en la aplicación', 'S_app posición', 'base × overhead_a', sAppPos, 'ms');

  // 3. Capacidad efectiva ----------------------------------------------
  const n = alt.nodosUsados(e);
  if (id === 'A1' && e.nodos !== 1) adv.push(`A1 es una sola instancia: se ignoran los ${e.nodos} nodos y se usa N = 1.`);
  if (id !== 'A3' && e.llamadasInternas > 0) adv.push('Las llamadas internas solo afectan a A3 (microservicios); aquí se ignoran.');
  const cn = usl(n, alt.k.sigma, alt.k.kappa);
  const cApp = e.vcpuNodo * (1 - alt.k.overheadPlataforma) * cn;
  const nOpt = id === 'A1' || alt.k.kappa === 0 ? 1 : uslNOptimo(alt.k.sigma, alt.k.kappa);
  if (n > nOpt) adv.push(`N = ${n} supera el óptimo de la USL (N* ≈ ${nOpt.toFixed(0)}): más nodos reducen la capacidad.`);
  const cBd = e.vcpuBd * (1 + alt.k.replicasBd);
  t('3. Capacidad efectiva', 'N usado', 'A1 fija N = 1', n, 'nodos');
  t('3. Capacidad efectiva', 'C(N) USL', `N / (1 + σ(N−1) + κN(N−1)), σ=${alt.k.sigma}, κ=${alt.k.kappa}`, cn, 'nodos efectivos');
  t('3. Capacidad efectiva', 'c_eff aplicación', 'vCPU_nodo × (1 − overhead_plataforma) × C(N)', cApp, 'vCPU');
  t('3. Capacidad efectiva', 'c_eff base', 'vCPU_bd × (1 + réplicas de lectura)', cBd, 'vCPU');

  // 4. Colas ------------------------------------------------------------
  const sBdRuta = K.rutasPorPedido * e.tRutaBdMs;
  const sBdRep = K.tCpuReporteBdMs;
  const lamApp = lamRuta + lamRep + lamPos;
  const sApp = (lamRuta * sAppRuta + lamRep * sAppRep + lamPos * sAppPos) / lamApp;
  const lamBd = lamRuta + lamRep;
  const sBd = (lamRuta * sBdRuta + lamRep * sBdRep) / lamBd;
  const app = colaTier({ lambda: lamApp, s: sApp / MS, c: cApp, cv: K.cvApp, colaMax: K.colaMaxRuteo }, K.cuantil);
  const bd = colaTier({ lambda: lamBd, s: sBd / MS, c: cBd, cv: K.cvBd, colaMax: K.colaMaxRuteo }, K.cuantil);
  const lock = colaTier(
    { lambda: lamRep, s: K.tLockReporteMs / MS, c: alt.k.particionesLock, cv: K.cvLock, colaMax: e.usuarios },
    K.cuantil,
  );
  t('4. Colas', 'S_bd ruteo', 'rutas por pedido × t_ruta', sBdRuta, 'ms');
  t('4. Colas', 'S medio aplicación', 'Σ λ_i·S_i / Σ λ_i', sApp, 'ms');
  t('4. Colas', 'S medio base', 'Σ λ_i·S_i / Σ λ_i (ruteo + insert)', sBd, 'ms');
  t('4. Colas', 'ρ aplicación', 'Σ λ·S / c_eff', app.rho, '');
  t('4. Colas', 'ρ base', 'Σ λ·S / c_eff', bd.rho, '');
  t('4. Colas', 'ρ lock de reportes', 'λ_rep · S_lock / particiones', lock.rho, '');
  t('4. Colas', 'P_w aplicación / base', 'Sakasegawa: ρ^(√(2(c+1))−1)', app.pw, '', `base: ${bd.pw.toFixed(3)}`);
  t('4. Colas', 'W_q medio base', 'S·ρ^(√(2(c+1))−1) / (c(1−ρ)) × (1+cv²)/2', bd.wqMedia * MS, 'ms',
    bd.saturado ? `Saturado: tope = cola máx. × S / c = ${(bd.tope * MS).toFixed(0)} ms` : undefined);
  t('4. Colas', 'W_q p95 aplicación', 'ln(P_w / 0,05) / θ', app.wq95 * MS, 'ms');
  t('4. Colas', 'W_q p95 base', 'ln(P_w / 0,05) / θ, θ = (cμ−λ)·2/(1+cv²)', bd.wq95 * MS, 'ms');
  t('4. Colas', 'W_q p95 lock', 'cola M/M/1 serializada (ρ ≥ 1: cola = usuarios × S_lock)', lock.wq95 * MS, 'ms');

  // 5. Latencias --------------------------------------------------------
  const salto = K.tSaltoMs + (e.mtls ? K.tTlsMs : 0);
  const netRuta = e.latenciaRedMs * K.viajesBdRuta;
  const netRep = e.latenciaRedMs * K.viajesBdReporte;
  const sBd95 = sBdRuta * (1 + K.z95 * K.cvBd);
  const p95Ruta = netRuta + hR * salto + sAppRuta + app.wq95 * MS + sBd95 + bd.wq95 * MS;
  const mediaRuta = netRuta + hR * salto + sAppRuta + app.wqMedia * MS + sBdRuta + bd.wqMedia * MS;
  const p95Rep = netRep + hP * salto + sAppRep + app.wq95 * MS + K.tLockReporteMs + lock.wq95 * MS;
  t('5. Latencia', 'Red ruteo', 'latencia × viajes a la base', netRuta, 'ms');
  t('5. Latencia', 'Saltos internos', 'saltos × (t_salto + t_TLS si mTLS)', hR * salto, 'ms', `reporte: ${(hP * salto).toFixed(1)} ms`);
  t('5. Latencia', 'S_bd p95', 'S_bd × (1 + z95 × cv)', sBd95, 'ms');
  t('5. Latencia', 'Latencia media ruteo', 'red + saltos + S_app + W_q,app + S_bd + W_q,bd', mediaRuta, 'ms');
  t('5. Latencia', 'p95 ruteo', 'red + saltos + S_app + W_q95,app + S_bd,95 + W_q95,bd', p95Ruta, 'ms');
  t('5. Latencia', 'p95 reporte → socket', 'red + saltos + S_app + W_q95,app + S_lock + W_q95,lock', p95Rep, 'ms',
    'Los inserts cortos no esperan detrás del cómputo de rutas (reparto de CPU de la base)');

  // 6. Capacidad y rendimiento -----------------------------------------
  const rhoRuta = Math.max(app.rho, bd.rho);
  const capRuta = lamRuta / rhoRuta;
  const rechazo = Math.max(app.rechazo, bd.rechazo);
  const thr = lamRuta * (1 - rechazo);
  const capRep = lock.capacidad;
  const rhoMax = Math.max(app.rho, bd.rho, lock.rho);
  const usuariosMax = e.usuarios / rhoMax;
  if (bd.saturado || app.saturado) adv.push(`Saturación en ruteo: ρ = ${rhoRuta.toFixed(2)}; se rechaza ${(rechazo * 100).toFixed(0)} % (503).`);
  if (lock.saturado) adv.push(`El lock de reportes está saturado (ρ = ${lock.rho.toFixed(2)}): los reportes se encolan.`);
  t('6. Capacidad', 'Capacidad de ruteo', 'λ_ruta / max(ρ_app, ρ_bd)', capRuta, 'pedidos/s');
  t('6. Capacidad', 'Rechazo de ruteo', 'ρ ≥ 1: 1 − 1/ρ', rechazo * 100, '%');
  t('6. Capacidad', 'Rendimiento de ruteo', 'λ_ruta × (1 − rechazo)', thr, 'pedidos/s');
  t('6. Capacidad', 'Capacidad de reportes', 'particiones / S_lock', capRep, 'reportes/s');
  t('6. Capacidad', 'Usuarios hasta ρ = 1', 'usuarios / max(ρ)', usuariosMax, 'usuarios');

  // 7. Disponibilidad ---------------------------------------------------
  const a = e.disponibilidadComponentePct / 100;
  const bdDisp = K.dispBdPct / 100;
  const tr = alt.dispRuta(a, n, bdDisp);
  const tp = alt.dispReporte(a, n, bdDisp);
  const dispRuta = tr.reduce((acc, x) => acc * x.valor, 1);
  const dispRep = tp.reduce((acc, x) => acc * x.valor, 1);
  for (const x of tr) t('7. Disponibilidad', `Ruteo: ${x.etiqueta}`, x.formula, x.valor * 100, '%');
  t('7. Disponibilidad', 'Disponibilidad ruteo (ruta crítica síncrona)', 'Π términos de la ruta de ruteo', dispRuta * 100, '%',
    'Es la que usa el requisito obligatorio de disponibilidad');
  for (const x of tp) t('7. Disponibilidad', `Reporte/alertas: ${x.etiqueta}`, x.formula, x.valor * 100, '%');
  t('7. Disponibilidad', 'Disponibilidad reporte/alertas', 'Π términos de la ruta de reporte', dispRep * 100, '%');
  t('7. Disponibilidad', 'Caída/mes ruteo', '(1 − A) × minutos del mes', (1 - dispRuta) * K.minutosMes, 'min');

  // 8. Costo ------------------------------------------------------------
  const cNodos = n * e.costoNodoUsd;
  const cBdUsd = cBd * e.costoVcpuBdUsd;
  const extras = alt.extras.map((x) => ({ etiqueta: x.etiqueta, valor: K[x.param] }));
  const costo = cNodos + cBdUsd + extras.reduce((acc, x) => acc + x.valor, 0);
  t('8. Costo', 'Nodos', 'N × costo por nodo', cNodos, 'USD/mes');
  t('8. Costo', 'Base de datos', 'vCPU_bd × (1 + réplicas) × costo por vCPU', cBdUsd, 'USD/mes');
  for (const x of extras) t('8. Costo', x.etiqueta, 'parámetro fijo', x.valor, 'USD/mes');
  t('8. Costo', 'Costo total', 'Σ términos', costo, 'USD/mes');

  // 9. Seguridad y operación -------------------------------------------
  const internos = alt.canalesInternos(e);
  const externos = K.canalesExternos + alt.k.replicasBd;
  const cifrados = externos + (e.mtls ? internos : 0);
  const cobertura = cifrados / (externos + internos);
  const superficie = 1 - Math.min(1, internos / K.canalesRefSeg);
  const seguridad = 100 * (K.pesoCoberturaSeg * cobertura + (1 - K.pesoCoberturaSeg) * superficie);
  const cont = alt.contenedores(n);
  const complejidad = Math.min(10, Math.max(1,
    alt.k.complejidadBase + K.complejidadPorContenedor * cont +
    (e.mtls && internos > 0 ? K.complejidadMtlsBase + K.complejidadPorCanalCifrado * internos : 0)));
  t('9. Seguridad y operación', 'Canales internos', 'según la alternativa', internos, 'canales');
  t('9. Seguridad y operación', 'Cobertura de cifrado', '(externos + internos con mTLS) / canales totales', cobertura * 100, '%');
  t('9. Seguridad y operación', 'Puntaje de seguridad', '100 × (w·cobertura + (1−w)·(1 − internos/ref))', seguridad, '/100');
  t('9. Seguridad y operación', 'Contenedores', 'según la alternativa', cont, 'u.');
  t('9. Seguridad y operación', 'Complejidad operativa', 'base + por contenedor + mTLS (tope 1-10)', complejidad, '/10');

  // 10. Escalabilidad ---------------------------------------------------
  const escal = id === 'A1' ? 1 : usl(2 * n, alt.k.sigma, alt.k.kappa) / cn;
  t('10. Escalabilidad', 'C(2N)/C(N)', 'ganancia al duplicar nodos', escal, '×');
  t('10. Escalabilidad', 'N óptimo', 'N* = √((1−σ)/κ)', nOpt, 'nodos');

  const ind: Indicadores = {
    p95RuteoMs: fin(p95Ruta), mediaRuteoMs: fin(mediaRuta), p95ReporteMs: fin(p95Rep),
    demandaRutaRps: fin(lamRuta), demandaReporteRps: fin(lamRep),
    capacidadRutaRps: fin(capRuta), capacidadReporteRps: fin(capRep), usuariosMax: fin(usuariosMax),
    rechazoRutaPct: fin(rechazo * 100), throughputRutaRps: fin(thr),
    utilizacionAppPct: fin(app.rho * 100), utilizacionBdPct: fin(bd.rho * 100),
    utilizacionLockPct: fin(lock.rho * 100), utilizacionMaxPct: fin(rhoMax * 100),
    saturadoRuta: bd.saturado || app.saturado, saturadoReporte: lock.saturado,
    dispRutaPct: dispRuta * 100, dispReportePct: dispRep * 100,
    caidaRutaMinMes: (1 - dispRuta) * K.minutosMes, caidaReporteMinMes: (1 - dispRep) * K.minutosMes,
    costoMesUsd: fin(costo), seguridad: fin(seguridad), coberturaCifradoPct: cobertura * 100,
    superficieAtaque: internos, contenedores: cont, memoriaMb: cont * alt.k.memoriaContenedorMb,
    complejidad: fin(complejidad), escalabilidad: fin(escal, 1), nodosEfectivos: fin(cn), nOptimo: fin(nOpt, 1),
  };
  return { alt: id, nombre: alt.nombre, indicadores: ind, traza, advertencias: adv };
}

export function simulateAll(e: Entradas): Resultado[] {
  return (['A1', 'A2', 'A3', 'A4'] as AltId[]).map((id) => simulate(e, id));
}

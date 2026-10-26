/** Teoría de colas y escalabilidad. Funciones puras, sin dependencias. */

/** Probabilidad de espera de Erlang C, c servidores enteros, a = λ·S (erlangs), a < c. */
export function erlangC(c: number, a: number): number {
  if (!Number.isInteger(c) || c < 1) throw new RangeError('c debe ser entero ≥ 1');
  if (a <= 0) return 0;
  if (a >= c) return 1;
  // Recurrencia estable de Erlang B: B(k) = a·B(k-1) / (k + a·B(k-1))
  let b = 1;
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  const rho = a / c;
  return b / (1 - rho * (1 - b));
}

/** Espera media exacta en M/M/c: Pw·S / (c(1-ρ)). */
export function erlangCWq(s: number, c: number, rho: number): number {
  if (rho >= 1) return Infinity;
  return (erlangC(c, rho * c) * s) / (c * (1 - rho));
}

/** Exponente de Sakasegawa: √(2(c+1)) − 1. */
export function sakasegawaExp(c: number): number {
  return Math.sqrt(2 * (c + 1)) - 1;
}

/** Probabilidad de espera implícita en Sakasegawa (válida para c real). */
export function sakasegawaPw(c: number, rho: number): number {
  if (rho <= 0) return 0;
  if (rho >= 1) return 1;
  return Math.min(1, Math.pow(rho, sakasegawaExp(c)));
}

/** Espera media aproximada de Sakasegawa (1977): S·ρ^(√(2(c+1))−1) / (c(1−ρ)). */
export function sakasegawaWq(s: number, c: number, rho: number): number {
  if (rho <= 0) return 0;
  if (rho >= 1) return Infinity;
  return (s * Math.pow(rho, sakasegawaExp(c))) / (c * (1 - rho));
}

/** Ley de Escalabilidad Universal: C(N) = N / (1 + σ(N−1) + κN(N−1)). */
export function usl(n: number, sigma: number, kappa: number): number {
  return n / (1 + sigma * (n - 1) + kappa * n * (n - 1));
}

/** Nodos que maximizan C(N): N* = √((1−σ)/κ). */
export function uslNOptimo(sigma: number, kappa: number): number {
  return kappa > 0 ? Math.sqrt((1 - sigma) / kappa) : Infinity;
}

export interface EntradaTier {
  lambda: number; // llegadas/s
  s: number; // servicio medio en segundos
  c: number; // servidores efectivos (real)
  cv: number; // coeficiente de variación del servicio
  colaMax: number; // pedidos esperando máximo (tope de saturación)
}

export interface SalidaTier {
  rho: number;
  saturado: boolean;
  pw: number; // probabilidad de esperar
  wqMedia: number; // s
  wq95: number; // s
  capacidad: number; // req/s a ρ = 1
  rechazo: number; // fracción 0..1
  tope: number; // espera máxima con cola llena, s
}

/**
 * Cola M/G/c de un nivel. Espera media = Sakasegawa × (1+cv²)/2 (Allen-Cunneen);
 * cola de espera exponencial P(Wq > t) = Pw·exp(−θ t), θ = (cμ−λ)·2/(1+cv²).
 * Con ρ ≥ 1 el sistema se satura: la espera queda en `tope` = colaMax·S/c,
 * el rendimiento es c/S y el resto de la demanda se rechaza (503).
 */
export function colaTier(e: EntradaTier, cuantil: number): SalidaTier {
  const { lambda, s, c, cv, colaMax } = e;
  const a = lambda * s;
  const rho = c > 0 ? a / c : Infinity;
  const capacidad = s > 0 ? c / s : Infinity;
  const tope = (colaMax * s) / c;
  if (!(rho < 1)) {
    return { rho, saturado: true, pw: 1, wqMedia: tope, wq95: tope, capacidad, rechazo: 1 - 1 / rho, tope };
  }
  const ac = (1 + cv * cv) / 2;
  const pw = sakasegawaPw(c, rho);
  const wqMedia = Math.min(tope, sakasegawaWq(s, c, rho) * ac);
  const theta = ((c / s) * (1 - rho)) / ac;
  const wq95 = pw <= 1 - cuantil ? 0 : Math.min(tope, Math.log(pw / (1 - cuantil)) / theta);
  return { rho, saturado: false, pw, wqMedia, wq95, capacidad, rechazo: 0, tope };
}

import { describe, it, expect } from 'vitest';
import { ejecutarCasos } from './testCases';
import { simulate, simulateAll } from './simulate';
import { ENTRADAS_REFERENCIA, ESCENARIOS_PREDEFINIDOS } from './scenarios';
import { decidir, PESOS_DEFECTO, validarPesos } from './decision';
import { PROYECTO_DEFECTO } from './project';
import { erlangC } from './queueing';
import { validarPesosUI, validarProyecto } from './validation';
import type { Pesos } from './types';
import { ALT_IDS } from './types';

describe('12 casos del modelo (compartidos con /pruebas)', () => {
  const casos = ejecutarCasos();
  it('son 12', () => expect(casos).toHaveLength(12));
  for (const c of casos) {
    it(`#${c.id} ${c.nombre}`, () => {
      expect(c.ok, `esperado: ${c.esperado} | obtenido: ${c.obtenido}`).toBe(true);
    });
  }
});

describe('pruebas adicionales', () => {
  it('Erlang C(1, ρ) = ρ (M/M/1)', () => expect(erlangC(1, 0.6)).toBeCloseTo(0.6, 12));

  it('ningún indicador es NaN ni Infinity en una malla de entradas', () => {
    for (const u of [1, 30, 1000, 5000]) for (const f of [1, 20]) for (const v of [1, 64]) for (const r of [0, 60]) {
      const e = { ...ENTRADAS_REFERENCIA, usuarios: u, factorRafaga: f, vcpuBd: v, reportesPorUsuarioHora: r, nodos: 50 };
      for (const res of simulateAll(e)) {
        for (const x of Object.values(res.indicadores)) if (typeof x === 'number') expect(Number.isFinite(x)).toBe(true);
        for (const p of res.traza) expect(Number.isFinite(p.valor)).toBe(true);
      }
    }
  });

  it('es determinista', () => {
    expect(simulate(ENTRADAS_REFERENCIA, 'A3')).toEqual(simulate(ENTRADAS_REFERENCIA, 'A3'));
  });

  it('la traza incluye λ, S, c_eff, ρ, W_q, disponibilidad y costo', () => {
    const t = simulate(ENTRADAS_REFERENCIA, 'A2').traza.map((p) => p.etiqueta).join('|');
    for (const k of ['λ ruteo', 'S_app ruteo', 'c_eff aplicación', 'ρ base', 'W_q p95 base', 'p95 ruteo', 'Disponibilidad ruteo', 'Costo total']) expect(t).toContain(k);
  });

  it('A4 reparte el lock: su p95 de reporte en ráfaga es menor que el de A1', () => {
    const e = { ...ENTRADAS_REFERENCIA, factorRafaga: 20, reportesPorUsuarioHora: 60 };
    expect(simulate(e, 'A4').indicadores.p95ReporteMs).toBeLessThan(simulate(e, 'A1').indicadores.p95ReporteMs);
  });

  it('A2 con réplica de lectura duplica la capacidad de ruteo frente a A1', () => {
    expect(simulate(ENTRADAS_REFERENCIA, 'A2').indicadores.capacidadRutaRps)
      .toBeGreaterThan(1.9 * simulate(ENTRADAS_REFERENCIA, 'A1').indicadores.capacidadRutaRps);
  });

  it('la decisión es consistente en todos los escenarios predefinidos', () => {
    for (const s of ESCENARIOS_PREDEFINIDOS) {
      const d = decidir(simulateAll(s.entradas), { ...PROYECTO_DEFECTO.requisitos, ...s.requisitos }, PESOS_DEFECTO);
      expect(ALT_IDS).toContain(d.recomendada);
      expect(d.ranking[0].alt).toBe(d.recomendada);
      expect(d.explicacion.titulo.length).toBeGreaterThan(0);
      if (d.modo === 'normal') expect(d.candidatas).toContain(d.recomendada);
    }
  });

  it('sin candidatas elige la menos mala y sugiere qué ajustar', () => {
    const d = decidir(simulateAll({ ...ENTRADAS_REFERENCIA, factorRafaga: 20 }), PROYECTO_DEFECTO.requisitos, PESOS_DEFECTO);
    expect(d.modo).toBe('menos-mala');
    expect(d.explicacion.faltas.length).toBeGreaterThan(0);
    expect(d.explicacion.faltas[0].sugerencia.length).toBeGreaterThan(5);
  });

  it('pesos todos en 0 es un error', () => {
    const cero = Object.fromEntries(Object.keys(PESOS_DEFECTO).map((k) => [k, 0])) as Pesos;
    expect(validarPesos(cero)).not.toBeNull();
    expect(validarPesosUI(cero).ok).toBe(false);
  });

  it('presupuesto ≤ 0 es un error de proyecto', () => {
    const p = structuredClone(PROYECTO_DEFECTO);
    p.requisitos.presupuestoUsd = 0;
    expect(validarProyecto(p).errores.presupuestoUsd).toBeDefined();
    expect(validarProyecto(PROYECTO_DEFECTO).ok).toBe(true);
  });

  it('el presupuesto por defecto es 150 USD/mes', () => {
    expect(PROYECTO_DEFECTO.requisitos.presupuestoUsd).toBe(150);
  });
});

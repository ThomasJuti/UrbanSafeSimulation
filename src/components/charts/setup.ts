import {
  Chart, CategoryScale, LinearScale, BarElement, PointElement, LineElement, RadialLinearScale, Filler, Tooltip, Legend,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, RadialLinearScale, Filler, Tooltip, Legend);

/** Lee un token CSS (p. ej. `--chart-4`) tal como está declarado en global.css; Chart.js lo pinta en canvas. */
export function tokenCss(nombre: string): string {
  if (typeof document === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  // Un token puede apuntar a otro (var(--safe)): se resuelve con un elemento de prueba.
  if (!v.startsWith('var(')) return v;
  const el = document.createElement('span');
  el.style.color = v;
  document.body.appendChild(el);
  const resuelto = getComputedStyle(el).color;
  el.remove();
  return resuelto;
}

/** Misma tinta con transparencia: oklch(0.70 0.19 45) → oklch(0.70 0.19 45 / 0.2). */
export function conAlfa(color: string, alfa: number): string {
  return color.replace(/\)\s*$/, ` / ${alfa})`);
}

/** Colores de ejes y leyenda, tomados de los tokens del tema oscuro. */
export const paleta = () => ({
  texto: tokenCss('--muted-foreground'),
  fuerte: tokenCss('--foreground'),
  rejilla: tokenCss('--border'),
  limite: tokenCss('--danger'),
  fondo: tokenCss('--popover'),
});

/** Fuente y colores por defecto de Chart.js para el tema oscuro (se aplican al montar cada gráfico). */
export function aplicarTema() {
  const p = paleta();
  Chart.defaults.font.family = "'Instrument Sans', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = p.texto;
  Chart.defaults.borderColor = p.rejilla;
  Chart.defaults.plugins.legend.labels.color = p.fuerte;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = p.fondo;
  Chart.defaults.plugins.tooltip.titleColor = p.fuerte;
  Chart.defaults.plugins.tooltip.bodyColor = p.texto;
  Chart.defaults.plugins.tooltip.borderColor = p.rejilla;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
}

export function baseOpts() {
  aplicarTema();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: paleta().fuerte, usePointStyle: true } } },
  } as const;
}

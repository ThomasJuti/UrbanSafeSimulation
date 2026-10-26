import { Line } from 'react-chartjs-2';
import './setup';
import { baseOpts, paleta } from './setup';

export interface SerieLinea { label: string; data: number[]; color: string; dash?: number[] }

export default function LineChart({ labels, series, xTitle, yTitle, titulo, limite }: {
  labels: string[]; series: SerieLinea[]; xTitle: string; yTitle: string; titulo: string; limite?: { valor: number; etiqueta: string };
}) {
  const p = paleta();
  const datasets = series.map((s) => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, pointRadius: 2, borderWidth: 2, tension: 0.15, borderDash: s.dash }));
  if (limite) datasets.push({ label: limite.etiqueta, data: labels.map(() => limite.valor), borderColor: p.limite, backgroundColor: p.limite, pointRadius: 0, borderWidth: 1.5, tension: 0, borderDash: [6, 4] });
  return (
    <div className="chart-box tall" role="img" aria-label={titulo}>
      <Line
        data={{ labels, datasets }}
        options={{
          ...baseOpts(),
          scales: {
            x: { ticks: { color: p.texto }, grid: { color: p.rejilla }, title: { display: true, text: xTitle, color: p.texto } },
            y: { beginAtZero: true, ticks: { color: p.texto }, grid: { color: p.rejilla }, title: { display: true, text: yTitle, color: p.texto } },
          },
        }}
      />
    </div>
  );
}

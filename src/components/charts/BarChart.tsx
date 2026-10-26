import { Bar } from 'react-chartjs-2';
import './setup';
import { baseOpts, paleta } from './setup';

export interface Serie { label: string; data: number[]; color: string | string[] }

export default function BarChart({ labels, series, yTitle, titulo }: { labels: string[]; series: Serie[]; yTitle: string; titulo: string }) {
  const p = paleta();
  return (
    <div className="chart-box" role="img" aria-label={titulo}>
      <Bar
        data={{ labels, datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: s.color, borderRadius: 4 })) }}
        options={{
          ...baseOpts(),
          scales: {
            x: { ticks: { color: p.texto }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: p.texto }, grid: { color: p.rejilla }, title: { display: true, text: yTitle, color: p.texto } },
          },
        }}
      />
    </div>
  );
}

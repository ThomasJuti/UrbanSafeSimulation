import { Radar } from 'react-chartjs-2';
import './setup';
import { baseOpts, conAlfa, paleta } from './setup';

export interface SerieRadar { label: string; data: number[]; color: string }

export default function RadarChart({ labels, series, titulo }: { labels: string[]; series: SerieRadar[]; titulo: string }) {
  const p = paleta();
  return (
    <div className="chart-box tall" role="img" aria-label={titulo}>
      <Radar
        data={{
          labels,
          datasets: series.map((s) => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: conAlfa(s.color, 0.12), pointBackgroundColor: s.color, borderWidth: 2 })),
        }}
        options={{
          ...baseOpts(),
          scales: { r: { min: 0, max: 1, ticks: { color: p.texto, backdropColor: 'transparent', stepSize: 0.25 }, grid: { color: p.rejilla }, angleLines: { color: p.rejilla }, pointLabels: { color: p.fuerte, font: { size: 11 } } } },
        }}
      />
    </div>
  );
}

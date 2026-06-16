/**
 * Gráfico de barras agrupadas (casa vs fora) por bloco de tempo — SVG puro.
 */
interface BarTimelineProps {
  labels: string[];
  home: number[];
  away: number[];
  height?: number;
}

export function BarTimeline({ labels, home, away, height = 150 }: BarTimelineProps) {
  const W = 600;
  const H = height;
  const padX = 8;
  const padTop = 10;
  const padBottom = 22;
  const n = labels.length;
  const max = Math.max(1, ...home, ...away);
  const groupW = (W - 2 * padX) / n;
  const barW = groupW * 0.36;
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const h = (v: number) => (v / max) * (H - padTop - padBottom);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
      {labels.map((lab, i) => {
        const gx = padX + i * groupW + groupW / 2;
        return (
          <g key={lab}>
            <rect x={gx - barW - 1} y={y(home[i])} width={barW} height={h(home[i])} fill="var(--green)" rx="2" />
            <rect x={gx + 1} y={y(away[i])} width={barW} height={h(away[i])} fill="var(--cyan)" rx="2" />
            <text x={gx} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--fg-2)" fontFamily="var(--mono)">
              {lab}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

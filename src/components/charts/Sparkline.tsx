/**
 * Sparkline / gráfico de linha em SVG puro (sem dependências).
 * Responsivo via viewBox. Área preenchida até à baseline e linha por cima.
 */
interface SparklineProps {
  values: number[];
  /** Valor de referência para a baseline (default 0). */
  baseline?: number;
  height?: number;
  /** Cor forçada; senão verde se o último ≥ baseline, vermelho caso contrário. */
  color?: string;
  /** Mostra a linha da baseline. */
  showBaseline?: boolean;
}

export function Sparkline({
  values,
  baseline = 0,
  height = 120,
  color,
  showBaseline = true,
}: SparklineProps) {
  const W = 600;
  const H = height;
  const pad = 6;

  if (values.length < 2) {
    return (
      <div className="muted" style={{ padding: 24, textAlign: 'center', fontSize: 12 }}>
        Sem dados suficientes para o gráfico (liquida algumas apostas).
      </div>
    );
  }

  const all = [...values, baseline];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;

  const x = (i: number) => pad + (i / (values.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const last = values[values.length - 1];
  const stroke = color ?? (last >= baseline ? 'var(--green)' : 'var(--red)');

  const linePts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPts = `${pad},${y(baseline).toFixed(1)} ${linePts} ${(W - pad).toFixed(1)},${y(
    baseline,
  ).toFixed(1)}`;

  const fillId = `spark-${Math.round(min)}-${Math.round(max)}-${values.length}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showBaseline && (
        <line
          x1={pad}
          x2={W - pad}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="var(--border-strong)"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
      )}
      <polygon points={areaPts} fill={`url(#${fillId})`} />
      <polyline
        points={linePts}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3.5" fill={stroke} />
    </svg>
  );
}

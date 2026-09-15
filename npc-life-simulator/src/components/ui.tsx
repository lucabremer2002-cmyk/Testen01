import { type ReactNode } from 'react';
import { clamp } from '../core/math';

export function Bar({
  value,
  max = 100,
  color,
  invert = false,
}: {
  value: number;
  max?: number;
  color?: string;
  invert?: boolean;
}) {
  const pct = clamp((value / max) * 100, 0, 100);
  // Needs read "higher is better"; stress is the exception, hence `invert`.
  const t = invert ? 1 - pct / 100 : pct / 100;
  const auto = t > 0.6 ? 'var(--good)' : t > 0.3 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="bar">
      <span style={{ width: `${pct}%`, background: color ?? auto }} />
    </div>
  );
}

export function BarRow({
  label,
  value,
  max = 100,
  invert = false,
  suffix = '',
  color,
}: {
  label: string;
  value: number;
  max?: number;
  invert?: boolean;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="bar-row">
      <span className="label">{label}</span>
      <Bar value={value} max={max} invert={invert} color={color} />
      <span className="val">
        {Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}

export function KV({ k, v, mono = false }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={mono ? 'v mono' : 'v'}>{v}</span>
    </div>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'good' | 'warn' | 'bad' | 'love';
}) {
  return <span className={tone ? `badge ${tone}` : 'badge'}>{children}</span>;
}

export function Avatar({ text, color, large = false }: { text: string; color: string; large?: boolean }) {
  return (
    <div className={large ? 'avatar lg' : 'avatar'} style={{ background: color }}>
      {text}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="panel-section">
      {title && <h4 className="panel-title">{title}</h4>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && <div className="delta">{delta}</div>}
    </div>
  );
}

/** Minimal inline line chart - no charting dependency needed. */
export function Sparkline({
  points,
  color = 'var(--accent)',
  height = 44,
  fill = true,
}: {
  points: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  if (points.length < 2) return <div className="spark" style={{ height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 100;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = height - ((p - min) / span) * (height - 6) - 3;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const area = `${path} L${w},${height} L0,${height} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }}>
      {fill && <path d={area} fill={color} opacity={0.12} />}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

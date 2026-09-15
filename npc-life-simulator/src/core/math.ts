export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Clamp into the 0..100 range used by every trait/need/emotion value. */
export const clamp100 = (v: number): number => (v < 0 ? 0 : v > 100 ? 100 : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const inverseLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a));

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Maps a 0..100 trait to a -1..+1 modifier. */
export const traitBias = (v: number): number => (v - 50) / 50;

/** Rounds to `d` decimals - used for compact save files. */
export const round = (v: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export const formatMoney = (v: number): string => {
  const n = Math.round(v);
  const sign = n < 0 ? '-' : '';
  return sign + '€' + Math.abs(n).toLocaleString('de-DE');
};

export const formatMoneyShort = (v: number): string => {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}€${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${sign}€${Math.round(a / 1000)}k`;
  return formatMoney(v);
};

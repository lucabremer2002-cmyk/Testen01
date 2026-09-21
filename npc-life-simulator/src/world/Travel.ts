/** One world unit is one metre; speeds are metres per simulated minute. */
export const SPEED = {
  walk: 83, // ~5 km/h
  transit: 320, // ~19 km/h including stops
  car: 520, // ~31 km/h city traffic
} as const;

export type TravelMode = 0 | 1 | 2;
export const MODE_LABEL: Record<TravelMode, string> = {
  0: 'zu Fuß',
  1: 'mit Bus/Bahn',
  2: 'mit dem Auto',
};

/** Fixed overhead per trip (waiting, parking). */
const OVERHEAD = [0, 6, 3] as const;

/** A car, the distance and the person's age decide how they get around. */
export function pickMode(distance: number, ownsCar: boolean, age: number): TravelMode {
  if (distance < 650) return 0;
  if (age < 17) return 1;
  return ownsCar ? 2 : 1;
}

export function travelMinutes(distance: number, mode: TravelMode): number {
  const speed = mode === 0 ? SPEED.walk : mode === 1 ? SPEED.transit : SPEED.car;
  return OVERHEAD[mode] + distance / speed;
}

/** Cost of a single trip in euros (transit ticket / fuel). */
export function travelCost(distance: number, mode: TravelMode, transportPrice: number): number {
  if (mode === 0) return 0;
  // Most commuters hold a season ticket, so the marginal fare is small.
  if (mode === 1) return transportPrice * (distance > 2000 ? 0.85 : 0.5);
  return (distance / 1000) * transportPrice * 0.45;
}

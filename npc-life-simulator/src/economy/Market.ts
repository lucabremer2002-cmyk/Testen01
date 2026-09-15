import { RNG } from '../core/rng';
import { clamp } from '../core/math';
import { PRICE_CATEGORIES, type PriceCategory } from './types';

/** Base price in EUR for one "unit" of each category. */
const BASE_PRICE: Record<PriceCategory, number> = {
  /** One home-cooked meal's worth of groceries. */
  food: 4.2,
  rent: 1,
  transport: 3.2,
  dining: 24,
  clothing: 65,
  entertainment: 18,
  electronics: 420,
  health: 45,
  education: 120,
};

/**
 * A light-weight price model: each category drifts with momentum around its
 * base value, bounded so the economy never runs away.
 */
export class Market {
  /** Multiplier per category, 1.0 = base price. */
  index: Record<PriceCategory, number>;
  private momentum: Record<PriceCategory, number>;
  /** City-wide wage multiplier, moves slowly with the economy. */
  wageFactor = 1;
  /** 0..100 - composite economic health, drives hiring and revenue. */
  economyHealth = 62;
  /** True year-over-year inflation in percent. */
  inflation = 1.8;
  /** Ring buffer of the last 365 daily price levels. */
  private levelHistory = new Float64Array(365).fill(1);
  private historyPos = 0;
  private historyFilled = false;
  /** Long-run price anchor; drifts upward so inflation is a trend, not noise. */
  private trend = 1;

  constructor() {
    this.index = {} as Record<PriceCategory, number>;
    this.momentum = {} as Record<PriceCategory, number>;
    for (const c of PRICE_CATEGORIES) {
      this.index[c] = 1;
      this.momentum[c] = 0;
    }
  }

  price(cat: PriceCategory): number {
    return BASE_PRICE[cat] * this.index[cat];
  }

  /** Called once per simulated day. */
  tickDay(rng: RNG): void {
    // ~1.9% per year, the anchor every category reverts towards.
    this.trend *= 1 + 0.019 / 365;
    let sum = 0;
    for (const c of PRICE_CATEGORIES) {
      this.momentum[c] = clamp(this.momentum[c] * 0.88 + rng.gauss(0, 0.00014), -0.0012, 0.0012);
      // Mean reversion around a slow 1.8%/year trend keeps prices believable.
      const pull = (this.trend - this.index[c]) * 0.03;
      this.index[c] = clamp(this.index[c] + this.momentum[c] + pull, 0.7, this.trend * 2.2);
      sum += this.index[c];
    }
    const avg = sum / PRICE_CATEGORIES.length;
    const yearAgo = this.historyFilled ? this.levelHistory[this.historyPos] : this.levelHistory[0];
    this.inflation = (avg / (yearAgo || 1) - 1) * 100;
    this.levelHistory[this.historyPos] = avg;
    this.historyPos = (this.historyPos + 1) % this.levelHistory.length;
    if (this.historyPos === 0) this.historyFilled = true;
    // Wages follow prices, but with a lag.
    this.wageFactor = clamp(this.wageFactor * 0.9985 + avg * 0.0015, 0.7, 3.5);
  }

  /** Economy health follows employment and company profitability. */
  updateHealth(employmentRate: number, profitableShare: number): void {
    const target = clamp(employmentRate * 62 + profitableShare * 38, 0, 100);
    this.economyHealth += (target - this.economyHealth) * 0.08;
  }

  serialize() {
    return {
      index: this.index,
      levelHistory: Array.from(this.levelHistory),
      historyPos: this.historyPos,
      historyFilled: this.historyFilled,
      momentum: this.momentum,
      trend: this.trend,
      wageFactor: this.wageFactor,
      economyHealth: this.economyHealth,
      inflation: this.inflation,
    };
  }

  restore(d: ReturnType<Market['serialize']>): void {
    this.index = d.index;
    if (d.levelHistory) this.levelHistory = Float64Array.from(d.levelHistory);
    this.trend = d.trend ?? 1;
    this.historyPos = d.historyPos ?? 0;
    this.historyFilled = d.historyFilled ?? false;
    this.momentum = d.momentum;
    this.wageFactor = d.wageFactor;
    this.economyHealth = d.economyHealth;
    this.inflation = d.inflation;
  }
}

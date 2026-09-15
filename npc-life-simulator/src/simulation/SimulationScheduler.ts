const BUCKET = 10; // minutes per bucket

/**
 * Bucketed timer queue. NPCs are only touched when their current action ends,
 * which makes the cost of a tick proportional to the number of decisions
 * instead of to the size of the population.
 */
export class SimulationScheduler {
  private buckets = new Map<number, number[]>();
  private cursor = 0;
  private initialised = false;
  /** Ids pulled from the queue but deferred because the tick budget ran out. */
  private carry: number[] = [];

  schedule(id: number, atMinute: number): void {
    const b = Math.floor(atMinute / BUCKET);
    const key = this.initialised ? Math.max(b, this.cursor) : b;
    let list = this.buckets.get(key);
    if (!list) {
      list = [];
      this.buckets.set(key, list);
    }
    list.push(id);
    if (!this.initialised) {
      this.cursor = key;
      this.initialised = true;
    } else if (key < this.cursor) {
      this.cursor = key;
    }
  }

  /**
   * Collects everything due at `now`, honouring a per-tick budget. Anything
   * over budget is carried into the next call rather than dropped.
   */
  collectDue(now: number, budget: number, out: number[]): void {
    out.length = 0;
    if (this.carry.length) {
      while (this.carry.length && out.length < budget) out.push(this.carry.pop()!);
      if (out.length >= budget) return;
    }
    const target = Math.floor(now / BUCKET);
    if (!this.initialised) {
      this.cursor = target;
      this.initialised = true;
    }
    while (this.cursor <= target) {
      const list = this.buckets.get(this.cursor);
      if (list) {
        if (out.length + list.length <= budget) {
          for (const id of list) out.push(id);
          this.buckets.delete(this.cursor);
        } else {
          const room = budget - out.length;
          for (let i = 0; i < room; i++) out.push(list[i]);
          // Everything else waits for the next tick.
          this.carry = list.slice(room);
          this.buckets.delete(this.cursor);
          return;
        }
      }
      this.cursor++;
    }
  }

  /** Number of entries still waiting - a load indicator for the debug panel. */
  get pending(): number {
    let n = this.carry.length;
    for (const list of this.buckets.values()) n += list.length;
    return n;
  }

  clear(): void {
    this.buckets.clear();
    this.carry.length = 0;
    this.initialised = false;
    this.cursor = 0;
  }

  /** Rebuilds the queue from the NPCs' own timestamps (used after loading). */
  rebuild(entries: { id: number; at: number }[], now: number): void {
    this.clear();
    this.cursor = Math.floor(now / BUCKET);
    this.initialised = true;
    for (const e of entries) this.schedule(e.id, e.at);
  }
}

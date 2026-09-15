import { MINUTES_PER_DAY } from '../time/calendar';
import type { EventType, GameEvent } from './types';

export interface EventInput {
  type: EventType;
  subjects: number[];
  text: string;
  /** Optional past-tense clause for story prose; falls back to `text`. */
  narrative?: string;
  importance: number;
  companyId?: number;
  buildingId?: number;
  cause?: number;
}

const MAX_EVENTS = 3000;
const MAX_PER_NPC = 40;

/**
 * Ring buffer of everything that happened, plus a per-NPC index so a single
 * character's history can be pulled without scanning the whole log.
 */
export class EventLog {
  private events: GameEvent[] = [];
  private byNpc = new Map<number, number[]>();
  private nextId = 1;
  /** Bumped on every append so the UI can cheaply detect new entries. */
  version = 0;

  push(minute: number, input: EventInput): GameEvent {
    const e: GameEvent = {
      id: this.nextId++,
      minute,
      day: Math.floor(minute / MINUTES_PER_DAY),
      type: input.type,
      subjects: input.subjects,
      companyId: input.companyId ?? -1,
      buildingId: input.buildingId ?? -1,
      importance: input.importance,
      text: input.text,
      narrative: input.narrative ?? '',
      cause: input.cause ?? -1,
    };
    this.events.push(e);
    if (this.events.length > MAX_EVENTS) {
      const removed = this.events.splice(0, this.events.length - MAX_EVENTS);
      for (const r of removed) {
        for (const s of r.subjects) {
          const list = this.byNpc.get(s);
          if (!list) continue;
          const i = list.indexOf(r.id);
          if (i >= 0) list.splice(i, 1);
        }
      }
    }
    for (const s of e.subjects) {
      let list = this.byNpc.get(s);
      if (!list) {
        list = [];
        this.byNpc.set(s, list);
      }
      list.push(e.id);
      if (list.length > MAX_PER_NPC) list.shift();
    }
    this.version++;
    return e;
  }

  /** Most recent events first. */
  recent(limit = 40, minImportance = 0): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = this.events.length - 1; i >= 0 && out.length < limit; i--) {
      if (this.events[i].importance >= minImportance) out.push(this.events[i]);
    }
    return out;
  }

  forNpc(id: number, limit = 25): GameEvent[] {
    const ids = this.byNpc.get(id);
    if (!ids) return [];
    const out: GameEvent[] = [];
    for (let i = ids.length - 1; i >= 0 && out.length < limit; i--) {
      const e = this.byId(ids[i]);
      if (e) out.push(e);
    }
    return out;
  }

  byId(id: number): GameEvent | undefined {
    // Events are appended in id order, so a binary search is exact.
    let lo = 0;
    let hi = this.events.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = this.events[mid].id;
      if (v === id) return this.events[mid];
      if (v < id) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }

  get count(): number {
    return this.events.length;
  }

  /** Count of events of a type since a given day - feeds the statistics panel. */
  countSince(day: number, type: EventType): number {
    let n = 0;
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].day < day) break;
      if (this.events[i].type === type) n++;
    }
    return n;
  }

  serialize() {
    return { events: this.events.slice(-1200), nextId: this.nextId };
  }

  restore(d: { events: GameEvent[]; nextId: number }): void {
    this.events = d.events;
    this.nextId = d.nextId;
    this.byNpc.clear();
    for (const e of this.events) {
      for (const s of e.subjects) {
        let list = this.byNpc.get(s);
        if (!list) {
          list = [];
          this.byNpc.set(s, list);
        }
        list.push(e.id);
      }
    }
    this.version++;
  }
}

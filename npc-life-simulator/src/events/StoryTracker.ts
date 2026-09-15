import { narrate } from './Narrator';
import type { GameEvent, Story } from './types';

interface Thread {
  npcId: number;
  eventIds: number[];
  startDay: number;
  lastDay: number;
  weight: number;
  cast: Set<number>;
}

const MIN_EVENT_IMPORTANCE = 48;
const THREAD_GAP_DAYS = 420;
const MIN_BEATS = 3;
const MIN_WEIGHT = 175;
const MAX_STORIES = 80;

/**
 * Watches the event stream and recognises causally-linked chains around a
 * single character. When a chain is dramatic enough it becomes a Story - this
 * is what turns raw simulation into something worth reading.
 */
export class StoryTracker {
  private threads = new Map<number, Thread>();
  stories: Story[] = [];
  private nextId = 1;
  version = 0;

  onEvent(e: GameEvent, nameOf: (id: number) => string, resolve: (id: number) => GameEvent | undefined): void {
    if (e.importance < MIN_EVENT_IMPORTANCE || e.subjects.length === 0) return;
    const protagonist = e.subjects[0];
    let t = this.threads.get(protagonist);

    if (t && e.day - t.lastDay > THREAD_GAP_DAYS) {
      this.close(protagonist, nameOf, resolve);
      t = undefined;
    }
    if (!t) {
      t = {
        npcId: protagonist,
        eventIds: [],
        startDay: e.day,
        lastDay: e.day,
        weight: 0,
        cast: new Set<number>(),
      };
      this.threads.set(protagonist, t);
    }

    // The same thing happening to the same people twice is not a new beat.
    // Without this, an on-again-off-again couple produces unreadable stories.
    const signature = `${e.type}:${e.subjects.slice(1).join(',')}`;
    let sameType = 0;
    for (const id of t.eventIds) {
      const prev = resolve(id);
      if (!prev) continue;
      if (`${prev.type}:${prev.subjects.slice(1).join(',')}` === signature) return;
      if (prev.type === e.type) sameType++;
    }
    if (sameType >= 2) return;

    t.eventIds.push(e.id);
    t.lastDay = e.day;
    t.weight += e.importance;
    for (const s of e.subjects) t.cast.add(s);
    if (t.eventIds.length > 8) {
      const dropped = t.eventIds.shift()!;
      const ev = resolve(dropped);
      if (ev) t.weight -= ev.importance;
      t.startDay = resolve(t.eventIds[0])?.day ?? t.startDay;
    }

    // A closing event (death, wedding, bankruptcy) seals the chain immediately.
    const sealed = e.type === 'death' || e.type === 'wedding' || e.type === 'bankruptcy';
    if (sealed || (t.eventIds.length >= MIN_BEATS && t.weight >= MIN_WEIGHT && t.eventIds.length >= 4)) {
      this.close(protagonist, nameOf, resolve);
    }
  }

  private close(npcId: number, nameOf: (id: number) => string, resolve: (id: number) => GameEvent | undefined): void {
    const t = this.threads.get(npcId);
    this.threads.delete(npcId);
    if (!t || t.eventIds.length < MIN_BEATS || t.weight < MIN_WEIGHT) return;

    const events: GameEvent[] = [];
    for (const id of t.eventIds) {
      const e = resolve(id);
      if (e) events.push(e);
    }
    if (events.length < MIN_BEATS) return;

    const name = nameOf(npcId);
    const { title, summary } = narrate(events, name, t.npcId + t.startDay);
    const story: Story = {
      id: this.nextId++,
      title,
      protagonist: npcId,
      cast: Array.from(t.cast),
      startDay: events[0].day,
      endDay: events[events.length - 1].day,
      beats: events.map((e) => ({ eventId: e.id, day: e.day, text: e.text })),
      summary,
      weight: Math.min(100, Math.round(t.weight / events.length)),
    };
    this.stories.unshift(story);
    if (this.stories.length > MAX_STORIES) this.stories.length = MAX_STORIES;
    this.version++;
  }

  /** Periodic housekeeping so abandoned threads do not pile up. */
  sweep(currentDay: number, nameOf: (id: number) => string, resolve: (id: number) => GameEvent | undefined): void {
    for (const [id, t] of this.threads) {
      if (currentDay - t.lastDay > THREAD_GAP_DAYS) this.close(id, nameOf, resolve);
    }
  }

  forNpc(npcId: number): Story[] {
    return this.stories.filter((s) => s.protagonist === npcId || s.cast.includes(npcId));
  }

  serialize() {
    return { stories: this.stories.slice(0, 40), nextId: this.nextId };
  }

  restore(d: { stories: Story[]; nextId: number }): void {
    this.stories = d.stories;
    this.nextId = d.nextId;
    this.version++;
  }
}

import { RNG } from '../core/rng';
import type { NPC } from '../npc/types';
import type { Relationship } from './types';
import type { RelationshipManager } from './RelationshipManager';

export type RumorKind =
  | 'affair'
  | 'jobloss'
  | 'wealth'
  | 'crime'
  | 'pregnancy'
  | 'breakup'
  | 'promotion'
  | 'debt'
  | 'illness'
  | 'crush';

export interface Rumor {
  id: number;
  /** Whom the rumour is about. */
  subject: number;
  /** Second party, -1 when none. */
  other: number;
  kind: RumorKind;
  truth: boolean;
  /** 0..100 - how damaging it is. */
  severity: number;
  createdDay: number;
  /** How many NPCs have heard it. */
  spread: number;
  text: string;
}

/** How hearing a rumour changes the listener's view of its subject. */
const IMPACT: Record<RumorKind, { opinion: number; trust: number; sympathy: number; respect: number }> = {
  affair: { opinion: -26, trust: -18, sympathy: -12, respect: -14 },
  jobloss: { opinion: -6, trust: -2, sympathy: 4, respect: -10 },
  wealth: { opinion: 4, trust: 0, sympathy: -2, respect: 10 },
  crime: { opinion: -34, trust: -26, sympathy: -18, respect: -20 },
  pregnancy: { opinion: 6, trust: 0, sympathy: 8, respect: 2 },
  breakup: { opinion: -2, trust: 0, sympathy: 6, respect: -2 },
  promotion: { opinion: 8, trust: 2, sympathy: 0, respect: 14 },
  debt: { opinion: -14, trust: -12, sympathy: 2, respect: -12 },
  illness: { opinion: 2, trust: 0, sympathy: 14, respect: 0 },
  crush: { opinion: -2, trust: -2, sympathy: 2, respect: -2 },
};

const MAX_RUMORS = 400;
const STALE_DAYS = 240;

/**
 * Information travels through the social graph rather than being broadcast.
 * Whether an NPC believes what they hear depends on who told them and on their
 * own personality, so the same rumour lands differently in different circles.
 */
export class RumorSystem {
  private rumors = new Map<number, Rumor>();
  private nextId = 1;

  create(
    subject: number,
    kind: RumorKind,
    truth: boolean,
    severity: number,
    day: number,
    text: string,
    other = -1,
  ): Rumor {
    const r: Rumor = {
      id: this.nextId++,
      subject,
      other,
      kind,
      truth,
      severity,
      createdDay: day,
      spread: 1,
      text,
    };
    this.rumors.set(r.id, r);
    if (this.rumors.size > MAX_RUMORS) {
      // Drop the oldest entry; long-dead gossip stops circulating anyway.
      const oldest = this.rumors.keys().next();
      if (!oldest.done) this.rumors.delete(oldest.value);
    }
    return r;
  }

  get(id: number): Rumor | undefined {
    return this.rumors.get(id);
  }

  all(): Rumor[] {
    return Array.from(this.rumors.values());
  }

  /** Rumours the NPC knows and could pass on right now. */
  tellable(npc: NPC, day: number): number[] {
    const out: number[] = [];
    for (const id of npc.known) {
      const r = this.rumors.get(id);
      if (!r || day - r.createdDay > STALE_DAYS) continue;
      out.push(id);
    }
    return out;
  }

  /**
   * One gossip exchange during a social interaction. Returns the rumour that
   * was passed on, or null.
   */
  gossip(
    teller: NPC,
    listener: NPC,
    rel: Relationship,
    rels: RelationshipManager,
    day: number,
    rng: RNG,
    npcById: (id: number) => NPC | undefined,
  ): Rumor | null {
    // Talkative, less agreeable people gossip more.
    const tendency =
      0.1 + teller.p.extraversion / 320 + (100 - teller.p.agreeableness) / 380 + rel.closeness / 500;
    if (!rng.chance(tendency)) return null;

    const options = this.tellable(teller, day);
    if (!options.length) return null;

    // Prefer juicy, fresh rumours the listener does not know yet.
    let chosen: Rumor | null = null;
    let bestScore = 0;
    for (const id of options) {
      if (listener.known.has(id)) continue;
      const r = this.rumors.get(id)!;
      if (r.subject === listener.id) continue;
      const freshness = 1 - Math.min(1, (day - r.createdDay) / STALE_DAYS);
      const score = (r.severity / 100) * 0.6 + freshness * 0.4 + rng.next() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        chosen = r;
      }
    }
    if (!chosen) return null;

    listener.known.add(chosen.id);
    chosen.spread++;

    // Belief depends on the messenger and on how credulous the listener is.
    const gullibility = 0.35 + (listener.p.agreeableness / 100) * 0.3 - (listener.a.intelligence / 100) * 0.2;
    const trustFactor = rel.trust / 100;
    const believes = rng.next() < Math.min(0.96, gullibility * 0.5 + trustFactor * 0.6);
    if (!believes) return chosen;

    const subject = npcById(chosen.subject);
    if (!subject || subject.id === listener.id) return chosen;

    const subjectRel = rels.get(listener.id, subject.id);
    const strength = (chosen.severity / 100) * (0.4 + trustFactor * 0.6);
    const imp = IMPACT[chosen.kind];
    if (subjectRel) {
      rels.modify(subjectRel, listener.id, {
        opinion: imp.opinion * strength,
        trust: imp.trust * strength * 0.6,
        sympathy: imp.sympathy * strength * 0.6,
        respect: imp.respect * strength * 0.6,
      });
      rels.refreshType(subjectRel);
    } else if (imp.opinion < -10) {
      // Even strangers get a reputation hit from serious gossip.
      subject.reputation = Math.max(0, subject.reputation - strength * 1.4);
    }
    subject.reputation = Math.max(0, Math.min(100, subject.reputation + imp.opinion * strength * 0.08));
    return chosen;
  }

  /** Removes gossip nobody repeats any more. */
  sweep(day: number): void {
    for (const [id, r] of this.rumors) {
      if (day - r.createdDay > STALE_DAYS * 2) this.rumors.delete(id);
    }
  }

  serialize() {
    return { rumors: Array.from(this.rumors.values()).slice(-200), nextId: this.nextId };
  }

  restore(d: { rumors: Rumor[]; nextId: number }): void {
    this.rumors.clear();
    for (const r of d.rumors) this.rumors.set(r.id, r);
    this.nextId = d.nextId;
  }
}

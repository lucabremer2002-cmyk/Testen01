import { clamp100 } from '../core/math';
import type { NPC } from '../npc/types';
import { pairKey, type FamilyTie, type RelationType, type Relationship } from './types';

export interface RelDelta {
  trust?: number;
  sympathy?: number;
  closeness?: number;
  loyalty?: number;
  conflict?: number;
  respect?: number;
  attraction?: number;
  opinion?: number;
}

/**
 * Owns every relationship in the city. NPCs only keep a list of ids, the edge
 * data lives here in a single flat map - that keeps save files and iteration
 * cheap even with tens of thousands of edges.
 */
export class RelationshipManager {
  private map = new Map<number, Relationship>();

  get size(): number {
    return this.map.size;
  }

  get(a: number, b: number): Relationship | undefined {
    return this.map.get(pairKey(a, b));
  }

  has(a: number, b: number): boolean {
    return this.map.has(pairKey(a, b));
  }

  all(): IterableIterator<Relationship> {
    return this.map.values();
  }

  /** Creates the edge if needed and registers it on both NPCs. */
  ensure(npcA: NPC, npcB: NPC, day: number, type: RelationType = 'stranger'): Relationship {
    const key = pairKey(npcA.id, npcB.id);
    let rel = this.map.get(key);
    if (rel) return rel;
    const a = Math.min(npcA.id, npcB.id);
    const b = Math.max(npcA.id, npcB.id);
    rel = {
      a,
      b,
      type,
      trust: 30,
      sympathy: 35,
      closeness: 8,
      loyalty: 20,
      conflict: 0,
      respect: 35,
      attractionAB: 0,
      attractionBA: 0,
      opinionAB: 0,
      opinionBA: 0,
      familyTie: 'none',
      sinceDay: day,
      lastInteractionDay: day,
      interactions: 0,
      romantic: false,
    };
    this.map.set(key, rel);
    npcA.links.push(npcB.id);
    npcB.links.push(npcA.id);
    return rel;
  }

  /** Applies a change from the perspective of `fromId`. */
  modify(rel: Relationship, fromId: number, d: RelDelta): void {
    if (d.trust) rel.trust = clamp100(rel.trust + d.trust);
    if (d.sympathy) rel.sympathy = clamp100(rel.sympathy + d.sympathy);
    if (d.closeness) rel.closeness = clamp100(rel.closeness + d.closeness);
    if (d.loyalty) rel.loyalty = clamp100(rel.loyalty + d.loyalty);
    if (d.conflict) rel.conflict = clamp100(rel.conflict + d.conflict);
    if (d.respect) rel.respect = clamp100(rel.respect + d.respect);
    const forward = fromId === rel.a;
    if (d.attraction) {
      if (forward) rel.attractionAB = clamp100(rel.attractionAB + d.attraction);
      else rel.attractionBA = clamp100(rel.attractionBA + d.attraction);
    }
    if (d.opinion) {
      if (forward) rel.opinionAB = Math.max(-100, Math.min(100, rel.opinionAB + d.opinion));
      else rel.opinionBA = Math.max(-100, Math.min(100, rel.opinionBA + d.opinion));
    }
  }

  attractionFrom(rel: Relationship, fromId: number): number {
    return fromId === rel.a ? rel.attractionAB : rel.attractionBA;
  }

  opinionFrom(rel: Relationship, fromId: number): number {
    return fromId === rel.a ? rel.opinionAB : rel.opinionBA;
  }

  other(rel: Relationship, selfId: number): number {
    return rel.a === selfId ? rel.b : rel.a;
  }

  setFamilyTie(rel: Relationship, fromId: number, tie: FamilyTie): void {
    // Ties are stored from a's perspective, so invert when set from b.
    const inverted: Record<FamilyTie, FamilyTie> = {
      none: 'none',
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
    };
    rel.familyTie = fromId === rel.a ? tie : inverted[tie];
    rel.type = 'family';
  }

  familyTieFrom(rel: Relationship, fromId: number): FamilyTie {
    if (rel.familyTie === 'none') return 'none';
    if (fromId === rel.a) return rel.familyTie;
    const inverted: Record<FamilyTie, FamilyTie> = {
      none: 'none',
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
    };
    return inverted[rel.familyTie];
  }

  /**
   * Derives the relationship label from its values. Romantic and family states
   * are set explicitly elsewhere and are never overwritten here.
   */
  refreshType(rel: Relationship): void {
    if (rel.romantic || rel.type === 'married' || rel.type === 'engaged' || rel.type === 'dating') return;
    if (rel.familyTie !== 'none') {
      rel.type = 'family';
      return;
    }
    const bond = rel.closeness * 0.5 + rel.sympathy * 0.3 + rel.trust * 0.2;
    if (rel.conflict > 70 && rel.sympathy < 30) {
      rel.type = 'enemy';
      return;
    }
    if (rel.conflict > 48 && rel.sympathy < 48) {
      rel.type = 'rival';
      return;
    }
    if (rel.type === 'ex') return;
    if (bond >= 78) rel.type = 'best_friend';
    else if (bond >= 62) rel.type = 'close_friend';
    else if (bond >= 42) rel.type = 'friend';
    else if (rel.interactions > 2 || rel.closeness > 14) rel.type = 'acquaintance';
    else rel.type = 'stranger';
  }

  /** Slow drift for relationships nobody maintains. */
  decay(rel: Relationship, days: number): void {
    if (rel.familyTie !== 'none' || rel.romantic) {
      rel.closeness = clamp100(rel.closeness - 0.012 * days);
      return;
    }
    const rate = 0.055 * days;
    rel.closeness = clamp100(rel.closeness - rate);
    rel.sympathy = clamp100(rel.sympathy - rate * 0.35);
    rel.conflict = clamp100(rel.conflict - rate * 0.6);
    rel.attractionAB = clamp100(rel.attractionAB - rate * 0.5);
    rel.attractionBA = clamp100(rel.attractionBA - rate * 0.5);
  }

  /** Removes an edge entirely (used when an NPC is deleted). */
  drop(aId: number, bId: number): void {
    this.map.delete(pairKey(aId, bId));
  }

  serialize(): Relationship[] {
    return Array.from(this.map.values());
  }

  restore(list: Relationship[]): void {
    this.map.clear();
    for (const r of list) this.map.set(pairKey(r.a, r.b), r);
  }
}

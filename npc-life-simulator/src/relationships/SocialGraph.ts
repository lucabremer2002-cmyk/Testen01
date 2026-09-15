import type { NPC } from '../npc/types';
import type { RelationshipManager } from './RelationshipManager';
import type { RelationType, Relationship } from './types';

export interface SocialCircle {
  friends: number[];
  closeFriends: number[];
  colleagues: number[];
  family: number[];
  rivals: number[];
  acquaintances: number[];
  romantic: number[];
  exes: number[];
}

const FRIEND_TYPES: RelationType[] = ['friend', 'close_friend', 'best_friend'];

/** Read-only queries over the relationship graph, used by AI and by the UI. */
export class SocialGraph {
  constructor(private rels: RelationshipManager) {}

  circle(npc: NPC): SocialCircle {
    const c: SocialCircle = {
      friends: [],
      closeFriends: [],
      colleagues: [],
      family: [],
      rivals: [],
      acquaintances: [],
      romantic: [],
      exes: [],
    };
    for (const otherId of npc.links) {
      const rel = this.rels.get(npc.id, otherId);
      if (!rel) continue;
      switch (rel.type) {
        case 'best_friend':
        case 'close_friend':
          c.closeFriends.push(otherId);
          c.friends.push(otherId);
          break;
        case 'friend':
          c.friends.push(otherId);
          break;
        case 'colleague':
          c.colleagues.push(otherId);
          break;
        case 'family':
          c.family.push(otherId);
          break;
        case 'rival':
        case 'enemy':
          c.rivals.push(otherId);
          break;
        case 'dating':
        case 'engaged':
        case 'married':
        case 'crush':
          c.romantic.push(otherId);
          break;
        case 'ex':
          c.exes.push(otherId);
          break;
        default:
          c.acquaintances.push(otherId);
      }
    }
    return c;
  }

  friendCount(npc: NPC): number {
    let n = 0;
    for (const otherId of npc.links) {
      const rel = this.rels.get(npc.id, otherId);
      if (rel && FRIEND_TYPES.includes(rel.type)) n++;
    }
    return n;
  }

  /** Best relationship for a given purpose, or -1. */
  bestFor(npc: NPC, score: (rel: Relationship, otherId: number) => number): number {
    let best = -1;
    let bestScore = 0;
    for (const otherId of npc.links) {
      const rel = this.rels.get(npc.id, otherId);
      if (!rel) continue;
      const s = score(rel, otherId);
      if (s > bestScore) {
        bestScore = s;
        best = otherId;
      }
    }
    return best;
  }

  /** Friends of friends this NPC has not met yet - the natural way to expand. */
  suggestIntroductions(npc: NPC, alive: (id: number) => boolean, limit = 8): number[] {
    const out: number[] = [];
    const seen = new Set<number>(npc.links);
    seen.add(npc.id);
    for (const friendId of npc.links) {
      const rel = this.rels.get(npc.id, friendId);
      if (!rel || rel.closeness < 35) continue;
      const friendLinks = this.linksOf(friendId);
      if (!friendLinks) continue;
      for (const candidate of friendLinks) {
        if (seen.has(candidate) || !alive(candidate)) continue;
        seen.add(candidate);
        out.push(candidate);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  private linksProvider: ((id: number) => number[] | undefined) | null = null;

  setLinksProvider(fn: (id: number) => number[] | undefined): void {
    this.linksProvider = fn;
  }

  private linksOf(id: number): number[] | undefined {
    return this.linksProvider ? this.linksProvider(id) : undefined;
  }

  /** Aggregate graph statistics for the city panel. */
  stats(npcs: NPC[]): { edges: number; avgDegree: number; isolated: number; couples: number } {
    let edges = 0;
    let degree = 0;
    let isolated = 0;
    let couples = 0;
    let living = 0;
    for (const npc of npcs) {
      if (!npc.alive) continue;
      living++;
      degree += npc.links.length;
      if (npc.links.length === 0) isolated++;
      if (npc.family.partner >= 0 && npc.id < npc.family.partner) couples++;
    }
    edges = this.rels.size;
    return {
      edges,
      avgDegree: living ? degree / living : 0,
      isolated,
      couples,
    };
  }
}

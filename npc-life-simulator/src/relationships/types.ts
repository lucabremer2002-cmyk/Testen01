export type RelationType =
  | 'stranger'
  | 'acquaintance'
  | 'colleague'
  | 'friend'
  | 'close_friend'
  | 'best_friend'
  | 'crush'
  | 'dating'
  | 'engaged'
  | 'married'
  | 'ex'
  | 'rival'
  | 'enemy'
  | 'family';

export const RELATION_LABEL: Record<RelationType, string> = {
  stranger: 'Fremde',
  acquaintance: 'Bekannte',
  colleague: 'Arbeitskollegen',
  friend: 'Freunde',
  close_friend: 'Enge Freunde',
  best_friend: 'Beste Freunde',
  crush: 'Romantisches Interesse',
  dating: 'Beziehung',
  engaged: 'Verlobt',
  married: 'Verheiratet',
  ex: 'Ex-Partner',
  rival: 'Rivalen',
  enemy: 'Feinde',
  family: 'Familie',
};

export type FamilyTie = 'none' | 'parent' | 'child' | 'sibling' | 'grandparent' | 'grandchild';

export const FAMILY_TIE_LABEL: Record<FamilyTie, string> = {
  none: '',
  parent: 'Elternteil',
  child: 'Kind',
  sibling: 'Geschwister',
  grandparent: 'Großelternteil',
  grandchild: 'Enkelkind',
};

/**
 * One relationship between two NPCs. Core values are shared (a relationship is
 * a thing between two people), while opinion and attraction are stored per
 * direction because those genuinely differ.
 */
export interface Relationship {
  a: number;
  b: number;
  type: RelationType;
  /** Shared values, 0..100. */
  trust: number;
  sympathy: number;
  closeness: number;
  loyalty: number;
  conflict: number;
  respect: number;
  /** Directed: how strongly a is drawn to b, and vice versa. */
  attractionAB: number;
  attractionBA: number;
  /** Directed opinion, -100..100. */
  opinionAB: number;
  opinionBA: number;
  familyTie: FamilyTie;
  sinceDay: number;
  lastInteractionDay: number;
  interactions: number;
  /** True while the pair is romantically involved (dating/engaged/married). */
  romantic: boolean;
}

export const pairKey = (a: number, b: number): number =>
  a < b ? a * 1_000_000 + b : b * 1_000_000 + a;

import type { BuildingType } from '../world/types';
import type { EducationLevel, SkillId } from '../npc/types';

export interface Profession {
  id: string;
  label: string;
  /** Where this job can be performed. */
  buildings: readonly BuildingType[];
  /** Monthly gross pay at career level 0. */
  baseSalary: number;
  /** Pay multiplier per career step. */
  stepFactor: number;
  ladder: readonly string[];
  mainSkill: SkillId;
  secondSkill: SkillId;
  minEducation: EducationLevel;
  /** Typical working window [startHour, endHour]; end may exceed 24 for nights. */
  hours: readonly [number, number];
  /** 0..100 - social standing the job confers. */
  prestige: number;
  /** Relative number of slots a business of this kind offers. */
  density: number;
  /** True if the job is usually worked on weekends too. */
  weekend: boolean;
}

export interface Position {
  prof: string;
  max: number;
  filled: number;
}

export interface Company {
  id: number;
  name: string;
  buildingId: number;
  industry: BuildingType;
  /** NPC who founded it, -1 for pre-existing businesses. */
  founderId: number;
  ownerId: number;
  employees: number[];
  positions: Position[];
  balance: number;
  /** Rolling monthly aggregates. */
  revenue: number;
  costs: number;
  lastProfit: number;
  /** 0..100 - customer perception, influences revenue. */
  reputation: number;
  /** 0..100 - product/service quality. */
  quality: number;
  /** Price multiplier relative to the market average. */
  priceLevel: number;
  foundedDay: number;
  bankrupt: boolean;
  /** Consecutive months in the red - three in a row means trouble. */
  lossStreak: number;
  growth: number;
}

export type PriceCategory =
  | 'food'
  | 'rent'
  | 'transport'
  | 'dining'
  | 'clothing'
  | 'entertainment'
  | 'electronics'
  | 'health'
  | 'education';

export const PRICE_LABEL: Record<PriceCategory, string> = {
  food: 'Lebensmittel',
  rent: 'Miete',
  transport: 'Transport',
  dining: 'Gastronomie',
  clothing: 'Kleidung',
  entertainment: 'Unterhaltung',
  electronics: 'Elektronik',
  health: 'Gesundheit',
  education: 'Bildung',
};

export const PRICE_CATEGORIES: readonly PriceCategory[] = [
  'food', 'rent', 'transport', 'dining', 'clothing', 'entertainment', 'electronics', 'health', 'education',
];

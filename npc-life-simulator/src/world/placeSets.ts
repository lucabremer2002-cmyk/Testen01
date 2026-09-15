import type { BuildingType } from './types';

/**
 * Stable, module-level building-type sets. They must be shared constants
 * rather than inline literals, because World memoises nearest-building lookups
 * per type-set identity.
 */
export const PLACES = {
  school: ['school'],
  university: ['university', 'library'],
  park: ['park'],
  hospital: ['hospital'],
  bank: ['bank'],
  gym: ['gym', 'sports'],
  supermarket: ['supermarket', 'mall'],
  restaurant: ['restaurant', 'cafe'],
  shopping: ['mall', 'shop'],
  jobCentre: ['office', 'townhall', 'library'],
  nightOut: ['bar', 'cafe', 'park', 'sports', 'gym'],
  socialEvening: ['bar', 'restaurant', 'cafe'],
  socialAfternoon: ['cafe', 'park', 'restaurant'],
  socialDay: ['cafe', 'park'],
  date: ['restaurant', 'bar', 'park', 'cafe'],
  cemetery: ['cemetery'],
} as const satisfies Record<string, readonly BuildingType[]>;

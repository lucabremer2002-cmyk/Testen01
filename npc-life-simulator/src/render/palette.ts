import type { BuildingType, DistrictType } from '../world/types';
import type { ActionType } from '../npc/types';

export const COLORS = {
  bg: '#0b0e14',
  bgSoft: '#111620',
  panel: '#151b26',
  panelSoft: '#1b2331',
  border: '#242e3f',
  borderSoft: '#1d2534',
  text: '#dbe3f0',
  textDim: '#8b97ac',
  textFaint: '#5d687c',
  accent: '#4da3ff',
  accentSoft: '#2a5f9e',
  good: '#4ad6a0',
  warn: '#f2b23c',
  bad: '#f26d6d',
  love: '#f76ba9',
  road: '#1a2130',
  roadMajor: '#222c3e',
} as const;

/**
 * District fills stay close to the page background on purpose. They give the
 * city its shape, but the moving dots are what the player should read first.
 */
export const DISTRICT_COLORS: Record<DistrictType, string> = {
  downtown: '#1e2434',
  oldtown: '#26212f',
  residential: '#1a2331',
  suburb: '#1a2727',
  industrial: '#282320',
  commercial: '#1f2632',
  green: '#172619',
  campus: '#222537',
};

/**
 * Buildings are deliberately muted: the people are the subject of this map,
 * and bright buildings would drown out the dots that represent them.
 */
export const BUILDING_COLORS: Record<BuildingType, string> = {
  house: '#39485a',
  apartment: '#344457',
  office: '#3f4f6d',
  factory: '#53463a',
  workshop: '#4b453a',
  shop: '#4b425a',
  supermarket: '#41563f',
  restaurant: '#6a4d3f',
  bar: '#5c3f55',
  cafe: '#63523f',
  gym: '#3f5b5c',
  park: '#27492f',
  school: '#535c3b',
  university: '#5b5b3b',
  hospital: '#683f3f',
  police: '#384565',
  fire: '#663939',
  bank: '#55593a',
  mall: '#524b64',
  station: '#484853',
  sports: '#345549',
  library: '#525563',
  townhall: '#5c5640',
  cemetery: '#2c303b',
};

/** Dot colour by what the NPC is doing - readable at a glance on the map. */
export const ACTION_COLORS: Record<ActionType, string> = {
  sleep: '#4f5b78',
  eat_home: '#d79a63',
  eat_packed: '#c09a72',
  eat_out: '#e0a05c',
  groceries: '#8fbf7a',
  work: '#4da3ff',
  overtime: '#2f7ed0',
  job_hunt: '#c0c05a',
  school: '#a8c05a',
  study: '#9ac06a',
  socialize: '#4ad6a0',
  date: '#f76ba9',
  romance_hunt: '#e08ac0',
  family_time: '#7ad6c0',
  gym: '#5ec9d8',
  park: '#63c27a',
  shop: '#b98fd8',
  hygiene: '#7fb8d8',
  relax: '#8a95b8',
  hospital: '#f27070',
  bank: '#d8c45e',
  idle: '#6b7488',
  childcare: '#8fd0b0',
  funeral: '#6a6a80',
};

/** Linear gradient helper for the map overlays. */
export function ramp(t: number, from: [number, number, number], to: [number, number, number]): string {
  const c = Math.max(0, Math.min(1, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * c);
  const g = Math.round(from[1] + (to[1] - from[1]) * c);
  const b = Math.round(from[2] + (to[2] - from[2]) * c);
  return `rgb(${r},${g},${b})`;
}

export const RAMP_WEALTH: [[number, number, number], [number, number, number]] = [
  [70, 60, 60],
  [90, 200, 140],
];
export const RAMP_MOOD: [[number, number, number], [number, number, number]] = [
  [200, 80, 80],
  [90, 200, 140],
];
export const RAMP_AGE: [[number, number, number], [number, number, number]] = [
  [110, 190, 240],
  [180, 120, 200],
];

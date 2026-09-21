import type { ActionType } from './types';

/** One glyph per activity, so a list of people reads at a glance. */
export const ACTIVITY_ICON: Record<ActionType, string> = {
  sleep: '😴',
  eat_home: '🍽️',
  eat_packed: '🥪',
  eat_out: '🍝',
  groceries: '🛒',
  work: '💼',
  overtime: '🌙',
  job_hunt: '📄',
  school: '🎒',
  study: '📚',
  socialize: '💬',
  date: '💞',
  romance_hunt: '✨',
  family_time: '🏡',
  gym: '🏋️',
  park: '🌳',
  shop: '🛍️',
  hygiene: '🚿',
  relax: '🛋️',
  hospital: '🏥',
  bank: '🏦',
  idle: '⏳',
  childcare: '🧸',
  funeral: '🕯️',
};

export const TRAVEL_ICON = ['🚶', '🚌', '🚗'] as const;

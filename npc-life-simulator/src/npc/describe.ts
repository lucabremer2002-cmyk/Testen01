import { formatClock, formatDuration } from '../time/calendar';
import { ACTIONS } from '../simulation/Actions';
import { levelTitle } from '../economy/professions';
import type { SimulationEngine } from '../simulation/SimulationEngine';
import { EDUCATION_LABEL, LIFE_STAGE_LABEL, type NPC } from './types';
import { dominantEmotion, EMOTION_LABEL, mood } from './Emotions';
import { MODE_LABEL } from '../world/Travel';
import { ACTIVITY_ICON, TRAVEL_ICON } from './activityIcons';

export const fullName = (npc: NPC): string => `${npc.firstName} ${npc.lastName}`;
export const initials = (npc: NPC): string => `${npc.firstName[0]}${npc.lastName[0]}`;

/** Job title including career level, or the reason there is none. */
export function jobTitle(engine: SimulationEngine, npc: NPC): string {
  if (npc.retired) return 'Im Ruhestand';
  if (npc.ageYears < 6) return 'Kleinkind';
  if (npc.ageYears < 18) return 'Schüler/in';
  const prof = engine.professionOf(npc);
  if (!prof) return 'Arbeitssuchend';
  return `${levelTitle(prof, npc.careerLevel)} · ${prof.label}`;
}

export function employerName(engine: SimulationEngine, npc: NPC): string {
  const c = npc.employerId >= 0 ? engine.companies[npc.employerId] : null;
  return c ? c.name : '–';
}

/** One-line description of what the NPC is doing right now. */
export function currentActivity(engine: SimulationEngine, npc: NPC): string {
  if (!npc.alive) return 'verstorben';
  if (npc.travel) {
    const dest = engine.world.buildings[npc.travel.toId];
    const left = Math.max(0, npc.travel.arriveMin - engine.now);
    return `unterwegs ${MODE_LABEL[npc.travel.mode]} nach ${dest?.name ?? '?'} (${formatDuration(left)})`;
  }
  const def = ACTIONS[npc.action.type];
  const place = engine.world.buildings[npc.action.locationId];
  const withWhom =
    npc.action.partner >= 0 && engine.npcs[npc.action.partner]
      ? ` mit ${fullName(engine.npcs[npc.action.partner])}`
      : '';
  const where = place && npc.action.type !== 'sleep' ? ` · ${place.name}` : '';
  return `${def.label}${withWhom}${where}`;
}

/** Icon for what somebody is doing right now, travel included. */
export function activityIcon(npc: NPC): string {
  if (!npc.alive) return '🕯️';
  if (npc.travel) return TRAVEL_ICON[npc.travel.mode];
  return ACTIVITY_ICON[npc.action.type];
}

export interface TimelineStep {
  time: string;
  icon: string;
  text: string;
  min: number;
}

/** A person's recent day as a readable sequence of steps. */
export function activityTimeline(engine: SimulationEngine, npc: NPC): TimelineStep[] {
  const out: TimelineStep[] = [];
  for (const entry of npc.activityLog) {
    const place = engine.world.buildings[entry.locationId];
    const other = entry.partner >= 0 ? engine.npcs[entry.partner] : undefined;
    const label = ACTIONS[entry.type].label;
    const withWhom = other ? ` mit ${fullName(other)}` : '';
    const where = place && entry.type !== 'sleep' ? ` · ${place.name}` : '';
    out.push({
      min: entry.min,
      time: formatClock(entry.min),
      icon: ACTIVITY_ICON[entry.type],
      text: `${label}${withWhom}${where}`,
    });
  }
  return out.reverse();
}

export function activityShort(npc: NPC): string {
  if (!npc.alive) return 'verstorben';
  if (npc.travel) return 'unterwegs';
  return ACTIONS[npc.action.type].label;
}

export function homeLabel(engine: SimulationEngine, npc: NPC): string {
  if (npc.homeId < 0) return 'ohne festen Wohnsitz';
  const b = engine.world.buildings[npc.homeId];
  const d = engine.world.districts[b.districtId];
  return `${b.name}, ${d.name}`;
}

export function moodLabel(npc: NPC): { text: string; tone: 'good' | 'warn' | 'bad' } {
  const m = mood(npc);
  const emo = dominantEmotion(npc);
  const label = emo === 'neutral' ? 'ausgeglichen' : EMOTION_LABEL[emo];
  if (m > 45) return { text: label, tone: 'good' };
  if (m > 18) return { text: label, tone: 'warn' };
  return { text: label, tone: 'bad' };
}

export function relationshipStatus(engine: SimulationEngine, npc: NPC): string {
  if (npc.family.partner < 0) {
    return npc.family.exPartners.length ? 'getrennt' : 'ledig';
  }
  const partner = engine.npcs[npc.family.partner];
  const verb = npc.family.married ? 'verheiratet mit' : 'zusammen mit';
  return `${verb} ${partner ? fullName(partner) : '?'}`;
}

export function educationLabel(npc: NPC): string {
  return EDUCATION_LABEL[npc.education] ?? '–';
}

export function stageLabel(npc: NPC): string {
  return LIFE_STAGE_LABEL[npc.lifeStage];
}

/** The NPC's own daily rhythm, for the routine view. */
export function routineLine(npc: NPC): string {
  const wake = formatClock(Math.round(npc.wakeHour * 60));
  const sleep = formatClock(Math.round((npc.sleepHour % 24) * 60));
  return `steht gegen ${wake} auf, geht gegen ${sleep} schlafen`;
}

/** Deterministic pastel colour per NPC, used for avatars and map tints. */
export function tintOf(npc: NPC): string {
  const hue = (npc.appearance.tint * 31 + npc.id * 13) % 360;
  return `hsl(${hue} 55% 62%)`;
}

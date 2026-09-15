/** Diagnostic probe: what is the city doing at each hour of the day? */
import { SimulationEngine } from '../simulation/SimulationEngine';
import { MINUTES_PER_DAY } from '../time/calendar';
import { ACTIONS } from '../simulation/Actions';
import type { ActionType } from '../npc/types';

const speed = Number(process.argv[2] ?? 50) as 50 | 100 | 500;
const engine = SimulationEngine.create({ seed: 847291, population: 600 });
engine.setSpeed(speed);
console.log(`Geschwindigkeit: ${speed}x\n`);

// Warm up for a week so the routines settle.
const warmEnd = engine.now + MINUTES_PER_DAY * 7;
while (engine.now < warmEnd) engine.tick();

const hours = [3, 8, 10, 13, 16, 19, 22];
const table: Record<number, Record<string, number>> = {};

for (const targetHour of hours) {
  // Advance to the next occurrence of this hour.
  const targetMin = Math.floor(engine.now / MINUTES_PER_DAY) * MINUTES_PER_DAY + targetHour * 60;
  const goal = targetMin > engine.now ? targetMin : targetMin + MINUTES_PER_DAY;
  while (engine.now < goal) engine.tick();

  const counts: Record<string, number> = {};
  let travelling = 0;
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.travel) travelling++;
    const key: ActionType = npc.action.type;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  counts['(unterwegs)'] = travelling;
  table[targetHour] = counts;
}

const allKeys = new Set<string>();
for (const h of hours) for (const k of Object.keys(table[h])) allKeys.add(k);
const keys = [...allKeys].sort();

console.log('Aktivität nach Uhrzeit (Anteil der 600 Einwohner in %)\n');
console.log('Aktivität'.padEnd(26) + hours.map((h) => `${h}h`.padStart(7)).join(''));
for (const k of keys) {
  const label = k === '(unterwegs)' ? 'unterwegs (Reise)' : ACTIONS[k as ActionType]?.label ?? k;
  const row = hours.map((h) => (((table[h][k] ?? 0) / 600) * 100).toFixed(1).padStart(7)).join('');
  console.log(label.padEnd(26) + row);
}

const sleepAtNoon = ((table[13].sleep ?? 0) / 600) * 100;
const workAt10 = ((table[10].work ?? 0) / 600) * 100;
const sleepAt3 = ((table[3].sleep ?? 0) / 600) * 100;
console.log(`\nPlausibilität:`);
console.log(`  Schlafend um 03:00: ${sleepAt3.toFixed(1)} %  (erwartet: hoch)`);
console.log(`  Arbeitend um 10:00: ${workAt10.toFixed(1)} %  (erwartet: ~30-45 %)`);
console.log(`  Schlafend um 13:00: ${sleepAtNoon.toFixed(1)} %  (erwartet: < 8 %)`);

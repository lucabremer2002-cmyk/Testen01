/** Measures how much visible life the city produces per simulated day. */
import { SimulationEngine } from '../simulation/SimulationEngine';
import { MINUTES_PER_DAY } from '../time/calendar';

const population = Number(process.argv[2] ?? 1200);
const days = Number(process.argv[3] ?? 14);
const engine = SimulationEngine.create({ seed: 847291, population, warmUpDays: 1 });
engine.setSpeed(2000);

const counts: Record<string, number> = {};
const original = engine.emit.bind(engine);
engine.emit = ((input: Parameters<typeof original>[0]) => {
  counts[input.type] = (counts[input.type] ?? 0) + 1;
  return original(input);
}) as typeof engine.emit;

const target = engine.now + MINUTES_PER_DAY * days;
while (engine.now < target) engine.tick();

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`${population} Einwohner · ${days} Simulationstage\n`);
console.log(`Ereignisse pro Sim-Tag: ${(total / days).toFixed(1)}\n`);
console.log('Typ              pro Tag   Anteil');
for (const [type, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`${type.padEnd(16)} ${(n / days).toFixed(1).padStart(7)}   ${((n / total) * 100).toFixed(0)} %`);
}
for (const speed of [10, 50]) {
  console.log(
    `Bei ${String(speed).padStart(3)}x: ${((total / (days * MINUTES_PER_DAY)) * speed).toFixed(2)} Ereignisse pro realer Sekunde`,
  );
}

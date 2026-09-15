/**
 * End-to-end smoke test: starts a world in a real browser, walks through every
 * panel, intervenes via god mode, saves and reloads. Run `npm run dev` first.
 *   node scripts/e2e.mjs
 */
import { chromium } from 'playwright';

// Screenshots land next to the script unless a target directory is given.
const SHOTS = process.env.E2E_SHOTS ?? new URL('../.e2e-shots/', import.meta.url).pathname;
const BASE = process.env.E2E_URL ?? 'http://localhost:5173/';
const CHROME =
  process.env.E2E_CHROME ??
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
await (await import('node:fs/promises')).mkdir(SHOTS, { recursive: true });
const errors = [];

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${SHOTS}/01-menu.png` });

// Start a smaller world so the test is quick.
await page.locator('#pop').fill('600');
await page.getByRole('button', { name: /Neue Welt erschaffen/ }).click();
await page.waitForSelector('.map-canvas', { timeout: 45000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/02-intro.png` });
// Dismiss the first-run introduction before driving the UI.
const skip = page.getByRole('button', { name: 'Überspringen' });
if (await skip.isVisible().catch(() => false)) await skip.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/02-game.png` });

// Speed up and let the world run.
await page.getByRole('button', { name: '100×' }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${SHOTS}/03-running.png` });

// Select the first person in the list.
const firstPerson = page.locator('.person-row').first();
await firstPerson.click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/04-selected.png` });

// Walk through every detail tab.
for (const tab of ['Zustand', 'Beziehungen', 'Leben', 'Beruf & Geld', 'Ziele']) {
  await page.locator('.sidebar.right .tab', { hasText: tab }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/05-tab-${tab.replace(/[^a-z]/gi, '')}.png` });
}

// God mode.
await page.getByRole('button', { name: /Eingreifen/ }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Geld schenken' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOTS}/06-god.png` });

// Left sidebar tabs.
for (const tab of ['Statistik', 'Wirtschaft', 'Geschichten', 'Verfolgt']) {
  await page.locator('.sidebar:not(.right) .tab', { hasText: tab }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/07-left-${tab}.png` });
}

// Debug overlay + time skip.
await page.keyboard.press('d');
await page.waitForTimeout(400);
await page.getByRole('button', { name: '+1 Monat' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/08-debug.png` });

// Search.
await page.locator('.search-input').fill('Max');
await page.waitForTimeout(700);
await page.screenshot({ path: `${SHOTS}/09-search.png` });
await page.keyboard.press('Escape');

// Map interaction: zoom and overlays.
await page.locator('.map-canvas').hover({ position: { x: 500, y: 400 } });
await page.mouse.wheel(0, -600);
await page.waitForTimeout(600);
await page.locator('.overlay-picker .tab', { hasText: 'Stimmung' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/10-map-mood.png` });

// Save + reload to verify persistence.
await page.locator('button[title^="Welt speichern"]').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/11-saved.png` });

const stats = await page.evaluate(() => {
  const el = document.querySelector('.clock .date');
  return el ? el.textContent : null;
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.save-row', { timeout: 20000 });
await page.getByRole('button', { name: 'Laden' }).first().click();
await page.waitForSelector('.map-canvas', { timeout: 45000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/12-loaded.png` });

const loadedDate = await page.evaluate(() => document.querySelector('.clock .date')?.textContent);

console.log('Datum vor dem Speichern :', stats);
console.log('Datum nach dem Laden    :', loadedDate);
console.log('\nFehler im Browser:', errors.length);
for (const e of errors.slice(0, 20)) console.log('  -', e);
console.log('Screenshots:', SHOTS);

await browser.close();
if (errors.length) process.exitCode = 1;

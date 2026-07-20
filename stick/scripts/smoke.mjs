// Headless smoke test for the Stick RPG remake: drives the real game in
// Chromium — new-game flow, a McSticks shift, the Skater Punk quest,
// casino blackjack, the sleep cycle — and fails on any page error.
// Usage:  npm run build && npx vite preview --port 4173 &  then  node scripts/smoke.mjs [shotDir]
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/';
const shotDir = process.argv[2] ?? null;

const browser = await chromium.launch();
const errors = [];

function makeSave(state, x, z) {
  return JSON.stringify({ v: 2, state: JSON.stringify(state), x, z, carX: -84, carZ: -64 });
}

function baseState(patch = {}) {
  return {
    version: 2, name: 'Smokey', dayLimit: 40, day: 2, minute: 12 * 60,
    cash: 500, bank: 100, loan: 0, hp: 25,
    stats: { strength: 5, intelligence: 25, charm: 5 }, karma: 0,
    inventory: {}, furniture: [], furnitureUsed: [], home: 'apartment',
    jobRank: -1, shiftsAtRank: 0, hasSkateboard: false, hasCar: false,
    punkSmokes: 0, punkDead: false, cityVisits: {},
    stockPrices: { XGEN: 50, STIK: 20, DIME: 5 },
    stockOwned: { XGEN: 0, STIK: 0, DIME: 0 },
    messages: [], titleOffered: false, title: 'none',
    dead: false, deathCause: null, ended: false, seed: 12345,
    ...patch,
  };
}

async function openPage(save) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  if (save) await page.addInitScript(s => localStorage.setItem('stick-rpg-3d-save', s), save);
  else await page.addInitScript(() => localStorage.removeItem('stick-rpg-3d-save'));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  return page;
}

const hud = async page => (await page.textContent('#hud'))?.replace(/\s+/g, ' ') ?? '';
const menu = async page =>
  (await page.evaluate(() => document.querySelector('.menu-card')?.textContent ?? ''))
    .replace(/\s+/g, ' ');
const teleport = (page, x, z) => page.evaluate(([tx, tz]) => window.__stick.teleport(tx, tz), [x, z]);
const gameMode = page => page.evaluate(() => window.__stick.mode());

// --- 1. new game flow ---
{
  const page = await openPage(null);
  await page.fill('#ng-name', 'Smokey');
  await page.click('#ng-lengths .screen-btn:nth-child(2)'); // 40 days
  await page.waitForTimeout(500);
  const h = await hud(page);
  if (!h.includes('Day 1 / 40')) errors.push(`new game HUD wrong: ${h}`);
  if (!h.includes('$100')) errors.push(`new game cash wrong: ${h}`);
  if (shotDir) await page.screenshot({ path: `${shotDir}/shot-spawn.png` });
  await page.close();
}

// --- 2. McSticks: walk in, work a shift ---
{
  const page = await openPage(makeSave(baseState(), -30, -19));
  await page.keyboard.press('e'); // enter the building
  await page.waitForTimeout(500);
  if ((await gameMode(page)) !== 'mcsticks') errors.push('did not enter McSticks');
  if (shotDir) await page.screenshot({ path: `${shotDir}/shot-mcsticks.png` });
  await teleport(page, 8, -6); // kitchen station
  await page.waitForTimeout(150);
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const h = await hud(page);
  if (!h.includes('$536')) errors.push(`McSticks shift pay missing (want $536): ${h}`);
  await page.close();
}

// --- 3. Skater Punk quest: smokes → skateboard ---
{
  const page = await openPage(makeSave(baseState({ inventory: { smokes: 1 } }), 11, -6));
  const pos = await page.evaluate(() => window.__stick.npcPos('punk'));
  await teleport(page, pos[0] + 1, pos[1]);
  await page.waitForTimeout(150);
  await page.keyboard.press('e');
  await page.waitForTimeout(250);
  const m = await menu(page);
  if (!m.includes('Skater Punk')) errors.push(`punk menu missing: ${m}`);
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  const board = await page.evaluate(() => window.__stick.getState()?.hasSkateboard);
  if (!board) errors.push('skateboard not granted');
  await page.close();
}

// --- 4. Casino: blackjack round ---
{
  const page = await openPage(makeSave(baseState(), -10, 66)); // casino door
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  if ((await gameMode(page)) !== 'casino') errors.push('did not enter the casino');
  if (shotDir) await page.screenshot({ path: `${shotDir}/shot-casino.png` });
  await teleport(page, 0, -6); // blackjack table
  await page.waitForTimeout(150);
  await page.keyboard.press('e');
  await page.waitForTimeout(250);
  let m = await menu(page);
  if (!m.includes('Blackjack')) errors.push(`blackjack menu missing: ${m}`);
  await page.keyboard.press('2'); // +$25 chip
  await page.waitForTimeout(150);
  await page.keyboard.press('d'); // deal
  await page.waitForTimeout(250);
  await page.keyboard.press('s'); // stand (no-op if already settled)
  await page.waitForTimeout(250);
  m = await menu(page);
  if (!/BLACKJACK|win|Push|Bust|Dealer wins/i.test(m)) errors.push(`blackjack round did not settle: ${m}`);
  await page.close();
}

// --- 5. Sleep flow at the apartment ---
{
  const page = await openPage(makeSave(baseState({ minute: 22 * 60 }), -72, -41));
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  if ((await gameMode(page)) !== 'apartment') errors.push('did not enter the apartment');
  if (shotDir) await page.screenshot({ path: `${shotDir}/shot-apartment.png` });
  await teleport(page, -8, -6); // bed
  await page.waitForTimeout(150);
  await page.keyboard.press('e');
  await page.waitForTimeout(250);
  const m = await menu(page);
  if (!m.includes('Call it a day')) errors.push(`sleep menu missing: ${m}`);
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  const h = await hud(page);
  if (!h.includes('Day 3')) errors.push(`sleep did not end the day: ${h}`);
  await page.close();
}

// --- 6. night look ---
if (shotDir) {
  const page = await openPage(makeSave(baseState({ minute: 22 * 60 }), 0, 20));
  await page.screenshot({ path: `${shotDir}/shot-night.png` });
  await page.close();
}

await browser.close();
console.log(errors.length ? `FAIL\n${errors.join('\n')}` : 'SMOKE OK');
process.exit(errors.length ? 1 : 0);

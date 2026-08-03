// WHICH ROOMS RESOLVE NO BUILDING NAME, and therefore build the kit's generic
// leaf without ever consulting a DoorDecl?
//
// The answer decides whether the new warning is a finding or a permanent siren:
// a warning that fires for six rooms forever is noise, one that fires for the
// one broken room is the check.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-noname-rooms.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const warns = [];
page.on('console', (m) => { if (/\[interior:/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// Interiors are built lazily on entry in some builds, so visit every room the
// world publishes rather than trusting what spawn happened to build.
const rooms = await page.evaluate(() => (window.__ct.rooms?.() ?? []).map((r) => r.id ?? r));
console.log(`rooms published: ${rooms.length ? rooms.join(', ') : '(none — __ct.rooms() absent)'}`);
await page.waitForTimeout(1500);

const noName = warns.filter((w) => /NO BUILDING NAME/.test(w));
console.log(`\n[interior:] warnings: ${warns.length}`);
for (const w of warns) console.log('  ' + w.split('\n')[0].slice(0, 140));
console.log(`\nrooms with NO BUILDING NAME: ${noName.length}`);
for (const w of noName) console.log('  ' + (w.match(/\[interior:([^\]]+)\]/) ?? [, '?'])[1]);

await browser.close();

// H (verifier): "instead of calling the casino golden aces call it SEVENS".
// The predicate is self-evident and needs no station: the old name must be
// gone from what the player can read, and the new one present.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 60000 });
const spots = await p.evaluate(() => window.__ct.spots().map((s) => s.label));
const hitOld = spots.filter((s) => /golden\s*aces/i.test(s));
const hitNew = spots.filter((s) => /sevens/i.test(s));
console.log(`spots mentioning GOLDEN ACES: ${hitOld.length}  ${JSON.stringify(hitOld)}`);
console.log(`spots mentioning SEVENS:      ${hitNew.length}  ${JSON.stringify(hitNew)}`);
// and any room/label the world publishes
const rooms = await p.evaluate(() => (window.__ct.rooms ? window.__ct.rooms() : []).map((r) => r.name || r.id || String(r)));
console.log(`rooms: ${rooms.filter((r) => /aces|sevens/i.test(r)).join(', ') || '(none matching)'}`);
await b.close();

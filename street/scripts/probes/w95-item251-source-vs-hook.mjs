// Item 251 — re-verify, on DEV (where both are readable), that every source
// import interiors-walk.mjs makes is either answered by `__ct` or dead.
//
// Worker ninetythree measured this and I am not taking it on trust: the whole
// point of the conversion is that the hook and the source agree, and if they
// disagree anywhere the conversion silently changes what the check tests.
//
// Must run on `vite dev` — it reads the TS sources, which is the very thing
// being removed from the harness.
//
// Usage: SHOT_URL=http://localhost:4511/ node scripts/probes/w95-item251-source-vs-hook.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 400 } });
await page.goto(process.env.SHOT_URL || 'http://localhost:4511/');
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.waitForTimeout(800);

const r = await page.evaluate(async () => {
  const dm = await import('/src/proto/ct/doors.ts');
  const im = await import('/src/proto/ct/interior.ts');
  const hookDoors = window.__ct.doors();
  const dims = window.__ct.roomDims();
  const out = { stand: [], point: [], party: null, dimsDoor: [], names: [] };
  for (const d of dm.declaredDoors()) {
    const n = d.building;
    out.names.push(n);
    const src = dm.doorStandFor(n), hook = (hookDoors.find((h) => h.building === n) || {}).stand;
    out.stand.push({ n, agree: JSON.stringify(src) === JSON.stringify(hook), src, hook });
    const sp = dm.doorPointFor(n), hp = (hookDoors.find((h) => h.building === n) || {}).point;
    out.point.push({ n, agree: JSON.stringify(sp) === JSON.stringify(hp) });
  }
  // does every room roomDims() publishes carry a `door`? the `|| { x: room.at }`
  // fallback in interiors-walk is the ONLY consumer of declaredDoors().at, so
  // if this is 13/13 that import is dead too.
  for (const d of dims) out.dimsDoor.push({ id: d.id, hasDoor: !!d.door });
  // and does the hook's PARTY match the source's?
  out.party = { src: im.PARTY, hook: window.__ct.party ? window.__ct.party() : null };
  return out;
});

const bad = r.stand.filter((x) => !x.agree);
console.log(`\n  doorStandFor  vs __ct.doors().stand : ${r.stand.length - bad.length}/${r.stand.length} agree`);
for (const b of bad) console.log(`    DISAGREE ${b.n}: src=${JSON.stringify(b.src)} hook=${JSON.stringify(b.hook)}`);
const badP = r.point.filter((x) => !x.agree);
console.log(`  doorPointFor  vs __ct.doors().point : ${r.point.length - badP.length}/${r.point.length} agree`);
for (const b of badP) console.log(`    DISAGREE ${b.n}`);

const noDoor = r.dimsDoor.filter((d) => !d.hasDoor);
console.log(`  roomDims() rooms publishing a .door  : ${r.dimsDoor.length - noDoor.length}/${r.dimsDoor.length}`);
for (const d of noDoor) console.log(`    NO DOOR: ${d.id}  <- the room.at fallback would fire for this one`);

console.log(`\n  PARTY source: ${JSON.stringify(r.party.src)}`);
console.log(`  PARTY hook  : ${JSON.stringify(r.party.hook)}`);
console.log(`  match: ${JSON.stringify(r.party.src) === JSON.stringify(r.party.hook)}`);

// the hook must be a COPY — mutating what it returns must not touch the world
const iso = await page.evaluate(() => {
  const a = window.__ct.party();
  a.push({ west: 'BOGUS', east: 'BOGUS', at: 0, w: 0, h: 0 });
  a[0].at = 999;
  const b = window.__ct.party();
  return { len: b.length, at: b[0].at };
});
console.log(`  read-only: after pushing and mutating the returned array,`
  + ` party() is still len ${iso.len} at ${iso.at}`
  + ` -> ${iso.len === 1 && iso.at === -9 ? 'ISOLATED' : 'LEAKS'}`);
await browser.close();

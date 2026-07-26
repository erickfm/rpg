#!/usr/bin/env node
/**
 * ARE THE LIBRARY'S FIGURES VISIBLE TO A PEOPLE CHECK, AND ARE THE SEATED ONES
 * ON THEIR SEATS?
 *
 * This exists because of a defect that no camera and no other check could see.
 * `int-library.ts` builds its readers with `citizenSprite` DIRECTLY rather than
 * through the kit's `room.person`, and it is right to: `room.person` places at
 * the FLOOR, which is correct for a keeper and wrong for a sitter. But
 * `room.person` also sets `userData.citizen`, and building them the direct way
 * skipped that — so three 8-angle citizens sat in this room tagged as nothing.
 *
 * `ct/interior.ts` says exactly why that matters, and it is the whole reason
 * for this file:
 *
 *   "The kit is the only thing that knows which meshes are people [because] a
 *    circle test that selects 'textured plane about person-height' also catches
 *    the thrift's mannequin and the diner's framed photographs."
 *
 * SO THE FAILURE IS SILENT IN THE WORST DIRECTION. A world sweep asking "does
 * every figure turn?" or "is every seated figure on its seat?" does not report
 * these readers as broken — it does not see them at all, finds nothing to
 * complain about, and prints GREEN. A check that skips a figure and a check
 * that passes it look identical from the outside.
 *
 * GOTCHAS §34, population before absences: this asserts the COUNT first. Nought
 * figures would make every verdict under it free.
 *
 *   node scripts/J-library-people.mjs              # SHOT_URL=your own preview
 *   node scripts/J-library-people.mjs --selftest   # must go RED
 */
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('SHOT_URL is not set. A default port is somebody else\'s server —');
  console.error('GOTCHAS §26/§48. Point this at your own preview and run it again.');
  process.exit(3);
}
const SELFTEST = process.argv.includes('--selftest');

const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// `__ct` existing means BUILT, not DRAWN. Wait for the world to settle rather
// than measuring a half-painted frame — this cost me a morning of black shots.
await p.waitForTimeout(3000);

const R = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => r.id === 'library'));
if (!R) { console.error('ABORTED: no room publishes itself as `library`.'); await b.close(); process.exit(3); }
console.log(`measuring ${URL}`);
console.log(`library ${R.w} x ${R.d} at (${R.cx}, ${R.cz})\n`);

if (SELFTEST) {
  // BREAK IT THE WAY IT WAS BROKEN. Strip the tag off the seated readers and
  // this must go red — if it stays green the check is measuring nothing.
  const n = await p.evaluate(([cx, cz, hw, hd]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let n = 0;
    s.traverse((m) => {
      if (!m.isMesh || !m.userData.citizen || !m.userData.seated) return;
      const e = m.matrixWorld.elements;
      if (Math.abs(e[12] - cx) > hw || Math.abs(e[14] - cz) > hd) return;
      m.userData.citizen = false; n++;
    });
    return n;
  }, [R.cx, R.cz, R.w / 2, R.d / 2]);
  console.log(`--selftest: untagged ${n} seated reader(s), the exact fault this guards\n`);
}

const seen = await p.evaluate(([cx, cz, hw, hd]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const people = [], lookalikes = [];
  s.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    const e = m.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (Math.abs(x - cx) > hw || Math.abs(z - cz) > hd) return;
    if (m.userData.citizen) { people.push({ x, y, z, seated: !!m.userData.seated }); return; }
    // What a shape test alone would pick up: an upright plane about the size of
    // a person. Some of these are shelving and notice boards, which is the
    // point — the tag is what tells them apart.
    const g = m.geometry;
    if (g.type !== 'PlaneGeometry' || !g.parameters) return;
    const sy = (g.parameters.height || 0) * m.scale.y, sx = (g.parameters.width || 0) * m.scale.x;
    if (Math.abs(m.rotation.x) < 0.35 && sy > 1.35 && sy < 2.10 && sx > 0.30 && sx < 1.20)
      lookalikes.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: +sx.toFixed(2), h: +sy.toFixed(2) });
  });
  return { people, lookalikes };
}, [R.cx, R.cz, R.w / 2, R.d / 2]);

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

// POPULATION FIRST (§34). Everything below is free if this is nought.
say(seen.people.length >= 4,
  'the library has its figures, and they are tagged as people',
  `${seen.people.length} tagged (a librarian and three sitters), ${seen.people.filter((q) => q.seated).length} of them seated`);

// THE ACTUAL DEFECT: a person-shaped plane that carries no tag is either an
// untagged figure or a bookcase, and nothing downstream can tell which.
say(seen.lookalikes.length === 0,
  'no person-shaped plane in this room is left untagged',
  seen.lookalikes.length === 0
    ? 'every figure declares itself; nothing else in the room is person-shaped'
    : `${seen.lookalikes.length} untagged: ` + seen.lookalikes.slice(0, 4)
        .map((q) => `(${q.x}, ${q.z}) ${q.w}x${q.h} m`).join(', '));

// The seated ones must be ON the pan, not in it. This is the 2.5 cm sink G
// found, expressed as a predicate so it cannot come back quietly: the seated
// origin is the HIP and belongs at the SEAT TOP.
const sat = seen.people.filter((q) => q.seated);
const lo = sat.length ? Math.min(...sat.map((q) => q.y)) : 0;
const hi = sat.length ? Math.max(...sat.map((q) => q.y)) : 0;
say(sat.length > 0 && lo > 0.46 && hi < 0.50,
  'every seated reader has their hip on the seat top, not inside the pan',
  sat.length ? `${sat.length} seated, origin y ${lo.toFixed(3)}…${hi.toFixed(3)} m (the pan top is 0.475)` : 'no seated figures found');

say(errs.length === 0, 'no console errors', errs.length ? errs.slice(0, 2).join(' | ') : 'clean');

console.log(fails ? `\n${fails} failed` : '\nall good');
await b.close();
process.exit(fails ? 2 : 0);

// THE THREE LIBRARY CLAIMS THAT NOTHING WOULD CATCH GOING FALSE.
//
// The auditor swept all 171 CONFIRMED rows for what their status actually
// rests on and found 28 that "name nobody and nothing" — the point being not
// that they are wrong but that **nothing would tell us if they stopped being
// true**, which is the same shape as the guards that had stopped guarding.
//
// I could not find three rows of MINE matching that description: at the
// sweep's own commit J owned six CONFIRMED rows, every one naming a verifier
// (C x5, the auditor x1) and carrying 2,303–4,894 characters and a STAND AT.
// But the substance applies anyway, and it is checkable — of my six rows, only
// two name an automated predicate:
//
//   the entrance          J-library-door.mjs      guarded
//   the stair handrail    J-gallery-walk.mjs      guarded
//   the partition removal        —                NOTHING
//   the librarian + computers    —                NOTHING
//   the periodicals              —                NOTHING
//
// So this is the missing predicate for those three. Each verdict is written to
// fail on the SPECIFIC WAY the user's original complaint would come back, not
// on a proxy for it.
//
// Usage: SHOT_URL=http://localhost:4192/ node scripts/J-library-room.mjs walk
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { modes } from './lib/modes.mjs';

const mode = modes('J-library-room', ['walk', 'all']);
void mode;
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4192/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(2500);

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// ── population first (GOTCHAS §34) ──────────────────────────────────────────
const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'library'));
if (!room) {
  console.error('ABORT  no library slab — every verdict below would pass for free');
  await b.close(); process.exit(3);
}
console.log(`library ${room.w} x ${room.d} at (${room.cx}, ${room.cz})`);

if (SELFTEST) {
  // one mutation per verdict, all in the LIVE world so nothing is rebuilt
  await p.evaluate(([cx, cz]) => {
    // (1) put the partition back: a collider band across the room at the old
    //     pier line, which is what "get rid of this weird internal structure"
    //     was about
    window.__ct.colliders().push({
      minX: cx - 10, maxX: cx - 2.8, minZ: cz + 6.63, maxZ: cz + 6.97 });
    window.__ct.colliders().push({
      minX: cx + 2.8, maxX: cx + 10, minZ: cz + 6.63, maxZ: cz + 6.97 });
    // (2) SHOVE THE LIBRARIAN OUT OF HER DESK. My first mutation set her
    //     `map.offset.x` to the back view — and the verdict stayed GREEN,
    //     because `citizenSprite.update()` recomputes the frame from the
    //     camera every tick and simply overwrote it on the next one. That is
    //     GOTCHAS §27 exactly: "a mutation that does not actually break the
    //     thing proves nothing, and looks exactly like a check that works." I
    //     only know because I watched the selftest fail to fail.
    //
    //     Her POSITION is durable, so that is what moves: 3 m north puts her
    //     on open floor outside the desk's collider, which is the "standing in
    //     the open" fault the row was filed for.
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m?.map || m.alphaTest !== 0.5 || Math.abs(m.map.repeat.y - 0.5) > 1e-6) return;
      const q = o.getWorldPosition(o.position.clone());
      if (Math.abs(q.x - (cx - 3.5)) > 0.4 || Math.abs(q.z - (cz + 4.2)) > 0.4) return;
      o.position.z -= 3.0;
    });
    // (3) blank every screen, so "at least one lit catalogue prompt" fails
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const img = m?.map?.image;
      if (img && img.width === 20 && img.height === 16) m.color.setHex(0x000000);
    });
  }, [room.cx, room.cz]);
  console.log('SELFTEST: partition restored, librarian shoved out of her desk, '
    + 'screens blanked — three verdicts must go red');
  console.log('NOTE: the FACING verdict has no mutation. The frame is recomputed');
  console.log('      every tick from the camera, so it cannot be broken from out');
  console.log('      here, and the facing itself lives in source. Said rather than');
  console.log('      faked — 4 of 5 verdicts are falsifiable, that one is not.');
}

// ── 1. THE PARTITION IS GONE ────────────────────────────────────────────────
//
// *"get rid of this weird internal structure inside the library"*. It was a
// soffit on two piers whose colliders spanned the room at local z 6.80,
// leaving a 5.6 m gap in a 20 m wall. So the predicate is the CLEAR SPAN
// across the room on that line: it was 5.6 m and it must now be the full
// width. A future pass that reintroduces any cross-room mass here fails.
const span = await p.evaluate(([cx, cz, w]) => {
  const zc = cz + 6.80, R = 0.36;
  const solid = (x) => window.__ct.colliders().some((c) =>
    x > c.minX - R && x < c.maxX + R && zc > c.minZ - R && zc < c.maxZ + R);
  let best = 0, run = 0;
  for (let x = cx - w / 2 + 0.3; x <= cx + w / 2 - 0.3; x += 0.05) {
    if (solid(x)) run = 0; else { run += 0.05; best = Math.max(best, run); }
  }
  return +best.toFixed(2);
}, [room.cx, room.cz, room.w]);
// 10 m, not 15. The bar is "no CROSS-ROOM MASS", not "nothing at all on this
// line" — the printer stand legitimately stands at local x 3.2..4.0 on it and
// takes the run to 12.45. I set 15 first and it went red on a correct world;
// the piers left 5.60, so 10 separates the fault from the furniture with room
// to spare either side. Calibrated against the FAULT, not against today.
report('no partition across the room at the old pier line',
  span > 10, `widest clear run on local z 6.80 is ${span} m (the piers left 5.60 m of 20)`);

// ── 2. THE LIBRARIAN IS BEHIND HER DESK AND FACING THE DOOR ─────────────────
//
// Two halves, because the row was filed twice for two different reasons: once
// for POSITION ("put this librarian behind the desk") and once for what that
// looked like from the room. Both are asserted from the world.
// STAND WHERE THE BORROWER STANDS BEFORE READING HER FRAME. The atlas picks
// its view from `camAng - facing`, so the sector is meaningless until the
// camera is where the question is asked from. My first version read it from
// spawn and got sector 6.00 — a mirrored profile — on a librarian who is
// facing the door correctly. GOTCHAS §20: a check must verify it is where it
// thinks it is before it presses a key.
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0),
  [room.cx - 3.5, room.cz + 5.95]);          // the counter's public side
await p.waitForTimeout(700);
const lib = await p.evaluate(([cx, cz]) => {
  let out = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m?.map || m.alphaTest !== 0.5 || Math.abs(m.map.repeat.y - 0.5) > 1e-6) return;
    const q = o.getWorldPosition(o.position.clone());
    if (Math.abs(q.x - cx) > 10 || Math.abs(q.z - cz) > 11) return;
    if (q.y > 0.05) return;                                    // seated readers
    out = { x: q.x, z: q.z, off: +(m.map.offset.x * 5).toFixed(2), rep: m.map.repeat.x };
  });
  if (!out) return null;
  // IS SHE INSIDE THE DESK'S OWN COLLIDER — not merely inside SOME collider.
  //
  // "inside any collider" was my first predicate and the selftest walked
  // straight through it: shoving her 3 m north put her inside the READING
  // TABLE's box and the verdict stayed green. A predicate that any furniture
  // satisfies is not a predicate about the desk.
  //
  // So the box is pinned by the counter itself: find the collider that
  // contains the front counter's own point, and require her to be in THAT one.
  const deskPt = { x: cx - 3.5, z: cz + 5.2 };
  const desk = window.__ct.colliders().find((c) =>
    deskPt.x > c.minX && deskPt.x < c.maxX && deskPt.z > c.minZ && deskPt.z < c.maxZ);
  out.inDesk = !!desk && out.x > desk.minX && out.x < desk.maxX
    && out.z > desk.minZ && out.z < desk.maxZ;
  return out;
}, [room.cx, room.cz]);
if (!lib) {
  report('the librarian is in the room at all', false, 'no standing atlas figure found');
} else {
  // H's decode, notes/H-atlas-facing.md: sector = repeat.x < 0 ? 9 - off : off
  const sector = lib.rep < 0 ? 9 - lib.off : lib.off;
  const facingness = Math.min(sector, 8 - sector);
  report('the librarian faces whoever comes in',
    facingness < 1.5,
    `sector ${sector.toFixed(2)} from the camera's bearing (0 = looking at you, 4 = away)`);
  report('…and stands inside her own desk, not in the open',
    lib.inDesk === true,
    lib.inDesk ? 'her position is inside the issue desk\'s collider — the staff pocket'
               : 'she is NOT inside the desk collider: the pocket is gone and she is on open floor');
}

// ── 3. THE COMPUTERS ARE THERE AND ONE SCREEN IS LIT ────────────────────────
//
// *"i want computers in the library"*, and the queue: *"give at least one
// screen a lit amber or green catalogue prompt; a dark screen reads as a box."*
// So a count is not enough — the lit one is the requirement.
const term = await p.evaluate(() => {
  let screens = 0, amber = 0, seats = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const img = m?.map?.image;
    if (!img || img.width !== 20 || img.height !== 16) return;
    screens++;
    const c = document.createElement('canvas'); c.width = 20; c.height = 16;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 20, 16).data;
    const tint = m.color;                                   // the night grade rides here
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] * tint.r, gg = d[i + 1] * tint.g, bb = d[i + 2] * tint.b;
      if (r > 150 && gg > 90 && gg < r * 0.85 && bb < gg * 0.7) lit++;   // amber
    }
    if (lit >= 4) amber++;
  });
  seats = window.__ct.seats().filter((s) => /terminal/.test(s.label)).length;
  return { screens, amber, seats };
});
report('there are computers, and at least one screen carries a lit amber prompt',
  term.screens >= 3 && term.amber >= 1,
  `${term.screens} screens, ${term.amber} of them lit amber, ${term.seats} terminal seats offered`);

// ── 4. THE PERIODICALS ARE A CASE, NOT RAKED SLABS ──────────────────────────
//
// *"three enormous pale grey slabs, tilted back at about thirty degrees"* — he
// filed it as `user-library-computers.png` because he could not name the
// object. The failure mode is a COUNT of raked planes in the alcove: it was
// three and is now one. Anything that puts them back fails here.
const raked = await p.evaluate(([cx, cz, w]) => {
  let n = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    // RAKED, not horizontal. |rotX| >= 1.2 is a floor or a ceiling plane laid
    // flat, and there are dozens — my first version counted 86 of them and
    // called them slabs. A reading surface is tilted between ~7 and ~69
    // degrees; anything flatter is a wall, anything steeper is the ground.
    const rx = Math.abs(o.rotation.x);
    if (rx < 0.12 || rx > 1.2) return;
    // BOUND THE BOX ON BOTH SIDES. My first version wrote only the upper
    // bound, so every raked plane WEST of the library — i.e. the entire rest
    // of the world, other rooms included — fell through and was counted: it
    // reported 5, of which 4 were at world x ~514, hundreds of metres away.
    // GOTCHAS §22's own warning, "give it the right box", and the auditor's
    // record of thirteen faults filed against ct/lot.ts from a box holding
    // none of it.
    const q = o.getWorldPosition(o.position.clone());
    if (q.x < cx - w / 2 || q.x > cx - w / 2 + 3.0) return;    // the west alcove ONLY
    if (Math.abs(q.z - cz) > 6) return;
    n++;
  });
  return n;
}, [room.cx, room.cz, room.w]);
report('the west alcove has ONE raked reading surface, not a rank of slabs',
  raked <= 1, `${raked} raked planes in the alcove (it was 3 when he reported it)`);

report('no console errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

console.log(fails ? `\n${fails} FAILED` : '\nall good');
await b.close();
if (SELFTEST) process.exit(fails >= 3 ? 0 : 2);
process.exit(fails ? 1 : 0);

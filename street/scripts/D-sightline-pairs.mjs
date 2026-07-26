// CAN YOU SELECT THROUGH AN OBSTRUCTION? THE PAIRED-STATION TEST.
//
// The user: *"shouldnt be able to select things through objects ever"* — and
// "ever" is doing work in that sentence, so it is an invariant, not a feature.
//
// H tried to verify it and correctly refused to draw a verdict, because
// standing outside a shop and reading a null prompt proves nothing: the spots
// it was "not selecting" were detached interior scenes 190 m away, so DISTANCE
// alone excluded them, and the one real prompt from the street was the tax
// office DOOR, which is correct by design. H then wrote down exactly what would
// test it and ran out of room to build it:
//
//   "a spot and a player in the SAME room on opposite sides of one obstruction
//    — close enough that distance alone would select it, so the only thing that
//    can stop it is the occlusion test."
//
// This is that check. The unit is a PAIR OF STATIONS around one spot at the
// SAME distance, differing in one thing only:
//
//   CLEAR   station — nothing between. The spot MUST be offered.
//   BLOCKED station — one solid mesh between. The spot MUST NOT be offered.
//
// The clear half is not decoration, it is the whole reason the pair exists.
// "Not offered" on its own is satisfied by a world where nothing is ever
// offered — GOTCHAS §34, and §27: a check you have never watched fail.
//
// ── FOUR THINGS THIS GOT WRONG BEFORE IT GOT ONE TRUE ANSWER ────────────────
//
// Every one of them made the WORLD look broken when the fault was here, which
// is the expensive direction (GOTCHAS §48). In order:
//
// 1. **Winding.** A plain Möller–Trumbore hits a triangle from either side;
//    THREE.Raycaster honours `material.side`, so a FrontSide face is invisible
//    to a ray arriving from behind. Two "leaks" at the bus stop were a shelter
//    panel the game's ray correctly passes through. Sides are now resolved per
//    geometry GROUP, because a shopfront box wears a material array and its
//    faces genuinely differ.
//
// 2. **A field name.** `standable()` read `c.x0/x1/z0/z1`; the type is
//    `{ minX, maxX, minZ, maxZ }` (fp.ts:9). Every comparison was against
//    `undefined`, every one was false, so the reject NEVER FIRED and every
//    point in the world counted as standable — including points inside walls.
//    It reported a leak at x -7.6 with the west facade at -7.0: a station a
//    metre inside the bank, whose view of the ATM is blocked by the building
//    it is standing in. A wrong field name does not throw, it silently inverts
//    the filter.
//
// 3. **`ok()` read at the wrong time.** Discovery filtered on `sp.ok`, which is
//    evaluated where the PLAYER is — and at discovery the player is still at
//    spawn, so every interior spot in the world reported false and was dropped
//    before it could be tested. Those are exactly H's cases. It is H's own
//    fault ("the prompt I read is whatever is nearest to where I STOOD") in
//    different clothes.
//
// 4. **The blocker walked off.** The last two "leaks" were both a
//    `PlaneGeometry 0.95x1.9` — a CITIZEN BILLBOARD, which walks the block and
//    re-faces the player every frame. The oracle had measured the scene during
//    discovery and judged the prompt several seconds later, by which time the
//    obstruction had turned or gone. **So occlusion is now re-checked at the
//    instant the prompt is read**, from where the player actually stands, and
//    a station whose verdict changed between the two is reported as `moved`
//    rather than scored. That is the only form that is sound in a world with
//    people in it.
//
// THE ORACLE IS INDEPENDENT OF THE PICK. crosstown.ts decides visibility with a
// THREE.Raycaster; the page publishes no `three` (see E-coplanar.mjs), so this
// does its own exact segment-triangle intersection. It asks the same GEOMETRIC
// question on purpose — eye at 1.6, aim 1.1 m above the spot's own ground,
// stopping 0.35 m short so the thing itself is not its own blocker — because
// those three numbers ARE the invariant as landed, and an oracle using
// different ones would report disagreements that are only conventions. What it
// does not share is the code path, so it still catches what matters: the
// visibility filter dropped from the pick, lines or the debug volume becoming
// blockers, or the re-entry hysteresis suppressing a prompt that should be
// there.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';
const RADII = [1.2, 1.0, 1.5];   // inside r + REACH_MARGIN for every spot
const MIN_PAIRS = 6;             // discovering nothing is a FAILURE, not a pass
const CAP = 26;

const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});

// ── the oracle, installed once, evaluated FRESH on every call ────────────────
await page.evaluate(() => {
  const scene = window.__ct.scene();
  const hitTri = (o, dir, len, a, bb, c, side) => {
    const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const p = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-10) return -1;            // parallel — grazing is not blocking
    // matches THREE: FrontSide is not hit from behind, BackSide not from the front
    if (side === 0 && det < 0) return -1;
    if (side === 1 && det > 0) return -1;
    const inv = 1 / det, s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
    const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
    if (u < 0 || u > 1) return -1;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) * inv;
    if (v < 0 || u + v > 1) return -1;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
    return (t > 1e-4 && t < len) ? t : -1;
  };
  // nearest blocker between eye and aim, or t < 0 for a clear line
  window.__dSee = (eye, aim) => {
    scene.updateMatrixWorld(true);                   // NOW, not at discovery
    const dir = [aim[0] - eye[0], aim[1] - eye[1], aim[2] - eye[2]];
    const dist = Math.hypot(dir[0], dir[1], dir[2]);
    if (dist < 0.45) return { t: -1, who: '' };      // standing on it
    for (let k = 0; k < 3; k++) dir[k] /= dist;
    const far = dist - 0.35;                         // the thing itself is not a blocker
    const bl = [Math.min(eye[0], aim[0]) - 1, Math.min(eye[1], aim[1]) - 1, Math.min(eye[2], aim[2]) - 1];
    const bh = [Math.max(eye[0], aim[0]) + 1, Math.max(eye[1], aim[1]) + 1, Math.max(eye[2], aim[2]) + 1];
    let best = -1, who = '';
    scene.traverse((n) => {
      if (!n.isMesh || !n.geometry || !n.geometry.attributes || !n.geometry.attributes.position) return;
      if (n.visible === false) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      if (!mats.some((m) => m && m.visible !== false)) return;
      const e = n.matrixWorld.elements;
      if (e[12] < bl[0] - 30 || e[12] > bh[0] + 30 || e[14] < bl[2] - 30 || e[14] > bh[2] + 30) return;
      const pos = n.geometry.attributes.position, idx = n.geometry.index;
      const xf = (i) => {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        return [e[0] * x + e[4] * y + e[8] * z + e[12],
                e[1] * x + e[5] * y + e[9] * z + e[13],
                e[2] * x + e[6] * y + e[10] * z + e[14]];
      };
      const groups = (n.geometry.groups && n.geometry.groups.length) ? n.geometry.groups : null;
      const sideOf = (mi) => {
        const m = Array.isArray(n.material) ? (n.material[mi] ?? n.material[0]) : n.material;
        return m ? (m.side ?? 0) : 0;                // 0 front, 1 back, 2 double
      };
      const sideAt = (st) => {
        if (!groups) return sideOf(0);
        for (const g of groups) if (st >= g.start && st < g.start + g.count) return sideOf(g.materialIndex);
        return sideOf(0);
      };
      const count = idx ? idx.count : pos.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const a = xf(idx ? idx.getX(i) : i), c = xf(idx ? idx.getX(i + 1) : i + 1), d = xf(idx ? idx.getX(i + 2) : i + 2);
        // cheap reject: whole triangle outside the segment's box
        if (Math.max(a[0], c[0], d[0]) < bl[0] || Math.min(a[0], c[0], d[0]) > bh[0]
         || Math.max(a[1], c[1], d[1]) < bl[1] || Math.min(a[1], c[1], d[1]) > bh[1]
         || Math.max(a[2], c[2], d[2]) < bl[2] || Math.min(a[2], c[2], d[2]) > bh[2]) continue;
        const t = hitTri(eye, dir, far, a, c, d, sideAt(i));
        if (t > 0 && (best < 0 || t < best)) {
          best = t;
          const gp = n.geometry.parameters || {};
          const dims = ['width', 'height', 'depth', 'radiusTop'].filter((k) => gp[k] != null)
            .map((k) => (+gp[k]).toFixed(2)).join('x');
          who = `${n.geometry.type} ${dims} at ${e[12].toFixed(1)},${e[13].toFixed(2)},${e[14].toFixed(1)}`;
        }
      }
    });
    return { t: best, who };
  };
});

// ── discovery ───────────────────────────────────────────────────────────────
const pairs = await page.evaluate((RADII) => {
  const groundAt = window.__ct.groundAt, cols = window.__ct.colliders();
  // A STATION MUST BE SOMEWHERE THE PLAYER COULD ACTUALLY STAND.
  const standable = (x, z, gy) => {
    if (Math.abs(groundAt(x, z) - gy) > 0.30) return false;     // a different floor
    for (const c of cols) {
      if (x > c.minX - 0.36 && x < c.maxX + 0.36 && z > c.minZ - 0.36 && z < c.maxZ + 0.36) return false;
    }
    return true;
  };
  const out = [];
  // NOT filtered on ok() here — see note 3 at the top of this file.
  for (const sp of window.__ct.spots()) {
    const gy = groundAt(sp.x, sp.z);
    const aim = [sp.x, gy + 1.1, sp.z];
    const clear = [], blocked = [];
    for (const R of RADII) {
      if (clear.length && blocked.length) break;
      for (let i = 0; i < 36; i++) {
        const th = (i / 36) * Math.PI * 2;
        const x = sp.x + Math.sin(th) * R, z = sp.z + Math.cos(th) * R;
        if (!standable(x, z, gy)) continue;
        const { t } = window.__dSee([x, 1.6, z], aim);
        // margins, so a pair is never built on a grazing hit or a near miss
        if (t < 0) clear.push({ x: +x.toFixed(3), z: +z.toFixed(3), R });
        else if (t > 0.25) blocked.push({ x: +x.toFixed(3), z: +z.toFixed(3), t: +t.toFixed(2), R });
      }
    }
    if (clear.length && blocked.length) {
      out.push({ label: sp.label, x: sp.x, z: sp.z, gy: +gy.toFixed(3),
                 clear: clear.slice(0, 4), blocked: blocked.sort((a, c) => c.t - a.t).slice(0, 3) });
    }
  }
  return out;
}, RADII);

console.log(`\n  ${pairs.length} spots have a clear/blocked station pair\n`);

// warp, settle, then re-ask the oracle from where the player ACTUALLY is
const at = async (st, sp) => {
  const yaw = Math.atan2(sp.x - st.x, -(sp.z - st.z));
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [st.x, st.z, yaw, sp.gy]);
  await page.waitForTimeout(260);
  const now = await page.evaluate(([sx, sz, gy]) => {
    const p = window.__ct.pos();
    return window.__dSee([p[0], 1.6, p[2]], [sx, gy + 1.1, sz]);
  }, [sp.x, sp.z, sp.gy]);
  return { see: await prompt(), t: now.t, who: now.who };
};

let pass = 0, fail = 0, invalid = 0, skipped = 0, moved = 0;
for (const sp of pairs.slice(0, CAP)) {
  const want = `[E] ${sp.label}`;
  // the control: a station with a genuinely clear line that offers this spot.
  // The pick returns whatever is nearest SCREEN CENTRE among everything in
  // range, so a clear station can honestly offer a DIFFERENT live spot; that
  // is not a sightline failure, it just means this station cannot be the
  // control. Walk the ring until one can.
  let ctl = null;
  for (const st of sp.clear) {
    const r = await at(st, sp);
    if (r.t >= 0) continue;                       // no longer clear — something moved in
    if (r.see === want) { ctl = r; break; }
    ctl = ctl || r;
  }
  const live = await page.evaluate((l) => (window.__ct.spots().find((s) => s.label === l) || {}).ok === true, sp.label);
  if (!live) { skipped++; console.log(`  skip     ${sp.label}  —  ok() false where we stand; not a sightline question`); continue; }
  if (!ctl || ctl.see !== want) {
    invalid++;
    console.log(`  INVALID  ${sp.label}`);
    console.log(`           no clear station offered it — best "${ctl ? ctl.see || '(nothing)' : '(none clear)'}", tried ${sp.clear.length}`);
    continue;
  }
  let judged = false;
  for (const st of sp.blocked) {
    const r = await at(st, sp);
    if (r.t < 0) continue;                        // the blocker moved away — not evidence
    judged = true;
    if (r.see === want) {
      fail++;
      console.log(`  LEAK     ${sp.label}`);
      console.log(`           offered through a blocker ${r.t.toFixed(2)} m away, from (${st.x}, ${st.z})`);
      console.log(`           the blocker is: ${r.who}`);
    } else {
      pass++;
      console.log(`  PASS     ${sp.label}  —  clear offers it, blocked (${r.t.toFixed(2)} m) does not`);
    }
    break;
  }
  if (!judged) { moved++; console.log(`  moved    ${sp.label}  —  every blocker had moved by the time we looked`); }
}
await b.close();

const tested = pass + fail + invalid;
console.log(`\n  ${pass} pairs hold, ${fail} leak, ${invalid} invalid, ${skipped} not-live, ${moved} moved — ${tested} scored`);
if (tested < MIN_PAIRS) {
  console.log(`\n  FAIL: only ${tested} pairs scored, wanted ${MIN_PAIRS}. A run that finds`);
  console.log('  nothing to test must not report success (GOTCHAS §34).');
  process.exit(1);
}
if (fail || invalid) {
  console.log('\n  FAIL: an [E] target must be VISIBLE from where the player stands.');
  process.exit(1);
}
console.log('\n  no [E] target can be selected through an obstruction');

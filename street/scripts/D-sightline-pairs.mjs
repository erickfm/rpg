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
import { installSee } from './lib/D-see.mjs';

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

// the occlusion oracle, shared with D-look-selects.mjs so the two cannot drift
await installSee(page);

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
  // ONLY SPOTS WITH A UNIQUE LABEL, and this is fault 5.
  //
  // The HUD gives a label and nothing else, so the label is the only handle a
  // prompt read has on WHICH spot won. "sit at the slot" is not unique — the
  // casino has a row of them — so at a station where the tested seat is
  // correctly refused for being behind a citizen, the NEXT slot along, plainly
  // visible, wins and prints the identical string. I scored that as the tested
  // spot leaking. It is H's own fault a third time ("the prompt I read is
  // whatever is nearest to where I STOOD, not the spot I meant to test"),
  // reached by a different road: not proximity this time, but a name that two
  // objects share.
  //
  // Verified rather than assumed: the blocker in both reports was a
  // `PlaneGeometry 0.95x1.90` citizen with `side=2` (DoubleSide), which THREE
  // does hit — so `canSee` was right to refuse it and the world was never
  // wrong.
  // A globally-unique label is too strong a demand — it left 2 candidates and
  // scored none. What actually has to hold is that no spot SHARING THIS LABEL
  // is close enough to win the prompt instead, and `pickSpot` is called with a
  // reach of 6, so 8 m is a comfortable margin on the only thing that matters.
  // Excluding every spot with a twin was too blunt — it left 2 candidates and
  // scored none. Twins are allowed back in; the ambiguity is resolved LATER,
  // at the moment of judging, by asking whether a twin could actually have
  // produced the prompt from that station (see `twinCouldWin` below). A spot
  // is only unusable when a same-labelled one is both in reach and visible.
  const ALL = window.__ct.spots();
  // NOT filtered on ok() here — see note 3 at the top of this file.
  for (const sp of ALL) {
    const gy = groundAt(sp.x, sp.z);
    const aim = [sp.x, gy + 1.1, sp.z];
    const clear = [], blocked = [];
    for (const R of RADII) {
      if (clear.length && blocked.length) break;
      for (let i = 0; i < 36; i++) {
        const th = (i / 36) * Math.PI * 2;
        const x = sp.x + Math.sin(th) * R, z = sp.z + Math.cos(th) * R;
        if (!standable(x, z, gy)) continue;
        const { t } = window.__dSee([x, gy + 1.6, z], aim);
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
  // READ THE PLAYER'S LIVE STOREY, not the one discovery recorded.
  //
  // `groundAt` is itself storey-dependent (GOTCHAS §7 — the floor picker has
  // hysteresis and answers for the storey you are ON), so a gy captured during
  // discovery, while the player stood somewhere else entirely, is not the gy
  // the game will use here. `pos()[3]` IS `apt.gy()`, which is exactly what
  // crosstown.ts's eye now reads, so this asks the same question from the same
  // height instead of from a remembered one.
  const now = await page.evaluate(([sx, sz]) => {
    const p = window.__ct.pos();
    return window.__dSee([p[0], p[3] + 1.6, p[2]], [sx, window.__ct.groundAt(sx, sz) + 1.1, sz]);
  }, [sp.x, sp.z]);
  // ok() IS READ HERE, AT THIS STATION, not after the loop.
  //
  // It used to be read once the control loop had finished, which means it was
  // read wherever the loop happened to STOP — and `ok()` is evaluated where the
  // player is. When the aim cone and the touch margin tightened, more clear
  // stations failed to offer, so the loop ran to its last candidate and the
  // ok() check was answered from a position that had never been the control.
  // Scored spots fell 6 -> 3 and the extras landed in "not-live", which reads
  // as the world having gone quiet when it was the probe changing the subject.
  const live = await page.evaluate((l) => (window.__ct.spots().find((s) => s.label === l) || {}).ok === true, sp.label);
  return { see: await prompt(), t: now.t, who: now.who, live };
};

let pass = 0, fail = 0, invalid = 0, skipped = 0, moved = 0, ambiguous = 0;
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
  if (!ctl || !ctl.live) { skipped++; console.log(`  skip     ${sp.label}  —  ok() false at the control station; not a sightline question`); continue; }
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
      // COULD A TWIN HAVE SAID THAT? The HUD gives a label and nothing else, so
      // before calling this a leak, rule out a same-labelled spot that is in
      // reach AND visible from here — it would print the identical string while
      // being correctly selected.
      const twin = await page.evaluate(([lbl, sx, sz]) => {
        const p = window.__ct.pos();
        for (const o of window.__ct.spots()) {
          if (o.label !== lbl || (o.x === sx && o.z === sz)) continue;
          if (Math.hypot(o.x - p[0], o.z - p[2]) > 6) continue;
          if (window.__dSee([p[0], p[3] + 1.6, p[2]], [o.x, window.__ct.groundAt(o.x, o.z) + 1.1, o.z]).t < 0) {
            return { x: o.x, z: o.z };
          }
        }
        return null;
      }, [sp.label, sp.x, sp.z]);
      if (twin) {
        ambiguous++;
        console.log(`  ambig    ${sp.label}  —  a twin at (${twin.x.toFixed(1)}, ${twin.z.toFixed(1)}) is in reach and visible; the label cannot tell them apart`);
        break;
      }
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
console.log(`\n  ${pass} pairs hold, ${fail} leak, ${invalid} invalid, ${skipped} not-live, ${moved} moved, ${ambiguous} ambiguous — ${tested} scored`);
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

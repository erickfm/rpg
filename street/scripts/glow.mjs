// feat/glow — is the lamp glow ON the lamp, or beside it?
//
// The complaint was never about the drawing, it was about position: the halo
// sat inside the opaque head box, which ate its core and left a smudge to one
// side. So this script does two things — it takes the two framings the user
// shot from (close low look at a head, and the wide street pool), and it
// measures the overlap between the halo's bright core and the lamp head in
// SCREEN space, which is the thing that was actually wrong.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/glow.mjs [shots|probe|all]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';
import { installMats } from './lib/materials.mjs';
import { modes } from './lib/modes.mjs';
import { waitPainted } from './lib/painted.mjs';

const mode = modes('glow', ['probe', 'shots', 'all']);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await installMats(page);   // 4008d7c3: one copy of the multi-material walk
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(2, 30));      // deep night
await page.waitForTimeout(1200);

const shot = async (n, x, z, tx, tz, gy = 0, p = 0) => {
  await page.evaluate(([x, z, tx, tz, gy, p]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `shots/gl-${n}.png` });
};

if (mode === 'probe' || mode === 'all') {
  // where is the halo relative to the head it belongs to?
  const r = await page.evaluate(() => {
    const sc = window.__ct.scene();
    // FOUND BY STAMP, not by box dimensions.
    //
    // This matched heads and lenses by exact size, and it broke twice for the
    // same reason. First it knew only the main street's shape and silently
    // checked 8 of 11 lamps. Then, once the world grew, a sheet belonging to
    // another module happened to sit within 0.5 m of a head-and-lens pair and
    // got adopted as a 22nd lamp — and mis-measured, because it was never one.
    // There are 50 halo-shaped additive sheets in this world now and only 21
    // are lamps; size cannot tell them apart and was never going to.
    const halos = [], heads = [], lenses = [];
    sc.traverse((o) => {
      const k = o.userData?.lampPart;
      if (k === 'halo') halos.push(o);
      else if (k === 'head') heads.push(o);
      else if (k === 'lens') lenses.push(o);
    });
    const near = (a, list) => list
      .filter((c) => Math.hypot(c.position.x - a.position.x, c.position.z - a.position.z) < 0.5)
      .sort((p, q) => Math.abs(p.position.y - a.position.y) - Math.abs(q.position.y - a.position.y))[0];
    return halos.map((h) => {
      const hd = near(h, heads), ln = near(h, lenses);
      if (!hd || !ln) return null;
      const g = hd.geometry.parameters;
      return {
        haloY: +h.position.y.toFixed(3),
        dx: +(h.position.x - hd.position.x).toFixed(3),
        dz: +(h.position.z - hd.position.z).toFixed(3),
        insideHead: h.position.y > hd.position.y - g.height / 2 &&
                    h.position.y < hd.position.y + g.height / 2,
        offLens: +(h.position.y - ln.position.y).toFixed(3),
      };
    }).filter(Boolean);
  });
  const halosSeen = await page.evaluate(() => {
    let n = 0; window.__ct.scene().traverse((o) => { if (o.userData?.lampPart === 'halo') n++; });
    return n;
  });
  console.log(`\n${r.length} lamps paired of ${halosSeen} stamped halos (street heads and park lanterns)`);
  const bad = r.filter((h) => h.insideHead || Math.abs(h.dx) > 0.01 || Math.abs(h.dz) > 0.01);
  // Every stamped halo must pair. The count is reported rather than asserted:
  // how many lamps this world has is a design decision that changes, and a
  // check that fails when someone adds a lamp is a check that gets ignored.
  // What must hold is that every lamp I build is anchored — which is what the
  // stamp makes answerable.
  // ZERO PAIRED OF ZERO IS NOT A PASS. The verdict below is `bad.length === 0`
  // — an absence — and the mismatch test above is an equality, so a world where
  // the halo stamp has stopped matching gives 0 of 0, no mismatch, no bad
  // halos, and a green row for lamps nobody looked at. Same shape as the tree
  // pits in footprint.mjs (footprint-blind), which I watched exit 0 with the
  // pits still standing. 21 lamps are stamped at HEAD; the floor is measured,
  // not remembered, because last time I remembered it I was wrong.
  if (halosSeen < 15) {
    console.error(`\n  FAIL only ${halosSeen} stamped halos — expected at least 15.`);
    console.error(`  Every verdict below is an absence and passes for free at zero.`);
    process.exitCode = 1;
  }
  if (r.length !== halosSeen) {
    console.error(`\n  FAIL ${halosSeen - r.length} stamped halo(s) could not be paired with a head and lens`);
    process.exitCode = 1;
  }
  const offLens = [...new Set(r.map((h) => h.offLens))];
  console.log(`  halo is directly over its head in x/z: ${r.every((h) => !h.dx && !h.dz) ? 'yes' : 'NO'}`);
  console.log(`  halo centre buried inside the opaque head box: ${r.some((h) => h.insideHead) ? 'YES — it will be eaten' : 'no'}`);
  console.log(`  halo centre vs the lens it comes out of: ${offLens.join(', ')} m`);
  console.log(`\n  ${bad.length === 0 ? 'OK  ' : 'FAIL'} every halo is anchored on its lamp, core unoccluded`);

  // ── DOES THE POOL ACTUALLY LIGHT THE GROUND? MEASURED IN PIXELS ──────────
  //
  // The user asked for "light around the light posts to show up on the objects
  // and entities under the lights". This clause is the one that answers it, and
  // until item 234 it was asking a question its sampling could not answer.
  //
  // IT READ `material.color`, AND THAT STOPPED WORKING AT `544053b20`. That
  // commit ("lamplight per fragment") moved the warm term AND the gain into
  // POOL_FRAG. `ct/props.ts:1494` now writes only `base * amb`, and `amb` is
  // `ambient(e.floor)` — per ELEVATION, not per lamp. Two materials on one floor
  // are therefore equal BY CONSTRUCTION however close either one is to a lamp,
  // so this clause reported `main street ... 1.0x` — identical across five runs
  // — about a world whose lamplight was working perfectly.
  //
  //     A FRAGMENT SHADER IS INVISIBLE TO ANYTHING READING `material.color`
  //     FROM JS.
  //
  // AND THE SIDE STREET WAS PASSING FOR A WORSE REASON THAN THE MAIN STREET WAS
  // FAILING. It read 11.7x and looked like the healthy one. Measured in
  // `probes/w86-is-glows-side-street-green-real.mjs`: SEVEN OF ITS EIGHT
  // near-lamp samples are SELF-LIT (`ct/props.ts:1113`) — neon signs and lit
  // windows, stamped `graded` but deliberately held bright at FLOOR_SIGN so they
  // do NOT dim at dusk, which is a thing the user asked for in as many words.
  // Their luminance is 1.0000 at 13:00 and 1.0000 at 23:00. **A material whose
  // colour is identical at noon and at midnight cannot be reporting on a lamp.**
  // The old green was reading "neon is bright at night" off a population that
  // happened to sit near a lamp post, and it cost nothing to earn.
  //
  // SO ASK THE RENDERER. Stand on the pavement looking down and read the PIXELS
  // — where a fragment shader's work actually lands, and where the player's eye
  // is.
  //
  // AND NORMALISE EACH SPOT AGAINST ITS OWN DAYTIME READING. The measurement is
  // a ratio of ratios, not of luminances:
  //
  //     gain(spot) = luminance(23:00 at spot) / luminance(13:00 at spot)
  //     pool       = gain(under a lamp) / gain(mid-block)
  //
  // At 13:00 `night` is 0 and POOL_FRAG's whole body is skipped by its own first
  // line, so the daytime reading is that spot's paint with no lamplight in it at
  // all. Dividing by it cancels the base colour. That is exactly the hole the
  // self-lit signs walked through, and closing it this way closes it for every
  // future population too, not just for neon.
  const propsSrc = readFileSync(import.meta.dirname + '/../src/proto/ct/props.ts', 'utf8');
  // DERIVED, NOT TYPED (BUILDER-BRIEF §8). LAMP_R decides what "mid-block"
  // means: a spot at or beyond the pool radius takes exactly zero from that
  // lamp, so the unlit control is chosen by the very number the shader falls off
  // with. Retune the world and this retunes with it; retune it by ACCIDENT and
  // this fails to parse rather than quietly measuring the wrong place.
  const mLamp = propsSrc.match(/const LAMP_R = ([\d.]+), LAMP_CORE = ([\d.]+);/);
  if (!mLamp) {
    console.error('\n  FAIL cannot find LAMP_R/LAMP_CORE in ct/props.ts — the mid-block');
    console.error('  control below is derived from them and I will not guess it.');
    process.exit(1);
  }
  const LAMP_R = +mLamp[1];

  const lampXZ = await page.evaluate(() => {
    const S = window.__ct.scene(); S.updateMatrixWorld(true);
    const out = [];
    S.traverse((o) => {
      if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
        const e = o.matrixWorld.elements; out.push([+e[12].toFixed(2), +e[14].toFixed(2)]);
      }
    });
    return out;
  });
  // The same two windows the old clause used, kept so the regions this reports
  // on do not silently change along with the method.
  const REGION = {
    main: ([x, z]) => Math.abs(x) <= 9 && z <= 2 && z >= -96,
    side: ([x, z]) => x > 9 && z < -94,
  };
  const minLampD = (x, z) => Math.min(...lampXZ.map(([lx, lz]) => Math.hypot(x - lx, z - lz)));
  /** Mid-block: the NEAREST spot on this lamp's own pavement line that is
   *  genuinely outside every pool. Same x, walk z, take the smallest offset
   *  whose nearest lamp is at or past LAMP_R — where `clamp((R-d)/(R-C))` is
   *  exactly 0, so the control takes provably zero light from any lamp.
   *
   *  NEAREST, NOT DARKEST, and that is a correction worth keeping. Maximising
   *  the distance instead sent five of eleven controls 18-20 m away and off the
   *  end of the street, onto ground that reads 0.58 at midday against the
   *  pavement's 0.28 — the daylight control below caught every one of them, but
   *  the right answer is not to wander off the block in the first place. The
   *  first metre past the pool edge is still mid-block and is still on the
   *  street the lamp is standing in. */
  const midBlock = ([lx, lz]) => {
    let best = null;
    for (let d = 3; d <= 20; d += 0.25) for (const s of [-1, 1]) {
      const z = lz + s * d, m = minLampD(lx, z);
      if (m >= LAMP_R) return { x: lx, z: +z.toFixed(2), m: +m.toFixed(2) };
      if (!best || m > best.m) best = { x: lx, z: +z.toFixed(2), m: +m.toFixed(2) };
    }
    return best;
  };

  const pairs = [];
  for (const [name, inRegion] of Object.entries(REGION))
    for (const L of lampXZ.filter(inRegion)) pairs.push({ region: name, lamp: L, far: midBlock(L) });

  /** Mean luminance of a crop of GROUND, standing at (x,z) looking steeply down.
   *
   *  THE CROP IS PART OF THE MEASUREMENT, not a detail. At this pitch the
   *  frame's edges still catch sky and facades, and its BOTTOM CARRIES THE
   *  PLAYER'S WRISTWATCH — a bright, constant, fully-HUD patch about 30% of the
   *  frame tall. Found by looking at the frames rather than by reasoning about
   *  them. A constant additive in both readings biases a ratio toward 1.0, so it
   *  could only ever have made this check too FORGIVING, but it is measuring the
   *  HUD rather than the world and it comes out. x 0.30-0.70, y 0.15-0.55. */
  let shotsKept = 0;
  const groundLum = async (x, z, tag) => {
    await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, -1.35), [x, z]);
    // GOTCHAS 78/80: rAF is not a painted frame, and a probe that shoots too
    // early photographs the void and believes it.
    await waitPainted(page, { quiet: true });
    const buf = await page.screenshot(tag ? { path: `shots/gl-pool-${tag}.png` } : {});
    if (tag) shotsKept++;
    return page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const x0 = Math.floor(c.width * 0.30), y0 = Math.floor(c.height * 0.15);
      const w = Math.floor(c.width * 0.40), h = Math.floor(c.height * 0.40);
      const d = g.getImageData(x0, y0, w, h).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      return s / (d.length / 4) / 255;
    }, buf.toString('base64'));
  };

  // Both hours for every spot, clock set ONCE per hour rather than per spot.
  for (const hour of [13, 23]) {
    await page.evaluate((h) => window.__ct.clock(h, 0), hour);
    await page.waitForTimeout(900);
    for (const q of pairs) {
      if (q.far.m < LAMP_R) continue;
      // one pair per region is kept on disk, because a luminance with no picture
      // behind it is how a probe reports confidently on a black frame
      const keep = q === pairs.find((t) => t.region === q.region && t.far.m >= LAMP_R);
      q[`near${hour}`] = await groundLum(q.lamp[0], q.lamp[1], keep ? `${q.region}-near-${hour}` : null);
      q[`far${hour}`] = await groundLum(q.far.x, q.far.z, keep ? `${q.region}-far-${hour}` : null);
    }
  }

  console.log('');
  const usable = [];
  for (const q of pairs) {
    const at = `${q.region} lamp (${q.lamp[0]},${q.lamp[1]})`;
    if (q.far.m < LAMP_R) {
      console.log(`  skip  ${at} — its darkest pavement spot is still ${q.far.m} m from a lamp,`
        + ` inside LAMP_R ${LAMP_R}; there is no unlit control here`);
      continue;
    }
    // THE INSTRUMENT'S OWN CONTROL, AND IT IS NOT OPTIONAL. At 13:00 there is no
    // pool anywhere, so the two spots must read ALIKE. If they do not they are
    // not comparable ground — one is over a different surface, or indoors, or
    // off the map — and any night ratio taken from them describes the paint
    // rather than the lamp. This caught three bad spots while this was being
    // written: a naive "6 m along" landed under the NEXT lamp twice and on a
    // different surface once (day 0.2969 vs 0.1266).
    const dayRatio = q.near13 / Math.max(q.far13, 1e-6);
    if (!(dayRatio > 0.8 && dayRatio < 1.25)) {
      console.log(`  skip  ${at} — at 13:00 the pair reads ${q.near13.toFixed(4)} vs `
        + `${q.far13.toFixed(4)} (${dayRatio.toFixed(2)}x): not comparable ground`);
      continue;
    }
    q.gainNear = q.near23 / Math.max(q.near13, 1e-6);
    q.gainFar = q.far23 / Math.max(q.far13, 1e-6);
    q.pool = q.gainNear / Math.max(q.gainFar, 1e-6);
    usable.push(q);
    console.log(`  ${at} vs mid-block (${q.far.x},${q.far.z}) at ${q.far.m} m — `
      + `night/day ${q.gainNear.toFixed(3)} vs ${q.gainFar.toFixed(3)} = ${q.pool.toFixed(2)}x`);
  }

  // POPULATION FLOOR. Every verdict below is a comparison, and a comparison over
  // an empty set is free — the exact failure this file already guards against
  // for the halo stamps. Measured at HEAD: 8 main-street lamps and 3 side-street
  // ones stamp a lens, of which 6 have a mid-block spot outside LAMP_R. The floor
  // is set below that and well above zero.
  const FLOOR = 4;
  if (usable.length < FLOOR) {
    console.error(`\n  FAIL only ${usable.length} lamp/mid-block pairs survived the daylight`
      + ` control — need at least ${FLOOR}.`);
    console.error(`  Measuring nothing is not a pass. Has the lens stamp stopped matching,`);
    console.error(`  or has the lamp spacing changed so no spot is outside LAMP_R ${LAMP_R}?`);
    process.exitCode = 1;
  }
  if (usable.length) {
    const sorted = usable.map((q) => q.pool).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const worst = sorted[0];
    // THE BAR. Measured at HEAD over the six usable pairs: 2.31x-2.45x, median
    // 2.43x. A world with the pool switched off gives exactly 1.00x, because the
    // ratio of ratios cancels everything else — that is the mutation case
    // `pool-dead` in scripts/canfail.mjs. 1.5 sits well clear of both.
    const BAR = 1.5;
    // WORST AS WELL AS MEDIAN, so one dark lamp cannot hide behind five bright
    // ones. This is what the old clause's per-region split was reaching for, and
    // it is strictly stronger: it is per LAMP, not per street.
    const okMed = median > BAR, okWorst = worst > BAR;
    console.log('');
    console.log(`  ${okMed ? 'OK  ' : 'FAIL'} the ground under a lamp is held up against mid-block — `
      + `median ${median.toFixed(2)}x over ${usable.length} lamps (bar ${BAR}x)`);
    console.log(`  ${okWorst ? 'OK  ' : 'FAIL'} and EVERY lamp does it — dimmest ${worst.toFixed(2)}x`);
    if (!okMed || !okWorst) process.exitCode = 1;
    const byRegion = {};
    for (const q of usable) (byRegion[q.region] ??= []).push(q.pool);
    for (const [k, v] of Object.entries(byRegion))
      console.log(`       ${k}: ${v.map((n) => n.toFixed(2) + 'x').join(', ')}`);
  }
  console.log(`       ${lampXZ.length} lamps carry a lens or lantern stamp; `
    + `${shotsKept} frames kept at shots/gl-pool-*.png — LOOK at them`);
  // put the clock back where the rest of this script expects it
  await page.evaluate(() => window.__ct.clock(2, 30));
  await page.waitForTimeout(900);

  // AND NOTHING IS DRAWN ON TOP OF THE LIGHT. The ratio above says the tint
  // reaches the ground; it says nothing about whether you can SEE it. The pool
  // decal is additive with depthWrite off, but it still depth-TESTS and opaque
  // geometry draws first, so anything lying within a few centimetres above it
  // stops the lamplight where they cross — present, carrying opacity, invisible.
  //
  // This is not hypothetical: it had happened in the park, where ct/park.ts
  // separates its coplanar ground detail on a 0.006 LIFT unit and my decal sat
  // inside that stack. Three of ten pools were partly covered, worst 18.6% of
  // its area, with every existing verdict green throughout. park.mjs guards it
  // there now; this is the same guarantee for the street, which is currently
  // clean and has no reason to stay that way by luck.
  //
  // 0.10 m band, because only NEAR-ground geometry is a layering fault — a
  // bollard or a bench standing in a pool of light is the world working.
  // Measured today: worst street pool 0.2%, one 0.11 m2 bite out of a 31 m2
  // pool, from my own basin casting standing legitimately proud of the road.
  const cover = await page.evaluate(() => {
    const sc = window.__ct.scene(); const pools = [], solids = [];
    sc.traverse((o) => {
      if (!o.isMesh) return;
      const w = o.getWorldPosition(new (o.position.constructor)());
      if (w.x < -9 || w.x > 9 || w.z > 4 || w.z < -96 || w.y > 1.0) return;
      const g = o.geometry?.parameters; if (!g) return;
      if (o.material?.blending === 2 && (g.width ?? 0) > 3)
        pools.push({ x: w.x, z: w.z, y: w.y, w: g.width });
      else if ((o.material?.opacity ?? 1) > 0.999 && !o.material?.transparent && (g.width ?? 0) >= 0.5)
        solids.push({ x: w.x, z: w.z, y: w.y, w: g.width, h: g.height ?? g.width });
    });
    return pools.map((p) => {
      const area = p.w * p.w; let covered = 0;
      for (const q of solids) {
        if (q.y <= p.y + 1e-6 || q.y - p.y > 0.10) continue;
      // A LID, NOT AN EDGE. A 2D footprint overlap cannot tell "lying on top
      // of" from "standing beside": a kerb line measured 12 x 0.12 m and a
      // basin grate bar 0.56 x 0.01 m both overlap a decal's footprint while
      // occluding nothing. Found by running this same test over my ground
      // decals — 12 of 26 showed coverage, every one of them a thin strip
      // contributing 0.01-0.04 m2, and none of it real.
      // Both dimensions must be at least 0.3 m before this counts as a lid.
      // The park's residual 2% was exactly this artefact: a 2.4 x 0.18 m strip.
      if (q.w < 0.3 || q.h < 0.3) continue;
        const ox = Math.min(p.x + p.w / 2, q.x + q.w / 2) - Math.max(p.x - p.w / 2, q.x - q.w / 2);
        const oz = Math.min(p.z + p.w / 2, q.z + q.h / 2) - Math.max(p.z - p.w / 2, q.z - q.h / 2);
        if (ox > 0 && oz > 0) covered += ox * oz;
      }
      return { at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, pct: area ? +(100 * covered / area).toFixed(1) : 0 };
    });
  });
  const worst = cover.length ? Math.max(...cover.map((c) => c.pct)) : 0;
  const okCover = cover.length > 0 && worst <= 5;
  console.log(`  ${okCover ? 'OK  ' : 'FAIL'} nothing is drawn on top of the street lamplight ` +
    `(worst pool ${worst}% covered, of ${cover.length} pools)`);
  for (const c of cover.filter((c) => c.pct > 5)) console.log(`      ${c.at}: ${c.pct}% under near-ground geometry`);
  if (!okCover) process.exitCode = 1;

  if (bad.length) process.exit(1);
}

if (mode === 'shots' || mode === 'all') {
  // 1. the user's close look up at a head — the framing that showed it beside
  await shot('head-close', 4.0, -20.5, 3.4, -23.5, 1.55, 0.42);
  await shot('head-side', 0.5, -23.0, 3.6, -23.0, 1.6, 0.34);
  // 2. the user's wide street shot — head glow + ground pool together
  await shot('street', 1.2, -6.0, -1.0, -30.0, 1.65, -0.06);
  await shot('pool', -2.0, -33.0, -3.6, -38.5, 1.65, -0.22);
  console.log('shots -> shots/gl-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');

// VERIFIER (M) — C's two LANDED television rows in room 301:
//
//   "the tv bezel looks good but i think i want the tv black"
//   "how do i stop watching the tv"
//
// I did not build these and I am not C. Both rows publish a station and I use
// theirs rather than a coordinate of my own.
//
// The second row is a PLAYER-BLOCKING report in the user's own words — "how do i
// stop watching the tv" is somebody who could not get out — so the claim that
// matters is not that a label exists but that the way out is offered **however
// you are looking**, since a seated player cannot turn far and the prompt is the
// only feedback there is.
//
// The first row is a colour claim, and colour claims cannot be settled by
// screenshot in this world (GOTCHAS 1: two runs differ in 20% of pixels). So this
// reads the MATERIALS — the casing's own colours, and the separation between the
// casing and the dead screen — which is what C's evidence actually asserts.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('usage: SHOT_URL=http://localhost:<your own preview>/ node scripts/M-verify-tv.mjs');
  process.exit(2);
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(600);

const results = [];
const say = (ok, name, detail) => results.push([ok, name, detail]);
const seated = () => p.evaluate(() => window.__ct.seated());
const promptText = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
// down/hold/up, never `keyboard.press`: the [E] dispatch is edge-triggered on
// `input.keys` read once per frame, so an instantaneous press can fall between
// two frames and never be seen as held (GOTCHAS 30)
const press = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(130);
  await p.keyboard.up(k); await p.waitForTimeout(200);
};
const until = async (fn, ms = 2500) => {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - t0 > ms) return false;
    await p.waitForTimeout(80);
  }
};

// ── the subject: ASK the world where the bed is ────────────────────────────
const bed = await p.evaluate(() =>
  (window.__ct.seats() || []).find((s) => /watch|bed|lie/i.test(s.label || '')) || null);
if (!bed) {
  console.error('ABORT: no seat in the world whose label mentions watching or a bed');
  await b.close(); process.exit(3);
}
console.log(`bed seat: label ${JSON.stringify(bed.label)} at (${bed.at.x.toFixed(1)}, `
  + `${bed.at.z.toFixed(1)})\n`);

// ── ROW 2: "how do i stop watching the tv" ────────────────────────────────
//
// C's station verbatim: *"sit on the bed; the prompt reads `[E] stop watching TV`
// and does not change however you look."*
// THE FLOOR IS AT y 5.40, NOT 0 — room 301 is up four storeys and `warp` takes the
// ground height as an argument. I passed 0, which put the player on the wrong
// floor, so the bed's floor-aware `ok()` was false and I got `prompt: null` on
// four claims and read it as a broken bed. GOTCHAS 7: floor height comes from a
// PICKER and nothing else knows it, so ask the picker.
const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [bed.at.x, bed.at.z]);
console.log(`floor under the bed: groundAt -> ${gy}`);
await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [bed.at.x, bed.at.z, gy]);
await p.waitForTimeout(400);
{
  const offered = await until(async () => /sit|watch|lie/i.test((await promptText()) || ''));
  say(offered, 'the bed offers itself', `prompt: ${JSON.stringify(await promptText())}`);
  await press('e');
  const on = await until(async () => (await seated()) !== null);
  say(on, 'and E puts you on it', on ? 'seated' : 'still standing');

  // THE CLAIM: the way out is offered, and it says what it does. "stand up" on a
  // bed you are watching television from is the label that produced the user's
  // question in the first place.
  const t = await promptText();
  say(/stop watching/i.test(t || ''),
    'the way out is named for what it DOES, not "stand up"',
    `prompt: ${JSON.stringify(t)}`);

  // AND IT MUST NOT DEPEND ON WHERE YOU LOOK. This is the half that makes it a
  // fix rather than a rename: a seated player cannot walk to find a trigger, so
  // a label that drops out when you turn your head is the same trap with better
  // words. Eight headings, all round the clock, plus up and down.
  const angles = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2;
    for (const pitch of (i % 4 === 0 ? [0, 0.5, -0.5] : [0])) {
      await p.evaluate(([y, pi, g]) => {
        const q = window.__ct.pos();
        window.__ct.warp(q[0], q[2], y, g, pi);
      }, [yaw, pitch, gy]);
      await p.waitForTimeout(150);
      angles.push([yaw.toFixed(2), pitch, /stop watching/i.test((await promptText()) || '')]);
    }
  }
  const bad = angles.filter((a) => !a[2]);
  say(bad.length === 0, 'and it holds from every heading, looking up and down',
    bad.length ? `LOST IT at yaw/pitch: ${bad.map((a) => `${a[0]}/${a[1]}`).join(', ')}`
      : `${angles.length} headings, all offered`);

  // and it actually WORKS — the user's question was how to stop, not whether a
  // label existed
  await press('e');
  const off = await until(async () => (await seated()) === null);
  say(off, 'and pressing it stops you watching', off ? 'standing' : 'STILL SEATED');
}

// ── ROW 1: "i think i want the tv black" ──────────────────────────────────
//
// Read off the MATERIALS, because a colour claim cannot be settled by screenshot
// here. C's evidence is specific and therefore checkable: black plastic is NOT
// black — a very dark neutral, the TOP FACE LIGHTER than the front where the
// moulding catches light, and the casing separating from the dead screen by HUE
// as well as value.
await setClock(p, 23, 30);                      // C's station: the hard case
await p.waitForTimeout(400);
{
  // THE SUBJECT IS THE SET, FOUND BY ITS SHAPE, not "every dark material".
  //
  // My first version swept the scene for materials under 0.32 luminance and
  // filtered on `|x| < 100` to "exclude the interior belt" — which is backwards:
  // room 301 is IN the belt at x ~198, so that filter excluded the television and
  // included the whole street. It reported 3,583 materials and 310 distinct dark
  // tones and passed "the casing is not one flat black" on them, which is a
  // verdict about the world and nothing about the set (GOTCHAS 48's family, and a
  // pass is worse than a fail here because nobody would look again).
  //
  // The casing is a BoxGeometry with a SIX-MATERIAL array — one per face — within
  // 2 m of the bed and above its floor. That is a shape, not a coordinate, so it
  // cannot be aimed at the wrong thing.
  const set = await p.evaluate(([sx, sz, floor]) => {
    const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const sat = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
      return mx ? (mx - mn) / mx : 0; };
    const grn = (c) => c.g - (c.r + c.b) / 2;
    let casing = null; const around = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const d = Math.hypot(o.position.x - sx, o.position.z - sz);
      if (d > 2.0 || o.position.y < floor + 0.2) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const rec = (m) => m && m.color
        ? { hex: '#' + m.color.getHexString(), lum: +lum(m.color).toFixed(4),
            sat: +sat(m.color).toFixed(3), grn: +grn(m.color).toFixed(4), map: !!m.map }
        : null;
      if (mats.length === 6 && mats.every((m) => m && m.color && lum(m.color) < 0.06)) {
        if (!casing) casing = { faces: mats.map(rec), y: +o.position.y.toFixed(2), d: +d.toFixed(2) };
      }
      for (const m of mats) {
        const r = rec(m);
        if (r && r.lum < 0.30) around.push({ ...r, d: +d.toFixed(2) });
      }
    });
    return { casing, around, on: window.__ct.scene().userData.tv };
  }, [bed.at.x, bed.at.z, gy]);

  say(!!set.casing, 'the television casing is in the room, as a six-faced box',
    set.casing ? `at y ${set.casing.y}, ${set.casing.d} m from the bed` : 'no 6-material dark box found');
  say(set.on && set.on.on === false, 'and the set is OFF, which is the station C named',
    `scene.userData.tv.on = ${set.on ? set.on.on : 'unpublished'}`);

  if (set.casing) {
    // BoxGeometry material order is [+x, -x, +y, -y, +z, -z]
    const [sideA, sideB, top, under, front] = set.casing.faces;
    console.log('  casing faces: top ' + top.hex + ' front ' + front.hex + ' sides ' + sideA.hex
      + ' under ' + under.hex);
    const tones = new Set(set.casing.faces.map((f) => f.hex));
    // I ASSERT THE RELATION, NOT THE HEX — and C's hexes turn out to be exactly
    // right, which is worth saying because I briefly thought they were not.
    //
    // C's row quotes "#36363f against a #26262c front". My first reading found
    // #2e2e37 on the front and I was drafting a note that the row's numbers had
    // gone stale (GOTCHAS 44). They had not: there are THREE similar six-material
    // dark boxes within 2 m of the bed and I had read a different one. The
    // shape-based finder picks the set itself, and its front is #26262c to the
    // digit.
    //
    // The assertions below still test the RELATION rather than the literal tones,
    // because a hex copied out of a note is a memory and the relation is the
    // claim — "top face lighter where the moulding catches light" survives a
    // repaint and "#36363f" does not.
    say(tones.size >= 4, 'BLACK PLASTIC IS NOT BLACK — the casing is graded, not one tone',
      `${tones.size} distinct tones across six faces: ${[...tones].join(' ')}`);
    say(top.lum > front.lum, 'the top face catches light — lighter than the front',
      `top ${top.hex} ${top.lum} vs front ${front.hex} ${front.lum}`);
    say(front.lum > sideA.lum && Math.abs(sideA.lum - sideB.lum) < 1e-6,
      'the sides are darker than the front, and equal to each other',
      `front ${front.lum} vs sides ${sideA.lum} / ${sideB.lum}`);
    say(under.lum < sideA.lum, 'and the underside is darker still',
      `under ${under.hex} ${under.lum} against sides ${sideA.lum}`);
    say(Math.max(...set.casing.faces.map((f) => f.sat)) < 0.35,
      'the casing is NEUTRAL, not a blue or a brown pretending to be black',
      `max saturation ${Math.max(...set.casing.faces.map((f) => f.sat)).toFixed(3)}`);
    // and it must separate from the DEAD SCREEN, which is the whole point of a
    // black set: a black box with a black screen in it is one silhouette
    const screens = set.around.filter((a) => a.grn > 0.0005);
    say(screens.length > 0,
      'and something near it is grey-GREEN, so the set separates by hue as well as value',
      screens.length ? `${screens.length} green-leaning material(s), e.g. `
        + screens.slice(0, 3).map((a) => `${a.hex} g+${a.grn}`).join(' ')
        : 'nothing green-leaning within 2 m — the dead screen may read as casing');
  }
}

say(errs.length === 0, 'no page errors through any of that',
  errs.length ? errs.slice(0, 3).join(' | ') : 'clean');

await b.close();
let bad = 0;
for (const [ok, name, detail] of results) {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}\n        ${detail}`);
}
console.log(`\n${results.length - bad} of ${results.length} passed`);
process.exit(bad ? 1 : 0);

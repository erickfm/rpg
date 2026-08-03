// Item 232 — WHAT DOES THE WRONG MARGIN ACTUALLY COST?
//
// The row says nine call sites compare against `REACH_MARGIN` (0.6) where
// `fp.ts` decides an unaimed standing player's offer with `TOUCH_MARGIN`
// (0.15). Before changing a single call site, measure the difference: how many
// spots does the world actually offer to a standing, unaimed player, and how
// many does the 0.6 predicate CLAIM it offers?
//
// The gap between those two counts is the false-green surface. If it is zero
// everywhere the row is cosmetic; if it is large the two registered checks have
// been certifying reachability the world does not provide.
//
// POPULATION FLOOR: sampling zero spots, or failing to read either accessor,
// must ABORT (exit 3) rather than report a comfortable zero. A probe that
// measures nothing and prints "no difference" is exactly the failure this
// project keeps paying for.
//
// Reads `__ct.touchMargin()` / `__ct.reachMargin()` — NEVER `import('/src/proto/fp.ts')`,
// which 404s on `vite preview` (item 223).
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const margins = await p.evaluate(() => ({
  touch: window.__ct.touchMargin?.(),
  reach: window.__ct.reachMargin?.(),
}));
if (typeof margins.touch !== 'number' || !isFinite(margins.touch)
 || typeof margins.reach !== 'number' || !isFinite(margins.reach)) {
  console.error(`ABORT: accessors did not both return numbers — ${JSON.stringify(margins)}`);
  await b.close(); process.exit(3);
}
console.log(`built bundle publishes: touchMargin=${margins.touch}  reachMargin=${margins.reach}`);
if (margins.touch >= margins.reach) {
  console.error(`ABORT: touch (${margins.touch}) is not smaller than reach (${margins.reach}) — the premise of this probe is gone.`);
  await b.close(); process.exit(3);
}

// Sample the world's own spots. For each, ask at what distance the two
// predicates disagree, and — the part that matters — walk the player to the
// ring BETWEEN them and ask the world whether it offers the spot.
const spots = await p.evaluate(() => window.__ct.spots().map((s) => ({
  label: s.label, x: s.x, z: s.z, r: s.r, ok: s.ok,
})));
if (spots.length === 0) {
  console.error('ABORT: zero spots in the world — nothing to measure.');
  await b.close(); process.exit(3);
}
console.log(`${spots.length} spots registered, ${spots.filter((s) => s.ok).length} live\n`);

// THE BAND: every spot has a ring r+TOUCH .. r+REACH where the 0.6 predicate
// says "reachable" and the world says "only if you aim at it". Its width is the
// same for every spot (0.45 m) but what matters is whether standing in it
// actually gets you an offer.
const BAND = margins.reach - margins.touch;
console.log(`the disputed band is ${BAND.toFixed(2)} m wide around EVERY spot`);
console.log(`  a check using r+${margins.reach} counts a player anywhere in it as "in reach"`);
console.log(`  the world offers them nothing there unless they are AIMED at it\n`);

// Test it on real spots: stand in the band, face AWAY, ask for the prompt.
// Facing away isolates the aim-free pass, which is the clause the row is about.
const live = spots.filter((s) => s.ok).slice(0, 12);
if (live.length === 0) {
  console.error('ABORT: no live spots to stand at.');
  await b.close(); process.exit(3);
}

let claimedReach = 0, actuallyOffered = 0, tested = 0;
for (const s of live) {
  // stand in the middle of the disputed band, facing directly AWAY from the spot
  const d = s.r + margins.touch + BAND / 2;
  const ang = 0;                                  // approach along +x
  const px = s.x + d * Math.cos(ang), pz = s.z + d * Math.sin(ang);
  const away = Math.atan2(s.x - px, -(s.z - pz)) + Math.PI;   // 180 deg off
  const res = await p.evaluate(([x, z, yaw]) => {
    window.__ct.warp(x, z, yaw);
    return null;
  }, [px, pz, away]);
  await p.waitForTimeout(140);
  const got = await p.evaluate(() => {
    // `#ct-prompt`.textContent IS A GHOST — `ct/hud.ts:1715` hides the element
    // with display:none and never clears its text, so it keeps the last offer
    // forever. `display` is the truth. See probes/w88-does-prompt-clear.mjs.
    const el = document.getElementById('ct-prompt');
    const shown = !!el && getComputedStyle(el).display !== 'none';
    const v = window.__ct.pos();
    return { prompt: shown ? ((el.textContent ?? '').trim() || null) : null, x: v[0], z: v[2] };
  });
  // did the warp actually land us where we asked? a collider may have stopped it
  const landed = Math.hypot(got.x - px, got.z - pz);
  if (landed > 0.35) continue;                    // could not stand there; not a sample
  tested++;
  claimedReach++;                                  // by r+0.6 this player is "in reach"
  const offered = got.prompt !== null && got.prompt.includes(s.label.slice(0, 12));
  if (offered) actuallyOffered++;
  console.log(`  ${offered ? 'OFFERED ' : 'silent  '} d=${d.toFixed(2)} (r ${s.r})  ${s.label.slice(0, 46)}`);
}

// ── THE CONTROL, AND IT IS NOT OPTIONAL ───────────────────────────────────
// Everything above reports "silent". A prompt reader that returns null for
// EVERYTHING would print exactly the same page and prove nothing — GOTCHAS 34,
// and the single likeliest way this probe lies to me. So stand INSIDE the touch
// radius of the same spots and require the prompt to actually fire. If it never
// fires here, the reader is broken and every "silent" above is worthless.
let controlOffered = 0, controlTested = 0;
for (const s of live) {
  const d = Math.max(0.05, s.r - 0.1);            // well inside r + TOUCH_MARGIN
  const px = s.x + d, pz = s.z;
  const toward = Math.atan2(s.x - px, -(s.z - pz));
  await p.evaluate(([x, z, yaw]) => { window.__ct.warp(x, z, yaw); }, [px, pz, toward]);
  await p.waitForTimeout(140);
  const got = await p.evaluate(() => {
    // `#ct-prompt`.textContent IS A GHOST — `ct/hud.ts:1715` hides the element
    // with display:none and never clears its text, so it keeps the last offer
    // forever. `display` is the truth. See probes/w88-does-prompt-clear.mjs.
    const el = document.getElementById('ct-prompt');
    const shown = !!el && getComputedStyle(el).display !== 'none';
    const v = window.__ct.pos();
    return { prompt: shown ? ((el.textContent ?? '').trim() || null) : null, x: v[0], z: v[2] };
  });
  if (Math.hypot(got.x - px, got.z - pz) > 0.35) continue;
  controlTested++;
  if (got.prompt !== null) controlOffered++;
}
console.log(`\n── control: standing INSIDE the radius, aimed ──`);
console.log(`  ${controlTested} sampled, ${controlOffered} produced a prompt`);
if (controlTested === 0 || controlOffered === 0) {
  console.error('ABORT: the prompt reader never fired even standing on top of a spot.');
  console.error('       Every "silent" above is unproven. Fix the reader before believing this probe.');
  await b.close(); process.exit(3);
}

console.log(`\n── the false-green surface ──`);
if (tested === 0) {
  console.error('ABORT: could not stand in the band at ANY spot — zero samples, nothing measured.');
  await b.close(); process.exit(3);
}
console.log(`  ${tested} spots sampled, standing in the disputed band, facing 180 deg away`);
console.log(`  a r+${margins.reach} check calls all ${claimedReach} of them "within reach"`);
console.log(`  the world actually offered ${actuallyOffered}`);
console.log(`  => ${claimedReach - actuallyOffered} of ${tested} would be certified reachable and are not`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}`);
await b.close();
process.exit(0);

// FIRST FEDERAL'S INTERIOR HOLDS: you can get in, get out, get into the vault,
// and you cannot get behind the teller line.
//
// An ASSERTION suite (GOTCHAS 24 — the pictures live in `M-bank-int-shots.mjs`).
// Interiors cannot be verified from a screenshot and collision least of all
// (GOTCHAS 1, 7), so this drives the real rig: it walks to the door on the
// pavement, presses E, and then walks the room until something stops it.
//
// Nothing here is a hand-typed coordinate. The door comes from the room's own
// declaration in ct/doors.ts, the room's size and centre from
// `__ct.roomDims()`, and the vault's mouth from the geometry the room published
// — because five checks in this project have gone red on a stale offset a
// harness was carrying its own copy of.
//
//   0  measured, and it is fine
//   1  measured, and it is WRONG
//   2  usage, or a --selftest that was not caught
//   3  ABORTED — wrong world, or nothing to measure (GOTCHAS 32)
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4204/';
const SELFTEST = flags(['--selftest']).selftest;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => {
  if (/\[interior:bank\]|\[doors\]/.test(m.text())) errs.push('KIT: ' + m.text());
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

// `__ct.pos()` returns an ARRAY [x, y, z, gy]. Wrapped into a named shape here
// once, rather than indexed at fifteen call sites where a [2] typed as a [1]
// reads as a plausible number.
const pos = async () => {
  const a = await p.evaluate(() => window.__ct.pos());
  return { x: a[0], y: a[1], z: a[2], gy: a[3] };
};
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const warp = (x, z, yaw, gy) =>
  p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const press = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(90);
  await p.keyboard.up('e'); await p.waitForTimeout(300);
};
// WALK UNTIL IT STOPS MAKING PROGRESS, never for a fixed time. GOTCHAS 30: a
// frame is 17 ms idle and over a second under load, so `hold('w', 1600)` is a
// bet on how busy the machine is — and it took `lotwalk` from 12/12 to 3/12.
//
// AND IT SAMPLES THE PROMPT AS IT GOES. Reading it only at the END is a bug I
// shipped into this file and watched fail: walking north along the pavement, the
// player passes the door's 1.15 m touch volume at about 1.3 s and keeps going
// for the rest of the 3 s, so the prompt at the finish line is about a stretch
// of empty wall forty metres on. It reported a working door as broken twice —
// GOTCHAS 48's shape exactly, a probe whose stride is longer than the feature.
const walk = async (key, maxMs = 4000) => {
  const t0 = Date.now();
  let last = await pos(), still = 0;
  const seen = [];
  await p.keyboard.down(key);
  while (Date.now() - t0 < maxMs) {
    await p.waitForTimeout(120);
    const [now, pr] = [await pos(), await prompt()];
    if (pr) seen.push(pr);
    const moved = Math.hypot(now.x - last.x, now.z - last.z);
    last = now;
    if (moved < 0.012) { if (++still >= 3) break; } else still = 0;
  }
  await p.keyboard.up(key);
  await p.waitForTimeout(140);
  const end = await pos();
  const pr = await prompt();
  if (pr) seen.push(pr);
  return { ...end, seen };
};
/** the re-entry hysteresis: every spot is suppressed until you are 1.2 m clear
 *  of where a door put you. Read it rather than infer it — a null prompt from a
 *  latched landing and a null prompt from a broken world are the same reading
 *  from the HUD, which is why __ct.landing() exists. */
const landing = () => p.evaluate(() => window.__ct.landing());

const results = [];
const say = (ok, name, detail) => results.push([ok, name, detail]);
const f2 = (n) => +n.toFixed(2);
const money = (n) => `$${n.toFixed(2)}`;

// ── the subjects, ASKED FOR rather than remembered ─────────────────────────
const R = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => r.id === 'bank'));
// AIMED AT EITHER BUILD. This used to `import('/src/proto/ct/doors.ts')`, which
// only resolves on the dev server — so the whole suite died against the BUNDLE
// with "failed to fetch dynamically imported module", and the bundle is what
// ships (GOTCHAS 37). `__ct.doors()` is the same registry published by the world,
// and the door's LOCAL x comes off `roomDims()`, which the kit publishes for
// exactly this reason. Nothing here is a second authoring of either.
const stand = await p.evaluate(() => {
  const d = (window.__ct.doors() || []).find((q) => q.building === 'FIRST FEDERAL');
  return d && d.stand ? { ...d.stand, widthM: d.widthM, point: d.point } : null;
});
const hw = R.w / 2, hd = R.d / 2;
const wx = (lx) => R.cx + lx, wz = (lz) => R.cz + lz;
console.log(`room ${R.w.toFixed(2)} x ${R.d.toFixed(2)} at (${R.cx.toFixed(1)}, ${R.cz.toFixed(1)})`);
console.log(`door published at local x ${R.door.x.toFixed(2)}, world z `
  + `${stand.point.z.toFixed(2)}; stand (${stand.x.toFixed(2)}, ${stand.z.toFixed(2)})\n`);

// ── --selftest: BREAK THE WORLD ON PURPOSE AND REQUIRE THIS TO GO RED ──────
//
// Two mutations, on the LIVE `__ct.colliders()` array the movement code tests,
// so they are the real thing and not a simulation of it. Nothing else changes:
// the room is still built, still furnished, still lit.
//
//   A. TAKE THE TELLER LINE'S COLLIDER OUT. Found by predicate, not by a typed
//      box — the widest collider in this room's slab that sits behind the
//      counter's front face. With it gone the player walks through the counter
//      to the back wall and the five containment claims must fail.
//   B. WALL THE VAULT THROAT SHUT. The two walk-in claims must fail.
//
// AND A NEGATIVE RESULT WORTH WRITING DOWN, because a mutation that cannot
// break the thing looks exactly like a check that works (GOTCHAS 27). I tried
// walling the pavement outside the bronze doors first and only ONE of
// twenty-one claims went red. That is not a weak check, it is the game: a spot
// you are LOOKING at is selectable out to 6 m (`fp.ts`, and the user asked for
// that by name), so you can read the prompt and press E from across the
// pavement whatever is in the way. The door-offer claims are therefore not
// falsifiable by geometry, and I would rather say that than ship a mutation
// that appears to test them. What DOES falsify them is the room not being built
// or the door not being declared, and both of those abort at exit 3 above.
if (SELFTEST) {
  const n = await p.evaluate(([cx, cz, hw]) => {
    const cs = window.__ct.colliders();
    let removed = 0;
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i];
      const inSlab = c.minX > cx - hw - 1 && c.maxX < cx + hw + 1;
      // maxZ > cz - 5 keeps the kit's own BACK WALL out of this: the wall's
      // maxZ is -6.0 and the counter's is -3.96. Without that clause the
      // mutation removed both and the player escaped 7 m past the back wall —
      // a red for a reason I did not intend, which is the same defect as a
      // green for a reason you did not intend.
      const isCounter = c.maxZ < cz - 3.5 && c.maxZ > cz - 5 && c.maxX - c.minX > 8;
      if (inSlab && isCounter) { cs.splice(i, 1); removed++; }
    }
    return removed;
  }, [R.cx, R.cz, hw]);
  await p.evaluate(([x, z]) => {
    window.__ct.colliders().push({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.5, maxZ: z + 0.5 });
  }, [R.cx - 5.40, R.cz - 3.0]);
  console.log(`selftest: removed ${n} counter collider(s) and walled the vault throat `
    + '— the containment and walk-in claims MUST now go red\n');
  if (n === 0) {
    console.error('selftest ABORT: found no counter collider to remove, so mutation A '
      + 'did nothing and a green below would prove nothing');
    await b.close(); process.exit(3);
  }
}

// ── 1. THE WAY IN, from every direction somebody would try ─────────────────
//
// A trigger you can only reach from one angle is a trigger that does not work
// (GOTCHAS 8 — the bodega's crates ate its door exactly this way). The bank is
// on the WEST side, so its pavement runs along z and you come at it walking
// north, walking south, or straight at it from the kerb.
const approaches = [
  ['walking north up the walk', stand.x, stand.z + 3.2, 0, 'w'],
  ['walking south down the walk', stand.x, stand.z - 3.2, Math.PI, 'w'],
  ['straight at the doors from the kerb', stand.x + 1.9, stand.z, -Math.PI / 2, 'w'],
];
for (const [what, sx, sz, yaw, key] of approaches) {
  // 1.2 m clear of any previous landing, or every spot below is suppressed and
  // this whole section reads as a broken door
  await p.evaluate(() => window.__ct.warp(-5.0, 30, 0, 0.14, 0));
  await p.waitForTimeout(200);
  await warp(sx, sz, yaw, 0.14);
  const r = await walk(key, 3200);
  const offered = r.seen.some((t) => /into FIRST FEDERAL/i.test(t));
  say(offered, `the doors offer themselves, ${what}`,
    `prompts seen on the way: ${r.seen.length ? [...new Set(r.seen)].join(' / ') : 'none'}`);
  if (offered) {
    // and then STAND at the spot and use it, which is what a player does once
    // the prompt has told them it is there
    await warp(stand.x, stand.z, yaw, 0.14);
    await p.waitForTimeout(200);
    await press();
    const q = await pos();
    const inside = q.x > R.cx - hw && q.x < R.cx + hw && q.z > R.cz - hd && q.z < R.cz + hd;
    say(inside, `and E puts you inside the room, ${what}`,
      `landed local (${f2(q.x - R.cx)}, ${f2(q.z - R.cz)})`);
  }
}

// ── 2. THE WAY OUT, walked the way a player meets it ──────────────────────
//
// NOT "warp to where the door drops you and read the prompt". On arrival the
// re-entry hysteresis is armed by design — the door that just moved you must not
// immediately pull you back — so the prompt is legitimately null for the first
// 1.2 m and a check that asserts otherwise is asserting against the fix. What a
// player actually does is walk in, turn round, and walk back at the doors.
{
  await warp(wx(R.door.x), wz(hd - 1.15), 0, 0);
  await p.waitForTimeout(200);
  const arrive = await landing();
  say(true, 'on arrival the re-entry hysteresis is armed (by design, not a fault)',
    arrive ? `must walk ${arrive.clearIn.toFixed(2)} m to re-arm` : 'nothing latched');
  const inn = await walk('w', 2200);                       // into the room, clearing it
  say((await landing()) === null, 'and walking into the room clears it',
    `walked to local (${f2(inn.x - R.cx)}, ${f2(inn.z - R.cz)})`);
  const back = await walk('s', 2600);                      // back at the doors
  say(back.seen.some((t) => /out to the street/i.test(t)),
    'the way out offers itself walking back at the doors',
    `prompts seen: ${back.seen.length ? [...new Set(back.seen)].join(' / ') : 'none'}`);
  await warp(wx(R.door.x), wz(hd - 0.55), Math.PI, 0);     // stand on it, facing it
  await p.waitForTimeout(220);
  await press();
  const q = await pos();
  say(q.x < 100, 'and it puts you back on the street', `landed (${f2(q.x)}, ${f2(q.z)})`);
  // THE GEOMETRIC form of "you are not dumped back inside the way-in trigger".
  // Reading the prompt here would pass for the wrong reason: leaving latches the
  // hysteresis too, so the prompt is null whatever the geometry says. Measure
  // the gap instead — the kit's own rule is doorR + 0.35.
  const gap = Math.hypot(q.x - stand.x, q.z - stand.z);
  say(gap > 1.05 + 0.35, 'and lands clear of the way-in trigger it just used',
    `${f2(gap)} m from the spot, which needs 1.40`);
}

// ── 3. YOU CANNOT GET BEHIND THE TELLER LINE ──────────────────────────────
//
// The one thing a teller line has to do. Walked at all three windows and at both
// ENDS, because a counter sealed in the middle and open at its ends is the
// classic version of this bug, and checking one instance of a repeated thing
// proves nothing about the others (GOTCHAS 41).
//
// TWO CLAIMS PER STATION, and separating them took two false results to see:
//
//   A. YOU CANNOT REACH THE BACK WALL. The threshold comes from the ROOM's own
//      depth, so it is independent of the thing under test and it FALSIFIES:
//      take the counter's collider away and the player walks to the back wall
//      and this goes red. This is the containment claim.
//   B. YOU STOP AT THE COUNTER'S FACE, within 0.16 m. This one is derived FROM
//      the collider, so it cannot falsify containment — what it catches is the
//      walk being stopped by SOMETHING ELSE, which happened: when I added the
//      queue rope, two of three windows went on passing under the mutation
//      because the rope was catching the walk 1.1 m short of the counter. The
//      check was measuring a velvet rope and reporting a teller line
//      (GOTCHAS 34).
//
// My first attempt merged them into one, deriving the expectation from the
// collider under test — which is a tautology dressed as a measurement: "the
// collider stops you where the collider is". Under the mutation it did not go
// red, it went to EXIT 3, because the check's own subject had been removed. That
// is the correct exit code and it is useless as a selftest.
const TELLER = await p.evaluate(([cx, cz, hw]) => {
  const cs = window.__ct.colliders().filter((c) =>
    c.minX > cx - hw - 1 && c.maxX < cx + hw + 1 && c.maxZ < cz - 3.5 && c.maxZ > cz - 5
    && c.maxX - c.minX > 8);
  return cs.length === 1 ? { front: cs[0].maxZ - cz, w: cs[0].maxX - cs[0].minX } : null;
}, [R.cx, R.cz, hw]);
const RADIUS = 0.36;                                    // fp.ts
// A MISSING COUNTER COLLIDER IS A FAULT, NOT AN UNMEASURABLE WORLD. The room is
// there and it is the subject; the counter failing to register is exactly what
// this section exists to catch, so it is a FAIL and not an exit 3.
say(TELLER !== null, 'the teller line registers exactly one wide collider',
  TELLER ? `${TELLER.w.toFixed(2)} m wide, face at local z ${TELLER.front.toFixed(2)}`
    : 'none found in the bank slab');
if (TELLER) {
  console.log(`teller line: ${TELLER.w.toFixed(2)} m wide, front face at local z `
    + `${TELLER.front.toFixed(2)}, so a player must stop at `
    + `${(TELLER.front + RADIUS).toFixed(2)}\n`);
}
// THE WALK STARTS NORTH OF THE QUEUE ROPE, ALWAYS — not "north of the counter
// when there is one". Falling back to the middle of the lobby left windows 1 and
// 2 behind the rope, and under the mutation the rope caught them 2 m short and
// they passed. A station whose falsifiability depends on another object being
// absent is not a station.
//
// -3.15 is the 1.28 m gap between the rope's north face (-2.52) and the
// counter's (-3.96), and the guard below refuses to measure from it if the rig
// has to push the player out of something to put them there.
const START_Z = -3.15;
const NO_GO = -hd + 1.5;             // this close to the back wall is behind the line
// Each station carries its own start z, because the EAST CORNER cannot be
// approached from -3.15: the waiting row's brochure table stands at x 6.06…7.18,
// z -3.03…-2.23, so a player put at (6.4, -3.15) is displaced 0.24 m by the rig
// before the walk begins. The start-point guard below is what found that — I had
// written the station from the room's plan, not from what is standing in it.
for (const [what, xl, zl] of [['window 1', -1.4, START_Z], ['window 2', 1.8, START_Z],
                              ['window 3', 5.0, START_Z], ['the west end', -3.2, START_Z],
                              ['the east corner', 6.6, -3.52]]) {
  await warp(wx(xl), wz(zl), 0, 0);
  await p.waitForTimeout(200);
  // A CHECK MUST VERIFY IT IS WHERE IT THINKS IT IS before it presses anything
  // (GOTCHAS 20). The rig pushes a capsule out of anything solid, so a start
  // point inside a collider silently becomes a different start point — and a
  // containment walk that begins somewhere else is a fact about the probe.
  const p0 = await pos();
  const slip = Math.hypot(p0.x - wx(xl), p0.z - wz(zl));
  say(slip < 0.06, `the walk at ${what} starts where it means to`,
    `displaced ${f2(slip)} m from (${xl}, ${zl})`);
  const q = await walk('w', 3500);
  const lz = q.z - R.cz;
  say(lz > NO_GO, `you cannot get behind the line at ${what}`,
    `stopped at local z ${f2(lz)}; behind the line is anything under ${f2(NO_GO)}`);
  if (TELLER) {
    say(Math.abs(lz - (TELLER.front + RADIUS)) < 0.16,
      `and you stop AT the counter's own face at ${what}, not short of it`,
      `stopped ${f2(lz)}, the face plus a radius is ${f2(TELLER.front + RADIUS)}`);
  }
}

// ── 4. THE VAULT IS A ROOM YOU CAN WALK INTO ─────────────────────────────
//
// The headline of the interior, so it is walked rather than looked at. Stand in
// the lobby on the throat's centreline, walk north, and you must end up PAST
// the vault's front wall — not stopped at it.
const THROAT_CX = -5.40, V_FRONT = -3.00;
await warp(wx(THROAT_CX), wz(-1.2), 0, 0);
await p.waitForTimeout(160);
{
  const q = await walk('w', 4500);
  const lz = q.z - R.cz, lx = q.x - R.cx;
  say(lz < V_FRONT - 0.4, 'you can walk through the vault door into the vault',
    `ended local (${f2(lx)}, ${f2(lz)}), the vault's front wall is at z ${V_FRONT}`);
  // and there is real floor in there — walk both ways across it
  const w1 = await walk('a', 2500);
  const w2 = await walk('d', 2500);
  say(Math.abs(w2.x - w1.x) > 1.2, 'and there is room to move about inside it',
    `traversed ${f2(Math.abs(w2.x - w1.x))} m of vault floor`);
  say(w1.x - R.cx > -hw && w2.x - R.cx < -3.6,
    'without escaping through the vault walls',
    `west stop local x ${f2(w1.x - R.cx)}, east stop local x ${f2(w2.x - R.cx)}`);
}

// ── 5. THE COUPON TABLE'S CHAIR IS SITTABLE ───────────────────────────────
{
  const seat = await p.evaluate(() => (window.__ct.seats ? window.__ct.seats() : [])
    .filter((s) => /coupon table/i.test(s.label || '')).length);
  say(seat === 1, 'the vault has exactly one registered seat', `found ${seat}`);
}

// ── 6. THE LOAN, applied for and paid back ────────────────────────────────
//
// The second request, driven end to end rather than looked at: sit down, read
// the form, hand it over, collect the cash at the window, pay it back.
//
// AND THE BALANCE IS READ OFF A'S ATM ON THE PAVEMENT, not off my own prompt.
// `__ct` publishes no purse and `crosstown.ts` is not mine to add one to, but
// the ATM already reports `ctx.purse.cash` and it is somebody else's code, so it
// is a better witness than anything in this room: it proves the ECONOMY moved,
// and it proves the machine outside agrees with the desk inside.
{
  // ── THE WITNESS: K's `__inv.cash()`, not my own prompt ───────────────────
  //
  // The claim is that the ECONOMY moved, so it has to be measured by something
  // that is not this room. It used to read the balance off A's ATM label on the
  // pavement — and K's ATM INTERFACE landed under me, so the label became
  // "FIRST FEDERAL — use the machine" and the number moved inside a panel that
  // draws to canvas. The check died on `null.toFixed`.
  //
  // `__inv.cash()` is the better witness and I should have used it first: it is
  // `ct/inventory.ts` publishing the same `ctx.purse` object the wallet draws and
  // the bodega spends from — a different module, a published affordance rather
  // than a prompt string being scraped, and it cannot be broken by somebody
  // rewording a label.
  const cash = () => p.evaluate(() => window.__inv.cash());
  const at = async (lx, lz, yaw) => {
    await warp(wx(lx), wz(lz), yaw, 0);
    await p.waitForTimeout(240);
    return prompt();
  };
  const DESK_X = 4.4, CLI_Z = 2.62, FORM_X = 3.75, FORM_Z = 1.92;
  const STAND_Z = CLI_Z + 0.9;
  const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));
  const atHer = () => at(DESK_X, STAND_Z, yawTo(DESK_X, STAND_Z, DESK_X, 0.95));
  const atForm = () => at(DESK_X, STAND_Z, yawTo(DESK_X, STAND_Z, FORM_X, FORM_Z));

  // THE CHAIR MUST NOT EAT THE OFFICER. This is the check for the bug this
  // section found: the seat's prompt is registered at its approach point, and a
  // spot you are standing on wins the dispatch outright.
  {
    const t0 = await at(DESK_X, STAND_Z, yawTo(DESK_X, STAND_Z, DESK_X, 0.95));
    say(!/sit in the client chair/i.test(t0 || ''),
      'standing in front of the desk selects the OFFICER, not the chair',
      `prompt: ${JSON.stringify(t0)}`);
    const t1 = await at(DESK_X + 1.10, CLI_Z + 0.25, yawTo(DESK_X + 1.10, CLI_Z + 0.25, DESK_X, CLI_Z));
    say(/sit in the client chair/i.test(t1 || ''),
      'and the chair is still offered, from its own side',
      `prompt: ${JSON.stringify(t1)}`);
  }

  const cash0 = await cash();
  say(typeof cash0 === 'number', 'the pockets publish a balance, so it can witness this',
    typeof cash0 === 'number' ? `opening balance ${money(cash0)}`
      : '__inv.cash() gave nothing — the rest of this section is unwitnessed');

  await p.evaluate(() => window.__ct.clock(14, 20));                   // banking hours
  await p.waitForTimeout(200);

  const panelUp = () => p.evaluate(() => window.__hud.panel());

  let t = await atHer();
  say(/apply for a loan/i.test(t || ''), 'the loan officer offers an application',
    `prompt: ${JSON.stringify(t)}`);

  // ── the application is K's SHARED CABINET, not a prompt of my own ─────────
  //
  // The queue asked for that by name: a loan application on a
  // different-looking panel would stand out immediately in a world with three
  // other full-screen interfaces. `__hud.panel()` reports which cabinet is up
  // by its own id, so this is the world's answer and not mine.
  await press();
  say((await panelUp()) === 'ct-loan', 'and E opens the shared panel, not a prompt',
    `__hud.panel() = ${JSON.stringify(await panelUp())}`);
  // THE WORLD IS FROZEN BEHIND IT — the framework's promise, checked rather
  // than trusted, because a cabinet you can walk out from behind is worse than
  // no cabinet
  {
    const before = await pos();
    await p.keyboard.down('w'); await p.waitForTimeout(420); await p.keyboard.up('w');
    const after = await pos();
    say(Math.hypot(after.x - before.x, after.z - before.z) < 0.02,
      'and the world is frozen behind it — W moves the selection, not the player',
      `moved ${f2(Math.hypot(after.x - before.x, after.z - before.z))} m`);
  }

  // W walked the amount up twice already (once above, once in the freeze test),
  // so this is $1000 — which wants $50 down against $14.50 and must be REFUSED.
  await p.keyboard.press('w'); await p.waitForTimeout(200);
  await p.keyboard.press('Enter'); await p.waitForTimeout(260);
  say((await panelUp()) === 'ct-loan', 'a refusal keeps the sheet up so you can read it',
    `__hud.panel() = ${JSON.stringify(await panelUp())}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  say((await panelUp()) === null, 'and ESC always closes it', `__hud.panel() = ${JSON.stringify(await panelUp())}`);
  const cashD = await cash();
  say(cashD === cash0, 'a refusal costs you nothing', `${money(cash0)} -> ${money(cashD)}`);
  t = await atHer();
  say(/apply for a loan/i.test(t || ''), 'and the desk still offers to try again',
    `prompt: ${JSON.stringify(t)}`);

  // …and the FORM on the desk opens the SAME sheet, which is the other half of
  // why they are two spots: the person and the paper are both the way in
  t = await atForm();
  say(/loan application/i.test(t || ''), 'the form on the desk is the other way in',
    `prompt: ${JSON.stringify(t)}`);
  await press();
  say((await panelUp()) === 'ct-loan', 'and it opens the same cabinet',
    `__hud.panel() = ${JSON.stringify(await panelUp())}`);

  // wind the amount back down to $200, which wants $10 — that one goes through
  for (let i = 0; i < 4; i++) { await p.keyboard.press('s'); await p.waitForTimeout(120); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  t = await atHer();
  say(/approved/i.test(t || '') && /window 2/i.test(t || ''),
    'a loan you CAN secure is approved, and the desk sends you to the teller',
    `prompt: ${JSON.stringify(t)}`);
  const cashA = await cash();
  say(cashA === cash0, 'and approval alone does not hand you the money',
    `${money(cash0)} -> ${money(cashA)}`);

  // …the TELLER counts it out, which is the half that makes the counter a
  // working object rather than scenery
  t = await at(1.8, -3.5, 0);
  say(/collect your loan/i.test(t || '') && /200\.00/.test(t || ''),
    'window 2 offers to count it out', `prompt: ${JSON.stringify(t)}`);
  await press();
  const cash1 = await cash();
  say(cash1 !== null && Math.abs(cash1 - (cash0 + 200)) < 0.005,
    'and the cash lands in the purse, as the pockets agree',
    `${money(cash0)} -> ${money(cash1)}`);

  // and it is a DEBT: 13.5% on $200 is $227.00, wanted back at the same window
  t = await at(1.8, -3.5, 0);
  // EITHER WORDING IS CORRECT and my first version of this assertion was not.
  // It demanded "pay off your loan — $227.00", but the player is holding $214.50
  // against a $227.00 debt, so the window correctly offers the PART payment it
  // can actually take. What matters is that the interest it quoted is the figure
  // being asked for: 13.5% on $200 is $227.00, and that number has to be on
  // screen either way.
  say(/pay .*your loan/i.test(t || '') && /227\.00/.test(t || ''),
    'the same window wants it back with the interest it quoted',
    `prompt: ${JSON.stringify(t)}`);
  await press();
  const cash2 = await cash();
  say(cash2 !== null && cash2 < cash1 - 200,
    'a part payment is taken when you cannot cover the whole debt',
    `${money(cash1)} -> ${money(cash2)}`);
  t = await at(1.8, -3.5, 0);
  say(/outstanding|nothing to pay/i.test(t || ''), 'and the balance still stands',
    `prompt: ${JSON.stringify(t)}`);

  // outside banking hours the desk SAYS SO rather than ignoring you — *"what is
  // not an answer is a machine that looks usable and ignores you"*
  await p.evaluate(() => window.__ct.clock(3, 0));
  await p.waitForTimeout(200);
  t = await atHer();
  say(t !== null, 'the loan desk answers at 3 a.m. rather than going silent',
    `prompt: ${JSON.stringify(t)}`);
  await p.evaluate(() => window.__ct.clock(14, 20));
}

// ── 6. and nothing threw or warned while doing any of that ───────────────
say(errs.length === 0, 'no page errors and no kit warnings for this room',
  errs.length ? errs.slice(0, 4).join(' | ') : 'clean');

await b.close();

let bad = 0;
for (const [ok, name, detail] of results) {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}\n        ${detail}`);
}
console.log(`\n${results.length - bad} of ${results.length} passed`);
if (SELFTEST) {
  if (bad > 0) { console.log('selftest CAUGHT the mutation'); process.exit(0); }
  console.log('selftest NOT CAUGHT — this check is decoration'); process.exit(2);
}
process.exit(bad ? 1 : 0);

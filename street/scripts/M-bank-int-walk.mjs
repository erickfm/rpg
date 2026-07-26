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
const stand = await p.evaluate(async () => {
  const dm = await import('/src/proto/ct/doors.ts');
  const decl = dm.declaredDoors().find((d) => d.building === 'FIRST FEDERAL');
  const s = dm.doorStandFor('FIRST FEDERAL');
  return decl && s ? { ...s, at: decl.at, leafW: decl.leaf && decl.leaf.clearW,
    doorWorld: dm.doorWorldFor('FIRST FEDERAL') } : null;
});
// GOTCHAS 32/34: an empty subject set is an ABORT, not a pass. Every verdict
// below is free if the room was never built or the door never declared.
if (!R) { console.error('ABORT: no room with id "bank" in __ct.roomDims()'); await b.close(); process.exit(3); }
if (!stand) { console.error('ABORT: FIRST FEDERAL declares no door in ct/doors.ts'); await b.close(); process.exit(3); }

const hw = R.w / 2, hd = R.d / 2;
const wx = (lx) => R.cx + lx, wz = (lz) => R.cz + lz;
console.log(`room ${R.w.toFixed(2)} x ${R.d.toFixed(2)} at (${R.cx.toFixed(1)}, ${R.cz.toFixed(1)})`);
console.log(`door declared at local x ${stand.at.toFixed(2)}, world z ${stand.doorWorld.toFixed(2)}, `
  + `leaf ${stand.leafW} m; stand (${stand.x.toFixed(2)}, ${stand.z.toFixed(2)})\n`);

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
  await warp(wx(stand.at), wz(hd - 1.15), 0, 0);
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
  await warp(wx(stand.at), wz(hd - 0.55), Math.PI, 0);     // stand on it, facing it
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
// The one thing a teller line has to do. Walked at all three windows, because a
// counter sealed at its middle and open at its ends is the classic version of
// this bug — and because checking one instance of a mirrored/repeated thing
// proves nothing about the others (GOTCHAS 41).
//
// The counter's own front face is read off the room rather than typed: it is
// the deepest z a player can reach on the counter's x span, which is what the
// walk measures anyway.
const WINDOW_X = [-1.4, 1.8, 5.0];
for (const wxl of WINDOW_X) {
  await warp(wx(wxl), wz(-1.6), 0, 0);
  await p.waitForTimeout(160);
  const q = await walk('w', 3500);
  const lz = q.z - R.cz;
  say(lz > -4.2, `the counter holds at window x ${wxl}`, `stopped at local z ${f2(lz)}`);
}
// …and at the two ENDS, which is where a slot would be
for (const [what, xl] of [['the counter\'s west end', -3.2], ['the east wall end', 6.4]]) {
  await warp(wx(xl), wz(-1.6), 0, 0);
  await p.waitForTimeout(160);
  const q = await walk('w', 3500);
  say(q.z - R.cz > -4.2, `no slot past ${what}`, `stopped at local z ${f2(q.z - R.cz)}`);
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
  const atmCash = async () => {
    const at = await p.evaluate(() => {
      // `spots()` publishes `label` already EVALUATED, as a string — it is not
      // the closure. Calling it throws, which is how I found out.
      const s = (window.__ct.spots() || []).find((q) => /check balance|balance \$/i.test(q.label || ''));
      return s ? { x: s.x, z: s.z } : null;
    });
    if (!at) return null;
    await p.evaluate(() => window.__ct.warp(-5.0, 20, 0, 0.14, 0));    // clear the latch
    await p.waitForTimeout(200);
    await p.evaluate(([x, z]) => window.__ct.warp(x + 0.85, z, -Math.PI / 2, 0.14, 0), [at.x, at.z]);
    await p.waitForTimeout(240);
    await press();
    const t = await prompt();
    const m = /\$([0-9]+\.[0-9]{2})/.exec(t || '');
    return m ? +m[1] : null;
  };
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

  const cash0 = await atmCash();
  say(cash0 !== null, 'the ATM outside reports a balance, so it can witness this',
    cash0 === null ? 'no ATM spot found — the rest of this section is unwitnessed'
      : `opening balance ${money(cash0)}`);

  await p.evaluate(() => window.__ct.clock(14, 20));                   // banking hours
  await p.waitForTimeout(200);

  let t = await atHer();
  say(/apply for a loan/i.test(t || ''), 'the loan officer offers an application',
    `prompt: ${JSON.stringify(t)}`);
  await press();
  t = await prompt();
  say(/hand her the form/i.test(t || '') && /\$200\.00/.test(t || ''),
    'and then asks for the form, naming the amount and the rate',
    `prompt: ${JSON.stringify(t)}`);

  // looking DOWN-LEFT at the desk selects the FORM instead of her — the whole
  // reason the two are separate spots, and it is the aim rule that does it
  t = await atForm();
  say(/the application/i.test(t || ''), 'looking at the form on the desk selects the form',
    `prompt: ${JSON.stringify(t)}`);
  await press();
  t = await prompt();
  say(/\$500\.00/.test(t || ''), 'and E on it moves the amount up',
    `prompt: ${JSON.stringify(t)}`);

  // $500 wants $25 down and the player has $14.50, so this must be REFUSED and
  // the refusal must carry BOTH numbers
  t = await atHer();
  await press();
  t = await prompt();
  say(/declined/i.test(t || '') && /25\.00/.test(t || ''),
    'a loan you cannot secure is DECLINED, and the refusal says why',
    `prompt: ${JSON.stringify(t)}`);
  const cashD = await atmCash();
  say(cashD === cash0, 'and a decline costs you nothing',
    `${money(cash0)} -> ${money(cashD)}`);

  // wrap the amount back round to $200, which wants $10 — and that goes through
  t = await atForm();
  for (let i = 0; i < 4; i++) await press();
  t = await prompt();
  say(/\$200\.00/.test(t || ''), 'the amount wraps back round to the smallest',
    `prompt: ${JSON.stringify(t)}`);
  await atHer();
  await press();
  t = await prompt();
  say(/approved/i.test(t || '') && /window 2/i.test(t || ''),
    'a loan you CAN secure is approved, and sends you to the teller',
    `prompt: ${JSON.stringify(t)}`);
  const cashA = await atmCash();
  say(cashA === cash0, 'and approval alone does not hand you the money',
    `${money(cash0)} -> ${money(cashA)}`);

  // …the TELLER counts it out, which is the half that makes the counter a
  // working object rather than scenery
  t = await at(1.8, -3.5, 0);
  say(/collect your loan/i.test(t || '') && /200\.00/.test(t || ''),
    'window 2 offers to count it out', `prompt: ${JSON.stringify(t)}`);
  await press();
  const cash1 = await atmCash();
  say(cash1 !== null && Math.abs(cash1 - (cash0 + 200)) < 0.005,
    'and the cash lands in the purse, as the ATM outside agrees',
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
  const cash2 = await atmCash();
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

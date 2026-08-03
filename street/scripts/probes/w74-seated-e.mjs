// ITEM 205 — the machine you sit at is an `[E]` TARGET, and sitting still opens it.
//
// The row asked for the sit-to-open polls to be deleted and replaced by a
// `ctx.spot`. Only the spot is added: *"add a slots interface and game where
// WHEN I SIT DOWN I ENTER THE SLOTS INTERFACE"* (FEATURE-REQUESTS.md:281) and
// queue item 4's *"opening when the player sits at a library machine"* are the
// user's own words for the behaviour the deletion would have removed. So this
// check asserts BOTH halves, and the regression half is not optional.
//
//   SHOT_URL=http://localhost:4300/ node scripts/probes/w74-seated-e.mjs
//
// POPULATION FLOOR. Every leg counts what it actually exercised and the run
// FAILS if a machine contributed nothing — "I measured nothing" must be red
// (BUILDER-BRIEF §7). The negative case is built in: leg `away` turns the head
// off the machine and requires the offer to DISAPPEAR, so a spot that simply
// always won would fail here rather than pass everything.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4300/');

const CASES = [
  { label: 'sit at the computer', panel: 'ct-library-pc', offer: /use the computer/i, station: '__librarypc', mesh: 'screenMesh' },
  { label: 'sit at the slot', panel: 'ct-slots', offer: /play the slot/i, station: '__slots', mesh: 'screen' },
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

let bad = 0, exercised = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const ok = (m) => console.log(`ok    ${m}`);
const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const panelNow = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const seatedNow = () => p.evaluate(() => !!window.__ct.seated());
// BUILDER-BRIEF §5: a HELD key. `press()` can begin and end inside one frame
// and the [E] dispatch is an edge read once per RENDERED frame.
const tap = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(90); await p.keyboard.up(k); await p.waitForTimeout(420); };
const turnTo = async (yaw) => {
  for (let i = 0; i < 500; i++) {
    const now = await p.evaluate(() => window.__ct.yaw());
    const step = ((yaw - now + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(step) < 0.03) return now;
    await p.keyboard.down(step > 0 ? 'ArrowRight' : 'ArrowLeft');
    await p.waitForTimeout(18);
    await p.keyboard.up(step > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  return p.evaluate(() => window.__ct.yaw());
};

for (const C of CASES) {
  console.log(`\n═══ ${C.label} ═══`);
  const i = await p.evaluate((l) => window.__ct.seats().findIndex((s) => s.label === l), C.label);
  if (i < 0) { fail(`no seat labelled "${C.label}" — REFUSING TO REPORT on it`); continue; }
  const seat = (await p.evaluate(() => window.__ct.seats()))[i];
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
  await p.evaluate(([x, z, yaw, g]) => window.__ct.warp(x, z, yaw, g, 0), [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
  await p.waitForTimeout(600);

  // ── 1. SIT STILL OPENS IT. The regression half — his words, not the row's. ──
  // BY IDENTITY: `__ct.sit` passes the caller's object to `rig.sit`, so a fresh
  // literal is not the registered pose and neither machine would recognise it.
  await p.evaluate((k) => window.__ct.sit(window.__ct.seats()[k].pose), i);
  await p.waitForTimeout(600);
  const onSit = await panelNow();
  if (onSit !== C.panel) fail(`sitting down no longer opens ${C.panel} (got ${JSON.stringify(onSit)})`);
  else ok(`sitting down opens ${C.panel}`);

  // ── 2. …and it is ON THE MACHINE, not a screen-space cabinet. ──
  const onMesh = await p.evaluate(([st, g]) => !!window[st]?.[g]?.(), [C.station, C.mesh]);
  if (!onMesh) fail(`${C.panel} opened, but not on the machine's own face`);
  else ok('the picture is on the machine');

  // ── 3. dismiss, and STAY IN THE CHAIR. This is the state the spot exists ──
  //     for, and nothing in the UI reaches it today: crosstown.ts:1440 stands
  //     you up on every diegetic close, so the frame hook clears the latch a
  //     frame later. `dismissHere()` + `sit()` in ONE evaluate is the whole
  //     trick — no frame runs between them, so the latch survives.
  const reached = await p.evaluate(([st, k]) => {
    const s = window[st];
    if (!s?.dismissHere) return 'no dismissHere affordance';
    s.dismissHere();
    window.__ct.sit(window.__ct.seats()[k].pose);
    return null;
  }, [C.station, i]);
  if (reached) { fail(reached); continue; }
  await p.waitForTimeout(500);
  if (!(await seatedNow())) { fail('could not get back on the seat to test the dismissed state'); continue; }
  if (await panelNow()) { fail('the panel came back on its own; the dismissed state is not reachable'); continue; }
  ok('dismissed, and still in the chair');

  // ── 4. AIMED AT THE MACHINE: the world offers it, and the exit stays named. ──
  const spot = await p.evaluate((rx) => {
    const re = new RegExp(rx, 'i');
    return window.__ct.spots().find((s) => re.test(s.label)) ?? null;
  }, C.offer.source);
  if (!spot) { fail(`no spot matching ${C.offer} is registered — nothing to aim at`); continue; }
  const d = Math.hypot(spot.x - seat.pose.x, spot.z - seat.pose.z);
  console.log(`      spot (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) r ${spot.r.toFixed(3)}  d ${d.toFixed(3)} m  seated bound r+0.6 = ${(spot.r + 0.6).toFixed(3)}`);
  if (d >= spot.r + 0.6) fail(`the spot is out of seated reach: ${d.toFixed(3)} >= ${(spot.r + 0.6).toFixed(3)}`);

  const yawTo = Math.atan2(spot.x - seat.pose.x, -(spot.z - seat.pose.z));
  await turnTo(yawTo);
  if (!(await seatedNow())) fail('turning the head stood the player up');
  const aimed = await promptNow();
  if (!C.offer.test(aimed ?? '')) fail(`aimed at the machine, [E] should name it; got ${JSON.stringify(aimed)}`);
  else ok(`aimed -> ${JSON.stringify(aimed)}`);
  // BUILDER-BRIEF §11: the way out may never leave the screen.
  if (!/\[ESC\]/.test(aimed ?? '') || !/stand up/i.test(aimed ?? '')) {
    fail('the way out left the screen while the machine took [E]');
  } else ok('the exit is still named, under [ESC]');

  // ── 5. THE NEGATIVE CASE. Look away and the offer must GO. A spot that ──
  //     always won would sail through every leg above and die here.
  await turnTo(yawTo + Math.PI);
  const away = await promptNow();
  if (C.offer.test(away ?? '')) fail(`head turned 180 degrees away and the machine is STILL offered: ${JSON.stringify(away)}`);
  else if (!/stand up/i.test(away ?? '')) fail(`head turned away, the exit should be back on [E]; got ${JSON.stringify(away)}`);
  else ok(`looked away -> ${JSON.stringify(away)}  (aim decides, not proximity)`);

  // ── 6. [E] on the machine opens it, from the chair. ──
  await turnTo(yawTo);
  await p.screenshot({ path: `shots/w74-${C.panel}-1-offered.png` });
  await tap('e');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/w74-${C.panel}-2-open.png` });
  const after = await p.evaluate(([st, g]) => ({
    panel: window.__hud?.panel?.() ?? null,
    onMesh: !!window[st]?.[g]?.(),
    fov: window.__ct.camera ? +window.__ct.camera().fov.toFixed(1) : null,
    camY: window.__ct.camera ? +window.__ct.camera().position.y.toFixed(3) : null,
  }), [C.station, C.mesh]);
  console.log(`      after [E]: ${JSON.stringify(after)}`);
  if (after.panel !== C.panel) fail(`[E] on the machine did not open ${C.panel}`);
  else if (!after.onMesh) fail('[E] opened it as a screen-space panel, not on the machine');
  else ok(`[E] from the chair opens it on the machine, fov ${after.fov}, eye ${after.camY}`);

  // ── 7. ONE Escape gets out. §11 — a second press is a workaround. ──
  await tap('Escape');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/w74-${C.panel}-3-out.png` });
  const out = await p.evaluate(() => ({ panel: window.__hud?.panel?.() ?? null, seated: !!window.__ct.seated() }));
  console.log(`      after ESC: ${JSON.stringify(out)}`);
  if (out.panel) fail('one ESC did not close the machine');
  else if (out.seated) fail('ESC closed the machine but left the player in the chair with no way out on screen');
  else ok('one ESC closes the machine and gives the feet back');

  exercised++;
  await p.evaluate(() => { window.__hud?.closePanels?.(); window.__ct.stand(); });
  await p.waitForTimeout(300);
}

// POPULATION FLOOR — a run that measured no machine is a FAILED run, not a
// clean one. GOTCHAS 79: a check that examines nothing reports green.
console.log(`\nmachines exercised: ${exercised} of ${CASES.length}`);
if (exercised < CASES.length) fail(`only ${exercised} of ${CASES.length} machines were exercised — this run proves nothing about the rest`);

if (errs.length) { console.log(`\nconsole errors: ${errs.length}`); console.log(errs.slice(0, 8).join('\n')); }
console.log(bad ? `\n${bad} FAILED` : '\nall clear');
await b.close();
process.exit(bad ? 1 : 0);

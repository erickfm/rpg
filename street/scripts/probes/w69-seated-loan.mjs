// THE USER'S OWN CASE: *"you sit and its the loan process as an integrated
// overlay."*
//
// Item 188. Sit in First Federal's client chair, look at the application form
// on the desk, and press [E]. Before this the only thing a seated player could
// ever be offered was standing back up — `ct/int-bank.ts:1414` wrote that limit
// down after walking into it.
//
// Every coordinate comes from the WORLD (`__ct.seats()`, `__ct.spots()`), not
// from this file. BUILDER-BRIEF §8: the room owns those numbers and a second
// copy of them here is how `bedcavity.mjs` spent a week measuring a truck that
// had been deleted.
//
// FIVE THINGS, in the order they can fail:
//
//   sits      — you can take the chair
//   ahead     — head straight, [E] still offers standing up. The seat is NOT a
//               menu you are trapped in front of; this is the regression half.
//   aimed     — turn to the form and [E] names the form, with the exit still on
//               screen under [ESC]  (BUILDER-BRIEF §11: it may never go away)
//   fires     — pressing [E] actually opens it
//   leaves    — ESC gets out, from inside the panel, every time
//
//   SHOT_URL=http://localhost:4250/ node scripts/probes/w69-seated-loan.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4250/');
const SEAT = 'sit in the client chair';
const FORM = /loan application/;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const ok = (m) => console.log(`ok    ${m}`);
const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
// A HELD keypress. `press('e')` can begin and end inside one animation frame and
// the [E] dispatch is an edge read once per RENDERED frame, so the tap is never
// observed — BUILDER-BRIEF §5, three false failures.
const tap = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(90); await p.keyboard.up(k); await p.waitForTimeout(260); };

const seat = (await p.evaluate(() => window.__ct.seats())).find((s) => s.label === SEAT);
if (!seat) { console.log(`REFUSING TO REPORT: no seat labelled "${SEAT}"`); await b.close(); process.exit(3); }

// Stand the player in the room first, so the interior's own `ok()` and the
// storey-aware sight lines are answering about the room they are in.
const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [seat.at.x, seat.at.z]);
await p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [seat.at.x, seat.at.z, seat.pose.yaw, gy]);
await p.waitForTimeout(700);

const form = (await p.evaluate(() => window.__ct.spots())).find((s) => FORM.test(s.label));
if (!form) { console.log('REFUSING TO REPORT: the loan application spot is not registered'); await b.close(); process.exit(3); }
const d = Math.hypot(form.x - seat.pose.x, form.z - seat.pose.z);
console.log(`chair (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)}) yaw ${seat.pose.yaw.toFixed(2)}`);
console.log(`form  (${form.x.toFixed(2)}, ${form.z.toFixed(2)}) r ${form.r}  ->  ${d.toFixed(3)} m, bound r+0.6 = ${(form.r + 0.6).toFixed(2)}\n`);

// ── sits ───────────────────────────────────────────────────────────────────
await p.evaluate(([x, z, yaw, h]) => window.__ct.sit({ x, z, yaw, h }),
  [seat.pose.x, seat.pose.z, seat.pose.yaw, seat.pose.h]);
await p.waitForTimeout(200);
if (!(await p.evaluate(() => window.__ct.seated()))) { fail('could not take the client chair'); }
else ok('sits in the client chair');

// ── ahead: the seat is not a menu ──────────────────────────────────────────
const ahead = await promptNow();
if (!/stand up|get up/i.test(ahead ?? '')) fail(`head straight, the prompt should still offer the way out; got ${JSON.stringify(ahead)}`);
else if (/\[ESC\]/.test(ahead ?? '')) fail(`head straight, nothing should be on offer but [E] was spent: ${JSON.stringify(ahead)}`);
else ok(`head straight -> ${JSON.stringify(ahead)}`);

// ── aimed: turn to the form ────────────────────────────────────────────────
// The heading is DERIVED from the two published points, not typed: rig
// convention is fwd = (sin yaw, -cos yaw), so yaw = atan2(dx, -dz).
const yawToForm = Math.atan2(form.x - seat.pose.x, -(form.z - seat.pose.z));
await p.evaluate(([y]) => { window.__ct.setYaw?.(y); }, [yawToForm]);
let turned = await p.evaluate(() => window.__ct.yaw());
if (Math.abs(((turned - yawToForm + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.02) {
  // No published setter — turn the head with the world's own arrow keys, which
  // is what a player has. Deliberately not a warp: warping re-seats the feet.
  const step = ((yawToForm - turned + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const key = step > 0 ? 'ArrowRight' : 'ArrowLeft';
  for (let i = 0; i < 400 && Math.abs(((await p.evaluate(() => window.__ct.yaw())) - yawToForm + Math.PI * 3) % (Math.PI * 2) - Math.PI) > 0.03; i++) {
    await p.keyboard.down(key); await p.waitForTimeout(20); await p.keyboard.up(key);
  }
  turned = await p.evaluate(() => window.__ct.yaw());
}
console.log(`turned to ${turned.toFixed(3)} rad (wanted ${yawToForm.toFixed(3)})`);
if (!(await p.evaluate(() => window.__ct.seated()))) fail('turning the head stood the player up');

const aimed = await promptNow();
if (!FORM.test(aimed ?? '')) fail(`aimed at the form, [E] should name it; got ${JSON.stringify(aimed)}`);
else ok(`aimed at the form -> ${JSON.stringify(aimed)}`);
if (!/\[ESC\]/.test(aimed ?? '') || !/stand up|get up/i.test(aimed ?? '')) {
  fail('BUILDER-BRIEF §11: the way out left the screen while something else took [E]');
} else ok('the exit is still named, under [ESC]');

// ── fires ──────────────────────────────────────────────────────────────────
await p.screenshot({ path: 'shots/w69-loan-1-seated.png' });
await tap('e');
await p.waitForTimeout(900);                        // the 0.40 s fly-in, plus slack
await p.screenshot({ path: 'shots/w69-loan-2-open.png' });
// `#ct-loan` is the panel's own element and a DIEGETIC one hides its canvas and
// keeps only the caption — the same reading `scripts/probes/w66-loan-look.mjs`
// takes, so the two agree about what "open" means.
const opened = await p.evaluate(() => {
  const el = document.querySelector('#ct-loan');
  const cam = window.__ct.camera?.();
  return {
    inDom: !!el,
    canvasHidden: el ? getComputedStyle(el.querySelector('canvas') ?? el).display === 'none' : null,
    fov: cam ? +cam.fov.toFixed(1) : null,
    camY: cam ? +cam.position.y.toFixed(3) : null,
    seated: !!window.__ct.seated(),
  };
});
console.log(`after [E]: ${JSON.stringify(opened)}`);
if (!opened.inDom) fail('pressing [E] on the form did not open it');
else if (!opened.canvasHidden) fail('the form opened as a SCREEN-SPACE panel, not on the paper');
else ok(`the form opened on the paper, seated, fov ${opened.fov}, eye ${opened.camY}`);

// ── leaves ─────────────────────────────────────────────────────────────────
// ONE press, from inside the panel. BUILDER-BRIEF §11 — a second press would be
// a workaround and a player will not know to make it.
await tap('Escape');
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/w69-loan-3-after-escape.png' });
// A CLOSED PANEL IS STILL IN THE DOM — `ct/hud.ts:1133` fades `wrap.opacity` to
// 0 and puts the canvas back rather than removing the node. Asking `!!element`
// therefore reports every panel in the world as permanently open, which is how
// this probe's first run "found" a form ESC could not close.
const out = await p.evaluate(() => {
  const el = document.querySelector('#ct-loan');
  return {
    seated: !!window.__ct.seated(),
    panel: el ? +getComputedStyle(el).opacity > 0.01 : false,
    prompt: (document.getElementById('ct-prompt')?.textContent ?? '').trim(),
  };
});
console.log(`after ESC: ${JSON.stringify(out)}`);
if (out.panel) fail('ESC left the form open');
if (out.seated) fail('ESC did not get the player out of the chair');
if (!out.panel && !out.seated) ok('one ESC closes the form AND leaves the chair');

if (errs.length) { console.log(`\nconsole errors: ${errs.length}`); console.log(errs.slice(0, 6).join('\n')); }
console.log(bad ? `\n${bad} FAILED` : '\nall clear');
await b.close();
process.exit(bad ? 1 : 0);

// THE CLAIM: FIRST FEDERAL is a machine you can actually use — card, PIN, menu,
// balance, notes out, cash into the SAME purse the bodega spends from — and it
// never takes anything without giving it back.
//
// The money is the point, so the money is what is asserted: the account falls by
// exactly what you asked for, the cash rises by exactly what you took, and the
// two together are conserved.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-atm-walk.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4292/';
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };
const st = () => page.evaluate(() => ({
  screen: window.__atm.screen(), account: window.__atm.account(),
  cash: window.__atm.cash(), pending: window.__atm.pending(),
  panel: window.__hud.panel(),
}));
// press, then WAIT FOR THE SCREEN TO CHANGE rather than sleeping on it. The
// machine's own steps are on timers (it counts notes for a beat, because a real
// one does) and a fixed sleep under load is GOTCHAS §30.
const press = async (k, want) => {
  await page.keyboard.press(k);
  if (want) await page.waitForFunction((w) => window.__atm.screen() === w, want, { timeout: 8000 }).catch(() => {});
  else await page.waitForTimeout(90);
};

if (!(await page.evaluate(() => typeof window.__atm === 'object' && window.__atm !== null))) {
  console.log('__atm absent — ct/atm.ts did not run in this build; nothing measured');
  await browser.close(); process.exit(3);
}

// ── it opens, and it is a panel ──────────────────────────────────────────
await page.evaluate(() => window.__atm.open());
await page.waitForTimeout(200);
let s = await st();
ok(s.panel === 'ct-atm', `the cabinet is up (${s.panel})`);
ok(s.screen === 'idle', 'and it starts at the card prompt');
const opening = s.account;
const pocketBefore = s.cash;
ok(typeof opening === 'number' && opening > 0, `there is an account behind it (${opening})`);

// ── the world is frozen while it is up ───────────────────────────────────
//
// The framework promises this to every panel, so it is checked HERE rather than
// taken on trust — and with a control, because "did not move" is an absence.
const before = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
await page.keyboard.down('w');
await page.waitForTimeout(900);
await page.keyboard.up('w');
const movedUp = await page.evaluate(([x, z]) => {
  const q = window.__ct.pos(); return Math.hypot(q[0] - x, q[2] - z);
}, before);
ok(movedUp < 0.05, `the world is frozen behind it (${movedUp.toFixed(3)} m on a held W)`);

// ── card, PIN, menu ──────────────────────────────────────────────────────
await press('1', 'pin');
ok((await st()).screen === 'pin', 'button 1 takes the card and asks for a PIN');
for (const d of ['4', '9', '0', '2']) await press(d);
await press('Enter', 'menu');
ok((await st()).screen === 'menu', 'four digits and ENTER reach the menu');
// …and the digits went to the MACHINE and not to main.ts's prototype switcher,
// which is the whole reason a PIN pad is possible. If they had escaped, the
// world would have reloaded and the panel would be gone.
ok((await st()).panel === 'ct-atm', 'the digits went to the machine, not to the world behind it');

// ── balance ──────────────────────────────────────────────────────────────
await press('1', 'balance');
ok((await st()).screen === 'balance', 'BALANCE shows the balance');
await press('5', 'menu');

// ── withdraw, and the money is CONSERVED ─────────────────────────────────
await press('2', 'withdraw');
ok((await st()).screen === 'withdraw', 'WITHDRAW offers the notes');
await press('2');                                   // $40
await page.waitForFunction(() => window.__atm.screen() === 'cash', null, { timeout: 8000 }).catch(() => {});
s = await st();
ok(s.screen === 'cash', 'it counts the notes and says they are ready');
ok(s.account === opening - 40, `the account fell by exactly $40 (${opening} -> ${s.account})`);
ok(s.pending === 40, `$40 is in the mouth and NOT yet in your pocket (cash still ${s.cash})`);
ok(s.cash === pocketBefore, 'money you have not taken yet is not money you have');

if (SELFTEST) {
  // THE MUTATION: jam the dispenser. The account has already been debited and
  // the notes now vanish — an account charged for cash that never arrives,
  // which is the one failure of a cash machine that actually matters. Every
  // screen still behaves perfectly; only the conservation verdict can see it.
  await page.evaluate(() => window.__atm.jam());
  console.log('      --selftest: dispenser jammed — the notes are gone, the debit is not');
}

await press('1', 'receipt');
s = await st();
ok(s.cash === pocketBefore + 40, `taking it put $40 in your pocket (${pocketBefore} -> ${s.cash})`);
ok(s.account + s.cash === opening + pocketBefore,
  `nothing was created or destroyed (${s.account} + ${s.cash} = ${opening + pocketBefore})`);

// ── the receipt, which is the joke ───────────────────────────────────────
await press('1');
const paper = await page.evaluate(() => window.__atm.screen());
ok(paper === 'receipt', 'asking for a receipt keeps you on the receipt screen…');
await press('5', 'card');
ok((await st()).screen === 'card', '…and NO gives you your card back');
await press('1', 'thanks');
ok((await st()).screen === 'thanks', 'taking the card ends the session');

// ── walking away never costs you anything ────────────────────────────────
//
// A 1997 machine really would keep a card you left in it. That is a good detail
// and a bad rule: the framework promises ESC always works, so ESC must never be
// the expensive choice.
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
ok((await st()).panel === null, 'ESC closes it');
await page.evaluate(() => window.__atm.open());
await press('1', 'pin');
await page.evaluate(() => { window.__atm.open(); });      // reset
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const walked = await st();
ok(walked.pending === 0, 'walking away mid-session leaves nothing in the machine');
ok(walked.cash + walked.account === opening + pocketBefore,
  `and costs you nothing (${walked.cash} + ${walked.account})`);

// ── and it can walk again afterwards ─────────────────────────────────────
const wasAt = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
await page.keyboard.down('w');
await page.waitForTimeout(800);
await page.keyboard.up('w');
const movedAfter = await page.evaluate(([x, z]) => {
  const q = window.__ct.pos(); return Math.hypot(q[0] - x, q[2] - z);
}, wasAt);
ok(movedAfter > 0.3, `CONTROL: the freeze is lifted when it closes (${movedAfter.toFixed(2)} m)`);

// ── no card ──────────────────────────────────────────────────────────────
await page.evaluate(() => { window.__atm.setCard(false); window.__atm.open(); });
await page.waitForTimeout(200);
await page.keyboard.press('1');
await page.waitForTimeout(200);
ok((await st()).screen === 'idle', 'with no card, the machine says so and does not proceed');
await page.evaluate(() => { window.__atm.setCard(true); window.__hud.closePanels(); });

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught it' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);

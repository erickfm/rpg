// H (verifier): hermit.mjs's headline clause - "HE IS NEVER SEEN TO DISAPPEAR"
// - is a NEGATIVE that passes when badVanish stays null. It never reports how
// many visible->invisible edges it actually observed, so a run that saw NONE
// reads identically to a run that saw many and judged them all legal
// (GOTCHAS §34). This counts them.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.hermit, null, { timeout: 60000 });
const H = () => p.evaluate(() => window.__ct.scene().userData.hermit);
const force = (v) => p.evaluate((q) => window.__ct.hermit(q), v);

const edges = [];
let prev = null, polls = 0;
const watch = async (ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const q = await H(); polls++;
    if (prev && prev.visible !== q.visible)
      edges.push({ dir: prev.visible ? 'vanish' : 'appear', x: +q.x.toFixed(2), door: +q.door.toFixed(2), phase: q.phase });
    prev = q;
    await p.waitForTimeout(40);
  }
};
// drive two full out-and-back cycles, the same way hermit.mjs does
await force(null); await watch(300);
for (let i = 0; i < 2; i++) {
  await force(true);  await watch(4200);
  await force(false); await watch(4200);
}
await force(null);
const X_IN = (await H()).x;
console.log(`polls: ${polls}   transitions seen: ${edges.length}`);
const van = edges.filter((e) => e.dir === 'vanish');
console.log(`  vanish edges: ${van.length}    appear edges: ${edges.length - van.length}`);
for (const e of edges) console.log(`   ${e.dir.padEnd(7)} at x ${String(e.x).padStart(6)}  door ${String(e.door).padStart(5)}  phase ${e.phase}`);
if (!van.length) console.log('\n  NOTHING TO CHECK — the negative clause would have passed vacuously.');
else console.log(`\n  ${van.length} real vanish edge(s) observed, so the clause had something to judge.`);
await b.close();

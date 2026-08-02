// VERIFYING C's TV ROW.
//
// It names its own predicate, which is what makes it worth a verifier's time:
// "`scene.userData.tv` publishes {seg, i, left, pool}; watch two minutes and
// count distinct names."
//
// And it makes one claim that is genuinely falsifiable rather than a matter of
// taste — the SEQUENCE:
//
//   "39 ads shown, ALL 20 DISTINCT, first repeat at #18. That took a fix:
//    picking uniformly at random showed a repeat by the NINTH ad — the
//    birthday problem, not a small pool — so it deals a SHUFFLED BAG and only
//    reshuffles when the pack is empty."
//
// A shuffled bag of 20 cannot repeat before #21. "First repeat at #18" does not
// follow from the mechanism the row describes, so either the number is loose or
// the bag is not strict. Worth knowing which, because "it deals a shuffled bag"
// is the fix the row is claiming.
//
// Also checked: the non-ads are GONE (deleted, not disabled) and the bezel is
// four rails round an aperture rather than a solid front — the row's own
// account of why its first attempt rendered a blank slab.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const tv = await p.evaluate(() => {
  const t = window.__ct.scene().userData.tv;
  return t ? { keys: Object.keys(t), sample: { ...t } } : null;
});
console.log('\n── the affordance the row names ──');
if (!tv) { console.log('  scene.userData.tv is not published — the row names it as the predicate.'); await b.close(); process.exit(1); }
console.log(`  keys: ${tv.keys.join(', ')}`);
console.log(`  now:  ${JSON.stringify(tv.sample).slice(0, 160)}`);

// ── the pool: 20, and no test card, no static ────────────────────────────
const pool = await p.evaluate(() => {
  const t = window.__ct.scene().userData.tv;
  const pl = typeof t.pool === 'function' ? t.pool() : t.pool;
  return Array.isArray(pl) ? pl.map((q) => (typeof q === 'string' ? q : q?.name ?? String(q))) : pl;
});
console.log('\n── the pool ──');
console.log(`  ${Array.isArray(pool) ? pool.length : pool} entries`);
if (Array.isArray(pool)) {
  console.log('  ' + pool.join(' · '));
  const nonAd = pool.filter((n) => /test\s*card|static|snow|bars/i.test(n));
  console.log(`  non-ads still in the pool: ${nonAd.length}` +
    (nonAd.length ? `  <-- ${nonAd.join(', ')}` : '   — the row says these were DELETED, and they are not here'));
  const street = pool.filter((n) => /crosstown|sevens|federal|bodega|pawn|burger/i.test(n));
  console.log(`  advertising his own street: ${street.length} (the row claims SIX) — ${street.join(', ')}`);
}

// ── THE SEQUENCE, which is the falsifiable claim ─────────────────────────
console.log('\n── the sequence: sampling until the pool has turned over twice ──');
const seen = [];
let last = null;
const started = Date.now();
while (seen.length < 44 && Date.now() - started < 150000) {
  const cur = await p.evaluate(() => {
    const t = window.__ct.scene().userData.tv;
    const s = typeof t.seg === 'function' ? t.seg() : t.seg;
    return typeof s === 'string' ? s : (s?.name ?? JSON.stringify(s));
  });
  if (cur !== last) { seen.push(cur); last = cur; }
  await p.waitForTimeout(140);
}
// THE FIRST OBSERVED SEGMENT IS NOT A DEALT CARD. The set is already mid-
// segment when the probe connects — scene.userData.tv reads {"i":0} at load —
// so counting it as the first card of the pack manufactures a repeat. My first
// run reported "FIRST REPEAT at #6" on exactly that, which would have been a
// false fault against the row's central claim.
const dealt = seen.slice(1);
console.log(`  ${seen.length} segments observed; ${dealt.length} DEALT (the first was in progress at connect)`);
const distinct = new Set(dealt);
console.log(`  distinct: ${distinct.size}`);
let firstRepeat = -1;
const met = new Set();
for (let i = 0; i < dealt.length; i++) {
  if (met.has(dealt[i])) { firstRepeat = i + 1; break; }
  met.add(dealt[i]);
}
const N = 20;
const pack1 = dealt.slice(0, N), pack2 = dealt.slice(N);
console.log(`  pack 1 (first ${N} dealt): ${new Set(pack1).size} distinct of ${pack1.length}` +
  (new Set(pack1).size === pack1.length ? '   A STRICT BAG' : '   <-- REPEATED INSIDE A PACK'));
if (pack2.length) {
  const gap = dealt.indexOf(pack2[0]);
  console.log(`  pack 2 opens with "${pack2[0]}", which was dealt at #${gap + 1} of pack 1` +
    (gap >= 0 && N - gap <= 3 ? `  — ${N - gap + 1} showings apart across the pack boundary` : ''));
}
console.log(`  FIRST REPEAT at #${firstRepeat < 0 ? '(none in this run)' : firstRepeat}`);
console.log(`  a strict shuffled bag of ${Array.isArray(pool) ? pool.length : '?'} cannot repeat before` +
  ` #${(Array.isArray(pool) ? pool.length : 0) + 1}`);
console.log(`  the row says "first repeat at #18"`);
console.log('  dealt order: ' + dealt.slice(0, 24).join(' · '));

// ── and sit and look ─────────────────────────────────────────────────────
await p.evaluate(() => window.__ct.clock(23, 10));
await settle(p);
await p.screenshot({ path: 'shots/B-verify-C/tv-now.png' });
console.log('\n  shots/B-verify-C/tv-now.png');
await b.close();

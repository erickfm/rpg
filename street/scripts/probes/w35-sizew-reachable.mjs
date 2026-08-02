// w35 — ITEM 66, row L260 ("why does the lighting catch..."). The row is
// CONFIRMED, and the last verifier to look at it wrote "CANNOT VERIFY with the
// instruments available", naming the one thing that would settle it: publish the
// computed `sizeW` on the slot mesh's userData, the way `printed` and `payphone`
// already are.
//
// This asks whether that is still true, from OUTSIDE, rather than by grepping —
// because "not reachable" is a claim about the running world.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const r = await p.evaluate(() => {
  const s = window.__ct.scene();
  let withSizeW = 0, objs = 0;
  const keys = new Set();
  s.traverse((o) => {
    objs++;
    for (const k of Object.keys(o.userData || {})) keys.add(k);
    if (o.userData && o.userData.sizeW !== undefined) withSizeW++;
  });
  // is the pooling registry itself exposed on any published affordance?
  const api = Object.keys(window.__ct);
  return { objs, withSizeW, hasSizeWKey: keys.has('sizeW'), api };
});
console.log(`objects traversed:       ${r.objs}`);
console.log(`carrying userData.sizeW: ${r.withSizeW}`);
console.log(`'sizeW' appears as a userData key anywhere: ${r.hasSizeWKey}`);
console.log(`\n__ct affordances: ${r.api.join(', ')}`);
console.log(`\nVERDICT: the pooling weight is ${r.withSizeW ? 'READABLE' : 'STILL NOT READABLE'} from the scene.`);
if (!r.withSizeW) {
  console.log('  So scripts/wallpool.mjs can only compare the world against its OWN');
  console.log('  hand-typed copy of the smoothstep (wallpool.mjs:78-80) — the same');
  console.log('  limit its own author flagged. props.ts:786 computes it and');
  console.log('  props.ts:802 stores it on a registry internal to the module.');
}
await b.close();

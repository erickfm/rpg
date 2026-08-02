// Item 65: how much red did the OLD rule invent? Scores the same live world
// both ways in the SAME sample, so the comparison cannot be two different
// worlds — which is the trap w24 named when it said the world-wide red count
// "is not a number" (two runs of one build gave 171 and 166).
//
//   OLD: trapAgainst(c, colliders) for every c, actors included as both
//        candidate and wall — what ct/debug-collision.ts used to do
//   NEW: actors are neither scored nor allowed to form a corridor
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-overlay-before-after.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const one = () => p.evaluate(async () => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
  const cols = window.__ct.colliders();
  const actorKeys = new Set(window.__ct.actorColliders().map(key));
  const statics = cols.filter((c) => !actorKeys.has(key(c)));
  let oldRed = 0, newRed = 0, actorRedOld = 0, staticFreedByActorRemoval = 0;
  for (const c of cols) {
    const isActor = actorKeys.has(key(c));
    const o = trapAgainst(c, cols) !== null;          // the old rule
    if (o) { oldRed++; if (isActor) actorRedOld++; }
    if (isActor) continue;
    const n = trapAgainst(c, statics) !== null;        // the new rule
    if (n) newRed++;
    if (o && !n) staticFreedByActorRemoval++;
  }
  return { total: cols.length, actors: actorKeys.size, oldRed, newRed, actorRedOld, staticFreedByActorRemoval };
});

const rows = [];
for (let i = 0; i < 12; i++) { rows.push(await one()); await p.waitForTimeout(700); }
const col = (k) => rows.map((r) => r[k]);
const rng = (k) => `${Math.min(...col(k))}…${Math.max(...col(k))}`;
console.log(`colliders ${rng('total')}   actors ${rng('actors')}`);
console.log(`OLD rule red: ${rng('oldRed')}   <- varies run to run, because actors move`);
console.log(`NEW rule red: ${rng('newRed')}   <- static set only`);
console.log(`  of the old red, ACTORS themselves: ${rng('actorRedOld')}`);
console.log(`  static boxes that were red ONLY because an actor stood by them: ${rng('staticFreedByActorRemoval')}`);
await b.close();

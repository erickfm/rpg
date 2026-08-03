// w100 / item 84 — DID THE PARKED CARS LEAVE, OR DID THE CHECK'S IDEA OF A CAR?
//
// scripts/side-walk.mjs asserts "3 parked cars, all on the road at y=0" and
// today reports "0 found". That is either a real world defect or the classic
// failure in this codebase: a constant that was right stopped being right
// because something else moved. This asks which, WITHOUT assuming either.
//
// side-walk identifies a car as:
//     o.type === 'Group' && o.userData.steer !== undefined && o.visible
// inside the box x 8..60, z -112..-95. So the census is repeated four ways —
// relaxing one clause at a time — and whichever clause is doing the excluding
// is the answer.
//
// Also samples over time: side-walk takes this census "BEFORE any traffic is
// spawned", so if parked cars now arrive late, the check is racing them.
//
// Usage: SHOT_URL=http://localhost:4562/ node scripts/probes/w100-sidestreet-cars.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4177/');
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const census = () => p.evaluate(() => {
  const BOX = (o) => !(o.position.x < 8 || o.position.x > 60 || o.position.z > -95 || o.position.z < -112);
  const r = { exact: 0, noVisible: 0, noGroup: 0, noBox: 0, steerAnywhere: 0, samples: [] };
  window.__ct.scene().traverse((o) => {
    const hasSteer = o.userData && o.userData.steer !== undefined;
    if (hasSteer) r.steerAnywhere++;
    if (hasSteer && BOX(o)) {
      r.noGroup++;
      if (o.type === 'Group') {
        r.noVisible++;
        if (o.visible) r.exact++;
      }
      if (r.samples.length < 8) {
        r.samples.push({ type: o.type, vis: o.visible, name: o.name || '',
          y: +o.position.y.toFixed(3), x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2),
          steer: typeof o.userData.steer,
          // the ANCESTRY of the invisibility matters: a Group whose own
          // `visible` is true but whose parent's is false is culled by a
          // REGION, not by itself.
          selfVis: o.visible,
          parentVis: o.parent ? o.parent.visible : null,
          parentName: o.parent ? (o.parent.name || o.parent.type) : '' });
      }
    }
    if (hasSteer && !BOX(o)) r.noBox++;
  });
  return r;
});

// WHAT ELSE IS IN THAT BOX THAT LOOKS LIKE A CAR? If nothing carries `steer`
// there any more, the parked cars may still be present under a different mark.
const carish = await p.evaluate(() => {
  const BOX = (o) => !(o.position.x < 8 || o.position.x > 60 || o.position.z > -95 || o.position.z < -112);
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.type !== 'Group' || !BOX(o)) return;
    const keys = Object.keys(o.userData || {});
    if (!keys.length) return;
    out.push({ name: o.name || '(unnamed)', keys: keys.join(','), vis: o.visible,
      x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(2),
      kids: o.children.length });
  });
  return out;
});

console.log('\nGroups with any userData inside side-walk\'s census box:');
if (!carish.length) console.log('  (none)');
for (const c of carish.slice(0, 20)) {
  console.log(`  ${c.name.padEnd(18)} userData[${c.keys}]`.padEnd(62)
    + ` vis=${c.vis ? 'Y' : '.'} kids=${String(c.kids).padStart(3)} @ ${c.x}, ${c.y}, ${c.z}`);
}

console.log('\ncensus over time (side-walk takes its one sample right after load):');
console.log('   t(s)  exact  +invisible  +non-Group  steer-anywhere-in-world');
let clock = 0;
for (const t of [0, 2, 5, 10, 20]) {
  if (t > clock) { await p.waitForTimeout((t - clock) * 1000); clock = t; }
  const r = await census();
  console.log(`  ${String(t).padStart(5)}  ${String(r.exact).padStart(5)}  ${String(r.noVisible).padStart(10)}`
    + `  ${String(r.noGroup).padStart(10)}  ${String(r.steerAnywhere).padStart(23)}`);
  if (t === 20 && r.samples.length) {
    console.log('\n  what carries `steer` in the box:');
    for (const s of r.samples) {
      console.log(`    ${s.type.padEnd(8)} self.visible=${s.selfVis ? 'Y' : '.'}`
        + ` parent(${s.parentName}).visible=${s.parentVis === null ? '-' : s.parentVis ? 'Y' : '.'}`
        + ` y=${String(s.y).padStart(7)} @ ${s.x}, ${s.z}  typeof steer=${s.steer}`);
    }
  }
}

// ── THE DECISIVE TEST: does standing on the side street bring them back? ──
//
// If `visible` is false because a REGION is culled while the player is
// elsewhere, then warping onto the side street must flip it — and side-walk's
// census, which it takes right after load and before it warps anywhere, is
// simply racing that. If it stays false, the cars are hidden for some other
// reason and this hypothesis is wrong.
//
// SELF-TEST BOTH SIGNS: the census is taken at the player's SPAWN first (which
// is the state side-walk measures in), then on the side street. Two readings,
// and the claim is only supported if they DIFFER in the predicted direction.
console.log('\n── decisive test: warp onto the side street and re-census ──');
const before = await census();
console.log(`  at spawn (where side-walk censuses):  exact=${before.exact}`
  + `  ignoring .visible=${before.noGroup}`);
await p.evaluate(() => window.__ct.warp(30, -96.8, Math.PI / 2, 0.14, 0));
await p.waitForTimeout(1500);
const after = await census();
console.log(`  standing on the side street:          exact=${after.exact}`
  + `  ignoring .visible=${after.noGroup}`);
console.log(after.exact > before.exact
  ? `\n  VERDICT: the cars are CULLED WHILE THE PLAYER IS ELSEWHERE.`
    + ` side-walk's census runs before it warps, so its \`o.visible\` term is racing the cull.`
  : `\n  VERDICT: warping did NOT change the count (${before.exact} -> ${after.exact}).`
    + ` The culling hypothesis is NOT supported — look elsewhere.`);

await b.close();

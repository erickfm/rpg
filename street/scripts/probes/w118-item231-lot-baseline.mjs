// Item 231 — what does the used-car lot ACTUALLY have for colliders right now?
//
// The row and notes/w81-item202c-car-colliders.md both describe `ct/lot.ts:1986`
// as "all 11 lot cars share ONE untagged 4 x 2.8 m full-height box". Those
// numbers are from an earlier session and BUILDER-BRIEF §6b says re-measure
// before acting. This reads it out of the running world instead.
//
// For each lot car it reports: kind, world centre, yaw, the drawn body's true
// local extents, and every collider whose footprint contains the car's centre.
//
// Usage: SHOT_URL=http://localhost:4740/ node scripts/probes/w118-item231-lot-baseline.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('  NOT AIMED — pass SHOT_URL=http://localhost:<your port>/'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(400);

// THE PLAYER SPAWNS IN APARTMENT 301 AT x=198.4, PAST regionCull's x>=100 —
// so warp to the lot BEFORE reading anything (GOTCHAS 79b). This probe reads
// authoring facts, not `visible`, but the warp also makes the walk below real.
const info = await page.evaluate(async () => {
  const THREEBox = window.__ct.scene();
  const cars = [];
  THREEBox.traverse((o) => {
    if (o.userData?.carKind === undefined) return;
    const p = new (o.position.constructor)();
    o.getWorldPosition(p);
    // ⚠ THE TRAFFIC POOL PARKS AT THE IDLE_XZ = 999 SENTINEL, and w81's note
    // records that filtering it by `>= 900` instead catches the interiors belt
    // out past x 600. Exclude the SENTINEL ITSELF, nothing else — my first cut
    // filtered `x < 60` and found ONLY the pool, five cars at (999, 999),
    // while missing all 11 lot cars and the whole street fleet.
    if (Math.abs(p.x - 999) < 1 && Math.abs(p.z - 999) < 1) return;
    // world yaw, accumulated through the parents the lot wraps cars in
    let yaw = 0;
    for (let n = o; n; n = n.parent) yaw += n.rotation?.y ?? 0;
    cars.push({ kind: o.userData.carKind, x: +p.x.toFixed(3), z: +p.z.toFixed(3), yaw: +yaw.toFixed(4) });
  });
  const cols = window.__ct.colliders().map((c) => ({
    tag: c.tag ?? null,
    minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ,
    maxY: c.maxY ?? null, rot: c.rot ?? null,
  }));
  return { cars, cols };
});

console.log(`  lot cars found: ${info.cars.length}`);
const kinds = {};
for (const c of info.cars) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
console.log(`  by kind: ${Object.entries(kinds).map(([k, n]) => `${k} x${n}`).join(', ')}`);

console.log(`\n  car                       yaw°     collider(s) containing its centre`);
const sigs = new Set();
for (const c of info.cars) {
  const mine = info.cols.filter((b) => c.x >= b.minX && c.x <= b.maxX && c.z >= b.minZ && c.z <= b.maxZ);
  const desc = mine.map((b) => `${(b.maxX - b.minX).toFixed(2)}x${(b.maxZ - b.minZ).toFixed(2)}`
    + ` maxY=${b.maxY ?? 'NONE(full height)'} rot=${b.rot ?? 'none'} tag=${b.tag ?? 'UNTAGGED'}`);
  for (const d of desc) sigs.add(`${c.kind}: ${d}`);
  console.log(`  ${c.kind.padEnd(7)} (${c.x.toFixed(1)}, ${c.z.toFixed(1)})  ${(c.yaw * 180 / Math.PI).toFixed(1).padStart(7)}  ${desc.join(' | ') || 'NONE'}`);
}

console.log(`\n  distinct (kind, collider) signatures: ${sigs.size}`);
for (const s of [...sigs].sort()) console.log(`    ${s}`);

// What the kind's OWN spec says it should be, for comparison.
const specs = await page.evaluate(() => {
  const out = {};
  for (const k of ['sedan', 'hatch', 'pickup', 'van']) {
    out[k] = window.__ct.carSpec(k).map((t) => ({
      tag: t.tag, long: +(t.maxZ - t.minZ).toFixed(3), short: +(t.maxX - t.minX).toFixed(3),
      maxY: t.maxY ?? null,
    }));
  }
  return out;
});
console.log(`\n  what each kind's declared spec is (carColliderSpec):`);
for (const [k, tiers] of Object.entries(specs)) {
  console.log(`    ${k.padEnd(7)} ${tiers.map((t) => `${t.tag} ${t.short}x${t.long} maxY=${t.maxY ?? 'NONE'}`).join('; ')}`);
}

await browser.close();

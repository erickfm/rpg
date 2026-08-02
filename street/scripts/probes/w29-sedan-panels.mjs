// WHICH CHILD OF A SEDAN IS THE HOOD, WHICH IS THE BOOT LID, WHICH IS THE ROOF.
//
// Item 54's tiers have to be seamed at the panels' OWN edges, and the sedan's
// cabin numbers (roof 1.46, screen foot -1.0, roof plate -0.35..0.9) are
// LOCALS inside makeCar's sedan branch (ct/cars.ts:857) — not exported the way
// PICKUP_CAB is, and ct/cars.ts is held by another builder (queue item 46), so
// hoisting them is not available to me.
//
// Copying them with a citation is the sanctioned fallback (BUILDER-BRIEF §8),
// but reading them off the DRAWN MESH is strictly better: it cannot drift from
// the panel it describes even if someone retunes the loft, and it needs no
// second copy of anything. This probe checks that the classification is
// unambiguous before crosstown.ts relies on it.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-sedan-panels.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

for (const kind of ['sedan', 'hatch', 'van', 'pickup']) {
  const out = await p.evaluate((k) => {
    const THREE = window.__THREE ?? null;
    const g = window.__ct.carVariant(k, {}, 400, 400, 0);   // far away, off the street
    const rows = [];
    for (const c of g.children) {
      c.updateMatrixWorld(true);
      const geo = c.geometry;
      if (!geo) continue;
      geo.computeBoundingBox();
      const bb = geo.boundingBox.clone();
      // into the CAR's local frame (the group sits at 400,0,400 with ry 0)
      bb.applyMatrix4(c.matrix);
      rows.push({
        type: geo.type,
        params: geo.parameters ? Object.keys(geo.parameters).length : 0,
        minY: +bb.min.y.toFixed(4), maxY: +bb.max.y.toFixed(4),
        minZ: +bb.min.z.toFixed(4), maxZ: +bb.max.z.toFixed(4),
        minX: +bb.min.x.toFixed(4), maxX: +bb.max.x.toFixed(4),
      });
    }
    g.parent.remove(g);
    return { rows, belt: g.userData.belt, hoodTop: g.userData.hoodTop };
  }, kind);

  console.log(`\n=== ${kind} ===  belt=${out.belt} hoodTop=${out.hoodTop}`);
  // the panels that SIT ON the beltline: a flat lid, not the body and not glass
  const onBelt = out.rows.filter((r) => r.maxY > out.belt + 0.02 && r.maxY < out.belt + 0.20);
  for (const r of out.rows) {
    const tag = onBelt.includes(r) ? '  <-- lid on the belt' : '';
    console.log(`  ${r.type.padEnd(16)} y ${String(r.minY).padStart(7)}..${String(r.maxY).padStart(6)}` +
      `  z ${String(r.minZ).padStart(7)}..${String(r.maxZ).padStart(7)}` +
      `  x ${String(r.minX).padStart(6)}..${String(r.maxX).padStart(6)}${tag}`);
  }
  console.log(`  lids on the belt: ${onBelt.length}` +
    (onBelt.length ? `  (front z ${Math.min(...onBelt.map((r) => r.minZ)).toFixed(2)})` : ''));
  const tallest = out.rows.reduce((a, b) => (b.maxY > a.maxY ? b : a));
  console.log(`  tallest child (the cabin): ${tallest.type} top ${tallest.maxY}  z ${tallest.minZ}..${tallest.maxZ}`);
}

await browser.close();

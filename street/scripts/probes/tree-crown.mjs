// Can you read a window through a tree again?
//
// The user, with a frame: tree canopies had alpha-0 holes you could see a
// building through. The cause was treeSprite's ragged-edge pass biting notches
// from 0.94 of the radius OUTWARD, which ate into the crown interior instead of
// only roughening the silhouette. Fixed by constraining the notches to the rim.
//
// Nothing would notice if it came back. e90c6736's audit is right that
// appearance is where the user's requests live and where the suite is thinnest —
// but this one has a machine signature, because the defect is a HOLE and a hole
// is countable. The ask ("a ragged, natural silhouette") is a judgement; the
// regression ("you can see through the middle of it") is not.
//
// The crown is an ellipse with known bounds: centre (W/2, 20 + rand(5)), radii
// RX 23-30, RY 16-22 (ct/tex-world.ts, treeSprite). So x within +/-8 of centre
// and y in 22..30 is well inside ANY crown the generator can produce — no
// per-sprite guessing, and no threshold carried over from a different metric.
//
// Measured across all 8 canopies today: 0.0% holes in that box. Fails above 2%.
//
//   node scripts/tree-crown.mjs
//   node scripts/tree-crown.mjs --selftest
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

const rows = await p.evaluate(([selftest]) => {
  const s = window.__ct.scene(); const seen = new Set(); const out = [];
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m?.map?.userData?.surface !== 'foliage' || seen.has(m.map.uuid)) continue;
      seen.add(m.map.uuid);
      const im = m.map.image;
      if (!im?.width || im.width < 40) continue;          // ivy and small foliage are not crowns
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      if (selftest && out.length === 0) {                 // bite a hole in one crown
        g.clearRect(Math.round(im.width / 2) - 5, 24, 10, 5);
      }
      const d = g.getImageData(0, 0, im.width, im.height).data;
      const cx = Math.round(im.width / 2);
      let hole = 0, tot = 0;
      for (let y = 22; y <= 30; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        if (x < 0 || x >= im.width || y >= im.height) continue;
        tot++;
        if (d[(y * im.width + x) * 4 + 3] < 128) hole++;
      }
      if (tot) out.push({ size: `${im.width}x${im.height}`, pct: +(100 * hole / tot).toFixed(1) });
    }
  });
  return out;
}, [SELFTEST]);
await b.close();

if (!rows.length) { console.error('no tree canopies found — this check is inert, fix it'); process.exit(2); }
const bad = rows.filter((r) => r.pct > 2);
console.log(`${rows.length} canopies, crown-interior holes: ${rows.map((r) => r.pct + '%').join(' ')}`);
if (SELFTEST) {
  if (bad.length) { console.log('SELFTEST PASSED — a hole bitten in a crown was caught'); process.exit(0); }
  console.error('SELFTEST FAILED — a crown was punctured and this did not notice.');
  process.exit(2);
}
if (!bad.length) { console.log('  every crown is solid where it should be — no window readable through a tree'); process.exit(0); }
console.error(`  ${bad.length} canopy/canopies have holes in the crown interior — the user reported`);
console.error('  reading a building through one. See treeSprite in ct/tex-world.ts: the ragged');
console.error('  edge pass must bite INWARD FROM THE RIM ONLY.');
process.exit(1);

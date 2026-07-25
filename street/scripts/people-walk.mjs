// Is every person drawn from the 8-angle atlas?
//
// The user: "the people inside these places are always flat and not like the
// people on the street." Every interior figure traced back to the diner's
// waitress — she was the reference room's, so each new room copied her, and
// she was one hand-painted front view on a plane. This asserts the whole class
// is gone rather than checking the four I happened to remember.
//
// An atlas figure is recognisable without naming it: its texture is tiled 5x2
// (five views, walk and idle rows), so repeat.x is +/-0.2. A hand-drawn cutout
// is a person-shaped alphaTest plane with an untiled map.
//
// IT USED TO BE INDOORS-ONLY — `if (w.x < 400) return`. That was right for the
// complaint it was written from, which was about interiors, but the rule in
// GOTCHAS §21 is not indoor-only and neither is the failure: a figure standing
// outside is exactly as flat, and there was nothing asserting it. Same gap
// `floaters-walk` had. It now sweeps the WHOLE world by default and takes an
// optional box to narrow it:
//
//     node scripts/people-walk.mjs            # everywhere
//     node scripts/people-walk.mjs 6 32 -12 16   # just the car lot
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const ARG = process.argv.slice(2).map(Number);
const BOX = ARG.length === 4 ? ARG : null;
const b = await chromium.launch();
const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it

const r = await p.evaluate(([BOX]) => {
  const V = window.__ct.scene().position.constructor;
  const atlas = [], suspects = [];
  window.__ct.scene().traverse((o) => {
    const m = Array.isArray(o.material) ? null : o.material;
    if (!o.isMesh || !m || !m.map || !o.geometry?.parameters) return;
    const w = new V(); o.getWorldPosition(w);
    if (BOX && (w.x < BOX[0] || w.x > BOX[1] || w.z < BOX[2] || w.z > BOX[3])) return;
    if (Math.abs(Math.abs(m.map.repeat.x) - 0.2) < 0.001) { atlas.push(+w.x.toFixed(0)); return; }
    // PERSON-shaped, which is narrower than prop-shaped. A standing figure is
    // about 1:1.8 — the waitress was 1.20 x 1.90 and the casino dealer 1.00 x
    // 1.80. Interiors are also full of standing PROPS on alphaTest planes: the
    // hotel palm is 1.15 x 1.60 and the tax office pot plant 0.95 x 1.42, both
    // squatter. The ratio is what separates them, and it is a heuristic — a
    // genuinely stout person or a very tall plant would need a human eye.
    const { width: pw, height: ph } = o.geometry.parameters;
    if (o.geometry.type !== 'PlaneGeometry' || m.alphaTest !== 0.5) return;
    if (Math.abs(o.rotation.x) > 0.01) return;
    if (pw >= 0.8 && pw <= 1.4 && ph >= 1.5 && ph <= 2.1 && ph / pw >= 1.55)
      suspects.push(`${pw.toFixed(2)}x${ph.toFixed(2)} (ratio ${(ph / pw).toFixed(2)}) @ x=${w.x.toFixed(0)}`);
  });
  return { atlas: atlas.length, suspects };
}, [BOX]);
console.log(`${r.atlas} atlas figures`);
console.log(r.suspects.length
  ? `${r.suspects.length} person-shaped hand-drawn cutouts remain:\n  ` + r.suspects.join('\n  ')
  : 'no hand-drawn people anywhere');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(r.suspects.length || errs.length ? 1 : 0);

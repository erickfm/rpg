// WHAT IS ACTUALLY AT THE SIDE STREET'S EAST END?
//
// An INVESTIGATION, not an assertion suite — named for what it looks at with an
// owner prefix, per GOTCHAS 24, so it cannot collide with anybody's check.
//
// It exists because the jail's site proposal must not be arithmetic off the
// roster comments (GOTCHAS 20: aim from the source, not from memory). Every
// number in notes/O-jail-site.md comes out of this run.
//
//   SHOT_URL=http://localhost:4297/ node scripts/O-eastend-survey.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/ (GOTCHAS 48)'); process.exit(2); }

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await p.evaluate(() => {
  const ct = window.__ct;
  const cols = ct.colliders();
  // everything solid east of x = 50, which is the closed end and its flanks
  const east = cols
    .filter((c) => c.maxX > 50)
    .map((c) => ({ minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2),
                   minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2) }))
    .sort((a, z) => a.minX - z.minX);

  // the ground across the closed end: is there pavement to walk on, and where
  // does it stop? Sample along the street centre line and along the end itself.
  const alongX = [];
  for (let x = 48; x <= 64; x += 0.5) alongX.push([x, +ct.groundAt(x, -103).toFixed(3)]);
  const alongZ = [];
  for (let z = -94; z >= -114; z -= 0.5) alongZ.push([z, +ct.groundAt(56, z).toFixed(3)]);

  // how far east can you stand before something solid stops you, on the two
  // pavements and on the centre line?
  const blockedAt = (z) => {
    for (let x = 50; x <= 66; x += 0.05) {
      if (cols.some((c) => x > c.minX - 0.36 && x < c.maxX + 0.36 && z > c.minZ - 0.36 && z < c.maxZ + 0.36))
        return +x.toFixed(2);
    }
    return null;
  };
  const walls = { northWalk: blockedAt(-97), centre: blockedAt(-103), southWalk: blockedAt(-109) };

  // the two side-street frontages, as the world has them
  const frontages = window.__frontages ?? null;
  return { east, alongX, alongZ, walls, frontages };
});

const say = (s) => console.log(s);
say('\n── SOLID EAST OF x=50 ─────────────────────────────');
for (const c of out.east) say(`  x ${c.minX}…${c.maxX}   z ${c.minZ}…${c.maxZ}`);

say('\n── GROUND ALONG THE STREET CENTRE (z = -103) ──────');
say('  ' + out.alongX.filter(([x]) => x >= 52).map(([x, y]) => `${x}:${y}`).join('  '));

say('\n── GROUND ACROSS THE CLOSED END (x = 56) ──────────');
say('  ' + out.alongZ.map(([z, y]) => `${z}:${y}`).join('  '));

say('\n── HOW FAR EAST CAN A 0.36 m CAPSULE GET ──────────');
for (const [k, v] of Object.entries(out.walls)) say(`  ${k.padEnd(10)} stopped at x = ${v}`);

say('\n── SIDE-STREET FRONTAGES ──────────────────────────');
if (out.frontages) {
  for (const [k, f] of Object.entries(out.frontages)) {
    if (f && f.axis === 'x') say(`  ${k.padEnd(16)} ${JSON.stringify(f)}`);
  }
} else say('  (no __frontages)');

await b.close();

// The alley — is it a room, or a gap between two boxes?
//
// The alley is the thing this builder is named after and it had no check at
// all. `scripts/alley.mjs` takes six screenshots, and screenshots are for
// LOOKING: two runs of identical code differ ~20% of pixels, so a shot can
// show me the alley is wrong and can never show me it is right.
//
// `9ca895b0`'s rule: guard the DEFECT, not the quality. Three defects were
// real, all three are recorded in notes/D-alley-report.md, and each assertion
// below is one of them:
//
//   1. YOU COULD SEE SKY over the rear wall. The end wall was a fixed height
//      while the buildings either side of it were not, so from inside the
//      alley the world stopped and daylight came over the top.
//
//      I TRIED TO MEASURE THIS WITH A CAMERA AND IT CANNOT BE DONE THAT WAY.
//      Stand in the alley, look up, count sky: the alley is ROOFLESS, so sky
//      overhead is correct and always present. A pixel count cannot separate
//      "sky above the rear wall, where a building should be" from "sky above
//      an open alley, which is the design". I shot it to check rather than
//      argue about it — the frame shows a wedge of sky between the two flanks
//      in both the fixed and the broken world.
//
//      So this one is RULE-BASED, and saying so matters. It compares the end
//      wall's world-space top against the tops of the two shells the alley is
//      cut between, both read from bounding boxes. That restates the
//      relationship END_H encodes rather than proving the view independently.
//      What it genuinely catches is the end wall drifting out of step with its
//      neighbours — a roster reorder, a storey added next door, the wall not
//      rebuilt — which is exactly how the defect arrived the first time.
//
//   2. THE ALLEY FLOOR WAS THREE TIMES COARSER than everything it abuts —
//      one 64x64 canvas over 6.6 x 6.5 m, 9.7 px/m, against a sidewalk at 32
//      and a road at 14-19. The arris at x = -7 announced itself.
//
//   3. THE TWO FLANKS ARE TWO BUILDINGS. They are the exposed party walls of
//      whatever sits either side of the gap, painted one at a time — warm
//      patched brick north, sooty and damp south. One shared texture is the
//      same defect the user raised twice about the bank's return.
//
// HOW IT FINDS THEM. ct/street.ts stamps `userData.alley` = 'end' | 'floor' |
// 'flank'. It does not infer from position, because inferring from position is
// exactly what made scripts/shells.mjs read this end wall as a 1.2 m building.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/alleycheck.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';
import { installMats } from './lib/materials.mjs';
import { setClock } from './lib/clock.mjs';

const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => {
  // integrationNoise() is the HMR socket in the live world and nothing else.
  if (integrationNoise(e.message)) return;
  errors.push('pageerror: ' + String(e.message));
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await installMats(page);
// setClock waits on the FRAME, not on a guess. 2558b1ba established the real
// mechanism: the jump costs one rendered frame, and a too-early read returns
// the PREVIOUS time of day in full rather than a half-applied one. My own
// 600 ms here was safe only because 13:00 is a day hour and the world boots at
// 13:20, so the previous value happened to be the right one. That is luck
// dressed as a margin.
await setClock(page, 13, 0);

const parts = await page.evaluate(() => {
  const out = { end: [], floor: [], flank: [] };
  const cv = document.createElement('canvas');
  cv.width = 24; cv.height = 24;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const pixelHash = (tex) => {
    try {
      g.clearRect(0, 0, 24, 24);
      g.drawImage(tex.image, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      let h = 0x811c9dc5;
      for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 0x01000193) >>> 0;
      return 'px' + h.toString(16);
    } catch (e) { return null; }
  };
  window.__ct.scene().traverse((o) => {
    const k = o.userData && o.userData.alley;
    if (!k) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const maps = window.__mats(o).filter((m) => m.map);
    out[k].push({
      topY: +bb.max.y.toFixed(2),
      wMeters: +(bb.max.x - bb.min.x).toFixed(2),
      zSpan: +(bb.max.z - bb.min.z).toFixed(2),
      // px/m read off the ACTUAL canvas and the ACTUAL geometry, not off the
      // constant that produced them.
      ppm: maps.length ? +(maps[0].map.image.width
        / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)).toFixed(1) : null,
      hashes: maps.map((m) => pixelHash(m.map)).filter(Boolean),
    });
  });
  return out;
});

// ── 1. the rear wall keeps up with its neighbours ─────────────────────────
//
// The two shells the alley is cut between: the west-run buildings whose z
// spans abut the alley's. Read from bounding boxes, not from the roster.
const neigh = await page.evaluate(() => {
  const box = (o) => { o.geometry.computeBoundingBox();
    return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); };
  let end = null; const west = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.alley === 'end') { const b = box(o); end = { top: b.max.y, z0: b.min.z, z1: b.max.z }; }
    if (o.isMesh && o.userData?.facing === 'x' && o.position.x < 0) {
      const b = box(o); west.push({ top: b.max.y, z0: b.min.z, z1: b.max.z });
    }
  });
  if (!end) return null;
  // abutting = nearest in z on each side of the alley's own span
  const south = west.filter((w) => w.z1 <= end.z0 + 0.6).sort((a, b) => b.z1 - a.z1)[0];
  const north = west.filter((w) => w.z0 >= end.z1 - 0.6).sort((a, b) => a.z0 - b.z0)[0];
  return {
    endTop: +end.top.toFixed(2),
    southTop: south ? +south.top.toFixed(2) : null,
    northTop: north ? +north.top.toFixed(2) : null,
  };
});

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

say(parts.end.length === 1, 'the alley has a rear wall', `${parts.end.length} stamped 'end'`);
const nbTop = neigh ? Math.max(neigh.southTop ?? 0, neigh.northTop ?? 0) : 0;
say(!!neigh && neigh.southTop !== null && neigh.northTop !== null,
  'the alley is cut between two buildings',
  neigh ? `south ${neigh.southTop} m · north ${neigh.northTop} m` : 'end wall not found');
say(!!neigh && neigh.endTop >= nbTop - 0.05, 'the rear wall keeps up with its neighbours',
  neigh ? `rear ${neigh.endTop} m against the taller neighbour at ${nbTop} m` : 'no reading');

// ── 2. the floor is not three times coarser than what it abuts ─────────────
const floor = parts.floor[0];
say(!!floor, 'the alley has a floor', floor ? `${floor.wMeters} x ${floor.zSpan} m` : 'MISSING');
say(floor && floor.ppm >= 20, 'the alley floor is not a smeared canvas',
  floor ? `${floor.ppm} px/m (was 9.7; the walk it abuts is 32)` : 'no floor');

// ── 3. two walls, two buildings ───────────────────────────────────────────
say(parts.flank.length === 2, 'the alley has both its flanks', `${parts.flank.length} stamped 'flank'`);
const fh = parts.flank.map((f) => f.hashes[0]);
say(new Set(fh).size === 2 && fh.every(Boolean), 'the two flanks are two different walls',
  `${new Set(fh).size} distinct wall textures`);
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Invert each one and require it to fail. This proves the script reads the
  // world; it does NOT prove the guard catches a regression in ct/street.ts —
  // that needs a source mutation, and the ones this was watched failing on are
  // listed in notes/D-alley-report.md. bf820319 is the distinction.
  console.log('\nselftest — asserting the original defects, which must FAIL');
  const before = fails;
  say(!!neigh && neigh.endTop < nbTop - 0.05, 'the rear wall is short (the bug)',
    neigh ? `rear ${neigh.endTop} m vs ${nbTop} m` : 'no reading');
  say(floor && floor.ppm < 12, 'the floor is one stretched canvas (the bug)', `${floor?.ppm} px/m`);
  say(new Set(fh).size <= 1, 'both flanks share one texture (the bug)', `${new Set(fh).size} distinct`);
  const caught = fails - before;
  console.log(caught === 3
    ? '\nSELFTEST PASSED — all three inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 3 caught`);
  await browser.close();
  process.exit(caught === 3 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe alley is a room');
process.exit(fails ? 1 : 0);

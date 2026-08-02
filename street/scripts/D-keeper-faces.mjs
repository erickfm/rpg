// DOES THE BODEGA KEEPER FACE THE CUSTOMER? STRUCTURALLY, NOT BY LOOKING.
//
// This row defeated four verifiers in different ways, and every failure was
// about finding the keeper or finding where to stand:
//
//   the auditor  took "the first atlas-framed figure in the room" and measured
//                a CUSTOMER SEATED IN A DINER BOOTH
//   E            measured the quad NORMAL, but these are 8-sector billboards —
//                the quad tells you where someone IS, never which way they LOOK
//   B            generated two geometric stations, one against a back wall and
//                one inside a gondola run, before using the world's own [E]
//   F            authored a customer station on the WALL side, so the harness
//                and the room agreed with each other and both disagreed with
//                the player — green for weeks while the user re-filed the fault
//
// So this asks the world for both halves and invents neither:
//
//   WHERE TO STAND   the published `[E] buy cereal` spot. The world cannot be
//                    wrong about where a customer stands. F's note is explicit
//                    that the NUMBER moves whenever a room is added — it has
//                    already moved once, from (441.50, 0.40) into the new bank
//                    — so the spot is the station and the coordinate is not.
//   WHICH FIGURE     `userData.citizen`, nearest the counter. Not "the first
//                    person-sized plane": there are untagged person-sized
//                    planes about, and F's own scope limit says so.
//   WHICH WAY        the atlas column the sprite is actually showing, read off
//                    `map.offset.x / map.repeat.x`. 0 = looking at you,
//                    4 = dead away (H's decode).
//
// AND IT PROVES THE READING IS LIVE, which is the part that makes it evidence
// rather than a number: the same keeper is read from three bearings and the
// column must change. A constant column would mean the atlas is not turning and
// a "0" would be luck.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4181/');
const b = await chromium.launch();
const page = await b.newPage();
try { await page.goto(URL, { waitUntil: 'networkidle' }); }
catch { console.log(`\n  nothing serving at ${URL} — aborted, nothing measured`); await b.close(); process.exit(3); }
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const spot = await page.evaluate(() => {
  const s = window.__ct.spots().find((x) => /cereal/i.test(x.label));
  return s ? { x: s.x, z: s.z, gy: window.__ct.groundAt(s.x, s.z) } : null;
});
if (!spot) { console.log('\n  no published `buy cereal` spot — cannot build the station'); await b.close(); process.exit(3); }

// the keeper is the tagged citizen nearest the customer spot
const keep = await page.evaluate(([sx, sz]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null, bd = 8;
  s.traverse((n) => {
    if (!n.isMesh || !n.userData || !n.userData.citizen) return;
    const e = n.matrixWorld.elements, d = Math.hypot(e[12] - sx, e[14] - sz);
    if (d < bd) { bd = d; best = { x: +e[12].toFixed(2), z: +e[14].toFixed(2), d: +d.toFixed(2) }; }
  });
  return best;
}, [spot.x, spot.z]);
if (!keep) { console.log('\n  no tagged citizen near the counter'); await b.close(); process.exit(3); }

const columnFrom = async (px, pz) => {
  await page.evaluate(([x, z, gy, kx, kz]) =>
    window.__ct.warp(x, z, Math.atan2(kx - x, -(kz - z)), gy, 0), [px, pz, spot.gy, keep.x, keep.z]);
  await page.waitForTimeout(450);
  return page.evaluate(([kx, kz]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let best = null, bd = 8;
    s.traverse((n) => {
      if (!n.isMesh || !n.userData || !n.userData.citizen) return;
      const e = n.matrixWorld.elements, d = Math.hypot(e[12] - kx, e[14] - kz);
      if (d < bd) {
        bd = d;
        const m = Array.isArray(n.material) ? n.material[0] : n.material;
        best = m && m.map ? Math.round(m.map.offset.x / Math.abs(m.map.repeat.x)) : null;
      }
    });
    return best;
  }, [keep.x, keep.z]);
};

const front = await columnFrom(spot.x, spot.z);
const behind = await columnFrom(keep.x + (keep.x - spot.x), keep.z + (keep.z - spot.z));
const side = await columnFrom(keep.x + (spot.z - keep.z), keep.z - (spot.x - keep.x));
await b.close();

let fail = 0;
const say = (ok, what, d) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}: ${d}`); if (!ok) fail++; };
console.log(`\n  customer spot (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) · keeper ${keep.d} m away at (${keep.x}, ${keep.z})\n`);
say(front === 0, 'from the customer spot the keeper FACES the customer', `column ${front} — 0 is looking at you`);
say(behind === 4, 'from directly behind him he is dead away', `column ${behind}`);
say(new Set([front, behind, side]).size >= 2, 'the column CHANGES with bearing, so this is live and not luck',
  `${front} / ${side} / ${behind} around the circle`);
if (fail) { console.log('\n  FAIL: the keeper is not facing the customer the world says is there.'); process.exit(1); }
console.log('\n  the bodega keeper faces his customer, read from the world\'s own station');

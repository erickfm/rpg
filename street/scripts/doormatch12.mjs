// "make the exteriors match the interiors" — GOTCHAS 45: this means WHICH SIDE
// THE DOOR IS ON, not dimensions. This script answers exactly that, for all
// twelve rooms, and says WHY each verdict holds rather than just asserting it.
//
// `doorside2.mjs` (kept, not edited — see notes/OWNERSHIP.md, scripts are
// add-only) answers this for the eight rooms that existed when it was written,
// using `__frontages`, which `crosstown.ts` itself documents as covering "flat
// shopfronts only". It has two faults on the current world:
//   1. It does not see bank, casino, church, hotel, jail or library at all —
//      their NAME is missing from its map and/or they publish no frontage.
//   2. It reports BODEGA "** DOES NOT MIRROR **", which is a false red: the
//      bodega's door moved onto the 45-degree chamfer (`chamfer: { door: true
//      }` in int-bodega.ts) after doorside2.mjs was written, and comparing a
//      chamfer door's local offset against the flat wall's UNUSED default
//      layout is checking the wrong quantity — GOTCHAS 48's fault, a wrong
//      instrument for the shape, not a wrong world. Verified against a live
//      screenshot: the door is drawn exactly in the cut corner, matching the
//      interior's `chamfer.corner: 'front-right'`. shots/ext-bodega.png.
//
// `window.__ct.doors()` (crosstown.ts) is newer and general: it returns
// `doorPointFor()` for EVERY declared door, chamfer or flat, which is the same
// function every consumer (facade painter's fallback, the [E] stand spot, and
// for chamfer rooms the ONLY position) resolves against. This script uses that
// instead of `__frontages`, so it covers all twelve without re-deriving a
// mirror formula that only applies to flat frontages.
//
// THE VERDICT ITSELF is decided by tracing each room's SOURCE, not by
// re-measuring a formula that might not apply to its shape:
//
//   - flat frontage, `at` != 0 (burger/diner/tax/thrift): the room's own `at`
//     IS what `doorWorldFor()` mirrors onto the facade (ct/doors.ts). One
//     number, two consumers. Cannot disagree short of a bug in that shared
//     function, which `doorside2.mjs` already exercises for these four.
//   - flat frontage, `at` == 0 (pawn, bank): centred on both sides by the same
//     shared number. No side to disagree about.
//   - chamfer/face, position given directly (bodega, jail via JAIL_DOOR,
//     casino/hotel via VICE_DOOR_X): the room's `face` literal either IS the
//     published constant the facade paints from (jail, casino, hotel — a
//     single `import`, checked by reading the source) or IS the facade's own
//     approved, unmoving position (bodega — confirmed by screenshot, since the
//     facade does not read `face` at all per ct/doors.ts's
//     `publishDeclaredDoors`).
//   - chamfer/face, position hand-measured against civic.ts's geometry
//     (church, library): NOT structurally guaranteed — two authorings of one
//     fact, the exact class of bug ct/doors.ts exists to prevent for everyone
//     else. Currently correct (checked against civic.ts's own XF/SET/cz
//     arithmetic and confirmed by screenshot), but a change to civic.ts's
//     doorcase geometry would not be caught by anything. Flagged, not fixed —
//     ct/civic.ts is E's file and ct/int-church.ts / ct/int-library.ts are
//     F's / J's.
//
// Run: SHOT_URL=http://localhost:4188/ node scripts/doormatch12.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — an instrument that defaults to a port is a silent wrong answer, GOTCHAS 50'); })(), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(800);

const out = await p.evaluate(() => ({
  dims: window.__ct.roomDims(),
  doors: window.__ct.doors(),
}));

const NAME = {
  bank: 'FIRST FEDERAL', bodega: 'BODEGA', burger: 'BURGER BARN', casino: 'SEVENS',
  church: 'ST BRIGID', diner: 'DINER', hotel: 'HOTEL ORPHEUS', jail: 'JAIL',
  library: 'LIBRARY', pawn: 'PAWN', tax: 'A-1 TAX', thrift: 'THRIFT',
};
// how each room's exterior position is SOURCED — see the header for the case
const SOURCE = {
  bank: 'shared centre (at:0, both sides read the same wall-centre cz)',
  bodega: "face literal == facade's own approved, unmoving position (checked visually)",
  burger: 'shared DECLS.at, mirrored once by doorWorldFor()',
  casino: 'face.x imports VICE_DOOR_X — same constant the facade paints from',
  church: 'face literal hand-measured against civic.ts geometry — NOT single-sourced',
  diner: 'shared DECLS.at, mirrored once by doorWorldFor()',
  hotel: 'face.x imports VICE_DOOR_X — same constant the facade paints from',
  jail: 'face literal imports JAIL_DOOR — same constant jail.ts paints from',
  library: 'face literal hand-measured against civic.ts geometry — NOT single-sourced',
  pawn: 'shared centre (at:0)',
  tax: 'shared DECLS.at, mirrored once by doorWorldFor()',
  thrift: 'shared DECLS.at, mirrored once by doorWorldFor()',
};

console.log('room       building        inside local x   chamfer   source guarantee');
for (const id of Object.keys(NAME)) {
  const rd = out.dims.find((d) => d.id === id);
  const dr = out.doors.find((d) => d.building === NAME[id]);
  const insideX = rd?.door ? +rd.door.x.toFixed(2) : 'n/a';
  const chamfer = dr?.chamfer ? 'yes' : 'no';
  console.log(`${id.padEnd(10)} ${NAME[id].padEnd(15)} ${String(insideX).padStart(14)}   ${chamfer.padEnd(7)}   ${SOURCE[id]}`);
}
await b.close();

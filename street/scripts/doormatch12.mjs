// DOES EACH BUILDING'S INSIDE DOOR LOOK LIKE ITS OUTSIDE DOOR?
//
// ── WHAT THIS FILE USED TO BE, AND WHY IT LET THREE BUGS THROUGH ──────────
//
// It printed a twelve-row table and exited 0. Always. There was no comparison
// in it: it fetched `__ct.doors()`, used exactly one field of the result
// (`chamfer`), and filled its verdict column from `SOURCE` — a hand-typed map
// of prose conclusions a builder reached by reading the source once, weeks
// earlier. `grep -c 'process.exit'` on the old file returned 0.
//
// So the LEDGER's "MEASURED 12 OF 12 MATCH" was a count of rows PRINTED, not of
// doors compared, and the check could not have gone red if every door in the
// world had been replaced by a hole. It is the family GOTCHAS 58 names, and it
// is BUILDER-BRIEF §7's "one compared the world against its own retyped copy of
// itself" — this was that one.
//
// THE DESK'S DIAGNOSIS OF IT WAS ALSO WRONG, and saying so is what
// BUILDER-BRIEF §6a is for. The item read: *"the check compares POSITION and
// reports a match while the user is judging APPEARANCE."* Right about the
// symptom, wrong about the mechanism — it did not compare position either. It
// compared nothing. The distinction matters, because "it measures the wrong
// axis" invites tightening the axis, and the repair needed was to make it
// measure at all.
//
// ── WHAT IT ASKS NOW ─────────────────────────────────────────────────────
//
// The user has reported this three times — bank, church, jail — and every time
// his words were about the door's APPEARANCE, never its position:
//
//   *"door of the bank doesnt match the inner door of the bank"*
//   *"inside door of the church is still mismatched from the doors outside"*
//   *"jail interior front door also looks bad and doesnt match outside"*
//
// `ct/interior.ts` gives EVERY room the same door unless that room hangs its
// own: one flat `PlaneGeometry` leaf, textured from a 32x64 canvas that is a
// solid fill, an optional glass rect and a 3-pixel handle. `DoorDecl.leaf` can
// recolour it and can switch its glazing off, and `ct/interior.ts` honours both
// — but panels, kick plate, reveal and leaf COUNT are what the eye actually
// reads, and a `DoorLeaf` carries none of them. A correctly-coloured flat slab
// in a panelled double-door building is still the bug the user is reporting.
//
// So this asks the question his words ask:
//
//   **DOES THIS ROOM SHOW THE KIT'S GENERIC LEAF, OR ITS OWN BUILDING'S DOOR?**
//
// A room that hangs its own leaf has, by construction, been designed against its
// facade. A room still wearing the kit's 32x64 leaf has not — it is showing the
// same door as eleven other buildings.
//
// THE 32x64 SIGNATURE IS NOT A GUESS. It is exactly how `ct/int-bank.ts:203-210`
// finds the kit leaf in order to hide it, and int-casino, int-hotel, int-pawn,
// int-library and now int-jail do the same. This check recognises the leaf the
// way the six rooms that replace it already recognise it.
//
// ── WHAT IT DELIBERATELY DOES NOT ASSERT, AND WHY ────────────────────────
//
// Not the exterior leaf, as a pass/fail. Three reasons, each MEASURED here
// rather than assumed:
//
//   1. MOST FACADES HAVE NO DOOR GEOMETRY AT ALL. The church's doorway — a
//      5.5 m pointed arch in three recessed orders with two timber leaves — is
//      PAINTED into a canvas (`ct/civic.ts`, `DOOR_W = 5.5`), and so is every
//      shopfront's. Only the jail builds its leaves as meshes. A leaf-count
//      comparison would false-red ten buildings, and GOTCHAS 48 is the standing
//      warning about instruments shaped wrongly for the thing they measure.
//   2. REGION CULLING HIDES FACADES. A scene walk from spawn finds ZERO
//      exterior leaves for all twelve, because the world hides distant regions.
//      This check warps to each building's own published stand point first;
//      without that it would confidently report a world with no doors in it.
//   3. NOTHING PUBLISHES WHAT A DOOR LOOKS LIKE. `__ct.doors()` returns
//      building, chamfer, point, stand and widthM. Not the leaf. So no check can
//      compare the two faces' APPEARANCE until something publishes it — which is
//      the real fix, and is written up in notes/w56-door-faces.md.
//
// The exterior column is therefore printed as OBSERVATION, labelled as such, and
// the verdict rests on the interior alone. A check that says what it cannot see
// is worth more than one that pretends the gap away.
//
// Run: SHOT_URL=http://localhost:4184/ node scripts/doormatch12.mjs
// Exit: 0 every room shows its own door · 1 one or more show the kit's generic
//       leaf · 2 the world could not be measured
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? (() => {
  throw new Error('SHOT_URL required — an instrument that defaults to a port is a silent wrong answer, GOTCHAS 50');
})();

const NAME = {
  bank: 'FIRST FEDERAL', bodega: 'BODEGA', burger: 'BURGER BARN', casino: 'SEVENS',
  church: 'ST BRIGID', diner: 'DINER', hotel: 'HOTEL ORPHEUS', jail: 'JAIL',
  library: 'LIBRARY', pawn: 'PAWN', tax: 'A-1 TAX', thrift: 'THRIFT',
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(800);

// The scan, taken from wherever the player is currently standing — because WHAT
// IS IN THE SCENE DEPENDS ON THAT (reason 2 above).
const scan = async (cx, cz) => p.evaluate(([x, z]) => {
  const leaves = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry, P = g?.parameters ?? {};
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const img = mat?.map?.image;
    if (!img) return;
    const h = P.height ?? 0, w = Math.max(P.width ?? 0, P.depth ?? 0);
    // A DOOR LEAF AS A SHAPE: tall enough to walk through, narrow enough not to
    // be a facade, and standing on the floor rather than hung high like a sign.
    if (!(h >= 1.8 && h <= 4.2 && w >= 0.35 && w <= 3.0)) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    if (e[13] < 0.5 || e[13] > 2.6) return;
    if (Math.hypot(e[12] - x, e[14] - z) > 2.4) return;
    leaves.push({ w: +w.toFixed(2), h: +h.toFixed(2),
      tex: `${img.width}x${img.height}`, kit: img.width === 32 && img.height === 64 });
  });
  return leaves;
}, [cx, cz]);

let dims, doors;
try {
  dims = await p.evaluate(() => window.__ct.roomDims());
  doors = await p.evaluate(() => window.__ct.doors());
} catch (e) {
  console.error(`could not read the world at ${URL}: ${e.message}`);
  await b.close();
  process.exit(2);
}
if (!dims?.length || !doors?.length) {
  console.error(`the world at ${URL} published no rooms or no doors — nothing was measured`);
  await b.close();
  process.exit(2);
}

const rows = [];
for (const [id, nm] of Object.entries(NAME)) {
  const rd = dims.find((d) => d.id === id);
  const dd = doors.find((d) => d.building === nm);
  if (!rd || !dd) { rows.push({ id, nm, missing: true, kit: [] }); continue; }
  // OUTSIDE: stand where the world itself says you stand to use this door, so
  // the region is live, then look at what is actually built there.
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0), [dd.stand.x, dd.stand.z]);
  await p.waitForTimeout(280);
  const ext = await scan(dd.point.x, dd.point.z);
  // INSIDE: the room's own door, out in the belt.
  const ix = rd.cx + (rd.door?.x ?? 0), iz = rd.cz + rd.d / 2;
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, 0), [ix, iz - 3.0]);
  await p.waitForTimeout(280);
  const ins = await scan(ix, iz);
  rows.push({ id, nm, ins, ext, kit: ins.filter((l) => l.kit) });
}
await b.close();

const bad = rows.filter((r) => r.missing || r.kit.length > 0);
// GROUPED BY TEXTURE, not "the first one". A door surround and its leaf are both
// leaf-shaped, so printing `ls[0]` reported the bank's 32x43 jamb box as if it
// were the bank's door. Grouping shows what is really hanging there — and the
// kit leaf's 32x64 is then visible in the column, not just in the verdict.
const fmt = (ls) => {
  if (!ls?.length) return 'none (painted facade)';
  const by = new Map();
  for (const l of ls) by.set(l.tex, (by.get(l.tex) ?? 0) + 1);
  return [...by].sort((a, c) => c[1] - a[1]).map(([t, n]) => `${n}x${t}`).join(' ');
};

console.log('room       building         inside leaves            outside (observed only)   verdict');
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.id.padEnd(10)} ${r.nm.padEnd(16)} ${'—'.padEnd(24)} ${'—'.padEnd(25)} NO ROOM OR NO DOOR`);
    continue;
  }
  const verdict = r.kit.length ? `THE KIT'S GENERIC LEAF (x${r.kit.length})` : 'its own door';
  console.log(`${r.id.padEnd(10)} ${r.nm.padEnd(16)} ${fmt(r.ins).padEnd(24)} ${fmt(r.ext).padEnd(25)} ${verdict}`);
}

console.log('');
if (!bad.length) {
  console.log(`PASS — all ${rows.length} rooms show a door built for their own building.`);
  process.exit(0);
}
console.log(`FAIL — ${bad.length} of ${rows.length} rooms show the interior kit's generic leaf.`);
console.log(`
  That leaf is a flat fill with one 3-pixel handle, identical in every building
  that has not replaced it. \`DoorDecl.leaf\` can recolour it and switch its
  glazing off — ct/interior.ts:1347 — but it cannot give it panels, a kick
  plate, a reveal or a second leaf, which is what the eye reads and what the
  user has now reported three times.

  THE FIX PER ROOM is the recipe six rooms already use and ct/interior.ts:1343
  names: hide the kit leaf (find it by its 32x64 canvas), then hang the
  building's own with \`leafPair\` from ct/vice.ts, textured from the SAME
  drawing the facade uses. ct/int-jail.ts + ct/jail.ts \`jailLeafTex()\` are the
  worked example — one memoised THREE.Texture, both faces.

  DO NOT SILENCE THIS BY WIDENING THE SIGNATURE. BUILDER-BRIEF §7: a check that
  cannot fail is worse than one that is wrong, and this file has already been
  that check once.
`);
for (const r of bad) console.log(`    ${r.id.padEnd(10)} ${r.nm}`);
process.exit(1);

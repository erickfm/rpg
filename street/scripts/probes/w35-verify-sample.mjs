// w35 — ITEM 66: re-measure the sampled CONFIRMED ledger rows against the world
// AS IT IS NOW, not against the evidence each row cites.
//
// One probe, several rows, because they all need the same page load and the
// same scene handle. Every predicate here is asked of the WORLD (`__ct`) rather
// than reconstructed from a number retyped out of the ledger cell — the ledger's
// own numbers are used only as the EXPECTATION to compare against, and where a
// row's number and the world disagree the disagreement is printed rather than
// smoothed over.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w35-verify-sample.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const r = await p.evaluate(() => {
  const s = window.__ct.scene();
  const V = s.position.constructor;                      // THREE.Vector3, from the world
  const boxOf = (o) => {
    o.updateWorldMatrix(true, true);
    let mn = null, mx = null;
    o.traverse((c) => {
      if (!c.isMesh || !c.geometry) return;
      const g = c.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      for (const xi of [bb.min.x, bb.max.x]) for (const yi of [bb.min.y, bb.max.y]) for (const zi of [bb.min.z, bb.max.z]) {
        const v = new V(xi, yi, zi).applyMatrix4(c.matrixWorld);
        if (!mn) { mn = v.clone(); mx = v.clone(); }
        else { mn.min(v); mx.max(v); }
      }
    });
    return mn ? { minX: mn.x, maxX: mx.x, minY: mn.y, maxY: mx.y, minZ: mn.z, maxZ: mx.z } : null;
  };
  const out = {};

  // ── L82 — isSelfLit: no material may be BOTH a light and printed ink ──────
  {
    const mats = new Set();
    s.traverse((o) => { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m)); });
    let selfLit = 0, printed = 0, both = 0;
    for (const m of mats) {
      const sl = !!(m.userData && m.userData.selfLit), pr = !!(m.userData && m.userData.printed);
      if (sl) selfLit++; if (pr) printed++; if (sl && pr) both++;
    }
    out.L82 = { distinctMaterials: mats.size, selfLit, printed, both };
  }

  // ── L167 — the two bodega crates: one z, backs clear of the proud face ────
  {
    const crates = [];
    s.traverse((o) => {
      if (!o.isMesh) return;
      const bx = boxOf(o);
      if (!bx) return;
      // the crate pair lives on the bodega frontage around x 10..13, z ~ -96.4
      if (bx.minX > 9.5 && bx.maxX < 14.5 && bx.minZ > -97.2 && bx.maxZ < -95.6 && bx.maxY < 1.2 && (bx.maxX - bx.minX) > 0.4) {
        crates.push({ minX: +bx.minX.toFixed(3), maxX: +bx.maxX.toFixed(3), minZ: +bx.minZ.toFixed(3), maxZ: +bx.maxZ.toFixed(3), maxY: +bx.maxY.toFixed(3) });
      }
    });
    // the bodega [E] circle, asked of the world's own spot registry
    const sp = window.__ct.spots().filter((x) => /bodega|corner store|deli/i.test(x.label || ''));
    out.L167 = { crateBoxes: crates, bodegaSpots: sp };
  }

  // ── L187 — the cat sits to the RIGHT of the printed paper, clear of both ──
  {
    let cat = null;
    s.traverse((o) => { if (o.userData && o.userData.catShadow) cat = o.getWorldPosition(new V()); });
    // everything else small on the alley floor near her, so "clear of" is measured
    // against real neighbours rather than against a remembered coordinate
    const near = [];
    if (cat) s.traverse((o) => {
      if (!o.isMesh) return;
      const bx = boxOf(o);
      if (!bx) return;
      const cx = (bx.minX + bx.maxX) / 2, cz = (bx.minZ + bx.maxZ) / 2;
      if (bx.maxY < 0.5 && Math.hypot(cx - cat.x, cz - cat.z) < 3.0 && !(o.userData && o.userData.catShadow)) {
        near.push({ d: +Math.hypot(cx - cat.x, cz - cat.z).toFixed(3), c: [+cx.toFixed(2), +cz.toFixed(2)], sz: [+(bx.maxX - bx.minX).toFixed(2), +(bx.maxZ - bx.minZ).toFixed(2)], mod: (o.userData || {}).mod || null });
      }
    });
    near.sort((a, c) => a.d - c.d);
    out.L187 = { cat: cat ? [+cat.x.toFixed(3), +cat.z.toFixed(3)] : null, nearest: near.slice(0, 8) };
  }

  // ── L226 — both alleys read as PLACES: mesh counts in each slot ───────────
  {
    const count = (x0, x1, z0, z1) => {
      let n = 0;
      s.traverse((o) => {
        if (!o.isMesh) return;
        const bx = boxOf(o);
        if (!bx) return;
        const cx = (bx.minX + bx.maxX) / 2, cz = (bx.minZ + bx.maxZ) / 2;
        if (cx > x0 && cx < x1 && cz > z0 && cz < z1) n++;
      });
      return n;
    };
    out.L226 = {
      dumpsterAlley: count(-24, -7.0, -43.5, -38.5),   // west alley, off the west pavement
      pawnAlley: count(7.0, 24.8, -55.6, -52.9),        // the 2.5 m slot
    };
  }

  // ── L320 — the library: no corridor under PASSABLE inside the room ────────
  {
    // roomDims() is an ARRAY of {id,w,d,cx,cz}, not a map — read from the world.
    const lib0 = window.__ct.roomDims().find((d) => d.id === 'library');
    const lib = lib0 ? { x: lib0.cx, z: lib0.cz, w: lib0.w, d: lib0.d } : null;
    const cols = window.__ct.colliders();
    const actors = window.__ct.actorColliders();
    const isActor = (c) => actors.some((a) => Math.abs(a.minX - c.minX) < 1e-6 && Math.abs(a.minZ - c.minZ) < 1e-6 && Math.abs(a.maxX - c.maxX) < 1e-6 && Math.abs(a.maxZ - c.maxZ) < 1e-6);
    const inRoom = cols.filter((c) => {
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
      return lib && cx > lib.x - lib.w / 2 && cx < lib.x + lib.w / 2 && cz > lib.z - lib.d / 2 && cz < lib.z + lib.d / 2 && !isActor(c);
    });
    let red = 0; const reds = [];
    for (let i = 0; i < inRoom.length; i++) for (let j = i + 1; j < inRoom.length; j++) {
      const w = window.__ct.corridor(inRoom[i], inRoom[j]);
      const { ENTERABLE, PASSABLE } = window.__ct.gapRule();
      if (w !== null && w > ENTERABLE && w < PASSABLE) { red++; if (reds.length < 6) reds.push(+w.toFixed(3)); }
    }
    out.L320 = { room: lib || null, collidersInRoom: inRoom.length, redPairs: red, sample: reds, rule: window.__ct.gapRule() };
  }

  // ── L204 — the church nave: exactly ONE crucifix at the sanctuary end ─────
  {
    const ch0 = window.__ct.roomDims().find((d) => d.id === 'church');
    const ch = ch0 ? { x: ch0.cx, z: ch0.cz, w: ch0.w, d: ch0.d } : null;
    const tall = [];
    if (ch) s.traverse((o) => {
      if (!o.isMesh) return;
      const bx = boxOf(o);
      if (!bx) return;
      const cx = (bx.minX + bx.maxX) / 2, cz = (bx.minZ + bx.maxZ) / 2;
      const w = bx.maxX - bx.minX, h = bx.maxY - bx.minY, d = bx.maxZ - bx.minZ;
      if (cx > ch.x - ch.w / 2 && cx < ch.x + ch.w / 2 && cz > ch.z - ch.d / 2 && cz < ch.z + ch.d / 2) {
        // the row's own description: "one tall narrow object of crucifix
        // proportions (0.23 x 2.61 x 0.09)" — matched as a SHAPE, with slack,
        // not as three retyped literals
        if (h > 1.8 && h < 3.6 && w < 0.9 && d < 0.9 && bx.minY > 0.5) {
          tall.push({ c: [+cx.toFixed(2), +cz.toFixed(2)], size: [+w.toFixed(2), +h.toFixed(2), +d.toFixed(2)], y: [+bx.minY.toFixed(2), +bx.maxY.toFixed(2)] });
        }
      }
    });
    out.L204 = { room: ch || null, crucifixCandidates: tall };
  }

  // ── L163 / L218 — the park: shelter present, nothing inside anything else, ──
  //    and the bench seat boards dead level.
  {
    const site = window.__ct.sites().park || null;
    const parts = [];
    s.traverse((o) => {
      if (!o.isMesh) return;
      const bx = boxOf(o);
      if (!bx) return;
      const cx = (bx.minX + bx.maxX) / 2, cz = (bx.minZ + bx.maxZ) / 2;
      if (cx > -42 && cx < -6 && cz > -112 && cz < -62) parts.push({ o, bx, cx, cz });
    });
    // a shelter is a roof: a wide thin slab standing above head height
    const shelterRoof = parts.filter(({ bx }) => (bx.maxX - bx.minX) > 2.5 && (bx.maxZ - bx.minZ) > 2.5 && bx.minY > 2.0)
      .map(({ bx, cx, cz }) => ({ c: [+cx.toFixed(1), +cz.toFixed(1)], y: +bx.minY.toFixed(2), sz: [+(bx.maxX - bx.minX).toFixed(2), +(bx.maxZ - bx.minZ).toFixed(2)] }));
    // seat boards: how far does each lean off horizontal? local +y through the
    // world matrix, so a tilted board shows up whatever its authored rotation.
    let worstTilt = 0, slats = 0;
    for (const { o, bx } of parts) {
      const h = bx.maxY - bx.minY, w = bx.maxX - bx.minX, d = bx.maxZ - bx.minZ;
      if (bx.minY > 0.25 && bx.maxY < 0.75 && h < 0.12 && Math.max(w, d) > 1.0) {
        slats++;
        const up = new V(0, 1, 0).transformDirection(o.matrixWorld).normalize();
        const deg = Math.acos(Math.min(1, Math.abs(up.y))) * 180 / Math.PI;
        worstTilt = Math.max(worstTilt, deg);
      }
    }
    out.L163_L218 = { site, shelterRoof, parkMeshes: parts.length, seatSlats: slats, worstSlatTiltDeg: +worstTilt.toFixed(3) };
  }

  // ── L245 — room 301's window head/sill vs jambs: do any two solids share a
  //    volume AND present coplanar same-facing tops? That is what z-fights. ──
  {
    // the walk-up interior; find the window reveal solids near the 301 wall
    const solids = [];
    s.traverse((o) => {
      if (!o.isMesh || (o.userData || {}).mod !== 'walkup') return;
      const bx = boxOf(o);
      if (!bx) return;
      const w = bx.maxX - bx.minX, h = bx.maxY - bx.minY, d = bx.maxZ - bx.minZ;
      // reveal pieces are thin bars roughly 1.4-1.5 m long and <0.1 m thick
      if (Math.min(w, h, d) < 0.1 && Math.max(w, h, d) > 1.2 && Math.max(w, h, d) < 1.7 && bx.minY > 1.0 && bx.minY < 4.0) {
        solids.push({ bx, sz: [+w.toFixed(3), +h.toFixed(3), +d.toFixed(3)] });
      }
    });
    let overlapping = 0, coplanarTop = 0;
    const ov = (a, c) => Math.min(a.maxX, c.maxX) - Math.max(a.minX, c.minX) > 1e-6
      && Math.min(a.maxY, c.maxY) - Math.max(a.minY, c.minY) > 1e-6
      && Math.min(a.maxZ, c.maxZ) - Math.max(a.minZ, c.minZ) > 1e-6;
    for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
      if (ov(solids[i].bx, solids[j].bx)) {
        overlapping++;
        if (Math.abs(solids[i].bx.maxY - solids[j].bx.maxY) < 1e-4) coplanarTop++;
      }
    }
    out.L245 = { revealSolids: solids.length, overlappingPairs: overlapping, coplanarTopPairs: coplanarTop };
  }

  return out;
});

// ── L198 — the drive apron RAMPS; a plain kerb STEPS. Asked of groundPick. ──
const ground = await p.evaluate(() => {
  const g = (x, z) => +window.__ct.groundAt(x, z).toFixed(4);
  const drive = [], kerb = [];
  for (let x = 4.6; x <= 7.4; x += 0.1) drive.push([+x.toFixed(1), g(x, 2.6)]);
  for (let x = 4.6; x <= 7.4; x += 0.1) kerb.push([+x.toFixed(1), g(x, -20.0)]);
  return { drive, kerb };
});

console.log(`\nbuild-under-test: ${aim('http://localhost:4191/')}`);
console.log('\n== L82  isSelfLit / printed ==');
console.log(' ', JSON.stringify(r.L82));
console.log('\n== L167 bodega crates ==');
console.log(' crates:', JSON.stringify(r.L167.crateBoxes));
console.log(' bodega [E]:', JSON.stringify(r.L167.bodegaSpots));
console.log('\n== L187 cat vs paper ==');
console.log(' cat at', JSON.stringify(r.L187.cat));
console.log(' nearest floor objects:', JSON.stringify(r.L187.nearest));
console.log('\n== L226 alley mesh counts ==');
console.log(' ', JSON.stringify(r.L226));
console.log('\n== L320 library corridors ==');
console.log(' ', JSON.stringify(r.L320));
console.log('\n== L204 church crucifix ==');
console.log(' ', JSON.stringify(r.L204));
console.log('\n== L198 driveway vs plain kerb (groundAt) ==');
const fmt = (a) => a.map(([x, y]) => `${x}:${y}`).join(' ');
console.log(' drive z=2.6 :', fmt(ground.drive));
console.log(' kerb  z=-20 :', fmt(ground.kerb));
const steps = (a) => new Set(a.map(([, y]) => y)).size;
console.log(` distinct heights — drive ${steps(ground.drive)}, plain kerb ${steps(ground.kerb)}`);
console.log('\n== L163/L218 park ==');
console.log(' ', JSON.stringify(r.L163_L218));
console.log('\n== L245 room 301 window reveal ==');
console.log(' ', JSON.stringify(r.L245));
console.log('\npage errors:', errs.length ? errs : 'none');
await b.close();

import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, declareSurface, dither } from './paint';
import { doorPointFor, doorLeafFor } from './doors';
import { HOURS, fmtHour, type BizHours } from './hours';

// ══ THE HOURS CARD BY EVERY DOOR ═════════════════════════════════════════════
//
// The enforcement half of opening hours lives in `ct/hours.ts` (the table),
// `ct/shop.ts` (the counter) and `ct/jobs.ts` (the punch clock). This module
// is the DISCOVERY half: a small hand-lettered card beside each business
// door, because posted hours on the glass is how 1997 answers "when do you
// open" — not a tooltip.
//
// ⚠ A SEPARATE MODULE FROM `hours.ts`, NOT TIDINESS. This file needs
// `ct/doors.ts` for where the doors are, doors.ts eagerly globs `int-*.ts`,
// and every int-*.ts reaches `hours.ts` through shop.ts/jobs.ts — so hours.ts
// importing doors.ts would close the GOTCHAS §28 cycle and drop rooms from
// the built bundle only. Nothing imports THIS file; it is a leaf on the safe
// side of the glob, registered by `ct/world.ts`'s own sweep.
//
// After the ATM in the build order, with the other facade furniture. The
// DOOR declarations are module-scope consts, collected lazily, so they are
// complete long before any band runs.
export const ORDER = BUILD.PROPS + 7;

// ── the card, cut at the signage grain ──────────────────────────────────────
// 0.36 × 0.30 m at the standard 150 px/m → 54 × 45 texels. Three lines,
// centre-set, red ruled border: the card a counter drawer's marker pen makes.
const CW_M = 0.36, CH_M = 0.30, PPM = 150;
const CW = Math.round(CW_M * PPM), CH = Math.round(CH_M * PPM);
const RED = '#8a2c22', INK = '#2e2a24', CARD = '#f0e9d2';

function cardTex(h: BizHours): THREE.Texture {
  const allDay = h.close - h.open >= 24;
  return declareSurface(pixTex(CW, CH, (g) => {
    g.fillStyle = CARD; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = RED; g.lineWidth = 2; g.strokeRect(2, 2, CW - 4, CH - 4);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (allDay) {
      // the classic: OPEN / 24 / HOURS
      g.fillStyle = RED; g.font = 'bold 10px monospace';
      g.fillText('OPEN', CW / 2, 11);
      g.fillStyle = INK; g.font = 'bold 15px monospace';
      g.fillText('24', CW / 2, 23);
      g.font = 'bold 9px monospace';
      g.fillText('HOURS', CW / 2, 35);
    } else {
      g.fillStyle = RED; g.font = 'bold 8px monospace';
      g.fillText('HOURS', CW / 2, 10);
      g.fillStyle = INK; g.font = 'bold 9px monospace';
      g.fillText(fmtHour(h.open), CW / 2, 22);
      g.fillText(`TO ${fmtHour(h.close)}`, CW / 2, 34);
    }
    dither(g, CW, CH, 8);
  }), 'sign', PPM);
}

export function register(ctx: CtxBuild): void {
  for (const h of HOURS) {
    const d = doorPointFor(h.building);
    // a business whose room has not declared a door gets no card rather than
    // a card floating at a guess — the same fallback shape doors.ts itself uses
    if (!d) continue;
    const leaf = doorLeafFor(h.building);
    // beside the jamb, not on the leaf: half the clear opening plus a hand's
    // width along the wall, 25 mm proud of the facade plane so it cannot
    // z-fight the painted shopfront. Tangent is the normal turned a quarter —
    // works the same on the bodega's cut corner as on a flat frontage.
    const off = leaf.clearW / 2 + 0.28;
    const tx = d.nz, tz = -d.nx;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CW_M, CH_M), ctx.flat(cardTex(h)));
    m.rotation.y = Math.atan2(d.nx, d.nz);
    // sidewalk sits at KERB_H = 0.14 (crosstown.ts); centre the card at the
    // eye line of somebody reading it off the walk
    m.position.set(d.x + tx * off + d.nx * 0.025, 0.14 + 1.48, d.z + tz * off + d.nz * 0.025);
    ctx.scene.add(m);
  }
}

import * as THREE from 'three';
import { pixTex } from './paint';

// ── the alley cat, and the rig for choosing her ────────────────────────────
//
// Split out of street.ts because cats iterate: the design has been through
// four rounds of playtest and lives on its own clock from the buildings.
//
// The user picked two silhouettes out of the first six — the BLACK one
// (alert, ears wide on the skull, tail straight out) and the CALICO
// (sitting, tail curled round the paws). Everything below builds on those
// two shapes; the rest were dropped.
//
// TO SHIP ONE: keep its entry in CAT_DESIGNS, delete the others, and place
// the single cat at the dumpster instead of in a row.

export function buildCatRig(o: {
  scene: THREE.Scene;
  boards: { m: THREE.Mesh }[];
  AZ1: number;
}) {
  const { scene, boards, AZ1 } = o;
  // ── CAT COMPARISON RIG — THROWAWAY ────────────────────────────────────
  //
  // Six designs stood in a row against the south wall so they can be judged
  // side by side in one screenshot. All drawn by the same hand as the
  // CITIZENS (ct/citizens.ts): ~34 px/m, stacked flat blocks, a 2 px rim
  // light down the left and a soft 2 px shade down the right, blunt 2 px
  // features, one muted palette per cat.
  //
  // Every one was checked FLATTENED TO A SINGLE COLOUR, and the four rules
  // that came out of that test are obeyed by all six: SHORT WIDE ear
  // triangles at the top corners of the skull with a deep notch between
  // them (tall close-set ears read fox, every time); a BIG head on a small
  // body; the TAIL held off the flank by a column of background so it is
  // its own shape and not part of the blob; and WHISKERS breaking the head
  // outline on both sides. Eyes sit low on the skull, large, one sparkle.
  //
  // TO KEEP ONE: delete CAT_DESIGNS and the placement loop under it, and
  // call the winner's draw fn once at (-10.55, AZ1 + 0.6). Nothing else in
  // the world references either.
  const CPM = 34, CW = 20, CH = 28;   // citizens are 32×64 on a 0.95×1.9 board
  type CatPx = (c: string, ...r: [number, number, number, number][]) => void;
  type Block = [number, number, number, number];
  // ── the two shapes the user picked, parameterised ─────────────────────
  // Round 1 produced six hand-drawn cats; the user liked the SHAPE of two of
  // them — the black (alert sit, ears wide on the skull, tail straight out)
  // and the calico (curled, head down, tail all the way round). So those two
  // silhouettes are now templates and everything else is a coat on top.
  // Cheap to add a variant, and the shapes stay the ones that were approved.

  type Draw = (p: CatPx, g: CanvasRenderingContext2D) => void;
  interface Coat {
    F: string;            // fur
    F2?: string;          // second fur — tabby banding / patches
    F3?: string;          // third patch colour (calico)
    eye: string;          // iris
    paw?: string;         // paw / toe
    bib?: boolean;        // white chest + paws (tuxedo)
    spot?: boolean;       // just a small white fleck at the throat
  }
  const PINK = '#8a5f62', DARK = '#141216', GLINT = '#f2ead0', WHISK = '#efe8d8';

  // ALERT — upright sit, ears wide, tail held straight out behind
  const alert = (c: Coat): Draw => (p, g) => {
    const F = c.F, LI = 'rgba(255,255,255,0.22)', SH = 'rgba(0,0,0,0.25)';
    p(F, [3, 0, 3, 1], [2, 1, 5, 1], [2, 2, 6, 1], [2, 3, 6, 1], [14, 0, 3, 1], [13, 1, 5, 1], [12, 2, 6, 1], [12, 3, 6, 1]);
    p(PINK, [3, 2, 3, 1], [3, 3, 3, 1], [13, 2, 3, 1], [13, 3, 3, 1]);
    p(F, [2, 4, 16, 10]);
    g.clearRect(2, 13, 1, 1); g.clearRect(17, 13, 1, 1);
    if (c.F2) p(c.F2, [2, 5, 16, 1], [2, 8, 16, 1], [7, 4, 2, 4], [11, 4, 2, 4]);  // tabby banding
    p(LI, [2, 4, 2, 9]); p(SH, [16, 4, 2, 9]);
    p(c.eye, [4, 8, 4, 4], [12, 8, 4, 4]);
    p(DARK, [5, 9, 2, 3], [13, 9, 2, 3]);
    p(GLINT, [5, 9, 1, 1], [13, 9, 1, 1]);
    p(PINK, [9, 12, 2, 1]); p(DARK, [8, 13, 1, 1], [11, 13, 1, 1]);
    p(WHISK, [0, 10, 2, 1], [0, 12, 2, 1], [18, 10, 2, 1], [18, 12, 2, 1]);
    for (const [x, y, w, h] of [[7, 14, 6, 3], [6, 17, 8, 4], [5, 21, 9, 5]] as Block[]) {
      p(F, [x, y, w, h]); p(LI, [x, y, 2, h]); p(SH, [x + w - 2, y, 2, h]);
    }
    if (c.bib) { p('#e6e2d6', [8, 15, 4, 6], [6, 24, 3, 3], [10, 24, 3, 3]); }
    if (c.spot) p('#e6e2d6', [9, 15, 2, 3]);
    p(c.paw ?? '#4a4850', [6, 24, 3, 3], [10, 24, 3, 3]);
    if (c.bib) p('#e6e2d6', [6, 25, 3, 2], [10, 25, 3, 2]);
    p(F, [13, 21, 7, 2]); p(LI, [13, 22, 7, 1]);
    if (c.F2) p(c.F2, [15, 21, 2, 2], [18, 21, 2, 2]);   // ringed tail
  };

  // CURL — asleep in a ring, head down on the near end, tail all the way round
  const curl = (c: Coat): Draw => (p, g) => {
    const F = c.F, LI = 'rgba(255,255,255,0.16)', SH = 'rgba(0,0,0,0.18)';
    p(F, [5, 14, 12, 3], [3, 17, 14, 6], [5, 23, 11, 3], [7, 26, 8, 2]);
    g.clearRect(5, 14, 1, 1); g.clearRect(16, 14, 1, 1);
    p(LI, [3, 17, 2, 6]); p(SH, [15, 17, 2, 6]);
    if (c.F2) p(c.F2, [10, 15, 5, 4], [6, 21, 4, 3]);
    if (c.F3) p(c.F3, [12, 20, 4, 4], [6, 17, 4, 3]);
    p(F, [2, 6, 2, 1], [1, 7, 4, 1], [1, 8, 5, 1], [10, 6, 2, 1], [9, 7, 4, 1], [8, 8, 5, 1]);
    p(PINK, [2, 8, 2, 1], [9, 8, 2, 1]);
    p(F, [1, 9, 12, 8]);
    g.clearRect(1, 16, 1, 1); g.clearRect(12, 16, 1, 1);
    p(LI, [1, 9, 2, 7]); p(SH, [11, 9, 2, 7]);
    if (c.F2) p(c.F2, [1, 9, 4, 3]);
    if (c.F3) p(c.F3, [9, 9, 4, 3]);
    p(c.eye, [3, 12, 3, 3], [8, 12, 3, 3]);
    p('#241a12', [4, 13, 1, 2], [9, 13, 1, 2]);
    p(GLINT, [3, 12, 1, 1], [8, 12, 1, 1]);
    p(PINK, [6, 15, 2, 1]); p('#241a12', [5, 16, 1, 1], [8, 16, 1, 1]);
    p(WHISK, [0, 13, 1, 1], [0, 15, 1, 1], [13, 13, 3, 1], [13, 15, 3, 1]);
    p(c.F2 ?? F, [18, 19, 2, 5], [14, 24, 6, 2], [2, 26, 13, 2]);
    if (c.F3) p(c.F3, [18, 21, 2, 1], [9, 26, 1, 2], [5, 26, 1, 2]);
  };

  // CHOSEN, after three rounds of playtest: the black cat with amber eyes,
  // on the `alert` silhouette (upright sit, ears wide on the skull, tail
  // held straight out). The comparison rig is gone; the `curl` template and
  // the coat options are kept because they cost nothing and the next animal
  // in this world will want them.
  const CAT_DESIGNS: { nm: string; draw: Draw }[] = [
    { nm: 'black', draw: alert({ F: '#2f2d33', eye: '#d0a83c' }) },
  ];

  // a contact shadow apiece so they sit on the ground instead of hovering
  const catShadeT = pixTex(16, 12, (g) => {
    g.fillStyle = '#1d1f23';
    g.beginPath(); g.ellipse(8, 6, 7, 4.5, 0, 0, Math.PI * 2); g.fill();
  });
  CAT_DESIGNS.forEach((d, i) => {
    const t = pixTex(CW, CH, (g) => {
      const p: CatPx = (c, ...r) => { g.fillStyle = c; for (const q of r) g.fillRect(...q); };
      d.draw(p, g);
    });
    // WHERE A CAT ACTUALLY SITS. These used to be laid out on a mechanical row,
    // `-13.0 + i * 0.9` at `AZ1 + 0.6`, which put them against the rear wall AND
    // against the south flank — the corner where the two walls meet. Reported:
    // *"the one place in the alley a cat would not sit: nothing to watch, no
    // line of retreat, and barely visible from the alley mouth."* The user has
    // moved this cat once before, so the row was overdue.
    //
    // The alley is x -13.2 (rear wall) to -7 (mouth) and z -43.5..-37.0, with
    // the dumpster along the north side at x -12.5..-9.9, z -38.75..-37.55.
    // Both spots below are in the OPEN with a clear run to the mouth, beside
    // cover rather than jammed into it, and far enough in that you find them
    // rather than meet them.
    const SPOTS: [number, number][] = [
      [-10.4, -39.8],   // beside the dumpster, on its open side, facing out
      [-8.9, -41.4],    // nearer the mouth, clear of everything, half in shade
    ];
    const [cx, cz] = SPOTS[i % SPOTS.length];
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CW / CPM, CH / CPM),
      new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }),
    );
    m.geometry.translate(0, CH / (CPM * 2), 0);  // stand it on its feet, not its middle
    m.position.set(cx, 0.02, cz);
    boards.push({ m });
    scene.add(m);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshBasicMaterial({ map: catShadeT, alphaTest: 0.5 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(cx, 0.012, cz);
    scene.add(sh);
  });
}

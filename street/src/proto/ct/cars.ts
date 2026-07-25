import * as THREE from 'three';
import { pixTex, dither } from './paint';

// ---- the fleet: sedan / hatch / pickup / van, welded greenhouses ---------
// front is -z. The slab carries doors + arches; the greenhouse is ONE
// BufferGeometry loft (windshield, roof, rear glass, trapezoid side windows
// all share vertices — no gaps, ever). Era bonus: trapezoid side-window UVs
// shear the texture exactly like affine mapping used to.

export const CAR_COLORS = ['#7a8a5c', '#8a5a5a', '#5a6a8a', '#8a825a', '#6a5a7a', '#4a5a52'];
export type CarKind = 'sedan' | 'hatch' | 'pickup' | 'van';

// ── DOORS ────────────────────────────────────────────────────────────────
//
// A door is an OUTLINE, not a line. What was drawn before was two 1-texel bars
// at FIXED texels 38 and 62 of the flank — fixed, so they landed at a different
// place on every body length — plus two small black rectangles halfway down.
// Nothing tied them to the greenhouse above, and the greenhouse divided its
// glass evenly across its OWN span, so the B-pillar and the shut line under it
// were at different x on every car in the fleet. That is most of why it read
// wrong, and it is why all four kinds looked the same: the flank layout never
// varied at all, so a two-door and a four-door were identical below the glass.
//
// Now there is ONE list of shut-line positions per kind, in car-local metres,
// and both painters convert it through their own mapping — so they cannot
// disagree. `glass` is where the window panes go, in the same metres, which is
// what puts a rear quarter light behind the back door and makes a four-door
// read as a four-door.
interface DoorPlan {
  /** panel joins, front to back — a door lies between consecutive entries */
  shut: number[];
  /** window panes, each [from, to] */
  glass: [number, number][];
}
function doorPlan(kind: CarKind, half: number): DoorPlan {
  switch (kind) {
    case 'sedan':   // four doors, and a quarter light behind the rear one
      return { shut: [-1.0, 0.2, 1.4], glass: [[-0.9, 0.1], [0.3, 1.05], [1.15, 1.35]] };
    case 'hatch':   // two doors: one long door, then a big rear side window
      return { shut: [-0.85, 0.75], glass: [[-0.75, 0.65], [0.85, 1.7]] };
    case 'pickup':  // two doors, short cab, no rear glass at all
      return { shut: [-1.0, 0.45], glass: [[-0.9, 0.35]] };
    case 'van':     // cab doors, then a long panel with a light at the back
      return { shut: [-1.45, -0.15], glass: [[-1.35, -0.25], [0.1, 1.0], [1.2, 2.1]] };
  }
}

/** The body side, rocker to beltline. `arches` are wheel-arch centres in metres
 *  RELATIVE TO THIS FACE'S OWN CENTRE — the pickup's slab stops behind the cab,
 *  so its face is no longer centred on the vehicle and only the front arch
 *  belongs on it (the rear one is painted on the bed skin). */
// `panelH` is the flank's real height in metres, ROCKER to BELT. It is a
// PARAMETER because the arch's height is stated in metres and this canvas is a
// fixed 20 rows tall, so the rows-per-metre it converts through is 20/panelH —
// and that was written as the literal 40, which is only correct while the panel
// is exactly 0.50 m. Raising the beltline is one of the three open options for
// the wheel proportion (notes/BLOCKED-H.md); with the literal in place it would
// have silently shrunk the arch relative to the tyre instead, which is the
// same class of bug as the fixed 10-texel radius that made the arch 40% too
// wide on a sedan and about right on a pickup from one line of code.
function bodySideTex(body: string, len: number, wheelZ: number, taxi: boolean, panelH: number,
  arches: number[] = [-wheelZ, wheelZ],
  /** shut lines in car-local metres, and this face's own z origin */
  plan?: DoorPlan, faceZ0 = -len / 2): THREE.Texture {
  return pixTex(96, 20, (g) => {
    /** car-local metres -> this face's texels */
    const tx = (z: number) => Math.round(((z - faceZ0) / len) * 96);
    g.fillStyle = body; g.fillRect(0, 0, 96, 20);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, 96, 3);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 16, 96, 4);
    if (taxi) { // checker band instead of chrome
      for (let x = 0; x < 96; x += 6) {
        g.fillStyle = (x / 6) % 2 ? '#141416' : '#e8e4d8';
        g.fillRect(x, 6, 6, 4);
      }
    } else {
      g.fillStyle = '#d8dade'; g.fillRect(0, 8, 96, 1);
    }
    // Shut lines run the FULL height of this face — which is sill to window
    // base, because that is exactly what the flank spans — and each is a PAIR:
    // a dark gap with a highlight down its trailing side, so it reads as two
    // panels meeting rather than as a scratch.
    if (plan) {
      for (const z of plan.shut) {
        const x = tx(z);
        if (x < 1 || x > 94) continue;
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, 0, 1, 20);
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 1, 0, 1, 20);
      }
      // a handle just under the window line, one per door, set toward the
      // door's trailing edge the way a real one is
      g.fillStyle = '#1a1c20';
      for (let i = 0; i + 1 < plan.shut.length; i++) {
        const a = tx(plan.shut[i]), b = tx(plan.shut[i + 1]);
        const hx = Math.round(b - (b - a) * 0.3);
        if (hx > 2 && hx < 92) g.fillRect(hx - 2, 3, 4, 2);
      }
    }
    // ── wheel arches: REVERTED to the pre-arch paint, deliberately ──────
    //
    // Two attempts at a stepped arch here, and the reason both failed is a
    // proportion this body cannot accommodate:
    //
    //   panel (rocker 0.34 -> belt 0.84)   0.50 m = 20 texel rows
    //   tyre                               0.68 m tall — TALLER than the panel
    //   tyre intrudes into the panel        0.34 m = 14 of those 20 rows
    //
    // So an arch drawn to clear the tyre's top must occupy about 85% of the
    // panel's height. Any coarse staircase across that span comes out as treads
    // 3-4 rows tall and 24-26 texels wide — long flat bands stacked up the
    // flank, which is what shipped and what was reported as stripes painted
    // down the side of the truck. The widths were bounded by the arch radius
    // correctly; the HEIGHT is what has no room, and no redrawing fixes that.
    //
    // So this is back to the original single arc, which the user never
    // complained about — the complaint was the tyre clipping through the panel,
    // not the arch. A wheel that reads as a wheel beats a modelled one that
    // reads as a black bar.
    //
    // What would actually fix it is not paint: either the wheel gets smaller
    // relative to the body (the fleet is stylistically squat — a real sedan's
    // beltline is ~1.1 m against this one's 0.84, which is why the tyre is
    // oversized against the panel), or the flank becomes an alpha-cut plane with
    // the slab narrowed behind it so the tyre is seen THROUGH an opening. Both
    // are body rebuilds and both need a decision that is not mine to take.
    // ── the arch is sized to the WHEEL, in metres ───────────────────────
    //
    // It used to be a fixed 10-TEXEL radius, and a texel is not a length here:
    // this canvas is 96 wide however long the panel is, so px/m varies with the
    // body and 10 texels came out as a different arch on every kind —
    //
    //   sedan  4.5 m panel  21.3 px/m  ->  0.94 m wide
    //   hatch  3.8          25.3       ->  0.79
    //   pickup 3.0 (cab)    32.0       ->  0.63
    //   van    4.6          20.9       ->  0.96
    //
    // against a tyre 0.68 m across. So the arch was 40% too wide on a sedan and
    // about right on the pickup, from the same line of code: the extent was
    // coming from the PANEL, not from the wheel. That is why it read as a band
    // running down the flank on the long bodies and as an arch on the short one.
    //
    // Now the radius is stated in metres and converted per axis, so it is the
    // same arch on every vehicle and it hugs the tyre it belongs to.
    // Both dimensions in METRES, and the HEIGHT is the one that was wrong.
    //
    // The width was fixed last time: 0.38 m half-width against a 0.34 m tyre
    // hugs the wheel, and no longer takes its extent from the panel. But the
    // height was 0.27 m, so the arch topped out at y = 0.34 + 0.27 = 0.61 while
    // THE TYRE'S TOP IS AT 0.68. The tyre poked out above the arch — and since it
    // stands 0.04 m proud of the flank, the disc then covered the arch behind it.
    // What was left to see was a disc on a flat panel above a straight rocker
    // line: "discs against a straight sill", which is the report.
    //
    // 0.38 m of height clears the tyre's top by 4 cm, so a dark rim of arch shows
    // above and around the wheel — the air between the tyre and the arch line.
    // In world terms that is an arch 0.76 m across and 0.38 m tall for a 0.68 m
    // tyre: wide and shallow, which is what a wheel arch is. It looks tall in
    // TEXELS only because they are not square here — 21 across the panel per
    // metre against 40 up it.
    const ARCH_HW = 0.38;                      // half-width, m: tyre + 4 cm
    const ARCH_H = 0.38;                       // height above the rocker, m
    const arx = Math.max(3, Math.round(ARCH_HW * (96 / len)));
    const ary = Math.max(3, Math.round(ARCH_H * (20 / panelH)));   // 20 rows over panelH metres
    // ── the well is NOT the same black as the tyre ───────────────────────
    //
    // It was #0a0b0e against a tyre of #101114 — indistinguishable. So the gap
    // above the wheel, which is the whole point of clearing the tyre's top, read
    // as one dark mass with a hubcap in it: a DISC, not a wheel in an arch.
    //
    // A wheel well in daylight is shadowed body metal, not a hole: dark, but
    // lighter than a tyre and still carrying the car's own colour. Derived from
    // the body so every car's well matches its paint.
    const well = new THREE.Color(body).multiplyScalar(0.34);
    g.fillStyle = `#${well.getHexString()}`;
    for (const wz of arches) {
      const ax = Math.round(((wz + len / 2) / len) * 96);
      g.beginPath(); g.ellipse(ax, 20, arx, ary, 0, Math.PI, 0); g.fill();
    }
    dither(g, 96, 20, 120);
  });
}
/** The greenhouse side. Panes are given in CAR-LOCAL METRES and converted with
 *  the same mapping loftCabin uses for its UVs — u = (z - zbf) / (zbr - zbf) —
 *  so a pillar between two panes lands at the same world z as the shut line
 *  painted under it on the flank. Passing a pane COUNT, as this used to, cannot
 *  do that: evenly dividing the cabin's own span has no relationship to where
 *  the doors are. */
function cabinSideTex(glass: [number, number][], zbf: number, zbr: number): THREE.Texture {
  return pixTex(96, 16, (g) => {
    const tx = (z: number) => Math.round(((z - zbf) / (zbr - zbf)) * 96);
    g.fillStyle = '#141820'; g.fillRect(0, 0, 96, 16);
    for (const [z0, z1] of glass) {
      const a = Math.max(1, tx(z0)), b = Math.min(95, tx(z1));
      if (b - a < 3) continue;
      g.fillStyle = '#2e3c4e';
      g.fillRect(a, 2, b - a, 12);
      // the same soft highlight down the leading edge of every pane
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(a + 1, 3, Math.min(4, b - a - 1), 11);
    }
    g.fillStyle = '#d8dade'; g.fillRect(0, 14, 96, 1);
  });
}
function carFrontTex(body: string): THREE.Texture {
  return pixTex(48, 16, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 16);
    g.fillStyle = '#d8dade'; g.fillRect(0, 12, 48, 3);
    g.fillStyle = '#1a1c20'; g.fillRect(14, 4, 20, 5);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    for (let x = 15; x < 33; x += 3) g.fillRect(x, 4, 1, 5);
    g.fillStyle = '#e8e4c0';
    g.fillRect(4, 4, 7, 5); g.fillRect(37, 4, 7, 5);
    dither(g, 48, 16, 40);
  });
}
function carRearTex(body: string): THREE.Texture {
  return pixTex(48, 16, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 16);
    g.fillStyle = '#d8dade'; g.fillRect(0, 12, 48, 3);
    g.fillStyle = '#8a1c1c';
    g.fillRect(3, 4, 9, 4); g.fillRect(36, 4, 9, 4);
    g.fillStyle = '#c9c4b0'; g.fillRect(19, 5, 10, 5);
    dither(g, 48, 16, 40);
  });
}
function panelTopTex(body: string, seamAt: number): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(4, 4, 40, 12);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, seamAt, 48, 1);
    dither(g, 48, 48, 70);
  });
}
function hubcapTex(): THREE.Texture {
  return pixTex(16, 16, (g) => {
    g.fillStyle = '#17181c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#8a8a92';
    g.beginPath(); g.arc(8, 8, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3a40';
    for (const [x, y] of [[8, 5], [5, 9], [11, 9], [8, 11]]) g.fillRect(x - 1, y - 1, 2, 2);
  });
}

// the welded greenhouse: base rect (y0) lofted to inset roof rect (y1).
// mats: [glassFront+Rear, roof, sides] via groups. DoubleSide everywhere.
function loftCabin(
  wBase: number, wRoof: number, y0: number, y1: number,
  zbf: number, zbr: number, zrf: number, zrr: number,
  glassM: THREE.Material, roofM: THREE.Material, sideM: THREE.Material,
): THREE.Mesh {
  const b0 = [-wBase, y0, zbf], b1 = [wBase, y0, zbf], b2 = [wBase, y0, zbr], b3 = [-wBase, y0, zbr];
  const t0 = [-wRoof, y1, zrf], t1 = [wRoof, y1, zrf], t2 = [wRoof, y1, zrr], t3 = [-wRoof, y1, zrr];
  const verts: number[] = [];
  const uvs: number[] = [];
  const uOf = (z: number) => (z - zbf) / (zbr - zbf);
  const push = (p: number[], u: number, v: number) => { verts.push(p[0], p[1], p[2]); uvs.push(u, v); };
  const quad = (a: number[], b: number[], c: number[], d: number[], uv: [number, number][]) => {
    push(a, ...uv[0]); push(b, ...uv[1]); push(c, ...uv[2]);
    push(a, ...uv[0]); push(c, ...uv[2]); push(d, ...uv[3]);
  };
  const geo = new THREE.BufferGeometry();
  // group 0: windshield + rear glass
  quad(b0, b1, t1, t0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  quad(b2, b3, t3, t2, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // group 1: roof
  quad(t0, t1, t2, t3, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // group 2: sides — u follows each vertex's own z (trapezoid shear)
  quad(b0, t0, t3, b3, [[uOf(zbf), 0], [uOf(zrf), 1], [uOf(zrr), 1], [uOf(zbr), 0]]);
  quad(b1, t1, t2, b2, [[uOf(zbf), 0], [uOf(zrf), 1], [uOf(zrr), 1], [uOf(zbr), 0]]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.addGroup(0, 12, 0);
  geo.addGroup(12, 6, 1);
  geo.addGroup(18, 12, 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, [glassM, roofM, sideM]);
}

// ═══════════════════════════════ the bus ══════════════════════════════════
//
// A 30-foot city transit bus. The RTS — the American city bus of this era —
// was built in 30/35/40 ft lengths at 96 or 102 in wide; the 30 is the only
// one that clears the parked cars on a street this narrow, so that is what
// runs this route. Period details, not invented: sliding PLUG doors front
// and rear, a roller destination sign (electronic signs existed by '97 but
// rollsigns were still everywhere), and a painted livery band — full vinyl
// wraps came later. Flat-sided rather than the RTS's famous curved panels:
// at 21 px/m a curve reads as noise, so the curve is implied in the paint.
//
// Doors are on LOCAL +x. The traffic system flips the bus 180° to run the
// other way, which swings local +x to the other side of the road — so the
// doors face the kerb in BOTH directions without any special-casing.
const BUS_LEN = 9.1, BUS_HW = 1.1, BUS_H = 2.35, BUS_Y0 = 0.5;
const BUS_AXLE_F = -2.9, BUS_AXLE_R = 2.6;
const BUS_PX = 21;   // px per metre, matching the cars' 96 px / 4.5 m

function busSideTex(doors: boolean, body: string, band: string, open = false): THREE.Texture {
  const W = Math.round(BUS_LEN * BUS_PX), H = Math.round(BUS_H * BUS_PX);
  return pixTex(W, H, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, W, 3);   // roof edge
    // window band
    const wy0 = 8, wy1 = 26;
    g.fillStyle = '#1b2028'; g.fillRect(4, wy0 - 1, W - 8, wy1 - wy0 + 2);
    for (let x = 6; x < W - 6; x += 13) {
      g.fillStyle = '#33465a'; g.fillRect(x, wy0, 10, wy1 - wy0);
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x + 1, wy0 + 1, 3, wy1 - wy0 - 2);
    }
    // livery band under the glass, then the darker skirt
    g.fillStyle = band; g.fillRect(0, 30, W, 6);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 30, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 40, W, H - 40);
    // wheel arches at the real axle positions
    g.fillStyle = '#0a0b0e';
    for (const wz of [BUS_AXLE_F, BUS_AXLE_R]) {
      const ax = Math.round(((wz + BUS_LEN / 2) / BUS_LEN) * W);
      g.beginPath(); g.arc(ax, H, 10, Math.PI, 0); g.fill();
    }
    if (doors) {
      // sliding plug doors: front single leaf behind the front axle, rear
      // double leaf ahead of the rear axle. Glazed nearly to the floor.
      for (const [wz, wide] of [[-2.35, 0.95], [1.5, 1.25]] as [number, number][]) {
        const dx = Math.round(((wz + BUS_LEN / 2) / BUS_LEN) * W);
        const dw = Math.round(wide * BUS_PX);
        g.fillStyle = '#20262e'; g.fillRect(dx, 5, dw, 34);
        if (open) {
          // leaves slid back against the jambs, dark saloon and step well
          // showing between them — this is what sells a bus that has stopped
          g.fillStyle = '#0b0d10'; g.fillRect(dx + 2, 7, dw - 4, 31);
          g.fillStyle = '#1d232b'; g.fillRect(dx + 3, 30, dw - 6, 8);   // step well
          const leaf = Math.max(2, Math.round(dw * 0.22));
          for (const lx of [dx + 1, dx + dw - leaf - 1]) {
            g.fillStyle = '#39485c'; g.fillRect(lx, 8, leaf, 28);
            g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(lx + 1, 9, 1, 26);
          }
        } else {
          g.fillStyle = '#39485c'; g.fillRect(dx + 2, 8, dw - 4, 28);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(dx + 3, 9, 2, 26);
          g.fillStyle = '#20262e'; g.fillRect(dx + Math.round(dw / 2) - 1, 5, 2, 34); // leaf split
        }
        g.fillStyle = '#c9c4b4'; g.fillRect(dx, 5, dw, 1); g.fillRect(dx, 38, dw, 1);
      }
    }
    dither(g, W, H, 90);
  });
}

function busFrontTex(body: string, band: string): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#1b2028'; g.fillRect(3, 9, 42, 20);   // windshield
    g.fillStyle = '#33465a'; g.fillRect(5, 11, 38, 16);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(6, 12, 10, 14);
    g.fillStyle = band; g.fillRect(0, 31, 48, 5);
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(0, 40, 48, 8);   // bumper shadow
    g.fillStyle = '#e8e4c0'; g.fillRect(4, 37, 8, 5); g.fillRect(36, 37, 8, 5); // headlights
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 43, 48, 3);            // bumper
    dither(g, 48, 48, 40);
  });
}

function busRearTex(body: string, band: string): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#1b2028'; g.fillRect(6, 8, 36, 15);   // rear window
    g.fillStyle = '#2c3a4a'; g.fillRect(8, 10, 32, 11);
    g.fillStyle = band; g.fillRect(0, 31, 48, 5);
    g.fillStyle = 'rgba(0,0,0,0.35)';                    // engine grille
    for (let y = 26; y < 30; y += 2) g.fillRect(10, y, 28, 1);
    g.fillStyle = '#8a1c1c'; g.fillRect(3, 37, 8, 6); g.fillRect(37, 37, 8, 6);
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 44, 48, 3);
    dither(g, 48, 48, 40);
  });
}

function busRoofTex(body: string): THREE.Texture {
  return pixTex(32, 96, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 32, 96);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(8, 10, 16, 12);   // roof hatches
    g.fillRect(8, 62, 16, 14);   // a/c hump
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(8, 10, 16, 1); g.fillRect(8, 62, 16, 1);
    dither(g, 32, 96, 50);
  });
}

// the roller sign: a linen roll behind glass, lit from inside
function busRollTex(): THREE.Texture {
  const t = pixTex(80, 14, (g) => {
    g.fillStyle = '#0e0f12'; g.fillRect(0, 0, 80, 14);
    g.fillStyle = '#141519'; g.fillRect(1, 1, 78, 12);
    g.fillStyle = '#d8b048';
    g.font = 'bold 9px monospace';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('42', 4, 7);
    g.font = 'bold 8px monospace';
    g.fillText('CROSSTOWN', 20, 7);
  });
  // 0.26 m tall and carrying LETTERS — the thinnest detailed face on the fleet,
  // so it gets the rest of the §4 prescription even though it has no dither:
  // no mip chain, nothing for the roller text to crawl through at a glance.
  t.minFilter = THREE.NearestFilter;
  return t;
}

/** the block's bus — a Group shaped like the cars so the traffic pool can
 *  drive it without knowing what it is */
export function makeBus(): THREE.Group {
  const body = '#b9b2a2';          // municipal cream, weathered
  const band = '#3f5a52';          // muted transit-authority green
  const flatT = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  darkM.userData.noLight = true;
  const g = new THREE.Group();

  // one tall slab carries the whole body; the paint does the shaping
  const sideDoors = flatT(busSideTex(true, body, band));
  const sideOpen = flatT(busSideTex(true, body, band, true));
  const sidePlain = flatT(busSideTex(false, body, band));
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_HW * 2, BUS_H, BUS_LEN),
    [sideDoors, sidePlain, flatT(busRoofTex(body)), darkM,
      flatT(busRearTex(body, band)), flatT(busFrontTex(body, band))],
  );
  shell.position.y = BUS_Y0 + BUS_H / 2;
  g.add(shell);

  // roof cap, slightly inset — breaks the silhouette so it isn't one brick
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_HW * 2 - 0.16, 0.12, BUS_LEN - 0.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(body).multiplyScalar(0.94) }),
  );
  cap.position.set(0, BUS_Y0 + BUS_H + 0.05, 0);
  g.add(cap);

  // the roller sign, above the windshield
  const roll = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.06), flatT(busRollTex()));
  roll.position.set(0, BUS_Y0 + BUS_H - 0.30, -BUS_LEN / 2 - 0.02);
  g.add(roll);

  // wheels: front axle well forward, rear axle set back, as on a real bus
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatT(hubcapTex());
  const busFront: THREE.Mesh[] = [];
  for (const wx of [-BUS_HW + 0.06, BUS_HW - 0.06]) for (const wz of [BUS_AXLE_F, BUS_AXLE_R]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 10), [tireM, capM, capM]);
    // YZX: the steer angle must turn the wheel about its own VERTICAL, after
    // the cylinder has been laid on its side — with the default XYZ order the
    // Y rotation would apply first and steer about the tilted axle instead.
    // At steer 0 this is the same matrix as the plain rotation.z it replaces.
    w.rotation.order = 'YZX';
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(wx, 0.44, wz);
    g.add(w);
    if (wz === BUS_AXLE_F) busFront.push(w);
  }
  g.userData.wheelbase = BUS_AXLE_R - BUS_AXLE_F;   // 5.5 m
  g.userData.steer = (a: number) => { for (const w of busFront) w.rotation.y = a; };
  g.userData.halfLen = BUS_LEN / 2;   // the traffic collider is longer for this one
  g.userData.laneX = 1.35;            // hugs the centre line to clear parked cars
  g.userData.speed = 6.4;             // and it is slower than the cars
  // the kerb-side door panel swaps to a leaves-open version while it stands
  // at the stop. Front door is at local z = -2.35, which is what the sim
  // lines up with the flag pole.
  g.userData.doorZ = -2.35;
  let shown = false;
  g.userData.setDoors = (open: boolean) => {
    if (open === shown) return;
    shown = open;
    (shell.material as THREE.Material[])[0] = open ? sideOpen : sideDoors;
  };
  return g;
}

/** Which corner. Front is -z (the model is built nose-first), and with forward
 *  -z and up +y the LEFT side is -x — so 'fl' is (-x, -z). */
export type Corner = 'fl' | 'fr' | 'rl' | 'rr';

/** A car that is not just parked. Everything here is OFF by default and every
 *  option is additive: with no options this function builds exactly the meshes
 *  it always did, in the same order. That is deliberate rather than tidy —
 *  three.js burns four `Math.random()` calls per object in `generateUUID`, so a
 *  single extra mesh re-grains every unseeded texture painted after it and the
 *  whole world's fingerprint moves (GOTCHAS §1). A lot full of jacked cars must
 *  not be able to change the pigeons. */
export interface CarState {
  /** Bonnet up on its hinge, with a dark engine bay underneath. */
  hood?: boolean;
  /** Corners with no wheel fitted. */
  wheelsOff?: Corner[];
  /** That corner up on a jack: wheel off, and the body tilted onto the other
   *  three. Implies `wheelsOff`. */
  jack?: Corner;
  /** Off the road for good: all four wheels off, body down on block stacks. */
  blocks?: boolean;
}

export function makeCar(kind: CarKind, colorIdx: number, taxi = false, state: CarState = {}): THREE.Group {
  let hoodPanel: THREE.Mesh | null = null;
  const body = taxi ? '#c9a12e' : CAR_COLORS[colorIdx % CAR_COLORS.length];
  const flatT = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });
  const bodyM = new THREE.MeshBasicMaterial({ color: new THREE.Color(body) });
  const glassM = new THREE.MeshBasicMaterial({ color: 0x1c2836, side: THREE.DoubleSide });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  // Dark glass under a sodium lamp stays dark glass; rubber stays black.
  // Flag them so the lamplight registry skips them outright — a warmed
  // greenhouse reads as a brown slab, which is not a lighting effect.
  glassM.userData.noLight = true;
  darkM.userData.noLight = true;
  const g = new THREE.Group();

  const spec = {
    sedan: { len: 4.5, wheelZ: 1.45 },
    hatch: { len: 3.8, wheelZ: 1.2 },
    pickup: { len: 4.9, wheelZ: 1.65 },
    van: { len: 4.6, wheelZ: 1.5 },
  }[kind];
  const half = spec.len / 2;

  // ── the body slab: rocker to beltline ───────────────────────────────────
  //
  // On the PICKUP it STOPS at the back of the cab. It used to run the whole
  // length, and that one fact is why two separate requests for a deeper bed
  // failed to land: the tub's floor was nested INSIDE this solid box (floor top
  // 0.645 against a slab top of 0.84), so what you actually saw as the bed
  // floor was this slab's top face — plain body colour, 0.13 m below the rail.
  // Lowering the buried floor from 0.77 to 0.62 moved a surface nobody could
  // see. A bed floor has to sit BELOW the beltline, so the body cannot be solid
  // there; the bed is built as a real open tub below.
  // 0.89 AND 0.84 WERE BELT IN DISGUISE. The hood slab's centre was typed as
  // 0.89, meaning "the belt plus half of its own 0.1 thickness", and the
  // greenhouse's base as 0.84, meaning "the belt" — in all four kinds. Raising
  // the beltline is the fix I recommend for the wheel proportion
  // (notes/BLOCKED-H.md); with those literals in place it would have left the
  // hood BURIED 0.05 m inside the slab and the greenhouse floating clear of it,
  // on every vehicle. Found by actually trying BELT = 0.94 and noticing the hood
  // apex did not move, which is also the blind spot scripts/carstate.mjs had.
  const BED_Z0 = 0.55;                                  // bed front, behind the cab
  const ROCKER = 0.34, BELT = 0.84;                     // the slab's own extent
  const slabLen = kind === 'pickup' ? half + BED_Z0 : spec.len;
  const slabZ = kind === 'pickup' ? (BED_Z0 - half) / 2 : 0;
  const plan = doorPlan(kind, half);
  const sideT = flatT(bodySideTex(body, slabLen, spec.wheelZ, taxi, BELT - ROCKER,
    // only the front arch is on the cab body once the slab is short
    kind === 'pickup' ? [-spec.wheelZ - slabZ] : [-spec.wheelZ, spec.wheelZ],
    plan, slabZ - slabLen / 2));
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, BELT - ROCKER, slabLen),
    [sideT, sideT, bodyM, darkM, flatT(carRearTex(body)), flatT(carFrontTex(body))],
  );
  slab.position.set(0, (ROCKER + BELT) / 2, slabZ);
  g.add(slab);

  const roofM = flatT(panelTopTex(body, 24));
  const hoodM = (seam: number) => [bodyM, bodyM, flatT(panelTopTex(body, seam)), bodyM, bodyM, bodyM];

  if (kind === 'sedan') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, half - 0.9), hoodM(40));
    hood.position.set(0, BELT + 0.05, -(half + 0.95) / 2 + 0.02);
    hoodPanel = hood; g.add(hood);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, half - 1.32), hoodM(8));
    // 0.885 is BELT plus half the lid thickness, same disguise as the hood
    trunk.position.set(0, BELT + 0.045, (half + 1.35) / 2);
    g.add(trunk);
    g.add(loftCabin(0.81, 0.74, BELT, 1.46, -1.0, 1.4, -0.35, 0.9, glassM, roofM, flatT(cabinSideTex(plan.glass, -1.0, 1.4))));
  } else if (kind === 'hatch') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, half - 0.75), hoodM(40));
    hood.position.set(0, BELT + 0.05, -(half + 0.8) / 2 + 0.02);
    hoodPanel = hood; g.add(hood);
    // no trunk: the rear glass slopes all the way to the tail
    g.add(loftCabin(0.81, 0.72, BELT, 1.44, -0.85, half - 0.15, -0.25, half - 0.95, glassM, roofM, flatT(cabinSideTex(plan.glass, -0.85, half - 0.15))));
  } else if (kind === 'pickup') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.5), hoodM(40));
    hood.position.set(0, BELT + 0.05, -half + 0.85);
    hoodPanel = hood; g.add(hood);
    // short cab, near-vertical rear window
    g.add(loftCabin(0.85, 0.74, BELT, 1.5, -1.0, 0.45, -0.45, 0.32, glassM, roofM, flatT(cabinSideTex(plan.glass, -1.0, 0.45))));
    // ── THE BED: a real open tub, floor BELOW the beltline ────────────────
    //
    // Rebuilt rather than nudged, because the bed has now been asked about
    // twice and the reason both previous passes failed is structural, not a
    // number: the slab ran solid through here, so the tub's floor was inside
    // it and the visible "floor" was the slab's body-coloured top face, 0.13 m
    // under the rail. Now the slab stops at the cab (see above) and the bed is
    // a genuine box: skin, floor, headboard, tailgate.
    //
    //   rail top   0.97   unchanged — a real pickup's rail sits near the base
    //                     of the cab glass, and a playtest already rejected it
    //                     standing proud of the beltline
    //   floor top  0.50   so the inside is 0.47 m deep, which is a 1997
    //                     half-ton bed, and lands just above the axle line
    //   skin       0.34 … 0.97 — the outer wall now spans rocker to rail, so
    //                     it carries the body side art the slab used to
    const RAIL_T = 0.97;
    const FLOOR_T = 0.50;               // the floor's TOP surface
    const WALL_T = 0.16, GATE_T = 0.10;
    const HW = 0.9;                     // body half-width — the slab is 1.8 wide
    const SKIN_H = RAIL_T - ROCKER;     // 0.63 m of outer wall
    const wallLen = (half - GATE_T) - BED_Z0;
    const bedMidZ = BED_Z0 + wallLen / 2;
    // Painted at the same texel density as the cab slab beside it (that face is
    // 96 texels over slabLen, and 20 over its 0.5 m), so the bed's paint is not
    // finer or coarser than the cab's.
    const PPM_X = 96 / slabLen, PPM_Y = 40;
    const skinW = Math.round(wallLen * PPM_X), skinH = Math.round(SKIN_H * PPM_Y);
    const yRow = (worldY: number) => Math.round((RAIL_T - worldY) * PPM_Y);
    const bedSkinT = pixTex(skinW, skinH, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, skinW, skinH);
      // the same three lines the cab slab carries, at the same WORLD heights,
      // so they run on across the seam instead of stepping at it
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, skinW, 2);        // rail cap
      g2.fillStyle = 'rgba(255,255,255,0.18)'; g2.fillRect(0, yRow(0.84), skinW, 3); // beltline
      g2.fillStyle = '#d8dade'; g2.fillRect(0, yRow(0.64), skinW, 1);              // chrome strip
      g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(0, yRow(0.44), skinW, skinH - yRow(0.44)); // rocker
      // the rear wheel arch, one ellipse — same reversion as the cab flank's,
      // for the same reason. See the note there.
      // same fix as the cab flank's: radius in METRES, converted with this
      // face's own px/m, so the bed's arch matches the cab's instead of being
      // whatever 10 texels happens to mean on a 1.8 m panel
      // THE WELL IS NOT BLACK — it is shadowed body metal, the same rule and the
      // same multiplier the cab flank uses. This was '#0a0b0e' and the cab was
      // fixed to `body * 0.34` without it, so a pickup carried TWO different
      // arches: a shadowed one on the cab and a near-black one on the bed. On a
      // dark car nobody sees the difference; on the tan pickup — the vehicle the
      // user was pointing at — the bed arch reads as a hard black rectangle
      // stamped on the side, which is their words for it exactly: "The arch is
      // a black RECTANGLE, not an arch."
      g2.fillStyle = `#${new THREE.Color(body).multiplyScalar(0.34).getHexString()}`;   // bodyC is declared BELOW this painter
      const ax = Math.round(((spec.wheelZ - bedMidZ + wallLen / 2) / wallLen) * skinW);
      g2.beginPath();
      // same two metres as the cab flank's, in this face's own density
      g2.ellipse(ax, skinH, Math.max(3, Math.round(0.38 * PPM_X)), Math.max(3, Math.round(0.38 * PPM_Y)), 0, Math.PI, 0);
      g2.fill();
    });
    bedSkinT.minFilter = THREE.NearestFilter;   // GOTCHAS §4 — see the liner below
    // The tailgate IS the back of the truck now, so it carries the tail lights
    // and the step bumper. Painted symmetrically and, unlike before, nothing is
    // coplanar with it — the slab's rear face is 1.8 m forward, behind the
    // headboard. The asymmetric lights the user saw were two symmetric painted
    // lights inside a z-fight, not a texture fault (GOTCHAS §6).
    const gateW = Math.round(HW * 2 * PPM_X), gateH = skinH;
    const bedRearT = pixTex(gateW, gateH, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, gateW, gateH);
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, gateW, 2);        // rail cap
      g2.fillStyle = 'rgba(0,0,0,0.3)';                                           // latch
      g2.fillRect(Math.round(gateW * 0.42), yRow(0.72), Math.round(gateW * 0.16), 3);
      const lw = Math.max(3, Math.round(gateW * 0.17)), lh = 4;
      g2.fillStyle = '#8a1c1c';
      g2.fillRect(Math.round(gateW * 0.07), yRow(0.58), lw, lh);
      g2.fillRect(gateW - Math.round(gateW * 0.07) - lw, yRow(0.58), lw, lh);
      g2.fillStyle = '#d8dade'; g2.fillRect(0, yRow(0.44), gateW, 3);             // step bumper
    });
    bedRearT.minFilter = THREE.NearestFilter;
    const bodyC = new THREE.Color(body);
    const outM = flatT(bedSkinT);
    const rimM = new THREE.MeshBasicMaterial({ color: bodyC.clone().multiplyScalar(1.16) });
    // ── the liner: NEAR-BLACK, and that is the point ───────────────────────
    //
    // It used to be the body colour scaled by 0.6, which on this palette is
    // #6d6646 against a #8a825a body — to the eye, the same green, which is
    // most of why the bed read as a pressed dish. Nothing in this world casts
    // a shadow, so the darkness of a cavity has to be PAINTED or it does not
    // exist. Flagged noLight for the same reason the glass is: a sodium lamp
    // warming the inside of a bed to amber is not a lighting effect.
    const linerM = new THREE.MeshBasicMaterial({ color: 0x16171a });
    linerM.userData.noLight = true;
    // ribs front-to-back, deliberately COARSE: this is a near-horizontal face
    // read at a grazing angle, which is the tailgate's own problem (GOTCHAS
    // §4). Wide bands, no dither, NearestFilter.
    const inW = HW * 2 - WALL_T * 2;
    const floorT = pixTex(Math.round(inW * 16), Math.round(wallLen * 16), (g2) => {
      const W = Math.round(inW * 16), H = Math.round(wallLen * 16);
      g2.fillStyle = '#16171a'; g2.fillRect(0, 0, W, H);
      for (let x = 2; x < W; x += 8) {                     // 0.25 m ribs
        g2.fillStyle = 'rgba(255,255,255,0.07)'; g2.fillRect(x, 0, 3, H);
        g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(x + 3, 0, 1, H);
      }
    });
    floorT.minFilter = THREE.NearestFilter;
    const floorM = flatT(floorT);
    floorM.userData.noLight = true;
    const floor2 = new THREE.Mesh(
      new THREE.BoxGeometry(inW, 0.05, wallLen),
      [linerM, linerM, floorM, darkM, linerM, linerM]);
    floor2.position.set(0, FLOOR_T - 0.025, bedMidZ);
    g.add(floor2);
    // side walls: outer face flush with the slab's own side plane at ±0.9 (they
    // used to stand at ±0.85, a 5 cm step in the body line), inner face liner
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_T, SKIN_H, wallLen),
        s < 0 ? [linerM, outM, rimM, darkM, linerM, linerM] : [outM, linerM, rimM, darkM, linerM, linerM],
      );
      wall.position.set(s * (HW - WALL_T / 2), (ROCKER + RAIL_T) / 2, bedMidZ);
      g.add(wall);
    }
    // ── THE WHEEL WELL IS A BOX, NOT A HOLE ────────────────────────────────
    //
    // The user, with the diagnosis attached: "the tyre penetrates through into
    // the bed cavity, so looking down into the bed you can see the wheel inside
    // the truck… you cut an arch into the outer panel but did not build a WELL.
    // A real wheel well is a box: an outer arch, an INNER WALL that separates
    // the tyre from the load space, and a top that closes it."
    //
    // Exactly right, and the arithmetic agrees. The bed's side wall spans x
    // 0.74…0.90. The rear tyre spans 0.70…0.94 and tops out at 0.68 against a
    // bed floor at 0.50. So the tyre passes clean through the wall, pokes 4 cm
    // into the cavity and stands 18 cm proud of the floor. On a sedan that is
    // hidden inside a closed body; on an open bed it is in plain sight.
    //
    // Inner wall plus lid, per rear wheel. The lid's top face at 0.76 IS the
    // hump a real pickup has over its rear wheels — free, once the well is a
    // box. All liner-dark, because every face of it that anyone can see is seen
    // from inside the bed, and the floor's darkening is what the user asked for
    // and likes.
    const WELL_IN = 0.66, WELL_TOP = 0.72, WELL_LID = 0.04;
    for (const s of [-1, 1]) {
      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, WELL_TOP - FLOOR_T, 0.86), linerM);
      inner.position.set(s * (WELL_IN + 0.02), (FLOOR_T + WELL_TOP) / 2, spec.wheelZ);
      g.add(inner);
      // The lid's TOP face is the bed floor continuing over the well, so it takes
      // the floor's own ribbed material — index 2 is +Y, the same slot floor2
      // uses. All liner-dark made the hump vanish into the floor it rises out
      // of; the ribs are what make it read as the floor STEPPING UP, which is
      // the thing the user says is the most recognisable part of a pickup bed.
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(HW - WELL_IN, WELL_LID, 0.86),
        [linerM, linerM, floorM, linerM, linerM, linerM]);
      lid.position.set(s * ((WELL_IN + HW) / 2), WELL_TOP + WELL_LID / 2, spec.wheelZ);
      g.add(lid);
    }

    // headboard, sealed against the back of the cab. Sits BETWEEN the walls so
    // its sides are not coplanar with their outer faces (GOTCHAS §6).
    const head = new THREE.Mesh(new THREE.BoxGeometry(inW, SKIN_H, 0.1),
      [linerM, linerM, rimM, darkM, linerM, linerM]);
    head.position.set(0, (ROCKER + RAIL_T) / 2, BED_Z0 + 0.05);
    g.add(head);
    // tailgate closes the end: the walls stop at half - GATE_T so the two ABUT
    // instead of overlapping
    const gate = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, SKIN_H, GATE_T),
      [outM, outM, rimM, darkM, flatT(bedRearT), linerM]);
    gate.position.set(0, (ROCKER + RAIL_T) / 2, half - GATE_T / 2);
    g.add(gate);
  } else { // van
    // tall box greenhouse, stub hood, near-vertical everything
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.8), hoodM(40));
    hood.position.set(0, BELT + 0.05, -half + 0.5);
    hoodPanel = hood; g.add(hood);
    g.add(loftCabin(0.85, 0.8, BELT, 1.78, -half + 0.85, half - 0.1, -half + 1.35, half - 0.2, glassM, roofM, flatT(cabinSideTex(plan.glass, -half + 0.85, half - 0.1))));
  }

  if (taxi) {
    const signT = pixTex(32, 12, (g2) => {
      g2.fillStyle = '#141416'; g2.fillRect(0, 0, 32, 12);
      g2.fillStyle = '#f2c94a'; g2.font = 'bold 8px monospace';
      g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText('TAXI', 16, 7);
    });
    signT.minFilter = THREE.NearestFilter;   // 0.18 m tall with letters on it — see busRollTex
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.24), flatT(signT));
    sign.position.set(0, 1.55, -0.1);
    g.add(sign);
  }

  // wheels
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatT(hubcapTex());
  const front: THREE.Mesh[] = [];
  // ±0.82 — the pre-arch position, restored. Yes, 0.24 m of tyre centred there
  // puts its outer sidewall at 0.94 against a flank at 0.90, so 0.04 m stands
  // proud. That sliver is also the only reason the wheel reads as a circle at
  // all, because the flank is opaque: moving it inboard to 0.72 stopped the
  // poking and buried the wheel, which was worse. See the arch note above.
  // Which corners are bare. `jack` implies its own corner; `blocks` means all
  // four. Empty for a normal car, so the loop below adds the same four meshes
  // in the same order it always has.
  const off = new Set<Corner>(state.wheelsOff ?? []);
  if (state.jack) off.add(state.jack);
  if (state.blocks) for (const c of ['fl', 'fr', 'rl', 'rr'] as Corner[]) off.add(c);

  for (const wx of [-0.82, 0.82]) for (const wz of [spec.wheelZ, -spec.wheelZ]) {
    const corner = `${wz < 0 ? 'f' : 'r'}${wx < 0 ? 'l' : 'r'}` as Corner;
    if (off.has(corner)) continue;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), [tireM, capM, capM]);
    // see makeBus: YZX so steering turns the wheel about its own vertical.
    // Front is -z (the whole model is built nose-first, see the file header).
    w.rotation.order = 'YZX';
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(wx, 0.34, wz);
    g.add(w);
    if (wz === -spec.wheelZ) front.push(w);
  }
  // The paint, published rather than left to be guessed at: scripts/carstate.mjs
  // needs it to prove the engine bay is NOT body-coloured, and inferring it as
  // "the commonest colour on the car" picks the tyre black off the four wheels.
  g.userData.body = body;
  // THE BODY'S OWN DIMENSIONS, for the same reason. carstate.mjs opened with
  // `const ROCKER = 0.34, BELT = 0.84, HOOD_TOP = 0.94, TYRE_R = 0.34` — its own
  // copy of four numbers that live here, in two places in that file, used in
  // twelve assertions. Raising the beltline is the fix I recommend for the wheel
  // proportion (notes/BLOCKED-H.md), and it would have left every one of those
  // comparing against a stale sill: the probe guarding the change would have
  // been the thing broken by it. dd5ecde4 hit exactly this and called it "my
  // harness was carrying a stale width".
  g.userData.rocker = ROCKER;
  g.userData.belt = BELT;
  g.userData.hoodTop = BELT + 0.10;      // the hood slab sits ON the belt, 0.1 thick
  g.userData.tyre = 0.34;
  g.userData.wheelbase = spec.wheelZ * 2;
  g.userData.steer = (a: number) => { for (const w of front) w.rotation.y = a; };

  // ── not-just-parked: hood up, on a jack, up on blocks ────────────────────
  //
  // Everything below is skipped entirely unless asked for. See CarState.
  if (state.hood && hoodPanel) {
    // Swing the panel about its REAR edge, which is where the hinge is on all
    // four kinds — the hood is built butted up to the windscreen base, so
    // rotating the nose end up moves it away from the glass, not into it.
    const L = (hoodPanel.geometry as THREE.BoxGeometry).parameters.depth;
    const py = hoodPanel.position.y, hinge = hoodPanel.position.z + L / 2;
    hoodPanel.geometry.translate(0, 0, -L / 2);          // origin to the hinge
    hoodPanel.position.set(hoodPanel.position.x, py, hinge);
    hoodPanel.rotation.x = 0.95;                          // ~54°, nose end up

    // A RAISED HOOD OVER BODY-COLOURED METAL IS THE TRUCK BED BUG AGAIN. The
    // slab runs the full length under the bonnet with its top face at BELT, so
    // opening the hood on its own just exposes more green — the same "surface
    // nobody could see" that made two deep-bed requests fail. The bay has to
    // be near-black for the opening to read as a hole, because an unlit world
    // has no shadow of its own to darken it.
    const bayM = new THREE.MeshBasicMaterial({ color: 0x14161a });
    bayM.userData.noLight = true;                         // a lit engine bay reads as a brown tray
    const z0 = hinge - L + 0.06, z1 = hinge - 0.06;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.07, z1 - z0), bayM);
    bay.position.set(0, BELT - 0.02, (z0 + z1) / 2);      // top 0.01 above the slab: a lip of body colour shows all round
    g.add(bay);

    // Coarse lumps only. This is a small area seen from above at a grazing
    // angle — GOTCHAS §4 — so: three big shapes, no dither, no fine trim. The
    // round air cleaner is what makes it read as an engine at three metres.
    const engM = new THREE.MeshBasicMaterial({ color: 0x35383e });
    const capM2 = new THREE.MeshBasicMaterial({ color: 0x1d1e22 });
    engM.userData.noLight = true; capM2.userData.noLight = true;
    const zc = (z0 + z1) / 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.17, Math.min(0.62, (z1 - z0) * 0.55)), engM);
    block.position.set(0, BELT + 0.07, zc);
    g.add(block);
    const air = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 10), capM2);
    air.position.set(0, BELT + 0.19, zc);
    g.add(air);
    const batt = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.15, 0.32), new THREE.MeshBasicMaterial({ color: 0x2b2a1c }));
    (batt.material as THREE.MeshBasicMaterial).userData.noLight = true;
    batt.position.set(0.6, BELT + 0.06, z1 - 0.24);
    g.add(batt);
    g.userData.hoodOpen = true;
  }

  if (state.jack) {
    // A car on a jack TILTS. Without that it reads as a car with a wheel
    // missing parked next to a stand. The tilt has to apply to the whole body
    // and not to `g`, whose rotation.y belongs to the caller — so the body
    // moves into an inner group, which is also why this is opt-in only.
    const sx = state.jack[1] === 'l' ? -1 : 1, sz = state.jack[0] === 'f' ? -1 : 1;
    const body = new THREE.Group();
    for (const c of [...g.children]) body.add(c);         // copy: add() mutates g.children
    // 0.10 m of lift across a 1.64 m track and a wheelbase of spec.wheelZ*2.
    body.rotation.z = -sx * 0.061;
    body.rotation.x = sz * (0.10 / (spec.wheelZ * 2));
    body.position.y = 0.03;
    g.add(body);

    const jm = new THREE.MeshBasicMaterial({ color: 0x24262a });
    jm.userData.noLight = true;
    const jx = sx * 0.74, jz = sz * (spec.wheelZ - 0.35);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.24), jm);
    base.position.set(jx, 0.02, jz);
    g.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.30, 0.09), jm);
    post.position.set(jx, 0.19, jz);
    g.add(post);
    g.userData.jack = state.jack;
  }

  if (state.blocks) {
    // Sitting on stacks, not floating: three courses of 0.11 reach 0.33, and
    // the rocker is at ROCKER = 0.34, so the top course touches the sill.
    const bm = new THREE.MeshBasicMaterial({ color: 0x6e6862 });
    for (const bx of [-0.74, 0.74]) for (const bz of [spec.wheelZ, -spec.wheelZ]) {
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.24), bm);
        b.position.set(bx, 0.055 + i * 0.11, bz);
        g.add(b);
      }
    }
    g.userData.onBlocks = true;
  }

  return g;
}

import * as THREE from 'three';
import { declareSurface, pixTex, dither } from './paint';
import {
  facadeTex, facadeLitTex, shopfrontTex, resGroundTex, ENTRANCE, SHOP_BAND_H, masonry, SHOP_MULT, wallHeight, FLOOR_M,
  proud, reveal, glazed, mullions, HI, shopfrontRelief, shopInteriorTex, WALK_PROJECTION,
  burgerFront, pawnFront, taxFront,
} from './tex-world';
import { walkTex, floorDrain } from './tex-ground';
import { buildCatRig } from './cat';
import type { CtxBuild } from './ctx';
import { buildCivic, type BldSpec } from './civic';
import { buildVice } from './vice';
import { L, ROAD_HALF, WALK, FACE } from './rng';
import { type AABB } from '../fp';
import { buildAlley } from './alley';
import { buildBodegaCorner } from './bodega-corner';
import { buildBank } from './bank';

// The alley's floor height lives in `ct/alley-floor.ts`, a LEAF module with no
// imports, and is re-exported here so nothing that already asked this file has
// to change. It is a leaf on purpose: `ct/cat.ts` needs the floor and
// `ct/alley.ts` needs the cat, so keeping the height in either would close a
// cycle — and a cycle here is GOTCHAS §28, a fault that is real in the BUILT
// bundle and invisible in dev.
export { ALLEY_SLAB_Y, alleyFloorY } from './alley-floor';


// Every building on the block, hand-authored end to end, plus the alley
// cut into the west wall. Adds meshes + billboard sprites; owns no state.

// ── SHARED SHELL VOCABULARY, hoisted to module scope and exported ──────────
//
// These were closures inside `buildStreet`. Nothing about them changed; they
// moved so that `ct/vice.ts` can call them, because GOLDEN ACES and HOTEL
// ORPHEUS still carry the two faults the user has raised twice — a flat
// untextured brown on every return, and a 3.4 m deep box — and every other
// building on the block was fixed by exactly these two functions.
//
// vice.ts is G's and I am not to edit it. What I can do is make the fix two
// lines instead of a rewrite:
//
//     const dep = depthOf(b.nm);
//     const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, dep),
//       shellMaterials(flat, 4, facade, dep, h, b.w, b.brick, gh, true, roofM));
//
// `depthOf` is a hash of the name, so a building keeps its depth across runs
// and two neighbours do not come out the same. `shellMaterials` puts the facade
// on the face you name and a real party wall — stepped scar, chimney breasts,
// blocked windows, weather per metre — on every other, which is what a return
// actually looks like and what `endM`'s flat colour never could.
export const depthOf = (nm: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < nm.length; i++) h = Math.imul(h ^ nm.charCodeAt(i), 0x01000193) >>> 0;
    return 14 + ((h >>> 9) % 6) * 1.9;               // 14 … 23.5 m
  };

  const partyWallTex = (
    brick: string, wM: number, hM: number, baseY: number, cope: boolean, salt: number,
  ) => {
    const ms = masonry(wM, hM, baseY);
    let hh = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    const mark = (n: number) => {
      hh = Math.imul(hh ^ (hh >>> 15), 0x2c1b3c6d) >>> 0;
      return (hh >>> 9) % Math.max(1, n);
    };
    return ms.paint((g) => {
      g.fillStyle = brick; g.fillRect(0, 0, ms.W, ms.H);
      ms.courses(g);
      const steps = 2 + mark(3);
      const ridge = ms.m(hM * (0.50 + mark(4) * 0.06));
      let x = 0;
      for (let i = 0; i <= steps; i++) {
        const x1 = Math.round(ms.W * ((i + 1) / (steps + 1)));
        const top = ridge + ms.m((mark(5) - 2) * 0.55);
        g.fillStyle = 'rgba(214,198,170,0.12)';
        g.fillRect(x, top, x1 - x, ms.H - top);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(x, top, x1 - x, Math.max(1, ms.m(0.09)));
        x = x1;
      }
      const breasts = 1 + mark(3);
      for (let i = 0; i < breasts; i++) {
        const bx = ms.m(1.5) + mark(Math.max(1, Math.round(wM - 3))) * ms.ppm;
        const bw = ms.m(0.9 + mark(3) * 0.3);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(bx, ridge, bw, ms.H - ridge);
        g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(bx + bw, ridge, Math.max(1, ms.m(0.12)), ms.H - ridge);
      }
      const blocked = 1 + mark(4);
      for (let i = 0; i < blocked; i++) {
        const wx = ms.m(1.2) + mark(Math.max(1, Math.round(wM - 3))) * ms.ppm;
        const wy = ridge + ms.m(1.0) + mark(4) * ms.m(1.4);
        const ww = ms.m(1.1), wh = ms.m(1.4);
        if (wy + wh > ms.H - ms.m(0.5) || wx + ww > ms.W) continue;
        g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        g.fillStyle = 'rgba(168,140,112,0.45)'; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(0,0,0,0.15)';
        for (let c = 0; c < 6; c++) g.fillRect(wx, wy + Math.round((c * wh) / 6), ww, 1);
        g.fillStyle = '#9a8a72'; g.fillRect(wx - 1, wy + wh, ww + 2, Math.max(1, ms.m(0.14)));
      }
      // weather, PER METRE. It was a flat 14 per wall, so a 32 m park flank
      // got the same fourteen streaks as a 6 m shop return.
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < Math.max(6, Math.round(wM * 1.1)); i++) {
        g.fillRect((i * 37) % ms.W, 0, 2, Math.round(ms.H * ((i % 5) / 6)));
      }
      if (cope) {                                             // only where it IS the top
        g.fillStyle = '#8a7a62'; g.fillRect(0, 0, ms.W, ms.m(0.5));
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, ms.m(0.5), ms.W, ms.m(0.16));
      }
      dither(g, ms.W, ms.H, Math.round(wM * hM * 5));
    });
  };

  const flankSalt = (brick: string, wM: number, hM: number) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < brick.length; i++) h = Math.imul(h ^ brick.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ Math.round(wM * 8), 0x01000193) >>> 0;
    return Math.imul(h ^ Math.round(hM * 8), 0x01000193) >>> 0 >>> 16;
  };
  const flankTex = (brick: string, wM: number, hM: number, baseY: number, cope: boolean) =>
    partyWallTex(brick, wM, hM, baseY, cope, flankSalt(brick, wM, hM));

  /** the six materials of a shell: its front where the front goes, and its own
   *  masonry on every side and return. `fi` is the BoxGeometry face index the
   *  facade belongs on (0 +x, 1 -x, 4 +z, 5 -z). */
export const shellMaterials = (
    flat: (t: THREE.Texture) => THREE.MeshBasicMaterial,
    fi: number, facade: THREE.Material, dx: number, dy: number, dz: number,
    brick: string, baseY: number, cope: boolean, roofM: THREE.Material,
  ) => {
    const xt = flat(flankTex(brick, dz, dy, baseY, cope));    // the +-x faces span z
    const zt = flat(flankTex(brick, dx, dy, baseY, cope));    // the +-z faces span x
    const m: THREE.Material[] = [xt, xt, roofM, roofM, zt, zt];
    m[fi] = facade;
    return m;
  };


export function buildStreet(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  sidewalkY: number; KERB_H: number;
  boards: { m: THREE.Mesh }[];
  AZ0: number; AZ1: number;
  SIDE_X1: number; SIDE_Z0: number; SIDE_Z1: number;
  // Four fields that already exist on CtxBuild, passed through so this module
  // can register its OWN [E] instead of one being hand-written in the entry
  // point — which is what ctx.spot exists for (ctx.ts: "a module describes its
  // own furniture and the entry point never learns what any of it is").
  // Additive: crosstown.ts gains four names in one object literal and nothing
  // it already passes changes. Flagged for the desk, as with the purse field.
  spot: CtxBuild['spot'];
  purse: CtxBuild['purse'];
  refreshWallet: CtxBuild['refreshWallet'];
  // `ground` is the newest of the four and it is the collision half of the
  // dished alley paving: ct/park.ts and ct/civic.ts already register theirs
  // this way, so this is the established pattern rather than a new one.
  ground: CtxBuild['ground'];
}) {
  const { scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1 } = o;
  /** the module-scope painter with this build's `flat` bound in — same six
   *  materials as before, same call sites, so nothing in this file changed. */
  const shellMats = (
    fi: number, facade: THREE.Material, dx: number, dy: number, dz: number,
    brick: string, baseY: number, cope: boolean, roofM: THREE.Material,
  ) => shellMaterials(flat, fi, facade, dx, dy, dz, brick, baseY, cope, roofM);
  // ── collision, registered by the module that draws the building ─────────
  //
  // This used to be two rectangles hand-written in crosstown.ts spanning the
  // whole block, which meant collision could not follow geometry: the library
  // courtyard was walled off by a blanket that knew nothing about it, and the
  // bodega's canted corner collided square. Same failure the [E] spots and the
  // frame hooks already outgrew, same fix — whoever draws it registers it.
  //
  // The two numbers every footprint below is built from:
  //   CUSH the cushion in FRONT of a facade, so nothing projecting sticks
  //        through the collider into the walking lane (GOTCHAS §9). It was a
  //        flat 0.3 on every building, written before the shopfront relief
  //        existed and sized by guess. It is now `WALK_PROJECTION` — 0.12,
  //        the depth of the deepest thing the relief actually puts at walking
  //        height (the jamb; the cornice is deeper but it is 3.5 m up).
  //
  //        That 0.18 m difference was the single biggest encroachment on the
  //        block. notes/lane-audit.md: "the clear lane is 1.70 m, not 2.00 m
  //        — before anyone puts anything on it… 15 % of the sacred 2 m is
  //        consumed by collision that corresponds to no geometry, everywhere,
  //        permanently." Giving it back is worth more than every individual
  //        lamp post and tree in that audit put together.
  //
  //        The BANK keeps 0.30, because its granite portal genuinely projects
  //        that far (DREC below) — there the cushion describes real stone.
  //   8    the depth BEHIND a facade. Shells are only 3.4 m deep; the extra
  //        stops you running round the back into the dead ground.
  const CUSH = WALK_PROJECTION;
  // ── whose mesh is this ──────────────────────────────────────────────────
  //
  // `userData.mod` makes "whose face is this" a LOOKUP instead of geography.
  // 501f5d74 measured what geography has cost: 726 of 3383 meshes stamped, all
  // from two modules, so 79 % of every cross-agent attribution this week was
  // inference — and inference misrouted thirteen faults onto ct/lot.ts, cost
  // 9e1bce93 two rounds, and nearly misrouted a third time. I did two of those
  // attributions myself, by hand, from coordinates (the lamp splash and pool).
  //
  // This module is a special case worth being careful about: `buildStreet`
  // CALLS other agents' builders — E's library and church, G's casino and
  // hotel, the cat rig — and they add straight to the same scene. Stamping
  // everything added during this function would put my name on their
  // geometry, which is precisely the false attribution the mechanism exists to
  // stop. So each of those calls is bracketed and stamped with ITS OWN owner
  // first, and `street` is applied last to whatever is still unclaimed.
  //
  // Never overwrites: first writer wins, so a module that stamps itself keeps
  // its own answer.
  const stampFrom = (mark: number, mod: string) => {
    for (let i = mark; i < scene.children.length; i++) {
      scene.children[i].traverse((n) => { if (!n.userData.mod) n.userData.mod = mod; });
    }
  };
  const STREET_MARK = scene.children.length;
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); return b; };
  // `kind` takes a building OUT of the shopfront system entirely — a civic
  // building is not a brick box with an awning and a painted name on it, and
  // the two that carry this block get their own builders below.
  //
  // ── the block, re-cast ────────────────────────────────────────────────
  //
  // Widths are load-bearing, not decoration. Three runs have to land on an
  // exact number and every roster below is balanced to hit it:
  //   · WEST before the alley must total 51.2 so PAWN ends on AZ0 = -37
  //   · WEST after it must total 54.5 so the last shell ends on -98, where
  //     the corner building takes over
  //   · EAST before No. 227 must total 49.2, because the walk-up's door and
  //     its interior live in ct/apartment.ts at a fixed z
  // Change a width and you must pay for it out of a neighbour in the same run.
  const WEST: (BldSpec | 'alley' | 'park' | 'bank')[] = [
    // DINER and LAUNDRY swapped IDENTITIES, not slots — the widths stay where
    // they are, so both run totals are untouched (51.2 before the alley, 54.5
    // after). Moving the entries bodily would have cost 2.8 m of
    // reconciliation in each run for nothing. The diner also wants the wider
    // frontage, and the far side of the alley had nothing to eat on it.
    // LAUNDRY 9.2 + MERIDIAN 10 merged into one 19.2 m bank — the run before
    // the alley still totals 51.2. MERIDIAN was the corporation, and a branch
    // bank plays that part better: institutional, flat, and still the right
    // foil for the library next door.
    'bank',
    { nm: 'LIBRARY', col: '', w: 16, brick: '', floors: 0, kind: 'library' },
    // the loudest thing on the block, in the widest slot on this side, right
    // up against the quietest — that contrast is doing a lot of work here
    { nm: 'BURGER BARN', col: '#c8302a', w: 16, brick: '#7a4a3a', floors: 4, front: 'burger' },
    'alley',
    // z -55.5 … -43.5, centre -49.5 — ct/int-diner.ts anchors its door here
    { nm: 'DINER', col: '#8a5a22', w: 12, brick: '#6b4034', floors: 4 },
    // BARBER and THRIFT swapped identities — widths stay, so the run still
    // totals 54.5. The swap is what MAKES the park: it puts BARBER beside
    // GROCERY, and those two together are the 30 m running down to z = -98
    // where the corner building takes over. With THRIFT between them there
    // was no 30 m to give away without breaking the run.
    { nm: 'THRIFT', col: '#7a5a2c', w: 12.5, brick: '#5c4436', floors: 4 },
    'park',   // the old BARBER 14 + GROCERY 16, given over — see placePark
  ];
  const EAST: (BldSpec | 'lot')[] = [
    // CAFE 11.2 + HARDWARE 12 given over to a used car lot. Already adjacent,
    // so no swap — and the run before No. 227 still totals 49.2, which is
    // load-bearing: the walk-up's door and interior sit at a fixed z in
    // ct/apartment.ts.
    'lot',
    { nm: 'A-1 TAX', col: '#2c4a7a', w: 13, brick: '#7a4a3a', floors: 5, front: 'tax' },
    { nm: 'LIQUOR', col: '#8a2c42', w: 13, brick: '#835444', floors: 4 },
    { nm: '', col: '', w: 18, brick: '#835444', floors: 5, res: true }, // No. 227 — home, across from the alley, a bit off
    // PAWN pays the 3 m. DELI + RECORDS were 21 m and the nave is 18, and the
    // post-227 run must still total 43 so the last shell lands on -96 — so the
    // difference goes to the church's north neighbour rather than overflowing
    // the run. No. 227 is untouchable: ct/apartment.ts depends on its z.
    { nm: 'PAWN', col: '#6a5a3a', w: 15, brick: '#5c4436', floors: 5, front: 'pawn' },
    { nm: 'ST BRIGID', col: '', w: 18, brick: '', floors: 0, kind: 'church' },
    { nm: 'BODEGA', col: '#b8342a', w: 10, brick: '#6b4034', floors: 3 }, // the corner store
  ];
  // The side street. It runs east into the fog, and the far end of it is
  // somewhere else: the casino and the hotel that feeds it sit out at x = 34
  // and beyond, read at 40 m through the haze, and are not part of this
  // block's life. Both rosters stop dead on x = 57, where the cross building
  // that closes the street begins.
  const NORTH2: BldSpec[] = [
    { nm: 'FLOWERS', col: '#4a7a52', w: 6, brick: '#835444', floors: 3 }, // half of it is the bodega's now
    { nm: 'CHOP SUEY', col: '#8a3a2e', w: 11, brick: '#5c4436', floors: 3 },
    { nm: 'HOTEL ORPHEUS', col: '#6a4a2c', w: 12, brick: '#7a4a3a', floors: 5 },
    { nm: 'GOLDEN ACES', col: '#8a2c42', w: 11.55, brick: '#5c4436', floors: 4 },
  ];
  const SOUTH2: BldSpec[] = [
    // the church has moved to the main block; the two shops it displaced take
    // its old slot. 9.5 + 8.5 = the 18 m the church vacated, so this run still
    // totals 64 and still ends dead on x = 57.
    { nm: 'DELI', col: '#2e6a34', w: 9.5, brick: '#6b4034', floors: 3 },
    { nm: 'RECORDS', col: '#6a2c6a', w: 8.5, brick: '#7a4a3a', floors: 3 },
    { nm: 'GARAGE', col: '#5a5f66', w: 12, brick: '#5c4436', floors: 3 },
    { nm: 'BILLIARDS', col: '#2c5a3a', w: 12, brick: '#835444', floors: 4 },
    { nm: 'SMOKES', col: '#8a6a22', w: 11, brick: '#6b4034', floors: 3 },
    { nm: 'LOANS', col: '#7a6a2c', w: 11, brick: '#7a4a3a', floors: 4 },
  ];
  // Buildings ABUT — a shell is exactly b.w deep, never b.w + slop. Two
  // neighbours share the boundary plane; their facade quads meet edge to
  // edge instead of overlapping, so there is no coplanar strip to z-fight
  // (same rule that fixed the corner road: abut, never overlap).
  // The three shopfronts that are NOT the block default — BURGER BARN, PAWN
  // and A-1 TAX — now live in ct/tex-world.ts next to shopfrontTex, which is
  // the system they are variants of. They were here, in a file owned by
  // somebody who did not own that system, and drifting is what that split
  // bought us: the burger barn kept its mustard through three fixes.
  // A shop's ground floor and a flat's are NOT the same height, and pretending
  // they were is what made every storefront on this block read undersized:
  // 3.2 m of band left only 1.92 m of glass, shorter than the door beside it.
  // Shops get SHOP_BAND_H; the walk-up keeps ENTRANCE.BAND_H, which is what
  // ct/apartment.ts hangs its door in and is already the right size.
  const bandOf = (b: BldSpec) => (b.res ? ENTRANCE.BAND_H : SHOP_BAND_H);
  // ── the block goes to bed ────────────────────────────────────────────────
  //
  // Lit windows used to be painted INTO the facade, so the same rooms were lit
  // at four in the morning as at nine at night — and at one in the afternoon,
  // which is the version you actually notice. The light is now its own
  // transparent sheet hung a couple of centimetres off each facade, and its
  // opacity is a function of the hour.
  //
  // Two things make this cheap rather than clever. `facadeLitTex` shares the
  // window grid with `facadeTex`, so the light cannot slide off its holes; and
  // props.dimWorld() skips any material with `transparent` set, so the night
  // grading that darkens the brick leaves the light alone without either side
  // having to know about the other.
  // TWO sheets, not one, because a block that fades all its windows together
  // is still one pattern — just a dimmer one at four in the morning. The
  // EVENING set is the block at home; the SMALL-HOURS set is a different,
  // much sparser set of rooms, and they cross-fade past each other so the
  // windows that are on at three are not the windows that were on at nine.
  const eveMats: THREE.MeshBasicMaterial[] = [];
  const lateMats: THREE.MeshBasicMaterial[] = [];
  const SHEETS = [
    { list: eveMats, variant: 0, pct: 19, off: 0.02 },
    { list: lateMats, variant: 1, pct: 8, off: 0.035 },
  ];
  // hang both sheets on a facade. `nx`/`nz` is the way the facade looks; the
  // sheets stand at slightly different offsets along it so two coplanar quads
  // never have to be ordered against each other.
  const litSheets = (
    b: BldSpec, wM: number, hM: number,
    x: number, y: number, z: number, ry: number, nx: number, nz: number,
  ) => {
    for (const sh of SHEETS) {
      const m = new THREE.MeshBasicMaterial({
        map: facadeLitTex(b.brick, b.floors, wM, { variant: sh.variant, pct: sh.pct }),
        transparent: true, opacity: 0, depthWrite: false,
      });
      // THIS SHEET CARRIES ITS OWN LIGHT — do not grade it down after dark.
      // It is already left alone, but for the wrong reason: props.ts's
      // `isGlass` is `m.transparent && !(m.alphaTest > 0)`, and these are
      // transparent, so the grader skips them as GLASS. They are not glass.
      // That is incidental, not a decision: tighten `isGlass` to actually
      // mean glass — entirely reasonable, it is B's file — and every lit
      // window on the block starts dimming at night with nothing on record
      // saying it must not.
      //
      // `userData.selfLit` is the convention for saying so (ct/paint.ts
      // documents it; props.ts stamps it on the signage path). No behaviour
      // changes today — measured, `graded` stays false either way. It makes
      // the exclusion DECLARED, and it answers the question A's nightgrade
      // asks of every ungraded material: 34 sheets that were never offered
      // to the dimmer, and now they say why.
      m.userData.selfLit = true;
      sh.list.push(m);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), m);
      // WHICH SET OF ROOMS THIS SHEET IS. The user's complaint had two halves
      // and only one is visible in a frame: "lit at one in the afternoon" a
      // camera can see, but "the same windows at 4am as at 8pm" it cannot —
      // a warm-pixel count is non-linear in opacity and cannot tell a window
      // at 0.35 from a window that is off (scripts/windowlights.mjs records
      // the numbers that proved it). The fact only this file knows is WHICH
      // sheet is which, so it says so, and a checker can read the two
      // opacities instead of guessing at pixels. Same move as userData.mod
      // and userData.facing.
      p.userData.litSheet = sh.variant === 0 ? 'evening' : 'late';
      p.position.set(x + nx * sh.off, y, z + nz * sh.off);
      p.rotation.y = ry;
      p.renderOrder = 2;                                // over its own facade
      scene.add(p);
    }
  };
  // Not a light sensor — people. Nobody switches a lamp on at noon, the block
  // is at its fullest around nine, and by four in the morning it is down to
  // whoever is still up. Both curves are continuous across midnight: they
  // leave hour 24 at the value they enter hour 0 with.
  const ramp = (a: number, b: number, t: number) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  const eveAt = (h: number) => {
    if (h < 5) return 1 - ramp(22.5, 24.5, h + 24);      // last night's tail
    if (h < 6.5) return 0.35 * ramp(5, 6.5, h);          // kettles on
    if (h < 7) return 0.35;
    if (h < 9.5) return 0.35 * (1 - ramp(7, 9.5, h));    // out for the day
    if (h < 16.5) return 0;                              // nobody lights a room at noon
    if (h < 20) return ramp(16.5, 20, h);                // home, a window at a time
    if (h < 22.5) return 1;                              // the block at its fullest
    return 1 - ramp(22.5, 24.5, h);                      // going to bed
  };
  const lateAt = (h: number) => {
    const t = h < 12 ? h + 24 : h;                       // one axis across midnight
    if (t < 21.5) return 0;
    if (t < 23) return ramp(21.5, 23, t);                // the ones who stay up
    if (t < 28) return 1;                                // …until four
    return 1 - ramp(28, 31, t);                          // gone by seven
  };
  const setWindows = (hourF: number) => {
    const e = eveAt(hourF), l = lateAt(hourF);
    for (const m of eveMats) m.opacity = e;
    for (const m of lateMats) m.opacity = l;
  };

  const placeBld = (side: number, z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const gh = bandOf(b);
    const dep = depthOf(b.nm || 'res'), cx = side * (FACE + dep / 2);
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = shellMats(side < 0 ? 0 : 1, facade, dep, h, b.w, b.brick, gh, true, roofM);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(dep, h, b.w), mats);
    // WHICH WAY THIS SHELL FACES. A BoxGeometry carries width/depth in world
    // axes and nothing that says which of them is the DEPTH — that depends on
    // whether the shell fronts the main street or a cross street, and only the
    // placer knows. Inferring it from position outside this file misreads the
    // alley's end wall and the bodega's corner block (notes/D-alley-report.md),
    // so the fact is published instead of guessed. Same reasoning as
    // userData.mod: whoever knows, says.
    //
    // 'x' means the facade's normal runs along x, so the shell's DEPTH is its
    // x extent. Only real shells carry it, which is what lets a checker tell a
    // building from a wall without a list of exceptions.
    wall.userData.facing = 'x';
    wall.position.set(cx, h / 2 + gh, cz);
    scene.add(wall);
    litSheets(b, b.w, h, side * FACE, h / 2 + gh, cz,
      side < 0 ? Math.PI / 2 : -Math.PI / 2, -side, 0);
    // MOVED ABOVE THE PAINTER, and it has to stay there. shopfrontRelief
    // registers where this frontage is in the world, and the painter needs
    // that registration to resolve the door position the ROOM declared —
    // paint first and it has nothing to resolve against, so the facade
    // quietly falls back to its own guess. Also adds the projecting mouldings;
    // nothing there projects past the 0.30 m solid() already reserves, so it
    // adds no collision. The walk-up (b.res) has a doorcase, not a shopfront.
    if (!b.res) shopfrontRelief({
      scene, name: b.nm, wMeters: b.w, trim: b.col,
      x: side * FACE, z: cz, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
    });
    const shopM = flat(
      b.res ? resGroundTex(b.brick, b.w)
        : b.front === 'burger' ? burgerFront(b.brick, b.w)
          : b.front === 'pawn' ? pawnFront(b.brick, b.w)
            : b.front === 'tax' ? taxFront(b.brick, b.w)
              : shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = shellMats(side < 0 ? 0 : 1, shopM, dep, gh, b.w, b.brick, 0, false, roofM);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(dep, gh, b.w), shopMats);
    shop.position.set(cx, gh / 2, cz);
    scene.add(shop);
    roofKit(cx, cz, dep, b.w, gh + h, b.nm || 'res');
    // collision follows the real footprint, not a fixed 8 m guess
    solid(side < 0
      ? { minX: -FACE - dep, maxX: -FACE + CUSH, minZ: cz - b.w / 2, maxZ: cz + b.w / 2 }
      : { minX: FACE - CUSH, maxX: FACE + dep, minZ: cz - b.w / 2, maxZ: cz + b.w / 2 });
  };
  // ── civic stone ─────────────────────────────────────────────────────────
  //
  // The library and the church live in `ct/civic.ts` — they share no
  // vocabulary with the shopfront system below (ashlar not brick, arches not
  // rectangles, cut letters not painted bands, real depth in the silhouette)
  // and splitting them off lets a second builder work them without touching
  // this file. street.ts still owns WHERE they stand; civic.ts owns what
  // they look like.
  const { placeLibrary, placeChurch } = buildCivic({ scene, flat, KERB_H });
  // ── how deep a building is ──────────────────────────────────────────────
  //
  // Every shell on the block was 3.4 m deep. That is a corridor, not a
  // building, and it is the "fake building" complaint: a real commercial block
  // is 15-30 m. It never showed while the street was an unbroken wall on both
  // sides and you never saw a return — it shows everywhere now the park, the
  // car lot, the alley and the church have opened the block up.
  //
  // Depth VARIES per building, hashed off the name so it is deterministic and
  // so the backs are not a second flat wall 20 m behind the first. A block
  // where every mass is the same depth is its own kind of fake.
  //
  // METRES CLAIMED, so E and C can plan against them (see notes/BLOCKED-D.md):
  //   west shells  x -7 … -30.5 at the deepest      park back wall is x -14
  //   east shells  x  7 …  30.5 at the deepest      lot  back wall is x  15
  // The two sites sit in z-gaps in those runs, so nothing overlaps — but if E
  // or C wants a site as deep as the block around it, the room is there and
  // this is the number to match.

  // ── what you now see on top ─────────────────────────────────────────────
  //
  // Deep buildings mean you see their ROOFS — from the park, from the car lot,
  // from the alley, from anywhere the block has been opened. A 20 m slab of
  // flat colour up there is worse than the 3.4 m corridor was, so every shell
  // gets the things that are actually on a roof: a parapet standing above the
  // deck, a stair bulkhead, a water tank on legs, and a vent or two. Placed
  // deterministically off the name so the skyline varies without jittering.
  const roofKit = (cx: number, cz: number, dx: number, dz: number, top: number, nm: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < nm.length; i++) h = Math.imul(h ^ nm.charCodeAt(i), 0x01000193) >>> 0;
    const r = () => { h = Math.imul(h ^ 0x9e3779b1, 0x01000193) >>> 0; return (h >>> 8) / 0xffffff; };
    const deckM = new THREE.MeshBasicMaterial({ color: 0x33343a });
    const wallM = new THREE.MeshBasicMaterial({ color: 0x6b5f52 });
    const tankM = new THREE.MeshBasicMaterial({ color: 0x5a4632 });
    // parapet: a low upstand round the deck, which is what gives a roofline
    // its edge instead of letting the wall just stop
    for (const [px, pz, sx, sz] of [
      [cx, cz - dz / 2 + 0.15, dx, 0.3], [cx, cz + dz / 2 - 0.15, dx, 0.3],
      [cx - dx / 2 + 0.15, cz, 0.3, dz], [cx + dx / 2 - 0.15, cz, 0.3, dz],
    ] as [number, number, number, number][]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.62, sz), wallM);
      p.position.set(px, top + 0.31, pz);
      scene.add(p);
    }
    // stair bulkhead — every flat roof has one, it is how you get out there
    const bw = 2.2 + r() * 1.2, bd = 2.0 + r() * 1.0;
    const bulk = new THREE.Mesh(new THREE.BoxGeometry(bw, 2.4, bd), deckM);
    bulk.position.set(cx + (r() - 0.5) * (dx - bw - 1.2), top + 1.2, cz + (r() - 0.5) * (dz - bd - 1.2));
    scene.add(bulk);
    // a timber water tank on legs, if the roof is big enough to hold one
    if (dx > 12 && dz > 8) {
      const tx = cx + (r() - 0.5) * (dx - 4), tz2 = cz + (r() - 0.5) * (dz - 4);
      for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]] as [number, number][]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), tankM);
        leg.position.set(tx + lx, top + 0.95, tz2 + lz);
        scene.add(leg);
      }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.3, 9), tankM);
      tank.position.set(tx, top + 3.05, tz2);
      scene.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.6, 9), new THREE.MeshBasicMaterial({ color: 0x3f3a33 }));
      cap.position.set(tx, top + 4.5, tz2);
      scene.add(cap);
    }
    // vents
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), deckM);
      v.position.set(cx + (r() - 0.5) * (dx - 2), top + 0.35, cz + (r() - 0.5) * (dz - 2));
      scene.add(v);
    }
  };

  // ── flanks: a return is made of what the building is made of ────────────
  //
  // `endM` was ONE flat brown — 0x53382e — on the sides, ends and returns of
  // every building on the block, whatever its front was made of. So the bank's
  // pale precast front met a brown brick flank and the corner read as a stage
  // flat with something else propped up behind it.
  //
  // A blind party wall IS correct: a flank does not want the front's windows,
  // its glazing or its sign. What it must not be is a different MATERIAL. So
  // the flank is derived from the same `brick` the front is painted from, at
  // the same masonry density, phased off the same world-Y course grid — and
  // every building gets its own instead of sharing a constant.
  //
  // Same family as the two patterns already fixed: one masonry density for the
  // world, one authoring of the door position. The defect is always the same
  // fact decided twice, or decided once and applied where it does not belong.
  // ── ONE party-wall painter, for every exposed return on the block ───────
  //
  // Opening the park, the car lot, the alley and the churchyard exposed a lot
  // of flanks that were never meant to be seen, and they all read as freshly
  // built blank brick — which is the "fake building" complaint again, one
  // surface further round. A flank that nobody was meant to see is not blank.
  // It carries what it was built against:
  //
  //   the SCAR      the demolished neighbour's roofline, stepped down the
  //                 wall, drawn as the LIGHTER area rather than as a line —
  //                 brick that spent decades sheltered is cleaner than brick
  //                 that spent them in the weather, so the ghost is the clean
  //                 part, not a stripe
  //   BREASTS       the chimneys they shared, shallow pilasters dying at the
  //                 old roofline
  //   BLOCKED-UP    windows bricked shut when they stopped facing a room and
  //                 started facing the street, in their own course rhythm
  //                 with the cill left proud
  //
  // This used to exist TWICE — here for the buildings and again inside
  // openSite for the park's and the lot's walls, which is how the two drifted
  // (the sites had the marks and the buildings did not). One painter now.
  //
  // Everything is hashed off `salt`, so two flanks of one building do not
  // wear identical scars, and none of it touches rnd() (GOTCHAS §2).

  // ── open sites ──────────────────────────────────────────────────────────
  //
  // A hole in the street wall — the park, and now the used car lot. They are
  // the same object: a piece of frontage given up, with ground you can walk
  // on, the neighbours' newly exposed party walls finished off, and a rear
  // elevation so the gap opens onto a city instead of onto fog. What goes IN
  // them is somebody else's file (the park is E's ct/park.ts, the lot is C's
  // ct/lot.ts) exactly the way the library and the church are.
  //
  // One builder, not two, because the second site would otherwise be the same
  // sixty lines with the signs flipped — and the mistakes worth making once
  // are the ones already commented here.
  //
  // `side` is -1 for the west run and +1 for the east, and every x below is
  // written through it so neither case is a special case.
  interface Site { minX: number; maxX: number; minZ: number; maxZ: number; y: number }
  const openSite = (
    side: -1 | 1, z: number, w: number,
    o: { depth: number; ground: string; grain: string; back: string; flank: string; gate: number },
  ): Site => {
    const XB = side * FACE, XF = XB + side * o.depth;       // street edge, back
    const z0 = z - w, z1 = z;
    const lo = Math.min(XF, XB), hi = Math.max(XF, XB);
    // the ground. A PLANE at exactly KERB_H that ABUTS the walk rather than
    // overlapping it — two coplanar tops z-fight (GOTCHAS §6).
    const groundT = declareSurface(pixTex(64, 64, (g) => {
      g.fillStyle = o.ground; g.fillRect(0, 0, 64, 64);
      g.fillStyle = o.grain;
      for (let i = 0; i < 90; i++) g.fillRect((i * 23) % 64, (i * 41) % 64, 2, 1);
      for (let i = 0; i < 60; i++) g.fillRect((i * 17) % 64, (i * 29) % 64, 1, 1);
      dither(g, 64, 64, 260);
    }), 'ground');
    groundT.wrapS = groundT.wrapT = THREE.RepeatWrapping;
    groundT.repeat.set(o.depth / 2, w / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(o.depth, w), wet(flat(groundT)));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((XF + XB) / 2, KERB_H, (z0 + z1) / 2);
    scene.add(floor);
    // the two party walls the site has just exposed, given a finished face.
    // masonry() phases its courses off world Y, so they run level with the
    // brick on the street elevation either side instead of starting again —
    // which is the difference between a party wall and the raw end of a shell.
    // A party wall is not a wall somebody built. It is the side of a building
    // that used to have another building against it, and everything on it is
    // evidence of the one that went: the stepped scar where its roof ran, the
    // chimney breasts that were shared, the windows bricked up when they
    // stopped facing a room and started facing the street.
    //
    // This mattered much less when these sites were 7 and 8 m deep. At 32 m
    // and 23 m a blank flank is most of what you see from inside, and 32 m of
    // unmarked brick reads as a prison yard rather than as a hole in a block.
    //
    // `mark` is a deterministic hash off the site so the two flanks of one
    // site do not wear identical scars.
    const wallTex = (wM: number, hM: number, brick: string, salt: number) =>
      partyWallTex(brick, wM, hM, 0, true, salt);
    const fh = wallHeight(4);
    for (const [zAt, ry] of [[z1 - 0.01, Math.PI], [z0 + 0.01, 0]] as [number, number][]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(o.depth, fh), flat(wallTex(o.depth, fh, o.flank, ry > 1 ? 3 : 7)));
      p.position.set((XF + XB) / 2, fh / 2, zAt);
      p.rotation.y = ry;
      scene.add(p);
    }
    // the back of the site, so the gap opens onto a city and not onto fog.
    //
    // It is a PARTY WALL already — `wallTex` above is a two-line wrapper around
    // `partyWallTex`, so this carries the stepped scar, chimney breasts,
    // blocked-up windows and per-metre streaks, and has since the two painters
    // were merged into one. Salt 11 keeps it distinct from the flanks at 3 and
    // 7. The queue item's warning that "at 32 m the park's back wall ... needs
    // to be worth looking at, not a flat slab" is already answered here.
    //
    // I briefly replaced this line with a direct partyWallTex call and a
    // derived salt, on the belief that `wallTex` was plain brick. It is not,
    // and the change was a no-op dressed as a fix. Reverted.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, fh), flat(wallTex(w, fh, o.back, 11)));
    back.position.set(XF - side * 0.01, fh / 2, (z0 + z1) / 2);
    back.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(back);
    solid(side < 0
      ? { minX: XF - 8, maxX: XF, minZ: z0, maxZ: z1 }
      : { minX: XF, maxX: XF + 8, minZ: z0, maxZ: z1 });
    // a low boundary along the street line with the middle left open, so the
    // site has an edge rather than bleeding into the pavement.
    //
    // IT SITS INSIDE THE SITE, not on the pavement. It used to be centred at
    // `XB - side * 0.18`, i.e. straddling the street line with half its
    // thickness — the whole 0.36 m, once the collider rounded outward — lying
    // in the walk, for the entire length of both runs on both sites.
    //
    // Builder C measured it rather than arguing it (notes/C-frontage.md,
    // scripts/lot-frontage.mjs): the clear band past the lot read 1.30 m
    // against a 1.54 m control on the same walk with no lot on it, and the
    // script named this wall as the overlap, twice, reaching 0.36 m in. That
    // is 18 % of the sacred 2 m (GOTCHAS §9) taken the whole way along, and
    // the park shares this helper so it was paying it twice over.
    //
    // A boundary belongs on its own land. `XB + side * 0.18` puts the face
    // flush with the street line and the body behind it, which is also what
    // C's own module already does — "everything this module builds is at
    // x >= 7.18".
    const railM = new THREE.MeshBasicMaterial({ color: 0x6d6455 });
    for (const [rz0, rz1] of [[z0 + 0.3, z0 + w * o.gate], [z1 - w * o.gate, z1 - 0.3]] as [number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, rz1 - rz0), railM);
      wall.position.set(XB + side * 0.18, KERB_H + 0.31, (rz0 + rz1) / 2);
      scene.add(wall);
      solid({ minX: Math.min(XB, XB + side * 0.36), maxX: Math.max(XB, XB + side * 0.36), minZ: rz0, maxZ: rz1 });
    }
    return { minX: lo, maxX: hi, minZ: z0, maxZ: z1, y: KERB_H };
  };
  // 30 m of the west side, where BARBER and GROCERY stood. Contents: E, in
  // ct/park.ts.
  //
  // DEEP — 32 m, not the 7 it opened with. The shells either side of it now run
  // 14–23.5 m back, and a 7 m yard between them read as a notch cut in a solid
  // block rather than as a park. These are the same metres the building-depth
  // item claims, and where the two want the same ground the open space wins:
  // a shallow park reads as a gap, whereas a building 18 m deep instead of 24
  // reads as a building. At 32 m its back wall is at x -39, clear of the
  // deepest shell on this side (x -30.5), so nothing is actually contested.
  let PARK: Site = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, y: KERB_H };
  const placePark = (z: number, w: number) => {
    PARK = openSite(-1, z, w, {
      depth: 32.0, ground: '#6a6f58', grain: '#5c6249', back: '#6b4034', flank: '#835444', gate: 0.36,
    });
  };
  // 23.2 m of the east side, where CAFE and HARDWARE stood. Contents — the
  // surfacing, the fence, the office, the signage and the stock — are C's, in
  // ct/lot.ts. A car lot is deeper than a park because it has to hold cars,
  // and its ground is broken asphalt rather than grass.
  let LOT: Site = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, y: KERB_H };
  const placeLot = (z: number, w: number) => {
    LOT = openSite(1, z, w, {
      depth: w, ground: '#4a4c50', grain: '#3e4044', back: '#5c4436', flank: '#6b4034', gate: 0.3,
    });
  };
  // ── the bank, and the ATM in its wall ───────────────────────────────────
  //
  // 491 lines of it used to sit inline here; it is `ct/bank.ts` now. Same rule
  // as the alley and the corner: the FILE moved and the CALL DID NOT, because
  // paint order re-grains every texture created after it (GOTCHAS §31) and the
  // seeded `rnd()` stream moves every tree and pigeon downstream (GOTCHAS §2).
  const { placeBank } = buildBank({
    scene, KERB_H, flat, solid, shellMats, depthOf, roofKit, litSheets,
    spot: o.spot, purse: o.purse, refreshWallet: o.refreshWallet,
  });
  let zw = 14.2;
  for (const b of WEST) {
    if (b === 'alley') { zw = AZ1; continue; }
    if (b === 'park') { placePark(zw, 30); zw -= 30; continue; }
    if (b === 'bank') { placeBank(zw, 19.2); zw -= 19.2; continue; }
    if (b.kind === 'library') { const m = scene.children.length; placeLibrary(zw, b); stampFrom(m, 'civic'); }
    else placeBld(-1, zw, b);
    zw -= b.w;
  }
  // The church stands on the main block now, and `placeChurch` builds along +x
  // with its facade on +z — the side-street axis it was authored for. Rather
  // than ask E to parameterise that (ct/civic.ts is E's), the church is built
  // into a GROUP and the group is turned: `buildCivic` only ever calls
  // scene.add and registers nothing, so a Group is a perfectly good scene, and
  // the transform is arithmetic on my side of the line.
  //
  // rotation.y = -π/2 sends local +x → world +z and local +z → world -x. So
  // the nave runs down the block from `z - b.w` to `z`, and the facade — local
  // +z, 1.7 out from the group origin — lands on x = FACE looking west across
  // the street, exactly where placeBld puts an east shopfront.
  const placeChurchEast = (z: number, b: BldSpec) => {
    const g = new THREE.Group();
    buildCivic({ scene: g as unknown as THREE.Scene, flat, KERB_H }).placeChurch(0, 0, b);
    g.rotation.y = -Math.PI / 2;
    g.position.set(FACE + 1.7, 0, z - b.w);
    g.traverse((n) => { if (!n.userData.mod) n.userData.mod = 'civic'; });
    scene.add(g);
    // NO blanket footprint here any more. This used to be
    //
    //     solid({ minX: FACE - 0.3, maxX: FACE + 8, minZ: z - b.w, maxZ: z });
    //
    // one box over the whole frontage, written when the church WAS a plain
    // slab and had no colliders of its own. The church is inlaid now and
    // ct/civic.ts registers the real thing — the nave, the tower and the
    // churchyard walls — so this box was doing nothing except sealing the
    // churchyard shut, exactly the way the old blanket wall sealed E's
    // library courtyard. Same mistake, same shape, second time.
    //
    // WALKED, not assumed, because this is the collider whose removal made
    // the church walk-through once before (E's patch note, and my own
    // handoff). Along the whole frontage, walking east off the pavement:
    //
    //     z -88 … -62   held at x 6.26 … 6.59   the churchyard wall
    //     z -80         in, to x 9.23           the GATE, which is the point
    //     from inside, east   stopped at x 9.24 the nave is still solid
    //     from inside, west   back out to the street
    //     eye height 1.62 everywhere, in and out — no floor hole at the gate
    //
    // E's scripts/E-yard-walk.mjs passes all four of its walks too.
  };
  let ze = 14.2;
  let bodegaZ0 = 0; // the bodega turns the corner — hand-built below, not by placeBld
  for (const b of EAST) {
    if (b === 'lot') { placeLot(ze, 23.2); ze -= 23.2; continue; }
    if (b.nm === 'BODEGA') { bodegaZ0 = ze; ze -= b.w; continue; }
    if (b.kind === 'church') placeChurchEast(ze, b); else placeBld(1, ze, b);
    ze -= b.w;
  }
  // side-street rosters run along x; facade on the street-facing z side
  const placeBldZ = (x0: number, zc: number, b: BldSpec, facing: 1 | -1) => {
    const cx = x0 + b.w / 2;
    const gh = bandOf(b);
    const dep = depthOf(b.nm), front = zc + facing * 1.7;
    const czd = front - facing * dep / 2;             // centre of the deeper shell
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = shellMats(facing > 0 ? 4 : 5, facade, b.w, h, dep, b.brick, gh, true, roofM);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, dep), mats);
    wall.userData.facing = 'z';        // cross-street shells front along z
    wall.position.set(cx, h / 2 + gh, czd);
    scene.add(wall);
    litSheets(b, b.w, h, cx, h / 2 + gh, front,
      facing > 0 ? 0 : Math.PI, 0, facing);
    // registered before the painter runs — see placeBld
    shopfrontRelief({
      scene, name: b.nm, wMeters: b.w, trim: b.col,
      x: cx, z: front, rotY: facing > 0 ? 0 : Math.PI,
    });
    const shopM = flat(shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = shellMats(facing > 0 ? 4 : 5, shopM, b.w, gh, dep, b.brick, 0, false, roofM);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w, gh, dep), shopMats);
    shop.position.set(cx, gh / 2, czd);
    scene.add(shop);
    roofKit(cx, czd, b.w, dep, gh + h, b.nm);
    solid(facing > 0
      ? { minX: x0, maxX: x0 + b.w, minZ: front - dep, maxZ: front + CUSH }
      : { minX: x0, maxX: x0 + b.w, minZ: front - CUSH, maxZ: front + dep });
  };
  // The bodega is the anchor store on this corner, so it does not stop at the
  // canted bay — it runs on down the side street, taking the first 6 m of what
  // used to be the FLOWERS frontage (FLOWERS is 6 m wide now, and everything
  // east of it is where it always was). Starts at BX1 = FACE + 3.4 so the wing
  // ABUTS the corner block exactly.
  const BODEGA_WING = 6.05;
  // THIS LINE PUBLISHES THE BODEGA'S FRONTAGE, AND IT IS THE WING'S, NOT THE
  // DOOR'S. Read this before trusting `__frontages['BODEGA']` for anything.
  //
  // `placeBldZ` paints the band from `nm` and `shopfrontRelief` registers the
  // frontage from the same `nm`, so this call publishes an axis-x frontage on
  // the side street's north face at z = -96 with a door at x 12.82 — the wing's
  // PAINTED door, which is decorative and opens onto nothing (checked: no [E]
  // fires anywhere along x 11.0…14.6).
  //
  // The customer door is round the corner on the canted bay at (8.0, -95.0),
  // 5 m away and on a different wall. It is published by `DOOR.face` in
  // ct/int-bodega.ts and readable through `declaredDoors()` / `doorStandFor`,
  // which is what the [E] uses and what `crosstown.ts`'s `doors:` affordance
  // exists to expose. `Placement` is axis-aligned (`axis: 'x' | 'z'`), so a 45°
  // face cannot register a correct frontage at all — that is the root of it.
  //
  // So: for a CUT FACE, `declaredDoors()` is the authority and `__frontages` is
  // not. Nothing consumes the wrong entry today; it goes live the moment anyone
  // derives door geometry from the frontage roster. notes/BLOCKED-D.md has the
  // three ways out and why none of them is mine to pick.
  placeBldZ(FACE + 3.4, -94.3, { nm: 'BODEGA', col: '#b8342a', w: BODEGA_WING, brick: '#6b4034', floors: 3 }, -1);
  let xn = FACE + 3.4 + BODEGA_WING;
  const sideSpans: Record<string, [number, number]> = {};
  // GOLDEN ACES and HOTEL ORPHEUS are built by ct/vice.ts — they are not
  // shopfronts and are not made of shopfront parts (same argument that took the
  // library and the church into ct/civic.ts). street.ts still owns where they
  // stand: the roster above and this cursor. Called from INSIDE the loop rather
  // than afterwards so the paint order is unchanged — the fingerprint harness
  // seeds Math.random, so moving a texture's creation shifts the grain of every
  // texture painted after it.
  const vice = buildVice({ scene, flat, solid, KERB_H });
  for (const b of NORTH2) {
    sideSpans[b.nm] = [xn, xn + b.w];
    if ((vice.VICE as readonly string[]).includes(b.nm)) { const m = scene.children.length; vice.placeShell(xn, -94.3, b); stampFrom(m, 'vice'); }
    else placeBldZ(xn, -94.3, b, -1);
    xn += b.w;
  }
  // The signs at the far end of the side street are ct/vice.ts's too — the
  // casino's rooftop pylon and the hotel's blade. Invoked here, at the point in
  // the sequence they were built at before, for the paint-order reason above.
  { const m = scene.children.length; vice.placeSigns(sideSpans); stampFrom(m, 'vice'); }
  let xs = -7;
  for (const b of SOUTH2) {
    if (b.kind === 'church') { const m = scene.children.length; placeChurch(xs, -111.7, b); stampFrom(m, 'civic'); }
    else placeBldZ(xs, -111.7, b, 1);
    xs += b.w;
  }
  // ── the bodega turns the corner on a canted bay ─────────────────────────
  //
  // The classic American corner store does not meet the intersection with a
  // square 90° arris. It cuts the corner off at 45° for the FULL height of
  // the elevation — ground floor to cornice — and puts the entrance in that
  // angled face, so the door addresses the crossing diagonally and both
  // streets see a shopfront. The upper storeys carry the same brick and the
  // same window rhythm as the rest of the building; it is one bay of the
  // elevation, not a notch cut in the shopfront.
  //
  // Plan (the shell is a rectangle with the south-west corner triangle taken
  // out, so it is built as two boxes plus the canted bay and a roof cap):
  //
  //        z=-86  ┌──────────────┐  BX1 = FACE+3.4
  //               │      R1      │
  //     z=-94.2   ├───────┬──────┤
  //               │  cut  │  R2  │
  //        z=-96  └╲______┴──────┘
  //                 ╲ canted bay, A→B
  //               BX0 = FACE
  // The canted corner is `ct/bodega-corner.ts` now — 353 lines of it used to
  // sit inline here. Same rule as the alley: the FILE moved and the CALL DID
  // NOT, because paint order re-grains every texture created after it
  // (GOTCHAS §31) and the seeded `rnd()` stream moves every tree and pigeon
  // downstream (GOTCHAS §2).
  buildBodegaCorner({
    scene, bodegaZ0, KERB_H, sidewalkY, flat, wet, solid, shellMats,
    bod: EAST[EAST.length - 1] as BldSpec,   // BODEGA — last on the roster
  });
  // south-west corner building closes the side street's west end
  placeBld(-1, -98, { nm: 'RADIO', col: '#3a4a7a', w: 12, brick: '#835444', floors: 4 });
  // east cross building — the side street disappears into the fog toward it
  {

    const eRoof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const eWall = new THREE.Mesh(
      new THREE.BoxGeometry(6, 13.6, 24),
      shellMats(1, flat(facadeTex('#5c4436', 4, 24, 13.6, 0)), 6, 13.6, 24, '#5c4436', 0, true, eRoof),
    );
    eWall.position.set(SIDE_X1 + 5, 6.8, (SIDE_Z0 + SIDE_Z1) / 2);
    scene.add(eWall);
  }

  // billboard registry (declared early — the alley adds to it too)
  interface Board { m: THREE.Mesh }

  // cross building closing the north end; the south end turns the corner now
  {
    // 13.6 m tall, not wallHeight(4) = 13.0 — pass the real face or the
    // texture is painted for a wall that does not exist and lands at 7.65 up
    //
    // THIS is the object in shots/user-bankflank.png, not the bank. It used to
    // be a 30 m box at z 13.5…19.5 while the bank runs to z 14.2, so the two
    // shells INTERPENETRATED by 0.7 m — a brick block standing through the
    // bank's precast front, floor to parapet, meeting it at a razor arris with
    // nothing between. Raycasting from that screenshot's camera hits this box
    // on every ray; the bank's own returns are behind it.
    //
    // It now ABUTS instead of overlapping (GOTCHAS §6: coplanar surfaces must
    // abut, never overlap — the same rule that fixed the alley walls and the
    // building seams), and it is only as wide as the gap it has to close, so
    // it stops barging across the building line on either side.
    const NZ = 14.2;                                   // the block's north end
    const CAP_W = 2 * FACE;                            // exactly the street, no more
    const CAP_D = 6;
    const facade = flat(facadeTex('#5c4436', 4, CAP_W, 13.6, 0));
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(CAP_W, 13.6, CAP_D),
      shellMats(5, facade, CAP_W, 13.6, CAP_D, '#5c4436', 0, true, roofM));
    wall.position.set(0, 6.8, NZ + CAP_D / 2);
    scene.add(wall);
    // and the two returns it presents where it meets the flanking runs are
    // party walls, not the block's flat brown — same reasoning as the bank's
    solid({ minX: -FACE, maxX: FACE, minZ: NZ, maxZ: NZ + CAP_D });
  }

  // ── the alley ───────────────────────────────────────────────────────────
  //
  // 493 lines of it used to sit inline here. It is `ct/alley.ts` now — see
  // that file for why, and for the proof that the move changed nothing. The
  // CALL STAYS AT THIS POINT IN THE SEQUENCE deliberately: paint order decides
  // the grain of every texture created after it (GOTCHAS §31) and the seeded
  // `rnd()` stream decides every tree height and pigeon downstream (GOTCHAS §2),
  // so moving this line is not the same edit as moving the file.
  {
    // The roster is this file's to read, so the two buildings the alley is cut
    // between are resolved HERE and handed over. Inside the block they used to
    // be found twice, by two copies of `WEST.indexOf('alley')` — once for the
    // end wall's height and once for the flanks'.
    const ai = WEST.indexOf('alley');
    buildAlley({
      scene, FACE, AZ0, AZ1, KERB_H, flat, wet, solid, boards, stampFrom,
      ground: o.ground,
      northNeighbour: WEST[ai - 1] as BldSpec,
      southNeighbour: WEST[ai + 1] as BldSpec,
      bandOf,
    });
  }

  stampFrom(STREET_MARK, 'street');
  return { colliders, park: PARK, lot: LOT, setWindows };
}

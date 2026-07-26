import * as THREE from 'three';
import type { AABB } from '../fp';
import { BUILD, type CtxBuild } from './ctx';
import type { Seat } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { FACE } from './rng';
import { masonry } from './tex-world';

// The two buildings on this block that are NOT shops.
//
// Split out of `ct/street.ts` on 2026-07-24. street.ts was 1277 lines with a
// single owner, and six queued user requests were stacked behind that one
// owner — church buttresses, the church tower, the library courtyard, the
// casino sign, hotel facade detail. None of them touch the shopfront system.
// A civic building shares nothing with a brick-box-and-awning except the
// street it stands on, so the seam was already there; this just cuts it.
//
// Takes what it needs from the caller and hands back two placers. Owns no
// state — street.ts still decides where these go.
//
// It DOES now have things you can walk into, so it also hands back the boxes
// that stop you: `colliders`, filled as the buildings are placed. `obstacle`
// is optional and registers them as they are made if the caller has a
// registry to hand; if it does not, the same boxes come back in the return
// value. See the courtyard note in placeLibrary for why this appeared.
export interface BldSpec {
  nm: string; col: string; w: number; brick: string; floors: number;
  res?: boolean; kind?: 'library' | 'church'; front?: 'burger' | 'pawn' | 'tax';
}

/** The library forecourt, in world coordinates, filled in when the library is
 *  placed (`live` until then is false).
 *
 *  This is the one piece of module state in here, and it exists because the
 *  courtyard is the first thing in `ct/civic.ts` you can walk INTO. Two facts
 *  about it live in the entry point and nowhere else: the west wall collider
 *  runs unbroken down the block and has to be notched for the mouth, and
 *  `groundY` decides the floor is at KERB_H only out to x = FACE + 0.3.
 *  Publishing the extents lets the entry point read both off ONE import
 *  instead of every caller in between forwarding a registry down to here.
 *  `colliders` is everything solid inside the courtyard. */
export const COURT = {
  live: false,
  /** Set by the ENTRY POINT, before the world builds, to say that it asks
   *  `courtGround` for the floor. Until it does, the flight is left SOLID.
   *
   *  A landing shim, and it should be deleted the moment the entry point is
   *  wired: the steps and the picker have to arrive together, and this file
   *  can be in the live world (which rebuilds every 15 s from every
   *  worktree) minutes before a one-line change to a file I do not own. Open
   *  treads with nothing answering for their height is not "not climbable
   *  yet" — it is walking through stone at pavement level, which is worse
   *  than what it replaces. So the geometry only opens when the floor is
   *  there to catch you. */
  climbable: false,
  minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  /** the flat paving level. `courtGround` is the truth; this is what the
   *  entry point read before the steps became climbable, and it is still
   *  correct for every part of the courtyard that is not the flight. */
  y: 0,
  colliders: [] as AABB[],
};

/** Every seat the civic buildings own, in WORLD coordinates.
 *
 *  The library's benches were built before `ctx.seat` existed and never went
 *  back for it, so the courtyard had furniture you could not sit on while the
 *  park's identical benches worked. They are registered here rather than
 *  through the options object because `buildCivic` is called from
 *  `ct/street.ts`, which has no ctx of its own — the same reason `COURT` and
 *  `courtGround` are exports. Call AFTER the world is built: the church is
 *  placed into a group that street.ts turns afterwards, so a seat inside it
 *  is only in world coordinates once that transform exists. */
export function civicSeats(): Seat[] {
  if (PENDING.length) { for (const f of PENDING) f(); PENDING.length = 0; }
  return SEATS;
}
const SEATS: Seat[] = [];

/** Every ground patch this module owns, in world coordinates. Registered as
 *  the buildings are placed; asked in order and the first answer wins. */
const FLOORS: ((x: number, z: number) => number | null)[] = [];
/** Deferred work that can only be done once the caller has finished placing
 *  us — see `host` in buildCivic. Runs on the first floor query. */
const PENDING: (() => void)[] = [];

/** The civic ground at (x, z) — the library forecourt, the churchyard, and
 *  the flights of steps in both — or null if this is neither, the same shape
 *  as the interior belt's `interiorGround`. The entry point asks one question
 *  and this module owns the whole answer, extents included.
 *
 *  It exists because you can WALK UP THE STEPS. GOTCHAS §7: floor height in
 *  this world comes from a picker, never from colliders, so a flight that is
 *  drawn but not answered for here is a flight you cannot climb — which is
 *  exactly what the user found on the library.
 *
 *  `ct/apartment.ts` is the model and its rule is the one that bites: **the
 *  picker does not know about treads.** It walks you up a smooth ramp at the
 *  flight's own gradient and the drawn steps ride within half a riser of it.
 *  Answer with tread tops instead and the camera jolts a whole riser at every
 *  nosing. No hysteresis, unlike the walk-up — nothing here is stacked over
 *  anything, so the floor is single-valued along the approach. */
export const courtGround = (x: number, z: number): number | null => {
  if (PENDING.length) { for (const f of PENDING) f(); PENDING.length = 0; }
  for (const f of FLOORS) {
    const y = f(x, z);
    if (y !== null) return y;
  }
  return null;
};

export const ORDER = BUILD.SITE;

/**
 * The world loader's entry point — and the reason this file no longer has to
 * export lists for someone else to consume.
 *
 * `buildCivic` is called from `ct/street.ts`, which has no ctx of its own, so
 * for a long time nothing in here could call `ctx.seat` or answer for its own
 * floor: `COURT`, `courtGround` and `civicSeats` were all exports invented to
 * get round that, and each one needed a line in the entry point that somebody
 * had to remember. The library's benches went unsittable for weeks because
 * nobody did, and the steps stayed solid for the same reason.
 *
 * The loader hands every module the full context. So this takes it here,
 * directly, and registers what it owns — no change to street.ts required.
 *
 * It runs in the SITE band, after buildStreet has placed the buildings, which
 * is what both registrations need: the church is built into a group street.ts
 * turns afterwards, so a seat inside it is only in world coordinates once that
 * transform exists.
 */
export function register(ctx: CtxBuild): void {
  ctx.ground(courtGround, BUILD.SITE);
  for (const s of civicSeats()) ctx.seat(s);
}

export function buildCivic(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  KERB_H: number;
  /** register a solid box, if the caller has a registry at this point */
  obstacle?: (b: AABB) => AABB;
}) {
  const { scene, flat, KERB_H } = o;
  const colliders: AABB[] = COURT.colliders;
  const solid = (b: AABB) => { colliders.push(b); o.obstacle?.(b); return b; };

  // ── where "here" is ──────────────────────────────────────────────────────
  //
  // Everything below is added to whatever the caller hands us as `scene`. For
  // the library that IS the scene. For the church it is a GROUP, which
  // ct/street.ts turns 90° and positions AFTER we return — the church was
  // authored along +x with its facade on +z, and rather than ask this file to
  // be parameterised, street.ts moves the whole thing. Good trade, but it
  // means a world-space number CANNOT be computed here at build time: the
  // transform does not exist yet.
  //
  // Colliders and floor patches are therefore registered in the HOST's frame
  // and converted once, lazily, on the first floor query — by which point the
  // matrix is real. AABBs start parked far away, the way ct/apartment.ts
  // parks a cap that is not live yet, so a box is never briefly wrong in the
  // middle of the street. An axis-aligned quarter turn maps a box to a box,
  // so nothing is lost in the conversion.
  const host = scene as unknown as THREE.Object3D;
  const hostPt = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(host.matrixWorld);
  /** register a solid box given in the HOST's frame */
  const solidLocal = (x0: number, x1: number, z0: number, z1: number) => {
    const box: AABB = { minX: 9e5, maxX: 9e5, minZ: 9e5, maxZ: 9e5 };
    solid(box);
    PENDING.push(() => {
      host.updateWorldMatrix(true, false);
      const a = hostPt(x0, z0), b2 = hostPt(x1, z1);
      box.minX = Math.min(a.x, b2.x); box.maxX = Math.max(a.x, b2.x);
      box.minZ = Math.min(a.z, b2.z); box.maxZ = Math.max(a.z, b2.z);
    });
    return box;
  };
  /** register a seat given in the HOST's frame — position, approach and
   *  FACING are all turned with it, because a seat that faces the right way
   *  in the church's own frame faces the street once street.ts turns it */
  const seatLocal = (sp: Seat) => {
    const out: Seat = { ...sp };
    SEATS.push(out);
    PENDING.push(() => {
      host.updateWorldMatrix(true, false);
      const e = new THREE.Euler().setFromRotationMatrix(host.matrixWorld, 'YXZ');
      const p = hostPt(sp.x, sp.z);
      out.x = p.x; out.z = p.z;
      out.yaw = sp.yaw - e.y;
      if (sp.approach) {
        const a = hostPt(sp.approach.x, sp.approach.z);
        out.approach = { x: a.x, z: a.z };
      }
    });
    return out;
  };

  /** register a floor patch whose function is written in the HOST's frame */
  const floorLocal = (fn: (x: number, z: number) => number | null) => {
    const inv = new THREE.Matrix4(), p = new THREE.Vector3();
    let ready = false;
    FLOORS.push((wx, wz) => {
      if (!ready) { host.updateWorldMatrix(true, false); inv.copy(host.matrixWorld).invert(); ready = true; }
      p.set(wx, 0, wz).applyMatrix4(inv);
      return fn(p.x, p.z);
    });
  };
  //
  // The library and the church are the two buildings on this block that are
  // NOT shops, and they must not be built out of shop parts. Everything else
  // here is brick + awning + sign band + glass; these two get their own
  // vocabulary, and it is the vocabulary that does the work:
  //
  //   ASHLAR, not brick — squared stone in 9 px courses against brick's 5 px,
  //     with PALE lime joints instead of dark ones, so it reads cool and
  //     coarse next to the warm fine brick either side.
  //   ARCHED openings, not rectangular holes — round-headed for the library
  //     (Carnegie branches are classical), pointed for the church.
  //   CUT lettering, not a painted band — the letters are the shadow of a
  //     chisel cut with a lit lower lip, which is what makes stone lettering
  //     read as carved rather than stencilled.
  //   A REAL PROFILE — projecting doorcases, cornices, buttresses, copings.
  //     A shopfront is a flat plane; a civic building has depth in its
  //     silhouette, and that is most of what tells them apart at a glance.
  const STONE = '#a89e88', STONE_D = '#8a806c', STONE_L = '#c2b8a0';
  const SLATE = '#4a4e56';
  /** the stone bond in metres: course height, and block length per building */
  const STONE_COURSE_M = 0.75, STONE_BLOCK_M = 2.75, NAVE_BLOCK_M = 2.5, TOWER_BLOCK_M = 2.25;
  const clcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  // squared stone, laid in courses, every third block a shade off
  // Ashlar's bond, in METRES. Stone courses are legitimately taller than the
  // brick bond next door — what has to match across a civic-to-shop party wall
  // is the DENSITY, not the course height. These are converted to texels
  // through the surface, so they never encode a px/m.
  const ashlar = (g: CanvasRenderingContext2D, W: number, H: number, r: () => number, courseH: number, blockW: number) => {
    g.fillStyle = STONE; g.fillRect(0, 0, W, H);
    for (let y = 0, i = 0; y < H; y += courseH, i++) {
      const off = (i % 2) ? 0 : Math.round(blockW / 2);
      for (let x = -off; x < W; x += blockW) {
        const k = r();
        if (k > 0.8) g.fillStyle = STONE_L; else if (k < 0.22) g.fillStyle = STONE_D; else continue;
        g.fillRect(x + 1, y + 1, blockW - 2, courseH - 2);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.16)';          // pale lime bed joint…
    for (let y = 0; y < H; y += courseH) g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.15)';                // …and its shadow under
    for (let y = 0; y < H; y += courseH) g.fillRect(0, y + 1, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0, i = 0; y < H; y += courseH, i++) {
      const off = (i % 2) ? 0 : Math.round(blockW / 2);
      for (let x = -off; x < W; x += blockW) g.fillRect(x, y, 1, courseH);
    }
  };
  // an arched opening. Round-headed by default; `pointed` gives the gothic
  // taper the church wants. Drawn as pixel steps, not a path, so it stays in
  // the same hand as the rest of the world.
  const archFill = (g: CanvasRenderingContext2D, cx: number, w: number, yTop: number, yBot: number, col: string, pointed = false) => {
    const rr = Math.floor(w / 2);
    const rise = pointed ? Math.round(rr * 1.9) : rr;
    const spring = yTop + rise;
    g.fillStyle = col;
    if (yBot > spring) g.fillRect(cx - rr, spring, w, yBot - spring);
    for (let dy = 0; dy <= rise; dy++) {
      const t = (rise - dy) / rise;
      const hw = pointed ? Math.round(rr * (1 - Math.pow(t, 1.8))) : Math.round(Math.sqrt(Math.max(0, rr * rr - (rise - dy) * (rise - dy))));
      if (hw > 0) g.fillRect(cx - hw, yTop + dy, hw * 2, 1);
    }
  };
  // The half-width of an `archFill` at a given row — the SAME stepped curve,
  // exposed so that anything drawn INSIDE an arch can be cut to it.
  //
  // The library's fanlight was a rectangle sitting behind the arched head and
  // running past it both sides, so the arch read as drawn ON the glass rather
  // than the glass being cut to fit. The window glazing bars did it too. An
  // opening and the thing inside it have to come off one curve, which is the
  // same lesson as the buttresses and the lancets one storey down: two
  // descriptions of the same edge will always drift.
  const archHW = (w: number, yTop: number, y: number, pointed = false) => {
    const rr = Math.floor(w / 2), rise = pointed ? Math.round(rr * 1.9) : rr;
    const dy = y - yTop;
    if (dy >= rise) return rr;                       // below the springing
    if (dy < 0) return 0;
    const t = (rise - dy) / rise;
    return pointed ? Math.round(rr * (1 - Math.pow(t, 1.8)))
      : Math.round(Math.sqrt(Math.max(0, rr * rr - (rise - dy) * (rise - dy))));
  };
  // lettering CUT into the stone: shadow first, then a lit lower lip
  const engrave = (g: CanvasRenderingContext2D, text: string, cx: number, cy: number, px: number) => {
    g.font = `bold ${px}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillText(text, cx, cy + 1);
    g.fillStyle = 'rgba(38,30,22,0.62)'; g.fillText(text, cx, cy);
  };
  // Rose window: stone surround, eight lights of coloured glass, stone boss.
  //
  // Takes its two radii in TEXELS and works in NORMALISED radius, so every
  // ring and spoke is the same thickness in metres either way round.
  //
  // It had one radius, and the nave front it is painted on used to be 8 px/m
  // across and 11.76 px/m up — so the rose came out 5.5 m wide and 3.7 m
  // tall. An oval, in the screenshot the user sent. A's density mandate has
  // since made every masonry canvas square, which would hide that on this
  // wall today; the two radii stay because the bug was the ASSUMPTION, and
  // the next painter to be given a stretched canvas should not have to
  // rediscover it. See the call site for the radii coming off the surface.
  const roseWin = (g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) => {
    // four hues, not eight. Real glass in a small parish rose is a limited
    // palette, and eight saturated ones at this texel size read as a beach
    // ball rather than as leaded glass in a muted street.
    const glass = ['#7a3e3c', '#3d5470', '#a08348', '#3f6050', '#7a3e3c', '#3d5470', '#a08348', '#3f6050'];
    const rim = 2.4 / rx, boss = 3 / rx;
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const u = Math.hypot(dx / rx, dy / ry);
      if (u > 1) continue;
      const a = Math.atan2(dy / ry, dx / rx) + Math.PI;
      const seg = a / (Math.PI / 4);
      if (u > 1 - rim) g.fillStyle = STONE_D;
      else if (u < boss) g.fillStyle = STONE_L;
      else if (Math.abs(u - (1 - rim) * 0.56) < 1.2 / rx) g.fillStyle = STONE;
      else if (Math.abs(seg - Math.round(seg)) < 0.075) g.fillStyle = STONE;
      else g.fillStyle = glass[Math.floor(seg) % 8];
      g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  };
  const stoneM = () => new THREE.MeshBasicMaterial({ color: 0x9c9280 });
  const slateM = () => new THREE.MeshBasicMaterial({ color: 0x4a4e56 });

  const partyTex = (seed: number, wash: boolean, depthM: number, FLANK_H: number) => {
    const flankS = masonry(depthM, FLANK_H, 0);
    const W = flankS.W, H = flankS.H, fm = flankS.m;
    return flankS.paint((g) => {
      const r = clcg(seed);
      g.fillStyle = '#6f5344'; g.fillRect(0, 0, W, H);
      flankS.courses(g);                                      // courses + perps
      if (wash) {                                             // flaking whitewash dado
        const wy = H - fm(2.9);
        g.fillStyle = 'rgba(214,206,188,0.5)'; g.fillRect(0, wy, W, H - wy);
        g.fillStyle = 'rgba(214,206,188,0.28)'; g.fillRect(0, wy - fm(0.36), W, fm(0.36));
        for (let i = 0; i < 40; i++) {                        // where it has come away
          g.fillStyle = 'rgba(111,83,68,0.55)';
          g.fillRect(Math.floor(r() * W), wy + Math.floor(r() * (H - wy)), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3));
        }
      }
      // the ghost of a lower roof that used to abut this wall
      const gy = H - fm(wash ? 7.4 : 9.1);
      g.fillStyle = 'rgba(150,128,108,0.3)'; g.fillRect(0, gy, W, H - gy);
      g.fillStyle = 'rgba(40,30,24,0.35)'; g.fillRect(0, gy, W, fm(0.18));
      // soot down from the top, and rain off the pipe
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(30,24,20,${0.06 + r() * 0.1})`;
        g.fillRect(Math.floor(r() * W), 0, 1 + Math.floor(r() * 2), Math.round(r() * H * 0.7));
      }
      g.fillStyle = 'rgba(74,86,58,0.22)';
      for (let i = 0; i < 14; i++) g.fillRect(fm(0.36) + Math.floor(r() * fm(0.5)), Math.round(H * 0.45 + r() * H * 0.5), fm(0.25), fm(0.36) + Math.floor(r() * fm(0.9)));
      // …and the top 2.5 m fades to the flank behind it, so the panel has
      // no visible top edge — the neighbour just carries on upward
      const FD = fm(2.5);
      for (let y = 0; y < FD; y++) {
        g.fillStyle = `rgba(83,56,46,${(1 - y / FD) ** 0.7})`;
        g.fillRect(0, y, W, 1);
      }
      dither(g, W, H, Math.round(depthM * FLANK_H * 5.3));
    });
  };

  // ── a flight of steps you can climb ──────────────────────────────────────
  //
  // ONE flight builder, used by the library and by the church. Both were
  // asked for by the user in the same breath — *"give it some stairs similar
  // to the library"* — and two hand-built approaches would drift apart the
  // first time either was touched.
  //
  // Written in APPROACH coordinates: `u` runs from the street line INTO the
  // building, `v` runs across the flight. The caller maps that onto its own
  // axes, because the library approaches along x and the church — which
  // street.ts turns a quarter turn — approaches along z. Everything else
  // about a stair is the same at both: nested treads, cheek walls beside
  // them, and a RAMP for the floor picker rather than tread tops (§7).
  //
  // Nothing in this world is lit, so a tread and a riser cut from the same
  // colour are the SAME colour, and a flight of them reads as a smooth ramp —
  // the library's first cut had five steps in it and you could see two. The
  // contrast is painted in: every tread takes the pale stone that faces the
  // sky, every riser the dark one that faces you.
  // ── TEXTURED, BECAUSE A FLAT COLOUR IS NOT A MATERIAL ────────────────────
  //
  // The user saw the forecourt as translucent patches over the paving. B
  // measured it and wrote notes/B-forecourt-patches.md: 26 ground-level meshes
  // of mine, all registered identically with the night sweep — nothing had
  // diverged — and **every one untextured flat colour**, seven tints between
  // them. B's diagnosis is the right one and it is worth stating in full:
  //
  //   *"Because a flat colour is not a material. Every other ground surface
  //   here derives its canvas from its real metres at one density — 32 px/m —
  //   and carries aggregate, staining and scoring joints. Against that, an
  //   untextured quad has no grain for the eye to attach to and no joints to
  //   give it scale, so it reads as a TINT OVER the paving rather than as a
  //   piece of paving."*
  //
  // So: one stone canvas at 32 px/m, cloned per member with its `repeat` taken
  // from that member's real metres — the same way the park shelter's timber was
  // fixed this morning, and the same reason. Two surfaces, related but not
  // identical: SCORED for anything you walk on, so the treads and the landing
  // carry the joint lines that give a slab its size, and PLAIN for the copings,
  // gate posts and planters, which are dressed stone rather than paving.
  const ST_TILE = 1.5;                       // 48 px at 32 px/m
  const ST_PX = Math.round(ST_TILE * 32);
  const stoneCanvas = (base: string, lo: string, hi: string, scored: boolean) =>
    pixTex(ST_PX, ST_PX, (g) => {
      const r = clcg(scored ? 0x5c3311 : 0x7ab214);
      g.fillStyle = base; g.fillRect(0, 0, ST_PX, ST_PX);
      for (let i = 0; i < ST_PX * ST_PX * 0.22; i++) {      // aggregate
        const k = r();
        g.fillStyle = k > 0.62 ? hi : lo;
        g.fillRect(Math.floor(r() * ST_PX), Math.floor(r() * ST_PX), 1, 1);
      }
      for (let i = 0; i < 7; i++) {                          // weathering, in patches
        g.fillStyle = `rgba(74,66,52,${(0.05 + r() * 0.07).toFixed(3)})`;
        g.fillRect(Math.floor(r() * ST_PX), Math.floor(r() * ST_PX),
          4 + Math.floor(r() * 12), 3 + Math.floor(r() * 9));
      }
      if (scored) {                                          // the joints, one per tile
        g.fillStyle = 'rgba(58,52,42,0.45)';
        g.fillRect(0, 0, ST_PX, 1); g.fillRect(0, 0, 1, ST_PX);
        g.fillStyle = 'rgba(226,220,204,0.20)';              // and its lit lip
        g.fillRect(0, 1, ST_PX, 1); g.fillRect(1, 0, 1, ST_PX);
      }
      dither(g, ST_PX, ST_PX, Math.round(ST_PX * ST_PX * 0.05));
    });
  const SCORED = stoneCanvas('#b4aa92', '#a79d86', '#c2b8a0', true);
  const DRESSED = stoneCanvas('#9c9280', '#8d846f', '#aca290', false);
  const RISER = stoneCanvas('#877d69', '#7a715e', '#968c76', false);
  /** a stone material whose grain is at 32 px/m for THIS member's metres */
  const stoneFace = (t: THREE.Texture, wM: number, hM: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = THREE.RepeatWrapping; c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(Math.max(0.12, wM / ST_TILE), Math.max(0.12, hM / ST_TILE));
    return flat(c);
  };
  const treadM = stoneFace(SCORED, 1.4, 4.1);
  const riserM = stoneFace(RISER, 1.4, 0.19);
  const stepSideM = stoneFace(DRESSED, 1.4, 1.4);
  const flight = (f: {
    axis: 'x' | 'z';
    /** host-frame (x, z) of u = 0, v = 0 — the street line on the centreline */
    ox: number; oz: number;
    /** +1 if u grows with the host axis, −1 if against it */
    dir: 1 | -1;
    n: number;
    /** the level it starts from, and the threshold it reaches */
    yBase: number; yTop: number;
    /** u of the bottom nosing, of the threshold, and of the wall behind */
    uNose: number; uTop: number; uBack: number;
    /** clear width between the cheeks; cheek 0 leaves them off */
    width: number; cheek: number;
  }) => {
    const rise = (f.yTop - f.yBase) / f.n, tread = (f.uTop - f.uNose) / f.n;
    // place a box given its extent in approach coords
    const put = (u0: number, u1: number, v0: number, v1: number, h: number, mats: THREE.Material | THREE.Material[]) => {
      const du = Math.abs(u1 - u0), dv = Math.abs(v1 - v0);
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      const m = new THREE.Mesh(
        f.axis === 'x' ? new THREE.BoxGeometry(du, h, dv) : new THREE.BoxGeometry(dv, h, du), mats);
      if (f.axis === 'x') m.position.set(f.ox + f.dir * uc, h / 2, f.oz + vc);
      else m.position.set(f.ox + vc, h / 2, f.oz + f.dir * uc);
      scene.add(m);
      return m;
    };
    for (let k = 0; k < f.n; k++) {          // k = 0 is the lowest step
      put(f.uNose + k * tread, f.uBack, -f.width / 2, f.width / 2, f.yBase + (k + 1) * rise,
        f.axis === 'x' ? [riserM, riserM, treadM, riserM, stepSideM, stepSideM]
          : [stepSideM, stepSideM, treadM, riserM, riserM, riserM]);
    }
    if (f.cheek > 0) {                       // cheeks, stepping down one per tread
      for (const s of [-1, 1]) {
        const vc = s * (f.width / 2 + f.cheek / 2);
        // TEXTURED, like the treads beside them. These cheeks are the
        // forecourt "patches": B measured 26 civic ground meshes with no map
        // at all, and a flat colour has no grain or joints for the eye to hold
        // against paving that has both, so it reads as a translucent patch
        // rather than as stone. The treads and risers two lines up were always
        // grained; their own side walls were not, which is why the fault
        // survived a pass that "textured the forecourt".
        const cheekM = stoneFace(DRESSED, f.cheek, tread);
        const cheekTopM = stoneFace(DRESSED, f.cheek, Math.max(0.3, f.uBack - f.uTop));
        for (let k = 0; k < f.n; k++) {
          put(f.uNose + k * tread, f.uNose + (k + 1) * tread, vc - f.cheek / 2, vc + f.cheek / 2,
            f.yBase + (k + 1) * rise + 0.5, cheekM);
        }
        put(f.uTop, f.uBack, vc - f.cheek / 2, vc + f.cheek / 2, f.yTop + 0.5, cheekTopM);
      }
    }
    return {
      /** the ramp, in approach coords. Outside the flight's width: null. */
      gy: (u: number, v: number): number | null => {
        if (Math.abs(v) > f.width / 2) return null;
        if (u <= f.uNose) return f.yBase;
        if (u >= f.uTop) return f.yTop;
        return f.yBase + ((u - f.uNose) / (f.uTop - f.uNose)) * (f.yTop - f.yBase);
      },
      /** the cheeks, in approach coords, for the caller to register */
      cheeks: [-1, 1].map((s) => ({
        u0: f.uNose, u1: f.uBack,
        v0: s * (f.width / 2) - (s < 0 ? f.cheek : 0), v1: s * (f.width / 2) + (s > 0 ? f.cheek : 0),
      })),
    };
  };

  // Forecourt paving. Deliberately NOT the sidewalk: the walk is cool grey
  // 1 m concrete slabs at 32 px/m, so the courtyard is warm stone flags,
  // BIGGER (1.15 m), laid in courses running parallel to the facade with a
  // border course round the edge — the change of material is what tells you
  // you have stepped off the pavement and into somewhere.
  //
  // Painted at 32 px/m from the surface's REAL METRES (GOTCHAS §5), so the
  // texels stay square and the flag grid does not stretch if the courtyard is
  // ever resized. `wM` runs in x (street → facade), `dM` in z.
  const PAVE = '#8e887a', PAVE_D = '#7b7568', PAVE_L = '#9d9788';
  const pavingTex = (wM: number, dM: number) => {
    const W = Math.round(wM * 32), H = Math.round(dM * 32);
    // Declared 'ground' — the last face any seam tool could not judge. 32 px/m is
    // CORRECT here and always was: paving derives from real metres at its own
    // density, as the comment above says, and is not masonry. The only thing
    // missing was saying so, which is why it sat in an UNJUDGEABLE column
    // rather than an answered one.
    return declareSurface(pixTex(W, H, (g) => {
      const r = clcg(0x51d0a3);
      // the base coat IS the joint: every flag is inset a texel into it, so
      // the mortar line is what is left over rather than something drawn on
      // top of the flags and fighting them
      g.fillStyle = '#6b6559'; g.fillRect(0, 0, W, H);
      const CH = 26, FW = 37;                       // 0.8 m courses, 1.15 m flags
      const BORD = 16;                              // 0.5 m border course
      for (let x = BORD, i = 0; x < W - BORD; x += CH, i++) {
        const ch = Math.min(CH, W - BORD - x);
        for (let z = (i % 2 ? -Math.round(FW / 2) : 0); z < H; z += FW) {
          const k = r();
          g.fillStyle = k > 0.78 ? PAVE_L : k < 0.26 ? PAVE_D : PAVE;
          g.fillRect(x + 1, Math.max(0, z + 1), ch - 1, Math.min(FW - 1, H - z - 1));
        }
      }
      // the border: long slabs round all four edges, laid the other way
      g.fillStyle = PAVE_D;
      g.fillRect(1, 1, BORD - 1, H - 2); g.fillRect(W - BORD, 1, BORD - 1, H - 2);
      g.fillRect(1, 1, W - 2, BORD - 1); g.fillRect(1, H - BORD, W - 2, BORD - 1);
      g.fillStyle = '#6b6559';
      for (let z = 0; z < H; z += 51) {             // a joint every 1.6 m
        g.fillRect(0, z, BORD, 1); g.fillRect(W - BORD, z, BORD, 1);
      }
      for (let x = 0; x < W; x += 51) { g.fillRect(x, 0, 1, BORD); g.fillRect(x, H - BORD, 1, BORD); }
      // forty years of nobody sweeping it: weeds in the joints, a run of
      // stain out from under the doors, two flags cracked across
      g.fillStyle = '#4c5535';
      for (let i = 0; i < 46; i++) {
        const jz = Math.round(r() * (H / FW)) * FW;
        g.fillRect(Math.round(BORD + r() * (W - BORD * 2)), jz + (r() < 0.5 ? 0 : -1), 1 + Math.round(r() * 2), 1);
      }
      g.fillStyle = 'rgba(58,48,36,0.13)';
      for (let i = 0; i < 22; i++) {
        g.fillRect(Math.round(r() * W * 0.4), Math.round(r() * H), 3 + Math.round(r() * 9), 2 + Math.round(r() * 5));
      }
      g.fillStyle = 'rgba(40,34,26,0.3)';
      for (const [cx, cz] of [[W * 0.55, H * 0.34], [W * 0.38, H * 0.71]]) {
        let x = Math.round(cx);
        for (let z = Math.round(cz); z < cz + 30; z++) { g.fillRect(x, z, 1, 1); x += r() < 0.4 ? 1 : 0; }
      }
      dither(g, W, H, 900);
    }), 'ground');
  };
  // A bench slat is 0.13 m — one texel at this world's density, and GOTCHAS §4
  // is unambiguous about what happens if you put grain on a surface that
  // thin. So the slats are FLAT COLOUR, two weathered browns alternating,
  // and all the variety comes from the gaps between them.
  const SLAT = [0x6a5238, 0x5e4831];
  // Clipped box in a planter. A clipped shrub at 8 px/m IS a box, which is
  // the one piece of luck this world's density hands you.
  const shrubTex = () => pixTex(16, 16, (g) => {
    const r = clcg(0x7e34c1);
    g.fillStyle = '#3f5232'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 90; i++) {
      const k = r();
      g.fillStyle = k > 0.62 ? '#4e6440' : k > 0.3 ? '#374a2c' : '#2b3a23';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
    }
  });
  // The bin is a wire basket, not a drum — but it is 0.44 m across, so the
  // mesh cannot be drawn as mesh (§4 again). Four bars and two hoops, each
  // several texels wide, is the most a bin this size can carry.
  const meshTex = () => pixTex(8, 14, (g) => {
    g.fillStyle = '#333a2b'; g.fillRect(0, 0, 8, 14);
    g.fillStyle = '#5c5340';
    for (const x of [1, 3, 5]) g.fillRect(x, 2, 1, 10);
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 10, 8, 1);
    g.fillStyle = '#2b3226'; g.fillRect(0, 0, 8, 2); g.fillRect(0, 12, 8, 2);
  });

  // ── the library ─────────────────────────────────────────────────────────
  //
  // A Carnegie branch, and the brief for it is the user's own line: built by
  // people who thought public buildings should be beautiful, and not looked
  // after since. So it gets the full classical kit — rusticated plinth, five
  // bays, tall round-arched windows, a pedimented doorcase up a flight of
  // steps, the name CUT into the frieze in Roman capitals with V for U the
  // way the carvers did it — and then it gets soot down the cornice and
  // staining under every sill, because nobody has cleaned it in forty years.
  //
  // It is deliberately SHORTER than its neighbours. A civic building that
  // does not reach the party walls either side of it is a real condition and
  // it reads as one: the block grew past it and left it behind.
  //
  // …and since 2026-07-24 it is deliberately BEHIND them too. The whole mass
  // stands SET back from the facade line and the notch that leaves is a
  // public forecourt — the user's ask, in his words: *"make entire library
  // building a bit recessed so there like a courtyard public 3rd space
  // area."* It is the same idea as the height: this building was here before
  // the block closed up around it, and it keeps its own ground.
  //
  // The setback is what pays for everything else. A flight of steps could
  // never project onto a 2 m pavement, so it used to be folded away inside
  // the entrance recess; now it comes down into the courtyard where a civic
  // stair belongs, with cheek walls stepping down beside it. What is left
  // either side is deep enough to sit in, which is the whole point of the
  // request — benches facing each other across the axis, planters at the foot
  // of the steps, a bin, and gate piers at the mouth so the space is read as
  // one from the street.
  const LIB_H = 13.2, BAY_H = 6.0, BAY_W = 5.0, BAY_D = 1.8;
  const SET = 3.2;                  // how far the mass stands back from x = -FACE
  const XF = -FACE - SET;           // the library's own facade plane
  const placeLibrary = (z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const CZ0 = cz - b.w / 2, CZ1 = cz + b.w / 2;   // the courtyard's z extent
    const surf = masonry(b.w, LIB_H, 0);
    const LW = surf.W, LH = surf.H, pm = surf.ppm;
    const yOf = (m: number) => Math.round(LH - m * pm);
    const bayPx = surf.m(BAY_W);
    const bx0 = Math.round((LW - bayPx) / 2), bx1 = bx0 + bayPx;   // the bay in texels
    const wSide = (bx0 / LW) * b.w;                                 // …and in metres
    // ONE drawing of the whole elevation, sampled three times. Slicing the
    // same painting keeps the coursing, the quoins and the frieze running
    // dead straight across the entrance bay, which they would not if each
    // block were painted separately.
    const paint = (g: CanvasRenderingContext2D) => {
      const r = clcg(0x7ab31d);
      ashlar(g, LW, LH, r, surf.m(STONE_COURSE_M), surf.m(STONE_BLOCK_M));
      const PL = yOf(2.6);
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, PL, LW, LH - PL);
      for (let y = PL; y < LH; y += 13) { g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(0, y, LW, 2); }
      for (let y = PL, i = 0; y < LH; y += 13, i++) {
        for (let x = (i % 2) ? 0 : 16; x < LW; x += 32) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y, 2, 13); }
      }
      g.fillStyle = STONE_L; g.fillRect(0, PL - 3, LW, 3);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, PL, LW, 1);
      for (let y = 0, i = 0; y < LH; y += 18, i++) {                 // quoins
        g.fillStyle = (i % 2) ? STONE_L : STONE_D;
        g.fillRect(0, y, 8, 18); g.fillRect(LW - 8, y, 8, 18);
      }
      for (const cx of [Math.round(LW * 0.11), Math.round(LW * 0.28), Math.round(LW * 0.72), Math.round(LW * 0.89)]) {
        archFill(g, cx, 22, yOf(8.75), yOf(3.2), STONE_D);
        archFill(g, cx, 18, yOf(8.55), yOf(3.35), '#26303a');
        g.fillStyle = 'rgba(196,212,222,0.22)';
        for (let y = yOf(8.9); y < yOf(3.35); y += 10) {          // cut to the head
          const hw = archHW(18, yOf(8.55), y);
          if (hw > 1) g.fillRect(cx - hw, y, hw * 2, 1);
        }
        const spr = yOf(8.55) + 9;                                // the springing
        g.fillRect(cx - 1, spr, 2, yOf(3.35) - spr);
        g.fillStyle = STONE_L; g.fillRect(cx - 3, yOf(9.15), 6, 9);
        g.fillRect(cx - 12, yOf(3.35), 24, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(cx - 12, yOf(3.35) + 3, 24, 2);
        // WATER COMES OFF THE ENDS OF A SILL, not evenly off its middle. The
        // stain under each window was one flat rectangle at 0.18 — measurable,
        // barely visible, and the wrong shape: a sill sheds to its outer
        // corners and the runs below them are long, dark and separate. This is
        // the "unmaintained" half of the user's sentence, and it was the half
        // that had not been drawn.
        const sillY = yOf(3.35) + 5;
        for (const end of [-1, 1]) {
          for (let k = 0; k < 5; k++) {
            const sx = cx + end * (6 + k) - (end > 0 ? 0 : 1);
            const len = Math.round((16 + r() * 26) * (1 - k * 0.13));
            g.fillStyle = `rgba(58,48,36,${(0.26 - k * 0.035).toFixed(3)})`;
            g.fillRect(sx, sillY, 1, len);
          }
        }
        g.fillStyle = 'rgba(58,48,36,0.10)';           // and a faint wash between them
        g.fillRect(cx - 9, sillY, 18, 10);
      }
      // the archivolt round the recess — the only thing drawn at the bay, and
      // it stops at its edge because everything inside it is real geometry
      archFill(g, Math.round(LW / 2), bayPx + 12, yOf(BAY_H + 0.6), yOf(0), STONE_D);
      archFill(g, Math.round(LW / 2), bayPx + 4, yOf(BAY_H + 0.25), yOf(0), STONE_L);
      // ── the name ──────────────────────────────────────────────────────
      //
      // It is the most deliberate thing on the building and it could not be
      // read from the pavement, which is the only place it is ever read from.
      // Two reasons, and the second was not "crowding":
      //
      //   · the frieze sat directly under a cornice that PROJECTS 0.45 m, so
      //     the letters were in its shadow at every angle you see them from;
      //   · and the cornice's own lower course was drawn AFTER the frieze and
      //     0.5 m of it landed on top of the letters. The name was bisected.
      //     Two bands whose extents were written 0.9 m apart in the file and
      //     never checked against each other.
      //
      // Fixed by SEPARATION rather than by shouting. The cornice goes up
      // 0.45 m, the windows below come down 0.45, and the frieze takes the
      // 1.7 m band that opens between them — 0.44 m of clear stone above the
      // letters and the same below. The letters stay at 9 px: `engrave`
      // builds its cut out of a 1 px shadow and a 1 px lit lip, and those are
      // fixed offsets, so a bigger letter is a shallower-looking cut.
      const CO = yOf(12.35);
      const FR = yOf(10.6), FRH = Math.round(1.7 * pm);
      g.fillStyle = STONE_L; g.fillRect(0, FR, LW, FRH);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, FR, LW, 1); g.fillRect(0, FR + FRH - 1, LW, 1);
      engrave(g, 'PVBLIC LIBRARY', Math.round(LW / 2), FR + Math.round(FRH / 2), 9);
      g.fillStyle = STONE_D; g.fillRect(0, CO, LW, 3);
      g.fillStyle = STONE_L;
      for (let x = 2; x < LW; x += 6) g.fillRect(x, CO + 3, 3, 5);
      g.fillStyle = STONE; g.fillRect(0, CO + 8, LW, 4);
      g.fillStyle = STONE_L; g.fillRect(0, 0, LW, CO - 4);
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 0, LW, CO - 4);
      for (let i = 0; i < 26; i++) {                                 // forty years of soot
        g.fillStyle = `rgba(46,38,30,${0.05 + r() * 0.08})`;
        g.fillRect(Math.floor(r() * LW), CO, 2 + Math.floor(r() * 3), Math.round(r() * LH * 0.5));
      }
      // ── AND THE BOTTOM METRE, WHICH IS WHERE A BUILDING GOES FIRST ───────
      //
      // Splash-back off the paving, rising damp, and forty years of nobody
      // washing it down. A stone plinth that is the same colour at the ground
      // as it is at first-floor sill level is a building somebody looks after,
      // which is precisely what the user said this one is not: *"a hallmark of
      // the benefit of public funding ... 40 years ago. no longer around."*
      const BASE = yOf(1.25);
      for (let y = BASE; y < LH; y++) {
        const t = (y - BASE) / (LH - BASE);                          // 0 at 1.25 m, 1 at grade
        for (let x = 0; x < LW; x++) {
          if (r() > 0.16 + t * 0.5) continue;
          g.fillStyle = r() < 0.65
            ? `rgba(58,52,40,${(0.05 + t * 0.16).toFixed(3)})`       // soot and grit
            : `rgba(74,80,56,${(0.04 + t * 0.12).toFixed(3)})`;      // and a green cast
          g.fillRect(x, y, 1, 1);
        }
      }
      dither(g, LW, LH, 700);
    };
    const slice = (px0: number, px1: number, py0: number, py1: number) =>
      pixTex(px1 - px0, py1 - py0, (g) => { g.translate(-px0, -py0); paint(g); });
    const side = stoneM(), roof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const box = (w: number, h: number, cx: number, cy: number, czz: number, face: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, w), [face, side, roof, roof, side, side]);
      m.position.set(XF - 1.7 + cx, cy, czz);
      scene.add(m);
    };
    // the mass, with the entrance bay left OUT of it
    box(wSide, LIB_H, 0, LIB_H / 2, cz + (b.w - wSide) / 2, flat(slice(0, bx0, 0, LH)));
    box(wSide, LIB_H, 0, LIB_H / 2, cz - (b.w - wSide) / 2, flat(slice(bx1, LW, 0, LH)));
    box(BAY_W, LIB_H - BAY_H, 0, (BAY_H + LIB_H) / 2, cz, flat(slice(bx0, bx1, 0, yOf(BAY_H))));
    // …and the back of the recess, 1.8 m in, carrying the doors
    const doorT = pixTex(40, 48, (g) => {
      g.fillStyle = STONE; g.fillRect(0, 0, 40, 48);
      const r2 = clcg(0x1188cd); ashlar(g, 40, 48, r2, 8, 18);   // door leaf, not a wall face
      archFill(g, 20, 26, 4, 48, STONE_D);
      archFill(g, 20, 22, 6, 48, '#2a2118');
      g.fillStyle = '#4a3a26'; g.fillRect(10, 16, 20, 32);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(19, 16, 2, 32);
      g.fillStyle = '#c9a45e'; g.fillRect(16, 30, 2, 4); g.fillRect(22, 30, 2, 4);
      // the fanlight, CUT TO THE ARCH: same cx, same width, same yTop as the
      // opening it sits in, stopped at the transom over the doors
      archFill(g, 20, 22, 6, 16, '#8a97a2');
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(19, 6 + 4, 2, 6);                                // the centre bar
      for (const by of [10, 13]) {                                // …and its lights
        const hw = archHW(22, 6, by);
        if (hw > 1) g.fillRect(20 - hw, by, hw * 2, 1);
      }
      g.fillStyle = STONE_D; g.fillRect(9, 16, 22, 1);            // the transom
      dither(g, 40, 48, 120);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.4 - BAY_D, BAY_H, BAY_W),
      [flat(doorT), side, side, side, side, side]);
    back.position.set(XF - 1.7 - BAY_D / 2, BAY_H / 2, cz);
    scene.add(back);

    // ── the forecourt ─────────────────────────────────────────────────────
    //
    // Its floor is a PLANE at exactly KERB_H, not a slab: every one of its
    // four edges is closed by something — the walk's own slab at x = -FACE,
    // the two neighbours' flanks, the library's face — so there is no edge to
    // show, and a plane that ABUTS the walk cannot z-fight with it the way an
    // overlapping box would (GOTCHAS §6). The walk's west edge is x = -FACE
    // exactly; this starts there and runs back to the new facade.
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(SET, b.w), flat(pavingTex(SET, b.w)));
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(XF + SET / 2, KERB_H, cz);
    scene.add(pave);
    COURT.live = true; COURT.y = KERB_H;
    COURT.minX = XF; COURT.maxX = -FACE; COURT.minZ = CZ0; COURT.maxZ = CZ1;

    // The steps, rebuilt for the depth. Same climb as before — 5 × 0.17 to a
    // threshold 0.85 above the walk — but the flight now runs the other way:
    // the recess is the LANDING, and the treads come down out of it into the
    // courtyard. Each step is a box from its own nosing back to the doors, so
    // they nest and no two risers are ever coplanar.
    //
    // Nothing in this world is lit, so a tread and a riser cut from the same
    // colour are the SAME colour, and a flight of them reads as a ramp — the
    // first cut of this had five steps in it and you could see two. The
    // contrast has to be painted in: every tread takes the pale stone that
    // faces the sky, every riser the dark one that faces you.
    const RISE = 0.17, TREAD = 0.36, N = 5;
    const TOP = KERB_H + N * RISE;                    // the threshold
    const XBOT = XF + N * TREAD;                      // the bottom nosing, 1.8 m out
    // u runs east→west into the block from the street line at x = -FACE
    const uOf = (x: number) => -FACE - x;
    const st = flight({
      axis: 'x', ox: -FACE, oz: cz, dir: -1, n: N,
      yBase: KERB_H, yTop: TOP,
      uNose: uOf(XBOT), uTop: uOf(XF), uBack: uOf(XF - BAY_D),
      width: BAY_W - 0.9, cheek: 0.42,
    });
    // ── climbing it ───────────────────────────────────────────────────────
    //
    // The flight used to be ONE SOLID BLOCK: you walked round it, not up it,
    // and the user went looking for the way up. Now the treads are open and
    // the only solids are the two cheek walls beside them — a stair in this
    // world is a floor-picker answer, never a collider (GOTCHAS §7).
    if (COURT.climbable) {
      for (const c of st.cheeks) {
        solid({ minX: XF - BAY_D, maxX: XBOT, minZ: cz + c.v0, maxZ: cz + c.v1 });
      }
      // …and the doors you climb TO stop you, 0.36 m short of the leaf
      solid({ minX: XF - BAY_D - 8, maxX: XF - BAY_D, minZ: cz - BAY_W / 2, maxZ: cz + BAY_W / 2 });
    } else {
      // the entry point is not asking `courtGround` yet — see COURT.climbable
      solid({ minX: XF - BAY_D, maxX: XBOT, minZ: cz - BAY_W / 2, maxZ: cz + BAY_W / 2 });
    }
    // the whole forecourt floor: flat paving, and the flight where it climbs
    floorLocal((x, z) => {
      if (x < XF - BAY_D || x > -FACE || z < CZ0 || z > CZ1) return null;
      const ramp = st.gy(uOf(x), z - cz);
      if (ramp !== null) return ramp;
      return x >= XF ? KERB_H : null;                 // beside the flight: paving
    });

    // ── the two party walls the setback exposes ───────────────────────────
    //
    // Cutting a notch out of a terrace uncovers 3.2 m of each neighbour's
    // FLANK, and a flank in this world is a bare `endM` box — a dead flat
    // 0x53382e slab. In the courtyard it fills half the view and it was by
    // far the worst thing about the first cut of this.
    //
    // These are not the library's walls to finish, so they are not finished
    // in the library's stone: they are common brick, sooted, with the
    // whitewashed dado every wall in a yard gets and the ghost of a lower
    // roof that used to lean on them. Same hand as `facadeTex` — 8 px/m
    // across, courses every 5 px — so they read as the same block.
    //
    // HEIGHT IS A COUPLING. The panel has to stop below the neighbour or it
    // The exposed flanks. 15.4 m clears the shortest neighbour on this run —
    // BURGER BARN, 4 floors, 17.2 m — with 1.8 m to spare. Drop a west
    // neighbour below four floors and this number needs revisiting.
    const FLANK_H = 15.4;
    const pipeM = new THREE.MeshBasicMaterial({ color: 0x3b332c });
    // B's list: the copings at the courtyard mouth, the gate posts and the two
    // planters were all in the untextured 26. Dressed stone, not paving, so
    // they take the plain canvas rather than the scored one.
    const capM = stoneFace(DRESSED, 0.62, 0.62);
    for (const s of [-1, 1]) {
      const zp = s < 0 ? CZ0 : CZ1;                             // the party line
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(SET, FLANK_H),
        flat(partyTex(s < 0 ? 0x3ac81f : 0x9b12ee, s < 0, SET, FLANK_H)));
      pan.position.set(XF + SET / 2, FLANK_H / 2, zp - s * 0.03);
      pan.rotation.y = s < 0 ? 0 : Math.PI;
      scene.add(pan);
      // a cast-iron downpipe on the sooty one, hopper head and all
      if (s > 0) {
        const px = XF + 0.5, pz = zp - 0.14;
        const dp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 13.4, 0.11), pipeM);
        dp.position.set(px, 6.7, pz);
        scene.add(dp);
        const hop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.22), pipeM);
        hop.position.set(px, 13.5, pz);
        scene.add(hop);
        for (const by of [3.2, 7.4, 11.6]) {
          // …and the pipe brackets stop at the line too. These reached
          // zp + 0.01 — ten millimetres into the neighbour, which is nothing to
          // look at but is the same fault as the coping and would have been
          // left behind by a fix aimed only at the thing in the screenshot.
          // A 0.2 m bracket on a centre 0.10 m inside the line is flush.
          const br = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.2), pipeM);
          br.position.set(px, by, zp - 0.10);
          scene.add(br);
        }
      }
      solid({ minX: XF, maxX: -FACE - 0.5, minZ: Math.min(zp, zp - s * 0.3), maxZ: Math.max(zp, zp - s * 0.3) });
      // A gate pier where each party line meets the pavement. Two of them
      // read the mouth as a way IN — without them the notch is just a gap,
      // and it is the one piece of the library's own stone that comes all
      // the way out to the street line.
      // grained, not flat — same reason as the cheeks
      // THE CAP SETS THE SETBACK, NOT THE PIER.
      //
      // A building's projections must stop at its OWN boundary, and this one
      // did not. The pier is 0.5 m on a centre 0.25 m inside the party line —
      // flush, correct. Its CAP is 0.62 m on the same centre, so it hung
      // 0.06 m past the line and into the neighbour's brick at BOTH ends. That
      // is the user's "the coping cap floats out over it", and 60 mm is enough
      // to see because what you see is a stone lip emerging from red brick
      // with no joint anywhere.
      //
      // The library was designed free-standing, with returns and a full
      // classical kit; on a party wall every projection that overhangs its
      // width lands inside somebody else's building. So the widest member sets
      // the setback: the cap's outer face is now ON the line and the pier sits
      // 60 mm in behind it, which reads as a pier dying into the party wall
      // rather than merging with it.
      //
      // Both ends come out of this one loop over s, which is why both were
      // wrong by exactly the same 0.06 m and why one edit fixes the pair.
      const PCAP = 0.62;
      const pz = zp - s * (PCAP / 2);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.35, 0.5), stoneFace(DRESSED, 0.5, 1.35));
      pier.position.set(-FACE - 0.25, 0.675, pz);
      scene.add(pier);
      const pcap = new THREE.Mesh(new THREE.BoxGeometry(PCAP, 0.12, PCAP), capM);
      pcap.position.set(-FACE - 0.25, 1.41, pz);
      scene.add(pcap);
      solid({ minX: -FACE - 0.5, maxX: -FACE, minZ: Math.min(zp, pz - 0.25), maxZ: Math.max(zp, pz + 0.25) });
    }

    // Two benches, facing each other across the axis with their backs to the
    // boundary walls — the arrangement that says "sit here" rather than "wait
    // here". Stone ends and four timber slats, because that is what a parks
    // department bolted down in 1960 and never replaced.
    for (const s of [-1, 1]) {
      const bz = (s < 0 ? CZ0 : CZ1) - s * 0.62;
      const bx = XF + 1.55;
      for (const ex of [-0.85, 0.85]) {
        const end = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.52), new THREE.MeshBasicMaterial({ color: 0x8a806c }));
        end.position.set(bx + ex, KERB_H + 0.22, bz);
        scene.add(end);
      }
      for (let i = 0; i < 3; i++) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.13),
          new THREE.MeshBasicMaterial({ color: SLAT[i % 2] }));
        sl.position.set(bx, KERB_H + 0.45, bz - 0.17 + i * 0.17);
        scene.add(sl);
      }
      solid({ minX: bx - 0.95, maxX: bx + 0.95, minZ: bz - 0.28, maxZ: bz + 0.28 });
      // …and you can sit on it. The facing is the whole point of a courtyard
      // bench: its back is to the party wall, so it seats you looking INTO
      // the space and up at the library, not at the brick behind you.
      // s < 0 is the south bench, which faces north (+z) — and the reverse.
      const yaw = s < 0 ? Math.PI : 0;
      seatLocal({
        x: bx, z: bz, yaw, h: 0.45,
        approach: { x: bx + Math.sin(yaw) * 0.95, z: bz - Math.cos(yaw) * 0.95 },
        label: 'sit on the bench',
      });
    }

    // Planters in the two corners where the cheek walls meet the flanks, and
    // a wire bin by the north bench where the litter actually collects.
    //
    // They started at the FOOT of the steps, which walked beautifully and
    // failed the only test that matters: a planter there reaches x = -7.37,
    // the steps reach -8.40, and between them they closed the courtyard off
    // north-to-south — with the payphone blocking the pavement at the same z,
    // there was no way through at all. Tucked into the corners they leave the
    // whole mouth open. GOTCHAS §8: an approach corridor is reserved space.
    const shrubM = flat(shrubTex());
    for (const s of [-1, 1]) {
      const pz = cz + s * 2.9, px = XBOT - 0.45;
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.52, 0.86), stoneFace(DRESSED, 0.86, 0.52));
      pl.position.set(px, KERB_H + 0.26, pz);
      scene.add(pl);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.09, 0.96), capM);
      rim.position.set(px, KERB_H + 0.5, pz);
      scene.add(rim);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 0.78), shrubM);
      sh.position.set(px, KERB_H + 0.83, pz);
      scene.add(sh);
      solid({ minX: px - 0.48, maxX: px + 0.48, minZ: pz - 0.48, maxZ: pz + 0.48 });
    }
    const binZ = CZ1 - 1.9, binX = XF + 0.75;
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.78, 0.44), flat(meshTex()));
    bin.position.set(binX, KERB_H + 0.39, binZ);
    scene.add(bin);
    solid({ minX: binX - 0.25, maxX: binX + 0.25, minZ: binZ - 0.25, maxZ: binZ + 0.25 });
    // The recessed facade — the wall you stop at, 0.3 m proud of the stone the
    // same way the street wall is proud of its shopfronts. NOTCHED at the
    // entrance bay, because the flight climbs INTO that notch: sealed across
    // the full frontage it stopped you at x = -9.54, two steps up, against
    // nothing you could see. The gap is exactly the bay, so the reveals
    // either side of it are still solid and abut the notch edge to edge.
    if (COURT.climbable) {
      for (const s of [-1, 1]) {
        const zIn = cz + s * (BAY_W / 2);
        solid({
          minX: XF - 8, maxX: XF + 0.3,
          minZ: s < 0 ? CZ0 : zIn, maxZ: s < 0 ? zIn : CZ1,
        });
      }
    } else {
      solid({ minX: XF - 8, maxX: XF + 0.3, minZ: CZ0, maxZ: CZ1 });
    }
    // The profile — doorcase, entablature, cornice, coping. It projects from
    // the RECESSED face now, into the courtyard rather than over the
    // pavement, and stays inside the 0.3 m the facade collider reserves.
    const proj = (w: number, h: number, d: number, y: number, dz = 0, col = 0x9c9280) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(XF + d / 2 - 0.01, y, cz + dz);
      scene.add(m);
    };
    const jamb = BAY_W / 2 + 0.4;
    proj(0.8, BAY_H + 0.5, 0.28, (BAY_H + 0.5) / 2, -jamb);
    proj(0.8, BAY_H + 0.5, 0.28, (BAY_H + 0.5) / 2, jamb);
    proj(BAY_W + 2.4, 0.6, 0.28, BAY_H + 0.8);          // entablature over the pair
    proj(BAY_W + 1.2, 0.28, 0.28, BAY_H + 1.2, 0, 0xb2a892);
    proj(BAY_W - 1.4, 0.28, 0.28, BAY_H + 1.48, 0, 0xb2a892);
    proj(b.w, 0.62, 0.45, 12.15);                       // cornice, well above head height
    proj(b.w, 0.34, 0.28, LIB_H - 0.17);                // parapet coping
  };

  // ── the church ──────────────────────────────────────────────────────────
  //
  // A small urban Catholic parish church: gabled nave front, a tall pointed
  // doorway in three recessed orders, lancets, a rose window under the
  // coping, buttresses stepping down the front, and a tower with a louvred
  // belfry, a spire and a cross. It is the tallest thing for two streets and
  // that is the point — a landmark, not a storefront.
  const placeChurch = (x0: number, zBlock: number, b: BldSpec) => {
    const TOWER_W = 5, NAVE_W = b.w - TOWER_W;
    const NAVE_H = 17, RIDGE = 21.6, TOWER_H = 26, SPIRE = 5.2;
    // ── inlaid ────────────────────────────────────────────────────────────
    //
    // *"inlay the church and give it some stairs similar to the library but
    // keep the design of the church. the church facade is good i just want it
    // to have depth and a lil courtyard"* — so this is a SETBACK and nothing
    // else. Not one line of the elevation below changes: the stone, the
    // gable, the rose, the lancets and the doorway in its recessed orders are
    // approved and stay exactly as they are.
    //
    // The whole mass simply moves back off the block's facade line, and the
    // notch that leaves becomes the churchyard. Because every piece of the
    // church downstream is positioned off `zc` or `zFront`, moving those two
    // numbers moves the nave, the gable, the roof, the buttresses, the tower,
    // the spire and the noticeboard together, and nothing else needs to know.
    //
    // 2.6 m, not the library's 3.2: the user asked for *a lil courtyard*, and
    // a churchyard that reads enclosed wants to be tighter than a civic
    // plaza. It also has to pay for the flight, which eats 1.02 m of it.
    const SET_C = 2.6;
    const zStreet = zBlock + 1.7;                  // the block's facade line
    const zc = zBlock - SET_C;                     // the mass, set back off it
    const zFront = zc + 1.7;                       // the church's own facade
    const naveCx = x0 + NAVE_W / 2, towCx = x0 + NAVE_W + TOWER_W / 2;
    const naveS = masonry(NAVE_W, NAVE_H, 0);
    const NW = naveS.W, NH = naveS.H;
    const pm = naveS.ppm, yOf = (m: number) => Math.round(NH - m * pm);
    // ── the west front, set out in METRES, once ───────────────────────────
    //
    // The buttresses are REAL boxes and the openings are PAINTED, and until
    // now those two lived in different coordinate spaces: buttresses at
    // `gxm ± 3.4` in metres, lancets at `NW * 0.19` in texels. Nothing
    // reconciled them, so nothing made them miss — and they didn't. The
    // user: *"pillars of the church seem not fully thought out. they block
    // the windows i think?"* They did, by 0.82 m of a 2 m window, each side.
    //
    // So the BAYS come first. Four buttresses stand on the bay divisions,
    // three bays sit between them, and every opening is centred in a bay and
    // sized to fit inside it with its margins to spare. Both the boxes and
    // the paint read these same numbers, which is what makes the fix a fix
    // rather than a nudge: you cannot now move one without the other.
    //
    // The metres→texels conversion is the SURFACE's, not this painter's —
    // `masonry()` is the one place a canvas is sized (A's density mandate),
    // and a set-out that carried its own px/m would be the same defect one
    // level up.
    const mx = naveS.at;                // metres -> texel x
    const wx = naveS.m;                 // …and widths, never thinner than a texel
    const BUT_W = 0.92;                 // buttress width at the base
    const BUT_X = [0.46, 3.14, NAVE_W - 3.14, NAVE_W - 0.46];
    const bayC = [                      // the three bay centres
      (BUT_X[0] + BUT_W / 2 + BUT_X[1] - BUT_W / 2) / 2,
      NAVE_W / 2,
      (BUT_X[2] + BUT_W / 2 + BUT_X[3] - BUT_W / 2) / 2,
    ];
    const DOOR_W = 5.5, LANCET_W = 1.3, ROSE_D = 3.7;
    // widest thing in each bay vs the bay it has to live in — if this ever
    // goes negative the front is overcrowded and something must give
    //   side bays: 1.76 m clear, lancet 1.30  -> 0.23 m each side
    //   centre  : 5.80 m clear, doorway 5.50  -> 0.15 m each side
    // `naveS.paint` rather than a bare `pixTex(NW, NH, …)`: identical pixels —
    // paint() IS pixTex(W, H, draw) — but it also stamps the canvas with what it
    // is and at what density. The size was already derived from masonry(), so
    // the DENSITY was never wrong here; only the declaration was missing, which
    // is why seampairs could not judge these faces and kept offering them as
    // candidates. ct/civic.ts's own flank painter already does it this way.
    const naveTex = naveS.paint((g) => {
      const r = clcg(0x3c91e5);
      ashlar(g, NW, NH, r, naveS.m(STONE_COURSE_M), naveS.m(NAVE_BLOCK_M));
      const mid = mx(bayC[1]);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, yOf(1.5), NW, NH - yOf(1.5)); // plinth
      g.fillStyle = STONE_L; g.fillRect(0, yOf(1.5) - 2, NW, 2);
      // the doorway: three recessed orders, pointed, with a tympanum. Centred
      // in the middle bay and 0.15 m clear of the buttress either side.
      archFill(g, mid, wx(DOOR_W), yOf(7.4), yOf(0.55), STONE_D, true);
      archFill(g, mid, wx(DOOR_W - 1.0), yOf(7.0), yOf(0.55), STONE, true);
      archFill(g, mid, wx(DOOR_W - 1.75), yOf(6.6), yOf(0.55), 'rgba(0,0,0,0.4)', true);
      archFill(g, mid, wx(DOOR_W - 2.25), yOf(6.3), yOf(0.55), '#2a2118', true);
      // the leaves, cut to the innermost order rather than through it — the
      // top corners of a 24-px rectangle poked out of the pointed head
      const leafHW = Math.min(12, archHW(wx(DOOR_W - 2.25), yOf(6.3), yOf(4.4), true));
      g.fillStyle = '#4a3524';
      g.fillRect(mid - leafHW, yOf(4.4), leafHW * 2, yOf(0.55) - yOf(4.4));
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(mid - 1, yOf(4.4), 2, yOf(0.55) - yOf(4.4));
      g.fillStyle = '#8a7a4a';
      for (const hy of [yOf(3.4), yOf(2.2)]) { g.fillRect(mid - 10, hy, 8, 1); g.fillRect(mid + 3, hy, 8, 1); }
      g.fillStyle = '#c9a45e'; g.fillRect(mid - 4, yOf(2.4), 2, 4); g.fillRect(mid + 2, yOf(2.4), 2, 4);
      // steps
      for (let s = 0; s < 3; s++) {
        g.fillStyle = s % 2 ? STONE_L : STONE;
        g.fillRect(mid - 24 - s * 4, yOf(0.2 * (s + 1)), 48 + s * 8, Math.max(2, Math.round(0.2 * pm)));
      }
      g.fillStyle = STONE_L; g.fillRect(0, yOf(8.4), NW, 3);        // string course
      g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(0, yOf(8.4) + 3, NW, 1);
      // A lancet in each side bay — centred on the bay, so the buttresses
      // that define the bay cannot cross it. Narrower than they were (1.3 m,
      // not 2.0), which is both what the bay allows and what a lancet is.
      const lw = wx(LANCET_W), lg = wx(LANCET_W - 0.3), lh = Math.round(lg / 2);
      for (const cx of [mx(bayC[0]), mx(bayC[2])]) {
        archFill(g, cx, lw, yOf(13.4), yOf(9.2), STONE_D, true);
        archFill(g, cx, lg, yOf(13.2), yOf(9.35), '#26303a', true);
        g.fillStyle = '#7a4a4a'; g.fillRect(cx - lh, yOf(12.0), lg, 6);
        g.fillStyle = '#3a5a8a'; g.fillRect(cx - lh, yOf(11.0), lg, 6);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx, yOf(13.2), 1, yOf(9.35) - yOf(13.2));
        g.fillStyle = STONE_L; g.fillRect(cx - lh - 2, yOf(9.35), lg + 4, 2);
      }
      // both radii off the same surface: square today, honest if it is not
      roseWin(g, mid, yOf(14.3), wx(ROSE_D / 2), wx(ROSE_D / 2));
      g.fillStyle = 'rgba(46,38,30,0.1)';
      for (let i = 0; i < 16; i++) g.fillRect(Math.floor(r() * NW), yOf(8.4), 2, Math.round(r() * 60));
      dither(g, NW, NH, 620);
    });
    const roofM = slateM();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(NAVE_W, NAVE_H, 3.4),
      [stoneM(), stoneM(), roofM, roofM, flat(naveTex), stoneM()]);
    nave.position.set(naveCx, NAVE_H / 2, zc);
    scene.add(nave);
    // the gable: a real prism, so the silhouette is a gable and not a box
    const gx0 = x0, gx1 = x0 + NAVE_W, gxm = naveCx;
    const zf = zc + 1.7, zb = zc - 1.7;
    // The gable carries the same coursing as the wall under it, mapped with
    // triangular UVs — (0,0),(1,0),(0.5,1) is the gable's own shape, so the
    // stone runs on across the eaves instead of stopping at a smooth plate.
    const gab = masonry(NAVE_W, RIDGE - NAVE_H, 0);
    const gabW = gab.W, gabH = gab.H;
    const gabTex = gab.paint((g) => {
      const r = clcg(0x5d21a7);
      ashlar(g, gabW, gabH, r, gab.m(STONE_COURSE_M), gab.m(NAVE_BLOCK_M));
      for (let y = 0; y < gabH; y++) {                 // coping along both rakes
        const xL = Math.round((gabW / 2) * (1 - y / gabH));
        g.fillStyle = STONE_L;
        g.fillRect(xL, y, 5, 1); g.fillRect(gabW - xL - 5, y, 5, 1);
      }
      dither(g, gabW, gabH, 160);
    });
    const triG = (z: number) => {
      const gm = new THREE.BufferGeometry();
      const front = z > zc;
      gm.setAttribute('position', new THREE.Float32BufferAttribute(
        front ? [gx0, NAVE_H, z, gx1, NAVE_H, z, gxm, RIDGE, z]
          : [gx1, NAVE_H, z, gx0, NAVE_H, z, gxm, RIDGE, z], 3));
      gm.setAttribute('uv', new THREE.Float32BufferAttribute(
        front ? [0, 0, 1, 0, 0.5, 1] : [1, 0, 0, 0, 0.5, 1], 2));
      gm.computeVertexNormals();
      return new THREE.Mesh(gm, flat(gabTex));
    };
    scene.add(triG(zf)); scene.add(triG(zb));
    for (const s of [-1, 1]) {                       // the two roof slopes
      const sm = new THREE.BufferGeometry();
      const xe = s < 0 ? gx0 : gx1;
      sm.setAttribute('position', new THREE.Float32BufferAttribute(
        s < 0 ? [xe, NAVE_H, zb, xe, NAVE_H, zf, gxm, RIDGE, zf, xe, NAVE_H, zb, gxm, RIDGE, zf, gxm, RIDGE, zb]
          : [xe, NAVE_H, zf, xe, NAVE_H, zb, gxm, RIDGE, zb, xe, NAVE_H, zf, gxm, RIDGE, zb, gxm, RIDGE, zf], 3));
      sm.computeVertexNormals();
      scene.add(new THREE.Mesh(sm, roofM));
    }
    // an oculus in the gable, and the coping along the rake
    const ocT = pixTex(16, 16, (g) => {
      for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) {
        const d = Math.hypot(dx + 0.5, dy + 0.5);
        if (d > 7.5) continue;
        g.fillStyle = d > 5.5 ? STONE_D : (((dx + dy) & 1) ? '#3a5a8a' : '#8a3a3a');
        g.fillRect(dx + 8, dy + 8, 1, 1);
      }
    });
    const oc = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: ocT, alphaTest: 0.5 }));
    oc.position.set(gxm, NAVE_H + 1.5, zf + 0.02);
    scene.add(oc);
    // ── the buttresses ────────────────────────────────────────────────────
    //
    // They stand ON the bay divisions (see the set-out above), which is the
    // half of the fix that stops them crossing the lancets. This is the other
    // half: a buttress that runs 0 → 12.5 m as one slab and stops dead under
    // a flat cap, 4.5 m below the eaves, is a pilaster. A real one is built
    // in stages, each stepping back under a sloped weathering that sheds the
    // water onto the stage below, and it dies into the wall under the eaves.
    //
    // The stepping is mostly in WIDTH rather than in projection, and that is
    // forced: the church stands on a 2 m pavement and the wall collider
    // reserves only 0.3 m in front of the facade (GOTCHAS §9), so NOTHING
    // here may project further than that — the plinth is already at the
    // limit. 0.16 m of width per stage reads from straight on, which is the
    // angle this was reported from, and the weatherings do the rest.
    // A set-off is a sloped slab: high against the wall, low at the outer
    // edge. It has to carry the whole read, because the projections it steps
    // between are 0.06 m apart and this world has no lighting to shade them
    // with — the same lesson the courtyard steps taught, that in a MeshBasic
    // world contrast is PAINTED, not lit. So each one oversails the stage
    // sideways, and its UNDERSIDE is dark: from the pavement you are looking
    // up at these, and the shadow line under the slab is the whole cue.
    const wTop = stoneFace(DRESSED, 1.9, 0.36);
    const wUnder = stoneFace(RISER, 1.9, 0.1);
    const wSide = stoneFace(DRESSED, 1.9, 0.36);
    const setOff = (bx: number, y: number, w: number, pFrom: number, pTo: number, drop: number) => {
      const run = Math.max(0.05, pFrom - pTo), T = 0.18;
      const th = Math.atan2(drop, run);
      // A tilted slab's outermost point is its lower outer CORNER, not the
      // end of its slope — (T/2)·sin θ further out, which on the steep plinth
      // set-off is 0.08 m. That is the difference between living inside the
      // 0.3 m the facade reserves and hanging over the pavement, so the whole
      // slab is pulled back by exactly that. Nothing here reaches past 0.30.
      const wm = new THREE.Mesh(new THREE.BoxGeometry(w, T, Math.hypot(run, drop)),
        [wSide, wSide, wTop, wUnder, wSide, wSide]);
      wm.position.set(bx, y + drop / 2, zFront + (pFrom + pTo) / 2 - (T / 2) * Math.sin(th));
      wm.rotation.x = -th;
      scene.add(wm);
    };
    const STAGES = [
      { top: 1.50, w: BUT_W + 0.12, p: 0.30, drop: 0.14 },   // plinth, on the wall's own plinth line
      { top: 6.40, w: BUT_W, p: 0.24, drop: 0.30 },
      { top: 11.40, w: BUT_W - 0.16, p: 0.17, drop: 0.30 },
      { top: 15.40, w: BUT_W - 0.32, p: 0.10, drop: 0.34 },  // dies in under the eaves at 17
    ];
    for (const bxLocal of BUT_X) {
      const bx = x0 + bxLocal;
      STAGES.forEach((st, i) => {
        // every stage runs from the GROUND up, each one narrower and
        // shallower than the last: they nest rather than stack, so no two
        // faces are ever coplanar and there is nothing to z-fight (§6)
        const bt = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.top, st.p), stoneM());
        bt.position.set(bx, st.top / 2, zFront + st.p / 2);
        scene.add(bt);
        setOff(bx, st.top, st.w + 0.16, st.p, STAGES[i + 1]?.p ?? 0, st.drop);
      });
    }
    // ── the tower ──
    const tow = masonry(TOWER_W, TOWER_H, 0);
    const TW = tow.W, TH = tow.H;
    const tpm = tow.ppm, tyOf = (m: number) => Math.round(TH - m * tpm);
    const towTex = tow.paint((g) => {
      const r = clcg(0x91b3c2);
      ashlar(g, TW, TH, r, tow.m(STONE_COURSE_M), tow.m(TOWER_BLOCK_M));
      for (let y = 0, i = 0; y < TH; y += 18, i++) {           // quoins
        g.fillStyle = (i % 2) ? STONE_L : STONE_D;
        g.fillRect(0, y, 6, 18); g.fillRect(TW - 6, y, 6, 18);
      }
      const mid = Math.round(TW / 2);
      for (const m of [8.4, 15.0]) {                           // string courses
        g.fillStyle = STONE_L; g.fillRect(0, tyOf(m), TW, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, tyOf(m) + 3, TW, 1);
      }
      for (const m of [5.4, 11.6]) {                           // slot lancets up the shaft
        archFill(g, mid, 10, tyOf(m + 2.6), tyOf(m), STONE_D, true);
        archFill(g, mid, 6, tyOf(m + 2.4), tyOf(m + 0.15), '#26303a', true);
      }
      // the belfry: two tall louvred openings
      for (const cx of [mid - 9, mid + 9]) {
        archFill(g, cx, 14, tyOf(23.0), tyOf(17.0), STONE_D, true);
        archFill(g, cx, 10, tyOf(22.8), tyOf(17.2), '#1a1e24', true);
        g.fillStyle = 'rgba(174,166,148,0.5)';
        for (let y = tyOf(21.6); y < tyOf(17.2); y += 4) g.fillRect(cx - 5, y, 10, 2);
      }
      g.fillStyle = STONE_D; g.fillRect(0, tyOf(24.4), TW, 4);   // cornice
      g.fillStyle = STONE_L;
      for (let x = 1; x < TW; x += 5) g.fillRect(x, tyOf(24.4) + 4, 3, 4);
      g.fillStyle = STONE_L; g.fillRect(0, 0, TW, tyOf(25.4));
      g.fillStyle = 'rgba(46,38,30,0.1)';
      for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * TW), tyOf(15.0), 2, Math.round(r() * 70));
      dither(g, TW, TH, 520);
    });
    const towM = flat(towTex);
    // The side face is 3.7 m deep, not TOWER_W. Stretching the 5 m canvas
    // across it painted the tower's flank at 10.81 px/m against the front's
    // 8 — same texture, two densities. Map the same stone at the same px/m
    // and let it crop instead.
    const TOWER_D = 3.7;
    const towSide = towTex.clone();
    towSide.repeat.x = TOWER_D / TOWER_W;
    towSide.needsUpdate = true;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, TOWER_H, TOWER_D),
      [flat(towSide), stoneM(), slateM(), slateM(), towM, stoneM()]);
    tower.position.set(towCx, TOWER_H / 2, zc + 0.15);   // stands 0.3 m proud of the nave front
    scene.add(tower);
    // the spire, and the cross on top of it
    const apex = TOWER_H + SPIRE;
    const hw = TOWER_W / 2, hd = 1.85, tz = zc + 0.15;
    const corners: [number, number][] = [
      [towCx - hw, tz - hd], [towCx + hw, tz - hd], [towCx + hw, tz + hd], [towCx - hw, tz + hd],
    ];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const sp = new THREE.BufferGeometry();
      sp.setAttribute('position', new THREE.Float32BufferAttribute(
        [ax, TOWER_H, az, bx, TOWER_H, bz, towCx, apex, tz], 3));
      sp.computeVertexNormals();
      scene.add(new THREE.Mesh(sp, new THREE.MeshBasicMaterial({ color: 0x3f434b, side: THREE.DoubleSide })));
    }
    const crossM = new THREE.MeshBasicMaterial({ color: 0x8a8271 });
    const cUp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), crossM);
    cUp.position.set(towCx, apex + 0.75, tz);
    scene.add(cUp);
    const cAcross = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.14), crossM);
    cAcross.position.set(towCx, apex + 1.02, tz);
    scene.add(cAcross);
    // the notice board every parish has, by the door
    const ntT = pixTex(24, 16, (g) => {
      g.fillStyle = '#2e3a2c'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = '#d8d0c0'; g.fillRect(2, 2, 20, 12);
      g.fillStyle = '#4a4438'; g.font = 'bold 4px monospace'; g.textAlign = 'center';
      g.fillText('MASS', 12, 7); g.fillText('SUN 9', 12, 12);
    });
    const nt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.1), flat(ntT));
    nt.position.set(naveCx + 4.6, 1.75, zFront + 0.06);
    scene.add(nt);

    // ── the churchyard ────────────────────────────────────────────────────
    //
    // It must not read as the library's forecourt. That one is a civic plaza:
    // sawn flags in courses, benches facing each other, a space that invites
    // you to sit in the middle of it. This is a churchyard — enclosed, and
    // quieter. Everything about it says so rather than being told:
    //
    //   FLAGS, not paving courses — irregular sizes on a broken bond, mossy
    //     in the joints, a different and cooler stone from either the library
    //     or the pavement.
    //   A WALL ON THE STREET LINE with a gate, not open gate piers. You enter
    //     through something. The library's mouth is 16 m wide; this one is
    //     2.6 m and everything either side of it is wall.
    //   PLANTING IN THE CORNERS, against the wall, not out in the space.
    //   And the space left over is deliberately small — you cross it, you do
    //     not sit down in it.
    const YARD_X0 = x0, YARD_X1 = x0 + b.w;
    const yardMid = (YARD_X0 + YARD_X1) / 2;
    // The flags. Irregular, and drawn from the surface's real metres like
    // every other masonry canvas in the world (A's density mandate).
    const flagS = masonry(b.w, SET_C, 0, 4);
    const flagTex = flagS.paint((g) => {
      const r = clcg(0x6b2fd1);
      const W = flagS.W, H = flagS.H, fm = flagS.at;
      g.fillStyle = '#5f6058'; g.fillRect(0, 0, W, H);           // the joints
      // a broken bond: each course a different depth, each flag a different
      // width, so no two joints line up the way the library's do
      for (let y = 0, i = 0; y < H; i++) {
        const d = fm(0.62 + (i % 3) * 0.24);
        for (let x = -Math.round(r() * fm(0.8)); x < W;) {
          const w = fm(0.55 + r() * 0.75);
          const k = r();
          g.fillStyle = k > 0.82 ? '#8d8c80' : k > 0.5 ? '#82806f' : k > 0.2 ? '#78776a' : '#6e6d62';
          g.fillRect(x + 1, y + 1, w - 1, Math.min(d - 1, H - y - 1));
          x += w;
        }
        y += d;
      }
      g.fillStyle = 'rgba(74,86,58,0.5)';                        // moss in the joints
      for (let i = 0; i < 260; i++) g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1 + Math.floor(r() * 2), 1);
      g.fillStyle = 'rgba(38,34,28,0.16)';                       // worn, dished at the gate
      for (let i = 0; i < 40; i++) {
        g.fillRect(Math.round(W * 0.5 + (r() - 0.5) * fm(3)), Math.round(r() * H), 2 + Math.floor(r() * 5), 2 + Math.floor(r() * 3));
      }
      dither(g, W, H, Math.round(b.w * SET_C * 6));
    });
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(b.w, SET_C), flat(flagTex));
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(yardMid, KERB_H, zFront + SET_C / 2);
    scene.add(yard);

    // The steps: the SAME flight the library uses, turned a quarter turn
    // because street.ts turns the church. 0.41 m of climb, not the library's
    // 0.85 — the doorway is PAINTED with its sill 0.55 m above the church's
    // base and its own three steps below that, and the facade is approved, so
    // the real flight lands exactly where the painted one already says the
    // threshold is. Change one and you must change the other.
    const SILL = 0.55, N_C = 3, TREAD_C = 0.34;
    const uTop = SET_C - 0.5;                       // a top landing you can stand on
    const cst = flight({
      axis: 'z', ox: naveCx, oz: zStreet, dir: -1, n: N_C,
      yBase: KERB_H, yTop: SILL,
      uNose: uTop - N_C * TREAD_C, uTop, uBack: SET_C,
      width: 4.6, cheek: 0.4,
    });

    // The wall on the street line, with the gate in the middle of it. 0.3 m
    // thick and standing INSIDE the line, so it takes nothing off the 2 m
    // walk (§9) — it sits in the 0.3 m the block's facade collider already
    // reserves, exactly like the library's profile does.
    // A DWARF WALL WITH RAILINGS, not a wall on its own: 0.62 m of stone and
    // 0.72 m of iron above it. The first cut was 0.92 m of solid stone and it
    // hid the flight completely from the pavement — you cannot ask for stairs
    // and then build a parapet in front of them. Low stone reads as boundary,
    // the railing reads as enclosure, and you can see through both.
    //
    // The railings are PAINTED on an alpha-tested plane rather than built out
    // of 70 little boxes. Symmetrical by construction, so the double-sided
    // mirroring that bit the HOTEL sign (§10) cannot show here.
    const soilT = pixTex(32, 32, (g) => {
      const r = clcg(0x6d21b4);
      g.fillStyle = '#4a4335'; g.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 210; i++) {
        const k = r();
        g.fillStyle = k > 0.72 ? '#5b5340' : k > 0.34 ? '#3e382c' : '#544c3b';
        g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1);
      }
      for (let i = 0; i < 9; i++) {                      // clods, and a stone or two
        g.fillStyle = r() < 0.7 ? '#5f573f' : '#6f6a5c';
        g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 2 + Math.floor(r() * 2), 2);
      }
      dither(g, 32, 32, 70);
    });
    const soilM = (() => {
      const t = soilT.clone();
      t.needsUpdate = true;
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2.0 / 1.0, (SET_C - 1.1) / 1.0);      // one tile per metre
      return flat(t);
    })();
    const GATE_W = 2.6, WALL_H = 0.62, RAIL_H = 0.72;
    const gate0 = naveCx - GATE_W / 2, gate1 = naveCx + GATE_W / 2;
    // The churchyard's coping, the last of the flat-colour stone the desk
    // predicted would be here: *"the church forecourt and the park will have
    // the same."* It did.
    const capM2 = stoneFace(DRESSED, 1.6, 0.3);
    const railTex = (wM: number) => {
      const W = Math.max(8, Math.round(wM * 16)), H = Math.round(RAIL_H * 16);
      return pixTex(W, H, (g) => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#2f3238';
        const pitch = Math.max(3, Math.round(0.19 * 16));
        for (let x = Math.round(pitch / 2); x < W; x += pitch) g.fillRect(x, 1, 2, H - 2);
        g.fillRect(0, 0, W, 2);                                  // top rail
        g.fillRect(0, H - 3, W, 2);                              // bottom rail
        g.fillStyle = '#3d4148';                                 // spear heads
        for (let x = Math.round(pitch / 2); x < W; x += pitch) g.fillRect(x - 1, 2, 4, 2);
      });
    };
    const railM = (wM: number) => new THREE.MeshBasicMaterial({
      map: railTex(wM), alphaTest: 0.5, side: THREE.DoubleSide,
    });
    for (const [wx0, wx1] of [[YARD_X0, gate0 - 0.25], [gate1 + 0.25, YARD_X1]]) {
      const w = wx1 - wx0;
      if (w <= 0) continue;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, 0.3), stoneFace(DRESSED, w, WALL_H));
      wall.position.set((wx0 + wx1) / 2, WALL_H / 2, zStreet - 0.15);
      scene.add(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.4), capM2);
      cap.position.set((wx0 + wx1) / 2, WALL_H + 0.05, zStreet - 0.15);
      scene.add(cap);
      const rail = new THREE.Mesh(new THREE.PlaneGeometry(w, RAIL_H), railM(w));
      rail.position.set((wx0 + wx1) / 2, WALL_H + 0.1 + RAIL_H / 2, zStreet - 0.15);
      scene.add(rail);
      solidLocal(wx0, wx1, zStreet - 0.3, zStreet);
    }
    for (const gx of [gate0 - 0.25, gate1 + 0.25]) {             // the gate piers
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.55, 0.5), stoneFace(DRESSED, 0.5, 1.55));
      pier.position.set(gx, 0.775, zStreet - 0.25);
      scene.add(pier);
      const pc = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.62), capM2);
      pc.position.set(gx, 1.62, zStreet - 0.25);
      scene.add(pc);
      solidLocal(gx - 0.25, gx + 0.25, zStreet - 0.5, zStreet);
      // its leaf, standing open INTO the yard — hinged on the pier and swung
      // back, which is how a parish gate spends every hour it is not locked
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.06), railM(1.15));
      leaf.position.set(gx, 0.67, zStreet - 0.25 - 0.575);
      leaf.rotation.y = Math.PI / 2;
      scene.add(leaf);
    }
    // planting in the two corners, against the wall where it is always found
    const shrubM2 = flat(shrubTex());
    for (const s of [-1, 1]) {
      const px = s < 0 ? YARD_X0 + 1.15 : YARD_X1 - 1.15;
      // …and the beds are SOIL, which is not a flat brown either. Turned earth
      // with clods and the odd stone in it, sized from the bed's own metres.
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.26, SET_C - 1.1), soilM);
      bed.position.set(px, KERB_H + 0.13, zFront + (SET_C - 1.1) / 2);
      scene.add(bed);
      for (const [dx, dz, h] of [[-0.5, 0.4, 1.5], [0.45, 1.15, 1.15]] as [number, number, number][]) {
        const yew = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), shrubM2);
        yew.position.set(px + dx, KERB_H + 0.26 + h / 2, zFront + 0.5 + dz);
        scene.add(yew);
      }
      solidLocal(px - 1.0, px + 1.0, zFront, zFront + SET_C - 1.1);
    }
    // the flight's cheeks, and the facade you stop at
    for (const c of cst.cheeks) {
      solidLocal(naveCx + c.v0, naveCx + c.v1, zStreet - c.u1, zStreet - c.u0);
    }
    solidLocal(YARD_X0, YARD_X1, zFront - 8, zFront);
    // The churchyard floor: flags, and the flight where it climbs. Written in
    // the church's OWN frame — street.ts turns the whole thing, so this is
    // converted to world coordinates lazily, once, on the first query.
    floorLocal((x, z) => {
      // a 5 cm tolerance on every edge. The extents are compared against
      // coordinates that have been through a matrix inverse, so the facade
      // plane and the street line land a float's-width outside themselves and
      // the patch drops the query — which reads as the floor vanishing at the
      // wall. Nothing standable is within 5 cm of these lines anyway.
      const T = 0.05;
      if (x < YARD_X0 - T || x > YARD_X1 + T || z < zFront - T || z > zStreet + T) return null;
      const ramp = cst.gy(zStreet - z, x - naveCx);
      return ramp !== null ? ramp : KERB_H;
    });
    // the flanks the setback uncovers — PAWN one side, the bodega the other.
    // 13.0 m clears the shorter of the two (the bodega, 3 floors, 14.8 m).
    for (const s of [-1, 1]) {
      const xp = s < 0 ? YARD_X0 : YARD_X1;
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(SET_C, 13.0),
        flat(partyTex(s < 0 ? 0x51ba07 : 0x2d77fe, s > 0, SET_C, 13.0)));
      pan.position.set(xp - s * 0.03, 6.5, zFront + SET_C / 2);
      pan.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(pan);
    }
  };

  // `colliders` is filled as the placers run, so read it AFTER placing.
  return { placeLibrary, placeChurch, colliders };
}

import * as THREE from 'three';
import type { AABB } from '../fp';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';

// ── the interior kit ──────────────────────────────────────────────────────
//
// Ten interiors were asked for at once — burger barn, diner, library, tax
// service, pawn shop, bodega, thrift, room 301, casino, hotel — and they are
// being built by different agents in parallel. Two things would go wrong
// without a shared kit, and both are fatal to a world whose whole value is
// that it looks MADE rather than generated:
//
//   1. Ten different room shells. Every builder would pick their own ceiling
//      height, their own doorway width, their own way of getting you back out
//      to the street. You would feel it immediately as ten unrelated games.
//   2. Ten builders colliding in world space. Interiors are not inside their
//      buildings — they are rooms parked far out along +x that you teleport
//      to. Two agents both choosing "somewhere past 300" silently overlap and
//      you walk out of the diner into the pawn shop.
//
// So this module owns BOTH: it hands out addresses, and it builds the shell.
// A builder calls `buildRoom` and gets back a room already wired to the
// street — door in, door out, colliders, floor height — and then furnishes it
// in LOCAL coordinates without ever knowing where in the world it stands.
//
// It also settles a standing complaint by construction. The user, on the
// walk-up: *"i need a door and not paper thin walls"*. Interior walls here
// are boxes with real thickness, and every opening is framed with jambs and a
// header, so a doorway has a visible reveal you walk THROUGH. There is no way
// to get a paper wall out of this kit, which is the point of having one.

// ── addressing ────────────────────────────────────────────────────────────
//
// x < 100 is the street. 100–230 is the walk-up, 230–260 the old bodega room;
// both predate this kit and keep their addresses. New interiors start at 400
// and take a 80 m slab each — far wider than any room, so there is dead space
// between neighbours and no chance of a stray collider or an overshooting
// teleport landing you in the wrong shop.
const SLAB_X0 = 400, SLAB_W = 80;

interface Slab { id: string; x0: number; x1: number; gy: (x: number, z: number) => number | null }
const SLABS: Slab[] = [];

/**
 * The east edge of the world, which is the east edge of the LAST slab actually
 * claimed. It has to be derived rather than fixed: a constant sized for the
 * sixteen rooms we might one day build would leave the player free to walk a
 * kilometre of dead ground east of the bodega, which is how you discover the
 * world has no back wall. Call this after every room is built.
 */
export function interiorMaxX(): number {
  return SLAB_X0 + Math.max(1, SLABS.length) * SLAB_W;
}

/**
 * Floor height inside the interior belt, or null if this point is not in any
 * room. `crosstown.ts` consults this before its own street logic — a room
 * owns the floor within its slab, so a builder can put a step or a mezzanine
 * in without the entry point knowing anything about it.
 *
 * Null, not 0, for the dead space BETWEEN slabs: answering 0 there would be
 * this module claiming ground it does not own, and the answer would be wrong
 * the day a room sits on a raised floor next to it.
 */
export function interiorGround(x: number, z: number): number | null {
  if (x < SLAB_X0) return null;
  for (const s of SLABS) if (x >= s.x0 && x < s.x1) return s.gy(x, z) ?? 0;
  return null;
}

// ── the shell ─────────────────────────────────────────────────────────────

export interface RoomSpec {
  /** stable id, also the slab key — 'diner', 'pawn', 'casino' */
  id: string;
  /** what the [E] prompt says outside: 'into the DINER' */
  label: string;
  /** clear interior size in metres, wall face to wall face */
  w: number;
  d: number;
  /** ceiling height. 2.9 is a shop; a casino or a library wants more */
  h?: number;
  /** floor, wall, ceiling, trim — hex ints, muted, 1997 */
  palette?: { floor?: number; wall?: number; ceil?: number; trim?: number };
  /** the way in, on the street: where you stand and press E */
  door: {
    /** street coords of the [E] spot outside */
    x: number; z: number; r?: number;
    /** where standing outside is legal — defaults to "anywhere on the street" */
    ok?: () => boolean;
    /** where you land when you step back OUT, and which way you face */
    outX: number; outZ: number; outYaw: number; outGy: number;
    /** door centre along the room's front (south) wall, in local x. 0 = middle */
    at?: number;
    /** clear door width. 1.1 is generous; the player capsule is 0.72 across */
    width?: number;
  };
  /** shopfront glazing on the front wall, so the room is not a sealed box */
  window?: { at?: number; w: number; h?: number; sill?: number };
}

export interface Room {
  /** world centre of the floor */
  cx: number; cz: number;
  /** clear dimensions, echoed back so furniture can be sized off them */
  W: number; D: number; H: number;
  /** local (x right, z toward the door) → world, for anything that has to be
   *  told a world address. Furniture does NOT need these — use `put`. */
  wx: (lx: number) => number;
  wz: (lz: number) => number;
  /** add a mesh positioned in LOCAL coordinates. Always place through this
   *  rather than `group.add` — see the note on `group`. */
  put: (m: THREE.Object3D, lx: number, y: number, lz: number) => THREE.Object3D;
  /** a collider in LOCAL coordinates, centred on (lx,lz) */
  solid: (lx: number, lz: number, w: number, d: number) => AABB;
  /** every collider this room has registered — hand these to the rig */
  colliders: AABB[];
  /** true while the player is standing in THIS room */
  inside: () => boolean;
  /**
   * The group everything in the room hangs off. It sits at the world ORIGIN
   * and its children carry world positions — deliberately, and it is not free
   * to change. `props.dimWorld` decides what the night sweep may darken by
   * reading each object's own `position.x` and skipping `|x| > 100`, and it
   * reads the LOCAL position, not the world one. Park the group out at the
   * room's address with local children and every stick of furniture looks
   * like it is standing on the street: the whole interior goes dark at 2am
   * while the lit window it is behind stays on.
   *
   * So: add through `put`, which does the offset for you. Reach in here with
   * `group.add` and you get a room that is correct all day and wrong all
   * night, which is the kind of bug that ships.
   */
  group: THREE.Group;
}

let slabN = 0;

export function buildRoom(ctx: CtxBuild, spec: RoomSpec): Room {
  const { scene, flat, player } = ctx;
  const W = spec.w, D = spec.d, H = spec.h ?? 2.9;
  const pal = spec.palette ?? {};
  const FLOOR = pal.floor ?? 0x8a8578, WALL = pal.wall ?? 0x9aa88e;
  const CEIL = pal.ceil ?? 0xb0aa9c, TRIM = pal.trim ?? 0x5a4632;

  // claim a slab. Rooms are centred in theirs, so a builder who overshoots by
  // a few metres runs into dead space rather than into somebody else's shop.
  const idx = slabN++;
  const x0 = SLAB_X0 + idx * SLAB_W, x1 = x0 + SLAB_W;
  const cx = x0 + SLAB_W / 2, cz = 0;
  const wx = (lx: number) => cx + lx;
  const wz = (lz: number) => cz + lz;

  // The group stays at the origin and its children hold world positions — see
  // the note on `Room.group` for why. `place` is the only way anything gets
  // into the room, so the offset happens in exactly one spot.
  const group = new THREE.Group();
  scene.add(group);
  const place = <T extends THREE.Object3D>(m: T, lx: number, y: number, lz: number): T => {
    m.position.set(cx + lx, y, cz + lz);
    group.add(m);
    return m;
  };
  const colliders: AABB[] = [];

  // ── floor ──
  const linoT = pixTex(32, 32, (g) => {
    const c = new THREE.Color(FLOOR);
    const hex = (m: number) => '#' + c.clone().multiplyScalar(m).getHexString();
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? hex(0.86) : hex(1.06);
      g.fillRect(x * 16, y * 16, 16, 16);
    }
    dither(g, 32, 32, 50);
  });
  linoT.wrapS = linoT.wrapT = THREE.RepeatWrapping;
  // texel density from the room's REAL METRES, so a big room does not get a
  // stretched floor and a small one a busy postage stamp (GOTCHAS §5)
  linoT.repeat.set(Math.max(1, Math.round(W / 1.6)), Math.max(1, Math.round(D / 1.6)));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), flat(linoT));
  floor.rotation.x = -Math.PI / 2;
  place(floor, 0, 0.005, 0);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshBasicMaterial({ color: CEIL, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  place(ceil, 0, H, 0);

  // ── walls, with THICKNESS ──
  //
  // A wall is a box 0.18 m thick, not a plane. That single decision is what
  // gives every opening a reveal: you see the depth of the jamb as you walk
  // through, the header casts the doorway as a hole in something solid, and
  // the room stops reading as a cardboard set.
  const T = 0.18;
  // One plaster tile is TILE_M wide and the full height of the room, so the
  // canvas has to be sized off H — a fixed 32×54 gave ~12 px/m across and
  // ~18 px/m up, and texels half again as tall as they are wide turn every
  // speck of grain into a dash. Derive both from the same px/m (GOTCHAS §5 is
  // about repeat, but the same rule decides the canvas) and they come out
  // square in any ceiling height a room asks for.
  const TILE_M = 2.7;
  const PXM = 32 / TILE_M;                                  // ≈ 11.9 px/m
  const wallPx = Math.max(16, Math.round(H * PXM));
  const scuffPx = Math.max(2, Math.round(0.5 * PXM));
  const plasterT = pixTex(32, wallPx, (g) => {
    const c = new THREE.Color(WALL);
    g.fillStyle = '#' + c.getHexString(); g.fillRect(0, 0, 32, wallPx);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(0, wallPx - scuffPx, 32, scuffPx);           // scuffed base
    // Grain weighted toward the floor. An even scatter across a big flat wall
    // seen from two metres away does not read as plaster, it reads as mould —
    // the first pass did. Walls get dirty from the bottom up, so most of the
    // grain lives in the bottom metre and the rest is nearly clean.
    dither(g, 32, wallPx, Math.round(32 * wallPx * 0.015));
    const grimePx = Math.max(3, Math.round(1.0 * PXM));
    g.save();
    g.translate(0, wallPx - grimePx);
    dither(g, 32, grimePx, Math.round(32 * grimePx * 0.05));
    g.restore();
  });
  const wallMat = (len: number) => {
    const t = plasterT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, len / TILE_M), 1);
    t.needsUpdate = true;
    return flat(t);
  };
  const trimM = new THREE.MeshBasicMaterial({ color: TRIM });

  /** a solid run of wall: length `len`, from height `y0` to `y1` */
  const wallRun = (lx: number, lz: number, len: number, along: 'x' | 'z', y0: number, y1: number) => {
    if (len <= 0.001 || y1 - y0 <= 0.001) return;
    const geo = along === 'x'
      ? new THREE.BoxGeometry(len, y1 - y0, T)
      : new THREE.BoxGeometry(T, y1 - y0, len);
    const side = wallMat(len);
    const m = new THREE.Mesh(geo, [side, side, trimM, trimM, side, side]);
    place(m, lx, (y0 + y1) / 2, lz);
  };

  const hw = W / 2, hd = D / 2;
  // back and both flanks are solid
  wallRun(0, -hd - T / 2, W + T * 2, 'x', 0, H);
  wallRun(-hw - T / 2, 0, D + T * 2, 'z', 0, H);
  wallRun(hw + T / 2, 0, D + T * 2, 'z', 0, H);

  // the front wall carries the door and the window, so it is built in pieces
  const dAt = spec.door.at ?? 0;
  const dW = spec.door.width ?? 1.1;
  const DOOR_H = 2.15;
  const win = spec.window;
  const wAt = win?.at ?? 0;
  const wW = win?.w ?? 0;
  const wSill = win?.sill ?? 0.95;
  const wH = win?.h ?? 1.5;

  // Openings along the front wall, left to right, as [from, to, y0, y1].
  //
  // The wall is then built as the runs BETWEEN them, which only produces a
  // wall at all if the openings are inside it, in order, and disjoint. None of
  // that is guaranteed by the types — a builder sizing a shopfront window off
  // the room width will overlap the door sooner or later — and the failure is
  // silent: negative-length runs are dropped, so you get a room with a hole in
  // it and no clue why. Check it here, once, for all ten rooms.
  const X0 = -hw - T, X1 = hw + T;
  const bad = (why: string) => console.warn(`[interior:${spec.id}] ${why}`);
  const holes: [number, number, number, number][] = [];
  const addHole = (what: string, from: number, to: number, y0: number, y1: number) => {
    if (to - from <= 0.001) { bad(`${what} has no width — dropped`); return; }
    if (from < X0 || to > X1) {
      bad(`${what} spans ${from.toFixed(2)}…${to.toFixed(2)} but the front wall only runs `
        + `${X0.toFixed(2)}…${X1.toFixed(2)} — dropped`);
      return;
    }
    if (y1 > H) { bad(`${what} is ${y1.toFixed(2)} m tall in a ${H.toFixed(2)} m room — dropped`); return; }
    const clash = holes.find((o) => from < o[1] && to > o[0]);
    if (clash) {
      bad(`${what} overlaps the opening at ${clash[0].toFixed(2)}…${clash[1].toFixed(2)} — dropped`);
      return;
    }
    holes.push([from, to, y0, y1]);
  };
  // the door goes in first: a room with no window is a room, a room with no
  // door is a bug, so the door is the one that wins a clash
  addHole('the door', dAt - dW / 2, dAt + dW / 2, 0, DOOR_H);
  if (win && wW > 0) addHole('the window', wAt - wW / 2, wAt + wW / 2, wSill, wSill + wH);
  const hasWindow = holes.length > 1;
  holes.sort((a, b) => a[0] - b[0]);

  let cursor = -hw - T;
  for (const [from, to, y0, y1] of holes) {
    wallRun((cursor + from) / 2, hd + T / 2, from - cursor, 'x', 0, H);
    if (y0 > 0) wallRun((from + to) / 2, hd + T / 2, to - from, 'x', 0, y0);       // under a window
    if (y1 < H) wallRun((from + to) / 2, hd + T / 2, to - from, 'x', y1, H);       // header over
    cursor = to;
  }
  wallRun((cursor + hw + T) / 2, hd + T / 2, hw + T - cursor, 'x', 0, H);

  // jambs: the short returns that make the reveal visible from inside the room
  const jamb = (lx: number, y1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, y1, T), trimM);
    place(m, lx, y1 / 2, hd + T / 2);
  };
  jamb(dAt - dW / 2, DOOR_H);
  jamb(dAt + dW / 2, DOOR_H);

  if (hasWindow) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(wW, wH),
      new THREE.MeshBasicMaterial({ color: 0x7d8b93, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    place(glass, wAt, wSill + wH / 2, hd + T / 2);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(wW + 0.2, 0.08, T + 0.12), trimM);
    place(sill, wAt, wSill - 0.04, hd + T / 2);
  }

  // wall colliders — the openings are NOT gaps you can walk out of, except
  // the doorway, which is left clear so the [E] spot inside is reachable
  // (GOTCHAS §8: a collider that swallows a trigger is the classic way to
  // make a door un-enterable, and it has already happened once here)
  const wall = (mnx: number, mxx: number, mnz: number, mxz: number) => {
    const b: AABB = { minX: cx + mnx, maxX: cx + mxx, minZ: cz + mnz, maxZ: cz + mxz };
    colliders.push(b);
    return b;
  };
  wall(-hw - T, hw + T, -hd - T, -hd);            // back
  wall(-hw - T, -hw, -hd - T, hd + T);            // left
  wall(hw, hw + T, -hd - T, hd + T);              // right
  wall(-hw - T, dAt - dW / 2, hd, hd + T);        // front, left of the door
  wall(dAt + dW / 2, hw + T, hd, hd + T);         // front, right of the door
  // …and the doorway is stopped OUTSIDE the threshold, not in it.
  //
  // Leaving the opening as a plain gap in the collider line is how you get a
  // room you can walk out of the front of, into the dead ground between
  // slabs — the way in is a teleport, so there is nothing out there. But the
  // blocker cannot sit IN the doorway either, because the way-out [E] spot
  // stands just inside it and a collider that swallows a trigger is exactly
  // how the bodega became un-enterable (GOTCHAS §8). So it goes on the far
  // face of the wall: you can still walk right up into the reveal and get the
  // prompt, you just cannot keep going.
  wall(dAt - dW / 2, dAt + dW / 2, hd + T, hd + T + 0.18);

  // ── the light ──
  //
  // Interiors are excluded from the night sweep (`dimWorld` skips |x| > 100),
  // so a room keeps its own light around the clock — which is right: a shop
  // with the lights on at 2am is exactly what a lit window on the street is
  // promising. This is the glow, not the illumination; the flat materials do
  // the rest.
  const bulbT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,235,190,0.8)');
    gr.addColorStop(1, 'rgba(255,235,190,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const bulbM = new THREE.MeshBasicMaterial({
    map: bulbT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lamps = Math.max(1, Math.round(D / 3.5));
  for (let i = 0; i < lamps; i++) {
    const lz = -hd + D * ((i + 0.5) / lamps);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), bulbM);
    gl.rotation.x = Math.PI / 2;
    place(gl, 0, H - 0.25, lz);
  }

  // ── the way in and the way out ────────────────────────────────────────
  //
  // Both spots are registered HERE, so no builder has to touch crosstown.ts
  // to add an interior — the entry point is the most-contended file in the
  // project (GOTCHAS §11) and ten new interiors would have meant ten agents
  // queueing to edit it.
  //
  // The way out lands you where the spec says, and that landing point must be
  // OUTSIDE the entry trigger's radius or you get sucked straight back in the
  // moment you step out. That bug has shipped once already.
  const doorR = spec.door.r ?? 1.05;
  // where the way-out trigger sits, and — separately — where you actually land
  // when you come in. They are not the same point: landing ON the threshold
  // puts you inside the swing of the door leaf and a step from walking back
  // out by accident. Land a stride clear of it, still close enough that the
  // way-out prompt is already up, so you always know how to leave.
  const spotX = wx(dAt), spotZ = wz(hd - 0.55);
  const arriveZ = wz(hd - 1.15);
  ctx.spot({
    x: spec.door.x, z: spec.door.z, r: doorR,
    ok: () => (spec.door.ok ? spec.door.ok() : player.x() < 100),
    label: () => spec.label,
    // yaw 0 is fwd = (0,0,-1). The door is in the +z wall, so facing away from
    // it — INTO the room — is yaw 0. Facing Math.PI walks you back out.
    act: () => player.jumpTo(spotX, arriveZ, 0, 0),
  });
  ctx.spot({
    x: spotX, z: spotZ, r: 1.0,
    ok: () => player.x() >= x0 && player.x() < x1,
    label: () => 'out to the street',
    act: () => player.jumpTo(spec.door.outX, spec.door.outZ, spec.door.outYaw, spec.door.outGy),
  });
  // Stepping out must not put you back inside the trigger you just used. Get
  // this wrong and the street prompt reads "into the DINER" the instant you
  // leave, and one more E — the key you are already pressing — puts you
  // straight back. That has shipped once. Checked rather than trusted,
  // because it is invisible until someone walks it.
  const outGap = Math.hypot(spec.door.outX - spec.door.x, spec.door.outZ - spec.door.z);
  if (outGap < doorR + 0.35) {
    bad(`stepping out lands ${outGap.toFixed(2)} m from the way-in spot, inside its `
      + `${doorR.toFixed(2)} m trigger — you will be sucked straight back in. `
      + `Move outX/outZ at least ${(doorR + 0.35).toFixed(2)} m clear.`);
  }

  // The door leaf, propped open.
  //
  // Hung on a pivot at the hinge rather than positioned at an angle by hand:
  // a plane placed at its own centre and then rotated swings its inner half
  // back THROUGH the jamb, which is what the previous version did. Hinged on
  // the outer face and swung outward, it cannot reach the wall at all, and it
  // reads from inside as a propped shop door rather than as a hole.
  const leafT = pixTex(32, 64, (g) => {
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#8a97a2'; g.fillRect(4, 4, 24, 40);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 24, 24, 2);
    g.fillStyle = '#c9b45e'; g.fillRect(25, 34, 3, 3);
  });
  // The hinge is done by arithmetic rather than by a pivot Group, for the same
  // reason everything else here is: a child of a nested group carries a LOCAL
  // position, `dimWorld` reads that local position, and the leaf alone would
  // go dark at 2am in an otherwise lit room. So swing it by hand — offset the
  // centre a half-leaf out from the hinge along the open angle, which is
  // exactly what the pivot was doing.
  const SWING = -0.85;                            // ~49° open, swinging outward
  const leafW = dW * 0.95;
  const hx = dAt - dW / 2, hz = hd + T + 0.02;    // the hinge, on the OUTER face
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(leafW, DOOR_H * 0.98),
    new THREE.MeshBasicMaterial({ map: leafT, side: THREE.DoubleSide }));
  leaf.rotation.y = SWING;
  place(leaf,
    hx + Math.cos(SWING) * leafW / 2, DOOR_H / 2,
    hz - Math.sin(SWING) * leafW / 2);

  SLABS.push({ id: spec.id, x0, x1, gy: () => 0 });

  return {
    cx, cz, W, D, H, wx, wz, group, colliders,
    put: (m, lx, y, lz) => place(m, lx, y, lz),
    solid: (lx, lz, w, d) => wall(lx - w / 2, lx + w / 2, lz - d / 2, lz + d / 2),
    inside: () => player.x() >= x0 && player.x() < x1,
  };
}

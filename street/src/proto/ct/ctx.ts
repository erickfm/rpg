import * as THREE from 'three';
import type { AABB } from '../fp';

// The construction-time context the world modules are handed.
//
// Several regions of the street append to the SAME lists while they build —
// billboards, wet ground surfaces, solid props — so those lists are created
// once by crosstown.ts and passed down, rather than each module returning its
// own and the entry point stitching them back together. Everything here is
// build-time only; per-frame state stays inside whichever module owns it.

/** A billboard sprite: turned to face the player every frame by the sim loop. */
export interface Board { m: THREE.Mesh }

/** A horizontal ground surface that darkens + cools as the rain comes in. */
export interface WetSurface { m: THREE.MeshBasicMaterial; base: THREE.Color }

/** An `[E]` interaction. Modules REGISTER these instead of the entry point
 *  enumerating them — see the note at the bottom of this file. */
export interface Spot {
  x: number; z: number; r: number;
  /** what the prompt says when you are in range */
  label: () => string;
  /** is this spot live right now (right floor, right side of a door…) */
  ok: () => boolean;
  act: () => void;
}

/**
 * A seat you can actually sit on.
 *
 * The user: *"for every seat in the game i want to be able to sit down"*. There
 * are seats all over this world — counter stools, booths, the bus bench, the
 * casino, the hotel lobby, room 301 — and they belong to six different owners.
 * So this is a REGISTRATION, exactly like `Spot`: a module describes its own
 * furniture and the entry point never learns what any of it is. Making your
 * chairs sittable does not require the desk, this file, or builder F.
 *
 * The minimum is four numbers:
 *
 *     ctx.seat({ x, z, yaw, h: 0.45 })
 *
 * `x, z` is the seat ITSELF — you are put there, and it is also the centre of
 * the `[E]` trigger, so it must be within `r` of somewhere you can stand.
 * A seat you cannot reach registers fine and can never be used; if the
 * furniture's own collider keeps you further away than `r`, give it an
 * `approach`.
 */
export interface Seat {
  /** the seat itself, in WORLD coordinates (interiors: use `room.wx/wz`) */
  x: number; z: number;
  /** which way you face once seated. Same convention as the rig:
   *  0 = −z, π/2 = +x, π = +z, −π/2 = −x. Point it at the table. */
  yaw: number;
  /** height of the seat pan above the floor: 0.45 a bench, 0.71 a stool */
  h: number;
  /** how close you must be to be offered it. Default 0.75 — big enough to
   *  reach past a 0.36 m player radius, small enough that a row of stools
   *  does not become one wide blur of overlapping triggers. */
  r?: number;
  /** where you STAND to be offered it, if that is not the seat itself — a
   *  booth bench sits behind its own table and cannot be stood next to. */
  approach?: { x: number; z: number };
  /** is this seat live right now (right room, right floor) */
  ok?: () => boolean;
  /** prompt override. Defaults to 'sit down'. */
  label?: string;
}

/** The few runtime facts a module needs in order to register an interaction
 *  at BUILD time — where the player is, and how to move them. */
export interface PlayerRef {
  x: () => number;
  z: () => number;
  gy: () => number;
  jumpTo: (x: number, z: number, yaw: number, gy: number) => void;
}

/** Everything a per-frame hook could need, assembled once by the sim loop. */
export interface Frame {
  dt: number;
  /** wall time, for anything that animates on its own clock */
  t: number;
  px: number; pz: number;
  /** the player's current ground height — which floor they are on */
  gy: number;
  /** absolute game hour, monotonic — what the weather hashes on */
  hourAbs: number;
  /** hour of day as a float, 0…24 — what the sky and lamps curve on */
  hourF: number;
  /** the night wash, 0…1 */
  night: number;
}
export type FrameHook = (f: Frame) => void;

/** Ordering for per-frame hooks. Registration order is NOT the run order —
 *  it must not be, or moving a module's build call would silently change
 *  behaviour. Hooks declare where they belong and are sorted once. */
export const ORDER = {
  /** world state that later passes read: weather, floors, occupancy */
  WORLD: 10,
  /** props reacting to that state */
  PROPS: 20,
  /** anything that must observe the finished frame */
  LATE: 30,
} as const;

export interface CtxBuild {
  scene: THREE.Scene;
  /** unlit material off a painted texture — the whole world is MeshBasic */
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  /** register a ground material for the rain's wet-look tint */
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  /** register a solid prop: blocks the player AND citizens steer around it */
  obstacle: (b: AABB) => AABB;
  boards: Board[];
  wetMats: WetSurface[];
  /** prop base height on the raised walks (== KERB_H) */
  sidewalkY: number;
  KERB_H: number;
  /** register an `[E]` interaction. The entry point iterates whatever has been
   *  registered; it does not know what any of them are. */
  spot: (s: Spot) => void;
  /** register a seat. Sitting, standing and the prompt are handled for you —
   *  see `Seat`. Register one per seat you actually want offered. */
  seat: (s: Seat) => void;
  /** register a per-frame hook. `order` decides when it runs — see ORDER.
   *  The billboard and citizen passes run after every registered hook. */
  onFrame: (fn: FrameHook, order?: number) => void;
  /** where the player is and how to move them, for use inside a Spot's
   *  ok()/act(). Safe to capture at build time — the accessors are live. */
  player: PlayerRef;
}

// ── why `spot` and `player` exist ─────────────────────────────────────────
// crosstown.ts is ~580 lines but was touched by 23 of the last 120 commits —
// four times more than files twice its size — because it is the WIRING. Every
// interactive object in the world had its [E] spot hand-written into one array
// there, so a builder adding a door to its own module still had to edit the
// entry point, which nobody owns and everybody collides in.
//
// Now a module registers its own interactions and the entry point just
// iterates. Adding a door touches exactly one file: the one that owns the door.


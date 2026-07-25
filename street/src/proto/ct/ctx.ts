import * as THREE from 'three';
import type { AABB } from '../fp';
import type { Purse } from './hud';

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

/**
 * A patch of ground a module is allowed to build on: the park's 30 m, the car
 * lot's 23.2 m, a building's frontage.
 *
 * `ct/street.ts` lays the block out and is the only thing that knows where
 * anything ends up. Everything else asks. The alternative — the desk reading a
 * z-span out of D's roster and relaying it to whoever needs it — has now
 * failed twice: the diner's `[E]` prompt ended up outside a bank because the
 * relay never happened, and the car lot sat finished and unplaced waiting on
 * the same number.
 */
export interface Site { minX: number; maxX: number; minZ: number; maxZ: number; y: number }

/**
 * When a module builds, relative to the others.
 *
 * Explicit, and never filesystem or glob order, because build order is
 * load-bearing: `ct/rng.ts` is ONE seeded stream and tree heights and pigeon
 * placement draw from it as they are constructed, so re-ordering the calls
 * moves every tree in the world (GOTCHAS §2). It is worse than that — three.js
 * spends four `Math.random()` calls per object on `generateUUID`, so under the
 * fingerprint harness merely CREATING something shifts the grain of every
 * texture painted after it.
 *
 * Pick the band that describes what you are: the number itself is only a sort
 * key, and ties break on filename.
 */
export const BUILD = {
  /** open ground the street cleared for you: the park, the car lot */
  SITE: 20,
  /** furniture and fittings that stand on the block */
  PROPS: 40,
  /** the interior belt. LAST, always — see ct/interior.ts */
  INTERIOR: 80,
} as const;

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
  /** the player's money and pockets. Here so that a spot which SELLS something
   *  can live with the counter it is sold over, instead of being stranded in
   *  the entry point — which is where the bodega's two were, and the only
   *  reason they were the last hand-written spots left in crosstown.ts. */
  purse: Purse;
  /** call after changing `purse` so the wallet readout catches up */
  refreshWallet: () => void;
  /** register a seat. Sitting, standing and the prompt are handled for you —
   *  see `Seat`. Register one per seat you actually want offered. */
  seat: (s: Seat) => void;
  /**
   * Ask for the ground you were given, by name — `ctx.site('park')`.
   *
   * Returns null if the block's layout has no such site, and a module that
   * gets null must build NOTHING and say so. That is the point: a module can
   * no longer be built against a slot that has quietly moved or stopped
   * existing, because it never held the number in the first place.
   */
  site: (name: string) => Site | null;
  /** publish a site. `ct/street.ts` owns the block's layout and is the only
   *  thing that should be calling this. */
  publishSite: (name: string, s: Site) => void;
  /**
   * Register a patch of GROUND you answer for: return the floor height at
   * (x, z), or null if the point is not yours.
   *
   * The third dispatch point to get this treatment, after `[E]` spots and
   * per-frame hooks, and for the same reason. Floor height is the one thing
   * that cannot come from colliders (GOTCHAS §7), so a module that builds a
   * step, a stair or a raised forecourt has to be ASKED — and until now the
   * entry point asked by name, which meant a module could finish a flight of
   * steps and have nobody call it. That happened: E built the library steps
   * and the picker for them together and had to leave the treads solid,
   * because the one line that consults them lived in a file E does not own.
   *
   * `order` decides who is asked first; the first non-null answer wins.
   */
  ground: (fn: (x: number, z: number) => number | null, order?: number) => void;
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


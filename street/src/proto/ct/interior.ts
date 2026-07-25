import * as THREE from 'three';
import type { AABB } from '../fp';
import { BUILD, ORDER as HOOK, type CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { frontageOf } from './tex-world';
import { doorWorldFor, roomWidthFor } from './doors';
import { citizenSprite, type Look } from './citizens';
import { FACE } from './rng';

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
 * Every collider every room has registered, in one list.
 *
 * The belt owns this so that adding a room does not mean adding a line to the
 * collider array in `crosstown.ts`. That array is in the most-contended file
 * in the project (GOTCHAS §11); ten rooms would have meant ten separate edits
 * to it, each one a merge conflict waiting for whichever builder landed
 * second. Now the entry point spreads this once and never changes again.
 */
const BELT_COLLIDERS: AABB[] = [];
export function interiorColliders(): AABB[] { return BELT_COLLIDERS; }

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
/** The id of every room that actually got built, in slab order. The wiring
 *  check reads this — see `scripts/interiors-wired.mjs`. */
export function interiorRoomIds(): string[] { return SLABS.map((s) => s.id); }

/**
 * Build every interior there is.
 *
 * Writing `ct/int-<name>.ts` is now SUFFICIENT to put a room in the world.
 * There is no line to add in `crosstown.ts` and therefore no line to forget.
 *
 * That mattered: the casino, the hotel and the tax office were each finished,
 * committed and unreachable, because the one-line `buildX(ctx)` construction
 * call lived in the desk-owned entry point. Builder G could not wire its own
 * rooms and nothing checked that anyone had. The auditor reported it three
 * rounds running. The kit had already removed the need to touch the entry
 * point for `[E]` spots, colliders and floors — construction was the last
 * desk-contended step, and this is it going away.
 *
 * Conventions, both enforced by `scripts/interiors-wired.mjs`:
 *   · one `export function build…(ctx)` per file
 *   · the file `int-<id>.ts` builds the room whose `spec.id` is `<id>`
 *
 * Sorted by path so slab addresses are a deterministic property of the file
 * names rather than of whatever order the bundler happened to hand them over
 * in — a room that moves slab between builds is a room whose saved position
 * means nothing.
 */
export const ORDER = BUILD.INTERIOR;

/** The world loader's entry point for the whole interior belt — see
 *  `ct/world.ts`. The belt keeps its OWN glob inside `buildAllInteriors`
 *  because interiors carry a second convention the other modules do not:
 *  `int-<id>.ts` must build the room whose `spec.id` is `<id>`, which
 *  `scripts/interiors-wired.mjs` enforces. */
export function register(ctx: CtxBuild): void { buildAllInteriors(ctx); }

export function buildAllInteriors(ctx: CtxBuild): void {
  const mods = import.meta.glob<Record<string, unknown>>('./int-*.ts', { eager: true });
  for (const path of Object.keys(mods).sort()) {
    const mod = mods[path];
    const entry = Object.entries(mod).find(
      ([k, v]) => k.startsWith('build') && typeof v === 'function');
    if (!entry) { console.warn(`[interior] ${path} exports no build…() — not built`); continue; }
    try {
      (entry[1] as (c: CtxBuild) => void)(ctx);
    } catch (e) {
      // One bad room must not take the whole world down with it. Loud, and
      // the bugsweep reports console errors, so it cannot pass unnoticed —
      // but the other nine rooms and the street still load.
      console.error(`[interior] ${path} threw while building:`, e);
    }
  }
}

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
  /** clear interior size in metres, wall face to wall face. `w` is optional
   *  when `frontage` is given — the kit sizes the room off the building. */
  w?: number;
  d: number;
  /** ceiling height. 2.9 is a shop; a casino or a library wants more */
  h?: number;
  /** floor, wall, ceiling, trim — hex ints, muted, 1997 */
  palette?: { floor?: number; wall?: number; ceil?: number; trim?: number };
  /** the way in, on the street: where you stand and press E */
  door: {
    /** Street coords of the [E] spot outside. Derived from the frontage when
     *  one is given — and it must be, because a hand-typed one cannot know its
     *  building moved. Three have: the diner's ended up outside a bank. */
    x?: number; z?: number; r?: number;
    /** where standing outside is legal — defaults to "anywhere on the street" */
    ok?: () => boolean;
    /** where you land when you step back OUT, and which way you face */
    outX?: number; outZ?: number; outYaw?: number; outGy?: number;
    /** door centre along the room's front (south) wall, in local x. 0 = middle */
    at?: number;
    /** clear door width. 1.1 is generous; the player capsule is 0.72 across */
    width?: number;
  };
  /**
   * The building this room is inside, so the kit can DERIVE the door, the
   * window and the street trigger instead of the room hand-typing them.
   *
   * The user: *"i need the facades to line up with the interior. so if the
   * door on the interior is full right then the facade must match."* They were
   * two authorings of one fact — `ct/tex-world.ts` painted a door wherever it
   * liked and each `int-*.ts` typed an offset beside it — so of course they
   * disagreed, and the auditor measured it twice. `frontageOf()` is now the
   * one authority; this reads it.
   *
   * Supplying this makes `door.at`, `door.width`, `door.x/z` and `window`
   * optional: give them anyway only to override, and expect to justify it.
   */
  frontage?: {
    /** the roster name, exactly — `frontageOf` dispatches character on it */
    name: string;
    /** the building's frontage width and centre z, from the roster */
    w: number; cz: number;
    /** -1 west (facade at x = -FACE), +1 east */
    side: -1 | 1;
  };
  /** shopfront glazing on the front wall, so the room is not a sealed box */
  window?: { at?: number; w: number; h?: number; sill?: number };
  /**
   * Tiled dado up the bottom of every wall, painted into the plaster rather
   * than modelled — a commercial room that is plaster to the floor reads as a
   * bedroom. Fast food and the tax office tile to the waist; a diner does not.
   */
  wainscot?: {
    /** dado height in metres (default 1.1 — waist height) */
    h?: number;
    /** tile size in metres. Default 0.32 — larger than real wall tile
     *  because at ~12 px/m anything under ~0.25 m draws a one-texel tile
     *  beside a one-texel joint, which reads as a dotted line, not tile. */
    tile?: number;
    /** the joint colour showing between tiles */
    grout?: number;
    /** the tile face itself */
    face?: number;
  };
  /**
   * The ceiling light. `kind` picks the fixture, `tint` its colour, `count`
   * how many (default: one per 3.5 m of depth).
   *
   * There IS a fixture, always. The user has already rejected the bare-glow
   * version of this once, on the walk-up: *"there is no fixture at all — it's
   * a bare glow decal on the ceiling, no shade, no bulb, so it reads as a
   * smudge rather than a light"*, and *"it's a smooth radial gradient in a
   * world that is entirely hard-edged nearest-filtered texels — the blur is
   * wildly off-style"*. This kit shipped that exact mistake, and would have
   * shipped it ten more times. The glow is stepped on the texel grid now and
   * it hangs under something you can see.
   */
  light?: {
    /**
     * `dome` — a shallow opal flush-mount. Domestic, warm, a diner.
     * `troffer` — a recessed fluorescent tray. A suspended commercial ceiling.
     * `strip` — a bare batten screwed to the soffit, tube showing. A unit that
     *   was cheaply converted and never finished; the thrift store, the back
     *   of a pawn shop.
     */
    kind?: 'dome' | 'troffer' | 'strip';
    tint?: number;
    count?: number;
    /**
     * Indices of fixtures that are OUT — no glow, and a dead grey tube.
     * A room where every light works is a room that has a facilities budget,
     * which is a thing some of these places conspicuously do not have.
     */
    dead?: number[];
  };
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
  /**
   * A sign readable from BOTH sides — two back-to-back single-sided planes,
   * not one `DoubleSide` plane.
   *
   * GOTCHAS §10: a DoubleSide plane viewed from behind is mirrored, because
   * three.js flips the normal and leaves the UVs alone. Symmetrical letters
   * hide it (a HOTEL blade sign shipped backwards; only the E and L gave it
   * away) and asymmetrical ones make it glaring. A shop is full of signs you
   * walk around — price cards on a rail, a notice in a window — so "which way
   * does this one face" is a question every room would otherwise have to get
   * right one sign at a time. This makes it not a question.
   *
   * Coincident planes do NOT z-fight here: each is FrontSide, so from any
   * given side exactly one of them is drawn and the other is culled.
   */
  sign: (map: THREE.Texture, w: number, h: number,
    lx: number, y: number, lz: number, rotY?: number) => void;
  /** a collider in LOCAL coordinates, centred on (lx,lz) */
  solid: (lx: number, lz: number, w: number, d: number) => AABB;
  /** every collider this room has registered — hand these to the rig */
  colliders: AABB[];
  /** Where the door is along the front wall, in LOCAL x — derived from the
   *  facade. Furnish around it: the door moves when the shopfront changes, and
   *  a fitting laid out against a remembered position ends up in front of it.
   *  The diner's booth bank did exactly that. */
  doorAt: number;
  /**
   * A PERSON, drawn from the 8-angle citizen atlas like everyone on the street.
   *
   * The user: *"the people inside these places are always flat and not like
   * the people on the street."* They were right and it was my fault — the
   * diner's waitress was one hand-painted front view on a plane, and because
   * she was the reference interior every room after her copied the mistake.
   * A street citizen turns through eight painted views; she turned through
   * one, so she was cardboard from every angle but dead ahead.
   *
   * This wraps H's `citizenSprite` and does the two things a room would
   * otherwise get wrong: it places the mesh in WORLD coordinates (a local
   * position gets the figure dimmed by the night sweep — see `group`), and it
   * registers the per-frame `update` the sprite needs to choose its sector.
   * Without that hook the sprite never turns and you are back where you
   * started, with better art.
   *
   * Stationary people hold the IDLE frame: `setWalking(false)` is the default,
   * which is row 0 of the atlas, not a walk cycle frozen mid-stride.
   */
  person: (look: Look, lx: number, lz: number, o?: {
    /** which way they face, atan2(vx, vz); 0 = +z. Point them at their work. */
    facing?: number;
    h?: number; w?: number;
  }) => void;
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

  // ── derive from the facade, if we were told which building this is ──────
  //
  // Everything below that the frontage can answer, it answers, and the room's
  // own value becomes an override rather than the source. Where the two used
  // to disagree they now cannot, because there is only one of them.
  const fr = spec.frontage;
  const F = fr ? frontageOf(fr.name, fr.w) : null;
  // ── the door's position, as ONE world number ──────────────────────────
  //
  // The user, standing in the tax office: the door is on the RIGHT of the
  // interior, so from outside it must be on the LEFT of the facade — and they
  // want that for every building. They are right, and it is not a preference:
  // a room and its facade are two faces of ONE WALL, so the handedness is
  // opposite by construction.
  //
  // Nothing in the code knew that, because each side authored its own offset
  // in its own local space and "left" meant something different in each. So
  // the position is carried as a WORLD coordinate on the axis the roster lays
  // buildings out on — z for a main-block shop — and each consumer converts
  // once, applying its own mirror. One number, three consumers: the painter
  // turns it into a texel column, the [E] spot uses it as it stands, and the
  // room turns it into a local x with the flip that being inside implies.
  //
  // ONE conversion, used by the door and the glazing alike so they cannot
  // drift apart. `alongFrontage` is metres from the facade's left edge as the
  // painter's canvas sees it (u = 0).
  //
  //   worldOf  — u = 0 is the HIGH-z edge of a west building, because a west
  //              facade is the +x face of its box and three.js runs u along
  //              -z there; an east facade is the -x face and runs the other
  //              way. That sign is the whole street conversion.
  //   localOf  — and then the MIRROR. Outside you face the building; inside
  //              you face the same wall from behind, so your right hand has
  //              swapped sides. Multiplying the world offset by `side` is what
  //              performs that swap: check it on the west side, where the
  //              observer's right is -z outside and -x inside.
  const worldOf = (alongFrontage: number) => fr
    ? (fr.side < 0 ? fr.cz + fr.w / 2 - alongFrontage : fr.cz - fr.w / 2 + alongFrontage)
    : 0;
  const localOf = (alongFrontage: number) => fr && F
    ? fr.side * (worldOf(alongFrontage) - fr.cz) * (W / F.frontageM)
    : 0;
  // THE ROOM'S DOOR, not the facade's. `ct/doors.ts` holds the declaration
  // this room made at module scope and the facade painter reads the same
  // entry, so the two cannot disagree — and when they move, the painted door
  // is what moves. See the note at the top of ct/doors.ts for why the room is
  // the authority and not the shopfront.
  const doorWorld = fr ? doorWorldFor(fr.name) : null;
  // The room is as wide as the building, less the wall thickness at each end.
  // Room width used to be a number each room picked: the burger barn had
  // 11.36 m of room behind 16 m of frontage — 71%, where the others were
  // 94–97% — and nothing said which was right. This makes it a rule.
  const W = spec.w ?? (F ? roomWidthFor(F.frontageM) : 8);
  const D = spec.d, H = spec.h ?? 2.9;
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
  const wain = spec.wainscot;
  const wainPx = wain ? Math.round((wain.h ?? 1.1) * PXM) : 0;
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
    // the tiled dado, over the top of all of that — tile is the wall down
    // here, not a decal on it, so it covers the grime rather than sharing it
    if (wain && wainPx > 2) {
      const y0 = wallPx - wainPx;
      const tilePx = Math.max(3, Math.round((wain.tile ?? 0.32) * PXM));
      const face = new THREE.Color(wain.face ?? 0xd8d0be);
      g.fillStyle = '#' + new THREE.Color(wain.grout ?? 0xa89e8c).getHexString();
      g.fillRect(0, y0, 32, wainPx);                         // the grout bed
      // Tiles laid ON the grout bed, one texel short each way, so the joint is
      // the bed showing through. One texel at ~12 px/m is an 8 cm joint —
      // coarse for grout, but it is the thinnest line this world can draw, and
      // a joint you cannot see is not a tiled wall.
      for (let ty = 0; y0 + ty * tilePx < wallPx; ty++) {
        for (let tx = 0; tx * tilePx < 32; tx++) {
          const x = tx * tilePx, y = y0 + ty * tilePx;
          g.fillStyle = '#' + face.clone()
            .multiplyScalar((tx + ty) % 2 ? 0.95 : 1.03).getHexString();
          g.fillRect(x, y, tilePx - 1, Math.min(tilePx - 1, wallPx - y));
        }
      }
      // the capping bullnose: the line that makes it read as tile stopping at
      // a height rather than as a differently-coloured wall
      g.fillStyle = '#' + new THREE.Color(TRIM).getHexString();
      g.fillRect(0, y0 - 1, 32, 2);
    }
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
  // Where the door sits along the room's front wall, and how wide it is —
  // from the facade when we know the building.
  //
  // `doorOffsetM` is signed metres from the frontage centre, the same
  // convention `at:` already used, so it drops straight in. It is SCALED by
  // room width over frontage width: the room is a little narrower than the
  // building (wall thickness), and the user's ask was that the door be in the
  // corresponding PLACE — "if the door on the interior is full right then the
  // facade must match" — which is a proportion, not an absolute offset.
  // World z → the room's local x, MIRRORED.
  //
  // Inside, you stand with the front wall behind you and the room in front, so
  // the wall you are looking back at is the same wall reversed. `doorWorld` is
  // metres along the street; `(doorWorld - cz)` is its signed offset from the
  // building centre on that axis; the leading minus is the mirror, and it is
  // the whole point of this line. Scaled by room width over frontage so a door
  // three-quarters along a shopfront is three-quarters along the room —
  // "if the door on the interior is full right then the facade must match".
  const dAt = spec.door.at ?? (F ? localOf(F.doorCentreM) : 0);
  const dW = spec.door.width ?? F?.doorWidthM ?? 1.1;
  const DOOR_H = 2.15;
  // The glazing, likewise: the painter's glazed span, scaled into the room and
  // then trimmed back off the door so the two openings cannot collide — which
  // the front-wall builder would otherwise drop on the floor with a warning.
  const glaze = F ? (() => {
    // through the same conversion as the door, mirror included, or the glass
    // ends up on the opposite side of the room from the window you were just
    // looking through
    const e0 = localOf(F.glazingStartM), e1 = localOf(F.glazingEndM);
    let a = Math.min(e0, e1), b = Math.max(e0, e1);
    const dl = dAt - dW / 2 - 0.12, dr = dAt + dW / 2 + 0.12;
    // keep whichever side of the door is the bigger run of glass
    if (a < dl && b > dr) { if (dl - a >= b - dr) b = dl; else a = dr; }
    else if (b > dl && b <= dr) b = dl;
    else if (a >= dl && a < dr) a = dr;
    return b - a > 0.8 ? { at: (a + b) / 2, w: b - a } : null;
  })() : null;
  const win = spec.window ?? (glaze ? { at: glaze.at, w: glaze.w, h: 1.5, sill: 0.95 } : undefined);
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
    // Mullions, and a transom bar across the top.
    //
    // Shopfront glazing is never one pane — it is panes in a frame, because
    // nobody in 1997 is hanging six metres of unsupported glass. Without them
    // a wide window is a single flat slab of colour taking up a third of the
    // room, which is what the burger barn's 6.2 m one looked like. One bar
    // every ~2 m, which is about the widest pane you would actually see.
    const bays = Math.max(1, Math.round(wW / 2.0));
    for (let i = 1; i < bays; i++) {
      const mx = wAt - wW / 2 + (wW * i) / bays;
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.07, wH, T + 0.04), trimM);
      place(mull, mx, wSill + wH / 2, hd + T / 2);
    }
    const transom = new THREE.Mesh(new THREE.BoxGeometry(wW, 0.07, T + 0.04), trimM);
    place(transom, wAt, wSill + wH * 0.72, hd + T / 2);
  }

  // wall colliders — the openings are NOT gaps you can walk out of, except
  // the doorway, which is left clear so the [E] spot inside is reachable
  // (GOTCHAS §8: a collider that swallows a trigger is the classic way to
  // make a door un-enterable, and it has already happened once here)
  const wall = (mnx: number, mxx: number, mnz: number, mxz: number) => {
    const b: AABB = { minX: cx + mnx, maxX: cx + mxx, minZ: cz + mnz, maxZ: cz + mxz };
    colliders.push(b);
    BELT_COLLIDERS.push(b);
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
  //
  // There is a FIXTURE, and the glow is STEPPED. Both are corrections to a
  // complaint already on file against the walk-up's ceiling lamps: *"there is
  // no fixture at all — it's a bare glow decal on the ceiling, no shade, no
  // bulb, so it reads as a smudge rather than a light"*, and *"it's a smooth
  // radial gradient in a world that is entirely hard-edged nearest-filtered
  // texels — the blur is wildly off-style"*. The first version of this kit
  // reproduced that mistake exactly, and ten rooms were about to inherit it.
  const lit = spec.light ?? {};
  const kind = lit.kind ?? 'dome';
  const tint = new THREE.Color(lit.tint ?? (kind === 'dome' ? 0xffebbe : 0xe8f0f4));
  const rgb = `${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)}`;
  // A halo quantised onto the texel grid: four hard steps, no interpolation.
  // Same job as a gradient, drawn the way everything else in this world is.
  const haloT = pixTex(16, 16, (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8;
      const step = Math.max(0, Math.ceil((1 - d) * 4) / 4);   // 0, .25, .5, .75, 1
      if (step <= 0) continue;
      // Weak on purpose. Additive white on an already-pale ceiling stops
      // reading as spill and starts reading as a splat of paint very quickly —
      // the first pass at 0.5 put a blocky cloud around every fixture. The
      // room is lit by its flat materials; this is only the bloom at the edge.
      g.fillStyle = `rgba(${rgb},${(step * 0.16).toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
  });
  haloT.minFilter = haloT.magFilter = THREE.NearestFilter;
  const haloM = new THREE.MeshBasicMaterial({
    map: haloT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const diffuserM = new THREE.MeshBasicMaterial({ color: tint });
  // The housing is painted metal, NOT the room's trim. Trim is right for
  // mullions and skirting — they are joinery — but a light fitting is a
  // bought object, and taking TRIM here gave the burger barn bright red
  // ceiling troffers, which no building has ever had.
  const roseM = new THREE.MeshBasicMaterial({ color: 0xc4c0b8 });
  // a tube that has gone: grey-green, slightly darker than the ceiling, with
  // the blackened ends a dead fluorescent always has
  const deadM = new THREE.MeshBasicMaterial({ color: 0x9a9a92 });
  const out = new Set(lit.dead ?? []);

  const lamps = Math.max(1, lit.count ?? Math.round(D / 3.5));
  for (let i = 0; i < lamps; i++) {
    const lz = -hd + D * ((i + 0.5) / lamps);
    const off = out.has(i);
    const lampM = off ? deadM : diffuserM;
    if (kind === 'strip') {
      // Batten: a channel screwed flat to the soffit with the tube exposed
      // under it. No diffuser, no tray, nowhere for the dust to hide — which
      // is exactly why it reads as the cheap option.
      const chan = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.12), roseM);
      place(chan, 0, H - 0.04, lz);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 8), lampM);
      tube.rotation.z = Math.PI / 2;
      place(tube, 0, H - 0.12, lz);
      for (const ex of [-0.76, 0.76]) {          // the blackened end caps
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 8),
          off ? new THREE.MeshBasicMaterial({ color: 0x54544e }) : roseM);
        cap.rotation.z = Math.PI / 2;
        place(cap, ex, H - 0.12, lz);
      }
      if (!off) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), haloM);
        gl.rotation.x = Math.PI / 2;
        place(gl, 0, H - 0.19, lz);
      }
    } else if (kind === 'troffer') {
      // a recessed fluorescent tray: the 1997 commercial ceiling, and the
      // reason a fast-food room feels harder than a diner
      const tray = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.42), roseM);
      place(tray, 0, H - 0.05, lz);
      const dif = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), lampM);
      dif.rotation.x = Math.PI / 2;
      place(dif, 0, H - 0.105, lz);
      if (!off) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), haloM);
        gl.rotation.x = Math.PI / 2;
        place(gl, 0, H - 0.12, lz);
      }
    } else {
      // a shallow opal flush-mount on a ceiling rose
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), roseM);
      place(rose, 0, H - 0.03, lz);
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.13, 10), lampM);
      place(dome, 0, H - 0.12, lz);
      if (!off) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), haloM);
        gl.rotation.x = Math.PI / 2;
        place(gl, 0, H - 0.2, lz);
      }
    }
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
  // ── the [E] spot on the street ──
  //
  // Derived from the SAME published door centre the painter draws with, so the
  // prompt cannot drift off its door — and cannot be left behind when its
  // building moves, which has now happened three times.
  //
  // The facade plane is at x = ±FACE and the wall collider reaches 0.3 m past
  // it, so the spot stands 0.75 m off the plane rather than the 0.45 m the
  // rooms were typing. The auditor measured every kit door spot sitting 0.21 m
  // INSIDE collision, prompting only because the trigger radius is five times
  // the intrusion. This puts it on ground you can actually stand on.
  //
  // Along the street: a west facade is the +x face of its box, where three.js
  // runs u along -z, so u = 0 is the HIGH-z edge. An east facade is the -x
  // face and runs the other way. That sign is the whole conversion.
  const spotOnStreet = doorWorld !== null && fr
    ? { x: fr.side * (FACE - 0.75), z: doorWorld }
    : { x: spec.door.x ?? 0, z: spec.door.z ?? 0 };
  // and stepping out: 1.5 m along the walk, which clears the trigger by more
  // than the 0.35 m margin the kit warns below
  const outAt = spec.door.outX !== undefined && spec.door.outZ !== undefined
    ? { x: spec.door.outX, z: spec.door.outZ, yaw: spec.door.outYaw ?? 0, gy: spec.door.outGy ?? 0 }
    : { x: (fr ? fr.side : -1) * (FACE - 1.2), z: spotOnStreet.z + 1.5,
      yaw: (fr ? fr.side : -1) < 0 ? Math.PI / 2 : -Math.PI / 2, gy: ctx.KERB_H };
  // where the way-out trigger sits, and — separately — where you actually land
  // when you come in. They are not the same point: landing ON the threshold
  // puts you inside the swing of the door leaf and a step from walking back
  // out by accident. Land a stride clear of it, still close enough that the
  // way-out prompt is already up, so you always know how to leave.
  const spotX = wx(dAt), spotZ = wz(hd - 0.55);
  const arriveZ = wz(hd - 1.15);
  ctx.spot({
    x: spotOnStreet.x, z: spotOnStreet.z, r: doorR,
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
    act: () => player.jumpTo(outAt.x, outAt.z, outAt.yaw, outAt.gy),
  });
  // Stepping out must not put you back inside the trigger you just used. Get
  // this wrong and the street prompt reads "into the DINER" the instant you
  // leave, and one more E — the key you are already pressing — puts you
  // straight back. That has shipped once. Checked rather than trusted,
  // because it is invisible until someone walks it.
  const outGap = Math.hypot(outAt.x - spotOnStreet.x, outAt.z - spotOnStreet.z);
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
    cx, cz, W, D, H, wx, wz, group, colliders, doorAt: dAt,
    put: (m, lx, y, lz) => place(m, lx, y, lz),
    person: (look, lx, lz, o = {}) => {
      const s = citizenSprite(look, { facing: o.facing ?? 0, h: o.h, w: o.w });
      place(s.mesh, lx, 0, lz);
      // the sprite picks its painted view from where YOU are, so it needs the
      // frame. LATE, after the world has moved: it is reacting to the finished
      // position, the same as the billboard pass.
      ctx.onFrame((f) => s.update(f.px, f.pz, f.dt), HOOK.LATE);
    },
    sign: (map, w, h, lx, y, lz, rotY = 0) => {
      for (const flip of [0, Math.PI]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map, side: THREE.FrontSide }));
        m.rotation.y = rotY + flip;
        place(m, lx, y, lz);
      }
    },
    solid: (lx, lz, w, d) => wall(lx - w / 2, lx + w / 2, lz - d / 2, lz + d / 2),
    inside: () => player.x() >= x0 && player.x() < x1,
  };
}

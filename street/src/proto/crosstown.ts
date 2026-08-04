import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, RADIUS, SIT_EYE, PITCH_LIMIT, type AABB, type SeatPose } from './fp';
import { ColliderDebug } from './ct/debug-collision';

// ═══════════════════════════════════════════════════════════════════════════
// CROSSTOWN '97 — the small world. One hand-authored street.
//
// Scoped down on purpose: no streaming, no procedural grid. This is the
// original narrow street, finished properly — closed at both ends by cross
// buildings half-swallowed in fog, upgraded with the 8-angle citizens and
// the painted car fleet from the milestone. We grow it from here, together,
// block by deliberate block.
// ═══════════════════════════════════════════════════════════════════════════
import { ROAD_HALF, WALK, FACE, PARK_X, FOG_NEAR, FOG_FAR, rnd } from './ct/rng';
import { pixTex } from './ct/paint';
import { asphaltTex } from './ct/tex-world';
import { buildGround, JUNCTION_CROSSINGS } from './ct/tex-ground';
import { type CarKind, makeCar, PICKUP_BED, CAR_HALF_W, carHalfLen, carColliderBoxes, carColliderSpec,
  tyreGeo, fleetWheelMats } from './ct/cars';
import { buildTraffic } from './ct/traffic';
import { buildSideStreet } from './ct/sidestreet';
import { nudgeClear, corridor, ENTERABLE, PASSABLE } from './ct/gap';
import { buildStreet } from './ct/street';
import { buildWorld, worldRegistrants } from './ct/world';
import { COURT } from './ct/civic';
import { buildCrowd, type Crowd } from './ct/crowd';
import { pickSpot, SpotOutline, REACH_MARGIN, TOUCH_MARGIN, REACH_TRIM, ON_IT, lookTolerance } from './fp';
import { ORDER, BUILD, type Site, type Board, type CtxBuild, type WetSurface, type Spot, type PlayerRef, type Frame, type FrameHook } from './ct/ctx';
import { buildApartment, SPAWN } from './ct/apartment';
import { makeHud, setScreenFocus, panelUp, type Purse } from './ct/hud';
import { buildProps } from './ct/props';
import { interiorGround, interiorMaxX, interiorMaxZ, interiorColliders, interiorRoomIds, interiorRooms, PARTY } from './ct/interior';
import { publishDeclaredDoors, declaredDoors, doorPointFor, doorStandFor } from './ct/doors';

// ═══════════════════════════════ the world ════════════════════════════════

export function makeCrosstown(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(88, 1, 0.1, 220);

  // ── scroll to zoom, clamped tight ─────────────────────────────────────────
  //
  // *"i want scroll to be zoom. it shouldnt be able to zoom too much though."*
  // Nothing handled the wheel before this. 88° above is the deliberate wide
  // 1997 look and stays the RESTING value — scroll only ever pulls IN from it
  // and springs back out to it, never wider. The range is deliberately
  // modest (24°): "shouldn't be able to zoom too much" is the whole spec, so
  // this errs tight rather than guessing wide and walking it back.
  //
  // WALKED BACK, as that comment invited: *"make zoom a little stronger"*
  // (2026-08-02). FOV_MIN 64 -> 52, so the range goes 24° -> 36°. Still a
  // one-way pull from the 88° resting look and still springs back to it — the
  // original spec ("shouldn't be able to zoom too much") is a ceiling on the
  // range, not on this particular number, and 52° is a normal lens rather than
  // a telephoto. FOV_STEP stays 3, so the extra range costs four more notches
  // rather than making each notch coarser.
  //
  // AND THAT WAS THE WRONG CALL, one message later: *"scroll wheel needs to be
  // more effective? i need to scroll way too much to get zoom moving. i want it
  // to be much more sensitive"*. Widening the range at a fixed step took a full
  // pull from 8 notches to 12 — answering a complaint about REACH by making the
  // EFFORT worse. STEP 3 -> 7: the whole 36° is now about five notches and one
  // notch is a visible move rather than a nudge.
  //
  // THE TWO NUMBERS ARE COUPLED. Range and step have to be chosen together;
  // changing one alone is exactly what produced the second complaint.
  const FOV_REST = 88, FOV_MIN = 52, FOV_STEP = 7;
  let fovTarget = FOV_REST;
  /**
   * HOW FAR DOWN YOU MUST LOOK BEFORE THE WATCH COMES UP, MEASURED BACK FROM
   * THE CLAMP. Gate fires at `PITCH_LIMIT - WATCH_TOLERANCE` below level, so a
   * BIGGER tolerance triggers EARLIER (shallower look-down).
   *
   * **CURRENT: 9° tolerance = the watch rises at 65.5° below level.**
   * *"make the look down angle to trigger watch coming up a bit less directly
   * down. increase that angle a bit"* (2026-08-04). This SUPERSEDES the earlier
   * reading of 2.9° (= 71.58°), which was a literal take on his *"couple deg of
   * tolerance"* and turned out to be tighter than he wanted in the hand.
   *
   * **THE FLOOR HE ALREADY REJECTED — DO NOT WANDER BACK ONTO IT.** This gate
   * was once `-0.95` rad = **54.4°** below level (a ~20.1° tolerance) and he
   * threw it out twice: *"i want you to need to look straight down, it is
   * confused. im asking for that. it isnt that way"* (2026-08-03). A wrist you
   * can read while still half looking at the street is not the gesture he
   * asked for. So the usable window is roughly **54.4°–71.58°**, and
   * `WATCH_TOLERANCE` must never approach ~20°. 9° is a deliberate modest step
   * with room to iterate in either direction.
   *
   * MEASURED (`scripts/probes/w110-watch-gate.mjs`, 5 runs, ArrowDown held from
   * level): the clamp lands at **74.48° on 5 of 5 runs**, spread 0.00°, so the
   * derivation below is exact. The wrapper is `position:fixed`, so the digits
   * are **100% on screen the instant the gate fires** at any gate angle —
   * readable-at and appears-at are the same angle, and always were. Moving this
   * number moves *when*, never *how readable*.
   *
   * `WATCH_TOLERANCE` is the ONLY typed number here; the gate is the CLAMP
   * minus it. `PITCH_LIMIT` is imported from `fp.ts`, which owns it and applies
   * it on both the mouse and the arrow-key paths — retyping 1.3 here is exactly
   * the defect that made `WATCH_DROP` next door lie about its own derivation,
   * and it would rot silently the day the clamp moved.
   *
   * WHY IT STAYS EASY TO HIT: the band is backed against a hard stop. You push
   * the mouse down until it stops moving and you are inside it — there is no
   * aiming to do, which is what keeps "look down" a gesture rather than a
   * balancing act. At fp.ts's 0.0022 rad/px, 9° is 71 px of mouse travel and
   * the clamp absorbs every pixel past it.
   */
  const WATCH_TOLERANCE = THREE.MathUtils.degToRad(9);
  const WATCH_PITCH = -(PITCH_LIMIT - WATCH_TOLERANCE);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // scroll UP (deltaY < 0) zooms IN — the Google-Maps/Photoshop convention,
    // and the opposite sign from `ct/hud.ts`'s own "+1 forward" wheel, which
    // answers a different question (which menu item) and has no bearing here.
    fovTarget = THREE.MathUtils.clamp(fovTarget + Math.sign(e.deltaY) * FOV_STEP, FOV_MIN, FOV_REST);
  };
  // BUBBLE phase, deliberately not capture, and the reason this needs no
  // import from `ct/hud.ts` at all: whenever a panel (ATM, slots, blackjack,
  // pockets) is open, `ct/hud.ts`'s own gate installs a CAPTURE-phase 'wheel'
  // listener on `window` and calls `stopImmediatePropagation()` on every one.
  // Capture always runs before bubble on the same target, so that swallows
  // the event before it ever reaches this bubble-phase listener — "scrolling
  // must NOT zoom the world while the ATM, slots or blackjack are up" holds
  // for free, without this file knowing panels exist. Verified by scrolling
  // with the ATM open: fov unchanged, and by scrolling on the sidewalk and
  // indoors: fov moves in `shots/`-verified screenshots. See the w3 handoff.
  window.addEventListener('wheel', onWheel, { passive: false });

  scene.background = new THREE.Color(0x8a97a2);
  scene.fog = new THREE.Fog(0x8a97a2, FOG_NEAR, FOG_FAR);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1), new THREE.HemisphereLight(0xd8dce0, 0x6a6258, 0.5));

  const flat = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m });

  // ground: the main street, and a side street it turns into at the south
  // end (the corner). Same road width, same kerbs, fog owns the far end.
  const SIDE_Z0 = -98, SIDE_Z1 = -108;  // side-street road band
  const SIDE_X1 = 55;                   // side street runs east to here
  // wet-look plumbing: horizontal ground surfaces darken + cool as the rain
  // comes in (everything is unlit, so ct/props tints the map materials). The
  // registry lives here because the roads below are the first thing to join it.
  const wetMats: WetSurface[] = [];
  const wet = (m: THREE.MeshBasicMaterial) => { wetMats.push({ m, base: m.color.clone() }); return m; };
  // the two road planes ABUT at z = -98 — never overlap, never z-fight
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 36 - SIDE_Z0), wet(flat(asphaltTex())));
  road.rotation.x = -Math.PI / 2; road.position.z = (36 + SIDE_Z0) / 2;
  scene.add(road);
  const sideRoad = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_X1 + 7, 10), wet(flat(asphaltTex(SIDE_X1 + 7, 10))));
  sideRoad.rotation.x = -Math.PI / 2;
  sideRoad.position.set((SIDE_X1 - 7) / 2, 0, (SIDE_Z0 + SIDE_Z1) / 2);
  scene.add(sideRoad);
  // the sidewalks, the kerb, the gutter pan and the two corner returns —
  // one module owns every surface you walk on (see ct/tex-ground.ts). It
  // hands back the ground height for the patches it owns, because the corner
  // is a radius now and one of the returns ramps down to the crossing.
  const KERB_H = 0.14;
  const ground = buildGround({ scene, flat, wet, KERB_H, SIDE_Z0, SIDE_Z1, SIDE_X1, asphalt: asphaltTex });
  const sidewalkY = KERB_H; // prop base height on the walks
  const lineT = pixTex(8, 32, (g) => { g.fillStyle = '#b8a24e'; g.fillRect(2, 0, 4, 18); });
  lineT.wrapS = lineT.wrapT = THREE.RepeatWrapping;

  // ── the centre line stops short of a crossing ──────────────────────────
  //
  // *"remove the yellow stripes where the cross walk is. it doesnt look
  // right."* Real centre lines stop at a crossing; one plane spanning the
  // whole street's length cannot know a crossing exists, so it painted
  // straight through both of them (`ct/tex-ground.ts`'s two junction
  // crossings). Fixed by building the line as SEGMENTS either side of each
  // crossing's gap instead of one span.
  //
  // THE GAPS ARE READ FROM `JUNCTION_CROSSINGS` (`ct/tex-ground.ts`), NOT
  // RETYPED. They used to be a hand-copied literal citing `tex-ground.ts`'s
  // then-local consts (`705b78b74`) because that item was read-only on the
  // file; w4 hoisted the module-level export in the follow-up (item 9b), and
  // this item points the read at it and deletes the copy — same numbers, one
  // source, so the two can no longer drift apart (BUILDER-BRIEF §8).
  const { z: XA_Z, hw: XA_HW } = JUNCTION_CROSSINGS.main;   // main-street junction crossing
  const { x: XB_X, hw: XB_HW } = JUNCTION_CROSSINGS.side;   // side-street junction crossing

  // DASH PITCH IS DERIVED, NOT RETYPED, from the length/repeat this file had
  // already tuned for the ONE unsegmented plane each line used to be —
  // splitting a line into shorter segments must not squeeze or stretch how
  // dense its dashes read. (GOTCHAS 27: a rebuilt prop silently reversing its
  // own tuning is exactly the class of bug a hand-typed second number causes.)
  const LINE_LEN = 36 - SIDE_Z0, LINE_PITCH = LINE_LEN / 38;      // main street's old repeat
  const LINE2_LEN = 48, LINE2_PITCH = LINE2_LEN / 22;             // side street's old repeat
  const dashedTex = (len: number, pitch: number) => {
    const t = lineT.clone();
    t.repeat.set(1, len / pitch);
    t.needsUpdate = true;
    return t;
  };
  /** a dashed segment running along Z (the main street), from z0 to z1 */
  const zLineSeg = (z0: number, z1: number, y: number, pitch: number) => {
    const len = z1 - z0;
    if (len <= 0) return;                 // a crossing wider than the gap it cuts — nothing to draw
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, len),
      new THREE.MeshBasicMaterial({ map: dashedTex(len, pitch), alphaTest: 0.5 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, (z0 + z1) / 2);
    scene.add(m);
  };
  /** a dashed segment running along X (the side street), from x0 to x1 at fixed z */
  const xLineSeg = (x0: number, x1: number, z: number, y: number, pitch: number) => {
    const len = x1 - x0;
    if (len <= 0) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, len),
      new THREE.MeshBasicMaterial({ map: dashedTex(len, pitch), alphaTest: 0.5 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, z);
    scene.add(m);
  };

  // MAIN STREET: was one plane z SIDE_Z0..36; now two, either side of the
  // crossing's z = XA_Z ± XA_HW.
  zLineSeg(SIDE_Z0, XA_Z - XA_HW, 0.03, LINE_PITCH);
  zLineSeg(XA_Z + XA_HW, 36, 0.03, LINE_PITCH);

  // SIDE STREET: was one plane x 6..54 (centred x=30, half-length 24); now
  // two, either side of the crossing's x = XB_X ± XB_HW. Same fault C's own
  // comment on `crossingStripes` already flagged: "check the side street's
  // line (line2) for the same fault."
  const SIDE_LINE_X0 = 30 - LINE2_LEN / 2, SIDE_LINE_X1 = 30 + LINE2_LEN / 2;
  const SIDE_LINE_Z = (SIDE_Z0 + SIDE_Z1) / 2;
  xLineSeg(SIDE_LINE_X0, XB_X - XB_HW, SIDE_LINE_Z, 0.032, LINE2_PITCH);
  xLineSeg(XB_X + XB_HW, SIDE_LINE_X1, SIDE_LINE_Z, 0.032, LINE2_PITCH);

  // buildings — every one a specific place, laid by hand end to end.
  // West carries the walk-up (No. 227, res facade, entrance at z=-31) and
  // the alley; nothing on the street is filler.
  const AZ0 = -37, AZ1 = -43.5; // the alley gap in the left wall
  const boards: Board[] = [];
  // The library and churchyard steps are CLIMBABLE, and this is the line that
  // says so. ct/civic.ts leaves the flight SOLID until the entry point asks
  // `courtGround` for the floor — E's call, and the right one: open treads
  // with nothing answering for their height is walking through stone at
  // pavement level, which is worse than what it replaces.
  //
  // It must be set BEFORE buildStreet, which is what places the library and
  // reads this as it draws. Setting it after gets you a picker that reports a
  // 0.99 m landing and a flight you still cannot climb.
  COURT.climbable = true;
  // Every room states where its door is before a single facade is painted —
  // the rooms are built last, so they cannot speak for themselves in time.
  // See ct/doors.ts.
  publishDeclaredDoors();
  // ── pockets, HUD and the [E] register, hoisted ABOVE the builders ──────
  //
  // They used to sit just above `ctx`. ct/street.ts now registers the ATM's own
  // [E] during its build, so the register has to exist before any builder runs.
  // Moved, not changed — same declarations, same values, three lines earlier.
  // (D, for the ATM interaction; flagged, as with the purse field itself.)
  const SPOTS: Spot[] = [];
  /** pose -> what the prompt says while you are on it. See `seat` below. */
  const SEAT_EXIT = new Map<SeatPose, string>();
  const spotOutline = new SpotOutline();
  // THE SELECTION OUTLINE IS DEBUG-ONLY AND OFF BY DEFAULT.
  // *"yea get rid of outline unless debug is true, we'll probably want that for
  // debug."* In normal play the prompt alone says what you have, which is how it
  // worked before this item and is not a regression. Turn it on from a console
  // or a probe with `__ct.debugSpots(true)` — chosen because every test
  // affordance in this file is already a function on `__ct` (`clock`, `hermit`,
  // `bus`, `drive`), so it needs no new mechanism and no new place to look.
  let debugSpots = false;
  // COLLISION DEBUG VIEW. Press V to toggle — see ct/debug-collision.ts, and
  // notes/debug-collision.md for why V (every letter WASD/shift/C/space/E
  // and i/g/x/z/[/] was already spoken for). Off by default, same rule as
  // debugSpots just above: a player feature this never was, a diagnosis tool
  // this always should have been.
  let debugCollision = false;
  let debugCollisionKeyHeld = false;
  // F: the frame-rate readout, same rule as V above — off by default, toggled,
  // a diagnosis tool rather than a player feature. `fpsWorst` tracks the LONGEST
  // frame in the window, because the user's report is about drops and a mean
  // hides those.
  let showFps = false, fpsKeyHeld = false;
  let fpsCount = 0, fpsAccum = 0, fpsWorst = 0, fpsText = '';
  const colliderDebug = new ColliderDebug();
  // HYSTERESIS ON TRANSITIONS. A spot you have just USED is latched off until
  // you have physically left its volume, and only then re-arms.
  //
  // F found the regression this closes, world-wide, from bce720de7 — every
  // interior failing "you are NOT standing in the re-entry trigger after
  // stepping out" and "a second E on the landing does not suck you straight back
  // in". Widening the volumes (REACH_MARGIN 0.6) is what did it: stepping out of
  // a door now leaves you inside the entry trigger, so the door will not let go
  // of you. The user has already reported the feeling once — *"im literally
  // stuck here"* — and this is a new way to produce it from a change meant to
  // make things easier.
  //
  // The fix is NOT to narrow the volumes back; the easier-selection half is what
  // he asked for first. It is the same shape as the floor picker's hysteresis
  // (GOTCHAS §7) and as the citizen view-selector's margin, which H proved
  // load-bearing by setting it to 0 and watching flicker return on 5 of 6
  // walkers within 47 ms. A transition you have just made stays latched until
  // you clear it.
  //
  // LATCHED BY LANDING POSITION, NOT BY SPOT — and that correction is the whole
  // fix. My first version held off the spot that was USED, which does nothing
  // for the reported fault: stepping OUT uses the exit spot, so the ENTRY spot
  // is a different object entirely and fires the instant you arrive. Measured
  // it failing exactly that way on BURGER BARN, SEVENS and ST BRIGID —
  // "[E] into BURGER BARN" showing the moment you stepped onto the pavement,
  // and a second E throwing you 522 m back inside.
  //
  // So what is held off is EVERYWHERE YOU JUST LANDED: after any transition,
  // nothing is offered until you have taken a step away from the spot you
  // arrived on. One rule, no per-spot bookkeeping, and it cannot be defeated by
  // two spots sharing a doorway.
  let landing: { x: number; z: number } | null = null;
  // THE TWO HALVES OF THE LATCH, NAMED — because the bug in them was a
  // RELATIONSHIP, not a value, and a relationship you cannot see is one nobody
  // checks. `LATCH_ARM` is "that act moved me, so it was a transition";
  // `LATCH_CLEAR` is "I have walked far enough away to re-arm". Both were typed
  // literals — 1.0 here, and 1.2 in TWO places (the per-frame clear below and
  // `__ct.landing()`'s `clearIn`) — so the only statement of how they relate
  // lived in prose. Three copies of a number that must agree is BUILDER-BRIEF
  // §8's habit, and `__ct.landing().clearIn` is the reading a harness trusts.
  //
  // ARM < CLEAR ON PURPOSE. The gap is the hysteresis: arming at the same
  // distance it clears at would let a spot re-fire the instant you drifted back
  // over the line, which is the yo-yo this whole mechanism exists to stop.
  const LATCH_ARM = 1.0;
  const LATCH_CLEAR = 1.2;
  // ── LINE-OF-SIGHT CACHE ───────────────────────────────────────────────────
  // *"i get awful performance drops in my room not sure why."* Flat 301.
  //
  // MEASURED, scripts/probes/w52-raycast-count.mjs: standing perfectly still in
  // 301 the world ran **7,832 `Mesh.raycast` tests every frame** — that is every
  // mesh in the scene, once per frame — and 15,664 on the landing outside his
  // door, where two spots are in range. On the street it ran **zero**. That is
  // the user's report exactly: the cost appears where he lives and nowhere else.
  //
  // The cause is `canSee` below, the `[E]` line-of-sight test. It is cast once
  // per candidate spot per frame against `intersectObject(scene, true)`, which
  // walks the WHOLE world; the ray is at most ~6 m long inside one small room,
  // so essentially all of that work is spent proving that the far end of the
  // street is not between him and his bed.
  //
  // THE FIX IS TO CAST LESS OFTEN, NOT TO CAST DIFFERENTLY. `canSee` reads only
  // the eye position and the spot — **it does not depend on yaw or pitch at
  // all** — so turning on the spot, which is the single most common thing a
  // player does, cannot change any answer it gives. Standing still, neither can
  // anything else except an occluder that moves. So the answers are memoised
  // against the position they were computed at and re-taken when the player
  // moves `SEE_MOVE`, changes storey, or the entry goes `SEE_TTL` stale.
  //
  // The staleness this admits is bounded at SEE_TTL on a PROMPT LABEL, and the
  // only thing that can be stale is a citizen or a car crossing the line while
  // he stands still — the geometry cannot move under him. Nothing about which
  // spot wins changes: `pickSpot` gets the same answers, just fewer times.
  // Deliberately NOT keyed on yaw, and that is the whole saving.
  const seeCache = new Map<Spot, boolean>();
  let seeAtX = NaN, seeAtZ = NaN, seeAtGy = NaN, seeAtT = -Infinity;
  /** How far he may walk before every sight line is re-taken. A quarter of the
   *  0.6 m REACH_MARGIN — under the slack the resolver already tolerates, so a
   *  spot cannot change tier on the strength of a stale sight line. */
  const SEE_MOVE = 0.15;
  /** …and how long an answer may stand while he does not move at all. Only a
   *  moving occluder can invalidate one, so this is the reaction time of the
   *  prompt to somebody walking in front of it. */
  const SEE_TTL = 0.10;
  const purse: Purse = { cash: 14.5, inv: { CEREAL: 3 } }; // some cash, a box of cereal
  const hud = makeHud(purse);
  // Modules that answer for a patch of floor. Asked in declared order, first
  // non-null wins — see ctx.ground. The entry point no longer names any of
  // them, which is what lets a builder ship a staircase that works.
  //
  // Hoisted for the same reason SPOTS was, and by the same hand: ct/street.ts
  // registers the dished alley paving during its build, so the register has to
  // exist before any builder runs. Moved, not changed. (D; flagged.)
  const GROUNDS: { fn: (x: number, z: number) => number | null; order: number }[] = [];

  // solid props the citizens must steer AROUND (never walk/phase through) —
  // trees, lamp poles, the hydrant, the payphone, and the cars. Declared up
  // here because every module that builds appends to the same two lists.
  //
  // HOISTED ABOVE `buildStreet` (item 198). It used to be declared just below
  // the call, which is exactly why `ct/street.ts` could not use it: the street
  // is the FIRST thing built, so `obstacle` was in its temporal dead zone and
  // the only registration hook the street could be handed was one that pushed
  // to a local list. That accident is the whole of the bug — `ct/park.ts:91`
  // and `ct/street.ts:242` were the same function under the same name, and only
  // the one built after this line called `obstacle`. Three plain `const`
  // declarations moved up; nothing else about them changed, and nothing between
  // the old and new positions reads them.
  const propColliders: AABB[] = [];
  const citAvoid: AABB[] = [];
  const obstacle = (b: AABB) => { propColliders.push(b); citAvoid.push(b); return b; };

  const street = buildStreet({ scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1,
    // so ct/street.ts can register the ATM's own [E] and the alley dish's own
    // floor height — D, additive, flagged
    spot: (sp) => { SPOTS.push(sp); }, purse, refreshWallet: () => hud.refreshWallet(),
    // …and the same hook `ct/park.ts` has always had, so the street's props are
    // visible to the crowd and not only to the player. See item 198.
    obstacle,
    ground: (fn, order = BUILD.PROPS) => { GROUNDS.push({ fn, order }); } });
  // ── interaction registry ────────────────────────────────────────────────
  // Modules register their own [E] spots; this file no longer enumerates them.
  // `rig` and the teleport are created ~200 lines below, so the accessors are
  // lazy closures — they are only ever CALLED at runtime, by which point both
  // exist.
  // (GROUNDS is declared above the builders now — see the hoist.)
  // Named ground, published by whoever lays the block out and asked for by
  // name by whoever builds on it. See ctx.ts `Site`.
  const SITES = new Map<string, Site>();
  // every registered seat, for the test harness only — `scripts/seats-walk.mjs`
  // sits on all of them. Six different owners will be registering furniture
  // through ctx.seat(); none of them can verify it without being able to
  // enumerate what got registered.
  const SEATS: { pose: { x: number; z: number; yaw: number; h: number };
    at: { x: number; z: number }; r: number; label: string }[] = [];
  let rig!: FPRig;
  let jumpToImpl!: (x: number, z: number, yaw: number, gy: number) => void;
  const player: PlayerRef = {
    x: () => rig.pos.x,
    z: () => rig.pos.z,
    gy: () => apt.gy(),
    jumpTo: (x, z, yaw, gy) => jumpToImpl(x, z, yaw, gy),
  };
  // per-frame hooks, sorted by declared order once the world is built — so
  // moving a module's build call cannot silently change run order
  const HOOKS: { fn: FrameHook; order: number }[] = [];
  // ── the pockets, and the HUD that draws them ────────────────────────────
  //
  // Declared above the BUILDERS now, not merely above ctx — see the hoist.

  const ctx: CtxBuild = {
    scene, flat, wet, obstacle, boards, wetMats, sidewalkY, KERB_H,
    spot: (sp) => { SPOTS.push(sp); },
    purse,
    refreshWallet: () => hud.refreshWallet(),
    ground: (fn, order = BUILD.PROPS) => { GROUNDS.push({ fn, order }); },
    site: (name) => SITES.get(name) ?? null,
    publishSite: (name, st) => { SITES.set(name, st); },
    // ── seats ───────────────────────────────────────────────────────────
    //
    // A seat is TWO ordinary spots: one to sit, one to stand. Building it out
    // of the existing interaction registry rather than adding a parallel one
    // means the E dispatch below does not change at all, and a seat behaves
    // like every other prompt in the world for free.
    //
    // The pairing is what keeps it honest. `sit` is dead while you are seated
    // — every seat's is, so no seat can be hopped to from another — and
    // `stand` is live only for the seat you are actually on, which it knows
    // by identity, not by position.
    seat: (s) => {
      const pose = { x: s.x, z: s.z, yaw: s.yaw, h: s.h };
      const at = s.approach ?? { x: s.x, z: s.z };
      SEATS.push({ pose, at, r: s.r ?? 0.75, label: s.label ?? 'sit down' });
      SPOTS.push({
        x: at.x, z: at.z, r: s.r ?? 0.75,
        ok: () => !rig.seated && (s.ok ? s.ok() : true),
        label: () => s.label ?? 'sit down',
        act: () => rig.sit(pose),
      });
      // THE EXIT IS NO LONGER A SPOT YOU HAVE TO WIN.
      //
      // It used to be registered here as an ordinary spot and left to the E
      // resolver, which meant standing up was decided by a proximity contest
      // it happened to win because a seated player is 0 m from it. C measured
      // the blast radius: of 225 seats in the world, 149 have a non-stand spot
      // INSIDE the 0.5 m stand radius, and 12+ have one at EXACTLY 0.00 m —
      // any seat registered without `approach` puts its sit spot and its stand
      // spot on the same coordinate. The user got stuck and could not get out
      // with E.
      //
      // So the exit is now a STATE EXIT handled in the dispatch below: while
      // seated, E stands, full stop — no selection, no proximity, no aim cone.
      // What is kept here is only the LABEL.
      SEAT_EXIT.set(pose, s.standLabel ?? 'stand up');
    },
    onFrame: (fn, order = ORDER.PROPS) => { HOOKS.push({ fn, order }); },
    player,
    clock: {
      now: () => ({ hour: Math.floor((totalMin % 1440) / 60), minute: Math.floor(totalMin % 60),
        totalMin }),
      advance: (minutes: number, opts?: { overSeconds?: number }) => {
        if (!(minutes > 0)) return;
        const over = opts?.overSeconds ?? 1.5;
        if (over <= 0) { totalMin += minutes; return; }
        clockRamp += minutes;
        clockRampRate = Math.max(clockRampRate, minutes / over);
      },
    },
  };
  const apt = buildApartment(ctx);

  // ── the clock ───────────────────────────────────────────────────────────
  let totalMin = 13 * 60 + 20; // one real second = one game minute
  // A RAMP, not a jump. `ctx.clock.advance` adds to this and the sim drains it
  // a slice per frame, so everything that reads the clock fresh — the sky
  // curve, the night wash, the lamps, the rain schedule — sweeps instead of
  // cutting, and none of them needs to know a sleep happened. Snapping is what
  // would fight them.
  let clockRamp = 0;          // game minutes still owed
  let clockRampRate = 0;      // game minutes per real second
  let rmbHeld = false;
  let feedHeld = false;


  // ── the block's furniture, and the weather over it ─────────────────────
  // ── everything the block cleared ground for ─────────────────────────────
  //
  // `buildStreet` opens the sites and publishes their extents; the modules
  // that fill them ask for them by name. Until ct/street.ts publishes these
  // itself, this file relays the two it already receives — the relay it
  // replaces is the desk copying a z-span out of D's roster by hand, which
  // failed twice.
  ctx.publishSite('park', street.park);
  ctx.publishSite('lot', street.lot);
  // The jail's ground, at the side street's closed east end. It replaces the
  // 6 x 24 cross-building shell that used to stand there and z-fought with the
  // frontage O needs (GOTCHAS §6), and it is published rather than described so
  // O never hand-types a coordinate out of ct/street.ts.
  ctx.publishSite('jail', street.jail);
  // Modules are found by `ct/world.ts` and run in ORDER bands. This band sits
  // exactly where buildPark/buildLot were called, so construction order — and
  // therefore every tree height and pigeon in the world — is unchanged.
  buildWorld(ctx, 0, BUILD.PROPS - 1);

  const props = buildProps(ctx);

  // ── the parked cars ─────────────────────────────────────────────────────
  //
  // How well each is parked is DRAWN, not hand-placed. Hand-tuning offsets
  // only swaps one fixed arrangement for another; this samples a spread, so
  // near-perfect parking is a legitimate outcome rather than something the
  // arrangement excludes. Drawn off the SEEDED stream, so it is stable within
  // a session rather than jittering frame to frame.
  //
  // A van used to stand at z=-78 in front of THRIFT and has been cut. Its
  // collider lived in this table, so it went with it — the table below is the
  // single source for the parked fleet, its boxes and its lamplight entries.
  //
  // The two hard walls, which the spread cannot cross:
  //   PARK_SNUG  |x| + 1.05 = 4.98 < ROAD_HALF — collider never on the walk
  //   PARK_OUT   |x| − 1.05 = 2.57 — collider never in the travel lane
  //              (cars cruise at 1.5 and the bus at 1.35, both to 2.55)
  const PARK_SNUG = 3.93, PARK_OUT = 3.62;
  // Each car gets a tidiness CLASS, and the classes are dealt out shuffled.
  // Drawing all three independently is the obvious thing and it is wrong at
  // this sample size: with only three cars, three tidy ones comes up about a
  // fifth of the time, which is the machined row this was meant to fix (the
  // first seeded draw did exactly that — 4 cm, 6 cm, 2 cm, all square).
  // Stratifying guarantees the ROW reads as varied, while each car's actual
  // gap and angle are still drawn inside its class. Perfect parking stays a
  // real outcome — one car always gets it.
  const PARK_CLASS = ['perfect', 'ordinary', 'out'];
  for (let i = PARK_CLASS.length - 1; i > 0; i--) {   // Fisher–Yates, seeded
    const j = Math.floor(rnd() * (i + 1));
    [PARK_CLASS[i], PARK_CLASS[j]] = [PARK_CLASS[j], PARK_CLASS[i]];
  }
  const parkGap = (cls: string) =>
    cls === 'perfect' ? rnd() * 0.05
      : cls === 'ordinary' ? 0.05 + rnd() * 0.12
        : 0.17 + rnd() * 0.14;                  // out from the kerb
  const parkYaw = (cls: string) => {
    const s = rnd() < 0.5 ? -1 : 1;
    return s * (cls === 'perfect' ? rnd() * 0.012
      : cls === 'ordinary' ? 0.012 + rnd() * 0.038
        : 0.04 + rnd() * 0.06);                 // left it at an angle
  };
  const carColliders: AABB[] = [];
  // …and the fleet itself, because the gap rule cannot be finished here: half the
  // things a car might trap you against are registered by modules built LATER.
  // See settleParking() at the bottom of the build.
  const parkedFleet: { car: THREE.Group; cb: AABB; half: number; kind: CarKind; ry: number }[] = [];
  // `carHalf`, a hand-typed { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 }
  // that was ALSO typed out identically in ct/sidestreet.ts, is gone: every
  // entry was `CAR_SPEC[kind].len / 2 + 0.15`, and that derivation now lives
  // once in ct/cars.ts as `carHalfLen` (item 202c, BUILDER-BRIEF §8).
  // ── nobody parks across an alley mouth ──────────────────────────────────
  //
  // The truck stood on the west kerb at z0 = -33, and the draw below spreads
  // each car ±1.2 m off its nominal spot — so its tail reached z = -36.8, half
  // a metre off the alley gap at AZ0 = -37, and it closed the sight line into
  // the alley where the dumpster, the cat and the graffiti are.
  //
  // The arrangement is DRAWN now, not hand-placed, so the fix is to move the
  // CONSTRAINT and let the draw keep its spread: the nominal spot is derived as
  // the closest the truck can stand north of the mouth with its whole body, the
  // full spread, and a sight line, all clear of it. Hand-placing a new z here
  // would just be a different fixed arrangement.
  const ALLEY_SIGHT = 2.5;                      // clear space off the mouth
  const PARK_SPREAD = 2.4;                      // the ±1.2 m the draw applies
  const truckZ0 = AZ0 + ALLEY_SIGHT + carHalfLen('pickup') + PARK_SPREAD / 2;
  // kind, colour, which kerb, roughly where
  const parked: [CarKind, number, number, number][] = [
    // -13 -> -11: the user, looking at it broadside from the walk by the lamp
    // post, asked to "move this car back just a bit", and confirmed he meant
    // back ALONG the street rather than off the kerb.
    //
    // WHICH WAY IS BACK — I got this wrong first time and it is worth writing
    // down. The east kerb parks facing SOUTH (`ct/sidestreet.ts`: "the same
    // rule the main street's east kerb follows by facing south"), and south is
    // -z here: `bugsweep`'s own station `warp(-1, -20, 0)` is labelled "looking
    // back north", so yaw 0 is +z is north. A car facing -z reverses towards
    // +z. My first edit moved it to -15, which was two metres FORWARD.
    //
    // This is the same sign trap GOTCHAS records for atan2(nx,nz) — the
    // direction is only ever obvious after you find the sentence that fixes it.
    ['sedan', 1, 1, -11],
    ['pickup', 3, -1, truckZ0],
    ['hatch', 5, 1, -49],
  ];
  parked.forEach(([kind, ci, side, z0], pi) => {
    const cls = PARK_CLASS[pi % PARK_CLASS.length];
    const gap = Math.min(parkGap(cls), PARK_SNUG - PARK_OUT);
    const x = side * (PARK_SNUG - gap);
    const zDrawn = z0 + (rnd() - 0.5) * 2.4;    // and they don't sit on a rhythm
    // ── never leave a gap the player can enter but not leave ──────────────
    //
    // The drawn spot is kept unless it makes a corridor 0.40–0.95 m wide against
    // something already solid — a kerb prop, a tree pit, the bus bench, the car
    // in front. Then it takes the NEAREST legal spot instead, so the spread the
    // distribution chose survives and only the trap is removed. See ct/gap.ts;
    // hand-placing a fixed offset back would just be a different arrangement,
    // and the trap moves with the draw anyway.
    const box = (zz: number) => ({
      minX: x - CAR_HALF_W, maxX: x + CAR_HALF_W,
      minZ: zz - carHalfLen(kind), maxZ: zz + carHalfLen(kind),
    });
    // reach 4.5 m, not the 3 m default: a kerb prop's z-span has to be cleared
    // ENTIRELY to remove an x-corridor between it and the car beside it, and a
    // 5.2 m truck against a prop mid-block needs most of its own length to do
    // that. The nearest legal spot is still taken, so the spread survives.
    // ── KEEP-CLEAR: BOTH ALLEY MOUTHS, not just the one that was reported ──
    //
    // The dumpster alley is protected because the truck's z is DERIVED from
    // AZ0 above. D's new alley between the pawn shop and No. 227 was NOT: I
    // measured it and no car overlaps it today, but that is the seed being
    // kind rather than the rule holding — nothing stops a future draw parking
    // across it, and then it is the same user report a second time.
    //
    // So the mouth goes in the array nudgeClear already clears against, and
    // the draw routes round it exactly as it does a kerb prop or the bench.
    // The span is street.ts's A2_Z0/A2_Z1 (alley2Z0 and ALLEY2_W); it is
    // written out here because street.ts does not export it, and that is worth
    // fixing — a literal is the fragile shape I warned D about, and it is only
    // acceptable because the alternative is leaving the mouth unprotected.
    const A2_MOUTH = { minX: -FACE - 1, maxX: -FACE + 1, minZ: -55.5, maxZ: -53.0 };
    const fit = nudgeClear(zDrawn, box,
      [...propColliders, ...carColliders, A2_MOUTH], 4.5);
    if (!fit.ok) console.warn(`[parking] ${kind} at z=${zDrawn.toFixed(2)} leaves a trap-band gap and no clear spot within 3 m`);
    const z = fit.at;
    const ry = (side > 0 ? 0 : Math.PI) + parkYaw(cls);
    const car = makeCar(kind, ci);
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    scene.add(car);
    props.lit(car);          // parked in a lamp pool? then it catches it
    const cb = box(z);
    carColliders.push(cb); citAvoid.push(cb);
    parkedFleet.push({ car, cb, half: carHalfLen(kind), kind, ry });
  });
  // ── the traffic, and the road network it drives ─────────────────────────
  //
  // The fleet, the junction at the corner and the driving all live in
  // ct/traffic.ts. Built HERE, at this exact point in the sequence, because
  // the car textures paint off the shared Math.random stream — moving the call
  // re-grains every texture painted after it. `crowd` is assigned a few lines
  // below and the accessor is only ever CALLED at runtime, so the lazy closure
  // is safe (same pattern as `rig`).
  let crowd!: Crowd;
  /** Every collider that is a MOVING ACTOR — a citizen or a vehicle — held by
   *  object identity rather than by shape.
   *
   *  These are real colliders: they stop the player, and `fp.ts` is right to be
   *  blocked by them. What they are NOT is geometry, and `ct/gap.ts`'s
   *  `trapAgainst` only means something about geometry — a corridor is narrow
   *  or it is not, and a pedestrian standing in one is a pedestrian, not a
   *  trap. Scoring them painted the V overlay red down the whole east walk and
   *  cost a queue item, when a red-dump read a moving box out of `colliders`
   *  and reported it as a static prop.
   *
   *  Identity, not shape: a citizen's box is 0.5 x 0.5 and so is plenty of real
   *  furniture, so any size test would have excused the furniture too. There
   *  are exactly two places an actor box enters `colliders`, and both are the
   *  registration hooks right here, so the set cannot drift from the world. */
  const actorBoxes = new Set<AABB>();
  // ⚠ THE "EXACTLY TWO PLACES" ABOVE WAS FALSE, AND ITEM 260 IS THE BILL FOR
  // IT. There is a THIRD way in — `...apt.colliders` a few dozen lines below is
  // a plain spread, so every moving cap the walk-up owns arrived in `colliders`
  // without passing either hook. Two of them move:
  //
  //   · `hermitCap`  — (999, 999) while he is out; at his doorway from hour 17,
  //                    drifting x 202.26 → 202.04 by 23:00
  //   · package caps — the nightly `pkgRoll(num, day, 7)` flips which side of
  //                    the door a parcel sits on, so a 0.28 × 0.34 m cap jumps
  //                    1.63 m in z between game days
  //
  // Neither shows up in a probe that samples seconds apart — a game day is 24
  // REAL MINUTES — which is why they sat in `staticColliders()` unnoticed.
  // Measured with `scripts/probes/w105-moving-static.mjs` (`DAYS=6` for the
  // parcels, the default 24-hour sweep for the hermit).
  //
  // The invariant is restored by making the third way in DECLARE itself:
  // `ct/apartment.ts` publishes `actorColliders`, the moving subset of its own
  // `colliders`, and it is drained into this set at the spread below. A module
  // that adds a moving cap and forgets to declare it is still a way to drift —
  // but it is now a one-line omission in the module that owns the box, rather
  // than an unstated assumption in a file its author never opens.
  const vehicleBoxes: AABB[] = [];   // one per vehicle in the pool, parked at 999 while idle
  const traffic = buildTraffic(ctx, {
    SIDE_Z0, SIDE_X1,
    lit: props.lit,
    vehicleBox: (b) => { vehicleBoxes.push(b); citAvoid.push(b); actorBoxes.add(b); return b; },
    peopleAt: () => crowd.walkers(),
  });

  // ── the people on the block ─────────────────────────────────────────────
  //
  // The cast and the walking sim live in ct/crowd.ts. Built HERE, at this
  // exact point in the sequence, because the atlases paint off the shared
  // Math.random stream — moving the call re-grains every texture after it.
  crowd = buildCrowd(ctx, {
    citAvoid,
    // The crowd's own hook, and the ONLY way a citizen box reaches `colliders`
    // (via the `...propColliders` spread below, which copies the reference —
    // so the box keeps moving inside `colliders` as the walker walks).
    solid: (b) => { propColliders.push(b); actorBoxes.add(b); },
    lit: props.lit,
    SIDE_Z0, SIDE_Z1, SIDE_X1,
  });

  // ── the interior belt, built LAST ───────────────────────────────────────
  //
  // Rooms parked far out along +x that you teleport into. Each claims its own
  // slab from ct/interior.ts and registers its own way in and out, so adding
  // one does NOT mean editing this file — which is the whole reason ten of
  // them can be built in parallel.
  //
  // Last on purpose, and it must stay last.
  //
  // GOTCHAS §2 is about the seeded rnd() stream. The same argument applies,
  // harder, to the paint layer's Math.random — which the fingerprint harness
  // seeds. And it is not only `dither()` that draws from it: three.js burns
  // FOUR Math.random calls per object in `generateUUID`, so under the harness
  // every mesh, material and texture you CREATE shifts the grain of every
  // texture painted after it. Build a room in the middle and you repaint half
  // the block.
  //
  // Built here, after the last street object exists, ten interiors can add a
  // thousand objects and the street's fingerprint does not move — which is the
  // only reason it can still answer the question it exists to answer while
  // this programme is running. (Interiors do reshuffle each OTHER's grain;
  // that is harmless, because the shipped world's Math.random is unseeded and
  // repaints every load anyway.)
  // Adding a room is NO lines here. `buildAllInteriors` finds every
  // `ct/int-*.ts` and builds it, so writing the file is what puts the room in
  // the world — see the note on that function for the three rooms that sat
  // finished and unreachable because this used to be a hand-maintained list.
  // Colliders come back through `interiorColliders()`, spread once below.
  buildWorld(ctx, BUILD.PROPS, 99);


  // ── the side street's furniture — trees and parked cars ─────────────────
  //
  // AFTER the interior belt on purpose, and the reason is the paragraph above.
  // These are street objects, so they belong with the street belt by rights —
  // but creating a mesh burns Math.random in `generateUUID`, so a module placed
  // in the middle re-grains every texture painted after it. Built here, after
  // everything else that paints, it re-grains NOTHING: the fingerprint against
  // mainline comes back as pure additions, which is the only way to show that
  // adding content did not disturb the block. Still before `dimWorld` below, so
  // the trees and cars go dark after sunset with the rest of the world.
  //
  // If this ever needs to move earlier, expect the interiors' grain to shift —
  // harmless in the shipped world (Math.random is unseeded there and repaints
  // every load) but it will make the next refactor's fingerprint unreadable.
  buildSideStreet(ctx, { SIDE_Z0, SIDE_Z1, lit: props.lit });

  const colliders: AABB[] = [
    // The block's collision comes from the modules that DRAW it, not from
    // rectangles written here. This used to be two blanket walls spanning the
    // whole street, plus one across the corner shops, and because they knew
    // nothing about the buildings they described, collision could not follow
    // geometry: they walled off E's library courtyard and squared off the
    // bodega's canted corner. ct/street.ts now registers a real footprint per
    // building as it places it — following the chamfer, leaving the alley
    // mouth open, and skipping the library entirely so ct/civic.ts's own
    // colliders are the only thing there.
    //
    // `...street.colliders` USED TO BE HERE and is gone (item 198). It has not
    // stopped arriving: `ct/street.ts`'s `solid` now calls `obstacle`, so every
    // one of those boxes comes in through `...propColliders` below — the same
    // route `ct/park.ts` and `ct/jail.ts` have always used. Spreading both would
    // have listed 359 boxes twice.
    ...COURT.colliders,
    // The east end of the side street used to be a hand-written rectangle
    // here, standing in for the anonymous filler box that closed the street.
    // `ct/jail.ts` is that building now and registers its own footprint
    // through `ctx.obstacle`, which is how every other module does it — desk
    // ruling 2026-07-26, on a bounded mandate for this one line: *"a collider
    // in the entry point standing in for a building that is about to be
    // replaced is exactly the wiring the registration pattern exists to
    // remove."* It also stopped the player at x = 56.35, which would have put
    // the jail's door out of reach (GOTCHAS §8).
    ...propColliders,
    ...carColliders,
    ...apt.colliders,   // its MOVING subset is drained into actorBoxes below
    // The east edge of the OLD world, which used to be the `maxX: 260` bound.
    //
    // Moving that bound out to the interior belt quietly un-hid a hole: the
    // bodega's east wall has a gap around z = -21, and sprinting at it now
    // carries you out of the shop and 200 m across the dead ground between
    // the bodega and the first slab. The bound was covering for it. Putting a
    // real wall back where the bound was restores exactly the old behaviour
    // without reaching into `ct/bodega.ts`, which is not this builder's file —
    // the gap itself is reported to the desk in notes/feat-interiors.md.
    { minX: 260, maxX: 262, minZ: -112, maxZ: 20 },
    ...interiorColliders(),
    // the traffic pool replaces the single hand-placed cruiser: one box per
    // vehicle, parked at x=999 while idle (see ct/traffic.ts)
    ...vehicleBoxes,
  ];
  // ITEM 260 — THE THIRD WAY IN, now declared. `ct/apartment.ts` is the one
  // module that hands back its collider list as a plain array rather than
  // through `vehicleBox`/`solid`, and two of the caps in it move. Draining its
  // own declaration here keeps `staticColliders()` meaning "geometry", which is
  // the only thing `ct/gap.ts`'s `trapAgainst` and every red-dump probe are
  // entitled to assume. See the note beside `actorBoxes` above.
  for (const box of apt.actorColliders) actorBoxes.add(box);
  // Everything is built by now, so sweep the block into the night registry:
  // the buildings, the ground, the furniture. Anything already registered for
  // the lamplight (cars, people, kerb props) or owned by the rain keeps its
  // own entry — this only picks up what nothing else was tinting, which is
  // most of the world and all of the reason it used to flatten after dark.
  // ── settle the parking, now that everything solid exists ────────────────
  //
  // The dangerous-gap rule was applied when each car was drawn, and that was too
  // early: props.ts's kerb furniture is in place by then, but the park, the car
  // lot, the side street and the interiors all register obstacles AFTER, so a
  // car could be nudged clear of everything that existed and still end up 0.78 m
  // from a bin planted later. That is exactly what shipped — the probe found two,
  // and the build logged no warning because at the time it looked fine.
  //
  // So the rule runs again here, against the FINISHED world, and moves the car
  // and its collider together. Same nudge, same nearest-legal-spot behaviour, so
  // the drawn spread still survives.
  for (const p of parkedFleet) {
    // against EVERY solid box in the world, not just propColliders: the one that
    // caught us out belongs to a module that hands back its own collider list
    // (the walls, the walk-up, the bodega, the interiors) and never goes through
    // ctx.obstacle at all, so a check against propColliders cannot see it. That
    // is why the first version of this pass reported success and shipped a trap.
    const others = colliders.filter((b) => b !== p.cb);
    const z0 = p.car.position.z;
    const at = (zz: number) => ({
      minX: p.cb.minX, maxX: p.cb.maxX, minZ: zz - p.half, maxZ: zz + p.half,
    });
    const fit = nudgeClear(z0, at, others, 4.5);
    if (!fit.ok) {
      console.warn(`[parking] ${p.kind} at z=${z0.toFixed(2)} still leaves a trap-band gap`);
      continue;
    }
    if (fit.moved !== 0) {
      p.car.position.z = fit.at;
      p.cb.minZ = fit.at - p.half; p.cb.maxZ = fit.at + p.half;
    }
  }

  // ── items 29, 54 AND 202c: ONE COLLIDER PER KIND, ON EVERY INSTANCE ─────
  //
  // *"i want the collision to be a bit more accurate to the objects. the cars
  // for instance. we should be able to jump on the cars."*   (items 29, 54)
  // *"truck collision isnt accurate to the truck but the other truck is? it
  //  seems odd. seems like all trucks should be one object that are all the
  //  same no?"*                                                   (item 202c)
  //
  // THIS USED TO BE TWO BLOCKS OF NINETY LINES, one opening
  // `parkedFleet.find((p) => p.kind === 'pickup')` and the other
  // `parkedFleet.find((p) => p.kind === 'sedan')`. Each built a correct,
  // silhouette-hugging, height-capped collider — for THE FIRST MATCH, which is
  // all `.find()` ever returns. Every other vehicle in the world kept the bare
  // box `box()` gave it, with no `maxY` at all, and `fp.ts:40` makes `maxY`
  // optional so absent means FULL HEIGHT. That is exactly what the user was
  // looking at through the V overlay: two pickups, one hugging its silhouette
  // and one a full-height slab. The tiers were never wrong; they were applied
  // once each.
  //
  // The shapes now live in `ct/cars.ts` as `carColliderSpec(kind)`, beside the
  // panel constants they are derived from, and this loop applies them to every
  // parked car. Not one number moved — the measured reasons behind each tier's
  // height are recorded there rather than repeated here.
  //
  // PLACED HERE, AFTER settleParking, AND MUTATING `p.cb` RATHER THAN
  // REGISTERING THE SPLIT FROM THE START, because settleParking's own gap check
  // (`others = colliders.filter((b) => b !== p.cb)`, a few lines up) excludes
  // the car's box by REFERENCE — a second box registered before that loop ran
  // would not be excluded, and the truck would read as trapped against its own
  // tailgate.
  //
  // AND THE GROUND FOOTPRINT DOES NOT MOVE, which is what makes it safe to
  // split a box the trap-band rule has already been run against: a kind's tiers
  // tile its length end to end (nose … cowl … bed front … tail) and the bed
  // rails lie inside that, so the union of every tier is exactly the box
  // `nudgeClear` saw. The lane you walk past a parked car in is untouched, at
  // ground level, to the millimetre.
  type Top = AABB & { tag: string };
  let hitched = false;
  for (const p of parkedFleet) {
    const tiers = carColliderBoxes(p.kind, p.car.position.x, p.car.position.z, p.ry);
    // Tier 0 is written INTO the box that already exists, so every reference
    // already held to it — `carColliders`, `colliders`, `citAvoid` and
    // settleParking's own `p.cb` — keeps pointing at a live tier. The rest go
    // to `colliders`/`citAvoid` directly and NOT to `carColliders`, which was
    // spread into `colliders` hundreds of lines above: pushing there would not
    // reach FPRig, colliderDebug or ctx.colliders().
    Object.assign(p.cb, tiers[0]);
    for (const t of tiers.slice(1)) { colliders.push(t); citAvoid.push(t); }

    // ── item 54's TRAILER, which is a VEHICLE and not a kind of car ─────────
    //
    // *"i love the car with the trailer thing btw keep that tysm."*
    //
    // Hitched to the one sedan parked on this block, and deliberately NOT part
    // of `carColliderSpec('sedan')`: a trailer is a second vehicle that happens
    // to be attached to this one, so folding it into the KIND would hitch a
    // flatbed to every sedan in the world — the side street's, the lot's, and
    // the four in the traffic pool. What the kind owns is the boot lid; what
    // this particular car owns is the trailer behind it.
    //
    // The deck at 0.50 m is the step a sedan's own body cannot provide: it is
    // the height the pickup's bed floor has shipped at since item 1, imported
    // from `PICKUP_BED.floorY` rather than retyped, because "the one flat
    // height on this street a standing jump gains from the road" is exactly the
    // property both surfaces are for.
    //
    //   road 0.00 → trailer deck 0.50 → boot lid 0.93
    //
    // The roof is deliberately NOT on that list: a boot-lid → roof hop is a
    // 0.53 m rise, which at the dt clamp leaves two frames of travel (0.330 m)
    // against the 0.36 m of RADIUS `blocked()` pads the roof by, so it lands on
    // a coin flip. scripts/w29-sedan-climb.mjs asserts that ABSENCE.
    if (p.kind !== 'sedan' || hitched) continue;
    hitched = true;
    const sz = p.car.position.z;
    // Same convention as `carColliderBoxes`: every parked car collider in this
    // world is axis-aligned, so `dir` only has to answer "which world end is
    // the boot", which needs the SIGN of cos(ry), not its value. parkYaw()'s
    // few degrees of jitter never get near flipping that sign.
    const dir = Math.cos(p.ry) >= 0 ? 1 : -1;
    const localZ = (a: number, b: number): [number, number] =>
      (dir === 1 ? [sz + a, sz + b] : [sz - b, sz - a]);
    const DECK_Y = PICKUP_BED.floorY;         // 0.50 — imported, not retyped
    const DRAW_L = 0.30;                      // drawbar seen between car and deck
    const DECK_L = 1.50;
    const deckZ0 = p.half + DRAW_L, deckZ1 = deckZ0 + DECK_L;
    // The deck collider starts at the car's own tail, not at the deck plank, so
    // the car and the trailer present ONE continuous solid at ground level. A
    // gap here would be 0.65 m of exactly the 0.40–0.95 m band `ct/gap.ts`
    // calls a trap, manufactured between two things added on purpose.
    const deckZ = localZ(p.half, deckZ1);
    const deckBox: Top = {
      tag: 'sedan-trailer-deck', minX: p.cb.minX, maxX: p.cb.maxX,
      minZ: deckZ[0], maxZ: deckZ[1], maxY: DECK_Y,
    };

    // ── the trailer itself, as a child of the car it is hitched to ──────────
    //
    // A child, so it inherits the car's placement and yaw and cannot drift from
    // it — and so it is built in the car's own local frame, which is the frame
    // every number above is already in. Added AFTER settleParking, like the
    // tiers, so the car's final z is known.
    const trailer = new THREE.Group();
    const steelM = new THREE.MeshBasicMaterial({ color: 0x3c4046 });
    // (no local tyre material any more — the wheels take the fleet's, below,
    // which also carries the `noLight` flag this one never had)
    // A weathered plank deck, painted at the same nearest-neighbour density as
    // everything else on the block.
    const plankT = pixTex(32, 48, (g) => {
      g.fillStyle = '#6b5c46'; g.fillRect(0, 0, 32, 48);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = ['#7a6a52', '#63553f', '#71624b', '#5c4f3a', '#75664e', '#685a44'][i];
        g.fillRect(0, i * 8, 32, 7);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, i * 8 + 7, 32, 1);
      }
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 24; i++) g.fillRect((i * 11) % 32, (i * 7) % 48, 2, 1);
    });
    const deckM = new THREE.MeshBasicMaterial({ map: plankT });
    const DECK_T = 0.06, DECK_HW = 0.9;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_HW * 2, DECK_T, DECK_L),
      [steelM, steelM, deckM, steelM, steelM, steelM],
    );
    deck.position.set(0, DECK_Y - DECK_T / 2, deckZ0 + DECK_L / 2);
    trailer.add(deck);
    // the A-frame drawbar, reaching from under the deck to the car's tail
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, DRAW_L + 0.35), steelM);
    bar.position.set(0, DECK_Y - 0.14, p.half - 0.05 + (DRAW_L + 0.35) / 2);
    trailer.add(bar);
    // ── the axle, and two wheels ACTUALLY tucked under the deck ─────────────
    //
    // *"[screenshot] fix the wheels on the trailer"* (2026-08-02), and he has
    // also said *"i love the car with the trailer thing btw keep that tysm"* —
    // so the rig stays and something about the wheels reads wrong.
    //
    // THE COMMENT ON THIS LINE USED TO SAY "tucked under the deck" AND IT WAS
    // NOT TRUE. Centres at ±0.95 with a half-thickness of 0.07 put the outer
    // sidewalls at ±1.02 against `DECK_HW = 0.9` — **0.113 m of tyre standing
    // proud of the trailer on each side**, measured off the live scene graph
    // (`scripts/probes/w114-item253-trailer-look.mjs`: wheel span X
    // 2.7244…4.7701, deck span 2.8375…4.6571). Shot from the carriageway at 3 m,
    // which is where a player passes it, the near wheel reads as a black disc
    // silhouetted against the ROAD with no bodywork behind it — the *"dark blob
    // detached from the vehicle"* the request describes. The sedan's own wheel
    // one metre away does not, because it is a circle inside an arch.
    //
    // ninetyeight had already ruled out the other candidate with numbers: these
    // wheels do NOT float. Ground gap 0.0000 m — a 12-gon phased onto a VERTEX,
    // so they are the one pair in the world that is seated exactly right, and
    // item 252's decagon-on-its-apothem defect does not apply here.
    //
    // NOW DERIVED FROM THE DECK, so the comment cannot go false again: the outer
    // sidewall is placed flush with the deck edge rather than at a typed ±0.95.
    // `ct/cars.ts:1458` warns that moving a CAR's wheel inboard "buried it,
    // which was worse" — that does not transfer, and the reason is structural:
    // a car's flank is an opaque slab from rocker to beltline, so an inboard
    // wheel disappears behind it, whereas this deck is 0.06 m of plank at
    // 0.44–0.50 m and hides nothing. Tucking these in changes which side of the
    // silhouette the wheel sits on; it does not hide it.
    const WHEEL_R = 0.22, WHEEL_T = 0.14;
    const WHEEL_X = DECK_HW - WHEEL_T / 2;          // outer sidewall == deck edge
    const AXLE_Z = deckZ0 + DECK_L * 0.5;
    // The axle spans hub to hub, so it follows the wheels instead of being a
    // second hand-typed width that could drift away from them.
    const axle = new THREE.Mesh(new THREE.BoxGeometry(WHEEL_X * 2, 0.06, 0.06), steelM);
    axle.position.set(0, WHEEL_R, AXLE_Z);
    trailer.add(axle);
    // ── AND THEY GET HUBCAPS, LIKE EVERY OTHER WHEEL IN THE WORLD (item 292) ─
    //
    // This was the only wheel in the fleet wearing one flat black material and
    // no cap, because `hubcapTex` was module-private to `ct/cars.ts` and this
    // rig is built here. `fleetWheelMats()` publishes the whole answer —
    // `[tread, cap, cap]` in THREE's cylinder order, the tread flagged
    // `noLight`, the cap through `flatTex` — rather than the ingredients, so
    // "matching the fleet" is one call and not four remembered facts.
    //
    // ⚠ TEN SEGMENTS, NOT TWELVE, AND THE QUEUE ROW WOULD HAVE GOT THIS WRONG.
    //
    // The row says "use `tyreGeo`, not a bare CylinderGeometry", and it is right
    // about the tool — but `tyreGeo(r, w, 12)` would have BROKEN the one pair of
    // wheels in this world that is already seated perfectly. `tyreGeo` adds
    // `thetaStart = π/segs`, and after `rotation.z = π/2` the ground contact is
    // at θ = 270°:
    //
    //     segs 12, phase 0     θ = 30i          270/30 = 9      vertex ✓  (today)
    //     segs 12, phase π/12  θ = 15 + 30i     255/30 = 8.5    FLAT   ✗  a 7.5 mm float
    //     segs 10, phase π/10  θ = 18 + 36i     252/36 = 7      vertex ✓
    //
    // `ct/cars.ts`'s own docstring names these wheels as the proof that phase is
    // what seats a tyre — *"the trailer's wheels are the only pair that measured
    // gap 0.0000, and the reason is that they happen to be phased onto a
    // vertex"* — so applying the fix at the wrong segment count would have
    // undone the evidence the fix was derived from.
    //
    // Ten is also what the whole fleet uses (`tyreGeo(0.34, …, 10)` on a car,
    // `tyreGeo(0.44, …, 10)` on the bus), so this now matches in phase, in
    // facet count and in materials. Gap re-measured after the change, not
    // assumed: `scripts/probes/w119-292-trailer-wheels.mjs`.
    const wheelMats = fleetWheelMats();
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(tyreGeo(WHEEL_R, WHEEL_T, 10), wheelMats);
      w.rotation.z = Math.PI / 2;
      w.position.set(s * WHEEL_X, WHEEL_R, AXLE_Z);
      trailer.add(w);
    }
    // a low tail board with the lamps, at the very back so it shadows none of
    // the standing band. NO collider, for the pickup tailgate's reason: a wall
    // here would be a 0.12 m lip you cannot see and can only trip on.
    const board = new THREE.Mesh(new THREE.BoxGeometry(DECK_HW * 2, 0.12, 0.05), steelM);
    board.position.set(0, DECK_Y + 0.06, deckZ1 - 0.03);
    trailer.add(board);
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x8e2a24 }));
      lamp.position.set(s * 0.7, DECK_Y + 0.06, deckZ1 - 0.005);
      trailer.add(lamp);
    }
    if (dir < 0) trailer.rotation.y = Math.PI;   // local +z is the boot end
    p.car.add(trailer);
    props.lit(trailer);          // hitched in a lamp pool? then it catches it

    // ── does the trailer manufacture a trap anywhere? ──────────────────────
    //
    // It lengthens this car's ground footprint by 1.8 m, and `nudgeClear`
    // (settleParking, above) already ran and cannot see it. So the trap rule
    // runs again HERE, against the finished world, using ct/gap.ts's own
    // `corridor()` rather than a second copy of the band — a warning, because
    // the seed does not put anything within reach of it today and a silent pass
    // is how the first version of settleParking shipped a trap.
    for (const c of colliders) {
      if (c === deckBox || c === p.cb) continue;
      const w = corridor(deckBox, c);
      if (w !== null && w > ENTERABLE && w < PASSABLE) {
        console.warn(`[sedan-climb] trailer leaves a ${w.toFixed(2)} m trap-band gap`);
      }
    }
    colliders.push(deckBox); citAvoid.push(deckBox);
  }

  props.dimWorld(scene);

  // YOU WAKE UP IN YOUR ROOM. "also make me spawn in my room" — the coordinate
  // is not typed here, it is `SPAWN` in ct/apartment.ts, derived from that
  // building's own APT_X0/APT_Z0/ST0 so it follows the walk-up if it ever moves.
  // A copy of it here would be the exact defect the checks sweep for.
  //
  // SET THE FLOOR FIRST. This is the whole reason `SPAWN` carries a `gy` and
  // not just x/z/yaw: `aptGround` picks the storey nearest the LAST height and
  // refuses to step up more than 0.6 m (ct/apartment.ts, "no stepping up half a
  // storey"). With `lastGy` still 0, the first ground query from three storeys
  // up finds the lobby slab, not room 301's — you would spawn at the right
  // x/z and fall through to the ground floor. Seeding the picker means the
  // hysteresis starts settled on the floor you are actually standing on.
  apt.setGy(SPAWN.gy);
  // ONE object, held so it can be both CLAMPED AGAINST and PUBLISHED. A probe
  // that needs the world's edges had no way to ask for them, so the only
  // alternatives were retyping `-110.6` into a script (BUILDER-BRIEF §8, the
  // single most expensive habit here) or inferring the edge by walking into it
  // — which reports a COLLIDER wherever one stands in front of the clamp.
  // Published below as `__ct.bounds()`. The literal lives here rather than at
  // the call site so that the two readings can never disagree.
  const WORLD_BOUNDS = { minX: westBound(), maxX: interiorMaxX(),
    minZ: -110.6, maxZ: Math.max(13, interiorMaxZ()) };
  rig = new FPRig(cam, { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw }, {
    // maxX reaches only as far as the interiors actually built — every room
    // is constructed by now, so this is the real east edge, not a reservation
    // The west bound is DERIVED from the sites the street opened, not typed.
    //
    // It was -FACE - 6.4 = -13.40, right when the deepest thing off the block
    // was an alley. D deepened the park to 32 m and nothing followed: you walk
    // in, stop dead at -13.40, and the lamps, the trees, the benches and the
    // loop are all in front of you and unreachable. The user has only ever
    // seen the first seven metres of it, which is what "the shittiest park ive
    // ever seen" was actually describing. E flagged the shape of it before the
    // depth landed — "deepening the site alone builds a park you can see and
    // not enter".
    //
    // A fix landed in parallel with this one, hard-coding -FACE - 33 to clear
    // the park's rear wall at -39, having walked the whole west side at 1.5 m
    // intervals to confirm nothing else out there becomes reachable — west of
    // the building line every metre is already spoken for by a shell's own
    // footprint, so the clamp never stopped you anywhere except the park.
    // That check holds and is worth keeping written down. The number is
    // derived rather than typed because that is the part that cannot go stale:
    // the next site to deepen would need someone to remember this line again.
    // maxZ ASKS THE BELT, the way maxX always has. 13 is the end of the
    // street; a room deeper than 26 m reaches past it and the player was
    // clamped short of its own front wall, unable to reach the way-out spot at
    // `hd - 0.55`. Measured by G on the casino at d 30 (BLOCKED-G 1b).
    //
    // ── THIS ONE RECTANGLE HAS NOW BEEN QUEUED AS A DEFECT TWICE. IT IS NOT
    //    ONE. DO NOT MAKE IT REGIONAL WITHOUT RE-MEASURING THE BELOW.
    //
    // The complaint, both times, is that ONE bounds rectangle covers the street
    // AND the interior belt 600 m east, so `Math.max(13, interiorMaxZ())` hands
    // the STREET 6 m of north walking it has no geometry for. The arithmetic is
    // right: the clamp really does sit at z 19 while the street's own end is 13.
    //
    // **It buys the player nothing, because a collider stops him first
    // everywhere he can stand.** Walked, not reasoned about (w85, item 230,
    // `scripts/probes/w85-item230-walk-the-claims.mjs`): held `w` northward from
    // twelve starting points swept across x 8…30, plus the road at x -6…6, and
    // the furthest north ANY of them reached is **z 13.83** — the north end wall
    // at 14.20 less the player's 0.36 radius. That is 5.17 m short of the clamp,
    // so the clamp is never the thing that stops him.
    //
    // And there is nothing out there to reach: north of the car lot the drawn
    // floor ends at z 14.0 (exact triangle raycast; `w75-site-contained`'s
    // bounding-box predicate claims floor out to 16.5 and its header's "real
    // pavement out to z 16.75" is that over-reach, not pavement — photographed
    // at `shots/w85-north-z16-down.png`, where the ground ends in a hard edge
    // and the rest of the frame is sky). The strip beyond is a separate open
    // component with ZERO floor cells in it, unreachable from any component that
    // has any.
    //
    // So a regional bound would be a change to `fp.ts` — the world's movement
    // core — that moves the player's reachable set by exactly nothing. The
    // standing check is `scripts/world-contained.mjs`: if it ever reports a
    // reachable cell north of z 13, this reasoning has expired.
    bounds: WORLD_BOUNDS,
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    // THE ONE COMMITTING CALL. FPRig asks this only at `this.pos.x/z` (fp.ts
    // 146, 390, 495) — it is the player's own position, every frame — so this
    // is the single call entitled to move the storey the player is recorded
    // on. Every other caller of `groundPick` gets a pure read.
    groundY: (x, z) => groundPick(x, z, true),
  });

  /** How far west the world goes: past the deepest open site, or past the
   *  building line if there are none. The 1.2 m is the same cushion the old
   *  constant carried past the alley. */
  function westBound(): number {
    let deepest = -FACE - 6.4;
    for (const st of [street.park, street.lot]) {
      if (st && st.minX < deepest) deepest = st.minX;
    }
    return deepest - 1.2;
  }

  /**
   * How high is the floor at (x, z)?
   *
   * **A QUERY THAT MUTATED SHARED STATE WAS THE BUG.** Every return here used
   * to go through `apt.setGy`, which is the walk-up's storey picker — so
   * *asking* about a coordinate silently rewrote which storey the player was
   * recorded as standing on. Three call sites ask; only one of them is the
   * player. `canSee` (below) asks once per candidate `[E]` spot, every single
   * frame, at the SPOT's coordinates, so `lastGy` ended each frame describing
   * the last thing the prompt-aimer looked at. On the pavement the last spot
   * probed happened to sit at 0.14 and nothing looked wrong; at the kerb edge
   * it was a road-level spot at 0.00, and `apt.gy()` read 0.00 under a player
   * standing on 0.14. It survived because the next frame's rig update repaired
   * it — the damage and the repair are one frame apart, so any test that
   * sampled across two frames saw a clean world. `scripts/probes/w25-kerb-gy.mjs`
   * samples inside a single `evaluate` and is the guard.
   *
   * So the question and the move are now different calls. **Default is PURE.**
   * `commit` is passed by exactly one caller: the rig's per-frame `groundY`,
   * which is the only one that passes the player's own position — see the
   * `groundY` line above, and `aptGround` in ct/apartment.ts, which takes the
   * same flag for the same reason (the walk-up's picker has hysteresis and
   * writes `lastGy` itself). Anything else that means to MOVE the player
   * between storeys still says so out loud through `apt.setGy` — `jumpTo` and
   * `warp` below both do.
   */
  function groundPick(x: number, z: number, commit = false): number {
    // The one place the side effect lives. Every `return put(...)` below is a
    // pure read unless the caller asked to commit.
    const put = (y: number) => (commit ? apt.setGy(y) : y);
    {
      // whoever registered themselves, in declared order
      for (const g of GROUNDS) {
        const y = g.fn(x, z);
        if (y !== null) return put(y);
      }
      // the interior belt owns its own floors — each room answers for its
      // slab, so a builder can put a step or a mezzanine in a shop without
      // this file knowing anything about it
      const ig = interiorGround(x, z);
      if (ig !== null) return put(ig);
      // NOT wrapped in put(): the walk-up's picker is stateful and does its
      // own committing, because the value it writes is chosen by hysteresis
      // against the value already there.
      if (x > 100) return apt.ground(x, z, commit);
      // the kerb returns are curved and the corner one ramps — the ground
      // module owns those patches and answers null everywhere else
      const k = ground.gy(x, z);
      if (k !== null) return put(k);
      if (z < SIDE_Z0 + 2) { // the corner and the side street
        if (z > SIDE_Z0) return put(Math.abs(x) > ROAD_HALF ? KERB_H : 0);
        if (z < SIDE_Z1) return put(KERB_H);
        return put(x > SIDE_X1 || x < -ROAD_HALF ? KERB_H : 0);
      }
      // The open sites — the park and the car lot — are paved at KERB_H and
      // reach 7-8 m back, past where the rule below stops answering. Same
      // problem as the courtyard, same answer: the module that owns the ground
      // says how high it is and this reads it off one value per site.
      for (const st of [street.park, street.lot]) {
        if (x >= st.minX && x <= st.maxX && z >= st.minZ && z <= st.maxZ) return put(st.y);
      }
      // The library courtyard is paved at KERB_H and reaches back well past
      // FACE + 0.3, where the rule below stops answering — walk into it and
      // the floor drops away. ct/civic.ts publishes its extents and its paving
      // level for exactly this, so the notch and the floor come off ONE import
      // instead of being restated here.
      return put(Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0);
    }
  }

  // debug/tour hook
  // E is one key for the whole world: doors, buying, feeding the birds
  jumpToImpl = (x: number, z: number, yaw: number, gy: number) => {
    // Get up first. A door or a till within reach of a chair would otherwise
    // teleport you across the world still sitting on furniture you left
    // behind — and `stand()` would then try to put you back on a spot in the
    // room you have just left. No seat is currently that close to a door;
    // this is here so that the first one somebody registers is not a bug.
    if (rig.seated) rig.stand();
    rig.pos.set(x, rig.pos.y, z);
    rig.yaw = yaw;
    apt.setGy(gy);
  };
  // ── DIEGETIC SCREEN FOCUS ────────────────────────────────────────────────
  //
  // *"i want when i hit e here to adjust my position and perspective and lock it
  // to be looking at the atm"*.
  //
  // `ct/hud.ts` owns what a screen SHOWS and how it is escaped. This owns the
  // only three things that file cannot see — the camera, the rig and the frame
  // loop — and it is registered into the HUD rather than imported by it, because
  // every module already imports the HUD and the arrow cannot point both ways.
  //
  // THE POSE IS DERIVED FROM THE MESH AND NOTHING IS TYPED HERE ABOUT THE BANK.
  // A screen's own normal already states which way it faces and how far it is
  // raked, so standing off ALONG that normal puts the eye square to the glass
  // at the height the person who tilted it implied. Measured on the real mesh:
  // the ATM's screen is raked 8.1°, its world normal is (0.99, 0.14, 0), and a
  // 0.55 m stand-off therefore lands the eye at 1.59 m looking 8° down — which
  // is where a head actually is at a cash machine. `ct/bank.ts` is not touched,
  // not imported, and none of its numbers are copied: this reads the object.
  const RAY = new THREE.Raycaster();
  let renderer: THREE.WebGLRenderer | null = null;
  /** seconds to ease ONTO a screen. Leaving is instant — see `leave`. */
  const FOCUS_IN = 0.40;
  /** how far the FEET stop from the face. The eye goes closer than the body
   *  can; a person leans in to read a screen and their shoes do not follow. */
  const FOCUS_FEET = 0.95;
  type FocusPose = { pos: THREE.Vector3; yaw: number; pitch: number; fov: number; feetX: number; feetZ: number };
  let focus: {
    mesh: THREE.Object3D; escape: () => void; from: FocusPose; to: FocusPose; t: number;
    /** THE CHAIR THE PLAYER WAS ALREADY IN when this screen opened, or null if
     *  they walked up to it standing. See `leave`. */
    chair: SeatPose | null;
  } | null = null;
  const wrapPi = (a: number) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  const poseFor = (mesh: THREE.Object3D, standoff: number, fov: number): FocusPose => {
    mesh.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const geo = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    const na = geo?.getAttribute?.('normal');
    // The FIRST vertex normal, transformed into the world. Every screen this is
    // for is a flat plane, so vertex 0's normal is the face's normal; the
    // fallback covers a mesh built without normals at all.
    const n = (na
      ? new THREE.Vector3(na.getX(0), na.getY(0), na.getZ(0))
      : new THREE.Vector3(0, 0, 1)).transformDirection(mesh.matrixWorld).normalize();
    const eye = c.clone().addScaledVector(n, standoff);
    // A screen mounted at knee height must not put the player's head on the
    // floor. The stand-off decides the DISTANCE; this decides that a person is
    // still a person, and the pitch below absorbs whatever the clamp took.
    const gy = groundPick(eye.x, eye.z);
    eye.y = THREE.MathUtils.clamp(eye.y, gy + 1.05, gy + 1.75);
    const dir = c.clone().sub(eye).normalize();
    // where the body stands: square to the face, along its HORIZONTAL normal
    const flat = new THREE.Vector3(n.x, 0, n.z);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);     // a screen facing straight up
    flat.normalize();
    return {
      pos: eye,
      // rig convention, fp.ts:477 — fwd = (sin yaw, 0, -cos yaw)
      yaw: Math.atan2(dir.x, -dir.z),
      pitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
      fov,
      feetX: c.x + flat.x * FOCUS_FEET,
      feetZ: c.z + flat.z * FOCUS_FEET,
    };
  };
  /** The eased fly-in. Runs AFTER `rig.update` so the lock is the last word on
   *  where the eye is, and it is the only thing that writes the camera while a
   *  screen is up. */
  const stepFocus = (dt: number): void => {
    const f = focus;
    if (!f) return;
    // THE RIG LOST THE SEAT WITHOUT BEING ASKED — fp.ts's own capture-phase
    // Escape (the deepest hatch in the codebase), a teleport, a fade. Hand the
    // panel back its way out rather than hold a camera the world has stopped
    // agreeing with; `escape` closes the panel, which calls `leave()`.
    if (!rig.seated) { const esc = f.escape; focus = null; esc(); return; }
    f.t = Math.min(1, f.t + dt / FOCUS_IN);
    const k = f.t * f.t * (3 - 2 * f.t);                       // smoothstep
    const yaw = f.from.yaw + wrapPi(f.to.yaw - f.from.yaw) * k;
    const pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * k;
    // KEEP THE RIG IN STEP with what is actually on screen. Releasing then
    // continues from where the player was looking instead of snapping their
    // head back to the direction they walked up in.
    rig.yaw = yaw; rig.pitch = pitch;
    cam.position.lerpVectors(f.from.pos, f.to.pos, k);
    const fov = f.from.fov + (f.to.fov - f.from.fov) * k;
    if (Math.abs(cam.fov - fov) > 0.001) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const cp = Math.cos(pitch);
    cam.lookAt(
      cam.position.x + Math.sin(yaw) * cp,
      cam.position.y + Math.sin(pitch),
      cam.position.z - Math.cos(yaw) * cp,
    );
  };
  setScreenFocus({
    enter: ({ mesh, standoff, fov, escape }) => {
      const to = poseFor(mesh, standoff, fov);
      const from: FocusPose = {
        pos: cam.position.clone(), yaw: rig.yaw, pitch: rig.pitch, fov: cam.fov,
        feetX: rig.pos.x, feetZ: rig.pos.z,
      };
      // THE FEET ARE LOCKED BY THE RIG'S OWN SEAT rather than by a second freeze
      // written here. That is not laziness — it buys the escape hatch in
      // fp.ts's constructor, which listens for Escape in the capture phase
      // precisely because `ct/hud.ts`'s gate can swallow everything above it,
      // so a locked player still has a way out even if this file and that one
      // both fail. `h` is set from the eye height the player is standing at
      // RIGHT NOW, so nothing about the pose reads as sitting down.
      const eyeNow = cam.position.y - groundPick(rig.pos.x, rig.pos.z);
      // WERE THEY ALREADY SITTING? `rig.sit` early-returns when `seat` is set
      // (`fp.ts:285`), so opening a screen from a chair does NOT overwrite the
      // chair's pose — which is right, and is also why `leave` could not tell
      // the two cases apart and stood everybody up. Remember the chair, so it
      // can be given back. Null when they walked up to the screen standing, and
      // then `leave` behaves exactly as it always did.
      const chair = rig.seatedOn;
      rig.sit({ x: to.feetX, z: to.feetZ, yaw: to.yaw, h: Math.max(0, eyeNow - SIT_EYE) });
      focus = { mesh, escape, from, to, t: 0, chair };
    },
    // INSTANT, deliberately, where entering is eased. An ease OUT would go on
    // owning the camera for a fifth of a second after the player asked to
    // leave, and "did Escape work?" must never be a question this world makes
    // anybody ask. The orientation is already continuous — `stepFocus` keeps
    // `rig.yaw`/`rig.pitch` in step every frame — so what actually snaps is
    // the half-metre lean, and the fov, back to the player's own zoom.
    leave: () => {
      // NOTHING FOCUSED MEANS NOTHING RESTORED — `false`, not `undefined`. The
      // caller reads this to decide whether to stand the player up, and a
      // falsy-by-accident return is the shape of bug this whole item is.
      if (!focus) return false;
      const { chair } = focus;
      focus = null;
      if (Math.abs(cam.fov - fovTarget) > 0.001) { cam.fov = fovTarget; cam.updateProjectionMatrix(); }
      // ── CLOSING A SCREEN FROM A CHAIR LEAVES YOU IN THE CHAIR (item 206) ──
      //
      // *"you sit and its the loan process as an integrated overlay."* Sitting
      // down, reading the form, closing it and finding yourself standing up is
      // not that. It was never a trap — you always had a way out — it was the
      // wrong feel for the one thing the user asked for by name.
      //
      // ⚠ `stand()` THEN `sit()` IS NOT A ROUNDABOUT WAY OF DOING NOTHING, and
      // simply skipping the `stand()` does not work. `fp.ts:251` registers a
      // CAPTURE-phase Escape listener that sets `forceUp` whenever Escape is
      // pressed while seated — it fires before `ct/hud.ts`'s gate can swallow
      // the key, deliberately, because that gate is the thing it exists to
      // survive. `forceUp` is private and is consumed by `update()`'s seated
      // branch on the NEXT frame. So leaving the player seated without clearing
      // it stands them up one frame later instead of immediately, which is the
      // same bug wearing a delay.
      //
      // `stand()` clears `forceUp` unconditionally — its own comment says that
      // is the point of doing it there — and `sit()` puts the chair back. The
      // round trip is exact: `stand()` returns the player to `standFrom`, and
      // `sit()` re-records `standFrom` from that same position, so nothing
      // about getting up afterwards moves. Both are public API on the rig;
      // `fp.ts` is not touched, and it is not this item's file to touch.
      //
      // AND SAY SO, because `ct/hud.ts`'s `close()` runs a SECOND, unconditional
      // stand-up three lines after this returns — the structural anti-trap that
      // fires whenever the player was seated as a panel came up. It cannot tell
      // the player's own chair from one a machine took for them; only this
      // function can, because only this function called `rig.sit` and watched it
      // early-return. Returning the answer is what makes the two halves one fix:
      // either alone measures 9/13 on `scripts/probes/w107-seat-keeps-you.mjs`.
      let kept = false;
      if (rig.seated) {
        rig.stand();
        if (chair) { rig.sit(chair); kept = rig.seated; }
      }
      return kept;
    },
    pick: (clientX, clientY) => {
      if (!focus || !renderer) return null;
      const r = renderer.domElement.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      RAY.setFromCamera(new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      ), cam);
      const hit = RAY.intersectObject(focus.mesh, false)[0];
      return hit && hit.uv ? { u: hit.uv.x, v: hit.uv.y } : null;
    },
  });

  HOOKS.sort((a, b) => a.order - b.order);
  GROUNDS.sort((a, b) => a.order - b.order);

  const jumpTo = jumpToImpl;
  // The walk-up's two spots used to live here. ct/apartment.ts registers them
  // itself now, via ctx.spot — the entry point does not enumerate them.
  // The hand-written SPOTS block is GONE. Every `[E]` in the world is now
  // registered by the module that draws the thing you press it on — the last
  // two were the bodega's counters, and they went home to ct/bodega.ts once
  // ctx started carrying the purse.

  // ── REGION CULL: the exterior does not exist while you are indoors ───────
  //
  // The user, 2026-08-02: *"facing the window in my room makes the game feel
  // slow. like my mouse moving across the screen feels like it drags."*
  //
  // MEASURED FIRST, AND IT IS NOT SUBTLE. Standing still in 301 and turning on
  // the spot to face the window takes the frame from 223 GPU draw calls to
  // 4,007 — more than standing in the middle of the street (3,742) — and the
  // frustum-visible renderable count from 102 to 2,784. Of those 2,784,
  // **2,691 are street geometry**. Counts, not timings, and both are the same
  // number on the user's machine as on this one: `scripts/probes/w53-drawcount.mjs`
  // wraps `drawElements`/`drawArrays` on the GL context, and
  // `scripts/probes/w53-bands.mjs` buckets the frustum set by world x.
  //
  // WHY IT HAPPENS. `ct/interior.ts:22-25`: "Interiors are not inside their
  // buildings — they are rooms parked far out along +x that you teleport to."
  // 301 sits at x ~199; the street ends at x 100. Its window wall faces -x
  // with the entire city behind it, and three.js's only culling is a per-object
  // frustum test that knows nothing about walls. So every building, every
  // citizen and every parked car is submitted to the driver and then thrown
  // away by the depth buffer. Face the other way and the city leaves the
  // frustum, which is exactly the shape of his report — and why the STREET is
  // fine: nothing is parked behind him out there.
  //
  // AND NOT ONE PIXEL OF IT IS VISIBLE. 301's window does not look at the
  // street. It looks into a light well the user asked for in those words —
  // *"a bit of a gap out of the window and then just a brick wall, almost like
  // a little room outside the window that is just brick"* — which
  // `ct/apartment.ts` builds as a closed brick box 1.2 m from the glass, with
  // returns down both sides and a floor. The 2,691 are drawn behind a wall you
  // cannot see past at any angle, from anywhere in the room.
  //
  // THE RULE. x 100 is not a number invented here. `ct/interior.ts:40` states
  // the world's address map — "x < 100 is the street" — and this file already
  // uses `px < 100` as "am I outdoors" to decide whether feeding the birds
  // works. A top-level scene child whose whole extent lies west of it is
  // street geometry; while the player stands east of it, it is not drawn.
  //
  // WHAT IT DELIBERATELY REFUSES TO TOUCH, because a room whose window goes
  // black is worse than a slow one:
  //   · anything that STRADDLES the boundary. The test is "entirely west of
  //     100", so the sky, or anything world-spanning, fails it and stays. If a
  //     thing might be visible from both sides, it is never hidden.
  //   · any subtree containing a Light — hiding a parent takes its lights out
  //     of the render, and this scene's two are global (line 90).
  //   · anything added to the scene after the first frame: a spot outline, a
  //     probe's car. Unclassified is never hidden.
  //
  // It constructs no object of any kind, deliberately. `scenedump.mjs` seeds
  // `Math.random` globally and three draws four random values per Object3D, so
  // one new mesh, geometry or material here would repaint every dithered
  // texture built after it and make `fp` unreadable (GOTCHAS 75). Box3 and
  // Vector3 are plain math and carry no uuid — which is why, unusually for a
  // performance change, `fp` IS a valid proof for this one.
  const REGION_X = 100;
  let regionKids: THREE.Object3D[] | null = null;
  const regionWas: boolean[] = [];
  let exteriorHidden = false;
  let regionCullOn = true;

  /** Sort the scene's top-level children into "entirely street" and everything
   *  else, once, on the first frame — by which point every module has built and
   *  nothing further is added at construction time. */
  function classifyRegions(): void {
    scene.updateMatrixWorld(true);
    const kids: THREE.Object3D[] = [];
    for (const child of scene.children) {
      let hasLight = false, hasDrawable = false, maxX = -Infinity;
      child.traverse((o) => {
        if ((o as unknown as { isLight?: boolean }).isLight) hasLight = true;
        const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (!g) return;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const bs = g.boundingSphere;
        if (!bs) return;
        hasDrawable = true;
        const e = o.matrixWorld.elements;
        // the sphere's centre through the world matrix (column-major: the x row
        // is e0/e4/e8/e12), plus its radius under the largest axis scale. Both
        // conservative, so a wrong answer errs towards KEEPING the object.
        const cx = bs.center.x * e[0] + bs.center.y * e[4] + bs.center.z * e[8] + e[12];
        const s = Math.max(Math.hypot(e[0], e[1], e[2]),
          Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
        maxX = Math.max(maxX, cx + bs.radius * s);
      });
      if (hasLight || !hasDrawable) continue;      // never a candidate
      if (maxX < REGION_X) kids.push(child);
    }
    regionKids = kids;
  }

  function regionCull(px: number): void {
    if (!regionKids) classifyRegions();
    const kids = regionKids!;
    const hide = regionCullOn && px >= REGION_X;
    if (hide !== exteriorHidden) {
      if (hide) {
        // REMEMBER WHAT THE OWNER WANTED. Restoring a blanket `true` would put
        // the rain on for a frame on a dry afternoon, and switch on every
        // vehicle in the pool that traffic.ts is holding in reserve.
        regionWas.length = kids.length;
        for (let i = 0; i < kids.length; i++) { regionWas[i] = kids[i].visible; kids[i].visible = false; }
      } else {
        for (let i = 0; i < kids.length; i++) kids[i].visible = regionWas[i] ?? true;
      }
      exteriorHidden = hide;
    } else if (hide) {
      // RE-ASSERT, because some top-level children are written every frame by
      // the module that owns them — the traffic fleet (ct/traffic.ts adds each
      // car to the scene directly), the rain and the star dome. A one-shot hide
      // is undone by the next hook to run, so this runs LAST in the frame and
      // has the final word. A boolean compare over the classified set, against
      // ~3,800 draw calls.
      for (let i = 0; i < kids.length; i++) if (kids[i].visible) kids[i].visible = false;
    }
  }

  // ── `__ct` OWNS THE WORLD. IT IS NOT A SUPERSET OF THE OTHER TEN. ─────────
  //
  // Item 249: *"`window.__hud` VERSUS `window.__ct` IS UNDOCUMENTED and cost
  // ninety three probe detours."* Reaching for the wrong surface does not throw
  // — it hands you `undefined`, and a probe then reasons from it, which is the
  // same silent-failure shape that had one reasoning from `RADIUS=undefined`.
  //
  // What lives HERE: the rig and where it is, the scene graph, colliders, ground
  // and floors, everything registered (spots, seats, doors, rooms, sites,
  // modules), the clock, traffic, people, the debug overlays.
  //
  // What does NOT: whether a panel is up — that is `__hud`, in `ct/hud.ts` — and
  // anything about one machine, which is on that machine's own surface (`__atm`,
  // `__slots`, `__blackjack`, `__librarypc`, `__inv`, `__rent`, `__frontages`).
  // **Eleven surfaces, 162 members, measured 2026-08-03.** Full map in
  // `notes/BUILDER-BRIEF.md` §4a; re-enumerate it from the running world with
  // `scripts/probes/w119-249-test-surfaces.mjs` rather than trusting a list.
  //
  // COMMENT ONLY — no member of this object is changed by item 249.
  (window as any).__ct = {
    warp: (x: number, z: number, yaw?: number, gy?: number, pitch?: number) => {
      // A TELEPORT BREAKS THE SIGHT CACHE'S ONE ASSUMPTION — that he cannot have
      // moved further than SEE_MOVE since the last answer was taken. A warp of
      // 0.05 m is still a warp, and it puts him somewhere the cached sight lines
      // were never cast from. Every instrument in `scripts/` drives the world
      // through this door, so a stale read here is a check measuring the station
      // before the one it thinks it is at.
      seeCache.clear(); seeAtT = -Infinity;
      rig.pos.set(x, rig.pos.y, z);
      if (yaw !== undefined) rig.yaw = yaw;
      if (gy !== undefined) apt.setGy(gy);
      if (pitch !== undefined) rig.pitch = pitch;
    },
    clock: (h: number, m = 0) => { totalMin = h * 60 + m; clockRamp = 0; clockRampRate = 0; },
    /** DEBUG: draw the [E] trigger volume of whatever is currently selected —
     *  its registered radius, and the reach-margin ring on the floor. OFF by
     *  default. A diagnosis tool for "the prompt did not come up" and "I got the
     *  wrong thing", not a player feature; see `SpotOutline` for why it draws a
     *  volume and not an object outline. */
    debugSpots: (on: boolean) => { debugSpots = on; if (!on) spotOutline.show(scene, null); },
    // DEBUG: same shape as debugSpots — a console/probe affordance for the
    // collision-view toggle (player key: V), so a script can turn it on
    // without simulating a keypress. off means truly off: see ct/debug-
    // collision.ts's ColliderDebug.update, which tears its scene objects
    // down rather than merely hiding them.
    debugCollision: (on: boolean) => { debugCollision = on; },
    debugCollisionOn: () => debugCollision,
    // test affordance for the ctx.clock verb, the same way colliders() and
    // groundAt() expose their registries — a capability nobody can drive from
    // a harness is a capability nobody can prove works.
    advanceClock: (minutes: number, overSeconds?: number) => {
      if (!(minutes > 0)) return;
      const over = overSeconds ?? 1.5;
      if (over <= 0) { totalMin += minutes; return; }
      clockRamp += minutes;
      clockRampRate = Math.max(clockRampRate, minutes / over);
    },
    clockNow: () => ({ hour: Math.floor((totalMin % 1440) / 60),
      minute: Math.floor(totalMin % 60), totalMin }),
    // test affordance: the 42 is rare on purpose, so put it on the block now
    bus: (z = -20, dir: 1 | -1 = -1) => traffic.bus(z, dir),
    // …and read back what it's doing, so the stop can be verified as motion
    // rather than guessed at from a still
    busInfo: () => traffic.busInfo(),
    // test affordance: every vehicle that is out, and what it is doing —
    // position, heading, speed, lean and steer (scripts/corner-traffic.mjs)
    traffic: () => traffic.info(),
    // test affordance: force a movement through the junction NOW, rather than
    // waiting out a 18–42 s gap between passes
    drive: (route: 'NE' | 'EN' = 'NE', which: 'car' | 'bus' | 'taxi' = 'car', s = 0, add = false) => traffic.spawn(route, which, s, add),
    // test affordance: stand one car of any kind and any CarState in front of
    // the player, for scripts/carstate.mjs. Builds nothing at load time.
    carVariant: (kind: CarKind = 'sedan', state: Record<string, unknown> = {}, x = 0, z = 0, ry = 0) => {
      const c = makeCar(kind, 3, false, state as never);
      c.position.set(x, 0, z); c.rotation.y = ry;
      c.userData.probe = true;
      scene.add(c);
      return c;                    // the OBJECT: a count tells a probe nothing it can check
    },
    // test affordance: THE DECLARED COLLIDER FOR A KIND OF CAR, in the car's own
    // local frame (item 202c). Published so a check can ask "does every sedan in
    // this world carry the sedan's collider?" against the SPEC rather than
    // against another instance — instance-vs-instance goes green the moment two
    // instances are wrong the same way, and it cannot tell a tier of the kind
    // apart from something hitched to one particular car (the sedan's trailer).
    carSpec: (kind: CarKind = 'sedan') => carColliderSpec(kind),
    // test affordance: IS THE RE-ENTRY HYSTERESIS HOLDING RIGHT NOW, and how
    // far must you walk to clear it?
    //
    // H is blocked verifying the re-entry fix and the reason is that the fix is
    // INVISIBLE FROM OUTSIDE: "pressing E where you land does nothing and the
    // regression cannot be observed from outside." That is the fix working —
    // every spot is suppressed until you are 1.2 m clear of where a door put
    // you, or a door drops you on its own far-side trigger and pulls you
    // straight back. But a null prompt is also what a BROKEN world produces,
    // and from the HUD alone the two are the same reading.
    //
    // So the state is published rather than inferred, the same way colliders()
    // and groundAt() publish theirs: a capability nobody can drive from a
    // harness is a capability nobody can prove works. Returns null when
    // nothing is suppressed, otherwise the arrival point and how much further
    // you must walk to re-arm.
    landing: () => (landing
      ? { x: landing.x, z: landing.z,
          clearIn: Math.max(0, LATCH_CLEAR - Math.hypot(rig.pos.x - landing.x, rig.pos.z - landing.z)) }
      : null),
    hermit: (v: boolean | null) => apt.forceHermit(v),
    /** THE WALLET, READ-ONLY — cash, pockets, bank balance, card.
     *
     *  WHY THIS EXISTS AT ALL (item 261). Until now `__ct` published nothing
     *  about money, so a check that wanted to assert the player got PAID had to
     *  reconstruct the number from PROMPT TEXT — `ct/int-bodega.ts:762` words
     *  its own label off the wallet ("buy cereal — $2.50" above $2.50, "you’re
     *  short" below it), and `scripts/probes/w103-fence-loop.mjs` drained the
     *  purse against that threshold and then did arithmetic on a hand-typed
     *  START_CASH to guess where it stood. That is fragile for the obvious
     *  reason — two literals copied out of two other files, BUILDER-BRIEF §8 —
     *  and for a non-obvious one this project has already been bitten by: the
     *  prompt is a DOM element whose text has outlived its own hiding before
     *  (GOTCHAS: a check 40 m from the jail still read `[E] into the HOUSE OF
     *  DETENTION`). A money assertion built on that is one regression away from
     *  measuring a ghost.
     *
     *  ⚠ AND THE PURSE WAS ALREADY PUBLISHED THREE TIMES OVER, once per feature
     *  that needed it and could not edit this file: `__inv.cash()`
     *  (ct/inventory.ts:772), `__atm.cash()` (ct/atm.ts) and `__slots.cash()`
     *  (ct/slots.ts:2421), each with a comment explaining that it is here
     *  because crosstown.ts belongs to somebody else. Three windows onto one
     *  object, and every one of them only exists once its own module has run —
     *  `__inv` is undefined until the pockets are built, so a check that opens
     *  with a money read is racing a module load. This is the one that does not
     *  depend on which feature happens to be alive. The three are left in place
     *  deliberately: they are each other's cross-check, and `__slots.cash()`'s
     *  own comment is right that "my machine moves THAT money" is best asserted
     *  through the machine.
     *
     *  NUMBERS, NOT THE OBJECT, and `inv` is a fresh copy — same rule as
     *  `citAvoid()` and `party()` above. `ctx.purse` is the single wallet the
     *  ATM, the bodega, the bank's loan desk, the slots and the pawn fence all
     *  spend from, so handing a probe the live object would let it fund its own
     *  assertions. `account` and `card` are optional on `Purse` (ct/hud.ts:15 —
     *  `ct/atm.ts` seeds the balance on first use), and they are normalised
     *  here rather than passed through as `undefined`: `undefined` does not
     *  survive `page.evaluate`'s serialisation, so a probe reading
     *  `'account' in purse()` would get a different answer than the world has.
     *  `null` means "the ATM has never been opened"; `card` defaults to true,
     *  which is what every reader of the optional field already assumes. */
    purse: () => ({
      cash: purse.cash,
      inv: { ...purse.inv },
      account: purse.account ?? null,
      card: purse.card !== false,
    }),
    /** debug hook: every landing gets a package (true) / none (false) / roll
     *  back on the nightly odds (null).
     *
     *  `ct/apartment.ts:152` has published this on its own interface since the
     *  packages landed, and nothing outside the module could reach it: the one
     *  check that drives it, `scripts/packages.mjs:32`, goes in through
     *  `scene().userData.packages.force()` — a side door through renderer state
     *  that works only because the apartment happens to hang a handle there.
     *
     *  It matters more since the fence landed (item 180). The theft-and-fence
     *  loop needs a parcel on a landing, and **a game day is 24 REAL MINUTES**,
     *  so a probe that waits on the spawn roll either burns hours or proves
     *  nothing. `w103-fence-loop.mjs` worked around it by calling
     *  `advanceClock(1440)` up to 40 times looking for a parcel — 40 simulated
     *  days to test one sale. With this it asks for one and gets one.
     *
     *  Named `forcePackages` rather than shortened to `packages` the way
     *  `hermit` shortens `forceHermit`: `apt.packages()` is a REPORT of what is
     *  out there, a different question with the same short name, and one of the
     *  two would have had to be renamed to something worse. */
    forcePackages: (v: boolean | null) => apt.forcePackages(v),
    atlases: () => crowd.atlases(),
    // test affordance: who is on the block, how big and how fast
    people: () => crowd.people(),
    // test affordance: which painted angle each person is showing, mirrored or
    // not, so the profile feet can be checked against travel (scripts/feet-check.mjs)
    views: () => crowd.views(),
    // test affordance: where everybody is standing, for the routing probe
    walkers: () => crowd.walkers(),
    // test affordance: route two named nodes of the walkable network
    netRoute: (a: string, b: string) => crowd.netRoute(a, b),
    // test affordance: THE dangerous-gap predicate, so scripts/gaps.mjs asks the
    // same code the parked draw is constrained by. It had its own copy and the
    // two disagreed about a near-degenerate pair — which is the only reason that
    // corridor was ever in doubt. One implementation, no drift.
    gapRule: () => ({ ENTERABLE, PASSABLE }),
    corridor: (a: AABB, b: AABB) => corridor(a, b),
    // paint any Look — how notes/CITIZEN-STYLE.md's contact sheet is made
    person: (look: any) => crowd.paint(look),
    pos: () => [rig.pos.x, rig.pos.y, rig.pos.z, apt.gy()],
    // test affordance: "is my [E] spot inside something solid?" is the single
    // most expensive question in this project — GOTCHAS §8, and the reason the
    // bodega was un-enterable — and it was previously only answerable by
    // bisecting the walk with the player. Read-only view of the live list.
    colliders: () => colliders,
    /** The moving actors inside `colliders()` — citizens and vehicles.
     *
     *  A SEPARATE accessor rather than a flag on `colliders()`, deliberately.
     *  `colliders()` returns the live array BY REFERENCE and at least one check
     *  relies on that: `scripts/interiors-walk.mjs --selftest` walls every door
     *  shut by pushing onto it. Returning a mapped copy would leave that
     *  selftest silently mutating a throwaway array and passing having tested
     *  nothing — the exact family of sleeping guard this project keeps paying
     *  for. So the array is left alone and the extra information is published
     *  beside it.
     *
     *  Identity does not survive the serialisation boundary, so an instrument
     *  matches these against `colliders()` BY VALUE, the same way the red-dump
     *  probes already key a box on its four extents plus `rot`. */
    actorColliders: () => [...actorBoxes],
    /** THE WORLD'S GEOMETRY, WITHOUT THE THINGS THAT WALK.
     *
     *  One root cause has now produced four false defects, all of them the same
     *  sentence: moving actors live in the same array as masonry. The V overlay
     *  painted the whole east walk red for pedestrians; a red-dump wrote a
     *  walking citizen down as a static prop and the desk queued a 0.45 m trap
     *  that does not exist; the chamfer walk reported "the chamfer did not let
     *  me past" when a citizen crossed the corner and refused the -z step
     *  exactly like a wall; and unstick-walk probed a point on the strength of
     *  the same confusion.
     *
     *  Item 65 fixed the OVERLAY's scoring by filtering locally, at one call
     *  site. That is the right answer in the wrong place: every future consumer
     *  inherits the bug, and three of the four defects above were written after
     *  that fix landed. So the distinction is published here instead, once,
     *  where anything reasoning about GEOMETRY can ask for geometry.
     *
     *  Actors keep their colliders and `fp.ts` is still right to be stopped by
     *  them — you cannot walk through a person. What they are not is a wall, and
     *  `gap.ts`'s corridor maths only means something about walls: a corridor is
     *  narrow or it is not, and a pedestrian standing in one is a pedestrian.
     *
     *  BY IDENTITY, against the set the two registration hooks build, never by
     *  shape — a citizen's box is 0.5 x 0.5 and so is plenty of real furniture,
     *  so any size test would have excused the furniture too.
     *
     *  A COPY, unlike `colliders()`, and deliberately: this is a derived view
     *  and nothing may push onto it expecting the world to change. The one
     *  selftest that mutates `colliders()` by reference keeps doing so. */
    staticColliders: () => colliders.filter((c) => !actorBoxes.has(c)),
    /** WHAT THE CROWD STEERS AROUND — the pedestrians' obstacle list.
     *
     *  `colliders` stops the PLAYER; `citAvoid` is what `ct/crowd.ts` steers
     *  citizens around, and the two are different lists on purpose. Nothing
     *  published it, so **the difference between them was unobservable from
     *  outside**, and that is a blocker under two of the user's own bugs:
     *  *"pedestrians sometimes clip into the fruit in the sidewalk outside the
     *  bodega"* (195) and *"people still get stuck"* (173). Both could be
     *  watched and neither could be asserted — a probe could see a citizen
     *  walk through a crate but could not ask whether the crate was ever
     *  offered to the crowd in the first place. Those are different bugs with
     *  different fixes, and telling them apart is the whole value here.
     *
     *  NUMBERS, NOT THE LIVE ARRAY, and this is the one place it differs from
     *  `colliders()` above. That one returns by reference because
     *  `interiors-walk.mjs --selftest` walls doors shut by pushing onto it;
     *  nothing needs that here, and a probe that can push a box into the
     *  crowd's obstacle list is a probe that can make the world agree with it.
     *  Each entry is a fresh spread, so mutating one changes nothing — the same
     *  reasoning `painted()` gives for publishing three counters rather than
     *  the renderer.
     *
     *  `actor` IS COMPUTED HERE, INSIDE THE WORLD, because it can only be
     *  computed here: it is an IDENTITY test against `actorBoxes`, and identity
     *  is exactly what does not survive `page.evaluate`. Cars and citizens push
     *  onto `citAvoid` too, so without this flag a probe asking "is the fruit
     *  stand in the list" has to distinguish a crate from a pedestrian by
     *  shape — and a citizen's box is 0.5 x 0.5, which is also plenty of real
     *  furniture. The spread carries `rot`, `minY`/`maxY` and any `tag` a box
     *  was built with, so a caller can key on the same fields the red-dump
     *  probes already key on. */
    citAvoid: () => citAvoid.map((b) => ({ ...b, actor: actorBoxes.has(b) })),
    // test affordance: WHAT GROUND HAS BEEN PUBLISHED, and where? Same argument
    // as colliders() and groundAt() — a module that asks `ctx.site('jail')` and
    // gets null must build nothing and say so, and until now there was no way
    // from outside to tell "the site is missing" from "the module ignored it".
    // O is building against a site it cannot see published; this is how it, and
    // whoever verifies the row, can check the publish actually landed.
    sites: () => Object.fromEntries(SITES),
    rooms: () => interiorRoomIds(),
    // resolved room geometry, so a harness never carries its own copy
    roomDims: () => interiorRooms(),
    /** Every party wall in the world — the one authoring of it is
     *  `ct/interior.ts:120` and this is a window onto it, not a second copy.
     *
     *  WHY IT IS HERE AT ALL (item 251). `scripts/interiors-walk.mjs` is a
     *  registered check, and it was the ONE check in this project that could
     *  not run on the built bundle — it read this declaration by doing
     *  `import('/src/proto/ct/interior.ts')` at runtime, which `vite dev`
     *  serves and `vite preview` 404s. So every builder was told to verify on
     *  the bundle (GOTCHAS 28) by a suite containing a check that could not.
     *  Worker ninetythree measured the gap and found three of its four source
     *  imports already redundant against `__ct.doors()`; `PARTY` was the whole
     *  remaining blocker, and it is one line.
     *
     *  AND THE HARNESS CANNOT BE LEFT TO GUESS IT. A containment walk that does
     *  not know where the party doorways are reports the doorway as a HOLE in
     *  the wall — the feature reads as the bug. That is why interiors-walk
     *  refuses to run rather than assuming an empty list.
     *
     *  A MAPPED COPY, like `citAvoid()` above and for the same reason: a test
     *  hook must not be a handle on world state. `PARTY` is `readonly` to
     *  TypeScript, but a probe reaching it through `__ct` is plain JavaScript
     *  and `readonly` is erased at runtime — returning the array itself would
     *  let a harness splice the world's only party wall out from under the
     *  renderer and then measure the result. The spread is per-element because
     *  handing back fresh objects in a fresh array is the only version of this
     *  that is actually read-only. */
    party: () => PARTY.map((w) => ({ ...w })),
    modules: () => worldRegistrants(),
    // test affordance, like colliders() and seats(): every registered [E], so
    // scripts/spots-walk.mjs can check the whole set rather than the ones
    // somebody remembered. Labels are evaluated, which is why they come back
    // as strings and not thunks.
    // Every declared door as tooling sees it: world point, outward normal, and
    // the spot you stand on. `__frontages` is A's and covers flat shopfronts
    // only, so the BODEGA — whose door is on a canted bay and is deliberately
    // never handed to the painter — was invisible to anything auditing doors.
    // Recorded as "tooling only, costs a player nothing", which is true and is
    // also how the bodega's own misalignment went unnoticed for so long.
    doors: () => declaredDoors().map((d) => ({
      building: d.building, chamfer: !!d.face,
      point: doorPointFor(d.building), stand: doorStandFor(d.building),
      widthM: d.width ?? null,
    })),
    // `rank` is published alongside the geometry (item 291) because it is now
    // part of WHY a spot won, and a probe that can see the arithmetic but not
    // the rank is reading two thirds of the decision.
    spots: () => SPOTS.map((sp) => ({
      x: sp.x, z: sp.z, r: sp.r, label: sp.label(), ok: sp.ok(), rank: sp.rank ?? 0,
    })),
    // REACH IS NOT RADIUS, and a script cannot work that out from `spots()`
    // alone: a spot publishes its `r`, but the margin that turns that radius
    // into a selectable disc lives in fp.ts. Two scripts had therefore
    // hand-typed `const REACH_MARGIN = 0.6` to reconstruct the predicate —
    // BUILDER-BRIEF §8's "a second hand-typed copy of a number is the single
    // most expensive habit in this codebase", and the reason `bedcavity.mjs`
    // spent a week measuring a truck that no longer existed.
    //
    // Published rather than folded into `spots()` as a `reach` field: each
    // margin is ONE global, not a property of each spot, and giving every row
    // its own copy would put 200 duplicates in the payload where the
    // duplication is exactly what this exists to remove. Both are imported from
    // fp.ts at the top of this file, so there is no copy here either.
    //
    // ── WHICH MARGIN GOVERNS WHICH CASE. CORRECTED 2026-08-03 (item 223) ─────
    //
    // THIS DOCSTRING USED TO SAY "whether you are standing AT it is
    // `d < r + REACH_MARGIN`", AND THAT PREDICATE NO LONGER EXISTS. It was true
    // when the margin was published and it stopped being true when `pickSpot`
    // was retuned on the user's *"i feel like i select stuff without even
    // looking at it"* — the aim-free pass was cut to a quarter of the old slack
    // and `fp.ts` has read `const touching = d < s.r + TOUCH_MARGIN` since. A
    // published constant with a stale docstring is worse than an unpublished
    // one: `casinodoor.mjs` predicted a 3.11 m band on this file's authority,
    // the world gave 2.13 m, and the script was right to disbelieve the comment.
    //
    // As the code stands (fp.ts `pickSpot`), for a STANDING player:
    //
    //   aim-free ("touching")   `d < r + TOUCH_MARGIN`   — fp.ts's `touching`
    //   aimed     ("looked")    `d < reach (6 m)` and inside `lookTolerance`
    //                            — NO margin term at all
    //
    // So REACH_MARGIN governs exactly two things now, and neither is the one
    // its name suggests: the SEATED clause (`!seated || d < s.r + RADIUS +
    // REACH_MARGIN`, which can only ever shorten the seated reach) and the outer
    // ring the debug volume overlay draws. Anything asking "would this spot be
    // offered to a player standing here, not looking at it" wants
    // `touchMargin()`.
    //
    // ⚠ THE `+ RADIUS` IS PART OF THE PREDICATE — item 289, `fp.ts:1236`. `d`
    // runs from the player's CENTRE to the spot's centre, so a bound of
    // `s.r + REACH_MARGIN` charges a seated player the width of his own chest;
    // it cost the bank's loan officer 7 cm. Reconstructing the seated reach from
    // `reachMargin()` alone therefore under-reports it by RADIUS, which is
    // published two entries below as `playerRadius()`.
    reachMargin: () => REACH_MARGIN,
    // …AND THE ONE THAT ACTUALLY GOVERNS AN UNAIMED PLAYER, published for the
    // first time here (item 223). It was exported from fp.ts and unreachable at
    // runtime, so a harness had two choices and both are on the record:
    // hand-copy `0.15` (`probes/w47-band-model.mjs:25`), or `await
    // import('/src/proto/fp.ts')` inside the page — which SEVEN harnesses do and
    // which works on the dev server ONLY. Measured against `vite preview` on the
    // built bundle: `Failed to fetch dynamically imported module:
    // /src/proto/fp.ts` (`scripts/probes/w80-touchmargin-reachable.mjs`). So on
    // the bundle the user actually ships, this number had no runtime path at all
    // — and GOTCHAS 28 says the bundle is where a check must be believed.
    touchMargin: () => TOUCH_MARGIN,
    // THE PLAYER'S OWN COLLISION RADIUS, published for item 170. A check that
    // asks "can somebody walk past this without brushing it" is asking about the
    // width of the person, and `RADIUS` was reachable only by hand-copying 0.36
    // — which `scripts/w40-bed-vs-door.mjs:117` names as the exact habit
    // BUILDER-BRIEF §8 exists to stop, and which the ONE runtime alternative,
    // `await import('/src/proto/fp.ts')`, cannot supply on the built bundle
    // (item 223 measured that import 404ing against `vite preview`).
    //
    // `ct/park.ts` derives every bench's clearance from RADIUS + TOUCH_MARGIN;
    // `scripts/bench-clearance.mjs` re-derives the same figure from these two
    // published values rather than from the module it is judging, so re-tuning
    // the player moves the world and the guard together and neither can drift
    // into agreeing with itself.
    playerRadius: () => RADIUS,
    /** THE WORLD-WIDE REACH TRIM AND THE DISC IT PRODUCES (item 309).
     *
     *  ⚠ A HARNESS THAT REBUILDS THE AIM-FREE PREDICATE FROM `touchMargin()`
     *  ALONE IS NOW WRONG BY 20%, and this is the third time a published
     *  constant has outlived the predicate it described (see `reachMargin`
     *  above, which `casinodoor.mjs` believed to the tune of a metre). The
     *  predicate as it stands, for a STANDING player, is
     *
     *      touching = d < (s.r + TOUCH_MARGIN) * REACH_TRIM
     *      onIt     = d < ON_IT                   // = RADIUS * REACH_TRIM
     *
     *  so anything asking "would this be offered to a player standing here, not
     *  looking at it" wants `reachTrim()` as well as `touchMargin()`.
     *
     *  `onItRadius` is published SEPARATELY from `playerRadius` above rather
     *  than derived by the caller, because the two were one number until item
     *  309 and every script that reconstructed the resolver's tier 1 read
     *  `RADIUS`. They are different facts now: one is how wide the man is, the
     *  other is how close he has to be. */
    reachTrim: () => REACH_TRIM,
    onItRadius: () => ON_IT,
    /** THE LOOK CONE, as a number — `lookTolerance(r, d)` in radians (item 237).
     *
     *  The margins above are constants; this is the one part of the selection
     *  rule that is a FUNCTION, and it is the part two workers got wrong by
     *  retyping. `lookTolerance` clamps `atan2(r, d)` between `LOOK_FLOOR` and
     *  `LOOK_CEILING`, and BOTH previous hand-copies read the value BEFORE the
     *  clamp — `notes/ninetytwo-item98-the-plateau-is-the-clamp.md` §2 — which
     *  inverted item 98's premise and cost it a release. A harness cannot get
     *  this right by copying, because the answer is 25.0° at 2 m and 11.3° at
     *  6 m for the same spot: it is not a number you can write down once.
     *
     *  NUMBERS IN, A NUMBER OUT — the `painted()` precedent. Nothing about the
     *  world is reachable through it, so it is read-only by construction rather
     *  than by a defensive copy.
     *
     *  `LOOK_CEILING` IS THE USER'S OWN DECISION (25°, 2026-08-03). This hook
     *  exists so a harness reads whatever he last chose rather than whatever it
     *  was typed at. */
    lookTolerance: (r: number, d: number) => lookTolerance(r, d),
    /** THE RESOLVER ITSELF, asked of the world's own spot list (item 237).
     *
     *  `scripts/probes/w40-resolver-map.mjs` is the blast-radius differ for any
     *  change to `pickSpot`'s tiering, and it could only run by doing
     *  `await import('/src/proto/fp.ts')` in the page — which resolves on the
     *  dev server and **404s on `vite preview`**, so the one instrument that
     *  says whether a selection change moved the world could not be pointed at
     *  the bundle the user ships (GOTCHAS 28). It did not fail softly either:
     *  it threw an uncaught `Failed to fetch dynamically imported module` and
     *  measured nothing at all.
     *
     *  RESULT NUMBERS, NOT THE SPOT — `citAvoid()`'s reasoning. `pickSpot`
     *  returns the live `Spot` object, whose `label` and `ok` are thunks closing
     *  over world state; handing that to a probe is handing it a lever on the
     *  world. What comes back instead is the spot's INDEX into `spots()` (so a
     *  caller can join the two), its evaluated label, its geometry, and the
     *  three tier numbers the resolver decided on.
     *
     *  LINE OF SIGHT IS DELIBERATELY NOT APPLIED, and this is a limit rather
     *  than an oversight. The `visible` callback in `update()` raycasts from the
     *  PLAYER'S EYE, so it can only answer for the pose the player is actually
     *  standing in — while the whole point of this hook is to ask about poses
     *  the player is not in. Supplying it for an arbitrary `view` would answer a
     *  different question and look like the same one. `w40-resolver-map.mjs`
     *  already omitted it on purpose ("a FILTER applied before any tiering…
     *  leaving it out widens the candidate set"); live-prompt truth, sight
     *  included, is what `w40-bed-vs-door.mjs` reads off `#ct-prompt`.
     *
     *  THE PREDICATES ARE UNTOUCHED. This calls `pickSpot` with the same
     *  `SPOTS`, the same default reach of 6 and the same `opts.seated` shape the
     *  frame loop uses; it is a window onto the resolver, not a second copy of
     *  it. */
    pickSpot: (
      view: { x: number; z: number; yaw: number; pitch?: number },
      opts?: { reach?: number; seated?: boolean },
    ) => {
      const won = pickSpot(
        SPOTS, { x: view.x, z: view.z, yaw: view.yaw, pitch: view.pitch ?? 0 },
        opts?.reach ?? 6, undefined, opts?.seated ? { seated: true } : undefined,
      );
      if (!won) return null;
      return {
        // INDEX INTO `spots()`, which is `SPOTS.map(...)` and therefore the same
        // order — that is the join a caller needs, and it is the identity the
        // live object cannot carry across `page.evaluate`.
        index: SPOTS.indexOf(won.spot),
        label: won.spot.label(), x: won.spot.x, z: won.spot.z, r: won.spot.r,
        looked: won.looked, offAxis: won.offAxis, dist: won.dist,
      };
    },
    // The acceptance test for the selection highlight, asked of the WORLD rather
    // than of a copy of it: every registered [E], whether it names an object,
    // and therefore whether its outline is the real contour or the generic
    // fallback box. A parity check that kept its own list of doors would be
    // testing the list.
    highlightParity: () => SPOTS.map((sp) => ({
      label: sp.label(),
      // A spot draws an outline if and only if it DECLARED its object. There is
      // no fallback any more: drawing the trigger volume is what put a wireframe
      // cube on the floorboards.
      outlined: spotOutline.resolves(sp),
      contoured: spotOutline.resolves(sp),
    })),
    seats: () => SEATS,
    camY: () => cam.position.y,
    yaw: () => rig.yaw,
    // test affordance: read the floor picker directly, without moving anybody
    // — and "without moving anybody" is now literally true. This used to
    // commit the answer as the player's storey, so a probe asking about the
    // road while standing on the pavement moved the player's own bookkeeping
    // to road level for one frame.
    groundAt: (x: number, z: number) => groundPick(x, z),
    // test affordance: the rectangle `fp.ts` CLAMPS the player into — the same
    // object it was handed, never a restatement of it. A containment sweep has
    // to know where the world is allowed to end, and until this existed its
    // only options were to retype `-110.6` or to infer the edge by walking at
    // it, which finds a collider long before it finds the clamp nearly
    // everywhere. Read-only on purpose: nothing may move the world's edges from
    // a probe.
    bounds: () => ({ ...WORLD_BOUNDS }),
    seated: () => (rig.seated ? rig.seatedOn : null),
    /**
     * IS A SCREEN HOLDING THE CAMERA, AND HAS IT FINISHED MOVING? `null` when
     * nothing is focused.
     *
     * THE ONE LINE BEHIND 89 PHANTOM SEAT FAILURES (item 263). `seats-walk.mjs`
     * models a plain chair in all five of its legs — sit, face, lock, eye
     * height, `[E] stand up` — and a slot stool is not a chair: it seats you
     * and hands the machine its overlay, whose way out is ESCAPE. With this
     * state unpublished a harness could not tell the two apart, so **every
     * machine station in `__ct.seats()` failed at whichever leg it reached
     * first**, and the count only ever moved from one leg to another: 83
     * identical 0.350 m "seated eye" errors became 89 identical "no stand up"
     * errors when the eye read was fixed. The honest defect count under those
     * was 26, and it was quoted as 109 all week.
     *
     * The second half is `t`. The fly-in is an EASE (`FOCUS_IN`, 0.40 s), so a
     * probe that samples on a fixed sleep is reading a camera mid-animation and
     * calling the result a seat defect — which is exactly what happened. `t`
     * and `settled` let it wait for the world to stop moving instead of
     * guessing when it has (GOTCHAS 30).
     *
     * NUMBERS AND A COPY, NEVER THE LIVE OBJECT — the house style beside
     * `citAvoid()`, `party()` and `painted()`, and for the same reason: a probe
     * must not be able to reach through a test hook and move the camera, the
     * chair or the mesh. `mesh` is published as its NAME; every field here
     * survives `page.evaluate`'s serialisation, which a `THREE.Object3D` does
     * not.
     */
    focus: () => (focus
      ? {
          /** 0 → 1 over FOCUS_IN seconds. Leaving is instant, so there is no
           *  outward equivalent — `null` is the whole of "not focused". */
          t: +focus.t.toFixed(4),
          settled: focus.t >= 1,
          /** the screen being read, by name rather than by reference */
          mesh: focus.mesh.name || '(unnamed)',
          /** TRUE when the player was ALREADY SEATED when this screen opened —
           *  a machine station (slot stool, ATM chair, loan desk), as against a
           *  screen someone walked up to standing. This is the discriminator a
           *  seat harness needs: `[E] stand up` is not what this seat offers. */
          fromChair: focus.chair !== null,
          /** where the ease is taking the eye, in world metres */
          eye: { x: focus.to.pos.x, y: focus.to.pos.y, z: focus.to.pos.z },
          yaw: focus.to.yaw, pitch: focus.to.pitch, fov: focus.to.fov,
          /** and where it stops the FEET, which is not the same point — a
           *  person leans in to read a screen and their shoes do not follow */
          feetX: focus.to.feetX, feetZ: focus.to.feetZ,
        }
      : null),
    stand: () => rig.stand(),
    // Test affordance, and the missing half of `stand()` — which has been
    // published since the seat mechanic shipped, while the only way IN was to
    // walk up to a seat and press E.
    //
    // That asymmetry is why nothing had ever asked all 219 seats what they offer
    // a player sitting on them: the question costs one warp-and-press per seat,
    // ten minutes a run, so it got asked of a handful and generalised from. Item
    // 188 turns the seated `[E]` into a real contest, and the only honest
    // acceptance test for that is the whole population
    // (`scripts/probes/w69-seated-offers.mjs`).
    //
    // It goes through `rig.sit`, so it inherits the guard that a seated player
    // cannot hop to another seat; a caller that wants to move must `stand()`
    // first, exactly as a player must.
    sit: (pose: { x: number; z: number; yaw: number; h: number }) => rig.sit(pose),
    scene: () => scene,   // test affordance: structural fingerprinting (scripts/scenedump.mjs)
    camera: () => cam,    // test affordance: raycast a screen pixel back to the mesh under it
    // test affordance: turn the region cull off, so a check can render the SAME
    // station both ways and compare. An A/B that has to compare two BUILDS is
    // comparing two worlds; this compares two frames of one.
    cullRegions: (on: boolean) => { regionCullOn = on; },
    // …and read its state back, because "nothing was hidden" and "the cull is
    // off" produce the same picture and must not produce the same reading.
    cullInfo: () => ({ on: regionCullOn, hiding: exteriorHidden,
      classified: regionKids ? regionKids.length : -1, topLevel: scene.children.length }),
    /**
     * HAS THE RENDERER ACTUALLY DRAWN ANYTHING YET? `null` until it exists.
     *
     * GOTCHAS 78 says to wait for "something the RENDERER has done" before
     * shooting, and then every probe in this tree waits on `afterFrames`, which
     * is **rAF ticks** — and rAF fires whether or not `renderer.render()` was
     * called. Worker sixtyone shot the built bundle after the prescribed wait
     * and got **8 solid black frames** while the same bundle's scene graph read
     * perfectly; the first genuinely drawn frame did not arrive until 1136 ms.
     * A probe that shoots on a frame count photographs the void and files it as
     * evidence, and "I looked at the screenshot" is the only proof we have for
     * the items where looking is the point.
     *
     * The cause is one line above this object: `__ct` is assigned inside
     * `make()`, and `configure(r)` — which is where `renderer` arrives — is
     * called by `src/main.ts` AFTERWARDS, with the first `frame()` after that.
     * So `window.__ct` existing is a statement about this file, not about the
     * screen. `renderer.info.render.frame` is a statement about the screen: it
     * is incremented by three inside `render()` and by nothing else.
     *
     * THE NUMBERS, NOT THE RENDERER. The item asked to publish `renderer`, and
     * publishing the object itself would be useless to the callers it is for:
     * every probe reads this through `page.evaluate`, which serialises, and a
     * `WebGLRenderer` does not survive that in any form you can assert on. So
     * this publishes what a probe can actually compare — the same shape as
     * `cullInfo()` and `busInfo()` beside it.
     *
     * `triangles` matters as much as `frames`: a render call that drew nothing
     * advances the counter and still leaves a black screen, so the honest wait
     * is "frames advanced AND geometry went through". `scripts/lib/painted.mjs`
     * does both; use it rather than reading this by hand.
     */
    painted: () => (renderer
      ? { frames: renderer.info.render.frame,
          triangles: renderer.info.render.triangles,
          calls: renderer.info.render.calls }
      : null),
  };

  return {
    key: 'crosstown', name: 'CROSSTOWN ’97',
    feel: 'The small world — one hand-made street. We grow it from here.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.NoToneMapping;
      r.shadowMap.enabled = false;
      // kept so a diegetic screen can turn a page-space pointer into a ray —
      // the canvas's own rect is the only honest source for that mapping
      renderer = r;
    },
    update(dt, t, input) {
      // LOOK IS LOCKED WHILE A SCREEN IS UP, and it is locked HERE rather than
      // in fp.ts: the rig applies mouse deltas before its own seated branch, so
      // a seated player can still turn their head — right for a bench, wrong
      // for a machine you are reading. Dropping the delta before the rig sees
      // it also frees the mouse to be a POINTER, which is the whole request.
      if (focus) { input.mouseDX = 0; input.mouseDY = 0; }
      rig.update(dt, input);
      // …and the lock gets the last word on the camera, after the rig has had
      // its say and before anything reads the finished view.
      stepFocus(dt);
      // smooth toward the scroll target rather than stepping per notch — a
      // ~0.1 s time constant so it reads as eased zoom, not a slide show.
      //
      // NOT WHILE A SCREEN IS UP: `stepFocus` owns the fov then, and these two
      // were pulling against each other every frame — the lock setting 60° and
      // this dragging it back toward the resting 88°, meeting at a stable 66°
      // that looked like an ease which had not finished. Two owners of one
      // number, which is the same fault shape as the ATM palette this file's
      // neighbours already carry a follow-up for. The lock wins while it is on;
      // `leave()` hands the fov straight back to `fovTarget`.
      if (!focus && Math.abs(cam.fov - fovTarget) > 0.01) {
        cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 10);
        cam.updateProjectionMatrix();
      }
      const px = rig.pos.x, pz = rig.pos.z;

      // the clock: one real second is one game minute
      totalMin += dt;
      // …plus any ramped advance somebody asked for. Drained at a bounded rate
      // so a sleep sweeps the night curve rather than cutting through it.
      if (clockRamp > 0) {
        const slice = Math.min(clockRamp, clockRampRate * dt);
        totalMin += slice;
        clockRamp -= slice;
        if (clockRamp <= 0.001) { clockRamp = 0; clockRampRate = 0; }
      }
      const clockMin = totalMin % 1440;
      const hourF = clockMin / 60;
      const skyCol = hud.skyAt(hourF);
      props.rainSky(skyCol); // rain flattens the light
      (scene.background as THREE.Color).copy(skyCol);
      const night = hud.nightAt(hourF);
      hud.setNight(night);
      // streetlamps warm up on the same night curve (0 by day, full at deep night)
      const lampNight = THREE.MathUtils.clamp((night - 0.03) / 0.28, 0, 1);
      props.setLampNight(lampNight);
      // and the flats above the shops light up on a curve of their own — the
      // block keeps people's hours, not the sun's (ct/street.ts owns the shape)
      street.setWindows(hourF);
      // Fog goes DARKER than the sky once the sun is down. By day it matches,
      // so the street simply fades into the haze; after dark, distance falling
      // toward black instead of toward the sky grey gives depth down the block
      // for free — the far end reads as unlit rather than as bright haze.
      scene.fog!.color.copy(skyCol).multiplyScalar(1 - 0.5 * lampNight);
      // ── registered per-frame hooks ────────────────────────────────────
      // Modules register these; this loop does not know what any of them are.
      // Sorted by declared ORDER at build time, so run order is a property of
      // the hook, not of where the module happened to be constructed.
      const frame: Frame = {
        dt, t, px, pz, gy: apt.gy(),
        hourAbs: Math.floor(totalMin / 60), hourF, night,
        // props.ts owns the drying model and publishes the result here each
        // frame; this reads it rather than keeping a second copy, so there is
        // still exactly one writer.
        wet: (scene.userData.wetness as number | undefined) ?? 0,
      };
      for (const h of HOOKS) h.fn(frame);
      // look down: your watch — BUT NOT WHILE A CABINET IS UP.
      //
      // `poseFor` takes the eye along the target face's own NORMAL. For a
      // screen bolted to a wall that normal is horizontal and the player ends
      // up level; for a form lying on a desk it points STRAIGHT UP, so reading
      // it means looking down — and looking down is the exact gesture that
      // raises the watch. Worker sixtysix photographed the result while
      // building the loan (item 185): its first SIGN box sat behind a
      // wristwatch. The ATM, slots and blackjack are all VERTICAL surfaces,
      // which is the only reason this went four panels without being seen.
      //
      // You are reading a document, not checking the time, so the watch stands
      // down. Same shape and same reasoning as `hud.prompt`, which already
      // silences itself on `panelUp()` for the double-caption overlap.
      //
      // WHY THIS ALSO ANSWERS "does it come back on every close path". It is
      // not an event and it does not need to be: this is a per-frame RECOMPUTE
      // of `want`, so the frame after `livePanel` clears — however it cleared,
      // by [E], by Escape, by the ATM's own farewell timeout, or by a future
      // panel that closes itself in a way nobody has written yet — the watch
      // slides back if the player is still looking down. There is no close
      // path to miss because no close path is enumerated.
      hud.watch(rig.pitch < WATCH_PITCH && !panelUp(), Math.floor(clockMin));
      // right-click: flip the wallet out / away
      const rmb = input.keys.has('rmb');
      if (rmb && !rmbHeld) hud.toggleWallet();
      rmbHeld = rmb;
      // V: toggle the collision debug view. Edge-triggered like rmb/E just
      // above, so holding it down does not flicker the overlay on and off.
      const debugKeyDown = input.keys.has('v');
      if (debugKeyDown && !debugCollisionKeyHeld) debugCollision = !debugCollision;
      debugCollisionKeyHeld = debugKeyDown;
      // F: toggle the frame-rate readout. The user: *"i get awful performance
      // drops in my room not sure why. can we also get an fps counter?"*
      //
      // OFF BY DEFAULT AND TOGGLED, not a permanent corner overlay — he had the
      // standing HUD text removed (*"get rid of the overlay descriptions here,
      // controlls and all"*) and a number nailed to the screen forever is that
      // same complaint wearing a different hat. Same edge-trigger and the same
      // reasoning as V beside it: a diagnosis tool, not a player feature.
      //
      // It reports the WORST frame in the last second as well as the mean,
      // because his report is *drops* — an average hides exactly the thing he
      // is asking about.
      const fpsKeyDown = input.keys.has('f');
      if (fpsKeyDown && !fpsKeyHeld) { showFps = !showFps; hud.setFps(showFps ? fpsText : null); }
      fpsKeyHeld = fpsKeyDown;
      if (showFps) {
        fpsCount++; fpsAccum += dt; fpsWorst = Math.max(fpsWorst, dt);
        if (fpsAccum >= 0.5) {
          const mean = fpsCount / fpsAccum, low = 1 / fpsWorst;
          fpsText = `${mean.toFixed(0)} fps   worst ${low.toFixed(0)}`;
          hud.setFps(fpsText);
          fpsCount = 0; fpsAccum = 0; fpsWorst = 0;
        }
      }
      // E: nearest live spot wins; with nothing near, E feeds the birds
      //
      // It said "nearest" and did FIRST-REGISTERED — the loop broke on the
      // first spot in range, so with two triggers overlapping you got whichever
      // module happened to build earlier, however far away it was. Three cases
      // were live: standing exactly on the second of two diner booths offered
      // the first, 0.67 m away, and the bus stop bench did the same at 0.9 m.
      // You walk to a seat, press E, and sit down in the one next to it.
      //
      // Found by asking whether any two spot radii overlap at all (171 pairs
      // do; all but three are a seat and its own "stand up", which are
      // mutually exclusive through ok()). Kept as an assertion in
      // scripts/seats-walk.mjs: stand ON a seat, and that is the seat offered.
      // SELECTION BY LOOKING as well as by standing, with an outline so you can
      // see WHICH thing you have. *"the door for instance to my apt should be
      // easy to open and close when looking at or by the door frame or the door
      // itself."*
      //
      // The rule this replaces was proximity only, nearest-in-metres wins, so a
      // spot was reachable from inside one small circle and never because you
      // faced it. Measured at the No. 227 door: r 1.05, and standing at the
      // frame is 1.15 m away — outside it. That is the "one magic square".
      //
      // Prompt and outline both read the same `picked`, so the thing framed is
      // always the thing that fires.
      // LINE OF SIGHT — an [E] must be visible from where you stand. A wall, a
      // door, a counter, a shelf, a car or a slot bank between you and it means
      // it is not selectable, with no exceptions by type: the test is the real
      // scene geometry, so a spot near something nobody thought of cannot leak.
      //
      // Aimed at 1.1 m above the spot's own ground rather than at the spot
      // itself, and that height is the whole trick. A ray along the floor is
      // blocked by the TABLE in front of a chair, which would make every seat at
      // a table unselectable; at chest height it clears the table and is still
      // stopped by anything that is actually a wall.
      //
      // Lines are skipped so the debug volume cannot occlude the world, and the
      // held watch and wrist are DOM rather than scene, so they never can.
      // everything re-arms once you have stepped away from where you arrived
      if (landing && Math.hypot(px - landing.x, pz - landing.z) > LATCH_CLEAR) landing = null;
      // THE EYE IS ON WHATEVER STOREY THE PLAYER IS, and this line was 1.6
      // flat, which killed every `[E]` above the ground floor.
      //
      // The aim has always been storey-aware — `groundPick(s.x, s.z) + 1.1` —
      // so at room 301's door the ray was cast from 1.6 m, INSIDE THE GROUND
      // FLOOR, up to 6.5 m at the spot, through the slabs at 2.7 and 5.4 on the
      // way. `canSee` returned false and the prompt simply never appeared:
      // nothing threw and nothing logged. You could not open your own apartment
      // door in the live world. Found by C (notes/C-los-storey.md), whose 301
      // item it was blocking, with the patch already tested.
      //
      // It survived because 425 of 431 interior spots sit at gy 0, where 1.6 is
      // correct — and because MY OWN CHECKS COULD NOT SEE IT. Their occlusion
      // oracle copied this constant from this line, so it agreed with the bug
      // and skipped every upper-floor spot as "no clear line" instead of
      // failing. An oracle that shares the implementation's assumptions is not
      // independent about those assumptions; it is only independent about the
      // code path. lib/D-see.mjs now takes the eye height from the caller.
      const eye = new THREE.Vector3(px, apt.gy() + 1.6, pz);
      const aim = new THREE.Vector3();
      const seeRay = new THREE.Raycaster();
      // Retake every sight line when the eye has actually moved, when he has
      // changed storey, or when the newest answer has gone stale. `apt.gy()` is
      // in the key because the eye is `gy + 1.6`: a lift or a stair changes what
      // is between him and a spot without moving him in x/z at all.
      const gyNow = apt.gy();
      if (Math.abs(px - seeAtX) > SEE_MOVE || Math.abs(pz - seeAtZ) > SEE_MOVE
        || gyNow !== seeAtGy || t - seeAtT > SEE_TTL) {
        seeCache.clear();
        seeAtX = px; seeAtZ = pz; seeAtGy = gyNow; seeAtT = t;
      }
      const canSee = (s: Spot) => {
        if (landing) return false;                    // just arrived here; take a step first
        // Memoised on the key above. `landing` stays OUTSIDE the cache: it is
        // cleared by a 1.2 m step, which is eight times SEE_MOVE, so a cached
        // `false` could otherwise outlive the arrival that caused it.
        const memo = seeCache.get(s);
        if (memo !== undefined) return memo;
        const v = seeRaw(s);
        seeCache.set(s, v);
        return v;
      };
      const seeRaw = (s: Spot) => {
        // A PURE READ, and it has to be: this runs once per candidate spot,
        // every frame, at coordinates that are not the player's. While it
        // committed, `apt.gy()` ended each frame describing the last spot the
        // aimer looked at rather than the ground under the player's feet.
        aim.set(s.x, groundPick(s.x, s.z) + 1.1, s.z);
        const dir = aim.clone().sub(eye);
        const dist = dir.length();
        if (dist < 0.45) return true;                 // standing on it
        seeRay.set(eye, dir.normalize());
        seeRay.far = dist - 0.35;                     // stop short: the thing itself is not a blocker
        for (const h of seeRay.intersectObject(scene, true)) {
          const o = h.object as THREE.Mesh;
          if (!o.isMesh || !o.geometry) continue;     // lines, sprites, the debug volume
          const m = o.material as THREE.Material;
          if (m && m.visible === false) continue;
          return false;                               // something solid is in the way
        }
        return true;
      };
      // SEATED IS A DIFFERENT PICK, NOT A SUPPRESSED ONE.
      //
      // *"you sit and its the loan process as an integrated overlay"*, and of
      // the library terminal *"like the atm too. intergrated overlay. realistic
      // setup"* — a PC is a thing you SIT at. Until this line, **no seat in this
      // world could carry an interaction you use while sitting on it**; the
      // limit is written down at `ct/int-bank.ts:1414`, found by walking, and it
      // is why the loan is transacted standing in a room that has a chair for
      // you.
      //
      // The cause named there — *"the stand-up spot is registered at the seat
      // itself, so while you are seated it is at d 0"* — WAS true and is no
      // longer: the exit stopped being a spot when it became a state exit (see
      // `ctx.seat`). What replaced it is this file, right here: the dispatch
      // below simply did not consult `picked` at all while seated. So the engine
      // limit was one `if`, in crosstown.ts, not a scoring bug in fp.ts.
      //
      // `{ seated: true }` turns off the aim-free proximity pass and shortens
      // reach to the spot's own `r + REACH_MARGIN` — fp.ts's `opts.seated` has
      // the derivation. Standing, the call is byte-for-byte the one that was
      // here before.
      const picked = pickSpot(SPOTS, { x: px, z: pz, yaw: rig.yaw, pitch: rig.pitch },
        6, canSee, rig.seated ? { seated: true } : undefined);
      const active: Spot | null = picked ? picked.spot : null;
      // THE EXIT NEVER LEAVES THE SCREEN. It used to be the whole seated prompt,
      // for a reason that still holds — *"the label must not be able to
      // disappear while the key that works is still E. A state with an invisible
      // exit reads as being stuck"*. So when a seated player is aimed at
      // something, the exit is not replaced, it is JOINED: the object takes `[E]`
      // and standing up is named on the same line under `[ESC]`, which is the
      // key `fp.ts` honours unconditionally from two independent listeners and
      // which therefore cannot be taken away by anything on offer here.
      const exit = rig.seated ? (SEAT_EXIT.get(rig.seatedOn!) ?? 'stand up') : null;
      hud.prompt(exit
        ? (active ? `[E] ${active.label()}   ·   [ESC] ${exit}` : `[E] ${exit}`)
        : (active ? `[E] ${active.label()}` : null));
      spotOutline.show(scene, debugSpots ? active : null);
      // E dispatch (edge-triggered)
      const feedDown = input.keys.has('e');
      if (feedDown && !feedHeld) {
        if (rig.seated && !active) {
          // STANDING UP IS THE FALLBACK, AND THE FALLBACK IS THE DEFAULT.
          //
          // This used to be unconditional, on the grounds that standing up is a
          // state exit rather than a world interaction. That is still true of
          // the STATE — Escape stands you up from anywhere, through two
          // independent listeners in fp.ts, and nothing here can reach that. It
          // was not true of the KEY, and paying for it with `[E]` is what made a
          // seat a dead end: sit down and the only verb left in the world is
          // getting back up.
          //
          // So `[E]` is spent on what you are aiming at IF the seated pick found
          // anything — which needs real aim and arm's length, so it is empty
          // almost everywhere — and otherwise on standing up, exactly as before.
          // Look away from the desk and you get your seat back. Measured across
          // all 219 registered seats before this landed; see the handoff.
          rig.stand();
        } else if (active) {
          // LATCH ONLY WHAT MOVED YOU. The hysteresis is for TRANSITIONS — a
          // door that just put you somewhere else must not immediately pull you
          // back. Latching every spot would break the ones you use repeatedly
          // from where you stand: the ATM would stop offering "check balance"
          // after one press until you walked away from it, and a seat would
          // stop offering "stand up".
          //
          // So the test is what actually happened, not what kind of thing it
          // was: if the act moved the player more than a stride, it was a
          // transition and the spot is held off until they clear its volume.
          const wasX = rig.pos.x, wasZ = rig.pos.z;
          active.act();
          // a TRANSITION is an act that moved you. Only those latch: latching
          // everything would stop the ATM re-offering "check balance" after one
          // press, and a seat re-offering "stand up".
          //
          // ── AND ONLY IF YOU STILL HAVE LEGS TO CLEAR IT WITH (item 283) ──
          //
          // THE ARM CONDITION IS A DISTANCE; THE CLEAR CONDITION IS A WALK.
          // That asymmetry is the whole bug. `landing` is discharged by exactly
          // one thing — the per-frame `> LATCH_CLEAR` test above, which reads
          // the player's own x/z — and `fp.ts`'s seated branch returns before
          // any movement is integrated. So a seated player's x/z is frozen at
          // the seat, and a latch armed by SITTING DOWN can never discharge:
          // `canSee` is false for every spot in the world until you stand.
          //
          // That is not a hypothetical. `ctx.seat` lets a seat declare an
          // `approach` away from the pose — the bank's client chair is taken
          // from its right so the player does not stand on the loan officer
          // (`ct/int-bank.ts:1421`) — and `hypot(1.10, 0.25) = 1.13 m` clears
          // LATCH_ARM by 13 cm. Measured on the built bundle: 2 of 219 seats
          // are over the line ("sit in the client chair", "sit in the shelter"),
          // and in both the seated `[E]` item 188 landed was dead on arrival.
          // The user asked for that chair by name — *"you sit and its the loan
          // process as an integrated overlay"* — so it was dead exactly where
          // he was going to look for it.
          //
          // NOT FIXED BY MOVING EITHER NUMBER. Raising LATCH_ARM past 1.13
          // rescues these two seats and breaks at the next `approach` somebody
          // writes; lowering it arms the latch on more of them. The defect is
          // that a latch whose only discharge is locomotion was being armed on
          // a player who cannot locomote, so the guard is that condition
          // itself, derived from `rig.seated` rather than from any distance.
          //
          // Safe to read `rig.seated` AFTER the act rather than before: the act
          // is what changes it, and both directions come out right. Sit down —
          // still seated, no latch, which is the fix. Use something from a
          // chair that stands you up and moves you (item 188 made that
          // reachable) — not seated, latch arms, exactly as a door does. And
          // `landing` is provably null on entry here, because `canSee` gates
          // `picked`, so this cannot be masking an older latch.
          if (!rig.seated && Math.hypot(rig.pos.x - wasX, rig.pos.z - wasZ) > LATCH_ARM) {
            landing = { x: rig.pos.x, z: rig.pos.z };
          }
        } else if ((purse.inv.CEREAL ?? 0) > 0 && px < 100) {
          purse.inv.CEREAL--;
          props.scatter(px + Math.sin(rig.yaw) * 1.3, pz - Math.cos(rig.yaw) * 1.3, apt.gy());
          hud.refreshWallet();
        }
      }
      feedHeld = feedDown;

      // billboards face the player
      //
      // …and may also POSE for where the player is. The loop already walks
      // every board once a frame with the player's position, which is exactly
      // what a pose test needs, so a board can carry one instead of each
      // module threading its own per-frame hook down from here. ct/cat.ts is
      // the first user — she looks up when you stand over her — and the
      // pigeons below hand-roll the same idea already.
      //
      // The cast is because `pose` is not on `Board` yet and `ct/ctx.ts` is not
      // mine; the field belongs there properly. Bounded desk mandate covers
      // these two lines and nothing else in this file.
      const py = rig.pos.y;
      for (const b of boards) {
        b.m.rotation.y = Math.atan2(px - b.m.position.x, pz - b.m.position.z);
        (b as { pose?: (x: number, z: number, y: number) => void }).pose?.(px, pz, py);
      }
      // the crowd walks itself and the traffic drives itself — ct/crowd.ts and
      // ct/traffic.ts each register a LATE frame hook
      // pigeons: peck, chase scattered cereal, spook when approached
      props.updatePigeons(dt, t, px, pz);
      // COLLISION DEBUG VIEW — see ct/debug-collision.ts. Last in the frame so
      // it draws over a settled world; costs nothing when debugCollision is
      // false (the ColliderDebug instance builds no geometry until the first
      // `on: true` call, and tears it down again the moment it goes false).
      colliderDebug.update(scene, colliders, apt.gy(), { x: px, z: pz, radius: RADIUS }, debugCollision, actorBoxes);
      // REGION CULL, LAST IN THE FRAME AND FOR THAT REASON. Every hook above
      // has now had its say about what is visible, including the three modules
      // that write `visible` on their own top-level objects every frame; this
      // gets the final word, the same way the focus lock gets the last word on
      // the camera at the top of this function. See the block by `__ct`.
      regionCull(px);
    },
    dispose() {
      // the zoom listener is added once per `makeCrosstown()` call; `main.ts`
      // rebuilds a fresh world (and a fresh `cam`) on every load, so a stale
      // one left behind would double up the zoom on the next load instead of
      // just leaking — remove it, not just the objects it closed over.
      window.removeEventListener('wheel', onWheel);
    },
  };
}

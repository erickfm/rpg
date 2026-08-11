import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild, Spot } from './ctx';
import type { Panel } from './hud';
// `ct/hours.ts` — the ONE table the whole street reads. See `hoursBlocks()`:
// that book is GENERATED from this import rather than retyped. Safe as a
// runtime edge for the reason `hours.ts`'s own header states: it imports
// nothing at runtime and so cannot close the glob cycle GOTCHAS §28 warns of.
import { HOURS, fmtHour } from './hours';
// TYPE-ONLY, for the reason `ct/library-pc.ts` gives in its own header: this
// module builds NO geometry and constructs no three object — it reads a mesh
// `ct/int-library.ts` already put in the room — so it needs the TYPES and
// nothing else, and `import type` is erased entirely. A runtime `three` edge
// here would reseed the world's dither grain (GOTCHAS §2, §75).
import type * as THREE from 'three';

// ══ THE REFERENCE SHELF — THE ONE PLACE THIS WORLD EXPLAINS ITSELF ══════════
//
// *"make this an e prompt for read and have it direct to a diegetic view of the
//  books. i want it to contain info on the stats like int str, etc. explain how
//  the game works and everything in various different books … the information
//  can be quite specific and should serve as a guide. like hours on all the
//  shops, what int you need how to get more int how to get more str and dex
//  what dex affects how to run, etc etc. basically anything you can think of
//  thats useful info. the rest of the game will not hand hold or provide
//  guidance. this is the one spot players can turn to as a repository of
//  information."*   (2026-08-11, on the returns trolley in the library)
//
// ⚠ EVERY NUMBER ON THESE PAGES WAS READ OUT OF THE SOURCE, and the file it
// came from is named in a comment beside the block that prints it. Nothing else
// in the world tells the player any of this, so a wrong figure here is worse
// than a blank page — there is no second source to correct it. **If you change
// a mechanic, the sentence in here that describes it is part of the change.**
//
// FOUR PLACES WHERE THE SOURCE'S OWN PROSE IS STALE AND THE PAGES FOLLOW THE
// CODE INSTEAD. Written down so the next author does not "correct" the book
// back to the comment:
//
//   · `stats.ts:14` says *"the gym trains STR and CON"*. It does not, and has
//     not since CROSSTOWN FITNESS was rebuilt: `int-gym.ts:31-34` and its three
//     `train()` calls are STR and **DEX**. CON cannot be raised at all.
//   · `stats.ts:139` clamps the DEX multiplier at 1.15, but `STAT_MAX` is 10,
//     so the reachable ceiling is **1.125**. fp.ts repeats the 1.15 four times.
//   · `fp.ts:573-574` defaults walk/run to 3.0/5.6; `crosstown.ts:1315`
//     overrides them to **3.3 / 6.8** and is the only world that ships. Every
//     derived figure in fp.ts's comments is against the defaults and is wrong.
//   · `roulette.ts:24` and `slotcab.ts:53` both quote a 94.97% slots RTP that
//     matches no machine now in the world. The live cabinets are 101.44%.
//
// WHERE PROSE REPLACES A NUMBER, THAT IS DELIBERATE. Some systems have no one
// figure worth quoting — the gym's gain is a per-session probability, not a
// count of sessions. Those are written around rather than guessed at. Do not
// invent a number to fill a gap, and do not document a thing you intend to
// build.
//
// ── HOW IT IS REACHED, AND WHY THIS FILE OWNS NO GEOMETRY ──────────────────
//
// `ct/int-library.ts` builds the returns trolley beside the issue desk — two
// boards on castors carrying three dozen real modelled books
// (int-library.ts:2276-2357). That is the object in his screenshot and the
// object the prompt hangs on. This file never draws or moves any part of it,
// exactly as `ct/library-pc.ts` never touches the CRT it paints on.
//
// THE TROLLEY IS FOUND BY MEASUREMENT, NOT BY COORDINATE. Interiors are handed
// an 80 m slab in build order (`interior.ts:1204`), so the library's world x
// depends on how many rooms were built before it and cannot be typed here. The
// two shelf boards are `BoxGeometry(0.52, 0.06, 0.86)` and that triple is
// unique in the world — grepped, two hits, both the trolley — so the search is
// arithmetic over `scene.traverse` and this module keeps no copy of anything
// `int-library.ts` owns. Re-size the trolley and the prompt disappears with a
// console warning, which is the honest failure rather than a silently wrong
// spot three metres from anything.

export const ORDER = BUILD.INTERIOR + 11;   // after the interiors are standing

/** THE CANVAS, the shape of an open book. Declared up here because the PHYSICAL
 *  book below is cut to the same ratio — one pair of numbers, so the picture
 *  can never be stretched across the object it is painted on. */
const CW = 440, CH = 304;

// ── finding the trolley ────────────────────────────────────────────────────

/** the shelf boards' own size, as `int-library.ts:2276` builds them */
const BOARD_W = 0.52, BOARD_H = 0.06, BOARD_D = 0.86;
/** how high the upper board's CENTRE stands off the library floor, so the floor
 *  under the trolley is DERIVED rather than assumed to be y 0 — the library has
 *  a gallery over part of its plan and `ok()` has to know which of them you are
 *  standing on. */
const BOARD_Y = 0.80;
const EPS = 1e-3;

// ── THE PAGE YOU ACTUALLY LOOK AT ──────────────────────────────────────────
//
// ⚠ THE ONE PIECE OF GEOMETRY THIS FILE OWNS, AND WHY IT HAS TO.
//
// `ct/hud.ts` resolves a panel's pointer TWO ways and picks between them on one
// test — `spec.surface && FOCUS ? surfaceHit(e) : elementHit(...)` (hud.ts:1577).
// `surfaceHit` raycasts the mesh the focus controller entered. But `hot`,
// `click` and `move` live on `surface` too, so a panel that wants a MOUSE has
// to declare `surface`, and a panel that declares `surface` without a findable
// mesh takes the raycast branch against nothing and every click returns null.
// **In this framework a clickable panel needs a real surface in the world.**
// (Widening that test is a `hud.ts` change and `hud.ts` had three other
// builders in it this session, so it is not made here.)
//
// So the shelf gets what every other diegetic screen in the world has: an
// object. A book lies open on the clear back strip of the trolley's top board —
// which is where a book being re-shelved actually sits — and pressing `[E]`
// leans you over it. The trolley's own books stand on the FRONT of that board
// (their front faces reach `TR_X + 0.20`, int-library.ts:2352), so this occupies
// floor nobody was using and adds no collider: it is inside the trolley's
// existing 0.62 x 0.96 footprint.
//
// ⚠ IT IS BUILT AT FRAME TIME, NEVER IN `register()`. three spends four
// `Math.random()` calls per Object3D on `generateUUID`, and `register()` runs
// inside the world's seeded build stream — four objects there would repaint the
// dither of every texture painted after this module (GOTCHAS §2, §75). Built
// after the first frames instead, it cannot move anything: the world is already
// standing. This is also why `three` arrives by DYNAMIC import.

/** the open book's size in metres. The 1.447 ratio is `CW / CH`, so the canvas
 *  lands on it un-stretched — the failure `ct/library-pc.ts` had to warn about
 *  is impossible here because both halves are derived from one pair. */
const PAGE_W = 0.30, PAGE_H = PAGE_W * CH / CW;
/** where on the board it lies: back from the standing spines, on the board's
 *  own top face (0.83, int-library.ts:2338) plus two millimetres of clearance. */
const PAGE_DX = -0.115, PAGE_DY = 0.832;
/** the eye leans this far over it, at this field. The drawer's lining — the
 *  world's other horizontal screen — uses 0.68 / 34 (drawer.ts:56); a book is
 *  held closer and read wider than a drawer is rummaged in. */
const PAGE_STANDOFF = 0.52, PAGE_FOV = 40;
/**
 * WHICH WAY TO TURN HIM. A horizontal face's normal points at the ceiling and
 * carries no heading at all, so the caller states it — the same argument, and
 * the same trap (`atan2(+0, −0)` = π, a 180° spin), that `ScreenSurface.faceYaw`
 * was written for.
 *
 * The reader stands on the WEST side of the trolley, which is the 1.05 m aisle
 * `int-library.ts:2274` leaves between it and the issue desk, and looks east.
 * `fwd = (sin yaw, −cos yaw)`, so east (+x) is yaw π/2. The plane is rolled to
 * match: its local +y — the top of the page — points +x, away from him.
 */
const PAGE_YAW = Math.PI / 2;

function findTrolley(scene: THREE.Scene): THREE.Object3D | null {
  let best: THREE.Object3D | null = null;
  let bestY = -Infinity;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (m.geometry.type !== 'BoxGeometry') return;
    const q = (m.geometry as THREE.BoxGeometry).parameters as
      { width: number; height: number; depth: number } | undefined;
    if (!q) return;
    if (Math.abs(q.width - BOARD_W) > EPS) return;
    if (Math.abs(q.height - BOARD_H) > EPS) return;
    if (Math.abs(q.depth - BOARD_D) > EPS) return;
    m.updateWorldMatrix(true, false);
    const y = m.matrixWorld.elements[13];
    if (y > bestY) { bestY = y; best = m; }      // the UPPER of the two boards
  });
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT A BOOK IS
// ═══════════════════════════════════════════════════════════════════════════
//
// BLOCKS, not lines. A page is laid out at draw time against the canvas's own
// measured character width, so the text is written here as prose and the
// wrapper decides where the line and the page end. Writing it pre-broken would
// mean re-breaking every page by hand the first time the type moved, which is
// how a reference book stops being maintained.

type Block =
  | { k: 'h'; t: string }             // a heading
  | { k: 'p'; t: string }             // a paragraph, wrapped
  | { k: 'l'; t: string }             // a bullet, wrapped under a hanging indent
  | { k: 'r'; a: string; b: string }  // a table row: label · leader · value
  | { k: 'rule' }
  | { k: 'gap' }
  | { k: 'break' };                   // start the next block on a fresh page

interface Book {
  /** stamped down the spine — the shelf gives it about 30 characters */
  spine: string;
  title: string;
  sub: string;
  /** the cloth the boards are bound in, and the gilt on them */
  cloth: string; gilt: string;
  /** the label a branch library sticks on the tail of a spine */
  dewey: string;
  body: Block[];
}

const h = (t: string): Block => ({ k: 'h', t });
const p = (t: string): Block => ({ k: 'p', t });
const l = (t: string): Block => ({ k: 'l', t });
const r = (a: string, b: string): Block => ({ k: 'r', a, b });
const RULE: Block = { k: 'rule' };
const GAP: Block = { k: 'gap' };
const BREAK: Block = { k: 'break' };

// ── the hours book, GENERATED rather than retyped ──────────────────────────
//
// `ct/hours.ts` is the one table the counters, the punch clock and the card by
// every door all read. Typing its rows out again here would be the exact
// two-authorings fault BUILDER-BRIEF §8 exists to stop, and the first hour it
// drifted this book would be lying to the one player who trusted it. So the
// page is BUILT FROM THE TABLE at load, through the same `fmtHour` the door
// cards are lettered with. Hoisted, so `BOOKS` may call it above its own body.
function hoursBlocks(): Block[] {
  const out: Block[] = [
    h('HOW TO READ THIS'),
    p('Every business on this street keeps hours, and every one of them has a '
      + 'card by the door saying so. This is all of those cards on one page, '
      + 'copied off the same list the shopkeepers work to.'),
    p('THE DOORS DO NOT LOCK. You can walk into any of these places at three in '
      + 'the morning. There will simply be nobody at the counter to serve you '
      + 'and the punch clock will not take your card. Closed means the SERVICE '
      + 'refuses, never that the way in is barred.'),
    GAP,
    h('NEVER CLOSED'),
  ];
  const day = HOURS.filter((b) => b.close - b.open >= 24);
  const rest = HOURS.filter((b) => b.close - b.open < 24)
    .slice()
    .sort((a, b) => a.open - b.open || a.close - b.close);
  for (const b of day) out.push(r(b.building, 'day and night'));
  out.push(GAP, h('THE REST, BY OPENING TIME'));
  for (const b of rest) out.push(r(b.building, `${fmtHour(b.open)}-${fmtHour(b.close)}`));
  out.push(
    GAP,
    RULE,
    h('THE PLACES WITH NO HOURS'),
    p('The CHURCH, this LIBRARY and the JAIL keep none, because none of them '
      + 'takes money at a counter. Neither do the two cash machines outside the '
      + 'bank, which is what a cash machine is for, nor the man under the lamp '
      + 'in the alley behind the pawn shop, who would not post them.'),
    h('WHAT THE HOURS ACTUALLY BIND'),
    p('Two things, and only these two. A counter will not sell to you while the '
      + 'shop is dark. And the punch clock will not start a shift while it is, '
      + 'and cuts short the shift you are already on at closing time — so a job '
      + 'at a business that shuts early is worth less of an evening than its '
      + 'hourly rate suggests.'),
    p('FIRST FEDERAL is the one to watch. Nine to four is the shortest working '
      + 'day on the street, and the loan desk inside keeps the building’s '
      + 'hours exactly. The machines out on the pavement do not care what time '
      + 'it is.'),
  );
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SHELF — TEN VOLUMES, FIVE TO A BOARD
// ═══════════════════════════════════════════════════════════════════════════

const BOOKS: Book[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. STATS — ct/stats.ts throughout; the raisers are ct/int-gym.ts:555-620
  //    and ct/int-college.ts:426-452. ⚠ the gym is STR and DEX (see header).
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'THE FIVE NUMBERS',
    title: 'THE FIVE NUMBERS',
    sub: 'a plain account of INT, STR, CHA, DEX and CON',
    cloth: '#7a3b30', gilt: '#e0c882', dewey: '155.2',
    body: [
      h('WHAT YOU ARE MADE OF'),
      p('Five numbers, each running 1 to 10. An ordinary person holds 5 in all '
        + 'of them. Nothing in this city will ever show them to you again after '
        + 'the morning you set them, so it is worth knowing what they do.'),
      GAP,
      r('INT', 'which jobs will have you'),
      r('STR', 'health, with CON'),
      r('CHA', 'the hiring roll, faintly'),
      r('DEX', 'how fast you move'),
      r('CON', 'health, with STR'),
      GAP,
      p('That list is complete. Nothing else in the world reads any of them — '
        + 'not a price, not a door, not a conversation, not a card at a table.'),

      h('THE POINT BUY, AT THE START'),
      p('You are given a pool of 30 points and every stat begins at 5, which '
        + 'costs 25 of them. So there are FIVE FREE POINTS to place. Dumping a '
        + 'stat to the floor of 1 frees four more. There is no cost curve: a '
        + 'point costs a point wherever you put it.'),
      p('The pool is a rule about CREATION only. Training later ignores it — a '
        + 'year of bench presses is not spending points — but the ceiling of 10 '
        + 'and the floor of 1 hold for ever.'),

      h('HEALTH, FROM STR AND CON'),
      p('Your maximum health is sixty, plus four for every point of STR and '
        + 'every point of CON.'),
      GAP,
      r('the sum', '60 + 4 x (STR + CON)'),
      r('STR 1, CON 1', '68'),
      r('STR 5, CON 5', '100'),
      r('STR 10, CON 10', '140'),
      GAP,
      p('An average body is exactly 100, which is what the bar was built to '
        + 'read. Beyond this, CON does nothing whatsoever and STR does nothing '
        + 'either. Between them they are one statistic wearing two hats.'),

      h('SPEED, FROM DEX'),
      p('DEX is a MULTIPLIER on every gait you have — walking, sprinting, '
        + 'crouching and riding the board alike. Two and a half per cent per '
        + 'point either side of average.'),
      GAP,
      r('DEX 1', 'x 0.900'),
      r('DEX 5', 'x 1.000'),
      r('DEX 8', 'x 1.075'),
      r('DEX 10', 'x 1.125'),
      GAP,
      p('That is the whole of it: twelve and a half per cent between an average '
        + 'body and the fastest in the city. DEX buys no jumping, no balance, '
        + 'no accuracy and no light fingers. It is a small, permanent, '
        + 'always-on discount on every distance you will ever walk.'),

      h('WORK, FROM INT AND CHA'),
      p('Every position posts an INT it wants. Meet it and you are very likely '
        + 'to be hired. Fall short and you are very unlikely — but never quite '
        + 'refused outright.'),
      GAP,
      r('INT at or over', '70%'),
      r('  each point over', '+4%'),
      r('  each point of CHA', '+1%'),
      r('  but never above', '95%'),
      r('INT under', '4%'),
      r('  each point of CHA', '+0.6%'),
      GAP,
      p('So a hopeless application still lands 4.6 times in a hundred at CHA 1, '
        + 'and 10 in a hundred at CHA 10. There is always a chance and it is '
        + 'always small.'),
      p('Read the CHA lines again. Charisma is worth at most one percentage '
        + 'point on a job you are qualified for. It is the cheapest stat to '
        + 'dump and the least rewarding to raise, and it can never be raised '
        + 'anyway. INT is the number that opens doors.'),

      h('RAISING THEM'),
      p('Two institutions on this street will move a number. NOTHING ELSE IN '
        + 'THE CITY WILL.'),
      GAP,
      RULE,
      h('CROSSTOWN FITNESS — STR AND DEX'),
      p('Pay at the desk first, then use the machines. One fee opens all three.'),
      GAP,
      r('DAY PASS', '$15.00'),
      r('FULL SEASON, 28 days', '$120.00'),
      GAP,
      r('the press', 'STR'),
      r('the heavy bag', 'DEX'),
      r('the rower', 'both, at half odds'),
      GAP,
      p('A session is ONE HOUR of the clock and you get ONE SESSION PER MACHINE '
        + 'PER DAY — three hours a day if you use all three. A session is not a '
        + 'guaranteed point. It is a roll, and the chance is (10 minus the stat) '
        + 'divided by five:'),
      GAP,
      r('5 going to 6', 'certain'),
      r('6 to 7', '4 days in 5'),
      r('7 to 8', '3 days in 5'),
      r('8 to 9', '2 days in 5'),
      r('9 to 10', '1 day in 5'),
      GAP,
      p('The rower halves every one of those but rolls STR and DEX separately '
        + 'in the same hour, so it is the better use of a day early on and the '
        + 'worse one at the top.'),
      p('THE GYM IS THE ONLY PLACE DEX CAN BE RAISED, and almost nobody finds '
        + 'it, because the heavy bag looks like scenery.'),
      RULE,
      h('THE COMMUNITY COLLEGE — INT'),
      p('The evening division, one point of INT per course completed, never '
        + 'more. Each course refuses you outright once your INT has passed its '
        + 'ceiling, and your money does not move on a refusal.'),
      GAP,
      r('NIGHT CLASS $150', 'INT 1-5, 3 hours'),
      r('CERTIFICATE $400', 'INT 1-7, 7 days'),
      r('SEMESTER $850', 'INT 1-9, 14 days'),
      GAP,
      p('The week and the fortnight are real: the clock runs to eight in the '
        + 'morning after the last day and you come out the other side of it.'),
      p('Climbing from an average INT of 5 all the way to 10 costs one night '
        + 'class, two certificates and two semesters — $2,650 and thirty-six '
        + 'days — and it is the only ladder up the wage table.'),
      RULE,
      h('AND THE TWO THAT CANNOT MOVE'),
      p('CHA AND CON CANNOT BE RAISED. Not anywhere, not by anything, not once '
        + 'the first morning is over. There is no charm school and no clinic in '
        + 'this city. Whatever you set them to at creation you will carry to '
        + 'the end, so spend the five free points knowing that.'),
      p('Nothing lowers a stat either. There is no injury, no ageing and no '
        + 'penalty anywhere that touches the five numbers.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. MOVEMENT — fp.ts, crosstown.ts:1315 (the live speed override),
  //    ct/skateboard.ts, ct/park.ts:3042-3093 (the trade).
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'ON FOOT',
    title: 'ON FOOT',
    sub: 'walking, running, the curb, and the board',
    cloth: '#3f5470', gilt: '#e0c882', dewey: '796.0',
    body: [
      h('THE CONTROLS, IN FULL'),
      p('There is no settings screen and no card in the box. This page is it.'),
      GAP,
      r('W A S D', 'walk'),
      r('SHIFT', 'sprint. Hold it. Free.'),
      r('SPACE', 'jump'),
      r('C', 'crouch, and the air tuck'),
      r('E', 'use what is highlighted'),
      r('E, looking down', 'open your bag'),
      r('ESCAPE', 'stand up; back out'),
      r('arrows / mouse', 'look around'),
      r('right mouse, down', 'the wristwatch'),
      r('M  [  ]', 'mute, quieter, louder'),
      r('F', 'the frame counter'),
      r('V', 'draw the colliders'),
      GAP,
      p('CTRL does nothing. TAB does nothing outside a screen. There is no '
        + 'walk/run toggle and no key at all that mounts the skateboard.'),

      h('HOW FAST YOU GO'),
      GAP,
      r('walking', '3.30 m/s'),
      r('sprinting', '6.80 m/s'),
      r('crouched, walking', '1.49 m/s'),
      r('crouched, sprinting', '3.06 m/s'),
      GAP,
      p('Multiply all four by your DEX figure from the other book. There is NO '
        + 'STAMINA: no bar, no drain, no wind, no cooldown. You may hold SHIFT '
        + 'from one end of the city to the other and back.'),
      p('Crouching costs you fifty-five per cent of your speed, which is an '
        + 'enormous amount, and there is nowhere in this city you have to '
        + 'crouch to get through.'),

      h('THE JUMP'),
      p('You leave the ground at four metres a second against a gravity of '
        + 'fourteen, which lifts your feet a little under half a metre. Hold C '
        + 'in the air and your knees come up, buying another thirty-five '
        + 'centimetres of clearance.'),
      GAP,
      r('plain jump clears', 'about 0.55 m'),
      r('crouch-jump clears', 'about 0.90 m'),
      r('the curb is', '0.14 m'),
      GAP,
      p('You cannot jump twice in the air. AND YOU CANNOT JUMP AT ALL WHILE '
        + 'WALKING DOWN A SLOPE, which is a real and permanent nuisance on the '
        + 'library steps and on every ramp in the city.'),
      p('There are no steps anywhere in this world, only ramps. Nothing needs '
        + 'jumping to climb, and the curb you walk straight up.'),

      h('HOPPING — THE FASTEST YOU WILL EVER MOVE'),
      p('Nothing in the city mentions this and no readout shows it, which is '
        + 'why it is written down here.'),
      p('Press SPACE again within a sixth of a second of landing, with a '
        + 'movement key still held, and the next jump carries a little more '
        + 'speed with it. FOUR CLEAN HOPS IN A ROW is the maximum, and it is '
        + 'worth sixty-five per cent on top of whatever gait you are in.'),
      GAP,
      r('one clean hop', '+16%'),
      r('four clean hops', '+65%'),
      r('sprinting, chained', '11.2 m/s'),
      GAP,
      p('Miss the window, or let the movement keys go, and the whole stack '
        + 'bleeds away inside half a second. HOLDING SPACE DOWN DOES NOTHING — '
        + 'the key has to come back up between hops. Sitting down erases it.'),
      p('There is no air steering. Turning the mouse in mid-air buys you '
        + 'nothing at all; the hop is the only trick this city has, and it is '
        + 'nearly twice walking pace.'),

      h('THE SKATEBOARD'),
      p('There is exactly ONE skateboard in this city. A kid in the park has it '
        + 'and he wants a pack of cigarettes for it. Buy a pack at the bodega, '
        + 'find him, and the prompt will read GIVE SMOKES.'),
      p('It costs you the emptiest pack you are carrying, and a sealed pack '
        + 'counts as twenty cigarettes — so smoke nineteen of them first and '
        + 'the board costs you one cigarette.'),
      p('It rides out of your BAG, not off a hotkey. Look down, press E, and '
        + 'use the board. The same verb steps you off again.'),
      GAP,
      r('cruising', '7.2 m/s'),
      r('pushing, on SHIFT', '8.8 m/s'),
      GAP,
      p('It carries momentum: let go at speed and you roll on for a couple of '
        + 'seconds. SPACE ollies. That is the only trick there is — no flip, no '
        + 'grind, no line to hold.'),
      p('Two things to know before you trade for it. IT CANNOT BE RIDDEN '
        + 'INDOORS and you are put off it at every door. And HOPPING DOES NOT '
        + 'WORK ON IT — the stack is wiped the instant you step on, so a fully '
        + 'chained sprint at 11.2 m/s beats the board comfortably. The board is '
        + 'for the long flat blocks when you cannot be bothered to hop.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. HOURS — generated from ct/hours.ts. Never retype a row.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'HOURS OF BUSINESS',
    title: 'HOURS OF BUSINESS',
    sub: 'a citizen’s directory of the block',
    cloth: '#6a6234', gilt: '#efe6cc', dewey: '381.1',
    body: hoursBlocks(),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TIME — ct/calendar.ts, ct/tenancy.ts, ct/apartment.ts:182-199,
  //    ct/fatigue.ts throughout.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'THE CLOCK & THE SEASONS',
    title: 'THE CLOCK AND THE SEASONS',
    sub: 'time, rent, sleep, and what happens if you do not',
    cloth: '#4a3f5c', gilt: '#e0c882', dewey: '529.0',
    body: [
      h('THE SHAPE OF A YEAR'),
      p('A year is four seasons and each season is twenty-eight days. The '
        + 'seasons ARE the months: SPRING, SUMMER, FALL, WINTER, and then '
        + 'SPRING again a year older. You begin on the first day of SPRING in '
        + 'YEAR 1.'),
      GAP,
      r('a day', '1,440 minutes'),
      r('a season', '28 days'),
      r('a year', '112 days'),
      GAP,
      p('A minute of city time passes in a second of your own, so a day takes '
        + 'twenty-four minutes of standing about and a season a little over '
        + 'eleven hours. SLEEPING IS WHAT MAKES THE CALENDAR MOVE: eight hours '
        + 'go by in about a second and a half.'),
      p('The first of every season is a Monday, for ever, and rent day is '
        + 'always a Friday. Sunday brings no post.'),

      h('RENT'),
      p('Five hundred dollars, due on the FIFTH of every season. The first bill '
        + 'lands on day four — nothing is paid in advance for you, and nobody '
        + 'is covering your first month.'),
      GAP,
      r('rent', '$500 a season'),
      r('due', 'the 5th'),
      r('notice posted', 'the 2nd'),
      r('your flat', '301, No. 227'),
      GAP,
      p('You pay THE LANDLORD in person, in the lobby of your own building. He '
        + 'stands there between seven in the morning and ten at night, and only '
        + 'when he is owed something.'),
      p('It comes out of your POCKET, never out of the bank, and only in WHOLE '
        + 'SEASONS — being ten dollars short means paying nothing at all that '
        + 'day and being told so.'),
      p('If you do not pay: a notice in the mailbox, a slip under your door '
        + 'every late day, and the man himself standing in the hall. The '
        + 'arrears simply stack up. THERE IS NO INTEREST, NO LATE FEE, NO '
        + 'LOCKOUT AND NO EVICTION. Rent in this city is pressure, not a wall.'),
      p('Once you have paid a season clear and owe nothing, the landlord can be '
        + 'asked about a room with a view. It is a thousand a month INSTEAD OF '
        + 'the five hundred, not on top of it; nothing changes hands on the '
        + 'handshake; and it cannot be given back.'),

      h('STAYING AWAKE'),
      p('You can stay on your feet for TWENTY-FOUR HOURS. Nothing warns you in '
        + 'words. Instead the edges of your sight begin to darken around the '
        + 'sixteenth hour and close further as the hours go, and in the last '
        + 'hour you start blinking — slower and more often the nearer you are '
        + 'to going down.'),
      p('Three things buy more hours, and they add up:'),
      GAP,
      r('a cup of coffee', '+6 hours'),
      r('caffeine pills', '+8 hours'),
      r('a bag of cocaine', '+12 hours'),
      GAP,
      p('The dark rim visibly draws back the moment a dose lands, which is how '
        + 'you know it worked. The extension never banks: going to sleep clears '
        + 'whatever is left of it.'),

      h('WHEN YOU GO DOWN'),
      p('You collapse where you stand, wake eight hours later wherever you last '
        + 'slept, and somebody goes through your pockets while you are out.'),
      GAP,
      r('taken', '1% to 10% of your CASH'),
      r('taken from the bank', 'nothing, ever'),
      r('health lost', 'a tenth of your maximum'),
      r('but never below', '1'),
      GAP,
      p('THAT IS THE WHOLE ARGUMENT FOR THE BANK. Money in the account cannot '
        + 'be reached by whoever finds you face down on the pavement, and it is '
        + 'the only thing the account is good for.'),
      p('You cannot die of exhaustion. The blackout floors you at one point of '
        + 'health and no lower.'),

      h('SLEEPING PROPERLY'),
      p('Every sleep in this world is eight hours — your own bed in 301, or a '
        + 'room at the ORPHEUS. A proper night RESTORES YOUR HEALTH IN FULL and '
        + 'resets the clock on staying awake. Collapsing does neither: it is a '
        + 'mugging, not a rest.'),
      p('Where you last went to sleep is where a blackout will dump you, so a '
        + 'night at the hotel moves the place your body turns up. If you have '
        + 'never slept at all, you wake in 301.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. JOBS — ct/jobs.ts:75-113, :279-349.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'HONEST WORK',
    title: 'HONEST WORK',
    sub: 'the eleven positions on this street, and what they pay',
    cloth: '#4a5c3f', gilt: '#efe6cc', dewey: '331.7',
    body: [
      h('THE POSITIONS'),
      p('Eleven businesses hire. Each posts the INT it wants and an hourly '
        + 'rate, and the two rise together — the ladder is INT and nothing '
        + 'else. The rate never changes.'),
      GAP,
      r('COUNTER CLERK', 'INT 5   $3.75'),
      r('   the bodega', ''),
      r('GRILL CREW', 'INT 5   $4.00'),
      r('   the barn', ''),
      r('REWIND CLERK', 'INT 6   $4.25'),
      r('   the video hut', ''),
      r('FLOOR CLERK', 'INT 6   $5.00'),
      r('   the thrift store', ''),
      r('LINE COOK', 'INT 7   $5.50'),
      r('   the diner', ''),
      r('DESK TRAINER', 'INT 7   $6.00'),
      r('   the gym', ''),
      r('COUNTER MAN', 'INT 8   $6.50'),
      r('   the pawn shop', ''),
      r('MATTRESS SALESMAN', 'INT 8   $7.25'),
      r('   the showroom', ''),
      r('FLOOR SALESMAN', 'INT 9   $7.75'),
      r('   VOLT VILLAGE', ''),
      r('NIGHT CLERK', 'INT 9   $8.50'),
      r('   the hotel', ''),
      r('ADJUNCT TUTOR', 'INT 10  $10.00'),
      r('   the college', ''),
      GAP,
      p('The bank does not hire, whatever the window says. Neither does the '
        + 'casino, the church, the tax office nor this library.'),

      h('APPLYING'),
      p('Look for a HELP WANTED card with a clipboard under it. Press E to '
        + 'apply, sign the form with the pen — scrawl enough ink to pass for a '
        + 'signature, or press ENTER and let your hand do it — then SUBMIT.'),
      p('One roll decides it, on the odds in the book about the five numbers. '
        + 'Turned down, and a POSITION FILLED slip covers the form for THREE '
        + 'DAYS before they will look at you again.'),
      p('You may hold ONE JOB. Being hired anywhere else quits the old one on '
        + 'the spot without asking you. That is the only way to leave a job: '
        + 'YOU CANNOT QUIT AND YOU CANNOT BE FIRED. Never turning up again '
        + 'costs you nothing but the wages.'),

      h('THE SHIFT'),
      p('At the place that hired you the prompt reads WORK. A shift is EIGHT '
        + 'HOURS, or whatever is left until the shop closes, whichever is the '
        + 'shorter. Under fifteen minutes to closing and they will not start '
        + 'you at all.'),
      p('You are paid IN CASH the moment you punch out, at the rate times the '
        + 'minutes actually worked. Four and a half hours at $5.50 is $24.75. '
        + 'Wages are not taxed; there is no income tax in this city.'),

      h('THE DOUBLE SHIFT'),
      p('This is the one thing worth knowing about work here. Punch back in '
        + 'WITHIN AN HOUR of punching out and it counts as staying on rather '
        + 'than as a second day. So you can work straight through until the '
        + 'shutters come down — and at the BODEGA, the DINER and the HOTEL, '
        + 'which never close, you can work for as long as you can stay awake.'),
      p('Wander off for more than an hour and the next shift belongs to '
        + 'tomorrow.'),
      p('Which makes NIGHT CLERK at the ORPHEUS — INT 9, $8.50, a desk that '
        + 'never shuts — the best paid work in the city by a distance, and '
        + 'ADJUNCT TUTOR at the college the best rate on a clock that stops '
        + 'at nine in the evening.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MONEY — crosstown.ts:410, ct/atm.ts:119-331, ct/menus.ts:60-63,
  //    ct/int-bank.ts:1268-1966, ct/inventory.ts:574-608, ct/dealer.ts:59.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'MONEY',
    title: 'MONEY',
    sub: 'the bank, the machine, the loan desk and the fence',
    cloth: '#2f4a3a', gilt: '#e0c882', dewey: '332.0',
    body: [
      h('WHAT YOU START WITH'),
      GAP,
      r('in your pocket', '$14.50'),
      r('in the bank', '$312.40'),
      GAP,
      p('The account is already open the first time you walk up to a machine. '
        + 'Nobody ever tells you it is there.'),

      h('THE CASH MACHINE'),
      p('Two of them stand outside FIRST FEDERAL and they never close. You '
        + 'choose a four-digit number the first time you use one and it lives '
        + 'on the card after that.'),
      GAP,
      r('notes', '$40  $100  $200  $400'),
      r('or', 'ALL'),
      r('fees', 'none, of any kind'),
      GAP,
      p('There is no surcharge, no minimum balance and no overdraft. A dollar '
        + 'in is a dollar out. There is also NO INTEREST — money in the bank '
        + 'does not grow by a cent, ever.'),
      p('So there is exactly one reason to bank money: it cannot be taken off '
        + 'you while you are lying unconscious in the street. That is reason '
        + 'enough. Carry the day’s spending and leave the rest.'),
      p('The rate board in the lobby advertising PASSBOOK SAVINGS at 4.10 is '
        + 'painted on the wall. There is one account and you already have it.'),

      h('THE LOAN DESK'),
      p('Inside the bank, nine to four. Five amounts, each at its own rate, and '
        + 'the smaller the loan the worse the rate.'),
      GAP,
      r('$200 at 13.50%', 'repay $227.00'),
      r('$500 at 12.50%', 'repay $562.50'),
      r('$1,000 at 11.25%', 'repay $1,112.50'),
      r('$2,500 at 9.75%', 'repay $2,743.75'),
      r('$5,000 at 8.90%', 'repay $5,445.00'),
      GAP,
      p('SECURITY IS FIVE PER CENT IN CASH, UP FRONT — fifty dollars against a '
        + 'thousand. Come up short of it and the application is declined where '
        + 'you stand.'),
      p('The interest is charged ONCE, flat. The form prints a monthly figure '
        + 'over twenty-four months, but nothing ever bills you: there is no '
        + 'schedule, no due date and no penalty for never paying it back.'),
      p('Approved, you collect the cash at WINDOW 2, and you repay at the same '
        + 'window, whatever you happen to be carrying, whenever you like. One '
        + 'loan at a time.'),

      h('THE FENCE'),
      p('Parcels are left on doorsteps up and down this street. The pawn shop '
        + 'will take what is in them, no questions asked, at its own prices — '
        + 'and it will take NOTHING ELSE. Stolen goods only.'),
      GAP,
      r('a book of cheques', '$32.00'),
      r('trainers', '$20.00'),
      r('a toaster', '$16.00'),
      r('an unlabelled tape', '$8.00'),
      r('six pairs of socks', '$2.00'),
      r('a mail-order catalogue', '$1.00'),
      GAP,
      p('One item per press, cash in hand, and the prompt names the price '
        + 'before you press it. He picks the item for you — always the dearest '
        + 'thing you are carrying that he will take. There is no haggling '
        + 'anywhere in this city and no roll to make.'),
      p('He sells the same things back across the shop at rather more: '
        + 'trainers at $48, a toaster at $36, a tape at $16. A whole season of '
        + 'taking every parcel that lands is worth somewhere around three '
        + 'hundred dollars, which is most of one rent bill and a great deal of '
        + 'walking.'),

      h('THE MAN IN THE ALLEY'),
      p('Behind the pawn shop, under the lamp, at any hour of the day or night. '
        + 'One bag, a hundred dollars, no change given, and he will not discuss '
        + 'it on the street.'),

      h('THINGS THAT DO NOT EXIST'),
      p('So that you do not go looking for them: there is no income tax and no '
        + 'sales tax, and the tax office prepares nothing for anyone. There are '
        + 'no fines, no bail and no bribes. Nothing is ever repossessed. You '
        + 'cannot be evicted and you cannot go bankrupt.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. THE BODY — ct/health.ts, ct/carhit.ts:38-135, ct/food.ts:48-60,
  //    ct/int-volt.ts:1124-1147, ct/gameover.ts:162-207.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'FLESH AND BLOOD',
    title: 'FLESH AND BLOOD',
    sub: 'health, the traffic, food, and the end',
    cloth: '#6e4a2c', gilt: '#e0c882', dewey: '613.0',
    body: [
      h('THE ONLY THING IN THIS CITY THAT CAN HURT YOU'),
      p('IS A CAR. There is no other source of damage in the whole world. There '
        + 'is no combat, no fistfight, no weapon, no attacker, no fall damage '
        + 'and no illness. Nobody will ever lay a hand on you.'),
      GAP,
      r('a car hits you for', '70'),
      r('you are safe for', '2 seconds after'),
      r('under 1 m/s it is', 'a nudge, not a hit'),
      r('you are thrown', '1.4 metres'),
      GAP,
      p('Seventy is chosen so that TWO HITS KILL, even at the strongest body '
        + 'this game allows. The traffic is the whole of the danger in '
        + 'CROSSTOWN, and the sidewalk is the whole of the safety.'),
      p('You cannot be arrested. The cells at the House of Detention are a '
        + 'place you can walk through, not a consequence of anything.'),

      h('HEALING'),
      p('Three ways, and there are no others.'),
      GAP,
      l('SLEEP, which restores you to FULL — your own bed or a hotel room. '
        + 'This is the only complete heal and it is free at home.'),
      l('FOOD, eaten out of your bag, never at the counter. Buy the parcel, '
        + 'look down, press E, and eat it.'),
      l('THE MASSAGE CHAIR at VOLT VILLAGE, which is free and worth 15. It '
        + 'wants a quarter of an hour of city time and gives you NOTHING at '
        + 'all if you stand up early.'),
      GAP,
      h('WHAT FOOD IS WORTH'),
      p('THERE IS NO HUNGER IN THIS CITY. You never need to eat and you will '
        + 'never be told you are hungry. Food does one thing: it heals.'),
      GAP,
      r('DINER PLATTER', '30'),
      r('CHICKEN / EGGS / SANDWICH', '18'),
      r('BARN BURGER', '15'),
      r('CEREAL', '12'),
      r('SHAKE', '10'),
      r('APPLE PIE', '8'),
      r('FRIES', '6'),
      r('CHIPS', '4'),
      r('SODA', '3'),
      GAP,
      p('Healing past your maximum is simply wasted. COFFEE is not food — it '
        + 'buys waking hours, not health — and the popcorn at the video hut '
        + 'cannot be eaten at all.'),
      p('Set the platter’s $15.00 against thirty points of health and it '
        + 'is the best value on the street; a soda at $3.50 for three points is '
        + 'the worst by some way.'),

      h('THE END'),
      p('Health at zero is the end of the game. There is one card, one cause of '
        + 'death printed on it, and one road out of it: press ENTER for a new '
        + 'life. The keys are dead for the first two seconds so that you cannot '
        + 'wipe your own save by leaning on a key.'),
      p('Loading a save that died puts the card straight back up. There is no '
        + 'resurrection and there is no continue.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. PRICES — int-bodega.ts:1072-1092, int-burger.ts:216-226, menus.ts:37-50,
  //    int-video.ts:448-456, int-thrift.ts:739-887, int-pawn.ts:636-644,
  //    int-sleep.ts:99-103/498-504, int-volt.ts:925-931, int-hotel.ts:980-1013.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'WHAT THINGS COST',
    title: 'WHAT THINGS COST',
    sub: 'a price list for the whole street',
    cloth: '#5c3a52', gilt: '#efe6cc', dewey: '338.5',
    body: [
      h('THE BODEGA — never closes'),
      GAP,
      r('SANDWICH', '$9.00'),
      r('CEREAL', '$10.00'),
      r('SODA', '$5.00'),
      r('CHIPS', '$3.00'),
      r('COFFEE', '$2.50'),
      r('CAFFEINE PILLS', '$6.00'),
      r('SMOKES', '$8.00'),
      r('NEWSPAPER', '$2.00'),
      GAP,
      h('BURGER BARN — 10 AM to midnight'),
      GAP,
      r('CHICKEN', '$9.00'),
      r('BARN BURGER', '$7.50'),
      r('SHAKE', '$5.00'),
      r('FRIES', '$3.50'),
      r('SODA', '$3.00'),
      r('APPLE PIE', '$2.75'),
      r('COFFEE', '$2.50'),
      GAP,
      h('THE DINER — never closes'),
      GAP,
      r('PLATTER', '$15.00'),
      r('EGGS', '$9.00'),
      r('SHAKE', '$6.00'),
      r('APPLE PIE', '$5.50'),
      r('SODA', '$3.50'),
      r('COFFEE', '$2.50'),
      BREAK,
      h('VIDEO HUT — 10 AM to midnight'),
      GAP,
      r('EX-RENTAL TAPE', '$10.00'),
      r('BLANKS, THREE PACK', '$9.00'),
      r('NEW RELEASE', '$6.00'),
      r('POPCORN', '$4.00'),
      GAP,
      p('None of the four can be used for anything. There is no television you '
        + 'own that plays a tape.'),
      h('THE THRIFT STORE — 9 to 6'),
      p('Clothes are bought AT THE FITTING MIRROR, not at the till, and they go '
        + 'into your wardrobe in 301 rather than into your bag.'),
      GAP,
      r('ANALOG WATCH', '$20.00'),
      r('BOOTS', '$18.00'),
      r('DENIM SHIRT', '$16.00'),
      r('BACKPACK', '$14.00'),
      r('DRESS', '$12.00'),
      r('SWEATER / SPECS / CROSSBODY', '$10.00'),
      r('TRACK PANTS / SKIRT / SANDALS', '$8.00'),
      r('SHADES / TOTE', '$8.00'),
      r('TEE / SHORTS / SUNHAT / CLUTCH', '$6.00'),
      r('CAP', '$4.00'),
      r('PAPERBACK, at the till', '$1.00'),
      GAP,
      p('CLOTHES HAVE NO EFFECT ON ANYTHING. Not on prices, not on CHA, not on '
        + 'who talks to you. They are how you look and nothing else.'),
      p('The one exception is a BAG, and it is not about which bag: carrying '
        + 'ANY bag gives you twelve slots, and carrying none gives you one. The '
        + 'cheapest is the clutch at six dollars and it holds exactly as much '
        + 'as the backpack.'),
      p('The paperback is worth a dollar and an hour: reading it passes sixty '
        + 'minutes and does not use it up.'),
      BREAK,
      h('THE PAWN SHOP — 9 to 7'),
      GAP,
      r('WATCH', '$60.00'),
      r('SHOES', '$48.00'),
      r('TOASTER', '$36.00'),
      r('TAPE', '$16.00'),
      r('SOCKS', '$6.00'),
      GAP,
      h('THE SLEEP CENTER — 10 to 7'),
      GAP,
      r('BED FRAME', '$160.00'),
      r('SHEET SET', '$100.00'),
      r('BLANKET', '$72.00'),
      r('PILLOW', '$48.00'),
      GAP,
      p('THE MATTRESSES ON THE FLOOR ARE NOT FOR SALE. The TWIN, FULL and QUEEN '
        + 'sets on the cards at $800, $1,200 and $1,600 are signage. And you '
        + 'cannot sleep in the showroom.'),
      h('VOLT VILLAGE — 10 to 9'),
      GAP,
      r('CAMCORDER', '$1,920.00'),
      r('4-HEAD VCR', '$600.00'),
      r('13" COLOUR TV', '$520.00'),
      r('BLANKS, THREE PACK', '$7.00'),
      GAP,
      p('The massage chair by the wall is free and heals you. The karaoke '
        + 'microphone does nothing at all.'),
      BREAK,
      h('HOTEL ORPHEUS — never closes'),
      GAP,
      r('ONE NIGHT', '$29.00'),
      r('A WEEK, single', '$145.00'),
      r('A WEEK, double', '$190.00'),
      GAP,
      p('Every stay is EIGHT HOURS from the moment you take the key, plus whole '
        + 'days for a week. Seven single nights is $203 against $145 for the '
        + 'week, so the week is worth taking if you mean to use it.'),
      p('Four weeks at the ORPHEUS is $580 against $500 of rent on the flat. '
        + 'The hotel is deliberately the dearer way to live.'),
      h('CROSSTOWN FITNESS — 6 AM to 10 PM'),
      GAP,
      r('DAY PASS', '$15.00'),
      r('FULL SEASON, 28 days', '$120.00'),
      GAP,
      p('Eight day passes buy a season. If you mean to train more than eight '
        + 'days, buy the season.'),
      h('THE COMMUNITY COLLEGE — 8 to 9'),
      GAP,
      r('NIGHT CLASS', '$150.00'),
      r('CERTIFICATE', '$400.00'),
      r('SEMESTER', '$850.00'),
      GAP,
      h('AND IN THE ALLEY'),
      GAP,
      r('one bag', '$100.00'),
      GAP,
      h('THE ONE PRICE THAT IS NOT A PRICE'),
      p('The HIGH LIMIT room at SEVENS asks a thousand dollars ON HAND. It is '
        + 'not a charge and nothing is taken: the doorman counts what you are '
        + 'carrying and drops the rope.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. THE CASINO — ct/slotcab.ts:38-216, ct/blackjack.ts:81-96/372-398,
  //    ct/roulette.ts:15-81, ct/bigsix.ts:16-67, ct/int-casino.ts:1309-1413.
  //    ⚠ ct/slots.ts's 22-stop machine is a LIBRARY, not reachable — omitted.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'GAMES OF CHANCE',
    title: 'GAMES OF CHANCE',
    sub: 'the floor at SEVENS, rule by rule',
    cloth: '#7a2f2f', gilt: '#e0c882', dewey: '795.0',
    body: [
      h('THE HOUSE'),
      p('SEVENS never closes, has no windows and no clock, asks for no '
        + 'membership and checks nobody’s age. There are no chairs at any '
        + 'game — you play standing, which is on purpose.'),
      p('THERE ARE NO CHIPS TO BUY AND NO CASHIER. The cage by the wall is '
        + 'painted furniture with nobody behind it. Every game plays straight '
        + 'out of the cash in your pocket, and the chips on the felts are only '
        + 'denominations for stacking a bet: 1, 5, 25 and 100. There is no ATM '
        + 'inside the building.'),
      p('The KENO board on the far wall is a picture. There is no keno, no '
        + 'craps, no poker and no bar.'),

      h('THE SLOT MACHINES'),
      p('Three kinds of cabinet, thirty-four of them, all with the same reels '
        + 'and the same odds. Only the stake differs.'),
      GAP,
      r('CHERRY BELLE', '$2 a pull'),
      r('LUCKY 7', '$5 a pull'),
      r('KING KACHING', '$10 a pull'),
      GAP,
      p('The two buttons under the glass set the bet from one to three times '
        + 'that. FIVE PAYLINES ARE LIVE ON EVERY PULL — across the middle, '
        + 'across the top, across the bottom, and both diagonals — and they '
        + 'stack: two lines paying at once pay both.'),
      GAP,
      r('7-7-7 down the CENTRE', '150 x your bet'),
      r('7-7-7 on any other line', '20 x'),
      r('three BELLS', '10 x'),
      r('three BARS', '5 x'),
      r('three CHERRIES', '4 x'),
      r('two CHERRIES', '2 x'),
      GAP,
      p('TWO SEVENS PAY NOTHING. The cherry pair is the only two-of-a-kind on '
        + 'the card, and the smallest thing the machine will ever pay is twice '
        + 'your bet.'),
      p('The centre jackpot comes up once in about a thousand pulls. Click the '
        + 'lever, click the glass, or press SPACE — there is no other key.'),
      p('AND NOW THE THING NOBODY WILL TELL YOU. These machines pay back about '
        + 'one hundred and one dollars for every hundred staked. THE SLOTS AT '
        + 'SEVENS ARE THE ONLY POSITIVE BET IN THE CITY. They are also the '
        + 'slowest way imaginable to earn a dollar, and the swing is brutal — '
        + 'you will lose three quarters of your pulls outright.'),

      h('BLACKJACK'),
      p('One table. Six decks from a shoe, reshuffled when three quarters of it '
        + 'is gone.'),
      GAP,
      r('blackjack pays', '3 to 2'),
      r('dealer draws to 16 and', 'STANDS ON ALL 17'),
      r('double', 'on any first two cards'),
      r('double after split', 'yes'),
      r('split', 'once only, two hands'),
      r('surrender', 'does not exist'),
      r('insurance', 'does not exist'),
      r('minimum', '$1'),
      r('maximum', 'whatever you have'),
      GAP,
      p('A dealer who stands on soft seventeen is a good rule for you, and it '
        + 'is printed on the felt. Split aces get one card each and twenty-one '
        + 'on a split ace is twenty-one, not blackjack.'),
      p('Everything is done with the mouse. The table binds no keys at all.'),
      p('Played correctly the house keeps about half of one per cent, which is '
        + 'the best game in the building after the slot machines. Play it '
        + 'badly and it collapses: copying the dealer costs you nearly six per '
        + 'cent, and standing on everything from twelve up costs you eight.'),

      h('ROULETTE'),
      p('One wheel, EUROPEAN, thirty-seven pockets with a single zero — the '
        + 'kinder of the two wheels, and it is printed on the baize.'),
      GAP,
      r('a straight number', '35 to 1'),
      r('RED / BLACK', '1 to 1'),
      r('ODD / EVEN', '1 to 1'),
      GAP,
      p('THOSE ARE THE ONLY BETS. There are no splits, no streets, no corners, '
        + 'no dozens, no columns and no high-low. You may back the zero '
        + 'straight up; the zero loses every outside bet on the table.'),
      p('Click a number or a plate, stack your chips, then CLICK THE WHEEL '
        + 'ITSELF to send the ball. The house keeps 2.70 per cent of every bet '
        + 'here, the same on all of them.'),

      h('THE BIG SIX'),
      p('The money wheel by the door. Fifty-four pegs, one flapper, six things '
        + 'to back. This is the most misread game in the building.'),
      GAP,
      r('$1  — 27 pegs', 'pays 1 to 1'),
      r('$2  — 13 pegs', 'pays 3 to 1'),
      r('$5  —  7 pegs', 'pays 6 to 1'),
      r('$10 —  4 pegs', 'pays 12 to 1'),
      r('$20 —  2 pegs', 'pays 25 to 1'),
      r('JOKER — 1 peg', 'pays 45 to 1'),
      GAP,
      p('Twenty-seven of the fifty-four pegs are the dollar, and the dollar '
        + 'pays even money. THAT IS A DEAD-LEVEL BET — the house keeps nothing '
        + 'at all on it, which no real money wheel in the world has ever '
        + 'offered. The $2, $10 and $20 all keep 3.7 per cent. The $5 keeps 9.3 '
        + 'and the JOKER keeps 14.8, and the joker is the worst bet in the '
        + 'building.'),

      h('THE HIGH LIMIT ROOM'),
      p('The deep west corner, behind a doorman and a rope, under a sign '
        + 'reading $1,000 ON HAND TO ENTER.'),
      p('IT IS A CHECK, NOT A CHARGE. Nothing is taken from you. Walk up with a '
        + 'thousand dollars in your pocket and the rope drops; walk up short '
        + 'and the doorman tells you exactly how short.'),
      p('Inside are three slot cabinets at ten times the floor stake — twenty, '
        + 'fifty and a hundred dollars a pull, and up to three hundred at the '
        + 'top bet. The reels and the odds are identical to the ones out front. '
        + 'There is no high-limit blackjack, roulette or wheel; there is '
        + 'nothing else in the room at all.'),
      p('Once you are inside, the rope stays down. Going broke at the hundred '
        + 'dollar machine does not lock you in.'),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. THE TERMINALS — ct/library-pc.ts throughout, esp. :193-702, :350-435,
  //     :906-935, :1144-1149.
  // ─────────────────────────────────────────────────────────────────────────
  {
    spine: 'THE ELECTRONIC AGE',
    title: 'THE ELECTRONIC AGE',
    sub: 'the terminals downstairs, and the market on them',
    cloth: '#2e5257', gilt: '#efe6cc', dewey: '004.0',
    body: [
      h('THE TERMINALS'),
      p('Sit down at one of the machines in this building — the prompt says SIT '
        + 'AT THE COMPUTER — and the screen comes up in front of you. This '
        + 'library keeps no hours, so the machines are here at four in the '
        + 'morning if you are.'),
      p('Five programs on the desktop. Click an icon, or steer with the arrows '
        + 'and press ENTER. TAB always takes you back to the desktop; ESCAPE '
        + 'always gets you out of the machine altogether.'),
      GAP,
      r('CARD CATALOG', 'thirty real books'),
      r('MINESWEEP', '11 by 9, fourteen mines'),
      r('TRADE-NET', 'the stock market'),
      r('SNAKE', 'it speeds up as you score'),
      r('SOLITAIRE', 'Klondike, draw one'),
      GAP,
      p('THE CATALOGUE IS THE ONE SCREEN WHERE E DOES NOT LEAVE, because you '
        + 'are typing into it and E is a letter. Use ESCAPE there. Minesweep '
        + 'has no right button to flag with, so there is a FLAG button on the '
        + 'screen that turns clicking into flagging.'),
      p('Your snake score and your solitaire wins are remembered.'),

      h('TRADE-NET'),
      p('Six companies, and no more will ever list.'),
      GAP,
      r('WEBZ  WebZone Online', '$34.00 start'),
      r('NRDW  NerdWare Systems', '$88.00'),
      r('BEEP  BeeperTech Corp', '$21.00'),
      r('KOLA  Kola Nation Bottling', '$55.00'),
      r('EDSN  Edison United Power', '$27.00'),
      r('ZAPP  ZapWare Interactive', '$2.50'),
      GAP,
      p('They are not the same animal. Each has a drift — where it is headed on '
        + 'average — and a volatility, which is how violently it gets there.'),
      GAP,
      r('WEBZ', '+1.2% a day, 16% swing'),
      r('NRDW', '+0.6% a day, 8%'),
      r('KOLA', '+0.2% a day, 4%'),
      r('EDSN', '+0.1% a day, 2%'),
      r('BEEP', '-0.8% a day, 10%'),
      r('ZAPP', '-0.4% a day, 45%'),
      GAP,
      p('WEBZ is the one going up and it lurches. EDSN is the one that barely '
        + 'moves. BEEP sells pagers and is sinking. ZAPP is a lottery ticket '
        + 'priced like one: it drifts down and swings nearly half its value in '
        + 'a day, and it cannot fall below five cents, ever.'),

      h('DEALING'),
      GAP,
      r('prices step every', '15 minutes of city time'),
      r('which is', '15 seconds of yours'),
      r('commission', '$2 a trade, BOTH WAYS'),
      r('order sizes', '1, 10 or 100 shares'),
      GAP,
      p('Press B to buy, S to sell, Q to cycle the size, or use the buttons. '
        + 'There is no shorting, no margin, no limit order, no dividend and no '
        + 'fraction of a share. An order fills at the price on the tape.'),
      p('THE TWO DOLLARS IS CHARGED EACH WAY, so a round trip costs four '
        + 'dollars however small it is. Selling a single share of ZAPP at five '
        + 'cents LOSES you money, and the machine will let you do it.'),
      p('The tape keeps running while you are away and catches up the moment '
        + 'you sit down — but it will only work through TWO GAME WEEKS of '
        + 'catching up, so a stock left for a season is not simulated for the '
        + 'whole season. Prices, charts and holdings are all remembered.'),
      p('Roughly once in every two hundred and fifty steps a stock takes a '
        + 'headline jump, up or down, sized by how twitchy it already is. On '
        + 'ZAPP that is worth watching for. On EDSN it is barely a wobble.'),
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// THE PAGE — LAYOUT
// ═══════════════════════════════════════════════════════════════════════════
//
// A canvas the shape of an open book, drawn full-bleed into a `chrome: 'none'`
// panel, so the framework's moulded beige cabinet is not wrapped around a
// picture of a book. Item 0c, *"i never want there to be menus popping up
// unless they are embedded to look as if they are in the actual game."*
//
// The bottom strip is left plain and dark BECAUSE THE FRAMEWORK PRINTS THERE:
// `chrome: 'none'` still writes `hint()` and the exit stamp over the bottom
// edge of the caller's own screen, and that promise — a way out, always visible
// — is the one thing no panel in this world may take away.

/** the boards */
const COV_X0 = 6, COV_Y0 = 4, COV_X1 = 434, COV_Y1 = 284;
/** the head band across the top of the boards: the tab and the running title */
const BAND_Y0 = 7, BAND_Y1 = 20;
/** the paper */
const PG_Y0 = 23, PG_Y1 = 281;
const PG_LX0 = 12, PG_LX1 = 214;
const PG_RX0 = 226, PG_RX1 = 428;
const TXT_PAD = 10;
const COL_W = (PG_LX1 - PG_LX0) - 2 * TXT_PAD;      // 182
const COL_LX = PG_LX0 + TXT_PAD;                     // 22
const COL_RX = PG_RX0 + TXT_PAD;                     // 236
const HEAD_Y = 34, HRULE_Y = 38;
const BODY_Y0 = 48, LH = 9;
const PER_PAGE = 24;
const FOLIO_Y = 275;

const PAPER = '#e9e2ce', PAPER_LO = '#d8d0b8';
const INK = '#2a2318', INK_DIM = '#6f6552', INK_HEAD = '#5a3a2a';
const SURROUND = '#191309';

const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px monospace`;
const BODY_PX = 7, HEAD_PX = 7;

/** one laid-out line of a page */
type Line =
  | { s: 'h'; t: string }
  | { s: 't'; t: string; ind: number }
  | { s: 'rule' }
  | { s: 'gap' };

/** measured once against the real canvas, because a monospace advance is a
 *  property of whatever font the browser actually resolved, not of 0.6 x px. */
let CPL = 42;
let cplMeasured = false;

function wrap(t: string, cpl: number, hang = 0): string[] {
  const out: string[] = [];
  const words = t.split(/\s+/).filter(Boolean);
  let cur = '';
  let width = cpl;
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= width) { cur += ` ${w}`; continue; }
    out.push(cur);
    cur = w;
    width = cpl - hang;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

/** label · leader dots · value, filled to the column. Two lines if it will not
 *  fit on one, which keeps a long shop name from silently losing its price. */
function rowLines(a: string, b: string, cpl: number): string[] {
  if (!b) return [a];
  if (a.length + b.length + 2 <= cpl) {
    const dots = '.'.repeat(cpl - a.length - b.length - 2);
    return [`${a} ${dots} ${b}`];
  }
  return [a, ' '.repeat(Math.max(0, cpl - b.length)) + b];
}

function layout(book: Book, cpl: number): Line[][] {
  const lines: Line[] = [];
  const flushTo = (n: number) => { while (lines.length % n !== 0) lines.push({ s: 'gap' }); };
  for (const b of book.body) {
    if (b.k === 'break') { flushTo(PER_PAGE); continue; }
    if (b.k === 'gap') { if (lines.length % PER_PAGE !== 0) lines.push({ s: 'gap' }); continue; }
    if (b.k === 'rule') { lines.push({ s: 'rule' }); continue; }
    if (b.k === 'h') {
      // never orphan a heading at the foot of a page
      const left = PER_PAGE - (lines.length % PER_PAGE);
      if (left < 4) flushTo(PER_PAGE);
      else if (lines.length % PER_PAGE !== 0) lines.push({ s: 'gap' });
      lines.push({ s: 'h', t: b.t });
      continue;
    }
    if (b.k === 'r') {
      for (const t of rowLines(b.a, b.b, cpl)) lines.push({ s: 't', t, ind: 0 });
      continue;
    }
    if (b.k === 'l') {
      const ws = wrap(b.t, cpl - 2, 0);
      ws.forEach((t, i) => lines.push({ s: 't', t: i === 0 ? `· ${t}` : t, ind: i === 0 ? 0 : 2 }));
      continue;
    }
    for (const t of wrap(b.t, cpl)) lines.push({ s: 't', t, ind: 0 });
  }
  const pages: Line[][] = [];
  for (let i = 0; i < lines.length; i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE));
  return pages.length ? pages : [[]];
}

/** page 0 of every book is its half-title, so `sheets` is [null, ...pages] and
 *  spread n shows sheets[2n] and sheets[2n+1]. */
const paged = new Map<Book, Line[][]>();
function pagesOf(book: Book): Line[][] {
  let v = paged.get(book);
  if (!v) { v = layout(book, CPL); paged.set(book, v); }
  return v;
}
function spreadsOf(book: Book): number {
  return Math.ceil((pagesOf(book).length + 1) / 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PAGE — DRAWING
// ═══════════════════════════════════════════════════════════════════════════

function drawPaper(g: CanvasRenderingContext2D): void {
  g.fillStyle = PAPER;
  g.fillRect(PG_LX0, PG_Y0, PG_LX1 - PG_LX0, PG_Y1 - PG_Y0);
  g.fillRect(PG_RX0, PG_Y0, PG_RX1 - PG_RX0, PG_Y1 - PG_Y0);
  // the gutter: the paper curving down into the spine
  for (let i = 0; i < 6; i++) {
    const a = 0.06 + i * 0.045;
    g.fillStyle = `rgba(60,44,24,${a.toFixed(3)})`;
    g.fillRect(PG_LX1 - 1 - i, PG_Y0, 1, PG_Y1 - PG_Y0);
    g.fillRect(PG_RX0 + i, PG_Y0, 1, PG_Y1 - PG_Y0);
  }
  g.fillStyle = '#4a3418';
  g.fillRect(PG_LX1, PG_Y0, PG_RX0 - PG_LX1, PG_Y1 - PG_Y0);
  // the head and tail edges, a shade darker where the block is cut
  g.fillStyle = PAPER_LO;
  g.fillRect(PG_LX0, PG_Y1 - 2, PG_LX1 - PG_LX0, 2);
  g.fillRect(PG_RX0, PG_Y1 - 2, PG_RX1 - PG_RX0, 2);
}

function drawColumn(
  g: CanvasRenderingContext2D, x0: number, page: Line[] | null,
  running: string, folio: number | null,
): void {
  if (!page) return;
  g.font = font(6);
  g.fillStyle = INK_DIM;
  g.fillText(running, x0, HEAD_Y);
  g.fillRect(x0, HRULE_Y, COL_W, 1);
  let y = BODY_Y0;
  for (const ln of page) {
    if (ln.s === 'gap') { y += LH; continue; }
    if (ln.s === 'rule') {
      g.fillStyle = INK_DIM;
      g.fillRect(x0 + COL_W * 0.25, y - 3, COL_W * 0.5, 1);
      y += LH;
      continue;
    }
    if (ln.s === 'h') {
      g.font = font(HEAD_PX, true);
      g.fillStyle = INK_HEAD;
      g.fillText(ln.t, x0, y);
      y += LH;
      continue;
    }
    g.font = font(BODY_PX);
    g.fillStyle = INK;
    g.fillText(ln.t, x0 + ln.ind * (COL_W / CPL), y);
    y += LH;
  }
  if (folio !== null) {
    g.font = font(6);
    g.fillStyle = INK_DIM;
    g.textAlign = 'center';
    g.fillText(String(folio), x0 + COL_W / 2, FOLIO_Y);
    g.textAlign = 'left';
  }
}

function drawHalfTitle(g: CanvasRenderingContext2D, book: Book): void {
  const cx = COL_LX + COL_W / 2;
  g.textAlign = 'center';
  g.font = font(6);
  g.fillStyle = INK_DIM;
  g.fillText('CROSSTOWN BRANCH', cx, 76);
  g.fillText('PUBLIC LIBRARY', cx, 85);
  g.fillStyle = INK_DIM;
  g.fillRect(COL_LX + 40, 96, COL_W - 80, 1);
  g.font = font(9, true);
  g.fillStyle = INK;
  for (const [i, t] of wrap(book.title, 22).entries()) g.fillText(t, cx, 126 + i * 13);
  g.font = font(6);
  g.fillStyle = INK_DIM;
  for (const [i, t] of wrap(book.sub, 34).entries()) g.fillText(t, cx, 160 + i * 9);
  g.fillRect(COL_LX + 40, 196, COL_W - 80, 1);
  g.font = font(6);
  g.fillStyle = INK;
  g.fillText(book.dewey, cx, 214);
  g.fillStyle = INK_DIM;
  g.fillText('REFERENCE', cx, 228);
  g.fillText('NOT FOR LOAN', cx, 237);
  g.textAlign = 'left';
}

function drawBook(g: CanvasRenderingContext2D, book: Book, spread: number): void {
  g.fillStyle = SURROUND;
  g.fillRect(0, 0, CW, CH);
  // the boards
  g.fillStyle = book.cloth;
  g.fillRect(COV_X0, COV_Y0, COV_X1 - COV_X0, COV_Y1 - COV_Y0);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(COV_X0, COV_Y0, COV_X1 - COV_X0, 1);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(COV_X0, COV_Y1 - 2, COV_X1 - COV_X0, 2);
  drawPaper(g);

  // the head band: the way back to the shelf, and the running title in gilt
  g.font = font(6, true);
  g.fillStyle = book.gilt;
  g.fillText('◀ THE SHELF', TAB.x + 4, BAND_Y1 - 4);
  g.textAlign = 'right';
  g.fillText(book.title, COV_X1 - 10, BAND_Y1 - 4);
  g.textAlign = 'left';

  const pages = pagesOf(book);
  const left = spread === 0 ? null : pages[spread * 2 - 1] ?? null;
  const right = pages[spread * 2] ?? null;
  if (spread === 0) drawHalfTitle(g, book);
  else drawColumn(g, COL_LX, left, book.title, spread * 2);
  drawColumn(g, COL_RX, right, right ? book.sub.toUpperCase() : '', right ? spread * 2 + 1 : null);

  // the fore-edge cue that there is more to turn to
  g.font = font(6);
  g.fillStyle = INK_DIM;
  if (spread > 0) { g.fillText('◀', PG_LX0 + 3, PG_Y1 - 8); }
  if (spread < spreadsOf(book) - 1) {
    g.textAlign = 'right';
    g.fillText('▶', PG_RX1 - 3, PG_Y1 - 8);
    g.textAlign = 'left';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SHELF — DRAWING
// ═══════════════════════════════════════════════════════════════════════════
//
// Two boards of five, which is the trolley you are standing at. Every spine is
// its own rectangle and `hot`, `click` and the painter all read THE SAME rects,
// so a book cannot be drawn where a click does not land.

interface Rect { x: number; y: number; w: number; h: number }
const inRect = (q: Rect, x: number, y: number): boolean =>
  x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h;

/** back to the shelf, on the head band of the boards */
const TAB: Rect = { x: 10, y: BAND_Y0, w: 78, h: BAND_Y1 - BAND_Y0 };
/** the two page halves: turn back, turn on */
const PREV: Rect = { x: PG_LX0, y: PG_Y0, w: PG_LX1 - PG_LX0, h: PG_Y1 - PG_Y0 };
const NEXT: Rect = { x: PG_RX0, y: PG_Y0, w: PG_RX1 - PG_RX0, h: PG_Y1 - PG_Y0 };

const SH_X0 = 26, SH_SLOT = (CW - 2 * SH_X0) / 5;
/** the two board tops. The lower one stops at 272 and not at the cover's own
 *  282, because the framework prints the way OUT across the bottom of this
 *  canvas and a spine standing in that strip would be read through the type. */
const SH_BOARD = [148, 272];
const SH_TALL = 104;                   // a nominal spine height

/** deterministic per-book jitter — never `Math.random`, which at build time
 *  rides the seeded world stream (GOTCHAS §2) and would move every dither
 *  painted after this module. */
const jit = (i: number, salt: number) => {
  let s = Math.imul((i + 1) ^ Math.imul(salt, 0x9e3779b1), 2246822519) >>> 0;
  s ^= s >>> 13; s = Math.imul(s, 3266489917) >>> 0;
  return (s >>> 8) / 16777216;
};

function spineRect(i: number): Rect {
  const row = i < 5 ? 0 : 1, col = i % 5;
  const w = 46 + jit(i, 11) * 12;
  const x = SH_X0 + col * SH_SLOT + (SH_SLOT - w) / 2;
  const hgt = SH_TALL - jit(i, 29) * 16;
  return { x, y: SH_BOARD[row] - hgt, w, h: hgt };
}

function drawSpine(g: CanvasRenderingContext2D, i: number, sel: boolean): void {
  const q = spineRect(i);
  const b = BOOKS[i];
  const lift = sel ? 5 : 0;
  const y = q.y - lift, hgt = q.h + lift;
  g.fillStyle = b.cloth;
  g.fillRect(q.x, y, q.w, hgt);
  // the hinge joints either side, and the head cap
  g.fillStyle = 'rgba(0,0,0,0.34)';
  g.fillRect(q.x, y, 2, hgt);
  g.fillRect(q.x + q.w - 2, y, 2, hgt);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(q.x + 2, y, q.w - 4, 1);
  // gilt bands
  g.fillStyle = b.gilt;
  g.fillRect(q.x + 4, y + 9, q.w - 8, 1);
  g.fillRect(q.x + 4, y + 13, q.w - 8, 1);
  // the branch's own label on the tail
  g.fillStyle = '#e4e0d0';
  g.fillRect(q.x + 5, y + hgt - 20, q.w - 10, 13);
  g.fillStyle = '#3a3428';
  g.font = font(5);
  g.textAlign = 'center';
  g.fillText(b.dewey, q.x + q.w / 2, y + hgt - 10);
  g.textAlign = 'left';
  // the title, read bottom-to-top the way a spine is
  g.save();
  g.translate(q.x + q.w / 2, y + hgt - 26);
  g.rotate(-Math.PI / 2);
  g.fillStyle = b.gilt;
  g.font = font(6, true);
  g.textBaseline = 'middle';
  g.fillText(b.spine, 0, 0);
  g.textBaseline = 'alphabetic';
  g.restore();
  if (sel) {
    g.strokeStyle = '#f0e4bc';
    g.lineWidth = 1;
    g.strokeRect(q.x - 1.5, y - 1.5, q.w + 3, hgt + 3);
  }
}

function drawShelf(g: CanvasRenderingContext2D, sel: number): void {
  g.fillStyle = '#241a12';
  g.fillRect(0, 0, CW, CH);
  // the card taped to the end panel
  g.fillStyle = '#e4dcc4';
  g.fillRect(CW / 2 - 96, 10, 192, 26);
  g.fillStyle = '#3a2f20';
  g.font = font(7, true);
  g.textAlign = 'center';
  g.fillText('REFERENCE — NOT FOR LOAN', CW / 2, 23);
  g.font = font(6);
  g.fillStyle = '#6a5c44';
  g.fillText('PLEASE DO NOT RE-SHELVE', CW / 2, 32);
  g.textAlign = 'left';
  for (let i = 0; i < BOOKS.length; i++) drawSpine(g, i, i === sel);
  // the two boards the books stand on, over their feet
  for (const top of SH_BOARD) {
    g.fillStyle = '#6a4a2c';
    g.fillRect(16, top, CW - 32, 7);
    g.fillStyle = '#4a3018';
    g.fillRect(16, top + 7, CW - 32, 3);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(16, top, CW - 32, 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE WIRING
// ═══════════════════════════════════════════════════════════════════════════

export function register(ctx: CtxBuild): void {
  let panel: Panel | null = null;
  /** the runtime `three`, once the dynamic import lands. See the note on
   *  PAGE_W: nothing is constructed until it does, and never in this call. */
  let T: typeof THREE | null = null;
  /** the open book on the board — the surface the panel is painted onto */
  let page: THREE.Mesh | null = null;
  void import('three').then((m) => { T = m; });
  /** null on the shelf, an index once a book is off it */
  let open: number | null = null;
  let sel = 0;
  let spread = 0;

  const clampSpread = () => {
    if (open === null) return;
    const n = spreadsOf(BOOKS[open]);
    spread = Math.max(0, Math.min(n - 1, spread));
  };

  const draw = (g: CanvasRenderingContext2D): void => {
    // MEASURE ONCE, then re-paginate: a monospace advance is whatever font the
    // browser resolved, not 0.6 x the pixel size, and a book laid out against a
    // guess loses its right-hand column on some machines and not others.
    if (!cplMeasured) {
      cplMeasured = true;
      g.font = font(BODY_PX);
      const adv = g.measureText('MMMMMMMMMM').width / 10;
      const n = adv > 0.5 ? Math.floor(COL_W / adv) : CPL;
      if (n !== CPL && n > 12) { CPL = n; paged.clear(); }
    }
    if (open === null) drawShelf(g, sel);
    else { clampSpread(); drawBook(g, BOOKS[open], spread); }
  };

  const toShelf = () => { if (open !== null) { sel = open; open = null; } };
  const openBook = (i: number) => { open = i; sel = i; spread = 0; };
  const turn = (d: number) => {
    if (open === null) { sel = (sel + d + BOOKS.length) % BOOKS.length; return; }
    const n = spreadsOf(BOOKS[open]);
    spread = Math.max(0, Math.min(n - 1, spread + d));
  };

  const onKey = (k: string): void => {
    if (k === 'arrowleft') turn(-1);
    else if (k === 'arrowright') turn(1);
    else if (k === 'arrowup') { if (open === null) turn(-1); else turn(-1); }
    else if (k === 'arrowdown') { if (open === null) turn(1); else turn(1); }
    else if (k === 'enter' || k === ' ') { if (open === null) openBook(sel); else turn(1); }
    // BACK TO THE SHELF GETS ITS OWN KEY AND IS NEVER ESCAPE. Escape has one
    // meaning everywhere in this world — leave — and a panel that overloads it
    // into a second, screen-dependent meaning is how a view stops being
    // leaveable. Same ruling `ct/library-pc.ts` made for TAB.
    else if (k === 'tab' || k === 'backspace') toShelf();
    else return;
    panel?.repaint();
  };

  const hotAt = (x: number, y: number): boolean => {
    if (open === null) return BOOKS.some((_, i) => inRect(spineRect(i), x, y));
    return inRect(TAB, x, y) || inRect(PREV, x, y) || inRect(NEXT, x, y);
  };

  const clickAt = (x: number, y: number): void => {
    if (open === null) {
      const i = BOOKS.findIndex((_, n) => inRect(spineRect(n), x, y));
      if (i >= 0) { openBook(i); panel?.repaint(); }
      return;
    }
    if (inRect(TAB, x, y)) { toShelf(); panel?.repaint(); return; }
    if (inRect(PREV, x, y)) { turn(-1); panel?.repaint(); return; }
    if (inRect(NEXT, x, y)) { turn(1); panel?.repaint(); }
  };

  const moveAt = (x: number, y: number): void => {
    if (open !== null) return;
    const i = BOOKS.findIndex((_, n) => inRect(spineRect(n), x, y));
    if (i >= 0 && i !== sel) { sel = i; panel?.repaint(); }
  };

  // `ct/hud.ts` by DYNAMIC import, the move `ct/library-pc.ts`, `slots.ts` and
  // `blackjack.ts` all make and document: a dynamic import is not part of the
  // static graph, so it cannot take part in the glob cycle GOTCHAS §28 warns
  // about, and `hud.ts` reaches `virtual:build-stamp`, which does not exist
  // outside the bundler.
  void import('./hud').then(({ makePanel }) => {
    panel = makePanel({
      // FRAMELESS: `draw` already paints a complete object — a shelf of books,
      // or an open book on a desk — edge to edge. The framework's beige
      // cabinet would be a machine drawn around a picture of a book.
      id: 'ct-library-books', w: CW, h: CH, scale: 2, chrome: 'none',
      hint: () => (open === null
        ? 'click a book · ← → choose · ENTER open · [E] step back'
        : 'click the page to turn · ← → pages · TAB the shelf · [E] put it back'),
      // NO `typing`: nothing on these pages takes text, so `[E]` closes from
      // every screen exactly as it does at every other machine in the world,
      // and Escape closes on top of that. There is no state in here that E and
      // Escape do not both leave.
      draw,
      key: (k) => onKey(k),
      wheel: (d) => { turn(d); panel?.repaint(); },
      surface: {
        // the book on the board. `null` would degrade to the screen-space
        // cabinet AND take the mouse with it (see the note above `PAGE_W`), so
        // the spot is not registered at all until this exists.
        mesh: () => page,
        standoff: PAGE_STANDOFF,
        fov: PAGE_FOV,
        faceYaw: PAGE_YAW,
        hot: hotAt,
        click: clickAt,
        move: moveAt,
      },
    });
  });

  // ── the prompt on the trolley ────────────────────────────────────────────
  //
  // Registered ONCE, from a frame hook, as soon as the search finds the boards
  // — the same shape `ct/library-pc.ts` uses to register its re-aimed spot,
  // and for the same reason: the object cannot be found at build time because
  // this module builds before nothing and reads a world that is still being
  // assembled around it.
  let spot: Spot | null = null;
  let looked = 0;

  ctx.onFrame((f) => {
    if (spot || !panel || !T) return;
    if (f.t < looked) return;
    looked = f.t + 1.0;                       // a whole-scene traverse: once a second
    const m = findTrolley(ctx.scene);
    if (!m) {
      if (f.t > 12) {
        console.warn('[ct-library-books] no 0.52 x 0.06 x 0.86 board in the scene — the'
          + ' returns trolley in ct/int-library.ts has been re-sized or removed, so the'
          + ' reference shelf has no [E] prompt. Re-point findTrolley().');
        looked = Infinity;
      }
      return;
    }
    m.updateWorldMatrix(true, false);
    const e = m.matrixWorld.elements;
    const tx = e[12], ty = e[13], tz = e[14];
    const floor = ty - BOARD_Y;

    // ── the book, lying open on the board ──────────────────────────────────
    //
    // Cream paper with a gutter and the grey of type on it, at 24 x 16 texels
    // — this is what the object looks like from across the room, and the panel
    // paints over it the moment you lean in. Nearest-filtered, like everything
    // else in this world.
    const cv = document.createElement('canvas');
    cv.width = 24; cv.height = 16;
    const g = cv.getContext('2d');
    if (g) {
      g.fillStyle = '#e9e2ce'; g.fillRect(0, 0, 24, 16);
      g.fillStyle = '#c9c0a6'; g.fillRect(0, 0, 24, 1); g.fillRect(0, 15, 24, 1);
      g.fillStyle = '#8d8064';
      g.fillRect(11, 0, 2, 16);                       // the gutter
      g.fillStyle = 'rgba(70,62,44,0.45)';
      for (let y = 3; y < 14; y += 2) {               // the grey of set type
        g.fillRect(2, y, 8, 1);
        g.fillRect(14, y, 8, 1);
      }
    }
    const tex = new T.CanvasTexture(cv);
    tex.magFilter = T.NearestFilter;
    tex.minFilter = T.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = T.SRGBColorSpace;
    page = new T.Mesh(
      new T.PlaneGeometry(PAGE_W, PAGE_H),
      new T.MeshBasicMaterial({ map: tex }),
    );
    page.name = 'ct-library-books-page';
    // face up, with the top of the page toward +x — see PAGE_YAW. Default XYZ
    // order, so the roll is applied first and the tip second: local +y ends up
    // on world +x and the normal on world +y.
    page.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    page.position.set(tx + PAGE_DX, floor + PAGE_DY, tz);
    ctx.scene.add(page);

    spot = {
      x: tx, z: tz,
      // 1.35 m: the trolley's own collider is 0.62 x 0.96, so this reaches
      // about half a metre past its faces and no further — you are offered the
      // books when you are standing AT them.
      r: 1.35,
      aimX: page.position.x, aimZ: page.position.z,
      obj: m,
      // the gallery runs over part of this room; a reader on the deck is not
      // standing at this trolley however square he is with it in plan.
      ok: () => Math.abs(ctx.player.gy() - floor) < 0.5 && !ctx.player.seated(),
      label: () => 'read the books',
      act: () => panel?.open(),
    };
    ctx.spot(spot);
  }, HOOK.LATE);
}

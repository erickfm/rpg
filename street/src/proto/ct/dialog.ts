import * as THREE from 'three';
import { ORDER, type CtxBuild } from './ctx';
import { UI, registerHeldObject } from './hud';
import { registerOsdBusy } from './osd';

/**
 * ── THE DIALOG SYSTEM ──────────────────────────────────────────────────────
 *
 * *"lets create a dialog system so we dont have to manage it in the e prompt
 *  style"*   (2026-08-07)
 *
 * *"i want it to be like a chat bubble that looks like an overlay but when you
 *  move the chat exists in the world and stays tied to the npc speaking. like a
 *  floating chat message"*   (2026-08-07, one minute later — and it settles the
 *  shape)
 *
 * Everything anybody in this world had to say went out through `hudNote` — the
 * transient strip the HUD prints "you paid the rent" on. That is a NOTICE
 * BOARD, not a mouth: it is anchored to the corner of the screen, it says
 * nothing about WHO is talking, only one of them can be up at a time by
 * accident rather than by design, and every speaker had to hand-tune its own
 * dwell in milliseconds (the park kid's line carries a `7200` typed by hand,
 * with a paragraph explaining why 2400 was wrong for it).
 *
 * So: a BUBBLE, and his second message is the whole specification of it.
 *
 *   · **It is HIS speech, so it faces where HE faces.** (2026-08-09: *"the
 *     speech bubble shouldnt rotate with my view it should rotate with the
 *     character, it is his speech."* The first pass billboarded it to the
 *     camera; he overruled that on sight.) The card hangs at the speaker's
 *     crown and turns with the speaker's own facing — walk around him and you
 *     see it edge-on, stand behind him and you are behind the words (the
 *     material is DoubleSide, so from the back you see the back of his speech,
 *     mirrored, exactly like a hand-held sign). Legibility in the normal case
 *     is carried by the SPEAKERS, not the card: every talker so far turns to
 *     face the player — the kid and the dealer through `loiter`'s notice turn,
 *     the salesman by standing at a counter that faces the room — so the
 *     moment you are close enough to talk, you are the thing he is facing.
 *
 *   · **It is in the world, at a fixed WORLD size.** `MPT` metres per texel,
 *     sized so the type reads comfortably at conversation range (a metre or
 *     two, where the `[E]` spot puts you). It shrinks with distance like
 *     everything else in the room, because it is a thing in the room; a card
 *     that held its screen size while turned edge-on would be neither overlay
 *     nor object.
 *
 *   · **It still draws over geometry.** `depthTest: false` and a renderOrder
 *     past everything else. Deliberately kept from the first pass even though
 *     the card is now a world object: the bubble is INK, not furniture, and
 *     the dealer talks in an alley where a 1.6 m card angled by his facing
 *     would otherwise clip mid-sentence into the wall he loiters against. A
 *     bubble a wall can eat half of is unreadable in a worse way than one
 *     that overdraws a railing.
 *
 * ── IT IS NOT A PANEL, AND THAT IS DELIBERATE ─────────────────────────────
 *
 * *"a panel you cannot close is the worst bug this project ships."* This
 * swallows NOTHING. No pointer lock, no captured keydown, no frozen feet, no
 * dimmed world — you can walk, look, jump and press `[E]` on something else
 * with a bubble up. So the trap this project fears cannot be built out of it.
 * It still closes five different ways, because "the way out is obvious" is not
 * the same as "there is a way out":
 *
 *   1. **Escape**, from every screen. (Handled here, and NOT swallowed: the
 *      press still reaches `fp.ts`, so Escape while seated still stands you up
 *      as well. The OSD menu is kept off the same press by a `registerOsdBusy`
 *      claim with a settle window — see `dismissedAt`.)
 *   2. **`[E]` again**, which pages forward and closes off the last page. The
 *      key that started the conversation is the key that finishes it.
 *   3. **Walking away** past `leave` metres. It is in the world; leaving is
 *      leaving.
 *   4. **Sitting down or standing up.** Any change of seated state ends it.
 *   5. **A timer.** Every page has a dwell derived from its own length, so a
 *      bubble left behind by a player who has wandered off cannot outlive the
 *      moment even if all four above are somehow missed.
 *
 * ── ONE VOICE AT A TIME ───────────────────────────────────────────────────
 *
 * There is exactly one bubble in the world and one `live` conversation. A
 * second speaker starting takes it over. Two people talking over each other in
 * overlapping cards at head height is unreadable, and a queue would mean a
 * shopkeeper finishing a sentence you walked away from three rooms ago.
 *
 * ── WHAT A SPEAKER COSTS ──────────────────────────────────────────────────
 *
 *     const kid = talker(ctx, { obj: kidSprite.mesh, name: 'kid', lines: [LINE] });
 *     …
 *     act: () => kid.say(),
 *
 * Two lines. No dwell, no panel, no `hudNote`, no wondering where on the screen
 * it lands. `say()` with an argument speaks something worked out on the spot
 * (the pawnbroker's price), `say()` with none speaks the script it was built
 * with, and `say()` while it is already talking turns the page.
 */

// ── THE CANVAS ─────────────────────────────────────────────────────────────
//
// Texels, and every draw origin below is an INTEGER of them — the paint is
// still hard-edged in its own pixels even though the card now lives at world
// scale and is sampled like any other surface in the room.
const CW = 248, CH = 128;
/**
 * METRES PER TEXEL — the card's one size, fixed in the world.
 *
 * 0.0065 makes the card 1.61 m wide and at most 0.83 m tall, and puts the
 * 11-texel type at ~7 mm per texel — which at the 1–2 m the `[E]` spot radius
 * holds a conversation at is comfortably larger on screen than the HUD's own
 * type. It shrinks with range after that, as a thing in the world must; the
 * far case that exists today (the VOLT salesman heckling from 9.5 m) stays
 * legible because his lines are six words long, not because the card cheats.
 */
const MPT = 0.0065;
/** transparent texels below the tail's tip, so the point of the tail sits ON
 *  the speaker's crown with a 5 cm air gap drawn into the texture itself. */
const GAP = 8;
/** the tail: 12 texels tall, 10 wide at the root, tip pulled 4 texels off
 *  the bubble's centre — a comic tail leans, it does not plumb. */
const TAIL = 12, TAIL_W = 10, TAIL_LEAN = 4;
const BX = 4, BW = CW - BX * 2;
const PAD = 8;
const LH = 14, FS = 11;
/** lines of speech per page. 5 × 14 + padding fits `CH` with room. */
const MAXL = 5;
const TEXT_W = BW - PAD * 2;
/** a one-line bubble never shrinks below this — a bare "No." floating in a
 *  postage stamp reads as a tooltip, not speech. */
const MIN_W = 64;

// ── THE LOOK: a comic-strip speech bubble ──────────────────────────────────
//
// *"i dont like the dialog bubbles they need a redesign. try again."*
// (2026-08-09.) The first look was a dark navy card with an amber name and
// cream terminal type — a floating CRT window, the exact register `hud.ts`
// uses for MACHINES. Speech is not a machine. So: newspaper-comic / SNES-era
// RPG — warm white paper, thin dark outline, corners rounded in pixel STEPS
// (drawn, not CSS-smooth), a leaning pointed tail down to the speaker, dark
// crisp type. The name line is GONE entirely: the tail says who is speaking,
// and he hates a label that repeats what the picture already shows.
const PAPER = '#f7f2e2';       // warm white — newsprint, not sterile
const PAPER_LO = '#e6dfc9';    // one shade down, laid along the bottom edge
const OUTLINE = '#2a241c';     // near-black warm ink, 2 texels
const INK = '#241d13';         // the words

// ── the one bubble ─────────────────────────────────────────────────────────
//
// BUILT LAZILY, ON THE FIRST WORD ANYONE SAYS, and that is load-bearing rather
// than thrift. `crosstown.ts` classifies the scene's top-level children into
// "entirely the street" and "not" ONCE, on the first frame, and hides the first
// group whenever the player crosses `REGION_X`. A mesh added at build time sits
// at the origin with a half-metre bounding sphere, would be classified as
// street, and would then be forced invisible every frame the player spent past
// that line — which includes the park. Nothing added AFTER that first frame is
// ever in the list, so waiting for the first `say()` puts the bubble outside
// the cull for good.
let mesh: THREE.Mesh | null = null;
let cv: HTMLCanvasElement | null = null;
let g2: CanvasRenderingContext2D | null = null;
let tex: THREE.CanvasTexture | null = null;

interface Live {
  /** the speaker's crown, in world coordinates, read fresh every frame */
  head: () => THREE.Vector3 | null;
  /** which way the SPEAKER faces, read fresh every frame — the card turns
   *  with this, never with the camera. Citizen convention: atan2(vx, vz),
   *  0 faces +z, forward is (sin f, cos f). */
  yaw: () => number;
  pages: string[][];
  page: number;
  /** `performance.now()` at which this page turns itself */
  until: number;
  leave: number;
  /** whether the player was seated when this started; ANY change ends it */
  seated: boolean;
}
let live: Live | null = null;
/** WHICH talker owns the live bubble, so a speaker can tell "am I the one
 *  talking" from "somebody is talking" — the difference between `[E]` turning
 *  MY page and `[E]` interrupting somebody else. An opaque token per talker;
 *  never compared to anything but itself. */
let liveOwner: unknown = null;
/**
 * WHEN THE LAST BUBBLE WENT DOWN.
 *
 * The OSD menu opens on Escape unless somebody claims the press, and claims are
 * asked as a PREDICATE rather than raced as listeners (`ct/osd.ts`). Both
 * listeners are on the same phase, so if this file's handler ran first and
 * cleared `live` outright, the menu's `busy()` would find nothing claiming and
 * open a menu on the same keystroke that closed the bubble. The settle window
 * is `ct/hud.ts`'s own trick at `dismissedAt` for the identical reason.
 */
let dismissedAt = -1e9;

/** is somebody talking right now */
export function dialogSpeaking(): boolean { return live !== null; }

/** shut whoever is talking up, from anywhere */
export function endDialog(): void {
  if (!live) return;
  live = null;
  if (mesh) mesh.visible = false;
}

/**
 * HOW LONG A PAGE STAYS UP, from how much there is to read.
 *
 * The park kid's hand-tuned `7200` was the argument for this existing: he is
 * 130 characters with four stumbles in them and the note's 2400 ms default cut
 * the gag off. 1200 + 45/char puts that same line at 7050 — his number, derived
 * rather than typed, and every future speaker gets it without thinking.
 */
const dwellFor = (lines: string[]): number => {
  const n = lines.reduce((a, l) => a + l.length, 0);
  return Math.max(2600, Math.min(9000, 1200 + n * 45));
};

function ensure(ctx: CtxBuild): void {
  if (mesh) return;
  cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  g2 = cv.getContext('2d')!;
  tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  // LINEAR, WITH MIPMAPS. The first pass used Nearest because the texel-to-
  // screen-pixel mapping never changed; a card at world scale is sampled at
  // every distance and every obliquity, and Nearest there is shimmer, not
  // crispness. The anisotropy is for reading the card at an angle, which is
  // now the DESIGN — you see his speech edge-on when you are not the person
  // he is talking to.
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  // Origin at the BOTTOM CENTRE — the tip of the tail — so `mesh.position` is
  // literally the point being spoken from and the card hangs above it.
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
    // FROM BEHIND YOU SEE THE BACK OF HIS SPEECH — mirrored, like the back of
    // a hand-held sign. His words face where he faces; being behind them is a
    // state the design now has, and an invisible card there would read as the
    // bubble cutting out whenever he turns.
    side: THREE.DoubleSide,
  }));
  // The card's size is fixed in the world and never touched again.
  mesh.scale.set(CW * MPT, CH * MPT, 1);
  mesh.renderOrder = 12000;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.name = 'chat-bubble';
  ctx.scene.add(mesh);
}

// ── wrapping ───────────────────────────────────────────────────────────────
//
// MEASURED, not counted. The type is monospace today and a character count
// would do, but the moment anybody sets a proportional face on a bubble a
// counted wrap starts overflowing the box silently, and the box is drawn from
// the wrap.
function wrap(text: string): string[] {
  const g = g2!;
  g.font = UI.font(FS, true);
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + word : word;
    if (line && g.measureText(next).width > TEXT_W) { out.push(line); line = word; }
    else line = next;
    // a single word longer than the box — a URL, a shout — is cut rather than
    // allowed to run off the edge
    while (g.measureText(line).width > TEXT_W && line.length > 1) {
      let k = line.length - 1;
      while (k > 1 && g.measureText(line.slice(0, k)).width > TEXT_W) k--;
      out.push(line.slice(0, k)); line = line.slice(k);
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

/** A SPEECH is a string; a PAGE is what fits in the box. One speech becomes as
 *  many pages as it needs, and a script of several speeches runs them end to
 *  end — so `lines: ['…', '…']` is a two-beat NPC and needs nothing else. */
const paginate = (speeches: string[]): string[][] => {
  const pages: string[][] = [];
  for (const s of speeches) {
    const lines = wrap(s);
    for (let i = 0; i < lines.length; i += MAXL) pages.push(lines.slice(i, i + MAXL));
  }
  return pages.length ? pages : [['']];
};

// ── painting ───────────────────────────────────────────────────────────────

/**
 * A PIXEL-ROUNDED RECT AS A UNION OF SIX RECTS — the classic way an SNES
 * window rounds a corner. No path, no arc, no anti-aliased diagonal: every
 * edge lands on whole texels, so the rounding is drawn in steps the way the
 * era drew it. The inset pairs are one quadrant of a radius-8 pixel circle.
 */
const ROUND: [number, number][] = [[0, 8], [1, 5], [2, 3], [3, 2], [5, 1], [8, 0]];
function roundRect(g: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, color: string): void {
  g.fillStyle = color;
  for (const [ix, iy] of ROUND) g.fillRect(x + ix, y + iy, w - ix * 2, h - iy * 2);
}

function paint(): void {
  const g = g2!, l = live!;
  const lines = l.pages[l.page];
  const more = l.page < l.pages.length - 1;
  g.clearRect(0, 0, CW, CH);

  // ── SIZED TO THE LINE ────────────────────────────────────────────────────
  // A comic bubble hugs its words. The old card was one fixed slab and three
  // words swam in it; here the box is measured from the widest line of THIS
  // page, floored at MIN_W so a bare "No." still reads as a bubble.
  g.font = UI.font(FS, true);
  let maxw = 0;
  for (const line of lines) maxw = Math.max(maxw, g.measureText(line).width);
  const bw = Math.min(BW, Math.max(MIN_W, Math.ceil(maxw) + PAD * 2 + 4)) & ~1;
  const boxH = PAD * 2 + lines.length * LH;
  const y1 = CH - GAP - TAIL;              // the bubble's bottom edge
  const y0 = y1 - boxH;
  const cx = CW >> 1;
  const bx0 = Math.max(BX, cx - (bw >> 1));

  // ── the bubble: ink shape, then paper inset 2 texels ─────────────────────
  // Outline by TWO FILLS rather than a stroke, so the stepped corners carry
  // the same 2-texel ink line as the straight edges and nothing anti-aliases.
  roundRect(g, bx0, y0, bw, boxH, OUTLINE);
  roundRect(g, bx0 + 2, y0 + 2, bw - 4, boxH - 4, PAPER);

  // ── the tail: pointed, and it LEANS ──────────────────────────────────────
  // Tip dead on the canvas centre — the mesh anchor, so it points at the
  // crown — with the root pulled sideways so the tail sweeps like a stroke of
  // the pen instead of hanging like a plumb line. Ink triangle, then a paper
  // triangle inset at the sides and run 3 texels up INTO the bubble to open
  // the throat through the outline.
  const rx = cx + TAIL_LEAN;               // root centre
  g.beginPath();
  g.moveTo(rx - (TAIL_W >> 1), y1 - 2);
  g.lineTo(rx + (TAIL_W >> 1), y1 - 2);
  g.lineTo(cx, y1 + TAIL);
  g.closePath();
  g.fillStyle = OUTLINE; g.fill();
  g.beginPath();
  g.moveTo(rx - (TAIL_W >> 1) + 2, y1 - 3);
  g.lineTo(rx + (TAIL_W >> 1) - 2, y1 - 3);
  g.lineTo(cx, y1 + TAIL - 3);
  g.closePath();
  g.fillStyle = PAPER; g.fill();

  // a single shade of ageing along the inside of the bottom edge — newsprint,
  // not printer paper. One rect; the whole of the shading budget.
  g.fillStyle = PAPER_LO;
  g.fillRect(bx0 + 6, y1 - 4, bw - 12, 2);

  // ── the words: dark ink, CENTRED, as a strip cartoon sets them ───────────
  g.font = UI.font(FS, true);
  g.fillStyle = INK;
  g.textBaseline = 'top';
  let ty = y0 + PAD;
  for (const line of lines) {
    const lw = g.measureText(line).width;
    g.fillText(line, (bx0 + (bw - lw) / 2) | 0, ty | 0);
    ty += LH;
  }

  // MORE TO COME: a small ink triangle tucked in the bottom-right corner.
  // Drawn rather than typed, because a `▾` glyph is a bet on a font this
  // world has not chosen and would land as a tofu box where it is missing.
  if (more) {
    const ax = bx0 + bw - 7, ay = y1 - 7;
    g.beginPath();
    g.moveTo(ax - 6, ay - 2); g.lineTo(ax, ay - 2); g.lineTo(ax - 3, ay + 2);
    g.closePath();
    g.fillStyle = OUTLINE; g.fill();
  }
  tex!.needsUpdate = true;
}

// ── the speaker handle a module holds ──────────────────────────────────────

export interface Talker {
  /**
   * WHAT THE `[E]` PROMPT SAYS: `'talk'`, always.
   *
   * *"e prompts shouldnt be descriptive. it should just say talk."*
   * (2026-08-09.) The prompt does not name the person — the highlight is
   * already drawn around him and the bubble's tail points at whoever is
   * speaking, so "talk to the kid" was saying everything twice. A spot whose
   * `[E]` offers something that is NOT speech (the dealer's post-pitch buy)
   * writes its own label; a spot that offers talk uses this and never types
   * the word again:
   *
   *     label: t.label,
   */
  label: () => string;
  /**
   * Speak — or, if this bubble is already up, TURN THE PAGE, and close off the
   * last one. That re-entrancy is what lets `[E]` page through a conversation
   * without this file touching the input system at all: the `[E]` dispatch in
   * the trunk already calls a spot's `act()`, and `act: () => t.say()` is
   * therefore both "start talking" and "go on then".
   *
   * With an argument it speaks that instead of the script, for a line worked
   * out at the moment it is said — a price, a name, a refusal.
   */
  say: (text?: string | string[]) => void;
  /** shut this one up, if it is the one talking */
  stop: () => void;
  speaking: () => boolean;
}

export interface TalkerOpts {
  /** WHO IS TALKING. The bubble hangs at the top of this object's bounds and
   *  follows it, so a speaker who walks is handled with no extra wiring. */
  obj: THREE.Object3D;
  /** NOT PAINTED. The 2026-08-09 redesign dropped the name line — the tail
   *  says who is speaking, and he hates a label repeating what the picture
   *  shows. Kept as the talker's identity for its ownership token, and in case
   *  a future look wants it back. */
  name?: string;
  /** the default script. Each entry is a speech; long ones page themselves. */
  lines?: string[] | (() => string[]);
  /** metres of separation that end the conversation. Default 5. */
  leave?: number;
  /**
   * WHICH WAY THE SPEAKER FACES, if the object cannot say for itself.
   *
   * The card turns with the character — *"it is his speech"* — so every talker
   * needs a live facing. Omitted, it is read off the object's
   * `userData.citizenFacing`, which `ct/citizens.ts` keeps current on every
   * sprite for exactly this kind of reader (the sprite MESH is useless here:
   * it billboards toward the camera, which is the orientation this card was
   * just told to stop having). Pass this only for a speaker that is not a
   * citizen sprite. Convention is the citizens' own: atan2(vx, vz), 0 = +z.
   */
  facing?: () => number;
  /** override the crown height above the object's own origin, in metres.
   *  Omitted, it is MEASURED off the object's bounds at the moment it speaks,
   *  which is right for every sprite in this world and needs no magic number
   *  per speaker. */
  headY?: number;
}

export function talker(ctx: CtxBuild, o: TalkerOpts): Talker {
  ensure(ctx);
  install(ctx);
  const wp = new THREE.Vector3();
  const out = new THREE.Vector3();
  const token = { id: o.name ?? 'voice' };
  let crown = o.headY ?? 0;
  const mine = () => live !== null && liveOwner === token;

  const head = (): THREE.Vector3 | null => {
    // A SPEAKER TAKEN OUT OF THE SCENE STOPS TALKING. Citizens are pooled and
    // removed; a bubble left hanging over where somebody used to be is a ghost.
    if (!o.obj.parent) return null;
    o.obj.getWorldPosition(wp);
    return out.set(wp.x, wp.y + crown, wp.z);
  };

  // his facing, read live: the caller's function, else the flag every citizen
  // sprite publishes, else the object's own heading for a non-citizen speaker.
  const yaw = (): number => {
    if (o.facing) return o.facing();
    const f = (o.obj.userData as { citizenFacing?: number }).citizenFacing;
    return typeof f === 'number' ? f : o.obj.rotation.y;
  };

  const say = (text?: string | string[]): void => {
    if (mine()) { turn(); return; }
    const src = text ?? o.lines ?? [];
    const raw = typeof src === 'function' ? src() : src;
    const speeches = (typeof raw === 'string' ? [raw] : raw).filter(Boolean);
    if (!speeches.length) return;
    if (o.headY === undefined) {
      // MEASURED ONCE, on the first word, off the composed sprite rather than
      // guessed from a scale factor — the citizen atlas pads above the crown
      // and that padding is part of the drawn person. Deferred to here and not
      // done at build time because the object may not be placed yet when its
      // module registers the talker.
      const b = new THREE.Box3().setFromObject(o.obj);
      o.obj.getWorldPosition(wp);
      crown = Number.isFinite(b.max.y) ? Math.max(0.3, b.max.y - wp.y) : 1.8;
    }
    const pages = paginate(speeches);
    live = {
      head, yaw, pages, page: 0,
      until: performance.now() + dwellFor(pages[0]),
      leave: o.leave ?? 5, seated: ctx.player.seated(),
    };
    liveOwner = token;
    paint();
  };

  return { say, label: () => 'talk', stop: () => { if (mine()) endDialog(); }, speaking: mine };
}

/** advance a page, or close if that was the last one */
function turn(): void {
  const l = live;
  if (!l) return;
  if (l.page >= l.pages.length - 1) { endDialog(); return; }
  l.page++;
  l.until = performance.now() + dwellFor(l.pages[l.page]);
  paint();
}

// ── the once-per-world wiring ──────────────────────────────────────────────
let installed = false;
function install(ctx: CtxBuild): void {
  if (installed) return;
  installed = true;

  // ESCAPE, AND ONLY ESCAPE. Capture phase so it is seen before anything can
  // consume it, and it does NOT stop propagation: `fp.ts` has two Escape
  // listeners of its own and standing up out of a seat must keep working on the
  // same press. What keeps the OSD menu off it is the claim below, not silence.
  window.addEventListener('keydown', (e) => {
    if (!live) return;
    if (e.key !== 'Escape') return;
    dismissedAt = performance.now();
    endDialog();
  }, true);
  // the menu does not open on the press that closed a bubble
  registerOsdBusy(() => live !== null || performance.now() - dismissedAt < 250);
  // and anything that puts a thing in the player's hands shuts the speaker up
  registerHeldObject(() => endDialog());

  ctx.onFrame(({ px, pz }) => {
    if (!mesh) return;
    const l = live;
    if (!l) { if (mesh.visible) mesh.visible = false; return; }

    const p = l.head();
    if (!p) { endDialog(); return; }
    // WALKED AWAY, or SAT DOWN, or STOOD UP. Three of the five ways out, all of
    // them checked before anything is drawn so none of them can leave a frame
    // of stale bubble behind.
    if (Math.hypot(px - p.x, pz - p.z) > l.leave) { endDialog(); return; }
    if (ctx.player.seated() !== l.seated) { endDialog(); return; }
    if (performance.now() >= l.until) { turn(); if (!live) { mesh.visible = false; return; } }

    mesh.position.copy(p);
    // ── IT TURNS WITH HIM, NEVER WITH THE CAMERA ──────────────────────────
    // *"it is his speech."* The card's yaw is the speaker's own facing, read
    // live — so it swings when the loiter walk turns him to notice you, holds
    // still when you circle him, and shows you its edge or its back when you
    // are not the person being spoken to. Citizen facing is atan2(vx, vz)
    // with 0 = +z, which is exactly a plane's rest orientation, so the angle
    // is used unconverted. Upright always: a speech card has no pitch.
    mesh.rotation.set(0, l.yaw(), 0);
    mesh.visible = true;
  }, ORDER.LATE);
}

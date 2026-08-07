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
 *   · **It looks like an overlay.** Constant apparent size — the quad is
 *     re-scaled every frame so it covers the same number of screen pixels no
 *     matter how far away the speaker is, and the camera's own zoom is read
 *     live so it does not swim when he scrolls. That is what makes it CRISP:
 *     the canvas is painted once at `CW × CH` texels and lands on exactly
 *     `CW*2 × CH*2` CSS pixels forever, so with `NearestFilter` every texel is
 *     a hard 2×2 block at every distance. There is no distance at which this
 *     goes soft, because there is no distance at which the mapping changes.
 *
 *   · **It is in the world, not on the camera.** The mesh sits at the
 *     speaker's crown and faces the camera outright (full quaternion copy, not
 *     the y-only turn `crosstown.ts` gives the billboard list) so it behaves
 *     like a card pinned to a point in the room: walk sideways and it tracks
 *     the NPC across the screen, walk away and it goes with them, turn round
 *     and it is behind you.
 *
 *   · **It draws over everything.** `depthTest: false` and a renderOrder past
 *     everything else, which is the "overlay" half of the ask and also the
 *     answer to getting buried in geometry — a bubble half-swallowed by a
 *     railing is the one failure that would read as broken. It can be seen
 *     through a wall, and that costs nothing, because a conversation ENDS the
 *     moment you walk out of its `leave` radius and there is no wall inside
 *     five metres of a speaker you are talking to.
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
// Texels, and every draw origin below is an INTEGER of them. A builder earlier
// today chased blurry type back to an origin landing on a fractional pixel;
// with `NearestFilter` and the fixed 1 texel = 2 CSS px mapping this file
// guarantees, integers here are hard edges on the screen and nothing else is.
const CW = 248, CH = 128;
/** CSS pixels per texel. 2, the same scale every `makePanel` screen is drawn
 *  at, so the bubble's type is the same size as the world's other type. */
const PXPT = 2;
/** transparent texels below the tail's tip, so the point of the tail can sit
 *  ON the speaker's crown and the gap above their head is measured in SCREEN
 *  pixels like the rest of the bubble, not in metres that shrink with range. */
const GAP = 8;
const TAIL = 8, TAIL_W = 7;
const BX = 4, BW = CW - BX * 2;
const PAD = 9;
const LH = 14, FS = 11;
const NAME_H = 13, NAME_FS = 9;
/** lines of speech per page. 5 × 14 + name + padding fits `CH` with room. */
const MAXL = 5;
const TEXT_W = BW - PAD * 2;

const INK = UI.ink;
const FILL = 'rgba(24,25,29,0.92)';
const EDGE = '#08080a';
const LIP = '#565861';

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
  name?: string;
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
  // NEAREST BOTH WAYS, and no mipmaps. The quad's screen size is pinned to
  // `CW*PXPT` CSS px at every distance, so there is never a minified sample to
  // want a mipmap for — and a mip chain on a canvas that is repainted every
  // page is a re-upload of the whole pyramid for nothing.
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  // Origin at the BOTTOM CENTRE — the tip of the tail — so `mesh.position` is
  // literally the point being spoken from and the card hangs above it.
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  }));
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
function paint(): void {
  const g = g2!, l = live!;
  const lines = l.pages[l.page];
  const more = l.page < l.pages.length - 1;
  g.clearRect(0, 0, CW, CH);

  const nameH = l.name ? NAME_H : 0;
  const boxH = PAD * 2 + nameH + lines.length * LH;
  const y1 = CH - GAP - TAIL;              // the box's bottom edge
  const y0 = y1 - boxH;
  const cx = CW >> 1;

  // ONE PATH for the box and its tail, so the shared edge is never stroked
  // across. Square corners: this world's 1997 chrome has no rounded anything.
  g.beginPath();
  g.moveTo(BX, y0);
  g.lineTo(BX + BW, y0);
  g.lineTo(BX + BW, y1);
  g.lineTo(cx + TAIL_W, y1);
  g.lineTo(cx, y1 + TAIL);
  g.lineTo(cx - TAIL_W, y1);
  g.lineTo(BX, y1);
  g.closePath();
  g.fillStyle = FILL; g.fill();
  g.lineWidth = 2; g.strokeStyle = EDGE; g.lineJoin = 'miter'; g.stroke();
  // the moulded lip, one texel in from the edge on the two lit sides
  g.beginPath();
  g.moveTo(BX + 2.5, y1 - 1); g.lineTo(BX + 2.5, y0 + 2.5); g.lineTo(BX + BW - 2, y0 + 2.5);
  g.lineWidth = 1; g.strokeStyle = LIP; g.stroke();

  let ty = y0 + PAD;
  if (l.name) {
    g.font = UI.font(NAME_FS, true);
    g.fillStyle = UI.amber;
    g.textBaseline = 'top';
    g.fillText(l.name.toUpperCase(), BX + PAD, ty | 0);
    ty += NAME_H;
  }
  g.font = UI.font(FS, true);
  g.fillStyle = INK;
  g.textBaseline = 'top';
  for (const line of lines) { g.fillText(line, BX + PAD, ty | 0); ty += LH; }

  // MORE TO COME: a small solid chevron in the bottom right of the box. Drawn
  // rather than typed, because a `▾` glyph is a bet on a font this world has
  // not chosen and would land as a tofu box on the one machine that lacks it.
  if (more) {
    const ax = BX + BW - PAD, ay = y1 - PAD + 2;
    g.beginPath();
    g.moveTo(ax - 5, ay - 3); g.lineTo(ax, ay - 3); g.lineTo(ax - 2.5, ay + 1);
    g.closePath();
    g.fillStyle = UI.dim; g.fill();
  }
  tex!.needsUpdate = true;
}

// ── the speaker handle a module holds ──────────────────────────────────────

export interface Talker {
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
  /** printed small and amber above the line. Omit for an unnamed voice. */
  name?: string;
  /** the default script. Each entry is a speech; long ones page themselves. */
  lines?: string[] | (() => string[]);
  /** metres of separation that end the conversation. Default 5. */
  leave?: number;
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
      head, name: o.name, pages, page: 0,
      until: performance.now() + dwellFor(pages[0]),
      leave: o.leave ?? 5, seated: ctx.player.seated(),
    };
    liveOwner = token;
    paint();
  };

  return { say, stop: () => { if (mine()) endDialog(); }, speaking: mine };
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

    const cam = ctx.camera;
    mesh.position.copy(p);
    // ── CONSTANT APPARENT SIZE ────────────────────────────────────────────
    // The world height the camera can see at this distance, divided by the
    // viewport's height in CSS pixels, is metres-per-pixel at the bubble. Scale
    // the quad by that and it covers `CW*PXPT × CH*PXPT` pixels at any range,
    // any fov (the zoom is read fresh, so it does not swim when he scrolls) and
    // any window size.
    const d = Math.max(0.35, mesh.position.distanceTo(cam.position));
    const vh = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const mpp = vh / Math.max(1, window.innerHeight);
    mesh.scale.set(CW * PXPT * mpp, CH * PXPT * mpp, 1);
    // FULL camera facing, not the y-only turn the billboard list does. A card
    // pinned to a point on the screen does not shear when you look up at it.
    mesh.quaternion.copy(cam.quaternion);
    mesh.visible = true;
  }, ORDER.LATE);
}

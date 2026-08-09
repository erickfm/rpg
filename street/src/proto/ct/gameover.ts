// ══ GAME OVER ═══════════════════════════════════════════════════════════════
//
// *"make cars hit you and cause damage, should be a consistent amount of
//  damage but on game start two cars hitting you should always kill you and
//  end your game."*   (2026-08-08)
//
// The END of it — "end your game". `ct/carhit.ts` owns what a car costs; this
// module owns what zero means, and it is wired to the NUMBER, not to the car:
// anything that ever drives `ct/health.ts` to 0 through its own verbs lands
// here. (The one deliberate exception is the pass-out in `ct/fatigue.ts`,
// which floors itself at 1 HP by its own line — a mugging, not an ending —
// and that floor is its to keep.)
//
// THE CARD IS THE TELEVISION'S. Same conceit as `ct/osd.ts`, same palette,
// same 320 x 240 texel grid, arrived at through the same snow — a 1997 VCR
// that has run to the end of the tape. It is deliberately TERMINAL: the run
// is over, and the only road out is NEW GAME, which is `ct/newgame.ts`'s
// `wipe()` — the same machinery the menu's confirm uses, dead-flag and all,
// so the dying page cannot re-save the old world over the fresh one (the bug
// newgame.ts exists to hold down).
//
// ⚠ TERMINAL MUST NEVER MEAN STUCK. The worst bug this project ships is a
// panel you cannot close, and a death card is the one screen that MAY refuse
// to close — so everything that could eat its one working key is put down
// first and KEPT down: panels are closed on arrival and every frame after
// (`ct/hud.ts`'s gate swallows keydown at capture while one is up, and a held
// [E] on the way down can still open one behind the card), the bag likewise,
// the OSD menu is closed and handed a busy claim so Escape cannot raise it
// over the card, and NEW GAME answers to four keys and the mouse.
//
// ⚠ THE SAVE DOES NOT RESURRECT. Dying is saved like any other change (hp 0
// flushes through `ct/save.ts`'s health slice), and this module watches the
// number FROM REGISTRATION — a reload with a dead save restores hp 0, the
// watcher fires, and the card is back before the world can be walked. The
// only door out of a finished life stays NEW GAME.
//
// IMPORT SHAPE, argued once: the paint kit comes from `ct/osd.ts`'s own
// exports (one television, one palette, one cursor — its header demands
// exactly this reuse), `closePanels` from the HUD, `showBag` from the bag,
// `wipe` from the leaf. Nothing imports this module except `ct/world.ts`'s
// glob and `ct/carhit.ts` (for the cause line below), so no cycle can close
// through here (GOTCHAS §28).

import { health, onHealthChange } from './health';
import {
  OW, OH, INK, DIM, font, row, heading, legend, osdFrame, snow, rollBar,
  registerOsdBusy, close as closeOsd,
} from './osd';
import { closePanels } from './hud';
import { showBag } from './bag';
import { wipe } from './newgame';
import type { CtxBuild } from './ctx';

/** What the card names as the end. Set by whoever is about to deal the
 *  killing kind of damage, just before dealing it — `ct/carhit.ts` today. A
 *  string and not an enum: the next cause should cost its author one line. */
let cause = 'YOU DIED';
export function setCauseOfDeath(text: string): void { cause = text; }

let dead = false;
/** is the card up — for anything that must stand down while the run is over */
export function gameOverUp(): boolean { return dead; }

// ── timing ──────────────────────────────────────────────────────────────────
/** world to black. Slower than any panel cut on purpose: it is a death, not a
 *  door. */
const FADE_MS = 1150;
/** black to the blue field, through the set's own snow — `ct/osd.ts`'s 200 ms
 *  fuzz, a touch longer because nothing here is in a hurry any more. */
const FUZZ_MS = 240;
/** keys are ignored until the card has been readable for a beat, so a held
 *  movement key or a panic mash on the way down cannot erase the save the
 *  instant the card appears. */
const ARM_MS = 600;

let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let bornAt = 0;

function build(): void {
  if (wrap) return;
  wrap = document.createElement('div');
  wrap.id = 'ct-gameover';
  // z 60: over the OSD's 40. Nothing outranks the end of the tape.
  wrap.style.cssText = 'position:fixed;inset:0;z-index:60;display:none;'
    + 'background:#000;align-items:center;justify-content:center;opacity:0;'
    + `transition:opacity ${FADE_MS}ms ease-in;`;
  cv = document.createElement('canvas');
  cv.width = OW; cv.height = OH;
  // the OSD's own sizing, texels blown up nearest-neighbour
  cv.style.cssText = 'image-rendering:pixelated;display:none;'
    + 'width:min(100vw,133vh);height:min(75vw,100vh);';
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
}

const armed = () => performance.now() - bornAt >= FADE_MS + FUZZ_MS + ARM_MS;

function paintCard(g: CanvasRenderingContext2D, specks: number): void {
  osdFrame(g);
  // the corner stamp a VCR wears when the tape stops
  g.font = font(11); g.fillStyle = DIM;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText('■ STOP', 14, 22);
  heading(g, 'GAME OVER', 84);
  g.font = font(12); g.fillStyle = INK;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(cause.toUpperCase(), OW / 2, 122);
  g.textAlign = 'left';
  // the one road out, permanently selected — the inverse-video block is the
  // OSD's own cursor, and here it has nowhere else to be
  const label = 'NEW GAME';
  g.font = font(14);
  const w = g.measureText(label).width;
  row(g, label, Math.round((OW - w) / 2), 178, 14, true);
  legend(g, [['START', 'ENTER KEY']]);
  if (specks > 0) snow(g, specks);
}

/** The card's own frame loop. Also the enforcement arm of "never stuck": a
 *  panel or the bag opened by a key that landed before ours is put back down
 *  within a frame, so `hud.ts`'s capture gate can never hold the ENTER this
 *  card lives on for more than that frame. */
function loop(): void {
  if (!dead) return;
  try { closePanels(); } catch { /* hud not built yet — a boot-dead save */ }
  try { showBag(false); } catch { /* likewise */ }
  const g = cv?.getContext('2d');
  if (g) {
    const t = performance.now() - bornAt;
    if (t >= FADE_MS) {
      if (cv!.style.display === 'none') cv!.style.display = 'block';
      const k = Math.min(1, (t - FADE_MS) / FUZZ_MS);
      if (k < 0.55) {
        // the set hunting for sync, exactly as the menu arrives
        g.fillStyle = '#0b0b12'; g.fillRect(0, 0, OW, OH);
        snow(g, 0.55);
        rollBar(g, k);
      } else {
        paintCard(g, k < 1 ? 0.34 * (1 - k) / 0.45 : 0);
      }
    }
  }
  requestAnimationFrame(loop);
}

function onKey(e: KeyboardEvent): void {
  if (!dead) return;
  // the world under the card is over; no key may act on it again
  e.stopImmediatePropagation();
  e.preventDefault();
  if (!armed()) return;
  const k = e.key.toLowerCase();
  if (k === 'enter' || k === ' ' || k === 'arrowright' || k === 'e') wipe();
}

function onClick(e: MouseEvent): void {
  if (!dead || !cv) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  if (!armed()) return;
  const r = cv.getBoundingClientRect();
  if (!r.height) return;
  const y = (e.clientY - r.top) * (OH / r.height);
  if (y > 158 && y < 198) wipe();          // the NEW GAME row, with slack
}

function gameOver(): void {
  if (dead) return;
  dead = true;
  bornAt = performance.now();
  // put down everything that could eat a key or stand over the card
  try { closePanels(); } catch { /* hud not built yet */ }
  try { showBag(false); } catch { /* likewise */ }
  closeOsd();
  try { document.exitPointerLock?.(); } catch { /* no lock to release */ }
  build();
  wrap!.style.display = 'flex';
  void wrap!.offsetHeight;                 // commit display before the fade
  wrap!.style.opacity = '1';
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('click', onClick, true);
  loop();
}

// ── registration ────────────────────────────────────────────────────────────

/** Constructs no THREE object and draws from no random stream, so the seeded
 *  world grain stands still (GOTCHAS §2). The band is a formality — beside
 *  fatigue, after the world, before `ct/save.ts` restores a possibly-dead hp. */
export const ORDER = 91;

export function register(_ctx: CtxBuild): void {
  // the menu must not open over the card — a claim in osd's list, ORed
  registerOsdBusy(() => dead);
  // wired to the NUMBER: a car today, anything else tomorrow, and the boot
  // restore of a save that died last session — all the same watcher
  onHealthChange(() => { if (health() <= 0) gameOver(); });
  if (health() <= 0) gameOver();
}

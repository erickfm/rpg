// ══ THE PEN — ONE SIGNATURE MECHANIC FOR EVERY PAPER ════════════════════════
//
// *"lets make it so you actually have to sign for signature like you have to
//  draw"*   (2026-08-09, on character creation)
//
// *"i want to sign similar to game start for job app. and for loan"*
//   (2026-08-09)
//
// Three papers sign now — FORM R-9 at game start (`ct/create.ts`), the job
// application on every hiring shop's clipboard (`ct/jobs.ts`) and FIRST
// FEDERAL's loan sheet (`ct/int-bank.ts`) — and this is the one copy of the
// mechanic they share: pen down inside the box, ink following the cursor a
// texel at a time, a minimum of honest ink before it counts, void-and-re-sign,
// and the keyboard's auto-scrawl so nobody is ever trapped behind a flourish.
// Each paper keeps its OWN box geometry, its own ink colour and its own voice
// (VOID / FILE / SUBMIT / HAND OVER); what they may not keep is a private copy
// of the drawing logic, because three copies is how one paper's fix misses the
// other two.
//
// ⚠ A PURE LEAF, AND IT MUST STAY ONE. This module imports NOTHING — not hud,
// not paint, not three. `ct/create.ts` sits outside the panel framework,
// `ct/jobs.ts` and `ct/int-bank.ts` sit inside it, and the only way one helper
// can serve both sides without closing an import cycle through the hud/mirror
// chain (GOTCHAS §28: dev looks perfect, the built artifact silently drops a
// module) is to depend on none of it. It takes a canvas context and numbers.

/** the blank a signature goes in, in the caller's own canvas pixels */
export interface SigBox { x0: number; y0: number; x1: number; y1: number }

/**
 * A 1 px line plotted a texel at a time (Bresenham). Hard pixels at any angle
 * — the same reason every diagonal in this world is stepped by hand rather
 * than handed to the antialiaser. Caller sets `fillStyle`.
 */
export function pixLine(g: CanvasRenderingContext2D,
                        x0: number, y0: number, x1: number, y1: number): void {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export interface SigPad {
  /** pen down at a canvas point. True if it landed in the box and a stroke
   *  began — the caller repaints and swallows; false means "not mine". */
  down(x: number, y: number): boolean;
  /** the pointer moved. True if ink was laid (repaint); no-op with pen up. */
  move(x: number, y: number): boolean;
  /** the button came up, anywhere. True if the pen was down. */
  up(): boolean;
  /** no strokes at all — drives whether a VOID affordance is offered */
  blank(): boolean;
  /** enough ink to count — see `minInk`. A dot is not a signature. */
  signed(): boolean;
  /** wipe the ink to re-sign */
  clear(): void;
  /**
   * A keyboard player's signature: one wavy scrawl across the box, sized to
   * it, counting as fully signed. Every paper's key fallback calls this
   * before submitting — THE NO-TRAP RULE OUTRANKS THE FLOURISH, and a player
   * with no working mouse must still be able to sign anything signable.
   */
  autoScrawl(): void;
  /** lay the ink down. Call it late, so the pen lies over the print. */
  paint(g: CanvasRenderingContext2D, ink: string): void;
}

/**
 * @param box    the blank of the line, canvas pixels, caller's geometry
 * @param minInk texels of path before the ink counts as a signature. 50 is
 *               about two honest strokes on every box built so far.
 */
export function makeSigPad(box: SigBox, minInk = 50): SigPad {
  let strokes: [number, number][][] = [];
  let ink = 0;
  let penDown = false;

  const inBox = (x: number, y: number): boolean =>
    x >= box.x0 && x < box.x1 && y >= box.y0 && y <= box.y1;

  return {
    down(x, y) {
      if (!inBox(x, y)) return false;
      penDown = true;
      strokes.push([[Math.round(x), Math.round(y)]]);
      return true;
    },
    move(x, y) {
      if (!penDown) return false;
      const s = strokes[strokes.length - 1];
      const px = Math.round(Math.max(box.x0, Math.min(box.x1 - 1, x)));
      const py = Math.round(Math.max(box.y0, Math.min(box.y1, y)));
      const [lx, ly] = s[s.length - 1];
      if (px === lx && py === ly) return false;
      s.push([px, py]);
      ink += Math.hypot(px - lx, py - ly);
      return true;
    },
    up() {
      const was = penDown;
      penDown = false;
      return was;
    },
    blank: () => strokes.length === 0,
    signed: () => ink >= minInk,
    clear() { strokes = []; ink = 0; penDown = false; },
    autoScrawl() {
      const cy = Math.round((box.y0 + box.y1) / 2);
      const amp = Math.max(1, Math.min(4, Math.floor((box.y1 - box.y0) / 3)));
      const xa = box.x0 + 6;
      const xb = box.x0 + Math.min(box.x1 - box.x0 - 6, 110);
      const s: [number, number][] = [];
      for (let x = xa; x <= xb; x += 3) {
        s.push([x, cy + Math.round(amp * Math.sin((x - xa) * 0.55))]);
      }
      strokes.push(s);
      ink = Math.max(ink, minInk);
    },
    paint(g, inkCol) {
      g.fillStyle = inkCol;
      for (const s of strokes) {
        if (s.length === 1) { g.fillRect(s[0][0], s[0][1], 1, 1); continue; }
        for (let k = 1; k < s.length; k++) {
          pixLine(g, s[k - 1][0], s[k - 1][1], s[k][0], s[k][1]);
        }
      }
    },
  };
}

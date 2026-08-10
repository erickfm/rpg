import { BUILD, type CtxBuild } from './ctx';
import { defineItem, mBox, mCyl, mOf } from './inventory';
import { hudNote } from './hud';
import { riding, setRiding } from '../fp';

// ══ THE SKATEBOARD ══════════════════════════════════════════════════════════
//
// *"make it so i can give the guy smokes in the park and he gives me a
//  skateboard i can use finally"*   (2026-08-10)
//
// THE ITEM AND ITS RIDE VERB LIVE HERE. The trade that puts it in your bag is
// the park kid's (ct/park.ts — he has wanted a cigarette since the day he was
// built), and the movement itself is the rig's: fp.ts owns how the board
// rolls, this file owns only the switch. `use` is a TOGGLE — RIDE steps on,
// STEP OFF steps off — and the verb string is mutated to say which, the way
// `ct/smoking.ts` mutates SMOKES: the bag paints and matches the same
// `use.verb`, so the plate can never offer the wrong one.
//
// ⚠ THE ACT RETURNS THE BOARD'S OWN ID. The bag's use machinery consumes an
// act that returns nothing — that is how eating works — and riding must not
// eat the skateboard.
//
// THERE IS ONE BOARD IN THE WORLD — the kid's — so `stack: 1`. NOT bulky,
// deliberately: a board rides strap-side against the bag, and taking your only
// hand for it would turn the reward into a chore.

const step = (on: boolean): void => {
  setRiding(on);
  SKATEBOARD.use!.verb = on ? 'step off' : 'ride';
  hudNote(on ? 'you step on the board.' : 'you step off.', 1800);
};

const box = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

export const SKATEBOARD = defineItem({
  id: 'SKATEBOARD', name: 'skateboard', stack: 1,
  thick: 0.11,
  blurb: 'the kid’s board. The grip tape is worn through where his feet went.',
  // side-on in the 24 px box: kicked nose and tail, dark grip over a battered
  // red underside, and the yellowed-white wheels every 1997 wheel became
  icon: (g) => {
    box(g, '#b8342a', 3, 10, 18, 2);                                 // underside
    box(g, '#2a241c', 3, 8, 18, 2);                                  // grip tape
    box(g, '#2a241c', 1, 6, 2, 3); box(g, '#b8342a', 1, 9, 2, 2);    // nose kick
    box(g, '#2a241c', 21, 6, 2, 3); box(g, '#b8342a', 21, 9, 2, 2);  // tail kick
    box(g, '#8a8478', 6, 12, 2, 2); box(g, '#8a8478', 16, 12, 2, 2); // trucks
    box(g, '#e8e0c8', 5, 14, 4, 4); box(g, '#e8e0c8', 15, 14, 4, 4); // wheels
    box(g, '#b0a890', 6, 15, 2, 2); box(g, '#b0a890', 16, 15, 2, 2);
  },
  use: { verb: 'ride', act: () => { step(!riding()); return 'SKATEBOARD'; } },
  // A REAL BOARD ON THE FLOOR: a 78 × 20 deck at wheel height, red underside,
  // grip-dark top, four yellowed wheels on grey trucks. Palette off the icon.
  model: () => {
    const wheel = (x: number, z: number) => {
      const w = mCyl(0.028, 0.03, '#e8e0c8');
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.028, z);
      return w;
    };
    return mOf(
      mBox(0.78, 0.012, 0.20, '#b8342a', 0, 0.075, 0),
      mBox(0.76, 0.004, 0.195, '#2a241c', 0, 0.083, 0),
      mBox(0.06, 0.05, 0.03, '#8a8478', -0.26, 0.045, 0),
      mBox(0.06, 0.05, 0.03, '#8a8478', 0.26, 0.045, 0),
      wheel(-0.26, -0.085), wheel(-0.26, 0.085),
      wheel(0.26, -0.085), wheel(0.26, 0.085),
    );
  },
});

// ── registration ────────────────────────────────────────────────────────────
//
// The item declared itself at import, the way everything in ct/goods.ts does;
// `register` only stands the guard. Nothing here constructs a THREE object and
// nothing draws from `rnd()`, so the seeded stream never moves (GOTCHAS §2).

export const ORDER = BUILD.INTERIOR + 10;      // 90, beside ct/smoking.ts

export function register(ctx: CtxBuild): void {
  // THE SWITCH CANNOT OUTLIVE THE BOARD. Drop it, fence it, sit down — the
  // first frame that finds you riding with no board in the bag, or riding a
  // chair, steps you off, verb and all. fp.ts stays dumb on purpose: it holds
  // the flag and this file holds the reasons.
  ctx.onFrame(() => {
    if (!riding()) return;
    if (ctx.player.seated() || (ctx.purse.inv[SKATEBOARD.id] ?? 0) < 1) step(false);
  });
}

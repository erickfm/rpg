import * as THREE from 'three';
import { makePanel, hudNote, type Panel } from './hud';
import { pixTex, declareSurface, dither } from './paint';
import { give, fullWhy, itemOf } from './inventory';
import type { CtxBuild, Spot } from './ctx';

// ══ BUYING THINGS, OVER A COUNTER, OFF A SIGN ══════════════════════════════
//
// *"for every business i just want to be able to talk to the shop keeper or
//  cashier and see a diagetic list of options as like a sign or something for
//  everything you can buy. stock the burger barn, the diner, the bodega, etc
//  all of them."*   (2026-08-06)
//
// ── "AS LIKE A SIGN OR SOMETHING" IS THE WHOLE SPECIFICATION ────────────────
//
// This project has thrown out a menu three times today. A dressing panel got
// *"this is not an option"*; a bag became a bag you look INTO; the options on it
// are stencilled onto the bag's own lining. So a shop's stock list is not a list
// with a shop drawn round it — **it is the menu board that is already bolted to
// the wall over the counter**, and pressing `[E]` on the person behind that
// counter is you stepping back and reading it.
//
// The machinery for that already exists and is not copied here: `makePanel`'s
// `surface` hangs a panel's canvas on a MESH (`ct/hud.ts`, the diegetic-screens
// note), and `crosstown.ts:poseFor` eases the eye onto that mesh's own face. The
// calendar, the mirror and the dresser drawer are the three tenants; a menu
// board is the easy case, because a board on a wall is VERTICAL and derives its
// own heading (the drawer's lining does not, and that cost five commits).
//
// ── ONE PAINTER, TWO SURFACES ──────────────────────────────────────────────
//
// `boardTexture()` paints the board you see across the room, and `paintBoard()`
// paints the panel's canvas while you are reading it. **They are the same
// function at the same canvas size**, so the board cannot say one thing on the
// wall and another in the view — which is exactly the split `ct/drawer.ts`
// documents, used the other way round: a drawer hides its contents from the room
// because a 0.135 m stack is a smudge at 4 m, and a MENU BOARD is a thing
// designed to be read at 4 m, so it shows everything from everywhere. The only
// difference between the two paintings is the wash under the line your pointer
// is on, which is a thing a wall cannot have.
//
// ── WHAT A SHOP IS ─────────────────────────────────────────────────────────
//
//     a stock list  +  a surface  +  somebody to talk to
//
// and nothing else. `shopCounter()` takes those three and registers the `[E]`,
// builds the panel, does the arithmetic and words the refusals. A room that
// wants to sell things writes a table and one call; it does not write a panel,
// a camera pose, a hit test or a transaction. That is the point — there are nine
// more shops behind this one.

/** ONE THING YOU CAN BUY: what it is, what the board calls it, what it costs. */
export interface StockLine {
  /**
   * The `ItemDef` id that lands in the bag. **Declare it** — in
   * `ct/goods.ts` or wherever its system lives — or it arrives as a wrapped
   * parcel with a lower-case name, which is `itemOf`'s honest fallback and is
   * not what a shop should be selling.
   */
  id: string;
  /**
   * How the BOARD says it, in the shop's own lettering: `BARN BURGER`, not
   * `barn burger`. Separate from `ItemDef.name` on purpose — the item is a
   * thing in the world and the line is a thing a shop printed, and the two
   * genuinely differ ("NO 1 COMBO", "TALL BOY", "TAPE — 2 NIGHTS").
   */
  name: string;
  /** dollars. 1997 money — see the note on prices at the foot of this file. */
  price: number;
}

/** One panel of the board: a heading and what is under it. */
export interface ShopColumn { head: string; lines: StockLine[] }

/**
 * HOW THIS SHOP'S SIGN IS MADE — six colours and a flag.
 *
 * Deliberately not a style system. A backlit fast-food panel, a diner's chalk
 * slate, a bodega shelf ticket and a pawn shop's rate card are the same OBJECT
 * (a list of things and their prices, printed where you can see it) in four
 * materials, and the difference between them is entirely colour and lettering.
 * Anything that needed more than this would be a sign that wants its own
 * painter, and it should have one.
 */
export interface BoardLook {
  /** the lit panel, the slate, the card — what the list is printed ON */
  panel: string;
  /** the surround: moulded plastic, a timber batten, a tin frame */
  frame: string;
  /** the heading band across the top of each panel */
  band: string;
  /** the heading's own letters, which sit ON the band */
  bandInk: string;
  /** the list */
  ink: string;
  /** the price column, when a shop prints it in a second colour */
  priceInk?: string;
  /** the wash under the line your pointer is on. Semi-transparent. */
  hover: string;
  /** the flash when the till takes it. Semi-transparent, brighter than hover. */
  flash: string;
}

// ── the sign, laid out ─────────────────────────────────────────────────────
//
// Everything below is derived from the canvas the caller asked for, in texels,
// because a board's PROPORTIONS are what the caller chose when it chose how big
// the object on the wall is (BUILDER-BRIEF §8: derive, do not retype). A shop
// with two columns and a shop with four get the same margins without either of
// them saying so.

interface Cell { line: StockLine; x: number; y: number; w: number; h: number }

interface Layout {
  frame: number;
  panels: { head: string; x: number; y: number; w: number; h: number; band: number }[];
  cells: Cell[];
  headPx: number; rowPx: number; pad: number;
}

function layout(W: number, H: number, cols: ShopColumn[]): Layout {
  const n = Math.max(1, cols.length);
  const frame = Math.max(4, Math.round(H * 0.07));
  const pw = Math.floor((W - frame * (n + 1)) / n);
  const ph = H - frame * 2;
  const band = Math.max(10, Math.round(ph * 0.22));
  // EVERY COLUMN GETS THE SAME ROW HEIGHT, off the LONGEST one. Sizing each
  // panel's rows to its own line count would make a three-line column's type
  // half the size of a one-line column's beside it, which reads as two signs.
  const most = Math.max(1, ...cols.map((c) => c.lines.length));
  const rowH = Math.floor((ph - band) / most);
  const pad = Math.max(3, Math.round(pw * 0.045));
  const panels: Layout['panels'] = [];
  const cells: Cell[] = [];
  cols.forEach((c, i) => {
    const x = frame + i * (pw + frame);
    panels.push({ head: c.head, x, y: frame, w: pw, h: ph, band });
    c.lines.forEach((line, r) => {
      cells.push({ line, x, y: frame + band + r * rowH, w: pw, h: rowH });
    });
  });
  return {
    frame, panels, cells, pad,
    headPx: Math.max(6, Math.round(band * 0.55)),
    rowPx: Math.max(6, Math.round(rowH * 0.52)),
  };
}

/**
 * A PRICE, THE WAY A 1997 SIGN PRINTS ONE. Under a dollar loses its nought —
 * `.89`, not `$0.89` — because that is what is on every board of the period and
 * because it is the cheapest possible signal that this is a shop and not a form.
 */
export const boardPrice = (p: number): string =>
  (p < 1 ? p.toFixed(2).slice(1) : p.toFixed(2));

/**
 * THE SIGN ITSELF. One painter for the object on the wall and for the view you
 * read it in — see the note at the head of this file.
 *
 * `hover` and `flash` are the two things only the VIEW has: the line under your
 * pointer, and the line the till just took. A wall cannot have either, so
 * `boardTexture` passes neither and the two paintings are otherwise identical.
 */
export function paintBoard(
  g: CanvasRenderingContext2D, W: number, H: number,
  cols: ShopColumn[], look: BoardLook,
  o: { hover?: StockLine | null; flash?: StockLine | null } = {},
): void {
  const L = layout(W, H, cols);
  g.fillStyle = look.frame; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  for (const p of L.panels) {
    g.fillStyle = look.panel; g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle = look.band; g.fillRect(p.x, p.y, p.w, p.band);
    g.fillStyle = look.bandInk;
    g.font = `bold ${L.headPx}px monospace`;
    g.textAlign = 'center';
    g.fillText(p.head, p.x + p.w / 2, p.y + p.band / 2);
  }
  for (const c of L.cells) {
    if (o.flash === c.line) { g.fillStyle = look.flash; g.fillRect(c.x, c.y, c.w, c.h); }
    else if (o.hover === c.line) { g.fillStyle = look.hover; g.fillRect(c.x, c.y, c.w, c.h); }
    g.font = `bold ${L.rowPx}px monospace`;
    const my = c.y + c.h / 2;
    g.fillStyle = look.ink;
    g.textAlign = 'left';
    g.fillText(c.line.name, c.x + L.pad, my);
    g.fillStyle = look.priceInk ?? look.ink;
    g.textAlign = 'right';
    g.fillText(boardPrice(c.line.price), c.x + c.w - L.pad, my);
  }
  // the same speckle every painted surface in this world carries (ct/paint.ts).
  // Light — a board is printed matter, not weathered brick.
  dither(g, W, H, Math.round((W * H) / 900));
}

/** The board as it hangs on the wall. Hand the result to `ctx.flat`. */
export function boardTexture(w: number, h: number, cols: ShopColumn[], look: BoardLook): THREE.Texture {
  return declareSurface(pixTex(w, h, (g) => paintBoard(g, w, h, cols, look)), 'sign');
}

/**
 * HOW FAR BACK YOU HAVE TO STAND TO READ THE WHOLE SIGN — derived, never typed.
 *
 * **A menu board is WIDE, and that is the only hard thing about focusing on
 * one.** Every diegetic screen this world had before it — the ATM, the drawer,
 * the calendar — is roughly square, so a standoff that felt right also framed
 * it. A 6 m board at 1 m is four unreadable letters. The distance is decided by
 * the WIDTH against the horizontal field, and it comes out at several metres,
 * which is exactly how far back a person stands to read a menu board.
 *
 *   `wM`, `hM`   the board, in metres
 *   `fov`        the vertical field to lean in to
 *   `riseM`      how far the board's CENTRE is above the eye. `poseFor` clamps
 *                the eye to 1.75 m over the floor, so a board hung at 2.35 m
 *                rises 0.60 — and the eye stands off along the NORMAL, so the
 *                true distance is the hypotenuse and the standoff is the leg.
 *
 * ⚠ `ASPECT` IS PESSIMISTIC ON PURPOSE — 1.5, not the 1.78 of a 16:9 window.
 * The horizontal field is the vertical one times the WINDOW's aspect, which is
 * the one number this code cannot know, and being wrong in the wide direction
 * crops the ends off the sign. A narrower assumption costs a little screen area
 * on a wide monitor and cannot cut a column off on a narrow one.
 */
export function boardStandoff(o: {
  wM: number; hM: number; fov: number; riseM?: number; fill?: number;
}): number {
  const ASPECT = 1.5;
  const fill = o.fill ?? 0.88;
  // the VERTICAL extent the lens must cover: whichever of the two dimensions
  // needs more of it once the width is converted through the aspect
  const need = Math.max((o.wM / fill) / ASPECT, o.hM / fill);
  const d = need / (2 * Math.tan((o.fov * Math.PI) / 180 / 2));
  const rise = o.riseM ?? 0;
  return Math.max(0.5, Math.sqrt(Math.max(0.01, d * d - rise * rise)));
}

// ── the counter ────────────────────────────────────────────────────────────

export interface ShopSpec {
  /** panel DOM id. `ct-shop-<room>`, so `__hud.panel()` names the shop. */
  id: string;
  /** what is for sale, in the columns the board prints it in */
  columns: ShopColumn[];
  look: BoardLook;
  /** the board's canvas in texels — the SAME size the world texture was painted at */
  w: number; h: number;
  /**
   * The board mesh, resolved at OPEN time and not captured at build time —
   * `ScreenSurface.mesh`'s own rule, and the fallback if it returns null is a
   * worse-looking panel rather than a broken one.
   */
  mesh: () => THREE.Object3D | null;
  /** how far the eye settles off the board. Use `boardStandoff`. */
  standoff: number;
  /** the lens to lean in with. 60 reads as looking up at a board. */
  fov: number;
  /** where you STAND to be served */
  stand: { x: number; z: number };
  /** the person you talk to: where they are, and their sprite for the highlight */
  keeper: { x: number; z: number; obj?: THREE.Object3D };
  /** 'the cashier', 'the counter man', 'the woman behind the till' */
  who: string;
  /** is this counter live right now — normally `room.inside` */
  ok: () => boolean;
  /** how close you must be. 1.0 is a counter's width of floor. */
  r?: number;
}

export interface Shop {
  /** bring the board up, as if you had pressed `[E]` on the keeper */
  open: () => void;
  /** redraw it — call after anything that changes what is for sale */
  repaint: () => void;
  /** the `[E]` spot, held so a keeper who WALKS can rewrite its x/z per frame */
  spot: Spot;
}

/**
 * A SHOP: a stock list, a sign, and somebody behind the counter.
 *
 * Registers the `[E]`, builds the diegetic board panel on first use, and owns
 * the transaction. The room supplies the world — the board mesh it already hung
 * and the keeper it already placed — and nothing else.
 */
export function shopCounter(ctx: CtxBuild, spec: ShopSpec): Shop {
  let panel: Panel | null = null;
  let hover: StockLine | null = null;
  let flash: StockLine | null = null;
  let flashT: ReturnType<typeof setTimeout> | null = null;
  const repaint = () => panel?.repaint();

  const cellAt = (x: number, y: number): StockLine | null => {
    for (const c of layout(spec.w, spec.h, spec.columns).cells) {
      if (x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h) return c.line;
    }
    return null;
  };

  /**
   * ══ THE TRANSACTION, AND THE ORDER OF ITS TWO HALVES ═════════════════════
   *
   * **THE ITEM GOES IN THE BAG BEFORE THE MONEY LEAVES THE PURSE.** That is not
   * a stylistic choice: `give()` is the only thing that decides whether there is
   * room (`ct/inventory.ts` — "ask `roomFor` to WORD A PROMPT, never to decide"),
   * a bag holds twelve, and a bulky item wants a hand that may already be full.
   * Debiting first and then discovering the refusal is how a shop takes your
   * money and hands you nothing, which is the worst failure this feature could
   * have and is unrecoverable from inside the game.
   *
   * So: check the cash (a refusal that costs nothing), then `give`, and only if
   * `give` actually took it does `purse.cash` move. Every path that does not
   * reach the debit has changed no state at all.
   *
   * AND EVERY REFUSAL SAYS WHY, in the player's own vocabulary — `fullWhy`
   * distinguishes a full bag from a full hand, which is the surprising case (a
   * bag with room in it that still cannot take a toaster).
   */
  const buy = (line: StockLine): void => {
    const p = ctx.purse;
    if (p.cash < line.price) {
      hudNote(`$${(line.price - p.cash).toFixed(2)} short of a ${itemOf(line.id).name}`);
      return;
    }
    if (give(p, line.id, 1) < 1) {
      // `fullWhy` answers for the SPACE — a full bag, a full hand — and returns
      // '' when there is space and the refusal was the item's own `stack`. That
      // second case is the common one at a food counter (two burgers is a
      // stack) and it needs its own words, or the player is told nothing at all
      // by a shop that just declined to serve him.
      hudNote(fullWhy(p) || `no room for another ${itemOf(line.id).name}`);
      return;
    }
    p.cash -= line.price;
    ctx.refreshWallet();
    // THE TILL TOOK IT. No `note` line on success — *"i dont want descriptors
    // for the items you pick up"* — so the receipt is the two things he can
    // already see: the line lights up under his pointer for half a second, and
    // the cash figure in the caption drops. Both are redrawn by this repaint.
    flash = line;
    if (flashT) clearTimeout(flashT);
    flashT = setTimeout(() => { flash = null; repaint(); }, 450);
    repaint();
  };

  const open = (): void => {
    if (!panel) {
      panel = makePanel({
        id: spec.id,
        w: spec.w, h: spec.h, scale: 1, chrome: 'none',
        // NOT `silent`. Every other diegetic surface in this world is something
        // you look INTO and can close by looking away; a shop is a thing you are
        // being SERVED at, and the one line the framework insists on — how to
        // leave — is worth having here. It carries the money with it, because
        // "can I afford that" is the only question the board itself cannot
        // answer: a menu board does not know what is in your pocket.
        hint: () => `$${ctx.purse.cash.toFixed(2)} in hand`,
        draw: (g, W, H) => paintBoard(g, W, H, spec.columns, spec.look, { hover, flash }),
        surface: {
          mesh: spec.mesh,
          standoff: spec.standoff,
          fov: spec.fov,
          // NO `faceYaw`. A board on a wall is VERTICAL and derives its own
          // heading from its face — `faceYaw` exists for the horizontal case
          // (a drawer's lining) where the normal points at the ceiling and
          // `atan2(+0, −0)` is exactly π. See `crosstown.ts:poseFor`.
          hot: (x, y) => !!cellAt(x, y),
          move: (x, y) => {
            const h = cellAt(x, y);
            if (h !== hover) { hover = h; repaint(); }
          },
          click: (x, y) => { const l = cellAt(x, y); if (l) buy(l); },
        },
        onOpen: () => { hover = null; flash = null; },
        onClose: () => {
          hover = null; flash = null;
          if (flashT) { clearTimeout(flashT); flashT = null; }
        },
      });
    }
    panel.open();
  };

  // ── who you talk to ──────────────────────────────────────────────────────
  //
  // `x/z` is where the CUSTOMER stands and `aimX/aimZ` is the KEEPER, which is
  // the split `Spot.aimX` exists for: the trigger has to be somewhere you can
  // put your feet, and the aim has to be at the thing the prompt names, or the
  // prompt fires while you look at the floor beside a man (`Pickable.aimX` in
  // fp.ts, and the calendar item that paid for it).
  //
  // `obj` is the keeper's own sprite so the selection outline draws the person
  // the prompt is talking about. Without it the fallback is a plain box at the
  // spot's own position — which here is the CUSTOMER's feet, i.e. an outline
  // round the player. `ctx.Spot.obj`'s note is explicit that the fallback is
  // deliberately dumb; a room that can hand over the mesh should.
  //
  // NO `rank`. Furniture declares nothing — `WAY_OUT` is for the door, and a
  // counter that outranked the way out of the room would be the exact bug the
  // rank field was added to fix, upside down.
  const spot: Spot = {
    x: spec.stand.x, z: spec.stand.z,
    aimX: spec.keeper.x, aimZ: spec.keeper.z,
    r: spec.r ?? 1.0,
    obj: spec.keeper.obj,
    ok: spec.ok,
    label: () => `talk to ${spec.who}`,
    act: open,
  };
  ctx.spot(spot);

  return { open, repaint, spot };
}

// ══ WHAT THINGS COST ═══════════════════════════════════════════════════════
//
// **1997, and the arithmetic of this world is already tight.** Rent is $500 a
// season; a fresh player can reach about $401 in one (starting cash $14.50, the
// account $312.40, the pawn shop paying $0.25–$8 a piece). So every shop is a
// SINK against an economy that is short before it opens, and the prices here are
// deliberately period-real rather than balanced against that: a burger is $1.89
// because a burger was $1.89, and a whole meal is about three dollars.
//
// That is the honest thing to build and it is worth saying out loud what it
// does: eating at the barn every day for a season is roughly $270 against a
// $500 rent bill, which is not payable. **Nothing here rebalances the economy**
// — no wages, no discounts, no cheaper food — because that was not the ask, and
// a shop that quietly re-tuned the rent would be a much bigger change than the
// one he asked for wearing this one's clothes.

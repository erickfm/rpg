// ══ NEW GAME ═══════════════════════════════════════════════════════════════
//
// *"starting a new gamre should start a new game the day stays the same"*
//   (2026-08-06)
//
// He started a new game and arrived on day 40 of the last character's life —
// rent already in arrears, the mailbox already emptied, the purse already spent.
//
// ── WHY IT WAS BROKEN, AND IT IS NOT THE OBVIOUS ONE ──────────────────────
//
// `ct/osd.ts` did the right-looking thing: remove `ct-save`, then reload. But
// `ct/save.ts` puts a `pagehide` AND a `visibilitychange` listener on the window
// as soon as autosave starts, and BOTH OF THOSE FIRE ON `location.reload()`.
// So the sequence was:
//
//     removeItem('ct-save')  ->  location.reload()  ->  pagehide fires
//        ->  flush()  ->  capture() of the world still standing there
//        ->  writeLocal()  ->  `ct-save` IS BACK, with day 40 in it
//
// The clock is one number in that blob (`ct/save.ts`'s 'clock' slice), so the
// day came back with everything else. Deleting the save and then letting the
// dying page save again cannot work; the writer has to be told to stop first.
//
// ── SO THIS FILE IS THE LIST, AND THERE IS ONLY ONE ───────────────────────
//
// This has now gone wrong twice in the same shape — `ct-wardrobe` survived NEW
// GAME on its own key until creation was made to reset the outfit by hand, and
// then the clock survived on the shared one. Both are the same bug: nobody
// owned the question "what does starting over clear?". This file owns it. A
// module that invents a new storage key adds one row to the table below and is
// done; nothing else in the tree learns about it.
//
// ⚠ A LEAF. It imports NOTHING. That is what lets `ct/osd.ts` — a near-leaf on
// purpose, so it cannot close an import cycle (GOTCHAS §28: dev looks perfect
// and the built artifact has no menu in it) — call `wipe()` directly, and lets
// `ct/save.ts` ask `wiped()` without either of them importing the other.

/**
 * ── EVERY KEY THIS GAME WRITES ────────────────────────────────────────────
 *
 * The rule is one line: **world and character state is cleared, a preference
 * about the person or the machine survives.** Starting a new life must not put
 * the watch back on the other wrist.
 *
 *   ct-save      CLEAR  the world — the clock (and therefore the date, the
 *                       season, the year, what rent has come due), the purse,
 *                       the dresser drawer, the outfit and the body, all in
 *                       `ct/save.ts`'s slices. This is the one he noticed.
 *   ct-created   CLEAR  "somebody has made a character on this browser".
 *                       A fact about the character, so it goes with him.
 *   ct-body      CLEAR  hair, its colour, height, build, skin — `ct/body.ts`
 *                       keeps its own copy beside the save, and without this
 *                       the new character wears the last one's face until he
 *                       touches a row on the creation screen.
 *   ct-wardrobe  CLEAR  the outfit — `ct/wardrobe.ts`'s own copy, the key that
 *                       taught us this lesson the first time.
 *
 *   ct-settings  KEEP   handedness, look speed, and the name he typed.
 *                       `ct/osd.ts` argues this out: a preference belongs to
 *                       the person and the machine, not to the character.
 *   ct.audio     KEEP   volume and mute, for exactly the same reason.
 *   ct-player    KEEP   who you are to the server. That is the ACCOUNT, not
 *                       the character — a new game replaces your save, it does
 *                       not make you somebody else and ask your name again.
 *
 *   ct-create    SET    the handshake. `ct/create.ts` finds it on the way up
 *                       and shows the creation screen, then clears it.
 */
const CLEAR = ['ct-save', 'ct-created', 'ct-body', 'ct-wardrobe'] as const;
const PENDING = 'ct-create';

/** Every touch of storage is guarded — reading it can THROW in a sandboxed
 *  iframe rather than return null, and an exception here is a black page. */
function drop(k: string): void {
  try { localStorage.removeItem(k); } catch { /* private mode */ }
}
function put(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
}

let dead = false;

/**
 * ⚠ ONE-WAY, AND NEVER UNSET. Asked by `ct/save.ts` in `flush()`, which is the
 * only thing that can write the world down. Once this is true the page is on
 * its way out and anything it still contains is the OLD life — a save from here
 * is never wanted, whichever of the three exits fires it (the ten-second tick,
 * `pagehide`, or the tab going hidden).
 */
export function wiped(): boolean { return dead; }

type Hook = () => void;
const HOOKS: Hook[] = [];

/** Run something at the moment the old life ends, before the reload. For
 *  `ct/save.ts`: stop the autosave timer, and clear the SERVER's copy too —
 *  otherwise a player with an account reloads and the old world is fetched
 *  straight back over the fresh one. Must not throw and must not block. */
export function onWipe(f: Hook): void { HOOKS.push(f); }

/**
 * Start over. Clears the world, keeps the person, asks who you are, reloads.
 *
 * ORDER IS THE WHOLE FIX: `dead` first, so nothing can write during the tear
 * down; then the hooks; then the keys; then the flag and the reload.
 */
export function wipe(): void {
  dead = true;
  for (const f of HOOKS) { try { f(); } catch { /* one bad hook must not trap him here */ } }
  for (const k of CLEAR) drop(k);
  put(PENDING, '1');
  location.reload();
}

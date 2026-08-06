import { BUILD, type CtxBuild } from './ctx';
import { drawerStock, drawerTake, drawerPut } from './inventory';
import { SLOTS, options, wornIndex, wear, onWardrobeChange, type Slot } from './wardrobe';

// ══ THE SAVE ═══════════════════════════════════════════════════════════════
//
// *"next i think i want to try to get this on railway. for other people to
//  play. for that ill need to try to build a db of sorts."*   (2026-08-05)
//
// OTHER PEOPLE PLAYING IS THE WHOLE REQUIREMENT, and it is what makes this
// different from the one thing that persisted before it. `ct/wardrobe.ts` keeps
// your outfit in `localStorage`, which is a fact about the BROWSER: it does not
// follow you to another machine and it cannot tell two people apart. A world
// somebody else can walk into needs the state to live somewhere the server can
// see, keyed by who you are.
//
// ── WHAT THIS FILE IS ─────────────────────────────────────────────────────
//
// A registry and a transport, and deliberately not a model of the game.
//
//     registerSlice('tenancy', { capture: () => …, restore: (v) => … });
//
// A module that owns state declares how to write it down and how to put it
// back, and this collects the answers into ONE JSON document. It is the same
// argument `ctx.spot`, `ctx.seat`, `ctx.ground` and `ct/world.ts` already make
// in this codebase: the thing that owns the state owns the verb, and the
// central file never learns what any of it is. A save format with a field per
// item would have to be edited by whoever adds a flag, in a file they do not
// own, which is exactly the shape that left five finished modules unreachable.
//
// ── IT IS NOT ALLOWED TO BREAK THE PAGES BUILD OR THE ARTIFACT ────────────
//
// There is no server behind https://erickfm.github.io/rpg/ and there is none
// inside `dist/artifact.html` — that file is one self-contained HTML document
// in a sandboxed iframe. So the API is PROBED, once, and everything below
// degrades in this order:
//
//     server answers  ->  saves to Postgres, keyed by username, follows you
//     no server       ->  saves to localStorage, exactly today's behaviour
//     no storage at all (private mode, sandboxed iframe: reading can THROW)
//                     ->  no save, and a world that still loads
//
// The last rung is the important one and `ct/wardrobe.ts` paid for it: *"an
// exception at module init is a black page with no world in it."* Every touch
// of `localStorage`, `fetch` and `prompt` in this file is guarded. A player who
// cannot save should get an unsaved game, never no game.

/** Last in the second build band — `crosstown.ts` runs `buildWorld(ctx,
 *  BUILD.PROPS, 99)` — so every module that owns state has registered its slice
 *  before we go looking for one to restore. Nothing here constructs a THREE
 *  object, so adding this module does not touch the seeded stream and does not
 *  move a single tree (GOTCHAS §2). */
export const ORDER = BUILD.INTERIOR + 19;      // 99

// ── the shape on the wire ─────────────────────────────────────────────────
//
// ONE JSON DOCUMENT PER PLAYER, one row in `saves`, one JSONB column.
//
//     { "v": 1, "at": 1754441234567, "slices": { "<name>": <anything> } }
//
// Not a column per field, and not one row per item. CROSSTOWN's state is still
// being invented — the bag stopped being a container and became a VIEW of the
// purse the same week this was written — and a relational schema would mean a
// migration every time a builder adds a flag. A document costs one `ALTER` in
// total, which has already been run.
//
// `v` is the format, not the game. Bump it only when an OLD blob would be
// misread by NEW code; adding a slice never needs it, because an unknown slice
// is ignored on load and a missing one just leaves that module at its defaults.
export const SAVE_VERSION = 1;

export interface SaveBlob {
  v: number;
  /** epoch ms the blob was captured — for "last played", and for telling two
   *  saves apart when a player has the game open in two tabs. */
  at: number;
  slices: Record<string, unknown>;
}

export interface Slice<T = unknown> {
  /** Write this module's state down as plain JSON. Must not throw; must not
   *  return anything `JSON.stringify` will choke on (no THREE objects, no
   *  cycles, no functions). */
  capture: () => T;
  /** Put it back. Called ONCE, after the world is built. Anything you do not
   *  recognise — an id that no longer exists, a count that is negative — must
   *  be skipped rather than half-applied. */
  restore: (v: T) => void;
}

/** How a slice is held once the generic has done its job at the call site.
 *  `restore` takes `unknown` because the blob we hand back came off the wire
 *  and is nobody's declared type until the slice has checked it — which is
 *  exactly what `Slice.restore`'s contract says it must do. */
type AnySlice = { capture: () => unknown; restore: (v: unknown) => void };

const SLICES = new Map<string, AnySlice>();

/**
 * Declare that your module has state worth keeping.
 *
 * Call it at module scope or from `register(ctx)`; anything registered before
 * the restore lands (ORDER 99 plus one network round trip) is included. A name
 * that is already taken REPLACES the previous slice and warns — two modules
 * writing to one key would silently lose one of them.
 */
export function registerSlice<T>(name: string, s: Slice<T>): void {
  if (SLICES.has(name)) console.warn(`[save] slice '${name}' registered twice — the later one wins`);
  SLICES.set(name, s as unknown as AnySlice);
}

/** Everything, right now. Never throws: a slice that fails is left out of the
 *  blob and logged, because one bad `capture` must not cost you the other six. */
export function capture(): SaveBlob {
  const slices: Record<string, unknown> = {};
  for (const [name, s] of SLICES) {
    try { slices[name] = s.capture(); }
    catch (e) { console.error(`[save] slice '${name}' failed to capture:`, e); }
  }
  return { v: SAVE_VERSION, at: Date.now(), slices };
}

/** Put a blob back. Returns the names that were applied. */
export function restore(blob: unknown): string[] {
  const b = blob as SaveBlob | null;
  if (!b || typeof b !== 'object' || typeof b.slices !== 'object' || !b.slices) return [];
  if (b.v !== SAVE_VERSION) {
    // Refuse rather than guess. A blob from a format we do not know could apply
    // cleanly to half the world and leave the other half at its defaults, and
    // that reads as a corrupt save rather than as an old one.
    console.warn(`[save] ignoring a v${b.v} blob — this build reads v${SAVE_VERSION}`);
    return [];
  }
  const done: string[] = [];
  for (const [name, s] of SLICES) {
    if (!(name in b.slices)) continue;          // never saved, or added since
    try { s.restore(b.slices[name]); done.push(name); }
    catch (e) { console.error(`[save] slice '${name}' failed to restore:`, e); }
  }
  return done;
}

// ── identity ──────────────────────────────────────────────────────────────
//
// A USERNAME, NO PASSWORD — `erickfm/slasher`'s model, unchanged, because the
// thing being protected is a single-player 1997 street and the worst case is
// that somebody types your name and walks around your flat. Against that, a
// password costs a login screen in front of a game whose whole pitch is that
// you press a key and you are standing on the pavement.
//
// Resolved in this order, and the last rung is why the artifact is unaffected:
//
//   1. `?player=NAME` in the URL — shareable, and how you get a second
//      character without clearing your browser storage.
//   2. `localStorage['ct-player']` — you are asked once per browser.
//   3. `prompt()`, ONLY when a server actually answered. No server means no
//      accounts to belong to, so Pages and the artifact never see a dialog.
//
// The prompt is a `window.prompt` and not a HUD panel on purpose: a modal built
// out of this project's own panel machinery, opened before the player has
// touched a key, is one bug away from the worst thing this project ships (*"a
// panel you cannot close"*). The browser's own dialog cannot trap anybody.

const PLAYER_KEY = 'ct-player';
const NAME_OK = /^[A-Za-z0-9 _-]{1,20}$/;       // must agree with server/api.mjs

function ls(): Storage | null {
  // Reading `localStorage` can THROW in a sandboxed iframe rather than return
  // null — see the note in ct/wardrobe.ts. One guarded accessor, used by all.
  try { return window.localStorage; } catch { return null; }
}

function readParam(): string | null {
  try {
    const p = new URLSearchParams(location.search).get('player');
    return p && NAME_OK.test(p.trim()) ? p.trim() : null;
  } catch { return null; }
}

function resolvePlayer(): string | null {
  const fromUrl = readParam();
  if (fromUrl) { try { ls()?.setItem(PLAYER_KEY, fromUrl); } catch { /* fine */ } return fromUrl; }
  let stored: string | null = null;
  try { stored = ls()?.getItem(PLAYER_KEY) ?? null; } catch { /* fine */ }
  if (stored && NAME_OK.test(stored)) return stored;
  let typed: string | null = null;
  try { typed = window.prompt('CROSSTOWN ’97 — who are you?\n(letters, digits, space, _ or -, up to 20)', ''); }
  catch { return null; }
  const name = (typed || '').trim();
  if (!NAME_OK.test(name)) return null;         // cancelled or nonsense: play unsaved
  try { ls()?.setItem(PLAYER_KEY, name); } catch { /* fine */ }
  return name;
}

// ── transport ─────────────────────────────────────────────────────────────

/** Where the API is, resolved against the document so the game still finds it
 *  when it is served from a subpath. Null when there is no sane base at all
 *  (a `blob:` or `data:` document — which is the artifact). */
function apiUrl(pathname: string): string | null {
  try { return new URL(`api/${pathname}`, document.baseURI).toString(); }
  catch { return null; }
}

type Mode = 'server' | 'local' | 'none';

let mode: Mode = 'none';
let player: string | null = null;
/** No autosave until the restore has been attempted. Saving a fresh world over
 *  a good save because the GET had not come back yet is the one unrecoverable
 *  mistake available here. */
let ready = false;
/** The last document we successfully wrote, stringified — the dirty check. */
let lastSent = '';

const LOCAL_KEY = 'ct-save';

async function probe(): Promise<boolean> {
  const url = apiUrl('health');
  if (!url) return false;
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return false;
    const j = await r.json() as { ok?: boolean };
    return j.ok === true;
  } catch { return false; }          // no server, offline, CSP, sandbox
}

async function fetchSave(name: string): Promise<SaveBlob | null> {
  const url = apiUrl(`saves/${encodeURIComponent(name)}`);
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.status === 404) return null;           // a new player, not an error
    if (!r.ok) return null;
    const j = await r.json() as { save?: SaveBlob };
    return j.save ?? null;
  } catch { return null; }
}

function readLocal(): SaveBlob | null {
  let raw: string | null = null;
  try { raw = ls()?.getItem(LOCAL_KEY) ?? null; } catch { return null; }
  if (!raw) return null;
  try { return JSON.parse(raw) as SaveBlob; } catch { return null; }
}

function writeLocal(json: string): void {
  try { ls()?.setItem(LOCAL_KEY, json); } catch { /* private mode, quota */ }
}

/**
 * Write the world down, if it has changed.
 *
 * `beacon` is for the tab closing: `fetch` from a `pagehide` handler is killed
 * with the page, `navigator.sendBeacon` is handed to the browser to deliver
 * afterwards. It can only POST, which is why `server/api.mjs` accepts POST on
 * the save route as well as PUT.
 */
export function flush(opts: { force?: boolean; beacon?: boolean } = {}): boolean {
  if (!ready && !opts.force) return false;
  const blob = capture();
  // `at` moves every call, so compare everything EXCEPT it — otherwise the
  // dirty check is never clean and we write once per tick for ever.
  const cmp = JSON.stringify(blob.slices);
  if (!opts.force && cmp === lastSent) return false;
  lastSent = cmp;

  const json = JSON.stringify(blob);
  writeLocal(json);                              // always, in every mode

  if (mode !== 'server' || !player) return true;
  const url = apiUrl(`saves/${encodeURIComponent(player)}`);
  if (!url) return true;
  const body = JSON.stringify({ save: blob });
  if (opts.beacon) {
    // text/plain, not application/json: a JSON content type makes this a
    // CORS-preflighted request and a beacon cannot be preflighted. Same origin
    // here so it would work either way, but the server takes both types and
    // this is the shape that survives being served from anywhere.
    try { navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })); } catch { /* gone */ }
    return true;
  }
  void fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body })
    .catch(() => { /* the localStorage copy already landed; try again next tick */ });
  return true;
}

// ── WHEN IT SAVES ─────────────────────────────────────────────────────────
//
// Every ten seconds, and only if something changed; plus once as the tab goes
// away. Both halves are needed and neither is enough:
//
//   · per frame is wrong — sixty writes a second to Postgres for a world that
//     changes when you press a key.
//   · on unload ONLY is wrong — `pagehide` does not fire on a crash, a killed
//     tab, a phone taking a call, or a laptop lid. That loses a session.
//
// Ten seconds bounds the loss at ten seconds of play, and the dirty check means
// standing still costs one `JSON.stringify` of a few small objects per tick and
// zero requests. `setInterval` rather than `ctx.onFrame` deliberately: this must
// keep ticking while a fade is on and while a panel is up, and it must cost
// nothing in the frame budget the FPS counter exists to protect.
const TICK_MS = 10_000;

let timer: ReturnType<typeof setInterval> | null = null;

function startAutosave(): void {
  if (timer !== null) return;
  timer = setInterval(() => { flush(); }, TICK_MS);
  // `pagehide` and not `unload`: `unload` is ignored by browsers that keep the
  // page in the back/forward cache, which is most of them now.
  addEventListener('pagehide', () => { flush({ beacon: true }); });
  // …and a phone backgrounding the tab never fires `pagehide` at all.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush({ beacon: true });
  });
}

// ── the slices this file can wire without editing anybody's module ────────
//
// Everything below reads and writes through EXPORTS that already exist, so no
// file in `src/proto/ct/` had to be edited to make the world persist. What is
// missing is missing for one honest reason — the state is a closure local with
// no setter — and every one of them is listed at the bottom of this file with
// the two lines that would finish it.

function builtins(ctx: CtxBuild): void {
  // ── THE CLOCK, AND THEREFORE THE DATE ──────────────────────────────────
  //
  // `totalMin` is the only time there is: `ct/calendar.ts` is pure functions
  // over `Math.floor(totalMin / 1440)`, so saving one number saves the day, the
  // season, the year, which rent periods have come due and what the sky is
  // doing. There is nothing else to store.
  //
  // ⚠ RESTORING ONLY EVER GOES FORWARD. `ctx.clock` hands out `advance`, and
  // that is the whole verb — nothing outside `crosstown.ts` can wind the clock
  // back. That is not a limitation here: a fresh world always starts at 13:20 of
  // day 0, which is the earliest time that exists, so a saved moment is always
  // ahead of it. If the clock ever gains a start time later than a save could
  // hold, this silently keeps the fresher one, which is the safe direction.
  registerSlice<{ totalMin: number }>('clock', {
    capture: () => ({ totalMin: ctx.clock.now().totalMin }),
    restore: (v) => {
      if (typeof v?.totalMin !== 'number' || !Number.isFinite(v.totalMin)) return;
      const delta = v.totalMin - ctx.clock.now().totalMin;
      // overSeconds 0 — a save is not a night's sleep and must not be watched.
      if (delta > 0) ctx.clock.advance(delta, { overSeconds: 0 });
    },
  });

  // ── THE PURSE: money, the bank, the card, the PIN, and your pockets ─────
  //
  // One object, and `ct/hud.ts` documents why every one of these fields lives
  // on it — *"the ATM, the wallet and the bank's loan desk all read ONE
  // `purse.cash`"*. `inv` is the pockets AND the bag: `ct/inventory.ts` deleted
  // its second store this week and the bag is now a VIEW over `purse.inv`, so
  // saving the purse saves what you are carrying however you are carrying it.
  //
  // Restored BY MUTATION, never by replacement. Nine modules captured this
  // exact object at build time; handing them a new one would leave every one of
  // them writing to a purse nothing else reads.
  registerSlice<{ cash: number; inv: Record<string, number>; account?: number; card?: boolean; pin?: string }>('purse', {
    capture: () => ({
      cash: ctx.purse.cash,
      inv: { ...ctx.purse.inv },
      account: ctx.purse.account,
      card: ctx.purse.card,
      pin: ctx.purse.pin,
    }),
    restore: (v) => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.cash === 'number' && Number.isFinite(v.cash)) ctx.purse.cash = v.cash;
      if (v.inv && typeof v.inv === 'object') {
        for (const k of Object.keys(ctx.purse.inv)) delete ctx.purse.inv[k];
        for (const [id, n] of Object.entries(v.inv)) {
          if (typeof n === 'number' && n > 0) ctx.purse.inv[id] = Math.floor(n);
        }
      }
      if (typeof v.account === 'number' && Number.isFinite(v.account)) ctx.purse.account = v.account;
      if (typeof v.card === 'boolean') ctx.purse.card = v.card;
      // The PIN is a property of the CARD and dies with it — `undefined` is not
      // a sentinel, it IS "this card has never been used" (ct/hud.ts).
      if (typeof v.pin === 'string') ctx.purse.pin = v.pin;
      ctx.refreshWallet();
    },
  });

  // ── THE DRESSER DRAWER ─────────────────────────────────────────────────
  //
  // A heap, not ordered slots, so it saves as counts per id. Restored by
  // EMPTYING it through the drawer's own `drawerTake` and refilling with
  // `drawerPut`, rather than by reaching into the record — the record is a
  // module local and this file has no business knowing it exists.
  registerSlice<Record<string, number>>('drawer', {
    capture: () => Object.fromEntries(drawerStock().map(({ id, n }) => [id, n])),
    restore: (v) => {
      if (!v || typeof v !== 'object') return;
      for (const { id, n } of drawerStock()) for (let i = 0; i < n; i++) drawerTake(id);
      for (const [id, n] of Object.entries(v)) {
        const k = Math.floor(Number(n));
        if (!(k > 0) || k > 999) continue;       // a corrupt count must not hang the loop
        for (let i = 0; i < k; i++) drawerPut(id);
      }
    },
  });

  // ── WHAT HE IS WEARING ─────────────────────────────────────────────────
  //
  // BY ID, NEVER BY INDEX, for the reason `ct/wardrobe.ts` already gives: a
  // re-ordered rack would otherwise dress the player in whatever moved into
  // that row. An id no longer in the rack is skipped and that slot keeps its
  // default.
  //
  // ⚠ THE TOP IS RESTORED LAST, and that is load-bearing. A dress occupies two
  // slots, and `wear('bottom', …)` TAKES A DRESS OFF by design — so restoring
  // top first and bottom second undresses anybody who saved in a dress. Last
  // means the trousers are already stashed at `wornAt.bottom` when the dress
  // goes on, which is exactly the state playing into it produces.
  //
  // This is a second writer to the outfit `ct/wardrobe.ts` already keeps in
  // `localStorage`, and they cannot disagree: `wear()` writes that copy itself,
  // so restoring through it updates both.
  registerSlice<Record<string, string>>('wardrobe', {
    capture: () => {
      const out: Record<string, string> = {};
      for (const s of SLOTS) out[s] = options(s)[wornIndex(s)]?.id ?? '';
      return out;
    },
    restore: (v) => {
      if (!v || typeof v !== 'object') return;
      const order: Slot[] = [...SLOTS.filter((s) => s !== 'top'), 'top'];
      for (const s of order) {
        const id = v[s];
        if (typeof id !== 'string' || !id) continue;
        const i = options(s).findIndex((g) => g.id === id);
        if (i >= 0) wear(s, i);
      }
    },
  });

  // Changing your clothes is the one thing a player can do that the ten-second
  // tick would otherwise be the only witness to, and the wardrobe already
  // publishes a change signal. Free, so take it.
  onWardrobeChange(() => { flush(); });
}

// ── boot ──────────────────────────────────────────────────────────────────

export function register(ctx: CtxBuild): void {
  builtins(ctx);

  // Everything from here is asynchronous and NOTHING waits on it. The world is
  // already built and playable by the time this runs; the save lands a moment
  // later. Gating the first frame on a network round trip would mean a black
  // screen whenever the database is slow, and would need an edit to
  // `crosstown.ts` — the most contended file in the tree — to arrange.
  //
  // The cost is honest and small: for the second or two before the blob
  // arrives you are standing in a fresh flat, and then you are standing in
  // yours. Autosave does not start until that has happened either way, so the
  // fresh world can never be written over the saved one.
  void boot();

  (window as unknown as { __save: unknown }).__save = {
    mode: () => mode,
    player: () => player,
    ready: () => ready,
    slices: () => [...SLICES.keys()],
    capture: () => capture(),
    /** force a write now, for a probe that does not want to wait ten seconds */
    flush: () => flush({ force: true }),
    restore: (b: unknown) => restore(b),
  };
}

async function boot(): Promise<void> {
  const online = await probe();
  let blob: SaveBlob | null = null;

  if (online) {
    mode = 'server';
    player = resolvePlayer();
    if (player) {
      blob = await fetchSave(player);
      // Register the name even when there is no save yet, so a player who quits
      // before the first tick still exists in `users`.
      try {
        await fetch(apiUrl('users') ?? '', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: player }),
        });
      } catch { /* the save routes upsert too — this is only for tidiness */ }
    } else {
      mode = 'local';                            // cancelled the prompt: play unsaved
    }
  } else {
    mode = ls() ? 'local' : 'none';
  }

  if (!blob) blob = readLocal();                 // Pages, the artifact, or a new player

  const applied = blob ? restore(blob) : [];
  if (applied.length) console.log(`[save] restored ${applied.join(', ')} (${mode}${player ? `, ${player}` : ''})`);
  else console.log(`[save] fresh world (${mode}${player ? `, ${player}` : ''})`);

  // Seed the dirty check from what the world is NOW, so the first tick after a
  // restore is a no-op instead of an immediate rewrite of what we just read.
  lastSent = JSON.stringify(capture().slices);
  ready = true;
  if (mode !== 'none') startAutosave();
}

// ══ WHAT IS NOT SAVED YET, AND EXACTLY WHY ═════════════════════════════════
//
// Everything above is wired through exports that already existed. The list
// below is the state I found that a returning player would notice missing, and
// in every case the reason is the same one: it is a closure local in a module
// with no setter, so it cannot be reached from outside. Each is TWO LINES in
// the module that owns it — a `registerSlice` call beside the state — and no
// change at all here or in the server.
//
//   ct/tenancy.ts   `paidPeriods`, `collectedDay`, `HELD` (the letters in your
//                   box), `POCKETED` (the ones you took). This is the biggest
//                   gap: rent paid and rent OWED are the closest thing the game
//                   has to a score, and `owed(day)` is computed from
//                   `paidPeriods` against a restored clock — so a returning
//                   player currently finds the date advanced and the rent
//                   marked prepaid, which is arrears the wrong way round.
//                   `__rent` publishes `paidPeriods()` and `held()` READ ONLY
//                   and says why: *"a probe that could set `paidPeriods` could
//                   make its own assertions come true."* A slice is not a
//                   probe, and it belongs inside that file for the same reason.
//
//   ct/inventory.ts `TAKEN` — the litter you dropped, and where. `dropLoose`
//                   is exported and takes (id, x, z, gy), so restoring is
//                   possible from outside; CAPTURING is not, because nothing
//                   publishes where the dropped things went.
//
//   ct/atm.ts,      per-machine state (a session in progress, a hand of
//   ct/slots.ts,    blackjack). Deliberately left out — none of it should
//   ct/blackjack.ts survive a reload, and a half-dealt hand restored into a
//                   world you are not standing in would be worse than nothing.
//
//   ct/audio.ts     volume and mute, already in `localStorage` under its own
//                   key. A PREFERENCE, not world state: it belongs to the
//                   machine you are sitting at, not to the character, and
//                   moving it into the save would carry your headphone
//                   volume onto somebody else's laptop.
//
//   doors, flags    there is no general flag store in this world today. When
//                   one appears it is one more slice.
//
// Adding one, in full:
//
//     import { registerSlice } from './save';
//     registerSlice('tenancy', {
//       capture: () => ({ paid: paidPeriods, collected: collectedDay }),
//       restore: (v) => { paidPeriods = v.paid; collectedDay = v.collected; },
//     });
//
// No import in this file, no line in the server, no deploy.

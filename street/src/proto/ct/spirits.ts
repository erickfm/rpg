import { BUILD, ORDER as FRAME, type CtxBuild } from './ctx';
import { screenFade, screenFading, hudNote, panelUp } from './hud';
import { gameOverUp } from './gameover';
import { mental, setMental, mentalDamage, mentalHeal } from './mental';
import { arrears } from './tenancy';
import { registerSlice, flush } from './save';
import { awakeStretch, flatBed } from './fatigue';
import { APT_X0, APT_Z0, ST0 } from './apartment';
import { RENTAL } from './goods';
import { itemOf } from './inventory';

// ══ SPIRITS — what moves the mental bar ═════════════════════════════════════
//
// *"lets get two health bars, one physical one mental. physical and mental
//  both get worn down by working. getting hit by a car, only physical.
//  everyday youre late on rent hurts the mental. the mental damage happens
//  when the day converts so either on wake up on a day with no rent paid
//  still or at midnight. smokes hurt physical but help mental. tv helps the
//  mental a tiny bit. just enough to offset the rent pain. coffee is a temp
//  boost to mental and physical but when it wears off it hurts both more than
//  the temp boost. pills is the same but 1.5x severe. cocaine is the same but
//  twice as severe. add confession in church and it helps the mental a lot.
//  renting and playing tapes at home helps mental twice as much as tv.
//  school fills mental to full always."*   (2026-08-15)
//
// The BAR is `ct/mental.ts`, a leaf the HUD can draw. This module is the
// CAUSES that need the world to see: the rent pain at the day line, the
// television, the tapes, the confession's daily gate, and what an empty bar
// does. The causes that live where their trigger lives stay there — work wear
// and the stimulant crashes in `ct/fatigue.ts` (which already meters shifts
// and doses), the cigarette in `ct/smoking.ts`, the college in
// `ct/int-college.ts`. `ct/carhit.ts` is untouched: a bumper hurts only the
// body, which is what it already did.
//
// ── THE NUMBERS, and how they hang together ────────────────────────────────
//
// Mental is 0…100. One late day is -6, and the television is +6 ONCE A DAY —
// his own sizing rule: *"just enough to offset the rent pain."* Everything
// else is priced against that pair: a tape is twice the television (+12, two
// game-hours a showing), confession is *"a lot"* (+40, once a day, free but
// for a quarter hour), school is total (+100, but a course costs $150 up).
// An 8-hour shift is -12 mental beside its -10 physical (`ct/fatigue.ts`),
// so a working week without rent trouble is survivable on television alone,
// and a working week IN rent trouble is not — which is the pressure the
// sentence describes.
const RENT_PAIN = 6;
const TV_MENTAL = 6;
/** game-minutes of sitting before the television counts as an evening's worth */
const TV_WATCH_MIN = 30;
const TAPE_MENTAL = TV_MENTAL * 2;                    // *"twice as much as tv"*
/** a movie is two game-hours, charged as ordinary waking time */
const TAPE_MIN = 120;
const CONFESS_MENTAL = 40;
const CONFESS_MIN = 15;
/** where the breakdown leaves you — cried out, not cured */
const BREAK_RESET = 35;

// ── the daily gates, and they are SAVED ────────────────────────────────────
// Two day-stamps, so a reload cannot hand back today's television or a second
// absolution. Exact restore, the tenancy slice's rule. New game needs no row:
// the `ct-save` wipe is total and the reload puts both back at -1.
let tvDay = -1;
let confessDay = -1;
registerSlice<{ tvDay: number; confessDay: number }>('spirits', {
  capture: () => ({ tvDay, confessDay }),
  restore: (v) => {
    if (!v || typeof v !== 'object') return;
    if (Number.isFinite(v.tvDay)) tvDay = Math.floor(v.tvDay);
    if (Number.isFinite(v.confessDay)) confessDay = Math.floor(v.confessDay);
  },
});

// ── session state, deliberately not saved ──────────────────────────────────
let lastT: number | null = null;
let lastDay = -1;
/** minutes on the bed in front of the set this sitting */
let tvMin = 0;
let breaking = false;

/** Inside 301 on the home floor — the tape gate and the television gate. The
 *  flat's own seat predicate is `x > 100` plus the storey; this adds the
 *  building's neighbourhood so no other interior at x > 100 can ever pass. */
function atHome(ctx: CtxBuild): boolean {
  return Math.abs(ctx.player.gy() - 2 * ST0) < 0.5
    && Math.abs(ctx.player.x() - APT_X0) < 9
    && Math.abs(ctx.player.z() - APT_Z0) < 9;
}

/**
 * ══ CONFESSION — the church's spot calls this ══════════════════════════════
 *
 * *"add confession in church and it helps the mental a lot."*
 *
 * NOT A PANEL. A short fade with a quarter-hour behind it, the college's own
 * gesture — so there is nothing modal to trap anyone, nothing Escape owes
 * anything to. Once a game day: absolution twice before supper is a mental
 * pump, not a sacrament. The quarter hour is declared to `ct/fatigue.ts` as
 * ordinary waking time (`awakeStretch`), so the jump reads as time on your
 * feet rather than as a night's sleep.
 */
export function confessNow(ctx: CtxBuild): void {
  if (screenFading() || panelUp() || gameOverUp()) return;
  const day = Math.floor(ctx.clock.now().totalMin / 1440);
  if (day === confessDay) {
    hudNote('the little door is shut. once a day is as much as anyone gets forgiven.', 4000);
    return;
  }
  confessDay = day;
  awakeStretch(CONFESS_MIN);
  void screenFade({
    mid: () => { ctx.clock.advance(CONFESS_MIN, { overSeconds: 0 }); },
    outMs: 140, holdMs: 90, inMs: 170,
  });
  mentalHeal(CONFESS_MENTAL);
  hudNote('you say all of it through the screen, and the voice says what it says. you walk out lighter.', 6000);
  flush();
}

/**
 * ── THE BREAKDOWN — what an empty mental bar does ──────────────────────────
 *
 * Zero physical is `ct/gameover.ts`'s and stays so. Zero mental is not an
 * ending: you shut down where you stand and surface in your own bed eight
 * hours later with the bar back at BREAK_RESET — a forced night, the
 * pass-out's own grammar (never mid-air, never out of a seat, never behind a
 * panel), minus the mugging. The clock jump behind the fade reads as sleep to
 * `ct/fatigue.ts`, which is right: a body that shuts down has slept, however
 * badly, so the night also does what every night does.
 */
function breakdown(ctx: CtxBuild): void {
  if (breaking || screenFading()) return;
  if (ctx.player.seated() || ctx.player.airborne() || panelUp() || gameOverUp()) return;
  breaking = true;
  const wake = flatBed();
  void screenFade({
    mid: () => {
      ctx.player.jumpTo(wake.x, wake.z, wake.yaw, wake.gy);
      ctx.clock.advance(8 * 60, { overSeconds: 0 });
      setMental(BREAK_RESET);
    },
    outMs: 140, holdMs: 260, inMs: 880,
  }).then(() => {
    breaking = false;
    hudNote('it all comes down on you at once. you do not remember getting home. eight hours are gone.', 6500);
    flush();
  });
}

// ── registration ────────────────────────────────────────────────────────────

/** Late in the second band, beside `ct/fatigue.ts` and for its reasons:
 *  nothing here constructs a THREE object, so the seeded stream stands still. */
export const ORDER = BUILD.INTERIOR + 10;      // 90

export function register(ctx: CtxBuild): void {
  // ── THE TAPES GET THEIR VERB ─────────────────────────────────────────────
  //
  // *"renting and playing tapes at home helps mental twice as much as tv."*
  //
  // Renting already exists — the VIDEO HUT's counter sells `RENTAL` at $6 and
  // the ex-rental `VHS` at $10 — the tapes just could not be played. Same
  // mutation `ct/food.ts` and `ct/fatigue.ts` make on `COFFEE`: the import is
  // the load-order guarantee and this touches the one def the bag reads.
  // PLAY returns the tape's own id, the library book's own trick, so the tape
  // survives the verb — there is no return clock in this world and a watched
  // movie is still a movie. Away from the flat it refuses and says why.
  const play = (id: string) => (): string => {
    if (screenFading() || panelUp()) return id;
    if (!atHome(ctx)) {
      hudNote('no VCR anywhere here. it plays at home or it plays nowhere.', 3500);
      return id;
    }
    awakeStretch(TAPE_MIN);
    void screenFade({
      mid: () => { ctx.clock.advance(TAPE_MIN, { overSeconds: 0 }); },
      outMs: 140, holdMs: 90, inMs: 170,
    });
    mentalHeal(TAPE_MENTAL);
    hudNote('you watch the whole thing, knees up on the bed. two hours somewhere else.', 5000);
    flush();
    return id;
  };
  RENTAL.use = { verb: 'play', act: play('RENTAL') };
  itemOf('VHS').use = { verb: 'play', act: play('VHS') };

  ctx.onFrame(() => {
    const t = ctx.clock.now().totalMin;
    const day = Math.floor(t / 1440);
    if (lastT === null) { lastT = t; lastDay = day; return; }
    const d = t - lastT;
    lastT = t;

    // ── THE DAY CONVERTS ───────────────────────────────────────────────────
    //
    // *"everyday youre late on rent hurts the mental. the mental damage
    //  happens when the day converts so either on wake up on a day with no
    //  rent paid still or at midnight."*
    //
    // One rule serves both of his clauses, the tenancy's own derive-don't-
    // accumulate discipline: whenever the day index climbs — a midnight
    // walked through, or a night slept across in one frame — every crossed
    // boundary hurts if he stood in arrears on the day that just ended
    // (`arrears(d - 1)`, so the due day itself is not yet "late"; the morning
    // after it is, which is what late means). A jump with NO fade is
    // `ct/save.ts` restoring the clock — time he never lived, `ct/fatigue.ts`'s
    // own reading — so it resyncs and charges nothing; a backwards snap
    // (a probe's `__ct.clock`) resyncs the same way.
    if (day !== lastDay) {
      const unlived = d > 0.5 && !screenFading();
      if (day > lastDay && !unlived) {
        let late = 0;
        for (let nd = lastDay + 1; nd <= day; nd++) if (arrears(nd - 1) > 0) late++;
        if (late > 0) {
          mentalDamage(RENT_PAIN * late);
          hudNote(late === 1 ? 'another day owing rent. it sits on you.'
            : `${late} more days owing rent. it sits on you.`, 5000);
          flush();
        }
      }
      lastDay = day;
    }

    // ── THE TELEVISION ─────────────────────────────────────────────────────
    //
    // *"tv helps the mental a tiny bit. just enough to offset the rent pain."*
    //
    // The one seat in 301 is the bed in front of the set, so seated-at-home
    // IS watching television. Half a game-hour of actually sitting there
    // earns the day's +6 — once a day, or an evening of channel-flipping
    // would out-earn the confessional. Standing up resets the sitting.
    if (ctx.player.seated() && atHome(ctx) && !screenFading()) {
      tvMin += Math.max(0, Math.min(d, 0.5));       // lived minutes only, never a jump
      if (tvMin >= TV_WATCH_MIN && tvDay !== day) {
        tvDay = day;
        mentalHeal(TV_MENTAL);
        hudNote('the set hums at you for a while. it helps, a little.', 4000);
        flush();
      }
    } else {
      tvMin = 0;
    }

    if (mental() <= 0) breakdown(ctx);
  }, FRAME.LATE);
}

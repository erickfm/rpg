// ══ 12-HOUR OR 24-HOUR — ONE PREFERENCE, AND ONE PLACE THAT WRITES A TIME ════
//
// *"also the esc menu needs an option for 24 hour clocks vs 12 hour"*
//   (2026-08-11)
//
// The option is one line in `ct/osd.ts`. THIS file is the reason that line is
// worth having: a switch that only moved the wristwatch would leave the watch
// saying 13:22 while the card on the door beside it said 6 PM, and a world that
// contradicts itself about the time is worse than one that never offered the
// choice. So every surface that prints a time asks HERE, and nowhere in the
// world is there a second opinion about what an hour looks like.
//
// ⚠ A TRUE LEAF — IT IMPORTS NOTHING, and that is load-bearing rather than
// tidiness. The three callers are as far apart as this project gets:
//
//   · `ct/hours.ts`      which advertises that it imports nothing at runtime,
//                        because every `int-*.ts` reads it and `ct/doors.ts`
//                        eagerly globs those — an edge from there toward doors
//                        closes the GOTCHAS §28 cycle and drops rooms from the
//                        BUILT bundle only.
//   · `ct/hud.ts`        the wristwatch.
//   · `ct/library-pc.ts` a taskbar clock and a brokerage terminal.
//
// A module with no edges of its own cannot be half of a cycle, so all three can
// reach it and hours.ts keeps its promise in substance: its one runtime import
// is a dead end.
//
// ⚠ IT IS NOT IN `ct-settings`, AND THAT IS THE AUDIO PRECEDENT. VOLUME and
// MUTE are not in the OSD's settings blob either — `ct/audio.ts` owns them
// under its own key and the menu merely asks it (see the VOLUME row's note).
// Same shape here, and for a sharper reason: the shop cards are lettered at
// BUILD time, long before any menu exists, so the preference has to be readable
// by something that does not know the OSD is there. localStorage, own key, and
// it survives a reload exactly as handedness and volume do.

export type ClockMode = '12h' | '24h';

/**
 * ── 12-HOUR IS THE DEFAULT, AND THE WORLD PICKED IT, NOT TASTE ─────────────
 *
 * It is 1997 America: a shop card reads `9 AM – 6 PM` and a receipt says PM.
 * But the deciding argument is that the street ALREADY reads that way almost
 * everywhere — thirteen door cards, the shut-door refusal, the library's hours
 * book and the library PC's taskbar are all 12-hour today. Exactly two surfaces
 * are not: the digital wristwatch's LCD and the brokerage terminal's header.
 *
 * So 12-hour is both the period-correct default AND the smaller change: it
 * moves two readouts into line with the other fifteen, where defaulting to
 * 24-hour would repaint the whole street on a fresh save. 24-hour is the
 * option, which is what he asked for.
 */
const KEY = 'ct-clock';
let mode: ClockMode = '12h';
try {
  const raw = localStorage.getItem(KEY);
  if (raw === '12h' || raw === '24h') mode = raw;
} catch { /* private mode, or a corrupt entry — the default is fine */ }

/** read it live. Every caller asks on the paint, never at module load, so a
 *  flip reaches a surface without that surface caching a string. */
export const clockMode = (): ClockMode => mode;

// ── AND THE WATCHERS ────────────────────────────────────────────────────────
//
// Live reads are not enough on their own, because two of the surfaces are
// CACHED CANVASES rather than per-frame paints: the thirteen door cards are
// baked textures and `ct/hud.ts`'s arm is cached on the minute. Both subscribe
// here and repaint themselves; the same shape `onWardrobeChange` already uses.
const WATCH: (() => void)[] = [];
export function onClockModeChange(fn: () => void): void { WATCH.push(fn); }

export function setClockMode(v: ClockMode): void {
  if (v === mode) return;
  mode = v;
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  for (const fn of WATCH) { try { fn(); } catch { /* a bad watcher is not a bad setting */ } }
}

/** the menu's own step — one row, one key, two states */
export function toggleClockMode(): void { setClockMode(mode === '12h' ? '24h' : '12h'); }

const p2 = (n: number): string => String(n).padStart(2, '0');

/**
 * AN HOUR ON ITS OWN, the way a sign writes it — this is `ct/hours.ts`'s old
 * `fmtHour` moved here whole, with a 24-hour branch in front of it.
 *
 * ⚠ THE 12-HOUR BRANCH IS UNTOUCHED, DELIBERATELY. `9 AM`, `10 PM`, `NOON`,
 * `MIDNIGHT` — nobody paints `12 AM` on a door and means it, and the whole
 * street is lettered in that voice. Adding an option is not licence to restyle
 * the half that was already right.
 *
 * The 24-hour branch is genuinely 24-hour: `00:00`–`23:00`, no am/pm, and a
 * business closing at midnight prints `00:00` rather than `24:00` because the
 * range is the day's, not the shift's.
 */
export function fmtHour(hr: number): string {
  const h = ((hr % 24) + 24) % 24;
  if (mode === '24h') return `${p2(h)}:00`;
  if (h === 0) return 'MIDNIGHT';
  if (h === 12) return 'NOON';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/**
 * A CLOCK READING, SPLIT — because the two faces that show one want the AM/PM
 * in different places. A 1997 LCD watch puts it in the corner of the glass as a
 * tiny flag beside the big digits; a Windows taskbar puts it on the same line.
 * Returning the halves lets each draw its own house style instead of forcing
 * one string on both, and `fmtClock` below rejoins them for everybody else.
 *
 * `pad12` is the taskbar's: it prints `01:22 PM` today and must keep doing so.
 * The watch does not pad, and the 24-hour form always does.
 */
export interface ClockParts { time: string; suffix: string }

export function clockParts(hour: number, minute: number, pad12 = false): ClockParts {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const m = p2(((Math.floor(minute) % 60) + 60) % 60);
  if (mode === '24h') return { time: `${p2(h)}:${m}`, suffix: '' };
  const h12 = ((h + 11) % 12) + 1;         // 0 → 12, 13 → 1
  return { time: `${pad12 ? p2(h12) : h12}:${m}`, suffix: h < 12 ? 'AM' : 'PM' };
}

/** the same reading as one string — `1:22 PM`, or `13:22` with nothing after it */
export function fmtClock(hour: number, minute: number, pad12 = false): string {
  const { time, suffix } = clockParts(hour, minute, pad12);
  return suffix ? `${time} ${suffix}` : time;
}

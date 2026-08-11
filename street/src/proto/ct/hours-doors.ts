import { BUILD, type CtxBuild } from './ctx';
import { doorStandFor } from './doors';
import { HOURS, neverCloses, openNow, opensLabel, hoursSpan } from './hours';

// ══ THE DOOR OF A SHUT SHOP ══════════════════════════════════════════════════
//
// *"make sure the signs also limit whether the person can enter. so if a place
//  is only open 10am to midnight then at 9am you cant enter."*   (2026-08-11)
//
// The refusing half of that is one line per room: each `int-*.ts` hands the
// interior kit `ok: () => doorOpen(ctx, 'THRIFT')`, so the way-in `[E]` is dead
// while the shop is dark. That alone would be the WRONG feature. A doorway that
// simply stops answering is indistinguishable from an unfinished build — it is
// the fault `ct/civic-doors.ts` was written for, in its own words: *"a climb
// that ends in silence is a bug the player cannot distinguish from an
// unfinished build."*
//
// So this is the other half, and it is that file's shape exactly: where the way
// in has gone quiet, a SHUT DOOR stands in its place. It tells you the shop is
// closed, it tells you when it opens, and pressing it gives you the door's own
// answer instead of nothing.
//
// ── the two spots can never both be live ─────────────────────────────────────
//
// This does NOT compete with the kit's way-in spot and must never be made to.
// They sit on the same point (`doorStandFor` is what the kit derives its own
// spot from), and they are exact complements: the kit's is `openNow`, this
// one's is `!openNow`, read from the same table in the same frame. So the
// prompt on a doorway is always exactly one thing, decided by the clock and not
// by a ranking contest — which is why this carries NO `rank`. A shut door is
// not a way out and outranking the pavement around it would shadow the
// neighbours, the bank's own ATMs first among them. Those machines are what
// 1997 has instead of a bank that is open, and they must stay reachable at four
// in the afternoon.
//
// ── nothing here can trap anybody ────────────────────────────────────────────
//
// The gate is on the way IN and touches nothing else. There is no ejection at
// closing time, no lock behind you, and the way OUT of every room is the kit's
// and is never consulted about hours. Walk in at five to six and you are simply
// in — see the note at the head of `ct/hours.ts`.
//
// ⚠ NOTHING IMPORTS THIS FILE. It reaches `ct/doors.ts`, which eagerly globs
// `int-*.ts`, so it has to stay a leaf on the safe side of that glob or it
// closes the GOTCHAS §28 cycle. `ct/world.ts`'s own sweep registers it.

/** after `ct/interior.ts` (`BUILD.INTERIOR`) has registered the way-in spots
 *  these stand in for, and after `ct/civic-doors.ts` (+1) which answers the
 *  other kind of door with nothing behind it */
export const ORDER = BUILD.INTERIOR + 2;

/** how long the door's own answer stays up after you try it */
const RESPONSE_MS = 2600;

export function register(ctx: CtxBuild): void {
  for (const h of HOURS) {
    // a place that never closes has no shut door to build
    if (neverCloses(h)) continue;
    // …and neither has one whose room never declared a door. Same fallback
    // shape `ct/doors.ts` and the card hanger both use: no guess, no spot.
    const stand = doorStandFor(h.building);
    if (!stand) continue;
    // -Infinity, not 0 — `performance.now()` is small for the first seconds of
    // a page, so 0 reads as "pressed just now" and the door would answer before
    // anybody had touched it (ct/civic-doors.ts paid for this one).
    let tried = -Infinity;
    ctx.spot({
      // 1.25, a shade over the widest way-in trigger any room declares (the
      // college's 1.2), so a shut door is offered from everywhere its open twin
      // would have been and there is no ring of pavement where a closed shop
      // offers nothing at all.
      x: stand.x, z: stand.z, r: 1.25,
      // the exact complement of `doorOpen` — see the note above
      ok: () => ctx.player.x() < 100 && !openNow(ctx, h.building),
      // The card on the wall beside you is the authority and this quotes it
      // rather than inventing a second voice: resting, when it opens; once you
      // have tried the handle, the hours as the card prints them.
      label: () => (performance.now() - tried < RESPONSE_MS
        ? `the door doesn't give — the card says ${hoursSpan(h.building)}`
        : `${h.building} is closed — opens at ${opensLabel(h.building)}`),
      act: () => { tried = performance.now(); },
    });
  }
}

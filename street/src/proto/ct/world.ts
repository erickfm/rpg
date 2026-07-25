import type { CtxBuild } from './ctx';

// ── automatic module incorporation ────────────────────────────────────────
//
// A module is in the world because it EXISTS. There is no line to add in the
// entry point and therefore no line to forget.
//
// Five finished modules have now shipped unreachable — the casino, the hotel,
// the tax office, the park and the car lot. Every one was complete work by a
// builder who could not put it in the world themselves, because the one line
// that constructs it lived in desk-owned `crosstown.ts`. The auditor reported
// it three rounds running. `ct/interior.ts` already solved this for interiors
// by globbing `int-*.ts`; this is the same mechanism widened to everything.
//
// TO ADD A MODULE TO THE WORLD, in full:
//
//     // ct/mything.ts
//     export const ORDER = BUILD.PROPS;                  // when, see ctx.ts
//     export function register(ctx: CtxBuild) {
//       const site = ctx.site('mything');                // where, from D's roster
//       if (!site) return;                               // no slot: build nothing
//       …
//     }
//
// That is the whole contract. No import, no call, no desk.
//
// ── why ORDER exists and glob order is not used ──
//
// Build order is load-bearing. `ct/rng.ts` is ONE seeded stream and tree
// heights and pigeon placement draw from it as they are constructed, so
// re-ordering the calls moves every tree in the world (GOTCHAS §2). And under
// the fingerprint harness it is worse: three.js spends four `Math.random()`
// calls per object on `generateUUID`, so merely creating something reshuffles
// the grain of every texture painted afterwards.
//
// So modules declare where they belong and this sorts them, with the filename
// as a tiebreak so the result is a property of the source rather than of
// whatever order the bundler happened to hand things over in.

interface Registrant { path: string; order: number; run: (ctx: CtxBuild) => void }

function registrants(): Registrant[] {
  const mods = import.meta.glob<Record<string, unknown>>('./*.ts', { eager: true });
  const out: Registrant[] = [];
  for (const [path, mod] of Object.entries(mods)) {
    const run = mod.register;
    if (typeof run !== 'function') continue;          // a leaf module, not a builder
    const order = typeof mod.ORDER === 'number' ? mod.ORDER : 50;
    out.push({ path, order, run: run as (ctx: CtxBuild) => void });
  }
  out.sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
  return out;
}

/**
 * Build every module whose ORDER falls in [from, to].
 *
 * The entry point calls this once per band rather than once overall, because
 * the bands have to land at the points in `crosstown.ts` where those modules
 * are built TODAY — the park and the lot before the props, the interiors after
 * everything. Collapsing them into a single call site would reorder
 * construction and move every tree in the world, which is precisely the thing
 * ORDER exists to prevent.
 */
export function buildWorld(ctx: CtxBuild, from: number, to: number): void {
  for (const r of registrants()) {
    if (r.order < from || r.order > to) continue;
    try {
      r.run(ctx);
    } catch (e) {
      // One bad module must not take the world down with it. Loud, and the
      // bugsweep reports console errors, so it cannot pass unnoticed — but
      // everything else still loads.
      console.error(`[world] ${r.path} threw while building:`, e);
    }
  }
}

/** What the loader found, for `scripts/world-wired.mjs`. */
export function worldRegistrants(): { path: string; order: number }[] {
  return registrants().map(({ path, order }) => ({ path, order }));
}

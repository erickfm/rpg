import { BUILD, type CtxBuild, type Spot } from './ctx';
import { citizenSprite } from './citizens';
import { loiter } from './loiter';
import { talker } from './dialog';
import { give, fullWhy } from './inventory';
import { COCAINE } from './fatigue';
import { hudNote } from './hud';
import { ALLEY2_SLAB_Y } from './alley-floor';

// ── THE SKEEVY GUY IN THE LONG ALLEY ──────────────────────────────────────
//
// *"you can buy cocaine from a skeevy guy in the long alley by the door."*
//   (2026-08-08)
//
// THE LONG ALLEY is the pawn alley — the user's own name for it (*"make the
// long alley flush with the sidewalk"*), the 2.5 m slot between PAWN and
// No. 227 — and THE DOOR is the one thing in it with a door: the pawn shop's
// back door at x = X0 + 12.4 on the south wall, with the painted lamp glow
// over it (`ct/pawn-alley.ts`, "a back door with a step, and the light over
// it"). He works the pool of that lamp, which is exactly where this man
// stands in 1997.
//
// HE IS NOT A SHOP. No board, no rate card, no lit sign — the pawn shop's two
// counters are the diegetic-commerce pattern here and this goes one grubbier:
// you talk to him (chat bubble, `ct/dialog.ts`), he names his price in his own
// voice, and after that `[E]` is the deal. The whole transaction is the same
// three rules the bodega's counter follows — cash checked first, the item goes
// in the bag FIRST via `give`, and the cash only moves if it went — because a
// dealer who takes $100 off a player whose hands are full is the exact bug the
// bodega's hand-written spots had.
//
// BUILT THE WAY THIS WORLD BUILDS PEOPLE: `citizenSprite` for the eight
// painted views, `ct/loiter.ts` for the posts-pauses-and-turns-to-face-you,
// and the park kid's own frame hook shape for dragging the spot and the
// collider along — including the withhold-if-the-player-is-inside guard, which
// matters MORE here than in the park: the slot is 2.5 m against a 0.72 m
// capsule, and a collider arriving around the player in a corridor that tight
// is a wedge, not a shove.

export const ORDER = BUILD.PROPS + 5;   // with the other street people, after props

// ── the goods ──────────────────────────────────────────────────────────────
//
// NOT DECLARED HERE. `COCAINE` — the bag, its icon, its model and its `use`
// that buys the twelve hours — is `ct/fatigue.ts`'s, declared beside the
// `STIMULANT_HOURS` table that keys on the id, so the thing sold and the thing
// that works are one definition. This file only sells it. Same rule the pawn
// shop's rate card follows: the price lives with the seller, the item lives
// with its system.

/**
 * $100 FOR THE BAG, against the $500/season rent baseline and the bodega's
 * $6.00 card of caffeine pills. A fifth of the rent for one purchase is what
 * keeps this a splurge rather than a staple — the pills are the working
 * stiff's tool, this is the expensive shortcut — and $100 even is also simply
 * the 1997 street price of a gram, which this world's ×4 economy happens to
 * land right on. He says it as one round number because that is how it is said.
 */
const PRICE = 100;

export function register(ctx: CtxBuild): void {
  // ── where he works, measured off the alley's own construction ────────────
  //
  // `ct/street.ts`: the slot runs z −53 (No. 227's flank) to −55.5 (PAWN's),
  // x from FACE = 7 to 7 + min(depthOf('PAWN'), depthOf('')) = 24.8.
  // `ct/pawn-alley.ts` puts the back door at X0 + 12.4 = 19.4 on the south
  // wall, the standpipe at 17.6 and the chained bike at 21.6 — so his beat is
  // the stretch between standpipe and bike, hugging the south wall where the
  // door and its lamp are. The step under the door reaches z −55.22; his
  // closest post keeps his ±0.25 collider clear of it and leaves the north
  // 1.6 m of the slot as the walking room, which in an alley narrower than
  // the sacred 2 m lane is the number that matters.
  const DOOR_X = 19.4, WALL_Z = -55.5;
  const MOUTH_X = 7, MOUTH_Z = -54.3;             // the way out — what he watches
  const guy = citizenSprite(
    // A LONG COAT IN AUGUST is the costume doing the talking: `fit: 'coat'`,
    // colours that have all gone one brown, and enough grime to say the coat
    // sleeps where he does. Wiry (`build: -1`), ordinary height — a big man
    // waiting by a door is a bouncer, a thin one is a dealer.
    { jacket: '#3b352c', pants: '#26221e', skin: '#b98a63', hair: '#241a10',
      fit: 'coat', cut: 'short', build: -1, grime: 0.45 },
    { facing: -Math.PI / 2, h: 1.0, w: 0.98 },
  );
  ctx.scene.add(guy.mesh);

  // NERVOUS GLANCES ARE THE LOITER ITSELF: short pauses (a settled man stands
  // for 7 s; he does not), a shuffle of a walk, and every look-target is either
  // the mouth of the alley — watching for exactly the person the player might
  // be — or the door he is dealing beside.
  const walk = loiter(guy, {
    posts: [
      { x: 18.55, z: -54.95, lx: MOUTH_X, lz: MOUTH_Z },
      { x: 20.15, z: -54.90, lx: DOOR_X, lz: WALL_Z },
      { x: 19.35, z: -54.65, lx: MOUTH_X, lz: MOUTH_Z },
    ],
    bounds: { minX: 18.1, maxX: 20.5, minZ: -55.05, maxZ: -54.5 },
    facing: -Math.PI / 2, speed: 0.30, notice: 2.8, pause: [2, 5.5],
    y: () => ALLEY2_SLAB_Y,
  });

  // Solid at the street's ±0.25, withheld while the player stands in it —
  // the park kid's guard, load-bearing here for the reason in the header.
  const HALF = 0.25;
  const bodyBox = ctx.obstacle({ minX: 999, maxX: 999, minZ: 999, maxZ: 999 });

  // ── the deal ──────────────────────────────────────────────────────────────
  //
  // TWO BEATS, GATED ON `pitched`. First `[E]` is the pitch — his lines, in
  // the bubble, price named at the end in his own voice. From then on `[E]` is
  // the buy, and the LABEL carries the price and the refusal before the key is
  // pressed (`give()`'s own rule: you are never told "no" by nothing
  // happening). `[E]` while he is mid-sentence turns the page, exactly as the
  // park kid's does.
  const talk = talker(ctx, {
    obj: guy.mesh, name: 'the guy in the coat',
    lines: [
      'Slow down, slow down. You a cop? You gotta say if you’re a cop, that’s the law.',
      `Okay. Okay. One bag — $${PRICE} even. Don’t count nothing out here.`,
    ],
  });
  let pitched = false;

  const spot: Spot = {
    // he IS the object — rewritten every frame below, these are only where he
    // starts
    x: walk.x, z: walk.z, aimX: walk.x, aimZ: walk.z, r: 0.95,
    obj: guy.mesh,
    // ALWAYS, day or night. A dealer who keeps shop hours is a shop.
    ok: () => true,
    label: () => {
      // pre-pitch, the offer is speech and the prompt is the talker's one
      // word — *"e prompts shouldnt be descriptive. it should just say
      // talk."* After the pitch it is a BUY, priced, and stays descriptive:
      // `give()`'s rule that you are never told "no" by nothing happening.
      if (!pitched) return talk.label();
      if (ctx.purse.cash < PRICE) return `he wants $${PRICE} — you’re short`;
      return `buy the bag — $${PRICE}`;
    },
    act: () => {
      if (talk.speaking()) { talk.say(); return; }          // turn the page
      if (!pitched) { pitched = true; talk.say(); return; } // the pitch
      if (ctx.purse.cash < PRICE) {
        talk.say(`It’s a hundred. It was a hundred ten seconds ago, it’s a hundred now.`);
        return;
      }
      // THE BAG FIRST, THE CASH ONLY IF IT WENT — the counter rule, because a
      // refusal that already took the money is the worst kind of shop.
      if (give(ctx.purse, COCAINE.id, 1) < 1) { hudNote(fullWhy(ctx.purse)); return; }
      ctx.purse.cash -= PRICE;
      ctx.refreshWallet();
      // THE DEAL HAPPENS QUICK. One line, and he is already looking at the
      // mouth of the alley again.
      talk.say('Done. You never saw me. Walk.');
    },
  };
  ctx.spot(spot);

  ctx.onFrame(({ px, pz, dt, gy }) => {
    // gy < 0.5: he does not crane after somebody three storeys up in No. 227.
    walk.tick(px, pz, dt, gy < 0.5);
    spot.x = walk.x; spot.z = walk.z;
    spot.aimX = walk.x; spot.aimZ = walk.z;
    const inIt = Math.abs(px - walk.x) < HALF + 0.36
      && Math.abs(pz - walk.z) < HALF + 0.36;
    bodyBox.minX = inIt ? 999 : walk.x - HALF;
    bodyBox.maxX = inIt ? 999 : walk.x + HALF;
    bodyBox.minZ = inIt ? 999 : walk.z - HALF;
    bodyBox.maxZ = inIt ? 999 : walk.z + HALF;
  });
}

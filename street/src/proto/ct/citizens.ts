import * as THREE from 'three';
import { pixTex } from './paint';

// ── the people on the block ───────────────────────────────────────────────
//
// One painted atlas per person: 5 views (front, 3/4, profile, 3/4 back, back)
// × 2 walk frames, mirrored at draw time for the other side. Everything that
// makes one person different from another is a parameter here — build, skin,
// hair shape, garment, stride length — so that nobody on the block is anybody
// else recoloured.
//
// Everyone is drawn the same way: same rim shading, same face, same care.

export const FW = 32, FH = 64;

/** The sprite plane's height in metres. Was a local `const H = 1.9` inside
 *  `citizenPlane` and a hand-typed `1.9` in three comments; hoisted because the
 *  seated knee below has to convert texels to metres with the SAME number. */
export const SPRITE_H_M = 1.9;

/**
 * WHERE THE FIST CLOSES ON THE UMBRELLA'S HANDLE — the frame row it lands on,
 * and how many texels outboard of the body's centre line.
 *
 * *"citizens hold their umbrella weird please fix this"* (2026-08-04.) It was
 * row 3, HALF A HEAD ABOVE THE CROWN, on the reasoning that a canopy 30 cm over
 * your head has to be held at head height. That reasoning skipped a step: it
 * checked the fist against the SHAFT and never against the HANDLE, and
 * `ct/crowd.ts` drew the handle 20 cm lower still. So the arm went dead
 * vertical, the hand closed on bare shaft up by the canopy, and the wooden
 * crook dangled unheld beside the citizen's eyes — a person carrying an
 * umbrella by its dome.
 *
 * Row 15 is where a handle actually is. A row is `SPRITE_H_M / FH` = 2.97 cm
 * and the painted figure's top is row 4, so row 15 hangs 0.33 m below the
 * crown; with the hem 0.30 m above it that makes a 0.63 m shaft, which is what
 * a stick umbrella has. On a 1.66 m painted figure the grip lands at 1.35 m —
 * shoulder height on a real body, even though this sprite's oversized head puts
 * it level with the ear. The arm that reaches it is bent, not extended.
 *
 * `HOLD_X` is what keeps the shaft off the face, and it is the half of this the
 * old pose could not have fixed on its own. The head's skin runs cx-5…cx+4 and
 * its hair, cap or hood one texel further, so a fist centred SIX texels out
 * closes beside the jaw and never inside it — and the shaft it holds leans out
 * to meet it instead of dropping down the centre line through the face.
 *
 * It is the RAISED (+x) side of the sheet, and `viewAt` mirrors that sheet for
 * the far four sectors — so the umbrella's own sprite has to mirror in step or
 * the shaft ends up in the empty hand. `ct/crowd.ts` does that; a dome alone
 * never needed it, a leaning shaft does.
 */
export const HOLD_ROW = 15, HOLD_X = 6;
/**
 * The fist's drop below the painted figure's top (row 4 of 64), in metres.
 *
 * EXPORTED SO IT CANNOT DRIFT. The handle's row in `ct/crowd.ts` used to be an
 * independent fraction of the umbrella sheet with a comment pointing here, and
 * the two ended up 20 cm apart — which is the bug above. crowd.ts imports this
 * file already, so reading the number closes no cycle; it is the REVERSE
 * direction that would (GOTCHAS §28), which is what the old note warned about.
 */
export const HOLD_DROP_M = (HOLD_ROW - 4) * SPRITE_H_M / FH;

/**
 * HOW FAR FORWARD OF THE HIP THE SEATED ART ITSELF REACHES.
 *
 * The profile shin is drawn at `cx - KNEE`, so a seated figure's leg already
 * extends this far ahead of wherever its origin was placed. **This is the whole
 * reason `seatFwd` must not also move the body forward by the seat's depth** —
 * see the derivation on `seatFwd` in `CitizenSprite`'s options.
 *
 * 12 texels was chosen (item 272) so the shin clears a diner bench's front face,
 * which stands `0.55 / 2 = 0.275 m` ahead of a sitter placed at the bench
 * CENTRE. A knee at 8 (0.238 m) would not clear it; 12 gives 0.356 m.
 */
export const SEATED_KNEE_TEXELS = 12;
/** …the same reach in metres, derived rather than retyped (BUILDER-BRIEF §8). */
export const SEATED_KNEE_M = SEATED_KNEE_TEXELS * SPRITE_H_M / FH;   // 0.356 m
export type Fit = 'plain' | 'cap' | 'dress' | 'hoodie' | 'coat';
export type HairCut = 'short' | 'crop' | 'long' | 'tied' | 'bald';

export interface Look {
  jacket: string;
  pants: string;
  skin: string;
  hair: string;
  fit: Fit;
  accent?: string;
  cut?: HairCut;
  /** −1 slight, 0 average, +1 broad — changes the SILHOUETTE, not just scale */
  build?: number;
  /** how far the legs swing on the moving frame; tied to walking speed */
  stride?: number;
  /** 0 = clean, 1 = unwashed: stains, unshaven jaw, unkempt hair. Reconciled
   *  from a parallel branch that added it for the hermit while this file was
   *  being restructured — both changes were wanted, so both survive. */
  grime?: number;
  /** SEATED — booths, stools, pews, reading desks.
   *
   *  The interiors hand-draw every figure not because nobody read
   *  CITIZEN-STYLE.md but because this atlas had only a standing pose, so a
   *  booth had nothing to call. One pose for now; leaning on a counter is a
   *  different silhouette and waits for the rooms to ask for it.
   *
   *  The ORIGIN MOVES with this flag and `citizenPlane` owns it — a caller
   *  passes the SEAT it already registered, never a hand offset. Five modules
   *  and ten rooms each applying their own offset is exactly how the 12 cm
   *  float happened. */
  seated?: boolean;
  /** ONE HAND UP, holding something overhead — an umbrella, today.
   *
   *  The user, on the umbrella: *"umbrella looks so janky."* Item 271 fixed the
   *  canopy and named what it could not reach from `ct/crowd.ts`: **both arms
   *  still hang at the sides, so nobody appears to be holding the thing.**
   *
   *  OPTIONAL AND DEFAULTS TO FALSE, which matters more than the pose does.
   *  Every caller of this atlas inherits every field on `Look`, and there are
   *  ten interiors plus the crowd plus the hermit — so an arm that went up by
   *  default would change the whole world to fix one prop. Omit it and this
   *  function paints exactly what it painted before, texel for texel.
   *
   *  It is a POSE, not a prop: nothing about an umbrella is drawn here, and a
   *  figure carrying a box or reaching for a shelf would use the same field. */
  holdUp?: boolean;
}

/** multiply a hex colour — used so the eyes and the hair shadow stay in the
 *  same family as the skin they sit on, at any tone */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

export function citizenAtlas(o: Look): THREE.Texture {
  const { jacket, pants, skin, hair, fit } = o;
  const accent = o.accent || '#8a3a2e';
  const cut: HairCut = o.cut ?? 'short';
  const grime = o.grime ?? 0;
  const seated = o.seated ?? false;
  /** How far the upper body drops when sitting — and this number is set by
   *  THE SEATS THAT EXIST, not by the frame.
   *
   *  I first derived 9 from the sprite alone (a straight leg is 21 rows, a
   *  folded one about 13) and it was wrong for the world: hip at row 47 puts
   *  hip-to-foot at 0.356 m, while the seats in this world measure 0.46 m on
   *  48 of them, then 0.50, 0.48, 0.47. A sitter placed on a real bench would
   *  have hung 10.4 cm in the air — which is the 12 cm float again, in the one
   *  function that exists because of it.
   *
   *  Hip row 44 gives (59-44)/64 * 1.9 = 0.445 m, inside half a texel of the
   *  commonest seat. Measured against the world, not reasoned from the sheet. */
  const SEAT_DROP = 6;
  const holdUp = o.holdUp ?? false;
  const build = o.build ?? 0;
  const strideMax = o.stride ?? 3;
  const tw = 7 + build;            // torso half-width: 6, 7 or 8
  const eye = shade(skin, 0.34);   // reads as dark on any complexion

  return pixTex(FW * 5, FH * 2, (g) => {
    for (let view = 0; view < 5; view++) {
      for (let frame = 0; frame < 2; frame++) {
        const ox = view * FW, oy = frame * FH;
        const cx = ox + FW / 2;
        const stride = frame === 0 ? 0 : strideMax;
        // ── legs ──────────────────────────────────────────────────────
        //
        // THE UNMIRRORED PROFILE FACES LEFT. Every other feature already says
        // so — the nose at cx-7, the eye at cx-4, the cap brim at cx-9 (its
        // comment reads "brim points forward"), the long hair falling at cx+1
        // behind the skull. The legs and feet below are the only parts that did
        // not know it, and `viewFor` mirrors this column for the other side, so
        // getting it right here gets both profiles right.
        const pantsC = fit === 'dress' ? skin : pants; // dresses show legs
        // How far each leg is thrown from the body's centre line. The +1 is the
        // fix for a STANDING profile having exactly one leg: at stride 0 the two
        // legs were both drawn at cx-2, i.e. on top of each other.
        const legOff = stride + 1;
        // ── WHERE A SEATED LEG GOES, AND WHY IT IS NOT WHERE IT WAS ──────────
        //
        // Item 272. The user: *"people sitting still looks bad because they
        // have no legs??"* **The legs were painted the whole time.** What was
        // wrong is WHICH ROWS they were painted on.
        //
        // `citizenPlane` puts the seated origin at the HIP, and a room places
        // that origin on the SEAT TOP it already registered. So the origin row
        // IS the seat's top face, and every row this block drew *below* it was
        // inside the furniture. The old block drew rows 44…59 — i.e. all of it,
        // 100%, under the seat line.
        //
        // Measured in the diner rather than reasoned from the sheet
        // (`scripts/probes/w112-seated-legs-census.mjs`): the sprite's leg band
        // ran y −0.144 … 0.450 against a bench whose top face is at 0.450 and
        // whose front face stands **0.22 m nearer the aisle than the sprite
        // plane**. Hiding just those two bench boxes at runtime brought the
        // legs straight back (`w112-is-it-occlusion.mjs`), which is what makes
        // this OCCLUSION and not missing art — and rules out the two cheaper
        // hypotheses, that the `seated` flag was unset or the figure too high.
        //
        // So the thigh now goes ABOVE the origin row, resting on the seat where
        // a sitter's thigh is, and the shin drops FORWARD of the seat's front
        // edge, where a sitter's shin is. The sizing is derived from the seats
        // that exist, the same way SEAT_DROP was: a booth bench is 0.55 m deep,
        // so its front face is 0.275 m ahead of a sitter placed at the bench
        // centre, and 0.275 m is 9.3 texels at this sprite's 1.9 m / 64 rows.
        // A knee at 12 clears it; a knee at 8 would not.
        //
        // AND THE PROFILE POINTED OUT OF HIS BACK. The unmirrored profile faces
        // LEFT — the nose at cx−7, the eye at cx−4, the standing shoe's toe at
        // ankle−7 all say so — and the old thigh ran from cx−2 to cx+8, to the
        // RIGHT. GOTCHAS 33 again: anything with a front ends up backwards.
        const SEAT = oy + 38 + SEAT_DROP;   // the origin row: the seat's top face
        const FOOT_Y = oy + 59;             // the floor. Unchanged — feet still land
        const THIGH = 6;                    // rows of thigh above the seat, ~0.18 m
        const KNEE = SEATED_KNEE_TEXELS;    // texels FORWARD of the hip, ~0.36 m
        g.fillStyle = pantsC;
        if (seated) {
          if (view === 2) {
            // Side on, and this is the view the aisle actually gives you: the
            // thigh runs forward along the seat, the shin drops in front of it.
            g.fillStyle = shade(pantsC, 0.62);
            g.fillRect(cx - KNEE, SEAT - THIGH, KNEE + 2, THIGH);        // far thigh
            g.fillRect(cx - KNEE, SEAT, 4, FOOT_Y - SEAT);               // far shin
            g.fillStyle = pantsC;
            g.fillRect(cx - KNEE - 1, SEAT - THIGH + 1, KNEE + 2, THIGH); // near thigh, over it
            g.fillRect(cx - KNEE - 1, SEAT + 1, 4, FOOT_Y - SEAT - 1);    // near shin
          } else {
            // FORESHORTENED, and this is the half the leg-only attempt got
            // wrong: from the front a lap is a WIDE SHORT MASS at hip height,
            // not two verticals. The knees are the nearest thing to the
            // viewer, so the thigh reads as width rather than length — and it
            // has to be WIDER than the torso or the torso paints over all of
            // it, which is what happens at `tw * 2 - 2`.
            const lapW = tw * 2 + 6;
            g.fillRect(cx - Math.floor(lapW / 2), SEAT - THIGH, lapW, THIGH);
            g.fillStyle = shade(pantsC, view >= 3 ? 0.72 : 0.9);
            g.fillRect(cx - 6, SEAT, 5, FOOT_Y - SEAT);
            g.fillRect(cx + 1, SEAT, 5, FOOT_Y - SEAT);
          }
          g.fillStyle = pantsC;
        } else if (view === 2) {
          // Back leg first, in an OPAQUE darker tone, then the front leg over
          // it. It used to be a 35%-black overlay — which with alphaTest 0.5
          // disappears anywhere it is not sitting on top of the front leg, so
          // simply offsetting it would have drawn nothing at all.
          g.fillStyle = shade(pantsC, 0.62);
          g.fillRect(cx - 2 + legOff, oy + 38, 4, 21);
          g.fillStyle = pantsC;
          g.fillRect(cx - 2 - legOff, oy + 38, 4, 21);
        } else {
          g.fillRect(cx - 5 - stride, oy + 38, 4, 21);
          g.fillRect(cx + 1 + stride, oy + 38, 4, 21);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(cx + 1 + stride, oy + 38, 4, 21);
        }
        g.fillStyle = '#16161a';
        if (seated) {
          // A SEATED SHOE GOES UNDER ITS OWN SHIN, not under the body. The old
          // block fell through to the standing cases below and put both shoes
          // beneath the hip while the shins were somewhere else entirely —
          // which is why the sheet read as a standing figure with its legs
          // lopped off. Same rows (57…59) either way, so the sprite still
          // reaches the floor and nothing about its footprint changes.
          if (view === 2) {
            // 6 texels rather than the standing 8: the profile shoe is now at
            // cx − KNEE − 4 and 8 would start at cx − 17, one texel INTO THE
            // NEIGHBOURING FRAME of the atlas. A 0.18 m shoe seen slightly
            // foreshortened is the honest thing to draw in the room that is left.
            g.fillRect(cx - KNEE - 4, oy + 57, 6, 3);
          } else {
            g.fillRect(cx - 7, oy + 57, 6, 3);
            g.fillRect(cx + 1, oy + 57, 6, 3);
          }
        } else if (view === 2) {
          // PROFILE FEET, third attempt. The shape is what was wrong, not the
          // placement: it spanned cx-5 … cx+6 around a leg at cx-2 … cx+2, so
          // it stuck out about as far behind the ankle as in front of it. A
          // foot symmetric about the ankle cannot say which way it points, and
          // the eye resolves that as BACKWARDS — the user's own word.
          //
          // A real profile foot has the ankle near the back: a stub of heel
          // behind it and the whole length forward. 8 texels long with the
          // ankle 1 from the heel is, at this sprite's 3 cm/texel, a 24 cm foot
          // with 3 cm of heel — and it points LEFT, the way this view faces.
          //
          // Each shoe sits under ITS OWN leg now (ankle on that leg's centre)
          // rather than at a separately capped offset. That is what keeps the
          // old "two shoes floating beside the person" bug from coming back:
          // the shoes used to be flung 12 texels apart while both legs were
          // drawn at the same x, so they floated either side of one narrow leg.
          // With the legs splaying by the same stride, a shoe is always
          // attached to a leg — at stride 5 the front pair is out in front and
          // the back shoe's toe reaches under the body, which is what a stride
          // looks like from the side.
          // The ankles are separated by `stride`, one texel less than the legs
          // are. At rest that collapses them onto each other, so a standing
          // profile has ONE shoe of the right length (8 texels) instead of an
          // 11-texel plank made of two offset ones — while the legs keep their
          // split and still read as two. Walking, each shoe sits under its leg.
          for (const s of [1, -1]) {
            const ankle = cx + s * stride;
            g.fillRect(ankle - 7, oy + 57, 8, 3);
          }
        } else {
          g.fillRect(cx - 6 - stride, oy + 57, 6, 3);
          g.fillRect(cx + stride, oy + 57, 6, 3);
        }
        // EVERYTHING BELOW IS THE UPPER BODY, and when seated it all comes
        // down together. One translate rather than SEAT_DROP added to forty
        // row literals — and it is only possible because the legs and feet are
        // already drawn above. The leg-only attempt failed precisely here: the
        // profile read as sitting and the other four did not, because the head
        // stayed at standing height (shots/seated.png, before this).
        //
        // …AND IN PROFILE IT ALSO COMES BACK. `SEAT_BACK` is the other half of
        // the leg fix and it is not decoration: the profile torso is drawn
        // `tw * 2` wide — the SHOULDER width, 12-16 texels — so a knee 12
        // texels forward of the hip pokes out by only `12 − tw`, i.e. 4 texels
        // on a broad build. The thigh then lands in the same columns as the
        // shin below it and the whole leg reads as one vertical bar, which is
        // exactly what the broad coated customer looked like on the first pass
        // (`shots/w112-zoom-0-try2.png`, kept: it is the failure this fixes).
        // Setting the upper body 3 texels back — 0.09 m, and a sitter does lean
        // back — buys the thigh 3 more texels of daylight and turns the bar
        // into an L. Profile only: in the other four views the horizontal axis
        // is not the direction he faces, so a shift there would just move him.
        const SEAT_BACK = 3;
        if (seated) g.translate(view === 2 ? SEAT_BACK : 0, SEAT_DROP);
        // ── torso ─────────────────────────────────────────────────────
        const torsoBot = fit === 'coat' ? 45 : 39;
        g.fillStyle = jacket;
        g.fillRect(cx - tw, oy + 20, tw * 2, torsoBot - 20);
        if (grime > 0) {
          // Unwashed: sweat-yellowed collar and pits, food stains down the
          // front, grubby cuffs. Drawn as low-alpha blotches so they read as
          // dirt in the cloth rather than as pattern.
          const G = `rgba(96,80,44,${0.20 * grime})`;
          const G2 = `rgba(60,48,30,${0.26 * grime})`;
          g.fillStyle = G;
          g.fillRect(cx - 7, oy + 20, 14, 3);          // collar
          g.fillRect(cx - 7, oy + 25, 3, 5); g.fillRect(cx + 4, oy + 25, 3, 5);  // pits
          g.fillStyle = G2;
          g.fillRect(cx - 3, oy + 30, 4, 3);           // down the front
          g.fillRect(cx + 1, oy + 34, 3, 2);
          g.fillRect(cx - 6, oy + 36, 3, 2);
        }
        // soft edge shading only — narrow 2 px rim lighting, not wide bands, so
        // the torso reads as rounded cloth instead of vertical stripes
        if (view < 4) {
          g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(cx - tw, oy + 20, 2, torsoBot - 20);
          g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx + tw - 2, oy + 20, 2, torsoBot - 20);
        } else {
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - tw, oy + 20, tw * 2, torsoBot - 20);
        }
        if (view === 4) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(cx - tw + 1, oy + 24, tw * 2 - 2, 2); }
        if (fit === 'coat' && view < 4) {   // a long coat gets a centre seam
          g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(cx - 1, oy + 22, 1, torsoBot - 23);
        }
        if (fit === 'dress') { // flared skirt over the hips
          g.fillStyle = jacket;
          g.fillRect(cx - tw, oy + 32, tw * 2, 6);
          g.fillRect(cx - tw - 1, oy + 36, tw * 2 + 2, 7);
        }
        // ── arms ──────────────────────────────────────────────────────
        g.fillStyle = jacket;
        // A SEATED ARM DOES NOT HANG TO THE SEAT. It was the arms, not the
        // torso, that hid the seated lap: jacket runs from row 21 to `armBot`
        // and the hand three rows past that, at cx±(tw…tw+3) — the exact texels
        // a thigh has to protrude through. Standing, that is right. Seated at a
        // table it is not: the forearm comes up and forward onto the table, and
        // 31 puts the hand at rows 37-40, clear of the seat line at 44 with the
        // lap showing under it. Every seated figure in the world is at a table,
        // a desk, a counter or a pew rail. (Item 272.)
        const armBot = seated ? 31 : (fit === 'coat' ? 40 : 36);
        const SHOULDER = oy + 21;
        /** An arm that leaves the shoulder at `sx` and closes its fist on the
         *  umbrella's HANDLE — beside the head at `HOLD_ROW`, `HOLD_X` texels
         *  out from the centre line.
         *
         *  ONE ANGLED RUN, where this used to be two segments. The old fist
         *  finished ABOVE the crown and INBOARD, at the centre line, so the arm
         *  had no way up that did not cross the face: it had to climb outside
         *  the head's silhouette and only turn in over the top of it, which is
         *  a salute with an umbrella in it, and is what the report is about.
         *
         *  A fist beside the jaw needs none of that. Shoulder to hand is a
         *  straight diagonal, up and slightly in — elbow out, forearm angled,
         *  hand at the jaw — and it never enters the head's columns at all.
         *
         *  Drawn a row at a time so the staircase is hard pixels rather than an
         *  arc `NearestFilter` would only fight — the same reasoning the
         *  umbrella's own dome is drawn with. */
        const reachUp = (sx: number, w: number) => {
          const endX = cx + HOLD_X - Math.floor(w / 2);
          g.fillStyle = jacket;
          for (let row = 21; row >= HOLD_ROW; row--) {
            const t = (21 - row) / (21 - HOLD_ROW);
            g.fillRect(Math.round(sx + (endX - sx) * t), oy + row, w, 1);
          }
          // the fist, closed round the handle — the same skin block the hanging
          // hand uses, so a hand is a hand whichever way the arm goes
          g.fillStyle = skin;
          g.fillRect(endX, oy + HOLD_ROW - 1, w, 3);
        };
        // ⚠ THE RAISED ARM IS DRAWN LAST, NOT HERE. Arms come before the head
        // in this function, and a hand that finishes at row 15 runs alongside
        // rows the hair, the cap brim and the hood all reach — long hair and a
        // hood both cover cx+5..cx+6, and the fist sits at cx+5..cx+7. Painted
        // in place it would be part-swallowed by the head. So the raise is
        // deferred to the foot of the frame, after everything on the head is
        // down, and the hand reads as being in front of it.
        let raise: (() => void) | null = null;
        if (view === 2) {
          // ⚠ THE PROFILE RAISES FROM cx+1, NOT FROM cx-2 WHERE ITS ARM HANGS.
          // This is the facing the eight-angle trap lives in. Everywhere else
          // the shoulder is already outboard of the head (cx+tw against a head
          // ending at cx+4), so the arm rises in clear air. In profile the one
          // visible arm is drawn at the body's centre, and a run from there up
          // to a fist at cx+4 crosses rows 15-19 at cx+0…cx+4 — straight over
          // the jaw, a 4-texel jacket bar across the lower face on a head ten
          // texels wide. Three texels back (9 cm, invisible at the shoulder,
          // decisive at the head) puts the whole run behind the skull's back
          // edge instead, which is also where a raised arm goes when you see
          // someone side-on.
          if (holdUp) raise = () => reachUp(cx + 1, 4);
          else {
            g.fillRect(cx - 2, oy + 21, 4, armBot - 21);
            g.fillStyle = skin; g.fillRect(cx - 2, oy + armBot, 4, 3);
          }
        } else {
          // ONE ARM GOES UP AND THE OTHER KEEPS HANGING. Both up is surrender,
          // and it is also wrong: a person under an umbrella has a spare hand.
          // The +x arm is the raised one — the lit side, and the side the
          // canopy's own highlight is on (`ct/crowd.ts`'s flanks put the light
          // on the right), so the two agree about where the sun is. `viewFor`
          // mirrors this column for the far profile, which turns it into the
          // −x arm there — the same physical arm seen from the other side,
          // which is what a mirror is for.
          g.fillRect(cx - tw - 3, oy + 21, 3, armBot - 21);
          g.fillStyle = skin; g.fillRect(cx - tw - 3, oy + armBot, 3, 3);
          if (holdUp) raise = () => reachUp(cx + tw, 3);
          else {
            g.fillStyle = jacket;
            g.fillRect(cx + tw, oy + 21, 3, armBot - 21);
            g.fillStyle = skin; g.fillRect(cx + tw, oy + armBot, 3, 3);
          }
        }
        // ── head ──────────────────────────────────────────────────────
        g.fillStyle = skin;
        g.fillRect(cx - 5, oy + 8, 10, 12);
        // ── the face gets a RIM, not bands ─────────────────────────────
        //
        // This used to be 3 texels of rgba(255,255,255,0.2) down the left and
        // 3 of rgba(0,0,0,0.18) down the right — on a head 10 texels wide, so
        // 3 lightened, 4 true skin, 3 darkened. A three-band face. At ten
        // pixels those bands are wide enough to read as AREAS, and a face is
        // the one surface where banding reads as skin discolouration rather
        // than as light: people read faces far more finely than they read
        // coats. On the torso the same idea works, and its own comment says
        // why — "narrow 2 px rim lighting, not wide bands" on a body 14 wide.
        // The head never got that treatment even though it is NARROWER.
        //
        // So: 1 texel each side and a third of the alpha. Enough to round the
        // skull, not enough to be a colour. It is also the option that
        // survives a hood best, which is the fit the report came from: a hood
        // eats the outer texels of the head, so a 3-wide band left mostly
        // tinted strips inside the opening with hardly any base tone between,
        // while a 1-wide rim is either covered outright or reads as an edge.
        //
        // (The third option in the queue — scaling strength with head size —
        // does not apply here: every head in the cast is the same 10 texels.
        // hs scales the MESH, so a shorter person's head loses no more of its
        // texels than a taller one's. The apparent difference is that a
        // smaller sprite spreads the same banding over fewer screen pixels.)
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(cx - 5, oy + 8, 1, 12);
        g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(cx + 4, oy + 8, 1, 12);
        if (grime > 0 && view <= 2) {
          // Days unshaven. Lower half of the face only, and only on the views
          // that HAVE a face — 3 and 4 are the back of the head, where a jaw
          // shadow would read as a bald patch. Laid over the head's own
          // shading and under the hair, so it darkens the skin without
          // flattening the rim light.
          g.fillStyle = `rgba(58,44,34,${0.34 * grime})`;
          g.fillRect(cx - 5, oy + 15, 10, 5);
        }
        // ── hair: shape as well as colour ─────────────────────────────
        // A hood or a cap covers all of this, so skip the work when it would
        // only be painted over.
        const covered = fit === 'hoodie';
        if (!covered && cut !== 'bald') {
          g.fillStyle = hair;
          const capTop = () => {
            if (view === 4) g.fillRect(cx - 6, oy + 5, 12, 6);
            else if (view === 3) { g.fillRect(cx - 6, oy + 5, 12, 6); g.fillRect(cx + 1, oy + 5, 5, 8); }
            else { g.fillRect(cx - 6, oy + 5, 12, 5); g.fillRect(cx - 6, oy + 8, 2, 4); }
          };
          if (cut === 'crop') {          // clipped close to the skull
            if (view === 4) g.fillRect(cx - 6, oy + 5, 12, 5);
            else if (view === 3) { g.fillRect(cx - 6, oy + 5, 12, 5); g.fillRect(cx + 2, oy + 5, 4, 6); }
            else { g.fillRect(cx - 6, oy + 5, 12, 4); g.fillRect(cx - 6, oy + 7, 2, 2); }
          } else if (cut === 'long') {   // falls past the shoulders
            capTop();
            if (view === 4 || view === 3) {
              // From behind, long hair is the whole silhouette — so it has to
              // be a VOLUME, not a filled rectangle: rounded crown, tapered
              // ends, and the same rim shading the torso gets.
              g.fillRect(cx - 6, oy + 6, 12, 13);
              g.fillRect(cx - 5, oy + 5, 10, 1);
              g.fillRect(cx - 5, oy + 19, 10, 3);
              g.fillRect(cx - 4, oy + 22, 8, 1);
              g.fillStyle = 'rgba(255,255,255,0.11)'; g.fillRect(cx - 6, oy + 6, 2, 13);
              g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 4, oy + 6, 2, 15);
              g.fillStyle = hair;
            } else if (view === 2) {
              g.fillRect(cx + 1, oy + 5, 5, 14); g.fillRect(cx + 1, oy + 19, 4, 2);
              g.fillRect(cx - 6, oy + 5, 12, 6);
              g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx + 4, oy + 6, 2, 13);
              g.fillStyle = hair;
            } else {
              g.fillRect(cx - 7, oy + 6, 2, 13); g.fillRect(cx + 5, oy + 6, 2, 13);
              g.fillRect(cx - 6, oy + 19, 2, 2); g.fillRect(cx + 4, oy + 19, 2, 2);
            }
          } else if (cut === 'tied') {   // pulled back into a knot
            // ── THE KNOT HAS TO SIT ON THE HEAD ─────────────────────────────
            //
            // "whats up with this kids face? its multi color?" — this is the
            // smallest citizen (hs 0.91, ball cap), and the knot was drawn
            // OUTSIDE their skull. The head's silhouette ends at cx+4 and
            // capTop covers cx-6..cx+5, but the profile knot was
            // `fillRect(cx + 4, oy + 8, 4, 6)` = cx+4..cx+8: its lower four
            // rows had nothing behind them at all, so it read as a loose brown
            // rectangle beside the face, touching only at one corner. A head
            // made of a red cap, a tan face and a floating brown block is
            // three colours that do not join up, which is the report.
            //
            // Every piece below now lands INSIDE the crown it grows out of,
            // and the sizes come from the head's own extents rather than from
            // numbers that happened to look right on one view.
            capTop();
            if (view === 4) { g.fillRect(cx - 6, oy + 5, 12, 7); g.fillRect(cx - 3, oy + 11, 6, 5); }
            else if (view === 3) g.fillRect(cx + 2, oy + 9, 4, 4);   // was 5x6, ran past cx+6
            else if (view === 2) g.fillRect(cx + 3, oy + 9, 3, 4);   // was at cx+4..cx+8, off the head
            // the loose strands at the temples: ON the crown's own edge
            // columns, not one texel outside them on both sides
            else { g.fillRect(cx - 6, oy + 7, 1, 4); g.fillRect(cx + 5, oy + 7, 1, 4); }
          } else {                        // 'short'
            capTop();
          }
          // the hairline sits ON the head, so it takes the head's own shading
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx + 2, oy + 5, 3, 3);
        }
        if (cut === 'bald' && !covered) {
          // Everyone else's crown is made of hair, so without it the skull
          // stops at row 8 and reads as a flat slab. Build the crown out of
          // skin instead, inset at the very top so it rounds off, and carry
          // the same rim shading the face uses.
          g.fillStyle = skin;
          g.fillRect(cx - 5, oy + 6, 10, 3);
          g.fillRect(cx - 4, oy + 5, 8, 1);
          // the crown carries the SAME rim as the face below it — 1 texel, low
          // alpha. It used to be the old 3-wide bands, which put the banding on
          // the one head in the cast that has no hair to hide it.
          g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(cx - 5, oy + 6, 1, 3);
          g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(cx + 4, oy + 6, 1, 3);
          // a soft sheen across the top of the skull, which is a HIGHLIGHT on a
          // bald head rather than a side band, so it stays
          if (view <= 2) { g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(cx - 3, oy + 6, 4, 1); }
          // ── a trace of hair, INSIDE THE SKULL'S OWN EXTENTS ────────────
          //
          // `capTop` runs cx-6..cx+5 because HAIR has volume and sits proud of
          // the skull. A bald head has no volume to sit proud of, and this
          // fringe was borrowing the haired silhouette anyway: cx-6..cx+5
          // against a skull of cx-5..cx+4, so it hung a texel over each side
          // on every view. On a head ten texels wide that is a tenth of it,
          // and in grey against a pale scalp it reads as two blobs stuck on
          // the sides and a bar across the back — the same "face made of
          // parts that do not line up" as the knot above.
          g.fillStyle = hair;
          if (view === 4 || view === 3) g.fillRect(cx - 5, oy + 9, 10, 2);
          else if (view === 2) g.fillRect(cx + 1, oy + 9, 4, 2);
          else { g.fillRect(cx - 5, oy + 9, 2, 3); g.fillRect(cx + 3, oy + 9, 2, 3); }
        }
        // ── headwear / hood ───────────────────────────────────────────
        if (fit === 'cap') { // ball cap over the hair
          g.fillStyle = accent;
          g.fillRect(cx - 6, oy + 4, 12, 5);
          if (view <= 1) g.fillRect(cx - 7, oy + 8, 14, 2);
          else if (view === 2) g.fillRect(cx - 9, oy + 8, 8, 2); // brim points forward
        } else if (fit === 'hoodie') {
          g.fillStyle = jacket;
          // the hood is the same cloth as the sweater: same fill AND the same
          // highlight/shadow overlays, so the color reads identical
          if (view === 4) { // dead back: hood swallows the head
            g.fillRect(cx - 7, oy + 4, 14, 16);
            g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx - 7, oy + 4, 14, 16);
          } else if (view === 3) { // 3/4 back: hood covers everything, no face
            g.fillRect(cx - 7, oy + 4, 14, 16);
            g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(cx - 7, oy + 4, 2, 16);
            g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx + 5, oy + 4, 2, 16);
          } else if (view === 2) { // profile: hood over the whole head, one sliver of face in the opening
            g.fillRect(cx - 7, oy + 4, 14, 16);
            g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx + 5, oy + 4, 2, 16);
            g.fillStyle = skin; g.fillRect(cx - 6, oy + 12, 4, 6);
          } else { // front views: rim frames the face — chin stays clear
            g.fillRect(cx - 7, oy + 4, 14, 4);
            g.fillRect(cx - 7, oy + 6, 2, 14); g.fillRect(cx + 5, oy + 6, 2, 14);
            g.fillRect(cx - 7, oy + 18, 3, 2); g.fillRect(cx + 4, oy + 18, 3, 2);
            g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(cx + 5, oy + 4, 2, 16);
            g.fillStyle = 'rgba(220,216,204,0.5)'; // soft drawstrings, not bright stripes
            g.fillRect(cx - 1, oy + 21, 1, 4); g.fillRect(cx + 1, oy + 21, 1, 4);
          }
        }
        // ── face ──────────────────────────────────────────────────────
        g.fillStyle = eye;
        if (view === 0) { g.fillRect(cx - 3, oy + 13, 2, 2); g.fillRect(cx + 2, oy + 13, 2, 2); }
        else if (view === 1) { g.fillRect(cx - 4, oy + 13, 2, 2); g.fillRect(cx + 1, oy + 13, 2, 2); }
        else if (view === 2) { g.fillRect(cx - 4, oy + 13, 2, 2); g.fillStyle = skin; g.fillRect(cx - 7, oy + 14, 2, 3); }
        if (view <= 1) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - 2, oy + 17, 5, 1); }
        // …and NOW the raised arm, in front of the head and everything on it.
        // See the note beside `raise` in the arms block for why it waits.
        raise?.();
        // put the frame back — BOTH axes, and the x term must mirror the one
        // above exactly. There is no save()/restore() in this loop; the next
        // view would inherit whatever is left here, and 10 frames of creeping
        // offset is a defect that looks like a paint bug rather than a
        // bookkeeping one.
        if (seated) g.translate(view === 2 ? -SEAT_BACK : 0, -SEAT_DROP);
      }
    }
  });
}

/** Which of the 8 facing sectors an angle falls in, as a CONTINUOUS position:
 *  2.5 means exactly on the boundary between sectors 2 and 3. The caller needs
 *  the fraction, not just the rounded index, because switching sprite view at
 *  the exact midpoint makes a walker whose heading sits on a boundary flicker
 *  between two views every frame — which reads as the whole person twitching.
 *  See the hysteresis in ct/crowd.ts. */
export const sectorAt = (rel: number) => {
  const s = rel / (Math.PI / 4);
  return ((s % 8) + 8) % 8;
};

/** the painted column for a sector, and whether it is drawn mirrored */
export function viewAt(sector: number): [number, boolean] {
  const s = ((Math.round(sector) % 8) + 8) % 8;
  const cols = [0, 1, 2, 3, 4, 3, 2, 1];
  return [cols[s], s > 4];
}

export function viewFor(rel: number): [number, boolean] {
  return viewAt(sectorAt(rel));
}

/** The citizen plane, with its origin AT THE PAINTED FEET.
 *
 *  Not at the frame's bottom edge, which is where `translate(0, 0.95, 0)` put
 *  it and why every figure in the world floated. The atlas paints the shoe at
 *  rows 57-59 of a 64-row frame, so FOUR rows below it are empty — and a plane
 *  1.9 m tall over 64 rows makes that 4 * 1.9/64 = 0.119 m of transparent
 *  padding standing between the feet and the ground.
 *
 *  It reads as a call-site bug and is not one: the gap is identical for every
 *  figure whatever its y, because it is a property of the SPRITE. C measured it
 *  world-wide — seven figures, call-site gap 0.000 for all of them, atlas
 *  padding 0.108-0.129, and that spread is only each figure's height scale.
 *
 *  ONE FUNCTION, because there were two copies of these two lines — here and in
 *  ct/crowd.ts — and two copies of a constant disagree eventually. Fixing them
 *  separately would have left the street and the interiors 12 cm apart.
 */
export function citizenPlane(seated = false): THREE.PlaneGeometry {
  const H = SPRITE_H_M;
  const PAD_ROWS = 4;                        // empty rows under the shoe
  const geo = new THREE.PlaneGeometry(0.95, H);
  // ── WHERE THE ORIGIN SITS, AND WHY IT MOVES WHEN SEATED ────────────────
  //
  // Standing, the origin is the PAINTED SHOE — not the frame's bottom edge,
  // which is where `translate(0, 0.95, 0)` put it and why every figure in the
  // world floated 12 cm. Four empty rows sit under the shoe and they are what
  // that gap was.
  //
  // Seated, the origin is the HIP, at row 47 of 64. The desk's ruling and the
  // reason for it: a room already knows where its seat is — it registered it —
  // so it should place a sitter by that seat and never compute an offset.
  // Five modules and ten rooms each doing their own arithmetic is exactly the
  // shape of the float this same function exists to have fixed.
  //
  //   standing   mesh.position.set(x, groundY, z)
  //   seated     mesh.position.set(x, seatY,   z)     <- the seat you registered
  //
  // The shoe still lands on row 59 either way, so a sitter's feet reach the
  // floor when the seat is at a sane height, and nothing about the standing
  // figure's footprint changes.
  const HIP_ROW = 44, ROWS = 64;   // 0.445 m above the shoe — see SEAT_DROP
  const originRow = seated ? HIP_ROW : ROWS - PAD_ROWS;
  // SIGN CARE. The plane spans -H/2..+H/2, so frame row r sits at
  // y = H/2 - (r/ROWS)*H, and putting the ORIGIN there means translating by
  // the NEGATIVE of that. I got this backwards when I rewrote the function for
  // the seated pose — the original measured PAD_ROWS up from the bottom, I
  // measured originRow down from the top and kept the same sign, which put
  // every standing citizen's origin at the crown of its head and sank the
  // whole crowd 1.66 m. Caught by measuring the composed sprite's bounds
  // rather than the atlas frames, which is the check the seated work never had.
  geo.translate(0, (originRow / ROWS) * H - H / 2, 0);
  return geo;
}

// ── THE PRIMITIVE: one call, one person ────────────────────────────────────
//
// Every person indoors is currently a hand-painted single-view plane — the diner
// waitress, the bodega keeper, the casino, the hotel, the tax office — because
// wiring the 8-angle atlas by hand is a dozen lines of billboard and UV
// arithmetic and nobody should have to know it. This is that dozen lines, once.
//
// It is the primitive under a room-level helper, not a competitor to one: an
// interior kit can wrap this in `room.person()` and callers never see it.
//
//   const w = citizenSprite(
//     { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e',
//       fit: 'plain', cut: 'tied', build: -1, stride: 3 },
//     { facing: Math.PI, h: 0.97, w: 0.99 },
//   );
//   w.mesh.position.set(x, floorY, z);        // origin is at the FEET
//   scene.add(w.mesh);
//   ctx.onFrame(({ px, pz, dt }) => w.update(px, pz, dt));
//
// That is the whole of it. The billboard turn, the choice of painted view, the
// mirroring of the back half, the standing-vs-walking frame and the hysteresis
// that stops the sprite flickering on a view boundary are all handled here.

export interface CitizenSprite {
  /** ready to add. The geometry's origin is at the FEET, so set position to
   *  floor height and scaling never sinks anyone into the floor. */
  mesh: THREE.Mesh;
  /** Call once per frame with the player's position. Turns the billboard and
   *  picks the painted view. `dt` only matters if the person is walking. */
  update: (px: number, pz: number, dt?: number) => void;
  /** Which way the person is TURNED, as atan2(vx, vz) — 0 faces +z, π faces -z.
   *  For somebody walking, pass their direction of travel. */
  setFacing: (rad: number) => void;
  /** Walking animates the two painted frames; standing holds feet-together.
   *  A stationary person whose feet keep striding reads as broken. */
  setWalking: (on: boolean) => void;
}

export function citizenSprite(look: Look, o: {
  /** initial facing, atan2(vx, vz). Default 0 = facing +z. */
  facing?: number;
  /** mesh scale — height and width vary independently of `build` */
  h?: number; w?: number;
  /** steps per second while walking; long legs swing slower */
  cadence?: number;
  /**
   * Stand this far FORWARD of the placed origin, along `facing`, in metres.
   *
   * ── WHY THIS EXISTS ────────────────────────────────────────────────────
   * *"people sitting still looks bad because they have no legs??"* — the user,
   * 2026-08-03. A seated figure is ONE FLAT BILLBOARD whose origin is the hip,
   * and a room places that hip at the seat's own centre. The legs are then
   * drawn from the hip down to the floor, which is precisely the volume the
   * cushion occupies — and because the plane billboards about a vertical axis
   * through the hip, THERE IS NO HORIZONTAL DIRECTION FROM WHICH THEY ARE
   * OUTSIDE THE SEAT. Worker onehundredeight proved that with one camera and
   * two frames (only the furniture's `visible` flipped): furniture shown, the
   * sitters are cut off dead level with the bench top; furniture hidden, both
   * have full legs and both feet on the floor.
   *
   * So it cannot be fixed by redrawing the atlas — the furthest-forward seated
   * pixel reaches 0.21 m against a 0.275 m bench half-depth, and every pixel a
   * single billboard paints is at the hip's depth anyway. It is a PLACEMENT
   * fault, and this is the placement.
   *
   * ── IT IS OPT-IN, AND THAT IS THE WHOLE DESIGN ─────────────────────────
   * The obvious version of this is one constant applied to every seated sprite.
   * **That is wrong, and 14 photographs say so.** Of the world's 14 seated
   * figures, six are occluded by a DESK, TABLE or SLOT MACHINE in front of them
   * — the bank's loan officer, three library readers, the church's pew sitter,
   * the casino's slot players — and for those, hiding the legs is CORRECT: it
   * is what sitting at a table looks like. A blanket offset drives their torsos
   * into the furniture they are sitting at, which is a regression the user
   * would see in three more rooms than the one he complained about.
   *
   * So the caller opts in, and passes a value DERIVED FROM THE SEAT IT OWNS
   * (`BENCH_W / 2`, `BENCH_D / 2 - SIT_OFF`, …) rather than a constant typed
   * here. Only the rooms where the SEAT ITSELF is the occluder pass anything.
   *
   * ── AND IT IS APPLIED IN `update()`, WHICH IS THE SAFETY ARGUMENT ──────
   * Two callers claim an occupied seat by reading `mesh.position` BACK after
   * placing it (`ct/interior.ts` room.person, `ct/int-casino.ts` sitter), and
   * `seatTaken`'s tolerance is 0.30 m — deliberately small, because casino
   * lounge seats are 0.65 m apart. A build-time offset of the natural size
   * (0.275 m) leaves 2.5 cm of that tolerance and any deeper seat spends it
   * outright, which would silently undo item 93 and offer the player a stool a
   * man is already sitting on.
   *
   * Both claims happen at BUILD time, immediately after `place()`/`put()`.
   * `update()` does not run until the first frame, which is strictly later — so
   * the registry records the TRUE seat exactly as it does today and that 2.5 cm
   * is never spent. Verified, not assumed: the 219-entry seat-offer vector is
   * byte-identical before and after this change.
   *
   * It cannot accumulate: every frame writes `base + offset`, never
   * `position += offset`. `base` is captured once, on the first update.
   */
  seatFwd?: number;
} = {}): CitizenSprite {
  const tex = citizenAtlas(look);
  tex.repeat.set(1 / 5, 1 / 2);
  // the plane's origin follows the pose: feet standing, HIP seated, so a room
  // places a sitter with the seat it already registered and never an offset
  const geo = citizenPlane(look.seated ?? false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, alphaTest: 0.5, side: THREE.DoubleSide,
  }));
  mesh.scale.set(o.w ?? 1, o.h ?? 1, 1);
  let facing = o.facing ?? 0;
  // PUBLISH THE FACING. `mesh.rotation.y` is NOT it — that is the billboard
  // angle, rewritten every frame to turn the plane towards the camera, so a
  // check that reads it measures where the OBSERVER stands. The real heading
  // lived only in this closure, which is why three of the five facing bugs this
  // project has shipped were PEOPLE and no check could see them: there was
  // nothing to read. `interiors-walk.mjs` had to decode it from the rendered
  // sprite, and only for shop keepers.
  //
  // THE KEY IS `citizenFacing`, and neither of the two obvious names was free:
  //   - `userData.citizen` is a BOOLEAN tag (`= true`) that rooms stamp on to
  //     mark a mesh as a person — ct/interior.ts, ct/int-casino.ts,
  //     ct/int-library.ts — and `scripts/J-library-people.mjs` tests it.
  //     Writing an object here would have silently changed that contract.
  //   - `userData.facing` is ALREADY TAKEN, for building shells: ct/street.ts
  //     and ct/bank.ts set it to the string 'x' or 'z', and
  //     `scripts/shells.mjs:124` traverses EVERY mesh looking for it. A number
  //     here would have made that instrument parse citizens as buildings.
  //
  // Set here rather than by the caller on purpose: the room tags are opt-in and
  // have been forgotten before — int-casino's own comment records five figures
  // going invisible to every people-sweep that way. Every sprite gets this one.
  mesh.userData.citizenFacing = facing;
  let walking = false;
  let sector = -1;
  let anim = 0;
  const cad = o.cadence ?? 5;
  // see `seatFwd` above. `base` is the position the ROOM placed, captured on
  // the first update and never written again, so the offset is idempotent.
  //
  // ── THE SAME 0.275 m WAS BEING CORRECTED TWICE (item 286) ─────────────────
  //
  // Items 272 and 280 were two fixes for ONE user complaint — *"people sitting
  // still looks bad because they have no legs??"* — written by different people
  // and landed within a day of each other. Each was verified alone; neither was
  // verified against the other, and they overlap EXACTLY:
  //
  //   · 280 (this option) moves the BODY forward by half the seat's depth —
  //     "put the hip on the front lip of the seat", the rule every adopter
  //     states verbatim (int-diner `BENCH_W/2`, int-jail `BENCH_D/2` and
  //     `bunkL/2`, int-casino `BENCH_D/2 - SIT_OFF`).
  //   · 272 draws the SHIN `SEATED_KNEE_M` (0.356 m) forward of the hip — and
  //     that 12-texel knee was sized, in this file's own words above, to clear a
  //     bench front face "0.275 m ahead of a sitter placed at the bench CENTRE".
  //
  // So the art already assumes the hip is at the seat's centre and reaches past
  // the lip on its own. Adding the body offset on top spent the same half-depth
  // a second time: in the diner it put both sitters' hips exactly on the table
  // edge (bench centre ±0.655 → ±0.38, and the table spans ±0.38) and their
  // shins at ±0.02 — i.e. both pairs of legs interpenetrating on the booth
  // centreline, under the middle of the table.
  //
  // THE FIX IS NOT TO PICK A WINNER. Both are right about something: the redraw
  // is right that the legs belong in front of the cushion, and the offset is
  // right that SOME seats are too deep for any 64-row sprite to reach across.
  // So the offset now supplies only what the ART CANNOT — the seat's half-depth
  // MINUS the knee's own reach, clamped at zero:
  //
  //   diner        0.275 - 0.356 -> 0        the redraw already clears it
  //   jail bench   0.210 - 0.356 -> 0                    "
  //   casino lounge 0.115 - 0.356 -> 0                   "
  //   jail bunk    0.960 - 0.356 -> 0.604    a 1.92 m bunk genuinely needs it
  //
  // Rooms keep passing the seat's half-depth, which is what all four already
  // pass and what the option has always meant to them; the reconciliation lives
  // here, in the one file that knows how far the art reaches, so a room that
  // changes its bench depth cannot reintroduce the double count.
  //
  // ⚠ IT IS A THRESHOLD, NOT A SUBTRACTION, AND I TRIED IT THE OTHER WAY FIRST.
  //
  // Subtracting the reach (`halfDepth - 0.356`) leaves the shin EXACTLY coplanar
  // with the seat's front face — zero clearance — and subtracting the reference
  // depth (`halfDepth - 0.275`) leaves only 0.081 m. Both are fine on a bench
  // you pass side-on, where the front face is a thin edge. Both FAILED on the
  // jail bunk, the one seat in this world a player can only view straight down
  // its own axis: a 1.92 m mattress slab is then a full-height occluder standing
  // directly between the sitter and the corridor, and it swallowed the leg
  // again at 0.604 and still at 0.685. Photographed all three ways from the same
  // vantage — `shots/w115-bunk-z045-PREFIX.png` (0.960, whole leg and shoe),
  // `w115-bunk-fixed.png` (0.604, shoe only) and `w115-bunk-z045-v2.png` (0.685,
  // shoe and a sliver). Item 280's author reached the same wall from the other
  // side, recording that `- 0.26` "hid his legs exactly as before".
  //
  // So the question is not how much to shave off; it is WHETHER THE ART CAN
  // REACH PAST THIS SEAT'S FRONT FACE AT ALL:
  //
  //   · it can (halfDepth <= SEATED_KNEE_M) -> the redraw already does the whole
  //     job and the body must NOT move, because the offset then spends the same
  //     half-depth twice and pushes the legs past the furniture into whatever is
  //     in front of it — in the diner, the opposite sitter.
  //   · it cannot (halfDepth > SEATED_KNEE_M) -> no 64-row sprite can cross this
  //     seat, the offset is doing work the art cannot, and the room's placement
  //     stands untouched.
  //
  //   diner        0.275 <= 0.356 -> 0        the redraw clears it
  //   jail bench   0.210 <= 0.356 -> 0                  "
  //   casino lounge 0.115 <= 0.356 -> 0                 "
  //   jail bunk    0.960 >  0.356 -> 0.960    unchanged; 280's fix survives intact
  //
  // This keeps BOTH landed fixes doing exactly the thing each was verified for,
  // and removes only the overlap between them.
  const askedFwd = o.seatFwd ?? 0;
  const seatFwd = askedFwd > SEATED_KNEE_M ? askedFwd : 0;
  let base: THREE.Vector3 | null = null;
  return {
    mesh,
    // kept in step with the closure — a published value that stops updating is
    // worse than none, because it looks live
    setFacing: (rad) => { facing = rad; mesh.userData.citizenFacing = rad; },
    setWalking: (on) => { walking = on; },
    update: (px, pz, dt = 0) => {
      // FORWARD OF THE SEAT, before anything reads the position — the billboard
      // must turn about where the figure ENDS UP, not about where it was placed.
      // `facing` is atan2(vx, vz), so forward is (sin f, 0, cos f).
      if (seatFwd) {
        if (!base) base = mesh.position.clone();
        mesh.position.set(base.x + Math.sin(facing) * seatFwd, base.y,
          base.z + Math.cos(facing) * seatFwd);
      }
      const camAng = Math.atan2(px - mesh.position.x, pz - mesh.position.z);
      mesh.rotation.y = camAng;               // the plane turns to face you
      // Hysteresis on the view, and it is not optional: rounding the heading to
      // one of 8 sectors switches at the exact midpoint, so a person whose angle
      // sits on a boundary flips between two painted columns every frame and
      // reads as twitching. Hold the current sector until clearly past it.
      const sPos = sectorAt(camAng - facing);
      if (sector < 0) sector = ((Math.round(sPos) % 8) + 8) % 8;
      let away = sPos - sector;
      while (away > 4) away -= 8;
      while (away < -4) away += 8;
      if (Math.abs(away) > 0.7) sector = ((Math.round(sPos) % 8) + 8) % 8;
      const [col, mirror] = viewAt(sector);
      if (walking) anim += dt * cad;
      const row = walking ? Math.floor(anim) % 2 : 0;
      tex.repeat.x = mirror ? -1 / 5 : 1 / 5;
      tex.offset.x = mirror ? (col + 1) / 5 : col / 5;
      tex.offset.y = row === 0 ? 0.5 : 0;
    },
  };
}

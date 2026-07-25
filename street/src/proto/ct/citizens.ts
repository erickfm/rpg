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
        g.fillStyle = pantsC;
        if (view === 2) {
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
        if (view === 2) {
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
        const armBot = fit === 'coat' ? 40 : 36;
        if (view === 2) {
          g.fillRect(cx - 2, oy + 21, 4, armBot - 21);
          g.fillStyle = skin; g.fillRect(cx - 2, oy + armBot, 4, 3);
        } else {
          g.fillRect(cx - tw - 3, oy + 21, 3, armBot - 21);
          g.fillRect(cx + tw, oy + 21, 3, armBot - 21);
          g.fillStyle = skin;
          g.fillRect(cx - tw - 3, oy + armBot, 3, 3); g.fillRect(cx + tw, oy + armBot, 3, 3);
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
            capTop();
            if (view === 4) { g.fillRect(cx - 6, oy + 5, 12, 7); g.fillRect(cx - 3, oy + 11, 6, 5); }
            else if (view === 3) g.fillRect(cx + 2, oy + 9, 5, 6);
            else if (view === 2) g.fillRect(cx + 4, oy + 8, 4, 6);
            else { g.fillRect(cx - 7, oy + 7, 1, 4); g.fillRect(cx + 6, oy + 7, 1, 4); }
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
          // a trace of hair still clinging round the back and sides
          g.fillStyle = hair;
          if (view === 4) g.fillRect(cx - 6, oy + 9, 12, 2);
          else if (view === 3) g.fillRect(cx - 6, oy + 9, 12, 2);
          else if (view === 2) g.fillRect(cx + 1, oy + 9, 5, 2);
          else { g.fillRect(cx - 6, oy + 9, 2, 3); g.fillRect(cx + 4, oy + 9, 2, 3); }
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
export function citizenPlane(): THREE.PlaneGeometry {
  const H = 1.9;
  const PAD_ROWS = 4;                        // empty rows under the shoe, see above
  const geo = new THREE.PlaneGeometry(0.95, H);
  geo.translate(0, H / 2 - (PAD_ROWS / FH) * H, 0);
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
} = {}): CitizenSprite {
  const tex = citizenAtlas(look);
  tex.repeat.set(1 / 5, 1 / 2);
  const geo = citizenPlane();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, alphaTest: 0.5, side: THREE.DoubleSide,
  }));
  mesh.scale.set(o.w ?? 1, o.h ?? 1, 1);
  let facing = o.facing ?? 0;
  let walking = false;
  let sector = -1;
  let anim = 0;
  const cad = o.cadence ?? 5;
  return {
    mesh,
    setFacing: (rad) => { facing = rad; },
    setWalking: (on) => { walking = on; },
    update: (px, pz, dt = 0) => {
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

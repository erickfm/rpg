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
        g.fillStyle = fit === 'dress' ? skin : pants; // dresses show legs
        if (view === 2) {
          g.fillRect(cx - 2 - stride, oy + 38, 4, 21);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(cx - 2 + stride, oy + 38, 4, 21);
        } else {
          g.fillRect(cx - 5 - stride, oy + 38, 4, 21);
          g.fillRect(cx + 1 + stride, oy + 38, 4, 21);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(cx + 1 + stride, oy + 38, 4, 21);
        }
        g.fillStyle = '#16161a';
        if (view === 2) {
          // PROFILE. Feet were drawn at the same spread as the front views —
          // 12 texels apart under a body only 4 wide — so from the side they
          // detached and read as two shoes floating beside the person. Seen
          // from the side you look along the shoe, so it is LONGER and the
          // two nearly overlap, parted only by the stride.
          //
          // Capped at 3 because stride is now per-person (2–5, tied to walking
          // speed). The shoe is 9 long and the two are set 2 + 2·stride apart,
          // so past stride 3.5 they part company again and the long-striding
          // walkers get the floating-shoes bug back. The legs above carry the
          // full stride, so the pace still reads.
          const fs = Math.min(stride, 3);
          g.fillRect(cx - 5 - fs, oy + 57, 9, 3);
          g.fillRect(cx - 3 + fs, oy + 57, 9, 3);
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
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(cx - 5, oy + 8, 3, 12);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 2, oy + 8, 3, 12);
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
          g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(cx - 5, oy + 6, 3, 3);
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 2, oy + 6, 3, 3);
          if (view <= 2) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(cx - 3, oy + 6, 4, 2); }
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

export function viewFor(rel: number): [number, boolean] {
  const sector = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
  const cols = [0, 1, 2, 3, 4, 3, 2, 1];
  return [cols[sector], sector > 4];
}

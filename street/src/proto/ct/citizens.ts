import * as THREE from 'three';
import { pixTex } from './paint';

export const FW = 32, FH = 64;
export type Fit = 'plain' | 'cap' | 'dress' | 'hoodie';
/**
 * `grime` (0…1) is for people who have not left the building in a while: it
 * sweats the shirt through at the collar and the underarms, drops a couple of
 * marks down the front and onto the trousers, leaves the jaw unshaven and the
 * hair unbrushed. Everything it draws is the same 1–2 texel vocabulary as the
 * rim shading, so a grimy citizen still reads as the same hand as a clean one.
 * At 0 — every existing caller — not one extra fill happens and the atlas is
 * byte-identical to before.
 */
export function citizenAtlas(jacket: string, pants: string, skin: string, hair: string, style: Fit = 'plain', accent = '#8a3a2e', grime = 0): THREE.Texture {
  return pixTex(FW * 5, FH * 2, (g) => {
    for (let view = 0; view < 5; view++) {
      for (let frame = 0; frame < 2; frame++) {
        const ox = view * FW, oy = frame * FH;
        const cx = ox + FW / 2;
        const stride = frame === 0 ? 0 : 3;
        g.fillStyle = style === 'dress' ? skin : pants; // dresses show legs
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
          g.fillRect(cx - 5 - stride, oy + 57, 9, 3);
          g.fillRect(cx - 3 + stride, oy + 57, 9, 3);
        } else {
          g.fillRect(cx - 6 - stride, oy + 57, 6, 3);
          g.fillRect(cx + stride, oy + 57, 6, 3);
        }
        g.fillStyle = jacket;
        g.fillRect(cx - 7, oy + 20, 14, 19);
        // soft edge shading only — narrow 2 px rim lighting, not wide bands, so
        // the torso reads as rounded cloth instead of vertical stripes
        if (view < 4) {
          g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(cx - 7, oy + 20, 2, 19);
          g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(cx + 5, oy + 20, 2, 19);
        } else {
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 7, oy + 20, 14, 19);
        }
        if (view === 4) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(cx - 6, oy + 24, 12, 2); }
        if (grime > 0) {
          // sweat and grease into the shirt. The torso is cx±7 for every
          // view, so these land the same way all the way round him.
          const st = (a: number) => `rgba(150,122,62,${(a * grime).toFixed(3)})`;
          g.fillStyle = st(0.30); g.fillRect(cx - 7, oy + 20, 14, 3);   // collar ring
          g.fillStyle = st(0.22); g.fillRect(cx - 7, oy + 34, 14, 5);   // waistband
          g.fillStyle = st(0.26); g.fillRect(cx - 7, oy + 23, 2, 8);    // underarms
          g.fillStyle = st(0.26); g.fillRect(cx + 5, oy + 23, 2, 8);
          g.fillStyle = st(0.34); g.fillRect(cx - 2, oy + 27, 3, 2);    // spilled down the front
          g.fillStyle = st(0.28); g.fillRect(cx + 1, oy + 30, 2, 2);
          g.fillStyle = `rgba(24,20,15,${(0.22 * grime).toFixed(3)})`;  // and onto the trousers
          if (view === 2) g.fillRect(cx - 2 - stride, oy + 46, 3, 4);
          else { g.fillRect(cx - 5 - stride, oy + 46, 3, 4); g.fillRect(cx + 2 + stride, oy + 52, 2, 3); }
        }
        if (style === 'dress') { // flared skirt over the hips
          g.fillStyle = jacket;
          g.fillRect(cx - 7, oy + 32, 14, 6);
          g.fillRect(cx - 8, oy + 36, 16, 7);
        }
        g.fillStyle = jacket;
        if (view === 2) {
          g.fillRect(cx - 2, oy + 21, 4, 15);
          g.fillStyle = skin; g.fillRect(cx - 2, oy + 36, 4, 3);
        } else {
          g.fillRect(cx - 10, oy + 21, 3, 15);
          g.fillRect(cx + 7, oy + 21, 3, 15);
          g.fillStyle = skin;
          g.fillRect(cx - 10, oy + 36, 3, 3); g.fillRect(cx + 7, oy + 36, 3, 3);
        }
        g.fillStyle = skin;
        g.fillRect(cx - 5, oy + 8, 10, 12);
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(cx - 5, oy + 8, 3, 12);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 2, oy + 8, 3, 12);
        if (grime > 0) {                                              // days unshaven
          g.fillStyle = `rgba(58,44,34,${(0.34 * grime).toFixed(3)})`;
          g.fillRect(cx - 5, oy + 15, 10, 5);
        }
        g.fillStyle = hair;
        if (view === 4) { g.fillRect(cx - 6, oy + 5, 12, 14); }
        else if (view === 3) { g.fillRect(cx - 6, oy + 5, 12, 9); g.fillRect(cx + 1, oy + 5, 5, 13); }
        else { g.fillRect(cx - 6, oy + 5, 12, 5); g.fillRect(cx - 6, oy + 8, 2, 4); }
        if (grime > 0) {
          // unbrushed: ONE tuft up, off to one side, and a ragged fringe.
          // Symmetric tufts either side of the crown read as ears or horns,
          // which is a different character entirely.
          g.fillStyle = hair;
          g.fillRect(cx + 3, oy + 3, 3, 2);
          g.fillRect(cx - 6, oy + 10, 2, 2);
          g.fillRect(cx + 4, oy + 9, 2, 2);
        }
        if (style === 'cap') { // ball cap over the hair
          g.fillStyle = accent;
          g.fillRect(cx - 6, oy + 4, 12, 5);
          if (view <= 1) g.fillRect(cx - 7, oy + 8, 14, 2);
          else if (view === 2) g.fillRect(cx - 9, oy + 8, 8, 2); // brim points forward
        } else if (style === 'hoodie') {
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
        g.fillStyle = '#241a12';
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

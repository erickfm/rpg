import * as THREE from 'three';
import { pixTex } from './paint';
import { facadeTex, shopfrontTex, SHOP_BAND_H } from './tex-world';
import { type BldSpec } from './civic';
import { type AABB } from '../fp';

// GOLDEN ACES and HOTEL ORPHEUS — the two buildings at the far end of the side
// street, and the only two in the world that are LIGHT SOURCES rather than lit
// surfaces.
//
// They are split out of ct/street.ts for the same reason the library and the
// church were split into ct/civic.ts: they share no vocabulary with the
// shopfront system. A barber and a deli are a brick box with a painted band and
// that is correct for them. A casino is a marquee, a pylon, chase bulbs and
// glass, and building it out of shopfront parts is why the user called the pair
// of them "so low effort and boring" — they had been standing at the end of the
// street wearing a barber's clothes.
//
// street.ts still owns WHERE they stand — the NORTH2 roster and the x cursor
// that walks it — and hands each one its span. This file owns what they look
// like.
//
// ── THIS COMMIT IS A PURE MOVE ────────────────────────────────────────────
// Nothing here is new. `placeShell` is the body of street.ts's `placeBldZ`
// specialised to facing = -1, and `placeSigns` is its far-end sign block
// verbatim. It is called from the same points in the same order, because the
// paint layer draws with a seeded Math.random under the fingerprint harness and
// re-ordering texture creation shifts the grain of every texture painted after
// it (GOTCHAS §1/§2). Verified world-neutral before a pixel changed.
export function buildVice(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  solid: (b: AABB) => AABB;
}) {
  const { scene, flat, solid } = o;

  /** The shell: street.ts's placeBldZ, for a building that faces -z. */
  const placeShell = (x0: number, zc: number, b: BldSpec) => {
    const cx = x0 + b.w / 2;
    const gh = SHOP_BAND_H;
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, 3.4),
      [endM, endM, roofM, roofM, endM, facade]);
    wall.position.set(cx, h / 2 + gh, zc);
    scene.add(wall);
    const shopM = flat(shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w, gh, 3.4),
      [endM, endM, roofM, roofM, endM, shopM]);
    shop.position.set(cx, gh / 2, zc);
    scene.add(shop);
    solid({ minX: x0, maxX: x0 + b.w, minZ: zc - 1.7 - 0.3, maxZ: zc + 1.7 + 8 });
  };

  // ── the far end of the side street ──────────────────────────────────────
  //
  // The casino and the hotel are 40 m away, which is most of the way to
  // FOG_FAR — from this block they are a glow, not a place, and that is
  // exactly what was asked for. Two things make that work:
  //
  //  · the signs stand ABOVE the roofline, where nothing occludes them;
  //  · the lit parts are `fog: false`. Everything else in the world dissolves
  //    into the haze on the fog curve, so neon that refuses to is read as
  //    neon — it is the only thing out there still burning at that distance.
  //    The boards they are mounted on DO take fog, so the sign hangs in the
  //    murk instead of looking pasted on top of it.
  const placeSigns = (sideSpans: Record<string, [number, number]>) => {
    // NOT `transparent: true`. With alphaTest the cutout is resolved in the
    // OPAQUE pass, where the depth buffer decides what you see. Marking it
    // transparent as well pushes both faces of a double-sided sign into the
    // sorted pass, where the far face can paint over the near one — which is
    // what made HOTEL read backwards from the west: you were seeing the far
    // plane's reverse. FrontSide then guarantees each face is only ever seen
    // from its own side, so this cannot come back.
    const neonM = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, fog: false, side: THREE.FrontSide });
    // A double-sided sign is TWO planes back to back, and the two faces are
    // mirror images of each other in world space. Hang the same texture on
    // both and one of them comes out reversed — which only shows up on
    // asymmetric letters, so HOTEL gave itself away on the E and the L while
    // the H, O and T looked fine.
    // The fix is applied to the ARTWORK, not to the transform: the back face
    // gets a texture that was painted mirrored, so the two faces carry
    // genuinely different images the way a real double-sided sign does.
    // (Mirroring the mesh instead — scale.x = -1 — does not survive here.)
    const twoSided = (
      tw: number, th: number, draw: (g: CanvasRenderingContext2D) => void,
      w: number, h: number, x: number, y: number, z: number, gap: number,
    ) => {
      for (const s of [-1, 1]) {
        const t = pixTex(tw, th, draw);   // both faces carry the same artwork…
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), neonM(t));
        m.position.set(x + s * gap, y, z);
        m.rotation.y = s * Math.PI / 2;
        scene.add(m);
      }
    };
    const boardM = new THREE.MeshBasicMaterial({ color: 0x24222a, side: THREE.DoubleSide });
    const casino = sideSpans['GOLDEN ACES'], hotel = sideSpans['HOTEL ORPHEUS'];
    if (casino) {
      // A ROOFTOP PYLON, not a fascia sign. Anything mounted at the casino's
      // own roofline (16.2 m) is hidden behind the hotel next door, which is
      // 18.6 — and from this block you only ever see the far end down the
      // length of the street, so an occluded sign is no sign. This one stands
      // clear of every roof on the side street and is the first thing you
      // pick out of the haze.
      // It faces ALONG the street, not across it. A sign hung parallel to its
      // own facade is edge-on to everyone approaching down the street, which
      // is the only way this one is ever seen — from the far end of it.
      // ── and it STANDS ON SOMETHING ────────────────────────────────────
      //
      // The legs used to sit at z = -95 ± 3.2, which is -98.2 and -91.8: one
      // of them hung in the air over the roadway and the other was buried
      // behind the parapet. The building is only 3.4 m deep (z -96 … -92.6),
      // so anything holding this up has to stand inside that. A rooftop sign
      // with no visible steelwork reads as a decal pasted on the sky.
      const cxm = (casino[0] + casino[1]) / 2, top = SHOP_BAND_H + 3.4 + 4 * 2.4;
      const ROOF = top, BOT = ROOF + 2.2;              // sign sits 2.2 m clear
      const steelM = new THREE.MeshBasicMaterial({ color: 0x35323a });
      for (const s of [-1, 1]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.2, BOT - ROOF, 0.2), steelM);
        upright.position.set(cxm, (ROOF + BOT) / 2, -94.3 + s * 1.2);
        scene.add(upright);
        // a raking brace back to the parapet, which is what actually stops a
        // sign this size pivoting in the wind
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.78, 0.13), steelM);
        brace.position.set(cxm, ROOF + 1.1, -94.3 + s * 1.75);
        brace.rotation.x = -s * 0.657;
        scene.add(brace);
      }
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.8), steelM);
      tie.position.set(cxm, BOT - 0.2, -94.3);
      scene.add(tie);
      // the board itself, centred over the building rather than over the kerb
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.6, 7.2), boardM);
      frame.position.set(cxm, BOT + 3.3, -94.3);
      scene.add(frame);
      twoSided(92, 74, (g) => {
        g.fillStyle = '#e8c25a'; g.font = 'bold 15px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('GOLDEN', 46, 26); g.fillText('ACES', 46, 45);
        g.fillStyle = '#e8574a';
        g.font = 'bold 9px monospace'; g.fillText('OPEN ALL NITE', 46, 62);
        g.fillStyle = '#f2d98a';                       // chaser bulbs round the edge
        for (let x = 3; x < 92; x += 8) { g.fillRect(x, 2, 4, 3); g.fillRect(x, 69, 4, 3); }
        for (let y = 6; y < 70; y += 8) { g.fillRect(2, y, 3, 4); g.fillRect(87, y, 3, 4); }
      }, 6.8, 6.2, cxm, BOT + 3.3, -94.3, 0.26);
    }
    if (hotel) {
      // a blade sign hung off the building at first-floor level, read end-on
      // down the length of the side street — the way a hotel sign hangs
      const hx = hotel[1] - 1.1;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.6, 0.5), boardM);
      mast.position.set(hx, 7.4, -96.72);
      scene.add(mast);
      // Bracketed back to the wall. A blade sign is cantilevered off a
      // building — without the arms and the raking stays it floats beside it.
      const steelB = new THREE.MeshBasicMaterial({ color: 0x35323a });
      for (const y of [9.9, 5.4]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.78), steelB);
        arm.position.set(hx, y, -96.37);
        scene.add(arm);
        const stay = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), steelB);
        stay.position.set(hx, y + 0.43, -96.37);
        stay.rotation.x = 0.69;                        // wall high, mast low
        scene.add(stay);
      }
      twoSided(16, 80, (g) => {
        g.fillStyle = '#7ad4e8'; g.font = 'bold 11px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        'HOTEL'.split('').forEach((ch, i) => g.fillText(ch, 8, 11 + i * 13));
        g.fillStyle = '#e85a8a'; g.fillRect(2, 74, 12, 3);
      }, 1.5, 6.2, hx, 7.4, -96.72, 0.13);
    }
  };

  return { placeShell, placeSigns, VICE: ['GOLDEN ACES', 'HOTEL ORPHEUS'] as const };
}

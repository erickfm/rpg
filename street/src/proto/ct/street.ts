import * as THREE from 'three';
import { pixTex, dither } from './paint';
import { facadeTex, shopfrontTex, resGroundTex, ENTRANCE, SHOP_BAND_H, masonry, SHOP_MULT, wallHeight } from './tex-world';
import { walkTex } from './tex-ground';
import { buildCatRig } from './cat';
import { buildCivic, type BldSpec } from './civic';
import { L, ROAD_HALF, WALK, FACE } from './rng';
import { type AABB } from '../fp';

// Every building on the block, hand-authored end to end, plus the alley
// cut into the west wall. Adds meshes + billboard sprites; owns no state.
export function buildStreet(o: {
  scene: THREE.Scene;
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  sidewalkY: number; KERB_H: number;
  boards: { m: THREE.Mesh }[];
  AZ0: number; AZ1: number;
  SIDE_X1: number; SIDE_Z0: number; SIDE_Z1: number;
}) {
  const { scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1 } = o;
  // ── collision, registered by the module that draws the building ─────────
  //
  // This used to be two rectangles hand-written in crosstown.ts spanning the
  // whole block, which meant collision could not follow geometry: the library
  // courtyard was walled off by a blanket that knew nothing about it, and the
  // bodega's canted corner collided square. Same failure the [E] spots and the
  // frame hooks already outgrew, same fix — whoever draws it registers it.
  //
  // The two numbers every footprint below is built from:
  //   0.3  the cushion in FRONT of a facade. Projecting doorcases, stallrisers
  //        and the bodega's tower all live inside it, so nothing sticks
  //        through the collider into the walking lane (GOTCHAS §9).
  //   8    the depth BEHIND a facade. Shells are only 3.4 m deep; the extra
  //        stops you running round the back into the dead ground.
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); return b; };
  // `kind` takes a building OUT of the shopfront system entirely — a civic
  // building is not a brick box with an awning and a painted name on it, and
  // the two that carry this block get their own builders below.
  //
  // ── the block, re-cast ────────────────────────────────────────────────
  //
  // Widths are load-bearing, not decoration. Three runs have to land on an
  // exact number and every roster below is balanced to hit it:
  //   · WEST before the alley must total 51.2 so PAWN ends on AZ0 = -37
  //   · WEST after it must total 54.5 so the last shell ends on -98, where
  //     the corner building takes over
  //   · EAST before No. 227 must total 49.2, because the walk-up's door and
  //     its interior live in ct/apartment.ts at a fixed z
  // Change a width and you must pay for it out of a neighbour in the same run.
  const WEST: (BldSpec | 'alley')[] = [
    // DINER and LAUNDRY swapped IDENTITIES, not slots — the widths stay where
    // they are, so both run totals are untouched (51.2 before the alley, 54.5
    // after). Moving the entries bodily would have cost 2.8 m of
    // reconciliation in each run for nothing. The diner also wants the wider
    // frontage, and the far side of the alley had nothing to eat on it.
    { nm: 'LAUNDRY', col: '#2c4a7a', w: 9.2, brick: '#6b4034', floors: 4 },
    // blander and more modern than anything either side of it — the whole
    // point of standing it next to the library
    { nm: 'MERIDIAN', col: '#5a6a72', w: 10, brick: '#8a8378', floors: 5 },
    { nm: 'LIBRARY', col: '', w: 16, brick: '', floors: 0, kind: 'library' },
    // the loudest thing on the block, in the widest slot on this side, right
    // up against the quietest — that contrast is doing a lot of work here
    { nm: 'BURGER BARN', col: '#c8302a', w: 16, brick: '#7a4a3a', floors: 4, front: 'burger' },
    'alley',
    // z -55.5 … -43.5, centre -49.5 — ct/int-diner.ts anchors its door here
    { nm: 'DINER', col: '#8a5a22', w: 12, brick: '#6b4034', floors: 4 },
    { nm: 'BARBER', col: '#8a2c22', w: 12.5, brick: '#5c4436', floors: 4 },
    { nm: 'THRIFT', col: '#7a5a2c', w: 14, brick: '#835444', floors: 4 },
    { nm: 'GROCERY', col: '#2e5a3c', w: 16, brick: '#7a4a3a', floors: 5 },
  ];
  const EAST: BldSpec[] = [
    { nm: 'CAFE', col: '#6a3a22', w: 11.2, brick: '#5c4436', floors: 4 },
    { nm: 'HARDWARE', col: '#5a5a2c', w: 12, brick: '#6b4034', floors: 3 },
    { nm: 'A-1 TAX', col: '#2c4a7a', w: 13, brick: '#7a4a3a', floors: 5, front: 'tax' },
    { nm: 'LIQUOR', col: '#8a2c42', w: 13, brick: '#835444', floors: 4 },
    { nm: '', col: '', w: 18, brick: '#835444', floors: 5, res: true }, // No. 227 — home, across from the alley, a bit off
    // PAWN pays the 3 m. DELI + RECORDS were 21 m and the nave is 18, and the
    // post-227 run must still total 43 so the last shell lands on -96 — so the
    // difference goes to the church's north neighbour rather than overflowing
    // the run. No. 227 is untouchable: ct/apartment.ts depends on its z.
    { nm: 'PAWN', col: '#6a5a3a', w: 15, brick: '#5c4436', floors: 5, front: 'pawn' },
    { nm: 'ST BRIGID', col: '', w: 18, brick: '', floors: 0, kind: 'church' },
    { nm: 'BODEGA', col: '#b8342a', w: 10, brick: '#6b4034', floors: 3 }, // the corner store
  ];
  // The side street. It runs east into the fog, and the far end of it is
  // somewhere else: the casino and the hotel that feeds it sit out at x = 34
  // and beyond, read at 40 m through the haze, and are not part of this
  // block's life. Both rosters stop dead on x = 57, where the cross building
  // that closes the street begins.
  const NORTH2: BldSpec[] = [
    { nm: 'FLOWERS', col: '#4a7a52', w: 6, brick: '#835444', floors: 3 }, // half of it is the bodega's now
    { nm: 'CHOP SUEY', col: '#8a3a2e', w: 11, brick: '#5c4436', floors: 3 },
    { nm: 'HOTEL ORPHEUS', col: '#6a4a2c', w: 12, brick: '#7a4a3a', floors: 5 },
    { nm: 'GOLDEN ACES', col: '#8a2c42', w: 11.55, brick: '#5c4436', floors: 4 },
  ];
  const SOUTH2: BldSpec[] = [
    // the church has moved to the main block; the two shops it displaced take
    // its old slot. 9.5 + 8.5 = the 18 m the church vacated, so this run still
    // totals 64 and still ends dead on x = 57.
    { nm: 'DELI', col: '#2e6a34', w: 9.5, brick: '#6b4034', floors: 3 },
    { nm: 'RECORDS', col: '#6a2c6a', w: 8.5, brick: '#7a4a3a', floors: 3 },
    { nm: 'GARAGE', col: '#5a5f66', w: 12, brick: '#5c4436', floors: 3 },
    { nm: 'BILLIARDS', col: '#2c5a3a', w: 12, brick: '#835444', floors: 4 },
    { nm: 'SMOKES', col: '#8a6a22', w: 11, brick: '#6b4034', floors: 3 },
    { nm: 'LOANS', col: '#7a6a2c', w: 11, brick: '#7a4a3a', floors: 4 },
  ];
  // Buildings ABUT — a shell is exactly b.w deep, never b.w + slop. Two
  // neighbours share the boundary plane; their facade quads meet edge to
  // edge instead of overlapping, so there is no coplanar strip to z-fight
  // (same rule that fixed the corner road: abut, never overlap).
  // ── three shopfronts that are NOT the block default ─────────────────────
  //
  // Everything else on the street wears shopfrontTex, which is the right
  // neutral for a barber or a deli. These three are characters, and the
  // spread between them is the point: the fast-food place is the loudest
  // thing on the block, the tax office is the least designed, and the
  // pawnshop is the most defended. All three keep the block's 8 px/m and the
  // same band heights as shopfrontTex, so they line up with their neighbours.
  // The three custom shop bands below were authored on a (wM*8) x 52 canvas —
  // 8 x 12.38 px/m — while every other band on the block runs at the shared
  // 2x masonry density. bandSurf() hands them the correct canvas and re-bases
  // the coordinates they were drawn in: `bx`/`by` map an old texel onto the
  // same WORLD position on the new one, so the art is unchanged and no painter
  // here carries a px/m of its own.
  const OLD_SB = 52;
  const bandSurf = (wM: number) => {
    const surf = masonry(wM, SHOP_BAND_H, 0, SHOP_MULT);
    const oldW = Math.max(64, Math.round(wM * 8));
    return {
      surf, W: surf.W, H: surf.H,
      bx: (v: number) => Math.round(v * surf.W / oldW),
      by: (v: number) => Math.round(v * surf.H / OLD_SB),
    };
  };
  // 1997 fast food: saturated brand colours, a fascia twice the usual depth,
  // and more glass than anyone else because you are supposed to see in.
  const burgerFront = (brick: string, wM: number) => {
    const { surf, W, H: SB, bx, by } = bandSurf(wM);
    // RED AND BEIGE, asked for twice. The scheme is these three: the fascia
    // red, the beige it is trimmed and lettered in, and the warm-but-not-
    // yellow interior. It used to run red + mustard (#e8a02a stripe, #f2d24a
    // letters, #e8c26a interior) and the mustard is what read as the second
    // colour — so all three moved together. Change them here, nowhere else.
    const BB_RED = '#c8302a', BB_BEIGE = '#e6dcc6', BB_INSIDE = '#e0d2b4';
    return surf.paint((g) => {
      g.fillStyle = brick; g.fillRect(0, 0, W, SB);
      g.fillStyle = BB_RED; g.fillRect(0, 0, W, by(16));              // the big red fascia
      g.fillStyle = BB_BEIGE; g.fillRect(0, by(16), W, by(3));        // beige accent stripe
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, by(19), W, by(2));
      g.fillStyle = BB_BEIGE; g.font = `bold ${by(9)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('BURGER BARN', W / 2, by(8));
      g.fillStyle = '#141820'; g.fillRect(bx(4), by(21), W - bx(8), by(31));
      g.fillStyle = BB_INSIDE; g.fillRect(bx(6), by(23), W - bx(12), by(25));   // lit right through
      g.fillStyle = '#8a6a4a';                                       // booths in silhouette
      for (let x = bx(10); x < W - bx(14); x += bx(17)) { g.fillRect(x, by(33), bx(7), by(12)); g.fillRect(x + bx(9), by(36), bx(5), by(9)); }
      g.fillStyle = BB_RED; g.fillRect(Math.round(W * 0.62), by(23), bx(12), by(12));   // menu board
      g.fillStyle = BB_BEIGE; g.fillRect(Math.round(W * 0.62) + bx(2), by(26), bx(8), 1);
      g.fillRect(Math.round(W * 0.62) + bx(2), by(29), bx(8), 1);
      g.fillStyle = '#2a3440'; g.fillRect(Math.round(W * 0.44), by(23), bx(4), by(25)); // door
      g.fillStyle = '#d8d0c0';                                        // window decals
      g.fillRect(bx(9), by(25), bx(10), by(4)); g.fillRect(W - bx(22), by(25), bx(12), by(4));
      g.fillStyle = '#8a3a24'; g.fillRect(bx(4), by(48), W - bx(8), by(4));    // stallriser
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(bx(4), by(48), W - bx(8), 1);
      dither(g, W, SB, Math.round(wM * SHOP_BAND_H * 6));
    });
  };
  // the pawnshop: barred glass, a hand-painted board, and the three balls
  const pawnFront = (brick: string, wM: number) => {
    const { surf, W, H: SB, bx, by } = bandSurf(wM);
    return surf.paint((g) => {
      g.fillStyle = brick; g.fillRect(0, 0, W, SB);
      surf.courses(g);
      g.fillStyle = '#6a5a3a'; g.fillRect(bx(3), by(2), W - bx(6), by(11));  // a painted board, not a light box
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(bx(3), by(13), W - bx(6), by(2));
      g.fillStyle = '#e8dcc0'; g.font = `bold ${by(8)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('PAWN', W / 2 - bx(12), by(7));
      g.font = `bold ${by(5)}px monospace`;
      g.fillText('LOANS  GOLD  TOOLS', W / 2 + bx(26), by(8));
      g.fillStyle = '#c9a45e';                                        // the three balls
      for (const b of [8, 14, 11]) g.beginPath(), g.arc(bx(b), b === 11 ? by(11) : by(6), by(2.4), 0, Math.PI * 2), g.fill();
      g.fillStyle = '#141820'; g.fillRect(bx(5), by(14), W - bx(10), by(38));
      g.fillStyle = '#2e2a26'; g.fillRect(bx(7), by(16), W - bx(14), by(32));  // dim, crowded window
      const junk = ['#8a3a2e', '#c9a45e', '#3a5a8a', '#8a8378', '#4a7a3a', '#7a3a6a'];
      for (let i = 0; i < Math.floor(W / bx(6)); i++) {
        g.fillStyle = junk[i % 6];
        g.fillRect(bx(9) + i * bx(6), by(20) + ((i * by(7)) % by(18)), bx(4), by(3) + (i % 4) * by(2));
      }
      g.fillStyle = 'rgba(0,0,0,0.55)';                               // the security bars
      for (let x = bx(8); x < W - bx(8); x += bx(5)) g.fillRect(x, by(16), 1, by(32));
      g.fillRect(bx(7), by(24), W - bx(14), 1); g.fillRect(bx(7), by(38), W - bx(14), 1);
      g.fillStyle = '#3a3020'; g.fillRect(bx(5), by(48), W - bx(10), by(4));
      dither(g, W, SB, Math.round(wM * SHOP_BAND_H * 6));
    });
  };
  // the tax office: no sign worth the name, just a banner cable-tied over the
  // brick and paper taped inside the glass. The least designed thing here.
  const taxFront = (brick: string, wM: number) => {
    const { surf, W, H: SB, bx, by } = bandSurf(wM);
    return surf.paint((g) => {
      g.fillStyle = brick; g.fillRect(0, 0, W, SB);
      surf.courses(g);
      // a vinyl banner, sagging a texel in the middle, grommets at the corners
      const bw = W - bx(14);
      g.fillStyle = '#d8d2c4'; g.fillRect(bx(7), by(3), bw, by(9));
      g.fillStyle = '#d8d2c4'; g.fillRect(bx(9), by(12), bw - bx(4), 1);   // the sag
      g.fillStyle = '#2c4a7a'; g.font = `bold ${by(7)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('A-1 TAX SERVICE', W / 2, by(7));
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (const gx of [bx(8), W - bx(9)]) { g.fillRect(gx, by(4), 1, 1); g.fillRect(gx, by(10), 1, 1); }
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(bx(7), by(13), bw, by(2));
      g.fillStyle = '#141820'; g.fillRect(bx(5), by(15), W - bx(10), by(37));
      g.fillStyle = '#cfd6c8'; g.fillRect(bx(7), by(17), W - bx(14), by(31));  // flat fluorescent interior
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let x = bx(12); x < W - bx(12); x += bx(22)) g.fillRect(x, by(19), bx(14), by(2)); // tube fittings
      // paper signs taped up inside, slightly off square
      const notes = ['REFUNDS', 'FAST', 'E-FILE'];
      g.font = `bold ${by(4)}px monospace`;
      notes.forEach((n, i) => {
        const nx = bx(10) + i * Math.round((W - bx(26)) / 3), ny = by(26) + (i % 2) * by(6);
        g.fillStyle = '#f2ead0'; g.fillRect(nx, ny, bx(18), by(8));
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(nx, ny + by(8), bx(18), 1);
        g.fillStyle = '#8a2c22'; g.fillText(n, nx + bx(9), ny + by(4));
      });
      g.fillStyle = '#2a3440'; g.fillRect(Math.round(W * 0.5), by(17), bx(4), by(31));   // door
      g.fillStyle = '#6a665e'; g.fillRect(bx(5), by(48), W - bx(10), by(4));
      dither(g, W, SB, Math.round(wM * SHOP_BAND_H * 6));
    });
  };
  // A shop's ground floor and a flat's are NOT the same height, and pretending
  // they were is what made every storefront on this block read undersized:
  // 3.2 m of band left only 1.92 m of glass, shorter than the door beside it.
  // Shops get SHOP_BAND_H; the walk-up keeps ENTRANCE.BAND_H, which is what
  // ct/apartment.ts hangs its door in and is already the right size.
  const bandOf = (b: BldSpec) => (b.res ? ENTRANCE.BAND_H : SHOP_BAND_H);
  const placeBld = (side: number, z: number, b: BldSpec) => {
    const cz = z - b.w / 2;
    const gh = bandOf(b);
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = side < 0
      ? [facade, endM, roofM, roofM, endM, endM]
      : [endM, facade, roofM, roofM, endM, endM];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, b.w), mats);
    wall.position.set(side * (FACE + 1.7), h / 2 + gh, cz);
    scene.add(wall);
    const shopM = flat(
      b.res ? resGroundTex(b.brick, b.w)
        : b.front === 'burger' ? burgerFront(b.brick, b.w)
          : b.front === 'pawn' ? pawnFront(b.brick, b.w)
            : b.front === 'tax' ? taxFront(b.brick, b.w)
              : shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = side < 0
      ? [shopM, endM, roofM, roofM, endM, endM]
      : [endM, shopM, roofM, roofM, endM, endM];
    const shop = new THREE.Mesh(new THREE.BoxGeometry(3.4, gh, b.w), shopMats);
    shop.position.set(side * (FACE + 1.7), gh / 2, cz);
    scene.add(shop);
    solid(side < 0
      ? { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: cz - b.w / 2, maxZ: cz + b.w / 2 }
      : { minX: FACE - 0.3, maxX: FACE + 8, minZ: cz - b.w / 2, maxZ: cz + b.w / 2 });
  };
  // ── civic stone ─────────────────────────────────────────────────────────
  //
  // The library and the church live in `ct/civic.ts` — they share no
  // vocabulary with the shopfront system below (ashlar not brick, arches not
  // rectangles, cut letters not painted bands, real depth in the silhouette)
  // and splitting them off lets a second builder work them without touching
  // this file. street.ts still owns WHERE they stand; civic.ts owns what
  // they look like.
  const { placeLibrary, placeChurch } = buildCivic({ scene, flat, KERB_H });
  let zw = 14.2;
  for (const b of WEST) {
    if (b === 'alley') { zw = AZ1; continue; }
    if (b.kind === 'library') placeLibrary(zw, b); else placeBld(-1, zw, b);
    zw -= b.w;
  }
  // The church stands on the main block now, and `placeChurch` builds along +x
  // with its facade on +z — the side-street axis it was authored for. Rather
  // than ask E to parameterise that (ct/civic.ts is E's), the church is built
  // into a GROUP and the group is turned: `buildCivic` only ever calls
  // scene.add and registers nothing, so a Group is a perfectly good scene, and
  // the transform is arithmetic on my side of the line.
  //
  // rotation.y = -π/2 sends local +x → world +z and local +z → world -x. So
  // the nave runs down the block from `z - b.w` to `z`, and the facade — local
  // +z, 1.7 out from the group origin — lands on x = FACE looking west across
  // the street, exactly where placeBld puts an east shopfront.
  const placeChurchEast = (z: number, b: BldSpec) => {
    const g = new THREE.Group();
    buildCivic({ scene: g as unknown as THREE.Scene, flat, KERB_H }).placeChurch(0, 0, b);
    g.rotation.y = -Math.PI / 2;
    g.position.set(FACE + 1.7, 0, z - b.w);
    scene.add(g);
    // The church does not go through placeBld, so it has to register its own
    // footprint or it is not there at all — with the blanket wall gone you
    // walked straight through the nave. The 0.3 cushion covers the tower,
    // which stands exactly that far proud of the facade.
    solid({ minX: FACE - 0.3, maxX: FACE + 8, minZ: z - b.w, maxZ: z });
  };
  let ze = 14.2;
  let bodegaZ0 = 0; // the bodega turns the corner — hand-built below, not by placeBld
  for (const b of EAST) {
    if (b.nm === 'BODEGA') { bodegaZ0 = ze; ze -= b.w; continue; }
    if (b.kind === 'church') placeChurchEast(ze, b); else placeBld(1, ze, b);
    ze -= b.w;
  }
  // side-street rosters run along x; facade on the street-facing z side
  const placeBldZ = (x0: number, zc: number, b: BldSpec, facing: 1 | -1) => {
    const cx = x0 + b.w / 2;
    const gh = bandOf(b);
    const h = 3.4 + b.floors * 2.4;
    const facade = flat(facadeTex(b.brick, b.floors, b.w));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const mats = facing > 0
      ? [endM, endM, roofM, roofM, facade, endM]
      : [endM, endM, roofM, roofM, endM, facade];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, 3.4), mats);
    wall.position.set(cx, h / 2 + gh, zc);
    scene.add(wall);
    const shopM = flat(shopfrontTex(b.brick, b.nm, b.col, b.w));
    const shopMats = facing > 0
      ? [endM, endM, roofM, roofM, shopM, endM]
      : [endM, endM, roofM, roofM, endM, shopM];
    const shop = new THREE.Mesh(new THREE.BoxGeometry(b.w, gh, 3.4), shopMats);
    shop.position.set(cx, gh / 2, zc);
    scene.add(shop);
    solid(facing > 0
      ? { minX: x0, maxX: x0 + b.w, minZ: zc - 1.7 - 8, maxZ: zc + 1.7 + 0.3 }
      : { minX: x0, maxX: x0 + b.w, minZ: zc - 1.7 - 0.3, maxZ: zc + 1.7 + 8 });
  };
  // The bodega is the anchor store on this corner, so it does not stop at the
  // canted bay — it runs on down the side street, taking the first 6 m of what
  // used to be the FLOWERS frontage (FLOWERS is 6 m wide now, and everything
  // east of it is where it always was). Starts at BX1 = FACE + 3.4 so the wing
  // ABUTS the corner block exactly.
  const BODEGA_WING = 6.05;
  placeBldZ(FACE + 3.4, -94.3, { nm: 'BODEGA', col: '#b8342a', w: BODEGA_WING, brick: '#6b4034', floors: 3 }, -1);
  let xn = FACE + 3.4 + BODEGA_WING;
  const sideSpans: Record<string, [number, number]> = {};
  for (const b of NORTH2) { sideSpans[b.nm] = [xn, xn + b.w]; placeBldZ(xn, -94.3, b, -1); xn += b.w; }
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
  {
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
    // the H, O and T looked fine. `scale.x = -1` flips that face's UVs back.
    // Any sign added here needs the same treatment; check it on a letter
    // with a handedness, never on one that reads the same both ways.
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
      const cxm = (casino[0] + casino[1]) / 2, top = SHOP_BAND_H + 3.4 + 4 * 2.4;
      for (const dz of [-3.2, 3.2]) {                  // two legs it stands on
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 0.3), boardM);
        leg.position.set(cxm, top + 2.1, -95.0 + dz);
        scene.add(leg);
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.4, 9.2), boardM);
      frame.position.set(cxm, top + 8.0, -95.0);
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
      }, 8.8, 7.0, cxm, top + 8.0, -95.0, 0.29);
    }
    if (hotel) {
      // a blade sign hung off the building at first-floor level, read end-on
      // down the length of the side street — the way a hotel sign hangs
      const hx = hotel[1] - 1.1;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.6, 0.5), boardM);
      mast.position.set(hx, 7.4, -96.72);
      scene.add(mast);
      twoSided(16, 80, (g) => {
        g.fillStyle = '#7ad4e8'; g.font = 'bold 11px monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        'HOTEL'.split('').forEach((ch, i) => g.fillText(ch, 8, 11 + i * 13));
        g.fillStyle = '#e85a8a'; g.fillRect(2, 74, 12, 3);
      }, 1.5, 6.2, hx, 7.4, -96.72, 0.13);
    }
  }
  let xs = -7;
  for (const b of SOUTH2) {
    if (b.kind === 'church') placeChurch(xs, -111.7, b); else placeBldZ(xs, -111.7, b, 1);
    xs += b.w;
  }
  // ── the bodega turns the corner on a canted bay ─────────────────────────
  //
  // The classic American corner store does not meet the intersection with a
  // square 90° arris. It cuts the corner off at 45° for the FULL height of
  // the elevation — ground floor to cornice — and puts the entrance in that
  // angled face, so the door addresses the crossing diagonally and both
  // streets see a shopfront. The upper storeys carry the same brick and the
  // same window rhythm as the rest of the building; it is one bay of the
  // elevation, not a notch cut in the shopfront.
  //
  // Plan (the shell is a rectangle with the south-west corner triangle taken
  // out, so it is built as two boxes plus the canted bay and a roof cap):
  //
  //        z=-86  ┌──────────────┐  BX1 = FACE+3.4
  //               │      R1      │
  //     z=-94.2   ├───────┬──────┤
  //               │  cut  │  R2  │
  //        z=-96  └╲______┴──────┘
  //                 ╲ canted bay, A→B
  //               BX0 = FACE
  {
    const bod = EAST[EAST.length - 1];               // BODEGA — last on the roster
    const BX0 = FACE, BX1 = FACE + 3.4;
    const BZ0 = bodegaZ0, BZ1 = bodegaZ0 - bod.w;    // -86 … -96
    // Cut back exactly one sidewalk width along each face. That is not an
    // arbitrary number: the walk is WALK m deep on both streets, so the
    // corner they share is a WALK × WALK square, and cutting back WALK makes
    // the canted face exactly as wide as that square's diagonal. The bay, the
    // door on its centre line, and the kerb corner in front then all sit on
    // one 45° axis instead of reading off-kilter against each other.
    const CHF = WALK;
    const CFW = CHF * Math.SQRT2;                    // 2.55 m of canted bay
    const SHOP = SHOP_BAND_H, BH = 3.4 + bod.floors * 2.4, TOP = SHOP + BH;
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    // The corner's footprint FOLLOWS THE CUT. The shell is the rectangle
    // BX0…BX1 × BZ1…BZ0 minus the triangle the chamfer takes out of its
    // south-west corner — the void is x ≥ BX0, z ≤ BZ1 + CHF and
    // x + z ≤ BX0 + BZ1 + CHF. An AABB cannot be diagonal, so the cut is
    // approximated by a staircase of thin bands, each starting at the
    // MOST PERMISSIVE x in its band so the stair never eats walkable ground
    // — the 0.36 m player radius more than covers the sliver of masonry that
    // leaves unblocked. Collide square here and you clip the cut face, which
    // is exactly what the user reported.
    {
      const CUT = BX0 + BZ1 + CHF;                    // x + z along the cut
      const BAND = 0.25;
      for (let z = BZ1; z < BZ1 + CHF - 1e-6; z += BAND) {
        solid({ minX: CUT - z, maxX: BX1 + 8, minZ: z, maxZ: z + BAND });
      }
      // …and the rest of the block, north of the cut, at full width
      solid({ minX: BX0 - 0.3, maxX: BX1 + 8, minZ: BZ1 + CHF, maxZ: BZ0 });
    }
    // The corner used to carry its own brick painter, because facadeTex once
    // floored its canvas at 64 px and would have painted a 2 m bay three times
    // finer than the elevation beside it. That clamp is gone and the density
    // now comes from ct/tex-world.ts's masonry() like every other wall, so the
    // local copy is deleted rather than corrected — a painter that derives its
    // own px/m is the defect, however carefully it derives it.
    // R1 — the block north of the cut, full depth, street shopfront on -x
    {
      const d = BZ0 - (BZ1 + CHF), cz = (BZ0 + BZ1 + CHF) / 2;
      const facade = flat(facadeTex(bod.brick, bod.floors, d));
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, BH, d), [endM, facade, roofM, roofM, endM, endM]);
      wall.position.set((BX0 + BX1) / 2, SHOP + BH / 2, cz);
      scene.add(wall);
      const shopM = flat(shopfrontTex(bod.brick, bod.nm, bod.col, d));
      const shop = new THREE.Mesh(new THREE.BoxGeometry(3.4, SHOP, d), [endM, shopM, roofM, roofM, endM, endM]);
      shop.position.set((BX0 + BX1) / 2, SHOP / 2, cz);
      scene.add(shop);
    }
    // R2 — the brick pier that closes the cut on the side street
    {
      const w = BX1 - (BX0 + CHF);
      const pier = flat(facadeTex(bod.brick, bod.floors, w, TOP, 0, 1, SHOP + 2.4));
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, TOP, CHF), [endM, endM, roofM, roofM, endM, pier]);
      p.position.set((BX0 + CHF + BX1) / 2, TOP / 2, BZ1 + CHF / 2);
      scene.add(p);
    }
    // the canted bay itself: local +z is the outward normal, pointing
    // south-west across the intersection; local +x runs along the face
    const bay = new THREE.Group();
    bay.position.set(BX0 + CHF / 2, 0, BZ1 + CHF / 2);
    bay.rotation.y = -Math.PI * 0.75;
    scene.add(bay);
    const bayUp = new THREE.Mesh(new THREE.PlaneGeometry(CFW, BH), flat(facadeTex(bod.brick, bod.floors, CFW, BH, SHOP, 1)));
    bayUp.position.set(0, SHOP + BH / 2, 0);
    bay.add(bayUp);
    // the shopfront in the bay: recessed doorway dead centre, a run of
    // display glass either side, sign band over the lot
    // Same band grid as shopfrontTex, so the bay lines up exactly with the two
    // shopfronts it turns the corner between. It used to be a fixed 48x52
    // canvas regardless of how wide the bay actually is — 24 x 12.38 px/m on a
    // 2 m face, three times the density of the elevation it abuts.
    const bayS = masonry(CFW, SHOP, 0, SHOP_MULT);
    const bm = bayS.m, bw = bayS.W, bh = bayS.H;
    const bayFrontT = bayS.paint((g) => {
      g.fillStyle = bod.brick; g.fillRect(0, 0, bw, bh);
      bayS.courses(g);
      g.fillStyle = bod.col; g.fillRect(bm(0.08), bm(0.16), bw - bm(0.16), bm(0.89));   // sign band
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(bm(0.08), bm(1.05), bw - bm(0.16), bm(0.16));
      g.fillStyle = '#f2ead0'; g.font = `bold ${bm(0.65)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(bod.nm, bw / 2, bm(0.61));
      g.fillStyle = '#141820'; g.fillRect(bm(0.12), bm(1.13), bw - bm(0.24), bh - bm(1.13));  // frames
      g.fillStyle = '#3a3020'; g.fillRect(bm(0.2), bm(1.29), bw - bm(0.4), bm(2.59));
      g.fillStyle = '#5a6a7a'; g.fillRect(bm(0.24), bm(1.37), bm(0.73), bm(2.5));   // display glass, left
      g.fillStyle = '#c9a45e'; g.fillRect(bm(0.28), bm(2.26), bm(0.57), bm(0.97));  // stacked cartons in it
      g.fillStyle = '#5a6a7a'; g.fillRect(bw - bm(1.21), bm(1.37), bm(0.73), bm(2.5)); // display glass, right
      g.fillStyle = '#4a7a3a'; g.fillRect(bw - bm(1.13), bm(2.42), bm(0.57), bm(0.81));
      // THE DOORWAY IS A HOLE, not a painted panel. It used to be drawn on
      // the same flat plane as the display glass in almost the same blue, so
      // there was nothing to tell you which of the three panels you could walk
      // through. Cut it out; the leaf, its reveal and its frame are real
      // geometry hung behind this face, and the shadow in the reveal is what
      // reads as a door from across the junction.
      g.fillStyle = '#141820';
      g.fillRect(bw / 2 - bm(0.75), bm(SHOP - 2.45), bm(1.5), bh - bm(SHOP - 2.45));  // surround
      g.clearRect(bw / 2 - bm(0.65), bm(SHOP - 2.35), bm(1.3), bh - bm(SHOP - 2.35)); // the opening
      g.fillStyle = '#4a4034'; g.fillRect(bm(0.2), bm(3.88), bm(0.89), bm(0.32));           // stallriser either side
      g.fillRect(bw - bm(1.09), bm(3.88), bm(0.89), bm(0.32));
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(bm(0.2), bm(3.88), bm(0.89), 1); g.fillRect(bw - bm(1.09), bm(3.88), bm(0.89), 1);
      dither(g, bw, bh, Math.round(CFW * SHOP * 6));
    });
    const bayFront = new THREE.Mesh(new THREE.PlaneGeometry(CFW, SHOP),
      new THREE.MeshBasicMaterial({ map: bayFrontT, alphaTest: 0.5 }));
    bayFront.position.set(0, SHOP / 2, 0);
    bay.add(bayFront);
    // ── the door itself ───────────────────────────────────────────────────
    //
    // Set BACK behind the shopfront line, with its reveal boxed in, so the
    // opening has depth and throws a shadow. Everything here lives inside the
    // 0.3 m cushion the corner's footprint already reserves, so none of it
    // reaches the pavement (GOTCHAS §9).
    const DW = 1.3, DH = 2.35, DREC = 0.12;
    const doorT = pixTex(52, 94, (g) => {
      g.fillStyle = '#2b2f36'; g.fillRect(0, 0, 52, 94);                 // stiles and rails
      g.fillStyle = '#c9b184'; g.fillRect(5, 6, 42, 58);                 // warm light from inside
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(7, 8, 14, 54);  // glare down one side
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(5, 34, 42, 2);        // glazing bar
      g.fillStyle = '#8a5f3a'; g.fillRect(5, 40, 14, 12);                // shelf of stock behind it
      g.fillStyle = '#7a8a5a'; g.fillRect(24, 44, 12, 8);
      g.fillStyle = '#1d2026'; g.fillRect(0, 64, 52, 6);                 // lock rail
      g.fillStyle = '#3a2c22'; g.fillRect(4, 76, 44, 14);                // kick plate
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(4, 76, 44, 1);
      g.fillStyle = '#c9b45e'; g.fillRect(38, 44, 3, 22);                // push bar, vertical
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(41, 46, 1, 20);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(24, 0, 2, 94);        // the meeting stile — two leaves
    });
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(DW + 0.04, DH + 0.04), flat(doorT));
    leaf.position.set(0, (DH + 0.04) / 2, -DREC);
    bay.add(leaf);
    const jambM = new THREE.MeshBasicMaterial({ color: 0x141820 });
    for (const sx of [-1, 1]) {                                          // the reveal, boxed in
      const jb = new THREE.Mesh(new THREE.BoxGeometry(0.07, DH, DREC), jambM);
      jb.position.set(sx * (DW / 2 + 0.035), DH / 2, -DREC / 2);
      bay.add(jb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(DW + 0.14, 0.07, DREC), jambM);
    head.position.set(0, DH + 0.035, -DREC / 2);
    bay.add(head);
    const awnT = pixTex(48, 12, (g) => {
      for (let x = 0; x < 48; x += 8) {
        g.fillStyle = (x / 8) % 2 ? bod.col : '#d8d0c0';
        g.fillRect(x, 0, 8, 12);
      }
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 9, 48, 3);
    });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(CFW, 0.1, 0.9), new THREE.MeshBasicMaterial({ map: awnT, side: THREE.DoubleSide }));
    // the awning tucks UNDER the sign band. On the taller band the fascia now
    // runs 3.15–4.04 m and the glass head is at 2.91, so it hangs at 2.99 —
    // recheck this whenever SHOP_BAND_H moves, or it covers the name again.
    awn.position.set(0, 2.99, 0.35);
    awn.rotation.x = -0.18;   // slopes down and away from the face
    bay.add(awn);
    const openT = pixTex(24, 12, (g) => {
      g.fillStyle = '#141416'; g.fillRect(0, 0, 24, 12);
      g.fillStyle = '#e8574a'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
      g.fillText('OPEN', 12, 9);
    });
    const open = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), flat(openT));
    // OVER THE DOOR, where a shop hangs it — it used to sit in the left
    // display window, which told you the wrong panel was the way in
    open.position.set(0, 1.98, -DREC + 0.04);
    bay.add(open);
    // roof cap over the wedge R1 and R2 leave open (wound for an up normal)
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute([
      BX0, TOP, BZ1 + CHF,
      BX0 + CHF, TOP, BZ1 + CHF,
      BX0 + CHF, TOP, BZ1,
    ], 3));
    cap.computeVertexNormals();
    scene.add(new THREE.Mesh(cap, roofM));
    // …and the matching triangle of SIDEWALK at the foot of it. Cutting the
    // corner uncovered ground that was under the building: the east walk
    // stops dead at x = FACE and the side-street walk stops at z = BZ1, so
    // the wedge between them had no floor at all and you saw sky through it.
    // This fills exactly that triangle, at walk height, ABUTTING both walks
    // on their existing edges — never overlapping them, or the two coplanar
    // tops would z-fight. UVs are taken straight off world x/z so the 1 m
    // slab grid runs on unbroken from the walks either side.
    {
      const tri = [[BX0, BZ1], [BX0, BZ1 + CHF], [BX0 + CHF, BZ1]] as [number, number][];
      const gap = new THREE.BufferGeometry();
      gap.setAttribute('position', new THREE.Float32BufferAttribute(
        tri.flatMap(([x, z]) => [x, KERB_H, z]), 3));
      // walkTex now takes WORLD EXTENTS (it aligns the slab grid globally via
      // repeat+offset), so UVs here are normalised across the triangle's rect
      // rather than raw world/2 as they were under the old size-based signature.
      gap.setAttribute('uv', new THREE.Float32BufferAttribute(
        tri.flatMap(([x, z]) => [(x - BX0) / CHF, (z - BZ1) / CHF]), 2));
      gap.computeVertexNormals();
      const gapT = walkTex(BX0, BX0 + CHF, BZ1, BZ1 + CHF);
      scene.add(new THREE.Mesh(gap, wet(new THREE.MeshBasicMaterial({ map: gapT, side: THREE.DoubleSide }))));
    }
    // Produce crates, not cartons. A slatted crate is BOARDS WITH GAPS: the
    // dark of the inside shows between them, the corner posts stand proud of
    // the boards, and there is a rail round the top. A flat tan box with a
    // grid drawn on it reads as cardboard every time.
    const crateT = pixTex(28, 18, (g) => {
      g.fillStyle = '#241a10'; g.fillRect(0, 0, 28, 18);              // the dark inside
      g.fillStyle = '#a8834a';
      for (const y of [2, 7, 12]) {                                    // three boards
        g.fillRect(0, y, 28, 4);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, y, 28, 1);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y + 3, 28, 1);
        g.fillStyle = '#a8834a';
      }
      g.fillStyle = '#8d6b3a';                                         // corner posts
      g.fillRect(0, 0, 3, 18); g.fillRect(25, 0, 3, 18);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 1, 18); g.fillRect(25, 0, 1, 18);
      g.fillStyle = '#b8944f'; g.fillRect(0, 0, 28, 2);                // top rail
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 16, 28, 2);       // shadow at the foot
      dither(g, 28, 18, 40);
    });
    const fruitTop = (c1: string, c2: string) => pixTex(28, 24, (g) => {
      g.fillStyle = '#241a10'; g.fillRect(0, 0, 28, 24);
      g.fillStyle = '#b8944f'; g.fillRect(0, 0, 28, 3); g.fillRect(0, 21, 28, 3);   // rim
      g.fillRect(0, 0, 3, 24); g.fillRect(25, 0, 3, 24);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(3, 3, 22, 2);                    // inside shadow
      for (let i = 0; i < 20; i++) {                                                // heaped produce
        g.fillStyle = i % 2 ? c1 : c2;
        g.beginPath(); g.arc(6 + (i % 5) * 4, 8 + Math.floor(i / 5) * 4, 2.2, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 8; i++) g.fillRect(5 + (i % 5) * 4, 7 + Math.floor(i / 5) * 4, 1, 1); // highlights
    });
    const crateM = flat(crateT);
    for (const [cxx, czz, top] of [
      // NOT in front of the canted bay. They used to stand at x 7.9 and 9.3,
      // straight across the door's approach, and their collider is what made
      // the bodega impossible to enter: you were stopped at x = 7.13 walking
      // east and x = 10.07 walking west, with the [E] spot stranded inside
      // the box between. Crates belong against the side-street frontage,
      // where they dress the shop without standing in its doorway.
      [10.05, -96.28, fruitTop('#d88a2a', '#c9762a')],
      [10.95, -96.25, fruitTop('#8a3a2e', '#a84a36')],
    ] as [number, number, THREE.Texture][]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.55), [crateM, crateM, flat(top), crateM, crateM, crateM]);
      crate.position.set(cxx, sidewalkY + 0.2, czz);
      // one box per crate and no bigger than the crate. A single generous box
      // across both is what swallowed the bodega's [E] spot (GOTCHAS §8).
      solid({ minX: cxx - 0.31, maxX: cxx + 0.31, minZ: czz - 0.28, maxZ: czz + 0.28 });
      scene.add(crate);
    }
  }
  // south-west corner building closes the side street's west end
  placeBld(-1, -98, { nm: 'RADIO', col: '#3a4a7a', w: 12, brick: '#835444', floors: 4 });
  // east cross building — the side street disappears into the fog toward it
  {
    const eEnd = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const eRoof = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const eWall = new THREE.Mesh(
      new THREE.BoxGeometry(6, 13.6, 24),
      [eEnd, flat(facadeTex('#5c4436', 4, 24, 13.6, 0)), eRoof, eRoof, eEnd, eEnd],
    );
    eWall.position.set(SIDE_X1 + 5, 6.8, (SIDE_Z0 + SIDE_Z1) / 2);
    scene.add(eWall);
  }

  // billboard registry (declared early — the alley adds to it too)
  interface Board { m: THREE.Mesh }

  // cross building closing the north end; the south end turns the corner now
  {
    // 13.6 m tall, not wallHeight(4) = 13.0 — pass the real face or the
    // texture is painted for a wall that does not exist and lands at 7.65 up
    const facade = flat(facadeTex('#5c4436', 4, 30, 13.6, 0));
    const endM = new THREE.MeshBasicMaterial({ color: 0x53382e });
    const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 13.6, 6), [endM, endM, roofM, roofM, endM, facade]);
    wall.position.set(0, 6.8, 16.5);
    scene.add(wall);
  }

  // ── the alley: a dark cut in the left wall with a dumpster ──────────────
  {
    const alleyFloorT = pixTex(64, 64, (g) => {
      g.fillStyle = '#2e3034'; g.fillRect(0, 0, 64, 64);
      dither(g, 64, 64, 700);
      // stains + a drain
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(20, 40, 12, 6, 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(46, 14, 8, 5, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#17181c'; g.fillRect(30, 28, 8, 8);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(30, 31, 8, 1); g.fillRect(30, 34, 8, 1);
    });
    const floorA = new THREE.Mesh(new THREE.PlaneGeometry(6.6, AZ0 - AZ1), new THREE.MeshBasicMaterial({ map: alleyFloorT }));
    floorA.rotation.x = -Math.PI / 2;
    floorA.position.set(-FACE - 3.3, 0.005, (AZ0 + AZ1) / 2);
    scene.add(floorA);
    // bare-brick end wall (no shop, one grimy window). 7 m x 12.8 m of wall —
    // it used to be a fixed 80 x 150 canvas, i.e. 11.43 x 11.72 px/m.
    const endS = masonry(7.0, 12.8, 0);
    const bareBrickT = endS.paint((g) => {
      const EW = endS.W, EH = endS.H, em = endS.m;
      g.fillStyle = '#5a3a30'; g.fillRect(0, 0, EW, EH);
      endS.courses(g);
      g.fillStyle = '#1a1c22'; g.fillRect(em(2.6), em(3.0), em(1.75), em(2.4));   // window reveal
      g.fillStyle = '#3a4450'; g.fillRect(em(2.8), em(3.15), em(1.4), em(2.05));  // grimy glass
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 4; k++) g.fillRect(Math.floor(Math.random() * (EW - em(0.25))), 0, em(0.25), Math.floor(EH * Math.random()));
      dither(g, EW, EH, Math.round(7.0 * 12.8 * 7.8));
    });
    const endWallM = new THREE.MeshBasicMaterial({ color: 0x3d2a24 });
    const alleyEnd = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 12.8, 7),
      [new THREE.MeshBasicMaterial({ map: bareBrickT }), endWallM, endWallM, endWallM, endWallM, endWallM],
    );
    alleyEnd.position.set(-FACE - 6.9, 6.4, (AZ0 + AZ1) / 2);
    solid({ minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 });
    scene.add(alleyEnd);
    // ── the alley's two flanks ────────────────────────────────────────────
    // These are the exposed party walls of the two buildings the alley is cut
    // between: whatever the roster puts north of it, and MUSIC to the south. They carry the SAME
    // brick as the rear wall — 5 px courses, 9 px stretchers, ~11.7 px/m —
    // so the alley reads continuous around both corners. But they are two
    // different buildings with two different histories, so they are painted
    // one at a time at full wall size (no tiling, no mirroring): different
    // tone, different weathering, different repairs.
    //
    // They run the FULL height of the building behind them, so brick — not
    // the shell's flat end cap — is what you see when you look up.
    //
    // Painted from a LOCAL lcg instead of Math.random: the fingerprint
    // harness seeds Math.random globally, so spending draws here would
    // ripple through every texture the world builds after the alley.
    const lcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    // whole stretchers a shade off the run — the thing that stops flat brick
    // reading as wallpaper. Walks the same bond masonry() lays down, so the
    // alley brick is the street brick seen from the side.
    const mottle = (g: CanvasRenderingContext2D, W: number, H: number, up: string, dn: string, r: () => number, cH: number, pW: number) => {
      for (let y = 0; y < H; y += cH) {
        const off = (Math.round(y / cH) % 2) ? 0 : Math.round(pW / 2);
        for (let x = off; x < W; x += pW) {
          const k = r();
          if (k > 0.85) g.fillStyle = up; else if (k < 0.13) g.fillStyle = dn; else continue;
          g.fillRect(x + 1, y + 1, pW - 1, cH - 1);
        }
      }
    };
    const grain = (g: CanvasRenderingContext2D, W: number, H: number, n: number, r: () => number) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
        g.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1);
      }
    };
    // The flanks are 7 m of wall, as tall as the building they belong to.
    // They used to be a fixed 80 px wide at 150/12.8 px per metre up — 11.43 x
    // 11.74, against a street that now runs 8 x 8.
    //
    // The art below is still written in the texel coordinates it was drawn in.
    // Restating two dozen constants in metres is a bigger edit than this file
    // can safely take right now, so `ox`/`oy` re-base them onto the correctly
    // dense canvas instead: same world positions, one derivation, no painter
    // carrying a px/m of its own. Worth restating properly next time the alley
    // is opened — see notes/A-density-cross.md.
    const FLANK_W = 7.0, OLD_AW = 80, OLD_PXM = 150 / 12.8;
    // north flank — the wall of whatever sits north of the gap. Warmer red brick, badly patched: a square
    // of newer grey brick let in mid-height, a bricked-up service door at
    // the bottom, and a long rust-and-rain streak off a missing downpipe.
    const northFlankT = (hM: number) => {
      const surf = masonry(FLANK_W, hM, 0);
      const AW = surf.W, H = surf.H;
      const ox = (v: number) => Math.round(v * (AW / OLD_AW));
      const oy = (v: number) => Math.round(v * (surf.ppm / OLD_PXM));
      const cH = surf.m(0.5), pW = surf.m(1.125);
      return surf.paint((g) => {
      const r = lcg(0x51f0a3);
      g.fillStyle = '#623f32'; g.fillRect(0, 0, AW, H);
      mottle(g, AW, H, '#6f4b3a', '#553629', r, cH, pW);
      surf.courses(g);
      // NO rectangular infill anywhere on this flank. Any outlined block with
      // a line across its head reads as a bricked-up doorway from inside the
      // alley — twice now — so this wall's history is told with repointing
      // that follows the courses and stops on a ragged brick edge instead.
      for (let y = Math.round(H * 0.3); y < Math.round(H * 0.62); y += cH) {
        const x0 = ox(40) + Math.floor(r() * ox(8)), x1 = ox(68) + Math.floor(r() * ox(10));
        g.fillStyle = 'rgba(216,200,172,0.1)'; g.fillRect(x0, y, x1 - x0, 1);
        g.fillStyle = 'rgba(214,198,170,0.06)'; g.fillRect(x0 + 2, y + 1, x1 - x0 - 5, oy(3));
      }
      // the streak: a wet column off a downpipe that isn't there any more
      for (const [sx, sw, a] of [[35, 3, 0.3], [34, 1, 0.16], [38, 1, 0.13]] as [number, number, number][]) {
        g.fillStyle = `rgba(24,14,10,${a})`;
        g.fillRect(ox(sx), 0, ox(sw), Math.round(H * 0.78));
        g.fillRect(ox(sx) - 1, Math.round(H * 0.5), ox(sw) + 2, Math.round(H * 0.28));
      }
      g.fillStyle = 'rgba(196,178,150,0.09)';                    // salt bloom near the floor
      for (let i = 0; i < 14; i++) g.fillRect((i * ox(17)) % ox(74), H - oy(4) - ((i * oy(11)) % oy(22)), ox(5), oy(2));
      grain(g, AW, H, Math.round(FLANK_W * hM * 9), r);
      });
    };
    // south flank — MUSIC's wall. Darker, sootier, wetter: a tide-line of
    // damp climbing off the floor, spalled brick faces, and the ghost of a
    // painted sign nobody has been able to scrub off.
    const southFlankT = (hM: number) => {
      const surf = masonry(FLANK_W, hM, 0);
      const AW = surf.W, H = surf.H;
      const ox = (v: number) => Math.round(v * (AW / OLD_AW));
      const oy = (v: number) => Math.round(v * (surf.ppm / OLD_PXM));
      const cH = surf.m(0.5), pW = surf.m(1.125);
      return surf.paint((g) => {
      const r = lcg(0x2b91c7);
      g.fillStyle = '#563a2f'; g.fillRect(0, 0, AW, H);       // greyer, sootier — same value, different cast
      mottle(g, AW, H, '#604436', '#492f28', r, cH, pW);
      surf.courses(g);
      // soot: this flank gets the weather off the roof, top down
      for (let y = 0; y < H * 0.4; y++) {
        g.fillStyle = `rgba(18,14,14,${0.2 * (1 - y / (H * 0.4))})`;
        g.fillRect(0, y, AW, 1);
      }
      // ghost sign — painted over decades ago, still coming through
      const gY = Math.round(H * 0.30), gW = ox(58), gX = ox(11);
      g.fillStyle = 'rgba(186,172,146,0.1)'; g.fillRect(gX, gY, gW, oy(29));
      g.fillStyle = 'rgba(198,184,158,0.16)';
      for (let i = 0; i < 5; i++) g.fillRect(gX + ox(4) + i * ox(11), gY + oy(6), ox(7), oy(11));   // washed lettering
      g.fillRect(gX + ox(8), gY + oy(22), gW - ox(20), oy(2));
      g.fillStyle = 'rgba(0,0,0,0.09)';
      for (let i = 0; i < 26; i++) g.fillRect((i * ox(29)) % (gW - ox(4)) + gX, gY + ((i * oy(13)) % oy(28)), ox(3), oy(2)); // flaked off
      // damp climbing out of the floor. Stepped BRICK BY BRICK, not a smooth
      // curve — masonry wicks along the courses, and a sine here just reads
      // as bunting at this texel size.
      for (let x = 0; x < AW; x += pW) {
        const t = cH * (3 + Math.floor(r() * 5));              // tide height, whole courses
        for (let y = H - t; y < H; y++) {
          g.fillStyle = `rgba(20,15,17,${0.07 + 0.26 * ((y - (H - t)) / t)})`;
          g.fillRect(x, y, pW, 1);
        }
      }
      // spalled faces — brick that has blown off, showing the dark core
      for (let i = 0; i < 8; i++) {
        const sx = ox(3) + Math.floor(r() * (AW - ox(14))), sy = oy(8) + Math.floor(r() * (H - oy(60)));
        g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(sx, sy, ox(5) + Math.floor(r() * ox(3)), oy(4));
        g.fillStyle = 'rgba(206,190,166,0.1)'; g.fillRect(sx, sy + oy(4), ox(5), 1);
      }
      // one long stepped crack running down from the top
      let cx = ox(52);
      for (let y = oy(2); y < H * 0.62; y += oy(3)) {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx, y, 1, oy(3));
        cx += r() < 0.42 ? (r() < 0.5 ? -1 : 1) : 0;
      }
      g.fillStyle = 'rgba(10,9,11,0.45)'; g.fillRect(0, H - oy(2), AW, oy(2));  // tar line at the foot
      grain(g, AW, H, Math.round(FLANK_W * hM * 9), r);
      });
    };
    // Each flank is as tall as its building and stands 1 cm proud of the
    // shell face — the shells now stop exactly on AZ0/AZ1, so 1 cm is all
    // the clearance the depth test needs.
    const ai = WEST.indexOf('alley');
    const topOf = (b: BldSpec) => bandOf(b) + 3.4 + b.floors * 2.4;
    for (const [paint, spec, az, ry] of [
      [northFlankT, WEST[ai - 1] as BldSpec, AZ0 - 0.01, Math.PI],
      [southFlankT, WEST[ai + 1] as BldSpec, AZ1 + 0.01, 0],
    ] as [(h: number) => THREE.Texture, BldSpec, number, number][]) {
      const wh = topOf(spec);
      const m = new THREE.MeshBasicMaterial({ map: paint(wh), side: THREE.DoubleSide });
      const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(7.0, wh), m);
      sideWall.position.set(-FACE - 3.5, wh / 2, az);
      sideWall.rotation.y = ry;
      scene.add(sideWall);
    }
    // the dumpster: ribbed tub with fork pockets, stencil on the long faces
    // only, lid hinged on the wall side and propped open onto the wall
    const dumpFrontT = pixTex(96, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 96, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 96, 3);            // top lip
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 6; x < 96; x += 12) g.fillRect(x, 3, 2, 41);                   // ribs
      g.fillStyle = '#14161a'; g.fillRect(8, 38, 24, 7); g.fillRect(64, 38, 24, 7); // fork pockets
      g.fillStyle = 'rgba(122,66,40,0.55)';
      g.fillRect(38, 36, 16, 10); g.fillRect(82, 16, 12, 14);                     // rust
      g.fillStyle = '#c9c4b0'; g.font = 'bold 9px monospace';
      g.textAlign = 'center'; g.fillText('CITY WASTE', 48, 20);
      dither(g, 96, 48, 160);
    });
    const dumpSideT = pixTex(48, 48, (g) => {
      g.fillStyle = '#2e5a3c'; g.fillRect(0, 0, 48, 48);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 48, 3);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 5; x < 48; x += 12) g.fillRect(x, 3, 2, 41);
      g.fillStyle = 'rgba(122,66,40,0.5)'; g.fillRect(10, 34, 14, 12);
      dither(g, 48, 48, 90);
    });
    const dumpFrontM = new THREE.MeshBasicMaterial({ map: dumpFrontT });
    const dumpSideM = new THREE.MeshBasicMaterial({ map: dumpSideT });
    const dumpInsideM = new THREE.MeshBasicMaterial({ color: 0x101114 });
    const dump = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.05),
      [dumpSideM, dumpSideM, dumpInsideM, dumpInsideM, dumpFrontM, dumpFrontM],
    );
    dump.position.set(-11.2, 0.69, AZ0 - 1.15);
    solid({ minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 });
    scene.add(dump);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.06, 1.12), new THREE.MeshBasicMaterial({ color: 0x24482f }));
    lid.geometry.translate(0, 0.03, -0.56); // pivot runs along its hinge edge
    lid.position.set(-11.2, 1.24, AZ0 - 0.625);
    lid.rotation.x = 0.5;
    scene.add(lid);
    for (const [wx, wz] of [[-12.15, AZ0 - 0.78], [-10.25, AZ0 - 0.78], [-12.15, AZ0 - 1.52], [-10.25, AZ0 - 1.52]]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), new THREE.MeshBasicMaterial({ color: 0x0e0f12 }));
      wheel.position.set(wx, 0.09, wz);
      scene.add(wheel);
    }
    // No trash bags. Three passes of low-poly lumps only ever read as rocks
    // on the ground, so they are gone rather than redrawn a fourth time —
    // the dumpster carries the alley on its own. Nothing referenced them:
    // the only alley colliders are the end wall and the dumpster.
    buildCatRig({ scene, boards, AZ1 });
    // The leaning plywood sheet is gone too — a tan slab against brick reads
    // as a mystery door, not as junk. The wall behind it is full brick now,
    // so there is nothing to patch over.
    // LA graffiti — cholo placa lineage (Bojórquez/Prime, not East-Coast
    // bubbles): ALL CAPS square block letters stood shoulder to shoulder,
    // upright, ONE color, hard underline. Hand-built 5×7 glyphs so the
    // strokes are square, not font curves.
    const PLACA: Record<string, [number, number, number, number][]> = {
      R: [[0, 0, 1, 7], [0, 0, 4, 1], [4, 1, 1, 2], [0, 3, 4, 1], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 1]],
      E: [[0, 0, 1, 7], [0, 0, 5, 1], [0, 3, 4, 1], [0, 6, 5, 1]],
      Z: [[0, 0, 5, 1], [4, 1, 1, 1], [3, 2, 1, 1], [2, 3, 1, 1], [1, 4, 1, 1], [0, 5, 1, 1], [0, 6, 5, 1]],
      O: [[0, 0, 5, 1], [0, 6, 5, 1], [0, 1, 1, 5], [4, 1, 1, 5]],
      S: [[0, 0, 5, 1], [0, 1, 1, 2], [0, 3, 5, 1], [4, 4, 1, 2], [0, 6, 5, 1]],
      N: [[0, 0, 1, 7], [4, 0, 1, 7], [1, 1, 1, 2], [2, 3, 1, 1], [3, 4, 1, 2]],
      A: [[0, 1, 1, 6], [4, 1, 1, 6], [1, 0, 3, 1], [1, 3, 3, 1]],
      K: [[0, 0, 1, 7], [3, 0, 1, 1], [2, 1, 1, 1], [1, 2, 1, 2], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 1]],
      B: [[0, 0, 1, 7], [0, 0, 4, 1], [4, 1, 1, 2], [0, 3, 4, 1], [4, 4, 1, 2], [0, 6, 4, 1]],
    };
    const placaTex = (word: string, ink: string) => {
      const W = word.length * 7 + 3;
      return pixTex(W, 20, (g) => {
        g.fillStyle = ink;
        for (let i = 0; i < word.length; i++) {
          const x0 = 2 + i * 7;
          for (const [sx, sy, sw, sh] of PLACA[word[i]] ?? []) {
            g.fillRect(x0 + sx, 1 + sy * 2, sw, sh * 2); // ×2 tall — soldiers, not squares
          }
        }
        g.fillRect(2, 17, W - 6, 1); // the hard underline
        g.fillRect(W - 5, 16, 2, 1); // finished with a flick
      });
    };
    const tag = (t: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    tag(placaTex('REZO', '#16161a'), 1.7, 1.1, -9.6, 1.45, AZ0 - 0.05, Math.PI);
    tag(placaTex('SNAK', '#c9c4b0'), 1.35, 0.87, -11.6, 1.15, AZ1 + 0.05, 0);
    tag(placaTex('KOBRA', '#16161a'), 1.55, 0.82, -FACE - 6.27, 1.7, AZ0 - 2.3, Math.PI / 2);
  }

  return { colliders };
}

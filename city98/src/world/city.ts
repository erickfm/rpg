/**
 * The city: a 3×3 grid of blocks divided by two avenues and two streets.
 * Late-90s Americana — brick storefronts downtown, an office tower, a gas
 * station, a park, and your apartment on the west side.
 * +x is east, +z is south. All data is plain and testable.
 */

export const CITY_HALF = 110;
export const ROAD_HALF = 6;
export const SIDEWALK_W = 4;
export const WALK_EDGE = ROAD_HALF + SIDEWALK_W;

export interface Road {
  axis: 'x' | 'z';
  at: number;
}

export const ROADS: Road[] = [
  { axis: 'z', at: -38 }, // western avenue (runs north–south)
  { axis: 'z', at: 38 }, // eastern avenue
  { axis: 'x', at: -38 }, // northern street (runs east–west)
  { axis: 'x', at: 38 }, // southern street
];

export function onRoad(x: number, z: number): boolean {
  return ROADS.some(r => Math.abs((r.axis === 'z' ? x : z) - r.at) <= ROAD_HALF);
}

/** Distance from the nearest road centerline (across the road). */
export function roadAcross(x: number, z: number): number {
  return Math.min(...ROADS.map(r => Math.abs((r.axis === 'z' ? x : z) - r.at)));
}

// ---------- buildings ----------

export type Face = 'n' | 's' | 'e' | 'w';

export type BuildingKind =
  | 'storefront' // brick with big windows, awning, roof sign
  | 'diner' // low chrome-and-tile with a pylon sign
  | 'office' // curtain-wall tower
  | 'apartment' // brick walk-up
  | 'gas' // small shop (canopy + pumps are props)
  | 'house' // pitched-roof rowhouse
  | 'warehouse' // corrugated big-box
  | 'strip'; // long strip-mall unit

export interface BuildingDef {
  id: string;
  kind: BuildingKind;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  face: Face;
  color: number;
  trim: number;
}

export const BUILDINGS: BuildingDef[] = [
  // downtown core (center block)
  { id: 'video',   kind: 'storefront', name: 'VIDEO PALACE',   x: -14, z: -18, w: 20, d: 16, h: 7,  face: 'n', color: 0x8f4f38, trim: 0x2e9c9c },
  { id: 'diner',   kind: 'diner',      name: 'SUNRISE DINER',  x: 12,  z: -19, w: 18, d: 14, h: 5.5, face: 'n', color: 0xd8d3c8, trim: 0xc84848 },
  { id: 'arcade',  kind: 'storefront', name: 'NEON DRAGON',    x: -12, z: 18,  w: 20, d: 16, h: 7,  face: 's', color: 0x565e7a, trim: 0xc84a9c },
  { id: 'records', kind: 'storefront', name: 'SPIN CITY RECORDS', x: 12, z: 19, w: 16, d: 14, h: 6.5, face: 's', color: 0x6a5a8c, trim: 0xe8c33c },
  // north block: the office tower
  { id: 'office',  kind: 'office',     name: 'DATACORP',       x: 0,   z: -63, w: 34, d: 26, h: 42, face: 's', color: 0x5f6b78, trim: 0x9fb8c8 },
  // west block: home
  { id: 'home',    kind: 'apartment',  name: 'MAPLE COURT',    x: -63, z: 0,   w: 26, d: 30, h: 20, face: 'e', color: 0x9c5f42, trim: 0xe8ddc8 },
  { id: 'rowA',    kind: 'house',      name: '',               x: -66, z: -22, w: 16, d: 12, h: 7,  face: 'e', color: 0xb8b09c, trim: 0x5f4f3f },
  // east block: gas + dealership
  { id: 'gasshop', kind: 'gas',        name: 'GAS-N-GO',       x: 60,  z: -14, w: 16, d: 12, h: 5.5, face: 'w', color: 0xd8d8d0, trim: 0xc83c3c },
  { id: 'dealer',  kind: 'strip',      name: "BIG RAY'S AUTOS", x: 76, z: 22,  w: 14, d: 12, h: 5.5, face: 'w', color: 0xd8cfa8, trim: 0x3c78c8 },
  // flavor blocks
  { id: 'houseA',  kind: 'house',      name: '',               x: -60, z: -94, w: 18, d: 14, h: 8, face: 'e', color: 0xc8b8a0, trim: 0x6a4a3a },
  { id: 'houseB',  kind: 'house',      name: '',               x: -60, z: -74, w: 18, d: 14, h: 8, face: 'e', color: 0xa8b8b0, trim: 0x4a5a52 },
  { id: 'houseC',  kind: 'house',      name: '',               x: -60, z: 58,  w: 18, d: 14, h: 8, face: 'e', color: 0xc0aa92, trim: 0x5f4433 },
  { id: 'houseD',  kind: 'house',      name: '',               x: -60, z: 80,  w: 18, d: 14, h: 8, face: 'e', color: 0x9aa8c0, trim: 0x44506a },
  { id: 'wareh',   kind: 'warehouse',  name: 'IRONSIDE STORAGE', x: 72, z: -72, w: 40, d: 32, h: 12, face: 'w', color: 0x7a8088, trim: 0x4a4e54 },
  { id: 'donut',   kind: 'strip',      name: 'DONUT HUT',      x: 66,  z: 60,  w: 16, d: 12, h: 5.5, face: 'w', color: 0xe8d8b8, trim: 0xc86a9c },
  { id: 'copy',    kind: 'strip',      name: 'COPY STOP',      x: 66,  z: 76,  w: 16, d: 12, h: 5.5, face: 'w', color: 0xd0d8e0, trim: 0x3c78c8 },
];

export function buildingById(id: string): BuildingDef {
  return BUILDINGS.find(b => b.id === id)!;
}

/** World-space position of a building's front wall center + outward normal. */
export function frontOf(b: BuildingDef): { x: number; z: number; nx: number; nz: number } {
  switch (b.face) {
    case 'n': return { x: b.x, z: b.z - b.d / 2, nx: 0, nz: -1 };
    case 's': return { x: b.x, z: b.z + b.d / 2, nx: 0, nz: 1 };
    case 'e': return { x: b.x + b.w / 2, z: b.z, nx: 1, nz: 0 };
    case 'w': return { x: b.x - b.w / 2, z: b.z, nx: -1, nz: 0 };
  }
}

// ---------- interactables ----------

export interface Interactable {
  id: string;
  label: string;
  x: number;
  z: number;
}

const door = (id: string, label: string, out = 1.6): Interactable => {
  const b = buildingById(id);
  const f = frontOf(b);
  return { id, label, x: f.x + f.nx * out, z: f.z + f.nz * out };
};

export const INTERACTABLES: Interactable[] = [
  door('home', 'Maple Court — your apartment'),
  door('video', 'Video Palace'),
  door('diner', 'Sunrise Diner'),
  door('office', 'Datacorp'),
  door('gasshop', 'Gas-N-Go'),
  door('arcade', 'Neon Dragon Arcade'),
  door('donut', 'Donut Hut'),
  door('dealer', "Big Ray's Autos"),
  door('records', 'Spin City Records'),
  { id: 'atm', label: 'First Federal ATM', x: -19.3, z: -30 },
  { id: 'newsstand', label: 'CITY HERALD box', x: -15, z: -28.4 },
  { id: 'bench', label: 'Park bench', x: 4, z: 58 },
  { id: 'payphone', label: 'Payphone', x: -8.3, z: 52 },
];

// ---------- props ----------

export type PropKind =
  | 'streetlight' | 'powerpole' | 'tree' | 'hydrant' | 'bench'
  | 'dumpster' | 'pump' | 'canopy' | 'planter' | 'fountain' | 'mailbox' | 'payphone' | 'atm' | 'newsbox';

export interface PropDef {
  kind: PropKind;
  x: number;
  z: number;
  rot?: number;
}

/** Block spans between the roads (shared by the renderer and pedestrians). */
export const BLOCK_SPANS: [number, number][] = [
  [-CITY_HALF, -38 - ROAD_HALF],
  [-38 + ROAD_HALF, 38 - ROAD_HALF],
  [38 + ROAD_HALF, CITY_HALF],
];

export interface Ring {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** Sidewalk-centerline loops pedestrians walk, one per block. */
export const BLOCK_RINGS: Ring[] = [];
for (const [bx1, bx2] of BLOCK_SPANS) {
  for (const [bz1, bz2] of BLOCK_SPANS) {
    BLOCK_RINGS.push({ x1: bx1 + 2, z1: bz1 + 2, x2: bx2 - 2, z2: bz2 - 2 });
  }
}

export function ringLength(r: Ring): number {
  return 2 * (r.x2 - r.x1) + 2 * (r.z2 - r.z1);
}

/** Point at distance `s` along the ring perimeter (clockwise from NW corner). */
export function ringPoint(r: Ring, s: number): { x: number; z: number; heading: number } {
  const w = r.x2 - r.x1;
  const d = r.z2 - r.z1;
  const len = ringLength(r);
  let t = ((s % len) + len) % len;
  if (t < w) return { x: r.x1 + t, z: r.z1, heading: -Math.PI / 2 }; // east along north edge
  t -= w;
  if (t < d) return { x: r.x2, z: r.z1 + t, heading: Math.PI }; // south along east edge
  t -= d;
  if (t < w) return { x: r.x2 - t, z: r.z2, heading: Math.PI / 2 }; // west along south edge
  t -= w;
  return { x: r.x1, z: r.z2 - t, heading: 0 }; // north along west edge
}

const corners: PropDef[] = [];
for (const ix of [-38, 38]) {
  for (const iz of [-38, 38]) {
    // heads lean toward the intersection they serve
    corners.push({ kind: 'streetlight', x: ix + 8.6, z: iz + 8.6, rot: Math.PI / 4 });
    corners.push({ kind: 'streetlight', x: ix - 8.6, z: iz - 8.6, rot: (-3 * Math.PI) / 4 });
    corners.push({ kind: 'hydrant', x: ix - 8.4, z: iz + 8.4 });
  }
}

export const PROPS: PropDef[] = [
  ...corners,
  // mid-block streetlights, heads over their roads
  { kind: 'streetlight', x: -38 + 8.6, z: 0, rot: Math.PI / 2 },
  { kind: 'streetlight', x: 38 - 8.6, z: 0, rot: -Math.PI / 2 },
  { kind: 'streetlight', x: 0, z: -38 - 8.6, rot: Math.PI },
  { kind: 'streetlight', x: 0, z: 38 + 8.6, rot: 0 },
  { kind: 'streetlight', x: -38 - 8.6, z: -74, rot: -Math.PI / 2 },
  { kind: 'streetlight', x: 38 + 8.6, z: 74, rot: Math.PI / 2 },
  // power line along the southern street
  ...[-96, -71, -50, -12, 12, 50, 71, 96].map(x => ({ kind: 'powerpole' as const, x, z: 38 + 9 })),
  // downtown dressing
  { kind: 'mailbox', x: -2, z: -27.4 },
  { kind: 'bench', x: 2.6, z: -27.6, rot: Math.PI },
  { kind: 'dumpster', x: -14, z: -6, rot: 0.3 },
  { kind: 'dumpster', x: 14, z: -8 },
  { kind: 'planter', x: 26, z: -27 },
  { kind: 'atm', x: -20.6, z: -30, rot: Math.PI / 2 },
  { kind: 'newsbox', x: -15, z: -30, rot: 0 },
  // office plaza
  { kind: 'planter', x: -12, z: -46.6 },
  { kind: 'planter', x: 12, z: -46.6 },
  // gas station forecourt (faces the eastern avenue)
  { kind: 'pump', x: 50.5, z: -18 },
  { kind: 'pump', x: 50.5, z: -10 },
  { kind: 'canopy', x: 50.5, z: -14 },
  // park
  { kind: 'payphone', x: -9.6, z: 52 },
  { kind: 'fountain', x: 0, z: 66 },
  { kind: 'bench', x: 4, z: 57, rot: Math.PI * 0.95 },
  { kind: 'bench', x: -8, z: 62, rot: Math.PI / 2 },
];

// ---------- vehicles ----------

export type CarKind = 'sedan' | 'hatch' | 'wagon' | 'pickup';

export interface ParkedCar {
  kind: CarKind;
  color: number;
  x: number;
  z: number;
  rot: number; // heading, 0 = facing −z (north)
}

const N = 0;
const S = Math.PI;
const E = Math.PI / 2;
const W = -Math.PI / 2;

/** Street parking + the dealership lot. */
export const PARKED: ParkedCar[] = [
  { kind: 'sedan',  color: 0x8c2f2f, x: -33.5, z: -14, rot: N },
  { kind: 'wagon',  color: 0x4a6a4a, x: -33.5, z: 22, rot: N },
  { kind: 'pickup', color: 0x3c5a8c, x: 33.5, z: -20, rot: S },
  { kind: 'sedan',  color: 0xb8b0a0, x: 12, z: -33.5, rot: E },
  { kind: 'hatch',  color: 0x7a4a9c, x: -18, z: 33.5, rot: W },
  // Big Ray's inventory, nosed toward the avenue
  { kind: 'sedan',  color: 0xc8b83c, x: 54, z: 18, rot: W },
  { kind: 'wagon',  color: 0x8c3c5a, x: 54, z: 26, rot: W },
  { kind: 'pickup', color: 0x3c8c7a, x: 54, z: 34, rot: W },
];

/** Your beater, parked on the avenue outside Maple Court. */
export const PLAYER_CAR = { kind: 'hatch' as CarKind, color: 0xc87830, x: -33.5, z: 6, rot: N };

export const PLAYER_SPAWN = { x: -46, z: 2, yaw: -0.35 }; // outside your door, looking up the avenue

/** Traffic loops one lane per road, right-hand side. */
export interface TrafficRoute {
  road: Road;
  color: number;
  kind: CarKind;
  speed: number;
}

export const TRAFFIC: TrafficRoute[] = [
  { road: ROADS[0], color: 0x9c9ca4, kind: 'sedan', speed: 12 },
  { road: ROADS[1], color: 0x6a4a3a, kind: 'pickup', speed: 11 },
  { road: ROADS[2], color: 0x4a5a8c, kind: 'wagon', speed: 12.5 },
  { road: ROADS[3], color: 0x8c6a2f, kind: 'sedan', speed: 11.5 },
];

// ---------- collision ----------

export interface Aabb {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

const PROP_HALF: Partial<Record<PropKind, [number, number]>> = {
  streetlight: [0.3, 0.3],
  powerpole: [0.3, 0.3],
  tree: [0.5, 0.5],
  hydrant: [0.35, 0.35],
  bench: [1.1, 0.5],
  dumpster: [1.6, 0.9],
  pump: [0.7, 1.1],
  planter: [1.2, 1.2],
  fountain: [3.2, 3.2],
  mailbox: [0.4, 0.4],
  payphone: [0.4, 0.3],
  atm: [0.6, 0.4],
  newsbox: [0.45, 0.35],
};

const CAR_HALF: Record<CarKind, [number, number]> = {
  sedan: [1.05, 2.35],
  hatch: [1.0, 1.95],
  wagon: [1.05, 2.5],
  pickup: [1.1, 2.5],
};

function carAabb(c: { kind: CarKind; x: number; z: number; rot: number }): Aabb {
  const [hw, hl] = CAR_HALF[c.kind];
  const along = Math.abs(Math.cos(c.rot)) > 0.5 ? 'z' : 'x'; // rot 0/π face ±z
  const hx = along === 'z' ? hw : hl;
  const hz = along === 'z' ? hl : hw;
  return { x1: c.x - hx, z1: c.z - hz, x2: c.x + hx, z2: c.z + hz };
}

export function staticColliders(): Aabb[] {
  const list: Aabb[] = [];
  for (const b of BUILDINGS) {
    list.push({ x1: b.x - b.w / 2, z1: b.z - b.d / 2, x2: b.x + b.w / 2, z2: b.z + b.d / 2 });
  }
  for (const p of PROPS) {
    if (p.kind === 'canopy') continue; // you can walk under it
    const half = PROP_HALF[p.kind];
    if (!half) continue;
    list.push({ x1: p.x - half[0], z1: p.z - half[1], x2: p.x + half[0], z2: p.z + half[1] });
  }
  for (const c of PARKED) list.push(carAabb(c));
  return list;
}

/** Circle-vs-AABB slide response; also clamps to the city bounds. */
export function resolveCollision(
  x: number,
  z: number,
  r: number,
  colliders: Aabb[]
): [number, number] {
  x = Math.max(-CITY_HALF + r, Math.min(CITY_HALF - r, x));
  z = Math.max(-CITY_HALF + r, Math.min(CITY_HALF - r, z));
  for (const b of colliders) {
    const cx = Math.max(b.x1, Math.min(b.x2, x));
    const cz = Math.max(b.z1, Math.min(b.z2, z));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // center is inside the box: push out the shallow side
      const pushLeft = Math.abs(x - b.x1);
      const pushRight = Math.abs(b.x2 - x);
      const pushUp = Math.abs(z - b.z1);
      const pushDown = Math.abs(b.z2 - z);
      const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (m === pushLeft) x = b.x1 - r;
      else if (m === pushRight) x = b.x2 + r;
      else if (m === pushUp) z = b.z1 - r;
      else z = b.z2 + r;
    }
  }
  return [x, z];
}

export { carAabb };

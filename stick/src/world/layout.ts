import type { PlaceId } from '../core/types';

/**
 * The 2 Dimensional World, laid out to match the original Stick RPG map:
 * a floating island with one vertical road and two offset horizontal arms.
 * +x is east, +z is south; north (−z) is the castle end of town.
 */

export type DoorSide = 'n' | 's' | 'e' | 'w';

export interface Building {
  id: PlaceId;
  name: string;
  x: number; // center
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  side: DoorSide;
  doorX: number;
  doorZ: number;
}

const DOOR_GAP = 1.4;

const B = (
  id: PlaceId,
  name: string,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: number,
  side: DoorSide
): Building => ({
  id, name, x, z, w, d, h, color, side,
  doorX: side === 'e' ? x + w / 2 + DOOR_GAP : side === 'w' ? x - w / 2 - DOOR_GAP : x,
  doorZ: side === 's' ? z + d / 2 + DOOR_GAP : side === 'n' ? z - d / 2 - DOOR_GAP : z,
});

/** Buildings hug their roads like the original — short walks to every door. */
export const CITY: Building[] = [
  // NW block — home turf
  B('apartment', 'Apartment',            -72, -54, 34, 20, 22, 0x8a5a3c, 's'),
  B('castle',    'The Castle',           -28, -56, 26, 26, 26, 0x8d939c, 's'),
  // NE block — money and books
  B('bank',      'Bank',                  22, -70, 16, 16, 20, 0x8c2f2f, 'w'),
  B('newlines',  'New Lines Inc.',        24, -44, 20, 20, 46, 0x7d838d, 'w'),
  B('uofs',      'U of S',                62, -13, 40, 28, 24, 0xd8c98f, 's'),
  // West block — grease, booze, and dice
  B('fineline',  'Fine Line Furnishings',-80,  -8, 26, 16, 12, 0xd9d9d2, 'n'),
  B('mcsticks',  'McSticks',             -30,  -8, 22, 16, 12, 0xc9a45a, 'n'),
  B('stickys',   "Sticky's Liquor",      -24,  26, 20, 16, 11, 0x5d6b3c, 'e'),
  B('casino',    'Silver Lining Casino', -28,  66, 30, 22, 16, 0x3d5da8, 'e'),
  // SE block — commerce of varying legality
  B('store',     'Convenience Store',     28,  34, 20, 16, 10, 0xd88a2e, 'n'),
  B('busdepot',  'Bus Depot',             74,  34, 24, 14, 10, 0x54a8c8, 'n'),
  B('pawn',      'Pawn Shop',             24,  72, 18, 14, 12, 0x7a4a9c, 'w'),
];

export const CITY_HALF = 110; // the island is a square of ±CITY_HALF
export const ROAD_HALF = 7;
export const INTERACT_RADIUS = 4;

export interface Road {
  axis: 'x' | 'z'; // direction the road runs
  at: number; // fixed coordinate of the centerline
  from: number;
  to: number;
}

/** One vertical road, two offset arms — the original's signature layout. */
export const ROADS: Road[] = [
  { axis: 'z', at: 0, from: -CITY_HALF, to: CITY_HALF },
  { axis: 'x', at: -30, from: -CITY_HALF, to: 0 },
  { axis: 'x', at: 10, from: 0, to: CITY_HALF },
];

export function onRoad(x: number, z: number): boolean {
  for (const r of ROADS) {
    const along = r.axis === 'x' ? x : z;
    const across = r.axis === 'x' ? z : x;
    if (along >= r.from && along <= r.to && Math.abs(across - r.at) <= ROAD_HALF) return true;
  }
  return false;
}

/** Fixed world dressing and actors. */
export const SPAWN = { x: -72, z: -39 };
export const YELLOW_CAR = { x: -94, z: -48 }; // hotwireable, on the apartment lot
export const PARKED_BUS = { x: 52, z: 34 };

export interface NpcPost {
  id: 'harold' | 'punk' | 'rudy';
  name: string;
  headColor: number;
  // patrol segment (a == b means standing still)
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

export const NPC_POSTS: NpcPost[] = [
  { id: 'harold', name: 'Homeless Harold', headColor: 0xd88a2e, ax: -9, az: 20, bx: -9, bz: 20 },
  // "the kid by your apartment... on the street corner"
  { id: 'punk',   name: 'Skater Punk',     headColor: 0x6ec6e8, ax: -12, az: -44, bx: -12, bz: -22 },
  { id: 'rudy',   name: 'Red-Headed Stick', headColor: 0xc83c3c, ax: 14, az: 40, bx: 14, bz: 62 },
];

/** Traffic: each car shuttles along one road, U-turning at the ends. */
export interface CarRoute {
  road: Road;
  color: number;
  speed: number;
}

export const CAR_ROUTES: CarRoute[] = [
  { road: ROADS[0], color: 0xc83c3c, speed: 16 },
  { road: ROADS[1], color: 0xe8b93c, speed: 13 },
  { road: ROADS[2], color: 0x9c4ac8, speed: 14 },
];

/**
 * Circle-vs-AABB response against buildings plus the island edge.
 * The castle is a vacant lot until purchased — pass `skipCastle` then.
 */
export function resolveCollision(x: number, z: number, r: number, skipCastle = false): [number, number] {
  x = Math.max(-CITY_HALF + r, Math.min(CITY_HALF - r, x));
  z = Math.max(-CITY_HALF + r, Math.min(CITY_HALF - r, z));
  for (const b of CITY) {
    if (skipCastle && b.id === 'castle') continue;
    const hw = b.w / 2 + r;
    const hd = b.d / 2 + r;
    const dx = x - b.x;
    const dz = z - b.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const px = hw - Math.abs(dx);
      const pz = hd - Math.abs(dz);
      if (px < pz) x = b.x + Math.sign(dx || 1) * hw;
      else z = b.z + Math.sign(dz || 1) * hd;
    }
  }
  return [x, z];
}

export function nearestDoor(x: number, z: number, skipCastle = false): Building | null {
  let best: Building | null = null;
  let bestD = INTERACT_RADIUS;
  for (const b of CITY) {
    if (skipCastle && b.id === 'castle') continue;
    const d = Math.hypot(x - b.doorX, z - b.doorZ);
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}

export function buildingById(id: PlaceId): Building {
  return CITY.find(b => b.id === id)!;
}

import type { Aabb } from './city';

/**
 * Walkable interiors. Each room lives in its own pocket of the world far
 * from the city (x ≈ 1000) — entering teleports you there, so the outside
 * world needs no visibility juggling. Local coords: room centered on (0,0),
 * the exit door mid-front at +z.
 */

export type RoomPlace = 'diner' | 'video' | 'arcade' | 'home' | 'office' | 'loft';

export type RoomPropKind =
  | 'counter' | 'stool' | 'booth' | 'shelf' | 'register' | 'cabinet'
  | 'bed' | 'tv' | 'fridge' | 'jukebox' | 'poster' | 'rug' | 'nightstand'
  | 'coffeemaker' | 'standee' | 'reception' | 'elevator' | 'plant' | 'chairs'
  | 'stereo' | 'crate' | 'lavalamp' | 'houseplant' | 'mirror' | 'couch' | 'window';

export interface RoomProp {
  kind: RoomPropKind;
  x: number;
  z: number;
  rot?: number;
  color?: number;
  /** If set, this prop is only shown once the matching good is owned. */
  good?: string;
}

export interface RoomStation {
  /** ids resolve in the panel switch; 'exit' leaves the room */
  id: string;
  label: string;
  x: number;
  z: number;
}

export interface RoomDef {
  place: RoomPlace;
  title: string;
  w: number;
  d: number;
  h: number;
  wall: number;
  floor: number;
  checker?: boolean;
  dark?: boolean; // moody rooms (arcade) get dimmer house lights
  stations: RoomStation[];
  props: RoomProp[];
}

export const ROOMS: RoomDef[] = [
  {
    place: 'diner',
    title: 'Sunrise Diner',
    w: 17, d: 12, h: 3.4,
    wall: 0xd8cfb8, floor: 0xd8d5cc, checker: true,
    stations: [
      { id: 'diner', label: 'Order at the counter', x: 0, z: -2.6 },
      { id: 'jukebox', label: 'Jukebox', x: 6.6, z: -3.6 },
    ],
    props: [
      { kind: 'counter', x: 0, z: -4.2 },
      { kind: 'coffeemaker', x: -3.4, z: -5.1 },
      { kind: 'stool', x: -2.4, z: -2.6 }, { kind: 'stool', x: -0.8, z: -2.6 },
      { kind: 'stool', x: 0.8, z: -2.6 }, { kind: 'stool', x: 2.4, z: -2.6 },
      { kind: 'booth', x: -6.6, z: -3.5, rot: Math.PI / 2 },
      { kind: 'booth', x: -6.6, z: 0.5, rot: Math.PI / 2 },
      { kind: 'booth', x: -6.6, z: 4.2, rot: Math.PI / 2 },
      { kind: 'jukebox', x: 6.6, z: -4.6 },
      { kind: 'poster', x: 8.4, z: 0, rot: -Math.PI / 2, color: 0xc84848 },
    ],
  },
  {
    place: 'video',
    title: 'Video Palace',
    w: 16, d: 13, h: 3.2,
    wall: 0x5f8a8a, floor: 0x8a4f9c,
    stations: [
      { id: 'video', label: 'The register — clock in', x: -4.6, z: -3.2 },
      { id: 'browse', label: 'Browse the new releases', x: 3, z: -0.6 },
    ],
    props: [
      { kind: 'register', x: -4.6, z: -4.6 },
      { kind: 'shelf', x: 3, z: -2.2 },
      { kind: 'shelf', x: 3, z: 1.4 },
      { kind: 'shelf', x: 3, z: 5 },
      { kind: 'shelf', x: -3, z: 1.4, rot: 0 },
      { kind: 'standee', x: -6.4, z: 2.4 },
      { kind: 'poster', x: 0, z: -6.2, color: 0x2e9c9c },
    ],
  },
  {
    place: 'arcade',
    title: 'Neon Dragon Arcade',
    w: 15, d: 12, h: 3.2,
    wall: 0x2c2c3c, floor: 0x232330, dark: true,
    stations: [
      { id: 'arcade', label: 'Street Champ II', x: -3.2, z: -3.4 },
      { id: 'arcade', label: 'Gutter Racer', x: 0, z: -3.4 },
    ],
    props: [
      { kind: 'cabinet', x: -4.2, z: -4.6, color: 0xc84a9c },
      { kind: 'cabinet', x: -2.4, z: -4.6, color: 0x3cc8c8 },
      { kind: 'cabinet', x: -0.6, z: -4.6, color: 0xe8c33c },
      { kind: 'cabinet', x: 1.2, z: -4.6, color: 0x4ac84a },
      { kind: 'cabinet', x: 5.6, z: -2, rot: -Math.PI / 2, color: 0xc84a4a },
      { kind: 'cabinet', x: 5.6, z: 0.2, rot: -Math.PI / 2, color: 0x4a6ac8 },
      { kind: 'poster', x: -6.9, z: 0, rot: Math.PI / 2, color: 0xc84a9c },
    ],
  },
  {
    place: 'home',
    title: 'Maple Court — Apt 3B',
    w: 10, d: 9, h: 3.0,
    wall: 0xc8b89c, floor: 0x8a6f52,
    stations: [
      { id: 'home', label: 'Bed', x: -2.6, z: -1.6 },
      { id: 'tv', label: 'The TV', x: 2.4, z: -0.8 },
      { id: 'fridge', label: 'Fridge', x: 3.6, z: -2.9 },
      { id: 'stereo', label: 'Stereo', x: 0.4, z: -1.4 },
      { id: 'mirror', label: 'Mirror — check yourself out', x: -4.0, z: -1.2 },
    ],
    props: [
      { kind: 'bed', x: -2.8, z: -2.6 },
      { kind: 'nightstand', x: -0.9, z: -3.4 },
      { kind: 'tv', x: 2.4, z: -2.4 },
      { kind: 'fridge', x: 3.9, z: -2.9 },
      { kind: 'stereo', x: 0.4, z: -2.9 },
      { kind: 'crate', x: 1.4, z: -2.9, good: 'up_stereo' },
      { kind: 'lavalamp', x: -0.9, z: -3.1, good: 'up_lamp' },
      { kind: 'houseplant', x: 4.2, z: 1.4, good: 'up_plant' },
      { kind: 'mirror', x: -4.85, z: -1.2, rot: Math.PI / 2 },
      { kind: 'rug', x: 0, z: 0.6 },
      { kind: 'poster', x: -4.4, z: 0.5, rot: Math.PI / 2, color: 0x3c78c8 },
    ],
  },
  {
    place: 'loft',
    title: 'Skyline Loft',
    w: 15, d: 12, h: 3.6,
    wall: 0xb8b0a4, floor: 0x9a7a58,
    stations: [
      { id: 'home', label: 'Bed', x: -5.4, z: -2.4 },
      { id: 'tv', label: 'The TV', x: 4.6, z: -1.4 },
      { id: 'fridge', label: 'Fridge', x: 5.8, z: -4.2 },
      { id: 'stereo', label: 'Stereo', x: 1.2, z: -2.0 },
      { id: 'mirror', label: 'Mirror — check yourself out', x: -6.2, z: 1.0 },
    ],
    props: [
      { kind: 'window', x: 0, z: -5.9 },
      { kind: 'bed', x: -5.4, z: -3.6 },
      { kind: 'nightstand', x: -3.6, z: -4.4 },
      { kind: 'tv', x: 4.6, z: -3.2 },
      { kind: 'fridge', x: 6.0, z: -4.2 },
      { kind: 'stereo', x: 1.2, z: -3.4 },
      { kind: 'crate', x: 2.3, z: -3.4, good: 'up_stereo' },
      { kind: 'lavalamp', x: -3.6, z: -4.1, good: 'up_lamp' },
      { kind: 'houseplant', x: 6.0, z: 2.2, good: 'up_plant' },
      { kind: 'couch', x: 3.0, z: 1.6 },
      { kind: 'mirror', x: -6.9, z: 1.0, rot: Math.PI / 2 },
      { kind: 'rug', x: 1.5, z: 1.2 },
      { kind: 'poster', x: -6.9, z: -2.4, rot: Math.PI / 2, color: 0xd8a83c },
    ],
  },
  {
    place: 'office',
    title: 'Datacorp — Lobby',
    w: 16, d: 12, h: 3.6,
    wall: 0x9fa8b0, floor: 0x7a8088,
    stations: [
      { id: 'office', label: 'Elevator — ride up and clock in', x: 0, z: -3.6 },
      { id: 'reception', label: 'Reception', x: -4.6, z: -2.4 },
    ],
    props: [
      { kind: 'elevator', x: 0, z: -5.6 },
      { kind: 'reception', x: -4.6, z: -4.2 },
      { kind: 'plant', x: -7.2, z: -4.8 },
      { kind: 'plant', x: 7.2, z: -4.8 },
      { kind: 'chairs', x: 5.4, z: 1.4, rot: -Math.PI / 2 },
      { kind: 'rug', x: 0, z: 0.8 },
      { kind: 'poster', x: 0, z: -6.2, color: 0x9fb8c8 },
    ],
  },
];

export const ROOM_ORIGIN: Record<RoomPlace, { x: number; z: number }> = {
  diner: { x: 1000, z: 0 },
  video: { x: 1000, z: 300 },
  arcade: { x: 1000, z: 600 },
  home: { x: 1000, z: 900 },
  office: { x: 1000, z: 1200 },
  loft: { x: 1000, z: 1500 },
};

export function roomByPlace(place: RoomPlace): RoomDef {
  return ROOMS.find(r => r.place === place)!;
}

/** World-space entry/exit spot, just inside the front wall. */
export function roomEntry(place: RoomPlace): { x: number; z: number } {
  const room = roomByPlace(place);
  const o = ROOM_ORIGIN[place];
  return { x: o.x, z: o.z + room.d / 2 - 1.2 };
}

const PROP_HALF: Partial<Record<RoomPropKind, [number, number]>> = {
  reception: [2.2, 0.7],
  elevator: [1.6, 0.3],
  plant: [0.45, 0.45],
  chairs: [1.9, 0.5],
  counter: [3.9, 0.6],
  stool: [0.3, 0.3],
  booth: [1.3, 1.5],
  shelf: [2.6, 0.45],
  register: [1.1, 0.55],
  cabinet: [0.55, 0.45],
  bed: [1.1, 1.6],
  tv: [0.7, 0.5],
  fridge: [0.55, 0.55],
  jukebox: [0.65, 0.45],
  nightstand: [0.45, 0.45],
  coffeemaker: [0.5, 0.35],
  standee: [0.5, 0.3],
  stereo: [0.6, 0.4],
  crate: [0.5, 0.5],
  mirror: [0.1, 0.6],
  couch: [1.6, 0.7],
  window: [0.1, 2.4],
  lavalamp: [0.25, 0.25],
  houseplant: [0.4, 0.4],
};

function rotHalf(kind: RoomPropKind, rot = 0): [number, number] {
  const half = PROP_HALF[kind] ?? [0.4, 0.4];
  return Math.abs(Math.sin(rot)) > 0.5 ? [half[1], half[0]] : half;
}

/** World-space colliders: four wall slabs plus the furniture. */
export function roomColliders(place: RoomPlace): Aabb[] {
  const room = roomByPlace(place);
  const o = ROOM_ORIGIN[place];
  const hw = room.w / 2;
  const hd = room.d / 2;
  const list: Aabb[] = [
    { x1: o.x - hw - 1, z1: o.z - hd - 1, x2: o.x + hw + 1, z2: o.z - hd }, // back
    { x1: o.x - hw - 1, z1: o.z + hd, x2: o.x + hw + 1, z2: o.z + hd + 1 }, // front
    { x1: o.x - hw - 1, z1: o.z - hd, x2: o.x - hw, z2: o.z + hd }, // left
    { x1: o.x + hw, z1: o.z - hd, x2: o.x + hw + 1, z2: o.z + hd }, // right
  ];
  for (const p of room.props) {
    if (p.kind === 'rug' || p.kind === 'poster') continue;
    const [hx, hz] = rotHalf(p.kind, p.rot);
    list.push({ x1: o.x + p.x - hx, z1: o.z + p.z - hz, x2: o.x + p.x + hx, z2: o.z + p.z + hz });
  }
  return list;
}

import type { GameState, PlaceId } from '../core/types';
import { hasFurniture } from '../core/state';

/**
 * Interior floor plans. Local coordinates, room centered on (0,0);
 * the exit door is always mid-south wall (+z). Stations are the
 * glowing pads the player walks onto and presses E.
 */

export type PropKind =
  | 'counter' | 'shelf' | 'desk' | 'bigdesk' | 'table' | 'rug' | 'plant'
  | 'bed' | 'sofa' | 'tv' | 'computer' | 'treadmill' | 'minibar' | 'freezer'
  | 'satellite' | 'encyclopedia' | 'slotmachine' | 'cardtable' | 'roulettetable'
  | 'dartboard' | 'vaultdoor' | 'jukebox' | 'blackboard' | 'weights'
  | 'ticketwindow' | 'stool' | 'npc';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  rot?: number;
  color?: number;
}

export interface Station {
  id: string;
  label: string;
  x: number;
  z: number;
}

export interface InteriorDef {
  place: PlaceId;
  title: string;
  w: number;
  d: number;
  floor: number;
  wall: number;
  stations: Station[];
  props: Prop[];
}

export const EXIT_MARGIN = 2.4; // exit pad sits this far inside the south wall

export function exitSpot(def: InteriorDef): { x: number; z: number } {
  return { x: 0, z: def.d / 2 - EXIT_MARGIN };
}

/** Interiors depend on state (owned furniture appears in your home). */
export function interiorFor(place: PlaceId, s: GameState): InteriorDef {
  switch (place) {
    case 'apartment':
    case 'castle':
      return homeInterior(place, s);
    case 'bank':
      return {
        place, title: 'Bank', w: 32, d: 24, floor: 0x8a8175, wall: 0x9c4040,
        stations: [
          { id: 'teller', label: 'Teller — accounts & loans', x: -8, z: -6 },
          { id: 'manager', label: 'Manager — real estate', x: 8, z: -6 },
          { id: 'vault', label: 'The vault…', x: 0, z: -9 },
        ],
        props: [
          { kind: 'counter', x: -8, z: -8.5 },
          { kind: 'bigdesk', x: 8, z: -8.5 },
          { kind: 'vaultdoor', x: 0, z: -11 },
          { kind: 'plant', x: -13, z: 8 },
          { kind: 'plant', x: 13, z: 8 },
          { kind: 'rug', x: 0, z: 2, color: 0x7a3030 },
        ],
      };
    case 'newlines':
      return {
        place, title: 'New Lines Inc.', w: 34, d: 26, floor: 0x9a9da6, wall: 0x6d737d,
        stations: [
          { id: 'reception', label: 'Reception — apply', x: -9, z: -6 },
          { id: 'desk', label: 'Your desk — work a shift', x: 9, z: -6 },
        ],
        props: [
          { kind: 'counter', x: -9, z: -8.5 },
          { kind: 'desk', x: 9, z: -8.5 },
          { kind: 'desk', x: 14, z: -2 },
          { kind: 'desk', x: 4, z: -2 },
          { kind: 'plant', x: -14, z: 9 },
          { kind: 'npc', x: -9, z: -10.5, color: 0x8a6a4a }, // Bob & co.
        ],
      };
    case 'uofs':
      return {
        place, title: 'University of Stick', w: 38, d: 28, floor: 0xb8a878, wall: 0xd8c98f,
        stations: [
          { id: 'study', label: 'Library — study (free)', x: -12, z: -7 },
          { id: 'class', label: 'Lecture hall — take a class', x: 0, z: -7 },
          { id: 'gym', label: 'Campus gym — exercise', x: 12, z: -7 },
        ],
        props: [
          { kind: 'shelf', x: -12, z: -10.5 },
          { kind: 'shelf', x: -16, z: -6 },
          { kind: 'blackboard', x: 0, z: -12 },
          { kind: 'weights', x: 12, z: -10.5 },
          { kind: 'table', x: -6, z: 3 },
          { kind: 'plant', x: 16, z: 9 },
        ],
      };
    case 'mcsticks':
      return {
        place, title: 'McSticks', w: 30, d: 24, floor: 0xc8b088, wall: 0xc9a45a,
        stations: [
          { id: 'order', label: 'Counter — order food', x: -6, z: -6 },
          { id: 'shift', label: 'Kitchen — work a shift', x: 8, z: -6 },
        ],
        props: [
          { kind: 'counter', x: -6, z: -8.5, color: 0xb03030 },
          { kind: 'npc', x: -6, z: -10.5, color: 0xf2e84a },
          { kind: 'table', x: -9, z: 4 },
          { kind: 'table', x: 0, z: 6 },
          { kind: 'table', x: 8, z: 3 },
          { kind: 'stool', x: -11, z: 4 }, { kind: 'stool', x: -7, z: 4 },
          { kind: 'stool', x: -2, z: 6 }, { kind: 'stool', x: 2, z: 6 },
        ],
      };
    case 'fineline':
      return {
        place, title: 'Fine Line Furnishings', w: 32, d: 24, floor: 0xa8a29a, wall: 0xd9d9d2,
        stations: [{ id: 'catalog', label: 'Showroom — browse furniture', x: 0, z: -5 }],
        props: [
          { kind: 'bed', x: -11, z: -8 },
          { kind: 'tv', x: -4, z: -9 },
          { kind: 'computer', x: 2, z: -9 },
          { kind: 'treadmill', x: 8, z: -8 },
          { kind: 'minibar', x: 13, z: -8 },
          { kind: 'sofa', x: -10, z: 3 },
          { kind: 'rug', x: 0, z: 0, color: 0x6a8ab0 },
        ],
      };
    case 'stickys':
      return {
        place, title: "Sticky's Liquor", w: 32, d: 26, floor: 0x6a5138, wall: 0x5d6b3c,
        stations: [
          { id: 'bar', label: 'Bar — drink & bottles', x: -8, z: -7 },
          { id: 'darts', label: 'Dartboard — drunken darts', x: 12, z: -6 },
          { id: 'tough', label: 'Tough guy — pick a fight', x: 8, z: 5 },
          { id: 'jukebox', label: 'Jukebox', x: -13, z: 6 },
        ],
        props: [
          { kind: 'counter', x: -8, z: -9.5, color: 0x4a3826 },
          { kind: 'npc', x: -8, z: -11.5, color: 0x8a8f99 },
          { kind: 'stool', x: -11, z: -7 }, { kind: 'stool', x: -8, z: -7 }, { kind: 'stool', x: -5, z: -7 },
          { kind: 'dartboard', x: 12, z: -10 },
          { kind: 'npc', x: 8, z: 7.5, color: 0x3c3c3c },
          { kind: 'jukebox', x: -13, z: 8 },
          { kind: 'table', x: 2, z: 2 },
        ],
      };
    case 'casino':
      return {
        place, title: 'Silver Lining Casino', w: 42, d: 30, floor: 0x35406a, wall: 0x3d5da8,
        stations: [
          { id: 'slots', label: 'Slots', x: -13, z: -6 },
          { id: 'blackjack', label: 'Blackjack table', x: 0, z: -6 },
          { id: 'roulette', label: 'Roulette wheel', x: 13, z: -6 },
        ],
        props: [
          { kind: 'slotmachine', x: -15, z: -9 },
          { kind: 'slotmachine', x: -12, z: -9.5 },
          { kind: 'slotmachine', x: -9, z: -10 },
          { kind: 'cardtable', x: 0, z: -9 },
          { kind: 'npc', x: 0, z: -11.5, color: 0x2c2c34 },
          { kind: 'roulettetable', x: 13, z: -9 },
          { kind: 'rug', x: 0, z: 4, color: 0x8a2434 },
          { kind: 'plant', x: -18, z: 10 },
          { kind: 'plant', x: 18, z: 10 },
        ],
      };
    case 'store':
      return {
        place, title: 'Funkytown Five-O', w: 28, d: 22, floor: 0xb0a890, wall: 0xd88a2e,
        stations: [
          { id: 'shop', label: 'Counter — buy goods', x: -5, z: -5 },
          { id: 'register', label: 'The register…', x: 5, z: -5 },
        ],
        props: [
          { kind: 'counter', x: 0, z: -7.5 },
          { kind: 'npc', x: 0, z: -9.5, color: 0x2c2c2c },
          { kind: 'shelf', x: -9, z: 1 },
          { kind: 'shelf', x: -9, z: 5 },
          { kind: 'shelf', x: 9, z: 1 },
          { kind: 'shelf', x: 9, z: 5 },
        ],
      };
    case 'pawn':
      return {
        place, title: 'Pawn Shop', w: 26, d: 20, floor: 0x77638a, wall: 0x7a4a9c,
        stations: [{ id: 'gear', label: 'Counter — buy gear', x: 0, z: -4 }],
        props: [
          { kind: 'counter', x: 0, z: -6.5, color: 0x4a3a5a },
          { kind: 'npc', x: 0, z: -8.5, color: 0x9c6a3c },
          { kind: 'shelf', x: -8, z: 0 },
          { kind: 'shelf', x: 8, z: 0 },
        ],
      };
    case 'busdepot':
      return {
        place, title: 'Bus Depot', w: 28, d: 20, floor: 0x8a9aa4, wall: 0x54a8c8,
        stations: [{ id: 'tickets', label: 'Ticket window — destinations', x: 0, z: -4 }],
        props: [
          { kind: 'ticketwindow', x: 0, z: -6.5 },
          { kind: 'npc', x: 0, z: -8.5, color: 0x4a6a8a },
          { kind: 'stool', x: -8, z: 2 }, { kind: 'stool', x: -5.5, z: 2 }, { kind: 'stool', x: -3, z: 2 },
          { kind: 'plant', x: 10, z: 5 },
        ],
      };
  }
}

function homeInterior(place: 'apartment' | 'castle', s: GameState): InteriorDef {
  const castle = place === 'castle';
  const stations: Station[] = [
    { id: 'sleep', label: 'Bed — sleep (ends the day)', x: -8, z: -6 },
    { id: 'messages', label: 'Answering machine', x: 8, z: -6 },
    { id: 'stocks', label: 'Newspaper — stock market', x: 8, z: 2 },
  ];
  if (castle) stations.push({ id: 'campaign', label: 'War room — run for office', x: -14, z: 4 });
  const props: Prop[] = [
    { kind: 'bed', x: -8, z: -8.5, color: hasFurniture(s, 'bed') ? 0x4a6ab0 : 0x6a6a62 },
    { kind: 'table', x: 8, z: -8 },
  ];
  // owned furniture shows up and is usable
  const spots: [number, number][] = [
    [-12, 2], [-12, 6], [-4, 6], [2, 6], [8, 6], [12, 2], [12, -2], [-4, -9],
  ];
  let i = 0;
  for (const f of s.furniture) {
    if (f === 'bed') continue;
    const [x, z] = spots[i++ % spots.length];
    props.push({ kind: f as PropKind, x, z });
    stations.push({ id: `use:${f}`, label: furnitureLabel(f), x, z: z + 2.2 });
  }
  return {
    place,
    title: castle ? 'Your Castle' : s.home === 'bigger' ? 'Bigger Apartment' : 'Your Apartment',
    w: castle ? 40 : s.home === 'bigger' ? 32 : 26,
    d: castle ? 30 : s.home === 'bigger' ? 24 : 20,
    floor: castle ? 0x8a8175 : 0x9a8468,
    wall: castle ? 0x8d939c : 0x8a5a3c,
    stations,
    props,
  };
}

function furnitureLabel(f: string): string {
  switch (f) {
    case 'tv': return 'Behemoth-Vision TV — watch';
    case 'computer': return 'Circuit-Breaking 5000 — browse';
    case 'treadmill': return 'Treadmill — run';
    case 'encyclopedia': return 'Stick-O-Pedia — read';
    case 'satellite': return 'Satellite — surf';
    case 'minibar': return 'Minibar — pour one';
    case 'freezer': return 'Deep Freeze (passive)';
    default: return f;
  }
}

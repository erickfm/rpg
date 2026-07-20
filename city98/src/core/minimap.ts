// Pure map math: project world coordinates (x east, z south) onto a square
// canvas, and name the district you're standing in. No render or world imports —
// the UI feeds in the data and draws the result.

export interface MapView {
  cx: number; // world x at the canvas center
  cz: number; // world z at the canvas center
  span: number; // world units from center to edge
  size: number; // canvas size in pixels
}

export interface MapPoint {
  mx: number;
  my: number;
  inView: boolean;
}

/** World → canvas pixels. North (−z) is up, east (+x) is right. */
export function project(x: number, z: number, v: MapView): MapPoint {
  const s = v.size / 2;
  const mx = s + ((x - v.cx) / v.span) * s;
  const my = s + ((z - v.cz) / v.span) * s;
  return { mx, my, inView: mx >= 0 && mx <= v.size && my >= 0 && my <= v.size };
}

// The 3×3 grid of the city, by the two avenues / two streets at ±road.
const DISTRICTS: string[][] = [
  ['Old Town', 'Datacorp Plaza', 'Ironside'], // north row
  ['Maple Court', 'Downtown', 'Auto Row'], // center row
  ['The Heights', 'Riverside Park', 'Sweetwater'], // south row
];

/** Friendly name of the block containing (x, z). */
export function districtAt(x: number, z: number, road = 38): string {
  const col = x < -road ? 0 : x > road ? 2 : 1;
  const row = z < -road ? 0 : z > road ? 2 : 1;
  return DISTRICTS[row][col];
}

export type PoiKind = 'home' | 'work' | 'food' | 'shop' | 'fun' | 'civic' | 'other';

export const POI_COLOR: Record<PoiKind, string> = {
  home: '#e8c33c',
  work: '#7fb0e0',
  food: '#e07a4a',
  shop: '#c84a9c',
  fun: '#5ad0a0',
  civic: '#c0c8d0',
  other: '#9098a4',
};

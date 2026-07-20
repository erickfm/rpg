// Pure navigation math for waypoints: how far, which way, are we there yet, and
// where to pin an off-screen marker on the minimap's edge. No render imports.

export function distanceTo(px: number, pz: number, tx: number, tz: number): number {
  return Math.hypot(tx - px, tz - pz);
}

export function arrived(px: number, pz: number, tx: number, tz: number, r = 5): boolean {
  return distanceTo(px, pz, tx, tz) <= r;
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Compass = (typeof DIRS)[number];

/** 8-point compass heading from a world delta (dx east, dz south; north is −z). */
export function compass8(dx: number, dz: number): Compass {
  let a = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = N, 90 = E
  a = ((a % 360) + 360) % 360;
  return DIRS[Math.round(a / 45) % 8];
}

/** Slide a point toward (cx,cy) until it lies inside the [min,max] square.
 *  Used to pin an off-map waypoint to the minimap border. Returns the point unchanged if already inside. */
export function clampToBox(
  cx: number, cy: number, x: number, y: number, min: number, max: number,
): [number, number] {
  const dx = x - cx;
  const dy = y - cy;
  let t = 1;
  if (dx > 0) t = Math.min(t, (max - cx) / dx);
  else if (dx < 0) t = Math.min(t, (min - cx) / dx);
  if (dy > 0) t = Math.min(t, (max - cy) / dy);
  else if (dy < 0) t = Math.min(t, (min - cy) / dy);
  t = Math.max(0, Math.min(1, t));
  return [cx + dx * t, cy + dy * t];
}

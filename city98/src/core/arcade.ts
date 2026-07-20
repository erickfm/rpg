import type { Rng } from './rng';

/**
 * "Gutter Racer" — a 3-lane dodge game. Pure, deterministic given an rng, so
 * the stepping and collision are unit-testable; the UI just renders state and
 * feeds input. Distance survived is the score; score buys a small payout.
 */

export const LANES = 3;
export const ROAD_LEN = 20; // obstacles spawn at y=ROAD_LEN, player sits at y=0

export interface Obstacle { lane: number; y: number; }

export interface ArcadeState {
  lane: number; // 0..LANES-1, player's lane
  obstacles: Obstacle[];
  dist: number; // total distance travelled = score basis
  speed: number; // world units/sec obstacles approach
  spawnCooldown: number; // seconds until next spawn
  alive: boolean;
}

export function newArcade(): ArcadeState {
  return { lane: 1, obstacles: [], dist: 0, speed: 7, spawnCooldown: 0.6, alive: true };
}

export type Steer = -1 | 0 | 1;

/** Advance the game by dt seconds. `steer` shifts lanes (one lane per press). */
export function stepArcade(s: ArcadeState, dt: number, steer: Steer, rng: Rng): ArcadeState {
  if (!s.alive) return s;

  const lane = Math.max(0, Math.min(LANES - 1, s.lane + steer));
  const move = s.speed * dt;

  // advance obstacles toward the player (decreasing y)
  let obstacles = s.obstacles.map(o => ({ ...o, y: o.y - move }));

  // collision: an obstacle in the player's lane crossing y≈0
  const crashed = obstacles.some(o => o.lane === lane && o.y <= 0.6 && o.y >= -0.6);

  // cull passed obstacles
  obstacles = obstacles.filter(o => o.y > -1);

  // spawn on cooldown; keep at least one lane open
  let spawnCooldown = s.spawnCooldown - dt;
  if (spawnCooldown <= 0) {
    const blocked = Math.floor(rng() * LANES);
    // spawn obstacles in up to 2 lanes, never all 3
    const count = 1 + (rng() < 0.4 ? 1 : 0);
    const lanes = new Set<number>();
    for (let i = 0; i < count; i++) lanes.add((blocked + i) % LANES);
    for (const l of lanes) obstacles.push({ lane: l, y: ROAD_LEN });
    spawnCooldown = Math.max(0.28, 0.62 - s.dist * 0.0016); // ramps up
  }

  const dist = s.dist + move;
  const speed = 7 + dist * 0.04; // gets faster the longer you last

  return {
    lane,
    obstacles,
    dist,
    speed,
    spawnCooldown,
    alive: !crashed,
  };
}

/** Cash for a run: skill-based, capped so it's fun money not a job. */
export function arcadePayout(dist: number): number {
  return Math.min(60, Math.floor(dist / 12));
}

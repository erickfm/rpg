import { describe, expect, it } from 'vitest';
import { LANES, ROAD_LEN, arcadePayout, newArcade, stepArcade } from './arcade';
import { mulberry32 } from './rng';

const noSteer = 0 as const;

describe('gutter racer', () => {
  it('starts alive in the middle lane', () => {
    const s = newArcade();
    expect(s.alive).toBe(true);
    expect(s.lane).toBe(1);
    expect(s.dist).toBe(0);
  });

  it('steering shifts one lane and clamps to the road', () => {
    let s = newArcade();
    s = stepArcade(s, 0.016, -1, mulberry32(1));
    expect(s.lane).toBe(0);
    s = stepArcade(s, 0.016, -1, mulberry32(1)); // already at edge
    expect(s.lane).toBe(0);
    s = stepArcade({ ...newArcade(), lane: 2 }, 0.016, 1, mulberry32(1));
    expect(s.lane).toBe(2);
  });

  it('accumulates distance and speeds up over time', () => {
    let s = newArcade();
    const startSpeed = s.speed;
    for (let i = 0; i < 200; i++) s = stepArcade(s, 0.05, noSteer, mulberry32(i + 1));
    expect(s.dist).toBeGreaterThan(0);
    expect(s.speed).toBeGreaterThan(startSpeed);
  });

  it('never spawns an impassable wall across all lanes', () => {
    let s = newArcade();
    for (let i = 0; i < 400; i++) {
      s = stepArcade(s, 0.05, noSteer, mulberry32(i * 7 + 3));
      // group obstacles by y-row and ensure no row fills every lane
      const rows = new Map<number, Set<number>>();
      for (const o of s.obstacles) {
        const key = Math.round(o.y);
        if (!rows.has(key)) rows.set(key, new Set());
        rows.get(key)!.add(o.lane);
      }
      for (const lanes of rows.values()) expect(lanes.size).toBeLessThan(LANES);
    }
  });

  it('a crash ends the run and freezes state', () => {
    // force an obstacle right on the player's lane at y≈0
    let s = { ...newArcade(), lane: 1, obstacles: [{ lane: 1, y: 0.5 }] };
    s = stepArcade(s, 0.016, noSteer, mulberry32(1));
    expect(s.alive).toBe(false);
    const frozen = stepArcade(s, 0.5, 1, mulberry32(1));
    expect(frozen).toBe(s); // dead states don't advance
  });

  it('dodging into an open lane survives the same obstacle', () => {
    let s = { ...newArcade(), lane: 1, obstacles: [{ lane: 1, y: 0.5 }] };
    s = stepArcade(s, 0.016, -1, mulberry32(1)); // swerve to lane 0
    expect(s.alive).toBe(true);
    expect(s.lane).toBe(0);
  });

  it('payout scales with distance but is capped', () => {
    expect(arcadePayout(0)).toBe(0);
    expect(arcadePayout(120)).toBe(10);
    expect(arcadePayout(100000)).toBe(60);
    expect(ROAD_LEN).toBeGreaterThan(0);
  });
});

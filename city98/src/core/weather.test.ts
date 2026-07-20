import { describe, expect, it } from 'vitest';
import { isWet, severity, skyForDay, soakDrainPerHour, weatherAt } from './weather';
import { newGame } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('weather', () => {
  it('is deterministic per run and day', () => {
    for (let day = 1; day <= 20; day++) {
      expect(skyForDay(1, day)).toBe(skyForDay(1, day));
    }
    // different seeds diverge somewhere in the first fortnight
    const a = Array.from({ length: 14 }, (_, i) => skyForDay(1, i + 1));
    const b = Array.from({ length: 14 }, (_, i) => skyForDay(999, i + 1));
    expect(a).not.toEqual(b);
  });

  it('produces a spread of conditions over a season', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => skyForDay(7, i + 1)));
    expect(seen.size).toBeGreaterThanOrEqual(3); // not stuck on one sky
  });

  it('clear days never rain; wet days do', () => {
    // find one of each in the first 40 days
    let clearDay = -1;
    let rainDay = -1;
    for (let d = 1; d <= 40; d++) {
      const sky = skyForDay(3, d);
      if (sky === 'clear' && clearDay < 0) clearDay = d;
      if ((sky === 'rain' || sky === 'storm') && rainDay < 0) rainDay = d;
    }
    expect(clearDay).toBeGreaterThan(0);
    expect(rainDay).toBeGreaterThan(0);
    const clearW = weatherAt({ ...fresh(), seed: 3, day: clearDay, minute: 12 * 60 });
    expect(clearW.intensity).toBe(0);
    expect(isWet(clearW)).toBe(false);
    const rainW = weatherAt({ ...fresh(), seed: 3, day: rainDay, minute: 12 * 60 });
    expect(isWet(rainW)).toBe(true);
    expect(rainW.intensity).toBeGreaterThan(0);
  });

  it('intensity peaks midday and eases at the edges', () => {
    // pick a rainy day
    let rainDay = 1;
    for (let d = 1; d <= 40; d++) {
      if (severity(skyForDay(5, d)) >= 2) { rainDay = d; break; }
    }
    const base = { ...fresh(), seed: 5, day: rainDay };
    const midday = weatherAt({ ...base, minute: 12 * 60 }).intensity;
    const dawn = weatherAt({ ...base, minute: 5 * 60 }).intensity;
    expect(midday).toBeGreaterThan(dawn);
  });

  it('rain soaks the unsheltered and spares the covered', () => {
    // find a stormy day for max drain
    let stormDay = 1;
    for (let d = 1; d <= 60; d++) { if (skyForDay(5, d) === 'storm') { stormDay = d; break; } }
    const w = weatherAt({ ...fresh(), seed: 5, day: stormDay, minute: 12 * 60 });
    expect(soakDrainPerHour(w, false)).toBeGreaterThan(0);
    expect(soakDrainPerHour(w, true)).toBe(0);
    // clear weather never soaks
    let clearDay = 1;
    for (let d = 1; d <= 60; d++) { if (skyForDay(5, d) === 'clear') { clearDay = d; break; } }
    const clear = weatherAt({ ...fresh(), seed: 5, day: clearDay, minute: 12 * 60 });
    expect(soakDrainPerHour(clear, false)).toBe(0);
  });

  it('gloom rises with severity', () => {
    expect(severity('storm')).toBeGreaterThan(severity('rain'));
    expect(severity('rain')).toBeGreaterThan(severity('clear'));
  });
});

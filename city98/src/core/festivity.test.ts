import { describe, it, expect } from 'vitest';
import { festivityFor, isNightMinute } from './festivity';

describe('isNightMinute', () => {
  it('is night in the evening and pre-dawn, not midday', () => {
    expect(isNightMinute(22 * 60)).toBe(true);
    expect(isNightMinute(19 * 60)).toBe(true);
    expect(isNightMinute(2 * 60)).toBe(true);
    expect(isNightMinute(12 * 60)).toBe(false);
    expect(isNightMinute(18 * 60)).toBe(false);
  });
});

describe('festivityFor', () => {
  it('runs the Y2K fireworks on New Year\'s Eve night only', () => {
    const eve = festivityFor(14, 22 * 60);
    expect(eve.fireworks).toBe(true);
    expect(eve.festiveLights).toBe(true);
    expect(festivityFor(14, 12 * 60).fireworks).toBe(false); // daytime
  });

  it('lights up other holiday nights without fireworks', () => {
    const harvest = festivityFor(6, 21 * 60);
    expect(harvest.holiday?.name).toBe('Harvest Fair');
    expect(harvest.festiveLights).toBe(true);
    expect(harvest.fireworks).toBe(false);
  });

  it('is quiet on an ordinary day', () => {
    const plain = festivityFor(5, 22 * 60);
    expect(plain.holiday).toBeNull();
    expect(plain.festiveLights).toBe(false);
    expect(plain.fireworks).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { folk, folkFromId, plainFolk, HAIR_STYLES, BUILD_WIDTH } from './folk';
import { mulberry32 } from './rng';

describe('folk archetypes', () => {
  it('is deterministic for a given seed', () => {
    const a = folk(mulberry32(1234));
    const b = folk(mulberry32(1234));
    expect(a).toEqual(b);
  });

  it('stays within valid ranges', () => {
    for (let s = 0; s < 200; s++) {
      const f = folk(mulberry32(s));
      expect([0, 1, 2]).toContain(f.build);
      expect(f.height).toBeGreaterThanOrEqual(0.88);
      expect(f.height).toBeLessThanOrEqual(1.12);
      expect(f.width).toBe(BUILD_WIDTH[f.build]);
      expect(f.hairStyle).toBeGreaterThanOrEqual(0);
      expect(f.hairStyle).toBeLessThan(HAIR_STYLES);
      expect(['pants', 'skirt', 'longcoat']).toContain(f.outfit);
      expect(['none', 'shoulder', 'backpack']).toContain(f.bag);
    }
  });

  it('produces a varied population, not clones', () => {
    const builds = new Set<number>();
    const hair = new Set<number>();
    const outfits = new Set<string>();
    let glasses = 0;
    for (let s = 0; s < 200; s++) {
      const f = folk(mulberry32(s * 97 + 3));
      builds.add(f.build);
      hair.add(f.hairStyle);
      outfits.add(f.outfit);
      if (f.glasses) glasses++;
    }
    expect(builds.size).toBe(3); // all three builds appear
    expect(hair.size).toBe(HAIR_STYLES); // every hairstyle appears
    expect(outfits.size).toBe(3); // pants, skirt, longcoat all appear
    expect(glasses).toBeGreaterThan(10); // a reasonable minority wear glasses
  });

  it('gives a fixed identity a stable archetype', () => {
    expect(folkFromId('gloria')).toEqual(folkFromId('gloria'));
    expect(folkFromId('gloria')).not.toEqual(folkFromId('marcus'));
  });

  it('plainFolk is the neutral average build', () => {
    const p = plainFolk();
    expect(p.build).toBe(1);
    expect(p.width).toBe(1);
    expect(p.height).toBe(1);
    expect(p.outfit).toBe('pants');
  });
});

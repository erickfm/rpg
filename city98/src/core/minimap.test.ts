import { describe, it, expect } from 'vitest';
import { project, districtAt, POI_COLOR, type MapView } from './minimap';

const view: MapView = { cx: 0, cz: 0, span: 110, size: 200 };

describe('minimap projection', () => {
  it('puts the center of the view at the canvas center', () => {
    const p = project(0, 0, view);
    expect(p.mx).toBe(100);
    expect(p.my).toBe(100);
    expect(p.inView).toBe(true);
  });

  it('maps east to the right and south down', () => {
    const east = project(55, 0, view);
    const south = project(0, 55, view);
    expect(east.mx).toBeGreaterThan(100);
    expect(east.my).toBe(100);
    expect(south.my).toBeGreaterThan(100);
    expect(south.mx).toBe(100);
  });

  it('flags points outside the span as not in view', () => {
    expect(project(200, 0, view).inView).toBe(false);
    expect(project(0, -140, view).inView).toBe(false);
    expect(project(50, 50, view).inView).toBe(true);
  });

  it('respects a recentered, zoomed view', () => {
    const v: MapView = { cx: 60, cz: 60, span: 30, size: 100 };
    expect(project(60, 60, v).mx).toBe(50);
    expect(project(60, 60, v).my).toBe(50);
    expect(project(90, 60, v).mx).toBe(100); // one span east = right edge
  });
});

describe('districtAt', () => {
  it('names downtown at the origin', () => {
    expect(districtAt(0, 0)).toBe('Downtown');
  });

  it('names the corners and edges of the 3×3 grid', () => {
    expect(districtAt(-63, 0)).toBe('Maple Court'); // home block, west
    expect(districtAt(0, -63)).toBe('Datacorp Plaza'); // office, north
    expect(districtAt(0, 66)).toBe('Riverside Park'); // park, south
    expect(districtAt(72, -72)).toBe('Ironside'); // warehouse, NE
    expect(districtAt(66, 60)).toBe('Sweetwater'); // donut, SE
  });

  it('splits on the avenues at ±38', () => {
    expect(districtAt(-40, 0)).toBe('Maple Court');
    expect(districtAt(-36, 0)).toBe('Downtown');
    expect(districtAt(40, 0)).toBe('Auto Row');
  });
});

describe('poi colors', () => {
  it('has a distinct color per category', () => {
    const colors = Object.values(POI_COLOR);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

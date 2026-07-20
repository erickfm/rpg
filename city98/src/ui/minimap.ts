import { BUILDINGS, BLOCK_SPANS, ROADS, ROAD_HALF, CITY_HALF, frontOf } from '../world/city';
import { project, districtAt, POI_COLOR, type MapView, type PoiKind } from '../core/minimap';
import { clampToBox } from '../core/nav';

interface Poi { x: number; z: number; label: string; kind: PoiKind; }
export interface Waypoint { x: number; z: number; label: string; }

// Category each named destination falls under (drives the marker color + legend).
const KIND: Record<string, PoiKind> = {
  home: 'home', office: 'work', diner: 'food', donut: 'food', arcade: 'fun',
  records: 'shop', gasshop: 'shop', dealer: 'shop', video: 'shop', copy: 'shop',
  wareh: 'other',
};

const POIS: Poi[] = [
  ...BUILDINGS.filter(b => b.name).map(b => {
    const f = frontOf(b);
    return { x: f.x, z: f.z, label: titleCase(b.name), kind: KIND[b.id] ?? 'other' };
  }),
  { x: 0, z: 66, label: 'Riverside Park', kind: 'fun' },
  { x: -19.3, z: -30, label: 'ATM', kind: 'civic' },
];

const LEGEND: [PoiKind, string][] = [
  ['home', 'Home'], ['work', 'Work'], ['food', 'Food'],
  ['shop', 'Shops'], ['fun', 'Fun'], ['civic', 'Civic'],
];

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

const ROAD = '#31343b';
const GROUND = '#586052';
const GRID = '#20222833';

let mini: HTMLCanvasElement;
let miniCap: HTMLElement;
let wrap: HTMLElement;
let overlay: HTMLElement;
let full: HTMLCanvasElement;
let fullTitle: HTMLElement;
let fullOpen = false;
let waypoint: Waypoint | null = null;
let onPick: (wp: Waypoint) => void = () => {};

const MINI = 158;
const FULL = 380;
const MINI_SPAN = 54; // world units shown from the player to the minimap edge
const WP_COLOR = '#ffd23c';

export function initMinimap(parent: HTMLElement, pick: (wp: Waypoint) => void = () => {}): void {
  onPick = pick;
  wrap = document.createElement('div');
  wrap.id = 'minimap';
  wrap.innerHTML = `
    <div class="mm-title"><span>MAP</span><span class="mm-n">▲ N</span></div>
    <canvas id="minimap-canvas" width="${MINI * 2}" height="${MINI * 2}"></canvas>
    <div class="mm-cap" id="minimap-cap">Downtown</div>
    <div class="mm-hint">TAB — city map</div>`;
  parent.appendChild(wrap);
  mini = wrap.querySelector('#minimap-canvas')!;
  miniCap = wrap.querySelector('#minimap-cap')!;

  overlay = document.createElement('div');
  overlay.id = 'map-overlay';
  overlay.hidden = true;
  const legend = LEGEND.map(([k, l]) => `<span class="mm-key"><i style="background:${POI_COLOR[k]}"></i>${l}</span>`).join('');
  overlay.innerHTML = `
    <div class="map-win">
      <div class="win-title"><span class="win-title-text" id="map-title">CITY 98</span><span></span></div>
      <div class="win-body">
        <canvas id="map-canvas" width="${FULL * 2}" height="${FULL * 2}"></canvas>
        <div class="mm-legend">${legend}</div>
        <div class="mm-foot">TAB or ESC to close</div>
      </div>
    </div>`;
  parent.appendChild(overlay);
  full = overlay.querySelector('#map-canvas')!;
  fullTitle = overlay.querySelector('#map-title')!;

  // click a destination on the full map to set a waypoint
  full.addEventListener('click', e => {
    const rect = full.getBoundingClientRect();
    const cxp = e.clientX - rect.left; // CSS pixels, canvas is FULL css px
    const cyp = e.clientY - rect.top;
    const view: MapView = { cx: 0, cz: 0, span: CITY_HALF + ROAD_HALF, size: FULL };
    let best: Poi | null = null;
    let bestD = 16;
    for (const p of POIS) {
      const m = project(p.x, p.z, view);
      const d = Math.hypot(m.mx - cxp, m.my - cyp);
      if (d < bestD) { best = p; bestD = d; }
    }
    if (best) {
      waypoint = { x: best.x, z: best.z, label: best.label };
      onPick(waypoint);
    }
  });
}

function renderMap(canvas: HTMLCanvasElement, size: number, view: MapView, px: number, pz: number, yaw: number, labels: boolean): void {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.scale(2, 2); // crisp on hidpi (canvas backing store is 2×)
  ctx.clearRect(0, 0, size, size);

  // asphalt base, then lay the blocks over it so roads show through the gaps
  ctx.fillStyle = ROAD;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = GROUND;
  for (const [x1, x2] of BLOCK_SPANS) {
    for (const [z1, z2] of BLOCK_SPANS) {
      const a = project(x1, z1, view);
      const b = project(x2, z2, view);
      ctx.fillRect(a.mx, a.my, b.mx - a.mx, b.my - a.my);
    }
  }
  // road centerlines (dashed lane markings)
  ctx.strokeStyle = '#c8b84a88';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  for (const r of ROADS) {
    ctx.beginPath();
    if (r.axis === 'z') {
      const a = project(r.at, -CITY_HALF, view), b = project(r.at, CITY_HALF, view);
      ctx.moveTo(a.mx, a.my); ctx.lineTo(b.mx, b.my);
    } else {
      const a = project(-CITY_HALF, r.at, view), b = project(CITY_HALF, r.at, view);
      ctx.moveTo(a.mx, a.my); ctx.lineTo(b.mx, b.my);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // POI markers
  ctx.font = '10px Tahoma, sans-serif';
  ctx.textBaseline = 'middle';
  for (const p of POIS) {
    const m = project(p.x, p.z, view);
    if (!m.inView) continue;
    ctx.beginPath();
    ctx.arc(m.mx, m.my, labels ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = POI_COLOR[p.kind];
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#12141a';
    ctx.stroke();
    if (labels) {
      // fan labels to the outward side so the dense downtown cluster stays legible
      const left = p.x < view.cx;
      ctx.textAlign = left ? 'right' : 'left';
      const ox = left ? -7 : 7;
      ctx.fillStyle = '#12141a';
      ctx.fillText(p.label, m.mx + ox, m.my + 1);
      ctx.fillStyle = '#f4f0e4';
      ctx.fillText(p.label, m.mx + ox, m.my);
    }
  }

  // waypoint marker — a gold diamond, pinned to the edge when it's off the minimap
  if (waypoint) {
    const w = project(waypoint.x, waypoint.z, view);
    let wx = w.mx, wy = w.my;
    if (!w.inView) [wx, wy] = clampToBox(size / 2, size / 2, w.mx, w.my, 6, size - 6);
    const s = labels ? 6 : 5;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = WP_COLOR;
    ctx.strokeStyle = '#12141a';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.restore();
    if (labels) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#12141a';
      ctx.fillText(waypoint.label, w.mx, w.my - 12);
      ctx.fillStyle = WP_COLOR;
      ctx.fillText(waypoint.label, w.mx, w.my - 13);
    }
  }

  // player arrow — points where you're facing
  const pm = project(px, pz, view);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // forward in world
  const ang = Math.atan2(fz, fx); // screen space: +x right, +z down
  const r = labels ? 8 : 6;
  ctx.translate(pm.mx, pm.my);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.7, r * 0.62);
  ctx.lineTo(-r * 0.35, 0);
  ctx.lineTo(-r * 0.7, -r * 0.62);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#12141a';
  ctx.stroke();
  ctx.restore();
}

export function drawMinimap(px: number, pz: number, yaw: number): void {
  renderMap(mini, MINI, { cx: px, cz: pz, span: MINI_SPAN, size: MINI }, px, pz, yaw, false);
  miniCap.textContent = districtAt(px, pz);
  if (fullOpen) {
    renderMap(full, FULL, { cx: 0, cz: 0, span: CITY_HALF + ROAD_HALF, size: FULL }, px, pz, yaw, true);
    fullTitle.textContent = `CITY 98 — ${districtAt(px, pz)}`;
  }
}

export function setMinimapVisible(on: boolean): void {
  wrap.hidden = !on;
  if (!on) closeFullMap();
}

export function toggleFullMap(): void {
  fullOpen = !fullOpen;
  overlay.hidden = !fullOpen;
}

export function closeFullMap(): void {
  fullOpen = false;
  overlay.hidden = true;
}

export function isFullMapOpen(): boolean {
  return fullOpen;
}

export function getWaypoint(): Waypoint | null {
  return waypoint;
}

export function setWaypoint(wp: Waypoint | null): void {
  waypoint = wp;
}

export function clearWaypoint(): void {
  waypoint = null;
}

/** Set the waypoint to a named POI (for gig auto-routing and debug hooks). Returns false if unknown. */
export function waypointTo(label: string): boolean {
  const p = POIS.find(poi => poi.label.toLowerCase() === label.toLowerCase());
  if (!p) return false;
  waypoint = { x: p.x, z: p.z, label: p.label };
  return true;
}

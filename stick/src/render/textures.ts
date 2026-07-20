import * as THREE from 'three';

export interface SignOpts {
  bg?: string;
  fg?: string;
  border?: string;
  font?: string;
  width?: number;
  height?: number;
}

/** Crisp canvas-texture signage shared by every facade. */
export function makeSign(text: string, opts: SignOpts = {}): THREE.CanvasTexture {
  const width = opts.width ?? 512;
  const height = opts.height ?? 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.bg ?? 'rgba(15, 17, 24, 0.92)';
  ctx.beginPath();
  ctx.roundRect(6, 6, width - 12, height - 12, 16);
  ctx.fill();
  if (opts.border !== 'none') {
    ctx.strokeStyle = opts.border ?? '#f2d27c';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.fillStyle = opts.fg ?? '#ffffff';
  ctx.font = opts.font ?? `bold ${Math.floor(height * 0.45)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 2, width - 60);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A window grid for towers and apartments; lit-looking panes on a wall color. */
export function makeWindowGrid(
  wall: string,
  cols: number,
  rows: number,
  pane = '#bfe3f2'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 256, 256);
  const cw = 256 / cols;
  const rh = 256 / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = Math.random() < 0.85 ? pane : '#31404e';
      ctx.fillRect(c * cw + cw * 0.22, r * rh + rh * 0.22, cw * 0.56, rh * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(c * cw + cw * 0.22, r * rh + rh * 0.22, cw * 0.56, rh * 0.12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Loose spray-paint scrawl for the convenience store wall. */
export function makeGraffiti(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 256);
  const words: [string, string, number, number, number][] = [
    ['FUNKY', '#e84ac8', 90, 110, -0.08],
    ['5-O', '#4ae8d8', 300, 90, 0.12],
    ['stik gang', '#f2e84a', 210, 200, -0.04],
  ];
  for (const [word, color, x, y, rot] of words) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = 'bold 64px "Comic Sans MS", cursive, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 10;
    ctx.strokeText(word, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(word, 0, 0);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** One die face with the right pip count, for the casino roof dice. */
export function makeDieFace(pips: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f5f5f0';
  ctx.beginPath();
  ctx.roundRect(0, 0, 128, 128, 24);
  ctx.fill();
  const spots: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [[36, 36], [92, 92]],
    3: [[32, 32], [64, 64], [96, 96]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
    6: [[36, 32], [92, 32], [36, 64], [92, 64], [36, 96], [92, 96]],
  };
  ctx.fillStyle = '#16181f';
  for (const [x, y] of spots[pips] ?? []) {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

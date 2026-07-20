import * as THREE from 'three';

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type SignStyle = 'block' | 'neon' | 'script' | 'plain';

/** Era-appropriate shop signage. */
export function makeSign(text: string, style: SignStyle, bg: string, fg: string): THREE.CanvasTexture {
  return canvasTex(512, 128, ctx => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    switch (style) {
      case 'block':
        ctx.font = '900 64px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = fg;
        ctx.fillText(text, 256, 68, 480);
        break;
      case 'neon':
        ctx.font = 'bold 62px Impact, sans-serif';
        ctx.shadowColor = fg;
        ctx.shadowBlur = 22;
        ctx.fillStyle = fg;
        ctx.fillText(text, 256, 68, 480);
        ctx.shadowBlur = 0;
        break;
      case 'script':
        ctx.font = 'italic bold 58px Georgia, serif';
        ctx.fillStyle = fg;
        ctx.fillText(text, 256, 66, 480);
        break;
      case 'plain':
        ctx.font = 'bold 52px Helvetica, Arial, sans-serif';
        ctx.fillStyle = fg;
        ctx.fillText(text, 256, 66, 480);
        break;
    }
  });
}

/**
 * A window grid used with `emissiveMap` so panes glow warmly at night.
 * The wall itself is drawn dark so only panes emit.
 */
export function makeWindowGrid(
  wall: string,
  cols: number,
  rows: number,
  litChance = 0.55,
  pane = '#274050'
): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const draw = (emissivePass: boolean) => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = emissivePass ? '#000' : wall;
    ctx.fillRect(0, 0, 256, 256);
    const cw = 256 / cols;
    const rh = 256 / rows;
    let n = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // deterministic per-pane "randomness"
        const lit = ((n * 2654435761) >>> 13) % 100 < litChance * 100;
        n++;
        const x = c * cw + cw * 0.2;
        const y = r * rh + rh * 0.22;
        const w = cw * 0.6;
        const h = rh * 0.5;
        if (emissivePass) {
          ctx.fillStyle = lit ? '#ffd9a0' : '#000';
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.fillStyle = pane;
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(x, y, w, h * 0.22);
        }
      }
    }
  };
  return {
    map: canvasTex(256, 256, draw(false)),
    emissive: canvasTex(256, 256, draw(true)),
  };
}

/** Simple storefront glass with a reflection streak and a door. */
export function makeShopfront(accent: string): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const draw = (emissivePass: boolean) => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = emissivePass ? '#000' : '#20323e';
    ctx.fillRect(0, 0, 512, 256);
    // glass panes
    for (let i = 0; i < 4; i++) {
      const x = 14 + i * 124;
      if (emissivePass) {
        ctx.fillStyle = i === 1 ? '#ffe2b0' : '#3c2f18';
        ctx.fillRect(x, 30, 108, 196);
      } else {
        ctx.fillStyle = '#2c4454';
        ctx.fillRect(x, 30, 108, 196);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(x + 10, 226);
        ctx.lineTo(x + 60, 30);
        ctx.lineTo(x + 88, 30);
        ctx.lineTo(x + 38, 226);
        ctx.fill();
      }
      ctx.strokeStyle = emissivePass ? '#000' : accent;
      ctx.lineWidth = 8;
      ctx.strokeRect(x, 30, 108, 196);
    }
  };
  return {
    map: canvasTex(512, 256, draw(false)),
    emissive: canvasTex(512, 256, draw(true)),
  };
}

/** Striped awning canvas. */
export function makeAwning(color: string): THREE.CanvasTexture {
  return canvasTex(256, 64, ctx => {
    ctx.fillStyle = '#f0ead8';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = color;
    for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 16, 64);
  });
}

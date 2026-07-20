import * as THREE from 'three';
import type { BuildingDef } from '../world/city';
import { makeAwning, makeShopfront, makeSign, makeWindowGrid } from './textures';

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

export interface BuildingBuild {
  group: THREE.Group;
  /** window materials whose emissiveIntensity ramps up at night */
  nightMats: THREE.MeshLambertMaterial[];
}

function windowMat(
  wall: string,
  cols: number,
  rows: number,
  nightMats: THREE.MeshLambertMaterial[],
  litChance = 0.55
): THREE.MeshLambertMaterial {
  const { map, emissive } = makeWindowGrid(wall, cols, rows, litChance);
  const mat = new THREE.MeshLambertMaterial({
    map,
    emissive: 0xffc98a,
    emissiveMap: emissive,
    emissiveIntensity: 0,
  });
  nightMats.push(mat);
  return mat;
}

function shopfrontMat(accent: string, nightMats: THREE.MeshLambertMaterial[]): THREE.MeshLambertMaterial {
  const { map, emissive } = makeShopfront(accent);
  const mat = new THREE.MeshLambertMaterial({
    map,
    emissive: 0xffd9a0,
    emissiveMap: emissive,
    emissiveIntensity: 0,
  });
  nightMats.push(mat);
  return mat;
}

/**
 * Buildings are built in local space facing +z, then rotated to their world
 * facing. `fw` is the width of the street-facing wall, `fd` the depth.
 */
export function buildBuilding(b: BuildingDef): BuildingBuild {
  const nightMats: THREE.MeshLambertMaterial[] = [];
  const g = new THREE.Group();
  const fw = b.face === 'n' || b.face === 's' ? b.w : b.d;
  const fd = b.face === 'n' || b.face === 's' ? b.d : b.w;

  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const frontPlane = (w: number, h: number, mat: THREE.Material, y: number, off = 0.05, x = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, fd / 2 + off);
    g.add(m);
    return m;
  };
  const cap = (h: number, color: number, inset = 0): void => {
    box(fw + 0.4 - inset, 0.5, fd + 0.4 - inset, lambert(color), 0, h + 0.2, 0);
  };
  const signBoard = (tex: THREE.CanvasTexture, w: number, h: number, y: number, off = 0.12): void => {
    frontPlane(w, h, new THREE.MeshBasicMaterial({ map: tex, transparent: true }), y, off);
  };
  const door = (x: number, w = 1.6, h = 2.6): void => {
    frontPlane(w + 0.5, h + 0.3, lambert(0x3a3630), h / 2 + 0.1, 0.04, x);
    frontPlane(w, h, lambert(0x22201c), h / 2, 0.06, x);
  };

  const dark = new THREE.Color(b.color).multiplyScalar(0.55).getHex();

  switch (b.kind) {
    case 'storefront': {
      box(fw, b.h, fd, lambert(b.color), 0, b.h / 2, 0);
      cap(b.h, dark);
      frontPlane(fw - 2, 3.1, shopfrontMat(hex(b.trim), nightMats), 1.85, 0.06);
      // striped awning
      const awning = new THREE.Mesh(
        new THREE.PlaneGeometry(fw - 1.6, 1.7),
        new THREE.MeshLambertMaterial({ map: makeAwning(hex(b.trim)), side: THREE.DoubleSide })
      );
      awning.position.set(0, 4.05, fd / 2 + 0.75);
      awning.rotation.x = 0.55;
      awning.castShadow = true;
      g.add(awning);
      const style = b.id === 'arcade' ? 'neon' : 'block';
      signBoard(makeSign(b.name, style, hex(dark), b.id === 'arcade' ? '#ff6ad5' : '#f2ead0'), fw - 3, 1.9, b.h - 1.2);
      break;
    }
    case 'diner': {
      box(fw, b.h, fd, lambert(b.color), 0, b.h / 2, 0);
      cap(b.h, b.trim);
      // wraparound glass band
      frontPlane(fw - 1.6, 2.0, windowMat(hex(b.color), 6, 1, nightMats, 0.9), 2.1, 0.06);
      door(-fw / 2 + 2.4);
      // roadside pylon sign
      const pole = box(0.3, 6.4, 0.3, lambert(0x8a8e96), fw / 2 - 1, 3.2, fd / 2 + 2.2);
      pole.castShadow = true;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 2.2, 0.3),
        lambert(0xf0ead8)
      );
      panel.position.set(fw / 2 - 1, 7.2, fd / 2 + 2.2);
      panel.castShadow = true;
      g.add(panel);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 2.0),
        new THREE.MeshBasicMaterial({ map: makeSign(b.name, 'script', '#f0ead8', '#c84848') })
      );
      face.position.set(fw / 2 - 1, 7.2, fd / 2 + 2.38);
      g.add(face);
      break;
    }
    case 'office': {
      const wm = windowMat(hex(b.color), 7, 12, nightMats, 0.4);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(fw, b.h, fd), [
        wm, wm, lambert(dark) as THREE.Material, lambert(dark), wm, wm,
      ] as THREE.Material[]);
      tower.position.y = b.h / 2;
      tower.castShadow = true;
      tower.receiveShadow = true;
      g.add(tower);
      cap(b.h, 0x3c4048);
      // mechanical penthouse + antenna
      box(8, 2.4, 6, lambert(0x4a4e55), -4, b.h + 1.2, -2);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7), lambert(0x2c2e33));
      ant.position.set(6, b.h + 3.5, 4);
      g.add(ant);
      // lobby
      frontPlane(9, 3.4, shopfrontMat(hex(b.trim), nightMats), 1.9, 0.07);
      box(10, 0.6, 1.2, lambert(0x3c4048), 0, 3.9, fd / 2 + 0.4);
      signBoard(makeSign(b.name, 'plain', '#2c3038', '#cfe0ec'), 10, 1.6, 5.2, 0.14);
      break;
    }
    case 'apartment': {
      box(fw, b.h, fd, lambert(b.color), 0, b.h / 2, 0);
      cap(b.h, dark);
      // cornice
      box(fw + 0.6, 0.6, fd + 0.6, lambert(b.trim), 0, b.h - 0.6, 0);
      frontPlane(fw - 3, b.h - 7, windowMat(hex(b.color), 4, 4, nightMats), b.h / 2 + 2.2, 0.06);
      // stoop
      box(4, 0.5, 2.2, lambert(0xa8a296), 0, 0.25, fd / 2 + 1.0);
      box(4.6, 0.25, 3.0, lambert(0xa8a296), 0, 0.05, fd / 2 + 1.4);
      door(0, 2.0, 2.9);
      signBoard(makeSign(b.name, 'plain', hex(dark), '#f0e6d2'), 7, 1.4, 4.6);
      break;
    }
    case 'gas': {
      box(fw, b.h, fd, lambert(b.color), 0, b.h / 2, 0);
      cap(b.h, b.trim);
      frontPlane(fw - 2, 2.4, shopfrontMat(hex(b.trim), nightMats), 1.5, 0.06);
      signBoard(makeSign(b.name, 'block', '#b82c2c', '#fff2d8'), fw - 4, 1.7, b.h - 0.9);
      break;
    }
    case 'house': {
      box(fw, b.h - 2.5, fd, lambert(b.color), 0, (b.h - 2.5) / 2, 0);
      // hip roof (rotate the pyramid inside a scaled wrapper)
      const roofCone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), lambert(b.trim));
      roofCone.rotation.y = Math.PI / 4;
      roofCone.castShadow = true;
      const roof = new THREE.Group();
      roof.add(roofCone);
      roof.scale.set((fw / 2 + 0.8) * Math.SQRT2, 2.8, (fd / 2 + 0.8) * Math.SQRT2);
      roof.position.y = b.h - 2.5 + 1.4;
      g.add(roof);
      const chimney = box(0.8, 2.2, 0.8, lambert(dark), fw / 4, b.h - 1.4, -fd / 4);
      chimney.castShadow = true;
      door(-fw / 4);
      frontPlane(2.2, 1.6, windowMat(hex(b.color), 2, 1, nightMats, 0.7), 2.2, 0.06, fw / 5);
      break;
    }
    case 'warehouse': {
      box(fw, b.h, fd, lambert(b.color), 0, b.h / 2, 0);
      cap(b.h, dark);
      // roll-up doors
      for (const x of [-fw / 4, fw / 4]) {
        frontPlane(6, 5, lambert(0x9aa0a8), 2.5, 0.06, x);
        frontPlane(6.4, 0.5, lambert(dark), 5.3, 0.07, x);
      }
      if (b.name) signBoard(makeSign(b.name, 'plain', '#3a3e44', '#c8ccd2'), 14, 2, b.h - 1.6);
      break;
    }
    case 'strip': {
      box(fw, b.h, fd, lambert(b.color), 0, b.h / 2, 0);
      cap(b.h, dark);
      frontPlane(fw - 2, 2.4, shopfrontMat(hex(b.trim), nightMats), 1.5, 0.06);
      signBoard(makeSign(b.name, 'block', hex(b.trim), '#fdf6e4'), fw - 2, 1.6, b.h - 0.9);
      break;
    }
  }

  const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[b.face];
  g.rotation.y = rot;
  g.position.set(b.x, 0, b.z);
  return { group: g, nightMats };
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { InteriorDef, Prop } from '../world/interiors';
import { exitSpot } from '../world/interiors';
import { makeSign } from './textures';
import { StickMan } from './stickman';

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

const WALL_H = 9;

/** Build a walkable room for an interior definition. */
export function buildInterior(def: InteriorDef): THREE.Group {
  const g = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.d), lambert(def.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // back and side walls full height; the south (camera-side) wall stays a low rail
  const wallMat = lambert(def.wall);
  const walls: [number, number, number, number, number][] = [
    // w, h, x, z, rotY
    [def.w, WALL_H, 0, -def.d / 2, 0],
    [def.d, WALL_H, -def.w / 2, 0, Math.PI / 2],
    [def.d, WALL_H, def.w / 2, 0, -Math.PI / 2],
  ];
  for (const [w, h, x, z, rotY] of walls) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    wall.position.set(x, h / 2, z);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    g.add(wall);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(def.w, 1, 0.5), wallMat);
  rail.position.set(0, 0.5, def.d / 2);
  g.add(rail);

  // baseboard trim, a shade darker than the wall
  const trimColor = new THREE.Color(def.wall).multiplyScalar(0.55);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(def.w, 0.4, 0.3),
    new THREE.MeshLambertMaterial({ color: trimColor })
  );
  trim.position.set(0, 0.2, -def.d / 2 + 0.2);
  g.add(trim);

  // exit mat by the south wall
  const exit = exitSpot(def);
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xf58a7a, transparent: true, opacity: 0.55 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(exit.x, 0.06, exit.z);
  g.add(pad);

  // station pads (kept above the rugs to avoid z-fighting)
  for (const st of def.stations) {
    const sPad = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5 })
    );
    sPad.rotation.x = -Math.PI / 2;
    sPad.position.set(st.x, 0.06, st.z);
    g.add(sPad);
  }

  for (const prop of def.props) g.add(buildProp(prop));

  // title plate on the back wall + room light
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2),
    new THREE.MeshBasicMaterial({ map: makeSign(def.title, { border: 'none' }), transparent: true })
  );
  plate.position.set(0, WALL_H - 1.6, -def.d / 2 + 0.06);
  g.add(plate);

  const light = new THREE.PointLight(0xfff2dd, 500, 80, 2);
  light.position.set(0, WALL_H - 1, 0);
  g.add(light);

  return g;
}

function box(w: number, h: number, d: number, color: number, x: number, z: number, rot = 0): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.25, h / 4)), lambert(color));
  m.position.set(x, h / 2, z);
  m.rotation.y = rot;
  m.castShadow = true;
  return m;
}

function buildProp(p: Prop): THREE.Object3D {
  const rot = p.rot ?? 0;
  switch (p.kind) {
    case 'counter':
      return box(10, 2.6, 1.8, p.color ?? 0x6a5138, p.x, p.z, rot);
    case 'bigdesk':
      return box(7, 2.4, 2.6, p.color ?? 0x5a4432, p.x, p.z, rot);
    case 'desk':
      return box(4.4, 2.2, 2.2, p.color ?? 0x7a6a54, p.x, p.z, rot);
    case 'table': {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.3, 16), lambert(p.color ?? 0x8a6a48));
      top.position.y = 1.9;
      top.castShadow = true;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.9, 8), lambert(0x4a3a2a));
      leg.position.y = 0.95;
      g.add(top, leg);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'stool': {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 12), lambert(0xa03030));
      seat.position.y = 1.4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), lambert(0x333338));
      leg.position.y = 0.7;
      g.add(seat, leg);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'rug': {
      const rug = new THREE.Mesh(new THREE.CircleGeometry(4.5, 28), lambert(p.color ?? 0x7a3030));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(p.x, 0.02, p.z);
      rug.receiveShadow = true;
      return rug;
    }
    case 'plant': {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 1, 10), lambert(0xa05a3c));
      pot.position.y = 0.5;
      const bush = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), lambert(0x3c7a3c));
      bush.position.y = 1.9;
      bush.castShadow = true;
      g.add(pot, bush);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'bed': {
      const g = new THREE.Group();
      g.add(box(3.2, 1.2, 5.4, 0x8a7a5a, 0, 0));
      const mattress = box(3, 0.6, 5, p.color ?? 0x4a6ab0, 0, 0);
      mattress.position.y = 1.5;
      g.add(mattress);
      const pillow = box(2.2, 0.5, 1.2, 0xf2f2ea, 0, -1.8);
      pillow.position.y = 1.95;
      g.add(pillow);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = rot;
      return g;
    }
    case 'sofa': {
      const g = new THREE.Group();
      g.add(box(5.5, 1.4, 2.2, 0x6a4a8a, 0, 0));
      const back = box(5.5, 1.6, 0.6, 0x6a4a8a, 0, -0.9);
      back.position.y = 1.9;
      g.add(back);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'tv': {
      const g = new THREE.Group();
      g.add(box(1.6, 2, 1.6, 0x3a3a40, 0, 0));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), new THREE.MeshBasicMaterial({ color: 0x8ad4f5 }));
      screen.position.set(0, 3, 0.1);
      g.add(screen);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'computer': {
      const g = new THREE.Group();
      g.add(box(3, 2.2, 1.8, 0x7a6a54, 0, 0));
      const monitor = box(1.4, 1.2, 0.8, 0xd8d8d0, 0, 0);
      monitor.position.y = 2.9;
      g.add(monitor);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ color: 0x5af57a }));
      glow.position.set(0, 2.9, 0.42);
      g.add(glow);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'treadmill': {
      const g = new THREE.Group();
      g.add(box(1.6, 0.5, 3.6, 0x3a3a40, 0, 0));
      const rail = box(1.4, 2.4, 0.3, 0x8a8f99, 0, -1.6);
      g.add(rail);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'minibar': {
      const g = new THREE.Group();
      g.add(box(3.4, 2.6, 1.6, 0x4a3826, 0, 0));
      for (let i = 0; i < 3; i++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8), lambert([0x3c8a3c, 0xa03030, 0xd8a83c][i]));
        bottle.position.set(-0.8 + i * 0.8, 3.05, 0);
        g.add(bottle);
      }
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'freezer':
      return box(2.4, 3.4, 2.2, 0xd8e2e8, p.x, p.z, rot);
    case 'satellite': {
      const g = new THREE.Group();
      g.add(box(1.8, 1.4, 1.8, 0x3a3a40, 0, 0));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), lambert(0xd8d8d0));
      dish.rotation.x = Math.PI / 3.2;
      dish.position.y = 2.2;
      g.add(dish);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'encyclopedia': {
      const g = new THREE.Group();
      g.add(box(2.8, 3.4, 1, 0x6a4a2a, 0, 0));
      for (let i = 0; i < 4; i++) {
        const book = box(0.5, 0.8, 0.7, [0xa03030, 0x3c6aa0, 0x3c8a3c, 0xd8a83c][i], -0.9 + i * 0.6, 0);
        book.position.y = 2.4 + (i % 2) * 0.05;
        g.add(book);
      }
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'slotmachine': {
      const g = new THREE.Group();
      g.add(box(1.8, 3.2, 1.4, 0xa02838, 0, 0));
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1),
        new THREE.MeshBasicMaterial({ map: makeSign('7 7 7', { bg: '#111', fg: '#f2c84a', border: 'none', width: 128, height: 96 }) })
      );
      face.position.set(0, 2.4, 0.74);
      g.add(face);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4), lambert(0xd8d8d0));
      arm.position.set(1.05, 2.6, 0);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22), lambert(0xd03030));
      knob.position.set(1.05, 3.3, 0);
      g.add(arm, knob);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.rot ?? 0;
      return g;
    }
    case 'cardtable': {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 24), lambert(0x1e6a40));
      top.position.y = 1.9;
      top.castShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 8, 24), lambert(0x5a4432));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 2.1;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.9, 10), lambert(0x4a3a2a));
      leg.position.y = 0.95;
      g.add(top, rim, leg);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'roulettetable': {
      const g = new THREE.Group();
      g.add(box(6, 2, 3.4, 0x1e6a40, 0, 0));
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.5, 24), lambert(0x5a4432));
      wheel.position.set(-1.6, 2.3, 0);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.55, 24), lambert(0xa02838));
      inner.position.set(-1.6, 2.32, 0);
      g.add(wheel, inner);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'dartboard': {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 20), lambert(0x8a2323));
      board.rotation.x = Math.PI / 2;
      board.position.y = 4.4;
      const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12), lambert(0xf2e84a));
      bull.rotation.x = Math.PI / 2;
      bull.position.set(0, 4.4, 0.02);
      g.add(board, bull);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'vaultdoor': {
      const g = new THREE.Group();
      const door = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 24), lambert(0x8a8f99));
      door.rotation.x = Math.PI / 2;
      door.position.y = 3;
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12), lambert(0x4a4e58));
      dial.rotation.x = Math.PI / 2;
      dial.position.set(0, 3, 0.4);
      g.add(door, dial);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'jukebox': {
      const g = new THREE.Group();
      g.add(box(2.4, 3.6, 1.6, 0xa05a28, 0, 0));
      const glow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 20, Math.PI), new THREE.MeshBasicMaterial({ color: 0x5af5d0 }));
      glow.position.set(0, 3.4, 0.82);
      g.add(glow);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'blackboard': {
      const g = new THREE.Group();
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 3.4),
        new THREE.MeshBasicMaterial({ map: makeSign('E = mc² · x = −b ± √(b²−4ac) / 2a', { bg: '#2c3c34', fg: '#e8e8dc', border: '#7a5a3a', font: '30px "Comic Sans MS", cursive' }) })
      );
      board.position.y = 4.4;
      g.add(board);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'weights': {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6), lambert(0x8a8f99));
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.2;
      for (const off of [-1.5, 1.5]) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 16), lambert(0x2c2c34));
        plate.rotation.z = Math.PI / 2;
        plate.position.set(off, 1.2, 0);
        g.add(plate);
      }
      const rack = box(4.2, 1, 1.2, 0x4a4e58, 0, 0);
      g.add(bar, rack);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'ticketwindow': {
      const g = new THREE.Group();
      g.add(box(8, 2.6, 1.6, 0x4a6a8a, 0, 0));
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), new THREE.MeshLambertMaterial({ color: 0xb8d8e8, transparent: true, opacity: 0.7 }));
      glass.position.set(0, 4, 0);
      g.add(glass);
      g.position.set(p.x, 0, p.z);
      return g;
    }
    case 'shelf': {
      const g = new THREE.Group();
      g.add(box(1.4, 4.2, 6, 0x8a7a5a, 0, 0));
      for (let level = 0; level < 3; level++) {
        for (let i = 0; i < 3; i++) {
          const item = box(0.7, 0.7, 1.2, [0xd03030, 0x3c8a3c, 0xd8a83c, 0x3c6aa0][(level + i) % 4], 0, -1.8 + i * 1.8);
          item.position.y = 1.2 + level * 1.3;
          g.add(item);
        }
      }
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.rot ?? 0;
      return g;
    }
    case 'npc': {
      const npc = new StickMan(p.color ?? 0x8a8f99);
      npc.group.position.set(p.x, 0, p.z);
      npc.group.rotation.y = Math.PI; // face the room
      npc.update(0.016, 0);
      return npc.group;
    }
  }
}

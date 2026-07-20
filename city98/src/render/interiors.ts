import * as THREE from 'three';
import { ROOMS, ROOM_ORIGIN, type RoomDef, type RoomProp } from '../world/interiors';
import { makeSign } from './textures';
import { makeAvatar, type PersonMesh } from './people';
import { SHIRT_COLORS, HAIR_COLORS, SKIN_COLORS, type Appearance } from '../core/appearance';

const lambert = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const CHROME = lambert(0xc8ccd2);
const DARKWOOD = lambert(0x5a4432);

function checkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#c8332f' : '#e8e4d8';
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tapeShelfTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3a3026';
  ctx.fillRect(0, 0, 256, 128);
  const colors = ['#c84a4a', '#4a6ac8', '#4ac86a', '#e8c33c', '#c84a9c', '#3cc8c8', '#e8e4d8'];
  for (let row = 0; row < 2; row++) {
    let x = 4;
    while (x < 250) {
      const w = 6 + Math.floor(Math.random() * 8);
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(x, 8 + row * 62, w, 50);
      x += w + 2;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildProp(p: RoomProp, room: RoomDef): THREE.Object3D {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material, y: number, x = 0, z = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };

  switch (p.kind) {
    case 'counter':
      box(7.8, 1.0, 1.2, lambert(0xc84848), 0.5);
      box(8.0, 0.1, 1.4, CHROME, 1.05);
      break;
    case 'stool': {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10), lambert(0xc84848));
      seat.position.y = 0.72;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), CHROME);
      leg.position.y = 0.35;
      g.add(seat, leg);
      break;
    }
    case 'booth': {
      box(2.4, 0.5, 1.0, lambert(0xc84848), 0.25, 0, -1.0);
      box(2.4, 1.1, 0.25, lambert(0xc84848), 0.55, 0, -1.5);
      box(2.4, 0.5, 1.0, lambert(0xc84848), 0.25, 0, 1.0);
      box(2.4, 1.1, 0.25, lambert(0xc84848), 0.55, 0, 1.5);
      box(2.0, 0.08, 1.0, lambert(0xe8e4d8), 0.78);
      const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.78, 8), CHROME);
      tleg.position.y = 0.39;
      g.add(tleg);
      break;
    }
    case 'coffeemaker':
      box(0.9, 0.6, 0.5, lambert(0x2c2c30), 1.35);
      box(0.3, 0.25, 0.3, lambert(0xd8d5cc), 1.18, 0.15, 0.05);
      break;
    case 'shelf': {
      box(5.2, 1.9, 0.8, DARKWOOD, 0.95);
      const tex = tapeShelfTexture();
      for (const side of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.6), new THREE.MeshLambertMaterial({ map: tex }));
        face.position.set(0, 1.0, side * 0.42);
        if (side < 0) face.rotation.y = Math.PI;
        g.add(face);
      }
      break;
    }
    case 'register':
      box(2.0, 1.0, 1.0, DARKWOOD, 0.5);
      box(0.5, 0.35, 0.4, lambert(0xb8b0a0), 1.15, -0.4);
      break;
    case 'standee': {
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.9),
        new THREE.MeshLambertMaterial({ map: makeSign('SPACE COP 3', 'block', '#1c2c5a', '#e8e4d8') })
      );
      face.position.y = 0.95;
      g.add(face);
      break;
    }
    case 'cabinet': {
      box(1.0, 1.8, 0.8, lambert(0x2c2c34), 0.9);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.55),
        new THREE.MeshBasicMaterial({ color: p.color ?? 0x3cc8c8 })
      );
      screen.position.set(0, 1.25, 0.41);
      screen.rotation.x = -0.15;
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: p.color ?? 0xc84a9c }));
      marquee.position.set(0, 1.92, 0.1);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.5), lambert(0x4a4a54));
      panel.position.set(0, 0.95, 0.5);
      g.add(screen, marquee, panel);
      break;
    }
    case 'bed':
      box(2.0, 0.35, 3.0, DARKWOOD, 0.2);
      box(1.9, 0.25, 2.9, lambert(0x4a6ab0), 0.48);
      box(1.6, 0.18, 0.7, lambert(0xe8e4d8), 0.62, 0, -1.0);
      break;
    case 'nightstand': {
      box(0.8, 0.7, 0.8, DARKWOOD, 0.35);
      // the answering machine, blinking since 1996
      box(0.4, 0.12, 0.3, lambert(0x2c2c30), 0.78);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
      led.position.set(0.12, 0.85, 0.1);
      g.add(led);
      break;
    }
    case 'tv':
      box(1.2, 0.5, 0.9, DARKWOOD, 0.25); // milk-crate-ish stand
      box(1.1, 0.9, 0.9, lambert(0x3a3a40), 0.95);
      {
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0x87a8c8 }));
        screen.position.set(0, 0.98, 0.46);
        g.add(screen);
      }
      break;
    case 'fridge':
      box(1.0, 2.0, 1.0, lambert(0xd8d5cc), 1.0);
      box(0.08, 0.5, 0.08, CHROME, 1.3, 0.44, 0.5);
      break;
    case 'jukebox': {
      box(1.2, 1.5, 0.8, lambert(0x8a4f2f), 0.75);
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 12, 1, false, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xe8c33c }));
      arch.rotation.z = Math.PI / 2;
      arch.rotation.y = Math.PI / 2;
      arch.position.y = 1.5;
      g.add(arch);
      break;
    }
    case 'rug': {
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), lambert(0x8a3c3c));
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.02;
      g.add(rug);
      break;
    }
    case 'poster': {
      const text =
        room.place === 'video' ? 'BE KIND · REWIND' :
        room.place === 'arcade' ? 'HIGH SCORES' :
        room.place === 'office' ? 'DATACORP' : 'EAT';
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 1.6),
        new THREE.MeshBasicMaterial({ map: makeSign(text, 'block', '#20242c', `#${(p.color ?? 0xe8e4d8).toString(16).padStart(6, '0')}`) })
      );
      face.position.y = 1.7;
      g.add(face);
      break;
    }
    case 'stereo': {
      box(1.1, 0.7, 0.5, lambert(0x2c2c30), 0.55);
      // two speakers
      for (const sx of [-0.75, 0.75]) box(0.4, 0.9, 0.4, lambert(0x1c1c20), 0.45, sx);
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0x40ff80 }));
      dial.position.set(-0.25, 0.7, 0.26);
      const dial2 = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xff8040 }));
      dial2.position.set(0.0, 0.7, 0.26);
      g.add(dial, dial2);
      break;
    }
    case 'crate': {
      box(0.9, 0.7, 0.9, DARKWOOD, 0.35);
      // record spines poking up
      const spineColors = [0xc84a4a, 0x4a6ac8, 0x4ac86a, 0xe8c33c, 0xc84a9c];
      for (let i = 0; i < 5; i++) {
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.04), lambert(spineColors[i]));
        spine.position.set(0, 0.7, -0.3 + i * 0.14);
        spine.rotation.x = -0.1;
        g.add(spine);
      }
      break;
    }
    case 'lavalamp': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 10), lambert(0x8a8e96));
      base.position.y = 0.1;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.6, 12), new THREE.MeshBasicMaterial({ color: 0xff5aa0 }));
      glass.position.y = 0.5;
      g.add(base, glass);
      break;
    }
    case 'houseplant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 10), lambert(0xc86a4a));
      pot.position.y = 0.2;
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 5), new THREE.MeshLambertMaterial({ color: 0x3c8a4c }));
        leaf.position.set(Math.cos(i) * 0.12, 0.7, Math.sin(i) * 0.12);
        leaf.rotation.z = Math.cos(i) * 0.4;
        leaf.rotation.x = Math.sin(i) * 0.4;
        g.add(leaf);
      }
      g.add(pot);
      break;
    }
    case 'couch': {
      box(3.4, 0.7, 1.3, lambert(0x6a5a8c), 0.35);
      box(3.4, 0.7, 0.3, lambert(0x6a5a8c), 0.75, 0, -0.5);
      for (const sx of [-1.6, 1.6]) box(0.3, 0.9, 1.3, lambert(0x5a4a7c), 0.45, sx);
      break;
    }
    case 'window': {
      // a big picture window with a low-poly city skyline beyond
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 4.4), lambert(0x4a4038));
      frame.position.y = 2.0;
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.9), new THREE.MeshBasicMaterial({ color: 0x2a3a5c }));
      sky.position.set(0.1, 2.0, 0);
      sky.rotation.y = Math.PI / 2;
      g.add(frame, sky);
      // skyline silhouette (generic boxes) + a few lit windows
      const rng2 = ((room.place.charCodeAt(0) * 131) % 97);
      for (let i = 0; i < 9; i++) {
        const h = 0.6 + ((i * 37 + rng2) % 10) / 10 * 1.1;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.32), lambert(0x12203a));
        b.position.set(0.12, 1.05 + h / 2, -1.8 + i * 0.42);
        g.add(b);
        if ((i * 7) % 3 === 0) {
          const lit = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
          lit.position.set(0.18, 1.2 + (i % 3) * 0.2, -1.8 + i * 0.42);
          lit.rotation.y = Math.PI / 2;
          g.add(lit);
        }
      }
      break;
    }
    case 'mirror': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.9), lambert(0x6a533f));
      frame.position.y = 1.4;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.5), new THREE.MeshBasicMaterial({ color: 0x8faab8 }));
      glass.position.set(0.08, 1.4, 0);
      glass.rotation.y = Math.PI / 2;
      g.add(frame, glass);
      break;
    }
    case 'reception':
      box(4.2, 1.1, 1.2, lambert(0x6a5a48), 0.55);
      box(4.4, 0.08, 1.4, CHROME, 1.14);
      break;
    case 'elevator': {
      for (const side of [-0.85, 0.85]) {
        box(1.4, 2.4, 0.3, CHROME, 1.2, side, 0);
      }
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.32), lambert(0x2c2e33));
      crack.position.set(0, 1.2, 0);
      g.add(crack);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.1), lambert(0x2c2e33));
      panel.position.set(1.9, 1.3, 0.1);
      const btn = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xffc040 }));
      btn.position.set(1.9, 1.35, 0.16);
      g.add(panel, btn);
      break;
    }
    case 'plant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 10), lambert(0x8a4a3a));
      pot.position.y = 0.25;
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshLambertMaterial({ color: 0x3c7a3c }));
      bush.position.y = 0.95;
      g.add(pot, bush);
      break;
    }
    case 'chairs':
      box(3.6, 0.45, 0.9, lambert(0x4a5a8c), 0.35);
      box(3.6, 0.8, 0.22, lambert(0x4a5a8c), 0.75, 0, -0.36);
      break;
  }
  g.position.set(p.x, 0, p.z);
  if (p.rot) g.rotation.y = p.rot;
  return g;
}

const mirrorAvatars = new Map<string, PersonMesh>();

/** Update every mirror reflection to match the player's appearance. */
export function updateMirror(look: Appearance): void {
  for (const av of mirrorAvatars.values()) {
    av.setColors?.(SHIRT_COLORS[look.shirt], HAIR_COLORS[look.hair], SKIN_COLORS[look.skin]);
  }
}

/** Show a room's reflection only when the player is at that mirror. */
export function setReflectionVisible(place: string, on: boolean): void {
  const av = mirrorAvatars.get(place);
  if (av) av.group.visible = on;
}

/** Build every room once; returns the per-place groups so upgrades can toggle. */
export function buildRooms(scene: THREE.Scene): Map<string, THREE.Group> {
  const groups = new Map<string, THREE.Group>();
  for (const room of ROOMS) {
    const o = ROOM_ORIGIN[room.place];
    const g = new THREE.Group();

    const floorMat = room.checker
      ? new THREE.MeshLambertMaterial({ map: checkerTexture() })
      : lambert(room.floor);
    if (room.checker) {
      const tex = (floorMat.map as THREE.CanvasTexture);
      tex.repeat.set(room.w / 4, room.d / 4);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    const wallMat = lambert(room.wall);
    const walls: [number, number, number, number, number][] = [
      [room.w, 0, -room.d / 2, 0, 0],
      [room.w, 0, room.d / 2, Math.PI, 0],
      [room.d, -room.w / 2, 0, Math.PI / 2, 0],
      [room.d, room.w / 2, 0, -Math.PI / 2, 0],
    ];
    for (const [w, x, z, rotY] of walls) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, room.h), wallMat);
      wall.position.set(x, room.h / 2, z);
      wall.rotation.y = rotY;
      g.add(wall);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), lambert(0xd8d5cc));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = room.h;
    g.add(ceil);

    // fluorescent panels + house light
    const panels = room.dark ? 1 : 2;
    for (let i = 0; i < panels; i++) {
      const lightPanel = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.08, 1.0),
        new THREE.MeshBasicMaterial({ color: room.dark ? 0x8a4ac8 : 0xf5f2e0 })
      );
      lightPanel.position.set((i - (panels - 1) / 2) * 5, room.h - 0.06, 0);
      g.add(lightPanel);
    }
    const light = new THREE.PointLight(room.dark ? 0xb080ff : 0xfff2d8, room.dark ? 40 : 70, 40, 2);
    light.position.set(0, room.h - 0.4, 0);
    g.add(light);

    // the exit door on the front wall
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), lambert(0x3a3630));
    door.position.set(0, 1.2, room.d / 2 - 0.02);
    door.rotation.y = Math.PI;
    g.add(door);

    for (const p of room.props) {
      const mesh = buildProp(p, room);
      if (p.good) {
        mesh.userData.good = p.good;
        mesh.visible = false;
      }
      g.add(mesh);
    }

    // the mirror's "reflection": an avatar just in front of the glass, facing the player
    const mirrorProp = room.props.find(pr => pr.kind === 'mirror');
    if (mirrorProp) {
      const av = makeAvatar(SHIRT_COLORS[1], HAIR_COLORS[0], SKIN_COLORS[0]);
      av.group.position.set(mirrorProp.x + 0.5, 0, mirrorProp.z); // just off the glass into the room
      av.group.rotation.y = -Math.PI / 2;
      av.group.visible = false;
      g.add(av.group);
      mirrorAvatars.set(room.place, av);
    }

    g.position.set(o.x, 0, o.z);
    scene.add(g);
    groups.set(room.place, g);
  }
  return groups;
}

/** Show/hide upgrade props in a room group per owned goods. */
export function applyRoomGoods(group: THREE.Group, goods: string[]): void {
  group.traverse(obj => {
    const good = obj.userData?.good;
    if (good) obj.visible = goods.includes(good);
  });
}

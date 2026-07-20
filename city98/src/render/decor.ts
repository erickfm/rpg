import * as THREE from 'three';
import type { Season } from '../core/calendar';
import type { DecorPlan } from '../core/decor';
import { makeSign } from './textures';

/**
 * Downtown dresses for the season — pumpkins in autumn, a lit evergreen and
 * wreaths in winter, flower boxes in spring, bunting in summer — plus a holiday
 * banner strung across the plaza. Everything is built once and toggled by day.
 */

const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c });

// open, visible spots: the plaza center + the four sidewalk corners (clear of
// the inset storefronts)
const CENTER: [number, number] = [0, 0];
const SPOTS: [number, number][] = [[-27, 27], [27, 27], [-27, -27], [27, -27]];

function pumpkinCluster(): THREE.Group {
  const g = new THREE.Group();
  const seedXZ = [[0, 0], [0.7, 0.3], [-0.5, 0.5]];
  for (const [dx, dz] of seedXZ) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mat(0xd8722a));
    body.scale.y = 0.72;
    body.position.set(dx, 0.3, dz);
    body.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 5), mat(0x4a6a2f));
    stem.position.set(dx, 0.56, dz);
    g.add(body, stem);
  }
  const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 8), mat(0xcaa84e));
  hay.rotation.z = Math.PI / 2;
  hay.position.set(-1.2, 0.5, -0.2);
  hay.castShadow = true;
  g.add(hay);
  return g;
}

function wreath(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.16, 8, 14), mat(0x2f6a3a));
  ring.position.y = 1.3;
  ring.castShadow = true;
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.1), mat(0xb02f2f));
  bow.position.set(0, 0.82, 0.05);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), mat(0x6a5030));
  post.position.y = 0.65;
  g.add(ring, bow, post);
  return g;
}

function evergreen(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.6, 6), mat(0x5a4030));
  trunk.position.y = 0.3;
  g.add(trunk);
  const green = mat(0x1f5a34);
  let y = 0.7;
  for (let i = 0; i < 3; i++) {
    const r = 1.5 - i * 0.42;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.5, 9), green);
    cone.position.y = y + 0.75;
    cone.castShadow = true;
    g.add(cone);
    y += 1.0;
  }
  // string lights + a topper
  const lights = [0xff5050, 0xffd24a, 0x5aa6ff, 0x54ff86];
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), glow(lights[i % lights.length]));
    const yy = 1.0 + Math.random() * 2.4;
    const rr = (1.5 - (yy - 1.0) / 2.4 * 1.2) * (0.7 + Math.random() * 0.3);
    const th = Math.random() * Math.PI * 2;
    b.position.set(Math.cos(th) * rr, yy, Math.sin(th) * rr);
    g.add(b);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glow(0xffe08a));
  star.position.y = 3.55;
  g.add(star);
  return g;
}

function flowerBox(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.7), mat(0x7a5636));
  box.position.y = 0.25;
  box.castShadow = true;
  g.add(box);
  const petals = [0xe85a86, 0xf2c84a, 0xe8523c, 0xd06ad0, 0xffffff];
  for (let i = 0; i < 9; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), mat(0x3c7a34));
    const x = -0.66 + (i / 8) * 1.32;
    stem.position.set(x, 0.6, 0);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(petals[i % petals.length]));
    bloom.position.set(x, 0.82, 0);
    g.add(stem, bloom);
  }
  return g;
}

/** A string of triangular flags between two plaza points. */
function bunting(ax: number, az: number, bx: number, bz: number): THREE.Group {
  const g = new THREE.Group();
  const a = new THREE.Vector3(ax, 3.2, az);
  const b = new THREE.Vector3(bx, 3.2, bz);
  const colors = [0xe8523c, 0xf2c84a, 0x3c8ad0, 0x54c06a, 0xd06ad0];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * 0.5; // gentle sag
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 4), glow(colors[i % colors.length]));
    flag.rotation.x = Math.PI; // point down
    flag.position.copy(p);
    g.add(flag);
  }
  return g;
}

export class Decor {
  private themes: Record<Season, THREE.Group>;
  private banner: THREE.Group;
  private bannerMesh: THREE.Mesh;
  private bannerText = '';

  constructor(scene: THREE.Scene) {
    const group = (): THREE.Group => {
      const g = new THREE.Group();
      g.visible = false;
      scene.add(g);
      return g;
    };
    this.themes = { autumn: group(), winter: group(), spring: group(), summer: group() };
    const at = (theme: Season, build: () => THREE.Group, x: number, z: number) => {
      const m = build(); m.position.set(x, 0, z); this.themes[theme].add(m);
    };
    // each season gets a plaza centerpiece plus ambient copies at the corners
    at('autumn', pumpkinCluster, CENTER[0], CENTER[1]);
    at('winter', evergreen, CENTER[0], CENTER[1]);
    at('spring', flowerBox, CENTER[0], CENTER[1]);
    for (const [x, z] of SPOTS) {
      at('autumn', pumpkinCluster, x, z);
      at('winter', wreath, x, z);
      at('spring', flowerBox, x, z);
    }
    // summer: bunting on four poles, ringing the plaza center
    const ring: [number, number][] = [[-9, -9], [9, -9], [9, 9], [-9, 9]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % 4];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), mat(0x6a6a72));
      pole.position.set(ax, 1.8, az);
      this.themes.summer.add(pole, bunting(ax, az, bx, bz));
    }

    // holiday banner across the plaza on two posts
    this.banner = new THREE.Group();
    this.banner.visible = false;
    for (const sx of [-6, 6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), mat(0x6a6a72));
      post.position.set(CENTER[0] + sx, 2, CENTER[1]);
      this.banner.add(post);
    }
    this.bannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 1.6),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    this.bannerMesh.position.set(CENTER[0], 3.3, CENTER[1]);
    this.banner.add(this.bannerMesh);
    scene.add(this.banner);
  }

  apply(plan: DecorPlan): void {
    for (const s of Object.keys(this.themes) as Season[]) {
      this.themes[s].visible = s === plan.theme;
    }
    if (plan.banner) {
      if (plan.banner !== this.bannerText) {
        this.bannerText = plan.banner;
        const tex = makeSign(plan.banner, 'block', '#b02f4a', '#ffe8c0');
        (this.bannerMesh.material as THREE.MeshBasicMaterial).map = tex;
        (this.bannerMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
      }
      this.banner.visible = true;
    } else {
      this.banner.visible = false;
    }
  }
}

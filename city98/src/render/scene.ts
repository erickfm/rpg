import * as THREE from 'three';
import {
  BUILDINGS, CITY_HALF, PARKED, PROPS, ROADS, ROAD_HALF, WALK_EDGE,
} from '../world/city';
import { mulberry32 } from '../core/rng';
import { buildBuilding } from './buildings';
import { buildProp, makeWire } from './props';
import { makeCar } from './cars';

export interface SceneCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  lamps: THREE.PointLight[];
  bulbs: THREE.Mesh[];
  nightMats: THREE.MeshLambertMaterial[];
  roadMat: THREE.MeshLambertMaterial;
}

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

export function createScene(container: HTMLElement): SceneCtx {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9cc0dd, 90, 320);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600);

  const hemi = new THREE.HemisphereLight(0xcfe0f5, 0x54683e, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0da, 2.2);
  sun.position.set(80, 110, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const built = buildCity(scene);
  return { renderer, scene, camera, sun, hemi, lamps: built.lamps, bulbs: built.bulbs, nightMats: built.nightMats, roadMat: built.roadMat };
}

// block spans between the roads
const SPANS: [number, number][] = [
  [-CITY_HALF, -38 - ROAD_HALF],
  [-38 + ROAD_HALF, 38 - ROAD_HALF],
  [38 + ROAD_HALF, CITY_HALF],
];

function buildCity(scene: THREE.Scene): {
  lamps: THREE.PointLight[];
  bulbs: THREE.Mesh[];
  nightMats: THREE.MeshLambertMaterial[];
  roadMat: THREE.MeshLambertMaterial;
} {
  const lamps: THREE.PointLight[] = [];
  const bulbs: THREE.Mesh[] = [];
  const nightMats: THREE.MeshLambertMaterial[] = [];

  const flat = (mat: THREE.Material, w: number, d: number, x: number, z: number, y: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // grass base
  const grass = lambert(0x679550);
  flat(grass, CITY_HALF * 2 + 40, CITY_HALF * 2 + 40, 0, 0, 0);

  // asphalt
  const asphalt = lambert(0x35383f);
  const roadMat = asphalt;
  for (const r of ROADS) {
    if (r.axis === 'z') flat(asphalt, ROAD_HALF * 2, CITY_HALF * 2, r.at, 0, 0.02);
    else flat(asphalt, CITY_HALF * 2, ROAD_HALF * 2, 0, r.at, 0.02);
  }

  // sidewalk rings around every block (raised, so there's a curb)
  const walkMat = lambert(0xb4aea1);
  const curb = (x1: number, z1: number, x2: number, z2: number): void => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(Math.abs(x2 - x1), 0.24, Math.abs(z2 - z1)),
      walkMat
    );
    m.position.set((x1 + x2) / 2, 0.12, (z1 + z2) / 2);
    m.receiveShadow = true;
    m.castShadow = true;
    scene.add(m);
  };
  for (const [bx1, bx2] of SPANS) {
    for (const [bz1, bz2] of SPANS) {
      const w = WALK_EDGE - ROAD_HALF; // 4
      curb(bx1, bz1, bx2, bz1 + w);
      curb(bx1, bz2 - w, bx2, bz2);
      curb(bx1, bz1 + w, bx1 + w, bz2 - w);
      curb(bx2 - w, bz1 + w, bx2, bz2 - w);
    }
  }

  // lane dashes + crosswalks
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c04a });
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xd8d5cc });
  for (const r of ROADS) {
    for (let a = -CITY_HALF + 6; a < CITY_HALF - 5; a += 8) {
      if ([-38, 38].some(j => Math.abs(a - j) < ROAD_HALF + 6)) continue;
      if (r.axis === 'z') flat(dashMat, 0.4, 3, r.at, a, 0.04);
      else flat(dashMat, 3, 0.4, a, r.at, 0.04);
    }
  }
  for (const ix of [-38, 38]) {
    for (const iz of [-38, 38]) {
      for (let s = -4; s <= 4; s += 2) {
        flat(zebraMat, 1.1, 3.2, ix + s, iz - ROAD_HALF - 1.8, 0.045);
        flat(zebraMat, 3.2, 1.1, ix - ROAD_HALF - 1.8, iz + s, 0.045);
      }
    }
  }

  // downtown block: concrete courtyard + painted parking in the middle
  const concrete = lambert(0xa8a296);
  flat(concrete, 52, 52, 0, 0, 0.055);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d5cc });
  for (let i = -2; i <= 2; i++) {
    flat(lineMat, 0.3, 5.4, i * 3.4, 0, 0.07);
  }
  // office plaza
  flat(concrete, 30, 8, 0, -46, 0.055);
  // gas station forecourt
  flat(concrete, 18, 22, 52, -14, 0.055);
  // dealership lot
  flat(concrete, 26, 26, 60, 24, 0.055);
  // park path
  flat(lambert(0xc0b490), 3, 24, 0, 54, 0.055);

  // buildings
  for (const b of BUILDINGS) {
    const built = buildBuilding(b);
    scene.add(built.group);
    nightMats.push(...built.nightMats);
  }

  // props
  const poleTops: THREE.Vector3[] = [];
  for (const p of PROPS) {
    const built = buildProp(p);
    scene.add(built.group);
    lamps.push(...built.lamps);
    bulbs.push(...built.bulbs);
    if (p.kind === 'powerpole') poleTops.push(new THREE.Vector3(p.x, 7.6, p.z));
  }
  poleTops.sort((a, b) => a.x - b.x);
  for (let i = 0; i + 1 < poleTops.length; i++) {
    const a = poleTops[i].clone().add(new THREE.Vector3(0, 0, 0));
    const b = poleTops[i + 1];
    scene.add(makeWire(a, b));
    scene.add(makeWire(a.clone().setY(6.9), b.clone().setY(6.9)));
  }

  // parked cars
  for (const c of PARKED) {
    const car = makeCar(c.kind, c.color);
    car.position.set(c.x, 0, c.z);
    car.rotation.y = c.rot;
    scene.add(car);
  }

  // park trees + scattered block trees
  const rng = mulberry32(41);
  let planted = 0;
  for (let tries = 0; tries < 400 && planted < 34; tries++) {
    const x = (rng() * 2 - 1) * (CITY_HALF - 8);
    const z = (rng() * 2 - 1) * (CITY_HALF - 8);
    const inPark = x > -28 && x < 28 && z > 46 && z < 104;
    const nearRoad = ROADS.some(r => Math.abs((r.axis === 'z' ? x : z) - r.at) < WALK_EDGE + 2);
    if (!inPark && nearRoad) continue;
    if (!inPark && rng() < 0.55) continue; // denser in the park
    const nearBuilding = BUILDINGS.some(
      b => Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(z - b.z) < b.d / 2 + 4
    );
    if (nearBuilding) continue;
    // keep the downtown courtyard and lots clear
    if (x > -28 && x < 28 && z > -28 && z < 28) continue;
    if (x > 42 && z > -28 && z < 40) continue;
    const tree = buildProp({ kind: 'tree', x, z });
    scene.add(tree.group);
    planted++;
  }

  return { lamps, bulbs, nightMats, roadMat };
}

import * as THREE from 'three';
import {
  CITY, CITY_HALF, PARKED_BUS, ROADS, ROAD_HALF, YELLOW_CAR, buildingById,
  type Building,
} from '../world/layout';
import { mulberry32 } from '../core/rng';
import { buildBuilding, makeBusMesh, makeCarMesh } from './buildings';
import { makeSign } from './textures';

export interface SceneCtx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  lamps: THREE.PointLight[];
  world: THREE.Group; // the outdoor island — hidden while indoors
  clouds: THREE.Group;
  castleGroup: THREE.Group; // visible only once purchased
  forSaleGroup: THREE.Group; // the vacant lot sign shown until then
}

export function createScene(container: HTMLElement): SceneCtx {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 140, 420);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 700);

  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a6a45, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
  sun.position.set(90, 130, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const world = new THREE.Group();
  scene.add(world);
  const { lamps, castleGroup, forSaleGroup } = buildIsland(world);
  const clouds = buildClouds();
  scene.add(clouds);

  return { renderer, scene, camera, sun, hemi, lamps, world, clouds, castleGroup, forSaleGroup };
}

// ---------- the floating island ----------

interface IslandRefs {
  lamps: THREE.PointLight[];
  castleGroup: THREE.Group;
  forSaleGroup: THREE.Group;
}

function buildIsland(world: THREE.Group): IslandRefs {
  const size = CITY_HALF * 2 + 14;
  const grass = new THREE.MeshLambertMaterial({ color: 0x5d9c50 });
  const dirt = new THREE.MeshLambertMaterial({ color: 0x6b4a32 });
  const bedrock = new THREE.MeshLambertMaterial({ color: 0x4a3423 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 14, size), [
    dirt, dirt, grass, bedrock, dirt, dirt,
  ]);
  slab.position.y = -7;
  slab.receiveShadow = true;
  world.add(slab);

  buildRoads(world);
  // the castle is real estate: hidden behind a FOR SALE sign until purchased
  const castle = buildingById('castle');
  const castleGroup = buildBuilding(castle);
  world.add(castleGroup);
  const forSaleGroup = buildForSaleLot(castle);
  world.add(forSaleGroup);
  for (const b of CITY) {
    if (b.id !== 'castle') world.add(buildBuilding(b));
    buildDoorPath(world, b);
  }

  // parked set dressing: the hotwireable yellow car and the depot bus
  const yellow = makeCarMesh(0xe8c93c);
  yellow.position.set(YELLOW_CAR.x, 0, YELLOW_CAR.z);
  yellow.rotation.y = 0.4;
  world.add(yellow);
  const bus = makeBusMesh();
  bus.position.set(PARKED_BUS.x, 0, PARKED_BUS.z);
  world.add(bus);

  plantTrees(world);
  return { lamps: placeLamps(world), castleGroup, forSaleGroup };
}

/** The castle's footprint before you can afford it: bare dirt and a sign. */
function buildForSaleLot(b: Building): THREE.Group {
  const g = new THREE.Group();
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(b.w, b.d),
    new THREE.MeshLambertMaterial({ color: 0x7a6a4a })
  );
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(b.x, 0.025, b.z);
  dirt.receiveShadow = true;
  g.add(dirt);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 3.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a })
  );
  post.position.set(b.doorX, 1.7, b.doorZ);
  post.castShadow = true;
  g.add(post);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 2),
    new THREE.MeshBasicMaterial({
      map: makeSign('FOR SALE · see the Bank', {
        bg: '#e8e2d2', fg: '#8a2323', border: '#8a2323',
        font: 'bold 44px Georgia, serif',
      }),
      side: THREE.DoubleSide,
      transparent: true,
    })
  );
  board.position.set(b.doorX, 3.4, b.doorZ);
  g.add(board);
  return g;
}

const WALK_W = 3.4; // sidewalk width
const WALK_EDGE = ROAD_HALF + WALK_W; // outer sidewalk edge from a road centerline
const WALK_MID = ROAD_HALF + WALK_W / 2;
const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a9da4 });

function buildRoads(world: THREE.Group): void {
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
  const dash = new THREE.MeshBasicMaterial({ color: 0xd8c24a });

  const flat = (
    mat: THREE.Material,
    w: number,
    d: number,
    x: number,
    z: number,
    y: number
  ): void => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    world.add(m);
  };

  // Asphalt: arms are trimmed to the vertical road's edge, so the surfaces
  // butt together instead of overlapping (no seams, no z-fighting).
  const H = CITY_HALF;
  flat(asphalt, ROAD_HALF * 2, 2 * H, 0, 0, 0.02); // vertical road
  flat(asphalt, H - ROAD_HALF, ROAD_HALF * 2, (-H - ROAD_HALF) / 2, -30, 0.02); // west arm
  flat(asphalt, H - ROAD_HALF, ROAD_HALF * 2, (H + ROAD_HALF) / 2, 10, 0.02); // east arm

  // Sidewalks as explicit segments that stop at junctions instead of
  // crossing the asphalt.
  const walkSeg = (x1: number, z1: number, x2: number, z2: number): void =>
    flat(walkMat, Math.abs(x2 - x1), Math.abs(z2 - z1), (x1 + x2) / 2, (z1 + z2) / 2, 0.045);

  // vertical road, left side (west arm joins at z = −30)
  walkSeg(-WALK_EDGE, -H, -ROAD_HALF, -30 - WALK_EDGE);
  walkSeg(-WALK_EDGE, -30 + WALK_EDGE, -ROAD_HALF, H);
  // vertical road, right side (east arm joins at z = 10)
  walkSeg(ROAD_HALF, -H, WALK_EDGE, 10 - WALK_EDGE);
  walkSeg(ROAD_HALF, 10 + WALK_EDGE, WALK_EDGE, H);
  // west arm, both sides, ending at the vertical road's outer sidewalk edge
  walkSeg(-H, -30 - WALK_EDGE, -WALK_EDGE, -30 - ROAD_HALF);
  walkSeg(-H, -30 + ROAD_HALF, -WALK_EDGE, -30 + WALK_EDGE);
  // east arm, both sides
  walkSeg(WALK_EDGE, 10 - WALK_EDGE, H, 10 - ROAD_HALF);
  walkSeg(WALK_EDGE, 10 + ROAD_HALF, H, 10 + WALK_EDGE);
  // corner pads where the sidewalks turn at each junction
  for (const [cx, cz] of [
    [-WALK_MID, -30 - WALK_MID],
    [-WALK_MID, -30 + WALK_MID],
    [WALK_MID, 10 - WALK_MID],
    [WALK_MID, 10 + WALK_MID],
  ]) {
    flat(walkMat, WALK_W, WALK_W, cx, cz, 0.045);
  }

  // Dashed centerlines, skipping the junction mouths.
  const junctionsOnVertical = [-30, 10];
  for (let z = -H + 5; z < H - 4; z += 9) {
    if (junctionsOnVertical.some(j => Math.abs(z - j) < ROAD_HALF + 5)) continue;
    flat(dash, 0.5, 4, 0, z, 0.06);
  }
  for (let x = -H + 5; x < -ROAD_HALF - 6; x += 9) flat(dash, 4, 0.5, x, -30, 0.06);
  for (let x = ROAD_HALF + 8; x < H - 4; x += 9) flat(dash, 4, 0.5, x, 10, 0.06);
}

/** Across-distance to the nearest road centerline, Infinity off-road ends. */
function roadAcross(x: number, z: number): number {
  let best = Infinity;
  for (const r of ROADS) {
    const along = r.axis === 'x' ? x : z;
    const across = r.axis === 'x' ? z - r.at : x - r.at;
    if (along >= r.from - WALK_W && along <= r.to + WALK_W) {
      best = Math.min(best, Math.abs(across));
    }
  }
  return best;
}

/** A concrete footpath from each door, ending where the sidewalk begins. */
function buildDoorPath(world: THREE.Group, b: Building): void {
  const dir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[b.side];
  let len = 0;
  for (; len < 80; len += 0.5) {
    if (roadAcross(b.doorX + dir[0] * len, b.doorZ + dir[1] * len) <= WALK_EDGE) break;
  }
  if (len <= 1 || len >= 80) return;
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(dir[0] !== 0 ? len : 2.6, dir[0] !== 0 ? 2.6 : len),
    walkMat
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(b.doorX + (dir[0] * len) / 2, 0.045, b.doorZ + (dir[1] * len) / 2);
  path.receiveShadow = true;
  world.add(path);
}

function plantTrees(world: THREE.Group): void {
  const rng = mulberry32(11);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
  let placed = 0;
  for (let tries = 0; tries < 500 && placed < 30; tries++) {
    const x = (rng() * 2 - 1) * (CITY_HALF - 6);
    const z = (rng() * 2 - 1) * (CITY_HALF - 6);
    if (roadAcross(x, z) < WALK_EDGE + 2.5) continue; // clear of roads and sidewalks
    const nearBuilding = CITY.some(
      b => Math.abs(x - b.x) < b.w / 2 + 5 && Math.abs(z - b.z) < b.d / 2 + 5
    );
    if (nearBuilding) continue;
    const scale = 0.8 + rng() * 0.7;
    const hue = 0.3 + rng() * 0.06;
    const leafMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.45, 0.32) });
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 8), trunkMat);
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let tier = 0; tier < 3; tier++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.4 - tier * 0.6, 2.6, 9),
        leafMat
      );
      cone.position.y = 3 + tier * 1.7;
      cone.castShadow = true;
      tree.add(cone);
    }
    tree.scale.setScalar(scale);
    tree.position.set(x, 0, z);
    world.add(tree);
    placed++;
  }
}

function placeLamps(world: THREE.Group): THREE.PointLight[] {
  const lamps: THREE.PointLight[] = [];
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2c33 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc966 });
  const spots: [number, number][] = [
    [-10.5, -60], [10.5, -20], [-10.5, 40], [10.5, 90],
    [-60, -40.5], [-95, -19.5], [40, -0.5], [90, 20.5],
    [-10.5, -19.5], [10.5, 20.5],
  ];
  for (const [x, z] of spots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 7.5, 8), poleMat);
    pole.position.set(x, 3.75, z);
    pole.castShadow = true;
    world.add(pole);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), bulbMat);
    arm.position.set(x, 7.6, z);
    world.add(arm);
    const light = new THREE.PointLight(0xffc966, 0, 55, 2);
    light.position.set(x, 7.4, z);
    world.add(light);
    lamps.push(light);
  }
  return lamps;
}

// ---------- sky dressing ----------

function buildClouds(): THREE.Group {
  const rng = mulberry32(23);
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 5 + rng() * 6;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set(p * (r * 1.1) - puffs * 2.5, rng() * 2, rng() * 4 - 2);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    const angle = rng() * Math.PI * 2;
    const radius = CITY_HALF + 40 + rng() * 90;
    const high = rng() < 0.35;
    cloud.position.set(
      Math.cos(angle) * radius,
      high ? 55 + rng() * 30 : -18 + rng() * 26,
      Math.sin(angle) * radius
    );
    group.add(cloud);
  }
  return group;
}

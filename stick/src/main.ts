import './ui/style.css';
import * as THREE from 'three';
import type { ActionResult, GameState, PlaceId } from './core/types';
import { deserialize, serialize, maxHp } from './core/state';
import { newGame } from './core/newgame';
import { passTime } from './core/time';
import { evaluateEnding } from './core/endgame';
import { mulberry32 } from './core/rng';
import {
  NPC_POSTS, SPAWN, YELLOW_CAR, buildingById, nearestDoor, resolveCollision,
  type NpcPost,
} from './world/layout';
import { exitSpot, interiorFor, type InteriorDef } from './world/interiors';
import { createScene } from './render/scene';
import { applyTimeOfDay } from './render/daynight';
import { StickMan, karmaHeadColor } from './render/stickman';
import { Traffic } from './render/traffic';
import { buildInterior } from './render/interiors';
import { makeCarMesh } from './render/buildings';
import { initHud, setPrompt, toast, updateHud } from './ui/hud';
import { closeMenu, initMenu, isMenuOpen, openMenu } from './ui/menu';
import {
  carMenu, haroldMenu, inventoryMenu, openStation, punkMenu, rudyMenu, type GameCtx,
} from './ui/panels';
import { isScreenOpen, showFinalScreen, showNewGameScreen } from './ui/screens';

// ---------- persistence ----------

const SAVE_KEY = 'stick-rpg-3d-save';

interface SaveFile {
  v: 2;
  state: string;
  x: number;
  z: number;
  carX: number;
  carZ: number;
}

function loadSave(): { state: GameState; x: number; z: number; carX: number; carZ: number } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveFile;
    if (save.v !== 2) return null;
    const state = deserialize(save.state);
    if (!state) return null;
    const [x, z] = resolveCollision(save.x, save.z, PLAYER_RADIUS);
    return { state, x, z, carX: save.carX ?? YELLOW_CAR.x, carZ: save.carZ ?? YELLOW_CAR.z };
  } catch {
    return null;
  }
}

function persist(): void {
  if (!state) return;
  const save: SaveFile = { v: 2, state: serialize(state), x: outX, z: outZ, carX, carZ };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function wipeSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

// ---------- world state ----------

const PLAYER_RADIUS = 0.6;
const WALK_SPEED = 12;
const RUN_SPEED = 18;
const SKATE_SPEED = 27; // Shift with the board = ride it
const DRIVE_SPEED = 36;

let state: GameState | null = null;
let px = SPAWN.x;
let pz = SPAWN.z;
let outX = SPAWN.x; // remembered outdoor position while indoors
let outZ = SPAWN.z;
let carX = YELLOW_CAR.x;
let carZ = YELLOW_CAR.z;
let heading = 0;
let mode: 'outside' | PlaceId = 'outside';
let driving = false;
let minuteAcc = 0;
let invulnUntil = 0;
let finalShown = false;

const rng = mulberry32(Date.now() >>> 0);

const app = document.getElementById('app')!;
const ctx3d = createScene(app);
initHud(document.body);
initMenu(document.body);

const stick = new StickMan();
ctx3d.scene.add(stick.group);

const traffic = new Traffic(ctx3d.world);

// the player's (hotwireable) yellow car
const yellowCar = makeCarMesh(0xe8c93c);
yellowCar.position.set(carX, 0, carZ);
yellowCar.rotation.y = 0.4;
ctx3d.world.add(yellowCar);

// outdoor NPCs
interface ActiveNpc {
  post: NpcPost;
  stick: StickMan;
  t: number;
  dir: 1 | -1;
}
const npcs: ActiveNpc[] = NPC_POSTS.map(post => {
  const s = new StickMan(post.headColor);
  s.group.position.set(post.ax, 0, post.az);
  ctx3d.world.add(s.group);
  return { post, stick: s, t: 0, dir: 1 };
});

// interior scene management
let interiorGroup: THREE.Group | null = null;
let interiorDef: InteriorDef | null = null;

// ---------- action plumbing ----------

const gameCtx: GameCtx = {
  get: () => state!,
  set: s => {
    state = s;
    updateHud(s);
    persist();
  },
  apply: (r: ActionResult): boolean => {
    state = r.state;
    toast(r.msg, r.ok);
    updateHud(state);
    persist();
    checkFinalStates();
    return r.ok;
  },
  rng,
  refreshInterior: () => {
    if (mode !== 'outside') enterInterior(mode, true);
  },
};

function checkFinalStates(): void {
  if (!state || finalShown) return;
  if (state.dead) {
    finalShown = true;
    closeMenu();
    const ending = evaluateEnding(state);
    showFinalScreen({
      kicker: 'Game over',
      title: 'YOU DIED',
      blurb: ending.blurb,
      stats: finalStats(state),
      buttons: [{ label: 'New game', onClick: () => { wipeSave(); location.reload(); } }],
    });
  } else if (state.ended) {
    finalShown = true;
    closeMenu();
    const ending = evaluateEnding(state);
    showFinalScreen({
      kicker: `${state.dayLimit} days in the 2D World`,
      title: ending.title,
      blurb: ending.blurb,
      stats: finalStats(state),
      buttons: [
        {
          label: 'Keep living here',
          onClick: () => {
            state = { ...state!, ended: false, dayLimit: null };
            finalShown = false;
            persist();
          },
        },
        { label: 'New game', onClick: () => { wipeSave(); location.reload(); } },
      ],
    });
  }
}

function finalStats(s: GameState): string[] {
  return [
    `Net worth   $${(s.cash + s.bank - s.loan).toLocaleString()}`,
    `Stats       STR ${s.stats.strength} · INT ${s.stats.intelligence} · CHA ${s.stats.charm}`,
    `Karma       ${s.karma > 0 ? '+' : ''}${s.karma}`,
    `Days lived  ${s.day}`,
    s.title !== 'none' ? `Title       ${s.title === 'president' ? 'President' : 'Dictator'} of the 2D World` : '',
  ].filter(Boolean);
}

// ---------- interiors ----------

function enterInterior(place: PlaceId, rebuild = false): void {
  if (!state) return;
  if (place === 'castle' && state.home !== 'castle') {
    toast('The castle gates are locked. The bank handles the listing — for $500,000.', false);
    return;
  }
  if (driving) stopDriving();
  if (!rebuild) {
    outX = px;
    outZ = pz;
  }
  if (interiorGroup) {
    ctx3d.scene.remove(interiorGroup);
    interiorGroup = null;
  }
  interiorDef = interiorFor(place, state);
  interiorGroup = buildInterior(interiorDef);
  ctx3d.scene.add(interiorGroup);
  ctx3d.world.visible = false;
  stick.group.visible = true;
  mode = place;
  if (!rebuild) {
    const spot = exitSpot(interiorDef);
    px = spot.x;
    pz = spot.z - 1.5;
    heading = Math.PI; // face into the room
  }
}

function leaveInterior(): void {
  if (interiorGroup) {
    ctx3d.scene.remove(interiorGroup);
    interiorGroup = null;
    interiorDef = null;
  }
  ctx3d.world.visible = true;
  mode = 'outside';
  px = outX;
  pz = outZ;
}

// ---------- driving ----------

function startDriving(): void {
  driving = true;
  stick.group.visible = false;
  toast('Vroom. E to park.');
}

function stopDriving(): void {
  driving = false;
  stick.group.visible = true;
  carX = px;
  carZ = pz;
  // step out beside the car
  px += 2.5;
  [px, pz] = resolveCollision(px, pz, PLAYER_RADIUS);
  persist();
}

// ---------- input ----------

const keys = new Set<string>();
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key.toLowerCase());
  if (!state || isMenuOpen() || isScreenOpen()) return;
  const k = e.key.toLowerCase();
  if (k === 'e') interact();
  if (k === 'i') inventoryMenu(gameCtx);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function interact(): void {
  if (!state) return;
  if (driving) {
    stopDriving();
    return;
  }
  if (mode === 'outside') {
    // nearest interactable: NPC, the yellow car, the FOR SALE lot, or a door
    const npc = npcs.find(
      n => !n.stick.group.visible ? false : Math.hypot(n.stick.group.position.x - px, n.stick.group.position.z - pz) < 4
    );
    if (npc) {
      if (npc.post.id === 'harold') return haroldMenu(gameCtx);
      if (npc.post.id === 'punk') return punkMenu(gameCtx);
      return rudyMenu(gameCtx);
    }
    if (Math.hypot(carX - px, carZ - pz) < 5) {
      return carMenu(gameCtx, () => {
        startDriving();
      });
    }
    const castleVacant = state.home !== 'castle';
    if (castleVacant) {
      const lot = buildingById('castle');
      if (Math.hypot(lot.doorX - px, lot.doorZ - pz) < 5) {
        openMenu({
          title: 'FOR SALE — prime 2D real estate',
          body: 'A weathered sign on a bare lot.\n"Castle-zoned. Serious buyers only. Inquire at the Bank."\n\nAsking: $500,000.',
          options: [{ label: 'One day…', onSelect: closeMenu }],
        });
        return;
      }
    }
    const door = nearestDoor(px, pz, castleVacant);
    if (door) enterInterior(door.id);
    return;
  }
  // indoors: exit pad or a station
  if (interiorDef) {
    const exit = exitSpot(interiorDef);
    if (Math.hypot(exit.x - px, exit.z - pz) < 2.4) {
      leaveInterior();
      return;
    }
    const station = interiorDef.stations.find(st => Math.hypot(st.x - px, st.z - pz) < 2.4);
    if (station) openStation(gameCtx, station.id);
  }
}

// ---------- boot ----------

if (new URLSearchParams(location.search).has('new')) {
  wipeSave();
  history.replaceState(null, '', location.pathname);
}
const loaded = loadSave();
if (loaded) {
  state = loaded.state;
  px = loaded.x;
  pz = loaded.z;
  outX = px;
  outZ = pz;
  carX = loaded.carX;
  carZ = loaded.carZ;
  yellowCar.position.set(carX, 0, carZ);
  updateHud(state);
  checkFinalStates();
} else {
  showNewGameScreen((name, days) => {
    state = newGame(name, days, rng);
    updateHud(state);
    persist();
    toast(`Welcome to the 2D World, ${state.name}.`);
    if (name === 'HEYZEUS!!!!') toast('The dice feel… loaded. In your favor.');
  });
}

// ---------- messages watcher ----------

let knownMessages = state?.messages.length ?? 0;

// ---------- game loop ----------

const CAM_OUTSIDE = { y: 58, z: 38 };
const CAM_INSIDE = { y: 26, z: 19 };
const cam = { y: CAM_OUTSIDE.y, z: CAM_OUTSIDE.z };
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const uiOpen = isMenuOpen() || isScreenOpen();
  let speed = 0;
  let skating = false;

  if (state && !uiOpen) {
    // movement
    let dx = 0;
    let dz = 0;
    if (keys.has('w') || keys.has('arrowup')) dz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dz += 1;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      if (driving) {
        speed = DRIVE_SPEED;
      } else if (keys.has('shift') && state.hasSkateboard && mode === 'outside') {
        skating = true; // Shift hops on the board instead of jogging
        speed = SKATE_SPEED;
      } else {
        speed = keys.has('shift') ? RUN_SPEED : WALK_SPEED;
      }
      if (!driving && state.hp <= Math.floor(maxHp(state) * 0.15)) speed *= 0.6;
      px += (dx / len) * speed * dt;
      pz += (dz / len) * speed * dt;
      if (mode === 'outside') {
        [px, pz] = resolveCollision(px, pz, driving ? 1.6 : PLAYER_RADIUS, state.home !== 'castle');
      } else if (interiorDef) {
        px = Math.max(-interiorDef.w / 2 + 1, Math.min(interiorDef.w / 2 - 1, px));
        pz = Math.max(-interiorDef.d / 2 + 1, Math.min(interiorDef.d / 2 - 1, pz));
      }
      const target = Math.atan2(dx, dz);
      const delta = ((target - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      heading += delta * Math.min(1, dt * 12);
    }

    if (mode === 'outside') {
      traffic.update(dt);
      updateNpcs(dt);

      // traffic is dangerous, like the original
      if (!driving && now > invulnUntil && traffic.hits(px, pz)) {
        invulnUntil = now + 2500;
        const hurt: GameState = {
          ...state,
          hp: Math.max(0, state.hp - 15),
        };
        gameCtx.apply({
          ok: false,
          state: hurt.hp === 0 ? { ...hurt, dead: true, deathCause: 'Run over on Main Street.' } : hurt,
          msg: 'WHAM — a car clips you! −15 HP. Look both ways!',
        });
      }

      // ambient clock: a minute per real second, outdoors only
      minuteAcc += dt;
      if (minuteAcc >= 1) {
        const whole = Math.floor(minuteAcc);
        minuteAcc -= whole;
        state = passTime(state, whole);
        checkFinalStates();
      }

      // prompts
      const npc = npcs.find(n => n.stick.group.visible && Math.hypot(n.stick.group.position.x - px, n.stick.group.position.z - pz) < 4);
      const nearCar = Math.hypot(carX - px, carZ - pz) < 5;
      const castleVacant = state.home !== 'castle';
      const lot = buildingById('castle');
      const nearLot = castleVacant && Math.hypot(lot.doorX - px, lot.doorZ - pz) < 5;
      const door = nearestDoor(px, pz, castleVacant);
      setPrompt(
        driving ? '[E] park' :
        npc ? `[E]  ${npc.post.name}` :
        nearCar ? (state.hasCar ? '[E]  Drive the yellow car' : '[E]  A yellow car…') :
        nearLot ? '[E]  FOR SALE sign' :
        door ? `[E]  ${door.name}` : null
      );
    } else if (interiorDef) {
      const exit = exitSpot(interiorDef);
      const station = interiorDef.stations.find(st => Math.hypot(st.x - px, st.z - pz) < 2.4);
      setPrompt(
        station ? `[E]  ${station.label}` :
        Math.hypot(exit.x - px, exit.z - pz) < 2.4 ? '[E]  Leave' : null
      );
    }

    // message notifications from any source
    if (state.messages.length > knownMessages) {
      knownMessages = state.messages.length;
      toast('📞 Your answering machine is blinking.');
    }
  } else {
    setPrompt(null);
  }

  // visuals
  if (state) {
    stick.setHeadColor(karmaHeadColor(state.karma, state.punkDead));
    // the board only appears while you're actually riding it
    stick.setSkateboard(skating);
    ctx3d.castleGroup.visible = state.home === 'castle';
    ctx3d.forSaleGroup.visible = state.home !== 'castle';
    updateHud(state);
  }

  if (driving) {
    yellowCar.position.set(px, 0, pz);
    yellowCar.rotation.y = heading;
    carX = px;
    carZ = pz;
  } else {
    yellowCar.position.set(carX, 0, carZ);
  }

  stick.group.position.set(px, 0, pz);
  stick.group.rotation.y = heading;
  stick.update(dt, speed);

  const target = mode === 'outside' ? CAM_OUTSIDE : CAM_INSIDE;
  cam.y += (target.y - cam.y) * Math.min(1, dt * 5);
  cam.z += (target.z - cam.z) * Math.min(1, dt * 5);
  ctx3d.camera.position.set(px, cam.y, pz + cam.z);
  ctx3d.camera.lookAt(px, 1.5, pz - 3);

  ctx3d.clouds.rotation.y += dt * 0.004;

  if (mode === 'outside') {
    applyTimeOfDay(ctx3d, state?.minute ?? 720);
  } else {
    // interiors are always lit, with a quiet dark backdrop
    ctx3d.hemi.intensity = 0.8;
    ctx3d.sun.intensity = 0.6;
    if (ctx3d.scene.background instanceof THREE.Color) ctx3d.scene.background.setHex(0x0e1120);
    (ctx3d.scene.fog as THREE.Fog).color.setHex(0x0e1120);
  }

  ctx3d.renderer.render(ctx3d.scene, ctx3d.camera);
  requestAnimationFrame(frame);
}

function updateNpcs(dt: number): void {
  for (const npc of npcs) {
    const { post } = npc;
    if (post.id === 'punk' && state?.punkDead) {
      npc.stick.group.visible = false;
      continue;
    }
    const length = Math.hypot(post.bx - post.ax, post.bz - post.az);
    if (length < 0.1) {
      npc.stick.update(dt, 0);
      continue;
    }
    npc.t += (npc.dir * dt * 3) / length;
    if (npc.t > 1) { npc.t = 1; npc.dir = -1; }
    if (npc.t < 0) { npc.t = 0; npc.dir = 1; }
    const x = post.ax + (post.bx - post.ax) * npc.t;
    const z = post.az + (post.bz - post.az) * npc.t;
    npc.stick.group.position.set(x, 0, z);
    npc.stick.group.rotation.y = Math.atan2((post.bx - post.ax) * npc.dir, (post.bz - post.az) * npc.dir);
    npc.stick.update(dt, 3);
  }
}

setInterval(persist, 10_000);
window.addEventListener('beforeunload', persist);

// deterministic hooks for the headless smoke tests
declare global {
  interface Window {
    __stick?: {
      teleport: (x: number, z: number) => void;
      getState: () => GameState | null;
      npcPos: (id: string) => [number, number] | null;
      mode: () => string;
    };
  }
}
window.__stick = {
  teleport: (x, z) => {
    px = x;
    pz = z;
  },
  getState: () => state,
  npcPos: id => {
    const npc = npcs.find(n => n.post.id === id);
    return npc ? [npc.stick.group.position.x, npc.stick.group.position.z] : null;
  },
  mode: () => mode,
};

requestAnimationFrame(frame);

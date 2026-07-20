import './ui/style.css';
import * as THREE from 'three';
import type { ActionResult, GameState } from './core/types';
import { carModel, deserialize, isSluggish, newGame, passTime, serialize } from './core/sim';
import { showTitle, type NewGameChoice } from './ui/title';
import { tryCompleteGig } from './core/gigs';
import { isWet, skyLabel, soakDrainPerHour, weatherAt } from './core/weather';
import { hasUmbrella } from './core/goods';
import { checkAspirations } from './core/aspirations';
import { epilogue } from './core/epilogue';
import { showEpilogue } from './ui/epilogue';
import { homeRoom } from './core/housing';
import {
  INTERACTABLES, PLAYER_CAR, PLAYER_SPAWN, staticColliders,
} from './world/city';
import {
  roomByPlace, roomColliders, roomEntry, ROOM_ORIGIN, type RoomPlace,
} from './world/interiors';
import { applyRoomGoods, buildRooms, setReflectionVisible, updateMirror } from './render/interiors';
import { createScene } from './render/scene';
import { applyTimeOfDay } from './render/daynight';
import { WeatherFx, applyGloom } from './render/weather';
import { applySeason, seasonHasSnow, SnowFx } from './render/season';
import { Fireworks } from './render/fireworks';
import { Decor } from './render/decor';
import { seasonFor, seasonInfo, holidayFor } from './core/calendar';
import { festivityFor } from './core/festivity';
import { decorFor } from './core/decor';
import { addScore, emptyScores, topScores, type GameId, type HighScores } from './core/highscores';
import { SLOT_COUNT, slotKey, LEGACY_KEY, summarize, type SlotSummary } from './core/saves';
import { makeCar } from './render/cars';
import { FpControls, PLAYER_RADIUS } from './game/fp';
import { Peds } from './game/peds';
import { Citizens } from './game/citizens';
import { befriend, talkLine, citizenById } from './core/citizens';
import { beginStory, checkStory, deliverStory } from './core/story';
import { completeFavor, favorAsk } from './core/favors';
import { GameAudio } from './game/audio';
import { Vehicle } from './game/vehicle';
import { Traffic } from './game/traffic';
import { initHud, setHint, setPrompt, setShelter, setSoaked, toast, updateGig, updateHud, updateNav, updateSeason, updateWeatherHud } from './ui/hud';
import {
  initMinimap, drawMinimap, setMinimapVisible, toggleFullMap, closeFullMap, isFullMapOpen,
  getWaypoint, setWaypoint, clearWaypoint, waypointTo, type Waypoint,
} from './ui/minimap';
import { distanceTo, compass8, arrived } from './core/nav';
import { closeDialog, initDialogs, isDialogOpen, openDialog } from './ui/win';
import { openPanel, type GameCtx } from './ui/panels';

// ---------- persistence ----------

const SCORE_KEY = 'city98-scores'; // arcade hall of fame — global, survives New Game
let activeSlot = 1;

function loadScores(): HighScores {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return emptyScores();
    const p = JSON.parse(raw);
    return { gutter: p.gutter ?? [], snake: p.snake ?? [] };
  } catch {
    return emptyScores();
  }
}

interface SaveFile {
  v: 1;
  state: string;
  px: number;
  pz: number;
  yaw: number;
  carX: number;
  carZ: number;
  carH: number;
}

function loadSlot(slot: number): SaveFile | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveFile;
    if (save.v !== 1 || !deserialize(save.state)) return null;
    return save;
  } catch {
    return null;
  }
}

/** Move the old single-save into slot 1 the first time we boot with slots. */
function migrateLegacySave(): void {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy && !localStorage.getItem(slotKey(1))) {
    localStorage.setItem(slotKey(1), legacy);
    localStorage.removeItem(LEGACY_KEY);
  }
}

function persist(): void {
  const save: SaveFile = {
    v: 1,
    state: serialize(state),
    px: mode === 'outside' ? fp.x : outside.x,
    pz: mode === 'outside' ? fp.z : outside.z,
    yaw: mode === 'outside' ? fp.yaw : outside.yaw,
    carX: car.x,
    carZ: car.z,
    carH: car.heading,
  };
  localStorage.setItem(slotKey(activeSlot), JSON.stringify(save));
}

// ---------- boot ----------

const app = document.getElementById('app')!;
const ctx3d = createScene(app);
initHud(document.body);
initMinimap(document.body, (wp: Waypoint) => {
  wpFromGig = false; // a hand-picked destination
  toast(`Waypoint set: ${wp.label}`);
  closeFullMap();
  requestLock();
});
initDialogs(document.body);

const colliders = staticColliders();

// Boot with a fresh default; the chosen slot loads over it when the title screen
// resolves (Continue) or a new life is started.
migrateLegacySave();
let state: GameState = newGame(Date.now() >>> 0);
const fp = new FpControls(PLAYER_SPAWN.x, PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);
const car = new Vehicle(PLAYER_CAR.x, PLAYER_CAR.z, PLAYER_CAR.rot);

/** Load a slot's save into live state + positions. */
function loadInto(slot: number): void {
  const save = loadSlot(slot);
  if (!save) return;
  state = deserialize(save.state)!;
  fp.x = save.px; fp.z = save.pz; fp.yaw = save.yaw;
  car.x = save.carX; car.z = save.carZ; car.heading = save.carH;
  outside = { x: fp.x, z: fp.z, yaw: fp.yaw };
  mode = 'outside';
}

// the player's car mesh follows the owned model; headlights ride along
const headlight = new THREE.SpotLight(0xfff2d0, 0, 42, 0.5, 0.4, 1.6);
headlight.position.set(0, 1.0, -1.9);
const headlightTarget = new THREE.Object3D();
headlightTarget.position.set(0, 0.3, -16);
let carMesh = new THREE.Group();
let carModelId = '';
function syncCarModel(): void {
  const model = carModel(state);
  if (model.id === carModelId) return;
  carModelId = model.id;
  carMesh.remove(headlight, headlightTarget);
  ctx3d.scene.remove(carMesh);
  carMesh = makeCar(model.kind as never, model.color);
  carMesh.add(headlight, headlightTarget);
  headlight.target = headlightTarget;
  ctx3d.scene.add(carMesh);
  car.setPerformance(model.top, model.accel);
}

const traffic = new Traffic(ctx3d.scene);
const peds = new Peds(ctx3d.scene);
const citizens = new Citizens(ctx3d.scene, state.minute);
const weatherFx = new WeatherFx(ctx3d.scene);
const snowFx = new SnowFx(ctx3d.scene);
const fireworks = new Fireworks(ctx3d.scene);
const decor = new Decor(ctx3d.scene);
const lampDefaults = ctx3d.lamps.map(l => l.color.getHex());
const FESTIVE_LAMPS = [0xff4d4d, 0x4dff88, 0x4da6ff, 0xffd24d, 0xff74e0];

// a plaid golf umbrella that peeks in at the top of the frame in the rain
const umbrella = new THREE.Mesh(
  new THREE.ConeGeometry(1.9, 0.85, 10, 1, true),
  new THREE.MeshLambertMaterial({ color: 0x3c8a5c, emissive: 0x1c3a28, side: THREE.DoubleSide })
);
umbrella.visible = false;
ctx3d.scene.add(umbrella);
const dryRoad = ctx3d.roadMat.color.clone();
let soakAcc = 0;
const wetRoad = dryRoad.clone().multiplyScalar(0.6);
let lastSky = '';
const roomGroups = buildRooms(ctx3d.scene);

const ROOM_PLACES: RoomPlace[] = ['diner', 'video', 'arcade', 'home', 'office', 'loft'];
const roomColliderMap = Object.fromEntries(ROOM_PLACES.map(pl => [pl, roomColliders(pl)])) as Record<RoomPlace, ReturnType<typeof roomColliders>>;
let mode: 'outside' | RoomPlace = 'outside';
let outside = { x: 0, z: 0, yaw: 0 };

function enterRoom(place: RoomPlace): void {
  outside = { x: fp.x, z: fp.z, yaw: fp.yaw };
  const entry = roomEntry(place);
  fp.x = entry.x;
  fp.z = entry.z;
  fp.yaw = 0; // face into the room
  mode = place;
  const grp = roomGroups.get(place);
  if (grp) applyRoomGoods(grp, state.goods);
  updateMirror(state.look);
}

function exitRoom(): void {
  mode = 'outside';
  fp.x = outside.x;
  fp.z = outside.z;
  fp.yaw = outside.yaw;
}
const audio = new GameAudio();
let stepAcc = 0;

let driving = false;
let lookYaw = 0; // extra look-around while driving
let minuteAcc = 0;
let knownMessages = state.messages.length;
let wpFromGig = false;
let lastGigDest: string | null = null;
let knownDay = state.day;
let epilogueOpen = false;
let wonShown = false;

/** Show the "you made it" screen the first time every life goal is complete. */
function maybeShowEpilogue(): void {
  if (!state.wonAt || wonShown || epilogueOpen || titleOpen) return;
  wonShown = true;
  epilogueOpen = true;
  document.exitPointerLock?.();
  showEpilogue(epilogue(state), () => { epilogueOpen = false; requestLock(); });
}
let highScores = loadScores();

function refreshSeasonHud(): void {
  updateSeason(`${seasonInfo(state.day).emoji} ${seasonInfo(state.day).name}`, holidayFor(state.day));
  decor.apply(decorFor(state.day));
}

syncCarModel();
updateMirror(state.look);
updateHud(state);
refreshSeasonHud();

// ---------- action plumbing ----------

const gameCtx: GameCtx = {
  get: () => state,
  apply: (r: ActionResult): boolean => {
    state = r.state;
    toast(r.msg, r.ok);
    updateHud(state);
    // completing a life goal can chain from any state change
    const goal = checkAspirations(state);
    if (goal) { state = goal.state; toast(goal.msg); }
    const story = checkStory(state);
    if (story) { state = story.state; toast(story.msg); }
    updateHud(state);
    persist();
    updateMirror(state.look);
    return r.ok;
  },
  playStation: (mood: number) => audio.playStationIndex(mood),
  stopStation: () => audio.stopRadio(),
  promptName: (current: string) => window.prompt('What\'s your name?', current),
  scores: () => highScores,
  recordScore: (game, score) => {
    const r = addScore(highScores, game, state.look.name, score);
    highScores = r.scores;
    localStorage.setItem(SCORE_KEY, JSON.stringify(highScores));
    return { rank: r.rank };
  },
};

// ---------- pointer lock ----------

const lockOverlay = document.createElement('div');
lockOverlay.id = 'lock-overlay';
lockOverlay.innerHTML = `
  <div class="win">
    <div class="win-title"><span class="win-title-text">CITY98.EXE</span><span></span></div>
    <div class="win-body">
      <h1>CITY 98</h1>
      <p id="pause-hint">A life, one day at a time.<br>WASD move · Shift run · E interact · Esc pause</p>
      <div id="pause-menu"></div>
    </div>
  </div>`;
lockOverlay.hidden = true;
document.body.appendChild(lockOverlay);
let titleOpen = true;
const pauseMenu = lockOverlay.querySelector<HTMLElement>('#pause-menu')!;
const pauseHint = lockOverlay.querySelector<HTMLElement>('#pause-hint')!;

const canvas = ctx3d.renderer.domElement;
let pointerLocked = false;

function requestLock(): void {
  canvas.requestPointerLock?.();
}

function pauseButton(label: string, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `win-btn title-btn ${cls}`;
  b.innerHTML = `<span class="lbl">${label}</span>`;
  return b;
}

function renderPauseMain(): void {
  pauseHint.hidden = false;
  pauseMenu.innerHTML = '';
  const resume = pauseButton('▶  Resume', 'primary');
  resume.addEventListener('click', () => { lockOverlay.hidden = true; audio.ensure(); requestLock(); });
  const stats = pauseButton('Life so far');
  stats.addEventListener('click', renderPauseStats);
  const quit = pauseButton('Save & quit to title');
  quit.addEventListener('click', () => { persist(); lockOverlay.hidden = true; openTitle(); });
  pauseMenu.append(resume, stats, quit);
}

function renderPauseStats(): void {
  pauseHint.hidden = true;
  const e = epilogue(state);
  pauseMenu.innerHTML = `<div class="epi-title" style="font-size:18px;margin:2px 0 10px">${state.look.name}'s life so far</div>`;
  const box = document.createElement('div');
  box.className = 'epi-rows';
  box.innerHTML = e.lines.map(l => {
    const [k, v] = l.split(' — ');
    return `<div class="epi-row"><span class="epi-k">${k}</span><span class="epi-v">${v ?? ''}</span></div>`;
  }).join('');
  const back = pauseButton('Back');
  back.addEventListener('click', renderPauseMain);
  pauseMenu.append(box, back);
}

function openPauseMenu(): void {
  renderPauseMain();
  lockOverlay.hidden = false;
}
renderPauseMain();
canvas.addEventListener('click', () => {
  if (!isDialogOpen()) requestLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && !isDialogOpen() && !titleOpen && !isFullMapOpen() && !epilogueOpen) {
    renderPauseMain();
    lockOverlay.hidden = false;
  }
});
document.addEventListener('mousemove', e => {
  if (!pointerLocked || isDialogOpen()) return;
  if (driving) {
    lookYaw = Math.max(-2.4, Math.min(2.4, lookYaw - e.movementX * 0.0023));
  } else {
    fp.look(e.movementX, e.movementY);
  }
});

// ---------- input ----------

const keys = new Set<string>();
window.addEventListener('keydown', e => {
  if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e' && !isDialogOpen()) interact();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'm') toast(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
  if (k === 'r' && driving) toast(`📻 ${audio.cycleRadio()}`);
  if (k === 'tab' && !titleOpen && !isDialogOpen() && mode === 'outside') {
    toggleFullMap();
    // free the cursor so you can click a destination; relock on close
    if (isFullMapOpen()) document.exitPointerLock?.();
    else requestLock();
  }
  if (k === 'escape' && isFullMapOpen()) { closeFullMap(); requestLock(); }
});
window.addEventListener('blur', () => keys.clear());

function nearestInteractable(): { id: string; label: string } | null {
  if (driving || mode !== 'outside') return null;
  let best: { id: string; label: string } | null = null;
  let bestD = 2.9;
  for (const it of INTERACTABLES) {
    const d = Math.hypot(it.x - fp.x, it.z - fp.z);
    if (d < bestD) {
      best = it;
      bestD = d;
    }
  }
  const carD = Math.hypot(car.x - fp.x, car.z - fp.z);
  if (carD < 3.4 && carD < bestD) return { id: '__car', label: 'your hatchback' };
  return best;
}

function nearestStation(): { id: string; label: string } | null {
  if (mode === 'outside') return null;
  const room = roomByPlace(mode);
  const o = ROOM_ORIGIN[mode];
  let best: { id: string; label: string } | null = null;
  let bestD = 2.2;
  for (const st of room.stations) {
    const d = Math.hypot(o.x + st.x - fp.x, o.z + st.z - fp.z);
    if (d < bestD) { best = { id: st.id, label: st.label }; bestD = d; }
  }
  if (best) return best;
  const entry = roomEntry(mode);
  if (Math.hypot(entry.x - fp.x, entry.z - fp.z) < 1.8) return { id: 'exit', label: 'Leave' };
  return null;
}

const ROOM_DOOR_IDS = new Set(['diner', 'video', 'arcade', 'home', 'office']);

function interact(): void {
  if (driving) {
    // park and step out
    driving = false;
    lookYaw = 0;
    const rightX = Math.cos(car.heading);
    const rightZ = -Math.sin(car.heading);
    fp.x = car.x + rightX * 2.4;
    fp.z = car.z + rightZ * 2.4;
    fp.yaw = car.heading;
    audio.stopRadio();
    toast('Parked. Probably legally.');
    persist();
    return;
  }
  if (mode !== 'outside') {
    const st = nearestStation();
    if (!st) return;
    if (st.id === 'exit') {
      exitRoom();
      return;
    }
    audio.click();
    openPanel(gameCtx, st.id);
    return;
  }
  const target = nearestInteractable();
  if (target) {
    if (target.id === '__car') {
      driving = true;
      lookYaw = 0;
      toast('W drive · S reverse · Space brake · E park');
      return;
    }
    audio.click();
    const done = tryCompleteGig(state, target.id);
    if (done) gameCtx.apply(done);
    if (ROOM_DOOR_IDS.has(target.id)) {
      enterRoom(target.id === 'home' ? homeRoom(state) : (target.id as RoomPlace));
      return;
    }
    openPanel(gameCtx, target.id);
    return;
  }
  const near = citizens.nearest(fp.x, fp.z, 3);
  if (near) {
    audio.click();
    const c = citizenById(near.id)!;
    // show the greeting, and a friendship talk builds the bond
    // a story delivery to this citizen takes priority
    const delivery = deliverStory(state, near.id);
    if (delivery && delivery.ok) {
      gameCtx.apply(delivery);
      closeDialog();
      return;
    }
    // a completed personal favor pays off on this visit
    const favor = completeFavor(state, near.id);
    if (favor && favor.ok) {
      gameCtx.apply(favor);
      closeDialog();
      return;
    }
    // an offered-but-unmet favor is what they lead with
    const line = delivery ? delivery.msg : (favorAsk(state, near.id) ?? talkLine(c, state, state.minute));
    openDialog({
      title: near.name,
      body: line,
      options: [{ label: 'Chat a while', onSelect: () => {
        gameCtx.apply(befriend(state, near.id));
        if (near.id === 'marcus') { const b = beginStory(state); if (b !== state) { state = b; updateHud(state); persist(); } }
        closeDialog();
      } }],
      closeLabel: 'Wave and move on',
    });
    return;
  }
  const ped = peds.nearest(fp.x, fp.z, 2.6);
  if (ped) {
    audio.click();
    openDialog({ title: ped.name, body: ped.bark, options: [], closeLabel: '"See ya."' });
  }
}

// ---------- game loop ----------

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const uiOpen = titleOpen || isDialogOpen() || !lockOverlay.hidden || isFullMapOpen() || epilogueOpen;

  if (!uiOpen) {
    const speedMult = isSluggish(state) ? 0.7 : 1;
    if (driving) {
      car.update(
        dt,
        {
          throttle: keys.has('w') || keys.has('arrowup'),
          reverse: keys.has('s') || keys.has('arrowdown'),
          left: keys.has('a') || keys.has('arrowleft'),
          right: keys.has('d') || keys.has('arrowright'),
          brake: keys.has(' '),
        },
        colliders
      );
    } else {
      const moved = fp.move(
        dt,
        {
          forward: keys.has('w') || keys.has('arrowup'),
          back: keys.has('s') || keys.has('arrowdown'),
          left: keys.has('a') || keys.has('arrowleft'),
          right: keys.has('d') || keys.has('arrowright'),
          sprint: keys.has('shift'),
        },
        speedMult,
        mode === 'outside' ? colliders : roomColliderMap[mode]
      );
      stepAcc += moved * dt;
      if (moved > 0 && stepAcc > 2.3) {
        stepAcc = 0;
        audio.step(keys.has('shift'));
      }
    }

    // one real second = one game minute
    minuteAcc += dt;
    if (minuteAcc >= 1) {
      const whole = Math.floor(minuteAcc);
      minuteAcc -= whole;
      state = passTime(state, whole);
      const goal = checkAspirations(state);
      if (goal) { state = goal.state; toast(goal.msg); }
      updateHud(state);
    }
    // rain wears you down unless sheltered (indoors / driving / umbrella)
    const w = weatherAt(state);
    const sheltered = mode !== 'outside' || driving || hasUmbrella(state);
    const soak = soakDrainPerHour(w, sheltered);
    if (soak > 0) {
      soakAcc += (soak * dt) / 60;
      if (soakAcc >= 1) {
        const drop = Math.floor(soakAcc);
        soakAcc -= drop;
        state = { ...state, energy: Math.max(0, state.energy - drop) };
        updateHud(state);
      }
    }
    setSoaked(mode === 'outside' && !driving && isWet(w) && !hasUmbrella(state));
    updateGig(state);

    // a new gig auto-routes you to its destination; finishing it drops the guide
    const gigDest = state.gig?.dest ?? null;
    if (gigDest !== lastGigDest) {
      lastGigDest = gigDest;
      if (gigDest) {
        const it = INTERACTABLES.find(i => i.id === gigDest);
        if (it) { setWaypoint({ x: it.x, z: it.z, label: state.gig!.destName }); wpFromGig = true; }
      } else if (wpFromGig) {
        clearWaypoint();
        wpFromGig = false;
      }
    }

    if (mode === 'outside') {
      traffic.update(dt, [
        { x: fp.x, z: fp.z },
        { x: car.x, z: car.z },
      ]);
      peds.update(dt, fp.x, fp.z);
      citizens.update(dt, state.minute, fp.x, fp.z);
    }

    if (mode !== 'outside') {
      const st = nearestStation();
      setPrompt(st ? `[E]  ${st.label}` : null);
      if (mode === 'home' || mode === 'loft') {
        const room = roomByPlace(mode);
        const mirrorSt = room.stations.find(st => st.id === 'mirror');
        const o = ROOM_ORIGIN[mode];
        const near = mirrorSt ? Math.hypot(o.x + mirrorSt.x - fp.x, o.z + mirrorSt.z - fp.z) < 3.2 : false;
        setReflectionVisible(mode, near);
      }
    } else {
      const target = nearestInteractable();
      const nearCit = target || driving ? null : citizens.nearest(fp.x, fp.z, 3);
      const nearPed = target || driving || nearCit ? null : peds.nearest(fp.x, fp.z, 2.6);
      setPrompt(
        driving ? null :
        target ? `[E]  ${target.id === '__car' ? 'Drive ' + target.label : target.label}` :
        nearCit ? `[E]  Talk to ${nearCit.name}` :
        nearPed ? `[E]  Talk to ${nearPed.name}` : null
      );
    }
  }

  if (state.messages.length > knownMessages) {
    knownMessages = state.messages.length;
    toast(state.messages[state.messages.length - 1]);
  }

  // a new day may bring a new season and a holiday greeting
  if (state.day !== knownDay) {
    knownDay = state.day;
    refreshSeasonHud();
    const h = holidayFor(state.day);
    if (h) toast(`${h.emoji} ${h.name} — ${h.greeting}`);
  }

  maybeShowEpilogue();

  // camera + car mesh
  syncCarModel();
  carMesh.position.set(car.x, 0, car.z);
  carMesh.rotation.y = car.heading;
  if (driving) {
    const cam = ctx3d.camera;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(-0.03, car.heading + lookYaw, 0);
    const backX = Math.sin(car.heading) * 0.4;
    const backZ = Math.cos(car.heading) * 0.4;
    cam.position.set(car.x + backX - Math.cos(car.heading) * 0.55, 1.32, car.z + backZ + Math.sin(car.heading) * 0.55);
  } else {
    fp.applyCamera(ctx3d.camera);
  }

  // minimap: hidden indoors, tracks the car when you're driving
  setMinimapVisible(mode === 'outside');
  if (mode === 'outside') {
    if (driving) drawMinimap(car.x, car.z, car.heading);
    else drawMinimap(fp.x, fp.z, fp.yaw);
  }

  // waypoint guidance chip: distance + compass heading, cleared on arrival
  const wp = getWaypoint();
  if (wp && mode === 'outside') {
    const wx = driving ? car.x : fp.x;
    const wz = driving ? car.z : fp.z;
    if (!wpFromGig && arrived(wx, wz, wp.x, wp.z, 6)) {
      toast(`Arrived: ${wp.label}`);
      clearWaypoint();
      updateNav(null);
    } else {
      updateNav(`→ ${wp.label} · ${Math.round(distanceTo(wx, wz, wp.x, wp.z))}m · ${compass8(wp.x - wx, wp.z - wz)}`);
    }
  } else {
    updateNav(null);
  }

  audio.setEngine(driving && !uiOpen, car.speed);
  audio.ambient(state.minute);

  applyTimeOfDay(ctx3d, state.minute);
  const season = seasonFor(state.day);
  applySeason(ctx3d, season);
  // holidays: colored streetlights at night (applyTimeOfDay set intensity, not color)
  const fest = festivityFor(state.day, state.minute);
  ctx3d.lamps.forEach((l, i) => l.color.setHex(fest.festiveLights ? FESTIVE_LAMPS[i % FESTIVE_LAMPS.length] : lampDefaults[i]));
  const weather = weatherAt(state);
  const umbrellaUp = mode === 'outside' && !driving && isWet(weather) && hasUmbrella(state);
  umbrella.visible = umbrellaUp;
  if (umbrellaUp) {
    const fwd = fp.forwardDir();
    umbrella.position.set(fp.x + fwd.x * 0.7, 2.75, fp.z + fwd.z * 0.7);
  }
  setShelter(umbrellaUp);
  applyGloom(ctx3d, weather);
  weatherFx.update(dt, weather, ctx3d.camera.position, now / 1000);
  snowFx.update(dt, seasonHasSnow(season) && mode === 'outside', ctx3d.camera.position, now / 1000);
  fireworks.update(dt, fest.fireworks && mode === 'outside', ctx3d.camera.position);
  // wet streets go dark and glossy-looking
  ctx3d.roadMat.color.copy(isWet(weather) ? wetRoad : dryRoad);
  if (weather.sky !== lastSky) {
    lastSky = weather.sky;
    updateWeatherHud(skyLabel(weather.sky), weather.sky);
  }
  // headlights come on with the streetlights, only while driving
  headlight.intensity = driving && ctx3d.lamps[0] && ctx3d.lamps[0].intensity > 20 ? 60 : 0;
  ctx3d.renderer.render(ctx3d.scene, ctx3d.camera);
  requestAnimationFrame(frame);
}

setInterval(persist, 10_000);
window.addEventListener('beforeunload', persist);
setHint('WASD move · Shift run · E interact · Tab map · Esc pause');

function beginPlay(): void {
  titleOpen = false;
  wonShown = state.wonAt !== null; // don't replay the ending for an already-won slot
  updateHud(state);
  refreshSeasonHud();
  updateMirror(state.look);
  syncCarModel();
  lockOverlay.hidden = false;
}

function openTitle(): void {
  titleOpen = true;
  const summaries: SlotSummary[] = [];
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const save = loadSlot(i);
    summaries.push(summarize(i, save ? deserialize(save.state) : null));
  }
  showTitle(
    summaries,
    (slot: number) => { activeSlot = slot; loadInto(slot); beginPlay(); },
    (slot: number, c: NewGameChoice) => {
      activeSlot = slot;
      state = newGame(Date.now() >>> 0);
      state = { ...state, look: { ...state.look, name: c.name, shirt: c.shirt, hair: c.hair, skin: c.skin } };
      fp.x = PLAYER_SPAWN.x; fp.z = PLAYER_SPAWN.z; fp.yaw = PLAYER_SPAWN.yaw;
      car.x = PLAYER_CAR.x; car.z = PLAYER_CAR.z; car.heading = PLAYER_CAR.rot;
      outside = { x: fp.x, z: fp.z, yaw: fp.yaw };
      mode = 'outside';
      persist();
      beginPlay();
    },
    (slot: number) => { localStorage.removeItem(slotKey(slot)); },
  );
}

openTitle();

// deterministic hooks for headless smoke tests
declare global {
  interface Window {
    __city?: {
      teleport: (x: number, z: number, yaw?: number) => void;
      getState: () => GameState;
      isDriving: () => boolean;
      carPos: () => [number, number];
      playerPos: () => [number, number];
      dismissLock: () => void;
      interact: () => void;
      setMinute: (m: number) => void;
      setCash: (c: number) => void;
      pedCount: () => number;
      nearestPedPos: () => [number, number] | null;
      mode: () => string;
      hasGig: () => boolean;
      leaveRoom: () => void;
      nearestCitizen: () => { id: string; name: string } | null;
      citizenPos: () => [number, number] | null;
      startGame: () => void;
      setDay: (d: number) => void;
      weatherSky: () => string;
      toggleMap: () => void;
      mapOpen: () => boolean;
      route: (label: string) => boolean;
      waypoint: () => string | null;
      season: () => string;
      holiday: () => string | null;
      addScore: (game: GameId, score: number) => number;
      topScore: (game: GameId) => number;
      fireworks: () => boolean;
      pitch: (p: number) => void;
      decorTheme: () => string;
      decorBanner: () => string | null;
      save: () => void;
      slot: () => number;
      pause: () => void;
      resume: () => void;
    };
  }
}
window.__city = {
  teleport: (x, z, yaw) => {
    fp.x = x;
    fp.z = z;
    if (yaw !== undefined) fp.yaw = yaw;
  },
  getState: () => state,
  isDriving: () => driving,
  carPos: () => [car.x, car.z],
  playerPos: () => [fp.x, fp.z],
  dismissLock: () => {
    lockOverlay.hidden = true;
  },
  interact,
  setMinute: m => {
    state = { ...state, minute: m };
    updateHud(state);
  },
  setCash: c => {
    state = { ...state, cash: c };
    updateHud(state);
  },
  pedCount: () => peds.count(),
  nearestPedPos: () => peds.nearestPos(fp.x, fp.z),
  mode: () => mode,
  hasGig: () => state.gig !== null,
  leaveRoom: () => { if (mode !== 'outside') exitRoom(); },
  nearestCitizen: () => citizens.nearest(fp.x, fp.z, 3),
  citizenPos: () => citizens.nearestPos(fp.x, fp.z),
  startGame: () => { document.getElementById('title-overlay')?.remove(); if (titleOpen) beginPlay(); },
  setDay: d => { state = { ...state, day: d }; updateHud(state); refreshSeasonHud(); },
  weatherSky: () => weatherAt(state).sky,
  toggleMap: () => { if (mode === 'outside') toggleFullMap(); },
  mapOpen: () => isFullMapOpen(),
  route: label => { const ok = waypointTo(label); if (ok) wpFromGig = false; return ok; },
  waypoint: () => getWaypoint()?.label ?? null,
  season: () => seasonFor(state.day),
  holiday: () => holidayFor(state.day)?.name ?? null,
  addScore: (game, score) => gameCtx.recordScore!(game, score).rank,
  topScore: game => topScores(highScores, game)[0]?.score ?? 0,
  fireworks: () => festivityFor(state.day, state.minute).fireworks,
  pitch: p => { fp.pitch = p; },
  decorTheme: () => decorFor(state.day).theme,
  decorBanner: () => decorFor(state.day).banner,
  save: () => persist(),
  slot: () => activeSlot,
  pause: () => openPauseMenu(),
  resume: () => { lockOverlay.hidden = true; },
};

requestAnimationFrame(frame);

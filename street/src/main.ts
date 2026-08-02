import * as THREE from 'three';
import { REGISTRY } from './protos';
import type { Proto, Input } from './proto/types';

const app = document.getElementById('app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// --- input ---------------------------------------------------------------
const input: Input = { keys: new Set(), mouseDX: 0, mouseDY: 0, locked: false };
window.addEventListener('keydown', (e) => {
  const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
  input.keys.add(k === 'shift' ? 'shift' : k);
  if (e.key === ' ') e.preventDefault();
  if (k === 'x' || k === ']') load(currentIndex + 1);
  else if (k === 'z' || k === '[') load(currentIndex - 1);
  else {
    const n = parseInt(e.key, 10);
    if (!isNaN(n)) load(n === 0 ? 9 : n - 1);
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
  input.keys.delete(k === 'shift' ? 'shift' : k);
});
renderer.domElement.addEventListener('click', () => {
  if (current?.pointerLock && !input.locked) {
    try { renderer.domElement.requestPointerLock(); } catch { /* sandboxed iframe: drag-look still works */ }
  }
});
document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === renderer.domElement; });
// drag-to-look fallback for environments without pointer lock (e.g. embedded pages)
let dragging = false;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  if (e.button === 2) input.keys.add('rmb'); // right button reaches worlds as a pseudo-key
});
window.addEventListener('mouseup', (e) => {
  dragging = false;
  if (e.button === 2) input.keys.delete('rmb');
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousemove', (e) => {
  if (input.locked) { input.mouseDX += e.movementX; input.mouseDY += e.movementY; }
  else if (dragging) { input.mouseDX += e.movementX; input.mouseDY += e.movementY; }
});

// --- world lifecycle -----------------------------------------------------
let current: Proto | null = null;
let currentIndex = 0;

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const key of ['map', 'emissiveMap', 'roughnessMap', 'normalMap'] as const) {
          const t = (m as any)[key];
          if (t) t.dispose();
        }
        m.dispose();
      }
    }
  });
  (scene.background as THREE.Texture | null)?.dispose?.();
  (scene.environment as THREE.Texture | null)?.dispose?.();
}

function load(i: number) {
  if (current) {
    current.dispose?.();
    disposeScene(current.scene);
  }
  if (input.locked) document.exitPointerLock();
  currentIndex = (i + REGISTRY.length) % REGISTRY.length;
  // renderer resets — each studio re-declares what it needs
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = false;
  current = REGISTRY[currentIndex].make();
  current.configure?.(renderer);
  applyAspect();
  // NO TITLE CARD, NO CONTROLS STRIP. Item 0d/0g: *"get rid of the overlay
  // descriptions here, controlls and all."* — same law as 0c (no pop-up
  // menus): nothing on screen that is not in the world. The `[E]` prompt is
  // untouched; it lives in `#ct-prompt` (`ct/hud.ts`/`crosstown.ts`), a
  // separate element from the one this used to write into.
}

function applyAspect() {
  if (!current) return;
  const cam = current.camera as THREE.PerspectiveCamera;
  cam.aspect = window.innerWidth / window.innerHeight;
  cam.updateProjectionMatrix();
}
function resize() { renderer.setSize(window.innerWidth, window.innerHeight); applyAspect(); }
window.addEventListener('resize', resize);

// --- loop ----------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();
  if (current) {
    current.update(dt, t, input);
    renderer.render(current.scene, current.camera);
  }
  input.mouseDX = 0; input.mouseDY = 0;
  requestAnimationFrame(frame);
}

const q = new URLSearchParams(location.search).get('proto');
const startI = q ? REGISTRY.findIndex((p) => p.key === q) : 0;
renderer.setSize(window.innerWidth, window.innerHeight);
load(startI >= 0 ? startI : 0);
frame();

// screenshot / debug hook
(window as any).__lab = {
  setProto: (k: string | number) => {
    const i = typeof k === 'number' ? k : REGISTRY.findIndex((p) => p.key === k);
    if (i >= 0) load(i);
    return REGISTRY[currentIndex].key;
  },
  list: () => REGISTRY.map((p) => ({ key: p.key, name: p.name })),
  current: () => REGISTRY[currentIndex].key,
};

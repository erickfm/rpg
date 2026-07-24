import * as THREE from 'three';

// A prototype is a self-contained little world: its own geometry, camera,
// lighting, and per-frame update. The shell (main.ts) loads one at a time and
// feeds it input. The whole point is that no two share a camera rig, a model
// vocabulary, or a movement feel.

export interface Input {
  keys: Set<string>; // held keys, lowercased
  mouseDX: number; // pointer-lock mouse delta this frame
  mouseDY: number;
  locked: boolean;
}

export interface Proto {
  key: string;
  name: string;
  feel: string; // one line on how it plays
  scene: THREE.Scene;
  camera: THREE.Camera;
  pointerLock?: boolean; // shell requests lock on click
  /** tone mapping / shadows / clear colour — reset to defaults before each call */
  configure?(r: THREE.WebGLRenderer): void;
  update(dt: number, t: number, input: Input): void;
  dispose?(): void;
}

export type ProtoFactory = () => Proto;

// shared tiny helpers ------------------------------------------------------

export const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
};

// deterministic PRNG so scenes look identical across reloads/screenshots
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

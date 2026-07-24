import * as THREE from 'three';
import type { AABB } from '../fp';

// The construction-time context the world modules are handed.
//
// Several regions of the street append to the SAME lists while they build —
// billboards, wet ground surfaces, solid props — so those lists are created
// once by crosstown.ts and passed down, rather than each module returning its
// own and the entry point stitching them back together. Everything here is
// build-time only; per-frame state stays inside whichever module owns it.

/** A billboard sprite: turned to face the player every frame by the sim loop. */
export interface Board { m: THREE.Mesh }

/** A horizontal ground surface that darkens + cools as the rain comes in. */
export interface WetSurface { m: THREE.MeshBasicMaterial; base: THREE.Color }

export interface CtxBuild {
  scene: THREE.Scene;
  /** unlit material off a painted texture — the whole world is MeshBasic */
  flat: (m: THREE.Texture) => THREE.MeshBasicMaterial;
  /** register a ground material for the rain's wet-look tint */
  wet: (m: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial;
  /** register a solid prop: blocks the player AND citizens steer around it */
  obstacle: (b: AABB) => AABB;
  boards: Board[];
  wetMats: WetSurface[];
  /** prop base height on the raised walks (== KERB_H) */
  sidewalkY: number;
  KERB_H: number;
}

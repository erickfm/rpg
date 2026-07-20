import * as THREE from 'three';

function limb(mat: THREE.Material, length: number, radius: number): THREE.Group {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), mat);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

/**
 * A classic stick figure: ball head, black capsule limbs.
 * `group` faces local +z; the caller sets position and heading.
 * Head color is settable — the original tints it by karma (and NPCs differ).
 */
export class StickMan {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly headMat: THREE.MeshLambertMaterial;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private readonly board: THREE.Mesh;
  private phase = 0;
  private swing = 0;

  constructor(headColor = 0x4a7ac8) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x15151a });
    this.headMat = new THREE.MeshLambertMaterial({ color: headColor });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), this.headMat);
    head.position.y = 3.35;
    head.castShadow = true;

    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.2, 4, 8), mat);
    spine.position.y = 2.35;
    spine.castShadow = true;

    this.leftArm = limb(mat, 1.15, 0.07);
    this.leftArm.position.set(-0.14, 2.85, 0);
    this.rightArm = limb(mat, 1.15, 0.07);
    this.rightArm.position.set(0.14, 2.85, 0);

    this.leftLeg = limb(mat, 1.75, 0.08);
    this.leftLeg.position.set(-0.18, 1.75, 0);
    this.rightLeg = limb(mat, 1.75, 0.08);
    this.rightLeg.position.set(0.18, 1.75, 0);

    this.board = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.12, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xc84a3c })
    );
    this.board.position.y = 0.1;
    this.board.visible = false;

    this.body.add(head, spine, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, this.board);
    this.group.add(this.body);
  }

  setHeadColor(color: number): void {
    this.headMat.color.setHex(color);
  }

  setSkateboard(on: boolean): void {
    this.board.visible = on;
  }

  update(dt: number, speed: number): void {
    const moving = speed > 0.1;
    if (this.board.visible && moving) {
      // skate stance: legs steady, slight crouch, board along travel
      this.swing += (0.15 - this.swing) * Math.min(1, dt * 8);
      this.leftLeg.rotation.x = 0.25;
      this.rightLeg.rotation.x = -0.35;
      this.leftArm.rotation.x = -0.3;
      this.rightArm.rotation.x = 0.4;
      this.body.position.y = 0.12;
      return;
    }
    this.phase += dt * speed * 1.6;
    const target = moving ? 0.65 : 0;
    this.swing += (target - this.swing) * Math.min(1, dt * 8);
    const s = Math.sin(this.phase) * this.swing;
    this.leftLeg.rotation.x = s;
    this.rightLeg.rotation.x = -s;
    this.leftArm.rotation.x = -s * 0.8;
    this.rightArm.rotation.x = s * 0.8;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.09 * this.swing;
  }
}

/** Karma tints your head, like the original's white/red/purple heads. */
export function karmaHeadColor(karma: number, punkDead: boolean): number {
  if (punkDead && karma <= -60) return 0x8a4ac8; // purple — you know what you did
  if (karma >= 60) return 0xf2f2ea;
  if (karma >= 20) return 0x9fc8e8;
  if (karma <= -60) return 0xc83c3c;
  if (karma <= -20) return 0xd8763c;
  return 0x4a7ac8;
}

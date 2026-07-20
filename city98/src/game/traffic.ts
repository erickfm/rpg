import * as THREE from 'three';
import { CITY_HALF, TRAFFIC } from '../world/city';
import { makeCar } from '../render/cars';

interface AiCar {
  mesh: THREE.Group;
  routeIndex: number;
  pos: number;
  dir: 1 | -1;
}

const LANE = 3;
const END = CITY_HALF - 8;

/** Ambient cars shuttling the roads, right-hand traffic, no ambitions. */
export class Traffic {
  private cars: AiCar[] = [];

  constructor(scene: THREE.Scene) {
    TRAFFIC.forEach((route, i) => {
      const mesh = makeCar(route.kind, route.color);
      scene.add(mesh);
      this.cars.push({ mesh, routeIndex: i, pos: -END + (i * 60) % (END * 2), dir: i % 2 === 0 ? 1 : -1 });
    });
  }

  update(dt: number, avoid: { x: number; z: number }[]): void {
    for (const car of this.cars) {
      const route = TRAFFIC[car.routeIndex];
      const r = route.road;

      // world position for the current lane/direction
      const laneOff = LANE * car.dir;
      const wx = r.axis === 'z' ? r.at + (r.axis === 'z' ? -laneOff : 0) : car.pos;
      const wz = r.axis === 'z' ? car.pos : r.at + laneOff;

      // brake if something is close ahead
      const aheadX = r.axis === 'z' ? wx : wx + car.dir * 7;
      const aheadZ = r.axis === 'z' ? wz + car.dir * 7 : wz;
      const blocked = avoid.some(a => Math.hypot(a.x - aheadX, a.z - aheadZ) < 5);
      if (!blocked) car.pos += car.dir * route.speed * dt;

      if (car.pos > END) {
        car.pos = END;
        car.dir = -1;
      } else if (car.pos < -END) {
        car.pos = -END;
        car.dir = 1;
      }

      if (r.axis === 'z') {
        car.mesh.position.set(r.at - LANE * car.dir, 0, car.pos);
        car.mesh.rotation.y = car.dir === 1 ? Math.PI : 0;
      } else {
        car.mesh.position.set(car.pos, 0, r.at + LANE * car.dir);
        car.mesh.rotation.y = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  }

  positions(): { x: number; z: number }[] {
    return this.cars.map(c => ({ x: c.mesh.position.x, z: c.mesh.position.z }));
  }
}

import * as THREE from 'three';
import { CAR_ROUTES, ROAD_HALF } from '../world/layout';
import { makeCarMesh } from './buildings';

interface ActiveCar {
  mesh: THREE.Group;
  routeIndex: number;
  pos: number; // position along the road axis
  dir: 1 | -1;
  speed: number;
}

const LANE = ROAD_HALF / 2;

/** Cars shuttling their roads, right-hand traffic, U-turns at the ends. */
export class Traffic {
  private cars: ActiveCar[] = [];

  constructor(world: THREE.Group) {
    CAR_ROUTES.forEach((route, i) => {
      const mesh = makeCarMesh(route.color);
      world.add(mesh);
      this.cars.push({
        mesh,
        routeIndex: i,
        pos: route.road.from + (route.road.to - route.road.from) * (0.2 + 0.3 * i),
        dir: i % 2 === 0 ? 1 : -1,
        speed: route.speed,
      });
    });
  }

  update(dt: number): void {
    for (const car of this.cars) {
      const road = CAR_ROUTES[car.routeIndex].road;
      car.pos += car.dir * car.speed * dt;
      if (car.pos > road.to - 4) {
        car.pos = road.to - 4;
        car.dir = -1;
      } else if (car.pos < road.from + 4) {
        car.pos = road.from + 4;
        car.dir = 1;
      }
      const lane = road.at + car.dir * LANE * (road.axis === 'x' ? 1 : -1);
      if (road.axis === 'x') {
        car.mesh.position.set(car.pos, 0, lane);
        car.mesh.rotation.y = car.dir === 1 ? 0 : Math.PI;
      } else {
        car.mesh.position.set(lane, 0, car.pos);
        car.mesh.rotation.y = car.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
  }

  /** Returns true if any car is within `radius` of the point. */
  hits(x: number, z: number, radius = 3): boolean {
    return this.cars.some(c => {
      const dx = c.mesh.position.x - x;
      const dz = c.mesh.position.z - z;
      return dx * dx + dz * dz < radius * radius;
    });
  }
}

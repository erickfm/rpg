import { ROAD_HALF, FACE } from './rng';

// ── THE WALKABLE NETWORK ───────────────────────────────────────────────────
//
// The crowd used to walk a LINE: a home lane on x and a direction along z, and
// it ping-ponged between two ends of the block. That is why nobody ever turned
// the corner, and why the side street had no one on it however finished it got.
//
// So the walkable world is a GRAPH now. It is built here, away from the sim, so
// the shape of the network can be read (and tested) on its own.
//
// The sidewalk in this world is ONE CONTINUOUS RING around the roadway —
// ct/tex-ground.ts builds it from a single kerb path with the walk always on its
// left. The ring is open only at the north end, where the main street runs into
// the fog:
//
//        (north, into the fog)
//            │           │
//   WEST     │           │    EAST         · west walk   x = -(ROAD_HALF+1)
//   walk     │           │    walk         · east walk   x = +(ROAD_HALF+1)
//            │           │                 · north walk  z = SIDE_Z0 + 1
//            └───┐   ┌───┘  ← CROSS_MAIN    · south walk  z = SIDE_Z1 - 1
//         NORTH  │ X │  walk ─────────      · east end    x = SIDE_X1 - 1
//         ───────┘   └────────────────
//         SOUTH walk ────────────────── (side street, east into the fog)
//
// Every coordinate below is derived from the same constants the ground is built
// from, one metre in from the kerb — the middle of the 2 m walk. Nothing here
// is hand-placed, so if the street's dimensions change the network follows.

/** one metre in from the kerb: the middle of a 2 m walk */
const IN = 1.0;
/** the north end, where the walk disappears into the fog */
const FOG_Z = 10;

/** The side street's dimensions are crosstown.ts's, not ct/rng.ts's, so they
 *  come in as arguments rather than being imported — same as ct/traffic.ts and
 *  ct/sidestreet.ts take them. */
export interface NetDims { SIDE_Z0: number; SIDE_Z1: number; SIDE_X1: number }

export interface Node {
  x: number; z: number;
  /** a name, for the probes and for reading a route in a log */
  id: string;
  /** what somebody might stop here FOR */
  act?: Activity;
}
export type Activity = 'window' | 'bench' | 'door' | 'corner' | 'none';

export interface Edge {
  a: number; b: number;
  /** this edge crosses the ROADWAY. Pedestrians only ever leave the kerb on
   *  one of these, which is what "cross at the crossing, and only at the
   *  crossing" means in practice. */
  road: boolean;
  len: number;
}

export interface Net {
  nodes: Node[];
  edges: Edge[];
  /** adjacency: node index -> [{to, edge}] */
  adj: { to: number; edge: number }[][];
  /** Shortest route between two nodes, as node indices, start included.
   *
   *  `avoid` is what makes walking ROUND something possible. Without it a
   *  re-plan is pointless: Dijkstra on an unchanged graph returns the same path
   *  through the same blocked node, so a walker that gives up and re-plans
   *  walks straight back into what stopped it. Nodes in `avoid` are treated as
   *  unavailable — except the two ends, since refusing to route to where you
   *  are going is not an alternative route, it is no route. */
  route: (from: number, to: number, avoid?: Set<number>) => number[];
  /** the nearest node to a point */
  nearest: (x: number, z: number) => number;
  /** is this edge a crossing? indices as returned in a route */
  isCrossing: (a: number, b: number) => boolean;
  /** How far either side of an edge's centre line a walker may stray. A walk is
   *  2 m wide with a kerb on one side and a shopfront on the other, so it is
   *  narrow. A CROSSING is not: it is as wide as the painted stripes, and
   *  giving it that width is what lets several people cross abreast instead of
   *  queueing through one node. */
  halfOf: (a: number, b: number) => number;
}

export function buildNet(d: NetDims): Net {
  const WEST_X = -(ROAD_HALF + IN);
  const EAST_X = ROAD_HALF + IN;
  const NORTH_Z = d.SIDE_Z0 + IN;
  const SOUTH_Z = d.SIDE_Z1 - IN;
  const EEND_X = d.SIDE_X1 - IN;
  const nodes: Node[] = [];
  const N = (id: string, x: number, z: number, act?: Activity) => {
    nodes.push({ id, x, z, act });
    return nodes.length - 1;
  };

  // ── the ring, anticlockwise from the north end of the west walk ──────────
  //
  // The `act` marks are the reason anybody goes anywhere: a window to look in,
  // the bus bench to wait at, a doorway to hesitate in. Positions are the
  // world's own — the bench is where ct/props.ts stands it (BENCH_Z = -36.6),
  // the bodega door where crosstown.ts registers its [E] spot (8.7, -96.85).
  // A citizen pausing at a window does not need to line up with a door to the
  // centimetre, so the window marks are spread along the shopfronts.
  const w = [
    N('w-fog', WEST_X, FOG_Z),
    N('w-diner', WEST_X, -14, 'door'),
    N('w-win1', WEST_X, -26, 'window'),
    N('w-alley', WEST_X, -40),                    // the alley mouth (AZ0…AZ1)
    N('w-thrift', WEST_X, -56, 'door'),
    N('w-win2', WEST_X, -70, 'window'),
    N('w-burger', WEST_X, -84, 'door'),
    N('w-corner', WEST_X, NORTH_Z, 'corner'),     // SW of the junction
  ];
  const sw = N('sw-corner', WEST_X, SOUTH_Z);
  const s = [
    N('s-win1', 6, SOUTH_Z, 'window'),
    N('s-mid', 22, SOUTH_Z),
    N('s-win2', 38, SOUTH_Z, 'window'),
    N('s-east', EEND_X, SOUTH_Z),
  ];
  const ne = N('ne-corner', EEND_X, NORTH_Z);
  const n = [
    N('n-win1', 38, NORTH_Z, 'window'),
    N('n-mid', 22, NORTH_Z),
    N('n-win2', 12, NORTH_Z, 'window'),
    N('n-bodega', 8.7, NORTH_Z, 'door'),          // the bodega's own doorway
    N('n-corner', EAST_X, NORTH_Z, 'corner'),     // the bodega corner, by the ramp
  ];
  const e = [
    N('e-win1', EAST_X, -84, 'window'),
    N('e-win2', EAST_X, -66, 'window'),
    N('e-pawn', EAST_X, -50, 'door'),
    N('e-bench', EAST_X, -36.6, 'bench'),         // the 42 stop's bench
    N('e-tax', EAST_X, -22, 'door'),
    N('e-fog', EAST_X, FOG_Z),
  ];

  const edges: Edge[] = [];
  const link = (a: number, b: number, road = false) => {
    edges.push({ a, b, road, len: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z) });
  };
  const chain = (ids: number[]) => { for (let i = 0; i + 1 < ids.length; i++) link(ids[i], ids[i + 1]); };
  chain(w);
  link(w[w.length - 1], sw);            // west walk turns the SW corner
  chain([sw, ...s]);
  link(s[s.length - 1], ne);            // up the closed east end
  chain([ne, ...n]);
  link(n[n.length - 1], e[0]);          // the bodega corner into the east walk
  chain(e);

  // ── the two crossings, and there are only two ───────────────────────────
  //
  // Both are AT THE JUNCTION, because that is where the kerb has a ramp:
  // ct/tex-ground.ts flags KRAMP on the bodega corner return only. Anywhere
  // else, stepping off the kerb would be jaywalking across an unbroken kerb
  // face, which is both wrong and invisible to the ground module.
  const crossMain = [n[n.length - 1], w[w.length - 1]];   // across the main street mouth
  link(crossMain[0], crossMain[1], true);
  // and across the side street, a few metres east of the corner so the two
  // crossings do not sit on top of each other
  const nSide = n[n.length - 2];        // n-bodega, x = 8.7
  link(nSide, s[0], true);              // s-win1 is at x = 6 on the south walk

  const adj: { to: number; edge: number }[][] = nodes.map(() => []);
  edges.forEach((ed, i) => {
    adj[ed.a].push({ to: ed.b, edge: i });
    adj[ed.b].push({ to: ed.a, edge: i });
  });

  const edgeAt = new Map<string, number>();
  edges.forEach((ed, i) => {
    edgeAt.set(`${ed.a}|${ed.b}`, i);
    edgeAt.set(`${ed.b}|${ed.a}`, i);
  });

  /** Dijkstra. The graph is ~25 nodes, so a linear scan for the next node is
   *  cheaper than a heap and much easier to read. */
  const route = (from: number, to: number, avoid?: Set<number>): number[] => {
    const dist = nodes.map(() => Infinity);
    const prev = nodes.map(() => -1);
    const done = nodes.map(() => false);
    dist[from] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = true;
      for (const { to: v, edge } of adj[u]) {
        if (avoid?.has(v) && v !== to && v !== from) continue;
        const d = dist[u] + edges[edge].len;
        if (d < dist[v]) { dist[v] = d; prev[v] = u; }
      }
    }
    const out: number[] = [];
    for (let at = to; at >= 0; at = prev[at]) { out.unshift(at); if (at === from) break; }
    return out[0] === from ? out : [from];
  };

  return {
    nodes, edges, adj, route,
    nearest: (x, z) => {
      let bi = 0, bd = Infinity;
      nodes.forEach((nd, i) => {
        const d = (nd.x - x) ** 2 + (nd.z - z) ** 2;
        if (d < bd) { bd = d; bi = i; }
      });
      return bi;
    },
    isCrossing: (a, b) => {
      const i = edgeAt.get(`${a}|${b}`);
      return i === undefined ? false : edges[i].road;
    },
    halfOf: (a, b) => {
      const i = edgeAt.get(`${a}|${b}`);
      return i !== undefined && edges[i].road ? CROSS_HALF : STRAY;
    },
  };
}

/** The walkable band across a walk, for keeping a lateral offset legal. Returns
 *  how far a citizen may stray either side of the walk's centre line, given the
 *  2 m walk, the kerb on one side and the building on the other. */
export const STRAY = Math.min(IN, FACE - (ROAD_HALF + IN)) - 0.45;

/** The same allowance for a CROSSING, which is wide where a walk is not.
 *  Pedestrians piled up at the junction because both crossings are a single
 *  edge between a single pair of nodes, so every trip across the street was
 *  funnelled through one point and people met head-on in it by construction.
 *  2.6 m of width is three lanes at the 0.9 m a walker occupies, which is what
 *  "give the crossing width and let walkers pick a lane" comes to. It is a
 *  lateral allowance rather than extra nodes on purpose: the ramp in the kerb
 *  is at ONE place (ct/tex-ground.ts flags KRAMP on the bodega corner return),
 *  so the ends must stay put even though the middle spreads out. */
export const CROSS_HALF = 1.3;

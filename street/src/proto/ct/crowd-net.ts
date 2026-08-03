import { ROAD_HALF, FACE } from './rng';
// WHERE THE PAINT IS. Imported from the module that LAYS it, so the graph
// cannot drift off the stripes again — which is item 201, the user's *"the
// pedestrians dont cross at the cross walk."* `ct/tex-ground.ts` imports only
// `./paint` and `./rng`, so this edge creates no cycle (GOTCHAS §28), and
// `crosstown.ts:18` already imports the same constant for the kerb gaps.
import { JUNCTION_CROSSINGS } from './tex-ground';

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
  // ── WHERE THE CROSSINGS ARE, TAKEN FROM THE PAINT (item 201) ─────────────
  //
  // The user: *"the pedestrians dont cross at the cross walk."* He was right and
  // it was not a freeze — measured over 240 s, 7144 of 7191 citizen-frames in a
  // carriageway were MOVING and only 47 were standing still, so people were
  // walking across the road on purpose, in the wrong place.
  //
  // The wrong place was here. These two edges used to be pinned to the corner
  // NODES — `n-corner`/`w-corner` at z -97, and `n-bodega` (x 8.7) diagonally
  // down to `s-win1` (x 6) — while `ct/tex-ground.ts` paints its stripes at
  // z -90.2 and x 10.6. Measured in the built world: the main-street paint spans
  // z -91.5..-88.9 and the crowd crossed at z -98..-96 in 5386 of 5623 samples,
  // i.e. NEVER ON IT, about 6.8 m south of the zebra.
  //
  // THE PAINT WINS, and the graph moves to it — that is the desk's instruction
  // and it is the right way round: the paint is what the user can see. The
  // ground module had already moved BOTH the stripes and the dropped kerbs here
  // (`pedCut` at tex-ground.ts:1378-1381 cuts the kerb at exactly these two
  // positions); only this file was left behind.
  //
  // DERIVED, NOT RETYPED. `JUNCTION_CROSSINGS` is the paint's own export, so if
  // the stripes ever move the walkers follow them without anybody remembering
  // to. That is the whole defect this had.
  const XMAIN_Z = JUNCTION_CROSSINGS.main.z;   // across the MAIN street, walked E-W
  const XSIDE_X = JUNCTION_CROSSINGS.side.x;   // across the SIDE street, walked N-S
  // Three of the four crossing feet sit INSIDE a walk row, because a foot is a
  // point on that pavement and the rows are chained in order — a node spliced in
  // out of sequence would link its neighbours through it backwards. So they are
  // created in place and their indices captured here, rather than being built
  // first and searched for by name afterwards.
  let wCross = -1, nCross = -1, sCross = -1;

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
    // ON THE PAINT — the west foot of the main-street crossing (item 201).
    (wCross = N('w-cross', WEST_X, XMAIN_Z, 'corner')),
    N('w-corner', WEST_X, NORTH_Z, 'corner'),     // SW of the junction
  ];
  const sw = N('sw-corner', WEST_X, SOUTH_Z);
  const s = [
    N('s-win1', 6, SOUTH_Z, 'window'),
    // ON THE PAINT — the south foot of the side-street crossing (item 201).
    (sCross = N('s-cross', XSIDE_X, SOUTH_Z, 'corner')),
    N('s-mid', 22, SOUTH_Z),
    N('s-win2', 38, SOUTH_Z, 'window'),
    N('s-east', EEND_X, SOUTH_Z),
  ];
  const ne = N('ne-corner', EEND_X, NORTH_Z);
  // ── THE JAIL FRONTAGE, which is what finally closes the ring on foot ──────
  //
  // `EEND_X` is SIDE_X1 - IN, i.e. one metre INSIDE the kerb, and that is the
  // right place for the two walk ends because their own rows (z NORTH_Z and
  // SOUTH_Z) are pavement across their whole width. It is the WRONG place to
  // walk between them: measured, the carriageway band z -98..-108 reads ground
  // 0 from x 52 to 55 and 0.14 only from x 55.5 out, so a straight line up
  // x = 54 is in the road. That is the edge I deleted.
  //
  // O's jail put a real footway on the far kerb — 1.89 m of walk against a
  // 0.72 m capsule, continuous from z -97 to -109. So the walk centre here is
  // one metre in from the kerb on the OTHER side: SIDE_X1 + IN. Derived by the
  // same rule as every other node in this file, not hand-placed, so it follows
  // the street if the street moves.
  const EWALK_X = d.SIDE_X1 + IN;
  const sj = N('se-jail', EWALK_X, SOUTH_Z);
  const nj = N('ne-jail', EWALK_X, NORTH_Z, 'door');   // the jail's own frontage
  const n = [
    N('n-win1', 38, NORTH_Z, 'window'),
    N('n-mid', 22, NORTH_Z),
    N('n-win2', 12, NORTH_Z, 'window'),
    // ON THE PAINT — the north foot of the side-street crossing (item 201).
    (nCross = N('n-cross', XSIDE_X, NORTH_Z, 'corner')),
    N('n-bodega', 8.7, NORTH_Z, 'door'),          // the bodega's own doorway
    N('n-corner', EAST_X, NORTH_Z, 'corner'),     // the bodega corner, by the ramp
  ];
  // the EAST foot of the main-street crossing, on the paint (item 201)
  const eCross = N('e-cross', EAST_X, XMAIN_Z, 'corner');
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
  // ── THE EAST END IS NOT A CROSSING AND NOT AN EDGE. THE RING CLOSES AT THE
  //    JUNCTION INSTEAD. ─────────────────────────────────────────────────────
  //
  // There used to be an edge here, s-east (54, -109) to ne-corner (54, -97),
  // straight up the closed east end. The side street's asphalt spans z
  // -98..-108, so it crossed TEN METRES OF CARRIAGEWAY. Unflagged, it made
  // walkers legal by the graph and jaywalking by the world, and it was the
  // entire residual in the in-the-road measurement (18 of ~20000 samples;
  // every other sample was a walker correctly inside a crossing's own lane).
  //
  // I flagged it as a crossing, which was the honest reading of an edge that
  // has to exist — and B painted stripes to match. THE USER DOES NOT WANT THE
  // PAINT (shots/user-remove-crosswalk.png), so the edge goes instead. That is
  // the branch the desk offered first and it is the better one: the east end
  // has no pavement and no ramp, and adding either purely to justify a node
  // would be building the world around the graph rather than the other way up.
  //
  // THE RING DOES NOT NEED THIS EDGE. South walk reaches north walk by the
  // side-street crossing at the corner (`nSide` -> `s[0]`, below), which is
  // where ct/tex-ground.ts actually flags KRAMP. Dropping this link leaves
  // s-east and ne-corner as DEAD-END STUBS at the closed end — which is what a
  // closed end is. Both still sit on pavement (s-east at z -109 is south of the
  // asphalt, ne-corner at z -97 is north of it); it was only the line between
  // them that was in the road. Nothing is orphaned: every node stays reachable,
  // proved by scripts/H-eastend-route.mjs, which routes s-east -> ne-corner and
  // reads the road flag on every hop: 9 hops / 105.6 m with ONE road hop, and it
  // is the junction crossing. With the old edge in place the same probe returns
  // 2 hops / 12 m with the road hop AT THE EAST END, so the probe distinguishes.
  //
  // Do not re-add it AS IT WAS. If the east end ever gets a real pavement, that
  // is a ground change first and a graph change second, in that order.
  //
  // ── AND IT DID. THE RING CLOSES AGAIN, ON PAVEMENT, WITH NO PAINT. ────────
  //
  // O's jail landed a west-facing frontage at x 57 with a real footway at its
  // foot — 1.89 m of walk against a 0.72 m capsule, continuous the whole height
  // of the closed end — and flagged the graph side to me rather than touching
  // it. That is the ground change, so this is the graph change.
  //
  // Three ORDINARY edges, `road` false, because none of them is a crossing:
  // out along z = SOUTH_Z to the far kerb, north up the frontage, back in along
  // z = NORTH_Z. Measured before writing: every metre of that path reads ground
  // 0.14 (pavement), while x <= 55 in the carriageway band reads 0.
  //
  // It is deliberately NOT the short way. The straight line between the two
  // walk ends is 12 m up the middle of the road; this is ~16 m round three
  // sides of the frontage, and a walker takes it because it is the only way
  // that exists rather than because it is quick — which is what a closed end
  // with a building on it should feel like.
  chain([s[s.length - 1], sj, nj, ne]);
  chain([ne, ...n]);
  // The bodega corner into the east walk, THROUGH the east foot of the main
  // crossing (item 201). `eCross` is declared with the other crossing feet
  // rather than inside the `e` row because it is not a shopfront stop — it is
  // the point the crossing lands on, and the row is a list of places people go.
  chain([n[n.length - 1], eCross, e[0]]);
  chain(e);

  // ── the two crossings, and there are only two ───────────────────────────
  //
  // ⚠ THE OLD COMMENT HERE SAID both crossings were at the junction "because
  // that is where the kerb has a ramp: ct/tex-ground.ts flags KRAMP on the
  // bodega corner return only." THAT IS STALE AND IT IS WHY THIS BUG SURVIVED.
  // The ground module now cuts a pedestrian ramp at each PAINTED crossing —
  // `pedCut(-ROAD_HALF, XA_Z, …)`, `pedCut(ROAD_HALF, XA_Z, …)`,
  // `pedCut(XB_X, SIDE_Z0, …)`, `pedCut(XB_X, SIDE_Z1, …)` at
  // tex-ground.ts:1378-1381 — so all four feet below have a dropped kerb, and
  // the corner is no longer the only place you may legally step off.
  //
  // Both edges now run FOOT TO FOOT ACROSS THE PAINT, square to the kerb.
  // Neither is a diagonal any more: the side crossing used to run from
  // `n-bodega` (x 8.7) to `s-win1` (x 6), drifting 2.7 m sideways while it
  // crossed, so even the half of it that touched the stripes left them again.
  link(wCross, eCross, true);           // across the MAIN street, on z = XMAIN_Z
  link(nCross, sCross, true);           // across the SIDE street, on x = XSIDE_X

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

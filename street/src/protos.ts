import type { ProtoFactory } from './proto/types';
import { makeCrosstown } from './proto/crosstown';

// The winner: CROSSTOWN '97. The whole-world build lives here now.
// (Losing studio prototypes remain in src/proto/ for reference.)

export const REGISTRY: { key: string; name: string; make: ProtoFactory }[] = [
  { key: 'crosstown', name: 'CROSSTOWN ’97', make: makeCrosstown },
];

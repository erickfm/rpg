#!/usr/bin/env node
// ITEM 196 — the row's hard constraint: "the width total is still 23.55".
//
// ct/apartment.ts pins the player's own front door to a fixed z, and both
// side-street rosters stop dead on x = 57, so the two frontages may be
// redistributed between themselves but their SUM must not move. Asked of the
// running world (`__ct.frontages`/`sites` are not it — the spans the signage
// was placed from are, so this reads the declared doors and the roster instead)
// and of ct/street.ts's roster, which is where the numbers live.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../src/proto/ct/street.ts', import.meta.url), 'utf8');
const w = (nm) => {
  const m = src.match(new RegExp(`nm: '${nm}'[^}]*?w: ([\\d.]+)`));
  return m ? +m[1] : NaN;
};
const hotel = w('HOTEL ORPHEUS'), casino = w('SEVENS');
const total = +(hotel + casino).toFixed(4);
console.log(`\n  HOTEL ORPHEUS  w ${hotel}`);
console.log(`  SEVENS         w ${casino}`);
console.log(`  TOTAL          ${total}   (must be 23.55)\n`);
process.exit(total === 23.55 ? 0 : 1);

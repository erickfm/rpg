// THE CALENDAR'S COPY OF THE LEASE MUST STILL EQUAL THE LEASE.
//
// `ct/apartment.ts` draws a biro ring on rent day and writes the amount and the
// landlord's name under it. Those four values belong to `ct/tenancy.ts`'s
// `RENT`, and BUILDER-BRIEF §8 says import rather than retype — but the import
// cannot be written: `ct/tenancy.ts:4` imports `APT_X0/APT_Z0/ST0` FROM
// `ct/apartment.ts`, so importing back closes a cycle, and GOTCHAS §28 is that
// a module in a cycle can be dropped from the BUILT BUNDLE ONLY. Dev would look
// perfect and the artifact would be missing a module.
//
// §8's escape hatch is "copy it with a line-number citation and queue a
// follow-up". This is the third thing it should have said: MAKE THE COPY
// FAIL LOUDLY WHEN IT DRIFTS. A duplicated constant that nothing compares is
// how `bedcavity.mjs` spent a week measuring a truck that no longer existed.
//
// SOURCE TEXT, not the running world, and deliberately: neither module
// publishes these numbers to `__ct`, so there is nothing to ask at runtime.
// That is a weakness worth naming — this checks that the two FILES agree, not
// that the world uses either — and it is still the difference between a drift
// that is caught in one run and a drift nobody ever finds.
//
// Exit 0 agree · 1 drifted · 3 could not measure (GOTCHAS §32).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEN = join(ROOT, 'src/proto/ct/tenancy.ts');
const APT = join(ROOT, 'src/proto/ct/apartment.ts');

let tenSrc, aptSrc;
try {
  tenSrc = readFileSync(TEN, 'utf8');
  aptSrc = readFileSync(APT, 'utf8');
} catch (e) {
  console.log(`COULD NOT READ THE SOURCES: ${e.message}`);
  process.exit(3);
}

/** `export const RENT = { ... } as const;` — the authority */
const rentBlock = tenSrc.match(/export const RENT = \{([\s\S]*?)\} as const;/);
/** `const LEASE = { ... } as const;` — the copy */
const leaseBlock = aptSrc.match(/const LEASE = \{([^}]*)\} as const;/);
if (!rentBlock || !leaseBlock) {
  console.log(`COULD NOT FIND THE DECLARATIONS — RENT ${!!rentBlock}, LEASE ${!!leaseBlock}.`);
  console.log('One of them was renamed or reshaped. That is a real change, not a pass.');
  process.exit(3);
}

const field = (block, name) => {
  const m = block.match(new RegExp(`(?:^|[\\s,{])${name}:\\s*('[^']*'|"[^"]*"|[-\\d.]+)`, 'm'));
  return m ? m[1].replace(/['"]/g, '') : null;
};

const FIELDS = ['firstDay', 'everyDays', 'amount', 'landlord'];
let bad = 0, read = 0;
for (const f of FIELDS) {
  const a = field(rentBlock[1], f);
  const b = field(leaseBlock[1], f);
  if (a === null || b === null) {
    console.log(`  ?? ${f.padEnd(10)} tenancy=${a} apartment=${b}  — NOT FOUND, so NOT CHECKED`);
    bad++;
    continue;
  }
  read++;
  const same = a === b;
  if (!same) bad++;
  console.log(`  ${same ? 'ok' : 'XX'} ${f.padEnd(10)} tenancy=${a}  apartment=${b}`);
}

if (!read) {
  console.log('\nZERO fields compared. A check that examined nothing is not a pass (GOTCHAS §34).');
  process.exit(3);
}
console.log(`\n${read - (bad - (FIELDS.length - read))}/${FIELDS.length} fields agree`);
if (bad) {
  console.log('THE CALENDAR IS LYING ABOUT THE RENT. Fix ct/apartment.ts\'s LEASE, or');
  console.log('better, hoist RENT into a leaf module neither file imports and delete the copy.');
  process.exit(1);
}
console.log('ct/apartment.ts LEASE == ct/tenancy.ts RENT');

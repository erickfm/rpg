/**
 * ══ WHAT THE STREET'S BUSINESSES ACTUALLY SELL ═════════════════════════════
 *
 * *"is the add for the diner accurate to the diner?"*   (2026-08-07)
 *
 * IT WAS NOT. The takeaway menu that arrives in your mail listed two eggs at
 * 1.95, a short stack, grilled cheese, chili, meatloaf and liver + onions —
 * eight dishes, of which the diner sold **none**, at prices from before the
 * world was rescaled x4 against a $500 season's rent. The same fault, one
 * building along: FIRST FEDERAL's pre-approval letter offered 24.9% APR while
 * the loan officer twelve feet inside the door quotes 9.75% on the same $2,500.
 *
 * An advertisement is a SECOND READER of a shop's prices, exactly like the rate
 * board beside the officer's desk — and GOTCHAS §20 has already been paid for
 * four times over here: a number that has to agree with another number belongs
 * in ONE of them. So the numbers live in this file, the shop reads them to build
 * its counter, and the mail reads them to print its ad. They cannot drift,
 * because there is only one of each.
 *
 * ⚠ THIS FILE IS A LEAF AND MUST STAY ONE. `ct/tenancy.ts` imports it at module
 * scope, and tenancy is imported by `interior.ts`, which every room imports —
 * so importing a room (or anything that reaches one) from here would close a
 * cycle through the mail. The one import below is `import type`, which is erased
 * at compile time and carries no runtime edge.
 */
import type { ShopColumn } from './shop';

/**
 * THE DINER'S BOARD OVER THE PASS. `ct/int-diner.ts` paints this onto the black
 * letter board and hangs `shopCounter` on it; `ct/tenancy.ts` prints the same
 * six dishes on the green takeaway menu that comes through the letterbox.
 *
 * A diner is dearer than the burger barn and that is the only pricing statement
 * the room makes: the coffee is the barn's $2.50, the shake is $6.00 against the
 * barn's $5.00 and the pie $5.50 against $2.75 — you are paying for the stool.
 */
export const DINER_MENU: ShopColumn[] = [
  { head: 'BREAKFAST', lines: [
    { id: 'EGGS', name: 'EGGS', price: 9.00 },
    { id: 'COFFEE', name: 'COFFEE', price: 2.50 },
  ] },
  { head: 'PLATES', lines: [
    { id: 'PLATTER', name: 'PLATTER', price: 15.00 },
    { id: 'PIE', name: 'APPLE PIE', price: 5.50 },
  ] },
  { head: 'FOUNTAIN', lines: [
    { id: 'SHAKE', name: 'SHAKE', price: 6.00 },
    { id: 'SODA', name: 'SODA', price: 3.50 },
  ] },
];

/**
 * WHAT FIRST FEDERAL LENDS, AND AT WHAT PRICE.
 *
 * THREE readers now: the loan officer at her desk, the RATE BOARD on the east
 * wall (both `ct/int-bank.ts`), and the pre-approval letter in the mail
 * (`ct/tenancy.ts`). The rate FALLS AS THE AMOUNT RISES, which is true of a 1997
 * personal loan and is the reason the amount is worth choosing at all.
 */
export const LOAN_AMOUNTS = [200, 500, 1000, 2500, 5000];
export const LOAN_RATE: Record<number, number> = {
  200: 13.5, 500: 12.5, 1000: 11.25, 2500: 9.75, 5000: 8.9,
};
/** the best rate on the sheet — what an advertisement quotes, "rates from" */
export const LOAN_BEST_RATE = Math.min(...Object.values(LOAN_RATE));
/** the largest sum the bank will advance — the other half of an ad's headline */
export const LOAN_MAX = Math.max(...LOAN_AMOUNTS);
export const LOAN_MIN = Math.min(...LOAN_AMOUNTS);

/**
 * A shop board, printed as an advertisement reads it: a heading on its own line,
 * then `NAME|0.00` per dish, which is the `dish|price` form the menu and flyer
 * painters in `ct/tenancy.ts` already split on.
 */
export function adLines(cols: readonly ShopColumn[]): string[] {
  const out: string[] = [];
  for (const c of cols) {
    out.push(c.head);
    for (const ln of c.lines) out.push(`${ln.name}|${ln.price.toFixed(2)}`);
  }
  return out;
}

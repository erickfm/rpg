# Item 229 — four dead canfail cases, and what killed them

**Worker eightyfour, 2026-08-03. Port 4400** (`ss -ltn` clean before binding,
`--strictPort`, held all session). Build `050733a20`.

The row was **right in every clause** — four cases, named correctly, all
`matched 0x`, pre-existing. What it could not know is that **three of the four
died in a single commit**, and that the commit did not rename anything. It moved
the work into a shader.

---

## 1. What each case was quoting, and where it went

| case | file | why it matched 0× |
|---|---|---|
| `rulings-atm` | `ct/bank.ts` | the eight ATM fascia numbers were **hoisted into `ct/atm-face.ts`**; `ct/bank.ts:250` now reads `KERB_H + ATM_FACE.bot` |
| `grade-twice` | `ct/props.ts` | `544053b20` — the pool's **warm term moved into `POOL_FRAG`** |
| `grade-nan` | `ct/props.ts` | same commit — `POOL_GAIN` went 12 → **6.5**, and stopped reaching a colour |
| `glow-pool` | `ct/props.ts` | same commit — `POOL_GAIN` went 12 → **6.5** |

`544053b20` is *"w45/95: lamplight per fragment, so a surface is lit because of
where it is"*. The CPU pass now owes a pooled material only its ambient —
`ct/props.ts:1494` is the whole of it:

```ts
e.m.color.setRGB(e.base.r * amb, e.base.g * amb, e.base.b * amb);
```

**That is not a moved line, it is a moved language.** Both `grade-sane.mjs` and
`glow.mjs` read `material.color` out of JS. A fragment shader is invisible to
them.

## 2. All four re-pointed, and each one CAUGHT for the right reason

None retired — all four are live questions, so all four follow their subject.

- **`rulings-atm` → `ct/atm-face.ts`**, quoting the `ATM_FACE` declaration and
  putting `bot` back to the pre-ruling 0.90. The case follows the *number*,
  which is what it was always about. `CAUGHT`.
- **`grade-twice` → the non-pool branch** (`ct/props.ts:1417`), applying the warm
  term twice. `CAUGHT` — and hand-verified for the *reason*, not just the exit
  code: `colour 1.3225 over the 1.155 grade ceiling`, **2692 impossible values**.
  **A single `WARM_R` would have been INERT**: `base * amb * 1.15` tops out at
  1.15, which is *under* the 1.155 bar. Measured, not assumed.
- **`grade-nan` → `ambient()`** (`ct/props.ts:580`), which is multiplied into
  every lit material on both branches — the same blast radius the original had.
  `CAUGHT`, again for the right reason: `NaN colour`, **113811** of them.
  Re-quoting `POOL_GAIN` would *not* have worked: its only surviving CPU consumer
  is `mul`, and `mul` no longer reaches a colour — it exists solely to set
  `poolLit` (`ct/props.ts:1479`). NaN in a boolean compare is `false` and a
  perfectly finite frame. **The obvious repair would have been vacuous.**
- **`glow-pool` → `const POOL_GAIN = 6.5;`**. Re-quoted, meaning unchanged.
  **But see §4 — this one certifies nothing today, and I have said so in the
  case's own comment rather than banking the green.**

`mutations-quote-real-source`: **4 DEAD → all 62 needles quote live source**,
exit 1 → 0.

## 3. A 0× match now aborts BEFORE the run, not after it

canfail already scored a stale needle honestly — verdict `NEEDLE`, kept out of
the caught count, listed by name, non-zero exit. **None of that was wrong. The
defect was *when*.** It arrived at the end of a build-and-browser-per-case run
over ~62 cases, as a `????` line in a list. That is exactly how four of them
survived a week in which this tool was signing off everybody else's repairs.

A needle is a string in a file. It is now audited for every selected case
**before the first build**, and a rot aborts.

**Exit 3, not 1, and the difference is the point (GOTCHAS 32).** 1 means *"I
measured your guards and one is asleep"* — a fact about the world. This is *"I
cannot measure them at all, because my own quotations no longer match"* — a
fault in canfail. Reporting the second as the first is what sends somebody to
rewrite a check that works.

Proved both signs, and the **ordering**, by pointing `SHOT_URL` at a dead port:

```
rotted needle + dead port  -> needle message wins   (so it precedes build AND server check)
good needle   + dead port  -> "NOTHING IS SERVING"  (so a live needle is not rejected)
```

## 4. `scripts/canfail-args.mjs` — the row seventynine asked for

Registered in `checks.mjs` (fast tier, no browser, one ~0.7 s build). **17
assertions, 5 invocations of canfail**: unknown name → exit 2; flag-shaped
argument → exit 2; **valid + invalid together, naming only the invalid one**
(the discrimination control — legs 1 and 2 pass just as happily on a tool that
refuses *everything*); a rotted needle → exit 3 for that reason; and a positive
control with no arguments at all, which audits all 62 needles and must reach
`NOTHING IS SERVING`.

**It can fail — driven, not asserted.** Two mutations to `canfail.mjs`,
restored byte-for-byte after each:

| mutation | result |
|---|---|
| unknown-name refusal disabled (item 224's fix removed) | **6 of 17 red** |
| needle pre-flight blinded (item 229's gate removed) | **3 of 17 red** |
| unmutated | **17/17 green, exit 0** |

**The mutation run found a defect in my own guard.** Blinding the pre-flight let
the run fall through to the dead port, which *also* exits 3 — so the leg
`aborts, exit 3` stayed **green over a gate that had been removed**. Exit code
and reason are now asserted together. Only two legs caught it before that.

**And my probe lied on its first run**, in the way the brief warns about: the
assertion *"never prints `0/0 checks caught their mutation`"* went red against a
**correct** refusal, because canfail's refusal message *quotes* the vacuous
output it exists to prevent (`canfail.mjs:1375`). The guard was reading the
explanation of the bug as the bug. Now anchored to the start of a line.

---

## 5. FOUND, NOT FIXED — two checks lost their subject to `544053b20`

Both are outside item 229 (BUILDER-BRIEF §9). **Both want rows.**

### 5a. `glow.mjs` is RED on mainline and it is a FALSE ALARM

Unmutated, on `cd5afdd8f`, **five runs, byte-identical every time**:

```
FAIL main street: under a lamp 0.0450 vs mid-block 0.0450 — 1.0x (59/164 samples)
OK   side street: under a lamp 1.0000 vs mid-block 0.0857 — 11.7x (8/161 samples)
```

Its pool clause reads `mat.color`, which is now `base * amb` — and **`amb` is
per-FLOOR, not per-lamp**, so near and far on one floor are equal *by
construction*. **1.0x is the only answer that sampling can give.**

**The feature itself works.** I asked the renderer instead
(`scripts/probes/w84-is-the-lamp-pool-real.mjs`, looking down at the pavement):

| hour | under a lamp | mid-block, 6 m | ratio |
|---|---|---|---|
| 13:00 (control) | 0.3877 | 0.3925 | **0.99x** |
| 23:00 | 0.2839 | 0.2094 | **1.36x** |

And I looked at the frames — `shots/w84-pool-under-a-lamp-23.png` versus
`shots/w84-pool-mid-block-m-along-23.png`. Under the lamp the kerb and paving
carry a warm sodium wash; 6 m along, the same surfaces are near-black and cold.
Both at 23:01. (1.36x *understates* it — the player's forearm fills the lower
right of both frames.)

> **So a red on the board is a check reading a CPU quantity for a phenomenon
> that now lives in a shader. The fix belongs in `glow.mjs`, not in the world.**

**Consequence for `glow-pool`, which I did not paper over:** canfail scores
CAUGHT on any non-zero exit, so a case over an **already-red** check goes "red"
under every mutation and **certifies nothing** — item 224's empty-set
certificate, one level out. `glow-pool` is re-pointed (so it stops matching 0×)
with that stated in full in its own comment.

### 5b. `grade-sane.mjs`'s ceiling clause is now VACUOUS

Its header records *"20 of 5536 through the night, 156-166 at the four ramp
hours, worst 1.1497 at 23:00"*. Measured today:

```
swept 24 hours, 10962 materials each — 0 impossible values
deliberately over 1.0: 0 material-hours, peak 0.0000 — none
```

**Zero, not twenty.** Nothing in the world approaches the 1.155 ceiling on the
CPU any more, so the clause *"nothing is warmed twice"* is green over a
population in which it cannot fail — in a check whose own header is a
thirty-line argument against vacuous passes. It still has real work (NaN,
negative, opacity — `grade-nan` proves that), but the clause it is *named* for
needs to read the shader or be retired.

### 5c. Smaller

- **canfail's INERT detection assumes mutations target `src/`.** It compares
  built-bundle hashes, so a case mutating anything under `scripts/` would be
  scored INERT whenever the check correctly stays green. Nothing does this
  today; it is why `canfail-args` is registered with no canfail case of its own.

---

## Gates

`tsc --noEmit` **0** · `npm run build` **0** · `health.mjs` **0 WORLD OK** ·
`npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE, exit 0** ·
`checks.mjs --only canfail-args` **✓**.

`git status` clean; every file canfail wrote was verified back byte-for-byte
(`git diff --stat` empty after each mutation run).

**Files outside the item I touched:** none of the world. `scripts/checks.mjs`
(one registry row, named by the item), `scripts/canfail.mjs` (named),
`scripts/canfail-args.mjs` (new), `scripts/probes/w84-is-the-lamp-pool-real.mjs`
(new, one-shot, per BUILDER-BRIEF §7a). **`ct/props.ts`, `ct/atm-face.ts` and
`ct/bank.ts` were mutated and restored, never edited.**

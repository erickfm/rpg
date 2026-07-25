# For C and the desk — the 7.4% you cite is withdrawn, and your own next sentence is why

`notes/C-lot.md:243` cites `3d71b035` for *"a jumped clock is 7.4% brighter than
the night a player reaches"*. **That finding is mine and I withdrew it in full**
(`9241a2f06`). Both halves were rain: the helper routed via 20:00, 20:00 rained
under that day's `rainAt`, and I was comparing a wet night with a dry one while
believing I was comparing two clock paths. `e0c68e46` replaced `rainAt`, 20:00
went dry, and the same measurement re-run gave **0.2%**.

**Your note does not need the citation, because the sentence after it is the
real mechanism, found independently:**

> *"the world never offers a dry spell longer than 8 hours and so a stepped
> arrival always follows recent rain"*

That is exactly right and it is a better statement than mine ever was. It
explains why stepping ever appeared to matter, it predicts when it will and will
not reproduce, and it does not depend on a particular day's weather. **Your
conclusion is untouched** — the ratio holding at 0.84–0.91 is what the section is
for, and nothing here moves it. What wants deleting is the *attribution*: the
effect you measured is your dry-spell finding, not my clock-path one.

## Re-measured at HEAD, since a withdrawal is worth less than a number

Every transparent material in the world, jumped straight to 23:00 versus stepped
via 20:00:

```
381 compared        0 differ
```

With the control that stops that zero being vacuous — day versus jumped 23:00,
same 381 materials:

```
296 differ    street=34  vice=210  props=50  lot=2
```

props's 50 splash sheets are in that 296. The probe sees them change; they do
not care how the clock arrived. **There is no night state to arm.**

## What actually survives, and it is the inverse

Do not step to *arm* anything. Step — or rather call `setNight` — because an
hour reached by any route may have passed through a **wet** one, and then your
night measurement is a wet night. `setNight` asks `scene.userData.rainAt` for an
evening hour the world says is dry, so it cannot happen by accident.

## Why this leaked, which is the part worth keeping

The correction existed. `setNight` in `lib/clock.mjs` has carried the corrected
version for some time — *"stepping does nothing … a jump is not deficient."*

It was thirty lines below `setClock`, whose doc comment still stated the
retracted claim as measured fact. **The correction landed under the helper
nobody calls directly, while the withdrawn claim stayed on the function
everybody does.** So every builder who read the file top-down got the wrong
version, and at least one of them wrote it into a note. Fixed at both sites now.

`6ce778e4a` writes down the rule that stops the citation leak. This is the same
leak one layer up: **withdrawing a finding in the commit that measured it does
not withdraw it from the places that already repeated it.** A retraction has to
travel to every site that states the claim, and the site that matters most is
the one with the highest readership — not the one where the mistake was made.

I have not edited `C-lot.md`. It is not mine and the change is one line.

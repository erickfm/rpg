# `m.userData.printed` — the isSelfLit opt-out C asked for

For **C**. Your ask, from FEATURE-REQUESTS: *"an opt-out `isSelfLit` honours — a
userData flag meaning 'printed, not lit, grade me'."* It is in `ct/props.ts` now.
Nothing in your file has changed; this is the half that had to land first.

```ts
m.userData.printed = true;   // this sheet is INK, not a light — grade me like masonry
```

## It takes the MATERIAL now, not the texture

`isSelfLit(t)` became `isSelfLit(m)` and reads `m.map` itself. That is deliberate:
the opt-out is checked before anything else, so a future caller holding a texture
cannot route around it. One call site, changed with it.

`cLight` is the opposite flag and stays yours — set by hand where a thing really
is a light. `printed` is the "no it isn't" for the ~40 that only look like one.

## Watched it work, not just written

I cannot edit `ct/lot.ts`, so I proved it from my own file: a temporary block in
`dimWorld` stamped `printed` on every lot material, measured, then came out
again.

```
                    selfLit        mean night luminance
lot   before          41/242              0.2058
lot   with flag        2/242              0.0557      <- 3.7x darker
street  (untouched)   38/419              0.1259      unchanged
vice    (untouched)   27/62               0.5579      unchanged
```

The yard goes dark and nothing outside the lot moves. The experiment is gone —
`grep TEMPORARY src/proto/ct/props.ts` returns nothing, and the reverted numbers
are byte-identical to the baseline.

**And it is inert until you set it**, which I checked by stashing rather than by
reasoning about it:

```
                    mods-dim   rows   lot selfLit   lot luminance
without my change    exit 1     10      41/242         0.2058
with my change       exit 1     10      41/242         0.2058
```

So landing this changes the world in no way at all until `lot.ts` opts in. Your
`mods-dim` stays red in the meantime, reporting the same 47 materials it always
did — that is your open bug still being open, not a regression from me.

## One thing I saw and did NOT explain

With `printed` stamped on all 242, **two materials stayed `selfLit`**. I did not
chase it and I am not going to guess at the cause in a note you have to rely on.

The practical consequence is the same either way, so take it as advice rather
than as a diagnosis: **set the flag where the material is created, not in a
post-pass.** If a material is shared with another module, whichever module the
grade reaches first wins, and a late stamp can arrive after the decision. That
is the same shape as the weed-tuft problem — one material worn in many places
cannot carry a per-place answer — so it is at least a plausible neighbour.

## The user-facing reason this matters

It serves a request the user made in their own words: *"make the unilluminated
stuff darker. it should feel scarier at night"*. Forty printed sheets held at
full daylight over a black yard is the most visible remaining exception to it.

Your own measurements are what make the case, and I want to restate the sharp
one: the lot salesman at **13.2%** hot is classed as a light and dims **0.0%**,
while a street pedestrian at **23%** hot — same `citizenSprite`, same atlas
generator — is classed as masonry and dims **95.5%**. A hotter sheet called "not
a light" and a cooler one called a light is proof the threshold is not what
decides. No better number fixes that; a hand flag does.

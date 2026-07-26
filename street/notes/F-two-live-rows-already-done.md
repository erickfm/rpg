# F → C and K: two of the three LIVE rows left on the board are already done

The whole board is down to three LIVE rows. I have direct evidence on two of
them, gathered while verifying, and both look delivered. Passing it on before
anyone builds something that exists.

## C — "the tv bezel looks good but i think i want the tv black" — ALREADY BLACK

Checked at 03:08 from the published `sit on the bed and watch TV` spot. The
casing is black. `shots/f-verify-tv-now.png`.

The tag also shows the set has grown state since the earlier version:

    userData.tv = { seg: "psychic line", i: 10, left: 2.23,
                    pool: 20, on: true, warming: false }

`on` and `warming` are new — the set models switching on and warming up, which
nobody asked for and which is exactly right for a 90s portable.

**If you already did this, the row just needs moving.** If you were about to,
look first.

## K — "when the player goes to sleep i want the screen to fade to black" — IT FADES

Measured through the transition, sampling every 350 ms:

    awake before   15198
    darkest during  2257   (85% down)
    awake after    15876

It fades *through* black rather than cutting, and comes back brighter — right
for waking at 07:00 having slept at 22:30. Full working and the caveat on my
instrument are in `notes/F-verify-sleepfade.md`.

**Caveat, stated plainly:** JPEG size is a luminance *proxy*. The shape of the
series — bright, collapse, bright — is what convinces me, not the single
number. If you want it airtight, have the fade publish its own opacity as
`userData`; that is the tag-and-assert that settled the TV ads after two
failed attempts.

## C — "how do i stop watching the tv" — the exit EXISTS, the discoverability does not

`[E]` cycles to `stand up`. Leads on why it is missed are in
`notes/F-for-C-tv-exit.md`. The slots cabinet solves the same problem by
printing its key legend on screen (`SPACE spin · B bet · ... · ESC`), and the
bank solves it in a label (*"ask about a loan — the officer's desk is by the
window"*). `[E] stand up — stop watching` would do it here.

This is the only one of the three I think is genuinely still open.

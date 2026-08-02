# scripts/probes — one-shot measurements, kept as evidence

Nothing in here is a live instrument. These are the throwaway scripts agents
wrote to answer one question once — *is this gap passable, did that texture
change, does the door open from the hall* — and then never ran again.

They are kept rather than deleted because the handoff notes in
`notes/archive/` cite them by name as the evidence for a finding. Deleting them
would turn a lot of "measured, here is the script" into "trust me".

**Nothing here is maintained.** A probe references the world as it was the day it
was written; the belt has shifted twice since some of them ran. If you want a
number today, write a fresh probe — do not resurrect one of these and believe it.

## Where your new probe goes

**Here, not in `scripts/`.** `scripts/` had grown to 797 files, of which about 30
were things anyone actually ran; finding `bugsweep.mjs` in that list was the
problem. A one-shot probe belongs in `probes/`, named for the question it
answers.

A script earns a place in `scripts/` proper only when something *calls* it — a
`package.json` entry, a shell wrapper, another script's import, or a standing
instruction in `notes/`. Until then it is a probe.

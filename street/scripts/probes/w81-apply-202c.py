# one-shot edit for item 202c: replace crosstown.ts's two .find() collider
# blocks with a single per-kind loop. Kept in probes/ because BUILDER-BRIEF
# §7a says a one-shot script lives here; it is not meant to be run twice.
import io, sys

p = 'src/proto/crosstown.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // ── item 29: A ROUTE ONTO THE ROOF')
end = s.index('  props.dimWorld(scene);')
new = io.open('scripts/probes/w81-202c-block.ts.txt', encoding='utf-8').read()
s = s[:start] + new + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('replaced %d chars with %d' % (end - start, len(new)))

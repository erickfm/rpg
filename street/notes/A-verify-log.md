# Second-verifier log — A

Rows I have checked, and the ones I could not. **I may not confirm my own** —
the bank facade and the flat-colour class are mine and are the auditor's.

## CONFIRMED

**C — "top right part of window frame" (301).** Station: inside room 301, three
positions a player uses — square on at 2.4 m, offset at 1.6 m, hard against the
glass at 0.75 m. Corner clean from all three. Also checked structurally, since
z-fighting is view-dependent: C's "share no volume" is not literally true (a
0.03x1.44x0.075 solid still shares 0.03 x 0.0525 x 0.075 m with a
0.03x0.075x1.49 one) but an overlap only z-fights where faces are coplanar and
same-facing, which I did not establish. Recorded in the row, not filed as a
fault.

## COULD NOT VERIFY — left LANDED, nobody is at fault

**E — "side benches have backs which are backwards?"**

I could not establish which benches are the park's, so I have no population to
judge and I am not marking this either way. Two attempts:

1. **`pose.x < -7.5`** — swept in STREET benches. The first one I sat on put me
   on the pavement by the car lot with the bunting and "$9 DOWN WE FINANCE" in
   frame. `shots/A-vpark-sit0.png` is that bench, and it is not in the park.
2. **`userData.mod === 'park'`** — **zero meshes carry it.** The park is not
   stamped, so the attribution route that works for street, vice and civic is
   not available here.

My scoring test was also the wrong question even with a right population: I
measured "does the sitter face the park CENTROID", and a bench beside the
fountain or along a path legitimately does not. The user's complaint was that
the BACKRESTS are backwards — that the back is in front of you — which is a
different test and needs no centroid.

**This is not evidence against E.** E verified by sitting in each and reports
9/9 with a positive control (old yaw → "4 of 9 face out"), which is a better
method than mine. Somebody with the park's own bench list should take it.

**What would make this verifiable by anyone:** stamp `userData.mod = 'park'` on
the park's meshes, the way `ct/street.ts` does with `stampFrom`. Every other
large module is attributable and the park is not, which is why an outside
checker cannot find its furniture.

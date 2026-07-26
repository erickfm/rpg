// THE OCCLUSION ORACLE, INSTALLED INTO THE PAGE AS `window.__dSee`.
//
// Shared because two checks need it — D-sightline-pairs.mjs (can you select
// through an obstruction) and D-look-selects.mjs (does the gaze cone select at
// range). A second copy is how the two would drift apart: `gapRule()` lives on
// `__ct` for exactly that reason, after its two implementations disagreed about
// a near-degenerate pair and put a whole corridor in doubt. One implementation,
// no drift.
//
// EYE HEIGHT IS THE CALLER'S, and that is a scar. This oracle used to hardcode
// `1.6` because crosstown.ts's `canSee` did, and it was WRONG IN BOTH PLACES:
// the aim is storey-aware (`groundPick + 1.1`) while the eye was not, so above
// the ground floor the ray was cast from inside the ground floor and every
// `[E]` upstairs was dead. C found it; my own checks could not, because they
// had copied the constant from the code under test and therefore agreed with
// it — they skipped every upper-floor spot as "no clear line" rather than
// failing. **An oracle that shares the implementation's assumptions is
// independent only about the code path, not about the assumptions.** So the
// eye is a parameter now and callers pass `gy + 1.6`.
//
// It answers the question crosstown.ts's `canSee` answers, with the same three
// numbers — eye at the player's own storey plus 1.6, aim 1.1 m above the spot's own ground, stopping 0.35 m
// short so the thing itself is not its own blocker — because those numbers ARE
// the invariant as landed, and an oracle using different ones would report
// disagreements that are only conventions. What it does NOT share is the code
// path: the page publishes no `three` (see E-coplanar.mjs), so this is its own
// exact segment-triangle intersection.
//
// EVALUATED FRESH ON EVERY CALL, deliberately. Citizens walk the block and
// re-face the player every frame, so an oracle that measures the scene once and
// judges a prompt seconds later reports people who have since moved as
// permanent walls. That cost two phantom leaks before it was caught.
//
// Two things a reimplementation gets wrong, both of which make the WORLD look
// broken when the fault is in the probe (GOTCHAS §48):
//   - WINDING. THREE.Raycaster honours `material.side`, so a FrontSide face is
//     invisible to a ray arriving from behind; a plain Möller–Trumbore is not.
//     Sides resolve per geometry GROUP, because a shopfront box wears an array
//     and its faces genuinely differ.
//   - INVISIBLE MATERIALS are not blockers, matching canSee's own filter.

/** Install `window.__dSee(eye[3], aim[3]) -> { t, who }` on the page.
 *  `t` is the distance to the nearest blocker, or < 0 for a clear line;
 *  `who` names it, so a report can say what it saw through. */
export async function installSee(page) {
  await page.evaluate(() => {
    const scene = window.__ct.scene();
    const hitTri = (o, dir, len, a, bb, c, side) => {
      const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const p = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
      const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-10) return -1;            // parallel — grazing is not blocking
      // matches THREE: FrontSide is not hit from behind, BackSide not from the front
      if (side === 0 && det < 0) return -1;
      if (side === 1 && det > 0) return -1;
      const inv = 1 / det, s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
      const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
      if (u < 0 || u > 1) return -1;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const v = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) * inv;
      if (v < 0 || u + v > 1) return -1;
      const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
      return (t > 1e-4 && t < len) ? t : -1;
    };
    // nearest blocker between eye and aim, or t < 0 for a clear line
    window.__dSee = (eye, aim) => {
      scene.updateMatrixWorld(true);                   // NOW, not at discovery
      const dir = [aim[0] - eye[0], aim[1] - eye[1], aim[2] - eye[2]];
      const dist = Math.hypot(dir[0], dir[1], dir[2]);
      if (dist < 0.45) return { t: -1, who: '' };      // standing on it
      for (let k = 0; k < 3; k++) dir[k] /= dist;
      const far = dist - 0.35;                         // the thing itself is not a blocker
      const bl = [Math.min(eye[0], aim[0]) - 1, Math.min(eye[1], aim[1]) - 1, Math.min(eye[2], aim[2]) - 1];
      const bh = [Math.max(eye[0], aim[0]) + 1, Math.max(eye[1], aim[1]) + 1, Math.max(eye[2], aim[2]) + 1];
      let best = -1, who = '';
      scene.traverse((n) => {
        if (!n.isMesh || !n.geometry || !n.geometry.attributes || !n.geometry.attributes.position) return;
        if (n.visible === false) return;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        if (!mats.some((m) => m && m.visible !== false)) return;
        const e = n.matrixWorld.elements;
        if (e[12] < bl[0] - 30 || e[12] > bh[0] + 30 || e[14] < bl[2] - 30 || e[14] > bh[2] + 30) return;
        const pos = n.geometry.attributes.position, idx = n.geometry.index;
        const xf = (i) => {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          return [e[0] * x + e[4] * y + e[8] * z + e[12],
                  e[1] * x + e[5] * y + e[9] * z + e[13],
                  e[2] * x + e[6] * y + e[10] * z + e[14]];
        };
        const groups = (n.geometry.groups && n.geometry.groups.length) ? n.geometry.groups : null;
        const sideOf = (mi) => {
          const m = Array.isArray(n.material) ? (n.material[mi] ?? n.material[0]) : n.material;
          return m ? (m.side ?? 0) : 0;                // 0 front, 1 back, 2 double
        };
        const sideAt = (st) => {
          if (!groups) return sideOf(0);
          for (const g of groups) if (st >= g.start && st < g.start + g.count) return sideOf(g.materialIndex);
          return sideOf(0);
        };
        const count = idx ? idx.count : pos.count;
        for (let i = 0; i + 2 < count; i += 3) {
          const a = xf(idx ? idx.getX(i) : i), c = xf(idx ? idx.getX(i + 1) : i + 1), d = xf(idx ? idx.getX(i + 2) : i + 2);
          // cheap reject: whole triangle outside the segment's box
          if (Math.max(a[0], c[0], d[0]) < bl[0] || Math.min(a[0], c[0], d[0]) > bh[0]
           || Math.max(a[1], c[1], d[1]) < bl[1] || Math.min(a[1], c[1], d[1]) > bh[1]
           || Math.max(a[2], c[2], d[2]) < bl[2] || Math.min(a[2], c[2], d[2]) > bh[2]) continue;
          const t = hitTri(eye, dir, far, a, c, d, sideAt(i));
          if (t > 0 && (best < 0 || t < best)) {
            best = t;
            const gp = n.geometry.parameters || {};
            const dims = ['width', 'height', 'depth', 'radiusTop'].filter((k) => gp[k] != null)
              .map((k) => (+gp[k]).toFixed(2)).join('x');
            who = `${n.geometry.type} ${dims} at ${e[12].toFixed(1)},${e[13].toFixed(2)},${e[14].toFixed(1)}`;
          }
        }
      });
      return { t: best, who };
    };
  });
}

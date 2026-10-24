/* Tiny 3D helpers for the isometric lab drawings (Roblox axes: +Y up, LookVector = -Z). */
(function () {
  const BB = window.BB;
  const V = (x, y, z) => ({ x, y, z });
  const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const unit = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };

  // 3x3 matrix as columns [r, u, b]: r = RightVector, u = UpVector, b = BackVector (+Z); Look = -b
  const matMulVec = (m, v) => add(add(mul(m[0], v.x), mul(m[1], v.y)), mul(m[2], v.z));
  const matMul = (a, b) => [matMulVec(a, b[0]), matMulVec(a, b[1]), matMulVec(a, b[2])];
  const rotX = (t) => [V(1, 0, 0), V(0, Math.cos(t), Math.sin(t)), V(0, -Math.sin(t), Math.cos(t))];
  const rotY = (t) => [V(Math.cos(t), 0, -Math.sin(t)), V(0, 1, 0), V(Math.sin(t), 0, Math.cos(t))];
  const rotZ = (t) => [V(Math.cos(t), Math.sin(t), 0), V(-Math.sin(t), Math.cos(t), 0), V(0, 0, 1)];
  // CFrame.Angles(rx, ry, rz) == Rx * Ry * Rz
  const angles = (rx, ry, rz) => matMul(matMul(rotX(rx), rotY(ry)), rotZ(rz));
  const I = [V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)];

  // CFrame = {p, m}
  const cf = (p, m) => ({ p, m: m || I });
  const cfMul = (a, b) => cf(add(a.p, matMulVec(a.m, b.p)), matMul(a.m, b.m));
  const cfPoint = (a, v) => add(a.p, matMulVec(a.m, v));

  /** isometric-ish camera: yaw around Y then pitch; returns [sx, sy, depth] */
  function camera(yaw = -0.62, pitch = 0.5, scale = 14, cx = 0, cy = 0) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (v) => {
      const x1 = v.x * cyw - v.z * syw;
      const z1 = v.x * syw + v.z * cyw;
      const y2 = v.y * cp - z1 * sp;
      const z2 = v.y * sp + z1 * cp;
      return [cx + x1 * scale, cy - y2 * scale, z2];
    };
  }
  const viewDir = (yaw = -0.62, pitch = 0.5) => {
    // direction from scene toward camera, in world space
    return unit(V(Math.sin(yaw) * Math.cos(pitch) * -1, Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)));
  };

  /** Faces of a box with CFrame c and size s: [{pts:[...], n, shade}] sorted back to front */
  function boxFaces(c, s, proj, light = V(0.4, 0.9, 0.55)) {
    const hx = s.x / 2, hy = s.y / 2, hz = s.z / 2;
    const corners = [];
    for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) corners.push(cfPoint(c, V(x, y, z)));
    const idx = (x, y, z) => (x > 0 ? 4 : 0) + (y > 0 ? 2 : 0) + (z > 0 ? 1 : 0);
    const F = [
      { n: V(1, 0, 0), q: [idx(1, -1, -1), idx(1, 1, -1), idx(1, 1, 1), idx(1, -1, 1)], name: "right" },
      { n: V(-1, 0, 0), q: [idx(-1, -1, -1), idx(-1, -1, 1), idx(-1, 1, 1), idx(-1, 1, -1)], name: "left" },
      { n: V(0, 1, 0), q: [idx(-1, 1, -1), idx(-1, 1, 1), idx(1, 1, 1), idx(1, 1, -1)], name: "top" },
      { n: V(0, -1, 0), q: [idx(-1, -1, -1), idx(1, -1, -1), idx(1, -1, 1), idx(-1, -1, 1)], name: "bottom" },
      { n: V(0, 0, 1), q: [idx(-1, -1, 1), idx(1, -1, 1), idx(1, 1, 1), idx(-1, 1, 1)], name: "back" },
      { n: V(0, 0, -1), q: [idx(-1, -1, -1), idx(-1, 1, -1), idx(1, 1, -1), idx(1, -1, -1)], name: "front" },
    ];
    const out = [];
    for (const f of F) {
      const wn = matMulVec(c.m, f.n);
      const pts = f.q.map((i) => proj(corners[i]));
      // back-face cull using screen winding
      const a = pts[0], b = pts[1], d = pts[2];
      const cr = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
      if (cr >= 0) continue;
      const depth = pts.reduce((s, p) => s + p[2], 0) / 4;
      const shade = 0.55 + 0.45 * Math.max(0, dot(unit(wn), unit(light)));
      out.push({ pts, shade, depth, name: f.name });
    }
    return out.sort((p, q) => p.depth - q.depth);
  }

  const pts = (arr) => arr.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  /** svg path for an arrow from screen a to screen b */
  function arrowPath(a, b, head = 9) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const h = Math.min(head, L * 0.45);
    const bx = b[0] - ux * h, by = b[1] - uy * h;
    return {
      line: `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${bx.toFixed(1)},${by.toFixed(1)}`,
      head: `${b[0].toFixed(1)},${b[1].toFixed(1)} ${(bx - uy * h * 0.55).toFixed(1)},${(by + ux * h * 0.55).toFixed(1)} ${(bx + uy * h * 0.55).toFixed(1)},${(by - ux * h * 0.55).toFixed(1)}`,
    };
  }

  BB.m3 = { V, add, sub, mul, dot, cross, len, unit, matMulVec, matMul, rotX, rotY, rotZ, angles, I, cf, cfMul, cfPoint, camera, viewDir, boxFaces, pts, arrowPath };
})();

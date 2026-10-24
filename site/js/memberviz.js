/* Animated diagrams for every CFrame member and every tween-related member.
   Each spec: frame(a, t) -> { objs | lanes, rows, code } where a is a 0..1 loop you can scrub. */
(function () {
  const BB = window.BB;
  const { html, useState, useEffect, useRef } = window.htmPreact;
  const M = BB.m3;
  const { V, add, sub, mul, dot, cross, len, unit, angles, cf, cfMul, cfPoint, camera, matMulVec, matMul, rotX, rotY, rotZ } = M;
  const f = BB.fmt;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const v3 = (v) => `${f(v.x)}, ${f(v.y)}, ${f(v.z)}`;
  const vs = (v) => `Vector3.new(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
  const deg = (r) => f(r * R2D, 0);

  /* ---------- CFrame math (Roblox conventions: columns = Right, Up, Back) ---------- */
  const T = (m) => [V(m[0].x, m[1].x, m[2].x), V(m[0].y, m[1].y, m[2].y), V(m[0].z, m[1].z, m[2].z)];
  const inv = (c) => { const r = T(c.m); return cf(mul(matMulVec(r, c.p), -1), r); };
  const toObj = (a, b) => cfMul(inv(a), b);
  const ptToObj = (c, p) => matMulVec(T(c.m), sub(p, c.p));
  const axisAngle = (axis, ang) => {
    const k = unit(axis), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    const col = (x, y, z) => V(x, y, z);
    return [col(t * k.x * k.x + c, t * k.x * k.y + s * k.z, t * k.x * k.z - s * k.y),
      col(t * k.x * k.y - s * k.z, t * k.y * k.y + c, t * k.y * k.z + s * k.x),
      col(t * k.x * k.z + s * k.y, t * k.y * k.z - s * k.x, t * k.z * k.z + c)];
  };
  const toAxisAngle = (m) => {
    const tr = m[0].x + m[1].y + m[2].z, ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
    if (ang < 1e-5) return [V(0, 1, 0), 0];
    const ax = V(m[1].z - m[2].y, m[2].x - m[0].z, m[0].y - m[1].x);
    return [len(ax) < 1e-6 ? V(1, 0, 0) : unit(ax), ang];
  };
  const lerpCF = (a, b, t) => { const rel = matMul(T(a.m), b.m), [ax, ang] = toAxisAngle(rel); return cf(add(a.p, mul(sub(b.p, a.p), t)), matMul(a.m, axisAngle(ax, ang * t))); };
  const lookAt = (at, target, up = V(0, 1, 0)) => {
    const look = unit(sub(target, at)); let right = cross(look, up); right = len(right) < 1e-6 ? V(1, 0, 0) : unit(right);
    const u = cross(right, look); return cf(at, [right, u, mul(look, -1)]);
  };
  const yxz = (rx, ry, rz) => matMul(matMul(rotY(ry), rotX(rx)), rotZ(rz));
  const look = (c) => mul(c.m[2], -1);

  /* ---------- the 3D renderer ---------- */
  const COL = { part: [86, 125, 214], ghost: null, other: [217, 96, 40], green: [70, 170, 110] };
  function render3D(objs, W, H) {
    const proj = camera(-0.72, 0.45, 15, W / 2, H * 0.62);
    const S = BB.Scene(proj);
    S.ground(8, 0);
    const o = V(0, 0, 0);
    S.arrow(o, V(3, 0, 0), "var(--x)", 1.5); S.arrow(o, V(0, 3, 0), "var(--y)", 1.5); S.arrow(o, V(0, 0, 3), "var(--z)", 1.5);
    for (const ob of objs) {
      if (!ob) continue;
      if (ob.box) {
        if (ob.ghost) S.box(ob.box, ob.size || V(3, 1.5, 4), COL.part, { flat: "none", stroke: ob.color || "var(--accent)", dash: "5 4", double: true });
        else S.box(ob.box, ob.size || V(3, 1.5, 4), ob.rgb || COL.part, { front: [217, 72, 15] });
        if (ob.label) S.callout(cfPoint(ob.box, V(0, (ob.size || V(3, 1.5, 4)).y / 2, 0)), ob.label);
        if (ob.axes) { const L = ob.axes === true ? 2.6 : ob.axes; S.arrow(ob.box.p, add(ob.box.p, mul(ob.box.m[0], L)), "var(--x)", 2.5); S.arrow(ob.box.p, add(ob.box.p, mul(ob.box.m[1], L)), "var(--y)", 2.5); S.arrow(ob.box.p, add(ob.box.p, mul(look(ob.box), L + 0.6)), "var(--z)", 2.5); }
      }
      if (ob.arrow) { S.arrow(ob.arrow[0], ob.arrow[1], ob.color || "var(--accent)", ob.w || 3, ob.dash); if (ob.label) S.text(ob.arrow[1], ob.label, ob.color || "var(--accent)"); }
      if (ob.line) { S.seg(ob.line[0], ob.line[1], ob.color || "var(--muted)", ob.w || 1.5, ob.dash || "3 4"); if (ob.label) S.text(mul(add(ob.line[0], ob.line[1]), 0.5), ob.label, ob.color || "var(--muted)"); }
      if (ob.path) S.path(ob.path, ob.color || "var(--accent)", ob.w || 2, ob.dash);
      if (ob.pt) { S.dot(ob.pt, ob.r || 6, ob.color || "var(--accent)"); if (ob.label) S.text(ob.pt, ob.label, ob.color || "var(--accent)"); }
    }
    return S.render(W, H);
  }
  // draw the three local axes of `c` from its own position as dashed component lines toward point p
  const compLines = (c, p) => {
    const l = ptToObj(c, p), a = add(c.p, mul(c.m[0], l.x)), b = add(a, mul(c.m[1], l.y));
    return [{ line: [c.p, a], color: "var(--x)", w: 2.5, dash: "" }, { line: [a, b], color: "var(--y)", w: 2.5, dash: "" }, { line: [b, p], color: "var(--z)", w: 2.5, dash: "" }];
  };
  const arc = (center, axis, from, ang, r = 2) => { const out = []; for (let i = 0; i <= 24; i++) out.push(add(center, mul(matMulVec(axisAngle(axis, (ang * i) / 24), from), r))); return out; };
  // a part that turns slowly; used by many demos
  const turning = (a, pos = V(0, 2.5, 0)) => cf(pos, angles(0, a * Math.PI * 1.5 - 0.6, 0.25 * Math.sin(a * Math.PI * 2)));

  /* ---------- staged euler rotation (shows the ORDER of turns) ---------- */
  function euler(a, order, rx, ry, rz, fname) {
    const k = Math.min(1, a * 1.25);
    const seq = order === "XYZ" ? [["X", rx], ["Y", ry], ["Z", rz]] : [["Y", ry], ["X", rx], ["Z", rz]];
    let m = M.I; const done = [];
    seq.forEach(([axName, ang], i) => {
      const part = Math.max(0, Math.min(1, k * 3 - i));
      const R = axName === "X" ? rotX(ang * part) : axName === "Y" ? rotY(ang * part) : rotZ(ang * part);
      m = matMul(m, R); if (part > 0) done.push(`${axName} ${deg(ang * part)}°`);
    });
    const c = cf(V(0, 2.5, 0), m);
    const step = Math.min(2, Math.floor(k * 3));
    return {
      objs: [{ box: cf(V(0, 2.5, 0)), ghost: true, color: "var(--muted)" }, { box: c, axes: true, label: "turning: " + (done.join(" then ") || "start") }],
      rows: [["order", seq.map((s) => s[0]).join(" → ")], ["now turning around", seq[step][0]], ["rx, ry, rz", `${deg(rx)}°, ${deg(ry)}°, ${deg(rz)}°`]],
      code: `local cf = ${fname}(math.rad(${deg(rx)}), math.rad(${deg(ry)}), math.rad(${deg(rz)}))\n-- turns happen in this order (each from the part's NEW point of view):\n-- ${seq.map((s) => s[0]).join(" first, then ")}`,
    };
  }

  const P0 = turning;
  const CF = {
    "CFrame.new": { say: "CFrame.new(x, y, z) makes a CFrame at that position with NO rotation. Watch the brick move but never turn.", frame: (a) => { const p = V(-4 + a * 8, 1.5 + Math.sin(a * Math.PI) * 3, 2 - a * 4); return { objs: [{ box: cf(p), axes: true, label: "CFrame.new(x, y, z)" }, { arrow: [V(0, 0, 0), p], color: "var(--muted)", w: 1.5, dash: "4 4" }], rows: [["position", v3(p)], ["rotation", "none (lined up with the world)"]], code: `local cf = CFrame.new(${f(p.x)}, ${f(p.y)}, ${f(p.z)})\npart.CFrame = cf` }; } },
    "CFrame.identity": { say: "The \"do nothing\" CFrame: at (0, 0, 0), not turned at all. Multiplying by it changes nothing, like × 1 for numbers.", frame: (a) => { const c = P0(a); return { objs: [{ box: cf(V(0, 0.75, 0)), axes: true, label: "CFrame.identity" }, { box: c, ghost: true, label: "cf" }, { box: c, ghost: true }], rows: [["identity", "0, 0, 0 + no turn"], ["cf * CFrame.identity", "= cf (unchanged)"]], code: `print(CFrame.identity) --> 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1\nprint(cf * CFrame.identity == cf) --> true` }; } },
    "CFrame.Position": { say: ".Position is just the WHERE part, as a Vector3. The arrow from the world center to the brick is its Position. Turning doesn't change it.", frame: (a) => { const c = cf(V(-3 + a * 6, 2, 1 - a * 2), angles(0, a * 4, 0)); return { objs: [{ box: c, label: "cf" }, { arrow: [V(0, 0, 0), c.p], label: ".Position" }], rows: [["cf.Position", v3(c.p)]], code: `print(cf.Position) --> ${v3(c.p)}` }; } },
    "CFrame.Rotation": { say: ".Rotation is the SAME turn but moved to (0, 0, 0). Handy to copy just the rotation onto something else.", frame: (a) => { const c = cf(V(3, 3, -1), angles(0.3, a * 5, 0.2)); const r = cf(V(0, 0.8, 0), c.m); return { objs: [{ box: c, axes: true, label: "cf" }, { box: r, axes: true, ghost: true, label: "cf.Rotation" }, { line: [c.p, r.p], dash: "4 4" }], rows: [["cf.Rotation.Position", "0, 0, 0"]], code: `local turnOnly = cf.Rotation\nother.CFrame = CFrame.new(other.Position) * turnOnly -- copy the turn` }; } },
    "CFrame.X": null, "CFrame.Y": null, "CFrame.Z": null,
    "CFrame.LookVector": null, "CFrame.RightVector": null, "CFrame.UpVector": null, "CFrame.XVector": null, "CFrame.YVector": null, "CFrame.ZVector": null,
    "CFrame:Inverse": { say: "Inverse is the \"undo\" CFrame: cf * cf:Inverse() puts you back at the identity. The ghost path shows the undo taking the brick back to the center, unturned.", frame: (a) => { const c = cf(V(3, 2.5, -2), angles(0, 1.1, 0.3)); const back = lerpCF(c, cf(V(0, 0.75, 0)), a); return { objs: [{ box: c, ghost: true, label: "cf" }, { box: back, axes: true, label: a > 0.95 ? "cf * cf:Inverse() = identity" : "undoing…" }, { line: [c.p, V(0, 0.75, 0)], dash: "4 4" }], rows: [["cf:Inverse().Position", v3(inv(c).p)]], code: `local undo = cf:Inverse()\nprint(cf * undo) --> CFrame.identity (back to 0,0,0, no turn)` }; } },
    "CFrame:Lerp": { say: "Lerp blends position AND rotation. alpha 0 = start, 1 = goal, 0.5 = halfway there and half-turned. Drag the slider to scrub.", frame: (a) => { const s0 = cf(V(-4, 1.5, 2), angles(0, 0.3, 0)), g = cf(V(4, 3.5, -2), angles(0.4, 2.2, 0.3)), c = lerpCF(s0, g, a); return { objs: [{ box: s0, ghost: true, color: "var(--muted)", label: "start" }, { box: g, ghost: true, label: "goal" }, { box: c, axes: true, label: `alpha ${f(a)}` }], rows: [["alpha", f(a)], ["position", v3(c.p)]], code: `local mid = startCF:Lerp(goalCF, ${f(a)})\npart.CFrame = mid` }; } },
    "CFrame:Orthonormalize": { say: "After lots of math, a CFrame's 3 arrows can drift so they're not exactly at 90° to each other (that squishes parts). Orthonormalize straightens them again.", frame: (a) => { const skew = (1 - a) * 0.6; const r = unit(V(1, skew, 0)), u = unit(V(-skew * 0.5, 1, skew)), b = unit(cross(r, u)); const c = cf(V(0, 2.5, 0), [r, u, b]); return { objs: [{ arrow: [c.p, add(c.p, mul(r, 3))], color: "var(--x)", label: "Right" }, { arrow: [c.p, add(c.p, mul(u, 3))], color: "var(--y)", label: "Up" }, { arrow: [c.p, add(c.p, mul(b, -3))], color: "var(--z)", label: "Look" }], rows: [["Right·Up (0 = perfect 90°)", f(dot(r, u), 3)]], code: `cf = cf:Orthonormalize() -- fixes tiny errors so the axes are 90° apart again` }; } },
    "CFrame:ToWorldSpace": { say: "ToWorldSpace(offset) = cf * offset: take an offset measured from the brick's point of view and find where it is in the world. The orange ghost is 4 studs in front, 1 up: it follows the brick around as it turns.", frame: (a) => { const c = P0(a), off = cf(V(0, 1, -4), angles(0, 0.6, 0)), w = cfMul(c, off); return { objs: [{ box: c, axes: true, label: "cf" }, { box: w, ghost: true, label: "cf:ToWorldSpace(offset)" }, { line: [c.p, w.p] }], rows: [["offset (local)", "0, 1, -4 + turn 34°"], ["result (world)", v3(w.p)]], code: `local offset = CFrame.new(0, 1, -4) * CFrame.Angles(0, math.rad(34), 0)\nlocal result = cf:ToWorldSpace(offset) -- same as cf * offset\n--> position ${v3(w.p)}` }; } },
    "CFrame:ToObjectSpace": { say: "ToObjectSpace asks: \"where is the OTHER thing, from my point of view?\" The colored lines measure the orange brick along the blue brick's own right (red), up (green) and back (blue) arrows.", frame: (a) => { const c = cf(V(-2, 2, 1), angles(0, 0.7, 0)), o = cf(V(Math.cos(a * 6.28) * 4 + 1, 2.5, Math.sin(a * 6.28) * 3 - 1), angles(0, a * 3, 0)), r = toObj(c, o); return { objs: [{ box: c, axes: true, label: "cf (me)" }, { box: o, rgb: COL.other, size: V(1.5, 1.5, 1.5), label: "other" }, ...compLines(c, o.p)], rows: [["cf:ToObjectSpace(other).Position", v3(r.p)], ["meaning", `${f(Math.abs(r.p.x), 1)} ${r.p.x >= 0 ? "right" : "left"}, ${f(Math.abs(r.p.y), 1)} ${r.p.y >= 0 ? "up" : "down"}, ${f(Math.abs(r.p.z), 1)} ${r.p.z <= 0 ? "in front" : "behind"}`]], code: `local rel = cf:ToObjectSpace(other.CFrame)\nprint(rel.Position) --> ${v3(r.p)}  (from cf's point of view)` }; } },
    "CFrame:PointToWorldSpace": { say: "Give a point in the brick's own coordinates and get the world position. The orange dot is (2, 1, -3) in the brick's space: always 2 right, 1 up, 3 in front of it.", frame: (a) => { const c = P0(a), p = cfPoint(c, V(2, 1, -3)); return { objs: [{ box: c, axes: true, label: "cf" }, { pt: p, label: "(2, 1, -3) local" }, ...compLines(c, p)], rows: [["world position", v3(p)]], code: `local worldPoint = cf:PointToWorldSpace(Vector3.new(2, 1, -3))\n--> ${v3(p)}  (same as cf * Vector3.new(2, 1, -3))` }; } },
    "CFrame:PointToObjectSpace": { say: "The opposite: a fixed WORLD point (orange), described from the turning brick's point of view. The dot doesn't move, but its local numbers change as the brick turns.", frame: (a) => { const c = P0(a), p = V(3, 1, 3), l = ptToObj(c, p); return { objs: [{ box: c, axes: true, label: "cf" }, { pt: p, label: "world point (3, 1, 3)" }, ...compLines(c, p)], rows: [["cf:PointToObjectSpace(point)", v3(l)]], code: `local localPoint = cf:PointToObjectSpace(Vector3.new(3, 1, 3))\n--> ${v3(l)}` }; } },
    "CFrame:VectorToWorldSpace": { say: "Like PointToWorldSpace, but for a DIRECTION: only the turn is used, not the position. (0, 0, -1) = \"my forward\" turns into a world direction.", frame: (a) => { const c = P0(a), d = matMulVec(c.m, V(0, 0, -1)); return { objs: [{ box: c, label: "cf" }, { arrow: [c.p, add(c.p, mul(d, 4))], label: "my forward, in the world" }, { arrow: [V(0, 0.05, 0), mul(d, 3)], color: "var(--muted)", w: 2, dash: "4 3", label: "same arrow (no position)" }], rows: [["cf:VectorToWorldSpace(0,0,-1)", v3(d)]], code: `local dir = cf:VectorToWorldSpace(Vector3.new(0, 0, -1))\n--> ${v3(d)}  (same as cf.LookVector)` }; } },
    "CFrame:VectorToObjectSpace": { say: "A fixed WORLD direction (orange, pointing world +X) described from the turning brick's point of view. Great for \"is this wind blowing at my front or my side?\".", frame: (a) => { const c = P0(a), w = V(1, 0, 0), l = matMulVec(T(c.m), w); return { objs: [{ box: c, axes: true, label: "cf" }, { arrow: [c.p, add(c.p, mul(w, 4))], label: "world direction (1, 0, 0)" }], rows: [["cf:VectorToObjectSpace(1,0,0)", v3(l)], ["meaning", Math.abs(l.x) > Math.abs(l.z) ? (l.x > 0 ? "toward my right side" : "toward my left side") : l.z < 0 ? "toward my front" : "toward my back"]], code: `local localDir = cf:VectorToObjectSpace(Vector3.new(1, 0, 0))\n--> ${v3(l)}` }; } },
    "CFrame:GetComponents": null, "CFrame:components": null,
    "CFrame:ToEulerAngles": { say: "Gives back 3 angles (radians) that rebuild this rotation, in the order you choose. Here the brick is built step by step in X → Y → Z order.", frame: (a) => euler(a, "XYZ", 0.5, 1.2, 0.3, "CFrame.fromEulerAngles") },
    "CFrame:ToEulerAnglesXYZ": { say: "The 3 angles in X → Y → Z order: the same numbers CFrame.Angles would need to rebuild it.", frame: (a) => euler(a, "XYZ", 0.5, 1.2, 0.3, "CFrame.Angles") },
    "CFrame:ToEulerAnglesYXZ": { say: "The 3 angles in Y → X → Z order. Same rotation, different recipe: watch it turn around Y first.", frame: (a) => euler(a, "YXZ", 0.5, 1.2, 0.3, "CFrame.fromEulerAnglesYXZ") },
    "CFrame:ToOrientation": { say: "Same as ToEulerAnglesYXZ: the angles a part's Orientation property uses (but in radians, not degrees).", frame: (a) => euler(a, "YXZ", 0.5, 1.2, 0.3, "CFrame.fromOrientation") },
    "CFrame:ToAxisAngle": { say: "Any rotation is ONE turn around ONE line (the axis). ToAxisAngle gives you that yellow axis and how far to turn around it.", frame: (a) => { const ax = unit(V(1, 1, 0.3)), ang = a * 2.4, c = cf(V(0, 2.5, 0), axisAngle(ax, ang)); return { objs: [{ arrow: [sub(c.p, mul(ax, 3)), add(c.p, mul(ax, 3.5))], color: "#d4a700", label: "axis" }, { box: c, axes: true }, { path: arc(c.p, ax, unit(cross(ax, V(0, 0, 1))), ang, 2.2), color: "var(--accent)", w: 3 }], rows: [["axis", v3(ax)], ["angle", `${f(ang, 2)} rad (${deg(ang)}°)`]], code: `local axis, angle = cf:ToAxisAngle()\nprint(axis, angle) --> ${v3(ax)}  ${f(ang, 2)}` }; } },
    "CFrame:FuzzyEq": { say: "Are two CFrames ALMOST equal? Exact == fails after tiny math errors, so FuzzyEq allows a small difference (epsilon). The ghost drifts; it counts as equal while it's close enough.", frame: (a) => { const d = Math.sin(a * Math.PI) * 0.6, c = cf(V(0, 2.5, 0)), o = cf(V(d, 2.5, 0), angles(0, d * 0.3, 0)); const eq = d < 0.1; return { objs: [{ box: c, label: "cf" }, { box: o, ghost: true, color: eq ? "var(--ok)" : "var(--bad)", label: eq ? "FuzzyEq: true" : "FuzzyEq: false" }], rows: [["difference", f(d, 3) + " studs"], ["cf:FuzzyEq(other, 0.1)", String(eq), eq ? "ax-y" : "ax-x"]], code: `print(cf:FuzzyEq(other, 0.1)) --> ${eq}` }; } },
    "CFrame:AngleBetween": { say: "How many radians of turning separate two rotations (positions are ignored).", frame: (a) => { const c = cf(V(-2.5, 2, 0)), oa = a * Math.PI, o = cf(V(2.5, 2, 0), angles(0, oa, 0)); return { objs: [{ box: c, axes: true, label: "cf" }, { box: o, axes: true, rgb: COL.other, label: "other" }, { path: arc(V(2.5, 2, 0), V(0, 1, 0), V(0, 0, -1), oa, 2.6), color: "var(--accent)", w: 3 }], rows: [["cf:AngleBetween(other)", `${f(oa, 2)} rad (${deg(oa)}°)`]], code: `print(cf:AngleBetween(other)) --> ${f(oa, 3)}` }; } },
    "CFrame.lookAt": { say: "CFrame.lookAt(at, target) puts a CFrame at `at` with its LookVector pointing at `target`. The orange target flies around and the brick keeps staring at it.", frame: (a) => { const at = V(0, 2, 0), tg = V(Math.cos(a * 6.28) * 5, 2 + Math.sin(a * 12.56) * 2, Math.sin(a * 6.28) * 4), c = lookAt(at, tg); return { objs: [{ box: c, axes: true, label: "CFrame.lookAt(at, target)" }, { pt: tg, r: 8, label: "target" }, { line: [at, tg] }], rows: [["target", v3(tg)], ["LookVector", v3(look(c))]], code: `part.CFrame = CFrame.lookAt(part.Position, target.Position)` }; } },
    "CFrame.lookAlong": { say: "Like lookAt, but you give a DIRECTION instead of a target point. The brick faces along the orange arrow.", frame: (a) => { const at = V(0, 2.5, 0), d = unit(V(Math.cos(a * 6.28), Math.sin(a * 6.28) * 0.5, Math.sin(a * 6.28))), c = lookAt(at, add(at, d)); return { objs: [{ box: c, axes: true }, { arrow: [at, add(at, mul(d, 5))], label: "direction" }], rows: [["direction", v3(d)]], code: `part.CFrame = CFrame.lookAlong(part.Position, ${vs(d)})` }; } },
    "CFrame.fromRotationBetweenVectors": { say: "Gives the turn that rotates the `from` arrow onto the `to` arrow. The brick is turned by exactly that rotation.", frame: (a) => { const fr = V(1, 0, 0), to = unit(V(Math.cos(a * 3), Math.sin(a * 3) * 0.8, Math.sin(a * 3) * 0.6)); const ax = cross(fr, to), ang = Math.acos(Math.max(-1, Math.min(1, dot(fr, to)))); const m = len(ax) < 1e-6 ? M.I : axisAngle(ax, ang); const c = cf(V(0, 2.5, 0), m); return { objs: [{ box: c, axes: true }, { arrow: [c.p, add(c.p, mul(fr, 4))], color: "var(--muted)", label: "from" }, { arrow: [c.p, add(c.p, mul(to, 4))], label: "to" }], rows: [["turn", `${deg(ang)}°`]], code: `local turn = CFrame.fromRotationBetweenVectors(Vector3.xAxis, ${vs(to)})` }; } },
    "CFrame.fromEulerAngles": { say: "Build a rotation from 3 angles (radians) and an order. The brick does each turn in that order.", frame: (a) => euler(a, "XYZ", 0.6, 1.0, 0.4, "CFrame.fromEulerAngles") },
    "CFrame.fromEulerAnglesXYZ": { say: "Same as CFrame.Angles: turn around X, then Y, then Z (each from the brick's new point of view).", frame: (a) => euler(a, "XYZ", 0.6, 1.0, 0.4, "CFrame.fromEulerAnglesXYZ") },
    "CFrame.fromEulerAnglesYXZ": { say: "Turn around Y first, then X, then Z. Same numbers as XYZ but a DIFFERENT result. Compare with CFrame.Angles.", frame: (a) => euler(a, "YXZ", 0.6, 1.0, 0.4, "CFrame.fromEulerAnglesYXZ") },
    "CFrame.Angles": { say: "CFrame.Angles(rx, ry, rz): turn around X, then Y, then Z. Angles are in RADIANS, so wrap degrees in math.rad().", frame: (a) => euler(a, "XYZ", 0.6, 1.0, 0.4, "CFrame.Angles") },
    "CFrame.fromOrientation": { say: "Same order as a part's Orientation property (Y, then X, then Z), but in radians.", frame: (a) => euler(a, "YXZ", 0.6, 1.0, 0.4, "CFrame.fromOrientation") },
    "CFrame.fromAxisAngle": { say: "Turn around ANY line you choose (the yellow axis) by an angle in radians.", frame: (a) => { const ax = unit(V(1, 1, 0)), ang = a * 3.14, c = cf(V(0, 2.5, 0), axisAngle(ax, ang)); return { objs: [{ arrow: [sub(c.p, mul(ax, 3)), add(c.p, mul(ax, 3.5))], color: "#d4a700", label: "axis (1, 1, 0)" }, { box: c, axes: true }], rows: [["angle", `${f(ang, 2)} rad (${deg(ang)}°)`]], code: `local cf = CFrame.fromAxisAngle(Vector3.new(1, 1, 0).Unit, ${f(ang, 2)})` }; } },
    "CFrame.fromMatrix": { say: "Build a CFrame from its arrows yourself: a position, the Right arrow (vX) and the Up arrow (vY). Roblox works out the third (vZ = vX × vY).", frame: (a) => { const ang = a * 2.5, vX = V(Math.cos(ang), 0, -Math.sin(ang)), vY = V(0, 1, 0), vZ = cross(vX, vY), c = cf(V(0, 2.5, 0), [vX, vY, vZ]); return { objs: [{ box: c }, { arrow: [c.p, add(c.p, mul(vX, 3.5))], color: "var(--x)", label: "vX (you give)" }, { arrow: [c.p, add(c.p, mul(vY, 3))], color: "var(--y)", label: "vY (you give)" }, { arrow: [c.p, add(c.p, mul(vZ, 3))], color: "var(--z)", label: "vZ (worked out)" }], rows: [["vX", v3(vX)], ["vZ = vX:Cross(vY)", v3(vZ)]], code: `local cf = CFrame.fromMatrix(pos, ${vs(vX)}, Vector3.yAxis)` }; } },
    "op:CFrame*CFrame": { say: "a * b = \"start at a, then do b from a's point of view\". The orange brick is b = (0, 2, -4) relative to the blue one, so it rides along as the blue brick moves and turns.", frame: (a) => { const A = cf(V(Math.sin(a * 6.28) * 2, 2, 0), angles(0, a * 4, 0.2)), B = cf(V(0, 2, -4)), R = cfMul(A, B); return { objs: [{ box: A, axes: true, label: "a" }, { box: R, rgb: COL.other, size: V(1.5, 1.5, 1.5), label: "a * b" }, { line: [A.p, R.p] }], rows: [["a * b position", v3(R.p)]], code: `local b = CFrame.new(0, 2, -4)\nlocal result = a * b --> ${v3(R.p)}` }; } },
    "op:CFrame*Vector3": { say: "cf * vector turns a point from the brick's own space into the world (same as PointToWorldSpace).", frame: (a) => { const c = P0(a), p = cfPoint(c, V(0, 0, -4)); return { objs: [{ box: c, axes: true }, { pt: p, label: "cf * (0, 0, -4)" }, { line: [c.p, p] }], rows: [["cf * Vector3.new(0,0,-4)", v3(p)]], code: `local inFront = cf * Vector3.new(0, 0, -4) --> ${v3(p)}` }; } },
    "op:CFrame+Vector3": { say: "cf + vector moves in WORLD directions and keeps the rotation. The ghost is always 4 studs toward world +X, no matter how the brick is turned.", frame: (a) => { const c = P0(a), g = cf(add(c.p, V(4, 0, 0)), c.m); return { objs: [{ box: c, axes: true, label: "cf" }, { box: g, ghost: true, label: "cf + (4, 0, 0)" }, { arrow: [c.p, g.p], color: "var(--x)" }], rows: [["result position", v3(g.p)]], code: `local moved = cf + Vector3.new(4, 0, 0) -- world direction, rotation kept` }; } },
    "op:CFrame-Vector3": { say: "cf - vector moves the opposite way, again in world directions.", frame: (a) => { const c = P0(a), g = cf(sub(c.p, V(0, 0, 4)), c.m); return { objs: [{ box: c, axes: true, label: "cf" }, { box: g, ghost: true, label: "cf - (0, 0, 4)" }, { arrow: [c.p, g.p], color: "var(--z)" }], rows: [["result position", v3(g.p)]], code: `local moved = cf - Vector3.new(0, 0, 4)` }; } },
  };
  // components X / Y / Z
  for (const [k, ax, col] of [["X", "x", "var(--x)"], ["Y", "y", "var(--y)"], ["Z", "z", "var(--z)"]]) {
    CF["CFrame." + k] = { say: `.${k} is just the ${k} number of the position. The colored line shows it measured along the world's ${k} axis.`, frame: (a) => { const p = V(-3 + a * 6, 1 + a * 3, 2 - a * 4), c = cf(p, angles(0, a * 3, 0)); const foot = V(ax === "x" ? p.x : 0, ax === "y" ? p.y : 0, ax === "z" ? p.z : 0); return { objs: [{ box: c }, { arrow: [V(0, 0, 0), foot], color: col, w: 4, label: `.${k} = ${f(p[ax])}` }, { line: [foot, p] }], rows: [[`cf.${k}`, f(p[ax])]], code: `print(cf.${k}) --> ${f(p[ax])}` }; } };
  }
  // direction vectors
  const DIRS = [["LookVector", (c) => look(c), "var(--z)", "its FRONT (the orange face). It's the part's -Z direction."], ["RightVector", (c) => c.m[0], "var(--x)", "its right side (+X)."], ["UpVector", (c) => c.m[1], "var(--y)", "its top (+Y)."],
    ["XVector", (c) => c.m[0], "var(--x)", "the first column of the rotation: same as RightVector."], ["YVector", (c) => c.m[1], "var(--y)", "the second column: same as UpVector."], ["ZVector", (c) => c.m[2], "var(--z)", "the third column: the BACK direction, so it's the opposite of LookVector."]];
  for (const [k, fn, col, txt] of DIRS) {
    CF["CFrame." + k] = { say: `.${k} is an arrow 1 stud long pointing toward ${txt} It turns with the brick.`, frame: (a) => { const c = P0(a), d = fn(c); return { objs: [{ box: c, label: "cf" }, { arrow: [c.p, add(c.p, mul(d, 4))], color: col, w: 4, label: k }, k === "ZVector" ? { arrow: [c.p, add(c.p, mul(look(c), 3))], color: "var(--muted)", w: 2, dash: "4 3", label: "LookVector" } : null], rows: [[`cf.${k}`, v3(d)], ["length", "always 1"]], code: `print(cf.${k}) --> ${v3(d)}` + (k === "LookVector" ? `\n-- move 5 studs forward:\npart.Position += part.CFrame.LookVector * 5` : "") }; } };
  }
  // GetComponents / components
  CF["CFrame:GetComponents"] = CF["CFrame:components"] = { say: "Returns 12 numbers: x, y, z, then the 3×3 rotation grid. Each COLUMN of the grid is one of the brick's arrows: Right (red), Up (green), Back (blue).", frame: (a) => { const c = P0(a), m = c.m; return { objs: [{ box: c, axes: true }], rows: [["x, y, z", v3(c.p)], ["R00 R01 R02", `${f(m[0].x)}  ${f(m[1].x)}  ${f(m[2].x)}`], ["R10 R11 R12", `${f(m[0].y)}  ${f(m[1].y)}  ${f(m[2].y)}`], ["R20 R21 R22", `${f(m[0].z)}  ${f(m[1].z)}  ${f(m[2].z)}`], ["columns =", "Right | Up | Back"]], code: `local x, y, z, R00, R01, R02, R10, R11, R12, R20, R21, R22 = cf:GetComponents()\n-- (R00, R10, R20) = RightVector = ${v3(m[0])}` }; } };

  /* ---------- tweens ---------- */
  const ease = (s, d, t) => BB.ease(s, d, Math.max(0, Math.min(1, t)));
  const STYLE_SAY = { Linear: "the same speed the whole way", Sine: "a gentle speed change", Quad: "a medium speed change (a great default)", Cubic: "a stronger speed change", Quart: "an even stronger one", Quint: "the strongest power curve", Exponential: "almost still, then whoosh", Circular: "a sharp change near one end", Back: "pulls back a bit or overshoots", Elastic: "wobbles like a rubber band", Bounce: "bounces at the end" };
  const TW = {};
  const lane = (label, x, color, extra = {}) => ({ label, x, color, ...extra });
  TW["TweenService:Create"] = { say: "Create(instance, TweenInfo, goals) makes a Tween: a plan to change those properties to the goals over time. Here the goal changes Position, Transparency AND Color at once. :Play() starts it.", frame: (a) => { const k = ease("Quad", "Out", a); return { lanes: [lane("Position", k, "var(--z)", { fade: k * 0.7, tint: k })], curve: ["Quad", "Out"], a, rows: [["progress", f(a * 100, 0) + "% of the time"], ["eased", f(k * 100, 0) + "% of the way"], ["Transparency", f(k * 0.7, 2)]], code: `local tween = TweenService:Create(part, TweenInfo.new(2), {\n\tPosition = part.Position + Vector3.new(20, 0, 0),\n\tTransparency = 0.7,\n\tColor = Color3.fromRGB(255, 120, 40),\n})\ntween:Play()` }; } };
  TW["TweenService:GetValue"] = { say: "GetValue(alpha, style, direction) gives you the eased number for a time between 0 and 1, without making a Tween. Use it to ease anything yourself.", frame: (a) => { const k = ease("Quad", "Out", a); return { lanes: [lane("your thing", k, "var(--accent)")], curve: ["Quad", "Out"], a, rows: [["alpha (time)", f(a, 2)], ["GetValue(...)", f(k, 3), "ax-z"]], code: `local eased = TweenService:GetValue(${f(a, 2)}, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)\n--> ${f(k, 3)}` }; } };
  TW["TweenService:SmoothDamp"] = { say: "SmoothDamp chases a target that can MOVE, slowing down gently as it arrives. The target jumps around; the follower glides after it. Call it every frame.", custom: "smoothdamp" };
  TW["Tween.Instance"] = { say: "The object the tween is changing (the one you passed to Create). Read only.", frame: (a) => ({ lanes: [lane("tween.Instance = part", ease("Sine", "InOut", a), "var(--z)")], a, rows: [["tween.Instance", "Part"]], code: `print(tween.Instance.Name) --> Part` }) };
  TW["Tween.TweenInfo"] = { say: "The TweenInfo the tween was made with (its time and easing). Read only: make a new tween to change it.", frame: (a) => ({ lanes: [lane("Time 2, Quad Out", ease("Quad", "Out", a), "var(--z)")], curve: ["Quad", "Out"], a, rows: [["tween.TweenInfo.Time", "2"], ["EasingStyle", "Quad"]], code: `print(tween.TweenInfo.Time) --> 2` }) };
  for (const k of ["TweenBase.PlaybackState", "TweenBase:Cancel", "TweenBase:Pause", "TweenBase:Play", "TweenBase.Completed"]) TW[k] = { say: { "TweenBase.PlaybackState": "Which stage the tween is in right now. Press the buttons and watch the state light up.", "TweenBase:Cancel": "Cancel stops the tween and RESETS its progress. The part stays where it is (it doesn't jump back), but Play starts over from the beginning.", "TweenBase:Pause": "Pause freezes the tween. Play continues from the same spot.", "TweenBase:Play": "Play starts the tween (or continues it after Pause).", "TweenBase.Completed": "Fires when the tween ends: either it finished, or it was cancelled. It tells you which with playbackState." }[k], custom: "player" };
  TW["TweenInfo.Time"] = { say: "How many seconds the tween takes. Two tweens, same distance: 1 second vs 2 seconds.", frame: (a, t) => { const p = (t % 2.6) / 2; return { lanes: [lane("Time = 1", ease("Quad", "Out", p * 2), "var(--accent)"), lane("Time = 2", ease("Quad", "Out", p), "var(--z)")], a: p, rows: [["seconds", f(Math.min(2, p * 2), 1)]], code: `TweenInfo.new(1) -- fast\nTweenInfo.new(2) -- twice as slow` }; } };
  TW["TweenInfo.EasingStyle"] = { say: "The SHAPE of the movement. It cycles through all 11 styles here.", frame: (a, t) => { const st = Object.keys(STYLE_SAY)[Math.floor(t / 2.2) % 11], p = (t % 2.2) / 1.8; return { lanes: [lane(st, ease(st, "Out", p), "var(--accent)")], curve: [st, "Out"], a: Math.min(1, p), rows: [["EasingStyle", st], ["feels like", STYLE_SAY[st]]], code: `TweenInfo.new(1, Enum.EasingStyle.${st})` }; } };
  TW["TweenInfo.EasingDirection"] = { say: "Where the effect happens: In = at the start, Out = at the end, InOut = both. Same style (Back), three directions.", frame: (a) => ({ lanes: ["In", "Out", "InOut"].map((d, i) => lane(d, ease("Back", d, a), ["var(--x)", "var(--y)", "var(--z)"][i])), a, rows: [["style", "Back"]], code: `TweenInfo.new(1, Enum.EasingStyle.Back, Enum.EasingDirection.Out)` }) };
  TW["TweenInfo.RepeatCount"] = { say: "How many EXTRA times it repeats after the first play. 2 = plays 3 times total. -1 = forever.", frame: (a, t) => { const n = 3, cyc = t % (n * 1.2 + 0.8), i = Math.min(n - 1, Math.floor(cyc / 1.2)), p = cyc > n * 1.2 ? 1 : (cyc % 1.2) / 1.0; return { lanes: [lane(`play ${i + 1} of 3`, ease("Quad", "InOut", p), "var(--z)")], a: Math.min(1, p), rows: [["RepeatCount", "2"], ["playing", `${i + 1} of 3`]], code: `TweenInfo.new(1, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut, 2)` }; } };
  TW["TweenInfo.Reverses"] = { say: "true = after reaching the goal, it plays backwards to the start (counts as part of one play).", frame: (a, t) => { const c = t % 2.4, p = c < 1 ? c : c < 2 ? 2 - c : 0; return { lanes: [lane(c < 1 ? "going" : c < 2 ? "coming back" : "done", ease("Quad", "InOut", p), "var(--z)"), lane("Reverses = false", ease("Quad", "InOut", Math.min(1, c)), "var(--muted)")], a: Math.min(1, c / 2), rows: [["Reverses", "true"]], code: `TweenInfo.new(1, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut, 0, true)` }; } };
  TW["TweenInfo.DelayTime"] = { say: "Seconds to wait after :Play() before moving. The bar fills while it waits.", frame: (a, t) => { const c = t % 3, wait = Math.min(1, c / 1), p = Math.max(0, (c - 1) / 1.5); return { lanes: [lane(c < 1 ? "waiting…" : "moving", ease("Quad", "Out", p), "var(--z)", { wait })], a: Math.min(1, p), rows: [["DelayTime", "1 second"], ["state", c < 1 ? "Delayed" : p < 1 ? "Playing" : "Completed"]], code: `TweenInfo.new(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, 0, false, 1)` }; } };
  TW["TweenInfo.new"] = { say: "All 6 settings in order: time, style, direction, repeat count, reverses, delay. You can leave out the ones at the end.", frame: (a, t) => { const c = t % 4.4, wait = Math.min(1, c / 0.6), p = c < 0.6 ? 0 : c < 1.8 ? (c - 0.6) / 1.2 : c < 3 ? 1 - (c - 1.8) / 1.2 : 0; return { lanes: [lane("all settings", ease("Back", "Out", p), "var(--accent)", { wait })], a: Math.min(1, c / 3), rows: [["1. time", "1.2"], ["2. style", "Back"], ["3. direction", "Out"], ["4. repeatCount", "0"], ["5. reverses", "true"], ["6. delayTime", "0.6"]], code: `local info = TweenInfo.new(\n\t1.2,                         -- time\n\tEnum.EasingStyle.Back,       -- style\n\tEnum.EasingDirection.Out,    -- direction\n\t0,                           -- repeatCount\n\ttrue,                        -- reverses\n\t0.6                          -- delayTime\n)` }; } };
  for (const st of Object.keys(STYLE_SAY)) TW["EasingStyle." + st] = { say: `${st}: ${STYLE_SAY[st]}. Shown with all three directions.`, frame: (a) => ({ lanes: ["In", "Out", "InOut"].map((d, i) => lane(`${st} ${d}`, ease(st, d, a), ["var(--x)", "var(--y)", "var(--z)"][i])), curve: [st, "Out"], a, rows: [["progress", f(a, 2)]], code: `TweenInfo.new(1, Enum.EasingStyle.${st}, Enum.EasingDirection.Out)` }) };
  for (const d of ["In", "Out", "InOut"]) TW["EasingDirection." + d] = { say: { In: "In: the style's effect happens at the START (slow start, fast end for Quad).", Out: "Out: the effect happens at the END (fast start, gentle stop). Usually feels the most natural.", InOut: "InOut: effect at both ends (gentle start AND stop)." }[d], frame: (a) => ({ lanes: ["Quad", "Back", "Bounce"].map((s, i) => lane(`${s} ${d}`, ease(s, d, a), ["var(--x)", "var(--y)", "var(--z)"][i])), curve: ["Quad", d], a, rows: [["direction", d]], code: `TweenInfo.new(1, Enum.EasingStyle.Quad, Enum.EasingDirection.${d})` }) };
  for (const s of ["Begin", "Delayed", "Playing", "Paused", "Completed", "Cancelled"]) TW["PlaybackState." + s] = { say: { Begin: "Begin: made with Create but not played yet.", Delayed: "Delayed: Play was called and it's waiting out its DelayTime.", Playing: "Playing: moving right now.", Paused: "Paused: stopped by :Pause(). :Play() continues.", Completed: "Completed: reached the end by itself.", Cancelled: "Cancelled: stopped by :Cancel()." }[s], custom: "player", highlight: s };

  /* ---------- tween renderers ---------- */
  function TweenScene({ fr }) {
    const W = 520, lanes = fr.lanes || [], H = 70 + lanes.length * 52 + (fr.curve ? 120 : 0);
    let y = 24;
    const out = [];
    for (const l of lanes) {
      const x0 = 30, x1 = W - 60, x = x0 + (x1 - x0) * l.x;
      out.push(html`<g><text x=${x0} y=${y} font-size="11" font-weight="700" fill="var(--muted)">${l.label}</text>
        <rect x=${x0} y=${y + 8} width=${x1 - x0 + 30} height="26" rx="13" fill="var(--sunk)" stroke="var(--line)" />
        ${l.wait !== undefined && html`<rect x=${x0} y=${y + 36} width=${(x1 - x0 + 30) * l.wait} height="4" rx="2" fill="var(--warn)" />`}
        <rect x=${x} y=${y + 10} width="30" height="22" rx="6" style=${`fill:${l.tint !== undefined ? `color-mix(in srgb, ${l.color} ${Math.round(100 - l.tint * 60)}%, #ff7828)` : l.color}`} opacity=${1 - (l.fade || 0)} /></g>`);
      y += 52;
    }
    if (fr.curve) {
      const gx = 30, gy = y + 100, gw = 200, gh = 90, pts = [];
      for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push(`${(gx + t * gw).toFixed(1)},${(gy - ease(fr.curve[0], fr.curve[1], t) * gh).toFixed(1)}`); }
      out.push(html`<g><rect x=${gx} y=${gy - gh} width=${gw} height=${gh} fill="none" stroke="var(--line)" /><polyline points=${pts.join(" ")} fill="none" stroke="var(--accent)" stroke-width="2.5" />
        <circle cx=${gx + fr.a * gw} cy=${gy - ease(fr.curve[0], fr.curve[1], fr.a) * gh} r="5" fill="var(--ink)" />
        <text x=${gx + gw + 10} y=${gy - gh + 12} font-size="11" fill="var(--muted)">${fr.curve[0]} ${fr.curve[1]}</text><text x=${gx + gw + 10} y=${gy - gh + 28} font-size="11" fill="var(--muted)">→ time, ↑ progress</text></g>`);
    }
    return html`<svg viewBox="0 0 ${W} ${y + (fr.curve ? 110 : 0)}" role="img" aria-label="Tween animation">${out}</svg>`;
  }

  const STATES = ["Begin", "Delayed", "Playing", "Paused", "Completed", "Cancelled"];
  function TweenPlayer({ highlight }) {
    const [st, setSt] = useState({ state: "Begin", p: 0, delay: 0, log: [] });
    const ref = useRef(st); ref.current = st;
    useEffect(() => {
      let raf, last = performance.now();
      const tick = (now) => {
        const dt = (now - last) / 1000; last = now;
        const s = ref.current;
        if (s.state === "Delayed") { const d = s.delay + dt; setSt(d >= 0.6 ? { ...s, state: "Playing", delay: d } : { ...s, delay: d }); }
        else if (s.state === "Playing") { const p = s.p + dt / 2; setSt(p >= 1 ? { ...s, p: 1, state: "Completed", log: [...s.log, "Completed fired: PlaybackState.Completed"] } : { ...s, p }); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    const play = () => setSt((s) => s.state === "Paused" ? { ...s, state: "Playing", log: [...s.log, ":Play() → continues"] } : s.state === "Playing" || s.state === "Delayed" ? s : { ...s, state: "Delayed", p: s.state === "Completed" || s.state === "Cancelled" ? 0 : s.p, delay: 0, base: s.x ?? 0, log: [...s.log, ":Play()"] });
    const pause = () => setSt((s) => s.state === "Playing" ? { ...s, state: "Paused", log: [...s.log, ":Pause()"] } : s);
    const cancel = () => setSt((s) => s.state === "Playing" || s.state === "Paused" || s.state === "Delayed" ? { ...s, state: "Cancelled", stuck: ease("Quad", "Out", s.p), p: 0, log: [...s.log, ":Cancel()", "Completed fired: PlaybackState.Cancelled"] } : s);
    const x = st.state === "Cancelled" ? st.stuck : ease("Quad", "Out", st.p);
    const lit = (n) => n === st.state;
    return html`<div style="display:flex;flex-direction:column;gap:10px">
      <${TweenScene} fr=${{ lanes: [lane(`part (tween is ${st.state})`, x, "var(--z)", { wait: st.state === "Delayed" ? st.delay / 0.6 : undefined })] }} />
      <div class="btnrow"><button class="btn primary" type="button" onClick=${play}>tween:Play()</button><button class="btn" type="button" onClick=${pause}>tween:Pause()</button><button class="btn" type="button" onClick=${cancel}>tween:Cancel()</button></div>
      <div class="toc">${STATES.map((n) => html`<span class="badge" style=${`cursor:default;${lit(n) ? "background:var(--accent);color:#fff;border-color:var(--accent)" : n === highlight ? "border-color:var(--accent);color:var(--accent)" : ""}`}>${n}</span>`)}</div>
      <div class="log" style="height:auto;min-height:60px;max-height:110px">${st.log.length ? st.log.slice(-5).map((l) => html`<div>${l}</div>`) : html`<div style="color:var(--c-com)">Press tween:Play()</div>`}</div>
      <${BB.Code} code=${`local tween = TweenService:Create(part, TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, 0, false, 0.6), { Position = goal })\n\ntween.Completed:Connect(function(playbackState)\n\tprint("Completed:", playbackState) --> Enum.PlaybackState.Completed or .Cancelled\nend)\n\ntween:Play()\nprint(tween.PlaybackState) --> Enum.PlaybackState.${st.state}`} /></div>`;
  }

  function SmoothDampViz() {
    const s = useRef({ x: 0.1, v: 0, target: 0.8, t: 0 });
    const [, setF] = useState(0);
    useEffect(() => {
      let raf, last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const q = s.current; q.t += dt;
        if (Math.floor(q.t / 1.8) !== q.k) { q.k = Math.floor(q.t / 1.8); q.target = 0.1 + Math.random() * 0.8; }
        // critically damped spring (what SmoothDamp does), smoothTime 0.35
        const st = 0.35, w = 2 / st, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), ch = q.x - q.target, tmp = (q.v + w * ch) * dt;
        q.v = (q.v - w * tmp) * e; q.x = q.target + (ch + tmp) * e;
        setF((n) => n + 1);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    const q = s.current, W = 520, x0 = 30, x1 = W - 60;
    return html`<div style="display:flex;flex-direction:column;gap:10px"><svg viewBox="0 0 ${W} 90" role="img" aria-label="SmoothDamp follower chasing a target">
      <rect x=${x0} y="30" width=${x1 - x0 + 30} height="30" rx="15" fill="var(--sunk)" stroke="var(--line)" />
      <rect x=${x0 + (x1 - x0) * q.target} y="26" width="30" height="38" rx="6" fill="none" stroke="var(--accent)" stroke-dasharray="4 3" stroke-width="2" /><text x=${x0 + (x1 - x0) * q.target + 15} y="18" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent)">target</text>
      <rect x=${x0 + (x1 - x0) * q.x} y="33" width="30" height="24" rx="6" fill="var(--z)" /><text x=${x0 + (x1 - x0) * q.x + 15} y="80" text-anchor="middle" font-size="11" font-weight="700" fill="var(--z)">current</text></svg>
      <dl class="readout"><dt>current</dt><dd>${f(q.x, 3)}</dd><dt>velocity</dt><dd>${f(q.v, 3)}</dd></dl>
      <${BB.Code} code=${`-- LocalScript: a camera/part that smoothly follows a moving target\nlocal velocity = 0\nRunService.RenderStepped:Connect(function(dt)\n\tcurrent, velocity = TweenService:SmoothDamp(current, target, velocity, 0.35, math.huge, dt)\nend)`} /></div>`;
  }

  /* ---------- the component shown in member cards ---------- */
  const REG = { "datatype/CFrame": CF, "class/TweenService": TW, "class/Tween": TW, "class/TweenBase": TW, "datatype/TweenInfo": TW, "enum/EasingStyle": TW, "enum/EasingDirection": TW, "enum/PlaybackState": TW };
  BB.memberViz = (ownerKey, name) => { const r = REG[ownerKey]; return r && r[name] ? r[name] : null; };
  BB.MemberViz = function ({ spec }) {
    const [playing, setPlaying] = useState(true);
    const [a, setA] = useState(0);
    const [t, setT] = useState(0);
    const root = useRef();
    const [vis, setVis] = useState(true);
    useEffect(() => {
      if (!root.current || !window.IntersectionObserver) return;
      const io = new IntersectionObserver((es) => setVis(es[0].isIntersecting));
      io.observe(root.current);
      return () => io.disconnect();
    }, []);
    useEffect(() => {
      if (!playing || !vis || spec.custom) return;
      let raf, start = performance.now() - t * 1000;
      const tick = (now) => { const tt = (now - start) / 1000; setT(tt); setA((1 - Math.cos((tt / 4) * Math.PI * 2)) / 2); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [playing, vis]);
    if (spec.custom === "player") return html`<div class="mviz" ref=${root}><p class="lab-say" style="margin:0">${spec.say}</p><${TweenPlayer} highlight=${spec.highlight} /></div>`;
    if (spec.custom === "smoothdamp") return html`<div class="mviz" ref=${root}><p class="lab-say" style="margin:0">${spec.say}</p><${SmoothDampViz} /></div>`;
    const fr = spec.frame(a, t);
    const is3d = !!fr.objs;
    return html`<div class="mviz" ref=${root}>
      <p class="lab-say" style="margin:0"><${Inline2} t=${spec.say} /></p>
      <div class="mviz-body">
        <div class="mviz-stage">${is3d ? html`<svg viewBox="0 0 520 320" role="img" aria-label="Animated diagram">${render3D(fr.objs, 520, 320)}</svg>` : html`<${TweenScene} fr=${fr} />`}</div>
        <div class="mviz-side">
          <div class="btnrow" style="align-items:center"><button class="btn" type="button" onClick=${() => setPlaying((p) => !p)}>${playing ? "Pause" : "Play"}</button>
            ${!playing && html`<input type="range" min="0" max="1" step="0.01" value=${a} aria-label="Scrub" style="flex:1" onInput=${(e) => { const v = +e.currentTarget.value; setA(v); setT((Math.acos(1 - 2 * v) / (Math.PI * 2)) * 4); }} />`}</div>
          <dl class="readout">${fr.rows.map(([k, v, c]) => html`<dt>${k}</dt><dd class=${c || ""}>${v}</dd>`)}</dl>
          <${BB.Code} code=${fr.code} />
        </div></div></div>`;
  };
  const Inline2 = ({ t }) => html`${String(t || "").split(/(`[^`]+`)/g).map((p) => (p.startsWith("`") && p.endsWith("`") ? html`<code>${p.slice(1, -1)}</code>` : p))}`;
})();

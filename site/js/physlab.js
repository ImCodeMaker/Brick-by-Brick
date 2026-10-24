/* Physics anatomy labs: every constraint and mover, simulated live, labeled like an exploded diagram. */
(function () {
  const BB = window.BB;
  const { html, useState, useEffect, useRef } = window.htmPreact;
  const M = BB.m3;
  const { V, add, sub, mul, dot, cross, len, unit, angles, cf, cfMul, cfPoint, camera, arrowPath } = M;
  const f = BB.fmt;
  const G = 196.2;
  const R2D = 180 / Math.PI, D2R = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------------- scene builder ---------------- */
  const COLORS = {
    base: [120, 128, 145], part: [86, 125, 214], part2: [217, 96, 40], wood: [176, 122, 72], metal: [150, 160, 172],
    green: [70, 170, 110], yellow: [235, 190, 60], glass: [140, 200, 230], dark: [70, 76, 92],
  };
  const LIGHT = unit(V(0.45, 0.85, 0.6));
  function Scene(proj) {
    const polys = [], over = [], calls = [];
    const shadeCol = (c, k, a = 1) => `rgba(${Math.round(c[0] * k + 25)},${Math.round(c[1] * k + 22)},${Math.round(c[2] * k + 18)},${a})`;
    const S = {
      proj,
      poly(world, n, color, o = {}) {
        let P = world.map(proj);
        const wn = cross(sub(world[1], world[0]), sub(world[2], world[0]));
        if (n && dot(wn, n) < 0) { world = world.slice().reverse(); P = P.slice().reverse(); }
        const a = P[0], b = P[1], d = P[2];
        const cr = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
        if (cr >= 0 && !o.double) return;
        const depth = P.reduce((s, p) => s + p[2], 0) / P.length;
        const k = 0.55 + 0.45 * Math.max(0, dot(unit(n || wn), LIGHT));
        polys.push({ P, depth: depth + (o.bias || 0), fill: o.flat ? o.flat : shadeCol(color, k, o.alpha ?? 1), stroke: o.stroke || "rgba(0,0,0,.28)", dash: o.dash });
      },
      box(c, s, color, o = {}) {
        const hx = s.x / 2, hy = s.y / 2, hz = s.z / 2;
        const P = (x, y, z) => cfPoint(c, V(x * hx, y * hy, z * hz));
        const F = [[V(1, 0, 0), [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)]], [V(-1, 0, 0), [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)]],
          [V(0, 1, 0), [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)]], [V(0, -1, 0), [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)]],
          [V(0, 0, 1), [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)]], [V(0, 0, -1), [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)]]];
        for (const [n, w] of F) S.poly(w, M.matMulVec(c.m, n), o.front && n.z === -1 ? o.front : color, o);
      },
      cyl(c, r, l, color, o = {}) { // axis = c's X axis (like a Roblox cylinder part)
        const seg = o.seg || 20, ring = (x) => { const out = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; out.push(cfPoint(c, V(x, Math.cos(a) * r, Math.sin(a) * r))); } return out; };
        const r0 = ring(-l / 2), r1 = ring(l / 2), ax = c.m[0];
        for (let i = 0; i < seg; i++) {
          const j = (i + 1) % seg, mid = sub(mul(add(add(r0[i], r0[j]), add(r1[i], r1[j])), 0.25), c.p);
          S.poly([r0[i], r0[j], r1[j], r1[i]], sub(mid, mul(ax, dot(mid, ax))), color, { ...o, stroke: "none" });
        }
        S.poly(r1, ax, color, o);
        S.poly(r0.slice().reverse(), mul(ax, -1), color, o);
        if (o.spokes !== false) { // spokes on both caps so turning is visible
          for (const [rr, x] of [[r1, l / 2 + 0.02], [r0, -l / 2 - 0.02]]) {
            for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + (o.spin || 0); S.seg(cfPoint(c, V(x, 0, 0)), cfPoint(c, V(x, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9)), "rgba(255,255,255,.75)", 2.5, null, "cap" + x); }
          }
        }
      },
      seg(a, b, color, w = 2, dash, tag) { over.push({ k: "line", a: proj(a), b: proj(b), color, w, dash, tag }); },
      path(list, color, w = 2, dash) { over.push({ k: "path", P: list.map(proj), color, w, dash }); },
      arrow(a, b, color, w = 3, dash) { over.push({ k: "arrow", a: proj(a), b: proj(b), color, w, dash }); },
      dot(p, r, color) { over.push({ k: "dot", p: proj(p), r, color }); },
      text(p, t, color = "var(--ink)", dx = 8, dy = -6, anchor = "start") { over.push({ k: "text", p: proj(p), t, color, dx, dy, anchor }); },
      attach(c, name, scale = 1.6) {
        const p = c.p;
        S.arrow(p, add(p, mul(c.m[0], scale)), "#f5c518", 2.5); // primary axis (X) = yellow
        S.arrow(p, add(p, mul(c.m[1], scale * 0.8)), "#ff8c1a", 2); // secondary axis (Y) = orange
        over.push({ k: "att", p: proj(p) });
        if (name) S.callout(p, name);
      },
      callout(p, t) { calls.push({ p: proj(p), t }); },
      ground(size = 10, y = 0, step = 2) {
        for (let i = -size; i <= size; i += step) { S.seg(V(i, y, -size), V(i, y, size), "var(--line)", 1, null, "grid"); S.seg(V(-size, y, i), V(size, y, i), "var(--line)", 1, null, "grid"); }
      },
      render(W, H) {
        polys.sort((a, b) => a.depth - b.depth);
        const grid = over.filter((o) => o.tag === "grid"), rest = over.filter((o) => o.tag !== "grid");
        const drawOver = (o, i) => {
          if (o.k === "line") return html`<line key=${i} x1=${o.a[0]} y1=${o.a[1]} x2=${o.b[0]} y2=${o.b[1]} stroke=${o.color} stroke-width=${o.w} stroke-dasharray=${o.dash || ""} stroke-linecap="round" />`;
          if (o.k === "path") return html`<polyline key=${i} points=${o.P.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} fill="none" stroke=${o.color} stroke-width=${o.w} stroke-dasharray=${o.dash || ""} stroke-linejoin="round" stroke-linecap="round" />`;
          if (o.k === "arrow") { const p = arrowPath(o.a, o.b, 8); return html`<g key=${i}><path d=${p.line} stroke=${o.color} stroke-width=${o.w} stroke-dasharray=${o.dash || ""} fill="none" stroke-linecap="round" /><polygon points=${p.head} fill=${o.color} /></g>`; }
          if (o.k === "dot") return html`<circle key=${i} cx=${o.p[0]} cy=${o.p[1]} r=${o.r} fill=${o.color} />`;
          if (o.k === "att") return html`<g key=${i}><circle cx=${o.p[0]} cy=${o.p[1]} r="5.5" fill="#3ddc84" stroke="#0b3d22" stroke-width="1.5" /></g>`;
          if (o.k === "text") return html`<text key=${i} x=${o.p[0] + o.dx} y=${o.p[1] + o.dy} font-size="12" font-weight="700" fill=${o.color} text-anchor=${o.anchor}>${o.t}</text>`;
        };
        // anatomy callouts: leader lines out to the margins
        const left = calls.filter((c) => c.p[0] < W / 2).sort((a, b) => a.p[1] - b.p[1]);
        const right = calls.filter((c) => c.p[0] >= W / 2).sort((a, b) => a.p[1] - b.p[1]);
        const place = (list, x) => { let y = 18; return list.map((c) => { const ty = Math.max(y, Math.min(H - 10, c.p[1])); y = ty + 20; return { ...c, x, y: ty }; }); };
        const labels = [...place(left, 10), ...place(right, W - 10)];
        return html`
          ${grid.map(drawOver)}
          ${polys.map((p, i) => html`<polygon key=${"p" + i} points=${p.P.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ")} fill=${p.fill} stroke=${p.stroke} stroke-width="1" stroke-linejoin="round" stroke-dasharray=${p.dash || ""} />`)}
          ${rest.map(drawOver)}
          ${labels.map((c, i) => { const lx = c.x < W / 2 ? c.x + Math.min(150, c.t.length * 6.6) + 6 : c.x - Math.min(150, c.t.length * 6.6) - 6;
            return html`<g key=${"c" + i} class="callout-g"><polyline points=${`${c.p[0]},${c.p[1]} ${lx},${c.y - 4}`} fill="none" stroke="var(--muted)" stroke-width="1" /><circle cx=${c.p[0]} cy=${c.p[1]} r="2.5" fill="var(--muted)" />
              <text x=${c.x} y=${c.y} font-size="11.5" font-weight="700" fill="var(--ink)" text-anchor=${c.x < W / 2 ? "start" : "end"} paint-order="stroke" stroke="var(--sunk)" stroke-width="3">${c.t}</text></g>`; })}`;
      },
    };
    return S;
  }
  BB.Scene = Scene;

  const rotY = (a) => angles(0, a, 0), rotX = (a) => angles(a, 0, 0), rotZ = (a) => angles(0, 0, a);
  const springPath = (a, b, coils, r = 0.6) => {
    const d = sub(b, a), L = len(d), u = unit(d);
    let s = Math.abs(u.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const p1 = unit(cross(u, s)), p2 = cross(u, p1);
    const out = [], N = coils * 16;
    for (let i = 0; i <= N; i++) { const t = i / N, ang = t * coils * Math.PI * 2; out.push(add(add(a, mul(u, L * t)), add(mul(p1, Math.cos(ang) * r), mul(p2, Math.sin(ang) * r)))); }
    return out;
  };

  /* ---------------- the configs ---------------- */
  const P = (k, min, max, step, def, extra = {}) => ({ k, type: "range", min, max, step, def, ...extra });
  const B = (k, def, extra = {}) => ({ k, type: "bool", def, ...extra });
  const E = (k, options, def, extra = {}) => ({ k, type: "enum", options, def, ...extra });

  const C = {};

  C.HingeConstraint = {
    title: "HingeConstraint", hint: "A door or a wheel that turns around ONE axis.",
    params: [E("Example", ["Door", "Wheel"], "Door", { demo: true }), E("ActuatorType", ["None", "Motor", "Servo"], "Servo"),
      P("AngularVelocity", -10, 10, 0.5, 3, { show: (p) => p.ActuatorType === "Motor", unit: " rad/s", say: "Motor target spin speed (radians per second). 6.28 = one turn per second." }),
      P("MotorMaxTorque", 0, 20000, 500, 8000, { show: (p) => p.ActuatorType === "Motor", say: "How hard the motor may twist. Too low and it can't reach full speed." }),
      P("TargetAngle", -90, 90, 5, 75, { show: (p) => p.ActuatorType === "Servo", unit: "°", say: "Servo: the angle it tries to reach and hold." }),
      P("AngularSpeed", 0.2, 10, 0.2, 2, { show: (p) => p.ActuatorType === "Servo", unit: " rad/s", say: "Servo: how fast it may turn on the way." }),
      B("LimitsEnabled", false, { say: "Stop the hinge at LowerAngle and UpperAngle, like a door stopper." }),
      P("UpperAngle", 0, 180, 5, 90, { show: (p) => p.LimitsEnabled, unit: "°" }), P("LowerAngle", -180, 0, 5, -45, { show: (p) => p.LimitsEnabled, unit: "°" }),
      P("Restitution", 0, 1, 0.05, 0.3, { show: (p) => p.LimitsEnabled, say: "Bounciness when it hits a limit. 0 = thud, 1 = full bounce." })],
    init: () => ({ a: 0, w: 0 }),
    step(s, dt, p) {
      const I = 400;
      let tq = 0;
      if (p.ActuatorType === "Motor") tq = clamp((p.AngularVelocity - s.w) * I * 30, -p.MotorMaxTorque, p.MotorMaxTorque);
      else if (p.ActuatorType === "Servo") { const wd = clamp((p.TargetAngle * D2R - s.a) * 6, -p.AngularSpeed, p.AngularSpeed); tq = clamp((wd - s.w) * I * 30, -20000, 20000); }
      else s.w *= 1 - 0.5 * dt;
      s.w += (tq / I) * dt; s.a += s.w * dt;
      if (p.LimitsEnabled) {
        if (s.a > p.UpperAngle * D2R) { s.a = p.UpperAngle * D2R; s.w = -s.w * p.Restitution; }
        if (s.a < p.LowerAngle * D2R) { s.a = p.LowerAngle * D2R; s.w = -s.w * p.Restitution; }
      }
    },
    auto(s, t, p) { return { ...p, ActuatorType: p.Example === "Wheel" ? "Motor" : "Servo", TargetAngle: Math.sin(t * 0.9) > 0 ? 80 : -10 }; },
    actions: [["Push it", (s) => (s.w += 4)]],
    draw(S, s, p) {
      S.ground(10, 0);
      if (p.Example === "Wheel") {
        S.box(cf(V(-3, 3, 0)), V(5, 1.4, 3), COLORS.base);
        S.callout(V(-4.5, 3.7, 0), "Part0: car body");
        const hub = V(0, 3, 0);
        const c0 = cf(V(-0.5, 3, 0)), wheel = cf(hub, rotX(s.a));
        S.cyl(cfMul(wheel, cf(V(0.6, 0, 0))), 2.6, 1.2, COLORS.dark, { spin: 0 });
        S.attach(c0, "Attachment0 (on body)");
        S.attach(cf(V(0, 3, 0), rotX(s.a)), "Attachment1 (in wheel)");
        S.callout(V(0.6, 5.6, 0), "Part1: wheel (spins)");
        S.callout(V(1.4, 3, 0), "Hinge axis = yellow arrow");
        S.seg(V(-1.5, 3, 0), V(3, 3, 0), "#f5c518", 1.5, "4 4");
      } else {
        S.box(cf(V(0, 4, 0)), V(1, 8, 1), COLORS.base);
        S.callout(V(0, 7.6, 0), "Part0: door frame (Anchored)");
        const hinge = V(0.5, 4, 0);
        const door = cfMul(cf(hinge, rotY(-s.a)), cf(V(2.7, 0, 0)));
        S.box(door, V(5, 7, 0.4), COLORS.wood, { front: COLORS.part2 });
        S.callout(cfPoint(door, V(1.6, 2.6, 0)), "Part1: door (not anchored)");
        const up = cf(hinge, angles(0, 0, Math.PI / 2));
        S.attach(up, "Attachments (same spot)");
        S.seg(V(0.5, 0, 0), V(0.5, 8.5, 0), "#f5c518", 1.5, "4 4");
        S.callout(V(0.5, 8.4, 0), "Hinge axis (primary axis, yellow)");
        const arc = []; for (let i = 0; i <= 20; i++) { const a = (-s.a * i) / 20; arc.push(add(V(0.5, 0.05, 0), V(Math.cos(a) * 3, 0, Math.sin(a) * 3))); }
        S.path(arc, "var(--accent)", 2.5);
        if (p.ActuatorType === "Servo") { const ta = -p.TargetAngle * D2R; S.seg(V(0.5, 0.05, 0), V(0.5 + Math.cos(ta) * 5.5, 0.05, Math.sin(ta) * 5.5), "var(--accent)", 1.5, "5 4"); S.text(V(0.5 + Math.cos(ta) * 5.8, 0.05, Math.sin(ta) * 5.8), "TargetAngle", "var(--accent)"); }
      }
    },
    read: (s, p) => [["CurrentAngle", f(s.a * R2D, 1) + "°"], ["CurrentAngularVelocity", f(s.w, 2) + " rad/s"], ["Mode", p.ActuatorType]],
    code: (p) => `-- Script: ${p.Example === "Wheel" ? "a motor that spins a wheel" : "a door that opens itself"}\nlocal ${p.Example === "Wheel" ? "body, wheel = workspace.Body, workspace.Wheel" : "frame, door = workspace.Frame, workspace.Door"}\n\nlocal a0 = Instance.new("Attachment")\na0.Parent = ${p.Example === "Wheel" ? "body" : "frame"}\na0.${p.Example === "Wheel" ? "Position = Vector3.new(2.5, 0, 0)  -- the axle spot on the body" : "Orientation = Vector3.new(0, 0, 90) -- turn the yellow axis to point UP"}\n\nlocal a1 = Instance.new("Attachment")\na1.Parent = ${p.Example === "Wheel" ? "wheel" : "door"}\na1.${p.Example === "Wheel" ? "Position = Vector3.new(-0.6, 0, 0)" : "Orientation = Vector3.new(0, 0, 90)\na1.Position = Vector3.new(-2.5, 0, 0) -- the door's left edge"}\n\nlocal hinge = Instance.new("HingeConstraint")\nhinge.Attachment0 = a0\nhinge.Attachment1 = a1\nhinge.ActuatorType = Enum.ActuatorType.${p.ActuatorType}\n${p.ActuatorType === "Motor" ? `hinge.AngularVelocity = ${p.AngularVelocity} -- radians per second\nhinge.MotorMaxTorque = ${p.MotorMaxTorque}\n` : p.ActuatorType === "Servo" ? `hinge.TargetAngle = ${p.TargetAngle} -- degrees\nhinge.AngularSpeed = ${p.AngularSpeed}\nhinge.ServoMaxTorque = math.huge\n` : ""}${p.LimitsEnabled ? `hinge.LimitsEnabled = true\nhinge.UpperAngle = ${p.UpperAngle}\nhinge.LowerAngle = ${p.LowerAngle}\n` : ""}hinge.Parent = ${p.Example === "Wheel" ? "wheel" : "door"}`,
    steps: (p) => [p.Example === "Wheel" ? "Make the body (Part0) and a Cylinder part for the wheel (Part1). Don't anchor the wheel!" : "Make the frame (Anchored) and the door (NOT anchored). Anchored parts can't move, even with a hinge.",
      "Put one Attachment in each part at the spot where they should turn together.", "Point both attachments' yellow arrow (the primary axis) along the line you want to turn around.",
      "Insert a HingeConstraint and set Attachment0 and Attachment1.", "Pick ActuatorType: None = free swinging, Motor = keep spinning, Servo = go to an angle and stay."],
  };

  C.SpringConstraint = {
    title: "SpringConstraint", hint: "Pushes and pulls two attachments toward a resting length, like a real spring.",
    params: [P("Stiffness", 0, 3000, 50, 600, { say: "How strong the spring is. Bigger = shorter bounces, harder pull." }), P("Damping", 0, 100, 1, 6, { say: "Friction that calms the bouncing. 0 = bounces forever." }),
      P("FreeLength", 1, 9, 0.5, 5, { say: "The length the spring WANTS to be (studs) when nothing pushes on it." }), P("mass", 1, 20, 0.5, 5, { demo: true, label: "Block mass" }),
      P("Coils", 2, 14, 1, 8, { say: "Just looks: how many loops are drawn." }), B("LimitsEnabled", false), P("MaxLength", 4, 11, 0.5, 9, { show: (p) => p.LimitsEnabled })],
    init: () => ({ L: 5, v: 0 }),
    step(s, dt, p) { const a = G - (p.Stiffness / p.mass) * (s.L - p.FreeLength) - (p.Damping / p.mass) * s.v; s.v += a * dt; s.L += s.v * dt; if (s.L < 0.6) { s.L = 0.6; s.v = 0; } const mx = p.LimitsEnabled ? p.MaxLength : 11; if (s.L > mx) { s.L = mx; s.v = Math.min(0, s.v); } },
    actions: [["Pull down", (s) => { s.L = Math.min(10.5, s.L + 3); s.v = 0; }], ["Push up", (s) => { s.L = 1.2; s.v = 0; }]],
    auto(s, t, p) { if (Math.floor(t / 2.5) !== s._k) { s._k = Math.floor(t / 2.5); s.L = 9; s.v = 0; } return p; },
    draw(S, s, p) {
      S.ground(8, 0);
      S.box(cf(V(0, 12.3, 0)), V(6, 0.6, 4), COLORS.base); S.callout(V(-2.5, 12.6, 0), "Part0: ceiling (Anchored)");
      const top = V(0, 12, 0), bot = V(0, 12 - s.L, 0);
      S.path(springPath(top, bot, p.Coils, 0.7), "var(--muted)", 2.5);
      S.box(cf(add(bot, V(0, -1, 0))), V(2.2, 2, 2.2), COLORS.part);
      S.callout(add(bot, V(1, -1.5, 0)), `Part1: block (mass ${p.mass})`);
      S.attach(cf(top, rotZ(-Math.PI / 2)), "Attachment0"); S.attach(cf(bot, rotZ(-Math.PI / 2)), "Attachment1");
      S.seg(V(2.2, 12, 0), V(2.2, 12 - p.FreeLength, 0), "var(--y)", 2.5); S.text(V(2.2, 12 - p.FreeLength / 2, 0), "FreeLength", "var(--y)");
      S.seg(V(-2.2, 12, 0), V(-2.2, 12 - s.L, 0), "var(--accent)", 2.5); S.text(V(-2.2, 12 - s.L / 2, 0), "CurrentLength", "var(--accent)", -8, -6, "end");
    },
    read: (s, p) => [["CurrentLength", f(s.L, 2) + " studs"], ["stretch (L − FreeLength)", f(s.L - p.FreeLength, 2)], ["spring force ≈ Stiffness × stretch", f(p.Stiffness * (s.L - p.FreeLength), 0)], ["weight (mass × 196.2)", f(p.mass * G, 0)], ["rests at", f(p.FreeLength + (p.mass * G) / Math.max(1, p.Stiffness), 2) + " studs"]],
    code: (p) => `-- Script: hang a bouncy block from the ceiling\nlocal a0 = Instance.new("Attachment", workspace.Ceiling)\na0.Position = Vector3.new(0, -0.3, 0) -- bottom of the ceiling\nlocal a1 = Instance.new("Attachment", workspace.Block)\na1.Position = Vector3.new(0, 1, 0)    -- top of the block\n\nlocal spring = Instance.new("SpringConstraint")\nspring.Attachment0 = a0\nspring.Attachment1 = a1\nspring.FreeLength = ${p.FreeLength}  -- resting length (studs)\nspring.Stiffness = ${p.Stiffness}\nspring.Damping = ${p.Damping}\nspring.Coils = ${p.Coils}\nspring.Visible = true -- draw the spring in-game\n${p.LimitsEnabled ? `spring.LimitsEnabled = true\nspring.MaxLength = ${p.MaxLength}\n` : ""}spring.Parent = workspace.Block`,
    steps: () => ["Anchor the ceiling (Part0). Leave the block (Part1) unanchored so it can bounce.", "Add an Attachment to each part where the spring's ends go.", "Insert a SpringConstraint; set Attachment0 and Attachment1.", "Set FreeLength (resting length), then raise Stiffness until it holds the weight, and add Damping so it stops bouncing.", "Tip: to hold a heavy part near FreeLength, Stiffness must be much bigger than mass × 196.2 ÷ how far you allow it to stretch."],
  };

  const pendulumStep = (rigid) => (s, dt, p) => {
    if (p.WinchEnabled) { const d = p.WinchTarget - s.len; s.len += clamp(d, -p.WinchSpeed * dt, p.WinchSpeed * dt); } else if (!rigid) s.len = p.Length; else s.len = p.Length;
    s.vy -= G * dt * 0.35; s.x += s.vx * dt; s.y += s.vy * dt;
    const dx = s.x, dy = s.y - 12, d = Math.hypot(dx, dy) || 1e-6, nx = dx / d, ny = dy / d;
    if (d > s.len || rigid) { s.x = nx * s.len; s.y = 12 + ny * s.len; const vr = s.vx * nx + s.vy * ny; if (vr > 0 || rigid) { const k = rigid ? 1 : 1 + (p.Restitution || 0); s.vx -= nx * vr * k; s.vy -= ny * vr * k; } }
    if (s.y < 1) { s.y = 1; s.vy = Math.abs(s.vy) * 0.3; s.vx *= 0.9; }
    s.vx *= 1 - 0.05 * dt;
  };
  const pendulumDraw = (kind) => (S, s, p) => {
    S.ground(10, 0);
    S.box(cf(V(0, 12.4, 0)), V(4, 0.8, 4), COLORS.base); S.callout(V(-1.8, 12.8, 0), "Part0: beam (Anchored)");
    const A = V(0, 12, 0), Bp = V(s.x, s.y, 0), d = len(sub(Bp, A));
    if (kind === "rope" && d < s.len - 0.05) {
      const sag = Math.sqrt(Math.max(0, s.len * s.len - d * d)) * 0.5, pts = [];
      for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(add(add(A, mul(sub(Bp, A), t)), V(0, -Math.sin(t * Math.PI) * sag, 0))); }
      S.path(pts, "#a0703c", 3); S.text(add(A, V(1, -s.len / 2, 0)), "slack (too loose)", "var(--warn)");
    } else S.seg(A, Bp, kind === "rope" ? "#a0703c" : "var(--muted)", kind === "rope" ? 3 : 6);
    const dir = unit(sub(Bp, A)), yaw = Math.atan2(dir.x, -dir.y);
    S.box(cf(add(Bp, mul(dir, 1)), rotZ(yaw)), V(2, 2, 2), COLORS.part);
    S.attach(cf(A, rotZ(-Math.PI / 2)), "Attachment0"); S.attach(cf(Bp, rotZ(yaw - Math.PI / 2)), "Attachment1");
    S.callout(add(Bp, V(1.2, 1.4, 0)), "Part1: weight");
  };
  C.RopeConstraint = {
    title: "RopeConstraint", hint: "Keeps two attachments no FARTHER apart than Length. Closer is fine: the rope goes slack.",
    params: [P("Length", 2, 11, 0.5, 8, { say: "Maximum distance between the attachments, in studs." }), P("Restitution", 0, 1, 0.05, 0.1, { say: "How much it bounces when the rope snaps tight." }),
      B("WinchEnabled", false, { say: "Turn the rope into a winch that reels in or out by itself." }), P("WinchTarget", 2, 11, 0.5, 4, { show: (p) => p.WinchEnabled, say: "The length the winch reels to." }), P("WinchSpeed", 0.5, 10, 0.5, 3, { show: (p) => p.WinchEnabled, unit: " studs/s" })],
    init: (p) => ({ x: 6, y: 9, vx: 0, vy: 0, len: p.Length }),
    step: pendulumStep(false),
    auto(s, t, p) { if (Math.floor(t / 4) !== s._k) { s._k = Math.floor(t / 4); s.x = 6; s.y = 10; s.vx = 0; s.vy = 0; } return p; },
    actions: [["Kick sideways", (s) => (s.vx += 25)], ["Lift up (slack)", (s) => { s.x = 2; s.y = 10; s.vx = 0; s.vy = 0; }]],
    draw: pendulumDraw("rope"),
    read: (s, p) => { const d = Math.hypot(s.x, s.y - 12); return [["distance", f(d, 2) + " studs"], ["Length", f(s.len, 2)], ["state", d < s.len - 0.05 ? "slack" : "tight", d < s.len - 0.05 ? "" : "ax-y"]]; },
    code: (p) => `local rope = Instance.new("RopeConstraint")\nrope.Attachment0 = workspace.Beam.Attachment\nrope.Attachment1 = workspace.Weight.Attachment\nrope.Length = ${p.Length}\nrope.Restitution = ${p.Restitution}\nrope.Visible = true\n${p.WinchEnabled ? `rope.WinchEnabled = true\nrope.WinchTarget = ${p.WinchTarget} -- reel to this length\nrope.WinchSpeed = ${p.WinchSpeed}\nrope.WinchForce = math.huge\n` : ""}rope.Parent = workspace.Weight`,
    steps: () => ["Anchor the beam. Leave the weight unanchored.", "Add an Attachment to each part.", "Insert a RopeConstraint, set Attachment0/1 and Length.", "Want a crane? Turn on WinchEnabled and change WinchTarget from a script."],
  };
  C.RodConstraint = {
    title: "RodConstraint", hint: "Keeps two attachments at EXACTLY Length apart, like a stiff metal bar. Can push AND pull.",
    params: [P("Length", 2, 11, 0.5, 7, { say: "The exact distance it keeps." })],
    init: (p) => ({ x: 0.3, y: 12 + p.Length, vx: 0, vy: 0, len: p.Length }),
    step: pendulumStep(true),
    auto(s, t, p) { if (Math.floor(t / 4) !== s._k) { s._k = Math.floor(t / 4); s.x = 0.3; s.y = 12 + p.Length; s.vx = 0; s.vy = 0; } return p; },
    actions: [["Start on top", (s, p) => { s.x = 0.3; s.y = 12 + p.Length; s.vx = 0; s.vy = 0; }], ["Kick", (s) => (s.vx += 25)]],
    draw: pendulumDraw("rod"),
    read: (s, p) => [["distance", f(Math.hypot(s.x, s.y - 12), 2) + " studs"], ["Length", f(p.Length)], ["why it differs from Rope", "it can hold the weight ABOVE, a rope can't"]],
    code: (p) => `local rod = Instance.new("RodConstraint")\nrod.Attachment0 = workspace.Beam.Attachment\nrod.Attachment1 = workspace.Weight.Attachment\nrod.Length = ${p.Length}\nrod.Visible = true\nrod.Parent = workspace.Weight`,
    steps: () => ["Same setup as a rope: two attachments, one in each part.", "Insert a RodConstraint and set Length.", "Press \"Start on top\": a rod holds the weight up and lets it swing around. A rope would just let it fall."],
  };

  C.BallSocketConstraint = {
    title: "BallSocketConstraint", hint: "A shoulder joint: swings in EVERY direction around one point.",
    params: [B("LimitsEnabled", true, { say: "Keep the swing inside a cone." }), P("UpperAngle", 5, 180, 5, 45, { show: (p) => p.LimitsEnabled, unit: "°", say: "How wide the cone is, measured from the attachment's yellow axis." }), P("Restitution", 0, 1, 0.05, 0.2, { show: (p) => p.LimitsEnabled })],
    init: () => ({ p: V(4, 12 - 4.9, 2), v: V(0, 0, 0) }),
    step(s, dt, p) {
      const A = V(0, 12, 0), L = 6.4;
      s.v = add(s.v, V(0, -G * 0.35 * dt, 0)); s.p = add(s.p, mul(s.v, dt));
      let d = unit(sub(s.p, A)); s.p = add(A, mul(d, L));
      s.v = sub(s.v, mul(d, dot(s.v, d)));
      if (p.LimitsEnabled) {
        const ax = V(0, -1, 0), ang = Math.acos(clamp(dot(d, ax), -1, 1)), lim = p.UpperAngle * D2R;
        if (ang > lim) { const side = unit(sub(d, mul(ax, dot(d, ax)))); d = add(mul(ax, Math.cos(lim)), mul(side, Math.sin(lim))); s.p = add(A, mul(d, L)); const vo = dot(s.v, side); if (vo > 0) s.v = sub(s.v, mul(side, vo * (1 + p.Restitution))); }
      }
      s.v = mul(s.v, 1 - 0.08 * dt);
    },
    actions: [["Swing!", (s) => (s.v = add(s.v, V(-8 + Math.random() * 16, 0, -14 + Math.random() * 8)))]],
    auto(s, t, p) { if (Math.floor(t / 4) !== s._k) { s._k = Math.floor(t / 4); s.v = V(10, 0, -12); } return p; },
    draw(S, s, p) {
      S.ground(10, 0);
      S.box(cf(V(0, 12.5, 0)), V(3, 1, 3), COLORS.base); S.callout(V(-1.4, 13, 0), "Part0: shoulder (Anchored)");
      const A = V(0, 12, 0);
      if (p.LimitsEnabled) {
        const lim = p.UpperAngle * D2R, ring = [];
        for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; ring.push(add(A, V(Math.sin(lim) * Math.cos(a) * 6.4, -Math.cos(lim) * 6.4, Math.sin(lim) * Math.sin(a) * 6.4))); }
        S.path(ring, "var(--accent)", 1.8, "5 4"); S.seg(A, ring[0], "var(--accent)", 1, "3 4"); S.seg(A, ring[16], "var(--accent)", 1, "3 4");
        S.callout(ring[8], "UpperAngle cone");
      }
      const d = unit(sub(s.p, A));
      const yaw = Math.atan2(d.x, d.z), pitch = Math.acos(clamp(-d.y, -1, 1));
      const arm = cfMul(cf(A, rotY(yaw)), cfMul(cf(V(0, 0, 0), rotX(pitch)), cf(V(0, -3.2, 0))));
      S.box(arm, V(1.2, 6.4, 1.2), COLORS.part); S.callout(cfPoint(arm, V(0, -2.5, 0)), "Part1: arm");
      S.attach(cf(A, rotZ(-Math.PI / 2)), "Attachments (the ball)");
      S.seg(A, add(A, V(0, -7.5, 0)), "#f5c518", 1.2, "3 4");
    },
    read: (s) => { const d = unit(sub(s.p, V(0, 12, 0))); return [["angle from yellow axis", f(Math.acos(clamp(-d.y, -1, 1)) * R2D, 1) + "°"]]; },
    code: (p) => `local ball = Instance.new("BallSocketConstraint")\nball.Attachment0 = workspace.Shoulder.Attachment\nball.Attachment1 = workspace.Arm.Attachment\n${p.LimitsEnabled ? `ball.LimitsEnabled = true\nball.UpperAngle = ${p.UpperAngle} -- cone size in degrees\nball.Restitution = ${p.Restitution}\n` : ""}ball.Parent = workspace.Arm`,
    steps: () => ["Put the attachments at the joint point (same spot in the world).", "Point the attachments' yellow axis down the middle of the swing: the UpperAngle cone is measured from it.", "Turn on TwistLimitsEnabled too if the arm must not spin around its own length."],
  };

  const sliderParams = [E("ActuatorType", ["None", "Motor", "Servo"], "Servo"),
    P("Velocity", -12, 12, 0.5, 5, { show: (p) => p.ActuatorType === "Motor", unit: " studs/s" }), P("MotorMaxForce", 0, 20000, 500, 6000, { show: (p) => p.ActuatorType === "Motor" }),
    P("TargetPosition", -6, 6, 0.5, 4, { show: (p) => p.ActuatorType === "Servo", say: "Where along the rail it goes (studs from the middle)." }), P("Speed", 0.5, 20, 0.5, 6, { show: (p) => p.ActuatorType === "Servo" }),
    B("LimitsEnabled", true), P("LowerLimit", -7, 0, 0.5, -6, { show: (p) => p.LimitsEnabled }), P("UpperLimit", 0, 7, 0.5, 6, { show: (p) => p.LimitsEnabled }), P("Restitution", 0, 1, 0.05, 0.3, { show: (p) => p.LimitsEnabled })];
  const sliderStep = (s, dt, p) => {
    const m = 3; let F = 0;
    if (p.ActuatorType === "Motor") F = clamp((p.Velocity - s.v) * m * 20, -p.MotorMaxForce, p.MotorMaxForce);
    else if (p.ActuatorType === "Servo") { const vd = clamp((p.TargetPosition - s.x) * 5, -p.Speed, p.Speed); F = clamp((vd - s.v) * m * 20, -20000, 20000); }
    else s.v *= 1 - 0.4 * dt;
    s.v += (F / m) * dt; s.x += s.v * dt;
    const lo = p.LimitsEnabled ? p.LowerLimit : -7, hi = p.LimitsEnabled ? p.UpperLimit : 7;
    if (s.x > hi) { s.x = hi; s.v = -s.v * (p.Restitution || 0); } if (s.x < lo) { s.x = lo; s.v = -s.v * (p.Restitution || 0); }
    if (p.AngularActuatorType === "Motor") { s.w = p.AngularVelocity; s.a += s.w * dt; }
  };
  C.PrismaticConstraint = {
    title: "PrismaticConstraint", hint: "Slides along ONE line, no turning. Elevators, sliding doors, pistons.",
    params: sliderParams,
    init: () => ({ x: -3, v: 0, a: 0, w: 0 }), step: sliderStep,
    auto(s, t, p) { return { ...p, ActuatorType: "Servo", TargetPosition: Math.sin(t * 0.8) > 0 ? 5 : -5 }; },
    actions: [["Push", (s) => (s.v += 8)]],
    draw(S, s, p) {
      S.ground(10, 0);
      S.box(cf(V(0, 3, 0)), V(16, 0.5, 0.5), COLORS.metal); S.callout(V(-7.5, 3.3, 0), "Part0: rail (Anchored)");
      S.box(cf(V(s.x, 3, 0)), V(2.4, 1.6, 1.6), COLORS.part); S.callout(V(s.x, 3.8, 0), "Part1: slider");
      S.attach(cf(V(0, 3, 0)), "Attachment0 (rail middle)"); S.attach(cf(V(s.x, 3, 0)), "Attachment1");
      if (p.LimitsEnabled) for (const [x, n] of [[p.LowerLimit, "LowerLimit"], [p.UpperLimit, "UpperLimit"]]) { S.seg(V(x, 2, 0), V(x, 4.4, 0), "var(--bad)", 3); S.text(V(x, 4.6, 0), n, "var(--bad)", 0, -4, "middle"); }
      if (p.ActuatorType === "Servo") { S.seg(V(p.TargetPosition, 1.5, 0), V(p.TargetPosition, 4.6, 0), "var(--accent)", 2, "4 4"); S.text(V(p.TargetPosition, 1.4, 0), "TargetPosition", "var(--accent)", 0, 14, "middle"); }
    },
    read: (s) => [["CurrentPosition", f(s.x, 2) + " studs"], ["Velocity", f(s.v, 2) + " studs/s"]],
    code: (p) => `local slider = Instance.new("PrismaticConstraint")\nslider.Attachment0 = workspace.Rail.Attachment -- yellow axis = the slide line\nslider.Attachment1 = workspace.Door.Attachment\nslider.ActuatorType = Enum.ActuatorType.${p.ActuatorType}\n${p.ActuatorType === "Servo" ? `slider.TargetPosition = ${p.TargetPosition}\nslider.Speed = ${p.Speed}\nslider.ServoMaxForce = math.huge\n` : p.ActuatorType === "Motor" ? `slider.Velocity = ${p.Velocity}\nslider.MotorMaxForce = ${p.MotorMaxForce}\n` : ""}${p.LimitsEnabled ? `slider.LimitsEnabled = true\nslider.LowerLimit = ${p.LowerLimit}\nslider.UpperLimit = ${p.UpperLimit}\n` : ""}slider.Parent = workspace.Door`,
    steps: () => ["The slide happens along the attachments' yellow (primary) axis. Point it where you want to move.", "Servo = go to TargetPosition (elevators). Motor = keep moving at Velocity (conveyors).", "For an elevator going UP, ServoMaxForce must beat the weight: mass × 196.2."],
  };
  C.CylindricalConstraint = {
    title: "CylindricalConstraint", hint: "Slides along a line AND spins around it. A drill, a screw, a car's steering column.",
    params: [...sliderParams, E("AngularActuatorType", ["None", "Motor"], "Motor"), P("AngularVelocity", -10, 10, 0.5, 4, { show: (p) => p.AngularActuatorType === "Motor", unit: " rad/s" })],
    init: () => ({ x: -3, v: 0, a: 0, w: 0 }), step: sliderStep,
    auto(s, t, p) { return { ...p, ActuatorType: "Servo", TargetPosition: Math.sin(t * 0.7) > 0 ? 5 : -5, AngularActuatorType: "Motor" }; },
    draw(S, s, p) {
      S.ground(10, 0);
      S.box(cf(V(0, 3, 0)), V(16, 0.5, 0.5), COLORS.metal); S.callout(V(-7.5, 3.3, 0), "Part0: shaft (Anchored)");
      S.cyl(cf(V(s.x, 3, 0), rotX(s.a)), 1.4, 1.8, COLORS.part2, { spin: s.a }); S.callout(V(s.x, 4.6, 0), "Part1: collar (slides + spins)");
      S.attach(cf(V(s.x, 3, 0)), "Attachment1");
      if (p.ActuatorType === "Servo") S.seg(V(p.TargetPosition, 1.4, 0), V(p.TargetPosition, 4.6, 0), "var(--accent)", 2, "4 4");
    },
    read: (s) => [["CurrentPosition", f(s.x, 2)], ["CurrentAngle", f(((s.a * R2D) % 360 + 360) % 360, 0) + "°"]],
    code: (p) => `local cyl = Instance.new("CylindricalConstraint")\ncyl.Attachment0 = workspace.Shaft.Attachment\ncyl.Attachment1 = workspace.Collar.Attachment\n-- sliding part\ncyl.ActuatorType = Enum.ActuatorType.${p.ActuatorType}\n${p.ActuatorType === "Servo" ? `cyl.TargetPosition = ${p.TargetPosition}\ncyl.Speed = ${p.Speed}\ncyl.ServoMaxForce = math.huge\n` : ""}-- spinning part\ncyl.AngularActuatorType = Enum.ActuatorType.${p.AngularActuatorType}\n${p.AngularActuatorType === "Motor" ? `cyl.AngularVelocity = ${p.AngularVelocity}\ncyl.MotorMaxTorque = math.huge\n` : ""}cyl.Parent = workspace.Collar`,
    steps: () => ["Like a Prismatic (slide) and a Hinge (spin) in one.", "It has two sets of actuator settings: ActuatorType for sliding, AngularActuatorType for spinning."],
  };

  C.TorsionSpringConstraint = {
    title: "TorsionSpringConstraint", hint: "A twisty spring: turn it and it twists back, like a mousetrap or a self-closing gate.",
    params: [P("Stiffness", 0, 600, 10, 120), P("Damping", 0, 40, 1, 3), B("LimitsEnabled", false), P("MaxAngle", 0, 180, 5, 120, { show: (p) => p.LimitsEnabled, unit: "°" })],
    init: () => ({ a: 1.6, w: 0 }),
    step(s, dt, p) { const I = 6; s.w += ((-p.Stiffness * s.a - p.Damping * s.w) / I) * dt; s.a += s.w * dt; if (p.LimitsEnabled) { const m = p.MaxAngle * D2R; if (Math.abs(s.a) > m) { s.a = Math.sign(s.a) * m; s.w = 0; } } },
    actions: [["Twist 90°", (s) => { s.a = Math.PI / 2; s.w = 0; }]],
    auto(s, t) { if (Math.floor(t / 3.5) !== s._k) { s._k = Math.floor(t / 3.5); s.a = 1.7; s.w = 0; } },
    draw(S, s) {
      S.ground(8, 0);
      S.box(cf(V(0, 0.6, 0)), V(3, 1.2, 3), COLORS.base); S.callout(V(-1.4, 1.2, 0), "Part0: base (Anchored)");
      const sp = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * 5 * Math.PI * 2 * (1 + s.a * 0.08); sp.push(V(Math.cos(a) * 0.9, 1.4 + t * 2.2, Math.sin(a) * 0.9)); }
      S.path(sp, "var(--muted)", 2.5);
      const lid = cfMul(cf(V(0, 4, 0), rotY(s.a)), cf(V(2.2, 0, 0)));
      S.box(lid, V(5, 0.6, 1.4), COLORS.part2); S.callout(cfPoint(lid, V(2.2, 0.3, 0)), "Part1: lever");
      S.attach(cf(V(0, 3.6, 0), rotZ(Math.PI / 2)), "Attachments (twist axis = yellow)");
    },
    read: (s, p) => [["CurrentAngle", f(s.a * R2D, 1) + "°"], ["twist-back torque ≈ Stiffness × angle", f(p.Stiffness * s.a, 0)]],
    code: (p) => `local torsion = Instance.new("TorsionSpringConstraint")\ntorsion.Attachment0 = workspace.Base.Attachment\ntorsion.Attachment1 = workspace.Lever.Attachment\ntorsion.Stiffness = ${p.Stiffness}\ntorsion.Damping = ${p.Damping}\n${p.LimitsEnabled ? `torsion.LimitsEnabled = true\ntorsion.MaxAngle = ${p.MaxAngle}\n` : ""}torsion.Parent = workspace.Lever`,
    steps: () => ["The yellow (primary) axis of the attachments is the line it twists around.", "Resting position = when the two attachments' axes line up.", "Higher Stiffness snaps back harder. Damping stops the wobble."],
  };

  C.UniversalConstraint = {
    title: "UniversalConstraint", hint: "Connects two spinning shafts at an angle, like a car's driveshaft joint.",
    params: [P("bend", 0, 60, 5, 35, { demo: true, label: "Bend angle", unit: "°" }), B("LimitsEnabled", true), P("MaxAngle", 0, 90, 5, 45, { show: (p) => p.LimitsEnabled, unit: "°" })],
    init: () => ({ a: 0 }),
    step(s, dt) { s.a += 2.2 * dt; },
    draw(S, s, p) {
      S.ground(10, 0);
      const bend = Math.min(p.bend, p.LimitsEnabled ? p.MaxAngle : 90) * D2R;
      const J = V(0, 4, 0);
      S.cyl(cfMul(cf(J, rotX(s.a)), cf(V(-3.5, 0, 0))), 0.5, 7, COLORS.metal, { spin: 0 }); S.callout(V(-6, 4.6, 0), "Part0: input shaft");
      const out = Math.atan2(Math.tan(s.a), Math.cos(bend)) + (Math.cos(s.a) < 0 ? Math.PI : 0);
      const oc = cfMul(cfMul(cf(J, rotZ(bend)), cf(V(3.5, 0, 0))), cf(V(0, 0, 0), rotX(out)));
      S.cyl(oc, 0.5, 7, COLORS.part2, { spin: 0 }); S.callout(cfPoint(oc, V(3, 0.6, 0)), "Part1: output shaft");
      S.attach(cf(J), "Attachments (the joint)");
    },
    read: (s, p) => { const b = p.bend * D2R, out = Math.atan2(Math.tan(s.a), Math.cos(b)) + (Math.cos(s.a) < 0 ? Math.PI : 0); return [["input angle", f(((s.a * R2D) % 360), 0) + "°"], ["output angle", f((((out * R2D) % 360) + 360) % 360, 0) + "°"], ["note", "bigger bend = wobblier output speed"]]; },
    code: (p) => `local uni = Instance.new("UniversalConstraint")\nuni.Attachment0 = workspace.InputShaft.Attachment\nuni.Attachment1 = workspace.OutputShaft.Attachment\n${p.LimitsEnabled ? `uni.LimitsEnabled = true\nuni.MaxAngle = ${p.MaxAngle} -- how far the shafts may bend\n` : ""}uni.Parent = workspace.OutputShaft`,
    steps: () => ["Put the attachments where the two shafts meet.", "Spin the input shaft (for example with a HingeConstraint motor); the universal joint passes the spin through the bend.", "MaxAngle limits how far the shafts can bend from straight."],
  };

  C.PlaneConstraint = {
    title: "PlaneConstraint", hint: "Keeps an attachment on a flat sheet. It can slide around on it, but never leave it.",
    params: [B("Enabled", true, { say: "Turn it off and the part just falls." }), P("tilt", 0, 40, 2, 16, { demo: true, label: "Tilt sheet", unit: "°" })],
    init: () => ({ p: V(0, 6, 0), v: V(3, 0, 2) }),
    step(s, dt, p) {
      const n = V(Math.sin(p.tilt * D2R), Math.cos(p.tilt * D2R), 0), O = V(0, 6, 0);
      s.v = add(s.v, V(0, -G * 0.25 * dt, 0));
      if (p.Enabled) { s.p = sub(s.p, mul(n, dot(sub(s.p, O), n))); s.v = sub(s.v, mul(n, dot(s.v, n))); }
      s.p = add(s.p, mul(s.v, dt));
      for (const k of ["x", "z"]) if (Math.abs(s.p[k]) > 6) { s.p[k] = Math.sign(s.p[k]) * 6; s.v[k] *= -0.6; }
      if (s.p.y < 1) { s.p.y = 1; s.v.y = 0; s.v = mul(s.v, 0.97); }
    },
    actions: [["Flick", (s) => (s.v = V(-6 + Math.random() * 12, 0, -6 + Math.random() * 12))], ["Reset", (s) => { s.p = V(0, 6, 0); s.v = V(3, 0, 2); }]],
    auto(s, t) { if (Math.floor(t / 3) !== s._k) { s._k = Math.floor(t / 3); s.v = V(Math.cos(t) * 8, 0, Math.sin(t) * 8); } },
    draw(S, s, p) {
      S.ground(10, 0);
      const ang = rotZ(-p.tilt * D2R), c0 = cf(V(0, 6, 0), ang);
      const q = (x, z) => cfPoint(c0, V(x, 0, z));
      S.poly([q(-7, -7), q(-7, 7), q(7, 7), q(7, -7)], M.matMulVec(ang, V(0, 1, 0)), COLORS.glass, { double: true, alpha: 0.35, bias: -50 });
      S.callout(q(-6.5, -6.5), "the plane (through Attachment0)");
      S.box(cf(s.p, ang), V(1.6, 1.6, 1.6), COLORS.part); S.callout(add(s.p, V(0.8, 0.8, 0)), "Part1 (stays on the sheet)");
      S.attach(cfMul(cf(V(0, 6, 0), ang), cf(V(0, 0, 0), rotZ(Math.PI / 2))), "Attachment0: yellow axis = sheet's normal");
    },
    read: (s, p) => [["height above sheet", f(dot(sub(s.p, V(0, 6, 0)), V(Math.sin(p.tilt * D2R), Math.cos(p.tilt * D2R), 0)), 2)], ["Enabled", String(p.Enabled)]],
    code: () => `local plane = Instance.new("PlaneConstraint")\nplane.Attachment0 = workspace.Floor.Attachment -- its yellow axis sticks OUT of the sheet\nplane.Attachment1 = workspace.Puck.Attachment\nplane.Parent = workspace.Puck`,
    steps: () => ["Attachment0's yellow (primary) axis is the NORMAL: the arrow sticking straight out of the sheet.", "Attachment1 can go anywhere on that sheet, and turn freely, but not off it.", "Great for air hockey pucks or keeping a 2.5D game on one plane."],
  };

  const weldCfg = (cls, hint, codeFn, extraSteps) => ({
    title: cls, hint,
    params: [B("Enabled", true, { say: "Turn it off: the glue breaks and Part1 falls." }), P("swing", 0, 1, 0.05, 0.6, { demo: true, label: "Move Part0" })],
    init: () => ({ fall: null, fv: 0 }),
    step(s, dt, p, t) {
      s.t = t;
      if (!p.Enabled) { if (!s.fall) s.fall = s.last || V(0, 6, 0); s.fv -= G * 0.35 * dt; s.fall = add(s.fall, V(0, s.fv * dt, 0)); if (s.fall.y < 1) { s.fall.y = 1; s.fv = 0; } }
      else { s.fall = null; s.fv = 0; }
    },
    draw(S, s, p) {
      S.ground(10, 0);
      const t = s.t || 0, a = Math.sin(t * 1.2) * p.swing;
      const c0 = cf(V(Math.sin(t * 0.8) * 3 * p.swing, 3, 0), rotY(a * 1.5));
      S.box(c0, V(4, 2, 3), COLORS.part); S.callout(cfPoint(c0, V(-1.8, 0.8, 0)), "Part0 (moved by a script)");
      const rel = cf(V(0, 2.5, 0), rotY(0.6));
      const c1 = s.fall ? cf(s.fall, rotY(0.6)) : cfMul(c0, rel);
      s.last = c1.p;
      S.box(c1, V(2, 3, 2), COLORS.part2); S.callout(cfPoint(c1, V(0.8, 1.4, 0)), s.fall ? "Part1: unglued, falls!" : "Part1 (glued on)");
      if (!s.fall) { S.seg(c0.p, c1.p, "var(--accent)", 2, "4 3"); S.callout(add(c0.p, V(0, 1.2, 0)), cls === "Weld" ? "C0 / C1 offsets keep this gap" : "offset saved when you weld"); }
    },
    read: (s, p) => [["Enabled", String(p.Enabled)], ["Part1 follows Part0", p.Enabled ? "yes, perfectly" : "no"]],
    code: codeFn,
    steps: () => extraSteps,
  });
  C.WeldConstraint = weldCfg("WeldConstraint", "Superglue: two parts stay exactly where they were and move as one.",
    () => `-- Script: glue a hat block onto a car\nlocal weld = Instance.new("WeldConstraint")\nweld.Part0 = workspace.Car\nweld.Part1 = workspace.Hat\nweld.Parent = workspace.Car\n-- they keep the gap they had when welded`,
    ["Move the two parts into place FIRST (in Studio or with CFrame).", "Make a WeldConstraint, set Part0 and Part1. They stay exactly as they were.", "Only one of them needs to be moved or anchored; the other follows.", "Want to change the gap later? Disable the weld, move it, enable it again."]);
  C.Weld = weldCfg("Weld", "The older, script-friendly weld: you set the gap yourself with C0 and C1 (CFrames).",
    () => `local weld = Instance.new("Weld")\nweld.Part0 = workspace.Car\nweld.Part1 = workspace.Hat\n-- Part1 sits at: Part0.CFrame * C0 * C1:Inverse()\nweld.C0 = CFrame.new(0, 2.5, 0) * CFrame.Angles(0, math.rad(35), 0)\nweld.C1 = CFrame.new()\nweld.Parent = workspace.Car`,
    ["A Weld does NOT remember where the parts were. Part1 is snapped to Part0.CFrame * C0 * C1:Inverse().", "C0 = an offset from Part0. C1 = an offset from Part1. Usually set C0 and leave C1 empty.", "Use WeldConstraint when you just want \"keep them as they are\"."]);
  C.RigidConstraint = weldCfg("RigidConstraint", "A weld made with attachments: the two attachments are locked together.",
    () => `local rigid = Instance.new("RigidConstraint")\nrigid.Attachment0 = workspace.Car.HatMount\nrigid.Attachment1 = workspace.Hat.Attachment\nrigid.Parent = workspace.Hat`,
    ["Put an Attachment where they should join on each part.", "RigidConstraint snaps Attachment1 onto Attachment0 (position AND rotation).", "Handy with accessories and with breakable joints: it can break when DestructionEnabled is on and the force passes DestructionForce."]);
  C.Motor6D = {
    ...weldCfg("Motor6D", "The joint inside every character: a weld you can ANIMATE by changing its Transform.", () => "", []),
    params: [B("Enabled", true), P("swing", 0, 1, 0.05, 0.8, { demo: true, label: "Animation strength" })],
    draw(S, s, p) {
      S.ground(10, 0);
      const t = s.t || 0;
      const torso = cf(V(0, 5, 0));
      S.box(torso, V(2, 2.6, 1.2), COLORS.part); S.callout(V(-1, 6, 0), "Part0: Torso");
      const shoulder = cfMul(torso, cf(V(1.6, 1, 0)));
      const tr = rotX(Math.sin(t * 2.5) * 1.1 * p.swing);
      const arm = cfMul(cfMul(shoulder, cf(V(0, 0, 0), tr)), cf(V(0, -1.2, 0)));
      S.box(arm, V(0.9, 2.6, 0.9), COLORS.part2); S.callout(cfPoint(arm, V(0.4, -1, 0)), "Part1: Right Arm");
      S.attach(shoulder, "joint: C0 on torso");
      S.callout(add(shoulder.p, V(1, 0.5, 0)), "Transform = the animated turn");
    },
    read: (s) => [["Transform", "changes every frame"]],
    code: () => `-- Animations change Motor6D.Transform for you.\n-- You can also do it yourself (LocalScript, each frame):\nlocal RunService = game:GetService("RunService")\nlocal shoulder = character.RightUpperArm.RightShoulder -- a Motor6D (R15)\nRunService.PreSimulation:Connect(function()\n\tshoulder.Transform = CFrame.Angles(math.sin(os.clock() * 2.5), 0, 0)\nend)`,
    steps: () => ["Every character joint (neck, shoulders, hips) is a Motor6D.", "C0 and C1 set where the joint is. Transform is the extra turn the animation adds on top.", "To make your own animated rig, connect parts with Motor6Ds, then animate them in the Animation Editor."],
  };

  C.NoCollisionConstraint = {
    title: "NoCollisionConstraint", hint: "Two specific parts ignore each other and pass through, but still hit everything else.",
    params: [B("Enabled", true)],
    init: () => ({ y: 10, v: 0 }),
    step(s, dt, p) { s.v -= G * 0.4 * dt; s.y += s.v * dt; const floor = p.Enabled ? 1 : 3.5; if (s.y < floor) { s.y = floor; s.v = -s.v * 0.25; } },
    actions: [["Drop again", (s) => { s.y = 10; s.v = 0; }]],
    auto(s, t) { if (Math.floor(t / 2.5) !== s._k) { s._k = Math.floor(t / 2.5); s.y = 10; s.v = 0; } },
    draw(S, s, p) {
      S.ground(10, 0);
      S.box(cf(V(0, 1.25, 0)), V(5, 2.5, 4), COLORS.green, { alpha: p.Enabled ? 0.55 : 1 }); S.callout(V(-2.4, 2.2, 0), "Part0: green block");
      S.box(cf(V(0, s.y, 0)), V(2, 2, 2), COLORS.part2); S.callout(V(1, s.y + 0.8, 0), "Part1: orange block");
      S.text(V(0, -0.5, 3), p.Enabled ? "ignores the green block, lands on the floor" : "collides: lands on top", p.Enabled ? "var(--y)" : "var(--accent)", 0, 14, "middle");
    },
    read: (s, p) => [["Enabled", String(p.Enabled)]],
    code: () => `local nc = Instance.new("NoCollisionConstraint")\nnc.Part0 = workspace.GreenBlock\nnc.Part1 = workspace.OrangeBlock\nnc.Parent = workspace.OrangeBlock`,
    steps: () => ["Set Part0 and Part1: only THOSE two stop colliding.", "Both still hit the floor and everything else.", "Use it for a character's own vehicle seat, or parts of one machine that overlap. For whole groups, use Collision Groups."],
  };

  /* -------- movers -------- */
  C.LinearVelocity = {
    title: "LinearVelocity", hint: "Makes a part move at an exact speed, using up to MaxForce to get there.",
    params: [P("VelocityX", -30, 30, 1, 15, { label: "VectorVelocity X", unit: " studs/s" }), B("ForceLimitsEnabled", true), P("MaxForce", 0, 6000, 100, 600, { show: (p) => p.ForceLimitsEnabled, say: "The strongest push it may use. Small = slow to speed up." }),
      E("RelativeTo", ["World", "Attachment0"], "World"), P("yaw", -90, 90, 5, 30, { demo: true, label: "Part turn", unit: "°", show: (p) => p.RelativeTo === "Attachment0" })],
    init: () => ({ x: -8, v: V(0, 0, 0), hist: [] }),
    step(s, dt, p) {
      const m = 4, dir = p.RelativeTo === "Attachment0" ? V(Math.cos(p.yaw * D2R), 0, -Math.sin(p.yaw * D2R)) : V(1, 0, 0);
      const target = mul(dir, p.VelocityX);
      const need = mul(sub(target, s.v), m * 25), mag = len(need), lim = p.ForceLimitsEnabled ? p.MaxForce : 1e9;
      const F = mag > lim ? mul(need, lim / mag) : need;
      s.v = add(s.v, mul(F, dt / m)); s.p = add(s.p || V(-8, 1, 0), mul(s.v, dt));
      for (const k of ["x", "z"]) { if (s.p[k] > 9) s.p[k] = -9; if (s.p[k] < -9) s.p[k] = 9; }
      s.F = len(F);
      s.hist.push(len(s.v)); if (s.hist.length > 200) s.hist.shift();
    },
    actions: [["Stop it", (s) => (s.v = V(0, 0, 0))]],
    auto(s, t, p) { if (Math.floor(t / 3) !== s._k) { s._k = Math.floor(t / 3); s.v = V(0, 0, 0); } return p; },
    draw(S, s, p) {
      S.ground(10, 0);
      const pos = s.p || V(-8, 1, 0), c = cf(pos, rotY(p.RelativeTo === "Attachment0" ? p.yaw * D2R : 0));
      S.box(c, V(2.4, 1.6, 1.6), COLORS.part); S.callout(add(pos, V(0, 1, 0)), "part with LinearVelocity");
      S.arrow(pos, add(pos, mul(s.v, 0.2)), "var(--accent)", 3.5); S.text(add(pos, mul(s.v, 0.22)), "velocity", "var(--accent)");
      S.attach(c, null);
      const h = s.hist, base = V(-9, 0, 9);
      if (h.length > 1) S.path(h.map((v, i) => add(base, V(i * 0.09, v * 0.15, 0))), "var(--y)", 2);
      S.seg(add(base, V(0, Math.abs(p.VelocityX) * 0.15, 0)), add(base, V(18, Math.abs(p.VelocityX) * 0.15, 0)), "var(--y)", 1, "4 4");
      S.callout(add(base, V(17, Math.abs(p.VelocityX) * 0.15, 0)), "speed graph: climbs to target");
    },
    read: (s, p) => [["speed now", f(len(s.v), 1) + " studs/s"], ["target", f(Math.abs(p.VelocityX), 1)], ["force used", f(s.F || 0, 0) + (p.ForceLimitsEnabled ? ` / ${p.MaxForce}` : "")]],
    code: (p) => `local att = Instance.new("Attachment", part)\nlocal lv = Instance.new("LinearVelocity")\nlv.Attachment0 = att\nlv.VectorVelocity = Vector3.new(${p.VelocityX}, 0, 0) -- studs per second\nlv.RelativeTo = Enum.ActuatorRelativeTo.${p.RelativeTo}\n${p.ForceLimitsEnabled ? `lv.MaxForce = ${p.MaxForce}` : "lv.ForceLimitsEnabled = false -- infinite force: instant speed"}\nlv.Parent = part`,
    steps: () => ["Needs ONE attachment (Attachment0) in the part you want to move.", "RelativeTo = World: the direction is the world's. Attachment0: the direction turns with the part (great for a car's 'forward').", "MaxForce too small = it speeds up slowly or can't beat gravity. Turn ForceLimitsEnabled off for instant speed.", "VelocityConstraintMode can also be Line (one direction only) or Plane (2 directions)."],
  };
  C.AngularVelocity = {
    title: "AngularVelocity", hint: "Spins a part at an exact rate, using up to MaxTorque.",
    params: [P("AngularVelocityY", -20, 20, 0.5, 6, { label: "AngularVelocity Y", unit: " rad/s" }), P("MaxTorque", 0, 20000, 200, 3000)],
    init: () => ({ a: 0, w: 0 }),
    step(s, dt, p) { const I = 120; s.w += clamp((p.AngularVelocityY - s.w) * I * 20, -p.MaxTorque, p.MaxTorque) / I * dt; s.a += s.w * dt; },
    actions: [["Stop it", (s) => (s.w = 0)]],
    auto(s, t) { if (Math.floor(t / 4) !== s._k) { s._k = Math.floor(t / 4); s.w = 0; } },
    draw(S, s) {
      S.ground(8, 0);
      S.box(cf(V(0, 0.75, 0)), V(1.4, 1.5, 1.4), COLORS.base);
      const c = cf(V(0, 2, 0), rotY(s.a));
      S.box(c, V(9, 0.4, 1.2), COLORS.part2); S.box(cf(V(0, 2.01, 0), rotY(s.a + Math.PI / 2)), V(9, 0.4, 1.2), COLORS.part2);
      S.callout(cfPoint(c, V(4.3, 0.2, 0)), "spinning part (a fan)");
      S.arrow(V(0, 2, 0), V(0, 5, 0), "var(--y)", 3); S.callout(V(0, 5, 0), "spin axis: the Y in (0, Y, 0)");
    },
    read: (s) => [["spin now", f(s.w, 2) + " rad/s"], ["turns per second", f(s.w / (2 * Math.PI), 2)]],
    code: (p) => `local av = Instance.new("AngularVelocity")\nav.Attachment0 = Instance.new("Attachment", fan)\nav.AngularVelocity = Vector3.new(0, ${p.AngularVelocityY}, 0) -- radians/sec around Y\nav.MaxTorque = ${p.MaxTorque}\nav.RelativeTo = Enum.ActuatorRelativeTo.World\nav.Parent = fan`,
    steps: () => ["The Vector3 says which axis to spin around and how fast: (0, 6, 0) = 6 radians per second around Y (about 1 turn/s).", "Positive vs negative = counter-clockwise vs clockwise (right-hand rule).", "MaxTorque limits how hard it can twist, so heavy parts spin up slowly."],
  };
  C.AlignPosition = {
    title: "AlignPosition", hint: "Pulls a part to a target spot, like a magnet. Great for floating pets and hover vehicles.",
    params: [P("TargetX", -7, 7, 0.5, 4, { label: "Position X" }), P("TargetY", 1, 10, 0.5, 6, { label: "Position Y" }), P("Responsiveness", 2, 200, 1, 15, { say: "How quickly it reacts. Higher = snappier." }),
      P("MaxVelocity", 1, 80, 1, 40, { unit: " studs/s" }), P("MaxForce", 0, 5000, 50, 2000, { say: "If MaxForce is less than the weight (mass × 196.2), it can't hold the part up!" }), B("RigidityEnabled", false, { say: "Ignore the limits: snap there instantly, as stiff as possible." })],
    init: () => ({ p: V(-4, 2, 0), v: V(0, 0, 0) }),
    step(s, dt, p) {
      const m = 4, T = V(p.TargetX, p.TargetY, 0);
      if (p.RigidityEnabled) { s.p = add(s.p, mul(sub(T, s.p), Math.min(1, dt * 40))); s.v = V(0, 0, 0); return; }
      let vd = mul(sub(T, s.p), p.Responsiveness * 0.35); if (len(vd) > p.MaxVelocity) vd = mul(unit(vd), p.MaxVelocity);
      let F = mul(sub(vd, s.v), m * 12); F = add(F, V(0, m * G, 0)); // also fights gravity
      if (len(F) > p.MaxForce) F = mul(unit(F), p.MaxForce);
      s.F = len(F);
      s.v = add(s.v, mul(add(F, V(0, -m * G, 0)), dt / m)); s.p = add(s.p, mul(s.v, dt));
      if (s.p.y < 1) { s.p.y = 1; s.v.y = 0; }
    },
    auto(s, t, p) { return { ...p, TargetX: Math.cos(t * 0.7) * 5, TargetY: 5 + Math.sin(t * 1.1) * 2.5 }; },
    draw(S, s, p) {
      S.ground(10, 0);
      const T = V(p.TargetX, p.TargetY, 0);
      S.box(cf(T), V(2, 2, 2), COLORS.part, { flat: "none", stroke: "var(--accent)", dash: "5 4", double: true }); S.callout(add(T, V(1, 1, 0)), "AlignPosition.Position (target)");
      S.box(cf(s.p), V(2, 2, 2), COLORS.part2); S.callout(add(s.p, V(-1, 1, 0)), "part (Attachment0)");
      S.seg(s.p, T, "var(--accent)", 1.5, "3 4");
      S.attach(cf(s.p), null);
    },
    read: (s, p) => [["distance to target", f(len(sub(V(p.TargetX, p.TargetY, 0), s.p)), 2) + " studs"], ["weight to hold up", f(4 * G, 0)], ["MaxForce", String(p.MaxForce), p.MaxForce < 4 * G ? "ax-x" : ""], ["force used", f(s.F || 0, 0)]],
    code: (p) => `local ap = Instance.new("AlignPosition")\nap.Attachment0 = Instance.new("Attachment", part)\nap.Mode = Enum.PositionAlignmentMode.OneAttachment\nap.Position = Vector3.new(${p.TargetX}, ${p.TargetY}, 0) -- the target\nap.Responsiveness = ${p.Responsiveness}\nap.MaxVelocity = ${p.MaxVelocity}\nap.MaxForce = ${p.MaxForce}\nap.RigidityEnabled = ${p.RigidityEnabled}\nap.Parent = part`,
    steps: () => ["OneAttachment mode: set .Position to a world point. TwoAttachment mode: it pulls Attachment0 to wherever Attachment1 is (follow a player!).", "Responsiveness = how fast it reacts. MaxVelocity = speed limit. MaxForce = strength.", "Turn MaxForce below the weight in this lab: the part can't hold itself up and sinks."],
  };
  C.AlignOrientation = {
    title: "AlignOrientation", hint: "Turns a part to face a target direction, like a compass needle.",
    params: [P("targetYaw", -180, 180, 5, 120, { label: "Target turn", unit: "°" }), P("Responsiveness", 2, 200, 1, 12), P("MaxAngularVelocity", 0.5, 30, 0.5, 6, { unit: " rad/s" }), B("RigidityEnabled", false)],
    init: () => ({ a: 0, w: 0 }),
    step(s, dt, p) {
      let d = p.targetYaw * D2R - s.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (p.RigidityEnabled) { s.a += d * Math.min(1, dt * 40); s.w = 0; return; }
      const wd = clamp(d * p.Responsiveness * 0.35, -p.MaxAngularVelocity, p.MaxAngularVelocity);
      s.w += (wd - s.w) * Math.min(1, dt * 12); s.a += s.w * dt;
    },
    auto(s, t, p) { return { ...p, targetYaw: Math.sin(t * 0.6) * 150 }; },
    draw(S, s, p) {
      S.ground(8, 0);
      const c = cf(V(0, 2, 0), rotY(s.a));
      S.box(c, V(1.6, 1.2, 6), COLORS.part, { front: COLORS.part2 }); S.callout(cfPoint(c, V(0, 0.6, 2.5)), "part (Attachment0)");
      const tl = cfPoint(cf(V(0, 2, 0), rotY(p.targetYaw * D2R)), V(0, 0, -7));
      S.arrow(V(0, 2, 0), tl, "var(--accent)", 2.5, "6 4"); S.callout(tl, "target direction");
      S.arrow(V(0, 2, 0), cfPoint(c, V(0, 0, -5)), "var(--z)", 3);
    },
    read: (s, p) => { let d = p.targetYaw * D2R - s.a; d = Math.atan2(Math.sin(d), Math.cos(d)); return [["angle left to turn", f(d * R2D, 1) + "°"], ["turning speed", f(s.w, 2) + " rad/s"]]; },
    code: (p) => `local ao = Instance.new("AlignOrientation")\nao.Attachment0 = Instance.new("Attachment", part)\nao.Mode = Enum.OrientationAlignmentMode.OneAttachment\nao.CFrame = CFrame.Angles(0, math.rad(${p.targetYaw}), 0) -- face this way\nao.Responsiveness = ${p.Responsiveness}\nao.MaxAngularVelocity = ${p.MaxAngularVelocity}\nao.RigidityEnabled = ${p.RigidityEnabled}\nao.Parent = part`,
    steps: () => ["Only the ROTATION of its CFrame target matters, not the position.", "Use it to keep a hoverboard upright, or to make a part always face the player (TwoAttachment mode).", "Responsiveness and MaxAngularVelocity control how fast it turns."],
  };
  C.VectorForce = {
    title: "VectorForce", hint: "A constant push, like a rocket engine. The longer it pushes, the faster it goes.",
    params: [P("ForceX", -1500, 1500, 50, 0, { say: "Sideways push. Watch it speed up, hit a wall and bounce." }), P("ForceY", 0, 1600, 5, 0, { say: "Up push. The block weighs 785 (mass 4 × gravity 196.2): less than 785 = it stays down, exactly 785 = it floats, more = it climbs faster and faster." }),
      E("RelativeTo", ["World", "Attachment0"], "World", { say: "World = push in fixed world directions. Attachment0 = the push turns with the block, like a real rocket engine." }),
      P("tilt", -45, 45, 5, 0, { demo: true, label: "Block tilt", unit: "°" }), B("ApplyAtCenterOfMass", true, { say: "Off: the push happens at the attachment (on top of the block), so a sideways push also makes it SPIN." })],
    init: () => ({ p: V(0, 1, 0), v: V(0, 0, 0), spin: 0, w: 0, F: V(0, 0, 0) }),
    step(s, dt, p) {
      const m = 4, th = p.tilt * D2R + s.spin;
      let F = V(p.ForceX, p.ForceY, 0);
      if (p.RelativeTo === "Attachment0") F = V(F.x * Math.cos(th) - F.y * Math.sin(th), F.x * Math.sin(th) + F.y * Math.cos(th), 0);
      s.F = F;
      // a little air drag so the demo stays readable (Roblox has none by default)
      const drag = mul(s.v, -0.6 * m);
      s.v = add(s.v, mul(add(add(F, V(0, -m * G, 0)), drag), dt / m));
      s.p = add(s.p, mul(s.v, dt));
      if (!p.ApplyAtCenterOfMass) s.w += (-0.7 * F.x / 60) * dt; // push at the top -> twist
      s.w *= 1 - 1.5 * dt; s.spin += s.w * dt;
      const onGround = s.p.y <= 1;
      if (onGround) { s.p.y = 1; if (s.v.y < 0) s.v.y = s.v.y < -3 ? -s.v.y * 0.3 : 0; s.v.x *= 1 - 3 * dt; s.w *= 1 - 4 * dt; s.spin *= 1 - 3 * dt; }
      if (s.p.y > 11) { s.p.y = 11; if (s.v.y > 0) s.v.y = -s.v.y * 0.4; }
      if (s.p.x > 8) { s.p.x = 8; if (s.v.x > 0) s.v.x = -s.v.x * 0.5; }
      if (s.p.x < -8) { s.p.x = -8; if (s.v.x < 0) s.v.x = -s.v.x * 0.5; }
    },
    actions: [["Hover (Force Y = 785)", (s, p, set) => set({ ForceY: 785, ForceX: 0, RelativeTo: "World" })], ["Launch!", (s, p, set) => set({ ForceY: 1300, ForceX: 0 })], ["Engine off", (s, p, set) => set({ ForceY: 0, ForceX: 0 })], ["Reset", (s) => { s.p = V(0, 1, 0); s.v = V(0, 0, 0); s.spin = 0; s.w = 0; }]],
    auto(s, t, p) { const ph = t % 5; return { ...p, ForceY: ph < 1.6 ? 1250 : ph < 3.6 ? 785 : 0, ForceX: ph < 1.6 ? 200 : ph < 3.6 ? -150 : 0 }; },
    draw(S, s, p) {
      S.ground(10, 0);
      for (const x of [-9.1, 9.1]) S.box(cf(V(x, 6, 0)), V(0.4, 12, 4), COLORS.base, { alpha: 0.35 });
      S.seg(V(-9, 12, 0), V(9, 12, 0), "var(--line)", 1.5, "4 4");
      const c = cf(s.p, rotZ(p.tilt * D2R + s.spin));
      S.box(c, V(2.2, 1.4, 1.4), COLORS.part); S.callout(add(s.p, V(-1, 0.8, 0)), "block (mass 4, weight 785)");
      const F = s.F, at = p.ApplyAtCenterOfMass ? s.p : cfPoint(c, V(0, 0.7, 0));
      if (len(F) > 1) { S.arrow(at, add(at, mul(F, 0.004)), "var(--accent)", 4); S.text(add(at, mul(F, 0.0045)), `Force ${f(len(F), 0)}`, "var(--accent)"); }
      S.arrow(s.p, add(s.p, V(0, -4 * G * 0.004, 0)), "var(--bad)", 3); S.text(add(s.p, V(0.3, -3.4, 0)), "gravity 785", "var(--bad)");
      if (len(s.v) > 0.5) S.arrow(s.p, add(s.p, mul(s.v, 0.12)), "var(--y)", 2, "4 3");
      S.attach(cf(at, c.m), null);
    },
    read: (s, p) => [["up push − weight", f(s.F.y - 4 * G, 0), s.F.y - 4 * G > 1 ? "ax-y" : s.F.y - 4 * G < -1 ? "ax-x" : ""], ["what happens", s.F.y > 4 * G + 1 ? "speeds up going up" : Math.abs(s.F.y - 4 * G) <= 1 ? "floats (balanced)" : "stays down / falls"], ["velocity (green)", `${f(s.v.x, 1)}, ${f(s.v.y, 1)}`], ["height", f(s.p.y, 1)]],
    code: (p) => `local att = Instance.new("Attachment", part)\nlocal force = Instance.new("VectorForce")\nforce.Attachment0 = att\nforce.Force = Vector3.new(${p.ForceX}, ${p.ForceY}, 0)\nforce.RelativeTo = Enum.ActuatorRelativeTo.${p.RelativeTo}\nforce.ApplyAtCenterOfMass = ${p.ApplyAtCenterOfMass}\nforce.Parent = part\n\n-- to hover exactly: Force.Y = part.AssemblyMass * workspace.Gravity`,
    steps: () => ["One attachment, one Force vector. It pushes the same amount every moment.", "World = push in world directions. Attachment0 = the push turns with the part (a rocket's engine).", "There's no speed limit! Keep pushing and it keeps speeding up (this lab adds a little air drag and walls so it stays on screen). Use LinearVelocity if you want a fixed speed."],
  };
  C.Torque = {
    title: "Torque", hint: "A constant twist. Like VectorForce, but it spins instead of pushes. It keeps spinning faster.",
    params: [P("TorqueY", -3000, 3000, 50, 600, { label: "Torque Y" }), E("RelativeTo", ["World", "Attachment0"], "World")],
    init: () => ({ a: 0, w: 0 }),
    step(s, dt, p) { const I = 200; s.w += (p.TorqueY / I) * dt; s.w = clamp(s.w, -40, 40); s.a += s.w * dt; },
    actions: [["Stop spin", (s) => (s.w = 0)]],
    auto(s, t, p) { if (Math.floor(t / 5) !== s._k) { s._k = Math.floor(t / 5); s.w = 0; } return p; },
    draw(S, s) {
      S.ground(8, 0);
      const c = cf(V(0, 1.5, 0), rotY(s.a));
      S.box(c, V(7, 1, 2), COLORS.part2); S.callout(cfPoint(c, V(3.3, 0.5, 0)), "spinning part");
      const arc = []; for (let i = 0; i <= 24; i++) { const a = s.a + (i / 24) * 1.5; arc.push(V(Math.cos(a) * 4.5, 3, -Math.sin(a) * 4.5)); }
      S.path(arc, "var(--accent)", 3); S.callout(arc[24], "Torque (twist)");
    },
    read: (s) => [["spin speed", f(s.w, 2) + " rad/s (keeps growing!)"]],
    code: (p) => `local torque = Instance.new("Torque")\ntorque.Attachment0 = Instance.new("Attachment", part)\ntorque.Torque = Vector3.new(0, ${p.TorqueY}, 0)\ntorque.RelativeTo = Enum.ActuatorRelativeTo.${p.RelativeTo}\ntorque.Parent = part`,
    steps: () => ["Torque is to spinning what force is to moving.", "No speed limit: it spins faster and faster. Use AngularVelocity for a fixed spin speed."],
  };
  C.LineForce = {
    title: "LineForce", hint: "A force along the line between two attachments. Magnets and gravity wells.",
    params: [P("Magnitude", -2000, 2000, 50, 900, { say: "How strong. The sign flips between pulling and pushing." }), B("InverseSquareLaw", true, { say: "On: much stronger up close, weaker far away (like real magnets)." }), P("MaxForce", 0, 5000, 100, 3000, { show: (p) => p.InverseSquareLaw }), B("ReactionForceEnabled", false, { say: "On: the magnet gets pulled back too (both move)." })],
    init: () => ({ x: 7, v: 0, mx: 0, mv: 0 }),
    step(s, dt, p) {
      const d = Math.max(0.5, Math.abs(s.x - s.mx)), dir = Math.sign(s.mx - s.x);
      let F = p.InverseSquareLaw ? Math.min(p.MaxForce, Math.abs(p.Magnitude) * 25 / (d * d)) * Math.sign(p.Magnitude) : p.Magnitude;
      s.F = F;
      s.v += (F * dir / 2) * dt; if (p.ReactionForceEnabled) s.mv -= (F * dir / 4) * dt;
      s.v *= 1 - 0.3 * dt; s.mv *= 1 - 0.3 * dt; s.x += s.v * dt; s.mx += s.mv * dt;
      if (Math.abs(s.x - s.mx) < 2.2) { s.x = s.mx + Math.sign(s.x - s.mx || 1) * 2.2; s.v = -s.v * 0.3; }
      s.x = clamp(s.x, -9, 9); s.mx = clamp(s.mx, -9, 9); if (Math.abs(s.x) === 9) s.v = 0; if (Math.abs(s.mx) === 9) s.mv = 0;
    },
    actions: [["Reset", (s) => { s.x = 7; s.v = 0; s.mx = 0; s.mv = 0; }]],
    auto(s, t) { if (Math.floor(t / 3.5) !== s._k) { s._k = Math.floor(t / 3.5); s.x = 8; s.v = 0; s.mx = 0; s.mv = 0; } },
    draw(S, s, p) {
      S.ground(10, 0);
      S.cyl(cf(V(s.mx, 1.2, 0), rotZ(Math.PI / 2)), 1.2, 2.4, COLORS.dark, { spokes: false }); S.callout(V(s.mx - 0.5, 2.6, 0), "magnet (Attachment1)");
      S.box(cf(V(s.x, 1, 0)), V(2, 2, 2), COLORS.metal); S.callout(V(s.x, 2, 0), "metal block (Attachment0)");
      S.arrow(V(s.x, 3, 0), V(s.x + Math.sign(s.mx - s.x) * clamp(s.F || 0, -3000, 3000) * 0.002, 3, 0), "var(--accent)", 3);
      S.seg(V(s.x, 1, 0), V(s.mx, 1, 0), "var(--accent)", 1, "3 4");
    },
    read: (s) => [["distance", f(Math.abs(s.x - s.mx), 2)], ["force now", f(s.F || 0, 0)]],
    code: (p) => `local lf = Instance.new("LineForce")\nlf.Attachment0 = workspace.Block.Attachment\nlf.Attachment1 = workspace.Magnet.Attachment\nlf.Magnitude = ${p.Magnitude} -- flip the sign if it pushes instead of pulls\nlf.InverseSquareLaw = ${p.InverseSquareLaw}\n${p.InverseSquareLaw ? `lf.MaxForce = ${p.MaxForce}\n` : ""}lf.ReactionForceEnabled = ${p.ReactionForceEnabled}\nlf.Parent = workspace.Block`,
    steps: () => ["Needs TWO attachments: the force always points along the line between them.", "InverseSquareLaw makes it much stronger up close. MaxForce caps it so nothing explodes when they touch.", "ReactionForceEnabled: the other part feels an equal force back (both move)."],
  };
  C.AnimationConstraint = {
    title: "AnimationConstraint", hint: "A joint you can animate that still works with physics, for physically simulated characters.",
    params: [B("IsKinematic", false, { say: "On: the animation wins completely. Off: physics can push back, up to MaxForce." }), P("swing", 0, 1, 0.05, 0.8, { demo: true, label: "Animation strength" })],
    init: () => ({}), step(s, dt, p, t) { s.t = t; },
    draw: (S, s, p) => C.Motor6D.draw(S, s, p),
    read: (s, p) => [["IsKinematic", String(p.IsKinematic)]],
    code: () => `local anim = Instance.new("AnimationConstraint")\nanim.Attachment0 = torso.ShoulderAttachment\nanim.Attachment1 = arm.ShoulderAttachment\nanim.IsKinematic = false -- physics can still push the arm\nanim.MaxForce = 10000\nanim.MaxTorque = 10000\nanim.Parent = arm\n-- animations set anim.Transform, like a Motor6D`,
    steps: () => ["It's like a Motor6D that respects physics: animations move it, but a wall can stop the arm.", "IsKinematic true = behaves like a Motor6D (animation always wins)."],
  };

  /* ---------------- PhysLab component ---------------- */
  function useVisible(ref) {
    const [vis, setVis] = useState(true);
    useEffect(() => {
      if (!ref.current || !window.IntersectionObserver) return;
      const io = new IntersectionObserver((es) => setVis(es[0].isIntersecting), { rootMargin: "100px" });
      io.observe(ref.current);
      return () => io.disconnect();
    }, []);
    return vis;
  }
  const defaults = (cfg) => Object.fromEntries(cfg.params.map((q) => [q.k, q.def]));
  BB.PhysLab = function ({ name, mini, onOpen }) {
    const cfg = C[name];
    const [p, setP] = useState(() => defaults(cfg));
    const sim = useRef(cfg.init(defaults(cfg)));
    const [, setFrame] = useState(0);
    const [playing, setPlaying] = useState(true);
    const root = useRef();
    const vis = useVisible(root);
    const pRef = useRef(p); pRef.current = p;
    const clock = useRef(0);
    useEffect(() => { sim.current = cfg.init(pRef.current); }, [name]);
    useEffect(() => {
      if (!vis || !playing) return;
      let raf, last = performance.now();
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = (now) => {
        const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
        clock.current += dt;
        let pp = pRef.current;
        if (mini && cfg.auto) pp = cfg.auto(sim.current, clock.current, pp) || pp;
        for (let i = 0; i < 4; i++) cfg.step(sim.current, dt / 4, pp, clock.current);
        sim.current._p = pp;
        setFrame((n) => n + 1);
        if (!reduce || !mini) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [vis, playing, name, mini]);
    const pp = { ...defaults(cfg), ...(sim.current._p || p) };
    const W = mini ? 360 : 620, H = mini ? 250 : 430;
    const proj = camera(-0.72, 0.42, mini ? 11 : 19, W / 2, H * 0.68);
    const S = Scene(proj);
    cfg.draw(S, sim.current, pp);
    const svg = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${cfg.title + " anatomy diagram"} style=${mini ? "width:100%;height:auto;display:block" : ""}>${S.render(W, H)}</svg>`;
    if (mini) return html`<div ref=${root}>${svg}</div>`;
    const set = (k) => (v) => setP((o) => ({ ...o, [k]: v }));
    const visible = cfg.params.filter((q) => !q.show || q.show(p));
    const say = visible.map((q) => q.say && html`<li><b>${q.label || q.k}:</b> ${q.say}</li>`).filter(Boolean);
    const side = html`
      ${visible.map((q) => q.type === "enum"
        ? html`<div style="display:flex;flex-direction:column;gap:4px"><span class="auto-note"><b>${q.label || q.k}</b>${q.demo ? " (demo only)" : ""}</span><div class="seg" role="group" aria-label=${q.k}>${q.options.map((o) => html`<button type="button" class=${p[q.k] === o ? "on" : ""} aria-pressed=${p[q.k] === o} onClick=${() => set(q.k)(o)}>${o}</button>`)}</div></div>`
        : q.type === "bool"
        ? html`<label class="place"><input type="checkbox" checked=${p[q.k]} onChange=${(e) => set(q.k)(e.currentTarget.checked)} /> <b>${q.label || q.k}</b></label>`
        : html`<div class="ctl"><label for=${"pl-" + name + q.k} title=${q.say || ""}>${q.label || q.k}${q.demo ? "*" : ""}</label><input id=${"pl-" + name + q.k} type="range" min=${q.min} max=${q.max} step=${q.step} value=${p[q.k]} onInput=${(e) => set(q.k)(+e.currentTarget.value)} /><output>${f(p[q.k], 2)}${q.unit || ""}</output></div>`)}
      <div class="btnrow">
        <button class="btn primary" type="button" onClick=${() => setPlaying((v) => !v)}>${playing ? "Pause" : "Play"}</button>
        ${(cfg.actions || []).map(([l, fn]) => html`<button class="btn" type="button" onClick=${() => fn(sim.current, p, (o) => setP((x) => ({ ...x, ...o })))}>${l}</button>`)}
      </div>
      <dl class="readout">${cfg.read(sim.current, p).map(([k, v, c]) => html`<dt>${k}</dt><dd class=${c || ""}>${v}</dd>`)}</dl>
      ${say.length > 0 && html`<ul class="lab-say" style="margin:0;padding-left:28px">${say}</ul>`}
      ${cfg.params.some((q) => q.demo) && html`<p class="auto-note" style="margin:0">* = only part of this demo, not a property of ${cfg.title}.</p>`}`;
    return html`<section class="lab" ref=${root}>
      <div class="lab-head"><h3>${cfg.title} <span class="auto-note" style="font-family:var(--f-body)">anatomy</span></h3><span class="hint">${cfg.hint}</span></div>
      <div class="lab-body"><div class="lab-stage">${svg}</div><div class="lab-side">${side}</div></div>
      <div class="lab-foot">
        <div><h4>How to set it up</h4><ol class="steps">${cfg.steps(p).map((x) => html`<li>${x}</li>`)}</ol>
          <p class="auto-note" style="margin:8px 0 0">Legend: <b style="color:#3ddc84">●</b> Attachment · <b style="color:#f5c518">→</b> primary axis (yellow) · <b style="color:#ff8c1a">→</b> secondary axis (orange)</p></div>
        <div style="min-width:0"><h4>The code (updates as you change things)</h4><${BB.Code} code=${cfg.code(p)} /></div>
      </div></section>`;
  };
  BB.anatomy = C;

  /* ---------------- "which one do I use?" grid ---------------- */
  const PICK = [
    ["A constant push (rocket, wind)", "VectorForce", "Speeds up more and more"],
    ["Move at an exact speed", "LinearVelocity", "Conveyor belt"],
    ["Fly to a spot and stay there", "AlignPosition", "Magnet pulling to a point"],
    ["Face a direction", "AlignOrientation", "Compass needle"],
    ["Spin at an exact speed", "AngularVelocity", "Ceiling fan"],
    ["A constant twist", "Torque", "Spins faster and faster"],
    ["Pull toward / push from a point", "LineForce", "A magnet"],
    ["Glue two parts together", "WeldConstraint", "Superglue"],
    ["Doors and wheels", "HingeConstraint", "A door hinge"],
    ["Bouncy suspension", "SpringConstraint", "A spring"],
    ["Hang something", "RopeConstraint", "A rope"],
    ["Keep an exact distance", "RodConstraint", "A metal bar"],
    ["Swing in all directions", "BallSocketConstraint", "A shoulder"],
    ["Slide along a line", "PrismaticConstraint", "An elevator"],
    ["Slide and spin", "CylindricalConstraint", "A drill"],
    ["Twist back after turning", "TorsionSpringConstraint", "A mousetrap"],
    ["Pass spin through a bend", "UniversalConstraint", "A driveshaft"],
    ["Stay on a flat sheet", "PlaneConstraint", "Air hockey"],
    ["Let two parts overlap", "NoCollisionConstraint", "A ghost"],
    ["Animate a joint", "Motor6D", "A character's shoulder"],
  ];
  BB.MoverPicker = function ({ only }) {
    const list = only ? PICK.filter((r) => only.includes(r[1])) : PICK;
    return html`<div class="picker">${list.map(([want, cls, feel]) => html`<a class="pick" href=${`#/class/${cls}`}>
      <div class="pick-fig"><${BB.PhysLab} name=${cls} mini=${true} /></div>
      <div class="pick-txt"><span class="auto-note">${want}</span><b>${cls}</b><span class="auto-note">Feels like: ${feel}</span></div></a>`)}</div>`;
  };

  /* ---------------- material physics: friction, elasticity, density ---------------- */
  BB.MaterialLab = function () {
    const [mode, setMode] = useState("bounce");
    const [e, setE] = useState(0.6);
    const [mu, setMu] = useState(0.3);
    const [ramp, setRamp] = useState(25);
    const [dens, setDens] = useState(0.7);
    const s = useRef({ y: 10, v: 0, x: 0, vx: 0, peaks: [] });
    const [, setF] = useState(0);
    const root = useRef();
    const vis = useVisible(root);
    const pr = useRef(); pr.current = { e, mu, ramp, dens, mode };
    useEffect(() => { s.current = { y: 10, v: 0, x: 0, vx: 0, peaks: [] }; }, [mode]);
    useEffect(() => {
      if (!vis) return;
      let raf, last = performance.now();
      const tick = (now) => {
        const dt = Math.min(1 / 30, (now - last) / 1000) / 2; last = now;
        const st = s.current, q = pr.current;
        for (let i = 0; i < 2; i++) {
          if (q.mode === "bounce") { st.v -= G * 0.35 * dt; st.y += st.v * dt; if (st.y < 1) { st.y = 1; st.v = -st.v * q.e; if (Math.abs(st.v) < 1) st.v = 0; } }
          else { const th = q.ramp * D2R, a = G * 0.35 * (Math.sin(th) - q.mu * Math.cos(th)); if (a > 0 || st.vx > 0) st.vx = Math.max(0, st.vx + (a > 0 ? a : G * 0.35 * (Math.sin(th) - q.mu * Math.cos(th))) * dt); st.x += st.vx * dt; if (st.x > 13) { st.x = 0; st.vx = 0; } }
        }
        setF((n) => n + 1);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [vis]);
    const W = 620, H = 400, proj = camera(-0.72, 0.4, 19, W / 2, H * 0.7), S = Scene(proj);
    S.ground(10, 0);
    const st = s.current;
    if (mode === "bounce") {
      S.box(cf(V(0, st.y, 0)), V(2, 2, 2), COLORS.part2); S.callout(V(0.8, st.y + 0.8, 0), `Elasticity ${e}`);
      S.seg(V(3, 1, 0), V(3, 10, 0), "var(--line)", 1); S.text(V(3, 10, 0), "drop height", "var(--muted)");
    } else {
      const th = ramp * D2R, rc = cf(V(0, Math.sin(th) * 7, 0), rotZ(-th));
      S.box(rc, V(15, 0.6, 5), COLORS.base); S.callout(cfPoint(rc, V(-7, 0.3, 0)), `ramp: ${ramp}°`);
      const bp = cfMul(rc, cf(V(-6 + st.x, 1.3, 0)));
      S.box(bp, V(2, 2, 2), COLORS.part); S.callout(add(bp.p, V(0, 1, 0)), `Friction ${mu}`);
    }
    const slides = Math.tan(ramp * D2R) > mu;
    const mass = dens * 8;
    return html`<section class="lab" ref=${root}>
      <div class="lab-head"><h3>Material physics: PhysicalProperties</h3><span class="hint">Density, Friction and Elasticity decide how parts feel.</span></div>
      <div class="lab-body"><div class="lab-stage"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bouncing and sliding demo">${S.render(W, H)}</svg></div>
        <div class="lab-side">
          <div class="seg" role="group" aria-label="Demo">${[["bounce", "Elasticity (bounce)"], ["slide", "Friction (slide)"]].map(([k, l]) => html`<button type="button" class=${mode === k ? "on" : ""} onClick=${() => setMode(k)}>${l}</button>`)}</div>
          ${mode === "bounce"
            ? html`<div class="ctl"><label for="mt-e">Elasticity</label><input id="mt-e" type="range" min="0" max="1" step="0.05" value=${e} onInput=${(ev) => setE(+ev.currentTarget.value)} /><output>${e}</output></div>
              <p class="lab-say">Elasticity = how much bounce is kept. 0 = lands like clay, 1 = bounces back to almost the same height. Each bounce keeps about ${Math.round(e * e * 100)}% of the height.</p>
              <button class="btn primary" type="button" onClick=${() => (s.current = { y: 10, v: 0, x: 0, vx: 0 })}>Drop again</button>`
            : html`<div class="ctl"><label for="mt-mu">Friction</label><input id="mt-mu" type="range" min="0" max="1.5" step="0.05" value=${mu} onInput=${(ev) => setMu(+ev.currentTarget.value)} /><output>${mu}</output></div>
              <div class="ctl"><label for="mt-r">Ramp°</label><input id="mt-r" type="range" min="0" max="60" step="1" value=${ramp} onInput=${(ev) => setRamp(+ev.currentTarget.value)} /><output>${ramp}°</output></div>
              <p class="lab-say">Friction = grip. Ice is about 0.02, plastic 0.3, rubber 1. The block slides when the ramp is steeper than the grip can hold (tan(angle) > friction). Right now it ${slides ? "SLIDES" : "STAYS"}.</p>
              <button class="btn primary" type="button" onClick=${() => (s.current = { y: 10, v: 0, x: 0, vx: 0 })}>Put it back</button>`}
          <div class="ctl"><label for="mt-d">Density</label><input id="mt-d" type="range" min="0.01" max="20" step="0.01" value=${dens} onInput=${(ev) => setDens(+ev.currentTarget.value)} /><output>${dens}</output></div>
          <dl class="readout"><dt>mass of a 2×2×2 block = density × volume</dt><dd>${f(dens, 2)} × 8 = ${f(mass, 2)}</dd><dt>weight (mass × 196.2)</dt><dd>${f(mass * G, 0)}</dd></dl>
        </div></div>
      <div class="lab-foot"><div><h4>How to set it up</h4><ol class="steps"><li>Every material (Plastic, Ice, Metal…) has its own density, friction and elasticity.</li><li>Override them with CustomPhysicalProperties, in the Properties window or from a script.</li><li>FrictionWeight and ElasticityWeight decide who "wins" when two different materials touch.</li></ol></div>
        <div style="min-width:0"><h4>The code</h4><${BB.Code} code=${`-- PhysicalProperties.new(density, friction, elasticity, frictionWeight, elasticityWeight)\npart.CustomPhysicalProperties = PhysicalProperties.new(${dens}, ${mu}, ${e}, 1, 1)\nprint(part.AssemblyMass) --> ${f(mass, 2)} for a 2x2x2 part`} /></div></div></section>`;
  };
})();

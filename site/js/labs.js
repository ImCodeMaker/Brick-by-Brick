/* Interactive "labs": hands-on diagrams for the hard ideas. */
(function () {
  const BB = window.BB;
  const { html, useState, useEffect, useRef, useMemo } = window.htmPreact;
  const { V, add, sub, mul, dot, len, unit, angles, cf, cfMul, cfPoint, camera, boxFaces, pts, arrowPath } = BB.m3;
  const f = BB.fmt;
  const rad = (d) => (d * Math.PI) / 180;

  /* ---------- shared bits ---------- */
  const Code = ({ code }) => {
    const ref = useRef();
    return html`<div class="codebox"><pre><code dangerouslySetInnerHTML=${{ __html: BB.hl(code) }}></code></pre>
      <button class="copy" type="button" onClick=${(e) => BB.copy(code, e.currentTarget)}>Copy</button></div>`;
  };
  BB.Code = Code;

  const Slider = ({ id, label, value, min, max, step = 1, onInput, unit = "", cls = "" }) => html`
    <div class="ctl"><label for=${id} class=${cls}>${label}</label>
      <input id=${id} type="range" min=${min} max=${max} step=${step} value=${value} onInput=${(e) => onInput(+e.currentTarget.value)} />
      <output for=${id}>${f(value, 2)}${unit}</output></div>`;
  const Seg = ({ options, value, onChange, label }) => html`
    <div class="seg" role="group" aria-label=${label}>${options.map(([v, l]) => html`<button type="button" class=${v === value ? "on" : ""} aria-pressed=${v === value} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;
  const Lab = ({ title, hint, stage, side, stageStyle }) => html`
    <section class="lab"><div class="lab-head"><h3>${title}</h3><span class="hint">${hint}</span></div>
      <div class="lab-body"><div class="lab-stage" style=${stageStyle || ""}>${stage}</div><div class="lab-side">${side}</div></div></section>`;
  const Readout = ({ rows }) => html`<dl class="readout">${rows.map(([k, v, c]) => html`<dt>${k}</dt><dd class=${c || ""}>${v}</dd>`)}</dl>`;
  const Arrow = ({ a, b, color, width = 3, dash }) => {
    const p = arrowPath(a, b);
    return html`<g><path d=${p.line} stroke=${color} stroke-width=${width} fill="none" stroke-linecap="round" stroke-dasharray=${dash || ""} /><polygon points=${p.head} fill=${color} /></g>`;
  };
  const v3 = (v) => `${f(v.x)}, ${f(v.y)}, ${f(v.z)}`;

  /* svg pointer -> viewBox coords */
  function svgPoint(svg, e) {
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return [((e.clientX - r.left) / r.width) * vb.width + vb.x, ((e.clientY - r.top) / r.height) * vb.height + vb.y];
  }
  function useDrag(onMove) {
    const drag = useRef(null);
    return {
      start: (key) => (e) => { drag.current = key; e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId); e.preventDefault(); },
      move: (e) => { if (drag.current) onMove(drag.current, svgPoint(e.currentTarget, e)); },
      end: () => (drag.current = null),
    };
  }

  /* =========================================================
     CFrame lab
     ========================================================= */
  BB.CFrameLab = function () {
    const [s, set] = useState({ px: 0, py: 3, pz: 0, rx: 0, ry: 60, rz: 0, mode: "local", anim: "off" });
    const up = (k) => (v) => set((o) => ({ ...o, [k]: v }));
    const [t, setT] = useState(0);
    useEffect(() => {
      if (s.anim === "off") return;
      let raf, start = performance.now();
      const tick = (now) => { setT((now - start) / 1000); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [s.anim]);
    const W = 620, H = 440;
    const proj = camera(-0.7, 0.5, 18.5, W / 2, H * 0.6);
    // the CFrame actually shown (static sliders, or an animation driving it)
    let c, target = null, trail = null, animCode = "";
    const base = cf(V(s.px, s.py, s.pz), angles(rad(s.rx), rad(s.ry), rad(s.rz)));
    if (s.anim === "spin") {
      c = cfMul(base, cf(V(0, 0, 0), angles(0, t * 1.5, 0)));
      animCode = `-- Script: spin forever (1.5 radians per second)\nlocal RunService = game:GetService("RunService")\nRunService.Heartbeat:Connect(function(dt)\n\tpart.CFrame = part.CFrame * CFrame.Angles(0, 1.5 * dt, 0)\nend)`;
    } else if (s.anim === "orbit") {
      const r = 6, a = t * 0.9;
      const pos = V(Math.cos(a) * r, s.py, Math.sin(a) * r);
      const ahead = V(Math.cos(a + 0.1) * r, s.py, Math.sin(a + 0.1) * r);
      const dir = unit(sub(ahead, pos));
      const yaw = Math.atan2(-dir.x, -dir.z);
      c = cf(pos, angles(0, yaw, 0));
      trail = [];
      for (let i = 0; i <= 48; i++) { const b = (i / 48) * Math.PI * 2; trail.push(proj(V(Math.cos(b) * r, s.py, Math.sin(b) * r))); }
      animCode = `-- Script: fly in a circle and face where you're going\nlocal RunService = game:GetService("RunService")\nlocal center, radius, speed = Vector3.new(0, ${f(s.py)}, 0), 6, 0.9\nlocal t = 0\nRunService.Heartbeat:Connect(function(dt)\n\tt += dt\n\tlocal a = t * speed\n\tlocal pos = center + Vector3.new(math.cos(a), 0, math.sin(a)) * radius\n\tlocal ahead = center + Vector3.new(math.cos(a + 0.1), 0, math.sin(a + 0.1)) * radius\n\tpart.CFrame = CFrame.lookAt(pos, ahead) -- look along the path\nend)`;
    } else if (s.anim === "lookat") {
      target = V(Math.cos(t * 0.8) * 8, 2 + Math.sin(t * 1.3) * 2 + 2, Math.sin(t * 0.8) * 6);
      const d = unit(sub(target, base.p));
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
      c = cf(base.p, angles(0, yaw, 0));
      c = cfMul(c, cf(V(0, 0, 0), angles(pitch, 0, 0)));
      animCode = `-- Script: always look at the target\nlocal RunService = game:GetService("RunService")\nRunService.Heartbeat:Connect(function()\n\tpart.CFrame = CFrame.lookAt(part.Position, target.Position)\nend)`;
    } else if (s.anim === "lerp") {
      const goal = cfMul(base, cf(V(0, 0, -7), angles(0, rad(90), 0)));
      const a = (Math.sin(t * 1.2 - Math.PI / 2) + 1) / 2;
      // lerp position + yaw (what CFrame:Lerp does, simplified to one axis here)
      c = cf(add(base.p, mul(sub(goal.p, base.p), a)), angles(rad(s.rx), rad(s.ry) + rad(90) * a, rad(s.rz)));
      target = goal.p;
      animCode = `-- Script: slide AND turn smoothly between two CFrames\nlocal startCF = part.CFrame\nlocal goalCF = startCF * CFrame.new(0, 0, -7) * CFrame.Angles(0, math.rad(90), 0)\nlocal RunService = game:GetService("RunService")\nlocal t = 0\nRunService.Heartbeat:Connect(function(dt)\n\tt += dt\n\tlocal alpha = (math.sin(t * 1.2 - math.pi / 2) + 1) / 2 -- 0 -> 1 -> 0\n\tpart.CFrame = startCF:Lerp(goalCF, alpha)  -- alpha now ${f(a)}\nend)`;
    } else c = base;
    const m = c.m;
    const size = V(4, 2, 6);
    const look = mul(m[2], -1), right = m[0], upv = m[1];
    const ghost = s.anim === "off" ? (s.mode === "local" ? cfMul(c, cf(V(0, 0, -7))) : s.mode === "world" ? cf(add(c.p, V(0, 0, -7)), m) : null) : null;
    const grid = [];
    for (let i = -12; i <= 12; i += 2) {
      grid.push([proj(V(i, 0, -12)), proj(V(i, 0, 12))]);
      grid.push([proj(V(-12, 0, i)), proj(V(12, 0, i))]);
    }
    const o = proj(V(0, 0, 0));
    const box = (cc, ghostly) =>
      boxFaces(cc, size, proj).map((fc) => {
        const front = fc.name === "front";
        const b = front ? [217, 72, 15] : [92, 130, 214];
        const k = fc.shade;
        const col = `rgb(${Math.round(b[0] * k + 30)},${Math.round(b[1] * k + 20)},${Math.round(b[2] * k + 10)})`;
        return html`<polygon points=${pts(fc.pts)} fill=${ghostly ? "none" : col} stroke=${ghostly ? "var(--accent)" : "rgba(0,0,0,.35)"} stroke-width=${ghostly ? 2 : 1} stroke-dasharray=${ghostly ? "5 4" : ""} stroke-linejoin="round" />`;
      });
    const ctr = proj(c.p);
    const tip = (v, l) => proj(add(c.p, mul(v, l)));
    const floor = proj(V(c.p.x, 0, c.p.z));
    const tp = target && proj(target);
    const stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A brick in 3D with its Right, Up and Look direction arrows">
      ${grid.map(([a, b]) => html`<line x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke="var(--line)" stroke-width="1" />`)}
      <${Arrow} a=${o} b=${proj(V(5, 0, 0))} color="var(--x)" width="2" />
      <${Arrow} a=${o} b=${proj(V(0, 5, 0))} color="var(--y)" width="2" />
      <${Arrow} a=${o} b=${proj(V(0, 0, 5))} color="var(--z)" width="2" />
      <text x=${proj(V(5.8, 0, 0))[0]} y=${proj(V(5.8, 0, 0))[1]} fill="var(--x)" font-size="12" font-weight="700">+X</text>
      <text x=${proj(V(0, 5.8, 0))[0] - 8} y=${proj(V(0, 5.8, 0))[1]} fill="var(--y)" font-size="12" font-weight="700">+Y</text>
      <text x=${proj(V(0, 0, 6))[0] - 6} y=${proj(V(0, 0, 6))[1] + 12} fill="var(--z)" font-size="12" font-weight="700">+Z</text>
      <text x=${o[0] + 6} y=${o[1] + 16} fill="var(--muted)" font-size="11">origin (0,0,0)</text>
      ${trail && html`<polyline points=${trail.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} fill="none" stroke="var(--accent)" stroke-dasharray="4 5" />`}
      <line x1=${ctr[0]} y1=${ctr[1]} x2=${floor[0]} y2=${floor[1]} stroke="var(--muted)" stroke-dasharray="3 4" />
      <ellipse cx=${floor[0]} cy=${floor[1]} rx="18" ry="7" fill="rgba(0,0,0,.12)" />
      ${ghost && box(ghost, true)}
      ${ghost && html`<${Arrow} a=${ctr} b=${proj(ghost.p)} color="var(--accent)" width="2" dash="6 5" />`}
      ${s.anim === "lerp" && box(cfMul(base, cf(V(0, 0, -7), angles(0, rad(90), 0))), true)}
      ${box(c, false)}
      <${Arrow} a=${ctr} b=${tip(right, 4.5)} color="var(--x)" />
      <${Arrow} a=${ctr} b=${tip(upv, 4)} color="var(--y)" />
      <${Arrow} a=${ctr} b=${tip(look, 6)} color="var(--z)" />
      ${tp && s.anim === "lookat" && html`<g><line x1=${ctr[0]} y1=${ctr[1]} x2=${tp[0]} y2=${tp[1]} stroke="var(--accent)" stroke-dasharray="3 4" /><circle cx=${tp[0]} cy=${tp[1]} r="10" fill="var(--accent)" /><text x=${tp[0] + 14} y=${tp[1] + 4} font-size="12" font-weight="700" fill="var(--accent)">target</text></g>`}
      <circle cx=${ctr[0]} cy=${ctr[1]} r="4" fill="var(--ink)" />
      <text x=${tip(look, 6.6)[0]} y=${tip(look, 6.6)[1]} fill="var(--z)" font-size="12" font-weight="700" text-anchor="middle">LookVector</text>
      <text x=${tip(right, 5.2)[0]} y=${tip(right, 5.2)[1]} fill="var(--x)" font-size="12" font-weight="700" text-anchor="middle">RightVector</text>
      <text x=${tip(upv, 4.6)[0]} y=${tip(upv, 4.6)[1]} fill="var(--y)" font-size="12" font-weight="700" text-anchor="middle">UpVector</text>
    </svg>`;
    const code = s.anim !== "off" ? animCode :
      `local cf = CFrame.new(${f(s.px)}, ${f(s.py)}, ${f(s.pz)})\n\t* CFrame.Angles(math.rad(${s.rx}), math.rad(${s.ry}), math.rad(${s.rz}))\npart.CFrame = cf\n\n` +
      (s.mode === "local"
        ? `-- move 7 studs FORWARD, the way the part faces (local)\npart.CFrame = cf * CFrame.new(0, 0, -7)\n--> ends at ${v3(ghost.p)}`
        : s.mode === "world"
        ? `-- move 7 studs along the WORLD's -Z, ignoring rotation\npart.CFrame = cf + Vector3.new(0, 0, -7)\n--> ends at ${v3(ghost.p)}`
        : `print(cf.LookVector) --> ${v3(look)}`);
    const SAY = {
      spin: "Every frame we multiply by a tiny turn. Multiplying = turning around the part's OWN up axis, so it spins in place.",
      orbit: "cos and sin of a growing angle trace a circle (see Trigonometry below). CFrame.lookAt(pos, ahead) turns the brick to face along its path.",
      lookat: "CFrame.lookAt(from, to) builds a CFrame at 'from' whose LookVector points at 'to'. Watch the blue arrow chase the target.",
      lerp: "Lerp blends two CFrames: position AND rotation. alpha 0 = start, 1 = the dashed goal, 0.5 = halfway there and half-turned.",
    };
    const side = html`
      <${Seg} label="Animate" value=${s.anim} onChange=${up("anim")} options=${[["off", "Still"], ["spin", "Spin"], ["orbit", "Orbit"], ["lookat", "lookAt"], ["lerp", "Lerp"]]} />
      ${s.anim === "off" && html`<${Seg} label="Move mode" value=${s.mode} onChange=${up("mode")} options=${[["local", "cf * CFrame.new(0,0,-7)"], ["world", "cf + Vector3"], ["none", "Just look"]]} />`}
      <p class="lab-say">${s.anim !== "off" ? SAY[s.anim] : s.mode === "local"
        ? "Multiplying by a CFrame moves RELATIVE TO THE PART. -Z is the part's own front (the orange face), so it slides the way it faces."
        : s.mode === "world"
        ? "Adding a Vector3 moves in WORLD directions. It always goes toward world -Z, no matter how the part is turned."
        : "The three arrows are the part's own directions. Turn it with the Y slider and watch LookVector follow the orange front face."}</p>
      <${Slider} id="cf-px" label="X" cls="ax-x" value=${s.px} min=${-8} max=${8} step=${0.5} onInput=${up("px")} />
      <${Slider} id="cf-py" label="Y" cls="ax-y" value=${s.py} min=${1} max=${10} step=${0.5} onInput=${up("py")} />
      <${Slider} id="cf-pz" label="Z" cls="ax-z" value=${s.pz} min=${-8} max=${8} step=${0.5} onInput=${up("pz")} />
      <${Slider} id="cf-rx" label="Turn X°" cls="ax-x" value=${s.rx} min=${-180} max=${180} step=${5} onInput=${up("rx")} />
      <${Slider} id="cf-ry" label="Turn Y°" cls="ax-y" value=${s.ry} min=${-180} max=${180} step=${5} onInput=${up("ry")} />
      <${Slider} id="cf-rz" label="Turn Z°" cls="ax-z" value=${s.rz} min=${-180} max=${180} step=${5} onInput=${up("rz")} />
      <${Readout} rows=${[["Position", v3(c.p)], ["LookVector", v3(look), "ax-z"], ["RightVector", v3(right), "ax-x"], ["UpVector", v3(upv), "ax-y"]]} />
      <${Code} code=${code} />`;
    return html`<${Lab} title="CFrame playground" hint="Slide to move and turn the brick, or press an animation. The orange face is its front." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Vector lab (2D so it's easy to see; Vector3 works the same with a Z)
     ========================================================= */
  BB.VectorLab = function () {
    const [A, setA] = useState([4, 3]);
    const [B, setB] = useState([-2, 5]);
    const [mode, setMode] = useState("add");
    const [t, setT] = useState(0.5);
    const [k, setK] = useState(2);
    const W = 460, H = 460, S = 20, cx = W / 2, cy = H / 2;
    const toS = (p) => [cx + p[0] * S, cy - p[1] * S];
    const fromS = (q) => [Math.round(((q[0] - cx) / S) * 2) / 2, Math.round(((cy - q[1]) / S) * 2) / 2];
    const clamp = (p) => [Math.max(-10, Math.min(10, p[0])), Math.max(-10, Math.min(10, p[1]))];
    const d = useDrag((key, q) => (key === "A" ? setA : setB)(clamp(fromS(q))));
    const O = [0, 0];
    const lenA = Math.hypot(A[0], A[1]), lenB = Math.hypot(B[0], B[1]);
    const dotv = A[0] * B[0] + A[1] * B[1];
    const cosang = lenA && lenB ? dotv / (lenA * lenB) : 0;
    const ang = (Math.acos(Math.max(-1, Math.min(1, cosang))) * 180) / Math.PI;
    const gridL = [];
    for (let i = -10; i <= 10; i++) {
      gridL.push(html`<line x1=${toS([i, -10])[0]} y1=${toS([i, -10])[1]} x2=${toS([i, 10])[0]} y2=${toS([i, 10])[1]} stroke=${i === 0 ? "var(--muted)" : "var(--line)"} stroke-width=${i === 0 ? 1.5 : 1} />`);
      gridL.push(html`<line x1=${toS([-10, i])[0]} y1=${toS([-10, i])[1]} x2=${toS([10, i])[0]} y2=${toS([10, i])[1]} stroke=${i === 0 ? "var(--muted)" : "var(--line)"} stroke-width=${i === 0 ? 1.5 : 1} />`);
    }
    const handle = (p, key, color) => html`<circle cx=${toS(p)[0]} cy=${toS(p)[1]} r="11" fill=${color} fill-opacity="0.18" stroke=${color} stroke-width="2" style="cursor:grab" onPointerDown=${d.start(key)} />`;
    const label = (p, txt, color, dx = 10, dy = -10) => html`<text x=${toS(p)[0] + dx} y=${toS(p)[1] + dy} fill=${color} font-size="13" font-weight="700">${txt}</text>`;
    let extra = null, rows = [], say = "", code = "";
    const vA = `Vector3.new(${A[0]}, ${A[1]}, 0)`, vB = `Vector3.new(${B[0]}, ${B[1]}, 0)`;
    if (mode === "add") {
      const R = [A[0] + B[0], A[1] + B[1]];
      extra = html`<${Arrow} a=${toS(A)} b=${toS(R)} color="var(--z)" dash="5 4" /><${Arrow} a=${toS(O)} b=${toS(R)} color="var(--accent)" width="4" />${label(R, "A + B", "var(--accent)")}`;
      rows = [["A", `${A[0]}, ${A[1]}`], ["B", `${B[0]}, ${B[1]}`], ["A + B", `${f(R[0])}, ${f(R[1])}`, "ax-z"]];
      say = "Adding = walking A, then walking B from where you ended. Just add X with X and Y with Y.";
      code = `local a = ${vA}\nlocal b = ${vB}\nprint(a + b) --> ${f(R[0])}, ${f(R[1])}, 0`;
    } else if (mode === "sub") {
      const R = [B[0] - A[0], B[1] - A[1]];
      const L = Math.hypot(R[0], R[1]);
      extra = html`<${Arrow} a=${toS(A)} b=${toS(B)} color="var(--accent)" width="4" />${label([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], "B − A", "var(--accent)")}`;
      rows = [["B − A", `${f(R[0])}, ${f(R[1])}`], ["(B − A).Magnitude", f(L), "ax-z"]];
      say = "B − A is the arrow that goes FROM A TO B. Its Magnitude is the distance between them. This is how you find how far an enemy is.";
      code = `local a = ${vA}\nlocal b = ${vB}\nlocal fromAtoB = b - a\nprint(fromAtoB.Magnitude) --> ${f(L)} studs apart`;
    } else if (mode === "mag") {
      const U = lenA ? [A[0] / lenA, A[1] / lenA] : [0, 0];
      extra = html`<circle cx=${cx} cy=${cy} r=${S} fill="none" stroke="var(--accent)" stroke-dasharray="4 4" /><${Arrow} a=${toS(O)} b=${toS(U)} color="var(--accent)" width="4" />${label(U, "Unit", "var(--accent)", 8, 18)}`;
      rows = [["X² + Y²", `${A[0]}² + ${A[1]}² = ${f(A[0] * A[0] + A[1] * A[1])}`], ["Magnitude = √", f(lenA), "ax-z"], ["Unit = A ÷ Magnitude", `${f(U[0], 3)}, ${f(U[1], 3)}`]];
      say = "Magnitude is the arrow's length (the Pythagoras rule). Unit keeps the direction but shrinks the length to exactly 1, so it's just a direction (the dashed circle has radius 1).";
      code = `local a = ${vA}\nprint(a.Magnitude) --> ${f(lenA)}\nprint(a.Unit)      --> ${f(U[0], 3)}, ${f(U[1], 3)}, 0`;
    } else if (mode === "dot") {
      const verdict = cosang > 0.7 ? "pointing the SAME way" : cosang > 0.2 ? "kind of the same way" : cosang > -0.2 ? "SIDEWAYS (about 90°)" : cosang > -0.7 ? "kind of opposite" : "OPPOSITE ways";
      const a0 = Math.atan2(A[1], A[0]), b0 = Math.atan2(B[1], B[0]);
      const r = 34;
      let da = b0 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const p1 = [cx + r * Math.cos(a0), cy - r * Math.sin(a0)], p2 = [cx + r * Math.cos(a0 + da), cy - r * Math.sin(a0 + da)];
      extra = html`<path d="M${p1[0]},${p1[1]} A${r},${r} 0 0 ${da > 0 ? 0 : 1} ${p2[0]},${p2[1]}" fill="none" stroke="var(--accent)" stroke-width="2" />`;
      rows = [["A·B = ax·bx + ay·by", `${A[0]}·${B[0]} + ${A[1]}·${B[1]} = ${f(dotv)}`], ["A.Unit:Dot(B.Unit)", f(cosang, 3), "ax-z"], ["Angle between", `${f(ang, 1)}°`]];
      say = `Using the Unit versions: 1 = same way, 0 = sideways, −1 = opposite. Right now they are ${verdict}. Games use this for "is the enemy in front of me?" (dot > 0).`;
      code = `local a = ${vA}\nlocal b = ${vB}\nlocal d = a.Unit:Dot(b.Unit)\nprint(d) --> ${f(cosang, 3)}\nif d > 0 then print("in front!") end`;
    } else if (mode === "lerp") {
      const P = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      extra = html`<line x1=${toS(A)[0]} y1=${toS(A)[1]} x2=${toS(B)[0]} y2=${toS(B)[1]} stroke="var(--accent)" stroke-dasharray="4 4" /><circle cx=${toS(P)[0]} cy=${toS(P)[1]} r="7" fill="var(--accent)" />${label(P, `A:Lerp(B, ${f(t)})`, "var(--accent)", 10, 20)}`;
      rows = [["alpha", f(t)], ["Result", `${f(P[0])}, ${f(P[1])}`, "ax-z"]];
      say = "Lerp finds a point in between. alpha 0 = at A, 1 = at B, 0.5 = exactly halfway. Move the slider.";
      code = `local a = ${vA}\nlocal b = ${vB}\nprint(a:Lerp(b, ${f(t)})) --> ${f(P[0])}, ${f(P[1])}, 0`;
    } else if (mode === "mul") {
      const P = [A[0] * k, A[1] * k];
      extra = html`<${Arrow} a=${toS(O)} b=${toS(P)} color="var(--accent)" width="4" />${label(P, `A × ${f(k)}`, "var(--accent)")}`;
      rows = [["A × number", `${f(P[0])}, ${f(P[1])}`, "ax-z"], ["new length", `${f(lenA)} × ${f(Math.abs(k))} = ${f(lenA * Math.abs(k))}`]];
      say = "Multiplying by a number stretches the arrow. × 2 = twice as long. × −1 flips it around. × 0.5 = half.";
      code = `local a = ${vA}\nprint(a * ${f(k)}) --> ${f(P[0])}, ${f(P[1])}, 0`;
    }
    const showB = mode !== "mag" && mode !== "mul";
    const stage = html`<svg viewBox="0 0 ${W} ${H}" onPointerMove=${d.move} onPointerUp=${d.end} onPointerLeave=${d.end} role="img" aria-label="Two arrows A and B on a grid">
      ${gridL}
      <text x=${W - 26} y=${cy - 6} fill="var(--x)" font-size="12" font-weight="700">X</text>
      <text x=${cx + 6} y=${16} fill="var(--y)" font-size="12" font-weight="700">Y</text>
      ${extra}
      <${Arrow} a=${toS(O)} b=${toS(A)} color="var(--x)" width="3.5" />${label(A, "A", "var(--x)")}
      ${showB && html`<${Arrow} a=${toS(O)} b=${toS(B)} color="var(--y)" width="3.5" />`}${showB && label(B, "B", "var(--y)")}
      ${handle(A, "A", "var(--x)")}${showB && handle(B, "B", "var(--y)")}
    </svg>`;
    const side = html`
      <${Seg} label="Operation" value=${mode} onChange=${setMode} options=${[["add", "A + B"], ["sub", "B − A"], ["mag", "Length"], ["dot", "Dot"], ["lerp", "Lerp"], ["mul", "× number"]]} />
      <p class="lab-say">${say}</p>
      ${mode === "lerp" && html`<${Slider} id="v-t" label="alpha" value=${t} min=${0} max=${1} step=${0.05} onInput=${setT} />`}
      ${mode === "mul" && html`<${Slider} id="v-k" label="number" value=${k} min=${-2} max=${3} step=${0.25} onInput=${setK} />`}
      <${Readout} rows=${rows} />
      <${Code} code=${code} />`;
    return html`<${Lab} title="Vector playground" hint="Drag the circles at the arrow tips. Each square = 1 stud." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Force lab: VectorForce vs gravity, F = m·a
     ========================================================= */
  BB.ForceLab = function () {
    const [mass, setMass] = useState(5.6);
    const [g, setG] = useState(196.2);
    const [F, setF] = useState(0);
    const [st, setSt] = useState({ y: 0, v: 0 });
    const [run, setRun] = useState(false);
    const live = useRef({ mass, g, F });
    live.current = { mass, g, F };
    useEffect(() => {
      if (!run) return;
      let last = performance.now(), raf;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        setSt((s) => {
          const { mass, g, F } = live.current;
          const a = (F - mass * g) / mass;
          let v = s.v + a * dt, y = s.y + v * dt;
          if (y <= 0) { y = 0; if (v < 0) v = 0; }
          if (y >= 60) { y = 60; if (v > 0) v = 0; }
          return { y, v };
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [run]);
    const weight = mass * g;
    const net = F - weight;
    const onGround = st.y <= 0 && net <= 0;
    const acc = onGround ? 0 : net / mass;
    const W = 420, H = 440, gy = 400, top = 40, sc = (gy - top - 40) / 60;
    const by = gy - st.y * sc;
    const bw = 40 + mass * 3, bh = 26 + mass * 1.5;
    const maxF = 40 * 196.2;
    const al = (n) => Math.min(150, (n / maxF) * 600);
    const verdict = Math.abs(net) < weight * 0.01 ? "balanced: it hovers (or stays still)" : net > 0 ? "force wins: it speeds up going UP" : "gravity wins: it speeds up going DOWN";
    const stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A block pushed up by a force while gravity pulls it down">
      ${[0, 10, 20, 30, 40, 50, 60].map((h) => html`<g><line x1="40" x2=${W - 20} y1=${gy - h * sc} y2=${gy - h * sc} stroke="var(--line)" /><text x="8" y=${gy - h * sc + 4} font-size="11" fill="var(--muted)">${h}</text></g>`)}
      <text x="8" y=${top - 14} font-size="11" fill="var(--muted)">height (studs)</text>
      <rect x="30" y=${gy} width=${W - 40} height="30" fill="var(--muted)" opacity="0.35" />
      <rect x=${W / 2 - bw / 2} y=${by - bh} width=${bw} height=${bh} rx="4" fill="var(--z)" stroke="rgba(0,0,0,.3)" />
      <text x=${W / 2} y=${by - bh / 2 + 4} text-anchor="middle" fill="#fff" font-size="12" font-weight="700">${f(mass, 1)} mass</text>
      ${F > 0 && html`<${Arrow} a=${[W / 2 - 22, by - bh / 2]} b=${[W / 2 - 22, by - bh / 2 - al(F) - 10]} color="var(--accent)" width="5" />`}
      ${F > 0 && html`<text x=${W / 2 - 30} y=${by - bh / 2 - al(F) - 16} text-anchor="end" font-size="12" font-weight="700" fill="var(--accent)">VectorForce ${Math.round(F)}</text>`}
      <${Arrow} a=${[W / 2 + 22, by - bh / 2]} b=${[W / 2 + 22, by - bh / 2 + al(weight) + 10]} color="var(--bad)" width="5" />
      <text x=${W / 2 + 32} y=${Math.min(gy + 22, by - bh / 2 + al(weight) + 10)} font-size="12" font-weight="700" fill="var(--bad)">gravity ${Math.round(weight)}</text>
    </svg>`;
    const side = html`
      <p class="lab-say">Gravity pulls with <b>mass × gravity</b>. To hover, push up with exactly that much. More = it rises, less = it falls. That's Newton's rule: <b>force = mass × acceleration</b>.</p>
      <${Slider} id="f-m" label="Mass" value=${mass} min=${1} max=${20} step=${0.1} onInput=${setMass} />
      <${Slider} id="f-g" label="Gravity" value=${g} min=${0} max=${300} step=${0.1} onInput=${setG} />
      <${Slider} id="f-f" label="Force up" value=${F} min=${0} max=${maxF} step=${10} onInput=${setF} />
      <div class="btnrow">
        <button class="btn primary" type="button" onClick=${() => setRun((r) => !r)}>${run ? "Pause" : "Run physics"}</button>
        <button class="btn" type="button" onClick=${() => setF(+(mass * g).toFixed(1))}>Make it hover</button>
        <button class="btn" type="button" onClick=${() => { setSt((s) => ({ ...s, v: s.v + 3000 / mass })); setRun(true); }}>ApplyImpulse up</button>
        <button class="btn" type="button" onClick=${() => { setSt({ y: 0, v: 0 }); setF(0); }}>Reset</button>
      </div>
      <${Readout} rows=${[["Weight (mass × g)", f(weight, 1)], ["Force up", f(F, 1)], ["Net force", f(net, 1), net > 0 ? "ax-y" : ""], ["Acceleration (net ÷ mass)", f(acc, 1) + " studs/s²"], ["Velocity", f(st.v, 1) + " studs/s"], ["Height", f(st.y, 1) + " studs"]]} />
      <p class="lab-say">Right now: ${verdict}.</p>
      <${Code} code=${`-- Script: make a part hover with VectorForce\nlocal part = workspace.Block\nlocal att = Instance.new("Attachment", part)\n\nlocal force = Instance.new("VectorForce")\nforce.Attachment0 = att\nforce.RelativeTo = Enum.ActuatorRelativeTo.World\nforce.ApplyAtCenterOfMass = true\n-- weight = mass x gravity = ${f(mass, 1)} x ${f(g, 1)} = ${f(weight, 1)}\nforce.Force = Vector3.new(0, part.AssemblyMass * workspace.Gravity, 0)\nforce.Parent = part`} />`;
    return html`<${Lab} title="Force vs gravity" hint="Press Run physics, then try the buttons." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     UDim2 lab: Scale vs Offset vs AnchorPoint
     ========================================================= */
  const DEVICES = { phone: [844, 390, "Phone"], tablet: [1180, 820, "Tablet"], pc: [1920, 1080, "PC"] };
  const PRESETS = {
    center: { sxs: 0.5, sxo: 0, sys: 0.4, syo: 0, pxs: 0.5, pxo: 0, pys: 0.5, pyo: 0, ax: 0.5, ay: 0.5 },
    offset: { sxs: 0, sxo: 600, sys: 0, syo: 300, pxs: 0, pxo: 300, pys: 0, pyo: 120, ax: 0, ay: 0 },
    corner: { sxs: 0, sxo: 160, sys: 0, syo: 60, pxs: 1, pxo: -20, pys: 0, pyo: 20, ax: 1, ay: 0 },
  };
  BB.UDimLab = function () {
    const [dev, setDev] = useState("pc");
    const [u, setU] = useState(PRESETS.center);
    const up = (k) => (v) => setU((o) => ({ ...o, [k]: v }));
    const [SW, SH] = DEVICES[dev];
    const sizeX = u.sxs * SW + u.sxo, sizeY = u.sys * SH + u.syo;
    const posX = u.pxs * SW + u.pxo, posY = u.pys * SH + u.pyo;
    const absX = posX - u.ax * sizeX, absY = posY - u.ay * sizeY;
    const VW = 640, k = Math.min((VW - 40) / SW, 360 / SH);
    const w = SW * k, h = SH * k, ox = (VW - w) / 2, oy = 24;
    const offscreen = absX < 0 || absY < 0 || absX + sizeX > SW || absY + sizeY > SH;
    const stage = html`<svg viewBox="0 0 ${VW} ${h + 70}" role="img" aria-label="A screen with a UI frame positioned by Scale and Offset">
      <rect x=${ox - 8} y=${oy - 8} width=${w + 16} height=${h + 16} rx="14" fill="var(--ink)" />
      <rect x=${ox} y=${oy} width=${w} height=${h} fill="var(--surface)" />
      <defs><clipPath id="scr"><rect x=${ox} y=${oy} width=${w} height=${h} /></clipPath></defs>
      <g clip-path="url(#scr)">
        <rect x=${ox + absX * k} y=${oy + absY * k} width=${Math.max(0, sizeX * k)} height=${Math.max(0, sizeY * k)} rx="6" fill="var(--accent)" fill-opacity="0.85" />
        <text x=${ox + (absX + sizeX / 2) * k} y=${oy + (absY + sizeY / 2) * k + 4} text-anchor="middle" font-size="12" font-weight="700" fill="#fff">Frame</text>
      </g>
      <rect x=${ox + absX * k} y=${oy + absY * k} width=${Math.max(0, sizeX * k)} height=${Math.max(0, sizeY * k)} rx="6" fill="none" stroke="var(--accent)" stroke-dasharray="4 3" />
      <circle cx=${ox + posX * k} cy=${oy + posY * k} r="5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2" />
      <line x1=${ox} x2=${ox + u.pxs * SW * k} y1=${oy + h + 22} y2=${oy + h + 22} stroke="var(--accent)" stroke-width="6" />
      <line x1=${ox + u.pxs * SW * k} x2=${ox + posX * k} y1=${oy + h + 22} y2=${oy + h + 22} stroke="var(--z)" stroke-width="6" />
      <text x=${ox} y=${oy + h + 44} font-size="11" fill="var(--muted)">Position X = <tspan fill="var(--accent)" font-weight="700">${f(u.pxs)} × ${SW}px (Scale)</tspan> + <tspan fill="var(--z)" font-weight="700">${u.pxo}px (Offset)</tspan> = ${f(posX, 0)}px</text>
      <text x=${ox + w} y=${oy - 12} text-anchor="end" font-size="11" fill="var(--muted)">${DEVICES[dev][2]} ${SW} × ${SH} pixels</text>
    </svg>`;
    const side = html`
      <${Seg} label="Screen" value=${dev} onChange=${setDev} options=${Object.entries(DEVICES).map(([key, d]) => [key, d[2]])} />
      <div class="btnrow">
        <button class="btn" type="button" onClick=${() => setU(PRESETS.center)}>Centered (Scale)</button>
        <button class="btn" type="button" onClick=${() => setU(PRESETS.offset)}>Pixels only</button>
        <button class="btn" type="button" onClick=${() => setU(PRESETS.corner)}>Top-right corner</button>
      </div>
      <p class="lab-say">${offscreen ? "Part of the frame is OFF the screen! Offset is fixed pixels, so on a smaller screen it doesn't shrink. Switch screens to compare." : "Switch between Phone, Tablet and PC. Scale (percent) grows and shrinks with the screen. Offset (pixels) stays exactly the same."}</p>
      <${Slider} id="u-sxs" label="Size X scale" value=${u.sxs} min=${0} max=${1} step=${0.05} onInput=${up("sxs")} />
      <${Slider} id="u-sxo" label="Size X offset" value=${u.sxo} min=${0} max=${800} step=${10} onInput=${up("sxo")} />
      <${Slider} id="u-sys" label="Size Y scale" value=${u.sys} min=${0} max=${1} step=${0.05} onInput=${up("sys")} />
      <${Slider} id="u-syo" label="Size Y offset" value=${u.syo} min=${0} max=${500} step=${10} onInput=${up("syo")} />
      <${Slider} id="u-pxs" label="Pos X scale" value=${u.pxs} min=${0} max=${1} step=${0.05} onInput=${up("pxs")} />
      <${Slider} id="u-pxo" label="Pos X offset" value=${u.pxo} min=${-400} max=${800} step=${10} onInput=${up("pxo")} />
      <${Slider} id="u-pys" label="Pos Y scale" value=${u.pys} min=${0} max=${1} step=${0.05} onInput=${up("pys")} />
      <${Slider} id="u-pyo" label="Pos Y offset" value=${u.pyo} min=${-300} max=${500} step=${10} onInput=${up("pyo")} />
      <${Slider} id="u-ax" label="Anchor X" value=${u.ax} min=${0} max=${1} step=${0.5} onInput=${up("ax")} />
      <${Slider} id="u-ay" label="Anchor Y" value=${u.ay} min=${0} max=${1} step=${0.5} onInput=${up("ay")} />
      <${Readout} rows=${[["AbsoluteSize", `${f(sizeX, 0)} × ${f(sizeY, 0)} px`], ["Position point", `${f(posX, 0)}, ${f(posY, 0)} px`], ["AbsolutePosition (top-left)", `${f(absX, 0)}, ${f(absY, 0)} px`]]} />
      <${Code} code=${`-- LocalScript\nframe.AnchorPoint = Vector2.new(${u.ax}, ${u.ay})\nframe.Size = UDim2.new(${f(u.sxs)}, ${u.sxo}, ${f(u.sys)}, ${u.syo})\nframe.Position = UDim2.new(${f(u.pxs)}, ${u.pxo}, ${f(u.pys)}, ${u.pyo})\n--             (xScale, xOffset, yScale, yOffset)`} />`;
    return html`<${Lab} title="Scale vs Offset" hint="Black dot = the Position point. AnchorPoint decides which part of the frame sits on it." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Easing lab
     ========================================================= */
  const E = {
    Linear: (t) => t,
    Sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    Quad: (t) => t * t,
    Cubic: (t) => t * t * t,
    Quart: (t) => t ** 4,
    Quint: (t) => t ** 5,
    Exponential: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
    Circular: (t) => 1 - Math.sqrt(1 - t * t),
    Back: (t) => t * t * (2.70158 * t - 1.70158),
    Elastic: (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))),
    Bounce: (t) => 1 - bounceOut(1 - t),
  };
  function bounceOut(x) {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }
  const ease = (style, dir, t) => {
    const fn = E[style];
    if (dir === "In") return fn(t);
    if (dir === "Out") return 1 - fn(1 - t);
    return t < 0.5 ? fn(2 * t) / 2 : 1 - fn(2 - 2 * t) / 2;
  };
  BB.ease = ease;
  const STYLE_SAY = {
    Linear: "Same speed the whole time. Feels robotic, good for spinning things.",
    Sine: "Very gentle speed change. Soft and natural.",
    Quad: "A bit stronger speed change. A great default.",
    Cubic: "Stronger than Quad.", Quart: "Even stronger.", Quint: "Strongest of the power curves.",
    Exponential: "Super dramatic: almost still, then whoosh.",
    Circular: "Like rolling around a curve: quick change near one end.",
    Back: "Pulls back a little before going (or overshoots then settles). Fun for buttons.",
    Elastic: "Wobbles like a rubber band.",
    Bounce: "Bounces like a dropped ball.",
  };
  BB.EasingLab = function () {
    const [style, setStyle] = useState("Quad");
    const [dir, setDir] = useState("Out");
    const [t, setT] = useState(1);
    const [playing, setPlaying] = useState(false);
    useEffect(() => {
      if (!playing) return;
      let start = performance.now(), raf;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / 1200);
        setT(p);
        if (p < 1) raf = requestAnimationFrame(tick); else setPlaying(false);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [playing]);
    const W = 460, H = 360, gx = 50, gw = 360, gyb = 290, gh = 220;
    const path = useMemo(() => {
      let d = "";
      for (let i = 0; i <= 120; i++) {
        const x = i / 120, y = ease(style, dir, x);
        d += (i ? "L" : "M") + (gx + x * gw).toFixed(1) + "," + (gyb - y * gh).toFixed(1);
      }
      return d;
    }, [style, dir]);
    const y = ease(style, dir, t);
    const stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Easing curve graph">
      <rect x=${gx} y=${gyb - gh} width=${gw} height=${gh} fill="none" stroke="var(--line)" />
      <line x1=${gx} x2=${gx + gw} y1=${gyb - gh / 2} y2=${gyb - gh / 2} stroke="var(--line)" stroke-dasharray="3 4" />
      <text x=${gx} y=${gyb + 18} font-size="11" fill="var(--muted)">start</text>
      <text x=${gx + gw} y=${gyb + 18} font-size="11" fill="var(--muted)" text-anchor="end">end (time →)</text>
      <text x=${gx - 8} y=${gyb - gh + 4} font-size="11" fill="var(--muted)" text-anchor="end">goal</text>
      <text x=${gx - 8} y=${gyb + 4} font-size="11" fill="var(--muted)" text-anchor="end">start</text>
      <path d=${path} fill="none" stroke="var(--accent)" stroke-width="3" />
      <circle cx=${gx + t * gw} cy=${gyb - y * gh} r="6" fill="var(--ink)" />
      <rect x="20" y=${H - 36} width=${W - 40} height="22" rx="11" fill="var(--sunk)" stroke="var(--line)" />
      <rect x=${20 + y * (W - 76)} y=${H - 34} width="36" height="18" rx="9" fill="var(--z)" />
    </svg>`;
    const side = html`
      <div class="ctl" style="grid-template-columns:78px minmax(0,1fr)"><label for="ez-s">Style</label>
        <select id="ez-s" value=${style} onChange=${(e) => setStyle(e.currentTarget.value)}>${Object.keys(E).map((k) => html`<option value=${k}>${k}</option>`)}</select></div>
      <${Seg} label="Direction" value=${dir} onChange=${setDir} options=${[["In", "In"], ["Out", "Out"], ["InOut", "InOut"]]} />
      <button class="btn primary" type="button" onClick=${() => { setT(0); setPlaying(true); }}>Play tween</button>
      <p class="lab-say"><b>${style}:</b> ${STYLE_SAY[style]} <b>${dir}</b> ${dir === "In" ? "= the effect happens at the START (slow start)." : dir === "Out" ? "= the effect happens at the END (slow finish). Usually feels best." : "= effect at both start and end."}</p>
      <${Code} code=${`local TweenService = game:GetService("TweenService")\n\nlocal info = TweenInfo.new(\n\t1.2,                           -- seconds\n\tEnum.EasingStyle.${style},\n\tEnum.EasingDirection.${dir}\n)\nlocal goal = { Position = part.Position + Vector3.new(20, 0, 0) }\nTweenService:Create(part, info, goal):Play()`} />`;
    return html`<${Lab} title="Easing explorer" hint="The curve shows progress over time. Steep = fast, flat = slow." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Raycast lab (top-down)
     ========================================================= */
  const WALLS = [
    { name: "Wall", x: 260, y: 40, w: 20, h: 160, c: "var(--muted)" },
    { name: "LavaWall", x: 150, y: 260, w: 200, h: 20, c: "var(--bad)" },
    { name: "Crate", x: 340, y: 120, w: 50, h: 50, c: "var(--warn)" },
    { name: "Boundary", x: 410, y: 20, w: 20, h: 360, c: "var(--muted)" },
  ];
  function hitRect(o, d, r) {
    // slab method; returns t in [0,1] and normal
    let tmin = 0, tmax = 1, nx = 0, ny = 0;
    for (const [oa, da, lo, hi, ax] of [[o[0], d[0], r.x, r.x + r.w, 0], [o[1], d[1], r.y, r.y + r.h, 1]]) {
      if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) return null; continue; }
      let t1 = (lo - oa) / da, t2 = (hi - oa) / da, n = -1;
      if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
      if (t1 > tmin) { tmin = t1; nx = ax === 0 ? n : 0; ny = ax === 1 ? n : 0; }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin > 0 || (nx || ny) ? { t: tmin, n: [nx, ny] } : { t: 0, n: [0, 0] };
  }
  BB.RaycastLab = function () {
    const [o, setO] = useState([90, 120]);
    const [tip, setTip] = useState([380, 300]);
    const [ignoreMe, setIgnoreMe] = useState(true);
    const [ignoreLava, setIgnoreLava] = useState(false);
    const d = useDrag((key, q) => (key === "o" ? setO : setTip)([Math.max(10, Math.min(450, q[0])), Math.max(10, Math.min(390, q[1]))]));
    const dir = [tip[0] - o[0], tip[1] - o[1]];
    const S = 10; // px per stud
    const me = { name: "MyCharacter", x: o[0] - 14, y: o[1] - 14, w: 28, h: 28, c: "var(--z)" };
    const list = [...(ignoreMe ? [] : [me]), ...WALLS.filter((w) => !(ignoreLava && w.name === "LavaWall"))];
    let best = null;
    for (const r of list) {
      const h = hitRect(o, dir, r);
      if (h && (!best || h.t < best.t)) best = { ...h, r };
    }
    const hp = best ? [o[0] + dir[0] * best.t, o[1] + dir[1] * best.t] : null;
    const toStud = (p) => `${f((p[0] - 230) / S, 1)}, 0, ${f((p[1] - 200) / S, 1)}`;
    const stage = html`<svg viewBox="0 0 460 400" onPointerMove=${d.move} onPointerUp=${d.end} onPointerLeave=${d.end} role="img" aria-label="Top-down room where a laser ray is shot from a character">
      ${WALLS.map((w) => html`<g opacity=${ignoreLava && w.name === "LavaWall" ? 0.3 : 1}><rect x=${w.x} y=${w.y} width=${w.w} height=${w.h} rx="3" fill=${w.c} /><text x=${w.x + w.w / 2} y=${w.y + w.h / 2 + 4} text-anchor="middle" font-size="10" font-weight="700" fill="#fff" transform=${w.h > w.w * 2 ? `rotate(-90 ${w.x + w.w / 2} ${w.y + w.h / 2})` : ""}>${w.name}</text></g>`)}
      <rect x=${me.x} y=${me.y} width="28" height="28" rx="14" fill="var(--z)" opacity=${ignoreMe ? 0.45 : 1} />
      <line x1=${o[0]} y1=${o[1]} x2=${tip[0]} y2=${tip[1]} stroke="var(--muted)" stroke-dasharray="4 5" />
      ${hp && html`<line x1=${o[0]} y1=${o[1]} x2=${hp[0]} y2=${hp[1]} stroke="var(--accent)" stroke-width="3" />`}
      ${hp && html`<circle cx=${hp[0]} cy=${hp[1]} r="6" fill="var(--accent)" />`}
      ${hp && (best.n[0] || best.n[1]) && html`<${Arrow} a=${hp} b=${[hp[0] + best.n[0] * 34, hp[1] + best.n[1] * 34]} color="var(--y)" width="2.5" />`}
      <circle cx=${o[0]} cy=${o[1]} r="9" fill="var(--surface)" stroke="var(--ink)" stroke-width="2.5" style="cursor:grab" onPointerDown=${d.start("o")} />
      <circle cx=${tip[0]} cy=${tip[1]} r="9" fill="var(--surface)" stroke="var(--muted)" stroke-width="2.5" style="cursor:grab" onPointerDown=${d.start("t")} />
      <text x=${o[0] + 14} y=${o[1] - 12} font-size="11" font-weight="700" fill="var(--ink)">origin</text>
      <text x=${tip[0] + 12} y=${tip[1] + 4} font-size="11" font-weight="700" fill="var(--muted)">origin + direction</text>
    </svg>`;
    const side = html`
      <p class="lab-say">The laser starts at <b>origin</b> and goes along <b>direction</b>. The direction's LENGTH is how far it reaches. If nothing is in that distance, Raycast gives back <code>nil</code>.</p>
      <label class="place"><input type="checkbox" checked=${ignoreMe} onChange=${(e) => setIgnoreMe(e.currentTarget.checked)} /> Exclude my own character</label>
      <label class="place"><input type="checkbox" checked=${ignoreLava} onChange=${(e) => setIgnoreLava(e.currentTarget.checked)} /> Also exclude LavaWall</label>
      ${!ignoreMe && html`<p class="callout bad" style="margin:0">Untick "Exclude my character" and the ray hits YOU first, since it starts inside your body. That's the #1 raycast mistake.</p>`}
      <${Readout} rows=${best
        ? [["result.Instance", best.r.name, "ax-z"], ["result.Position", toStud(hp)], ["result.Normal", best.n[0] || best.n[1] ? `${best.n[0]}, 0, ${best.n[1]}` : "(inside it)", "ax-y"], ["result.Distance", f(Math.hypot(dir[0], dir[1]) * best.t / S, 1) + " studs"]]
        : [["result", "nil (missed)", "ax-x"], ["ray length", f(Math.hypot(dir[0], dir[1]) / S, 1) + " studs"]]} />
      <${Code} code=${`local params = RaycastParams.new()\nparams.FilterType = Enum.RaycastFilterType.Exclude\nparams.FilterDescendantsInstances = { ${[ignoreMe && "character", ignoreLava && "workspace.LavaWall"].filter(Boolean).join(", ")} }\n\nlocal origin = character.HumanoidRootPart.Position\nlocal direction = Vector3.new(${f(dir[0] / S, 1)}, 0, ${f(dir[1] / S, 1)}) -- ${f(Math.hypot(dir[0], dir[1]) / S, 1)} studs long\n\nlocal result = workspace:Raycast(origin, direction, params)\nif result then\n\tprint("Hit", result.Instance.Name, "at", result.Position)\nelse\n\tprint("Missed!")\nend`} />`;
    return html`<${Lab} title="Raycast laser" hint="Drag the origin and the end of the laser. Seen from above." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Network lab: client / server / internet
     ========================================================= */
  const NODES = { server: [300, 70], you: [130, 300], friend: [470, 300], net: [560, 70] };
  BB.NetworkLab = function () {
    const [packets, setPackets] = useState([]);
    const [colors, setColors] = useState({ server: "#7a8599", you: "#7a8599", friend: "#7a8599" });
    const [log, setLog] = useState([["info", "Press a button to send something."]]);
    const [now, setNow] = useState(0);
    const logRef = useRef();
    const say = (cls, msg) => setLog((l) => [...l.slice(-40), [cls, msg]]);
    const send = (from, to, color, onArrive, delay = 0) => {
      const p = { id: Math.random(), from, to, color, start: performance.now() + delay, onArrive };
      setPackets((ps) => [...ps, p]);
    };
    useEffect(() => {
      let raf;
      const tick = (t) => {
        setNow(t);
        setPackets((ps) => {
          const keep = [];
          for (const p of ps) {
            if (t - p.start >= 900) { p.onArrive && setTimeout(p.onArrive, 0); } else keep.push(p);
          }
          return keep.length === ps.length ? ps : keep;
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = 1e9; }, [log]);
    const rnd = () => `hsl(${Math.floor(Math.random() * 360)} 70% 55%)`;
    const actions = [
      ["Server colors the part", () => {
        const c = rnd();
        say("info", "Server: part.Color = new color");
        setColors((o) => ({ ...o, server: c }));
        send("server", "you", c, () => { setColors((o) => ({ ...o, you: c })); say("ok", "Replicated to You: you see the new color"); });
        send("server", "friend", c, () => { setColors((o) => ({ ...o, friend: c })); say("ok", "Replicated to Friend: they see it too"); });
      }],
      ["Your LocalScript colors it", () => {
        const c = rnd();
        setColors((o) => ({ ...o, you: c }));
        say("bad", "LocalScript changed the part ONLY on your screen. Not sent anywhere: the server and your friend still see the old color.");
      }],
      ["You fire a RemoteEvent", () => {
        say("info", "You: remote:FireServer(\"Jump\")");
        send("you", "server", "var(--accent)", () => say("ok", "Server: OnServerEvent(player = You, \"Jump\") ran"));
      }],
      ["Cheater asks for 1,000,000 coins", () => {
        say("info", "Cheater (You, hacked): remote:FireServer(\"AddCoins\", 1000000)");
        send("you", "server", "var(--bad)", () => say("bad", "Server checks: 'Did they earn this? No.' Request ignored. Never trust the client!"));
      }],
      ["Server calls a website (HttpService)", () => {
        say("info", "Server: HttpService:GetAsync(\"https://api.example.com\")");
        send("server", "net", "var(--z)", () => { say("info", "Website got the request, answering…"); send("net", "server", "var(--z)", () => say("ok", "Server got the website's answer")); });
      }],
      ["Your LocalScript calls a website", () => say("bad", "Error: HttpService is not allowed to make requests from the client. Only the server can use the internet.")],
    ];
    const pos = (p) => {
      const k = Math.max(0, Math.min(1, (now - p.start) / 900));
      const a = NODES[p.from], b = NODES[p.to];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, now >= p.start];
    };
    const device = (key, label, sub) => {
      const [x, y] = NODES[key];
      return html`<g><rect x=${x - 80} y=${y - 46} width="160" height="92" rx="12" fill="var(--surface)" stroke="var(--line)" stroke-width="2" />
        <text x=${x} y=${y - 26} text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${label}</text>
        <text x=${x} y=${y - 11} text-anchor="middle" font-size="10" fill="var(--muted)">${sub}</text>
        <rect x=${x - 18} y=${y} width="36" height="26" rx="4" fill=${colors[key]} stroke="rgba(0,0,0,.25)" />
        <text x=${x + 26} y=${y + 17} font-size="10" fill="var(--muted)">Part</text></g>`;
    };
    const [sx, sy] = NODES.server, [nx, ny] = NODES.net;
    const stage = html`<svg viewBox="0 0 640 380" role="img" aria-label="A server connected to two player devices and the internet">
      <line x1=${sx} y1=${sy} x2=${NODES.you[0]} y2=${NODES.you[1]} stroke="var(--line)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" />
      <line x1=${sx} y1=${sy} x2=${NODES.friend[0]} y2=${NODES.friend[1]} stroke="var(--line)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" />
      <line x1=${sx} y1=${sy} x2=${nx} y2=${ny} stroke="var(--line)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" />
      <text x="190" y="190" font-size="10" fill="var(--muted)" transform="rotate(-52 190 190)">Roblox network (not HTTP)</text>
      <text x=${(sx + nx) / 2} y=${sy - 8} text-anchor="middle" font-size="10" fill="var(--muted)">HTTPS</text>
      ${device("server", "Roblox server", "Scripts run here")}
      ${device("you", "You (client)", "LocalScripts run here")}
      ${device("friend", "Friend (client)", "their own copy")}
      <g><ellipse cx=${nx} cy=${ny} rx="58" ry="34" fill="var(--sunk)" stroke="var(--line)" stroke-width="2" /><text x=${nx} y=${ny + 4} text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">Internet</text></g>
      ${packets.map((p) => { const [x, y, vis] = pos(p); return vis && html`<circle cx=${x} cy=${y} r="9" fill=${p.color} stroke="var(--surface)" stroke-width="2" />`; })}
    </svg>`;
    const side = html`
      <div class="btnrow">${actions.map(([l, fn]) => html`<button class="btn" type="button" onClick=${fn}>${l}</button>`)}</div>
      <div class="log" ref=${logRef} aria-live="polite">${log.map(([c, m]) => html`<div class=${c}>${m}</div>`)}</div>`;
    return html`<${Lab} title="Who talks to whom" hint="Each colored dot is a message traveling." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Explorer tree lab
     ========================================================= */
  const TREE = ["game", "DataModel", [
    ["Workspace", "Workspace", [["Baseplate", "Part"], ["House", "Model", [["Door", "Part", [["ClickDetector", "ClickDetector"]]], ["Roof", "Part"], ["Window", "Part"]]], ["Camera", "Camera"]]],
    ["Players", "Players", [["Player1", "Player", [["Backpack", "Backpack", [["Sword", "Tool"]]], ["PlayerGui", "PlayerGui"]]]]],
    ["ReplicatedStorage", "ReplicatedStorage", [["BuyItem", "RemoteEvent"]]],
    ["ServerScriptService", "ServerScriptService", [["GameScript", "Script"]]],
    ["StarterGui", "StarterGui", [["ShopGui", "ScreenGui"]]],
  ]];
  function flatten(node, parent = null, depth = 0, out = []) {
    const [name, cls, kids = []] = node;
    const me = { name, cls, parent, depth, kids: [] };
    out.push(me);
    if (parent) parent.kids.push(me);
    kids.forEach((k) => flatten(k, me, depth + 1, out));
    return out;
  }
  const ALL = flatten(TREE);
  const descOf = (n) => n.kids.flatMap((k) => [k, ...descOf(k)]);
  const ancOf = (n) => (n.parent ? [n.parent, ...ancOf(n.parent)] : []);
  BB.TreeLab = function () {
    const [sel, setSel] = useState(ALL.find((n) => n.name === "House"));
    const desc = new Set(descOf(sel)), anc = new Set(ancOf(sel)), kids = new Set(sel.kids);
    const role = (n) => (n === sel ? "sel" : kids.has(n) ? "child" : desc.has(n) ? "desc" : n === sel.parent ? "parent" : anc.has(n) ? "anc" : "");
    const COL = { sel: "var(--accent)", child: "var(--y)", desc: "var(--y)", parent: "var(--z)", anc: "var(--z)" };
    const LBL = { sel: "selected", child: "child", desc: "descendant", parent: "Parent", anc: "ancestor" };
    const path = [...ancOf(sel)].reverse().concat(sel);
    const dotPath = path.map((n, i) => (i === 0 ? "game" : n.name)).join(".");
    const stage = html`<div style="width:100%;padding:16px;align-self:start;font-family:var(--f-mono);font-size:.86rem">
      ${ALL.map((n) => {
        const r = role(n);
        return html`<button type="button" onClick=${() => setSel(n)} style=${`display:flex;gap:8px;align-items:center;width:100%;text-align:left;border:0;border-radius:6px;padding:3px 8px;margin-left:${n.depth * 18}px;max-width:calc(100% - ${n.depth * 18}px);background:${r === "sel" ? "var(--accent-soft)" : "transparent"};color:var(--ink)`}>
          <span style=${`width:9px;height:9px;border-radius:2px;flex:none;background:${COL[r] || "var(--line)"}`}></span>
          <b style="font-weight:600">${n.name}</b><span style="color:var(--muted);font-size:.78rem">${n.cls}</span>
          ${r && r !== "sel" && html`<span style=${`margin-left:auto;font-size:.72rem;font-family:var(--f-body);font-weight:800;color:${COL[r]}`}>${LBL[r]}</span>`}</button>`;
      })}</div>`;
    const second = path[1] && path[1].name;
    const code = sel === ALL[0] ? `print(game) -- the very top of everything`
      : `-- direct path (errors if something is missing)\nlocal it = ${dotPath}\n\n-- safe: gives nil if it isn't there\nlocal it = ${path.length > 2 ? path.slice(0, -1).map((n, i) => (i === 0 ? "game" : n.name)).join(".") : "game"}:FindFirstChild("${sel.name}")\n\n-- waits until it exists (use in LocalScripts!)\nlocal it = ${path.length > 2 ? path.slice(0, -1).map((n, i) => (i === 0 ? "game" : n.name)).join(".") : "game"}:WaitForChild("${sel.name}")\n\nprint(it.Parent) --> ${sel.parent ? sel.parent.name : "nil"}\nprint(#it:GetChildren()) --> ${sel.kids.length}\nprint(#it:GetDescendants()) --> ${desc.size}`;
    const side = html`
      <p class="lab-say">Click anything. <b style="color:var(--z)">Blue</b> = the things it is inside (its Parent and ancestors). <b style="color:var(--y)">Green</b> = the things inside it (its children and descendants).</p>
      <${Readout} rows=${[["ClassName", sel.cls], ["Parent", sel.parent ? sel.parent.name : "nil"], ["Children", String(sel.kids.length)], ["Descendants", String(desc.size)], ["GetFullName()", path.slice(1).map((n) => n.name).join(".") || "game"]]} />
      ${second === "Workspace" && sel !== path[1] && html`<p class="callout ok" style="margin:0">It's inside Workspace, so it exists in the 3D world and players can see it.</p>`}
      <${Code} code=${code} />`;
    return html`<${Lab} title="The Explorer tree" hint="This is what Studio's Explorer window shows." stage=${stage} side=${side} stageStyle="place-items:start" />`;
  };

  /* =========================================================
     Player lifecycle lab
     ========================================================= */
  const LIFE = [
    { t: "Player clicks Play", ev: "Players.PlayerAdded", who: "server", say: "The server makes a new Player object and puts it in the Players service. This is the moment to load their saved data.", code: `Players.PlayerAdded:Connect(function(player)\n\tprint(player.Name .. " joined!")\n\t-- load saved coins here (DataStore)\nend)`, box: { player: 1 } },
    { t: "Starter stuff gets copied", ev: "(automatic)", who: "server", say: "Roblox copies the Starter containers into the player: StarterGui → PlayerGui (their screen UI), StarterPack → Backpack (their tools), StarterPlayerScripts → PlayerScripts.", code: `-- you don't write code for this. Roblox does it.\n-- Put UI in StarterGui, tools in StarterPack,\n-- LocalScripts in StarterPlayerScripts.`, box: { player: 1, gui: 1, pack: 1, scripts: 1 } },
    { t: "Character spawns", ev: "Player.CharacterAdded", who: "server", say: "Because Players.CharacterAutoLoads is true, a body (character Model with a Humanoid) appears at a SpawnLocation. Scripts in StarterCharacterScripts are copied INTO the character.", code: `player.CharacterAdded:Connect(function(character)\n\tlocal humanoid = character:WaitForChild("Humanoid")\n\thumanoid.WalkSpeed = 24\nend)`, box: { player: 1, gui: 1, pack: 1, scripts: 1, char: 1 } },
    { t: "Playing", ev: "Humanoid.HealthChanged", who: "both", say: "The player runs around. The character's Humanoid handles walking, jumping and Health (100 by default).", code: `humanoid.HealthChanged:Connect(function(health)\n\tprint("Health is now", health)\nend)`, box: { player: 1, gui: 1, pack: 1, scripts: 1, char: 1 } },
    { t: "Character dies", ev: "Humanoid.Died", who: "server", say: "Health hits 0. The body falls apart and stays for Players.RespawnTime seconds (5 by default).", code: `humanoid.Died:Connect(function()\n\tprint(player.Name .. " fell over!")\nend)`, box: { player: 1, gui: 1, pack: 1, scripts: 1, char: 2 } },
    { t: "Old body removed", ev: "Player.CharacterRemoving", who: "server", say: "The old character is about to be deleted. The Backpack is emptied too: tools are lost unless they're in StarterPack or StarterGear. PlayerGui is reset if ScreenGui.ResetOnSpawn is true.", code: `player.CharacterRemoving:Connect(function(character)\n\tprint("Cleaning up", character.Name)\nend)`, box: { player: 1, gui: 1, scripts: 1 } },
    { t: "Respawn", ev: "Player.CharacterAdded (again)", who: "server", say: "A brand-new character spawns. It's a DIFFERENT object! Old variables pointing to the old Humanoid are now useless. That's why you connect to CharacterAdded instead of grabbing the character once.", code: `-- WRONG: only works for the first life\nlocal humanoid = player.Character.Humanoid\n\n-- RIGHT: runs for every new life\nplayer.CharacterAdded:Connect(function(character)\n\tlocal humanoid = character:WaitForChild("Humanoid")\nend)`, box: { player: 1, gui: 1, pack: 1, scripts: 1, char: 1 } },
    { t: "Player leaves", ev: "Players.PlayerRemoving", who: "server", say: "The player is about to disappear. SAVE their data now! Also use game:BindToClose so saves finish when the whole server shuts down.", code: `Players.PlayerRemoving:Connect(function(player)\n\t-- save coins here (DataStore)\n\tprint(player.Name .. " left")\nend)`, box: {} },
  ];
  BB.LifecycleLab = function () {
    const [i, setI] = useState(0);
    const s = LIFE[i];
    const B = (on, label, sub, x, y, w = 150) => html`<g opacity=${on ? 1 : 0.28}><rect x=${x} y=${y} width=${w} height="44" rx="8" fill=${on === 2 ? "var(--bad)" : "var(--surface)"} fill-opacity=${on === 2 ? 0.2 : 1} stroke=${on ? "var(--accent)" : "var(--line)"} stroke-width="2" stroke-dasharray=${on ? "" : "4 4"} />
      <text x=${x + 12} y=${y + 19} font-size="12" font-weight="700" fill="var(--ink)">${label}</text><text x=${x + 12} y=${y + 34} font-size="10" fill="var(--muted)">${sub}</text></g>`;
    const b = s.box;
    const stage = html`<svg viewBox="0 0 440 360" role="img" aria-label="What exists for the player at this step">
      <text x="20" y="28" font-size="11" fill="var(--muted)" font-weight="700" letter-spacing="1">PLAYERS SERVICE</text>
      ${B(b.player, "Player1", "the Player object", 20, 40, 400)}
      ${B(b.gui, "PlayerGui", "from StarterGui", 40, 100)}
      ${B(b.pack, "Backpack", "from StarterPack", 250, 100)}
      ${B(b.scripts, "PlayerScripts", "from StarterPlayerScripts", 40, 156)}
      <text x="20" y="236" font-size="11" fill="var(--muted)" font-weight="700" letter-spacing="1">WORKSPACE</text>
      ${B(b.char, b.char === 2 ? "Character (dead)" : "Character", "Model + Humanoid + scripts from StarterCharacterScripts", 20, 248, 400)}
      <line x1="20" x2="420" y1="320" y2="320" stroke="var(--line)" stroke-width="4" stroke-linecap="round" />
      <line x1="20" x2=${20 + (400 * i) / (LIFE.length - 1)} y1="320" y2="320" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" />
      ${LIFE.map((_, j) => html`<circle cx=${20 + (400 * j) / (LIFE.length - 1)} cy="320" r=${j === i ? 8 : 5} fill=${j <= i ? "var(--accent)" : "var(--line)"} style="cursor:pointer" onClick=${() => setI(j)} />`)}
      <text x="20" y="346" font-size="11" fill="var(--muted)">step ${i + 1} of ${LIFE.length}</text>
    </svg>`;
    const side = html`
      <h3 style="font-size:1.15rem">${i + 1}. ${s.t}</h3>
      <div class="place">Event: <b><code>${s.ev}</code></b></div>
      <p style="margin:0">${s.say}</p>
      <${Code} code=${s.code} />
      <div class="btnrow"><button class="btn" type="button" disabled=${i === 0} onClick=${() => setI(i - 1)}>Back</button><button class="btn primary" type="button" disabled=${i === LIFE.length - 1} onClick=${() => setI(i + 1)}>Next step</button></div>`;
    return html`<${Lab} title="A player's life, step by step" hint="Press Next step. Faded boxes don't exist yet." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Events & yielding timeline
     ========================================================= */
  const SCEN = {
    wait: { code: `print("A")\ntask.wait(2)   -- the script PAUSES here\nprint("B")\nprint("C")`, out: [[0, "A"], [2, "B"], [2, "C"]], say: "task.wait yields: everything after it waits. B and C come 2 seconds later." },
    spawn: { code: `print("A")\ntask.spawn(function()\n\ttask.wait(2)\n\tprint("B")\nend)\nprint("C")`, out: [[0, "A"], [0, "C"], [2, "B"]], say: "task.spawn starts the function on its own path (thread). The main script doesn't wait, so C prints before B." },
    delay: { code: `task.delay(1.5, function()\n\tprint("B")\nend)\nprint("A")`, out: [[0, "A"], [1.5, "B"]], say: "task.delay schedules a function for later and moves on right away." },
    event: { code: `part.Touched:Connect(function(hit)\n\tprint("Touched by", hit.Name)\nend)\nprint("Listening!")`, out: [[0, "Listening!"], [1, "Touched by LeftFoot"], [1.1, "Touched by RightFoot"], [2.5, "Touched by LeftFoot"]], say: ":Connect doesn't wait. It just says \"run this every time\". The function runs later, each time the event fires (often many times!)." },
  };
  BB.EventsLab = function () {
    const [k, setK] = useState("wait");
    const [shown, setShown] = useState([]);
    const [clock, setClock] = useState(0);
    const timers = useRef([]);
    const run = () => {
      timers.current.forEach(clearTimeout); timers.current = [];
      setShown([]); setClock(0);
      const start = performance.now();
      const iv = setInterval(() => setClock((performance.now() - start) / 1000), 50);
      timers.current.push(iv);
      SCEN[k].out.forEach(([t, txt]) => timers.current.push(setTimeout(() => setShown((s) => [...s, [t, txt]]), t * 1000)));
      const end = Math.max(...SCEN[k].out.map((o) => o[0])) * 1000 + 300;
      timers.current.push(setTimeout(() => clearInterval(iv), end));
    };
    useEffect(() => () => timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }), []);
    useEffect(() => { timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }); setShown([]); setClock(0); }, [k]);
    const s = SCEN[k];
    const stage = html`<div style="width:100%;padding:16px;display:flex;flex-direction:column;gap:12px;align-self:start"><${Code} code=${s.code} />
      <div class="log" style="height:auto;min-height:120px">${shown.length ? shown.map(([t, txt]) => html`<div><span style="color:var(--c-com)">[${t.toFixed(1)}s]</span> ${txt}</div>`) : html`<div style="color:var(--c-com)">Output is empty. Press Run.</div>`}</div></div>`;
    const side = html`
      <${Seg} label="Example" value=${k} onChange=${setK} options=${[["wait", "task.wait"], ["spawn", "task.spawn"], ["delay", "task.delay"], ["event", ":Connect"]]} />
      <button class="btn primary" type="button" onClick=${run}>Run</button>
      <${Readout} rows=${[["clock", clock.toFixed(1) + " s"]]} />
      <p class="lab-say">${s.say}</p>`;
    return html`<${Lab} title="Who prints first?" hint="Guess the order, then press Run." stage=${stage} side=${side} stageStyle="place-items:start" />`;
  };
})();

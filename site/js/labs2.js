/* More labs: trigonometry, the math library, and 3D vectors (Cross, projection). */
(function () {
  const BB = window.BB;
  const { html, useState, useEffect, useRef, useMemo } = window.htmPreact;
  const { V, add, sub, mul, dot, cross, len, unit, camera, pts, arrowPath } = BB.m3;
  const f = BB.fmt;

  const Code = BB.Code;
  const Slider = ({ id, label, value, min, max, step = 1, onInput, unit = "", cls = "" }) => html`
    <div class="ctl"><label for=${id} class=${cls}>${label}</label>
      <input id=${id} type="range" min=${min} max=${max} step=${step} value=${value} onInput=${(e) => onInput(+e.currentTarget.value)} />
      <output for=${id}>${f(value, 2)}${unit}</output></div>`;
  const Seg = ({ options, value, onChange, label }) => html`
    <div class="seg" role="group" aria-label=${label}>${options.map(([v, l]) => html`<button type="button" class=${v === value ? "on" : ""} aria-pressed=${v === value} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;
  const Lab = ({ title, hint, stage, side }) => html`
    <section class="lab"><div class="lab-head"><h3>${title}</h3><span class="hint">${hint}</span></div>
      <div class="lab-body"><div class="lab-stage">${stage}</div><div class="lab-side">${side}</div></div></section>`;
  const Readout = ({ rows }) => html`<dl class="readout">${rows.map(([k, v, c]) => html`<dt>${k}</dt><dd class=${c || ""}>${v}</dd>`)}</dl>`;
  const Arrow = ({ a, b, color, width = 3, dash }) => {
    const p = arrowPath(a, b);
    return html`<g><path d=${p.line} stroke=${color} stroke-width=${width} fill="none" stroke-linecap="round" stroke-dasharray=${dash || ""} /><polygon points=${p.head} fill=${color} /></g>`;
  };
  BB.useClock = function (running) {
    const [t, setT] = useState(0);
    const base = useRef(0);
    useEffect(() => {
      if (!running) return;
      let raf, last = performance.now();
      const tick = (now) => { base.current += Math.min(0.05, (now - last) / 1000); last = now; setT(base.current); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [running]);
    return [t, (v) => { base.current = v; setT(v); }];
  };

  /* =========================================================
     Trigonometry lab
     ========================================================= */
  BB.TrigLab = function () {
    const [mode, setMode] = useState("circle");
    const [play, setPlay] = useState(true);
    const [t, setT] = BB.useClock(play);
    const [deg, setDeg] = useState(40);
    const [speed, setSpeed] = useState(1);
    const [amp, setAmp] = useState(3);
    const [pt, setPt] = useState([3, 2]);
    const angle = play && mode !== "atan2" ? ((t * speed * 57.3) % 360) : deg;
    const a = (angle * Math.PI) / 180;
    const W = 560, H = 400, cx = 190, cy = 200, R = 130;
    const svgRef = useRef();
    const drag = useRef(false);
    const onMove = (e) => {
      if (!drag.current) return;
      const r = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      setPt([+(((x - cx) / R) * 4).toFixed(1), +(((cy - y) / R) * 4).toFixed(1)]);
    };
    let stage, side, code;
    const cosv = Math.cos(a), sinv = Math.sin(a);
    if (mode === "circle" || mode === "orbit") {
      const px = cx + cosv * R, py = cy - sinv * R;
      // sine wave history on the right
      const wave = [];
      for (let i = 0; i <= 120; i++) {
        const back = (i / 120) * Math.PI * 2;
        wave.push([px > 0 ? 340 + i * 1.7 : 0, cy - Math.sin(a - back) * R]);
      }
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Unit circle with sine and cosine">
        <line x1="20" x2="330" y1=${cy} y2=${cy} stroke="var(--line)" /><line x1=${cx} x2=${cx} y1="30" y2="370" stroke="var(--line)" />
        <circle cx=${cx} cy=${cy} r=${R} fill="none" stroke="var(--muted)" stroke-width="1.5" />
        <path d="M${cx + 28},${cy} A28,28 0 ${a % (2 * Math.PI) > Math.PI ? 1 : 0} 0 ${cx + Math.cos(a) * 28},${cy - Math.sin(a) * 28}" fill="none" stroke="var(--accent)" stroke-width="2" />
        <text x=${cx + 34} y=${cy - 8} font-size="12" fill="var(--accent)" font-weight="700">${f(angle, 0)}°</text>
        <line x1=${cx} y1=${cy} x2=${px} y2=${cy} stroke="var(--x)" stroke-width="5" stroke-linecap="round" />
        <line x1=${px} y1=${cy} x2=${px} y2=${py} stroke="var(--y)" stroke-width="5" stroke-linecap="round" />
        <line x1=${cx} y1=${cy} x2=${px} y2=${py} stroke="var(--ink)" stroke-width="2" />
        <text x=${(cx + px) / 2} y=${cy + (sinv > 0 ? 18 : -8)} font-size="12" text-anchor="middle" fill="var(--x)" font-weight="700">cos = ${f(cosv)}</text>
        <text x=${px + (cosv > 0 ? 8 : -8)} y=${(cy + py) / 2} font-size="12" text-anchor=${cosv > 0 ? "start" : "end"} fill="var(--y)" font-weight="700">sin = ${f(sinv)}</text>
        ${mode === "circle" && html`<g><line x1=${px} y1=${py} x2="340" y2=${py} stroke="var(--y)" stroke-dasharray="3 4" />
          <polyline points=${wave.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} fill="none" stroke="var(--y)" stroke-width="2.5" />
          <text x="344" y="40" font-size="11" fill="var(--muted)">sin over time → a wave</text></g>`}
        ${mode === "orbit" && html`<g><rect x=${px - 14} y=${py - 14} width="28" height="28" rx="5" fill="var(--z)" stroke="rgba(0,0,0,.3)" transform=${`rotate(${-angle} ${px} ${py})`} />
          <text x="360" y="120" font-size="13" fill="var(--ink)" font-weight="700">x = cos(angle) × radius</text>
          <text x="360" y="144" font-size="13" fill="var(--ink)" font-weight="700">z = sin(angle) × radius</text>
          <text x="360" y="176" font-size="12" fill="var(--muted)">Grow the angle every frame</text><text x="360" y="194" font-size="12" fill="var(--muted)">and the part goes around.</text></g>`}
        <circle cx=${px} cy=${py} r="7" fill="var(--accent)" />
      </svg>`;
      code = mode === "circle"
        ? `local angle = math.rad(${f(angle, 0)}) -- degrees -> radians\nprint(math.cos(angle)) --> ${f(cosv, 3)}  (how far RIGHT)\nprint(math.sin(angle)) --> ${f(sinv, 3)}  (how far UP)\nprint(math.tan(angle)) --> ${Math.abs(cosv) < 1e-6 ? "huge" : f(sinv / cosv, 3)}  (sin / cos)`
        : `-- Script: make a part orbit around a center point\nlocal RunService = game:GetService("RunService")\nlocal center = Vector3.new(0, 5, 0)\nlocal radius, speed = 10, ${f(speed)}\nlocal angle = 0\n\nRunService.Heartbeat:Connect(function(dt)\n\tangle += speed * dt -- radians per second\n\tlocal x = math.cos(angle) * radius\n\tlocal z = math.sin(angle) * radius\n\tpart.Position = center + Vector3.new(x, 0, z)\nend)`;
      side = html`
        <${Seg} label="Mode" value=${mode} onChange=${setMode} options=${[["circle", "sin & cos"], ["orbit", "Orbit"], ["wave", "Bobbing wave"], ["atan2", "atan2 aim"]]} />
        <p class="lab-say">${mode === "circle" ? "Walk around a circle of radius 1. cos is how far right you are, sin is how far up. That's all they are! They always stay between -1 and 1." : "cos and sin turn one growing number (the angle) into a circle. This is how every orbiting coin, planet and spinning platform works."}</p>
        <div class="btnrow"><button class="btn primary" type="button" onClick=${() => setPlay((p) => !p)}>${play ? "Pause" : "Play"}</button></div>
        ${!play && html`<${Slider} id="tr-deg" label="Angle°" value=${deg} min=${0} max=${360} step=${1} onInput=${setDeg} />`}
        ${play && html`<${Slider} id="tr-sp" label="Speed" value=${speed} min=${0.2} max=${3} step=${0.1} onInput=${setSpeed} unit=" rad/s" />`}
        <${Readout} rows=${[["degrees", f(angle, 1) + "°"], ["radians", f(a % (2 * Math.PI), 3)], ["math.cos", f(cosv, 3), "ax-x"], ["math.sin", f(sinv, 3), "ax-y"]]} />
        <${Code} code=${code} />`;
    } else if (mode === "wave") {
      const y = Math.sin(t * speed * 2) * amp;
      const pts2 = [];
      for (let i = 0; i <= 200; i++) { const tt = t - (200 - i) / 60; pts2.push([30 + i * 2.2, 200 - Math.sin(tt * speed * 2) * amp * 25]); }
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A part bobbing up and down on a sine wave">
        <line x1="20" x2=${W - 20} y1="200" y2="200" stroke="var(--line)" />
        <polyline points=${pts2.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} fill="none" stroke="var(--y)" stroke-width="2.5" />
        <rect x="470" y=${200 - y * 25 - 20} width="40" height="40" rx="6" fill="var(--z)" stroke="rgba(0,0,0,.3)" />
        <text x="490" y=${200 - y * 25 + 5} text-anchor="middle" font-size="11" fill="#fff" font-weight="700">coin</text>
        <text x="30" y="40" font-size="12" fill="var(--muted)">height over time</text>
        <line x1="440" x2="530" y1=${200 - amp * 25} y2=${200 - amp * 25} stroke="var(--accent)" stroke-dasharray="3 3" /><text x="535" y=${204 - amp * 25} font-size="11" fill="var(--accent)">+${amp}</text>
        <line x1="440" x2="530" y1=${200 + amp * 25} y2=${200 + amp * 25} stroke="var(--accent)" stroke-dasharray="3 3" /><text x="535" y=${204 + amp * 25} font-size="11" fill="var(--accent)">-${amp}</text>
      </svg>`;
      code = `-- Script: a coin that floats up and down forever\nlocal RunService = game:GetService("RunService")\nlocal startY = coin.Position.Y\nlocal height, speed = ${f(amp)}, ${f(speed * 2)}\nlocal t = 0\n\nRunService.Heartbeat:Connect(function(dt)\n\tt += dt\n\tlocal offset = math.sin(t * speed) * height -- goes -${f(amp)} .. +${f(amp)}\n\tcoin.Position = Vector3.new(coin.Position.X, startY + offset, coin.Position.Z)\nend)`;
      side = html`
        <${Seg} label="Mode" value=${mode} onChange=${setMode} options=${[["circle", "sin & cos"], ["orbit", "Orbit"], ["wave", "Bobbing wave"], ["atan2", "atan2 aim"]]} />
        <p class="lab-say">math.sin of a growing time number smoothly goes up to 1, down to -1, and back. Multiply it by a height and add it to a position: instant floating animation.</p>
        <${Slider} id="tr-amp" label="Height" value=${amp} min=${0.5} max=${6} step=${0.5} onInput=${setAmp} unit=" studs" />
        <${Slider} id="tr-sp2" label="Speed" value=${speed} min=${0.2} max=${3} step=${0.1} onInput=${setSpeed} />
        <${Readout} rows=${[["math.sin(t × speed)", f(Math.sin(t * speed * 2), 3)], ["offset", f(y, 2) + " studs", "ax-y"]]} />
        <${Code} code=${code} />`;
    } else {
      const ang = Math.atan2(pt[1], pt[0]);
      const px = cx + (pt[0] / 4) * R, py = cy - (pt[1] / 4) * R;
      stage = html`<svg ref=${svgRef} viewBox="0 0 ${W} ${H}" onPointerMove=${onMove} onPointerUp=${() => (drag.current = false)} onPointerLeave=${() => (drag.current = false)} style="touch-action:none" role="img" aria-label="A turret aiming at a draggable target using atan2">
        <line x1="20" x2="360" y1=${cy} y2=${cy} stroke="var(--line)" /><line x1=${cx} x2=${cx} y1="30" y2="370" stroke="var(--line)" />
        <path d="M${cx + 40},${cy} A40,40 0 ${ang < 0 ? 1 : 0} 0 ${cx + Math.cos(ang) * 40},${cy - Math.sin(ang) * 40}" fill="none" stroke="var(--accent)" stroke-width="2" />
        <g transform=${`rotate(${(-ang * 180) / Math.PI} ${cx} ${cy})`}><rect x=${cx - 18} y=${cy - 18} width="36" height="36" rx="8" fill="var(--z)" /><rect x=${cx} y=${cy - 5} width="56" height="10" rx="3" fill="var(--ink)" /></g>
        <line x1=${cx} y1=${cy} x2=${px} y2=${py} stroke="var(--accent)" stroke-dasharray="4 4" />
        <line x1=${px} y1=${cy} x2=${px} y2=${py} stroke="var(--y)" stroke-width="2" stroke-dasharray="2 3" />
        <text x=${px + 6} y=${(cy + py) / 2} font-size="12" fill="var(--y)" font-weight="700">y = ${pt[1]}</text>
        <text x=${(cx + px) / 2} y=${cy + 16} font-size="12" fill="var(--x)" font-weight="700" text-anchor="middle">x = ${pt[0]}</text>
        <circle cx=${px} cy=${py} r="13" fill="var(--bad)" style="cursor:grab" onPointerDown=${(e) => { drag.current = true; e.preventDefault(); }} />
        <text x=${px} y=${py - 18} text-anchor="middle" font-size="11" font-weight="700" fill="var(--bad)">drag me</text>
      </svg>`;
      code = `-- Which way should the turret point to face the target?\nlocal dx = target.X - turret.X   -- ${pt[0]}\nlocal dy = target.Y - turret.Y   -- ${pt[1]}\nlocal angle = math.atan2(dy, dx) -- ${f(ang, 3)} radians\nprint(math.deg(angle))           --> ${f((ang * 180) / Math.PI, 1)}°\n\n-- In 3D you usually skip the math:\nturret.CFrame = CFrame.lookAt(turret.Position, target.Position)`;
      side = html`
        <${Seg} label="Mode" value=${mode} onChange=${setMode} options=${[["circle", "sin & cos"], ["orbit", "Orbit"], ["wave", "Bobbing wave"], ["atan2", "atan2 aim"]]} />
        <p class="lab-say">atan2 is the reverse of sin and cos: give it how far right (x) and how far up (y) something is, and it tells you the ANGLE to it. Put y first: math.atan2(y, x).</p>
        <${Readout} rows=${[["target offset", `${pt[0]}, ${pt[1]}`], ["math.atan2(y, x)", f(ang, 3) + " rad", "ax-z"], ["in degrees", f((ang * 180) / Math.PI, 1) + "°"]]} />
        <${Code} code=${code} />`;
    }
    return html`<${Lab} title="Trigonometry playground" hint="sin, cos and atan2: the math behind circles, waves and aiming." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     Math library lab
     ========================================================= */
  function noise1(x, seed) {
    // smooth value noise: similar SHAPE to math.noise (exact numbers differ)
    const h = (i) => { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
    const i = Math.floor(x), fr = x - i, u = fr * fr * (3 - 2 * fr);
    return (h(i) * (1 - u) + h(i + 1) * u) * 0.7;
  }
  BB.MathLab = function () {
    const [tab, setTab] = useState("clamp");
    const [v, setV] = useState(14);
    const [lo, setLo] = useState(0);
    const [hi, setHi] = useState(10);
    const [alpha, setAlpha] = useState(0.3);
    const [num, setNum] = useState(2.6);
    const [scale, setScale] = useState(0.15);
    const [seed, setSeed] = useState(1);
    const [amp, setAmp] = useState(20);
    const [rolls, setRolls] = useState([]);
    const [rolling, setRolling] = useState(false);
    useEffect(() => {
      if (!rolling) return;
      let n = 0;
      const iv = setInterval(() => {
        setRolls((r) => [...r, 1 + Math.floor(Math.random() * 6)].slice(-600));
        if (++n >= 120) { clearInterval(iv); setRolling(false); }
      }, 16);
      return () => clearInterval(iv);
    }, [rolling]);
    const W = 560, H = 360;
    const X0 = 40, X1 = 520, toX = (n, a = -5, b = 20) => X0 + ((n - a) / (b - a)) * (X1 - X0);
    const ticks = (a, b, step, y) => {
      const out = [];
      for (let n = a; n <= b; n += step) out.push(html`<g><line x1=${toX(n, a, b)} x2=${toX(n, a, b)} y1=${y - 6} y2=${y + 6} stroke="var(--muted)" /><text x=${toX(n, a, b)} y=${y + 22} font-size="11" text-anchor="middle" fill="var(--muted)">${n}</text></g>`);
      return out;
    };
    let stage, side;
    const tabs = html`<${Seg} label="Function" value=${tab} onChange=${setTab} options=${[["clamp", "clamp"], ["lerp", "lerp"], ["round", "floor / ceil / round"], ["random", "random"], ["noise", "noise"]]} />`;
    if (tab === "clamp") {
      const r = Math.max(lo, Math.min(hi, v));
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="math.clamp on a number line">
        <line x1=${X0} x2=${X1} y1="180" y2="180" stroke="var(--muted)" stroke-width="2" />${ticks(-5, 20, 5, 180)}
        <rect x=${toX(lo)} y="168" width=${Math.max(0, toX(hi) - toX(lo))} height="24" rx="6" fill="var(--y)" opacity=".25" />
        <text x=${(toX(lo) + toX(hi)) / 2} y="160" text-anchor="middle" font-size="12" fill="var(--y)" font-weight="700">allowed: ${lo} to ${hi}</text>
        <circle cx=${toX(v)} cy="120" r="9" fill="var(--muted)" /><text x=${toX(v)} y="100" text-anchor="middle" font-size="12" fill="var(--muted)">value ${v}</text>
        ${r !== v && html`<${Arrow} a=${[toX(v), 130]} b=${[toX(r), 172]} color="var(--accent)" width="2.5" />`}
        <circle cx=${toX(r)} cy="180" r="10" fill="var(--accent)" /><text x=${toX(r)} y="236" text-anchor="middle" font-size="13" fill="var(--accent)" font-weight="700">result ${f(r)}</text>
      </svg>`;
      side = html`${tabs}<p class="lab-say">math.clamp(value, min, max) keeps a number inside a range. Too big? You get max. Too small? You get min. Perfect for health, speed and zoom.</p>
        <${Slider} id="m-v" label="value" value=${v} min=${-5} max=${20} step=${0.5} onInput=${setV} />
        <${Slider} id="m-lo" label="min" value=${lo} min=${-5} max=${10} step=${1} onInput=${setLo} />
        <${Slider} id="m-hi" label="max" value=${hi} min=${0} max=${20} step=${1} onInput=${setHi} />
        <${Code} code=${`print(math.clamp(${v}, ${lo}, ${hi})) --> ${f(r)}\n\n-- typical use: health can't go below 0 or above 100\nhumanoid.Health = math.clamp(humanoid.Health + 25, 0, humanoid.MaxHealth)`} />`;
    } else if (tab === "lerp") {
      const a = 0, b = 20, r = a + (b - a) * alpha;
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Linear interpolation between two numbers">
        <line x1=${toX(0)} x2=${toX(20)} y1="180" y2="180" stroke="var(--muted)" stroke-width="2" />${ticks(-5, 20, 5, 180)}
        <circle cx=${toX(a)} cy="180" r="9" fill="var(--x)" /><text x=${toX(a)} y="150" text-anchor="middle" font-size="12" fill="var(--x)" font-weight="700">a = 0</text>
        <circle cx=${toX(b)} cy="180" r="9" fill="var(--y)" /><text x=${toX(b)} y="150" text-anchor="middle" font-size="12" fill="var(--y)" font-weight="700">b = 20</text>
        <rect x=${toX(a)} y="174" width=${toX(r) - toX(a)} height="12" rx="6" fill="var(--accent)" opacity=".5" />
        <circle cx=${toX(r)} cy="180" r="11" fill="var(--accent)" /><text x=${toX(r)} y="236" text-anchor="middle" font-size="13" font-weight="700" fill="var(--accent)">${f(r)}</text>
        <text x="40" y="300" font-size="12" fill="var(--muted)">alpha ${f(alpha)} = ${f(alpha * 100, 0)}% of the way from a to b</text>
      </svg>`;
      side = html`${tabs}<p class="lab-say">math.lerp(a, b, alpha) gives the number that is alpha of the way from a to b. 0 = a, 1 = b, 0.5 = middle. Doing it every frame with a small alpha makes smooth "catch up" motion.</p>
        <${Slider} id="m-al" label="alpha" value=${alpha} min=${0} max=${1} step=${0.05} onInput=${setAlpha} />
        <${Code} code=${`print(math.lerp(0, 20, ${f(alpha)})) --> ${f(r)}\n\n-- smooth camera zoom: move 10% closer to the goal each frame\nzoom = math.lerp(zoom, goalZoom, 0.1)`} />`;
    } else if (tab === "round") {
      const fl = Math.floor(num), ce = Math.ceil(num), ro = Math.round(num);
      const a = -4, b = 4, X = (n) => toX(n, a, b);
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="floor, ceil and round on a number line">
        <line x1=${X0} x2=${X1} y1="180" y2="180" stroke="var(--muted)" stroke-width="2" />${ticks(a, b, 1, 180)}
        <circle cx=${X(num)} cy="180" r="9" fill="var(--ink)" /><text x=${X(num)} y="160" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${num}</text>
        <${Arrow} a=${[X(num), 196]} b=${[X(fl), 250]} color="var(--x)" width="2" /><text x=${X(fl)} y="268" text-anchor="middle" font-size="12" font-weight="700" fill="var(--x)">floor ${fl}</text>
        <${Arrow} a=${[X(num), 164]} b=${[X(ce), 110]} color="var(--y)" width="2" /><text x=${X(ce)} y="100" text-anchor="middle" font-size="12" font-weight="700" fill="var(--y)">ceil ${ce}</text>
        <circle cx=${X(ro)} cy="180" r="6" fill="var(--accent)" /><text x=${X(ro)} y="310" text-anchor="middle" font-size="12" font-weight="700" fill="var(--accent)">round ${ro}</text>
      </svg>`;
      side = html`${tabs}<p class="lab-say">floor always goes DOWN to a whole number, ceil always goes UP, round goes to the NEAREST one (.5 goes up). Watch negative numbers: floor(-2.5) is -3!</p>
        <${Slider} id="m-num" label="number" value=${num} min=${-4} max=${4} step=${0.1} onInput=${setNum} />
        <${Code} code=${`print(math.floor(${num})) --> ${fl}\nprint(math.ceil(${num}))  --> ${ce}\nprint(math.round(${num})) --> ${ro}\n\n-- snap a position to a 4-stud grid\nlocal snapped = math.round(x / 4) * 4`} />`;
    } else if (tab === "random") {
      const counts = [0, 0, 0, 0, 0, 0];
      rolls.forEach((r) => counts[r - 1]++);
      const max = Math.max(1, ...counts);
      const last = rolls[rolls.length - 1];
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram of random dice rolls">
        ${counts.map((c, i) => html`<g><rect x=${70 + i * 75} y=${300 - (c / max) * 220} width="50" height=${(c / max) * 220} rx="6" fill=${last === i + 1 ? "var(--accent)" : "var(--z)"} /><text x=${95 + i * 75} y="322" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">${i + 1}</text><text x=${95 + i * 75} y=${292 - (c / max) * 220} text-anchor="middle" font-size="11" fill="var(--muted)">${c}</text></g>`)}
        <text x="70" y="40" font-size="12" fill="var(--muted)">${rolls.length} rolls of math.random(1, 6)</text>
      </svg>`;
      side = html`${tabs}<p class="lab-say">math.random(1, 6) picks a whole number from 1 to 6, each equally likely. Roll a lot and the bars even out. math.random() with nothing gives a decimal from 0 to 1.</p>
        <div class="btnrow"><button class="btn primary" type="button" onClick=${() => setRolling(true)}>Roll 120 times</button><button class="btn" type="button" onClick=${() => setRolls([])}>Clear</button></div>
        <${Readout} rows=${[["last roll", last ? String(last) : "–", "ax-z"]]} />
        <${Code} code=${`print(math.random(1, 6))  -- a dice roll\nprint(math.random())      -- like 0.4821\n\n-- pick a random item from a list\nlocal colors = { "Red", "Blue", "Green" }\nprint(colors[math.random(1, #colors)])\n\n-- Random.new gives you your own generator\nlocal rng = Random.new()\nprint(rng:NextNumber(5, 10)) -- decimal between 5 and 10`} />`;
    } else {
      const ptsN = [];
      for (let i = 0; i <= 200; i++) ptsN.push([30 + i * 2.5, 200 - noise1(i * scale, seed) * amp * 6]);
      const ptsR = [];
      for (let i = 0; i <= 200; i += 4) ptsR.push([30 + i * 2.5, 300 - (Math.sin(i * 12.9898 + seed) * 43758.5453 % 1) * amp * 2]);
      stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Noise makes smooth hills, random makes spikes">
        <path d=${"M30,360 L" + ptsN.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + " L530,360 Z"} fill="var(--y)" opacity=".35" />
        <polyline points=${ptsN.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} fill="none" stroke="var(--y)" stroke-width="2.5" />
        <text x="34" y="40" font-size="12" fill="var(--y)" font-weight="700">math.noise → smooth hills</text>
        <polyline points=${ptsR.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} fill="none" stroke="var(--bad)" stroke-width="1.5" opacity=".7" />
        <text x="34" y="340" font-size="12" fill="var(--bad)" font-weight="700">math.random → spiky mess</text>
      </svg>`;
      side = html`${tabs}<p class="lab-say">math.noise(x) gives "random" numbers that change SMOOTHLY: close x values give close answers. That makes natural hills, wobbles and clouds. Smaller scale = wider, gentler hills. (Shape shown is like math.noise; Roblox's exact numbers differ.)</p>
        <${Slider} id="m-sc" label="scale" value=${scale} min=${0.03} max=${0.6} step=${0.01} onInput=${setScale} />
        <${Slider} id="m-amp" label="height" value=${amp} min=${2} max=${30} step=${1} onInput=${setAmp} />
        <${Slider} id="m-seed" label="seed" value=${seed} min=${1} max=${20} step=${1} onInput=${setSeed} />
        <${Code} code=${`-- Script: build a hilly line of parts with noise\nlocal seed = ${seed}\nfor x = 0, 100 do\n\tlocal h = math.noise(x * ${f(scale)}, seed) * ${amp} -- about -${amp}..${amp}\n\tlocal part = Instance.new("Part")\n\tpart.Anchored = true\n\tpart.Size = Vector3.new(1, 1, 4)\n\tpart.Position = Vector3.new(x, h + 20, 0)\n\tpart.Parent = workspace\nend`} />`;
    }
    return html`<${Lab} title="math library playground" hint="The math functions you'll use the most, on a number line." stage=${stage} side=${side} />`;
  };

  /* =========================================================
     3D vector lab: add, Cross (right-hand rule), Dot + projection
     ========================================================= */
  BB.Vector3DLab = function () {
    const [A, setA] = useState({ x: 5, y: 0, z: 0 });
    const [B, setB] = useState({ x: 2, y: 0, z: -5 });
    const [op, setOp] = useState("cross");
    const [spin, setSpin] = useState(true);
    const [t] = BB.useClock(spin);
    const b = spin ? (() => { const a = t * 0.7, r = Math.hypot(B.x, B.z) || 5; return V(Math.cos(a) * r, B.y, -Math.sin(a) * r); })() : V(B.x, B.y, B.z);
    const a = V(A.x, A.y, A.z);
    const W = 560, H = 420;
    const proj = camera(-0.75, 0.45, 20, W / 2, H * 0.58);
    const O = proj(V(0, 0, 0));
    const grid = [];
    for (let i = -8; i <= 8; i += 2) { grid.push([proj(V(i, 0, -8)), proj(V(i, 0, 8))]); grid.push([proj(V(-8, 0, i)), proj(V(8, 0, i))]); }
    const c = cross(a, b), d = dot(a, b);
    const proj_b_on_a = len(a) ? mul(a, d / (len(a) ** 2)) : V(0, 0, 0);
    const lbl = (p, txt, col) => { const s = proj(p); return html`<text x=${s[0] + 8} y=${s[1] - 6} font-size="13" font-weight="700" fill=${col}>${txt}</text>`; };
    let extra = null, rows, say, code;
    const v3 = (v) => `${f(v.x)}, ${f(v.y)}, ${f(v.z)}`;
    if (op === "cross") {
      const cs = mul(c, 1 / 6);
      extra = html`<${Arrow} a=${O} b=${proj(cs)} color="var(--accent)" width="4" />${lbl(cs, "A:Cross(B) ÷ 6", "var(--accent)")}
        <polygon points=${pts([O, proj(a), proj(add(a, b)), proj(b)])} fill="var(--accent)" opacity=".12" />`;
      rows = [["A:Cross(B)", v3(c), "ax-z"], ["length", f(len(c)) + " (= area of the shaded shape)"]];
      say = "Cross gives a NEW arrow sticking straight out from both A and B (at 90° to each). Point your right hand's fingers along A, curl them toward B: your thumb is the cross product. Watch it flip when B passes A.";
      code = `local a = Vector3.new(${f(a.x)}, ${f(a.y)}, ${f(a.z)})\nlocal b = Vector3.new(${f(b.x)}, ${f(b.y)}, ${f(b.z)})\nprint(a:Cross(b)) --> ${v3(c)}\n\n-- use: find "up" from a surface's two edges,\n-- or which side a turn is on (y > 0 = left, y < 0 = right)`;
    } else if (op === "add") {
      const s = add(a, b);
      extra = html`<${Arrow} a=${proj(a)} b=${proj(s)} color="var(--y)" width="2" dash="5 4" /><${Arrow} a=${O} b=${proj(s)} color="var(--accent)" width="4" />${lbl(s, "A + B", "var(--accent)")}`;
      rows = [["A + B", v3(s), "ax-z"], ["(A + B).Magnitude", f(len(s))]];
      say = "In 3D it's the same as 2D: walk A, then walk B. Add X+X, Y+Y, Z+Z.";
      code = `print(Vector3.new(${f(a.x)}, ${f(a.y)}, ${f(a.z)}) + Vector3.new(${f(b.x)}, ${f(b.y)}, ${f(b.z)}))\n--> ${v3(s)}`;
    } else {
      extra = html`<line x1=${proj(b)[0]} y1=${proj(b)[1]} x2=${proj(proj_b_on_a)[0]} y2=${proj(proj_b_on_a)[1]} stroke="var(--muted)" stroke-dasharray="3 4" />
        <${Arrow} a=${O} b=${proj(proj_b_on_a)} color="var(--accent)" width="5" />${lbl(proj_b_on_a, "shadow of B on A", "var(--accent)")}`;
      const cosang = len(a) && len(b) ? d / (len(a) * len(b)) : 0;
      rows = [["A:Dot(B)", f(d), "ax-z"], ["A.Unit:Dot(B.Unit)", f(cosang, 3)], ["angle", f((Math.acos(Math.max(-1, Math.min(1, cosang))) * 180) / Math.PI, 1) + "°"]];
      say = "Dot measures how much B goes ALONG A. The orange arrow is B's \"shadow\" on A. When B is sideways the shadow vanishes (dot = 0). When B points backwards, the shadow flips (dot < 0).";
      code = `local a = Vector3.new(${f(a.x)}, ${f(a.y)}, ${f(a.z)})\nlocal b = Vector3.new(${f(b.x)}, ${f(b.y)}, ${f(b.z)})\nprint(a:Dot(b)) --> ${f(d)}\n\n-- the shadow (projection) of b on a:\nlocal shadow = a.Unit * b:Dot(a.Unit) --> ${v3(proj_b_on_a)}`;
    }
    const stage = html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Two 3D arrows A and B with their cross product">
      ${grid.map(([p, q]) => html`<line x1=${p[0]} y1=${p[1]} x2=${q[0]} y2=${q[1]} stroke="var(--line)" />`)}
      <${Arrow} a=${O} b=${proj(V(3, 0, 0))} color="var(--x)" width="1.5" /><${Arrow} a=${O} b=${proj(V(0, 3, 0))} color="var(--y)" width="1.5" /><${Arrow} a=${O} b=${proj(V(0, 0, 3))} color="var(--z)" width="1.5" />
      ${extra}
      <${Arrow} a=${O} b=${proj(a)} color="var(--x)" width="4" />${lbl(a, "A", "var(--x)")}
      <${Arrow} a=${O} b=${proj(b)} color="var(--z)" width="4" />${lbl(b, "B", "var(--z)")}
    </svg>`;
    const side = html`
      <${Seg} label="Operation" value=${op} onChange=${setOp} options=${[["cross", "Cross"], ["dot", "Dot / shadow"], ["add", "Add"]]} />
      <label class="place"><input type="checkbox" checked=${spin} onChange=${(e) => setSpin(e.currentTarget.checked)} /> Spin B around (animate)</label>
      <p class="lab-say">${say}</p>
      <${Slider} id="v3-ax" label="A.X" cls="ax-x" value=${A.x} min=${-6} max=${6} step=${1} onInput=${(v) => setA({ ...A, x: v })} />
      <${Slider} id="v3-ay" label="A.Y" cls="ax-y" value=${A.y} min=${-6} max=${6} step=${1} onInput=${(v) => setA({ ...A, y: v })} />
      <${Slider} id="v3-az" label="A.Z" cls="ax-z" value=${A.z} min=${-6} max=${6} step=${1} onInput=${(v) => setA({ ...A, z: v })} />
      ${!spin && html`<${Slider} id="v3-bx" label="B.X" cls="ax-x" value=${B.x} min=${-6} max=${6} step=${1} onInput=${(v) => setB({ ...B, x: v })} />
        <${Slider} id="v3-by" label="B.Y" cls="ax-y" value=${B.y} min=${-6} max=${6} step=${1} onInput=${(v) => setB({ ...B, y: v })} />
        <${Slider} id="v3-bz" label="B.Z" cls="ax-z" value=${B.z} min=${-6} max=${6} step=${1} onInput=${(v) => setB({ ...B, z: v })} />`}
      <${Readout} rows=${rows} />
      <${Code} code=${code} />`;
    return html`<${Lab} title="3D vector playground" hint="A is red, B is blue. Untick spin to drive B yourself." stage=${stage} side=${side} />`;
  };
})();

/* Replication lab: one wheel, one server, three players.
   Question it answers: "Player A spins a wheel. How do I make EVERYONE see it?" */
(function () {
  const BB = window.BB;
  const { html, useState, useEffect, useRef } = window.htmPreact;
  const { V, cf, cfMul, angles, camera } = BB.m3;
  const f = BB.fmt;
  const SPIN = 6; // radians per second

  const PANELS = { S: [320, 92, "Roblox server"], A: [108, 318, "Player A (you)"], B: [320, 318, "Player B"], C: [532, 318, "Player C"] };

  const SCEN = {
    server: {
      label: "Server spins it", button: null,
      say: "A Script on the SERVER turns on the wheel's motor. The server runs the physics and sends the wheel's angle to every player many times a second. That's replication: it happens by itself. Everyone sees it, a little late (their ping).",
      files: [["Script in ServerScriptService", `local hinge = workspace.Car.WheelHinge -- a HingeConstraint\nhinge.ActuatorType = Enum.ActuatorType.Motor\nhinge.MotorMaxTorque = math.huge\nhinge.AngularVelocity = 6 -- spin!\n-- Nothing else to do: the server owns the wheel,\n-- so Roblox sends its movement to every player.`]],
    },
    local: {
      label: "Problem: LocalScript only", button: "Player A presses E",
      say: "A LocalScript on Player A's device spins the wheel. ONLY Player A sees it. The server and the other players still have a still wheel, because changes made by a LocalScript stay on that device. (Even worse: if it's a physics wheel the server runs, a LocalScript changing its motor won't move it at all, because the server's physics wins.) This is the problem the 3 fixes solve.",
      files: [["LocalScript in StarterPlayerScripts (the WRONG way)", `local UIS = game:GetService("UserInputService")\nlocal RunService = game:GetService("RunService")\nlocal wheel = workspace.Car.Wheel\nlocal spinning = false\n\nUIS.InputBegan:Connect(function(input, typing)\n\tif not typing and input.KeyCode == Enum.KeyCode.E then\n\t\tspinning = true\n\tend\nend)\n\nRunService.RenderStepped:Connect(function(dt)\n\tif spinning then\n\t\t-- this only moves YOUR copy of the wheel!\n\t\twheel.CFrame = wheel.CFrame * CFrame.Angles(6 * dt, 0, 0)\n\tend\nend)`]],
    },
    remote: {
      label: "Fix 1: ask the server", button: "Player A presses E",
      say: "Player A's LocalScript sends a RemoteEvent: \"please spin\". The server checks it's allowed, then spins the wheel itself. Since the SERVER changed it, it replicates to everyone. Downside: Player A waits a full round trip (to the server and back) before seeing it.",
      files: [
        ["Setup: a RemoteEvent named SpinWheel in ReplicatedStorage", `-- In Studio: ReplicatedStorage > + > RemoteEvent, rename it SpinWheel`],
        ["LocalScript in StarterPlayerScripts", `local UIS = game:GetService("UserInputService")\nlocal spinWheel = game.ReplicatedStorage:WaitForChild("SpinWheel")\n\nUIS.InputBegan:Connect(function(input, typing)\n\tif typing then return end\n\tif input.KeyCode == Enum.KeyCode.E then\n\t\tspinWheel:FireServer() -- message 1: A -> server\n\tend\nend)`],
        ["Script in ServerScriptService", `local spinWheel = game.ReplicatedStorage.SpinWheel\nlocal hinge = workspace.Car.WheelHinge\n\nspinWheel.OnServerEvent:Connect(function(player)\n\t-- never trust the client: check this player may do it\n\tlocal char = player.Character\n\tif not char then return end\n\tlocal dist = (char:GetPivot().Position - workspace.Car:GetPivot().Position).Magnitude\n\tif dist > 20 then return end -- too far from the car\n\n\thinge.AngularVelocity = 6 -- the SERVER changes it -> everyone sees it\nend)`],
      ],
    },
    owner: {
      label: "Fix 2: the player owns the car", button: "Player A presses E",
      say: "Player A is the NETWORK OWNER of the car, so A's DEVICE runs its physics, not the server. A's LocalScript turns on the motor and A sees it instantly. A's device sends the wheel's movement (its position and rotation) to the server. The server does NOT simulate it: it just passes the movement on to B and C. That's two trips, so they see it a bit later. This is how driving games feel smooth for the driver.",
      gotcha: "Only the RESULT is sent (where the wheel is and how it's turned), not the property. The server's HingeConstraint still says AngularVelocity = 0. If ownership goes back to the server (the driver leaves, or you call SetNetworkOwner(nil)), the server's physics takes over with AngularVelocity = 0 and the wheel stops. Roblox can also hand ownership of unanchored parts near a player to that player automatically, and a VehicleSeat gives the car to whoever sits in it. Call SetNetworkOwner yourself when you need to be sure.",
      files: [
        ["Script in ServerScriptService", `local car = workspace.Car\nlocal seat = car.DriverSeat\n\nseat:GetPropertyChangedSignal("Occupant"):Connect(function()\n\tlocal humanoid = seat.Occupant\n\tlocal player = humanoid and game.Players:GetPlayerFromCharacter(humanoid.Parent)\n\t-- the driver's device now runs this car's physics\n\t-- (nil = give it back to the server)\n\tcar.PrimaryPart:SetNetworkOwner(player)\nend)`],
        ["LocalScript in StarterPlayerScripts", `local UIS = game:GetService("UserInputService")\nlocal hinge = workspace.Car.WheelHinge\n\nUIS.InputBegan:Connect(function(input, typing)\n\tif typing then return end\n\tif input.KeyCode == Enum.KeyCode.E then\n\t\t-- works for everyone ONLY because this player owns\n\t\t-- the car: the PHYSICS result (the wheel turning) is\n\t\t-- what gets sent, not the property change.\n\t\thinge.AngularVelocity = 6\n\tend\nend)`],
      ],
    },
    fanout: {
      label: "Fix 3: tell every player (FireAllClients)", button: "Player A presses E",
      say: "For a wheel that's just for looks (no physics, like a spinning sign), you don't need the server to spin anything. A tells the server, the server tells ALL players with FireAllClients, and each device spins its OWN copy. Super smooth and cheap. Notice the server's wheel never moves: it only passed the message along.",
      files: [
        ["LocalScript in StarterPlayerScripts", `local UIS = game:GetService("UserInputService")\nlocal RunService = game:GetService("RunService")\nlocal spinWheel = game.ReplicatedStorage:WaitForChild("SpinWheel")\nlocal wheel = workspace.Sign.Wheel -- Anchored, just decoration\nlocal spinning = false\n\n-- every player runs this when the server says "spin"\nspinWheel.OnClientEvent:Connect(function()\n\tspinning = true\nend)\n\nRunService.RenderStepped:Connect(function(dt)\n\tif spinning then\n\t\twheel.CFrame = wheel.CFrame * CFrame.Angles(6 * dt, 0, 0)\n\tend\nend)\n\nUIS.InputBegan:Connect(function(input, typing)\n\tif not typing and input.KeyCode == Enum.KeyCode.E then\n\t\tspinning = true          -- start right away for me\n\t\tspinWheel:FireServer()   -- and tell everyone else\n\tend\nend)`],
        ["Script in ServerScriptService", `local spinWheel = game.ReplicatedStorage.SpinWheel\n\nspinWheel.OnServerEvent:Connect(function(player)\n\t-- (check it's allowed here)\n\tspinWheel:FireAllClients() -- pass it to EVERY player\nend)`],
      ],
    },
  };

  const PICK = [
    ["Fix 1: ask the server", "Important things (doors, damage, anything people could cheat with). The server is the boss.", "Player A waits for a round trip before it moves."],
    ["Fix 2: network ownership", "Things a player controls with physics: cars, boats, their own character.", "The owner's device decides the physics, so cheaters could fake it. Check speeds on the server."],
    ["Fix 3: FireAllClients", "Pure looks: effects, decorations, emotes, sounds. No physics.", "Each player's copy is a little out of sync. Players who join later don't know unless you also save it (e.g. an Attribute)."],
  ];

  BB.ReplicationLab = function ({ start = "server" } = {}) {
    const [scen, setScen] = useState(start);
    const [lat, setLat] = useState({ A: 80, B: 160, C: 300 });
    const [rate, setRate] = useState(20);
    const [interp, setInterp] = useState(true);
    const [, setFrame] = useState(0);
    const st = useRef(null);
    const fresh = (sc) => ({ t: 0, truth: 0, ang: { S: 0, A: 0, B: 0, C: 0 }, motor: sc === "server", local: { S: false, A: false, B: false, C: false }, snaps: {}, packets: [], nextSend: 0, log: [] });
    if (!st.current) st.current = fresh(scen);
    useEffect(() => { setScen(start); }, [start]);
    const reset = () => { st.current = fresh(scen); };
    useEffect(() => { st.current = fresh(scen); }, [scen]);
    const cfgRef = useRef(); cfgRef.current = { scen, lat, rate, interp };
    const root = useRef();
    const [vis, setVis] = useState(true);
    useEffect(() => {
      if (!root.current || !window.IntersectionObserver) return;
      const io = new IntersectionObserver((es) => setVis(es[0].isIntersecting));
      io.observe(root.current);
      return () => io.disconnect();
    }, []);
    useEffect(() => {
      if (!vis) return;
      let raf, last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const s = st.current, c = cfgRef.current, L = (k) => c.lat[k] / 1000;
        s.t += dt;
        const owner = c.scen === "owner" ? "A" : "S";
        const physical = c.scen === "server" || c.scen === "remote" || c.scen === "owner";
        if (physical && s.motor) s.truth += SPIN * dt;
        // local-only spinning (LocalScript problem, or FireAllClients visuals)
        for (const k of ["S", "A", "B", "C"]) if (s.local[k]) s.ang[k] += SPIN * dt;
        // the simulating computer sends snapshots
        if (physical && s.t >= s.nextSend) {
          s.nextSend = s.t + 1 / c.rate;
          if (owner === "S") for (const k of ["A", "B", "C"]) s.packets.push({ from: "S", to: k, t0: s.t, t1: s.t + L(k), v: s.truth });
          else s.packets.push({ from: "A", to: "S", t0: s.t, t1: s.t + L("A"), v: s.truth, relay: true });
        }
        // deliver
        const keep = [];
        for (const p of s.packets) {
          if (s.t < p.t1) { keep.push(p); continue; }
          if (p.kind === "ask") { s.motor = true; s.log.push(`${s.t.toFixed(2)}s  server: got SpinWheel from A, checked it, motor ON`); }
          else if (p.kind === "tellAll") {
            s.log.push(`${s.t.toFixed(2)}s  server: FireAllClients()`);
            for (const k of ["A", "B", "C"]) s.packets.push({ from: "S", to: k, t0: s.t, t1: s.t + L(k), kind: "start" });
          } else if (p.kind === "start") { if (!s.local[p.to]) s.log.push(`${s.t.toFixed(2)}s  ${PANELS[p.to][2]}: OnClientEvent, start spinning my copy`); s.local[p.to] = true; }
          else {
            (s.snaps[p.to] = s.snaps[p.to] || []).push([p.t1, p.v]);
            if (p.relay) for (const k of ["B", "C"]) s.packets.push({ from: "S", to: k, t0: s.t, t1: s.t + L(k), v: p.v });
          }
        }
        s.packets = keep;
        // what each screen shows for physical scenarios
        if (physical) for (const k of ["S", "A", "B", "C"]) {
          if (k === owner) { s.ang[k] = s.truth; continue; }
          const list = s.snaps[k] || [];
          if (!list.length) continue;
          if (!c.interp) { s.ang[k] = list[list.length - 1][1]; continue; }
          const rt = s.t - 1 / c.rate;
          let i = list.length - 1;
          while (i > 0 && list[i - 1][0] > rt) i--;
          const a = list[Math.max(0, i - 1)], b = list[i];
          const k2 = b[0] === a[0] ? 1 : Math.max(0, Math.min(1, (rt - a[0]) / (b[0] - a[0])));
          s.ang[k] = a[1] + (b[1] - a[1]) * k2;
          if (list.length > 80) list.splice(0, list.length - 80);
        }
        setFrame((n) => n + 1);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [vis]);
    const s = st.current;
    const press = () => {
      const L = lat.A / 1000;
      if (scen === "local") { s.local.A = true; s.log.push(`${s.t.toFixed(2)}s  A: LocalScript sets AngularVelocity (only on A's device)`); }
      else if (scen === "remote") { s.packets.push({ from: "A", to: "S", t0: s.t, t1: s.t + L, kind: "ask" }); s.log.push(`${s.t.toFixed(2)}s  A: SpinWheel:FireServer()`); }
      else if (scen === "owner") { s.motor = true; s.log.push(`${s.t.toFixed(2)}s  A (network owner): motor ON, A's device runs the physics`); }
      else if (scen === "fanout") { s.local.A = true; s.packets.push({ from: "A", to: "S", t0: s.t, t1: s.t + L, kind: "tellAll" }); s.log.push(`${s.t.toFixed(2)}s  A: spin my copy now + FireServer()`); }
    };
    const wheel = (k) => {
      const [x, y, label] = PANELS[k];
      const proj = camera(-0.72, 0.42, 9, x, y + 22);
      const S = BB.Scene(proj);
      S.box(cf(V(-2.2, 2.4, 0)), V(3.2, 1, 2.4), [120, 128, 145]);
      S.cyl(cfMul(cf(V(0, 2.4, 0), angles(s.ang[k], 0, 0)), cf(V(0.4, 0, 0))), 2, 0.8, [70, 76, 92]);
      const runsPhysics = (scen === "owner" && k === "A") || ((scen === "server" || scen === "remote") && k === "S");
      const spinning = Math.abs(s.ang[k]) > 0.01;
      const deg = ((((s.ang[k] * 180) / Math.PI) % 360) + 360) % 360;
      const relay = scen === "owner" && k === "S";
      return html`<g><rect x=${x - 98} y=${y - 62} width="196" height="128" rx="12" fill="var(--surface)" stroke=${runsPhysics ? "var(--accent)" : "var(--line)"} stroke-width="2" stroke-dasharray=${relay ? "6 4" : ""} />
        ${relay && html`<text x=${x - 88} y=${y + 58} font-size="10.5" font-weight="800" fill="var(--muted)">COPY FROM A (no physics)</text>`}
        <text x=${x - 88} y=${y - 44} font-size="12" font-weight="700" fill="var(--ink)">${label}</text>
        ${k !== "S" && html`<text x=${x + 88} y=${y - 44} font-size="11" text-anchor="end" fill="var(--muted)">ping ${lat[k]}ms</text>`}
        ${runsPhysics && html`<text x=${x - 88} y=${y + 58} font-size="10.5" font-weight="800" fill="var(--accent)">PHYSICS RUNS HERE</text>`}
        <text x=${x + 88} y=${y + 58} font-size="10.5" text-anchor="end" font-weight="700" fill=${spinning ? "var(--ok)" : "var(--muted)"}>${spinning ? f(deg, 0) + "°" : "still"}</text>
        ${S.render(196, 128)}</g>`;
    };
    const pos = (p) => { const a = PANELS[p.from], b = PANELS[p.to], k = Math.max(0, Math.min(1, (s.t - p.t0) / (p.t1 - p.t0 || 1))); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
    const dotColor = (p) => (p.kind === "ask" || p.kind === "tellAll" ? "var(--accent)" : p.kind === "start" ? "var(--warn)" : p.from === "S" ? "var(--z)" : "var(--y)");
    const sc = SCEN[scen];
    const seen = ["A", "B", "C"].filter((k) => Math.abs(s.ang[k]) > 0.01).length;
    return html`<section class="lab" ref=${root}>
      <div class="lab-head"><h3>Replication: make EVERYONE see Player A's spinning wheel</h3><span class="hint">Every dot is a network message.</span></div>
      <div class="lab-body"><div class="lab-stage"><svg viewBox="0 0 640 400" role="img" aria-label="A server and three players each seeing a wheel">
        ${["A", "B", "C"].map((k) => html`<line x1=${PANELS.S[0]} y1=${PANELS.S[1] + 64} x2=${PANELS[k][0]} y2=${PANELS[k][1] - 62} stroke="var(--line)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" />`)}
        ${s.packets.map((p) => { const [x, y] = pos(p); return html`<circle cx=${x} cy=${y} r=${p.kind ? 7 : 3.5} fill=${dotColor(p)} />`; })}
        ${["S", "A", "B", "C"].map(wheel)}
      </svg></div>
      <div class="lab-side">
        <div class="seg" role="group" aria-label="Scenario">${Object.entries(SCEN).map(([k, v]) => html`<button type="button" class=${scen === k ? "on" : ""} aria-pressed=${scen === k} onClick=${() => setScen(k)}>${v.label}</button>`)}</div>
        <p class="lab-say">${sc.say}</p>
        ${sc.gotcha && html`<div class="callout"><h4>Watch out</h4><p style="margin:0">${sc.gotcha}</p></div>`}
        ${sc.button && html`<div class="btnrow"><button class="btn primary" type="button" onClick=${press}>${sc.button}</button><button class="btn" type="button" onClick=${reset}>Reset</button></div>`}
        <dl class="readout"><dt>players who see it spin</dt><dd class=${seen === 3 ? "ax-y" : seen ? "" : "ax-x"}>${seen} of 3</dd><dt>server's wheel</dt><dd>${Math.abs(s.ang.S) > 0.01 ? (scen === "owner" ? "moving (a copy of A's physics)" : "spinning") : "still"}</dd><dt>physics runs on</dt><dd class="ax-z">${scen === "owner" ? "Player A's device" : scen === "server" || scen === "remote" ? "the server" : "nobody (just visuals)"}</dd></dl>
        ${s.log.length > 0 && html`<div class="log" style="height:auto;max-height:120px">${s.log.slice(-5).map((l) => html`<div>${l}</div>`)}</div>`}
        <details class="official"><summary>Ping, update rate and smoothing</summary><div style="display:flex;flex-direction:column;gap:10px;padding-top:8px">
          ${["A", "B", "C"].map((k) => html`<div class="ctl"><label for=${"rl-" + k}>Ping ${k}</label><input id=${"rl-" + k} type="range" min="0" max="500" step="10" value=${lat[k]} onInput=${(e) => setLat({ ...lat, [k]: +e.currentTarget.value })} /><output>${lat[k]}ms</output></div>`)}
          <div class="ctl"><label for="rl-rate">Updates/s</label><input id="rl-rate" type="range" min="2" max="60" step="1" value=${rate} onInput=${(e) => setRate(+e.currentTarget.value)} /><output>${rate}</output></div>
          <label class="place"><input type="checkbox" checked=${interp} onChange=${(e) => setInterp(e.currentTarget.checked)} /> Smooth it (interpolation)</label>
          <p class="auto-note" style="margin:0">Set updates to 3/s and untick smoothing: the wheels jump. Roblox smooths between updates for you.</p></div></details>
      </div></div>
      <div class="lab-foot" style="grid-template-columns:minmax(0,1fr)">
        <div style="min-width:0;display:flex;flex-direction:column;gap:12px"><h4>The code for "${sc.label}"</h4>
          ${sc.files.map(([where, code]) => html`<div class="ex"><span class="place">Put it in: <b>${where}</b></span><${BB.Code} code=${code} /></div>`)}</div>
        <div><h4>Which fix should I use?</h4><div class="tablewrap"><table class="params"><thead><tr><th>Fix</th><th>Use it for</th><th>Watch out</th></tr></thead>
          <tbody>${PICK.map(([a, b, c]) => html`<tr><td><b>${a}</b></td><td>${b}</td><td>${c}</td></tr>`)}</tbody></table></div></div>
      </div></section>`;
  };
})();

/* Shared helpers: Luau highlighting, plain-words type/tag explanations, starter-snippet generator. */
(function () {
  const BB = (window.BB = window.BB || {});

  /* ---------- Luau syntax highlighting ---------- */
  const KW = new Set("and break continue do else elseif end false for function if in local nil not or repeat return then true until while export type typeof".split(" "));
  const GL = new Set("game workspace script Instance Vector3 Vector2 CFrame Color3 UDim UDim2 Enum task math string table coroutine print warn error pcall xpcall pairs ipairs require tick os TweenInfo Ray RaycastParams OverlapParams BrickColor NumberRange NumberSequence ColorSequence Random DateTime tostring tonumber select next setmetatable getmetatable rawget rawset assert unpack buffer utf8 bit32 debug vector".split(" "));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const TOK = /(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`|\[(=*)\[[\s\S]*?\]\4\])|(\b0x[\da-fA-F_]+\b|\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_]\w*)(\s*\()?/g;
  BB.hl = function (code) {
    let out = "", last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(code))) {
      out += esc(code.slice(last, m.index));
      if (m[1]) out += `<span class="t-com">${esc(m[1])}</span>`;
      else if (m[3]) out += `<span class="t-str">${esc(m[3])}</span>`;
      else if (m[5]) out += `<span class="t-num">${m[5]}</span>`;
      else if (m[6]) {
        const w = m[6];
        if (KW.has(w)) out += `<span class="t-kw">${w}</span>`;
        else if (GL.has(w)) out += `<span class="t-g">${w}</span>`;
        else if (m[7]) out += `<span class="t-fn">${w}</span>`;
        else out += w;
        if (m[7]) out += esc(m[7]);
      }
      last = TOK.lastIndex;
    }
    return out + esc(code.slice(last));
  };
  BB.esc = esc;

  /* ---------- types in plain words ---------- */
  const T = {
    string: "Text, written in quotes. Example: \"Hello\".",
    boolean: "A yes/no switch: true or false.",
    bool: "A yes/no switch: true or false.",
    number: "Any number, like 5, -2 or 3.14.",
    float: "A number that can have a decimal point, like 0.5 or 12.75.",
    double: "A number that can have a decimal point (extra precise).",
    int: "A whole number with no decimal point, like 3 or -10.",
    int64: "A whole number that can be really, really big (used for things like UserIds).",
    "()": "Nothing. This gives nothing back.",
    void: "Nothing. This gives nothing back.",
    Tuple: "Several values at once, separated by commas. Like a function that returns 2 or 3 things.",
    Variant: "Could be any kind of value (a number, text, true/false, a part…).",
    Array: "A list in order: {\"a\", \"b\", \"c\"}. You get items with list[1], list[2]…",
    Dictionary: "A table with labels: {Coins = 10, Name = \"Bob\"}. You get items with data.Coins.",
    table: "A Luau table: a container that can hold a list or labeled values.",
    Instances: "A list of objects (Instances).",
    Function: "A function you hand over so Roblox can call it later.",
    function: "A function you hand over so Roblox can call it later.",
    Instance: "Any object in the game tree, like a Part, Model, Script or Folder.",
    Objects: "A list of objects.",
    Object: "An object.",
    thread: "A coroutine: a piece of code that can pause and continue later.",
    buffer: "A chunk of raw bytes, for advanced data packing.",
    vector: "A Luau vector (x, y, z numbers) — the fast built-in version of Vector3.",
    Content: "A link to a file on Roblox, like an image or sound (rbxassetid://123…).",
    ContentId: "A link to a file on Roblox, like \"rbxassetid://1234567\".",
    User: "A user's id number (their UserId).",
    Vector3: "A 3D point or arrow made of X, Y and Z numbers. Like (0, 10, 0) = 10 studs up.",
    Vector2: "A 2D point or arrow made of X and Y. Used a lot for screen positions.",
    CFrame: "A position AND a rotation together. Tells where something is and which way it faces.",
    Color3: "A color made of red, green and blue.",
    UDim2: "A UI size or position with Scale (percent of screen) + Offset (pixels) for X and Y.",
    UDim: "One Scale (percent) + Offset (pixels) pair.",
    BrickColor: "An old-style named color like \"Bright red\".",
    RBXScriptSignal: "An event you can :Connect() a function to.",
    RBXScriptConnection: "The link you get from :Connect(). Call :Disconnect() on it to stop listening.",
    Player: "A person in the game (the Player object in the Players service).",
    BasePart: "Any kind of part: Part, MeshPart, WedgePart, etc.",
    Model: "A group of parts and other objects.",
  };
  BB.typeInfo = function (t) {
    if (!t) return "";
    const base = String(t).replace(/\?$/, "").replace(/^Datatype\./, "");
    const nul = /\?$/.test(t) ? " The ? means it can also be nil (nothing)." : "";
    if (T[base]) return T[base] + nul;
    const m = base.match(/^(?:List|Array|Tuple)<(.+)>$/);
    if (m) return `A list of ${m[1]} values.` + nul;
    const e = BB.lookup && BB.lookup(base);
    if (e) {
      if (e.k === "enum") return `One choice from the ${base} list, like Enum.${base}.SomeOption.` + nul;
      return (e.s || "").replace(/`(?:Class|Datatype|Enum)\.([^`|]+)(?:\|([^`]+))?`/g, (_, a, b) => b || a).slice(0, 160) + nul;
    }
    return nul.trim();
  };
  BB.typeHref = function (t) {
    const base = String(t || "").replace(/\?$/, "").replace(/^Datatype\./, "").replace(/^(?:List|Array|Tuple)<(.+)>$/, "$1");
    const e = BB.lookup && BB.lookup(base);
    return e ? `#/${e.k}/${e.n}` : null;
  };

  /* ---------- tags & security in plain words ---------- */
  BB.tagInfo = {
    Yields: ["Waits", "yield", "This makes your script WAIT until Roblox finishes (for example, until the internet answers). The line after it won't run until it is done."],
    CanYield: ["May wait", "yield", "Sometimes this pauses your script until it's done."],
    ReadOnly: ["Read only", "ro", "You can look at this value, but you can't change it from a script."],
    NotReplicated: ["Not synced", "", "Changes to this are NOT copied between server and players. Each side keeps its own value."],
    NotCreatable: ["Can't Instance.new", "", "You can't make this with Instance.new(). Roblox makes it for you."],
    Service: ["Service", "", "A built-in helper. Get it with game:GetService(\"Name\"). There is only one of it."],
    Hidden: ["Hidden", "", "Doesn't show in Studio's Properties window."],
    NotScriptable: ["Not for scripts", "sec", "Scripts can't use this. It's only changed in Studio."],
    Deprecated: ["Old", "dep", "Old and replaced by something better. It may still work, but don't use it in new code."],
    CustomLuaState: ["Special", "", "Runs in a special way inside Roblox; most scripters can ignore this."],
    NotBrowsable: ["Hidden", "", "Doesn't show up in Studio's object browser."],
    PlayerReplicated: ["Player-synced", "", "Synced from a player's device to the server."],
  };
  BB.secInfo = {
    PluginSecurity: "Only Studio plugins (and the command bar) can use this. Normal game scripts can't.",
    RobloxScriptSecurity: "Only Roblox's own built-in scripts can use this. Your scripts can't.",
    RobloxEngineSecurity: "Only the Roblox engine itself can use this. Your scripts can't.",
    NotAccessibleSecurity: "Nobody can use this from scripts.",
    LocalUserSecurity: "Only Roblox's internal code can use this.",
  };

  /* ---------- starter snippet generator (used when no hand-written example exists) ---------- */
  const SAMPLE = {
    boolean: "true", bool: "true", number: "10", float: "0.5", double: "0.5", int: "5", int64: "123456789",
    string: "\"Hello\"", Vector3: "Vector3.new(0, 10, 0)", Vector2: "Vector2.new(100, 50)", CFrame: "CFrame.new(0, 10, 0)",
    Color3: "Color3.fromRGB(255, 80, 40)", UDim2: "UDim2.fromScale(0.5, 0.5)", UDim: "UDim.new(0, 8)",
    BrickColor: "BrickColor.new(\"Bright red\")", ContentId: "\"rbxassetid://1234567\"", Content: "Content.fromUri(\"rbxassetid://1234567\")",
    Instance: "workspace.Baseplate", BasePart: "workspace.Baseplate", Player: "player", Dictionary: "{}", Array: "{}", table: "{}",
    Function: "function() end", function: "function() end", NumberRange: "NumberRange.new(1, 5)", User: "player.UserId",
    TweenInfo: "TweenInfo.new(1)", NumberSequence: "NumberSequence.new(1)", ColorSequence: "ColorSequence.new(Color3.new(1, 1, 1))",
    Model: "workspace.Model", Variant: "123", Tuple: "...", Ray: "Ray.new(Vector3.zero, Vector3.new(0, -10, 0))",
  };
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const VAR = { Workspace: "workspace", Player: "player", Players: "Players", BasePart: "part", Part: "part", Humanoid: "humanoid", Instance: "object", Model: "model", Camera: "camera" };
  function sample(t, name) {
    if (!t) return name || "value";
    const base = String(t).replace(/\?$/, "");
    if (SAMPLE[base]) return SAMPLE[base];
    const e = BB.lookup && BB.lookup(base);
    if (e && e.k === "enum") {
      const first = (e.m && e.m[0]) || "";
      return first ? `Enum.${first}` : `Enum.${base}.Default`;
    }
    return name || lowerFirst(base);
  }
  function getter(entry) {
    const n = entry.n;
    const v = VAR[n] || lowerFirst(n);
    if (n === "Workspace") return { v: "workspace", line: "-- 'workspace' is always ready to use" };
    if (n === "Player") return { v: "player", line: "local Players = game:GetService(\"Players\")\nlocal player = Players.LocalPlayer -- in a LocalScript: you!" };
    if (n === "Humanoid") return { v: "humanoid", line: "local character = player.Character or player.CharacterAdded:Wait()\nlocal humanoid = character:WaitForChild(\"Humanoid\")" };
    if (n === "Camera") return { v: "camera", line: "local camera = workspace.CurrentCamera" };
    if (entry.svc) return { v: n, line: `local ${n} = game:GetService("${n}")` };
    if (entry.tg && entry.tg.includes("NotCreatable")) return { v, line: `local ${v} = workspace:FindFirstChildWhichIsA("${n}", true) -- find one in your game` };
    return { v, line: `local ${v} = workspace:FindFirstChild("My${n}") -- an existing ${n}` };
  }
  BB.starter = function (entry, m) {
    const short = m.n.replace(/^[^.:]+[.:]/, "");
    if (entry.k === "class") {
      const g = getter(entry);
      if (m.k === "prop") {
        const ro = (m.tg || []).includes("ReadOnly");
        let s = `${g.line}\n\n-- read it\nprint(${g.v}.${short})`;
        if (!ro) s += `\n\n-- change it\n${g.v}.${short} = ${sample(m.t)}`;
        return s;
      }
      if (m.k === "method" || m.k === "callback") {
        const args = (m.p || []).map((p) => (p.d !== undefined ? null : sample(p.t, p.n))).filter(Boolean).join(", ");
        const ret = m.r && m.r.length && m.r[0].t !== "()" ? "local result = " : "";
        const yields = (m.tg || []).includes("Yields") || /Async$/.test(short);
        if (m.k === "callback") return `${g.line}\n\n${g.v}.${short} = function(${(m.p || []).map((p) => p.n).join(", ")})\n\t-- Roblox calls this for you\n\treturn ${m.r && m.r[0] && m.r[0].t !== "()" ? sample(m.r[0].t) : "nil"}\nend`;
        if (yields)
          return `${g.line}\n\n-- This one talks to Roblox's servers, so wrap it in pcall\n-- (pcall catches errors so your script doesn't crash)\nlocal ok, ${ret ? "result" : "err"} = pcall(function()\n\treturn ${g.v}:${short}(${args})\nend)\nif ok then\n\tprint("It worked!", ${ret ? "result" : "nil"})\nelse\n\twarn("It failed:", ${ret ? "result" : "err"})\nend`;
        return `${g.line}\n\n${ret}${g.v}:${short}(${args})${ret ? "\nprint(result)" : ""}`;
      }
      if (m.k === "event") {
        const ps = (m.p || []).map((p) => p.n).join(", ");
        return `${g.line}\n\n${g.v}.${short}:Connect(function(${ps})\n\t-- this runs every time ${short} happens\n\tprint("${short} fired!"${ps ? ", " + ps : ""})\nend)`;
      }
    }
    if (m.k === "ctor" || m.k === "func") {
      const args = (m.p || []).map((p) => sample(p.t, p.n)).join(", ");
      return `local result = ${m.n}(${args})\nprint(result)`;
    }
    if (m.k === "const") return `print(${m.n})`;
    if (m.k === "prop" && entry.k === "datatype") {
      const v = lowerFirst(entry.n);
      return `local ${v} = ${sample(entry.n, v)}\nprint(${v}.${short})`;
    }
    if (m.k === "prop") return `print(${m.n})`;
    if (m.k === "method" && entry.k === "datatype") {
      const v = lowerFirst(entry.n);
      const args = (m.p || []).map((p) => sample(p.t, p.n)).join(", ");
      return `local ${v} = ${sample(entry.n, v)}\nlocal result = ${v}:${short}(${args})\nprint(result)`;
    }
    if (m.k === "op") return `local a = ${sample(m.a, "a")}\nlocal b = ${sample(m.b, "b")}\nlocal result = a ${m.op} b  -- gives a ${m.t}\nprint(result)`;
    if (m.k === "item") return `-- use it like this:\nsomething.Property = Enum.${entry.n}.${short}\n\n-- or compare:\nif something.Property == Enum.${entry.n}.${short} then\n\tprint("It's ${short}!")\nend`;
    return "";
  };

  BB.copy = function (text, btn) {
    const done = (msg) => { if (btn) { const o = btn.textContent; btn.textContent = msg; setTimeout(() => (btn.textContent = o), 1200); } };
    try {
      navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Select + copy"));
    } catch (e) { done("Select + copy"); }
  };

  BB.fmt = (n, d = 2) => {
    const v = Math.abs(n) < 1e-9 ? 0 : n;
    return (+v.toFixed(d)).toString();
  };
})();

/* The app: routing, rail, search, reference pages, glossary popovers. */
(function () {
  const BB = window.BB;
  const { html, render, useState, useEffect, useRef, useMemo } = window.htmPreact;

  /* ---------- data ---------- */
  let INDEX = [], BYKEY = {}, BYNAME = {}, GNAV = { nav: [], pages: [] }, GBYPATH = {};
  const docCache = {};
  const loadDoc = (slug) => (docCache[slug] = docCache[slug] || fetch(`data/g/${slug}.json`).then((r) => r.json()));
  const LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
  const chunks = {};
  const loadChunk = (cid) => (chunks[cid] = chunks[cid] || fetch(`data/${cid}.json`).then((r) => r.json()));
  const ORDER = { class: 0, datatype: 1, library: 2, global: 3, enum: 4 };
  BB.lookup = (name) => BYNAME[name];
  async function loadEntry(kind, name) {
    const row = BYKEY[`${kind}/${name}`];
    if (!row) return null;
    const data = await loadChunk(row.c);
    return data[`${kind}/${name}`];
  }
  const chain = (row) => { const out = []; let r = row; while (r && r.i && BYKEY[`class/${r.i}`]) { r = BYKEY[`class/${r.i}`]; out.push(r); } return out; };

  /* ---------- routing ---------- */
  const parse = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!h || h === "/") return { page: "home" };
    if (!h.startsWith("/")) {
      // bare deep link: #cframe, #Players
      if (BB.guideById[h.toLowerCase()]) return { page: "guide", id: h.toLowerCase() };
      const row = BYNAME[h];
      if (row) return { page: "entry", kind: row.k, name: row.n };
      return { page: "home" };
    }
    const [, a, b, ...rest] = h.split("/");
    if (a === "guide") return { page: "guide", id: b };
    if (a === "docs") return { page: "doc", path: "/" + [b, ...rest].filter(Boolean).join("/") };
    if (a === "glossary") return { page: "glossary" };
    if (a === "browse") return { page: "browse", kind: b };
    if (ORDER[a] !== undefined) return { page: "entry", kind: a, name: b, member: rest.join("/") || null };
    return { page: "home" };
  };
  const go = (href) => { location.hash = href.replace(/^#/, ""); };

  /* ---------- small components ---------- */
  const Brick = ({ size = 30 }) => html`<svg width=${size} height=${size} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M4 11 L16 5 L28 11 L16 17 Z" fill="var(--accent)" /><path d="M4 11 L16 17 L16 28 L4 22 Z" fill="var(--accent)" opacity=".75" /><path d="M28 11 L16 17 L16 28 L28 22 Z" fill="var(--accent)" opacity=".55" />
    <ellipse cx="12" cy="10" rx="3" ry="1.5" fill="#fff" opacity=".7" /><ellipse cx="20" cy="10" rx="3" ry="1.5" fill="#fff" opacity=".7" /></svg>`;
  const Chev = () => html`<svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>`;
  const Bulb = () => html`<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" /></svg>`;
  const Html = ({ h, cls = "doc", mark = true }) => {
    const ref = useRef();
    useEffect(() => { if (mark && ref.current) BB.markTerms(ref.current); }, [h]);
    useEffect(() => {
      if (!ref.current) return;
      ref.current.querySelectorAll("pre code").forEach((c) => { if (!c.dataset.hl) { c.dataset.hl = 1; c.innerHTML = BB.hl(c.textContent); } });
    }, [h]);
    return html`<div class=${cls} ref=${ref} dangerouslySetInnerHTML=${{ __html: h }}></div>`;
  };
  const Ex = ({ ex }) => html`<div class="ex">
    <div class="ex-head"><h3>${ex.title}</h3>${ex.place && html`<span class="place">Put it in: <b>${ex.place}</b></span>`}</div>
    ${ex.code && html`<${BB.Code} code=${ex.code} />`}
    ${ex.explain && ex.explain.length > 0 && html`<ol class="steps">${ex.explain.map((s) => html`<li><${Inline} t=${s} /></li>`)}</ol>`}</div>`;
  // render `code` in kid strings
  const Inline = ({ t }) => html`${String(t || "").split(/(`[^`]+`)/g).map((p) => (p.startsWith("`") && p.endsWith("`") ? html`<code>${p.slice(1, -1)}</code>` : p))}`;
  const TypeLink = ({ t }) => {
    if (!t) return null;
    const href = BB.typeHref(t);
    const tip = BB.typeInfo(t);
    return href ? html`<a class="ty" href=${href} title=${tip}>${t}</a>` : html`<span class="ty" title=${tip}>${t}</span>`;
  };

  /* ---------- rail ---------- */
  const RAIL_TABS = [["guides", "Learn"], ["docs", "Docs"], ["class", "Classes"], ["datatype", "Types"], ["more", "More"]];
  function NavTree({ nodes, cur, close, depth = 0 }) {
    const has = (n) => n.p === cur || (n.c || []).some(has);
    return html`<ul class="nav-tree">${nodes.map((n) => html`<${NavNode} n=${n} cur=${cur} close=${close} depth=${depth} open0=${has(n)} />`)}</ul>`;
  }
  function NavNode({ n, cur, close, depth, open0 }) {
    const [open, setOpen] = useState(open0);
    useEffect(() => { if (open0) setOpen(true); }, [open0]);
    if (!n.c) return html`<li>${n.p ? html`<a href=${"#/docs" + (n.p === "/" ? "" : n.p)} class=${cur === n.p ? "on" : ""} onClick=${close}><span class=${"dot" + (GBYPATH[n.p] && GBYPATH[n.p].kid ? " kid" : "")}></span>${n.t}</a>` : html`<span class="auto-note" style="padding:5px 8px;display:block">${n.t}</span>`}</li>`;
    return html`<li><button type="button" class="sec" aria-expanded=${open} onClick=${() => setOpen(!open)}>${n.t}<span style="color:var(--muted)">${open ? "−" : "+"}</span></button>${open && html`<${NavTree} nodes=${n.c} cur=${cur} close=${close} depth=${depth + 1} />`}</li>`;
  }
  function Rail({ route, open, close }) {
    const [tab, setTab] = useState(() => (route.page === "doc" ? "docs" : route.page === "entry" ? (route.kind === "class" ? "class" : route.kind === "datatype" ? "datatype" : "more") : "guides"));
    const [q, setQ] = useState("");
    const [onlyKid, setOnlyKid] = useState(false);
    useEffect(() => { if (route.page === "entry") setTab(route.kind === "class" ? "class" : route.kind === "datatype" ? "datatype" : "more"); if (route.page === "doc") setTab("docs"); }, [route.kind, route.page]);
    const cur = route.page === "entry" ? `${route.kind}/${route.name}` : route.page === "guide" ? `guide/${route.id}` : route.page;
    const list = (kinds) => INDEX.filter((r) => kinds.includes(r.k) && !r.x && (!onlyKid || r.kid) && (!q || r.n.toLowerCase().includes(q.toLowerCase())));
    const link = (r) => html`<a href=${`#/${r.k}/${r.n}`} class=${cur === `${r.k}/${r.n}` ? "on" : ""} onClick=${close}><span class=${"dot" + (r.kid ? " kid" : "")}></span>${r.n}</a>`;
    let body;
    if (tab === "docs") {
      body = html`<h4>Create (Roblox Creator Hub)</h4><${NavTree} nodes=${GNAV.nav} cur=${route.page === "doc" ? route.path : null} close=${close} />`;
    } else if (tab === "guides") {
      body = html`<h4>Start here</h4>
        <a href="#/" class=${cur === "home" ? "on" : ""} onClick=${close}>Home</a>
        <h4>Guides with labs</h4>
        ${BB.guides.map((g) => html`<a href=${`#/guide/${g.id}`} class=${cur === `guide/${g.id}` ? "on" : ""} onClick=${close}>${g.title}</a>`)}
        <h4>Words</h4>
        <a href="#/glossary" class=${cur === "glossary" ? "on" : ""} onClick=${close}>Glossary (${BB.glossary.length} words)</a>
        <h4>Browse everything</h4>
        <a href="#/browse/class" onClick=${close}>All classes</a><a href="#/browse/datatype" onClick=${close}>All data types</a><a href="#/browse/enum" onClick=${close}>All enums</a><a href="#/browse/library" onClick=${close}>Libraries and globals</a>`;
    } else {
      const kinds = tab === "more" ? ["library", "global", "enum"] : [tab];
      const items = list(kinds);
      const groups = tab === "more" ? [["Libraries", items.filter((r) => r.k === "library")], ["Globals", items.filter((r) => r.k === "global")], ["Enums", items.filter((r) => r.k === "enum")]] : [[null, items]];
      body = html`
        <input class="rail-filter" type="search" id="rail-filter" placeholder=${"Filter " + items.length + "…"} value=${q} onInput=${(e) => setQ(e.currentTarget.value)} />
        <label class="rail-legend"><input type="checkbox" checked=${onlyKid} onChange=${(e) => setOnlyKid(e.currentTarget.checked)} /><span class="dot kid" style="width:8px;height:8px;border-radius:2px;display:inline-block;background:var(--accent)"></span> Only ones explained in plain words</label>
        ${groups.map(([t, g]) => html`${t && g.length > 0 && html`<h4>${t}</h4>`}${g.slice(0, tab === "more" && t === "Enums" && !q ? 600 : 2000).map(link)}`)}`;
    }
    return html`<nav class=${"rail" + (open ? " open" : "")} aria-label="Reference index">
      <div class="rail-tabs" role="tablist">${RAIL_TABS.map(([k, l]) => html`<button type="button" role="tab" aria-selected=${tab === k} class=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${l}</button>`)}</div>
      ${body}</nav>`;
  }

  /* ---------- search ---------- */
  function Search({ close }) {
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const inp = useRef();
    useEffect(() => inp.current && inp.current.focus(), []);
    const results = useMemo(() => {
      const s = q.trim().toLowerCase();
      if (!s) return [];
      const out = [];
      for (const r of INDEX) {
        const n = r.n.toLowerCase();
        let score = n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 3 : -1;
        if (score >= 0) out.push({ score: score + (r.x ? 5 : 0) - (r.kid ? 0.5 : 0) + ORDER[r.k] * 0.1, label: r.n, sub: `${r.k} · ${r.s}`, href: `#/${r.k}/${r.n}` });
        if (r.k === "enum") continue;
        for (const m of r.m) {
          const short = m.replace(/^[^.:]+[.:]/, "").toLowerCase();
          const sc = short === s ? 2 : short.startsWith(s) ? 4 : m.toLowerCase().includes(s) && s.length > 2 ? 6 : -1;
          if (sc >= 0) out.push({ score: sc - (r.kid ? 0.5 : 0) + ORDER[r.k] * 0.1, label: m.startsWith(r.n) ? m : `${r.n} → ${m}`, sub: `member of ${r.n}`, href: `#/${r.k}/${r.n}/${m}` });
        }
        if (out.length > 4000) break;
      }
      for (const d of GNAV.pages) { const t = d.t.toLowerCase(); if (t.includes(s)) out.push({ score: t.startsWith(s) ? 0.5 : 2.5, label: d.t, sub: "doc · " + (d.d || "").slice(0, 90), href: "#/docs" + (d.p === "/" ? "" : d.p) }); }
      for (const g of BB.guides) if ((g.title + " " + g.short).toLowerCase().includes(s)) out.push({ score: -1, label: g.title, sub: "guide · " + g.short, href: `#/guide/${g.id}` });
      for (const g of BB.glossary) if (g.name.toLowerCase().includes(s)) out.push({ score: 1.5, label: g.name, sub: "word · " + g.def.slice(0, 90), href: "#/glossary", term: g.id });
      return out.sort((a, b) => a.score - b.score).slice(0, 40);
    }, [q]);
    const pick = (r) => { close(); go(r.href); };
    const key = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") { setSel((s) => Math.min(results.length - 1, s + 1)); e.preventDefault(); }
      else if (e.key === "ArrowUp") { setSel((s) => Math.max(0, s - 1)); e.preventDefault(); }
      else if (e.key === "Enter" && results[sel]) pick(results[sel]);
    };
    return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && close()}>
      <div class="sbox" role="dialog" aria-label="Search">
        <input ref=${inp} id="search-input" type="search" placeholder="Search: Players, CFrame, Touched, magnitude…" value=${q} onInput=${(e) => { setQ(e.currentTarget.value); setSel(0); }} onKeyDown=${key} />
        <div class="sres">${!q ? html`<p class="hint">Type a class, a method, an event or a word you don't understand.</p>` : results.length === 0 ? html`<p class="hint">Nothing matches "${q}". Try a shorter word.</p>`
          : results.map((r, i) => html`<a href=${r.href} class=${i === sel ? "sel" : ""} onClick=${(e) => { e.preventDefault(); pick(r); }}><b>${r.label}</b><small>${r.sub}</small></a>`)}</div>
      </div></div>`;
  }

  /* ---------- glossary popover ---------- */
  function TermPop() {
    const [st, setSt] = useState(null);
    useEffect(() => {
      const onClick = (e) => {
        const t = e.target.closest && e.target.closest(".term");
        if (t) {
          const g = BB.term(t.dataset.term);
          const r = t.getBoundingClientRect();
          const top = r.bottom + 8 + 260 > innerHeight ? Math.max(8, r.top - 268) : r.bottom + 8;
          setSt({ g, left: Math.max(16, Math.min(r.left, innerWidth - 376)), top });
          e.preventDefault();
        } else if (!e.target.closest(".pop")) setSt(null);
      };
      const onKey = (e) => e.key === "Escape" && setSt(null);
      document.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
      window.addEventListener("hashchange", () => setSt(null));
      return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
    }, []);
    if (!st) return null;
    const { g } = st;
    return html`<div class="pop" role="dialog" aria-label=${g.name} style=${`left:${st.left}px;top:${st.top}px`}>
      <h4>${g.name}<button class="x" type="button" aria-label="Close" onClick=${() => setSt(null)}>×</button></h4>
      <p>${g.def}</p>${g.ex && html`<${BB.Code} code=${g.ex} />`}
      ${g.guide && BB.guideById[g.guide] && html`<a href=${`#/guide/${g.guide}`}>Learn more: ${BB.guideById[g.guide].title} →</a>`}</div>`;
  }

  /* ---------- pages ---------- */
  function Home() {
    const kidCount = INDEX.filter((r) => r.kid).length;
    const memCount = INDEX.reduce((s, r) => s + r.m.length, 0);
    const popular = ["Players", "Player", "Humanoid", "Instance", "BasePart", "Workspace", "RemoteEvent", "TweenService", "UserInputService", "RunService", "DataStoreService", "GuiObject"].map((n) => BYKEY[`class/${n}`]).filter(Boolean);
    const types = ["Vector3", "CFrame", "UDim2", "Color3", "TweenInfo", "RaycastParams"].map((n) => BYKEY[`datatype/${n}`]).filter(Boolean);
    const p = BB.m3, proj = p.camera(-0.7, 0.55, 18, 150, 120);
    const faces = p.boxFaces(p.cf(p.V(0, 0, 0), p.angles(0, 1.1, 0)), p.V(6, 2.4, 4), proj);
    return html`<div class="page wide">
      <section class="hero">
        <div style="display:flex;flex-direction:column;gap:16px">
          <span class="kind">Unofficial Roblox Engine API guide</span>
          <h1>Roblox scripting, explained <em>like you're new</em>.</h1>
          <p class="lede">Every class, property, method, event, type and enum from Roblox's API, with simpler words, real examples and diagrams you can play with. Tap any <button type="button" class="term" data-term="relative">underlined word</button> to see what it means.</p>
          <div class="btnrow"><a class="btn primary" href="#/guide/network" style="text-decoration:none">Start: how a game runs</a><a class="btn" href="#/guide/cframe" style="text-decoration:none;color:var(--ink)">Jump to CFrames</a></div>
        </div>
        <svg viewBox="0 0 300 220" style="max-width:420px;width:100%" role="img" aria-label="A Roblox-style brick with direction arrows">
          ${faces.map((fc) => html`<polygon points=${p.pts(fc.pts)} fill=${fc.name === "front" ? "var(--accent)" : "var(--z)"} fill-opacity=${0.45 + fc.shade * 0.55} stroke="rgba(0,0,0,.3)" />`)}
          ${(() => { const c = proj(p.V(0, 0, 0)); const look = proj(p.V(-Math.sin(1.1) * 6, 0, -Math.cos(1.1) * 6)); const up = proj(p.V(0, 4.5, 0)); const a1 = p.arrowPath(c, look), a2 = p.arrowPath(c, up);
            return html`<path d=${a1.line} stroke="var(--z)" stroke-width="3" /><polygon points=${a1.head} fill="var(--z)" /><path d=${a2.line} stroke="var(--y)" stroke-width="3" /><polygon points=${a2.head} fill="var(--y)" />
              <text x=${look[0] - 4} y=${look[1] - 8} font-size="12" font-weight="700" fill="var(--z)" text-anchor="middle">LookVector</text><text x=${up[0] + 8} y=${up[1]} font-size="12" font-weight="700" fill="var(--y)">UpVector</text>`; })()}
        </svg>
      </section>
      <p class="auto-note">${INDEX.length.toLocaleString()} APIs and ${memCount.toLocaleString()} members, all included. ${kidCount} of the most-used ones are fully rewritten in plain words (orange dot in the index). The rest show Roblox's own text with every tricky word explained.</p>

      <h2>Guides you can play with</h2>
      <div class="cards">${BB.guides.map((g) => html`<a class="card" href=${`#/guide/${g.id}`}><h3>${g.title}</h3><p>${g.short}</p></a>`)}</div>

      <h2>The Creator Hub docs, explained</h2>
      <p class="auto-note" style="margin:0">All ${GNAV.pages.length} pages of Roblox's "Create" docs, each with a plain-words summary on top. Open the <b>Docs</b> tab in the sidebar for the full tree.</p>
      <div class="cards">${GNAV.nav.map((n) => { const first = (function f(x) { return x.p || (x.c && x.c.map(f).find(Boolean)); })(n); return first && html`<a class="card" href=${"#/docs" + (first === "/" ? "" : first)}><h3>${n.t}</h3><p>${n.c ? n.c.length + " topics" : "Overview"}</p></a>`; })}</div>

      <h2>How to read a reference page</h2>
      <div class="howto">
        <div><b>Class</b><p>A kind of object, like Part or Players. Each object you see in Explorer is one of these.</p></div>
        <div><b>Property</b><p>A setting you read or change: <code>part.Color = …</code></p></div>
        <div><b>Method</b><p>An action it can do. Called with a colon: <code>part:Destroy()</code></p></div>
        <div><b>Event</b><p>Something that happens. You <code>:Connect()</code> a function to it.</p></div>
        <div><b>Data type</b><p>A kind of value, like Vector3 or CFrame. Made with <code>.new()</code></p></div>
        <div><b>Enum</b><p>A fixed list of choices: <code>Enum.Material.Neon</code></p></div>
      </div>

      <h2>Most used classes</h2>
      <div class="cards">${popular.map((r) => html`<a class="card" href=${`#/class/${r.n}`}><h3>${r.n}</h3><p>${r.s}</p></a>`)}</div>
      <h2>Most used data types</h2>
      <div class="cards">${types.map((r) => html`<a class="card" href=${`#/datatype/${r.n}`}><h3>${r.n}</h3><p>${r.s}</p></a>`)}</div>
      <${Foot} /></div>`;
  }

  const Foot = () => html`<p class="foot">Unofficial and not made by or affiliated with Roblox. Reference text and diagrams come from the <a href="https://github.com/Roblox/creator-docs" target="_blank" rel="noopener">Roblox Creator Docs</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>), with plain-words explanations, examples and labs added on top. Always check the <a href="https://create.roblox.com/docs/reference/engine" target="_blank" rel="noopener">official reference</a> for the very latest.</p>`;

  function Guide({ id }) {
    const g = BB.guideById[id];
    if (!g) return html`<div class="page"><h1>Guide not found</h1><a href="#/">Go home</a></div>`;
    const i = BB.guides.indexOf(g), next = BB.guides[i + 1];
    return html`<div class="page wide">
      <div class="crumbs"><a href="#/">Home</a> / Guides</div>
      <h1>${g.title}</h1><p class="lede">${g.short}</p>
      ${g.body()}
      <div class="btnrow" style="justify-content:space-between;align-items:center">
        <a href=${g.official} target="_blank" rel="noopener">Roblox's official page on this (with their videos) ↗</a>
        ${next && html`<a class="btn primary" style="text-decoration:none" href=${`#/guide/${next.id}`}>Next: ${next.title} →</a>`}</div>
      <${Foot} /></div>`;
  }

  function Glossary() {
    return html`<div class="page">
      <div class="crumbs"><a href="#/">Home</a> / Glossary</div>
      <h1>Glossary</h1>
      <p class="lede">Every confusing word, in plain words. Throughout the site, these words get a yellow wavy underline. Tap one to see this explanation.</p>
      ${BB.glossary.slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => html`<section class="panel" id=${"g-" + g.id} style="display:flex;flex-direction:column;gap:10px">
        <h3>${g.name}</h3><p style="margin:0">${g.def}</p>${g.ex && html`<${BB.Code} code=${g.ex} />`}
        ${g.guide && BB.guideById[g.guide] && html`<a href=${`#/guide/${g.guide}`}>See it in: ${BB.guideById[g.guide].title} →</a>`}</section>`)}
      <${Foot} /></div>`;
  }

  const KIND_NAME = { class: "Classes", datatype: "Data types", enum: "Enums", library: "Libraries and globals", global: "Globals" };
  function Browse({ kind }) {
    const kinds = kind === "library" ? ["library", "global"] : [kind];
    const rows = INDEX.filter((r) => kinds.includes(r.k)).sort((a, b) => a.n.localeCompare(b.n));
    const letters = [...new Set(rows.map((r) => r.n[0].toUpperCase()))];
    return html`<div class="page wide">
      <div class="crumbs"><a href="#/">Home</a> / Browse</div>
      <h1>${KIND_NAME[kind]}</h1>
      <p class="lede">${rows.length} in total. Orange names have full plain-words explanations. Faded ones are old (deprecated).</p>
      <div class="letters">${letters.map((l) => html`<a href=${"#L-" + l} onClick=${(e) => { e.preventDefault(); document.getElementById("L-" + l)?.scrollIntoView(); }}>${l}</a>`)}</div>
      ${letters.map((l) => html`<section style="display:flex;flex-direction:column;gap:8px"><h2 id=${"L-" + l} style="scroll-margin-top:80px">${l}</h2>
        <ul class="alist">${rows.filter((r) => r.n[0].toUpperCase() === l).map((r) => html`<li style=${r.x ? "opacity:.5" : ""}><a href=${`#/${r.k}/${r.n}`} style=${r.kid ? "" : "color:var(--ink)"}>${r.n}</a><span>${r.s}</span></li>`)}</ul></section>`)}
      <${Foot} /></div>`;
  }


  /* ---------- which interactive lab goes on which page ---------- */
  const PHYS_DOC = { "ball-socket": "BallSocketConstraint", hinge: "HingeConstraint", prismatic: "PrismaticConstraint", cylindrical: "CylindricalConstraint", spring: "SpringConstraint", "torsion-spring": "TorsionSpringConstraint", universal: "UniversalConstraint", rope: "RopeConstraint", rod: "RodConstraint", plane: "PlaneConstraint", weld: "WeldConstraint", rigid: "RigidConstraint", "no-collision": "NoCollisionConstraint", "linear-velocity": "LinearVelocity", "angular-velocity": "AngularVelocity", "align-position": "AlignPosition", "align-orientation": "AlignOrientation", "vector-force": "VectorForce", torque: "Torque", "line-force": "LineForce", animation: "AnimationConstraint" };
  const DOC_LABS = {
    "/workspace/cframes": ["CFrameLab", "TrigLab"], "/workspace/raycasting": ["RaycastLab"], "/ui/position-and-size": ["UDimLab"], "/ui/animation": ["EasingLab"],
    "/projects/client-server": ["ReplicationLab", "NetworkLab"], "/projects/data-model": ["TreeLab"], "/scripting/events": ["EventsLab"], "/scripting/events/remote": ["NetworkLab"],
    "/players": ["LifecycleLab"], "/physics": ["MoverPicker", "MaterialLab"], "/physics/mechanical-constraints": ["MoverPicker"], "/physics/mover-constraints": ["MoverPicker"],
    "/physics/network-ownership": ["ReplicationLab"], "/scripting/security/network-ownership": ["ReplicationLab"], "/physics/assemblies": ["WeldConstraint"], "/physics/units": ["MaterialLab"], "/parts/materials": ["MaterialLab"],
    "/workspace": ["Vector3DLab"], "/projects/server-authority": ["ReplicationLab"],
  };
  const ENTRY_LABS = {
    "datatype/CFrame": ["CFrameLab"], "datatype/Vector3": ["Vector3DLab", "VectorLab"], "datatype/Vector2": ["VectorLab"], "library/vector": ["Vector3DLab"], "library/math": ["TrigLab", "MathLab"],
    "datatype/UDim2": ["UDimLab"], "datatype/UDim": ["UDimLab"], "class/GuiObject": ["UDimLab"], "class/TweenService": ["EasingLab"], "datatype/TweenInfo": ["EasingLab"], "enum/EasingStyle": ["EasingLab"], "enum/EasingDirection": ["EasingLab"],
    "datatype/RaycastParams": ["RaycastLab"], "datatype/RaycastResult": ["RaycastLab"], "class/WorldRoot": ["RaycastLab"], "class/Players": ["LifecycleLab"], "class/Player": ["LifecycleLab"], "class/Instance": ["TreeLab"],
    "library/task": ["EventsLab"], "datatype/RBXScriptSignal": ["EventsLab"], "class/RemoteEvent": ["ReplicationLab", "NetworkLab"], "class/RemoteFunction": ["NetworkLab"], "class/UnreliableRemoteEvent": ["ReplicationLab"],
    "class/BasePart": ["MaterialLab", "ReplicationLab"], "datatype/PhysicalProperties": ["MaterialLab"], "class/Constraint": ["MoverPicker"], "class/Attachment": ["MoverPicker"], "class/Workspace": ["MaterialLab"],
    "class/JointInstance": ["WeldConstraint"], "class/BodyVelocity": ["LinearVelocity"], "class/BodyPosition": ["AlignPosition"], "class/BodyGyro": ["AlignOrientation"], "class/BodyForce": ["VectorForce"],
    "class/BodyAngularVelocity": ["AngularVelocity"], "class/BodyThrust": ["VectorForce"], "class/RocketPropulsion": ["AlignPosition"], "class/SlidingBallConstraint": ["PrismaticConstraint"],
  };
  const Labs = ({ list, note }) => list.map((n) => html`<div style="display:flex;flex-direction:column;gap:8px">${note && html`<p class="auto-note" style="margin:0">${note}</p>`}${
    BB.anatomy[n] ? html`<${BB.PhysLab} key=${n} name=${n} />` : n === "MoverPicker" ? html`<${BB.MoverPicker} key=${n} />` : BB[n] ? html`<${BB[n]} key=${n} start=${n === "ReplicationLab" && /ownership|BasePart/i.test(location.hash) ? "owner" : undefined} />` : null}</div>`);
  const labsForEntry = (kind, name) => {
    if (kind === "class" && BB.anatomy[name]) return [name];
    return ENTRY_LABS[`${kind}/${name}`] || [];
  };

  /* ---------- reference page ---------- */
  const GROUPS = [
    ["prop", "Properties", "Settings you can read (and often change) with a dot: thing.Property"],
    ["method", "Methods", "Actions it can do. Call them with a colon: thing:Method()"],
    ["event", "Events", "Things that happen. Run code when they do with thing.Event:Connect(function() … end)"],
    ["callback", "Callbacks", "Functions YOU write and hand to it. Roblox calls them at the right moment."],
    ["ctor", "Constructors", "Ways to make a new one. Usually TypeName.new(…)"],
    ["const", "Constants", "Ready-made values that never change."],
    ["func", "Functions", "Functions you call with a dot: library.function(…)"],
    ["op", "Math operators", "What happens when you use + − × ÷ on these values."],
    ["item", "Choices (items)", "All the options in this list. Use them as Enum.Name.Option"],
  ];
  const shortName = (m) => (m.k === "op" ? `${m.a} ${m.op} ${m.b}` : m.n.replace(/^[^.:]+[.:]/, ""));

  function Badges({ m, entry }) {
    const out = [];
    if (m.kid) out.push(html`<span class="badge kidb" title="Explained in plain words below">Plain words</span>`);
    if (entry && BB.memberViz(`${entry.k}/${entry.n}`, m.n)) out.push(html`<span class="badge anim" title="Open to see it animated">▶ Animated</span>`);
    for (const t of m.tg || []) {
      const info = BB.tagInfo[t];
      if (info && t !== "Deprecated") out.push(html`<span class=${"badge " + (info[1] || "")} title=${info[2]}>${info[0]}</span>`);
    }
    if (m.dep) out.push(html`<span class="badge dep" title=${BB.tagInfo.Deprecated[2]}>Old</span>`);
    if (m.sec) out.push(html`<span class="badge sec" title=${BB.secInfo[m.sec] || m.sec}>${m.sec === "PluginSecurity" ? "Plugins only" : "Not for your scripts"}</span>`);
    if (m.k === "method" && /Async$/.test(m.n) && !(m.tg || []).includes("Yields")) out.push(html`<span class="badge yield" title=${BB.tagInfo.Yields[2]}>Waits</span>`);
    return html`<span class="badges">${out}</span>`;
  }

  function Sig({ m }) {
    const nm = shortName(m);
    if (m.k === "prop" || m.k === "const") return html`<span class="sig"><span class="nm">${nm}</span>: <${TypeLink} t=${m.t} /></span>`;
    if (m.k === "op") return html`<span class="sig"><span class="nm">${nm}</span> → <${TypeLink} t=${m.t} /></span>`;
    if (m.k === "item") return html`<span class="sig"><span class="nm">${nm}</span> <span style="color:var(--muted)">= ${m.v}</span></span>`;
    const ps = (m.p || []).map((p, i) => html`${i ? ", " : ""}${p.n}${p.t ? ": " : ""}<${TypeLink} t=${p.t} />`);
    const rs = (m.r || []).filter((r) => r.t && r.t !== "()");
    return html`<span class="sig"><span class="nm">${nm}</span>(${ps})${rs.length > 0 && html` → ${rs.map((r, i) => html`${i ? ", " : ""}<${TypeLink} t=${r.t} />`)}`}</span>`;
  }

  function Member({ m, entry, target, openAll }) {
    const ref = useRef();
    const [open, setOpen] = useState(!!target);
    useEffect(() => { if (openAll !== undefined && BB.memberViz(`${entry.k}/${entry.n}`, m.n) && ref.current) { ref.current.open = openAll; setOpen(openAll); } }, [openAll]);
    useEffect(() => {
      if (target && ref.current) { ref.current.open = true; setOpen(true); setTimeout(() => ref.current && ref.current.scrollIntoView({ block: "start" }), 60); }
    }, [target]);
    const k = m.kid || {};
    const example = k.example || BB.starter(entry, m);
    const ps = m.p || [];
    const rs = (m.r || []).filter((r) => r.t && r.t !== "()");
    return html`<details class=${"m" + (target ? " target" : "")} id=${"m-" + m.n} ref=${ref} onToggle=${(e) => setOpen(e.currentTarget.open)}>
      <summary><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><${Sig} m=${m} /><${Badges} m=${m} entry=${entry} /><${Chev} /></div>
        <span class=${"short" + (k.simple ? " kid" : "")}><${Inline} t=${k.simple || (m.s || "").replace(/`(?:Class|Datatype|Enum|Library|Global)\.([^`|]+)(?:\|([^`]+))?`/g, (_, a, b) => b || a)} /></span></summary>
      ${open && html`<div class="m-body">
        ${BB.memberViz(`${entry.k}/${entry.n}`, m.n) && html`<${BB.MemberViz} spec=${BB.memberViz(`${entry.k}/${entry.n}`, m.n)} />`}
        ${m.dep && html`<div class="callout bad"><h4>Old: don't use in new code</h4><${Html} h=${m.dep} /></div>`}
        ${ps.length > 0 && html`<div class="tablewrap"><table class="params"><thead><tr><th>You give it</th><th>Type</th><th>What it means</th></tr></thead><tbody>
          ${ps.map((p) => html`<tr><td><code>${p.n}</code>${p.d !== undefined && html`<div class="auto-note">optional, default ${String(p.d)}</div>`}</td><td><${TypeLink} t=${p.t} /><div class="auto-note">${BB.typeInfo(p.t)}</div></td><td>${p.s ? html`<${Html} h=${p.s} />` : ""}</td></tr>`)}</tbody></table></div>`}
        ${rs.length > 0 && html`<div class="tablewrap"><table class="params"><thead><tr><th>You get back</th><th>What it means</th></tr></thead><tbody>
          ${rs.map((r) => html`<tr><td><${TypeLink} t=${r.t} /><div class="auto-note">${BB.typeInfo(r.t)}</div></td><td>${r.s ? html`<${Html} h=${r.s} />` : ""}</td></tr>`)}</tbody></table></div>`}
        ${(m.k === "prop" || m.k === "const") && m.t && html`<p class="auto-note" style="margin:0"><b>Type ${m.t}:</b> ${BB.typeInfo(m.t)}${m.def !== undefined ? ` Default: ${m.def}.` : ""}</p>`}
        ${k.gotcha && html`<div class="callout"><h4>Watch out</h4><p style="margin:0"><${Inline} t=${k.gotcha} /></p></div>`}
        ${example && !m.sec && !(m.tg || []).includes("NotScriptable") && html`<div class="ex"><span class="place">${k.example ? "Example" : "Starter snippet (made automatically from the API, change the names to fit your game)"}</span><${BB.Code} code=${example} /></div>`}
        <details class="official" open=${!k.simple}><summary>Roblox's official description</summary><div><${Html} h=${m.d || "<p>No description.</p>"} /></div></details>
      </div>`}</details>`;
  }

  function Inherited({ row }) {
    const anc = chain(row);
    const [open, setOpen] = useState({});
    const [data, setData] = useState({});
    if (!anc.length) return null;
    const toggle = async (a) => {
      setOpen((o) => ({ ...o, [a.n]: !o[a.n] }));
      if (!data[a.n]) { const e = await loadEntry("class", a.n); setData((d) => ({ ...d, [a.n]: e })); }
    };
    return html`<section class="mgroup"><h2 id="inherited">Inherited <small>it also gets everything from these</small></h2>
      <p class="what">A ${row.n} <button type="button" class="term" data-term="inherit">inherits</button> from ${anc.map((a, i) => html`${i ? " → " : ""}<a href=${`#/class/${a.n}`}>${a.n}</a>`)}, so you can use their properties, methods and events on it too.</p>
      ${anc.filter((a) => a.m.length).map((a) => html`<div class="official"><button type="button" class="btn" style="border:0;width:100%;text-align:left;background:none" aria-expanded=${!!open[a.n]} onClick=${() => toggle(a)}>From ${a.n} (${a.m.length}) ${open[a.n] ? "▾" : "▸"}</button>
        ${open[a.n] && html`<div style="padding:6px 14px 12px;display:flex;flex-wrap:wrap;gap:6px">${data[a.n] ? data[a.n].m.filter((m) => !m.dep).map((m) => html`<a class="ref" href=${`#/class/${a.n}/${m.n}`} title=${(m.kid && m.kid.simple) || m.s || ""}><code>${shortName(m)}</code></a>`) : html`<span class="auto-note">Loading…</span>`}</div>`}</div>`)}</section>`;
  }

  function Entry({ kind, name, member }) {
    const [e, setE] = useState(null);
    const [err, setErr] = useState(false);
    const [showOld, setShowOld] = useState(false);
    const [openAll, setOpenAll] = useState(undefined);
    useEffect(() => { setOpenAll(undefined); setShowOld(false); }, [kind, name]);
    useEffect(() => { setE(null); setErr(false); loadEntry(kind, name).then((x) => (x ? setE(x) : setErr(true)), () => setErr(true)); }, [kind, name]);
    useEffect(() => { if (!member) window.scrollTo(0, 0); }, [kind, name]);
    const row = BYKEY[`${kind}/${name}`];
    if (err || !row) return html`<div class="page"><h1>Not found</h1><p>No ${kind} called "${name}". Try the search.</p></div>`;
    if (!e) return html`<div class="page"><p class="loading">Loading ${name}…</p></div>`;
    const k = e.kid;
    const memberIsOld = member && e.m.find((m) => m.n === member && m.dep);
    const visible = e.m.filter((m) => showOld || !m.dep || memberIsOld);
    const oldCount = e.m.filter((m) => m.dep).length;
    const groups = GROUPS.map(([gk, title, what]) => [gk, title, what, visible.filter((m) => m.k === gk)]).filter((g) => g[3].length);
    const anc = chain(row);
    const g = kind === "class" ? (row.svc ? `local ${name} = game:GetService("${name}")` : (e.tg || []).includes("NotCreatable") ? null : `local thing = Instance.new("${name}")\nthing.Parent = workspace`) : null;
    return html`<div class="page">
      <div class="crumbs"><a href="#/">Home</a> / <a href=${`#/browse/${kind === "global" ? "library" : kind}`}>${KIND_NAME[kind]}</a>${anc.length > 0 && html` / <span>is a ${[...anc].reverse().map((a, i) => html`${i ? " → " : ""}<a href=${`#/class/${a.n}`}>${a.n}</a>`)}</span>`}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="kind">${kind === "datatype" ? "data type" : kind}</span><${Badges} m=${{ tg: e.tg, dep: e.dep }} /></div>
        <h1>${name}</h1>
        <p class="lede">${(e.s || "").replace(/`(?:Class|Datatype|Enum|Library|Global)\.([^`|]+)(?:\|([^`]+))?`/g, (_, a, b) => b || a)}</p>
      </div>
      ${e.dep && html`<div class="callout bad"><h4>This is old (deprecated)</h4><${Html} h=${e.dep} /></div>`}
      ${k ? html`<section class="plain">
          <span class="label">In plain words</span><p><${Inline} t=${k.simple} /></p>
          ${k.analogy && html`<div class="analogy"><${Bulb} /><div><${Inline} t=${k.analogy} /></div></div>`}
          ${k.where && html`<p style="font-size:.98rem"><b>Where it lives:</b> <${Inline} t=${k.where} /></p>`}
          ${k.whenToUse && html`<div><b>Use it when you want to…</b><ul style="margin:.3em 0 0">${k.whenToUse.map((w) => html`<li><${Inline} t=${w} /></li>`)}</ul></div>`}
        </section>`
        : html`<section class="plain"><span class="label">In plain words</span>
          <p>${(e.s || "").replace(/`(?:Class|Datatype|Enum|Library|Global)\.([^`|]+)(?:\|([^`]+))?`/g, (_, a, b) => b || a)}</p>
          <p class="auto-note">No hand-written explanation for this one yet. Roblox's text is below with tricky words underlined. Tap one for help. Every member also has a starter snippet.</p></section>`}
      ${g && html`<div class="ex"><span class="place">How to get one</span><${BB.Code} code=${g} /></div>`}
      ${labsForEntry(kind, name).length > 0 && html`<h2>Try it</h2><${Labs} list=${labsForEntry(kind, name)} note=${/^Body|RocketPropulsion/.test(name) ? `${name} is old. This lab shows its modern replacement, which works the same way.` : null} />`}
      ${k && k.terms && Object.keys(k.terms).length > 0 && html`<section class="panel"><h3 style="margin-bottom:8px">Words on this page</h3>
        <dl style="margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:8px">${Object.entries(k.terms).map(([t, d]) => html`<div><dt style="font-weight:800;display:inline">${t}: </dt><dd style="display:inline;margin:0"><${Inline} t=${d} /></dd></div>`)}</dl></section>`}
      ${k && k.examples && k.examples.length > 0 && html`<h2>Examples</h2>${k.examples.map((ex) => html`<${Ex} ex=${ex} />`)}`}
      ${k && k.gotchas && k.gotchas.length > 0 && html`<div class="callout"><h4>Common mistakes</h4><ul style="margin:0;padding-left:1.2em">${k.gotchas.map((x) => html`<li><${Inline} t=${x} /></li>`)}</ul></div>`}
      <details class="official" open=${!k}><summary>Roblox's official description</summary><div><${Html} h=${e.d || "<p>No description.</p>"} /></div></details>
      ${groups.length > 0 && html`<nav class="toc" aria-label="Sections">${groups.map(([gk, title, , list]) => html`<a href=${"#sec-" + gk} onClick=${(ev) => { ev.preventDefault(); document.getElementById("sec-" + gk)?.scrollIntoView(); }}>${title} <span>${list.length}</span></a>`)}
        ${e.m.some((m) => BB.memberViz(`${kind}/${name}`, m.n)) && html`<button type="button" class="btn primary" onClick=${() => setOpenAll(!openAll)}>${openAll ? "Close all animations" : "▶ Open all animations"}</button>`}
        ${oldCount > 0 && html`<label class="place" style="margin-left:auto"><input type="checkbox" checked=${showOld} onChange=${(ev) => setShowOld(ev.currentTarget.checked)} /> Show ${oldCount} old members</label>`}</nav>`}
      ${groups.map(([gk, title, what, list]) => html`<section class="mgroup"><h2 id=${"sec-" + gk}>${title} <small>${list.length}</small></h2><p class="what">${what}</p>
        ${list.map((m) => html`<${Member} key=${m.n} m=${m} entry=${{ ...row, tg: e.tg }} target=${member === m.n} openAll=${openAll} />`)}</section>`)}
      ${kind === "class" && html`<${Inherited} row=${row} />`}
      ${e.desc && e.desc.length > 0 && html`<section class="mgroup"><h2>Kinds of ${name}</h2><p class="what">These classes inherit from ${name}, so they can do everything above and more.</p>
        <div class="toc">${e.desc.slice(0, 80).map((d) => html`<a href=${`#/class/${d}`}>${d}</a>`)}</div></section>`}
      <p><a href=${`https://create.roblox.com/docs/reference/engine/${kind === "datatype" ? "datatypes" : kind === "class" ? "classes" : kind === "enum" ? "enums" : kind === "library" ? "libraries" : "globals"}/${name}`} target="_blank" rel="noopener">Open ${name} on Roblox's site ↗</a></p>
      <${Foot} /></div>`;
  }


  /* ---------- Creator Hub doc page ---------- */
  function DocPage({ path: rawPath }) {
    const path = GBYPATH[rawPath] ? rawPath : rawPath === "/" && GNAV.pages[0] ? GNAV.pages[0].p : rawPath;
    const meta = GBYPATH[path];
    const [d, setD] = useState(null);
    const ref = useRef();
    useEffect(() => { setD(null); if (meta) loadDoc(meta.s).then(setD); window.scrollTo(0, 0); }, [path]);
    useEffect(() => {
      if (!d || !ref.current) return;
      // videos: play locally; on the published page, link to Roblox's copy instead
      ref.current.querySelectorAll("video.gmedia, audio.gmedia").forEach((v) => {
        if (LOCAL) return;
        const a = document.createElement("a");
        a.className = "vid-link"; a.target = "_blank"; a.rel = "noopener";
        a.href = "https://create.roblox.com/docs" + (path === "/" ? "" : path);
        a.textContent = (v.tagName === "VIDEO" ? "▶ Video: " : "♪ Audio: ") + (v.dataset.alt || "watch this clip on Roblox's page") + " ↗";
        v.replaceWith(a);
      });
      ref.current.querySelectorAll("a[href^='#/']").forEach((a) => a.removeAttribute("target"));
    }, [d]);
    if (!meta) return html`<div class="page"><h1>Page not found</h1><p>Try the Docs tab in the sidebar.</p></div>`;
    const order = GNAV.pages, i = order.findIndex((p) => p.p === path), prev = order[i - 1], next = order[i + 1];
    const crumbs = [];
    const walk = (nodes, trail) => { for (const n of nodes) { if (n.p === path) { crumbs.push(...trail); return true; } if (n.c && walk(n.c, [...trail, n.t])) return true; } return false; };
    walk(GNAV.nav, []);
    const slugTail = path.split("/").pop();
    const labs = [...(DOC_LABS[path] || []), ...(path.startsWith("/physics/constraints/") && PHYS_DOC[slugTail] ? [PHYS_DOC[slugTail]] : [])];
    const k = d && d.kid;
    const link = (p) => "#/docs" + (p.p === "/" ? "" : p.p);
    return html`<div class="page wide">
      <div class="crumbs"><a href="#/">Home</a> / Docs${crumbs.map((c) => html` / <span>${c}</span>`)}</div>
      <h1>${meta.t}</h1>${meta.d && html`<p class="lede">${meta.d}</p>`}
      ${!d ? html`<p class="loading">Loading…</p>` : html`
        ${k && html`<section class="plain kidbox"><span class="label">In plain words</span><p><${Inline} t=${k.simple} /></p>
          ${k.analogy && html`<div class="analogy"><${Bulb} /><div><${Inline} t=${k.analogy} /></div></div>`}
          ${k.keyPoints && html`<div><b>The important bits</b><ul>${k.keyPoints.map((x) => html`<li><${Inline} t=${x} /></li>`)}</ul></div>`}</section>`}
        ${labs.length > 0 && html`<h2>Try it yourself</h2><${Labs} list=${labs} />`}
        ${k && k.example && html`<h2>Example</h2><${Ex} ex=${k.example} />`}
        ${k && k.watchOut && k.watchOut.length > 0 && html`<div class="callout"><h4>Watch out</h4><ul style="margin:0;padding-left:1.2em">${k.watchOut.map((x) => html`<li><${Inline} t=${x} /></li>`)}</ul></div>`}
        ${k && k.terms && Object.keys(k.terms).length > 0 && html`<section class="panel"><h3 style="margin-bottom:8px">Words on this page</h3>
          <dl style="margin:0;display:grid;gap:8px">${Object.entries(k.terms).map(([t, x]) => html`<div><dt style="font-weight:800;display:inline">${t}: </dt><dd style="display:inline;margin:0"><${Inline} t=${x} /></dd></div>`)}</dl></section>`}
        <h2>Roblox's full guide</h2>
        <p class="auto-note" style="margin:0">Roblox's own text, images${LOCAL ? " and videos" : " (videos link to Roblox)"}. Tap any underlined word for help.</p>
        <div ref=${ref}><${Html} h=${d.h} /></div>`}
      <div class="btnrow" style="justify-content:space-between">${prev ? html`<a class="btn" style="text-decoration:none;color:var(--ink)" href=${link(prev)}>← ${prev.t}</a>` : html`<span></span>`}${next && html`<a class="btn primary" style="text-decoration:none" href=${link(next)}>${next.t} →</a>`}</div>
      <p><a href=${"https://create.roblox.com/docs" + (path === "/" ? "" : path)} target="_blank" rel="noopener">Open this page on Roblox's site ↗</a></p>
      <${Foot} /></div>`;
  }

  /* ---------- app shell ---------- */
  function App() {
    const [route, setRoute] = useState(parse());
    const [railOpen, setRailOpen] = useState(false);
    const [search, setSearch] = useState(false);
    const [theme, setTheme] = useState(() => { try { return localStorage.getItem("bb-theme") || ""; } catch (e) { return ""; } });
    useEffect(() => {
      const on = () => { const r = parse(); setRoute(r); setRailOpen(false); if (!r.member) window.scrollTo(0, 0); };
      window.addEventListener("hashchange", on);
      const key = (e) => {
        if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { e.preventDefault(); setSearch(true); }
      };
      document.addEventListener("keydown", key);
      return () => { window.removeEventListener("hashchange", on); document.removeEventListener("keydown", key); };
    }, []);
    useEffect(() => {
      if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
      try { localStorage.setItem("bb-theme", theme); } catch (e) {}
    }, [theme]);
    const isDark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    let page;
    if (route.page === "guide") page = html`<${Guide} id=${route.id} />`;
    else if (route.page === "doc") page = html`<${DocPage} path=${route.path} />`;
    else if (route.page === "glossary") page = html`<${Glossary} />`;
    else if (route.page === "browse") page = html`<${Browse} kind=${route.kind} />`;
    else if (route.page === "entry") page = html`<${Entry} kind=${route.kind} name=${route.name} member=${route.member} />`;
    else page = html`<${Home} />`;
    return html`
      <header class="top">
        <button class="icon-btn menu-btn" type="button" aria-label="Open the index" aria-expanded=${railOpen} onClick=${() => setRailOpen((o) => !o)}><svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg></button>
        <a class="brand" href="#/"><${Brick} /><span>Brick by Brick</span></a>
        <button class="search-btn" type="button" onClick=${() => setSearch(true)}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2" /><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>Search<span class="long">&nbsp;classes, methods, words</span><kbd>/</kbd></button>
        <button class="icon-btn" type="button" aria-label=${isDark ? "Switch to light mode" : "Switch to dark mode"} onClick=${() => setTheme(isDark ? "light" : "dark")}>${isDark
          ? html`<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g></svg>`
          : html`<svg width="18" height="18" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor" /></svg>`}</button>
      </header>
      <div class="shell"><${Rail} route=${route} open=${railOpen} close=${() => setRailOpen(false)} /><main id="main">${page}</main></div>
      ${search && html`<${Search} close=${() => setSearch(false)} />`}
      <${TermPop} />`;
  }

  Promise.all([fetch("data/index.json").then((r) => r.json()), fetch("data/gnav.json").then((r) => r.json()).catch(() => ({ nav: [], pages: [] }))]).then(([idx, gnav]) => {
    GNAV = gnav;
    for (const p of gnav.pages) GBYPATH[p.p] = p;
    INDEX = idx.sort((a, b) => ORDER[a.k] - ORDER[b.k] || a.n.localeCompare(b.n));
    for (const r of INDEX) {
      BYKEY[`${r.k}/${r.n}`] = r;
      if (!BYNAME[r.n] || ORDER[r.k] < ORDER[BYNAME[r.n].k]) BYNAME[r.n] = r;
    }
    const app = document.getElementById("app");
    app.innerHTML = "";
    render(html`<${App} />`, app);
  }).catch(() => { document.getElementById("app").innerHTML = '<p class="loading" style="padding:40px 16px">The reference data didn\'t load. Refresh the page to try again.</p>'; });
})();

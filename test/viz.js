const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "../site"); const errors = [];
const vc = new VirtualConsole(); vc.on("jsdomError", (e) => errors.push(String(e.detail || e.message || e)));
const src = fs.readFileSync(path.join(SITE, "index.html"), "utf8").replace(/<script[^>]*><\/script>/g, "");
const dom = new JSDOM(`<!doctype html><body>${src}</body>`, { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/" });
const w = dom.window; w.matchMedia = () => ({ matches: false }); w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
w.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(SITE, u), "utf8"))) });
w.onerror = (m, s, l, c, e) => errors.push(m + (e ? "\n" + e.stack.split("\n").slice(0, 4).join("\n") : ""));
for (const f of [path.join(__dirname, "htm.js"), ...["lib", "glossary", "three", "labs", "labs2", "physlab", "replication", "memberviz", "guides", "app"].map((n) => path.join(SITE, "js", n + ".js"))]) w.eval(fs.readFileSync(f, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(300);
  for (const r of ["/datatype/CFrame", "/class/TweenService", "/class/Tween", "/class/TweenBase", "/datatype/TweenInfo", "/enum/EasingStyle", "/enum/EasingDirection", "/enum/PlaybackState"]) {
    const before = errors.length;
    w.location.hash = r; await sleep(400);
    const btn = [...w.document.querySelectorAll("button")].find((b) => b.textContent.includes("Open all animations"));
    if (btn) btn.click();
    await sleep(600);
    const cards = w.document.querySelectorAll("details.m").length, badges = w.document.querySelectorAll(".badge.anim").length, viz = w.document.querySelectorAll(".mviz").length, svgs = [...w.document.querySelectorAll(".mviz svg")].filter((s) => s.querySelectorAll("polygon,rect,polyline").length > 2).length;
    console.log(r.padEnd(24), "cards", cards, "animated badges", badges, "open diagrams", viz, "with drawing", svgs, errors.length > before ? "ERR" : "");
  }
  // the interactive tween player
  w.location.hash = "/class/TweenBase"; await sleep(400);
  [...w.document.querySelectorAll("button")].find((b) => b.textContent.includes("Open all animations")).click(); await sleep(300);
  const pl = w.document.querySelector(".mviz");
  const click = (t) => [...pl.querySelectorAll("button")].find((b) => b.textContent.includes(t)).click();
  click("Play()"); await sleep(900); click("Pause()"); await sleep(200);
  console.log("after play+pause:", pl.querySelector(".badge[style*='background']").textContent);
  click("Play()"); await sleep(2500);
  console.log("after finishing:", pl.querySelector(".badge[style*='background']").textContent, "| log:", [...pl.querySelectorAll(".log div")].map((d) => d.textContent).join(" / "));
  console.log("errors:", errors.length, errors.slice(0, 3)); process.exit(0);
})();

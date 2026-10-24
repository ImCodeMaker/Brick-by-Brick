// Drive the replication lab: press the button in each scenario and check who ends up seeing the spin.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "../site");
const errors = [];
const vc = new VirtualConsole(); vc.on("jsdomError", (e) => errors.push(String(e.detail || e.message || e)));
const src = fs.readFileSync(path.join(SITE, "index.html"), "utf8").replace(/<script[^>]*><\/script>/g, "");
const dom = new JSDOM(`<!doctype html><body>${src}</body>`, { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/" });
const w = dom.window;
w.matchMedia = () => ({ matches: false }); w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
w.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(SITE, u), "utf8"))) });
w.onerror = (m, s, l, c, e) => errors.push(m + (e ? "\n" + e.stack.split("\n").slice(0, 3).join("\n") : ""));
for (const f of [path.join(__dirname, "htm.js"), ...["lib", "glossary", "three", "labs", "labs2", "physlab", "replication", "memberviz", "guides", "app"].map((n) => path.join(SITE, "js", n + ".js"))]) w.eval(fs.readFileSync(f, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(300); w.location.hash = "/guide/network"; await sleep(400);
  const lab = [...w.document.querySelectorAll("section.lab")].find((l) => l.textContent.includes("make EVERYONE see"));
  const seg = [...lab.querySelectorAll(".seg button")];
  for (const b of seg) {
    b.click(); await sleep(150);
    const btn = [...lab.querySelectorAll(".btnrow .btn.primary")].find((x) => x.textContent.includes("presses"));
    if (btn) btn.click();
    await sleep(2500);
    const dd = [...lab.querySelectorAll(".readout dd")].map((d) => d.textContent);
    console.log(b.textContent.padEnd(42), "seen:", dd[0], "| server:", dd[1], "| log:", [...lab.querySelectorAll(".log div")].length, "lines");
  }
  console.log("errors:", errors.length, errors.slice(0, 3));
  process.exit(0);
})();

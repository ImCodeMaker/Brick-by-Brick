const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "../site"); const errors = [];
const vc = new VirtualConsole(); vc.on("jsdomError", (e) => errors.push(String(e.detail || e.message || e)));
const src = fs.readFileSync(path.join(SITE, "index.html"), "utf8").replace(/<script[^>]*><\/script>/g, "");
const dom = new JSDOM(`<!doctype html><body>${src}</body>`, { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/" });
const w = dom.window; w.matchMedia = () => ({ matches: false }); w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
w.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(SITE, u), "utf8"))) });
for (const f of [path.join(__dirname, "htm.js"), ...["lib", "glossary", "three", "labs", "labs2", "physlab", "replication", "memberviz", "guides", "app"].map((n) => path.join(SITE, "js", n + ".js"))]) w.eval(fs.readFileSync(f, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(300); w.location.hash = "/docs/physics/network-ownership"; await sleep(800);
  const lab = [...w.document.querySelectorAll("section.lab")].find((l) => l.textContent.includes("make EVERYONE see"));
  console.log("opens on:", lab.querySelector(".seg button.on").textContent);
  const btn = [...lab.querySelectorAll(".btn.primary")].find((x) => x.textContent.includes("presses")); btn.click(); await sleep(2000);
  console.log([...lab.querySelectorAll(".readout dt")].map((d, i) => d.textContent + ": " + lab.querySelectorAll(".readout dd")[i].textContent).join(" | "));
  console.log("watch-out shown:", !!lab.querySelector(".callout"), "| relay label:", lab.textContent.includes("COPY FROM A"));
  console.log("errors:", errors.length); process.exit(0);
})();

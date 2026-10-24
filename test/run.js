// Smoke test: load the site in jsdom, visit many routes, report errors and empty pages.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");
const SITE = path.join(__dirname, "../site");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail || e.message || e)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

let htmlSrc = fs.readFileSync(path.join(SITE, "index.html"), "utf8")
  .replace(/<script src="https:[^"]+"><\/script>/, "")
  .replace(/<script src="([^"]+)"><\/script>/g, "");
const dom = new JSDOM(`<!doctype html><html><head></head><body>${htmlSrc}</body></html>`, {
  runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/",
});
const w = dom.window;
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(SITE, u), "utf8"))) });
w.HTMLElement.prototype.scrollIntoView = () => {};
w.scrollTo = () => {};
w.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
w.onerror = (m, s, l, c, e) => errors.push("onerror: " + m + (e && e.stack ? "\n" + e.stack.split("\n").slice(0, 4).join("\n") : ""));
w.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + (e.reason && e.reason.stack || e.reason)));
for (const f of [path.join(__dirname, "htm.js"), ...["lib", "glossary", "three", "labs", "labs2", "physlab", "replication", "memberviz", "guides", "app"].map((n) => path.join(SITE, "js", n + ".js"))]) {
  try { w.eval(fs.readFileSync(f, "utf8")); } catch (e) { errors.push("load " + f + ": " + e.stack); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const routes = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/", "/guide/network", "/guide/tree", "/guide/events", "/guide/vectors", "/guide/cframe", "/guide/physics", "/guide/udim", "/guide/tweens", "/guide/raycast", "/guide/players",
  "/glossary", "/browse/class", "/browse/enum", "/class/Players", "/class/Players/Players:BanAsync", "/class/Part", "/class/BasePart", "/class/Humanoid", "/class/Instance",
  "/datatype/CFrame", "/datatype/Vector3", "/datatype/Instance", "/enum/EasingStyle", "/library/math", "/library/task", "/global/LuaGlobals", "/global/RobloxGlobals",
  "/class/Accoutrement", "/class/WorldRoot", "/class/Tween", "/class/AdService", "/class/GuiObject", "/datatype/UDim2",
];
(async () => {
  await sleep(300);
  for (const r of routes) {
    const before = errors.length;
    w.location.hash = r;
    await sleep(250);
    const main = w.document.getElementById("main");
    const txt = main ? main.textContent : "";
    const h1 = main && main.querySelector("h1");
    // open all member cards to render their bodies
    if (main) main.querySelectorAll("details.m").forEach((d) => { d.open = true; d.dispatchEvent(new w.Event("toggle")); });
    await sleep(150);
    // mark terms in opened bodies
    const terms = main ? main.querySelectorAll(".term").length : 0;
    console.log(`${r.padEnd(40)} h1=${h1 ? JSON.stringify(h1.textContent.slice(0, 40)) : "NONE"} len=${txt.length} members=${main ? main.querySelectorAll("details.m").length : 0} terms=${terms}${errors.length > before ? "  ERR" : ""}`);
  }
  // search
  w.document.querySelector(".search-btn").click();
  await sleep(50);
  const inp = w.document.getElementById("search-input");
  if (inp) { inp.value = "magnitude"; inp.dispatchEvent(new w.Event("input", { bubbles: true })); await sleep(100);
    console.log("search results:", w.document.querySelectorAll(".sres a").length, [...w.document.querySelectorAll(".sres a b")].slice(0, 5).map((b) => b.textContent)); }
  // term popover
  w.location.hash = "/class/Players"; await sleep(250);
  const t = w.document.querySelector(".term");
  if (t) { t.click(); await sleep(50); console.log("popover:", !!w.document.querySelector(".pop"), w.document.querySelector(".pop h4")?.textContent); }
  console.log("\nERRORS:", errors.length); errors.slice(0, 15).forEach((e) => console.log(" -", e.slice(0, 600)));
  process.exit(0);
})();

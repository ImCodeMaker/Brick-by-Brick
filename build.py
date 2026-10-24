"""Build compact JSON data for the Brick by Brick reference from Roblox creator-docs YAML."""
import glob, json, os, re, sys
import yaml, markdown

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src/creator-docs/content/en-us/reference/engine")
DOCS = os.path.join(ROOT, "src/creator-docs/content/en-us")
OUT = os.path.join(ROOT, "site/data")
KID = os.path.join(ROOT, "site/kid")
os.makedirs(OUT, exist_ok=True)

KIND_DIR = {"Class": "class", "Datatype": "datatype", "Enum": "enum", "Library": "library", "Global": "global"}
images = set()


def ref_link(m):
    """`Class.Players:BanAsync()|BanAsync()` -> <a data-ref=...>"""
    body = m.group(1)
    target, _, label = body.partition("|")
    kind, _, rest = target.partition(".")
    if kind not in KIND_DIR or not rest:
        return m.group(0)
    rest = rest.rstrip("()")
    # split owner from member: Players:BanAsync, Players.PlayerAdded, Global.LuaGlobals.print
    parts = re.split(r"([.:])", rest, maxsplit=1)
    owner = parts[0]
    member = rest if len(parts) > 1 else ""
    if kind == "Global" and len(parts) > 1:
        owner, member = parts[0], rest
    if kind == "Enum" and len(parts) > 1:
        member = rest
    label = label or (target.split(".", 1)[1])
    href = f"{KIND_DIR[kind]}/{owner}" + (f"/{member}" if member else "")
    return f'<a class="ref" href="#/{href}"><code>{label}</code></a>'


def guide_link(m):
    text, path = m.group(1), m.group(2)
    if path.startswith("http"):
        return m.group(0)
    clean = re.sub(r"^(\.\./)+", "", path)
    clean = re.sub(r"(/index)?\.md", "", clean)
    return f"[{text}](https://create.roblox.com/docs/{clean})"


def img_src(m):
    src = m.group(1)
    clean = "assets/" + re.sub(r"^(\.\./)*/?assets/", "", src)
    if clean.startswith("assets/"):
        images.add(clean)
    return f'src="{clean}"'


def md(text):
    if not text:
        return ""
    text = re.sub(r"`((?:Class|Datatype|Enum|Library|Global)\.[^`]+)`", lambda m: "\x00" + ref_link(m) + "\x01", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", guide_link, text)
    # stash generated anchors so markdown leaves them alone
    stash = []
    text = re.sub(r"\x00(.*?)\x01", lambda m: (stash.append(m.group(1)), f"@@R{len(stash)-1}@@")[1], text)
    html = markdown.markdown(text, extensions=["fenced_code", "tables"])
    html = re.sub(r"@@R(\d+)@@", lambda m: stash[int(m.group(1))], html)
    html = re.sub(r'src="([^"]+)"', img_src, html)
    html = html.replace('<img ', '<img loading="lazy" ')
    return html.strip()


def clean_params(ps):
    return [{"n": p.get("name"), "t": p.get("type"), **({"d": p["default"]} if p.get("default") not in (None, "") else {}),
             **({"s": md(p.get("summary"))} if p.get("summary") else {})} for p in (ps or [])]


def clean_returns(rs):
    return [{"t": r.get("type"), **({"s": md(r.get("summary"))} if r.get("summary") else {})} for r in (rs or [])]


def member(m, kind):
    out = {"n": m["name"], "k": kind}
    desc = m.get("description") or m.get("summary")
    out["d"] = md(desc)
    if m.get("summary"):
        out["s"] = re.sub(r"\s+", " ", m["summary"]).strip()
    if "type" in m:
        out["t"] = m["type"]
    if "parameters" in m:
        out["p"] = clean_params(m["parameters"])
    if "returns" in m:
        out["r"] = clean_returns(m["returns"])
    if m.get("default") not in (None, ""):
        out["def"] = m["default"]
    tags = [t for t in (m.get("tags") or []) if isinstance(t, str)]
    if tags:
        out["tg"] = tags
    if m.get("deprecation_message") or "Deprecated" in tags:
        out["dep"] = md(m.get("deprecation_message") or "Deprecated.") or "Deprecated."
    sec = m.get("security")
    if isinstance(sec, dict):
        sec = sec.get("read") if sec.get("read") != "None" else sec.get("write")
    if sec and sec != "None":
        out["sec"] = sec
    if m.get("category"):
        out["cat"] = m["category"]
    if kind == "op":
        out["op"] = m["operation"]; out["a"] = m["type_a"]; out["b"] = m["type_b"]; out["t"] = m["return_type"]
        out["n"] = f"op:{m['type_a']}{m['operation']}{m['type_b']}"
    if m.get("value") is not None and kind == "item":
        out["v"] = m["value"]
    return out


SECTIONS = [("properties", "prop"), ("methods", "method"), ("events", "event"), ("callbacks", "callback"),
            ("constructors", "ctor"), ("constants", "const"), ("functions", "func"), ("math_operations", "op"),
            ("items", "item")]


def load_kid():
    kid = {}
    for f in glob.glob(os.path.join(KID, "*.json")):
        try:
            d = json.load(open(f))
            kid[d.get("name") or os.path.basename(f)[:-5]] = d
        except Exception as e:
            print("BAD KID FILE", f, e, file=sys.stderr)
    return kid


def chunk_id(e):
    k, first = e["k"], e["n"][0].upper()
    if k == "class":
        return f"c-{first}"
    if k == "enum":
        return "e-" + ("AC" if first <= "C" else "DK" if first <= "K" else "LR" if first <= "R" else "SZ")
    return {"datatype": "datatypes", "library": "libs", "global": "libs"}[k]


def build():
    kid = load_kid()
    entries = {}
    for kdir, kind in [("classes", "class"), ("datatypes", "datatype"), ("enums", "enum"),
                       ("libraries", "library"), ("globals", "global")]:
        for f in sorted(glob.glob(os.path.join(SRC, kdir, "*.yaml"))):
            d = yaml.safe_load(open(f))
            name = os.path.basename(f)[:-5] if kind == "global" else d["name"].strip()
            e = {"n": name, "k": kind, "d": md(d.get("description")),
                 "s": re.sub(r"\s+", " ", (d.get("summary") or "")).strip()}
            if d.get("inherits"):
                e["inh"] = d["inherits"]
            if d.get("descendants"):
                e["desc"] = d["descendants"]
            tags = [t for t in (d.get("tags") or []) if isinstance(t, str)]
            if tags:
                e["tg"] = tags
            if d.get("deprecation_message") or "Deprecated" in tags:
                e["dep"] = md(d.get("deprecation_message") or "Deprecated.") or "Deprecated."
            e["m"] = [member(m, mk) for key, mk in SECTIONS for m in (d.get(key) or [])]
            seen = set(); uniq = []
            for m in e["m"]:
                m["n"] = m["n"].strip()
                if kind == "enum" and "." not in m["n"]:
                    m["n"] = f"{name}.{m['n']}"
                if (m["n"], m["k"]) in seen and m["k"] != "op":
                    continue  # overloads share one card
                seen.add((m["n"], m["k"])); uniq.append(m)
            e["m"] = uniq
            key = f"{kind}/{name}"
            if key in entries:  # datatype Instance merges into class Instance? keep separate pages
                key = f"{kind}/{name}"
            entries[key] = e
    # attach kid layers: class wins for shared names (Instance)
    orphan = {}
    for name, k in kid.items():
        for kind in ("class", "datatype", "library", "global", "enum"):
            e = entries.get(f"{kind}/{name}")
            if not e:
                continue
            e["kid"] = {x: k[x] for x in ("simple", "analogy", "whenToUse", "where", "terms", "examples", "gotchas") if k.get(x)}
            km = {kk.strip(): vv for kk, vv in (k.get("members") or {}).items()}
            orphan.update({kk: vv for kk, vv in km.items()})
            for m in e["m"]:
                if m["n"] in km:
                    m["kid"] = km[m["n"]]
            if kind == "class" and name == "Instance" and "datatype/Instance" in entries:
                for m in entries["datatype/Instance"]["m"]:
                    if m["n"] in km:
                        m["kid"] = km[m["n"]]
                entries["datatype/Instance"].setdefault("kid", e["kid"])
            break

    # kid notes written for inherited members (e.g. TweenBase:Play in Tween.json)
    for e in entries.values():
        for m in e["m"]:
            if "kid" not in m and m["n"] in orphan:
                m["kid"] = orphan[m["n"]]

    # chunk: classes by first letter, everything else one file per kind
    chunks = {}
    for key, e in entries.items():
        kind = e["k"]
        cid = chunk_id(e)
        chunks.setdefault(cid, {})[key] = e
    for cid, data in chunks.items():
        json.dump(data, open(os.path.join(OUT, f"{cid}.json"), "w"), separators=(",", ":"), ensure_ascii=False)

    # index for nav + search
    index = []
    for key, e in entries.items():
        cid = chunk_id(e)
        row = {"n": e["n"], "k": e["k"], "s": e["s"][:180], "c": cid,
               "m": [m["n"] for m in e["m"] if not m.get("dep")]}
        if e.get("inh"):
            row["i"] = e["inh"][0]
        if e.get("dep"):
            row["x"] = 1
        if e.get("kid"):
            row["kid"] = 1
        if "Service" in (e.get("tg") or []):
            row["svc"] = 1
        index.append(row)
    json.dump(index, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    json.dump(sorted(images), open(os.path.join(OUT, "_images.json"), "w"))
    print("entries", len(entries), "chunks", len(chunks), "images", len(images),
          "kid", sum(1 for e in entries.values() if e.get("kid")))


if __name__ == "__main__":
    build()

"""Convert the Creator Hub 'Create' guide pages (MDX-ish markdown) into per-page JSON for Brick by Brick."""
import base64, glob, json, os, re, subprocess
import yaml, markdown
from build import ref_link

ROOT = os.path.dirname(os.path.abspath(__file__))
NAV = os.path.join(ROOT, "src/creator-docs/content/common/navigation/engine/guides.yaml")
GSRC = os.path.join(ROOT, "gsrc")
MEDIA = os.path.join(ROOT, "site/g")          # downloaded originals (served locally)
PROC = os.path.join(ROOT, "gproc")            # compressed copies for embedding
OUT = os.path.join(ROOT, "site/data/g")
KIDG = os.path.join(ROOT, "site/kidg")
os.makedirs(OUT, exist_ok=True)
os.makedirs(PROC, exist_ok=True)
SKIP_TOP = {"Cloud services", "Roblox for Unity developers", "Roblox for Unreal developers"}

# labs embedded on matching pages
LABS = {
    "/workspace/cframes": ["CFrameLab", "TrigLab"],
    "/workspace/raycasting": ["RaycastLab"],
    "/ui/position-and-size": ["UDimLab"],
    "/ui/animation": ["EasingLab"],
    "/projects/client-server": ["NetworkLab"],
    "/projects/data-model": ["TreeLab"],
    "/scripting/events": ["EventsLab"],
    "/players": ["LifecycleLab"],
    "/physics/mover-constraints": ["ForceLab"],
    "/physics": ["ForceLab"],
    "/workspace": ["Vector3DLab"],
    "/scripting": ["MathLab"],
}


def files_for(path):
    for c in (f"content/en-us{path}.md", f"content/en-us{path}/index.md"):
        if os.path.exists(os.path.join(GSRC, c)):
            return c
    return None


def load_nav():
    nav = yaml.safe_load(open(NAV))["navigation"]
    out, on = [], False
    for n in nav:
        if n.get("heading"):
            on = n["heading"] == "Create"
            continue
        if on and n.get("title") and n["title"] not in SKIP_TOP:
            out.append(n)

    def conv(n):
        p = (n.get("path") or "").rstrip("/") or "/"
        node = {"t": n["title"], "p": p if files_for(p) else None}
        kids = [conv(k) for k in (n.get("section") or []) if k.get("title")]
        if kids:
            node["c"] = kids
        return node
    return [conv(n) for n in out]


def flat(nodes, acc=None):
    acc = [] if acc is None else acc
    for n in nodes:
        if n.get("p") and n["p"] not in acc:
            acc.append(n["p"])
        flat(n.get("c", []), acc)
    return acc


# ---------- media ----------
def compress(rel):
    """rel = assets/...  -> data URI of a small WebP copy, or None"""
    from PIL import Image
    src = os.path.join(MEDIA, rel)
    if not os.path.exists(src) or os.path.getsize(src) == 0:
        return None
    ext = rel.rsplit(".", 1)[-1].lower()
    if ext == "svg":
        data = open(src, "rb").read()
        data = re.sub(rb"<!DOCTYPE[^>\[]*(\[[^\]]*\])?\s*>", b"", data)
        return "data:image/svg+xml;base64," + base64.b64encode(data).decode()
    if ext == "gif":
        if os.path.getsize(src) > 1_500_000:
            return None
        return "data:image/gif;base64," + base64.b64encode(open(src, "rb").read()).decode()
    if ext not in ("png", "jpg", "jpeg", "webp"):
        return None
    dst = os.path.join(PROC, rel + ".webp")
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        try:
            im = Image.open(src)
            im.thumbnail((900, 900))
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA")
            im.save(dst, "WEBP", quality=68, method=5)
        except Exception as e:
            print("img fail", rel, e)
            return None
    return "data:image/webp;base64," + base64.b64encode(open(dst, "rb").read()).decode()


# ---------- conversion ----------
def asset_rel(page_file, u):
    u = u.split("#")[0].split("?")[0]
    if u.startswith("/assets/"):
        return u[1:]
    p = os.path.normpath(os.path.join(os.path.dirname(page_file.replace("content/en-us/", "")), u))
    return p if p.startswith("assets/") else None


def convert(page_file, pages_set):
    raw = open(os.path.join(GSRC, page_file)).read()
    fm, body = {}, raw
    m = re.match(r"^---\n(.*?)\n---\n", raw, re.S)
    if m:
        fm = yaml.safe_load(m.group(1)) or {}
        body = raw[m.end():]
    page_dir = os.path.dirname(page_file.replace("content/en-us/", ""))
    t = body
    t = re.sub(r"\sstyle=\{\{.*?\}\}", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    # fenced code with titles
    t = re.sub(r"^(\s*)```(\w+)[^\n`]*?title=\"([^\"]+)\"[^\n]*$", lambda m: f"{m.group(1)}**{m.group(3)}**\n\n{m.group(1)}```{m.group(2)}", t, flags=re.M)
    t = re.sub(r"^(\s*)```(\w+)[ \t]+[^\n]+$", r"\1```\2", t, flags=re.M)
    # components
    t = re.sub(r"<Alert\s+severity\s*=\s*[\"'](\w+)[\"'][^>]*>", r'<div class="callout c-\1" markdown="1">', t)
    t = t.replace("</Alert>", "</div>")
    t = re.sub(r"<AlertTitle>(.*?)</AlertTitle>", r"**\1**", t, flags=re.S)
    t = re.sub(r"<BetaAlert[^>]*/>", '<div class="callout c-info"><p><b>Beta:</b> this feature is still being tested by Roblox and may change.</p></div>', t)
    t = re.sub(r"<BetaAlert[^>]*>", '<div class="callout c-info" markdown="1"><b>Beta:</b> ', t)
    t = t.replace("</BetaAlert>", "</div>")
    t = re.sub(r"<Tabs[^>]*>", '<div class="tabs" markdown="1">', t)
    t = t.replace("</Tabs>", "</div>")
    t = re.sub(r"<TabItem\s+label=\"([^\"]*)\"[^>]*>", r'<div class="tab" data-label="\1" markdown="1">', t)
    t = t.replace("</TabItem>", "</div>")
    t = re.sub(r"<GridContainer[^>]*>", '<div class="gridc" markdown="1">', t)
    t = t.replace("</GridContainer>", "</div>")
    t = re.sub(r"<Grid\b[^>]*>", '<div class="gcell" markdown="1">', t)
    t = t.replace("</Grid>", "</div>")
    t = re.sub(r"<BaseAccordion[^>]*>", '<details class="acc" markdown="1">', t)
    t = t.replace("</BaseAccordion>", "</details>")
    t = re.sub(r"<AccordionSummary[^>]*>(.*?)</AccordionSummary>", lambda m: "<summary>" + re.sub(r"<[^>]+>", "", m.group(1)) + "</summary>", t, flags=re.S)
    t = re.sub(r"<AccordionDetails[^>]*>", '<div markdown="1">', t)
    t = t.replace("</AccordionDetails>", "</div>")
    t = re.sub(r"<Chip\s+label=\"([^\"]*)\"[^>]*/>", r'<span class="chip">\1</span>', t)
    t = re.sub(r"<CardMedia[^>]*image=\"([^\"]+)\"[^>]*/>", r'<img src="\1" />', t)
    t = re.sub(r"<(Card|CardContent)\b[^>]*>", '<div class="gcard" markdown="1">', t)
    t = re.sub(r"</(Card|CardContent)>", "</div>", t)
    t = re.sub(r"</?(Typography|Translation|Button|CardActions|Stack|Box)\b[^>]*>", "", t)
    t = re.sub(r"<[A-Z][A-Za-z]+\b[^>]*/>", "", t)            # other includes/widgets
    t = re.sub(r"</?[A-Z][A-Za-z]+\b[^>]*>", "", t)
    # YouTube iframes -> link
    t = re.sub(r"<iframe[^>]*src=\"(https://www\.youtube(?:-nocookie)?\.com/embed/([\w-]+))[^\"]*\"[^>]*>.*?</iframe>",
               lambda m: f'<p><a class="yt" href="https://www.youtube.com/watch?v={m.group(2)}" target="_blank" rel="noopener">Watch this video on YouTube ↗</a></p>', t, flags=re.S)
    t = re.sub(r"<iframe.*?</iframe>", "", t, flags=re.S)
    # API refs
    t = re.sub(r"`((?:Class|Datatype|Enum|Library|Global)\.[^`]+)`", lambda m: "\x00" + ref_link(m) + "\x01", t)
    stash = []
    t = re.sub(r"\x00(.*?)\x01", lambda m: (stash.append(m.group(1)), f"@@R{len(stash)-1}@@")[1], t)

    # markdown links to other guides / assets
    def link(m):
        text, href = m.group(1), m.group(2)
        if href.startswith(("http", "#", "mailto:")):
            return m.group(0)
        anchor = ""
        if "#" in href:
            href, anchor = href.split("#", 1)
        if "assets/" in href and not href.endswith(".md"):
            rel = asset_rel(page_file, href)
            return f"[{text}](https://create.roblox.com/docs/{rel})" if rel else text
        if href.startswith("/"):
            target = href
        else:
            target = "/" + os.path.normpath(os.path.join(page_dir, href))
        target = re.sub(r"(/index)?\.md$", "", target).rstrip("/") or "/"
        target = target.replace("/en-us", "")
        if target in pages_set:
            return f"[{text}](#/docs{target})"
        return f"[{text}](https://create.roblox.com/docs{target}{'#' + anchor if anchor else ''})"
    t = re.sub(r"(?<!!)\[([^\]]+)\]\(([^)\s]+)\)", link, t)
    # markdown images -> html img
    t = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)[^)]*\)", r'<img src="\2" alt="\1" />', t)

    html = markdown.markdown(t, extensions=["fenced_code", "tables", "md_in_html", "attr_list"])
    html = re.sub(r"@@R(\d+)@@", lambda m: stash[int(m.group(1))], html)

    # media
    def fix_img(m):
        tag = m.group(0)
        sm = re.search(r'src="([^"]+)"', tag)
        if not sm:
            return tag
        rel = asset_rel(page_file, sm.group(1)) if not sm.group(1).startswith("http") else None
        if not rel:
            return ""
        data = compress(rel)
        if not data:
            return f'<a href="https://create.roblox.com/docs/{rel}" target="_blank" rel="noopener">(image)</a>'
        tag = tag.replace(sm.group(0), f'src="{data}"')
        tag = re.sub(r'\s(width|height)="[^"]*"', "", tag)
        return tag.replace("<img ", '<img loading="lazy" ')
    html = re.sub(r"<img\b[^>]*>", fix_img, html)

    def fix_media(m):
        kind, attrs = m.group(1), m.group(2)
        sm = re.search(r'src="([^"]+)"', attrs)
        rel = asset_rel(page_file, sm.group(1)) if sm else None
        if not rel:
            return ""
        alt = re.search(r'alt="([^"]*)"', attrs)
        return (f'<{kind} class="gmedia" controls preload="none" src="g/{rel}" data-alt="{alt.group(1) if alt else ""}"></{kind}>')
    html = re.sub(r"<(video|audio)\b([^>]*)>(?:\s*</\1>)?", fix_media, html)
    html = re.sub(r"<source[^>]*>", "", html)
    return fm, html


def main():
    nav = load_nav()
    order = flat(nav)
    pages_set = set(order)
    meta = []
    for i, p in enumerate(order):
        f = files_for(p)
        fm, html = convert(f, pages_set)
        slug = f.replace("content/en-us/", "")[:-3].replace("/", "__")
        kid = None
        kf = os.path.join(KIDG, slug + ".json")
        if os.path.exists(kf):
            try:
                kid = json.load(open(kf))
                kid.pop("path", None)
            except Exception as e:
                print("BAD", kf, e)
        rec = {"p": p, "t": fm.get("title") or p, "d": fm.get("description", ""), "h": html}
        if kid:
            rec["kid"] = kid
        if p in LABS:
            rec["labs"] = LABS[p]
        json.dump(rec, open(os.path.join(OUT, slug + ".json"), "w"), separators=(",", ":"), ensure_ascii=False)
        meta.append({"p": p, "t": rec["t"], "d": rec["d"], "s": slug, "kid": 1 if kid else 0})
    json.dump({"nav": nav, "pages": meta}, open(os.path.join(ROOT, "site/data/gnav.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    print("pages", len(meta), "with kid", sum(m["kid"] for m in meta))


if __name__ == "__main__":
    main()

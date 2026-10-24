# Plain-words summaries for Roblox Creator Hub guide pages — spec

We are building an unofficial, kid-friendly mirror of the Roblox Creator Hub "Create" docs. Each guide
page will show Roblox's own text (CC-BY-4.0) with an "In plain words" box on top. You write that box.

Source markdown (already downloaded) lives under:
  /private/tmp/claude-501/-Users-teudymbp/bb335579-418b-40ce-9ec4-f18faa69876c/scratchpad/gsrc/<path>
where <path> is a line from your group file (e.g. `content/en-us/workspace/cframes.md`).

API data (to check facts about classes you mention):
  /private/tmp/claude-501/-Users-teudymbp/bb335579-418b-40ce-9ec4-f18faa69876c/scratchpad/src/creator-docs/content/en-us/reference/engine/{classes,datatypes,enums,libraries}/<Name>.yaml

For EACH page in your group, read the whole page and write ONE JSON file to:
  /private/tmp/claude-501/-Users-teudymbp/bb335579-418b-40ce-9ec4-f18faa69876c/scratchpad/site/kidg/<slug>.json
where <slug> = the path without `content/en-us/` and without `.md`, with every `/` replaced by `__`.
Examples: `content/en-us/workspace/cframes.md` -> `workspace__cframes.json`;
`content/en-us/players/index.md` -> `players__index.json`.

## JSON shape
```json
{
  "path": "content/en-us/workspace/cframes.md",
  "simple": "3-5 short sentences: what this page is about and why a beginner should care, explained to a 10-13 year old who plays Roblox but is new to making games.",
  "analogy": "One real-world comparison that makes the main idea click.",
  "keyPoints": ["5-8 bullets: the most important things the page teaches, each a plain sentence"],
  "terms": { "confusing word from this page": "plain 1-2 sentence definition, with a tiny number example when it helps" },
  "example": {
    "title": "Short task name",
    "place": "Script in ServerScriptService (or LocalScript in StarterPlayerScripts, etc.)",
    "code": "runnable modern Luau with -- comments",
    "explain": ["step-by-step plain explanation"]
  },
  "watchOut": ["Common beginner mistake + how to avoid it"]
}
```
- `example` is optional: include it when the page is about scripting something. Omit it for Studio-UI or
  policy pages (publishing, team permissions, etc.); there, `keyPoints` can describe the clicks to make.
- `terms`: include every word on the page a kid would trip on (relative, offset, replicate, yield,
  streaming, assembly, network ownership, etc.). When the page says something vague like "relative to"
  or "offset", explain relative to WHAT / offset from WHAT with numbers.

## Rules
- Short sentences, everyday words, friendly, never babyish. No emoji. Only `inline code` backticks as markup.
- Be accurate: base everything on the page and the API YAML. Leave out anything you're unsure about.
- Code: modern Luau (game:GetService, task.wait, :Connect, local). Say where the script goes.
- Valid JSON. Validate each file: python3 -c "import json,sys;json.load(open(sys.argv[1]))" <file>
- Only write files for your own group. Other writers handle the other pages in parallel.

When done, reply with: number of files written, and any pages you skipped and why.

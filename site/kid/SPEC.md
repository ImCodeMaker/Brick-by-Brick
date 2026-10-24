# Kid-friendly explanation files — spec

We are building an unofficial, kid-friendly Roblox Engine API reference. The official docs data
(CC-BY-4.0) lives at:

  /private/tmp/claude-501/-Users-teudymbp/bb335579-418b-40ce-9ec4-f18faa69876c/scratchpad/src/creator-docs/content/en-us/reference/engine/
    classes/<Name>.yaml   datatypes/<Name>.yaml   libraries/<name>.yaml   globals/<Name>.yaml

Related guides (great source material, read the relevant ones):
  .../src/creator-docs/content/en-us/{workspace,players,physics,scripting,ui,cloud-services,characters,parts,luau}/

For EACH API you are assigned, read its YAML in full and write ONE JSON file:

  /private/tmp/claude-501/-Users-teudymbp/bb335579-418b-40ce-9ec4-f18faa69876c/scratchpad/site/kid/<Name>.json

(use the exact YAML `name`, e.g. `Players.json`, `CFrame.json`, `task.json`, `LuaGlobals.json`)

## JSON shape

```json
{
  "name": "Players",
  "simple": "2-4 short sentences. What is this, explained to a 10-year-old who has played Roblox but never coded.",
  "analogy": "One real-world comparison. e.g. 'Players is like the guest list at a party: ...'",
  "whenToUse": ["short bullet", "short bullet"],
  "where": "Where it lives / runs and how you get it, e.g. 'Server and client. Get it with game:GetService(\"Players\").'",
  "terms": { "word that might confuse a kid": "plain definition, 1-2 sentences" },
  "examples": [
    {
      "title": "Say hi when someone joins",
      "place": "Script in ServerScriptService",
      "code": "local Players = game:GetService(\"Players\")\n...",
      "explain": ["Line-by-line or step-by-step plain explanation", "..."]
    }
  ],
  "gotchas": ["Common mistake + how to avoid it"],
  "members": {
    "Players:GetPlayerByUserId": {
      "simple": "1-3 sentences, plain words. What it does and WHY you would use it.",
      "example": "short runnable Luau snippet with -- comments",
      "gotcha": "optional: common mistake"
    }
  }
}
```

## Member keys
Use the member's `name` EXACTLY as in the YAML (e.g. `Players.PlayerAdded`, `Players:GetPlayerByUserId`,
`Vector3.new`, `CFrame.LookVector`, `CFrame:ToWorldSpace`, `math.clamp`, `task.wait`).
For datatype `math_operations`, use the key `op:<type_a><operation><type_b>`, e.g. `op:Vector3+Vector3`,
`op:CFrame*Vector3`, `op:Vector3*number`.

Cover EVERY non-deprecated member: properties, methods, events, callbacks, constructors, constants,
functions, math_operations. For deprecated members (non-empty `deprecation_message` or `Deprecated` tag),
write only `{"simple": "Old — use X instead."}`. Skip `NotScriptable`/hidden internals with a one-liner
if they are useless to normal scripters.

## Writing rules (important)
- Audience: a kid (~10-13) or total beginner. Short sentences. Everyday words. Friendly, never babyish.
- NEVER use a technical word without explaining it right there or in `terms`. Words like relative, offset,
  scale, local/world space, yield, async, replicate, client, server, instance, parent, descendant,
  callback, signal, radians, magnitude, normal, vector, interpolate/lerp, deprecated, nil, pcall,
  rate limit, etc. Put each confusing word the class uses into `terms`.
- When the official text says something vague ("relative to", "offset", "in object space"), say relative
  to WHAT, offset from WHAT, with a concrete number example (e.g. "a part at (0,5,0) moved by an offset of
  (2,0,0) ends up at (2,5,0)").
- Every example must be correct, modern Luau that actually runs. Use game:GetService, task.wait (not wait),
  :Connect, `local` variables. Say where the script goes (Script in ServerScriptService, LocalScript in
  StarterPlayerScripts / StarterGui / StarterCharacterScripts). Comment the code.
- Be accurate. Base facts on the YAML + guides. If unsure about a detail, leave it out rather than guess.
- No emoji. No markdown inside strings except `inline code` with backticks (allowed) and \n in code.
- Output must be valid JSON (escape quotes and newlines). Validate each file with:
  python3 -c "import json,sys;json.load(open(sys.argv[1]))" <file>

When done, reply with just: list of files written + member counts, and anything you skipped.

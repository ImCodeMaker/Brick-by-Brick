/* Glossary: every confusing word, in plain language, with a tiny example. Auto-highlighted inside official text. */
(function () {
  const BB = window.BB;
  // [id, display, regex source (word forms), definition, example code (optional), guide id (optional)]
  const G = [
    ["relative", "Relative (to)", "relative(?:ly)? to|relative", "\"Relative to X\" means \"measured starting from X\". If your friend stands 3 steps to your right, they are at +3 relative to YOU. Relative to the door, they could be somewhere totally different. Always ask: relative to what?", "-- 5 studs above THE PART (relative to the part)\nlocal spot = part.Position + Vector3.new(0, 5, 0)", "cframe"],
    ["offset", "Offset", "offsets?", "An offset is how far something is shifted from a starting point. Start at (0, 5, 0), add an offset of (2, 0, 0), and you end at (2, 5, 0). In UI (UDim2), Offset means an exact number of pixels.", "local start = Vector3.new(0, 5, 0)\nlocal offset = Vector3.new(2, 0, 0)\nprint(start + offset) --> 2, 5, 0", "udim"],
    ["scale", "Scale (UI)", "scale", "In UI, Scale is a percent of the parent's size, written from 0 to 1. Scale 0.5 = half. On a 1000-pixel-wide screen, 0.5 = 500 pixels. On a phone 400 wide, 0.5 = 200. That's why Scale fits every screen.", "frame.Size = UDim2.fromScale(0.5, 0.25) -- half as wide, a quarter as tall", "udim"],
    ["world", "World space", "world space|world coordinates|world position|world frame|global space", "World space measures everything from the center of the whole game world (0, 0, 0) with the world's fixed directions: up is always +Y.", "print(part.Position) -- this is in world space", "cframe"],
    ["local", "Local / object space", "object space|local space|local coordinates|object-space|local-space", "Local (object) space measures from a part's own center using the part's OWN directions. \"Forward\" means wherever the part is facing, even if it is turned sideways.", "-- 5 studs in front of the part, wherever it faces\nlocal ahead = part.CFrame * CFrame.new(0, 0, -5)", "cframe"],
    ["studs", "Stud", "studs?", "Roblox's unit of length. A default character is about 5 studs tall. 1 stud ≈ 28 cm in real life (roughly).", "part.Size = Vector3.new(4, 1, 2) -- 4 studs wide, 1 tall, 2 deep"],
    ["radians", "Radians", "radians?", "Another way to measure angles. A full circle is 360 degrees, which is about 6.28 radians (2π). Roblox's CFrame.Angles wants radians, so convert with math.rad(degrees).", "CFrame.Angles(0, math.rad(90), 0) -- turn 90 degrees", "cframe"],
    ["degrees", "Degrees", "degrees?", "The everyday way to measure angles. A full turn is 360°. Orientation in Studio uses degrees; CFrame math uses radians.", "print(math.deg(math.pi)) --> 180"],
    ["vector", "Vector", "vectors?", "A vector is an arrow: it has a direction and a length. (0, 10, 0) is an arrow 10 studs long pointing straight up. Vectors can also just mean a point.", "local up = Vector3.new(0, 10, 0)\nprint(up.Magnitude) --> 10", "vectors"],
    ["magnitude", "Magnitude", "magnitudes?", "The length of a vector. For the distance between two things, subtract their positions and take the Magnitude.", "local distance = (a.Position - b.Position).Magnitude", "vectors"],
    ["unit", "Unit vector", "unit vectors?|normalized|normalize[ds]?", "A unit vector is a direction arrow with length exactly 1. It tells you WHICH WAY without saying how far. Get one with .Unit.", "local dir = (target - from).Unit -- just the direction", "vectors"],
    ["normal", "Normal", "surface normals?|normal vectors?|normals?", "A normal is an arrow sticking straight out of a surface, like a flagpole on a floor. A floor's normal points up (0, 1, 0).", "local result = workspace:Raycast(origin, dir)\nif result then print(result.Normal) end", "raycast"],
    ["dot", "Dot product", "dot products?", "A number that says how much two directions agree. 1 = same way, 0 = sideways (90°), -1 = opposite. Great for \"is the enemy in front of me?\"", "local facing = part.CFrame.LookVector:Dot(toEnemy.Unit) > 0.5", "vectors"],
    ["cross", "Cross product", "cross products?", "Gives a new arrow that sticks out at a right angle (90°) to two arrows. Used to find a sideways or perpendicular direction.", "print(Vector3.xAxis:Cross(Vector3.yAxis)) --> 0, 0, 1", "vectors"],
    ["lerp", "Lerp / interpolate", "lerp(?:s|ing|ed)?|interpolat(?:e|es|ed|ion|ing)|linear interpolation", "Lerp means \"find the in-between\". Lerp from A to B by 0.5 gives the halfway point. 0 = A, 1 = B, 0.25 = a quarter of the way.", "local mid = a:Lerp(b, 0.5) -- halfway between a and b", "vectors"],
    ["orientation", "Orientation", "orientations?", "Which way something is turned, written as degrees around X, Y and Z. (0, 90, 0) means turned 90° left/right.", "part.Orientation = Vector3.new(0, 90, 0)", "cframe"],
    ["rotation", "Rotation matrix", "rotation matri(?:x|ces)|rotational component", "Inside a CFrame, rotation is stored as 3 direction arrows: RightVector, UpVector and LookVector. Together they are called the rotation matrix. You rarely touch it directly.", "print(part.CFrame.LookVector) -- one row of that matrix", "cframe"],
    ["euler", "Euler angles", "euler angles?", "Describing a rotation as three turns: around X, around Y and around Z, done in a certain order. The ORDER changes the result!", "CFrame.fromEulerAnglesXYZ(math.rad(30), 0, 0)", "cframe"],
    ["axis", "Axis", "ax[ie]s", "An imaginary line. X goes left-right (red in Studio), Y goes up-down (green), Z goes forward-back (blue).", "print(Vector3.yAxis) --> 0, 1, 0 (straight up)", "vectors"],
    ["pivot", "Pivot", "pivots?", "The point a model or part turns around and moves by. For models, :PivotTo() moves the whole thing using its pivot.", "model:PivotTo(CFrame.new(0, 10, 0))", "cframe"],
    ["origin", "Origin", "origins?", "The starting point. The world origin is (0, 0, 0). A ray's origin is where the laser starts.", "workspace:Raycast(origin, direction)", "raycast"],
    ["instance", "Instance", "instances?", "Any object in the game: a Part, a Script, a Sound, a Folder, a Player… Everything in the Explorer window is an Instance.", "local part = Instance.new(\"Part\")\npart.Parent = workspace", "tree"],
    ["parent", "Parent", "parent(?:ed|s|ing)?", "The object something sits INSIDE in the Explorer. If a Part is in a Model, the Model is its Parent. Setting .Parent is how you put things into the game.", "part.Parent = workspace -- now it's in the world", "tree"],
    ["child", "Child / Children", "child(?:ren)?", "Objects directly inside another object. :GetChildren() gives you a list of them (only one level deep).", "for _, child in model:GetChildren() do print(child.Name) end", "tree"],
    ["descendant", "Descendant", "descendants?", "Everything inside an object, at ANY depth: children, children's children, and so on.", "for _, d in model:GetDescendants() do print(d.Name) end", "tree"],
    ["ancestor", "Ancestor", "ancestors?|ancestry", "Anything an object is inside of, going up: its parent, its parent's parent… all the way to game.", "print(part:FindFirstAncestorOfClass(\"Model\"))", "tree"],
    ["hierarchy", "Hierarchy", "hierarch(?:y|ies)|data model|datamodel", "The tree of everything in the game, like folders inside folders. It's what the Explorer window shows. The very top is `game` (also called the DataModel).", "print(part:GetFullName()) --> Workspace.House.Door", "tree"],
    ["service", "Service", "services?", "A built-in Roblox helper that does one job (Players, TweenService, DataStoreService…). There's exactly one of each. Get them with game:GetService().", "local TweenService = game:GetService(\"TweenService\")"],
    ["property", "Property", "propert(?:y|ies)", "A setting on an object, like a Part's Color, Size or Anchored. You read it with object.Name and change it with object.Name = value.", "part.Color = Color3.fromRGB(255, 0, 0)"],
    ["method", "Method", "methods?", "An action an object can do. You call it with a colon: object:DoThing(). The colon secretly passes the object itself in.", "part:Destroy()"],
    ["event", "Event", "events?|signals?", "Something that happens, like a player joining or a part being touched. You :Connect() a function to it so your code runs every time it happens.", "part.Touched:Connect(function(hit) print(hit.Name) end)", "events"],
    ["fires", "Fires / fired", "fire[sd]?|firing", "When an event \"fires\", it means it just happened and all connected functions run now.", "remote:FireServer(\"hi\") -- makes OnServerEvent fire on the server", "events"],
    ["callback", "Callback", "callbacks?", "A function YOU write that Roblox will call later, at the right moment. You hand it over and Roblox calls you back.", "remoteFunction.OnServerInvoke = function(player) return 42 end", "events"],
    ["connect", "Connect / connection", "connections?|connect(?:ed|s|ing)?", ":Connect(fn) tells an event \"run this function every time you happen\". It returns a connection you can :Disconnect() to stop.", "local conn = part.Touched:Connect(onTouch)\nconn:Disconnect() -- stop listening", "events"],
    ["yield", "Yield", "yield(?:s|ing|ed)?", "To yield means to PAUSE this script and wait. The next line runs only after the wait is over. task.wait(2) yields for 2 seconds. Functions ending in Async often yield.", "print(\"A\")\ntask.wait(2) -- yields here\nprint(\"B\") -- 2 seconds later", "events"],
    ["async", "Async", "async(?:hronous(?:ly)?)?", "Async (asynchronous) means \"takes time, usually talking to the internet\". Async functions pause your script until they finish and can fail, so wrap them in pcall.", "local ok, data = pcall(function()\n\treturn store:GetAsync(key)\nend)", "events"],
    ["thread", "Thread", "threads?|coroutines?", "A thread is a piece of code running on its own path. task.spawn starts a new thread so two things can happen without waiting on each other.", "task.spawn(function()\n\ttask.wait(5)\n\tprint(\"5 seconds later\")\nend)\nprint(\"runs right away\")", "events"],
    ["pcall", "pcall", "pcall|protected call", "pcall = \"protected call\". It runs a function and CATCHES errors instead of crashing your script. It returns ok (true/false) and then the result or the error message.", "local ok, err = pcall(function() error(\"oops\") end)\nprint(ok, err) --> false  oops"],
    ["nil", "nil", "nil", "nil means \"nothing\" or \"doesn't exist\". FindFirstChild gives nil if nothing has that name.", "if workspace:FindFirstChild(\"Door\") == nil then print(\"no door!\") end"],
    ["client", "Client", "clients?|client-side|client side", "The client is the player's own device (phone, PC, console) running the game. LocalScripts run there. Each player has their own client.", "-- LocalScript (runs on the client)\nprint(game.Players.LocalPlayer.Name)", "network"],
    ["server", "Server", "servers?|server-side|server side", "The server is Roblox's computer that runs the real copy of your game for everyone in it. Normal Scripts run there. It is the boss: it decides what's true.", "-- Script in ServerScriptService (runs on the server)\nprint(\"Hello from the server\")", "network"],
    ["replicate", "Replicate", "replicat(?:e|es|ed|ion|ing)", "To replicate means to copy changes across the network. When the server changes a part's color, Roblox replicates it to every player so they all see it.", "-- on the server:\npart.Color = Color3.new(1, 0, 0) -- every player sees red", "network"],
    ["remote", "Remote", "remote events?|remote functions?|remotes?", "RemoteEvents and RemoteFunctions are how a client and the server send messages to each other. Put them in ReplicatedStorage.", "remote:FireServer(\"jump\") -- client -> server", "network"],
    ["exploiter", "Exploiter", "exploit(?:er|ers|s|ing)?|cheat(?:er|ers|ing)?", "A cheater who can run their own code on THEIR client. That's why the server must check everything a client sends.", "if coins < price then return end -- server-side check", "network"],
    ["filtering", "Filtering", "filtering ?enabled|filtered|filter(?:s|ing)?", "Two meanings: (1) text filtering hides bad words in chat or signs; (2) in raycasts, a filter list says which objects to ignore or include.", "params.FilterDescendantsInstances = {character}", "raycast"],
    ["ownership", "Network ownership", "network owner(?:ship)?", "Which computer (server or a player) runs the physics for a part. Players usually own their own character so it feels smooth.", "part:SetNetworkOwner(nil) -- server runs its physics", "physics"],
    ["deprecated", "Deprecated", "deprecat(?:ed|ion)", "Old and replaced by something newer. It may still work, but you shouldn't use it in new code.", "-- old: wait(1)\ntask.wait(1) -- new"],
    ["enum", "Enum", "enums?|enumerations?|enum items?", "A fixed list of named choices. Instead of typing magic numbers, you pick one like Enum.Material.Neon.", "part.Material = Enum.Material.Neon", null],
    ["datatype", "Data type", "data ?types?", "A kind of value, like a number, text (string), true/false (boolean), Vector3 or CFrame.", "print(typeof(Vector3.new())) --> Vector3"],
    ["class", "Class", "class(?:es)?", "A type of object, like a blueprint. Part is a class; each part you place is an Instance of that class. Classes can inherit from others.", "print(part.ClassName) --> Part", "tree"],
    ["inherit", "Inherit", "inherit(?:s|ed|ance|ing)?|superclass|subclass(?:es)?", "If class B inherits from class A, B gets all of A's properties, methods and events for free. Part inherits from BasePart, which inherits from Instance.", "print(part:IsA(\"BasePart\")) --> true", "tree"],
    ["argument", "Argument / parameter", "arguments?|parameters?|params?", "Values you hand to a function inside the brackets. In part:SetAttribute(\"Coins\", 5), \"Coins\" and 5 are the arguments.", "print(math.max(3, 9)) -- 3 and 9 are arguments"],
    ["return", "Return", "returns?|returned", "What a function gives back to you. local x = math.max(3, 9) — math.max returns 9, so x is 9.", "local count = #workspace:GetChildren() -- # returns the length"],
    ["tween", "Tween", "tween(?:s|ing|ed)?", "A smooth animation of a property from its current value to a goal over time. \"Tween\" comes from \"in-between\".", "TweenService:Create(part, TweenInfo.new(1), {Transparency = 1}):Play()", "tweens"],
    ["easing", "Easing", "easing(?: styles?| directions?)?", "How a tween speeds up or slows down. Linear = same speed. Quad Out = fast then slow. Bounce = bounces at the end.", "TweenInfo.new(1, Enum.EasingStyle.Bounce, Enum.EasingDirection.Out)", "tweens"],
    ["velocity", "Velocity", "velocit(?:y|ies)|linear velocity", "How fast AND which way something moves, in studs per second. (0, 50, 0) = moving up at 50 studs/sec.", "part.AssemblyLinearVelocity = Vector3.new(0, 50, 0)", "physics"],
    ["acceleration", "Acceleration", "accelerat(?:ion|e|es|ed|ing)", "How quickly velocity changes. Gravity accelerates things down by 196.2 studs per second, every second.", "-- Newton: acceleration = force / mass", "physics"],
    ["force", "Force", "forces?", "A push or pull. A bigger force moves things faster; a heavier thing needs more force. Force = mass × acceleration.", "vectorForce.Force = Vector3.new(0, part.AssemblyMass * workspace.Gravity, 0) -- hover!", "physics"],
    ["mass", "Mass", "mass(?:es)?", "How heavy something is. Bigger or denser parts have more mass. Read it with part:GetMass() or part.AssemblyMass.", "print(part.AssemblyMass)", "physics"],
    ["gravity", "Gravity", "gravity", "The pull downward. In Roblox, workspace.Gravity is 196.2 studs per second squared by default. Lower = floaty moon jumps.", "workspace.Gravity = 50 -- moon mode", "physics"],
    ["torque", "Torque", "torques?", "A twisting force. Force pushes; torque spins. Like turning a doorknob.", "torque.Torque = Vector3.new(0, 1000, 0) -- spin around Y", "physics"],
    ["impulse", "Impulse", "impulses?", "A one-time instant kick (like hitting a ball), instead of a force that keeps pushing.", "part:ApplyImpulse(Vector3.new(0, 500, 0))", "physics"],
    ["assembly", "Assembly", "assembl(?:y|ies)", "A group of parts welded or joined so they move together as one physical object.", "print(part.AssemblyRootPart)", "physics"],
    ["anchored", "Anchored", "anchored|anchor(?!point)", "An anchored part is frozen in place: gravity and physics can't move it. Scripts can still move it by setting its Position or CFrame.", "part.Anchored = true", "physics"],
    ["anchorpoint", "AnchorPoint", "anchor ?points?", "In UI, the point of the frame that its Position refers to. (0,0) = top-left corner, (0.5,0.5) = the middle, (1,1) = bottom-right.", "frame.AnchorPoint = Vector2.new(0.5, 0.5)\nframe.Position = UDim2.fromScale(0.5, 0.5) -- perfectly centered", "udim"],
    ["pixel", "Pixel", "pixels?|px", "One tiny dot on the screen. A 1920×1080 screen is 1920 dots wide and 1080 tall. UI Offset is in pixels.", "frame.Size = UDim2.fromOffset(200, 100) -- 200 by 100 pixels", "udim"],
    ["absolute", "Absolute", "absolute(?:position|size)?", "Absolute means \"the final real result in pixels\" after Scale and Offset are worked out. AbsoluteSize of a 0.5-scale frame on a 1000px screen is 500.", "print(frame.AbsoluteSize) --> 500, 300", "udim"],
    ["viewport", "Viewport", "viewports?", "The part of the screen where the 3D game is drawn. Its size is camera.ViewportSize.", "print(workspace.CurrentCamera.ViewportSize)"],
    ["render", "Render / frame", "render(?:ed|s|ing)?|frames? per second|fps", "Rendering is drawing a picture of the game on screen. This happens about 60 times a second; each picture is one frame.", "RunService.RenderStepped:Connect(function(dt) end)", "events"],
    ["deltatime", "Delta time (dt)", "delta ?time|deltatime|\\bdt\\b|step(?:ped)? time", "The time, in seconds, since the last frame. Usually about 0.016 (1/60). Multiply speeds by it so movement is smooth on fast AND slow devices.", "part.Position += Vector3.new(0, 0, 10 * dt) -- 10 studs per second", "events"],
    ["raycast", "Raycast", "raycast(?:s|ing)?|rays?", "Shooting an invisible laser from a point in a direction to see what it hits first. Used for guns, line of sight and ground checks.", "local hit = workspace:Raycast(origin, Vector3.new(0, -10, 0))", "raycast"],
    ["attribute", "Attribute", "attributes?", "Your own custom setting you can put on any object (like \"Health\" or \"Team\"). Set with :SetAttribute, read with :GetAttribute.", "part:SetAttribute(\"Coins\", 10)\nprint(part:GetAttribute(\"Coins\")) --> 10"],
    ["tag", "Tag", "tags?|collection tags?", "A label you stick on objects so you can find all of them, using CollectionService. Like putting a \"Lava\" sticker on every lava part.", "CollectionService:AddTag(part, \"Lava\")"],
    ["throttle", "Rate limit / throttle", "throttl(?:e|ed|ing)|rate limits?|budgets?|limits?", "Roblox only lets you call some functions so many times per minute. Go over and requests are slowed down or fail. Save less often, not every second.", "-- save when the player leaves, not every frame"],
    ["datastore", "Data store", "data ?stores?", "Roblox's save system. It keeps info (coins, levels) even after a player leaves, so it's there next time.", "local store = game:GetService(\"DataStoreService\"):GetDataStore(\"Coins\")", "network"],
    ["userid", "UserId", "user ?ids?", "A player's permanent ID number. Names can change; UserId never does. Use it as the key when saving data.", "print(player.UserId) --> 123456789"],
    ["humanoid", "Humanoid", "humanoids?", "The object inside a character that makes it act like a person: walking, jumping, health and dying.", "humanoid.WalkSpeed = 32 -- run fast", "players"],
    ["character", "Character", "characters?|avatars?", "The 3D body a player controls in the world (a Model with a Humanoid). Player.Character points to it. It's replaced every respawn.", "local character = player.Character or player.CharacterAdded:Wait()", "players"],
    ["spawn", "Spawn / respawn", "respawn(?:s|ed|ing)?|spawn(?:s|ed|ing)?", "When a character appears in the world. After dying, a new character spawns after Players.RespawnTime seconds (5 by default).", "player:LoadCharacterAsync() -- spawn right now", "players"],
    ["experience", "Experience", "experiences?|places?|universes?", "\"Experience\" is Roblox's word for a game. One experience (universe) can have several places (levels or worlds).", "print(game.PlaceId, game.GameId)"],
    ["module", "ModuleScript / require", "module ?scripts?|modules?|require[sd]?", "A ModuleScript holds code you want to reuse. require(module) runs it once and gives back what it returns (usually a table of functions).", "local Utils = require(game.ReplicatedStorage.Utils)\nUtils.sayHi()"],
    ["debounce", "Debounce", "debounce|cooldowns?", "A trick to stop something firing many times in a row, like Touched firing 20 times in one bump. Use a true/false flag as a cooldown.", "local busy = false\npart.Touched:Connect(function()\n\tif busy then return end\n\tbusy = true\n\ttask.wait(1)\n\tbusy = false\nend)"],
    ["clamp", "Clamp", "clamp(?:s|ed)?", "Keep a number inside a range. math.clamp(15, 0, 10) gives 10 because 15 is too big.", "health = math.clamp(health, 0, 100)"],
  ];
  BB.glossary = G.map(([id, name, re, def, ex, guide]) => ({ id, name, re, def, ex, guide }));
  const byId = {};
  BB.glossary.forEach((g) => (byId[g.id] = g));
  BB.term = (id) => byId[id];

  // one big alternation; each group is named by index
  const big = new RegExp("\\b(?:" + BB.glossary.map((g) => "(" + g.re.replace(/\((?!\?)/g, "(?:") + ")").join("|") + ")\\b", "gi");

  /** Wrap the first mention of each term inside `root` (skips code, links, headings). */
  BB.markTerms = function (root) {
    if (!root || root.dataset.marked) return;
    root.dataset.marked = "1";
    const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        let p = n.parentElement;
        while (p && p !== root) {
          if (/^(CODE|PRE|A|BUTTON|H1|H2|H3|H4|H5|SUMMARY)$/.test(p.tagName) || p.classList.contains("term")) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return n.nodeValue.trim().length > 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      big.lastIndex = 0;
      let m, last = 0, frag = null;
      while ((m = big.exec(text))) {
        let gi = -1;
        for (let i = 1; i < m.length; i++) if (m[i] !== undefined) { gi = i - 1; break; }
        const g = BB.glossary[gi];
        if (!g || seen.has(g.id)) continue;
        seen.add(g.id);
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const b = document.createElement("button");
        b.className = "term";
        b.type = "button";
        b.dataset.term = g.id;
        b.textContent = m[0];
        frag.appendChild(b);
        last = m.index + m[0].length;
      }
      if (frag) {
        frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
  };
})();

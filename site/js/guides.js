/* Hand-written guides. Each one pairs plain explanations with a lab. */
(function () {
  const BB = window.BB;
  const { html } = window.htmPreact;
  const C = (code) => html`<${BB.Code} code=${code} />`;
  const R = (k, n, label) => html`<a class="ref" href=${`#/${k}/${n}`}><code>${label || n}</code></a>`;
  const Note = ({ kind = "", title, children }) => html`<div class=${"callout " + kind}><h4>${title}</h4>${children}</div>`;

  BB.guides = [
    {
      id: "network", title: "How a Roblox game runs", short: "Server, clients, and how they talk (spoiler: not HTTP).",
      official: "https://create.roblox.com/docs/projects/client-server",
      body: () => html`
        <div class="prose">
          <p>When you press Play, you are not running the whole game alone. There are two kinds of computers involved.</p>
          <ul>
            <li><b>The server</b> is a Roblox computer in a data center. It runs the "real" copy of the game for everyone in that match. Your <b>Scripts</b> run here. Roblox gives you this server for free, so you never set one up.</li>
            <li><b>Clients</b> are each player's own device (PC, phone, Xbox). <b>LocalScripts</b> run here, handling things like the camera, keyboard and the UI on your screen.</li>
          </ul>
          <p>They talk using Roblox's own fast network connection, <b>not HTTP</b> (the thing web pages use). Two things travel over it:</p>
          <ul>
            <li><b>Replication</b>: when the server changes something in Workspace, Roblox automatically copies the change to every player.</li>
            <li><b>Remotes</b>: ${R("class", "RemoteEvent")} and ${R("class", "RemoteFunction")} let you send your own messages between a client and the server.</li>
          </ul>
          <p>HTTP only shows up when the <b>server</b> calls an outside website with ${R("class", "HttpService")}. Clients aren't allowed to do that.</p>
        </div>
        <${BB.NetworkLab} />
        <h2>How do I make everyone see what ONE player does?</h2>
        <div class="prose">
          <p>Say Player A presses E to spin a wheel. If A's LocalScript does it, <b>only A sees it</b>: changes made on a player's device stay there. To make everyone see it, you have three options:</p>
          <ol>
            <li><b>Ask the server.</b> A sends a RemoteEvent, the server spins the wheel, and replication sends it to everyone. Safest. Best for anything important.</li>
            <li><b>Let the player own it.</b> The server gives A <b>network ownership</b> of the car. A's device runs its physics, and that physics is sent to everyone. Best for things a player drives.</li>
            <li><b>Tell every player.</b> The server passes A's message on with <code>FireAllClients</code>, and every device spins its own copy. Best for effects that are only for looks.</li>
          </ol>
          <p>Pick a scenario in the lab, press <b>Player A presses E</b>, and count how many players see it spin. The code for each one (client AND server) is underneath.</p>
        </div>
        <${BB.ReplicationLab} />
        <div class="grid2">
          <${Note} kind="bad" title="Never trust the client"><p style="margin:0">Cheaters (exploiters) can run their own code on THEIR device and send any message they want through your RemoteEvents. The server must double-check everything: "Does this player really have enough coins? Are they close enough to the shop?"</p><//>
          <${Note} kind="ok" title="Rule of thumb"><p style="margin:0">Important stuff (money, damage, saving) happens on the <b>server</b>. Looks and controls (UI, camera, effects) happen on the <b>client</b>.</p><//>
        </div>
        <h2>Sending a message from a player to the server</h2>
        <div class="grid2">
          <div class="ex"><span class="place">LocalScript in <b>StarterPlayerScripts</b></span>${C(`local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal buy = ReplicatedStorage:WaitForChild("BuyItem")\n\n-- ask the server to buy a sword\nbuy:FireServer("Sword")`)}</div>
          <div class="ex"><span class="place">Script in <b>ServerScriptService</b></span>${C(`local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal buy = ReplicatedStorage.BuyItem\nlocal PRICES = { Sword = 100 }\n\n-- Roblox adds 'player' as the first value for you\nbuy.OnServerEvent:Connect(function(player, itemName)\n\tlocal price = PRICES[itemName]\n\tif not price then return end -- unknown item: ignore\n\tlocal coins = player.leaderstats.Coins\n\tif coins.Value < price then return end -- can't afford it\n\tcoins.Value -= price\n\tprint(player.Name .. " bought " .. itemName)\nend)`)}</div>
        </div>`,
    },
    {
      id: "tree", title: "The Explorer tree", short: "Parent, children, descendants and finding things.",
      official: "https://create.roblox.com/docs/studio/explorer",
      body: () => html`
        <div class="prose">
          <p>Everything in a Roblox game lives in one big tree, like folders inside folders. Studio shows it in the <b>Explorer</b> window. The very top is <code>game</code>. Every item in the tree is an ${R("class", "Instance")}.</p>
          <p>Family words describe where things are:</p>
          <ul>
            <li><b>Parent</b>: the thing it's directly inside. A Door in a House has the House as its Parent.</li>
            <li><b>Children</b>: things directly inside it (one level down).</li>
            <li><b>Descendants</b>: everything inside it at any depth.</li>
            <li><b>Ancestors</b>: everything it's inside, all the way up to <code>game</code>.</li>
          </ul>
        </div>
        <${BB.TreeLab} />
        <h2>Three ways to find something</h2>
        <div class="grid2">
          <${Note} title="Dot: workspace.House"><p style="margin:0">Short and fast. But if House doesn't exist (yet), your script errors and stops.</p><//>
          <${Note} title=":FindFirstChild(\"House\")"><p style="margin:0">Looks once. Gives back the object, or <code>nil</code> if it isn't there. Doesn't wait.</p><//>
          <${Note} kind="ok" title=":WaitForChild(\"House\")"><p style="margin:0">Waits until it exists, then gives it back. Use it in LocalScripts, because things may still be loading on the player's device.</p><//>
        </div>
        <h2>Making new things</h2>
        ${C(`local part = Instance.new("Part")   -- make it (it's nowhere yet)\npart.Size = Vector3.new(4, 1, 2)\npart.Anchored = true\npart.Position = Vector3.new(0, 10, 0)\npart.Parent = workspace             -- set Parent LAST: now it appears!`)}`,
    },
    {
      id: "events", title: "Events and waiting", short: "Connect, yield, task.wait and task.spawn.",
      official: "https://create.roblox.com/docs/scripting/events",
      body: () => html`
        <div class="prose">
          <p>An <b>event</b> is something that happens: a player joins, a part is touched, a button is clicked. You don't keep checking for it. You <b>connect</b> a function, and Roblox runs that function every time the event <b>fires</b>.</p>
          <p>Some lines make your script <b>yield</b>, which means pause and wait. ${R("library", "task")}<code>.wait(2)</code> pauses for 2 seconds. Functions whose names end in <b>Async</b> (like <code>GetAsync</code>) usually pause while they talk to Roblox's servers.</p>
        </div>
        <${BB.EventsLab} />
        <h2>Stop listening</h2>
        ${C(`local connection\nconnection = part.Touched:Connect(function(hit)\n\tprint("Touched once by", hit.Name)\n\tconnection:Disconnect() -- stop: this won't run again\nend)`)}
        <${Note} title="Touched fires a LOT"><p style="margin:0">One step can touch a part 5 times (each foot, each leg). Add a <b>debounce</b>: a true/false flag that blocks repeats for a moment.</p><//>
        ${C(`local busy = false\npart.Touched:Connect(function(hit)\n\tif busy then return end\n\tbusy = true\n\tprint("Ouch!")\n\ttask.wait(1)      -- cooldown\n\tbusy = false\nend)`)}`,
    },
    {
      id: "vectors", title: "Vectors", short: "Arrows with X, Y, Z: add, subtract, length, Dot, Lerp.",
      official: "https://create.roblox.com/docs/reference/engine/datatypes/Vector3",
      body: () => html`
        <div class="prose">
          <p>A ${R("datatype", "Vector3")} is three numbers: <b class="ax-x">X</b> (left/right), <b class="ax-y">Y</b> (up/down) and <b class="ax-z">Z</b> (forward/back). You can think of it two ways:</p>
          <ul><li>a <b>point</b>: "the spot (0, 10, 0)", 10 studs above the center of the world;</li><li>an <b>arrow</b>: "go 10 studs up from wherever you are".</li></ul>
          <p>The playground is 2D so it's easy to see. Vector3 math works exactly the same, just with a Z too.</p>
        </div>
        <${BB.VectorLab} />
        <h2>Recipes you'll use all the time</h2>
        <div class="grid2">
          <div class="ex"><b>How far apart are two things?</b>${C(`local distance = (a.Position - b.Position).Magnitude\nif distance < 10 then\n\tprint("Close!")\nend`)}</div>
          <div class="ex"><b>Which way should I shoot?</b>${C(`-- direction from gun to target, length 1\nlocal dir = (target.Position - gun.Position).Unit\nlocal bulletVelocity = dir * 200 -- 200 studs/sec`)}</div>
          <div class="ex"><b>Is the enemy in front of me?</b>${C(`local toEnemy = (enemy.Position - me.Position).Unit\nlocal facing = me.CFrame.LookVector:Dot(toEnemy)\nif facing > 0.5 then print("I can see you") end`)}</div>
          <div class="ex"><b>Move halfway there</b>${C(`part.Position = part.Position:Lerp(goal, 0.5)`)}</div>
        </div>
        <h2>Now in real 3D: Cross and Dot</h2>
        <${BB.Vector3DLab} />`,
    },
    {
      id: "math", title: "Trigonometry and the math library", short: "sin, cos, atan2, clamp, lerp, random and noise, animated.",
      official: "https://create.roblox.com/docs/reference/engine/libraries/math",
      body: () => html`
        <div class="prose">
          <p>Trigonometry sounds scary, but in games you only need three ideas:</p>
          <ul>
            <li><b>cos(angle)</b> and <b>sin(angle)</b> tell you where you are on a circle: how far right, and how far up. Grow the angle and you go around.</li>
            <li><b>sin of time</b> goes up and down smoothly forever: floating coins, breathing lights, bobbing boats.</li>
            <li><b>atan2(y, x)</b> goes backwards: from "how far right and up is the target" to "what angle do I turn to face it".</li>
          </ul>
          <p>Roblox angles use <b>radians</b>: a full circle is about 6.28 (2 × π). Turn degrees into radians with <code>math.rad(degrees)</code>.</p>
        </div>
        <${BB.TrigLab} />
        <h2>The math library</h2>
        <div class="prose"><p>${R("library", "math")} is full of small helpers. These are the ones you'll use every week.</p></div>
        <${BB.MathLab} />`,
    },
    {
      id: "cframe", title: "CFrames", short: "Position plus rotation, and local vs world moves.",
      official: "https://create.roblox.com/docs/workspace/cframes",
      body: () => html`
        <div class="prose">
          <p>A ${R("datatype", "CFrame")} ("coordinate frame") stores <b>where</b> something is AND <b>which way it's facing</b>. A Vector3 position alone can't tell you which way a car is pointing. A CFrame can.</p>
          <p>Inside every CFrame are three direction arrows, each 1 stud long:</p>
          <ul>
            <li><b class="ax-z">LookVector</b>: the part's front. In Roblox, the front is the part's <b>−Z</b> side.</li>
            <li><b class="ax-x">RightVector</b>: the part's right side (+X).</li>
            <li><b class="ax-y">UpVector</b>: the part's top (+Y).</li>
          </ul>
        </div>
        <${BB.CFrameLab} />
        <h2>The big idea: local vs world</h2>
        <div class="grid2">
          <${Note} kind="ok" title="cf * CFrame.new(...) = relative to the part"><p style="margin:0">"Move 5 studs forward <i>from the part's point of view</i>." If it's turned, the move turns with it. Use it for walking forward, putting a gun at a hand, or placing something in front of a player.</p><//>
          <${Note} title="cf + Vector3.new(...) = world directions"><p style="margin:0">"Move 5 studs toward world −Z," no matter how the part is turned. Use it for "lift it up 5 studs" (up is up for everyone).</p><//>
        </div>
        ${C(`-- make a part, turned 90° left\nlocal cf = CFrame.new(0, 5, 0) * CFrame.Angles(0, math.rad(90), 0)\n\nprint((cf * CFrame.new(0, 0, -10)).Position)  --> -10, 5, 0   (10 forward, its way)\nprint((cf + Vector3.new(0, 0, -10)).Position) --> 0, 5, -10   (10 toward world -Z)`)}
        <h2>Angles use radians</h2>
        <div class="prose"><p>${R("datatype", "CFrame", "CFrame.Angles")} wants <b>radians</b>, not degrees. A full turn is 360° = about 6.28 radians. Don't do the math yourself; wrap degrees in <code>math.rad()</code>.</p></div>
        ${C(`part.CFrame = part.CFrame * CFrame.Angles(0, math.rad(45), 0) -- turn 45° more`)}
        <h2>Point something at a target</h2>
        ${C(`-- stand at 'from' and look at 'target'\npart.CFrame = CFrame.lookAt(from, target.Position)`)}
        <${Note} title="Order matters with *"><p style="margin:0"><code>a * b</code> means "start at a, then do b <i>from a's point of view</i>". <code>CFrame.new(10,0,0) * CFrame.Angles(0, math.rad(90), 0)</code> moves then turns in place. Swap them and it turns first, then walks 10 "sideways" along its new direction, ending somewhere else.</p><//>`,
    },
    {
      id: "physics", title: "Forces and physics", short: "Mass, gravity, VectorForce, impulses, and hovering.",
      official: "https://create.roblox.com/docs/physics/mechanical-constraints",
      body: () => html`
        <div class="prose">
          <p>Roblox has a real physics engine. Unanchored parts fall, bounce and get pushed. Here are the words:</p>
          <ul>
            <li><b>Mass</b>: how heavy. Bigger or denser parts have more. Read <code>part.AssemblyMass</code>.</li>
            <li><b>Gravity</b>: <code>workspace.Gravity</code>, 196.2 by default. It pulls everything down.</li>
            <li><b>Force</b>: a push that keeps pushing, like a rocket engine (${R("class", "VectorForce")}).</li>
            <li><b>Impulse</b>: one instant kick, like a bat hitting a ball (<code>part:ApplyImpulse()</code>).</li>
            <li><b>Velocity</b>: speed plus direction, in studs per second.</li>
          </ul>
          <p>The one rule that explains it all: <b>acceleration = force ÷ mass</b>. Twice as heavy means you need twice the push.</p>
        </div>
        <${BB.ForceLab} />
        <h2>Which one should I use?</h2>
        <p class="lede" style="font-size:1rem">Every card is a live simulation. Click one to open its full anatomy lab: every property on a slider, labeled parts, setup steps and code.</p>
        <${BB.MoverPicker} />
        <${Note} title="Almost everything needs an Attachment"><p style="margin:0">Constraints and movers connect to ${R("class", "Attachment")}s: small points (green dots in the labs) you put inside parts. Their <b style="color:#c99a00">yellow arrow</b> (primary axis) decides the direction: the line a hinge turns around, the line a slider moves along. Set <code>Attachment0</code> (and usually <code>Attachment1</code>) or nothing happens.</p><//>
        <h2>A full anatomy lab: the hinge</h2>
        <${BB.PhysLab} name="HingeConstraint" />
        <h2>What a part is made of</h2>
        <${BB.MaterialLab} />`,
    },
    {
      id: "udim", title: "UI sizes: Scale vs Offset", short: "UDim2, AnchorPoint, and why your UI breaks on phones.",
      official: "https://create.roblox.com/docs/ui/position-and-size",
      body: () => html`
        <div class="prose">
          <p>UI positions and sizes use ${R("datatype", "UDim2")}, which is four numbers: <code>UDim2.new(xScale, xOffset, yScale, yOffset)</code>. Each direction mixes two ideas:</p>
          <ul>
            <li><b>Scale</b> = a percent of the parent (the screen, or the frame it's in), written from 0 to 1. <code>0.5</code> = half. It stretches with the screen.</li>
            <li><b>Offset</b> = an exact number of <b>pixels</b>. It never changes, whatever the screen.</li>
          </ul>
          <p>The final size is <b>Scale × parent size + Offset</b>. So on a 1000-pixel-wide screen, <code>UDim2.new(0.5, 20, …)</code> is 0.5 × 1000 + 20 = <b>520 pixels</b>.</p>
          <p><b>AnchorPoint</b> picks which point of the frame sits at its Position. (0, 0) is the top-left corner (the default). (0.5, 0.5) is the middle, which is how you center things.</p>
        </div>
        <${BB.UDimLab} />
        <h2>Copy-paste recipes</h2>
        <div class="grid2">
          <div class="ex"><b>Perfectly centered</b>${C(`frame.AnchorPoint = Vector2.new(0.5, 0.5)\nframe.Position = UDim2.fromScale(0.5, 0.5)`)}</div>
          <div class="ex"><b>Full width bar at the bottom</b>${C(`frame.AnchorPoint = Vector2.new(0, 1)\nframe.Position = UDim2.fromScale(0, 1)\nframe.Size = UDim2.new(1, 0, 0, 60) -- 100% wide, 60px tall`)}</div>
          <div class="ex"><b>Button 20px from the top-right</b>${C(`button.AnchorPoint = Vector2.new(1, 0)\nbutton.Position = UDim2.new(1, -20, 0, 20)`)}</div>
          <div class="ex"><b>Health bar (fill = health %)</b>${C(`fill.Size = UDim2.fromScale(humanoid.Health / humanoid.MaxHealth, 1)`)}</div>
        </div>`,
    },
    {
      id: "tweens", title: "Tweens and easing", short: "Smooth animations of any property.",
      official: "https://create.roblox.com/docs/ui/animation",
      body: () => html`
        <div class="prose">
          <p>A <b>tween</b> (from "in-be<b>tween</b>") smoothly changes properties from where they are now to a goal, over some time. Doors sliding, UI popping in, a part fading away: all tweens. You make them with ${R("class", "TweenService")}.</p>
          <p>${R("datatype", "TweenInfo")} says <b>how</b>: how long it takes, and the <b>easing</b>, meaning whether it starts slow, ends slow, bounces or wobbles.</p>
        </div>
        <${BB.EasingLab} />
        <h2>All of TweenInfo, one value at a time</h2>
        ${C(`local info = TweenInfo.new(\n\t2,                          -- time: 2 seconds\n\tEnum.EasingStyle.Quad,      -- the curve shape\n\tEnum.EasingDirection.Out,   -- slow at the end\n\t0,                          -- repeat count (-1 = forever)\n\tfalse,                      -- reverse back afterwards?\n\t0                           -- delay before starting (seconds)\n)\n\nlocal tween = TweenService:Create(door, info, { CFrame = openCFrame })\ntween:Play()\ntween.Completed:Wait() -- wait until it's done\nprint("Door open!")`)}`,
    },
    {
      id: "raycast", title: "Raycasting", short: "Shoot an invisible laser and see what it hits.",
      official: "https://create.roblox.com/docs/workspace/raycasting",
      body: () => html`
        <div class="prose">
          <p>A raycast shoots an invisible laser and tells you the <b>first</b> thing it hits. Guns, "is the player on the ground?", "can the NPC see me?" all use raycasts.</p>
          <p><code>workspace:Raycast(origin, direction, params)</code> needs:</p>
          <ul>
            <li><b>origin</b>: a Vector3 where the laser starts.</li>
            <li><b>direction</b>: a Vector3 arrow for which way it goes AND how far. Its length is the range. <code>Vector3.new(0, -10, 0)</code> checks 10 studs straight down.</li>
            <li><b>params</b> (optional): a ${R("datatype", "RaycastParams")} with what to ignore.</li>
          </ul>
          <p>You get a ${R("datatype", "RaycastResult")} back, or <code>nil</code> if it hit nothing.</p>
        </div>
        <${BB.RaycastLab} />
        <h2>Shoot where the player is looking</h2>
        ${C(`local origin = head.Position\nlocal direction = head.CFrame.LookVector * 100 -- 100 studs ahead\n\nlocal params = RaycastParams.new()\nparams.FilterType = Enum.RaycastFilterType.Exclude\nparams.FilterDescendantsInstances = { character } -- don't hit yourself\n\nlocal result = workspace:Raycast(origin, direction, params)\nif result and result.Instance.Parent:FindFirstChild("Humanoid") then\n\tresult.Instance.Parent.Humanoid:TakeDamage(10)\nend`)}`,
    },
    {
      id: "players", title: "Players and characters", short: "Joining, spawning, dying, respawning and leaving.",
      official: "https://create.roblox.com/docs/players",
      body: () => html`
        <div class="prose">
          <p>Two different things are easy to mix up:</p>
          <ul>
            <li>The <b>${R("class", "Player")}</b> is the <i>person</i>. It lives in the ${R("class", "Players")} service from the moment they join until they leave. It knows their Name, UserId, team and so on.</li>
            <li>The <b>character</b> is the <i>body</i>: a Model with a ${R("class", "Humanoid")} that walks around Workspace. <code>player.Character</code> points to it. A new body is made every time they respawn.</li>
          </ul>
          <p>Each Player also has four containers: <b>Backpack</b> (tools), <b>StarterGear</b> (tools kept after death), <b>PlayerGui</b> (their screen UI) and <b>PlayerScripts</b> (their LocalScripts). Roblox fills these by copying from StarterPack, StarterGui and StarterPlayerScripts.</p>
        </div>
        <${BB.LifecycleLab} />
        <h2>The full starter script</h2>
        <span class="place">Script in <b>ServerScriptService</b></span>
        ${C(`local Players = game:GetService("Players")\n\nlocal function onCharacterAdded(character)\n\tlocal humanoid = character:WaitForChild("Humanoid")\n\thumanoid.Died:Connect(function()\n\t\tprint(character.Name .. " died")\n\tend)\nend\n\nlocal function onPlayerAdded(player)\n\tprint(player.Name .. " joined")\n\tplayer.CharacterAdded:Connect(onCharacterAdded)\n\tif player.Character then -- body may already exist\n\t\tonCharacterAdded(player.Character)\n\tend\nend\n\nPlayers.PlayerAdded:Connect(onPlayerAdded)\n-- players who joined before this script started (Studio testing!)\nfor _, player in Players:GetPlayers() do\n\tonPlayerAdded(player)\nend\n\nPlayers.PlayerRemoving:Connect(function(player)\n\tprint(player.Name .. " left: save their data here")\nend)`)}
        <h2>Banning</h2>
        <div class="prose"><p>${R("class", "Players")}<code>:BanAsync()</code> kicks people out and keeps them out, for a time you choose (<code>Duration</code> in seconds, or <code>-1</code> forever). Turn on <b>Players.BanningEnabled</b> in Studio first. Option <code>ApplyDeviceBlock</code> also blocks their computer for 24 hours (Windows and Mac only). Keep your rules fair and posted where players can read them, and never put personal info or links in the ban message.</p></div>
        ${C(`local ok, err = pcall(function()\n\tPlayers:BanAsync({\n\t\tUserIds = { 123456789 },\n\t\tApplyToUniverse = true,     -- every place in your game\n\t\tDuration = 60 * 60 * 24,    -- 1 day, in seconds\n\t\tDisplayReason = "Cheating (rule 2).", -- the player sees this\n\t\tPrivateReason = "Speed hack seen by mod.", -- only you see this\n\t\tExcludeAltAccounts = false, -- also ban their alt accounts\n\t})\nend)\nif not ok then warn("Ban failed:", err) end`)}`,
    },
  ];
  BB.guideById = Object.fromEntries(BB.guides.map((g) => [g.id, g]));
})();

# DevRel Positioning Strategy

This document captures the reframe for the **Vercel DevRel Engineer, Agentic Infrastructure** role — the narrative that makes this repo proof of the job itself.

## The Core Narrative

> I built this because the AI SDK-to-Sandbox pattern didn't have a canonical example yet. That's the gap this repo fills: friction log included, tests at every layer, honest about what breaks. That's how I'd deliver work as a DevRel engineer — build it first, teach it clearly, feed what breaks back to the product team.

---

## LinkedIn Post

**Headline:**
"I couldn't find a worked example of AI SDK feeding into Sandbox execution — so I built one."

**Hook (first 2 lines):**
```
I couldn't find a single canonical example showing AI SDK's generateText 
feeding directly into Sandbox execution. So I built one, friction log included.
```

**Body:**
```
The gap: you can find tutorials on AI SDK. You can find tutorials on Sandbox. 
But there's no worked example showing them connected end-to-end, tested, 
deployed, and shipped with an honest friction log of what broke.

So I built sandbox-agent-demo:
- Prompt → AI SDK generates a script → Sandbox executes it isolated → results stream back
- Free tier compatible (generateText + manual JSON parsing, not generateObject)
- Full test suite (unit + integration + E2E)
- Friction log entry #3 promoted to the README: "There is no canonical example"
- Deployment guide with cost breakdown
- Security model explained (four-layer constraints)

The repo reads as an answer to "here's a gap in the docs, here's what I built to close it."

Why? Because that's the loop DevRel runs on: build with these tools before anyone 
else can, show the world what they make possible, and feed back what breaks.

Repo: https://github.com/ramirez-ai-labs/vercel-agent-demo
```

**Tags:** #Vercel #AISDK #Sandbox #DevRel #Agentic

---

## Medium Post Outline

**Title:** "Building Agentic Infrastructure: The Example the Ecosystem Needed"

**Structure:**

1. **The Gap (500 words)**
   - "I've used AI SDK. I've used Sandbox separately. But connecting them end-to-end? Not one worked example."
   - Friction log entry #3 from the CLAUDE.md: "No single canonical example for 'AI SDK output feeds Sandbox input'"
   - Why that matters: "This is the pattern. This is the frontier. Why no example?"

2. **The Example (800 words)**
   - Walk through the actual code (real file references)
   - Emphasize the choices: `generateText` + manual parsing (free tier) vs. `generateObject` (production)
   - Why manual parsing is a teaching choice: "You see the error path. Most docs skip this."
   - The streaming protocol (NDJSON, not SSE) and why it matters for real-time feedback

3. **What Broke (600 words)**
   - React 19 + Testing Library peer dependency conflict (what I hit, what Vercel should fix)
   - Sandbox v2 mental model shift (ephemeral → persistent by default — users hit this)
   - "Timeout ceiling is plan-dependent" (friction log #2, deserves product investment)
   - JSON parsing failures and how the route handles them

4. **The Lesson for Product (400 words)**
   - "Here's what I'd tell the AI SDK team: show this pattern in your docs"
   - "Here's what I'd tell the Sandbox team: the mental model shift from v1 → v2 is tripping up early adopters"
   - "Here's what I'd tell DevRel: don't ship a product until you've shipped the worked example"

5. **Call to Action (200 words)**
   - "If you're building agentic infrastructure, fork this, iterate, ship yours. Send the friction back upstream."
   - "If you're at Vercel: this is what happens when you hand DevRel the SDK first — we build the gaps."

**Tone:** Honest, transparent, "I hit it first so you don't have to."

---

## "Why This Role" Answer

**For the Vercel Application (500 char limit):**

> I built sandbox-agent-demo because the AI SDK-to-Sandbox pattern didn't have a canonical example yet. As a DevRel engineer, that's the gap I'd fill: build with these tools before anyone else, show the ecosystem what they make possible, and feed back what breaks. That friction log? That's the signal product needs. This repo is exactly how I'd work in this role — build → teach → loop feedback back to Engineering.

**For the Interview (talking version, 2 min):**

> The core of what I built is an answer to friction log entry #3: "No single canonical example for AI SDK output feeding Sandbox." That's the DevRel job, right? Build it first. Teach it clearly so the ecosystem doesn't have to re-discover the pattern. And feed back what breaks so the product team fixes it *before* it becomes a support ticket. 
>
> I chose free-tier models and manual JSON parsing deliberately—not because it's cheaper, but because it's honest. Shows the error path. Shows what happens when the model returns invalid JSON. Most docs skip that. I didn't.
>
> The friction log in the repo—React 19 compatibility, Sandbox v2 mental model shift, timeout ceilings—that's the signal product needs. I hit all of these so the next developer doesn't have to. That's the loop I'd run as a DevRel engineer: build the gaps, teach clearly, loop the friction back upstream.

---

## Important Note

**Do NOT reuse this positioning for the FDE Director role** if you apply there. This reframe is specific to DevRel's job description and language ("build before anyone else," "set the canonical examples"). The FDE role (Forward Deployed Engineering) needs a different story — infrastructure for customers, scalable patterns, embedding with teams.

If you apply to both, position the same repo differently:
- **DevRel:** "I built the example the ecosystem didn't have"
- **FDE:** "I built a repeatable pattern for forward deployments" (reference architecture language)

Same artifact, two jobs it can do. Only one per application.

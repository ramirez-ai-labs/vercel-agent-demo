# Friction Log — sandbox-agent-demo

Concrete rough edges hit while integrating **Vercel AI SDK** and **Sandbox**, not general complaints. Entries below are from scaffolding and build-testing this repo. Add new entries once deployed live against a real `AI_GATEWAY_API_KEY` and Sandbox project — these only cover static build friction, not runtime behavior (auth, cold-start latency, real generated code failing, etc.), which is where the more interesting friction usually shows up.

## 1. Sandbox v2 changed the mental model from "ephemeral" to "named + persistent"
The current `@vercel/sandbox` SDK defaults to persistent, named sandboxes that
snapshot-and-resume on stop — a real shift from the anonymous, throwaway-VM mental model
in most existing tutorials and blog posts. For a genuinely one-off execution (this demo's
case), you have to remember to pass `persistent: false` explicitly, or you're paying for
snapshot behavior you don't want. Worth calling out in interviews as a "the docs/tutorials
lag the SDK version" pattern — exactly the kind of gap a DevRel role should be closing.

## 2. Timeout ceiling is plan-dependent and easy to misconfigure
Max sandbox timeout is 45 minutes on Hobby vs. up to 24 hours on Pro/Enterprise. Nothing
in the SDK surfaces this at call time — you find out by hitting the ceiling, not by a
type error or a helpful runtime message. A demo that works fine locally on Pro could
silently behave differently for someone cloning it on Hobby.

## 3. No single canonical example for "AI SDK output feeds Sandbox input"
Plenty of standalone examples for AI SDK (chat/completion patterns) and plenty for
Sandbox (running a dev server, cloning a git repo), but the specific "model generates a
file, sandbox executes it" pattern — the actual point of Sandbox's AI use case — took
stitching together from a changelog post and a docs page, not one worked example.
That's a real DevRel gap: this repo itself could become that example.

## 4. [Add after live deploy] Auth handshake between AI Gateway and Sandbox in one route
Both need credentials; document whether OIDC alone covers both in a single deployed
route or whether you hit a snag needing separate tokens.

## 5. [Add after live deploy] First real failure case
Note the first time the model generates something that fails inside the sandbox —
non-zero exit, unexpected stderr, or a runtime the schema didn't account for. What did
the error surface look like on the client, and was it enough to debug from?

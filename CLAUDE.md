# sandbox-agent-demo — CLAUDE.md

## What Is This?

A focused demo of the **Vercel AI SDK** and **Sandbox**: the model receives a prompt, generates a self-contained script (Node.js or Python) via structured `generateObject()` with Zod schema, writes it to an isolated Firecracker microVM, executes it, and streams results back to the browser.

Purpose: Portfolio piece demonstrating **AI SDK code generation** + **Sandbox infrastructure isolation** + **streaming event protocols**. Not a broader Vercel platform demo (no KV, D1, Blob).

## Why It Exists

Companion to [`trustclaw-jfrog-demo`](https://github.com/vhr1975/trustclaw-jfrog-demo) — both showcase "generate → execute → report" but on different infrastructure. TrustClaw uses a standalone Python serverless function; this one uses Next.js App Router with Vercel Sandbox, covering the parts of the modern AI stack that TrustClaw didn't touch: structured code generation, streaming events, schema-driven contracts, and infrastructure-level isolation.

Used to screen for roles requiring hands-on knowledge of AI SDK, Vercel platform, agentic execution, and sandbox security models.

## Architecture Decisions

### 1. **Schema-First Code Generation (`generateObject` over `streamText`)**

**Decision:** Use `ai.generateObject()` with a Zod schema instead of `streamText()`.

**Why:** The model's output is a *runnable artifact* (language, filename, code), not prose. A schema enforces this contract at generation time—no parsing code blocks from markdown, no ambiguity about the filename or runtime. Trade-off: loses streaming of the model's reasoning (acceptable since we only need the final code).

**Implementation:** `lib/schema.ts` defines `scriptSchema`; the route calls `generateObject({ model, schema, system, prompt })`. This makes the type boundary explicit: model output is structurally guaranteed to be correct before sandbox execution.

### 2. **Newline-Delimited JSON Stream over SSE**

**Decision:** Stream events as `\n`-delimited JSON instead of using Server-Sent Events or `useChat`'s data-stream protocol.

**Why:** This is not a chat; it's a few discrete stages (status → code → result → done). A custom protocol is simpler to reason about than fitting these into the chat message shape. No reconnect/resume semantics needed. Each line is a complete event; the client parses and applies it immediately.

**Trade-off:** Doesn't gracefully handle partial reads (but browsers and Node.js handle this via TextDecoder's `stream: true` option).

**Implementation:** Server encodes events as UTF-8 + `\n`; client collects lines in a buffer, splits on `\n`, parses each line as JSON. See `app/page.tsx` lines 47–59 for the parse loop.

### 3. **Persistent: false (Ephemeral Sandboxes)**

**Decision:** Create sandboxes with `persistent: false`.

**Why:** Each run is one-off; no state should persist between executions. Saves costs (no snapshot on stop) and simplifies reasoning (no cleanup overhead). This is a key design difference from the Sandbox v2 default, which is persistent.

**Rough edge:** Documented in FRICTION_LOG.md—the SDK's default shifted from "ephemeral" to "named + persistent" in v2, but docs/examples lag the SDK. This route explicitly passes `persistent: false` to make intent clear.

### 4. **Node.js Default, Python When Appropriate**

**Decision:** System prompt tells the model to prefer Node.js unless Python is "clearly better."

**Why:** Reduces cognitive load (one default runtime). Python is larger and slower for the sandbox to provision; Node is the fast path. But the model has discretion if the task (math, data science) fits Python better.

**Trade-off:** Not validated post-generation—if the model breaks this promise (e.g., chooses Python for a simple string sort), the sandbox will provision Python anyway. This is acceptable for a demo; could be validated if needed.

### 5. **Tight Timeouts (30s Sandbox, 60s Route)**

**Decision:** Sandbox command timeout = 30s, Next.js route maxDuration = 60s.

**Why:** This handles arbitrary user prompts; tight timeouts prevent runaway executions and limit costs. The 60s route timeout gives overhead for model inference + sandbox provisioning.

**Trade-off:** Hobby plan caps functions lower than 60s; deployed apps need Pro or Enterprise. Documented in README and FRICTION_LOG.

### 6. **System Prompt Over Infrastructure Constraints**

**Decision:** Guardrails (no network, no filesystem outside working dir, no stdin) are enforced via system prompt, not infrastructure policy.

**Why:** Simpler to implement and reason about for a demo. Faster iteration.

**Risk:** Not production-grade. Recommendation: add egress-blocking network policy at the Sandbox level before handling truly untrusted input.

## Extension Points

### Adding a New Runtime

1. Update `scriptSchema.language` enum in `lib/schema.ts`
2. Add runtime check in `app/api/agent/route.ts` line 60: `runtime: object.language === "rust" ? "rust1.7" : ...`
3. Update command resolution line 71: `const cmd = object.language === "rust" ? "rustc" : ...`
4. Update system prompt to mention the new runtime

### Swapping the Model

Change `process.env.AI_MODEL` or default in line 36. Requires:
- Verify the model supports `generateObject()` (Claude, GPT-4, Gemini do; Llama.cpp might not)
- Adjust system prompt if the new model has different strengths (e.g., GPT-4 is better at structured code than Claude)
- Re-test against the system prompt constraints (Node preference, <60 lines, etc.)

### Changing the Output Protocol

The event types are defined in `lib/schema.ts` (type `AgentEvent`). To add a new event (e.g., model refusal, sandbox quota exceeded):
1. Add the event type to `AgentEvent`
2. Add a handler in `app/page.tsx` `applyEvent()` function
3. Emit it from the route's `send()` calls

### Adding Tool-Calling Loop

Current: model gets one shot; if the script fails, nothing happens. To add auto-retry:
1. Check `result.exitCode` in the route (line 72)
2. If non-zero, feed stderr to the model in a follow-up prompt
3. Loop until exit code is 0 or max retries hit
4. Document this adds another model call per failed run (cost + latency)

## Known Limitations

1. **No Persistence** — Nothing is logged or saved. Runs are ephemeral.
2. **No Auth/Rate Limiting** — /api/agent accepts any request. Add before sharing publicly.
3. **No Self-Correction** — Model gets one shot; non-zero exit codes aren't fed back.
4. **Soft Constraints Only** — "<60 lines" and "prefer Node" are in the system prompt, not enforced.
5. **Prompt-Level Security** — Guardrails rely on model compliance, not infrastructure. Not production-ready for untrusted input.
6. **No Error Catalog** — Error messages are generic ("Unknown error running the agent"). See docs/ERROR_HANDLING.md for details.
7. **Cold-Start Latency** — Sandbox provisioning + model inference adds ~3–5s even for simple tasks.

## Future Work

- Add request logging (who ran what, exit codes, duration) for observability
- Implement tool-calling loop so the model can retry if the script fails
- Add egress-blocking network policy at Sandbox level
- Validate prompt length and reject obvious injection patterns
- Split error types (ModelError, SandboxError, ValidationError) for intelligent client-side retry
- Add cost/quota monitoring and alerts
- Build a job queue for parallel execution
- Expose model preference in the UI (let users pick Claude vs GPT-4, if configured)

## Testing

Run tests with `npm test` (once test suite is added).

- **Unit:** Schema validation, event type guards
- **Integration:** Mock sandbox, verify agent route streams correct events in order
- **E2E:** (Optional) Spin up real app, submit a prompt, verify output

No tests exist yet; see `docs/TESTING.md` once added.

## Deployment

1. Local dev: `npm run dev`, then `vercel env pull` for OIDC token
2. Staging: `vercel deploy --prod=false`
3. Production: `vercel deploy`, set `AI_GATEWAY_API_KEY` in project env vars

See README for full setup and cost/quota notes.

## Cost Notes

Each run incurs:
- **AI Gateway:** One model call (generateObject). Cost depends on model and token count. ~$0.01–0.10 per run.
- **Sandbox:** Provisioning + 30s compute. Firecracker is cheap; estimate ~$0.01–0.05 per run.

Running this demo 100 times costs ~$1–15. Monitor in Vercel dashboard.

## Related Reading

- Vercel AI SDK: https://sdk.vercel.ai
- Sandbox docs: https://vercel.com/docs/storage/vercel-sandbox
- Zod: https://zod.dev
- FRICTION_LOG.md: Real rough edges discovered during dev
- docs/ERROR_HANDLING.md: What can go wrong and why

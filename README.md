# sandbox-agent-demo

A focused demo of the **Vercel AI SDK** and **Sandbox**: describe a coding task, the model generates a self-contained script (Node.js or Python), and it runs isolated in a Firecracker microVM instead of on the request-handling server. Progress and output stream back to the browser as events.

Showcases:
- **AI SDK** structured code generation with Zod schema (`generateObject`)
- **Sandbox** infrastructure-level isolation and lifecycle management
- **Streaming events** with a custom NDJSON protocol (not SSE/useChat)
- **Production thinking** (cost awareness, tight timeouts, security model)

Built as a companion to [`trustclaw-jfrog-demo`](https://github.com/vhr1975/trustclaw-jfrog-demo) — same "generate → execute → report" pattern on different infrastructure.

## Architecture

```
Browser (app/page.tsx)
  │  POST { prompt }
  ▼
app/api/agent/route.ts
  │  generateObject()  → model writes { language, filename, code, summary }
  │  Sandbox.create()  → spins up a Firecracker microVM
  │  writeFiles()      → puts the generated script in the sandbox
  │  runCommand()      → executes it, captures stdout/stderr/exit code
  │  sandbox.stop()    → tears the VM down
  ▼
newline-delimited JSON stream → status / code / result / done events
  ▼
Browser renders each event as it arrives
```

The route returns a plain `ReadableStream` of newline-delimited JSON rather than using
`useChat`'s data-stream protocol — this isn't a chat, it's a handful of discrete stages
(generating, provisioning, running, done), and a custom protocol made that easier to reason
about than fitting it into the chat message shape. See `lib/schema.ts` for the event types.

## Why generateObject instead of streamText

The model's job here is to produce a runnable artifact (language + filename + code), not
prose. `generateObject` with a Zod schema makes that artifact structurally guaranteed —
no parsing a code block out of free text, no ambiguity about the filename or runtime.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in AI_GATEWAY_API_KEY at minimum — see .env.example for details
npm run dev
```

Sandbox auth: locally, run `vercel link` once, then `vercel env pull` to get an OIDC
dev token in `.env.local`. It expires after 12 hours — re-run `vercel env pull` when it
does. Deployed on Vercel, the Sandbox SDK picks up credentials automatically.

## Deploying

```bash
vercel deploy
```

Set `AI_GATEWAY_API_KEY` in the project's environment variables. No Sandbox-specific env
vars are needed in production — the SDK authenticates via OIDC automatically when running
on Vercel.

## Guardrails worth knowing about

- The route caps at `maxDuration = 60` seconds and the sandbox itself at a 30s command
  timeout — deliberately tight, since this handles arbitrary user prompts and the model
  is explicitly instructed not to write scripts that wait on input or reach the network.
- Sandboxes are created with `persistent: false` since each run is one-off; no snapshot
  is needed after `stop()`.
- The system prompt tells the model not to read/write outside its working directory or
  touch the network — worth tightening further (e.g. an explicit egress-blocking network
  policy on the sandbox, see Sandbox docs) before pointing this at truly untrusted input.

## What's intentionally left out

- No persistence — nothing is saved between runs. Fine for a demo; a real version would
  want request logging at minimum.
- No auth/rate limiting on `/api/agent` — add before sharing a public deploy link widely,
  since each run costs both an LLM call and sandbox compute.
- No tool-calling loop (the model gets one shot at the script, no self-correction if it
  fails). A natural next step: on non-zero exit code, feed stderr back to the model and
  let it retry once.

See `FRICTION_LOG.md` for rough edges hit while building this against the current SDKs.

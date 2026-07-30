# Demo Guide — sandbox-agent-demo

How to run this locally, demo it live, and talk about it in interviews.

---

## Quick Start (5 minutes)

```bash
# 1. Clone and install
git clone https://github.com/ramirez-ai-labs/vercel-agent-demo.git
cd vercel-agent-demo
npm install

# 2. Get credentials
# AI Gateway key: Vercel dashboard → Settings → Tokens → AI Gateway API key
cp .env.example .env.local
# Edit .env.local, paste your AI_GATEWAY_API_KEY

# 3. Sandbox auth (local dev only)
vercel link              # Link project to Vercel account
vercel env pull          # Pull OIDC token (expires 12h)

# 4. Start dev server
npm run dev
# Opens http://localhost:3000
```

---

## Demo Walkthrough

Once the dev server is running, **submit a prompt** to show the full lifecycle.

### Sample Prompts (Easy → Complex)

```
1. "Write hello world"
   → Quick win. Instant code generation. Shows model works.

2. "Generate a random number between 1 and 100"
   → Real code. Shows structured output (language + filename + code).

3. "Sort this list and find the median: [4, 1, 7, 3, 9, 2]"
   → Computation. Verifies script executes correctly. Shows output streaming.

4. "Estimate pi using Monte Carlo simulation with 10,000 samples"
   → Default prompt on page load. Longer execution. Shows sandbox timeouts work.
```

### What Happens as You Watch

1. **Status: "Asking the model to write a script…"**
   - AI SDK calls the model (Claude Sonnet by default)
   - Model generates structured JSON: `{ language, filename, code, summary }`

2. **Code Panel: Shows Generated Script**
   - Language: `node` or `python`
   - Filename: `script.js` or `script.py`
   - Code: The complete, self-contained script
   - Summary: One-liner explaining what it does

3. **Status: "Starting a Vercel Sandbox (Firecracker microVM)…"**
   - Provisioning takes ~1–2s (cold start)
   - This is a real isolated VM, not a container

4. **Status: "Running script.js inside the sandbox…"**
   - Script executes inside the VM
   - Timeout: 30 seconds (deliberate, to prevent runaway costs)

5. **Sandbox Output Panel: Shows Result**
   - `stdout`: Script output (what console.log/print() produced)
   - `stderr`: Any errors (syntax, runtime, etc.)
   - `exit code`: 0 = success, non-zero = error

---

## Key Things to Point Out When Demoing

### 1. Structured Code Generation
- "The model doesn't just return prose with a code block—it returns structured JSON via `generateObject()` with a Zod schema."
- "This guarantees the contract: model output is executable before we ever touch the sandbox."
- **Show:** [lib/schema.ts](../lib/schema.ts)

### 2. Infrastructure Isolation
- "The script runs inside a Firecracker microVM, not on this server."
- "No network access, no filesystem outside the working dir, no stdin. It's isolated at the infrastructure level."
- **Show:** The "Starting a Vercel Sandbox" status message.
- **Reference:** [CLAUDE.md → Persistent: false](../CLAUDE.md#3-persistent-false-ephemeral-sandboxes)

### 3. Custom Streaming Protocol
- "Instead of Server-Sent Events or the chat protocol, we stream newline-delimited JSON."
- "Each line is a complete event (status, code, result, done). The client parses and applies it immediately."
- **Show:** Browser DevTools → Network → /api/agent → Response tab
- **Code:** [app/page.tsx lines 47–65](../app/page.tsx#L47-L65)

### 4. Production Thinking
- "Tight timeouts (30s sandbox, 60s route) prevent runaway costs."
- "Error handling at every layer: JSON parsing, runtime validation, sandbox cleanup."
- "FRICTION_LOG documents real rough edges, not marketing fluff."
- **Reference:** [CLAUDE.md → Known Limitations](../CLAUDE.md#known-limitations)

### 5. Type Safety & Validation
- "Zod schema validates model output at runtime."
- "Runtime type guard fails fast if someone adds 'rust' to the language enum but doesn't wire it to the sandbox."
- **Show:** [app/api/agent/route.ts lines 60–68](../app/api/agent/route.ts#L60-L68)

---

## Code Review Walkthrough (For Interviews)

**Order to read for maximum impact:**

### 1. **CLAUDE.md** (2 min) — "Here's why I made these choices"
   - Schema-first approach (generateObject vs. streamText)
   - Custom NDJSON streaming
   - Ephemeral vs. persistent sandboxes
   - Soft constraints (Node preference, 60-line limit)
   - Honest about trade-offs and limitations

### 2. **app/api/agent/route.ts** (3 min) — "How the orchestration works"
   - Input validation (400 errors for bad requests)
   - Model inference (generateObject with schema)
   - Sandbox lifecycle (create → write → run → stop)
   - Error handling and cleanup
   - Event streaming (each step sends a status event)

### 3. **lib/schema.ts** (1 min) — "Type contracts"
   - Zod schema for model output (language, filename, code, summary)
   - Discriminated union for events (status, code, result, error, done)
   - This is where the boundaries are explicit

### 4. **app/page.tsx** (2 min) — "Client-side event handling"
   - Stream parsing with error handling (try/catch on JSON.parse)
   - Event dispatch (applyEvent switch statement)
   - UI state updates (statusLog, script, result, error)

### 5. **docs/ERROR_HANDLING.md** (2 min) — "Debugging is part of the product"
   - Comprehensive error catalog
   - Debugging checklist
   - Shows you think about the user, not just the happy path

### 6. **FRICTION_LOG.md** (1 min) — "Real feedback for SDKs"
   - "Sandbox v2 changed the mental model"
   - "No single canonical example for AI SDK → Sandbox"
   - This is DevRel-ready feedback

---

## Talking Points for Different Audiences

### **For AI/LLM Platform Roles (Anthropic, OpenAI, Vercel)**
> "This demo uses AI SDK's `generateObject()` to guarantee a contract between model output and executable artifact. No prompt injection risks, no parsing code blocks from markdown. The Zod schema is the boundary. I also documented FRICTION_LOG entries—SDK gaps worth fixing—which is the kind of feedback you should listen to for DevRel."

**Pointer:** [CLAUDE.md → Architecture Decisions](../CLAUDE.md#architecture-decisions)

### **For Infrastructure/Platform Engineers**
> "The sandbox is ephemeral, not persistent. Each run is one-off. I use runtime type guards to fail fast if someone adds a new language but forgets to wire the runtime. Error handling at every layer—JSON parsing, validation, cleanup. The timeouts are tight on purpose: 30s for the VM, 60s for the route. This prevents runaway costs."

**Pointer:** [app/api/agent/route.ts](../app/api/agent/route.ts)

### **For DevRel / Documentation Roles**
> "FRICTION_LOG is what I hit integrating these SDKs. 'No single canonical example for AI SDK → Sandbox pattern.' That's a real gap. ERROR_HANDLING.md is comprehensive—debugging checklist, cost tracking, quota awareness. Documentation should teach, not just reference. Here's an example of docs that prevent support tickets."

**Pointers:** [FRICTION_LOG.md](../FRICTION_LOG.md), [docs/ERROR_HANDLING.md](../docs/ERROR_HANDLING.md)

---

## Troubleshooting Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `AI_GATEWAY_API_KEY not set` | Missing from .env.local | Add key from Vercel dashboard, restart dev server |
| `OIDC token expired` | Local dev tokens last 12 hours | Run `vercel env pull` to refresh |
| `Request timed out (>60s)` | Route exceeds serverless timeout | Use a simpler prompt or increase `maxDuration` in route.ts (Hobby plan caps lower than 60s) |
| `Sandbox command timed out (30s)` | Script is too slow or infinite loop | Test locally with `node script.js`, check generated code in UI |
| `Unknown language: X` | Schema validation failed or runtime not wired | Check `app/api/agent/route.ts` lines 60–68 for runtime/cmd validation |
| `Stream parsing error` | Malformed JSON from server | Check browser console, verify .env.local has correct API key |
| `Sandbox quota exceeded` | Hit plan limit | Check Vercel dashboard → Usage, upgrade plan or wait for reset |
| "Cannot find module" | Script tried to import external package | Verify system prompt (script must use only stdlib) |

---

## Commands Reference

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run test suite (vitest)
npm run lint             # Lint code (eslint via next lint)

# Vercel (local dev & deployment)
vercel link              # Link project to Vercel account
vercel env pull          # Sync env vars from Vercel to .env.local
vercel deploy            # Deploy to preview URL
vercel deploy --prod     # Deploy to production

# Git
git checkout -b docs/demo-guide     # Create branch for demo docs
git add docs/DEMO.md                # Stage this file
git commit -m "Add comprehensive demo guide"
git push origin docs/demo-guide     # Push to remote
# Then open PR on GitHub
```

---

## Deploy to Vercel (For Live Demo / Sharing)

```bash
# 1. Ensure all changes are committed
git status
git add .
git commit -m "Ready for deployment"

# 2. Push to main (or merge PR first)
git push origin main

# 3. Deploy to Vercel production
vercel deploy --prod

# 4. Set AI_GATEWAY_API_KEY in Vercel dashboard
# Project Settings → Environment Variables → Add AI_GATEWAY_API_KEY
# (Value comes from your AI Gateway tokens)

# 5. Redeploy to pick up the env var
vercel deploy --prod

# 6. Share the live URL (e.g., https://vercel-agent-demo.vercel.app)
```

---

## What This Demo Signals

✅ **Full-stack thinking** — You understand client/server boundaries, streaming patterns, infrastructure isolation.

✅ **Production awareness** — Error handling, timeouts, costs, validation. Not a toy.

✅ **Developer empathy** — FRICTION_LOG, ERROR_HANDLING.md, comprehensive docs. You think about the user.

✅ **Type safety** — Zod schemas, discriminated unions, runtime type guards. Strong fundamentals.

✅ **Honest trade-offs** — CLAUDE.md documents every decision with a "why" and "trade-off." This is how senior engineers communicate.

---

## Further Reading

- [CLAUDE.md](../CLAUDE.md) — Architecture decisions and extension points
- [ERROR_HANDLING.md](../docs/ERROR_HANDLING.md) — Debugging guide
- [FRICTION_LOG.md](../FRICTION_LOG.md) — Real SDK rough edges
- [README.md](../README.md) — Setup, guardrails, what's intentionally left out
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Vercel Sandbox](https://vercel.com/docs/storage/vercel-sandbox)

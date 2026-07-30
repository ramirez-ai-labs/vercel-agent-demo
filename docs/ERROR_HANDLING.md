# Error Handling & Debugging

This document catalogs errors you may encounter and how to debug them.

## Client-Side Errors

### "No response stream from /api/agent"

**When:** The fetch response has no body.

**Why:** The server is returning a non-streaming response (e.g., 4xx/5xx error without a stream, or the connection was dropped).

**How to debug:**
```javascript
const res = await fetch("/api/agent", { method: "POST", body: JSON.stringify({ prompt }) });
console.log(res.status, res.statusText);
if (res.body) console.log("Stream available");
else console.log("No body on response");
```

**Fix:** Check server logs. If status is 4xx, the request is malformed (see "Malformed Request" below). If 5xx, see server-side errors.

---

### "Failed to parse JSON event"

**When:** The streaming protocol broke — a line wasn't valid JSON.

**Why:** Either the server is sending malformed ndjson, or the client's buffer is incomplete (edge case).

**How to debug:**
1. Open browser DevTools → Network → select the /api/agent request
2. Scroll to "Response" tab
3. Look for non-JSON lines (e.g., partial data, error messages)
4. If all lines look like valid JSON, the issue is likely in the client's buffer logic

**Fix:** Update the parse loop in `app/page.tsx` to log bad lines:
```typescript
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const event = JSON.parse(line) as AgentEvent;
    applyEvent(event);
  } catch (e) {
    console.error("Failed to parse line:", line, e);
  }
}
```

---

## Server-Side Errors

### "Missing 'prompt' in request body" (400)

**When:** POST /api/agent without a prompt, or prompt is not a string.

**Example:**
```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{}'  # Missing "prompt"
```

**Fix:** Include `prompt: "..."` in the JSON body:
```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write hello world"}'
```

---

### "Request body must be JSON" (400)

**When:** The request body isn't valid JSON.

**Example:**
```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d 'not json'
```

**Fix:** Ensure the body is valid JSON. Use a JSON validator: https://jsonlint.com/

---

## AI SDK / Model Errors

### Model Refusal or Timeout

**When:** The stream contains an error event with message like "The model refused to respond" or "Request timed out".

**Why:** 
- Model refused due to safety policy (e.g., prompt requested harmful code)
- Model inference took too long (network latency, high load)
- AI Gateway is unreachable or rate-limited

**How to debug:**
1. Check that `AI_GATEWAY_API_KEY` is set and valid:
   ```bash
   echo $AI_GATEWAY_API_KEY
   ```
   If empty, set it: `export AI_GATEWAY_API_KEY=your_key_here`

2. Check AI Gateway status: https://vercel.com/dashboard/monitoring/ai-gateway

3. Check your API quota: https://vercel.com/dashboard/usage

4. Try a simpler prompt (e.g., "Write hello world" instead of "Write a complex ML library")

**Fix:**
- If quota exceeded, wait or upgrade plan
- If model refused, rephrase the prompt to avoid triggering safety filters
- If timeout, increase `maxDuration` in `app/api/agent/route.ts` (but note Hobby plan limit is 10s)

---

### "generateObject() returned invalid schema"

**When:** The model generated code that doesn't match `scriptSchema`.

**Why:** The model misunderstood the system prompt and returned, e.g., `language: "go"` (not in enum).

**How to debug:**
1. Add logging to `app/api/agent/route.ts` after line 35:
   ```typescript
   const { object } = await generateObject({ ... });
   console.log("Generated object:", JSON.stringify(object, null, 2));
   ```
2. Redeploy and re-run the agent
3. Check server logs to see what the model returned

**Fix:**
- Improve system prompt clarity (e.g., explicitly list allowed languages)
- Use a more capable model (upgrade `AI_MODEL` env var)

---

## Sandbox Errors

### "Sandbox creation failed" or "Timeout waiting for sandbox"

**When:** The stream contains an error event like "Sandbox failed" or the route times out.

**Why:**
- Sandbox quota exceeded (hit plan limit)
- Vercel infrastructure issue (rare)
- Local dev: OIDC token expired (see below)

**How to debug:**
1. Check Sandbox usage: https://vercel.com/dashboard/usage
2. If local dev, check if token expired:
   ```bash
   cat .env.local | grep VERCEL
   ```
   Tokens expire after 12 hours
3. Check Vercel status: https://www.vercel-status.com/

**Fix:**
- If quota exceeded, upgrade plan or wait for reset
- If local dev token expired, run: `vercel env pull`
- If infra issue, wait a few minutes and retry

---

### "Command timed out (30000ms)"

**When:** The script ran but didn't finish within 30 seconds.

**Why:** The script is too slow or got stuck in an infinite loop.

**Example:** A script that sleeps for 60 seconds:
```javascript
setTimeout(() => console.log("done"), 60000);
```

**How to debug:**
1. Check the generated script in the "Code" panel—does it look right?
2. Test it locally: `node script.js`
3. If it hangs locally, the script has an issue

**Fix:**
- Revise the prompt to ask for faster code (e.g., "Write a fast script that...")
- Increase the timeout in `app/api/agent/route.ts` line 61 (but note sandbox ceiling is 30min on Hobby, 24h on Pro)
- Ask the model to add timeouts: "Add a 10-second timeout if the operation doesn't complete"

---

### "Network access denied" or "Filesystem operation failed"

**When:** The script tried to access the network or read/write files outside its directory.

**Why:** Sandbox isolation blocked it (intended behavior).

**Example:**
```javascript
const fs = require('fs');
fs.readFileSync('/etc/passwd');  // Blocked
```

**Fix:** The script should only:
- Read/write in its working directory (`.`)
- Compute results, not fetch data from the internet
- Use built-in libraries (Node.js stdlib, Python stdlib)

Revise the prompt: "Write a script that computes [X] using only built-in libraries and local files."

---

### "Command exited with code 1" or non-zero exit code

**When:** The script ran but returned a non-zero exit code.

**Why:** The script had a runtime error or explicitly exited with an error code.

**How to debug:**
1. Look at the "Sandbox output" panel—stderr will show the error
2. Example error:
   ```
   TypeError: Cannot read property 'foo' of undefined
   ```
3. See "Common Runtime Errors" below for solutions

**Fix:** Revise the prompt to ask for safer code, or retry (the model might correct it if it sees the error).

---

## Common Runtime Errors

### "Cannot find module" or "No module named"

**Example stderr:**
```
Error: Cannot find module 'express'
ModuleNotFoundError: No module named 'pandas'
```

**Why:** The script tried to import a package that isn't available in the sandbox.

**Fix:** Ask the model to use only built-in libraries. Revise prompt: "Use only the Node.js standard library (fs, path, util, etc.) — no npm packages."

---

### "SyntaxError" or "IndentationError"

**Example stderr:**
```
SyntaxError: Unexpected token }
IndentationError: expected an indented block
```

**Why:** The generated code has a typo or syntax error.

**Fix:** Usually a model mistake. Retry with a slightly different prompt, or specify the syntax more carefully: "Write a valid, error-free Python script that..."

---

### "TypeError" or "AttributeError"

**Example stderr:**
```
TypeError: Cannot read property 'length' of undefined
AttributeError: 'NoneType' object has no attribute 'foo'
```

**Why:** The script accessed an undefined variable or property.

**Fix:** Ask the model for defensive code: "Write a script that safely checks for null/undefined values and provides a fallback."

---

## Performance & Cost

### "Agent runs are slow (5–10s latency)"

**Why:**
1. Model inference takes 1–3s
2. Sandbox provisioning takes 1–3s (cold start)
3. Network round-trips add 500ms–1s

**Optimization:**
- Use a faster model (e.g., GPT-4o Mini) if available
- Reuse the same sandbox for multiple runs (would require architectural change)
- Cache model responses if the prompt is repeated

---

### "Sandbox quota exceeded" or "Billing surprise"

**Cost per run:**
- AI Gateway: ~$0.01–0.10 (depends on model and token count)
- Sandbox: ~$0.01–0.05 (provisioning + compute)

**Estimate:** 100 runs ≈ $1–15

**How to monitor:**
1. Check Vercel dashboard → Usage
2. Set a billing alert: https://vercel.com/docs/accounts-and-teams/billing

**How to reduce cost:**
- Use a cheaper model (Claude Haiku vs. Claude Sonnet)
- Add rate limiting (see CLAUDE.md "No Auth/Rate Limiting")
- Batch requests offline if possible

---

## Debugging Checklist

When something breaks, work through this list:

- [ ] **Request valid?** Check prompt is a non-empty string
- [ ] **API key set?** `echo $AI_GATEWAY_API_KEY`
- [ ] **OIDC token fresh?** (local dev) Run `vercel env pull`
- [ ] **Quota ok?** Check Vercel dashboard
- [ ] **Model online?** Check AI Gateway status
- [ ] **Server logs?** Check terminal running `npm run dev`
- [ ] **Network tab?** Check browser DevTools for response content
- [ ] **Sandbox isolation?** Does the script access network or filesystem?
- [ ] **Timeouts?** Is the script taking >30s?

---

## Report a Bug

If you've worked through the checklist and still have an issue:

1. Reproduce with a minimal prompt (e.g., "Write hello world")
2. Collect:
   - The prompt you sent
   - Full error message from stderr or the error event
   - The generated code (if visible)
   - Server logs (from `npm run dev`)
   - Environment (local dev vs. deployed, Node version, OS)
3. Open an issue with this info

---

## Further Reading

- [Vercel AI SDK Docs](https://sdk.vercel.ai)
- [Sandbox Docs](https://vercel.com/docs/storage/vercel-sandbox)
- [Vercel Troubleshooting](https://vercel.com/docs/troubleshoot)

# Testing Strategy — sandbox-agent-demo

How to verify that everything works: the setup, the code, and the full end-to-end flow.

---

## Testing Pyramid

```
     E2E (Playwright)
    /              \
   /  Integration   \
  /  (mocked SDK)    \
 /  Unit (schema)     \
/_____________________\
```

**Cost vs. coverage:**
- **Unit tests** (fast, isolated, no credentials needed)
- **Integration tests** (medium speed, mocks external APIs, catches wiring bugs)
- **E2E tests** (slow, real credentials, verifies the user experience)

---

## 1. Manual Verification (5 min)

**Do this first** to make sure your environment is set up correctly.

```bash
# 1. Verify setup
npm install                    # Should complete without errors
echo $AI_GATEWAY_API_KEY       # Should print your key (not empty)

# 2. Build check
npm run build                  # Should complete without errors
npm run lint                   # Should pass

# 3. Start dev server
npm run dev
# Wait for "compiled successfully" in terminal

# 4. Open browser
open http://localhost:3000     # or navigate manually

# 5. Submit a test prompt
# Input: "Write hello world"
# Expected output:
#   - Status: "Asking the model..." → "Starting Sandbox..." → "Running..."
#   - Code: Shows generated script (language: node, filename: hello.js)
#   - Result: Shows "hello world" in stdout
#   - Exit code: 0

# 6. Test error handling
# Input: "" (empty string)
# Expected: Error message appears immediately (validation error)

# 7. Test streaming
# Input: "Estimate pi with 1000000 samples"
# Watch: Status messages stream in (real-time progress)
# Expected: Takes ~5-10s, shows streaming behavior
```

**✅ If all 7 steps work, your environment is correct.**

---

## 2. Unit & Integration Tests

Run the existing test suite:

```bash
# Run all tests (vitest)
npm test

# Run tests in watch mode (re-run on file changes)
npm test -- --watch

# Run with UI
npm test -- --ui

# Run and generate coverage
npm test -- --coverage
```

### What's Tested

**Schema Validation** (`lib/__tests__/schema.test.ts`):
- ✅ Valid Node.js script accepted
- ✅ Valid Python script accepted
- ✅ Invalid language rejected
- ✅ Missing fields rejected
- ✅ Event types are correct

**Route Handler** (`app/api/agent/__tests__/route.test.ts`):
- ✅ Rejects request without prompt (400)
- ✅ Rejects non-JSON request (400)
- ✅ Rejects empty/non-string prompt (400)
- ✅ Returns stream with correct content-type
- ✅ Streams status/code/result/done events
- ✅ Emits error event on model failure
- ✅ Cleans up sandbox even on error

**Test mocks:**
- `ai.generateObject()` → returns synthetic { language, filename, code, summary }
- `Sandbox.create()` → returns mock sandbox with runCommand() that returns { exitCode, stdout(), stderr() }
- No real API calls, no real sandbox provisioning

### Expected Output

```
 ✓ lib/__tests__/schema.test.ts (13)
 ✓ app/api/agent/__tests__/route.test.ts (9)

Test Files  2 passed (2)
Tests     22 passed (22)
```

---

## 3. End-to-End Test (With Real API)

**E2E test using Playwright** — actually runs the full stack with real credentials.

### Setup

```bash
# Install Playwright
npm install -D @playwright/test

# Create basic E2E test
cat > e2e/agent.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('Agent API E2E', () => {
  test('generates and executes a simple script', async ({ request }) => {
    const response = await request.post('/api/agent', {
      data: { prompt: 'Write hello world' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/x-ndjson');

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const events = lines.map(line => JSON.parse(line));

    // Verify event sequence
    expect(events.some(e => e.type === 'status')).toBeTruthy();
    expect(events.some(e => e.type === 'code')).toBeTruthy();
    expect(events.some(e => e.type === 'result')).toBeTruthy();
    expect(events.some(e => e.type === 'done')).toBeTruthy();

    // Verify result
    const resultEvent = events.find(e => e.type === 'result');
    expect(resultEvent?.exitCode).toBe(0);
    expect(resultEvent?.stdout).toContain('hello');
  });

  test('handles invalid prompt gracefully', async ({ request }) => {
    const response = await request.post('/api/agent', {
      data: { prompt: '' },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects non-JSON request', async ({ request }) => {
    const response = await request.post('/api/agent', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not json',
    });

    expect(response.status()).toBe(400);
  });
});
EOF
```

### Run E2E Tests

```bash
# Requires API_GATEWAY_API_KEY and Sandbox access (Vercel project)
export API_GATEWAY_API_KEY=your_key_here
export VERCEL_OIDC_TOKEN=$(vercel env pull --token=$VERCEL_TOKEN)

# Run tests
npx playwright test

# Run in UI mode (see what's happening)
npx playwright test --ui

# Run one test
npx playwright test e2e/agent.spec.ts -g "generates and executes"
```

### Expected Output

```
✓ Agent API E2E › generates and executes a simple script (3s)
✓ Agent API E2E › handles invalid prompt gracefully (0.5s)
✓ Agent API E2E › rejects non-JSON request (0.5s)

3 passed (4s)
```

---

## 4. Test All Three Layers

Create a test script that runs everything:

```bash
cat > scripts/test-all.sh << 'EOF'
#!/bin/bash
set -e

echo "=== Manual Verification ==="
echo "1. Checking environment..."
[ -z "$AI_GATEWAY_API_KEY" ] && echo "❌ AI_GATEWAY_API_KEY not set" && exit 1
echo "✅ AI_GATEWAY_API_KEY is set"

echo "2. Installing dependencies..."
npm install

echo "3. Building..."
npm run build

echo "4. Linting..."
npm run lint

echo ""
echo "=== Unit + Integration Tests ==="
npm test -- run

echo ""
echo "=== E2E Tests ==="
echo "(Requires running dev server in another terminal)"
echo "Start dev server: npm run dev"
echo "Then run: npx playwright test"

echo ""
echo "✅ All tests passed!"
EOF

chmod +x scripts/test-all.sh
./scripts/test-all.sh
```

---

## 5. CI/CD Testing (GitHub Actions)

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm install
      - run: npm run lint
      - run: npm run build
      - run: npm test -- run
      
      # E2E tests (skip if no API key)
      - if: env.AI_GATEWAY_API_KEY != ''
        run: npm run dev &
      - if: env.AI_GATEWAY_API_KEY != ''
        run: npx playwright test
        env:
          AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
```

---

## 6. Manual Testing Checklist

Use this checklist before deployment:

- [ ] `npm install` completes without errors
- [ ] `npm run build` completes without errors
- [ ] `npm run lint` passes
- [ ] `npm test` passes all unit tests
- [ ] `npm run dev` starts without errors
- [ ] Browser loads http://localhost:3000
- [ ] Sample prompt "Write hello world" generates code + executes
- [ ] Exit code is 0 for successful script
- [ ] Exit code is non-zero for failing script
- [ ] Empty prompt shows validation error
- [ ] Long-running prompt (Monte Carlo) shows streaming status updates
- [ ] Stream parsing handles errors gracefully
- [ ] Sandbox cleanup happens even on errors
- [ ] `vercel deploy` completes successfully
- [ ] Live deployment accepts requests without errors
- [ ] E2E tests pass (if API key available)

---

## 7. What Each Test Level Catches

| Test Level | Catches | Misses |
|------------|---------|--------|
| **Unit** | Schema validation, event type shapes | Real SDK behavior, network issues |
| **Integration** | Route handler, error handling, event streaming | UI rendering, real sandbox provisioning |
| **E2E** | Full user flow, SDK integration, actual sandbox isolation | Edge cases, load testing, cost validation |

---

## 8. Debugging Failed Tests

### Unit/Integration Tests Fail

```bash
# Run a single test file
npm test -- lib/__tests__/schema.test.ts

# Run with verbose output
npm test -- --reporter=verbose

# Run with debugging
node --inspect-brk ./node_modules/.bin/vitest lib/__tests__/schema.test.ts

# Check mock setup
# Verify mocks in __tests__ files match actual SDK shapes
```

### E2E Tests Fail

```bash
# Run in UI mode to see what's happening
npx playwright test --ui

# Run one test with verbose trace
npx playwright test -g "test name" --trace on

# View trace
npx playwright show-trace trace.zip
```

### Manual Test Fails

```bash
# Check environment
echo $AI_GATEWAY_API_KEY
echo $VERCEL_OIDC_TOKEN

# Check dev server logs
npm run dev
# Look for "compiled successfully" and no errors

# Check browser console
# Open DevTools → Console tab
# Look for "Failed to parse event" or fetch errors

# Check server logs
# Look in terminal running `npm run dev`

# Try a simpler prompt
# Instead of "estimate pi", try "write hello world"
```

---

## 9. Before Deploying

Run this checklist:

```bash
# 1. All tests pass locally
npm test -- run                    # Unit + integration
npx playwright test               # E2E (if API key available)

# 2. Linting passes
npm run lint

# 3. Build succeeds
npm run build

# 4. Manual verification
npm run dev
# → Submit "Write hello world"
# → Verify output in browser

# 5. No uncommitted changes
git status
# → Should show nothing, or only the test files you added

# 6. Ready to push
git push origin your-branch
# → Open PR, wait for CI to pass
# → Then merge to main and deploy
```

---

## 10. Cost & Quota Monitoring

**Monitor these while testing:**

```bash
# Check Sandbox quota usage
# https://vercel.com/dashboard/usage

# Check API Gateway usage
# https://vercel.com/dashboard/monitoring/ai-gateway

# Set billing alerts
# https://vercel.com/docs/accounts-and-teams/billing
```

**Rough cost per test run:**
- Unit test: $0 (no API calls)
- Integration test: $0 (mocked)
- E2E test: ~$0.02–0.05 (one API call + one sandbox)
- Full test suite (unit + integration + E2E): ~$0.05 per run

**If tests run in CI on every PR, you may see small charges accumulate.** Set a billing alert.

---

## Summary

**Test as you go:**
1. ✅ Manual verification (5 min) — sanity check
2. ✅ Unit tests (30 sec) — catches schema/logic bugs
3. ✅ Integration tests (1 min) — catches wiring bugs
4. ✅ E2E tests (2–5 min) — verifies user experience
5. ✅ Before deploy — run full checklist

**Goal:** Every line of code has been tested at least twice (unit + integration), and the happy path has been tested end-to-end.

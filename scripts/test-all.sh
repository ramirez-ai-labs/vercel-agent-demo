#!/bin/bash

# Test all layers: unit + integration + E2E
# Usage: ./scripts/test-all.sh

set -e

echo "========================================="
echo "  sandbox-agent-demo — Full Test Suite"
echo "========================================="
echo ""

# Check environment
echo "1️⃣  Checking environment..."
if [ -z "$AI_GATEWAY_API_KEY" ]; then
  echo "❌ AI_GATEWAY_API_KEY not set"
  echo "   Add to .env.local or set: export AI_GATEWAY_API_KEY=your_key"
  exit 1
fi
echo "✅ AI_GATEWAY_API_KEY is set"
echo ""

# Install dependencies
echo "2️⃣  Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Lint
echo "3️⃣  Linting code..."
npm run lint
echo "✅ Lint passed"
echo ""

# Build
echo "4️⃣  Building..."
npm run build
echo "✅ Build succeeded"
echo ""

# Unit + Integration tests
echo "5️⃣  Running unit + integration tests (vitest)..."
npm test -- run
echo "✅ Unit + integration tests passed"
echo ""

# E2E tests
echo "6️⃣  Running E2E tests (Playwright)..."
echo "    (Starting dev server...)"
npx playwright test
echo "✅ E2E tests passed"
echo ""

echo "========================================="
echo "  ✨ All tests passed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  - Review changes: git diff"
echo "  - Push branch: git push origin your-branch"
echo "  - Open PR on GitHub"
echo "  - Deploy: vercel deploy --prod"

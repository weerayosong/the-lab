#!/usr/bin/env bash
set -e

echo "🚀 Running Memory Leak Detective — core-002"
echo ""

# --expose-gc ทำให้ global.gc() ใช้ได้
node --expose-gc detective.js

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Experiment Complete"
echo ""
echo "📖 Read the full analysis:"
echo "   cat core-002-closure-memory-leak/README.md"
echo ""
echo "🔗 Reference:"
echo "   MDN: Closures — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures"
echo "   MDN: WeakMap — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
#!/usr/bin/env bash
set -e

echo "🚀 Running Memory Leak Detective..."
echo ""

# --expose-gc ทำให้ global.gc() ใช้ได้
node --expose-gc detective.js

echo ""
echo "📋 Summary:"
echo "  WeakMap lets GC collect objects when no other references exist."
echo "  This is the EXPECTED behavior — our baseline is solid."
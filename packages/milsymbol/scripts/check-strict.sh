#!/bin/bash
# Phase 4 Strict Mode Check
# Checks only Phase 2-3 files for strict TypeScript compliance
# Usage: ./scripts/check-strict.sh

set -euo pipefail

STRICT_FILES=(
  "src/milsym/armyc2/c5isr/renderer/modifiers/"
  "src/milsym/armyc2/c5isr/renderer/utilities/DataLoader.ts"
  "src/milsym/armyc2/c5isr/renderer/utilities/ChunkRegistry.ts"
  "src/milsym/armyc2/c5isr/renderer/utilities/IDataLoader.ts"
)

echo "=== TypeScript Strict Check (Phase 2-3 files only) ==="

# Run tsc with strict config and filter for only our files
ERRORS=$(npx tsc --noEmit -p tsconfig.strict.json 2>&1 || true)

TOTAL=0
for pattern in "${STRICT_FILES[@]}"; do
  COUNT=$(echo "$ERRORS" | grep "^${pattern}" | grep "error TS" | wc -l)
  TOTAL=$((TOTAL + COUNT))
  if [ "$COUNT" -gt 0 ]; then
    echo ""
    echo "--- ${pattern} ($COUNT errors) ---"
    echo "$ERRORS" | grep "^${pattern}" | grep "error TS"
  fi
done

echo ""
echo "=== Total strict errors in Phase 2-3 files: $TOTAL ==="

if [ "$TOTAL" -eq 0 ]; then
  echo "All Phase 2-3 files are strict-clean!"
  exit 0
else
  echo "Fix these errors before merging."
  exit 1
fi

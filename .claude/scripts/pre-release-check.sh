#!/usr/bin/env bash
# Pre-release hook: run lint and tests before tagging a release
# Exit 0 = pass, Exit 2 = block with message

echo "Running lint check..."
if ! npx biome check . 2>&1; then
  echo "BLOCKED: Lint check failed. Fix lint errors before tagging a release."
  exit 2
fi

echo "Running tests..."
if ! npx vitest run 2>&1; then
  echo "BLOCKED: Tests failed. Fix test failures before tagging a release."
  exit 2
fi

echo "All checks passed."
exit 0

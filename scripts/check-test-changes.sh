#!/usr/bin/env bash
set -euo pipefail

changed_tests=$(git diff --no-renames --numstat "$1...HEAD" -- \
  ':(glob)**/*.spec.ts' ':(glob)**/*.int-spec.ts' ':(glob)**/*.db-spec.ts' \
  ':(glob)**/*.test.ts' ':(glob)**/*.test.tsx' apps/frontend/e2e/ \
  | awk -F '\t' '$2 + 0 > 0 || $2 == "-" { print $3 }')

if [[ -n "$changed_tests" ]]; then
  printf 'Existing test lines were removed or rewritten in:\n%s\nExplain intentional test changes in the pull request.\n' "$changed_tests"
  exit 1
fi

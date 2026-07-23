#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

./scripts/check-public-release.sh

if ! git diff --quiet || ! git diff --cached --quiet; then
  printf 'public release export requires a clean committed worktree\n' >&2
  exit 1
fi

release_ref="${1:-HEAD}"
release_name="qiymetleri-public-$(git rev-parse --short "$release_ref")"
output="${2:-$repo_root/$release_name.tar.gz}"

git archive \
  --format=tar.gz \
  --prefix="$release_name/" \
  --output="$output" \
  "$release_ref"

printf 'created %s\n' "$output"

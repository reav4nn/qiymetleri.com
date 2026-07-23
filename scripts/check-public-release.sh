#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

errors=0
public_files=()

report_error() {
  printf 'public-release audit: %s\n' "$1" >&2
  errors=$((errors + 1))
}

while IFS= read -r -d '' path; do
  [[ -f "$path" ]] || continue
  public_files+=("$path")

  case "$path" in
    private/README.md|private/.gitignore)
      ;;
    private/*)
      report_error "private file is publishable/tracked: $path"
      ;;
  esac

  case "$path" in
    .env|*/.env|*.env.local|*.env.production|*.env.development|*.env.test)
      report_error "real environment file is publishable/tracked: $path"
      ;;
    shared/specs/pilot/*.json)
      report_error "real pilot snapshot is in the public tree: $path"
      ;;
    backend/scripts/seed_demo.py|backend/scripts/seed_spec_taxonomy.py)
      ;;
    backend/scripts/seed_*.py)
      report_error "one-off ingestion script is in the public tree: $path"
      ;;
    frontend/public/stores/*)
      [[ "$path" == "frontend/public/stores/README.md" ]] ||
        report_error "third-party retailer artwork is public: $path"
      ;;
    *.csv|*.parquet|*.xlsx|*.dump|*.sql.gz|*.tar.gz|*.zip)
      report_error "export/archive is in the public tree: $path"
      ;;
  esac
done < <(git ls-files -z --cached --others --exclude-standard)

for required in \
  LICENSE NOTICE DATA_LICENSE.md TRADEMARKS.md SECURITY.md CONTRIBUTING.md \
  docs/OPEN_SOURCE_BOUNDARY.md docs/DATA_GOVERNANCE.md \
  docs/PUBLICATION.md; do
  [[ -f "$required" ]] || report_error "required policy file is missing: $required"
done

if ((${#public_files[@]})); then
  secret_pattern='-----BEGIN ([A-Z ]+)?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|(sk_live|rk_live)_[A-Za-z0-9]{16,}|postgres(ql)?://[A-Za-z0-9_.-]+:[^$/{:@[:space:]][^@[:space:]]*@'
  while IFS= read -r path; do
    [[ -n "$path" ]] && report_error "possible credential in: $path"
  done < <(rg -l -I -e "$secret_pattern" -- "${public_files[@]}" || true)

  while IFS= read -r path; do
    [[ "$path" == "scripts/check-public-release.sh" ]] && continue
    [[ -n "$path" ]] && report_error "developer absolute path in: $path"
  done < <(
    rg -l -I -e '/home/[^/]+/|/Users/[^/]+' -- "${public_files[@]}" || true
  )
fi

git check-ignore -q .env ||
  report_error ".env is not ignored"
git check-ignore -q private/data/audit-probe.json ||
  report_error "private data overlay is not ignored"
git check-ignore -q private/production/audit-probe.env ||
  report_error "private production overlay is not ignored"

if ((errors)); then
  printf 'public-release audit failed with %d issue(s)\n' "$errors" >&2
  exit 1
fi

printf 'public-release audit passed (%d publishable files checked)\n' \
  "${#public_files[@]}"

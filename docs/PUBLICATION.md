# Publishing the public repository

## Important history rule

Do not make an existing private remote public merely because the current
working tree passes the release audit. Earlier commits may still contain
deleted pilot data, one-off ingestion scripts, retailer artwork, or credentials.

The safe default is a new, history-free public repository:

1. commit the open-source boundary changes in the private repository;
2. run all tests and `./scripts/check-public-release.sh`;
3. create a source archive with `./scripts/export-public-release.sh`;
4. inspect the archive;
5. extract it into a new directory, run `git init`, and create the first public
   commit there;
6. connect that clean repository to the public remote.

If preserving history is essential, use a dedicated history-rewriting tool and
independently scan every rewritten commit before replacing any remote. History
rewriting and force-pushing are intentionally not automated here.

## Release checklist

- public release audit passes;
- backend/shared and scraper tests pass;
- frontend lint and production build pass;
- no `.env`, database export, pilot snapshot, source payload, or retailer
  artwork is present;
- `LICENSE`, `NOTICE`, `DATA_LICENSE.md`, and trademark notices are included;
- archive contents have been manually spot-checked.

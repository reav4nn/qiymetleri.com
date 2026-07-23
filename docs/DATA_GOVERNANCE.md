# Data governance

## Source records

Every production specification must retain its source URL, source type,
retrieval time, parser identity, and audit reason. Manufacturer sources are
preferred; retailer fallback is used only when the manufacturer omits a value.
Conflicts remain blocking until reviewed.

## Publication classes

- **Public:** schemas, taxonomy, validators, synthetic fixtures, aggregate
  methodology, and documentation.
- **Internal:** normalized catalogue, observations, model UUID mappings,
  readiness reports, price history, and source-specific parsers.
- **Restricted:** credentials, proxy configuration, admin records, moderation
  payloads, raw exports, backups, and production logs.

## Retention and deletion

Production retention is configured outside this repository. Raw payloads and
logs should be kept only as long as needed for audit, debugging, and legal
obligations. Backups must be encrypted and tested; deletion must include
derived exports when applicable.

## Dataset publication

Before releasing any dataset:

1. confirm rights for both the database structure and individual contents;
2. remove credentials, personal data, internal IDs, raw HTML, and copyrighted
   images or prose;
3. document provenance, collection date, known errors, and regional variants;
4. run the public release audit;
5. assign a data licence only to material the project is entitled to license.

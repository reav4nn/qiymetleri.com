# Comparison specification contracts

`smartphones.v1.json` is the versioned source contract for the smartphone
comparison taxonomy. It defines stable keys, AZ/RU labels, value types, scopes,
canonical units, objective comparison rules, readiness metadata, and enum/set
options.

The files under `fixtures/` are synthetic contract fixtures. They cover five
representative model archetypes plus tie, missing-value, variant-override, and
source-conflict behavior. They are not claims about real products and must
never be imported as production catalogue data.

Real pilot snapshots are private catalogue data and are not committed. Generate
one with `python -m scripts.snapshot_comparison_pilot` from the backend
environment and write it under `private/data/pilots/`. Pass its path with
`python -m shared.spec_taxonomy --pilot PATH` when it needs validation.

Validate the bundled contract from the repository root:

```bash
python3 -m shared.spec_taxonomy
python3 -m unittest discover -s shared/tests -p 'test_*.py'
```

Contract rules:

- Existing stable keys are never reinterpreted in place. Breaking changes
  require a new contract/schema version and an explicit data migration.
- Text, enum, range, and set values are difference-only in v1.
- Only numeric and boolean definitions may mark an objective per-attribute
  advantage.
- Aggregate product scores and overall winners are forbidden.
- Canonical comparison values will be stored in typed relational columns;
  this JSON is seed/configuration input, not the runtime value store.

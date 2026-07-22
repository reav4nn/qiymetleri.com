# Comparison specification contracts

`smartphones.v1.json` is the versioned source contract for the smartphone
comparison taxonomy. It defines stable keys, AZ/RU labels, value types, scopes,
canonical units, objective comparison rules, readiness metadata, and enum/set
options.

The files under `fixtures/` are synthetic contract fixtures. They cover five
representative model archetypes plus tie, missing-value, variant-override, and
source-conflict behavior. They are not claims about real products and must
never be imported as production catalogue data.

The file under `pilot/` is a dated, read-only snapshot of 50 candidates selected
from the existing smartphone catalogue. It fixes Phase 0 scope; it is not a
claim that their technical specifications are already complete or verified.
Regenerate it with `python -m scripts.snapshot_comparison_pilot` from the
backend environment, then review any catalogue naming pollution before replacing
the committed snapshot.

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

# Private workspace

This directory is a local-only overlay and is excluded from the public
repository. Its presence documents the boundary; its contents are not part of
the open-source distribution.

Use these local paths:

```text
private/
├── data/
│   ├── ingestion/   # source-specific one-off import scripts
│   ├── pilots/      # real catalogue snapshots and curated datasets
│   ├── exports/     # CSV/JSON/database exports
│   └── assets/      # third-party retailer assets
└── production/
    ├── env/         # production environment overlays
    ├── deploy/      # provider-specific deployment manifests
    └── backups/     # encrypted operational backups
```

Never force-add files from this directory. Public examples belong in the
normal source tree and must contain synthetic data and placeholder secrets.

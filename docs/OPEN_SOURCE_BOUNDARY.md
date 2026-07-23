# Open-source boundary

The repository uses an open-core-code/private-data split without changing the
runtime import paths.

| Layer | Location | Publication |
| --- | --- | --- |
| Application core | `backend/`, `frontend/src/`, `shared/`, `scraper/` | Public, Apache-2.0 |
| Public contracts | `shared/specs/smartphones.v1.json`, synthetic fixtures | Public, CC BY 4.0 |
| Local/demo deployment templates | Compose, Render, `.env.example`, `docs/` | Public, placeholders only |
| Curated catalogue and prices | `private/data/`, managed PostgreSQL | Private |
| One-off source ingestion | `private/data/ingestion/` | Private |
| Real pilot snapshots | `private/data/pilots/` | Private |
| Retailer artwork | `private/data/assets/` | Private |
| Production configuration | `private/production/`, provider secret store | Private |

## Publication rule

The public Git repository is the application core. The `private/` directory is
an ignored local overlay whose two boundary files are the only permitted
tracked entries. The release audit rejects real pilot data, batch ingestion
scripts, exports, backups, credentials, and third-party retailer artwork.

`render.yaml` and Docker Compose are deployable templates, not production state.
All synchronized/secret values remain external. A provider-specific manifest
containing real domains, IDs, private endpoints, or policy settings belongs in
`private/production/deploy/`.

## Data flow

```text
public adapters + taxonomy
          │
          ▼
private source observations ──► managed database ──► public API/UI
          │
          └── private exports, pilots, moderation and audit records
```

Real data may be loaded into a local or hosted deployment, but it is not
redistributed with the source code.

Before changing repository visibility, follow
[the history-safe publication procedure](PUBLICATION.md). Removing a file from
the current tree does not remove it from earlier Git commits.

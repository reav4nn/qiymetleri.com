# Contributing

Thank you for helping improve qiymetleri.com.

## Scope

Contributions may include application code, tests, documentation, synthetic
fixtures, taxonomy improvements, and source adapters that respect the source's
terms and rate limits.

Do not submit:

- production credentials, exports, raw retailer payloads, or private data;
- copyrighted product copy, retailer logos, or images without permission;
- real customer, admin, analytics, or moderation records;
- generated model specifications without a traceable source and audit note.

## Development

1. Copy `.env.example` to `.env` and replace every `CHANGE_ME` value.
2. Start the stack with `docker compose up -d --build`.
3. Keep changes focused and add regression tests.
4. Run `./scripts/check-public-release.sh`.
5. Run the backend/shared, scraper, and frontend checks documented in README.

Contributions are accepted under Apache-2.0. Public taxonomy and synthetic
fixture contributions are accepted under CC BY 4.0 as described in
`DATA_LICENSE.md`. By submitting a contribution, you confirm that you have the
right to provide it under those terms.

# Security policy

## Reporting a vulnerability

Do not open a public issue for vulnerabilities, leaked credentials, access
control bypasses, scraper abuse paths, or data exposure.

Use GitHub's private security advisory feature for this repository. If it is
unavailable, email `info@qiymetleri.com` with:

- the affected component and version or commit;
- reproducible steps and impact;
- any suggested mitigation;
- whether the report contains sensitive data.

Do not access data that is not yours, disrupt production, or publish the issue
before a fix is available. We will acknowledge a complete report as soon as
practical and coordinate disclosure based on severity.

## Supported versions

Security fixes target the current `main` branch. Deployment operators are
responsible for rotating secrets, applying database migrations, and updating
containers and dependencies.

## Secret handling

Only `.env.example` files with placeholders belong in source control. Real
credentials, production manifests, database exports, and moderation data must
remain in the ignored `private/` overlay or a managed secret store.

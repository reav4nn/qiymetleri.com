# Deployment Guide

## Required services

Production requires:

- a PostgreSQL database; TimescaleDB is optional;
- a password-protected Redis service;
- the FastAPI web service;
- the Next.js web service;
- one Celery worker and one Celery beat process;
- an optional scraper process for manual runs.

PostgreSQL and Redis must not expose public ports. Use private networking or provider-level access controls.

## Environment variables

Set at least the following secrets in the deployment platform:

```text
DATABASE_URL
CACHE_REDIS_URL
CELERY_BROKER_URL
CELERY_RESULT_BACKEND
ADMIN_USER
ADMIN_PASSWORD
```

Use separate managed Redis instances when the provider does not support logical database numbers. Never commit production values to `.env` or the repository.

## Deployment order

1. Provision PostgreSQL and Redis.
2. Run `alembic upgrade head` using the backend image.
3. Start the FastAPI service and wait for `/health/ready`.
4. Start the Next.js service with `INTERNAL_API_URL` pointing to FastAPI.
5. Start the Celery worker and Celery beat services.
6. Start the reverse proxy or connect the platform ingress.

The demo seed is optional and must not be run against production unless demonstration data is explicitly required.

## Smoke tests

After every deployment, verify:

```bash
curl https://API_HOST/health/live
curl https://API_HOST/health/ready
curl 'https://API_HOST/api/v1/products?per_page=1'
curl https://WEB_HOST/az
```

Also confirm that PostgreSQL and Redis are unreachable from the public internet, admin endpoints reject invalid credentials, and the worker appears online in the admin status endpoint.

## Rollback

Application images are safe to roll back while the current database migration remains compatible. Before a schema downgrade, take a database backup and review the migration's `downgrade()` implementation. Do not delete persistent volumes as part of a normal rollback.

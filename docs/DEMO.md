# Diploma Demonstration Runbook

This runbook produces a repeatable local demonstration without depending on retailer websites during the presentation.

## First start

1. Create `.env` from the committed template:

   ```bash
   cp .env.example .env
   ```

2. Replace every password placeholder and keep `.env` outside Git.

3. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Load the demonstration catalogue:

   ```bash
   docker compose --profile demo run --rm seed-demo
   ```

The seed command is safe to repeat. Stable identifiers and upserts prevent duplicate products and current prices.

## Presentation checks

Run these checks before opening the browser:

```bash
docker compose ps
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
curl 'http://localhost:8000/api/v1/products?per_page=3'
curl http://localhost:8000/api/v1/filters
```

Expected readiness response:

```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "cache": "ok"
  }
}
```

Open the following pages:

- `http://localhost:3000/az`
- `http://localhost:3000/ru`
- `http://localhost:8000/docs`

## Live scraper demonstration

The deterministic dataset should be loaded first. A retailer can change its markup or block a request at any time, so live crawling is an additional demonstration rather than a prerequisite.

```bash
docker compose --profile scraper run --rm scraper scrapy crawl kontakt_home
```

## Intentional fresh reset

The following operation permanently removes local database and Redis data:

```bash
docker compose down -v
docker compose up -d --build
docker compose --profile demo run --rm seed-demo
```

Do not run the reset against an environment containing data that must be preserved.

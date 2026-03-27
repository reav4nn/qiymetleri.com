<!-- prettier-ignore -->
<div align="center">

<img src="./frontend/public/qiymetleriTransparentWhite.png" alt="qiymetleri.com logo" height="80" />

# qiymetleri.com

**Real-time price comparison for electronics in Azerbaijan**

[![CI](https://img.shields.io/github/actions/workflow/status/reav4nn/qiymetleri/ci.yml?style=flat-square&label=CI)](https://github.com/reav4nn/qiymetleri/actions)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-3.14-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)

[Overview](#overview) · [Getting Started](#getting-started) · [Local Development](#local-development) · [API](#api-endpoints) · [Architecture](#architecture) · [Deployment](#deployment)

</div>

---

## Overview

Buying electronics in Azerbaijan means manually checking Kontakt Home, Baku Electronics, Irshad Electronics, and iSpace one by one. **qiymetleri.com** aggregates prices from all stores, ranks them cheapest-first, and shows price history trends — in a single search.

### Features

- **Multi-store comparison** — 4 stores, 2000+ products, prices updated every 2 hours
- **Price history charts** — 90-day price trends per product across all stores
- **Smart matching** — Fuzzy product matching across stores (pg_trgm + FTS hybrid)
- **AZ + RU** — Full Azerbaijani and Russian language support
- **SEO-optimized** — SSR, JSON-LD structured data, sitemap, OpenGraph
- **Mobile-first** — Responsive design with touch-optimized interactions
- **Admin panel** — Scraper health monitoring, product management, anomaly detection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript, Recharts |
| Backend | FastAPI, Python 3.13, SQLAlchemy 2.0 (async), Pydantic |
| Database | PostgreSQL 17 + TimescaleDB (time-series hypertables) |
| Cache | Redis 7 (cache-aside pattern, Celery broker) |
| Scraping | Scrapy 2.14 + Playwright 1.58 (headless Chromium) |
| Scheduling | Celery + Redis (beat schedule + GitHub Actions cron) |
| Proxy | Nginx 1.27 (reverse proxy, rate limiting, Basic Auth) |
| Containers | Docker Compose (7 services) |

## Project Structure

```
qiymetleri/
├── backend/                  # FastAPI REST API
│   ├── app/
│   │   ├── api/v1/           # Versioned endpoints (products, search, admin)
│   │   ├── core/             # Config, database, cache
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Business logic
│   └── alembic/              # Database migrations
├── frontend/                 # Next.js 16 App Router
│   └── src/
│       ├── app/[locale]/     # Pages (home, search, product detail, admin)
│       ├── components/       # Reusable React components
│       ├── lib/              # API client, SEO utilities, JSON-LD schemas
│       └── messages/         # i18n translations (az.json, ru.json)
├── scraper/                  # Scrapy + Playwright spiders
│   ├── qiymetleri_scraper/
│   │   ├── spiders/          # Store-specific spiders (4 stores)
│   │   ├── pipelines/        # Normalization + DB persistence
│   │   └── middlewares/      # Proxy rotation (BrightData)
│   ├── celery_app.py         # Celery task scheduler
│   └── tasks.py              # Periodic scraping tasks
├── shared/                   # Shared Python utilities
│   └── normalizer.py         # Product name normalization pipeline
├── docker/
│   ├── nginx/                # Reverse proxy + rate limiting
│   └── postgres/             # Schema init (init.sql)
├── docker-compose.yml        # All services (7 containers)
└── render.yaml               # Render.com deployment config
```

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2+
- [Node.js 22+](https://nodejs.org/) with [pnpm](https://pnpm.io/)
- [Python 3.13+](https://www.python.org/) with [Poetry](https://python-poetry.org/)

### Run with Docker (quickest)

```bash
git clone https://github.com/reav4nn/qiymetleri.git
cd qiymetleri

# Create .env with required secrets
cat > .env << 'EOF'
POSTGRES_PASSWORD=your_strong_password
ADMIN_PASSWORD=your_admin_password
REDIS_PASSWORD=redis_dev_password
EOF

# Start all services
docker compose up -d
```

This brings up 7 containers:

| Service | URL | Description |
|---------|-----|-------------|
| Nginx | http://localhost | Reverse proxy (main entry) |
| Frontend | http://localhost:3000 | Next.js web app |
| Backend | http://localhost:8000 | FastAPI + Swagger docs |
| PostgreSQL | localhost:5432 | TimescaleDB database |
| Redis | localhost:6379 | Cache + task broker |
| Celery Worker | — | Scraping task executor |
| Celery Beat | — | Periodic task scheduler |

### Run a scraper

```bash
# Via Docker (scraper profile)
docker compose --profile scraper run scraper scrapy crawl kontakt_home

# Or run all spiders
docker compose --profile scraper run scraper scrapy crawl ispace
docker compose --profile scraper run scraper scrapy crawl irshad_electronics
docker compose --profile scraper run scraper scrapy crawl baku_electronics
```

## Local Development

### Backend

```bash
cd backend
cp .env.example .env          # Edit with your DB credentials
poetry install
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000 with interactive docs at `/docs`.

### Frontend

```bash
cd frontend
cp .env.example .env.local    # Set NEXT_PUBLIC_API_URL=http://localhost:8000
pnpm install
pnpm dev
```

Open http://localhost:3000. The dev server supports hot reload.

### Scraper

```bash
cd scraper
poetry install
playwright install chromium   # Download browser binary

# Run a specific spider
scrapy crawl kontakt_home
scrapy crawl baku_electronics
scrapy crawl irshad_electronics
scrapy crawl ispace
```

> [!NOTE]
> The scraper requires PostgreSQL and Redis to be running. Start them with
> `docker compose up postgres redis -d` if running locally.

### Build for Production

```bash
# Frontend production build
cd frontend
pnpm build        # Outputs standalone build to .next/standalone
pnpm start        # Serves production build on port 3000

# Backend — no build step, served with uvicorn
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Docker images
docker compose build              # Build all images
docker compose build frontend     # Build single service
```

## API Endpoints

### Public API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/products` | List products (paginated, filterable) |
| `GET` | `/api/v1/products/{id}` | Product detail with all store prices |
| `GET` | `/api/v1/products/{id}/history` | Price history (default 90 days) |
| `GET` | `/api/v1/search?q=` | Full-text product search |
| `GET` | `/api/v1/filters` | Available filter options (brands, stores, categories) |

**Query parameters for `/api/v1/products`:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `per_page` | int | Items per page (1–100, default: 20) |
| `category` | string | `smartphones`, `laptops`, `headphones`, `smartwatches` |
| `brand` | string | Filter by brand |
| `store_id` | string | Filter by store |
| `min_price` / `max_price` | float | Price range in AZN |
| `sort_by` | string | `name`, `price_asc`, `price_desc` |

### Admin API (HTTP Basic Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/dashboard` | Platform statistics |
| `GET` | `/api/v1/admin/scraper/health` | Per-spider health and failure rates |
| `POST` | `/api/v1/admin/scraper/trigger/{spider}` | Manually trigger a spider |
| `GET` | `/api/v1/admin/anomalies` | Price anomaly detection (>30% change) |
| `PATCH` | `/api/v1/admin/products/{id}` | Edit product metadata |
| `DELETE` | `/api/v1/admin/products/batch/delete` | Batch delete products |

## Architecture

```
[Store Websites]
      ↓
[Scrapy + Playwright Spiders] → [Normalization Pipeline] → [PostgreSQL + TimescaleDB]
                                                                    ↓
                                                              [Redis Cache]
                                                                    ↓
[User] → [Next.js Frontend] → [Nginx] → [FastAPI Backend] ← [Celery Workers]
```

### Database Schema

| Table | Purpose |
|-------|---------|
| `stores` | Registered retailers (4 stores) |
| `products` | Canonical products with FTS index and trigram matching |
| `current_prices` | Denormalized latest price per product/store (fast reads) |
| `price_history` | TimescaleDB hypertable — 7-day chunks for time-series queries |
| `product_matches` | Cross-store fuzzy match tracking (accept/reject queue) |
| `scraper_runs` | Spider execution history for health monitoring |

> [!TIP]
> The schema auto-initializes via `docker/postgres/init.sql` when PostgreSQL starts.

## Environment Variables

### Root `.env` (Docker Compose)

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `ADMIN_PASSWORD` | Yes | Admin panel password |
| `REDIS_PASSWORD` | No | Redis password (default: `redis_dev_password`) |
| `PROXY_ENABLED` | No | Enable BrightData proxy (`true`/`false`) |
| `PROXY_USERNAME` | No | BrightData username |
| `PROXY_PASSWORD` | No | BrightData password |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |
| `NEXT_PUBLIC_ADSENSE_ID` | — | Google AdSense publisher ID |

> [!IMPORTANT]
> Change all default passwords before deploying to production.

## Deployment

### Production Stack

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | qiymetleri.vercel.app |
| Backend | Render (Docker) | qiymetleri.onrender.com |
| Database | Supabase (PostgreSQL) | Session Pooler |
| Cache | Upstash (Redis) | SSL connection |
| Scraper | GitHub Actions | Cron every 2 hours |

### CI/CD

GitHub Actions runs on every push to `main`:
- **Frontend**: `pnpm install` → TypeScript check → `pnpm build`
- **Backend**: `poetry install` → `ruff check` → `black --check`
- **Docker**: Build + push images to GHCR (`ghcr.io/reav4nn/qiymetleri-*`)

## Supported Stores

| Store | Spider | Products | Method |
|-------|--------|----------|--------|
| [Kontakt Home](https://kontakt.az) | `kontakt_home` | ~94 | data-gtm JSON extraction |
| [Baku Electronics](https://bakuelectronics.az) | `baku_electronics` | ~82 | CSS module selectors |
| [Irshad Electronics](https://irshad.az) | `irshad_electronics` | ~66 | BEM class selectors |
| [iSpace](https://ispace.az) | `ispace` | ~77 | Vue.js rendered (Apple only) |

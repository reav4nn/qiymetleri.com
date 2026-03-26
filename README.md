# qiymetleri.com

> Real-time price comparison platform for electronics in Azerbaijan

Find the cheapest smartphones, laptops, headphones, and smartwatches across all major Azerbaijani electronics retailers — in a single search.

<div align="center">

```
"Azərbaycanda ən sərfəli seçim"
```

</div>

## Overview

Buying electronics in Azerbaijan means manually checking [Kontakt Home](https://kontakt.az), [Baku Electronics](https://bakuelectronics.az), [Irshad Electronics](https://irshad.az), and [iSpace](https://ispace.az) one by one. **qiymetleri.com** eliminates that by aggregating prices from all stores, ranking them cheapest-first, and showing price history trends over time.

### How it works

```
Store websites → Scrapers (Playwright) → Normalize → PostgreSQL + TimescaleDB
                                                            ↓
User ← Next.js frontend ← Nginx ← FastAPI API ← Redis cache
```

1. **Scrapers** visit store websites periodically using headless browsers
2. **Normalization pipeline** cleans and matches products across stores
3. **TimescaleDB hypertable** records every price change for history charts
4. **FastAPI** serves product data with Redis caching
5. **Next.js** renders SEO-optimized pages with SSR/ISR

## Features

- **Multi-store search** — Compare prices from 4+ stores instantly
- **Price history** — 30/90-day price trends per product
- **Smart matching** — Products matched across stores despite naming differences
- **SEO-first** — Server-rendered pages with structured data for Google
- **Mobile-ready** — Responsive design, mobile-first approach
- **Fast** — Redis caching, ISR with 5-minute revalidation

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Backend | FastAPI, Python 3.13, SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 17 + TimescaleDB (hypertables) |
| Cache | Redis 7 |
| Scraping | Scrapy + Playwright (headless Chromium) |
| Proxy | Nginx 1.27 (reverse proxy, rate limiting) |
| Containers | Docker Compose |

## Project Structure

```
qiymetleri/
├── backend/              # FastAPI REST API
│   ├── app/
│   │   ├── api/v1/       # Versioned endpoints
│   │   ├── core/         # Config, database, cache
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   └── alembic/          # Database migrations
├── frontend/             # Next.js App Router
│   └── src/
│       ├── app/          # Pages (home, search, product detail)
│       ├── components/   # React components
│       └── lib/          # API client
├── scraper/              # Scrapy + Playwright
│   └── qiymetleri_scraper/
│       ├── spiders/      # Store-specific spiders
│       └── pipelines/    # Data cleaning + DB persistence
├── docker/
│   ├── nginx/            # Reverse proxy config
│   └── postgres/         # Schema + seed data
├── docker-compose.yml
└── memory-bank/          # Architecture docs
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js 22+](https://nodejs.org/) with [pnpm](https://pnpm.io/)
- [Python 3.13+](https://www.python.org/) with [Poetry](https://python-poetry.org/)

## Getting Started

### Run with Docker (recommended)

```bash
git clone https://github.com/your-username/qiymetleri.git
cd qiymetleri
docker compose up -d
```

This starts all services:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js web app |
| Backend | http://localhost:8000 | FastAPI + Swagger docs |
| API docs | http://localhost:8000/api/v1/openapi.json | OpenAPI spec |
| Nginx | http://localhost:80 | Reverse proxy |
| PostgreSQL | `localhost:5432` | Database |
| Redis | `localhost:6379` | Cache |

### Local development

**Backend:**

```bash
cd backend
cp .env.example .env
poetry install
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

**Scraper:**

```bash
cd scraper
poetry install
playwright install chromium
scrapy crawl kontakt_home
```

### Run the scraper

```bash
# Via Docker Compose (uses the scraper profile)
docker compose --profile scraper run scraper scrapy crawl kontakt_home

# Or locally
cd scraper && scrapy crawl kontakt_home -o results.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/products` | List products (filter by category, brand, price, store) |
| `GET` | `/api/v1/products/{id}` | Product detail with prices from all stores |
| `GET` | `/api/v1/search?q=` | Full-text product search |

**Query parameters for `/api/v1/products`:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `per_page` | int | Items per page (1–100, default: 20) |
| `category` | string | Filter by category |
| `brand` | string | Filter by brand |
| `store_id` | string | Filter by store |
| `min_price` | float | Minimum price (AZN) |
| `max_price` | float | Maximum price (AZN) |
| `sort_by` | string | `name`, `price_asc`, or `price_desc` |

## Database Schema

Four core tables power the platform:

- **`stores`** — Registered electronics retailers (Kontakt Home, Baku Electronics, etc.)
- **`products`** — Canonical product entities with full-text search index
- **`current_prices`** — Denormalized latest price per product per store (fast reads)
- **`price_history`** — TimescaleDB hypertable with 7-day chunks (time-series analytics)

> [!NOTE]
> The schema auto-initializes when PostgreSQL starts via `docker/postgres/init.sql`.

## Supported Stores

| Store | ID | Status |
|-------|----|--------|
| Kontakt Home | `kontakt_home` | Spider ready |
| Baku Electronics | `baku_electronics` | Planned |
| Irshad Electronics | `irshad_electronics` | Planned |
| iSpace | `ispace` | Planned |

## Environment Variables

Copy the example files and adjust as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**Backend** (`backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `postgres` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_USER` | `qiymetleri` | Database user |
| `POSTGRES_PASSWORD` | `qiymetleri_secret` | Database password |
| `POSTGRES_DB` | `qiymetleri` | Database name |
| `REDIS_HOST` | `redis` | Redis host |

> [!IMPORTANT]
> Change the default `POSTGRES_PASSWORD` before deploying to production.

**Frontend** (`frontend/.env.local`):

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |

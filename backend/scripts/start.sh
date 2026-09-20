#!/bin/bash
set -e

echo "=== Starting Qiymetleri Backend ==="
echo "PORT: ${PORT:-8000}"

# Run Alembic migrations and seed if DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations with Alembic..."
    alembic upgrade head || {
        echo "Alembic upgrade warning: migrations could not complete cleanly. Continuing..."
    }

    echo "Ensuring catalogue is populated..."
    python -m scripts.seed_catalogue || {
        echo "Seed warning: seed_catalogue did not complete. Continuing..."
    }
else
    echo "No DATABASE_URL found. Running without database migrations."
fi

echo "Launching Uvicorn server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

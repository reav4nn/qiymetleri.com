FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir poetry

COPY scraper/pyproject.toml scraper/poetry.lock* ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main

# Install Playwright browsers
RUN playwright install --with-deps chromium

COPY shared/ /app/shared/
COPY scraper/ .

ENV SCRAPY_SETTINGS_MODULE=qiymetleri_scraper.settings
ENV PYTHONPATH=/app

CMD ["scrapy", "crawl", "kontakt_home"]

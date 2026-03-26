FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir poetry

COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main

# Install Playwright browsers
RUN playwright install --with-deps chromium

COPY . .

CMD ["scrapy", "crawl", "kontakt_home"]

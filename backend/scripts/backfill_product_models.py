"""Dry-run, execute, or resume the resumable Product -> ProductModel backfill."""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid

from app.core.database import AsyncSessionLocal, engine
from app.services.model_backfill_service import dry_run_report, run_backfill


async def execute(args: argparse.Namespace) -> dict:
    async with AsyncSessionLocal() as session:
        if args.dry_run:
            return await dry_run_report(session)
        return await run_backfill(
            session,
            batch_size=args.batch_size,
            max_batches=args.max_batches,
            resume_run_id=uuid.UUID(args.resume_run) if args.resume_run else None,
        )


async def async_main(args: argparse.Namespace) -> int:
    try:
        result = await execute(args)
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if result.get("status") != "failed" else 1
    finally:
        await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--max-batches", type=int)
    parser.add_argument("--resume-run")
    args = parser.parse_args()
    if args.dry_run and (args.max_batches is not None or args.resume_run):
        parser.error("--dry-run cannot be combined with --max-batches/--resume-run")
    return asyncio.run(async_main(args))


if __name__ == "__main__":
    raise SystemExit(main())

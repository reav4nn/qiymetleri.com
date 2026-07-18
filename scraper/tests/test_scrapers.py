import asyncio

from qiymetleri_scraper.pipelines.price_pipeline import PriceCleaningPipeline
from qiymetleri_scraper.spiders.baku_electronics import BakuElectronicsSpider
from qiymetleri_scraper.spiders.irshad_electronics import IrshadElectronicsSpider
from qiymetleri_scraper.spiders.ispace import ISpaceSpider
from qiymetleri_scraper.spiders.kontakt_home import KontaktHomeSpider


def test_local_price_formats():
    parse = PriceCleaningPipeline._parse_price
    assert parse("1.899,99 ₼") == 1899.99
    assert parse("1 899,99") == 1899.99
    assert parse("1,899.99") == 1899.99
    assert parse("1899") == 1899.0


def test_each_spider_creates_four_start_requests():
    async def collect(spider):
        return [request async for request in spider.start()]

    for spider_class in (
        KontaktHomeSpider,
        BakuElectronicsSpider,
        IrshadElectronicsSpider,
        ISpaceSpider,
    ):
        requests = asyncio.run(collect(spider_class()))
        assert len(requests) == 4
        assert {request.cb_kwargs["category"] for request in requests} == {
            "smartphones",
            "laptops",
            "headphones",
            "smartwatches",
        }

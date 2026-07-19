import asyncio
from types import SimpleNamespace

from scrapy.http import HtmlResponse, Request

from qiymetleri_scraper.items import ProductItem
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


class FakeStats:
    def inc_value(self, key):
        return None


def _response(url: str, html: str, **meta) -> HtmlResponse:
    request = Request(url, meta=meta)
    return HtmlResponse(url, request=request, body=html, encoding="utf-8")


def test_kontakt_home_parses_server_rendered_product_card():
    spider = KontaktHomeSpider()
    spider.crawler = SimpleNamespace(stats=FakeStats())
    response = _response(
        "https://kontakt.az/telefoniya/smartfonlar",
        """
        <div class="prodItem product-item"
             data-gtm='{"item_name":"Samsung Galaxy S25 12/128 GB Silver","item_brand":"Samsung","price":1799.99}'>
          <a class="prodItem__img" href="/samsung-galaxy-s25">
            <picture><source srcset="https://kontakt.az/media/s25.webp"></picture>
          </a>
          <div class="prodItem__title">Samsung Galaxy S25 12/128 GB Silver</div>
        </div>
        """,
        category="smartphones",
    )

    items = [
        result
        for result in spider.parse_listing(response, "smartphones")
        if isinstance(result, ProductItem)
    ]

    assert len(items) == 1
    assert items[0]["original_title"] == "Samsung Galaxy S25 12/128 GB Silver"
    assert items[0]["price_raw"] == "1799.99 ₼"
    assert items[0]["url"] == "https://kontakt.az/samsung-galaxy-s25"
    assert items[0]["image_url"] == "https://kontakt.az/media/s25.webp"


def test_baku_electronics_parses_server_rendered_product_card():
    spider = BakuElectronicsSpider()
    spider.crawler = SimpleNamespace(stats=FakeStats())
    response = _response(
        "https://bakuelectronics.az/catalog/telefonlar-qadcetler/smartfonlar-mobil-telefonlar",
        """
        <a class="ProductCard_Product__abc" href="/mehsul/iphone-17">
          <img alt="Smartfon Apple iPhone 17 Pro 256GB Silver" src="data:image/gif;base64,placeholder">
          <noscript><img alt="Smartfon Apple iPhone 17 Pro 256GB Silver"
            src="https://media.bakuelectronics.az/iphone-17.webp"></noscript>
          <h4 class="ProductCard_ProductTitle__abc">Smartfon Apple iPhone 17 Pro 256GB Silver</h4>
          <span class="ProductCard_DiscountPrice__abc">3599.99 ₼</span>
          <span class="ProductCard_OriginalPrice__abc">3289.99 ₼</span>
        </a>
        """,
        category="smartphones",
        page_num=1,
    )

    items = [
        result
        for result in spider.parse_listing(response, "smartphones")
        if isinstance(result, ProductItem)
    ]

    assert len(items) == 1
    assert items[0]["original_title"] == "Smartfon Apple iPhone 17 Pro 256GB Silver"
    assert items[0]["price_raw"] == "3289.99 ₼"
    assert items[0]["url"] == "https://bakuelectronics.az/mehsul/iphone-17"
    assert items[0]["image_url"] == "https://media.bakuelectronics.az/iphone-17.webp"

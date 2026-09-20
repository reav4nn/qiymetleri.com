"""
Irshad Electronics spider — scrapes product listings from irshad.az

Server-rendered HTML with BEM-style CSS classes (product__*).
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import re
from datetime import datetime, timezone

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/az/telefon-ve-aksesuarlar/mobil-telefonlar",
    "laptops": "/az/notbuk-planset-ve-komputer-texnikasi/notbuklar",
    "headphones": "/az/telefon-ve-aksesuarlar/qulaqliqlar",
    "smartwatches": "/az/telefon-ve-aksesuarlar/smart-saatlar",
}

# Known brands per category — products with these brands pass validation
CATEGORY_BRANDS = {
    "smartphones": {
        "apple", "iphone", "samsung", "xiaomi", "huawei", "honor", "oppo",
        "vivo", "realme", "oneplus", "google", "motorola", "nokia", "nothing",
        "poco", "infinix", "tecno", "hmd", "cubot", "doogee", "oscal",
        "oukitel", "zte", "meizu", "sony", "htc", "blackview", "umidigi",
        "agm", "cat",
    },
    "laptops": {
        "apple", "lenovo", "hp", "dell", "acer", "asus", "msi", "microsoft",
        "huawei", "honor", "samsung", "razer", "gigabyte", "toshiba",
        "macbook",
    },
    "headphones": {
        "apple", "samsung", "jbl", "marshall", "beats", "bose", "sennheiser",
        "sony", "xiaomi", "huawei", "honor", "razer", "logitech",
        "steelseries", "corsair", "hyperx", "jabra", "anker", "soundcore",
        "edifier", "haylou", "borofone", "celebrat", "euroacs", "baseus",
        "canyon", "akg", "skullcandy", "1more", "marley", "monster",
    },
    "smartwatches": {
        "apple", "samsung", "xiaomi", "huawei", "honor", "garmin", "fitbit",
        "amazfit", "mibro", "haylou", "wonlex",
    },
}

# Keywords in product name that confirm category membership
CATEGORY_KEYWORDS = {
    "smartphones": [
        r"\b\d+\s*gb\b", r"\b\d+\s*tb\b", r"\bphone\b", r"\btelefon\b",
        r"\biphone\b", r"\bgalaxy [sazm]", r"\bredmi\b", r"\bnote \d",
        r"\b[45]g\b", r"\blte\b", r"\bdual sim\b", r"\bds\b", r"\bflip\b",
        r"\bfold\b", r"\bpro max\b",
    ],
    "laptops": [
        r"\blaptop\b", r"\bnotebook\b", r"\bmacbook\b", r"\bthinkpad\b",
        r"\bideapad\b", r"\bzenbook\b", r"\bvivobook\b", r"\bpavilion\b",
        r"\binspir", r"\blatitude\b", r"\baspire\b", r"\bswift\b",
        r"\bnitro\b", r"\bpredator\b", r'\b\d+\.?\d*"\b', r"\bintel\b",
        r"\bryzen\b", r"\bcore i[3579]\b", r"\bm[1-5]\b",
    ],
    "headphones": [
        r"\bheadphone\b", r"\bearphone\b", r"\bearbud\b", r"\bheadset\b",
        r"\bqulaql[ıi]q\b", r"\bairpods\b", r"\bbuds\b", r"\btws\b",
        r"\bin-ear\b", r"\bover-ear\b", r"\bon-ear\b", r"\bnoise cancel",
        r"\banc\b", r"\bbluetooth\b.*\b(ear|head)",
    ],
    "smartwatches": [
        r"\bwatch\b", r"\bsaat\b", r"\bband\b", r"\btracker\b",
        r"\bsmartwatch\b", r"\bwearable\b", r"\bfit\b", r"\bgt\s*\d",
        r"\bgtr\b", r"\bgts\b",
    ],
}

# Products containing these terms are NEVER valid for ANY of our categories
JUNK_KEYWORDS = [
    r"\bwashing\b", r"\bpaltaryuyan\b", r"\bvacuum\b", r"\btozsoran\b",
    r"\bdishwasher\b", r"\bqabyuyan\b", r"\brefrigerator\b", r"\bsoyuducu\b",
    r"\bconditioner\b.*\bbtu\b", r"\bkondisioner\b", r"\bboiler\b",
    r"\bkombi\b", r"\bcoffee grinder\b", r"\bblender\b", r"\bmixer\b",
    r"\bair fryer\b", r"\bhair\b.*\b(dryer|styler|straighten|curl)\b",
    r"\bairwrap\b", r"\bskateboard\b", r"\bhot wheels\b", r"\btoys\b",
    r"\bplaystation\b", r"\bxbox\b", r"\bgta\b", r"\belektromobil\b",
    r"\bmatress\b", r"\bmattress\b", r"\byorğan\b", r"\bkreslo\b",
    r"\bbackpack\b", r"\bpressure washer\b", r"\b\d+ kw\b",
    r"\binverter\b", r"\bsmart tv\b", r"\bled tv\b",
    r"\bparca\b.*\b(boz|qara|ağ)\b", r"\bindiksion\b",
    r"\bmulti-styler\b", r"\bfootball\b", r"\bbasketball\b",
    r"\bflash drive\b", r"\bsandisk\b", r"\bgame console\b",
    r"\btreadmill\b", r"\bwalkingpad\b",
    r"\bprojector\b", r"\bproyektor\b",
    r"\btaube\b.*\btv\b",
    # Appliance brands — never electronics we track
    r"\bbeko\b", r"\bbosch\b", r"\bmidea\b", r"\bdyson\b",
    r"\bfujifilm\b", r"\binstax\b", r"\bhaier\b", r"\bvestel\b",
    r"\barcelik\b", r"\btefal\b", r"\belectrolux\b", r"\bindesit\b",
    r"\bwhirlpool\b", r"\bgorenje\b", r"\bphilips\b.*\b(iron|shaver|blender)\b",
    r"\bdelonghi\b", r"\bkenwood\b",
]

# Cross-category exclusions — brand may match but product belongs elsewhere
CATEGORY_EXCLUSIONS = {
    "smartphones": [
        r"\bearbuds?\b", r"\bheadphones?\b", r"\bearphones?\b", r"\bheadset\b",
        r"\bwatch\b", r"\bsmart saat\b", r"\bsaat\b", r"\bband\b",
        r"\bpad\b", r"\btablet\b", r"\blaptop\b", r"\bnotebook\b",
        r"\bmacbook\b", r"\bairpods\b", r"\bbuds\b",
        r"\bcase\b", r"\bcover\b", r"\bfolio\b", r"\bsilicone\b",
        r"\btv\b", r"\btelevizor\b", r"\bled\b.*\bsmart\b",
        r"\blg\s+g[rn]-",  # LG fridge model numbers (GR-xxx, GN-xxx)
        r"\blg\s+f\d+v",   # LG washing machine model numbers (F4V...)
    ],
    "laptops": [
        r"\bearbuds?\b", r"\bheadphones?\b", r"\bearphones?\b", r"\bheadset\b",
        r"\bqulaql[ıi]q\b", r"\bearpods\b",
        r"\bwatch\b", r"\bsmart saat\b", r"\bsaat\b",
        r"\biphone\b", r"\bgalaxy [sazm]", r"\bairpods\b", r"\bbuds\b",
        r"\bredmi\s+\d", r"\bredmi\s+note\b", r"\bpoco\b",
        r"\bhonor\s+x\d", r"\bhonor\s+magic\d", r"\bhonor\s+[0-9]",
        r"\bmagic\s+mouse\b", r"\bmagic\s+keyboard\b", r"\bklaviatura\b",
        r"\bcharger\b", r"\badapter\b", r"\bşarj\b", r"\bqidalanma\b",
        r"\bconnector\b", r"\bçoxportlu\b",
    ],
    "headphones": [
        r"\bwatch\b", r"\bsmart saat\b", r"\bsaat\b",
        r"\biphone\b", r"\bgalaxy [sazm]", r"\bpad\b", r"\btablet\b",
        r"\blaptop\b", r"\bnotebook\b", r"\bmacbook\b",
        r"\bgame console\b",
        r"\bprojector\b", r"\bproyektor\b",
        r"\bmouse\b", r"\bsuperlight\b",
        r"\bfolio\b", r"\bglass\b", r"\banty glass\b",
        r"\bredmi\s+\d", r"\bredmi\s+note\b", r"\bpoco\b",
        r"\bhonor\s+x\d", r"\bhonor\s+pad\b",
        r"\btv\b", r"\btelevizor\b",
        r"\b\d+\s*gb\s*/\s*\d+\s*gb\b",  # "8 GB / 256 GB" = phone pattern
    ],
    "smartwatches": [
        r"\bearbuds?\b", r"\bheadphones?\b", r"\bearphones?\b", r"\bheadset\b",
        r"\biphone\b", r"\bgalaxy [sazm]", r"\bpad\b", r"\btablet\b",
        r"\blaptop\b", r"\bnotebook\b", r"\bmacbook\b",
        r"\bairpods\b", r"\bbuds\b",
        r"\bredmi\s+\d", r"\bredmi\s+note\b", r"\bpoco\b",
        r"\bhonor\s+x\d", r"\bhonor\s+magic\d", r"\bhonor\s+[0-9]",
        r"\btv\b", r"\btelevizor\b",
        r"\bipad\b",
        r"\bflip\b", r"\bfold\b",
        r"\b\d+\s*gb\s*/\s*\d+\s*gb\b",  # "8 GB / 256 GB" = phone pattern
    ],
}


class IrshadElectronicsSpider(scrapy.Spider):
    name = "irshad_electronics"
    allowed_domains = ["irshad.az"]
    store_id = "irshad_electronics"

    custom_settings = {
        "DOWNLOAD_DELAY": 30,
        "RANDOMIZE_DOWNLOAD_DELAY": False,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
    }

    async def start(self):
        base_url = "https://irshad.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                    },
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 5000),
                        PageMethod(
                            "wait_for_selector",
                            ".products__list__body .product",
                            timeout=20000,
                        ),
                    ],
                    "category": category,
                },
                cb_kwargs={"category": category},
                errback=self.errback_close_page,
            )

    async def parse_listing(self, response, category: str):
        self.crawler.stats.inc_value(f"category/{category}/pages")
        page = response.meta.get("playwright_page")

        try:
            # Click "daha çoxuna bax" (show more) — track count to stop early
            if page:
                clicks = 0
                prev_count = await page.evaluate(
                    'document.querySelectorAll("div.product").length'
                )
                while clicks < 20:
                    btn = await page.query_selector(
                        'button:has-text("daha çoxuna bax"), '
                        'a:has-text("daha çoxuna bax")'
                    )
                    if not btn:
                        break
                    try:
                        await btn.click()
                        await page.wait_for_timeout(2000)
                        clicks += 1
                        new_count = await page.evaluate(
                            'document.querySelectorAll("div.product").length'
                        )
                        if new_count <= prev_count:
                            self.logger.info(
                                f"[IRSHAD] No new products after click {clicks} "
                                f"in {category}, stopping"
                            )
                            break
                        prev_count = new_count
                    except Exception:
                        break

            # Extract all products from live DOM (after load-more clicks)
            products_data = []
            if page:
                products_data = await page.evaluate('''
                    () => {
                        const cards = document.querySelectorAll("div.product");
                        return Array.from(cards).map(card => {
                            const nameEl = card.querySelector(".product__name");
                            const name = nameEl ? nameEl.textContent.trim() : "";

                            const newPrice = card.querySelector(".product__price__current .new-price");
                            const priceEl = card.querySelector(".product__price__current");
                            const price = newPrice
                                ? newPrice.textContent.trim()
                                : (priceEl ? priceEl.textContent.trim() : "");

                            const link = card.querySelector("a.product-link");
                            const url = link ? link.href : "";

                            const img = card.querySelector(".product__img img");
                            let imgSrc = "";
                            if (img) {
                                const src = img.currentSrc || img.src || "";
                                if (src && !src.startsWith("data:") &&
                                    !src.includes("icon") && !src.includes(".svg")) {
                                    imgSrc = src;
                                }
                            }

                            const text = card.textContent || "";
                            const inStock = text.includes("Stokda var");

                            return {name, price, url, imgSrc, inStock};
                        });
                    }
                ''')

            self.logger.info(
                f"[IRSHAD] {len(products_data)} products in {category} "
                f"on {response.url}"
            )

            skipped = 0
            for data in products_data:
                name = data.get("name", "").strip()
                if not name or len(name) < 3:
                    continue

                if not self._validate_category(name, category):
                    skipped += 1
                    self.logger.debug(
                        f"[IRSHAD] Skipped '{name}' — doesn't match {category}"
                    )
                    continue

                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()
                item["original_title"] = name
                item["price_raw"] = data.get("price", "")
                item["brand"] = self._extract_brand(name)
                item["in_stock"] = data.get("inStock", False)

                url = data.get("url", "")
                if url:
                    item["url"] = url

                img_src = data.get("imgSrc", "")
                if img_src:
                    item["image_url"] = img_src

                yield item

            if skipped:
                self.logger.info(
                    f"[IRSHAD] Skipped {skipped} misclassified products "
                    f"in {category}"
                )
        finally:
            if page:
                await page.close()

    async def errback_close_page(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error(f"Request failed: {failure.value}")
        category = failure.request.meta.get("category", "unknown")
        self.crawler.stats.inc_value(f"category/{category}/errors")

    @staticmethod
    def _extract_brand(title: str) -> str | None:
        known_brands = [
            "apple", "iphone", "samsung", "xiaomi", "huawei", "honor",
            "oppo", "vivo", "realme", "oneplus", "google", "motorola",
            "sony", "lg", "asus", "lenovo", "hp", "dell",
            "acer", "msi", "jbl", "marshall", "beats",
            "bose", "sennheiser", "garmin", "fitbit",
            "poco", "infinix", "tecno", "nokia", "nothing",
            "haylou", "mibro", "hmd", "cubot", "doogee", "oscal",
            "oukitel", "zte", "meizu", "amazfit", "wonlex",
            "borofone", "celebrat", "euroacs", "baseus", "canyon",
            "edifier", "razer", "microsoft", "macbook",
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                if brand == "iphone":
                    return "apple"
                if brand == "macbook":
                    return "apple"
                return brand
        return None

    @staticmethod
    def _validate_category(name: str, category: str) -> bool:
        """Check if a product name plausibly belongs to the given category."""
        # Normalize Turkish characters for matching
        name_lower = name.lower().replace("İ", "i").replace("i̇", "i")

        # Reject if name matches obvious junk keywords
        for pattern in JUNK_KEYWORDS:
            if re.search(pattern, name_lower):
                return False

        # Reject if name contains keywords from OTHER categories
        exclusions = CATEGORY_EXCLUSIONS.get(category, [])
        for pattern in exclusions:
            if re.search(pattern, name_lower):
                return False

        # Accept if name contains a brand known for this category
        brands = CATEGORY_BRANDS.get(category, set())
        for brand in brands:
            if re.search(rf"\b{re.escape(brand)}\b", name_lower):
                return True

        # Accept if name matches category-specific keywords
        keywords = CATEGORY_KEYWORDS.get(category, [])
        for pattern in keywords:
            if re.search(pattern, name_lower):
                return True

        # Unknown product — reject to be safe
        return False

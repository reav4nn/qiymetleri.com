import scrapy


class ProductItem(scrapy.Item):
    store_id = scrapy.Field()
    original_title = scrapy.Field()
    url = scrapy.Field()
    price_raw = scrapy.Field()
    price_azn = scrapy.Field()
    in_stock = scrapy.Field()
    brand = scrapy.Field()
    category = scrapy.Field()
    image_url = scrapy.Field()
    attributes = scrapy.Field()
    scraped_at = scrapy.Field()

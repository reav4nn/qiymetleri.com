/**
 * JSON-LD structured data generators for SEO.
 */

import { SITE_URL, SITE_NAME } from "./seo";

export interface ProductSchemaInput {
  name: string;
  image?: string | null;
  brand?: string | null;
  description: string;
  url: string;
  offers: {
    storeName: string;
    price: number;
    inStock: boolean;
    url?: string | null;
  }[];
}

export function productSchema(input: ProductSchemaInput) {
  const offers = input.offers.map((o) => ({
    "@type": "Offer" as const,
    priceCurrency: "AZN",
    price: o.price.toFixed(2),
    availability: o.inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    seller: { "@type": "Organization" as const, name: o.storeName },
    ...(o.url ? { url: o.url } : {}),
  }));

  const inStockPrices = input.offers
    .filter((o) => o.inStock)
    .map((o) => o.price);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    ...(input.image ? { image: input.image } : {}),
    description: input.description,
    url: input.url,
    ...(input.brand
      ? { brand: { "@type": "Brand", name: input.brand } }
      : {}),
    offers:
      inStockPrices.length > 0
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "AZN",
            lowPrice: Math.min(...inStockPrices).toFixed(2),
            highPrice: Math.max(...inStockPrices).toFixed(2),
            offerCount: offers.length,
            offers,
          }
        : offers,
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
  };
}

export function breadcrumbSchema(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/az/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

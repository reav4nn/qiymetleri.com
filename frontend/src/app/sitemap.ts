import type { MetadataRoute } from "next";
import { SITE_URL, LOCALES } from "@/lib/seo";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProductItem {
  id: string;
  name: string;
}

interface PaginatedResponse {
  items: ProductItem[];
  total: number;
  pages: number;
}

async function fetchAllProductIds(): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/products?page=${page}&per_page=100`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) break;
      const data: PaginatedResponse = await res.json();
      totalPages = data.pages;
      for (const item of data.items) {
        ids.push(item.id);
      }
      page++;
    } catch {
      break;
    }
  }

  return ids;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productIds = await fetchAllProductIds();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  // Home pages
  for (const locale of LOCALES) {
    entries.push({
      url: `${SITE_URL}/${locale}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    });
  }

  // Category search pages
  const categories = ["smartphones", "laptops", "headphones", "smartwatches"];
  for (const locale of LOCALES) {
    for (const cat of categories) {
      entries.push({
        url: `${SITE_URL}/${locale}/search?category=${cat}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  // Product pages
  for (const id of productIds) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/products/${id}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  return entries;
}

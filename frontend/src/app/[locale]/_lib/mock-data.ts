export type CategoryKey =
  | "phones"
  | "laptops"
  | "tvs"
  | "headphones"
  | "tablets"
  | "watches";

export type Category = {
  slug: string;
  key: CategoryKey;
  count: number;
};

export const categories: Category[] = [
  { slug: "telefonlar", key: "phones", count: 2140 },
  { slug: "noutbuklar", key: "laptops", count: 1380 },
  { slug: "televizorlar", key: "tvs", count: 960 },
  { slug: "qulaqliqlar", key: "headphones", count: 1720 },
  { slug: "tabletler", key: "tablets", count: 640 },
  { slug: "smart-saatlar", key: "watches", count: 880 },
];

export type Store = {
  name: string;
  logo: string;
};

export const stores: Store[] = [
  { name: "Kontakt Home", logo: "/stores/kontakt_home.png" },
  { name: "Baku Electronics", logo: "/stores/baku_electronics.png" },
  { name: "Irshad Electronics", logo: "/stores/irshad_electronics.png" },
  { name: "iSpace", logo: "/stores/ispace.png" },
];

export type Product = {
  id: string;
  name: string;
  imageHint: string;
  price: number;
  offers: number;
  discountPercent?: number;
};

export const popularProducts: Product[] = [
  {
    id: "iphone-15-128gb-black",
    name: "Apple iPhone 15 128GB Black",
    imageHint: "telefon şəkli",
    price: 1799,
    offers: 4,
    discountPercent: 8,
  },
  {
    id: "galaxy-s24-256gb-gray",
    name: "Samsung Galaxy S24 256GB Gray",
    imageHint: "telefon şəkli",
    price: 1549,
    offers: 4,
    discountPercent: 12,
  },
  {
    id: "macbook-air-m3-13-256gb",
    name: 'Apple MacBook Air M3 13" 256GB',
    imageHint: "noutbuk şəkli",
    price: 2299,
    offers: 3,
  },
  {
    id: "sony-wh-1000xm5",
    name: "Sony WH-1000XM5 Qulaqlıq",
    imageHint: "qulaqlıq şəkli",
    price: 649,
    offers: 4,
    discountPercent: 15,
  },
  {
    id: "samsung-55-crystal-uhd-4k",
    name: 'Samsung 55" Crystal UHD 4K TV',
    imageHint: "televizor şəkli",
    price: 1099,
    offers: 3,
    discountPercent: 6,
  },
  {
    id: "apple-watch-series-9-41mm",
    name: "Apple Watch Series 9 41mm",
    imageHint: "saat şəkli",
    price: 799,
    offers: 4,
  },
  {
    id: "ipad-10-9-64gb-wifi",
    name: 'Apple iPad 10.9" 64GB Wi-Fi',
    imageHint: "tablet şəkli",
    price: 899,
    offers: 3,
    discountPercent: 9,
  },
  {
    id: "redmi-note-13-pro-256gb",
    name: "Xiaomi Redmi Note 13 Pro 256GB",
    imageHint: "telefon şəkli",
    price: 569,
    offers: 4,
    discountPercent: 18,
  },
];

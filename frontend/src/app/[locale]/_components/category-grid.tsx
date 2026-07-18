import { Headphones, Laptop, Smartphone, Tablet, Tv, Watch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { FilterOption } from "@/lib/api";

type CategoryKey = "phones" | "laptops" | "tvs" | "headphones" | "tablets" | "watches";

const categories: { id: string; key: CategoryKey }[] = [
  { id: "smartphones", key: "phones" },
  { id: "laptops", key: "laptops" },
  { id: "televisions", key: "tvs" },
  { id: "headphones", key: "headphones" },
  { id: "tablets", key: "tablets" },
  { id: "smartwatches", key: "watches" },
];

const categoryIcons: Record<CategoryKey, typeof Smartphone> = {
  phones: Smartphone,
  laptops: Laptop,
  tvs: Tv,
  headphones: Headphones,
  tablets: Tablet,
  watches: Watch,
};

export async function CategoryGrid({
  categories: apiCategories,
}: {
  categories: FilterOption[];
}) {
  const t = await getTranslations();

  return (
    <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => {
        const Icon = categoryIcons[category.key];
        const count = apiCategories.find((item) => item.id === category.id)?.count ?? 0;
        return (
          <Link
            key={category.id}
            href="#"
            className="flex flex-col gap-2.5 rounded-chip border-[1.5px] border-border bg-white px-3.5 py-4 transition-colors hover:border-accent"
          >
            <span className="flex size-[38px] items-center justify-center rounded-button bg-accent-soft">
              <Icon className="size-[18px] text-accent" strokeWidth={2} />
            </span>
            <span className="text-sm font-bold">{t(`categories.${category.key}`)}</span>
            <span className="text-xs font-medium text-[#a1a1aa]">
              {t("categories.count", { count })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

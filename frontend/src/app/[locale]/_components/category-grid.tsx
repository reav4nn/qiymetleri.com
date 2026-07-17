import { Headphones, Laptop, Smartphone, Tablet, Tv, Watch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { categories, type CategoryKey } from "@/app/[locale]/_lib/mock-data";

const categoryIcons: Record<CategoryKey, typeof Smartphone> = {
  phones: Smartphone,
  laptops: Laptop,
  tvs: Tv,
  headphones: Headphones,
  tablets: Tablet,
  watches: Watch,
};

export async function CategoryGrid() {
  const t = await getTranslations();

  return (
    <div className="mb-7 grid grid-cols-6 gap-3">
      {categories.map((category) => {
        const Icon = categoryIcons[category.key];
        return (
          <Link
            key={category.slug}
            href="#"
            className="flex flex-col gap-2.5 rounded-chip border-[1.5px] border-border bg-white px-3.5 py-4 transition-colors hover:border-accent"
          >
            <span className="flex size-[38px] items-center justify-center rounded-button bg-accent-soft">
              <Icon className="size-[18px] text-accent" strokeWidth={2} />
            </span>
            <span className="text-sm font-bold">{t(`categories.${category.key}`)}</span>
            <span className="text-xs font-medium text-[#a1a1aa]">
              {t("categories.count", { count: category.count })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

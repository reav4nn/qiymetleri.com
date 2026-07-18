import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ProductSummary } from "@/lib/api";
import { FavouriteButton } from "@/components/favourite-button";

export async function ProductCard({ product }: { product: ProductSummary }) {
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <Link
      href={`/products/${product.id}`}
      className="group relative flex flex-col gap-3 rounded-card border-[1.5px] border-border bg-white p-4 transition-shadow hover:border-[#e4e4e7] hover:shadow-[0_8px_24px_rgba(0,0,0,.08)]"
    >
      <FavouriteButton label={t("product.favourite")} />

      <div
        className="flex aspect-[4/3] items-center justify-center rounded-button bg-contain bg-center bg-no-repeat sm:aspect-square"
        style={{
          backgroundImage: product.image_url
            ? `url(${JSON.stringify(product.image_url)})`
            : "repeating-linear-gradient(45deg, #f4f4f5 0, #f4f4f5 10px, #fafafa 10px, #fafafa 20px)",
        }}
      >
        {!product.image_url ? (
          <span className="font-mono text-[11px] text-[#a1a1aa]">qiymetleri.com</span>
        ) : null}
      </div>

      <div className="h-[38px] overflow-hidden text-sm font-semibold leading-[1.35]">
        {product.name}
      </div>

      <div>
        <div className="mb-0.5 text-[11px] font-bold tracking-[0.03em] text-[#16a34a] uppercase">
          {t("product.cheapest")}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold tracking-[-0.02em]">
            {product.lowest_price === null
              ? "—"
              : `${format.number(product.lowest_price)} ${t("product.unit")}`}
          </span>
          <span className="rounded-md bg-[#eff6ff] px-2 py-[3px] text-xs font-bold text-[#2563eb]">
            {t("product.offers", { count: product.store_count })}
          </span>
        </div>
      </div>
    </Link>
  );
}

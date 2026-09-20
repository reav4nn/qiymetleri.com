import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getHomeData } from "@/lib/api";
import { CategoryGrid } from "./_components/category-grid";
import { StoresBar } from "./_components/stores-bar";
import { ProductGrid } from "./_components/product-grid";

export default async function HomePage() {
  const t = await getTranslations();
  const homeData = await getHomeData();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[50vh] max-w-[1280px] px-4 pt-6 pb-[60px] sm:px-6 sm:pt-7">
        <h1 className="mb-4 text-xl font-extrabold tracking-[-0.02em] sm:text-[22px]">
          {t("home.hero")}
        </h1>

        <CategoryGrid categories={homeData.categories} />
        <StoresBar stores={homeData.stores} />
        <h2 className="mb-4 text-lg font-extrabold sm:text-xl">
          {t("home.popularTitle")}
        </h2>
        <ProductGrid products={homeData.products} />
        {!homeData.available ? (
          <p className="mt-4 text-sm text-[#71717a]" role="status">
            {t("home.dataUnavailable")}
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

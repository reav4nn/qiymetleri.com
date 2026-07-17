import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Link } from "@/i18n/navigation";
import { CategoryGrid } from "./_components/category-grid";
import { StoresBar } from "./_components/stores-bar";
import { ProductGrid } from "./_components/product-grid";

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-6 pt-7 pb-[60px] min-h-[50vh]">
        <h1 className="mb-4 text-[22px] font-extrabold tracking-[-0.02em]">
          {t("home.hero")}
        </h1>

        <CategoryGrid />
        <StoresBar />


      </main>
      <SiteFooter />
    </>
  );
}

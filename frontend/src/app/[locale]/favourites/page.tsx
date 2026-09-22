import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getAllCatalogueProducts } from "@/lib/real-catalogue";
import { FavouritesClient } from "./favourites-client";

export default async function FavouritesPage() {
  const t = await getTranslations();
  const allProducts = getAllCatalogueProducts();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <nav
          className="mb-4 flex items-center gap-1 text-sm text-[#71717a]"
          aria-label={t("common.breadcrumb")}
        >
          <Link href="/" className="hover:text-foreground">
            {t("common.home")}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="text-foreground">{t("favourites.title")}</span>
        </nav>

        <h1 className="mb-6 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
          {t("favourites.title")}
        </h1>

        <FavouritesClient allProducts={allProducts} />
      </main>
      <SiteFooter />
    </>
  );
}

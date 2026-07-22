import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[60vh] max-w-[760px] items-center px-4 py-12 sm:px-6">
        <div className="w-full rounded-card border border-border bg-white p-6 text-center sm:p-10">
          <p className="text-sm font-extrabold tracking-[0.1em] text-accent uppercase">404</p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            {t("notFound.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-prose text-[#71717a]">{t("notFound.body")}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-button bg-accent px-5 text-sm font-bold text-white"
            >
              {t("notFound.home")}
            </Link>
            <Link
              href="/products"
              className="inline-flex min-h-12 items-center justify-center rounded-button border border-border bg-white px-5 text-sm font-bold"
            >
              {t("notFound.catalogue")}
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

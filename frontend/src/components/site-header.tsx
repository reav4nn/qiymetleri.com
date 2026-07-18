import Image from "next/image";
import { Grid2X2, Search, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function SiteHeader() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:flex-nowrap">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl"
        >
          <Image src="/logo.svg" alt="qiymetleri.com" width={32} height={32} className="object-contain" />
          <div className="hidden items-baseline gap-0.5 sm:flex">
            <span className="text-foreground">qiymetleri</span>
            <span className="text-accent">.com</span>
          </div>
        </Link>

        <Link
          href="/products"
          className="hidden min-h-11 shrink-0 items-center gap-2 rounded-button bg-accent px-4 text-sm font-semibold whitespace-nowrap text-white xl:flex"
        >
          <Grid2X2 className="size-4" />
          {t("nav.categories")}
        </Link>

        <form
          action={`/${locale}/products`}
          className="relative order-last w-full lg:order-none lg:flex-1"
          role="search"
        >
          <Input
            name="q"
            type="search"
            placeholder={t("search.placeholder")}
            className="min-h-12 rounded-input border-[1.5px] border-[#e4e4e7] bg-[#fafafa] py-3 pr-[52px] pl-4 text-[15px] focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("search.submit")}
            className="absolute top-1/2 right-1 size-10 -translate-y-1/2 rounded-[9px] bg-accent text-white hover:bg-accent/90"
          >
            <Search className="size-4" strokeWidth={2} />
          </Button>
        </form>

        <LanguageToggle />

        <Link
          href="/login"
          aria-label={t("nav.login")}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-button border-[1.5px] border-[#e4e4e7] bg-white px-3 text-sm font-semibold whitespace-nowrap text-foreground xl:px-4"
        >
          <UserRound className="size-[18px] text-accent" />
          <span className="hidden xl:inline">{t("nav.login")}</span>
        </Link>
      </div>
    </header>
  );
}

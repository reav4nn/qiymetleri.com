import Image from "next/image";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-6 py-[14px]">
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em]"
        >
          <Image src="/logo.svg" alt="qiymetleri.com" width={32} height={32} className="object-contain" />
          <div className="flex items-baseline gap-0.5">
            <span className="text-foreground">qiymetleri</span>
            <span className="text-accent">.com</span>
          </div>
        </Link>

        <Link
          href="#"
          className="flex shrink-0 items-center gap-2 rounded-button bg-accent px-4 py-[11px] text-sm font-semibold whitespace-nowrap text-white"
        >
          <span className="grid grid-cols-2 gap-0.5">
            <span className="size-[5px] bg-white" />
            <span className="size-[5px] bg-white" />
            <span className="size-[5px] bg-white" />
            <span className="size-[5px] bg-white" />
          </span>
          {t("nav.categories")}
        </Link>

        <form className="relative flex-1" role="search">
          <Input
            type="search"
            placeholder={t("search.placeholder")}
            className="h-auto rounded-input border-[1.5px] border-[#e4e4e7] bg-[#fafafa] py-[13px] pr-[48px] pl-[18px] text-[15px] focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("search.submit")}
            className="absolute top-1/2 right-1.5 size-9 -translate-y-1/2 rounded-[9px] bg-accent text-white hover:bg-accent/90"
          >
            <Search className="size-4" strokeWidth={2} />
          </Button>
        </form>

        <LanguageToggle />

        <Link
          href="#"
          className="flex shrink-0 items-center gap-2 rounded-button border-[1.5px] border-[#e4e4e7] bg-white px-4 py-[9px] text-sm font-semibold whitespace-nowrap text-foreground"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e11d2a"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          {t("nav.login")}
        </Link>
      </div>
    </header>
  );
}

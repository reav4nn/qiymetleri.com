import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const shopLinks = [
  ["smartphones", "phones"],
  ["laptops", "laptops"],
  ["televisions", "tvs"],
] as const;

const informationLinks = [
  ["about", "about"],
  ["partnership", "partnership"],
  ["social", "social"],
  ["contact", "contact"],
] as const;

const legalLinks = [
  ["terms", "terms"],
  ["privacy", "privacy"],
  ["personal-data", "personalData"],
  ["consent", "consent"],
] as const;

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="border-t border-border bg-[#fafafa] pt-12 pb-7 text-[#71717a] sm:pt-16 sm:pb-8">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1 lg:gap-6">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 text-2xl font-extrabold tracking-[-0.02em] text-[#09090b]"
            >
              <Image src="/logo.svg" alt="qiymetleri.com" width={28} height={28} />
              <div className="flex items-baseline gap-0.5">
                <span>qiymetleri</span>
                <span className="text-accent">.com</span>
              </div>
            </Link>
            <p >{t("footer.tagline")}</p>
          </div>

          <FooterColumn title={t("footer.shop")}>
            {shopLinks.map(([category, key]) => (
              <li key={category}>
                <Link
                  href={`/products?category=${category}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-[#09090b]"
                >
                  {t(`categories.${key}`)}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t("footer.information")}>
            {informationLinks.map(([href, key]) => (
              <li key={href}>
                <Link
                  href={`/${href}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-[#09090b]"
                >
                  {t(`footer.${key}`)}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t("footer.legal")} className="col-span-2 lg:col-span-1">
            {legalLinks.map(([href, key]) => (
              <li key={href}>
                <Link
                  href={`/${href}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-[#09090b]"
                >
                  {t(`footer.${key}`)}
                </Link>
              </li>
            ))}
          </FooterColumn>
        </div>

        <div className="mt-10 border-t border-[#e4e4e7] pt-6 text-[13px] text-[#a1a1aa] sm:mt-14 sm:pt-8">
          <p>{t("footer.copyright", { year: 2026 })}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <h2 className="text-[13px] font-bold tracking-[0.08em] text-[#09090b] uppercase">
        {title}
      </h2>
      <ul className="flex flex-col text-sm">{children}</ul>
    </div>
  );
}

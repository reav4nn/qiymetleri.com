import Image from "next/image";
import { STORE_LOGOS } from "@/lib/store-logos";
import { getTranslations } from "next-intl/server";

const STORES = [
  { id: "kontakt_home", nameKey: "kontaktHome" },
  { id: "baku_electronics", nameKey: "bakuElectronics" },
  { id: "irshad_electronics", nameKey: "irshadElectronics" },
  { id: "ispace", nameKey: "ispace" },
];

export async function StoreLogos() {
  const t = await getTranslations("home");

  return (
    <section className="mt-6 sm:mt-10">
      <div className="flex flex-col items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-3">
          <div className="h-px w-8 bg-[var(--color-border)] sm:w-12" />
          <span className="text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase sm:text-sm">
            {t("trustedStores")}
          </span>
          <div className="h-px w-8 bg-[var(--color-border)] sm:w-12" />
        </div>
        <div className="flex items-center justify-center gap-6 sm:gap-10 md:gap-14">
          {STORES.map((store) => (
            <div
              key={store.id}
              className="group flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-105 sm:gap-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-1.5 shadow-sm transition-all duration-200 group-hover:border-[var(--color-accent)] group-hover:shadow-md group-hover:shadow-[var(--color-accent-subtle)] sm:h-14 sm:w-14 sm:rounded-2xl sm:p-2">
                <Image
                  src={STORE_LOGOS[store.id]}
                  alt={t(`stores.${store.nameKey}`)}
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              </div>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-secondary)] sm:text-xs">
                {t(`stores.${store.nameKey}`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

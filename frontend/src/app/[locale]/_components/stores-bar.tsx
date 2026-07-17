import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { stores } from "@/app/[locale]/_lib/mock-data";

export async function StoresBar() {
  const t = await getTranslations();

  return (
    <div className="mb-7 flex flex-wrap items-center gap-[18px] rounded-chip border-[1.5px] border-border bg-white px-5 py-4">
      <span className="text-sm font-bold text-[#52525b]">{t("home.storesLabel")}</span>
      {stores.map((store) => (
        <span key={store.name} className="flex items-center gap-2 text-sm font-bold">
          <Image
            src={store.logo}
            alt={store.name}
            width={18}
            height={18}
            className="rounded-[4px] object-contain"
          />
          {store.name}
        </span>
      ))}
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import type { FilterOption } from "@/lib/api";

export async function StoresBar({ stores }: { stores: FilterOption[] }) {
  const t = await getTranslations();

  return (
    <div className="mb-7 flex flex-wrap items-center gap-[18px] rounded-chip border-[1.5px] border-border bg-white px-5 py-4">
      <span className="text-sm font-bold text-[#52525b]">{t("home.storesLabel")}</span>
      {stores.map((store) => (
        <span key={store.name} className="flex items-center gap-2 text-sm font-bold">
          <span
            aria-hidden="true"
            className="grid size-[18px] place-items-center rounded-[4px] bg-[#f4f4f5] text-[10px] font-extrabold uppercase text-[#52525b]"
          >
            {store.name.slice(0, 1)}
          </span>
          {store.name}
        </span>
      ))}
    </div>
  );
}

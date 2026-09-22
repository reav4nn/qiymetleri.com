"use client";

import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useFavourites } from "@/lib/favourites";

export function HeaderFavouritesButton({ label }: { label: string }) {
  const { count } = useFavourites();

  return (
    <Link
      href="/favourites"
      aria-label={label}
      className="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-button border-[1.5px] border-[#e4e4e7] bg-white text-foreground transition-colors hover:border-accent hover:bg-accent-soft/20"
    >
      <Heart className="size-[18px] text-accent" />
      {count > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-white shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

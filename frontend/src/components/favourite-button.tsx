"use client";

import { Heart } from "lucide-react";
import { useFavourites } from "@/lib/favourites";
import { cn } from "@/lib/utils";

export function FavouriteButton({
  productId,
  label,
}: {
  productId: string;
  label: string;
}) {
  const { isFavourite, toggleFavourite } = useFavourites();
  const active = isFavourite(productId);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavourite(productId);
      }}
      className={cn(
        "absolute top-3 right-3 z-2 flex size-11 items-center justify-center rounded-full border bg-[#fafafa] transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-[#d4d4d8] hover:text-[#a1a1aa]"
      )}
    >
      <Heart
        className={cn(
          "size-5 transition-transform active:scale-90",
          active ? "fill-accent stroke-accent" : ""
        )}
        strokeWidth={2}
      />
    </button>
  );
}

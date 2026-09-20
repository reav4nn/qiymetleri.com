"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavouriteButton({ label }: { label: string }) {
  const [isFavourite, setIsFavourite] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsFavourite(!isFavourite);
      }}
      className={cn(
        "absolute top-3 right-3 z-2 flex size-11 items-center justify-center rounded-full border bg-[#fafafa] transition-colors",
        isFavourite
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-[#d4d4d8] hover:text-[#a1a1aa]"
      )}
    >
      <Heart
        className={cn(
          "size-5 transition-transform active:scale-90",
          isFavourite ? "fill-accent stroke-accent" : ""
        )}
        strokeWidth={2}
      />
    </button>
  );
}

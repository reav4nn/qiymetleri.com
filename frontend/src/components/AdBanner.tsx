"use client";

import { useEffect, useRef } from "react";

type AdFormat = "auto" | "horizontal" | "vertical" | "rectangle" | "fluid";

interface AdBannerProps {
  slot: string;
  format?: AdFormat;
  responsive?: boolean;
  className?: string;
  layout?: string;
  layoutKey?: string;
}

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

/**
 * Google AdSense banner component.
 *
 * Renders an ad unit only when NEXT_PUBLIC_ADSENSE_ID is set.
 * In development (no ID), renders nothing.
 */
export function AdBanner({
  slot,
  format = "auto",
  responsive = true,
  className = "",
  layout,
  layoutKey,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_ID;

  useEffect(() => {
    if (!publisherId || pushed.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet or ad blocker active
    }
  }, [publisherId]);

  if (!publisherId) return null;

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
        {...(layout ? { "data-ad-layout": layout } : {})}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
}

/**
 * In-feed ad for use between product cards in search results.
 */
export function InFeedAd({ slot }: { slot: string }) {
  return (
    <AdBanner
      slot={slot}
      format="fluid"
      layout="in-article"
      className="col-span-full my-4"
    />
  );
}

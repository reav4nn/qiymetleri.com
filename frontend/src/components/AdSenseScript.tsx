"use client";

import { useEffect } from "react";

export function AdSenseScript() {
  useEffect(() => {
    const publisherId = process.env.NEXT_PUBLIC_ADSENSE_ID;
    if (!publisherId) return;

    const existing = document.querySelector(
      `script[src*="${publisherId}"]`,
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, []);

  return null;
}

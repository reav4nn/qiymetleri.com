import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kontakt.az" },
      { protocol: "https", hostname: "**.kontakt.az" },
      { protocol: "https", hostname: "bakuelectronics.az" },
      { protocol: "https", hostname: "**.bakuelectronics.az" },
      { protocol: "https", hostname: "irshad.az" },
      { protocol: "https", hostname: "**.irshad.az" },
      { protocol: "https", hostname: "ispace.az" },
      { protocol: "https", hostname: "**.ispace.az" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

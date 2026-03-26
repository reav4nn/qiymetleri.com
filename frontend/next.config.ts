/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kontakt.az",
      },
      {
        protocol: "https",
        hostname: "**.baku.electronics",
      },
      {
        protocol: "https",
        hostname: "irshad.az",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          "https://credify-production-b5c0.up.railway.app/api/:path*",
      },
    ];
  },
};

export default nextConfig;
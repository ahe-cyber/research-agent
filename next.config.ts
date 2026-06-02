import type { NextConfig } from "next";

const EXPRESS_PORT = process.env.EXPRESS_PORT || "3001";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${EXPRESS_PORT}/api/:path*`
      }
    ];
  }
};

export default nextConfig;

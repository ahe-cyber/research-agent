import type { NextConfig } from "next";

const basePath = "/research-agent";

const nextConfig: NextConfig = {
  basePath,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "q4qq995h-3003.use.devtunnels.ms",
    "*.use.devtunnels.ms"
  ],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
  }
};

export default nextConfig;

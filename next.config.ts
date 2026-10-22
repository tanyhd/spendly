import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end tests run their own dev server next to yours (e2e/start-app.mjs),
  // so they build into a separate folder. Unset everywhere else, including Vercel.
  // The dev badge would also sit on top of the phone tab bar there, so hide it.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR, devIndicators: false } : {}),
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Packages natifs à NE PAS bundler (génération PDF serveur via Chromium headless).
  // Sans ça, le binaire @sparticuz/chromium ne se charge pas en serverless.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;

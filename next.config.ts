import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Packages natifs à NE PAS bundler (génération PDF serveur via Chromium headless).
  // Sans ça, le binaire @sparticuz/chromium ne se charge pas en serverless.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  // Force l'inclusion du binaire Chromium (fichiers brotli du dossier /bin) dans le
  // bundle des fonctions serverless qui génèrent des PDF. Ces fichiers sont lus via
  // `fs` à l'exécution (pas importés) → le tracing de Next les ignore par défaut, d'où
  // l'erreur prod « .../@sparticuz/chromium/bin does not exist ». On ne cible que les
  // routes PDF (comptes courants + RH) pour ne pas alourdir les autres fonctions.
  outputFileTracingIncludes: {
    "/api/comptes-courants/**": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/admin/rh/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;

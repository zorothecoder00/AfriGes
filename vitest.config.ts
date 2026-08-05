import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// CDC Comptabilité §78 — suite de tests d'intégration du moteur comptable.
// Chaque test tourne dans sa propre base "afriges_test" (jamais la base de
// dev ni Neon), créée/migrée/semée une fois par tests/setup/globalSetup.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/loadEnv.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Les tests partagent une seule base et un seul plan comptable/exercice
    // semés une fois — l'exécution séquentielle des fichiers évite toute
    // contention inutile sur les lignes de référence partagées (chaque test
    // reste isolé par sa propre transaction annulée, mais garder les fichiers
    // séquentiels simplifie le diagnostic en cas d'échec).
    fileParallelism: false,
  },
});

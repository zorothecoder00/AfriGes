// Charge .env.test dans chaque fichier de test — redondant avec globalSetup.ts
// (qui propage déjà DATABASE_URL aux workers), mais garantit que lib/prisma.ts
// lit la bonne valeur même si l'ordre d'exécution Vitest change un jour.
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../../.env.test") });

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"   

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}  

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const prisma =
  globalForPrisma.prisma ??   
  new PrismaClient({
    adapter: new PrismaPg(pool),
    // En production, on n'expose que warn/error pour éviter de divulguer les
    // requêtes SQL (paramètres, structure) et de polluer les logs.
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma

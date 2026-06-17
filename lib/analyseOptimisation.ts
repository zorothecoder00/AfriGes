import { prisma } from "@/lib/prisma";

export async function genRefOptimisation(): Promise<string> {
  const count = await prisma.analyseOptimisationRIA.count();
  const annee = new Date().getFullYear();
  return `OPT-${annee}-${String(count + 1).padStart(5, "0")}`;
}

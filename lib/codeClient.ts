import { Prisma } from "@prisma/client";

/**
 * Génère le prochain code client au format CLI-00042.
 *
 * Basé sur le **plus grand suffixe numérique existant** (et non un simple count),
 * pour rester correct même quand certains clients ont un `codeClient` nul
 * (clients créés en prospection agent/RPV avant l'ajout du code) : un count
 * pourrait produire un code déjà attribué → violation de la contrainte @unique.
 *
 * À appeler dans une transaction pour que le max lu et l'insertion soient cohérents.
 */
export async function genererCodeClient(tx: Prisma.TransactionClient): Promise<string> {
  const dernier = await tx.client.findFirst({
    where:   { codeClient: { startsWith: "CLI-" } },
    orderBy: { codeClient: "desc" },
    select:  { codeClient: true },
  });
  const dernierNum = dernier?.codeClient
    ? parseInt(dernier.codeClient.replace(/^CLI-/, ""), 10) || 0
    : 0;
  return `CLI-${String(dernierNum + 1).padStart(5, "0")}`;
}

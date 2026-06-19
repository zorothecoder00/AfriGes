import { Prisma, TypeCommissionRIA } from "@prisma/client";

/**
 * CDC — Module Plans d'Actions : « Après chaque réunion : création automatique de tâches ».
 *
 * À la validation du compte rendu, chaque ligne non vide du champ « Actions définies »
 * devient une tâche (PlanActionCommRIA) rattachée à la réunion, en statut NON_DEMARRE.
 * Les lignes déjà matérialisées (même intitulé sur la même réunion) ne sont pas recréées,
 * pour rester idempotent si le compte rendu est revalidé.
 *
 * @returns le nombre de tâches effectivement créées
 */
export async function genererTachesDepuisCompteRendu(
  tx: Prisma.TransactionClient,
  params: { reunionId: number; typeCommission: TypeCommissionRIA; actionsDefinies?: string | null }
): Promise<number> {
  const { reunionId, typeCommission, actionsDefinies } = params;
  if (!actionsDefinies) return 0;

  // Une action par ligne ; on retire puces / numérotation éventuelles en tête de ligne.
  const lignes = actionsDefinies
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 0);
  if (lignes.length === 0) return 0;

  const existantes = await tx.planActionCommRIA.findMany({
    where: { reunionId },
    select: { titre: true },
  });
  const dejaLa = new Set(existantes.map((t) => t.titre.trim().toLowerCase()));

  // Dédoublonnage interne (deux lignes identiques) + contre l'existant
  const aCreer = Array.from(new Set(lignes.map((l) => l)))
    .filter((l) => !dejaLa.has(l.toLowerCase()));
  if (aCreer.length === 0) return 0;

  await tx.planActionCommRIA.createMany({
    data: aCreer.map((titre) => ({
      typeCommission,
      reunionId,
      titre,
      statut: "NON_DEMARRE",
      progression: 0,
    })),
  });
  return aCreer.length;
}

import { Prisma, TypeCommissionRIA, PrioriteActionRIA } from "@prisma/client";
import { parseActionsCR } from "@/lib/commissionsRIA";

const PRIORITES_VALIDES: PrioriteActionRIA[] = ["CRITIQUE", "HAUTE", "MOYENNE", "BASSE"];

/**
 * CDC — Module Plans d'Actions : « Après chaque réunion : création automatique de tâches ».
 *
 * À la validation du compte rendu, chaque « action définie » devient une tâche
 * (PlanActionCommRIA) rattachée à la réunion, en statut NON_DEMARRE — avec son
 * responsable, son échéance et sa priorité quand l'action est structurée (cf. ActionCR).
 * Reste rétro-compatible avec l'ancien texte libre (une action par ligne).
 * Les actions déjà matérialisées (même intitulé sur la réunion) ne sont pas recréées,
 * pour rester idempotent si le compte rendu est revalidé.
 *
 * @returns le nombre de tâches effectivement créées
 */
export async function genererTachesDepuisCompteRendu(
  tx: Prisma.TransactionClient,
  params: { reunionId: number; typeCommission: TypeCommissionRIA; actionsDefinies?: string | null }
): Promise<number> {
  const { reunionId, typeCommission, actionsDefinies } = params;

  const actions = parseActionsCR(actionsDefinies);
  if (actions.length === 0) return 0;

  const existantes = await tx.planActionCommRIA.findMany({
    where: { reunionId },
    select: { titre: true },
  });
  const dejaLa = new Set(existantes.map((t) => t.titre.trim().toLowerCase()));

  const vues = new Set<string>();
  const aCreer = actions.filter((a) => {
    const cle = a.titre.trim().toLowerCase();
    if (!cle || dejaLa.has(cle) || vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
  if (aCreer.length === 0) return 0;

  await tx.planActionCommRIA.createMany({
    data: aCreer.map((a) => ({
      typeCommission,
      reunionId,
      titre: a.titre.trim(),
      statut: "NON_DEMARRE",
      progression: 0,
      responsableId: a.responsableId ?? null,
      dateEcheance: a.dateEcheance ? new Date(a.dateEcheance) : null,
      priorite: PRIORITES_VALIDES.includes(a.priorite as PrioriteActionRIA)
        ? (a.priorite as PrioriteActionRIA)
        : "MOYENNE",
    })),
  });
  return aCreer.length;
}

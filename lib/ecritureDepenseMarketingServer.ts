// lib/ecritureDepenseMarketingServer.ts
//
// Écriture comptable automatique pour une dépense marketing (CDC Marketing
// §53 : "ces dépenses doivent être reliées au module comptable existant").
// Avant ce fichier, DepenseMarketing.ecritureComptableId existait en base mais
// rien ne le renseignait jamais — le lien comptable était un champ mort.
// Idempotent via ce même champ (même principe que
// lib/comptabilite/ecrituresAjustement.ts).
import type { Prisma } from "@prisma/client";
import { creerEcriture, resoudreRegleComptable } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

export async function creerEcritureDepenseMarketing(tx: TxClient, depenseId: number, userId: number): Promise<number | null> {
  const depense = await tx.depenseMarketing.findUnique({
    where: { id: depenseId },
    include: { campagne: { select: { nom: true, code: true } } },
  });
  if (!depense) return null;
  if (depense.ecritureComptableId != null) return depense.ecritureComptableId;

  const montant = Number(depense.montant);
  if (montant <= 0) return null;

  const regle = await resoudreRegleComptable(tx, "DEPENSE_MARKETING", { modePaiement: depense.modePaiement });
  if (!regle) return null;

  const ecritureId = await creerEcriture(tx, {
    reference: `DEP-MKT-${depenseId}`,
    date: depense.date,
    journal: regle.journal,
    libelle: `Dépense marketing (${depense.categorie}) — ${depense.campagne.nom} (${depense.campagne.code})`,
    userId,
    lignes: [
      { numero: regle.compteDebitNumero, debit: montant, libelle: depense.description ?? depense.categorie },
      { numero: regle.compteCreditNumero, credit: montant, libelle: depense.description ?? depense.categorie },
    ],
  });

  await tx.depenseMarketing.update({ where: { id: depenseId }, data: { ecritureComptableId: ecritureId } });
  return ecritureId;
}

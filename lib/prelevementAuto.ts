import { prisma } from "@/lib/prisma";
import { PrioriteNotification } from "@prisma/client";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { chargerParametrageCC, payerCreditDepuisCC, montantBloqueActif } from "@/lib/compteCourant";

/**
 * Prélèvement automatique des échéances de crédit (CDC §19.C).
 * Pour chaque autorisation active, si le crédit présente un montant dû (échéance
 * du jour + arriéré) et que le compte courant le permet (solde ≥ plancher), le
 * système débite le CC et impute le crédit — via le helper mutualisé
 * `payerCreditDepuisCC` (même mécanique que le paiement manuel).
 */

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Montant dû à ce jour d'un crédit = arriéré + échéance du jour (non encore payés). */
async function montantDuAJour(creditId: number, now: Date): Promise<number> {
  const echeances = await prisma.echeanceCredit.findMany({
    where: { creditId, dateEcheance: { lte: now }, statut: { not: "PAYE" } },
    select: { montantDu: true, montantPaye: true },
  });
  return echeances.reduce((s, e) => s + Math.max(0, Number(e.montantDu) - Number(e.montantPaye)), 0);
}

export async function executerPrelevementsAuto(now: Date = new Date()): Promise<{
  verifies: number; executes: number; totalPreleve: number; ignores: number;
}> {
  const param = await chargerParametrageCC();
  const seuilParDefaut = Number(param.soldeMinObligatoire ?? 0);

  const autorisations = await prisma.autorisationPrelevement.findMany({
    where: {
      actif: true,
      credit: { statut: { in: ["ACTIF", "EN_RETARD"] } },
    },
    select: {
      id: true, montantMax: true, montantMinSolde: true, dernierPrelevementAt: true, creeParId: true,
      compte: {
        select: {
          id: true, numeroCompte: true, codeAgence: true, statut: true, solde: true,
          client: { select: { prenom: true, nom: true } },
        },
      },
      credit: { select: { id: true, reference: true, soldeRestant: true } },
    },
  });

  let executes = 0;
  let ignores = 0;
  let totalPreleve = 0;

  for (const a of autorisations) {
    // Compte non ACTIF : impossible de débiter (blocage CDC §10).
    if (a.compte.statut !== "ACTIF") { ignores += 1; continue; }
    // Déjà prélevé aujourd'hui : on ne repasse pas (idempotence quotidienne).
    if (a.dernierPrelevementAt && memeJour(new Date(a.dernierPrelevementAt), now)) { ignores += 1; continue; }

    const du = await montantDuAJour(a.credit.id, now);
    if (du <= 0) { ignores += 1; continue; } // rien d'exigible aujourd'hui

    const plancher = a.montantMinSolde != null ? Number(a.montantMinSolde) : seuilParDefaut;
    // Épargne bloquée (CDC §19.E) : indisponible pour le prélèvement.
    const bloque = await montantBloqueActif(prisma, a.compte.id, now);
    const disponible = Number(a.compte.solde) - plancher - bloque;
    const plafond = a.montantMax != null ? Number(a.montantMax) : Infinity;
    const montant = Math.min(du, disponible, plafond, Number(a.credit.soldeRestant));

    if (montant <= 0) {
      // Solde insuffisant pour honorer l'échéance : on alerte les admins (sans bloquer).
      ignores += 1;
      await notifyAdmins(prisma, {
        titre: "Prélèvement automatique impossible",
        message: `Solde insuffisant pour prélever l'échéance du crédit ${a.credit.reference} (${a.compte.client.prenom} ${a.compte.client.nom}). Dû : ${du.toLocaleString("fr-FR")} FCFA, disponible : ${Math.max(0, disponible).toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/admin/comptes-courants/${a.compte.id}`,
      });
      continue;
    }

    const clientNom = `${a.compte.client.prenom} ${a.compte.client.nom}`;
    try {
      const applique = await prisma.$transaction(async (tx) => {
        const paye = await payerCreditDepuisCC(tx, {
          compteId: a.compte.id, numeroCompte: a.compte.numeroCompte, codeAgence: a.compte.codeAgence, clientNom,
          creditId: a.credit.id, creditRef: a.credit.reference, montant, userId: a.creeParId, param,
          observation: "Prélèvement automatique",
        });
        if (paye.montantApplique <= 0) return 0;

        await tx.autorisationPrelevement.update({
          where: { id: a.id },
          data: {
            totalPreleve: { increment: paye.montantApplique },
            nbPrelevements: { increment: 1 },
            dernierPrelevementAt: now,
            // Crédit soldé → l'autorisation n'a plus d'objet.
            ...(paye.estSolde ? { actif: false } : {}),
          },
        });

        await auditLog(tx, a.creeParId, "PRELEVEMENT_AUTO_CC", "CompteCourant", a.compte.id,
          { credit: a.credit.reference, montant: paye.montantApplique, solde: paye.estSolde });
        await notifyAdmins(tx, {
          titre: paye.estSolde ? "Crédit soldé par prélèvement automatique" : "Prélèvement automatique effectué",
          message: `${paye.montantApplique.toLocaleString("fr-FR")} FCFA prélevés du compte ${a.compte.numeroCompte} (${clientNom}) pour le crédit ${a.credit.reference}.${paye.estSolde ? " Crédit intégralement remboursé." : ""}`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/comptes-courants/${a.compte.id}`,
        });
        return paye.montantApplique;
      });

      if (applique > 0) { executes += 1; totalPreleve += applique; }
      else ignores += 1;
    } catch (e) {
      ignores += 1;
      console.error(`Prélèvement auto échoué (autorisation ${a.id})`, e);
    }
  }

  return { verifies: autorisations.length, executes, totalPreleve, ignores };
}

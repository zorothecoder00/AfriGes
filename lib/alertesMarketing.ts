import { prisma } from "@/lib/prisma";
import { calculerAlertesStock } from "@/lib/campagneStock";

/**
 * Alertes marketing (CDC §77) — 6 conditions évaluées sur les campagnes
 * ACTIVE : budget dépassé, ROI sous/au-dessus de l'objectif, audience trop
 * petite, produit en rupture, fréquence de communication excessive.
 */

const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];
const JOUR_MS = 24 * 60 * 60 * 1000;

export type TypeAlerteMarketing =
  | "BUDGET_DEPASSE" | "ROI_FAIBLE" | "ROI_DEPASSE_OBJECTIF"
  | "AUDIENCE_TROP_PETITE" | "PRODUIT_RUPTURE" | "FREQUENCE_EXCESSIVE";

export interface AlerteMarketing {
  type: TypeAlerteMarketing;
  campagneId: number;
  campagneNom: string;
  message: string;
  priorite: "HAUTE" | "NORMAL";
}

async function chargerParametrage() {
  const existant = await prisma.parametrageMarketing.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.parametrageMarketing.create({ data: { id: 1 } });
}

/** ROI d'une campagne : (CA attribué - dépenses) / dépenses × 100, même formule que le dashboard global. */
async function calculerRoiCampagne(campagneId: number): Promise<number | null> {
  const [ventes, credits, depenses] = await Promise.all([
    prisma.venteDirecte.aggregate({ where: { campagneId, statut: { notIn: VENTES_EXCLUES as never } }, _sum: { montantTotal: true } }),
    prisma.creditClient.aggregate({ where: { campagneId }, _sum: { montantTotal: true } }),
    prisma.depenseMarketing.aggregate({ where: { campagneId }, _sum: { montant: true } }),
  ]);
  const caAttribue = Number(ventes._sum.montantTotal ?? 0) + Number(credits._sum.montantTotal ?? 0);
  const depensesTotal = Number(depenses._sum.montant ?? 0);
  if (depensesTotal <= 0) return null;
  return ((caAttribue - depensesTotal) / depensesTotal) * 100;
}

export async function evaluerAlertesMarketing(): Promise<AlerteMarketing[]> {
  const [campagnes, param] = await Promise.all([
    prisma.campagne.findMany({
      where: { statut: "ACTIVE" },
      include: { budget: true, audience: { select: { tailleCalculee: true } } },
    }),
    chargerParametrage(),
  ]);

  const alertes: AlerteMarketing[] = [];
  const depuis7Jours = new Date(Date.now() - 7 * JOUR_MS);

  for (const c of campagnes) {
    // ── Budget dépassé ─────────────────────────────────────────────────────
    if (c.budget && Number(c.budget.montantApprouve) > 0 && Number(c.budget.montantEngage) > Number(c.budget.montantApprouve)) {
      alertes.push({
        type: "BUDGET_DEPASSE", campagneId: c.id, campagneNom: c.nom, priorite: "HAUTE",
        message: `Budget engagé (${Math.round(Number(c.budget.montantEngage)).toLocaleString("fr-FR")} FCFA) dépasse le budget approuvé (${Math.round(Number(c.budget.montantApprouve)).toLocaleString("fr-FR")} FCFA).`,
      });
    }

    // ── Audience trop petite ───────────────────────────────────────────────
    if (c.audience?.tailleCalculee != null && c.audience.tailleCalculee < param.seuilAudienceMinimale) {
      alertes.push({
        type: "AUDIENCE_TROP_PETITE", campagneId: c.id, campagneNom: c.nom, priorite: "NORMAL",
        message: `Audience de ${c.audience.tailleCalculee} client(s), sous le seuil de ${param.seuilAudienceMinimale}.`,
      });
    }

    // ── ROI vs objectif ─────────────────────────────────────────────────────
    if (c.roiCible != null) {
      const roiActuel = await calculerRoiCampagne(c.id);
      if (roiActuel != null) {
        const cible = Number(c.roiCible);
        if (roiActuel < cible) {
          alertes.push({
            type: "ROI_FAIBLE", campagneId: c.id, campagneNom: c.nom, priorite: "HAUTE",
            message: `ROI actuel ${roiActuel.toFixed(0)}%, sous l'objectif de ${cible}%.`,
          });
        } else {
          alertes.push({
            type: "ROI_DEPASSE_OBJECTIF", campagneId: c.id, campagneNom: c.nom, priorite: "NORMAL",
            message: `ROI actuel ${roiActuel.toFixed(0)}%, au-dessus de l'objectif de ${cible}%.`,
          });
        }
      }
    }

    // ── Produit en rupture (réutilise §61) ─────────────────────────────────
    const ruptures = await calculerAlertesStock(c.id);
    for (const r of ruptures) {
      alertes.push({
        type: "PRODUIT_RUPTURE", campagneId: c.id, campagneNom: c.nom, priorite: "NORMAL",
        message: `${r.produitNom} à ${r.pointDeVenteNom} : ${r.quantite} restant(s) (seuil ${r.seuil}).`,
      });
    }

    // ── Fréquence de communication excessive ────────────────────────────────
    if (c.audienceId) {
      const membres = await prisma.audienceMarketingMembre.findMany({ where: { audienceId: c.audienceId }, select: { clientId: true } });
      if (membres.length > 0) {
        const clientIds = membres.map((m) => m.clientId);
        const envois = await prisma.envoiMessage.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, dateEnvoi: { gte: depuis7Jours }, statut: { in: ["ENVOYE", "LIVRE", "LU", "REPONSE"] } },
          _count: { _all: true },
        });
        const auPlafond = envois.filter((e) => e._count._all >= param.maxCommunicationsParSemaine).length;
        const partAuPlafond = auPlafond / membres.length;
        if (partAuPlafond >= 0.3) {
          alertes.push({
            type: "FREQUENCE_EXCESSIVE", campagneId: c.id, campagneNom: c.nom, priorite: "NORMAL",
            message: `${auPlafond} client(s) sur ${membres.length} (${Math.round(partAuPlafond * 100)}%) déjà au plafond hebdomadaire de communications.`,
          });
        }
      }
    }
  }

  return alertes;
}

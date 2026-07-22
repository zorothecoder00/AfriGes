import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
import { extraireMetaRequete } from "@/lib/compteCourant";

type Ctx = { params: Promise<{ id: string; mid: string }> };

// Seuls ces mouvements « autonomes » (sans répercussion crédit/vente/RIA) ont un
// montant corrigeable en ligne. Un paiement crédit se corrige par annulation +
// re-saisie (pour répercuter proprement le crédit et la cascade RIA).
const NATURES_MONTANT_EDITABLE = new Set(["DEPOT", "RETRAIT"]);

const httpError = (message: string, status: number) => Object.assign(new Error(message), { status });
const toNullableStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * PATCH /api/comptes-courants/[id]/mouvements/[mid]
 * Correction d'un mouvement par l'admin (« l'erreur est humaine ») :
 *  - métadonnées (toutes natures) : observation, mode, date d'opération, n° jour, agence, agent apporteur ;
 *  - montant (DÉPÔT / RETRAIT uniquement) : recalcule toute la chaîne des soldes,
 *    le solde du compte, les totaux et réaligne l'écriture comptable liée.
 * Réservé ADMIN / SUPER_ADMIN. Journalisé.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  const role = session?.user?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
  }

  const { id, mid } = await params;
  const compteId = Number(id);
  const mvtId = Number(mid);
  if (!compteId || !mvtId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const mvt = await tx.mouvementCompteCourant.findUnique({
        where: { id: mvtId },
        select: { id: true, compteId: true, nature: true, montant: true, statut: true, ecritureId: true },
      });
      if (!mvt || mvt.compteId !== compteId) throw httpError("Mouvement introuvable", 404);
      if (mvt.statut !== "VALIDE") {
        throw httpError("Seuls les mouvements validés sont modifiables (un retrait en attente se valide ou se rejette).", 422);
      }

      // ── Métadonnées (toutes natures, sans impact sur les soldes) ──
      const data: Prisma.MouvementCompteCourantUncheckedUpdateInput = {};
      if ("observation" in body) data.observation = toNullableStr(body.observation);
      if ("modePaiement" in body) data.modePaiement = toNullableStr(body.modePaiement);
      if ("agence" in body) data.agence = toNullableStr(body.agence);
      if ("numeroJour" in body) {
        data.numeroJour = body.numeroJour == null || body.numeroJour === "" ? null : Math.max(1, Math.floor(Number(body.numeroJour)));
      }
      if ("dateOperation" in body) {
        data.dateOperation = body.dateOperation ? new Date(body.dateOperation) : null;
      }
      if ("agentApporteurId" in body) {
        data.agentApporteurId = body.agentApporteurId ? Number(body.agentApporteurId) : null;
      }

      // ── Montant (DÉPÔT / RETRAIT uniquement) ──
      const ancienMontant = Number(mvt.montant);
      let nouveauMontant = ancienMontant;
      let montantChange = false;
      if (body.montant != null && body.montant !== "") {
        const m = Number(body.montant);
        if (!Number.isFinite(m) || m <= 0) throw httpError("Montant invalide", 400);
        if (!NATURES_MONTANT_EDITABLE.has(mvt.nature)) {
          throw httpError(
            "Le montant de ce type de mouvement ne se corrige pas ici : pour un paiement crédit, annulez puis re-saisissez (afin de répercuter le crédit et la cascade RIA).",
            422,
          );
        }
        const signe = mvt.nature === "DEPOT" ? 1 : -1;
        nouveauMontant = signe * Math.abs(m);
        montantChange = nouveauMontant !== ancienMontant;
        if (montantChange) data.montant = nouveauMontant;
      }

      if (Object.keys(data).length > 0) {
        await tx.mouvementCompteCourant.update({ where: { id: mvtId }, data });
      }

      // Réaligne l'écriture comptable liée sur le nouveau montant absolu.
      if (montantChange && mvt.ecritureId) {
        const abs = Math.abs(nouveauMontant);
        const lignes = await tx.ligneEcriture.findMany({
          where: { ecritureId: mvt.ecritureId }, select: { id: true, debit: true, credit: true },
        });
        for (const l of lignes) {
          await tx.ligneEcriture.update({
            where: { id: l.id },
            data: { debit: Number(l.debit) > 0 ? abs : 0, credit: Number(l.credit) > 0 ? abs : 0 },
          });
        }
      }

      // Recalcule TOUTE la chaîne des soldes (mouvements VALIDE) depuis 0 : source
      // de vérité, auto-corrige d'éventuelles dérives. Puis solde + total du bucket.
      if (montantChange) {
        const chaine = await tx.mouvementCompteCourant.findMany({
          where: { compteId, statut: "VALIDE" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, montant: true },
        });
        let running = 0;
        for (const m of chaine) {
          const avant = running;
          running += Number(m.montant);
          if (running < -0.009) {
            throw httpError("Cette correction rendrait le solde négatif à un moment de l'historique.", 422);
          }
          await tx.mouvementCompteCourant.update({
            where: { id: m.id }, data: { soldeAvant: avant, soldeApres: running },
          });
        }
        const deltaAbs = Math.abs(nouveauMontant) - Math.abs(ancienMontant);
        await tx.compteCourant.update({
          where: { id: compteId },
          data: {
            solde: running,
            ...(mvt.nature === "DEPOT" ? { totalDepose: { increment: deltaAbs } } : {}),
            ...(mvt.nature === "RETRAIT" ? { totalRetire: { increment: deltaAbs } } : {}),
          },
        });
      }

      await auditLog(tx, userId, "CC_MOUVEMENT_MODIFIE", "MouvementCompteCourant", mvtId, {
        champs: Object.keys(data), montantChange, ancienMontant, nouveauMontant,
      }, { ip, userAgent });

      const mouvement = await tx.mouvementCompteCourant.findUnique({ where: { id: mvtId } });
      const compte = await tx.compteCourant.findUnique({ where: { id: compteId }, select: { solde: true } });
      return { mouvement, solde: compte?.solde ?? null };
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 500) console.error("PATCH /api/comptes-courants/[id]/mouvements/[mid]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur serveur" }, { status });
  }
}

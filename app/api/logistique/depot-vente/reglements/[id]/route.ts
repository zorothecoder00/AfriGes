import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { getSession } from "../../../fournisseurs/route";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reglement = await prisma.reglementDepotVente.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!reglement) return NextResponse.json({ error: "Règlement introuvable" }, { status: 404 });

    return NextResponse.json({ data: reglement });
  } catch (error) {
    console.error("GET /logistique/depot-vente/reglements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/depot-vente/reglements/[id]
 * { action: "SOUMETTRE" } — "Demande de règlement fournisseur" : crée une
 * Fiche de Décaissement (PAIEMENT_FOURNISSEUR, visa N1/N2) liée. Le "Reçu de
 * règlement" et le "Relevé fournisseur (dépôt-vente)" ne nécessitent aucun
 * code supplémentaire une fois cette fiche payée (voir commentaire du modèle
 * ReglementDepotVente dans prisma/schema.prisma).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reglementId = Number(id);
    const reglement = await prisma.reglementDepotVente.findUnique({
      where: { id: reglementId },
      include: { convention: { select: { id: true, reference: true, fournisseurId: true, fournisseur: { select: { nom: true } } } } },
    });
    if (!reglement) return NextResponse.json({ error: "Règlement introuvable" }, { status: 404 });

    const body = await req.json();
    if (body.action !== "SOUMETTRE") return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (reglement.statut !== "BROUILLON") {
      return NextResponse.json({ error: `Impossible depuis le statut ${reglement.statut}` }, { status: 422 });
    }
    if (Number(reglement.montantDu) <= 0) {
      return NextResponse.json({ error: "Montant dû nul — rien à régler" }, { status: 422 });
    }

    const userId = parseInt(session.user.id);
    const fiche = await genererReferenceUnique(
      "FD",
      () => prisma.ficheDecaissement.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const f = await tx.ficheDecaissement.create({
          data: {
            reference,
            statut: "SOUMISE",
            demandeurId: userId,
            beneficiaireNom: reglement.convention.fournisseur.nom,
            fournisseurId: reglement.convention.fournisseurId,
            motif: `Règlement dépôt-vente ${reglement.reference} (convention ${reglement.convention.reference})`,
            typeDepense: "PAIEMENT_FOURNISSEUR",
            montantDemande: reglement.montantDu,
            reglementDepotVenteId: reglementId,
            piecesJustificatives: [`Règlement dépôt-vente ${reglement.reference}`],
          },
        });
        await tx.reglementDepotVente.update({ where: { id: reglementId }, data: { statut: "SOUMIS" } });
        await auditLog(tx, userId, "FD_CREEE", "FicheDecaissement", f.id, { reglementDepotVenteId: reglementId }, getRequestMeta(req));
        await auditLog(tx, userId, "RDV_SOUMIS", "ReglementDepotVente", reglementId, { ficheDecaissementId: f.id }, getRequestMeta(req));
        await notifyRoles(tx, ["COMPTABLE", "CHEF_COMPTABLE"], {
          titre: `Fiche de décaissement soumise (${reference})`,
          message: `${session.user.prenom} ${session.user.nom} demande le règlement de ${Number(reglement.montantDu).toLocaleString("fr-FR")} FCFA pour "${f.beneficiaireNom}" (dépôt-vente ${reglement.reference}).`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/decaissements?detail=${f.id}`,
        });
        return f;
      }),
    );
    return NextResponse.json({ data: fiche }, { status: 201 });
  } catch (error) {
    console.error("PATCH /logistique/depot-vente/reglements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

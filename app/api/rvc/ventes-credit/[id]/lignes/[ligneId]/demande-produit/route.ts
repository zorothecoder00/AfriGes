import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { notifyAdmins } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string; ligneId: string }> };

/**
 * POST /api/rvc/ventes-credit/[id]/lignes/[ligneId]/demande-produit
 *
 * Le RVC signale qu'une ligne hors catalogue nécessite la création d'un produit.
 * → Notifie les Admin/SuperAdmin pour qu'ils créent le produit dans le catalogue
 * → Une fois le produit créé, le RVC peut le substituer via PATCH lignes/[ligneId]
 *
 * Body: { description?, unite?, prixEstime? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const venteId  = parseInt(id);
    const ligneIdN = parseInt(ligneId);
    if (isNaN(venteId) || isNaN(ligneIdN)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const rvcId   = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: rvcId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun PDV associé au RVC" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      select: { id: true, statut: true, pointDeVenteId: true, reference: true },
    });
    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (vente.statut !== "CREDIT_REQUEST") {
      return NextResponse.json({ error: "Seules les ventes en CREDIT_REQUEST peuvent être modifiées" }, { status: 409 });
    }

    const ligne = await prisma.ligneVenteDirecte.findFirst({
      where: { id: ligneIdN, venteId },
    });
    if (!ligne) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
    if (ligne.produitId) {
      return NextResponse.json({ error: "Cette ligne est déjà liée à un produit du catalogue" }, { status: 400 });
    }

    const body = await req.json();
    const { description, unite, prixEstime } = body as {
      description?: string;
      unite?: string;
      prixEstime?: number;
    };

    const rvcNom  = `${session.user.prenom} ${session.user.nom}`;
    const nomProd = ligne.produitNom ?? "produit sans nom";
    const details = [
      `Produit : ${nomProd}`,
      description  ? `Description : ${description}` : null,
      unite        ? `Unité : ${unite}` : null,
      prixEstime   ? `Prix estimé : ${Number(prixEstime).toLocaleString("fr-FR")} FCFA` : null,
      `Quantité demandée : ${ligne.quantite}`,
      `Vente crédit : ${vente.reference}`,
    ]
      .filter(Boolean)
      .join(" | ");

    await prisma.$transaction(async (tx) => {
      await notifyAdmins(tx, {
        titre:     `Demande création produit — "${nomProd}"`,
        message:   `${rvcNom} demande la création d'un nouveau produit pour une vente crédit. ${details}. Créez le produit puis signalez-le au RVC pour substitution.`,
        priorite:  PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/admin/packs`,
      });
    });

    return NextResponse.json({ success: true, message: "Demande envoyée aux administrateurs" });
  } catch (error) {
    console.error("POST /api/rvc/ventes-credit/[id]/lignes/[ligneId]/demande-produit:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/clients/[id]/historique
 * Retourne l'historique complet d'un client :
 * - Ses souscriptions packs avec tous leurs versements
 * - Ses ventes directes
 * - Les totaux (totalPaye, totalDu)
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        telephone: true,
        adresse: true,
        etat: true,
        createdAt: true,
        pointDeVente: { select: { id: true, nom: true, code: true } },
        pointsDeVente: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
      },
    });

    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    // Souscriptions avec versements
    const souscriptions = await prisma.souscriptionPack.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        pack: { select: { id: true, nom: true, type: true } },
        versements: {
          orderBy: { datePaiement: "desc" },
          select: {
            id: true,
            montant: true,
            type: true,
            datePaiement: true,
            encaisseParNom: true,
            notes: true,
          },
        },
      },
    });

    // Ventes directes
    const ventesDirectes = await prisma.venteDirecte.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        montantTotal: true,
        montantPaye: true,
        modePaiement: true,
        statut: true,
        notes: true,
        createdAt: true,
        pointDeVente: { select: { nom: true, code: true } },
        lignes: {
          select: {
            quantite: true,
            prixUnitaire: true,
            montant: true,
            produit: { select: { nom: true } },
          },
        },
      },
    });

    // Calcul des totaux
    const totalVersementsPacks = souscriptions
      .flatMap((s) => s.versements)
      .reduce((sum, v) => sum + Number(v.montant), 0);

    const totalAchatsDirects = ventesDirectes
      .filter((v) => v.statut !== "BROUILLON" && v.statut !== "ANNULEE")
      .reduce((sum, v) => sum + Number(v.montantPaye), 0);

    const totalDu = souscriptions
      .filter((s) => s.statut !== "COMPLETE" && s.statut !== "ANNULE")
      .reduce((sum, s) => sum + Number(s.montantRestant), 0);

    return NextResponse.json({
      success: true,
      client,
      souscriptions,
      ventesDirectes,
      totaux: {
        totalVersementsPacks,
        totalAchatsDirects,
        totalPaye: totalVersementsPacks + totalAchatsDirects,
        totalDu,
        nbSouscriptions: souscriptions.length,
        nbAchats: ventesDirectes.length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/clients/[id]/historique:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

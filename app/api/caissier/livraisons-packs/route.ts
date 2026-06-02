import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { getAdminSession } from "@/lib/authAdmin";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/caissier/livraisons-packs
 * Retourne les ReceptionProduitPack LIVREE pour le PDV du caissier (60 derniers jours).
 * Accessible aussi par RPV et Admin.
 */
export async function GET() {
  try {
    const session =
      (await getCaissierSession()) ??
      (await getRPVSession()) ??
      (await getAdminSession());
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let pdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      pdvId = aff?.pointDeVenteId ?? null;
    }

    const pdvFilter = pdvId
      ? {
          OR: [
            { pointDeVenteId: pdvId },
            {
              pointDeVenteId: null,
              OR: [
                { souscription: { client: { pointDeVenteId: pdvId } } },
                { souscription: { clientId: null } },
              ],
            },
          ],
        }
      : {};

    const livrees = await prisma.receptionProduitPack.findMany({
      where: {
        statut: "LIVREE",
        dateLivraison: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        ...pdvFilter,
      },
      orderBy: { dateLivraison: "desc" },
      take: 50,
      include: {
        souscription: {
          include: {
            pack:   { select: { nom: true, type: true } },
            client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            user:   { select: { nom: true, prenom: true } },
          },
        },
        lignes: {
          include: { produit: { select: { nom: true, unite: true } } },
        },
        pointDeVente: { select: { nom: true } },
      },
    });

    return NextResponse.json({ data: livrees });
  } catch (error) {
    console.error("GET /api/caissier/livraisons-packs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

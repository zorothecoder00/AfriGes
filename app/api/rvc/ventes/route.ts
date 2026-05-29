import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

/**
 * GET /api/rvc/ventes
 * Liste les demandes de vente à crédit (CREDIT_REQUEST) en attente de traitement
 * scoped au PDV du RVC connecté.
 */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let pdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      pdvId = aff?.pointDeVenteId ?? null;
    }

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    const where = {
      statut: "CREDIT_REQUEST" as const,
      ...(pdvId ? { pointDeVenteId: pdvId } : {}),
    };

    const [ventes, total] = await Promise.all([
      prisma.venteDirecte.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
          vendeur:      { select: { id: true, nom: true, prenom: true } },
          client:       { select: { id: true, nom: true, prenom: true, telephone: true, limiteCredit: true, soldeActuel: true } },
          pointDeVente: { select: { id: true, nom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
      }),
      prisma.venteDirecte.count({ where }),
    ]);

    return NextResponse.json({
      data: ventes.map((v) => ({
        id:           v.id,
        reference:    v.reference,
        createdAt:    v.createdAt.toISOString(),
        montantTotal: Number(v.montantTotal),
        notes:        v.notes,
        vendeur:      v.vendeur
                        ? { id: v.vendeur.id, nom: `${v.vendeur.prenom} ${v.vendeur.nom}` }
                        : null,
        client:       v.client
                        ? {
                            id:           v.client.id,
                            nom:          `${v.client.prenom} ${v.client.nom}`,
                            telephone:    v.client.telephone,
                            limiteCredit: Number(v.client.limiteCredit ?? 0),
                            soldeActuel:  Number(v.client.soldeActuel ?? 0),
                            creditDispo:  Number(v.client.limiteCredit ?? 0) - Number(v.client.soldeActuel ?? 0),
                          }
                        : { id: null, nom: v.clientNom ?? "—", telephone: v.clientTelephone ?? null, limiteCredit: 0, soldeActuel: 0, creditDispo: 0 },
        pointDeVente: v.pointDeVente?.nom ?? "—",
        lignes:       v.lignes.map((l) => ({
          produit:      l.produit.nom,
          unite:        l.produit.unite ?? "",
          quantite:     l.quantite,
          prixUnitaire: Number(l.prixUnitaire),
          montant:      Number(l.montant),
        })),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/rvc/ventes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

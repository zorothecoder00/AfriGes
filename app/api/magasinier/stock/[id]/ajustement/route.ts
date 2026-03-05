import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/magasinier/stock/[id]/ajustement
 * Ajustement de stock sur le PDV du magasinier (StockSite).
 * Body: { quantite, motif }
 * - quantite > 0 : entrée (AJUSTEMENT_POSITIF)
 * - quantite < 0 : sortie (AJUSTEMENT_NEGATIF)
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const produitId = Number(id);
    if (isNaN(produitId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    // PDV du magasinier
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });

    const body = await req.json();
    const { quantite, motif } = body;

    if (quantite === undefined || !motif) {
      return NextResponse.json({ error: "quantite et motif sont obligatoires" }, { status: 400 });
    }

    const qty = Number(quantite);
    if (qty === 0) return NextResponse.json({ error: "La quantité d'ajustement ne peut pas être 0" }, { status: 400 });

    // Lire le stock actuel
    const stockActuel = await prisma.stockSite.findUnique({
      where: { produitId_pointDeVenteId: { produitId, pointDeVenteId: pdvId } },
      include: { produit: { select: { nom: true } } },
    });

    const qteActuelle = stockActuel?.quantite ?? 0;
    const qteNouvelle = qteActuelle + qty;

    if (qteNouvelle < 0) {
      return NextResponse.json(
        { error: `Stock insuffisant. Stock actuel : ${qteActuelle}, ajustement : ${qty}` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Mettre à jour ou créer le StockSite
      const stock = await tx.stockSite.upsert({
        where: { produitId_pointDeVenteId: { produitId, pointDeVenteId: pdvId } },
        update: { quantite: qteNouvelle },
        create: { produitId, pointDeVenteId: pdvId, quantite: qteNouvelle },
      });

      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId,
          pointDeVenteId: pdvId,
          type:           "AJUSTEMENT",
          typeEntree:     qty > 0 ? "AJUSTEMENT_POSITIF" : undefined,
          typeSortie:     qty < 0 ? "AJUSTEMENT_NEGATIF" : undefined,
          quantite:       Math.abs(qty),
          motif:          `${motif} (par ${session.user.prenom} ${session.user.nom})`,
          reference:      `MAG-ADJ-${randomUUID().slice(0, 8).toUpperCase()}`,
          operateurId:    parseInt(session.user.id),
        },
      });

      await auditLog(tx, parseInt(session.user.id), "AJUSTEMENT_STOCK_MAGASINIER", "MouvementStock", mouvement.id);

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
        titre:    `Ajustement stock : ${stockActuel?.produit.nom ?? produitId}`,
        message:  `${session.user.prenom} ${session.user.nom} a ajusté le stock de "${stockActuel?.produit.nom ?? produitId}" : ${qteActuelle} → ${qteNouvelle} (${qty > 0 ? "+" : ""}${qty}). Motif : ${motif}.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl:`/dashboard/magasinier/stock/${produitId}`,
      });

      return { mouvement, stock };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/stock/[id]/ajustement:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { Prisma, TypeMouvement, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/magasinier/stock/[id]/ajustement
 * Reception de stock ou ajustement d'inventaire
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getMagasinierSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const produitId = Number(id);
    if (isNaN(produitId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json();
    const { type, quantite, motif } = body;

    if (!type || !quantite || !motif) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (type, quantite, motif)" },
        { status: 400 }
      );
    }

    if (!["ENTREE", "AJUSTEMENT"].includes(type)) {
      return NextResponse.json(
        { error: "Type invalide (ENTREE ou AJUSTEMENT attendu)" },
        { status: 400 }
      );
    }

    const qty = Number(quantite);
    if (type === "ENTREE" && qty <= 0) {
      return NextResponse.json(
        { error: "La quantite doit etre superieure a 0 pour une entree" },
        { status: 400 }
      );
    }

    if (type === "AJUSTEMENT" && qty === 0) {
      return NextResponse.json(
        { error: "La quantite d'ajustement ne peut pas etre 0" },
        { status: 400 }
      );
    }

    const produit = await prisma.produit.findUnique({ where: { id: produitId } });
    if (!produit) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const newStock = produit.stock + qty;
    if (newStock < 0) {
      return NextResponse.json(
        { error: "Le stock ne peut pas devenir negatif" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId,
          type: type as TypeMouvement,
          quantite: Math.abs(qty),
          motif: `${motif} (par ${session.user.prenom} ${session.user.nom})`,
          reference: `MAG-${type === "ENTREE" ? "REC" : "ADJ"}-${randomUUID()}`,
        },
      });

      const updated = await tx.produit.update({
        where: { id: produitId },
        data: { stock: newStock },
      });

      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: type === "ENTREE" ? "RECEPTION_STOCK_MAGASINIER" : "AJUSTEMENT_STOCK_MAGASINIER",
          entite: "MouvementStock",
          entiteId: mouvement.id,
        },
      });

      // Notifications : Admin + RPV + Logistique (pour ENTREE et AJUSTEMENT)
      const typeLabel = type === "ENTREE" ? "Réception" : "Ajustement";
      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
        {
          titre:    `${typeLabel} stock : ${produit.nom}`,
          message:  `${session.user.prenom} ${session.user.nom} (magasinier) a enregistré ${qty > 0 ? "+" : ""}${qty} unité(s) sur "${produit.nom}". Stock : ${produit.stock} → ${newStock}. Motif : ${motif}.`,
          priorite: type === "AJUSTEMENT" ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/stock/${produitId}`,
        }
      );

      return { mouvement, produit: updated };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/stock/[id]/ajustement error:", error);
    return NextResponse.json({ error: "Erreur lors de l'operation" }, { status: 500 });
  }
}

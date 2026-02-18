import { NextResponse } from "next/server";
import { Prisma, TypeMouvement, Role, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";

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

      // Notification aux admins pour les entrées
      if (type === "ENTREE") {
        const admins = await tx.user.findMany({
          where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
          select: { id: true },
        });

        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              titre: `Reception stock: ${produit.nom}`,
              message: `Le magasinier ${session.user.prenom} ${session.user.nom} a receptionne ${qty} unites de "${produit.nom}". Stock: ${produit.stock} → ${newStock}.`,
              priorite: PrioriteNotification.NORMAL,
              actionUrl: `/dashboard/admin/stock/${produitId}`,
            })),
          });
        }
      }

      return { mouvement, produit: updated };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/stock/[id]/ajustement error:", error);
    return NextResponse.json({ error: "Erreur lors de l'operation" }, { status: 500 });
  }
}

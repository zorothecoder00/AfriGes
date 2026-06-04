import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutLigneCreditClient } from "@prisma/client";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; ligneId: string }> };

/**
 * PATCH /api/admin/credits/[id]/lignes/[ligneId]
 *
 * Met à jour le statut d'une ligne de crédit.
 * L'admin peut traiter n'importe quelle ligne de n'importe quel crédit.
 *
 * Body:
 *   { statut: "LIVRE" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE", notes?, produitSubstitutId? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const creditId = Number(id);
    const ligneIdN = Number(ligneId);
    if (isNaN(creditId) || isNaN(ligneIdN)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const body = await req.json() as {
      statut: StatutLigneCreditClient;
      notes?: string;
      produitSubstitutId?: number;
    };

    const { statut, notes, produitSubstitutId } = body;

    const STATUTS_VALIDES: StatutLigneCreditClient[] = ["LIVRE", "INDISPONIBLE", "SUBSTITUE", "ANNULE"];
    if (!STATUTS_VALIDES.includes(statut)) {
      return NextResponse.json({ error: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}` }, { status: 400 });
    }
    if (statut === "SUBSTITUE" && !produitSubstitutId) {
      return NextResponse.json({ error: "produitSubstitutId est requis pour une substitution" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCreditClient.findUnique({
        where: { id: ligneIdN },
        include: { credit: { select: { id: true, reference: true } } },
      });
      if (!ligne) throw new Error("LIGNE_INTROUVABLE");
      if (ligne.creditId !== creditId) throw new Error("LIGNE_INTROUVABLE");

      if (ligne.statut === "LIVRE") throw new Error("LIGNE_DEJA_LIVREE");
      if (statut !== "ANNULE" && ligne.statut !== "EN_ATTENTE") throw new Error("TRANSITION_INVALIDE");

      if (produitSubstitutId) {
        const produit = await tx.produit.findUnique({ where: { id: produitSubstitutId }, select: { id: true } });
        if (!produit) throw new Error("PRODUIT_SUBSTITUT_INTROUVABLE");
      }

      const result = await tx.ligneCreditClient.update({
        where: { id: ligneIdN },
        data: {
          statut,
          notes:              notes ?? ligne.notes,
          produitSubstitutId: statut === "SUBSTITUE" ? produitSubstitutId : ligne.produitSubstitutId,
          traiteParId:        userId,
          dateTraitement:     new Date(),
        },
        include: {
          produit:          { select: { id: true, nom: true } },
          produitSubstitut: { select: { id: true, nom: true } },
          traitePar:        { select: { id: true, nom: true, prenom: true } },
        },
      });

      await auditLog(tx, userId, `LIGNE_CREDIT_${statut}`, "LigneCreditClient", ligneIdN);

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        LIGNE_INTROUVABLE:             ["Ligne introuvable", 404],
        LIGNE_DEJA_LIVREE:             ["Cette ligne est déjà marquée comme livrée", 409],
        TRANSITION_INVALIDE:           ["Seules les lignes EN_ATTENTE peuvent changer de statut (sauf ANNULE)", 409],
        PRODUIT_SUBSTITUT_INTROUVABLE: ["Produit substitut introuvable", 404],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    console.error("PATCH /api/admin/credits/[id]/lignes/[ligneId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

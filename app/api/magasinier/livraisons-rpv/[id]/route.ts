import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/magasinier/livraisons-rpv/[id]
 * Body : { action: "valider", lignes: [{ ligneId, quantiteRecue }] }
 *
 * Passe la livraison EN_COURS → LIVREE.
 * Crée les MouvementStock et met à jour le stock des produits.
 * Notifie le RPV, la Logistique et le Comptable.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const id = Number(idStr);

    const livraison = await prisma.livraison.findUnique({
      where:   { id },
      include: { lignes: { include: { produit: true } } },
    });
    if (!livraison) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });

    const body   = await req.json();
    const action = body.action as string;

    if (action !== "valider")
      return NextResponse.json({ error: "Action invalide. Seule 'valider' est acceptée." }, { status: 400 });

    if (livraison.statut !== "EN_COURS")
      return NextResponse.json({ error: "Seule une livraison EN_COURS peut être validée par le Magasinier" }, { status: 400 });

    const lignesRecues: { ligneId: number; quantiteRecue: number }[] = body.lignes ?? [];
    // Si aucune ligne fournie, on utilise les quantités prévues
    if (!lignesRecues.length) {
      for (const l of livraison.lignes) {
        lignesRecues.push({ ligneId: l.id, quantiteRecue: l.quantitePrevue });
      }
    }

    // Vérifier stock disponible pour EXPEDITION
    if (livraison.type === "EXPEDITION") {
      for (const lr of lignesRecues) {
        const l = livraison.lignes.find((x) => x.id === lr.ligneId);
        if (!l) continue;
        if (l.produit.stock < lr.quantiteRecue)
          return NextResponse.json(
            { error: `Stock insuffisant pour "${l.produit.nom}" (disponible : ${l.produit.stock})` },
            { status: 400 }
          );
      }
    }

    const operateur = `${session.user.prenom} ${session.user.nom}`;

    const updated = await prisma.$transaction(async (tx) => {
      for (const lr of lignesRecues) {
        const ligne = livraison.lignes.find((x) => x.id === lr.ligneId);
        if (!ligne) continue;

        await tx.livraisonLigne.update({
          where: { id: lr.ligneId },
          data:  { quantiteRecue: lr.quantiteRecue },
        });

        const typeMvt = livraison.type === "RECEPTION" ? "ENTREE" : "SORTIE";
        const delta   = livraison.type === "RECEPTION" ? lr.quantiteRecue : -lr.quantiteRecue;

        await tx.mouvementStock.create({
          data: {
            produitId:     ligne.produitId,
            type:          typeMvt,
            quantite:      lr.quantiteRecue,
            motif:         `${livraison.type === "RECEPTION" ? "Réception" : "Expédition"} livraison ${livraison.reference} — validé par ${operateur} (Magasinier)`,
            reference:     `MAG-LIV-${randomUUID()}`,
            dateMouvement: new Date(),
          },
        });

        await tx.produit.update({
          where: { id: ligne.produitId },
          data:  { stock: { increment: delta }, prixUnitaire: new Prisma.Decimal(Number(ligne.produit.prixUnitaire)) },
        });
      }

      const validated = await tx.livraison.update({
        where:   { id },
        data:    { statut: "LIVREE", dateLivraison: new Date() },
        include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
      });

      await auditLog(tx, parseInt(session.user.id), "LIVRAISON_VALIDEE_MAGASINIER", "Livraison", id);

      const produitsStr = lignesRecues
        .map((lr) => {
          const l = livraison.lignes.find((x) => x.id === lr.ligneId);
          return l ? `${lr.quantiteRecue}× ${l.produit.nom}` : null;
        })
        .filter(Boolean)
        .join(", ");

      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT", "COMPTABLE"],
        {
          titre:    `Réception validée — ${livraison.reference}`,
          message:  `${operateur} (Magasinier) a validé la réception de la livraison ${livraison.reference}. ${lignesRecues.length} ligne(s) : ${produitsStr}. Stock mis à jour.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/responsablesPointDeVente`,
        }
      );

      return validated;
    });

    return NextResponse.json({
      success: true,
      message: `Réception validée — ${lignesRecues.length} ligne(s) traitée(s), stock mis à jour`,
      data: {
        ...updated,
        datePrevisionnelle: updated.datePrevisionnelle.toISOString(),
        dateLivraison:      updated.dateLivraison?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/magasinier/livraisons-rpv/[id] error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

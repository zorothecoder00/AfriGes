import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { prixRevendeur } from "@/lib/revendeur";
import { PrioriteNotification } from "@prisma/client";
import { INCLUDE } from "@/app/api/admin/revendeurs/[id]/commandes/route";

/**
 * Bon de commande revendeur — self-service : le revendeur passe lui-même sa
 * commande (mêmes routes/moteur de tarification que la saisie Admin/RVC pour
 * son compte, cf. /api/admin/revendeurs/[id]/commandes).
 */

/** GET /api/revendeur/commandes — mes commandes */
export async function GET() {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const commandes = await prisma.commandeRevendeur.findMany({
      where: { revendeurId: userId },
      orderBy: { createdAt: "desc" },
      include: INCLUDE,
    });
    return NextResponse.json({ data: commandes });
  } catch (error) {
    console.error("GET /revendeur/commandes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { produitId: number; quantite: number }

/** POST /api/revendeur/commandes — Body: { lignes: [{produitId, quantite}], dateLivraisonSouhaitee?, notes? } */
export async function POST(req: Request) {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId } });
    if (!profil) return NextResponse.json({ error: "Aucun compte revendeur ouvert" }, { status: 404 });
    if (profil.statut !== "ACTIF") return NextResponse.json({ error: "Compte revendeur non actif" }, { status: 422 });
    if (!profil.pointDeVenteId) return NextResponse.json({ error: "Aucun point de vente de rattachement — contactez l'administrateur" }, { status: 422 });

    const body = await req.json();
    const lignesInput = (body.lignes ?? []) as LigneInput[];
    if (!lignesInput.length) return NextResponse.json({ error: "Au moins une ligne est requise" }, { status: 400 });
    for (const l of lignesInput) {
      if (!l.produitId || !l.quantite || l.quantite <= 0) {
        return NextResponse.json({ error: "Chaque ligne doit avoir produitId et quantite (>0)" }, { status: 400 });
      }
    }

    const produits = await prisma.produit.findMany({
      where: { id: { in: lignesInput.map((l) => Number(l.produitId)) } },
      select: { id: true, nom: true, prixUnitaire: true },
    });
    const produitParId = new Map(produits.map((p) => [p.id, p]));
    for (const l of lignesInput) {
      if (!produitParId.has(Number(l.produitId))) return NextResponse.json({ error: `Produit ${l.produitId} introuvable` }, { status: 404 });
    }

    const lignesCalculees = await Promise.all(lignesInput.map(async (l) => {
      const produit = produitParId.get(Number(l.produitId))!;
      const prixUnitaire = await prixRevendeur(produit, profil.pointDeVenteId);
      const quantite = Number(l.quantite);
      return { produitId: produit.id, quantite, prixUnitaire, montantLigne: prixUnitaire * quantite };
    }));
    const totalTTC = lignesCalculees.reduce((s, l) => s + l.montantLigne, 0);

    const commande = await genererReferenceUnique(
      "BCR",
      () => prisma.commandeRevendeur.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const c = await tx.commandeRevendeur.create({
          data: {
            reference,
            revendeurId: userId,
            pointDeVenteId: profil.pointDeVenteId!,
            creeParId: userId,
            dateLivraisonSouhaitee: body.dateLivraisonSouhaitee ? new Date(body.dateLivraisonSouhaitee) : null,
            notes: body.notes || null,
            totalHT: totalTTC,
            totalTTC,
            lignes: { create: lignesCalculees },
          },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "BCR_CREE", "CommandeRevendeur", c.id, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["RESPONSABLE_VENTE_CREDIT"], {
          titre: `Nouvelle commande revendeur (${reference})`,
          message: `${profil.raisonSociale} a passé une commande de ${totalTTC.toLocaleString("fr-FR")} FCFA.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/revendeurs/${profil.id}`,
        });
        return c;
      }),
    );
    return NextResponse.json({ data: commande }, { status: 201 });
  } catch (error) {
    console.error("POST /revendeur/commandes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

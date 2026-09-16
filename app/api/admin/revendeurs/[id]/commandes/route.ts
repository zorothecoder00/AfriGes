import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { genererReferenceUnique } from "@/lib/depotVente";
import { prixRevendeur } from "@/lib/revendeur";

/**
 * Bon de commande revendeur (CDC §5.6) — saisi ici par l'Admin/RVC pour le
 * compte du revendeur (le revendeur peut aussi commander lui-même via
 * /api/revendeur/commandes, même moteur de tarification).
 */

export const INCLUDE = {
  revendeur: { select: { id: true, nom: true, prenom: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
  bonLivraison: { select: { id: true, reference: true } },
  facture: { select: { id: true, numero: true, statut: true } },
};

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/revendeurs/[id]/commandes */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, select: { userId: true } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const commandes = await prisma.commandeRevendeur.findMany({
      where: { revendeurId: profil.userId },
      orderBy: { createdAt: "desc" },
      include: INCLUDE,
    });
    return NextResponse.json({ data: commandes });
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]/commandes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { produitId: number; quantite: number }

/**
 * POST /api/admin/revendeurs/[id]/commandes
 * Body: { pointDeVenteId?, lignes: [{produitId, quantite}], dateLivraisonSouhaitee?, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });
    if (profil.statut !== "ACTIF") return NextResponse.json({ error: "Compte revendeur non actif" }, { status: 422 });

    const body = await req.json();
    const pointDeVenteId = Number(body.pointDeVenteId || profil.pointDeVenteId);
    if (!pointDeVenteId) return NextResponse.json({ error: "Point de vente obligatoire" }, { status: 400 });

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
      const prixUnitaire = await prixRevendeur(produit, pointDeVenteId);
      const quantite = Number(l.quantite);
      return { produitId: produit.id, quantite, prixUnitaire, montantLigne: prixUnitaire * quantite };
    }));
    const totalTTC = lignesCalculees.reduce((s, l) => s + l.montantLigne, 0);

    const userId = parseInt(session.user.id);
    const commande = await genererReferenceUnique(
      "BCR",
      () => prisma.commandeRevendeur.count(),
      (reference) => prisma.$transaction(async (tx) => {
        const c = await tx.commandeRevendeur.create({
          data: {
            reference,
            revendeurId: profil.userId,
            pointDeVenteId,
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
        return c;
      }),
    );
    return NextResponse.json({ data: commande }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/revendeurs/[id]/commandes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

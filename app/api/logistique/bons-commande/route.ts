import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../fournisseurs/route";
import { getRequestMeta } from "@/lib/requestMeta";

const INCLUDE = {
  fournisseur: { select: { id: true, nom: true, code: true, email: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  demandeCotation: { select: { id: true, reference: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  approuvePar: { select: { id: true, nom: true, prenom: true } },
  signePar: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
};

/**
 * GET /api/logistique/bons-commande
 * Liste des bons de commande. Query: statut?, fournisseurId?, search?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const fournisseurId = searchParams.get("fournisseurId");
    const search = (searchParams.get("search") || "").trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (fournisseurId) where.fournisseurId = Number(fournisseurId);
    if (search) where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { fournisseur: { nom: { contains: search, mode: "insensitive" } } },
    ];

    const [bons, statsRaw] = await Promise.all([
      prisma.bonCommande.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.bonCommande.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: bons,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /logistique/bons-commande:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/bons-commande
 * Crée un bon de commande en DRAFT.
 * Body: { fournisseurId, pointDeVenteId, dateLivraisonPrevue?, devise?, notes?,
 *         demandeCotationId?, lignes: [{ produitId, quantite, prixUnitaire }] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { fournisseurId, pointDeVenteId, dateLivraisonPrevue, devise, notes, demandeCotationId, lignes } = body;

    if (!fournisseurId || !pointDeVenteId) {
      return NextResponse.json({ error: "fournisseurId et pointDeVenteId sont obligatoires" }, { status: 400 });
    }
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: "Au moins une ligne de commande est requise" }, { status: 400 });
    }
    for (const l of lignes) {
      if (!l.produitId || !l.quantite || l.quantite <= 0 || l.prixUnitaire == null || l.prixUnitaire < 0) {
        return NextResponse.json({ error: "Chaque ligne doit avoir produitId, quantite (>0) et prixUnitaire (≥0)" }, { status: 400 });
      }
    }

    const montantTotal = lignes.reduce((s: number, l: { quantite: number; prixUnitaire: number }) => s + l.quantite * l.prixUnitaire, 0);

    const data = {
      fournisseurId: Number(fournisseurId),
      pointDeVenteId: Number(pointDeVenteId),
      demandeCotationId: demandeCotationId ? Number(demandeCotationId) : null,
      dateLivraisonPrevue: dateLivraisonPrevue ? new Date(dateLivraisonPrevue) : null,
      devise: devise || "XOF",
      notes: notes || null,
      montantTotal,
      creeParId: parseInt(session.user.id),
    };

    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.bonCommande.count();
      const annee = new Date().getFullYear();
      const reference = `PO-TG-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const bon = await prisma.$transaction(async (tx) => {
          const b = await tx.bonCommande.create({
            data: {
              ...data, reference,
              lignes: {
                create: lignes.map((l: { produitId: number; quantite: number; prixUnitaire: number }) => ({
                  produitId: Number(l.produitId), quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire),
                })),
              },
            },
            include: INCLUDE,
          });
          await auditLog(tx, parseInt(session.user.id), "PO_CREE", "BonCommande", b.id, undefined, getRequestMeta(req));
          return b;
        });
        return NextResponse.json({ data: bon }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence PO unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /logistique/bons-commande:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

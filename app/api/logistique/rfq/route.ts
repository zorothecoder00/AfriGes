import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../fournisseurs/route";

const INCLUDE = {
  produit: { select: { id: true, nom: true, codeProduit: true, uniteAchat: { select: { nom: true } } } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  fournisseurRetenu: { select: { id: true, nom: true, code: true } },
  reponses: {
    include: { fournisseur: { select: { id: true, nom: true, code: true, email: true, noteGlobale: true } } },
  },
  _count: { select: { reponses: true } },
};

/**
 * GET /api/logistique/rfq
 * Liste des demandes de cotation. Query: statut?, produitId?, search?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const produitId = searchParams.get("produitId");
    const search = (searchParams.get("search") || "").trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (produitId) where.produitId = Number(produitId);
    if (search) where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { produit: { nom: { contains: search, mode: "insensitive" } } },
    ];

    const [demandes, statsRaw] = await Promise.all([
      prisma.demandeCotation.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.demandeCotation.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: demandes,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /logistique/rfq:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/rfq
 * Crée une demande de cotation en BROUILLON (pas encore envoyée aux fournisseurs).
 * Body: { produitId, quantite, pointDeVenteId?, dateLimiteReponse?, notes?, fournisseurIds: number[] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { produitId, quantite, pointDeVenteId, dateLimiteReponse, notes, fournisseurIds } = body;

    if (!produitId || !quantite || quantite <= 0) {
      return NextResponse.json({ error: "produitId et quantite (>0) sont obligatoires" }, { status: 400 });
    }
    if (!Array.isArray(fournisseurIds) || fournisseurIds.length < 1) {
      return NextResponse.json({ error: "Sélectionnez au moins un fournisseur à consulter" }, { status: 400 });
    }

    const data = {
      produitId: Number(produitId),
      quantite: Number(quantite),
      pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
      dateLimiteReponse: dateLimiteReponse ? new Date(dateLimiteReponse) : null,
      notes: notes || null,
      creeParId: parseInt(session.user.id),
    };

    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.demandeCotation.count();
      const annee = new Date().getFullYear();
      const reference = `RFQ-TG-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const demande = await prisma.$transaction(async (tx) => {
          const d = await tx.demandeCotation.create({
            data: {
              ...data, reference,
              reponses: {
                create: fournisseurIds.map((fid: number) => ({ fournisseurId: Number(fid) })),
              },
            },
            include: INCLUDE,
          });
          await auditLog(tx, parseInt(session.user.id), "RFQ_CREEE", "DemandeCotation", d.id);
          return d;
        });
        return NextResponse.json({ data: demande }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence RFQ unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /logistique/rfq:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

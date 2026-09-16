import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSeuilVisaDemandeAchat } from "@/lib/parametresDocuments";
import { getSession } from "../fournisseurs/route";

/**
 * Demande d'Achat Interne (CDC digitalisation §5.3) — formalise en interne un
 * besoin d'achat avant le lancement d'une RFQ/PO. Namespace logistique/appro
 * (création) + visa RPV/Chef Agence/Direction au-delà du seuil paramétré.
 */

export const INCLUDE = {
  demandeur: { select: { id: true, nom: true, prenom: true } },
  visePar: { select: { id: true, nom: true, prenom: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
  lignes: {
    include: {
      produit: { select: { id: true, nom: true, codeProduit: true, prixUnitaire: true } },
      demandeCotation: { select: { id: true, reference: true, statut: true } },
    },
  },
};

/**
 * GET /api/logistique/demandes-achat
 * Query: statut?, search?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const search = (searchParams.get("search") || "").trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (search) where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { motif: { contains: search, mode: "insensitive" } },
    ];

    const [demandes, statsRaw] = await Promise.all([
      prisma.demandeAchatInterne.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.demandeAchatInterne.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const seuilVisaDemandeAchat = await getSeuilVisaDemandeAchat();

    return NextResponse.json({
      data: demandes,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
      seuilVisaDemandeAchat,
    });
  } catch (error) {
    console.error("GET /logistique/demandes-achat:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { produitId: number; quantite: number; justification?: string }

/**
 * POST /api/logistique/demandes-achat
 * Body: { motif, pointDeVenteId?, notes?, lignes: [{produitId, quantite, justification?}] }
 * Auto-approuvée si montantEstimatif ≤ seuil, sinon en attente de visa.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const motif = String(body.motif || "").trim();
    if (!motif) return NextResponse.json({ error: "Motif obligatoire" }, { status: 400 });

    const lignesInput = (body.lignes ?? []) as LigneInput[];
    if (!lignesInput.length) return NextResponse.json({ error: "Au moins une ligne est requise" }, { status: 400 });
    for (const l of lignesInput) {
      if (!l.produitId || !l.quantite || l.quantite <= 0) {
        return NextResponse.json({ error: "Chaque ligne doit avoir produitId et quantite (>0)" }, { status: 400 });
      }
    }

    const userId = parseInt(session.user.id);
    const produits = await prisma.produit.findMany({
      where: { id: { in: lignesInput.map((l) => Number(l.produitId)) } },
      select: { id: true, prixUnitaire: true },
    });
    if (produits.length !== new Set(lignesInput.map((l) => Number(l.produitId))).size) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }
    const prixParProduit = new Map(produits.map((p) => [p.id, Number(p.prixUnitaire)]));
    const montantEstimatif = lignesInput.reduce(
      (s, l) => s + l.quantite * (prixParProduit.get(Number(l.produitId)) ?? 0),
      0
    );

    const seuil = await getSeuilVisaDemandeAchat();
    const visaRequis = montantEstimatif > seuil;

    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.demandeAchatInterne.count();
      const annee = new Date().getFullYear();
      const reference = `DAI-TG-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const demande = await prisma.$transaction(async (tx) => {
          const d = await tx.demandeAchatInterne.create({
            data: {
              reference,
              statut: visaRequis ? "EN_VALIDATION" : "APPROUVEE",
              demandeurId: userId,
              pointDeVenteId: body.pointDeVenteId ? Number(body.pointDeVenteId) : null,
              motif,
              notes: body.notes || null,
              montantEstimatif,
              lignes: {
                create: lignesInput.map((l) => ({
                  produitId: Number(l.produitId),
                  quantite: Number(l.quantite),
                  justification: l.justification || null,
                })),
              },
            },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "DAI_CREEE", "DemandeAchatInterne", d.id, { visaRequis, montantEstimatif }, getRequestMeta(req));
          if (visaRequis) {
            await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE"], {
              titre: `Demande d'achat en attente de visa (${reference})`,
              message: `${session.user.prenom} ${session.user.nom} a soumis une demande d'achat de ${montantEstimatif.toLocaleString("fr-FR")} FCFA (estimatif) — visa requis.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: `/dashboard/user/logistiquesApprovisionnements/demandes-achat?detail=${d.id}`,
            });
          }
          return d;
        });
        return NextResponse.json({ data: demande }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /logistique/demandes-achat:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

async function getSession() {
  return (await getLogistiqueSession()) ?? (await getMagasinierSession());
}

/**
 * GET /api/logistique/receptions
 * Liste des réceptions d'approvisionnement (ReceptionApprovisionnement).
 * Query: statut, type, pdvId, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip   = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const statut = searchParams.get("statut") || "";
    const type   = searchParams.get("type")   || "";
    const pdvId  = searchParams.get("pdvId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (type)   where.type   = type;
    if (pdvId)  where.pointDeVenteId = Number(pdvId);
    if (search) where.OR = [
      { reference:      { contains: search, mode: "insensitive" } },
      { fournisseurNom: { contains: search, mode: "insensitive" } },
      { fournisseur:    { nom: { contains: search, mode: "insensitive" } } },
    ];

    const [receptions, total] = await Promise.all([
      prisma.receptionApprovisionnement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente:   { select: { id: true, nom: true, code: true } },
          fournisseur:    { select: { id: true, nom: true } },
          receptionnePar: { select: { id: true, nom: true, prenom: true } },
          validePar:      { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, reference: true, unite: true } } },
          },
        },
      }),
      prisma.receptionApprovisionnement.count({ where }),
    ]);

    // Données annexes pour le formulaire
    const [pdvs, fournisseurs, produits] = await Promise.all([
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true, type: true }, orderBy: { nom: "asc" } }),
      prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true, telephone: true }, orderBy: { nom: "asc" } }),
      prisma.produit.findMany({ where: { actif: true }, select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true }, orderBy: { nom: "asc" } }),
    ]);

    // Stats 30 derniers jours
    const since30j = new Date(); since30j.setDate(since30j.getDate() - 30);
    const stats30j = await prisma.receptionApprovisionnement.count({ where: { createdAt: { gte: since30j } } });

    return NextResponse.json({
      data: receptions,
      pdvs, fournisseurs, produits,
      stats: { total30j: stats30j },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/receptions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/receptions
 * Créer une nouvelle réception (statut BROUILLON).
 * Body: { type, pointDeVenteId, fournisseurId?, fournisseurNom?, origineId?,
 *         datePrevisionnelle, notes?, lignes: [{produitId, quantiteAttendue, prixUnitaire?}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, pointDeVenteId, fournisseurId, fournisseurNom,
            origineId, datePrevisionnelle, notes, lignes } = body;

    if (!type || !pointDeVenteId || !datePrevisionnelle || !lignes?.length) {
      return NextResponse.json(
        { error: "type, pointDeVenteId, datePrevisionnelle et lignes sont obligatoires" },
        { status: 400 }
      );
    }
    if (type === "FOURNISSEUR" && !fournisseurId && !fournisseurNom) {
      return NextResponse.json({ error: "fournisseurId ou fournisseurNom requis pour type FOURNISSEUR" }, { status: 400 });
    }

    const reception = await prisma.$transaction(async (tx) => {
      const ref = `REC-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      const r = await tx.receptionApprovisionnement.create({
        data: {
          reference:         ref,
          type,
          statut:            "BROUILLON",
          pointDeVenteId:    Number(pointDeVenteId),
          fournisseurId:     fournisseurId ? Number(fournisseurId) : null,
          fournisseurNom:    fournisseurNom || null,
          origineId:         origineId     ? Number(origineId)     : null,
          datePrevisionnelle:new Date(datePrevisionnelle),
          notes:             notes  || null,
          receptionneParId:  parseInt(session.user.id),
          lignes: {
            create: lignes.map((l: { produitId: number; quantiteAttendue: number; prixUnitaire?: number }) => ({
              produitId:        Number(l.produitId),
              quantiteAttendue: Number(l.quantiteAttendue),
              prixUnitaire:     l.prixUnitaire ?? null,
            })),
          },
        },
        include: {
          pointDeVente: { select: { nom: true } },
          lignes: { include: { produit: { select: { nom: true } } } },
        },
      });

      await auditLog(tx, parseInt(session.user.id), "RECEPTION_CREEE", "ReceptionApprovisionnement", r.id);

      await notifyRoles(tx, ["MAGAZINIER"], {
        titre:    `Réception planifiée : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} a planifié une réception ${type} de ${lignes.length} produit(s) pour "${r.pointDeVente.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/logistique/receptions/${r.id}`,
      });

      return r;
    });

    return NextResponse.json({ data: reception }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/receptions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

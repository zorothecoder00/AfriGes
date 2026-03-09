import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/livraisons
 * Liste les réceptions d'approvisionnement du PDV du RPV.
 * Paramètres : page, limit, statut, type (FOURNISSEUR|INTERNE), search
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ message: "Aucun PDV associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "10")));
    const statut = searchParams.get("statut") ?? "";
    const type   = searchParams.get("type") ?? "";
    const search = searchParams.get("search") ?? "";

    const where: Prisma.ReceptionApprovisionnementWhereInput = { pointDeVenteId: pdv.id };
    if (statut) where.statut = statut as Prisma.EnumStatutReceptionApproFilter;
    if (type)   where.type   = type as Prisma.EnumTypeReceptionApproFilter;
    if (search) {
      where.OR = [
        { reference:    { contains: search, mode: "insensitive" } },
        { fournisseurNom: { contains: search, mode: "insensitive" } },
        { origineNom:   { contains: search, mode: "insensitive" } },
      ];
    }

    const [receptions, total, statsRaw] = await Promise.all([
      prisma.receptionApprovisionnement.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { datePrevisionnelle: "asc" },
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true, prixUnitaire: true } } },
          },
          receptionnePar: { select: { nom: true, prenom: true } },
        },
      }),
      prisma.receptionApprovisionnement.count({ where }),
      prisma.receptionApprovisionnement.groupBy({
        by: ["statut"], _count: { id: true },
        where: { pointDeVenteId: pdv.id },
      }),
    ]);

    const stats: Record<string, number> = {};
    for (const s of statsRaw) stats[s.statut] = s._count.id;

    return NextResponse.json({
      success: true,
      data: receptions.map((r) => ({
        ...r,
        datePrevisionnelle: r.datePrevisionnelle.toISOString(),
        dateLivraison:      r.dateReception?.toISOString() ?? null,
        destinataireNom:    r.origineNom ?? null,
        planifiePar:        r.receptionnePar ? `${r.receptionnePar.prenom} ${r.receptionnePar.nom}` : "—",
        createdAt:          r.createdAt.toISOString(),
        updatedAt:          r.updatedAt.toISOString(),
        lignes: r.lignes.map((l) => ({
          ...l,
          quantitePrevue: l.quantiteAttendue,
          quantiteRecue:  l.quantiteRecue ?? null,
          produit: { ...l.produit, prixUnitaire: Number(l.produit.prixUnitaire) },
        })),
      })),
      stats: {
        brouillon: stats["BROUILLON"] ?? 0,
        enCours:   stats["EN_COURS"]  ?? 0,
        recu:      stats["RECU"]      ?? 0,
        valide:    stats["VALIDE"]    ?? 0,
        annule:    stats["ANNULE"]    ?? 0,
      },
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("GET /api/rpv/livraisons error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/livraisons
 * Planifie une nouvelle réception d'approvisionnement.
 * Body : {
 *   type: "FOURNISSEUR" | "INTERNE",
 *   fournisseurNom?  (FOURNISSEUR)
 *   origineNom?      (INTERNE)
 *   datePrevisionnelle: ISO string,
 *   notes?,
 *   lignes: [{ produitId, quantiteAttendue }]
 * }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvPost = await prisma.pointDeVente.findUnique({ where: { rpvId: parseInt(session.user.id) } });
    if (!pdvPost) return NextResponse.json({ message: "Aucun PDV associé" }, { status: 400 });

    const { type, fournisseurNom, origineNom, datePrevisionnelle, notes, lignes } = await req.json();

    if (!type || !datePrevisionnelle || !lignes?.length) {
      return NextResponse.json(
        { message: "type, datePrevisionnelle et au moins une ligne sont requis" },
        { status: 400 }
      );
    }
    if (!["FOURNISSEUR", "INTERNE"].includes(type))
      return NextResponse.json({ message: "Type invalide (FOURNISSEUR|INTERNE)" }, { status: 400 });

    const produitIds = (lignes as { produitId: number }[]).map((l) => Number(l.produitId));
    const count = await prisma.produit.count({ where: { id: { in: produitIds } } });
    if (count !== produitIds.length)
      return NextResponse.json({ message: "Un ou plusieurs produits introuvables" }, { status: 404 });

    const reference = `REC-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const reception = await prisma.$transaction(async (tx) => {
      const created = await tx.receptionApprovisionnement.create({
        data: {
          reference,
          type,
          statut:             "BROUILLON",
          pointDeVenteId:     pdvPost.id,
          fournisseurNom:     type === "FOURNISSEUR" ? (fournisseurNom ?? null) : null,
          origineNom:         type === "INTERNE"     ? (origineNom ?? null)     : null,
          datePrevisionnelle: new Date(datePrevisionnelle),
          notes:              notes ?? null,
          receptionneParId:   parseInt(session.user.id),
          lignes: {
            create: (lignes as { produitId: number; quantiteAttendue: number }[]).map((l) => ({
              produitId:       Number(l.produitId),
              quantiteAttendue: Number(l.quantiteAttendue),
            })),
          },
        },
        include: {
          lignes: { include: { produit: { select: { id: true, nom: true } } } },
        },
      });

      await auditLog(tx, parseInt(session.user.id), "PLANIFICATION_LIVRAISON_RPV", "ReceptionApprovisionnement", created.id);

      const lignesStr = created.lignes.map((l) => `${l.quantiteAttendue}× ${l.produit.nom}`).join(", ");
      const typeLabel = type === "FOURNISSEUR" ? "réception fournisseur" : "réception interne";
      const tiers     = type === "FOURNISSEUR" ? fournisseurNom : origineNom;

      await notifyRoles(
        tx,
        ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
        {
          titre:    `Livraison planifiée (${typeLabel})`,
          message:  `${session.user.name ?? "RPV"} a planifié une ${typeLabel}${tiers ? ` avec "${tiers}"` : ""} pour le ${new Date(datePrevisionnelle).toLocaleDateString("fr-FR")}. Réf : ${reference}. Produits : ${lignesStr}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/user/responsablesPointDeVente`,
        }
      );

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Livraison planifiée avec succès",
        data: {
          ...reception,
          datePrevisionnelle: reception.datePrevisionnelle.toISOString(),
          createdAt:          reception.createdAt.toISOString(),
          updatedAt:          reception.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rpv/livraisons error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

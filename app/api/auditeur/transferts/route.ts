import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

/**
 * GET /api/auditeur/transferts?page=1&limit=20&statut=X&origineId=X&destinationId=X
 *
 * Transferts de stock entre PDV et dépôts (lecture seule)
 *  - Statut : EN_COURS | EXPEDIE | RECU | ANNULE
 *  - Écart : lignes EXPEDIE non encore réceptionnées
 */
export async function GET(req: Request) {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit      = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "20")));
    const statut     = searchParams.get("statut") ?? "";
    const origineId  = searchParams.get("origineId") ? Number(searchParams.get("origineId")) : null;
    const destId     = searchParams.get("destinationId") ? Number(searchParams.get("destinationId")) : null;

    const where: Record<string, unknown> = {};
    if (statut)    where.statut       = statut;
    if (origineId) where.origineId    = origineId;
    if (destId)    where.destinationId = destId;

    const [total, transferts, statsParStatut, pointsDeVente] = await Promise.all([
      prisma.transfertStock.count({ where }),

      prisma.transfertStock.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          origine:     { select: { id: true, nom: true, code: true, type: true } },
          destination: { select: { id: true, nom: true, code: true, type: true } },
          creePar:     { select: { id: true, nom: true, prenom: true } },
          validePar:   { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: {
              produit: { select: { id: true, nom: true, unite: true } },
            },
          },
        },
      }),

      prisma.transfertStock.groupBy({
        by: ["statut"],
        _count: { id: true },
      }),

      prisma.pointDeVente.findMany({
        where:  { actif: true },
        select: { id: true, nom: true, code: true, type: true },
        orderBy: { nom: "asc" },
      }),
    ]);

    const statsMap: Record<string, number> = {};
    for (const s of statsParStatut) statsMap[s.statut] = s._count.id;

    const data = transferts.map((t) => ({
      id:            t.id,
      reference:     t.reference,
      statut:        t.statut,
      origine:       { id: t.origine.id, nom: t.origine.nom, code: t.origine.code, type: t.origine.type },
      destination:   { id: t.destination.id, nom: t.destination.nom, code: t.destination.code, type: t.destination.type },
      creeParNom:    `${t.creePar.prenom} ${t.creePar.nom}`,
      valideParNom:  t.validePar ? `${t.validePar.prenom} ${t.validePar.nom}` : null,
      dateExpedition: t.dateExpedition?.toISOString() ?? null,
      dateReception:  t.dateReception?.toISOString() ?? null,
      notes:          t.notes,
      createdAt:      t.createdAt.toISOString(),
      // Indique si ce transfert est en attente de réception (EXPEDIE sans dateReception)
      enAttenteReception: t.statut === "EXPEDIE" && !t.dateReception,
      lignes: t.lignes.map((l) => ({
        id:          l.id,
        produitNom:  l.produit.nom,
        unite:       l.produit.unite ?? "",
        quantite:    l.quantite,
        prixUnit:    l.prixUnit ? Number(l.prixUnit) : null,
      })),
      totalQuantite: t.lignes.reduce((s, l) => s + l.quantite, 0),
      totalValeur:   t.lignes.reduce((s, l) => s + l.quantite * (l.prixUnit ? Number(l.prixUnit) : 0), 0),
    }));

    return NextResponse.json({
      success: true,
      data,
      stats: {
        parStatut:           statsMap,
        enAttenteReception:  statsMap["EXPEDIE"] ?? 0,
        total,
      },
      pointsDeVente,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/auditeur/transferts error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

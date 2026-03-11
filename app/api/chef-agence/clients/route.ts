import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/clients?pdvId=X&search=X&page=1&limit=25&etat=X
 *
 * Base clients de toute la zone du chef d'agence, avec filtres.
 */
export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit      = Math.min(100, Math.max(5, Number(searchParams.get("limit") ?? "25")));
    const pdvIdParam = searchParams.get("pdvId")  ? Number(searchParams.get("pdvId")) : null;
    const search     = searchParams.get("search") ?? "";
    const etat       = searchParams.get("etat")   ?? "";

    const effectivePdvIds = pdvIdParam
      ? (pdvIds === null || pdvIds.includes(pdvIdParam) ? [pdvIdParam] : [])
      : pdvIds;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {}),
    };

    if (etat) where.etat = etat;
    if (search) {
      where.OR = [
        { nom:       { contains: search, mode: "insensitive" } },
        { prenom:    { contains: search, mode: "insensitive" } },
        { telephone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),

      prisma.client.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        select: {
          id: true, nom: true, prenom: true, telephone: true, adresse: true, etat: true,
          createdAt: true,
          pointDeVente: { select: { id: true, nom: true, code: true } },
          souscriptionsPacks: {
            where:  { statut: { in: ["ACTIF", "EN_ATTENTE"] } },
            select: { id: true, statut: true, montantTotal: true, montantVerse: true, montantRestant: true,
                      pack: { select: { nom: true, type: true } } },
          },
          _count: { select: { ventesDirectes: true, souscriptionsPacks: true } },
        },
      }),
    ]);

    const data = clients.map((c) => ({
      id:          c.id,
      nom:         c.nom,
      prenom:      c.prenom,
      telephone:   c.telephone,
      adresse:     c.adresse,
      etat:        c.etat,
      createdAt:   c.createdAt.toISOString(),
      pdv:         c.pointDeVente,
      souscriptionsActives: c.souscriptionsPacks.map((s) => ({
        id:             s.id,
        statut:         s.statut,
        packNom:        s.pack.nom,
        packType:       s.pack.type,
        montantTotal:   Number(s.montantTotal),
        montantVerse:   Number(s.montantVerse),
        montantRestant: Number(s.montantRestant),
      })),
      nbVentes:        c._count.ventesDirectes,
      nbSouscriptions: c._count.souscriptionsPacks,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/clients error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

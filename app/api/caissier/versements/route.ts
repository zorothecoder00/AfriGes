import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";

/**
 * GET /api/caissier/versements
 * Historique des versements packs encaissés par ce caissier / sur ce PDV.
 * Query: search, dateDebut, dateFin, aujourdHui, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip       = (page - 1) * limit;
    const search     = searchParams.get("search") || "";
    const dateDebut  = searchParams.get("dateDebut");
    const dateFin    = searchParams.get("dateFin");
    const aujourdHui = searchParams.get("aujourdHui") === "true";

    // Filtre souscription PDV
    const souscriptionFilter = pdvId ? souscriptionPdvWhere(pdvId) : {};

    // Filtre date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (aujourdHui) {
      const now = new Date();
      dateFilter.datePaiement = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (dateDebut || dateFin) {
      dateFilter.datePaiement = {};
      if (dateDebut) dateFilter.datePaiement.gte = new Date(dateDebut);
      if (dateFin)   dateFilter.datePaiement.lte = new Date(dateFin + "T23:59:59.999Z");
    }

    // Filtre souscription — PDV + recherche combinés avec AND pour éviter toute collision de clés OR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const souscriptionAndConditions: any[] = [];
    if (pdvId) souscriptionAndConditions.push(souscriptionFilter);
    if (search) {
      souscriptionAndConditions.push({
        OR: [
          { pack:   { nom:    { contains: search, mode: "insensitive" } } },
          { client: { nom:    { contains: search, mode: "insensitive" } } },
          { client: { prenom: { contains: search, mode: "insensitive" } } },
          { user:   { nom:    { contains: search, mode: "insensitive" } } },
          { user:   { prenom: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...dateFilter,
      ...(souscriptionAndConditions.length > 0
        ? { souscription: { AND: souscriptionAndConditions } }
        : {}),
    };

    const [versements, total] = await Promise.all([
      prisma.versementPack.findMany({
        where,
        orderBy: { datePaiement: "desc" },
        skip,
        take: limit,
        include: {
          souscription: {
            select: {
              id: true,
              statut: true,
              montantTotal: true,
              montantVerse: true,
              montantRestant: true,
              pack:   { select: { id: true, nom: true, type: true } },
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
              user:   { select: { id: true, nom: true, prenom: true, telephone: true } },
            },
          },
        },
      }),
      prisma.versementPack.count({ where }),
    ]);

    // Stats de la période
    const allPeriod = await prisma.versementPack.findMany({
      where,
      select: { montant: true },
    });
    const montantTotal = allPeriod.reduce((s, v) => s + Number(v.montant), 0);
    const panierMoyen  = allPeriod.length > 0 ? montantTotal / allPeriod.length : 0;

    return NextResponse.json({
      success: true,
      data: versements,
      stats: {
        totalVentes:    total,
        montantTotal,
        panierMoyen,
        quantiteTotale: total,
      },
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("GET /api/caissier/versements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

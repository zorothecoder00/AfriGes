import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/caissier/ventes
 *
 * Liste les versements packs collectés (vue caisse).
 * Remplace l'ancien endpoint VenteCreditAlimentaire.
 * Paramètres : page, limit, search, dateDebut, dateFin, aujourdHui (bool)
 */
export async function GET(req: Request) {
  try {
    const session = (await getCaissierSession()) ?? (await getRPVSession());
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit      = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "15")));
    const skip       = (page - 1) * limit;
    const search     = searchParams.get("search") ?? "";
    const dateDebut  = searchParams.get("dateDebut");
    const dateFin    = searchParams.get("dateFin");
    const aujourdHui = searchParams.get("aujourdHui") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (aujourdHui) {
      const now = new Date();
      where.datePaiement = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (dateDebut || dateFin) {
      where.datePaiement = {};
      if (dateDebut) where.datePaiement.gte = new Date(dateDebut);
      if (dateFin)   where.datePaiement.lte = new Date(dateFin + "T23:59:59.999Z");
    }

    if (search) {
      where.OR = [
        { souscription: { pack:   { nom:    { contains: search, mode: "insensitive" } } } },
        { souscription: { client: { nom:    { contains: search, mode: "insensitive" } } } },
        { souscription: { client: { prenom: { contains: search, mode: "insensitive" } } } },
        { souscription: { user:   { nom:    { contains: search, mode: "insensitive" } } } },
        { souscription: { user:   { prenom: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [versements, total] = await Promise.all([
      prisma.versementPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { datePaiement: "desc" },
        include: {
          souscription: {
            include: {
              pack:   { select: { id: true, nom: true, type: true } },
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
              user:   { select: { id: true, nom: true, prenom: true, telephone: true } },
            },
          },
        },
      }),
      prisma.versementPack.count({ where }),
    ]);

    // Stats sur la période complète (sans pagination)
    const allMontants = await prisma.versementPack.findMany({
      where,
      select: { montant: true },
    });
    const montantTotal  = allMontants.reduce((s, v) => s + Number(v.montant), 0);
    const nbVersements  = allMontants.length;
    const panierMoyen   = nbVersements > 0 ? montantTotal / nbVersements : 0;

    return NextResponse.json({
      success: true,
      data: versements,
      stats: {
        totalVentes:    total,
        montantTotal,
        panierMoyen,
        quantiteTotale: nbVersements,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/ventes error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

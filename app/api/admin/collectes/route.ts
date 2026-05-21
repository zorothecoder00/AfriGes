import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/collectes
 * Liste toutes les collectes journalières
 * Query params: page, limit, agentId, pdvId, statut, dateDebut, dateFin
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Number(searchParams.get("page")  || 1);
    const limit     = Number(searchParams.get("limit") || 20);
    const skip      = (page - 1) * limit;
    const agentId   = searchParams.get("agentId");
    const pdvId     = searchParams.get("pdvId");
    const statut    = searchParams.get("statut");
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");

    const where: Prisma.CollecteJournaliereWhereInput = {
      ...(agentId && { agentId: Number(agentId) }),
      ...(pdvId   && { pointDeVenteId: Number(pdvId) }),
      ...(statut  && { statut: statut as never }),
      ...(dateDebut || dateFin
        ? {
            dateCollecte: {
              ...(dateDebut && { gte: new Date(dateDebut) }),
              ...(dateFin   && { lte: new Date(dateFin + "T23:59:59") }),
            },
          }
        : {}),
    };

    const [collectes, total] = await Promise.all([
      prisma.collecteJournaliere.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateCollecte: "desc" },
        include: {
          agent: { select: { id: true, nom: true, prenom: true } },
          validePar: { select: { id: true, nom: true, prenom: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          _count: { select: { lignes: true } },
        },
      }),
      prisma.collecteJournaliere.count({ where }),
    ]);

    return NextResponse.json({
      data: collectes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/collectes", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/collectes
 * Créer une nouvelle session de collecte (avec ses lignes)
 * Body: { agentId, dateCollecte, pointDeVenteId?, notes?, lignes: [{ clientId, souscriptionId, montantAttendu }] }
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { agentId, dateCollecte, pointDeVenteId, notes, lignes } = body;

    if (!agentId || !dateCollecte || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { message: "agentId, dateCollecte et au moins une ligne sont requis" },
        { status: 400 }
      );
    }

    // Vérifier que les souscriptions existent et ont un restant > 0
    const souscriptionIds: number[] = lignes.map((l: { souscriptionId: number }) => l.souscriptionId);
    const souscriptions = await prisma.souscriptionPack.findMany({
      where: { id: { in: souscriptionIds } },
      select: { id: true, montantRestant: true, statut: true, clientId: true },
    });

    for (const ligne of lignes) {
      const sous = souscriptions.find((s) => s.id === ligne.souscriptionId);
      if (!sous) {
        return NextResponse.json(
          { message: `Souscription ${ligne.souscriptionId} introuvable` },
          { status: 400 }
        );
      }
      if (Number(sous.montantRestant) <= 0 || sous.statut === "COMPLETE" || sous.statut === "ANNULE") {
        return NextResponse.json(
          { message: `Souscription ${ligne.souscriptionId} déjà soldée ou annulée` },
          { status: 400 }
        );
      }
    }

    const montantPrevu = lignes.reduce(
      (sum: number, l: { montantAttendu: number }) => sum + Number(l.montantAttendu),
      0
    );

    // Générer une référence unique
    const date = new Date(dateCollecte);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.collecteJournaliere.count();
    const reference = `COL-${dateStr}-${String(count + 1).padStart(3, "0")}`;

    const collecte = await prisma.collecteJournaliere.create({
      data: {
        reference,
        agentId:        Number(agentId),
        pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
        dateCollecte:   new Date(dateCollecte),
        montantPrevu,
        notes,
        lignes: {
          create: lignes.map((l: {
            clientId: number;
            souscriptionId: number;
            montantAttendu: number;
            notes?: string;
          }) => ({
            clientId:       Number(l.clientId),
            souscriptionId: Number(l.souscriptionId),
            montantAttendu: Number(l.montantAttendu),
            notes:          l.notes ?? null,
          })),
        },
      },
      include: {
        lignes:      true,
        agent:       { select: { id: true, nom: true, prenom: true } },
        pointDeVente:{ select: { id: true, nom: true, code: true } },
      },
    });

    return NextResponse.json({ data: collecte }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/collectes", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { traiterExpirations } from "@/lib/expirationAuto";

/**
 * GET /api/agentTerrain/packs  
 * Souscriptions actives / en attente avec la prochaine échéance à collecter.
 *   ?search=nom&type=ALIMENTAIRE
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Résoudre le PDV de l'agent terrain
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const typePack = searchParams.get("type") ?? "";
    const now = new Date();
    await traiterExpirations();

    // 1) Marquer automatiquement les échéances dépassées
    await prisma.echeancePack.updateMany({
      where: {
        statut: "EN_ATTENTE",
        datePrevue: { lt: now },
        souscription: {  
          client: { pointDeVenteId: pdvId },
        },
      }, 
      data: { statut: "EN_RETARD" },
    });

    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        statut: { in: ["EN_ATTENTE", "ACTIF", "SUSPENDU"] },
        // Filtrer uniquement les clients du PDV de l'agent
        client: { pointDeVenteId: pdvId },
        ...(typePack ? { pack: { type: typePack as never } } : {}),
        ...(search
          ? {
              OR: [   
                { client: { nom: { contains: search, mode: "insensitive" } } },
                { client: { prenom: { contains: search, mode: "insensitive" } } },
                { client: { telephone: { contains: search } } },
              ],
            }
          : {}),
      },
      include: {
        pack: { select: { nom: true, type: true, frequenceVersement: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        user:   { select: { id: true, nom: true, prenom: true, telephone: true } },
        echeances: {
          where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { datePrevue: "asc" },
          take: 1,
        },
        _count: { select: { versements: true } },
      },
      orderBy: [{ statut: "asc" }, { createdAt: "asc" }],
    });

    // Stats
    const totalMontantRestant = souscriptions.reduce(
      (sum, s) => sum + Number(s.montantRestant),
      0
    );
    const enRetard = souscriptions.filter((s) =>
      s.echeances.some((e) => e.statut === "EN_RETARD")
    ).length;
  
    const expirees = await prisma.souscriptionPack.count({
      where: {
        statut: "SUSPENDU",
        montantRestant: { gt: 0 },
        client: { pointDeVenteId: pdvId },
      },
    });

    return NextResponse.json({
      souscriptions,
      stats: {
        total: souscriptions.length,
        totalMontantRestant,
        enRetard,
        expirees,
      },
    });
  } catch (error) {
    console.error("GET /api/agentTerrain/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

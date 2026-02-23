import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET — Liste les échéances avec filtres optionnels.
 *   ?statut=EN_ATTENTE|EN_RETARD|PAYE&search=nom&limit=50
 * Met aussi à jour les échéances EN_ATTENTE dont la date est dépassée → EN_RETARD.
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") ?? "EN_ATTENTE,EN_RETARD";
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    // Marquer les échéances en retard
    await prisma.echeancePack.updateMany({
      where: {
        statut: "EN_ATTENTE",
        datePrevue: { lt: new Date() },
      },
      data: { statut: "EN_RETARD" },
    });

    const statuts = statut.split(",").map((s) => s.trim());

    const echeances = await prisma.echeancePack.findMany({
      where: {
        statut: { in: statuts as never[] },
        ...(search
          ? {
              souscription: {
                OR: [
                  { client: { nom: { contains: search, mode: "insensitive" } } },
                  { client: { prenom: { contains: search, mode: "insensitive" } } },
                  { client: { telephone: { contains: search } } },
                  { user: { nom: { contains: search, mode: "insensitive" } } },
                  { user: { prenom: { contains: search, mode: "insensitive" } } },
                ],
              },
            }
          : {}),
      },
      include: {
        souscription: {
          include: {
            pack: { select: { nom: true, type: true } },
            client: { select: { nom: true, prenom: true, telephone: true } },
            user: { select: { nom: true, prenom: true, telephone: true } },
          },
        },
      },
      orderBy: [{ statut: "desc" }, { datePrevue: "asc" }],
      take: limit,
    });

    // Stats
    const stats = await prisma.echeancePack.groupBy({
      by: ["statut"],
      _count: true,
      _sum: { montant: true },
    });

    return NextResponse.json({ echeances, stats });
  } catch (error) {
    console.error("GET /api/admin/packs/echeances", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

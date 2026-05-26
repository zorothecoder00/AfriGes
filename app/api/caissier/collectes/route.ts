import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

/**
 * GET /api/caissier/collectes
 * Liste des sessions de collecte terrain EN_COURS rattachées au PDV du caissier.
 * Utilisé pour que le caissier valide ou signale une fraude.
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    if (!isAdmin && !pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce caissier" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") || "EN_COURS";

    const collectes = await prisma.collecteJournaliere.findMany({
      where: {
        ...(pdvId ? { pointDeVenteId: pdvId } : {}),
        statut: statut as "EN_COURS" | "VALIDEE" | "ANNULEE",
      },
      orderBy: { dateCollecte: "desc" },
      include: {
        agent: { select: { id: true, nom: true, prenom: true, telephone: true } },
        validePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          select: {
            id: true, statut: true,
            montantAttendu: true, montantCollecte: true,
            client: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    const data = collectes.map((c) => ({
      id:              c.id,
      reference:       c.reference,
      statut:          c.statut,
      dateCollecte:    c.dateCollecte.toISOString(),
      montantPrevu:    Number(c.montantPrevu),
      montantCollecte: Number(c.montantCollecte),
      ecart:           Number(c.montantCollecte) - Number(c.montantPrevu),
      notes:           c.notes,
      dateValidation:  c.dateValidation?.toISOString() ?? null,
      agent:           c.agent,
      validePar:       c.validePar,
      nbLignes:        c.lignes.length,
      nbCollectees:    c.lignes.filter((l) => l.statut === "COLLECTE").length,
      lignes:          c.lignes.map((l) => ({
        id:              l.id,
        statut:          l.statut,
        montantAttendu:  Number(l.montantAttendu),
        montantCollecte: Number(l.montantCollecte),
        client:          l.client,
      })),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/caissier/collectes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * Agrégations serveur par investisseur pour l'onglet gouvernance « agents »
 * (audit & contrôle). Remplace le chargement plafonné de
 * `/api/admin/ria/investisseurs?limit=50` (include imbriqué lourd + agrégation
 * côté client tronquée). On agrège ici sur TOUS les investisseurs ; chaque
 * ligne = un investisseur, donc la liste est naturellement bornée au nombre
 * d'investisseurs.
 */

type Pf = {
  capitalInvesti: unknown;
  capitalEngage: unknown;
  beneficesGeneres: unknown;
  affectations: { actif: boolean; financements: { statut: string }[] }[];
};
type InvRow = {
  id: number;
  member: { nom: string; prenom: string; email: string | null } | null;
  profilRIA: { portefeuilles: Pf[] } | null;
};

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const investisseurs = (await prisma.gestionnaire.findMany({
      where: { OR: [{ role: "INVESTISSEUR_RIA" }, { profilRIA: { isNot: null } }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        member: { select: { nom: true, prenom: true, email: true } },
        profilRIA: {
          select: {
            portefeuilles: {
              where: { actif: true },
              select: {
                capitalInvesti: true,
                capitalEngage: true,
                beneficesGeneres: true,
                affectations: { select: { actif: true, financements: { select: { statut: true } } } },
              },
            },
          },
        },
      },
    })) as unknown as InvRow[];

    const toNum = (v: unknown) => Number(v ?? 0);

    let totalPortefeuilles = 0;
    let totalClientsActifs = 0;

    const rows = investisseurs.map((inv) => {
      const pfs = inv.profilRIA?.portefeuilles ?? [];
      const capitalInvesti = pfs.reduce((s, p) => s + toNum(p.capitalInvesti), 0);
      const capitalEngage  = pfs.reduce((s, p) => s + toNum(p.capitalEngage), 0);
      // rendementMoyen : moyenne des (bénéfices générés / capital investi) par portefeuille.
      const rendementMoyen = pfs.length > 0
        ? pfs.reduce((s, p) => s + (toNum(p.capitalInvesti) > 0 ? (toNum(p.beneficesGeneres) / toNum(p.capitalInvesti)) * 100 : 0), 0) / pfs.length
        : 0;
      const clientsActifs = pfs.reduce((s, p) => s + p.affectations.filter((a) => a.actif).length, 0);
      const retards = pfs.reduce(
        (s, p) => s + p.affectations.reduce((as, a) => as + a.financements.filter((f) => f.statut === "EN_RETARD").length, 0),
        0,
      );

      totalPortefeuilles += pfs.length;
      totalClientsActifs += clientsActifs;

      return {
        id: inv.id,
        nom: inv.member?.nom ?? "",
        prenom: inv.member?.prenom ?? "",
        email: inv.member?.email ?? "",
        nbPortefeuilles: pfs.length,
        capitalInvesti,
        capitalEngage,
        rendementMoyen,
        clientsActifs,
        retards,
      };
    });

    return NextResponse.json({
      data: {
        total: investisseurs.length,
        totalPortefeuilles,
        totalClientsActifs,
        rows,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/gouvernance/investisseurs-stats", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/paie/[id]/historique  (CDC 13.9 — Historique des paies)
 * Retourne, pour une fiche, la trace complète et inaltérable :
 *   - bulletin       : identité fiche + bulletin signé (fichierUrl)
 *   - modifications  : journal d'audit (AuditLog entite=FichePaie), du plus récent au plus ancien
 *   - paiement       : mise en paiement / paiement effectué (dates, mode, acteurs)
 * Conservation illimitée, aucune suppression : lecture seule.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const ficheId = Number(id);

    const fiche = await prisma.fichePaie.findUnique({
      where: { id: ficheId },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
          },
        },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    const modifications = await prisma.auditLog.findMany({
      where:   { entite: "FichePaie", entiteId: ficheId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { nom: true, prenom: true } } },
    });

    // Résolution des acteurs de paiement (User.id stockés en scalaire sur la fiche)
    const actorIds = [fiche.valideParId, fiche.misEnPaiementParId].filter((x): x is number => !!x);
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, nom: true, prenom: true } })
      : [];
    const actorName = (uid: number | null) => {
      if (!uid) return null;
      const u = actors.find((a) => a.id === uid);
      return u ? `${u.prenom} ${u.nom}` : null;
    };

    return NextResponse.json({
      bulletin: {
        id: fiche.id, mois: fiche.mois, annee: fiche.annee,
        statut: fiche.statut, netAPayer: fiche.netAPayer,
        fichierUrl: fiche.fichierUrl, notes: fiche.notes,
        profilRH: fiche.profilRH,
      },
      paiement: {
        statut:             fiche.statut,
        modePaiement:       fiche.modePaiement,
        dateValidation:     fiche.dateValidation,
        valideParNom:       actorName(fiche.valideParId),
        dateMiseEnPaiement: fiche.dateMiseEnPaiement,
        misEnPaiementNom:   actorName(fiche.misEnPaiementParId),
        paye:               fiche.statut === "PAYE",
      },
      modifications: modifications.map((m) => ({
        id:        m.id,
        action:    m.action,
        details:   m.details,
        createdAt: m.createdAt,
        auteur:    m.user ? `${m.user.prenom} ${m.user.nom}` : null,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/[id]/historique", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

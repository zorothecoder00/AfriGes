import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/paie/retenues — État des retenues (agrégat, aucune nouvelle donnée).
 * Regroupe les composants de paie isRetenue=true déjà en base, par type puis par
 * collaborateur, sur la période demandée.
 *   Query: mois?, annee (défaut année courante)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const mois  = searchParams.get("mois");
    const annee = Number(searchParams.get("annee") ?? new Date().getFullYear());

    const fichePaieWhere = {
      annee,
      ...(mois ? { mois: Number(mois) } : {}),
    };

    const composants = await prisma.composantSalaire.findMany({
      where: { isRetenue: true, fichePaie: fichePaieWhere },
      select: {
        type: true, libelle: true, montant: true,
        fichePaie: {
          select: {
            id: true, mois: true, annee: true,
            profilRH: {
              select: {
                id: true, matricule: true, departement: true,
                gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
              },
            },
          },
        },
      },
    });

    const parType = new Map<string, { type: string; libelle: string; total: number; nombre: number }>();
    const parCollaborateur = new Map<number, {
      profilRH: { id: number; matricule: string; departement: string | null; nom: string; prenom: string };
      total: number;
      detail: { type: string; libelle: string; montant: number }[];
    }>();

    let totalRetenues = 0;

    for (const c of composants) {
      const montant = Number(c.montant);
      totalRetenues += montant;

      const t = parType.get(c.type) ?? { type: c.type, libelle: c.libelle, total: 0, nombre: 0 };
      t.total += montant;
      t.nombre += 1;
      parType.set(c.type, t);

      const p = c.fichePaie.profilRH;
      const member = p.gestionnaire.member;
      const existing = parCollaborateur.get(p.id) ?? {
        profilRH: { id: p.id, matricule: p.matricule, departement: p.departement, nom: member.nom, prenom: member.prenom },
        total: 0,
        detail: [],
      };
      existing.total += montant;
      existing.detail.push({ type: c.type, libelle: c.libelle, montant });
      parCollaborateur.set(p.id, existing);
    }

    return NextResponse.json({
      totalRetenues,
      parType: Array.from(parType.values()).sort((a, b) => b.total - a.total),
      parCollaborateur: Array.from(parCollaborateur.values()).sort((a, b) => b.total - a.total),
      periode: { mois: mois ? Number(mois) : null, annee },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/retenues", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHIdsPerimetre } from "@/lib/authRH";
import { TAUX_CNSS_SALARIAL, TAUX_CNSS_PATRONAL, TAUX_CNSS_TOTAL } from "@/lib/paieCotisations";

/**
 * GET /api/responsableRH/paie/cnss-fiscal — État CNSS/fiscal, scopé au périmètre PDV.
 * Même agrégat que /api/admin/rh/paie/cnss-fiscal (cf. ce fichier pour le détail).
 *   Query: mois?, annee (défaut année courante)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const mois  = searchParams.get("mois");
    const annee = Number(searchParams.get("annee") ?? new Date().getFullYear());

    const profilRHIds = await profilRHIdsPerimetre(session);

    const fiches = await prisma.fichePaie.findMany({
      where: {
        annee,
        ...(mois ? { mois: Number(mois) } : {}),
        ...(profilRHIds ? { profilRHId: { in: profilRHIds } } : {}),
      },
      select: {
        id: true, mois: true, annee: true, totalBrut: true,
        profilRH: {
          select: {
            id: true, matricule: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
        composants: {
          where: { type: { in: ["COTISATION_RETRAITE", "IMPOT_REVENU"] }, isRetenue: true },
          select: { type: true, montant: true },
        },
      },
    });

    let totalBrutPeriode = 0;
    let totalSalariale = 0;
    let totalPatronale = 0;
    let totalIrpp = 0;

    const parCollaborateur = fiches.map((f) => {
      const brut      = Number(f.totalBrut);
      const salariale = f.composants.filter((c) => c.type === "COTISATION_RETRAITE").reduce((s, c) => s + Number(c.montant), 0);
      const patronale = Math.round(brut * TAUX_CNSS_PATRONAL);
      const irpp      = f.composants.filter((c) => c.type === "IMPOT_REVENU").reduce((s, c) => s + Number(c.montant), 0);

      totalBrutPeriode += brut;
      totalSalariale   += salariale;
      totalPatronale   += patronale;
      totalIrpp        += irpp;

      const member = f.profilRH.gestionnaire.member;
      return {
        profilRH:  { id: f.profilRH.id, matricule: f.profilRH.matricule, departement: f.profilRH.departement, nom: member.nom, prenom: member.prenom },
        mois: f.mois, annee: f.annee,
        totalBrut: brut,
        cnssSalariale: salariale,
        cnssPatronale: patronale,
        cnssTotal: salariale + patronale,
        irpp,
      };
    }).sort((a, b) => (b.cnssTotal + b.irpp) - (a.cnssTotal + a.irpp));

    return NextResponse.json({
      taux: { salarial: TAUX_CNSS_SALARIAL, patronal: TAUX_CNSS_PATRONAL, total: TAUX_CNSS_TOTAL },
      totalBrutPeriode,
      totalSalariale,
      totalPatronale,
      totalCnss: totalSalariale + totalPatronale,
      totalIrpp,
      parCollaborateur,
      periode: { mois: mois ? Number(mois) : null, annee },
    });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/cnss-fiscal", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

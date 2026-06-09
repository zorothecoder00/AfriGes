import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeConge } from "@prisma/client";

/**
 * GET /api/admin/rh/conges/soldes
 * Soldes de congés par collaborateur pour une année.
 * Query: annee?, profilRHId?, departement?
 *
 * Retourne pour chaque collaborateur ses soldes par type.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const annee      = Number(searchParams.get("annee")      || new Date().getFullYear());
    const profilRHId = searchParams.get("profilRHId");
    const departement = searchParams.get("departement")?.trim();

    // Récupérer les profils
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilWhere: any = { statut: { not: "INACTIF" } };
    if (profilRHId)  profilWhere.id          = Number(profilRHId);
    if (departement) profilWhere.departement  = { contains: departement, mode: "insensitive" };

    const profils = await prisma.profilRH.findMany({
      where: profilWhere,
      select: {
        id: true, matricule: true, fonction: true, departement: true,
        gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        soldesConges: { where: { annee } },
      },
      orderBy: [{ departement: "asc" }, { gestionnaire: { member: { nom: "asc" } } }],
    });

    // Récupérer les politiques pour référence
    const politiques = await prisma.politiqueConge.findMany({ where: { actif: true } });
    const politiquesMap = Object.fromEntries(politiques.map((p) => [p.type, p]));

    // Construire la réponse — pour chaque type, s'assurer qu'un solde existe (même à 0)
    const ALL_TYPES: TypeConge[] = ["ANNUEL", "MALADIE", "EXCEPTIONNEL", "PERMISSION", "FORMATION", "MATERNITE", "PATERNITE", "SANS_SOLDE"];

    const data = profils.map((p) => {
      const soldesMap = Object.fromEntries(p.soldesConges.map((s) => [s.type, s]));
      const soldes = ALL_TYPES.map((type) => {
        const solde    = soldesMap[type];
        const politique = politiquesMap[type];
        return {
          type,
          totalDroit: solde?.totalDroit ?? politique?.joursParAn ?? 0,
          pris:       solde?.pris       ?? 0,
          reporte:    solde?.reporte    ?? 0,
          restant:    solde?.restant    ?? (solde ? solde.totalDroit + solde.reporte - solde.pris : (politique?.joursParAn ?? 0)),
          hasSolde:   !!solde,
        };
      });

      return {
        profilRH: {
          id:          p.id,
          matricule:   p.matricule,
          fonction:    p.fonction,
          departement: p.departement,
          nom:         p.gestionnaire.member.nom,
          prenom:      p.gestionnaire.member.prenom,
        },
        soldes,
        annee,
      };
    });

    return NextResponse.json({ data, annee });
  } catch (error) {
    console.error("GET /api/admin/rh/conges/soldes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/conges/soldes
 * Initialiser ou ajuster manuellement le solde d'un collaborateur.
 * Body: { profilRHId, type, annee, totalDroit?, reporte?, note? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, annee, totalDroit, reporte } = body;

    if (!profilRHId || !type || !annee) {
      return NextResponse.json({ error: "profilRHId, type et annee sont requis" }, { status: 400 });
    }

    // Récupérer le solde existant pour conserver les jours pris
    const existing = await prisma.soldeConge.findUnique({
      where: { profilRHId_type_annee: { profilRHId: Number(profilRHId), type: type as TypeConge, annee: Number(annee) } },
    });

    const newTotalDroit = totalDroit !== undefined ? Number(totalDroit) : (existing?.totalDroit ?? 0);
    const newReporte    = reporte    !== undefined ? Number(reporte)    : (existing?.reporte    ?? 0);
    const pris          = existing?.pris ?? 0;
    const restant       = newTotalDroit + newReporte - pris;

    const solde = await prisma.soldeConge.upsert({
      where: { profilRHId_type_annee: { profilRHId: Number(profilRHId), type: type as TypeConge, annee: Number(annee) } },
      create: {
        profilRHId: Number(profilRHId),
        type:       type as TypeConge,
        annee:      Number(annee),
        totalDroit: newTotalDroit,
        pris,
        reporte:    newReporte,
        restant,
      },
      update: {
        totalDroit: newTotalDroit,
        reporte:    newReporte,
        restant,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "SoldeConge",
        entiteId: solde.id,
        details:  `Solde ${type} ${annee} profilRH#${profilRHId} : droit=${newTotalDroit}, reporté=${newReporte}`,
      },
    });

    return NextResponse.json({ data: solde }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/conges/soldes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFichePaie } from "@prisma/client";
import { appliquerRetenuesAuto } from "@/lib/paieRetenues";

/**
 * GET /api/admin/rh/paie
 * Liste les fiches de paie
 * Query: profilRHId, mois, annee, statut, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const mois       = searchParams.get("mois");
    const annee      = searchParams.get("annee");
    const statut     = searchParams.get("statut") as StatutFichePaie | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (mois)   where.mois   = Number(mois);
    if (annee)  where.annee  = Number(annee);
    if (statut) where.statut = statut;
    if (search) {
      where.profilRH = {
        gestionnaire: {
          member: {
            OR: [
              { nom:    { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [fiches, total, stats] = await Promise.all([
      prisma.fichePaie.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ annee: "desc" }, { mois: "desc" }],
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
          composants: true,
        },
      }),
      prisma.fichePaie.count({ where }),
      prisma.fichePaie.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({
      data: fiches,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/paie
 * Crée une fiche de paie avec ses composants
 * Body: { profilRHId, mois, annee, salaireBase, composants: [{type, libelle, montant, isRetenue}], notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, mois, annee, salaireBase, composants = [], notes } = body;
    // Retenues automatiques (prêts + avances) activées par défaut (CDC 13.5/13.6).
    const autoRetenues = body.autoRetenues !== false;

    if (!profilRHId || !mois || !annee) {
      return NextResponse.json({ error: "profilRHId, mois et annee sont obligatoires" }, { status: 400 });
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Anti double prélèvement : une seule fiche par (collaborateur, mois, année).
    const dejaCree = await prisma.fichePaie.findUnique({
      where: { profilRHId_mois_annee: { profilRHId: Number(profilRHId), mois: Number(mois), annee: Number(annee) } },
      select: { id: true },
    });
    if (dejaCree) {
      return NextResponse.json({ error: "Une fiche de paie existe déjà pour ce collaborateur sur cette période." }, { status: 409 });
    }

    // Totaux des composants saisis manuellement.
    const brutManuel        = composants.filter((c: { isRetenue: boolean; montant: number }) => !c.isRetenue).reduce((s: number, c: { montant: number }) => s + Number(c.montant), Number(salaireBase ?? 0));
    const retenuesManuelles = composants.filter((c: { isRetenue: boolean; montant: number }) =>  c.isRetenue).reduce((s: number, c: { montant: number }) => s + Number(c.montant), 0);

    const fiche = await prisma.$transaction(async (tx) => {
      // Injection des retenues automatiques (décrémente les soldes prêts/avances).
      const autoComposants = autoRetenues ? await appliquerRetenuesAuto(tx, Number(profilRHId)) : [];
      const retenuesAuto    = autoComposants.reduce((s, c) => s + c.montant, 0);

      const totalBrut     = brutManuel;
      const totalRetenues = retenuesManuelles + retenuesAuto;
      const netAPayer     = totalBrut - totalRetenues;

      const f = await tx.fichePaie.create({
        data: {
          profilRHId:    Number(profilRHId),
          mois:          Number(mois),
          annee:         Number(annee),
          salaireBase:   Number(salaireBase ?? 0),
          totalBrut,
          totalRetenues,
          netAPayer,
          notes:         notes ?? null,
          genereParId:   parseInt(session.user.id),
          statut:        "BROUILLON",
          composants: {
            create: [
              ...composants.map((c: { type: string; libelle: string; montant: number; isRetenue: boolean }) => ({
                type:      c.type,
                libelle:   c.libelle,
                montant:   Number(c.montant),
                isRetenue: c.isRetenue ?? false,
              })),
              ...autoComposants.map((c) => ({
                type:      c.type,
                libelle:   c.libelle,
                montant:   c.montant,
                isRetenue: true,
                ordre:     c.ordre,
              })),
            ],
          },
        },
        include: { composants: true },
      });
      return f;
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "FichePaie",
        entiteId: fiche.id,
        details:  `Fiche paie ${mois}/${annee} créée pour profilRH #${profilRHId}`,
      },
    });

    return NextResponse.json({ data: fiche }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/paie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

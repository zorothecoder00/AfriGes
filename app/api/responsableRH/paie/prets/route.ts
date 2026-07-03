import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { getRHScope, profilDansPerimetre } from "@/lib/scopeRH";

/**
 * GET  /api/responsableRH/paie/prets
 *   Query: profilRHId?, statut?, page?, limit?
 *   Scopé au PDV du RESPONSABLE_RH (admin = tout).
 *
 * POST /api/responsableRH/paie/prets
 *   Body: { profilRHId, montant, tauxInteret?, dureesMois, notes? }
 *   Calcule montantMensuel = (montant * (1 + taux/100)) / dureesMois — collaborateur du PDV uniquement.
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const scope = await getRHScope(session);

    const { searchParams } = req.nextUrl;
    const profilRHId = searchParams.get("profilRHId");
    const statut     = searchParams.get("statut") ?? undefined;
    const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit      = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (scope.profilRHIds !== null) where.profilRHId = { in: scope.profilRHIds };
    if (profilRHId) {
      const asked = Number(profilRHId);
      if (!profilDansPerimetre(scope, asked)) {
        return NextResponse.json({ error: "Collaborateur hors de votre périmètre" }, { status: 403 });
      }
      where.profilRHId = asked;
    }
    if (statut) where.statut = statut;

    const [prets, total] = await Promise.all([
      prisma.pretEmploye.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.pretEmploye.count({ where }),
    ]);

    return NextResponse.json({
      data: prets,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/prets", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const scope = await getRHScope(session);
    const { profilRHId, montant, tauxInteret, dureesMois, notes } = await req.json();

    if (!profilRHId || !montant || !dureesMois) {
      return NextResponse.json({ error: "profilRHId, montant et dureesMois sont obligatoires" }, { status: 400 });
    }

    if (!profilDansPerimetre(scope, Number(profilRHId))) {
      return NextResponse.json({ error: "Collaborateur hors de votre périmètre" }, { status: 403 });
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const taux       = Number(tauxInteret ?? 0);
    const capital    = Number(montant);
    const duree      = Number(dureesMois);
    const totalDu    = capital * (1 + taux / 100);
    const mensualite = Math.ceil(totalDu / duree);

    const pret = await prisma.pretEmploye.create({
      data: {
        profilRHId:     Number(profilRHId),
        montant:        capital,
        tauxInteret:    taux,
        dureesMois:     duree,
        montantMensuel: mensualite,
        montantRestant: totalDu,
        notes:          notes ?? null,
        statut:         "EN_COURS",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "PretEmploye",
        entiteId: pret.id,
        details:  { apres: { montant: pret.montant, dureesMois: pret.dureesMois, profilRHId: pret.profilRHId } },
      },
    });

    return NextResponse.json({ data: pret }, { status: 201 });
  } catch (error) {
    console.error("POST /api/responsableRH/paie/prets", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

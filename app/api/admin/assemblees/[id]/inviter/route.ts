import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — Invite tous les actionnaires actifs à l'assemblée.
 * Peut aussi recevoir un tableau `gestionnaireIds` pour inviter des personnes spécifiques.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);

    const assemblee = await prisma.assemblee.findUnique({ where: { id: assembleeId } });
    if (!assemblee) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const specificIds: number[] | undefined = body.gestionnaireIds;

    let gestionnaireIds: number[];

    if (specificIds && specificIds.length > 0) {
      gestionnaireIds = specificIds;
    } else {
      // Inviter tous les actionnaires actifs
      const actionnaires = await prisma.gestionnaire.findMany({
        where: { role: "ACTIONNAIRE", actif: true },
        select: { id: true },
      });
      gestionnaireIds = actionnaires.map((g) => g.id);
    }

    if (gestionnaireIds.length === 0) {
      return NextResponse.json({ message: "Aucun actionnaire à inviter", count: 0 });
    }

    // Upsert pour ne pas créer de doublons
    const created = await prisma.$transaction(
      gestionnaireIds.map((gestionnaireId) =>
        prisma.assembleeParticipant.upsert({
          where: { assembleeId_gestionnaireId: { assembleeId, gestionnaireId } },
          update: {},
          create: { assembleeId, gestionnaireId, statut: "INVITE" },
        })
      )
    );

    // Notifier les actionnaires invités
    const userId = parseInt(session.user.id);
    const gestionnaireUsers = await prisma.gestionnaire.findMany({
      where: { id: { in: gestionnaireIds } },
      select: { memberId: true },
    });

    await prisma.notification.createMany({
      data: gestionnaireUsers.map((g) => ({
        userId: g.memberId,
        titre: `Convocation — ${assemblee.titre}`,
        message: `Vous êtes convoqué(e) à l'assemblée "${assemblee.titre}" le ${new Date(assemblee.dateAssemblee).toLocaleDateString("fr-FR")} à ${assemblee.lieu}.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/user/actionnaires",
      })),
      skipDuplicates: true,
    });

    void userId; // utilisé implicitement via session

    return NextResponse.json({ message: `${created.length} actionnaire(s) invité(s)`, count: created.length });
  } catch (error) {
    console.error("POST /api/admin/assemblees/[id]/inviter", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — libellé et statut actif/inactif (jamais de suppression physique, cf. plan comptable). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { libelle, actif } = body;

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.sectionAnalytique.update({
        where: { id: Number(id) },
        data: {
          ...(libelle !== undefined && { libelle }),
          ...(actif !== undefined && { actif: Boolean(actif) }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_SECTION_ANALYTIQUE", "SectionAnalytique", u.id, { libelle, actif }, meta);
      return u;
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

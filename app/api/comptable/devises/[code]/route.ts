import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ code: string }> };

/** PATCH — taux (avec horodatage automatique), nom, symbole, statut actif/inactif. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { code } = await params;
    const body = await req.json();
    const { nom, symbole, tauxVersFonctionnelle, actif } = body;

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.devise.update({
        where: { code },
        data: {
          ...(nom !== undefined && { nom }),
          ...(symbole !== undefined && { symbole }),
          ...(tauxVersFonctionnelle !== undefined && { tauxVersFonctionnelle, dateTauxMaj: new Date() }),
          ...(actif !== undefined && { actif: Boolean(actif) }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_DEVISE", "Devise", undefined, { code: u.code, tauxVersFonctionnelle, actif }, meta);
      return u;
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

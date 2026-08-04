import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — { statut: "ACTIF"|"SUSPENDU" } : suspendre/reprendre (jamais de suppression). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { statut } = body;
    if (!["ACTIF", "SUSPENDU"].includes(statut)) {
      return NextResponse.json({ error: "statut doit être ACTIF ou SUSPENDU" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.ecritureRecurrente.update({ where: { id: Number(id) }, data: { statut } });
      await auditLog(tx, userId, statut === "SUSPENDU" ? "SUSPENSION_ECRITURE_RECURRENTE" : "REPRISE_ECRITURE_RECURRENTE", "EcritureRecurrente", u.id, { statut }, meta);
      return u;
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

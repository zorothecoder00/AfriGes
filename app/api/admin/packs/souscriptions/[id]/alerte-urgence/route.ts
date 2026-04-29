import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog, notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscriptionId = Number.parseInt(id, 10);
    if (!souscriptionId) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const motif = typeof body?.motif === "string" && body.motif.trim().length > 0
      ? body.motif.trim()
      : "Collecte / encaissement urgent requis";

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      select: {
        id: true,
        statut: true,
        dateFin: true,
        pack: { select: { nom: true } },
      },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    const adminId = Number.parseInt(session.user.id, 10);
    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim() || "Admin";

    await prisma.$transaction(async (tx) => {
      const cibles = await tx.user.findMany({
        where: {
          gestionnaire: {
            is: {
              role: {
                in: ["CAISSIER", "COMPTABLE", "AGENT_TERRAIN"],
              },
              actif: true,
            },
          },
          etat: "ACTIF",
        },
        select: { id: true },
      });

      await notifyAdmins(tx, {
        titre: `Alerte urgence souscription — #${souscription.id}`,
        message: `${adminNom} signale une urgence opérationnelle sur la souscription #${souscription.id} (${souscription.pack.nom}) en statut ${souscription.statut}. Motif: ${motif}.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/packs",
      });

      if (cibles.length > 0) {
        await tx.notification.createMany({
          data: cibles.map((u) => ({
            userId: u.id,
            titre: `Urgence souscription #${souscription.id}`,
            message: `Demande admin: ${motif}. Vérifiez la souscription #${souscription.id} (${souscription.pack.nom}) et attendez changement de statut si blocage.`,
            priorite: "HAUTE",
            actionUrl: "/dashboard/admin/packs",
          })),
        });
      }

      await auditLog(tx, adminId, "SOUSCRIPTION_PACK_ALERTE_URGENCE", "SouscriptionPack", souscription.id);
    });

    return NextResponse.json({ ok: true, souscriptionId, statut: souscription.statut, motif });
  } catch (error) {
    console.error("POST /api/admin/packs/souscriptions/[id]/alerte-urgence", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
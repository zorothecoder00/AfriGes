import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { statsAchatsRevendeur } from "@/lib/revendeur";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/revendeurs/[id] — profil + "État des achats" (§5.6). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const stats = await statsAchatsRevendeur(profil.userId);
    return NextResponse.json({ data: profil, stats });
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/revendeurs/[id]
 * Body: { action: "SUSPENDRE" | "REACTIVER" | "RESILIER" }
 *   ou : champs du profil à mettre à jour (raisonSociale, nif, rccm, adresse,
 *        ville, contactNom, contactTelephone, contactEmail, pointDeVenteId,
 *        conditionsParticulieres)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profilId = Number(id);
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: profilId } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    if (body.action) {
      const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
        SUSPENDRE: { from: ["ACTIF"], to: "SUSPENDU" },
        REACTIVER: { from: ["SUSPENDU"], to: "ACTIF" },
        RESILIER: { from: ["ACTIF", "SUSPENDU"], to: "RESILIE" },
      };
      const t = TRANSITIONS[body.action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(profil.statut)) {
        return NextResponse.json({ error: `Impossible depuis le statut ${profil.statut}` }, { status: 422 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const p = await tx.profilRevendeur.update({ where: { id: profilId }, data: { statut: t.to as never }, include: INCLUDE });
        await auditLog(tx, userId, `REVENDEUR_${body.action}`, "ProfilRevendeur", profilId, { avant: profil.statut, apres: t.to }, getRequestMeta(req));
        return p;
      });
      return NextResponse.json({ data: updated });
    }

    const editable = ["raisonSociale", "nomCommercial", "nif", "rccm", "adresse", "ville", "contactNom", "contactTelephone", "contactEmail", "conditionsParticulieres"] as const;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const f of editable) if (f in body) data[f] = body[f] || null;
    if ("pointDeVenteId" in body) data.pointDeVenteId = body.pointDeVenteId ? Number(body.pointDeVenteId) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.profilRevendeur.update({ where: { id: profilId }, data, include: INCLUDE });
      await auditLog(tx, userId, "REVENDEUR_PROFIL_MODIFIE", "ProfilRevendeur", profilId, undefined, getRequestMeta(req));
      return p;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /admin/revendeurs/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

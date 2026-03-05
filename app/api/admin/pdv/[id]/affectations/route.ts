import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog, notifyRoles } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/pdv/[id]/affectations
 * Liste des affectations actives (gestionnaires assignés à ce PDV).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pdvId = Number(id);
    if (isNaN(pdvId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const affectations = await prisma.gestionnaireAffectation.findMany({
      where: { pointDeVenteId: pdvId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
            email: true,
            gestionnaire: { select: { role: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: affectations });
  } catch (error) {
    console.error("GET /admin/pdv/[id]/affectations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/pdv/[id]/affectations
 * Affecter un gestionnaire (userId) à ce PDV.
 * Body: { userId }
 * - Désactive toute affectation active existante du même userId sur d'autres PDVs.
 * - Crée (ou réactive) l'affectation sur ce PDV.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pdvId = Number(id);
    if (isNaN(pdvId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId est obligatoire" }, { status: 400 });

    // Vérifier que le PDV existe
    const pdv = await prisma.pointDeVente.findUnique({
      where: { id: pdvId },
      select: { id: true, nom: true, actif: true },
    });
    if (!pdv) return NextResponse.json({ error: "PDV introuvable" }, { status: 404 });
    if (!pdv.actif) return NextResponse.json({ error: "Ce PDV est désactivé" }, { status: 400 });

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, nom: true, prenom: true, gestionnaire: { select: { role: true } } },
    });
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    if (!user.gestionnaire) return NextResponse.json({ error: "Cet utilisateur n'est pas un gestionnaire" }, { status: 400 });

    const affectation = await prisma.$transaction(async (tx) => {
      // Désactiver toutes les affectations actives de cet utilisateur sur d'autres PDVs
      await tx.gestionnaireAffectation.updateMany({
        where: { userId: Number(userId), actif: true, pointDeVenteId: { not: pdvId } },
        data:  { actif: false },
      });

      // Upsert : réactiver si déjà affecté à ce PDV, sinon créer
      const existing = await tx.gestionnaireAffectation.findFirst({
        where: { userId: Number(userId), pointDeVenteId: pdvId },
      });

      let aff;
      if (existing) {
        aff = await tx.gestionnaireAffectation.update({
          where: { id: existing.id },
          data:  { actif: true },
        });
      } else {
        aff = await tx.gestionnaireAffectation.create({
          data: { userId: Number(userId), pointDeVenteId: pdvId, actif: true },
        });
      }

      await auditLog(tx, parseInt(session.user.id), "GESTIONNAIRE_AFFECTE_PDV", "GestionnaireAffectation", aff.id);

      await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Nouvelle affectation PDV`,
        message:  `${user.prenom} ${user.nom} (${user.gestionnaire?.role}) a été affecté au point de vente "${pdv.nom}".`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/admin/pdv/${pdvId}`,
      });

      return aff;
    });

    return NextResponse.json({ data: affectation }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/pdv/[id]/affectations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/pdv/[id]/affectations
 * Désaffecter un gestionnaire de ce PDV.
 * Body: { userId }
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pdvId = Number(id);
    if (isNaN(pdvId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId est obligatoire" }, { status: 400 });

    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: Number(userId), pointDeVenteId: pdvId, actif: true },
    });
    if (!affectation) {
      return NextResponse.json({ error: "Aucune affectation active trouvée" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.gestionnaireAffectation.update({
        where: { id: affectation.id },
        data:  { actif: false },
      });
      await auditLog(tx, parseInt(session.user.id), "GESTIONNAIRE_DESAFFECTE_PDV", "GestionnaireAffectation", affectation.id);
    });

    return NextResponse.json({ message: "Affectation désactivée" });
  } catch (error) {
    console.error("DELETE /admin/pdv/[id]/affectations:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
  
type Ctx = { params: Promise<{ id: string }> };

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/pdv/[id]
 * Détail d'un PDV avec son stock, équipe et statistiques.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const pdv = await prisma.pointDeVente.findUnique({
      where: { id: Number(id) },
      include: {
        rpv:        { select: { id: true, nom: true, prenom: true, telephone: true } },
        chefAgence: { select: { id: true, nom: true, prenom: true } },
        affectations: {
          where: { actif: true },
          include: { user: { select: { id: true, nom: true, prenom: true, gestionnaire: { select: { role: true } } } } },
        },
        stocks: {
          include: { produit: { select: { id: true, nom: true, reference: true, prixUnitaire: true } } },
        },
        _count: {
          select: { ventesDirectes: true, inventaires: true, bonsSortie: true },
        },
      },
    });

    if (!pdv) return NextResponse.json({ error: "PDV introuvable" }, { status: 404 });

    // Valeur totale du stock sur ce PDV
    const valeurStock = pdv.stocks.reduce(
      (acc, s) => acc + s.quantite * Number(s.produit.prixUnitaire),
      0
    );

    return NextResponse.json({ data: { ...pdv, valeurStock } });
  } catch (error) {
    console.error("GET /admin/pdv/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/pdv/[id]
 * Modifier un PDV (nom, adresse, rpvId, chefAgenceId, actif...).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const body = await req.json();
    const { nom, adresse, telephone, notes, rpvId, chefAgenceId, actif } = body;

    const existing = await prisma.pointDeVente.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "PDV introuvable" }, { status: 404 });

    // Si changement de RPV, vérifier qu'il n'est pas pris
    if (rpvId !== undefined && rpvId !== null && rpvId !== existing.rpvId) {
      const dejaPDV = await prisma.pointDeVente.findFirst({
        where: { rpvId: Number(rpvId), id: { not: Number(id) } },
      });
      if (dejaPDV) {
        return NextResponse.json({ error: "Ce RPV est déjà responsable d'un autre PDV" }, { status: 409 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.pointDeVente.update({
        where: { id: Number(id) },
        data: {
          ...(nom          !== undefined && { nom }),
          ...(adresse      !== undefined && { adresse }),
          ...(telephone    !== undefined && { telephone }),
          ...(notes        !== undefined && { notes }),
          ...(actif        !== undefined && { actif }),
          ...(rpvId        !== undefined && { rpvId: rpvId ? Number(rpvId) : null }),
          ...(chefAgenceId !== undefined && { chefAgenceId: chefAgenceId ? Number(chefAgenceId) : null }),
        },
        include: {
          rpv:        { select: { id: true, nom: true, prenom: true } },
          chefAgence: { select: { id: true, nom: true, prenom: true } },
        },
      });

      // ── Synchroniser GestionnaireAffectation ─────────────────────────────────

      // RPV : si changement, créer/réactiver l'affectation du nouveau RPV
      if (rpvId !== undefined) {
        if (rpvId) {
          // Désactiver d'éventuelles affectations actives du nouveau RPV ailleurs
          await tx.gestionnaireAffectation.updateMany({
            where: { userId: Number(rpvId), actif: true, pointDeVenteId: { not: Number(id) } },
            data:  { actif: false },
          });
          const existingAff = await tx.gestionnaireAffectation.findFirst({
            where: { userId: Number(rpvId), pointDeVenteId: Number(id) },
          });
          if (existingAff) {
            await tx.gestionnaireAffectation.update({ where: { id: existingAff.id }, data: { actif: true } });
          } else {
            await tx.gestionnaireAffectation.create({
              data: { userId: Number(rpvId), pointDeVenteId: Number(id), actif: true },
            });
          }
        } else if (existing.rpvId) {
          // RPV retiré : désactiver son affectation si elle pointait sur ce PDV
          await tx.gestionnaireAffectation.updateMany({
            where: { userId: existing.rpvId, pointDeVenteId: Number(id), actif: true },
            data:  { actif: false },
          });
        }
      }

      // Chef d'agence : zone multi-PDV — on n'écrase PAS les autres affectations
      if (chefAgenceId !== undefined) {
        if (chefAgenceId) {
          // Upsert de l'affectation pour CE PDV uniquement (pas de désactivation des autres)
          const existingAff = await tx.gestionnaireAffectation.findFirst({
            where: { userId: Number(chefAgenceId), pointDeVenteId: Number(id) },
          });
          if (existingAff) {
            await tx.gestionnaireAffectation.update({ where: { id: existingAff.id }, data: { actif: true } });
          } else {
            await tx.gestionnaireAffectation.create({
              data: { userId: Number(chefAgenceId), pointDeVenteId: Number(id), actif: true },
            });
          }
        } else if (existing.chefAgenceId) {
          // Retrait du chef d'agence de CE PDV uniquement
          await tx.gestionnaireAffectation.updateMany({
            where: { userId: existing.chefAgenceId, pointDeVenteId: Number(id), actif: true },
            data:  { actif: false },
          });
        }
      }

      await auditLog(tx, parseInt(session.user.id), "PDV_MODIFIE", "PointDeVente", p.id);
      return p;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /admin/pdv/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/pdv/[id]
 * Désactiver un PDV (soft delete — actif = false).
 * Un PDV avec du stock ne peut pas être supprimé.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const stockNonVide = await prisma.stockSite.findFirst({
      where: { pointDeVenteId: Number(id), quantite: { gt: 0 } },
    });
    if (stockNonVide) {
      return NextResponse.json(
        { error: "Impossible de supprimer un PDV avec du stock. Transférez d'abord le stock." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.pointDeVente.update({ where: { id: Number(id) }, data: { actif: false } });
      await auditLog(tx, parseInt(session.user.id), "PDV_DESACTIVE", "PointDeVente", Number(id));
    });

    return NextResponse.json({ message: "PDV désactivé avec succès" });
  } catch (error) {
    console.error("DELETE /admin/pdv/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

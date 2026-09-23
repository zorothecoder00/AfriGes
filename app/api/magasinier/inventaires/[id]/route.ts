import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRPVSession } from "@/lib/authRPV";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { chargerDetailInventaire, getOwnPDV } from "@/lib/inventaireServer";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  return (await getMagasinierSession()) ?? (await getRPVSession());
}

function isAdminRole(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * GET /api/magasinier/inventaires/[id]
 * Détail d'un inventaire avec ses lignes (limité au PDV de l'utilisateur).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    const inv = await chargerDetailInventaire(Number(id));
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });

    if (!isAdminRole(session.user.role)) {
      const pdvId = await getOwnPDV(parseInt(session.user.id));
      if (pdvId !== inv.pointDeVenteId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json({ data: inv });
  } catch (error) {
    console.error("GET /magasinier/inventaires/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/inventaires/[id]
 * Comptage et soumission — la validation (application des écarts au stock) est
 * réservée à l'admin (PATCH /api/admin/stock/inventaires/[id]).
 *
 * - sans action : body.lignes = [{ ligneId, quantiteConstatee }] → mise à jour des écarts
 * - action "SOUMETTRE" : EN_COURS → SOUMIS, notifie les admins pour validation
 * - action "ANNULER"   : EN_COURS/SOUMIS → ANNULE
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const userId = parseInt(session.user.id);

    const body = await req.json();
    const { action, lignes, notes } = body;

    const inv = await prisma.inventaireSite.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: { select: { id: true, quantiteSysteme: true, quantiteConstatee: true, ecart: true } },
        pointDeVente: { select: { nom: true } },
      },
    });
    if (!inv) return NextResponse.json({ error: "Inventaire introuvable" }, { status: 404 });

    if (!isAdminRole(session.user.role)) {
      const pdvId = await getOwnPDV(userId);
      if (pdvId !== inv.pointDeVenteId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // ─ ANNULER ───────────────────────────────────────────────
    if (action === "ANNULER") {
      if (inv.statut !== "EN_COURS" && inv.statut !== "SOUMIS") {
        return NextResponse.json({ error: "Seul un inventaire en cours ou soumis peut être annulé" }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.inventaireSite.update({
          where: { id: Number(id) },
          data: { statut: "ANNULE", notes: notes || inv.notes },
        });
        await auditLog(tx, userId, "INVENTAIRE_ANNULE", "InventaireSite", u.id);
        return u;
      });
      return NextResponse.json({ data: updated });
    }

    if (inv.statut !== "EN_COURS") {
      const msg = inv.statut === "SOUMIS"
        ? "Inventaire soumis : en attente de validation par l'administrateur"
        : "Cet inventaire n'est plus modifiable";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // ─ Mise à jour des quantités constatées ─────────────────
    if (!action && Array.isArray(lignes)) {
      const parId = new Map(inv.lignes.map(l => [l.id, l]));
      const saisies = (lignes as Array<{ ligneId: number; quantiteConstatee: number }>)
        .map(l => ({ ligne: parId.get(Number(l.ligneId)), qte: Number(l.quantiteConstatee) }))
        .filter((x): x is { ligne: NonNullable<typeof x.ligne>; qte: number } => !!x.ligne);

      if (saisies.some(s => !Number.isInteger(s.qte) || s.qte < 0)) {
        return NextResponse.json({ error: "Les quantités constatées doivent être des entiers positifs" }, { status: 400 });
      }

      await prisma.$transaction(
        saisies.map(({ ligne, qte }) =>
          prisma.ligneInventaireSite.update({
            where: { id: ligne.id },
            data: { quantiteConstatee: qte, ecart: qte - ligne.quantiteSysteme },
          }),
        ),
      );
      if (notes !== undefined) {
        await prisma.inventaireSite.update({ where: { id: Number(id) }, data: { notes: notes || null } });
      }
      return NextResponse.json({ data: await chargerDetailInventaire(Number(id)) });
    }

    // ─ SOUMETTRE (à la validation admin) ─────────────────────
    if (action === "SOUMETTRE") {
      const nbEcarts = inv.lignes.filter(l => l.ecart !== 0).length;
      const result = await prisma.$transaction(async (tx) => {
        const u = await tx.inventaireSite.update({
          where: { id: Number(id) },
          data: { statut: "SOUMIS", dateSoumission: new Date(), notes: notes || inv.notes },
        });
        await auditLog(tx, userId, "INVENTAIRE_SOUMIS", "InventaireSite", u.id);
        await notifyAdmins(tx, {
          titre:     `Inventaire à valider : ${inv.reference}`,
          message:   `${session.user.prenom} ${session.user.nom} a soumis l'inventaire de "${inv.pointDeVente.nom}" (${inv.lignes.length} produit(s), ${nbEcarts} écart(s)).`,
          priorite:  nbEcarts > 0 ? "HAUTE" : "NORMAL",
          actionUrl: `/dashboard/admin/stock/inventaires?detail=${u.id}`,
        });
        return u;
      });
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /magasinier/inventaires/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

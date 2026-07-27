import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "../../fournisseurs/route";
import { notify, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
  demandeur: { select: { id: true, nom: true, prenom: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true, unite: true } } } },
};

/**
 * GET /api/logistique/commandes-internes/[id]
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const commande = await prisma.commandeInterne.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!commande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    return NextResponse.json({ data: commande });
  } catch (error) {
    console.error("GET /logistique/commandes-internes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/commandes-internes/[id]
 * Body: { action: "VALIDER" | "REJETER" | "CLOTURER", lignes?: [{ id, quantiteValidee }], notes? }
 *
 * VALIDER  : SOUMISE → EN_COURS, fixe quantiteValidee par ligne (0 = produit refusé).
 * REJETER  : SOUMISE/EN_COURS → ANNULE.
 * CLOTURER : EN_COURS → COMPLETE (une fois le besoin couvert par ailleurs — RFQ/PO/réception).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const commandeId = Number(id);
    const existing = await prisma.commandeInterne.findUnique({
      where: { id: commandeId },
      include: { lignes: true, pointDeVente: { select: { nom: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    if (body.action === "VALIDER") {
      if (existing.statut !== "SOUMISE") {
        return NextResponse.json({ error: "Seule une demande soumise peut être validée" }, { status: 422 });
      }
      const overrides = new Map<number, number>(
        (body.lignes as Array<{ id: number; quantiteValidee: number }> | undefined ?? [])
          .map((l) => [Number(l.id), Number(l.quantiteValidee)])
      );

      const updated = await prisma.$transaction(async (tx) => {
        for (const ligne of existing.lignes) {
          await tx.ligneCommandeInterne.update({
            where: { id: ligne.id },
            data: { quantiteValidee: overrides.get(ligne.id) ?? ligne.quantiteDemandee },
          });
        }
        const c = await tx.commandeInterne.update({ where: { id: commandeId }, data: { statut: "EN_COURS" }, include: INCLUDE });
        await auditLog(tx, userId, "COMMANDE_INTERNE_VALIDEE", "CommandeInterne", commandeId);
        await notify(tx, [existing.demandeurId], {
          titre: `Demande validée : ${existing.reference}`,
          message: `Votre demande de réapprovisionnement pour "${existing.pointDeVente.nom}" a été validée et est prise en charge.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/user", // le demandeur peut être RPV ou magasinier — le proxy redirige vers son propre dashboard
        });
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "REJETER") {
      if (!["SOUMISE", "EN_COURS"].includes(existing.statut)) {
        return NextResponse.json({ error: "Cette demande ne peut plus être rejetée" }, { status: 422 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeInterne.update({
          where: { id: commandeId },
          data: { statut: "ANNULE", notes: body.notes ? `${existing.notes ? existing.notes + " — " : ""}Rejet : ${body.notes}` : existing.notes },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "COMMANDE_INTERNE_REJETEE", "CommandeInterne", commandeId, { motif: body.notes ?? null });
        await notify(tx, [existing.demandeurId], {
          titre: `Demande rejetée : ${existing.reference}`,
          message: `Votre demande de réapprovisionnement pour "${existing.pointDeVente.nom}" a été rejetée${body.notes ? ` : ${body.notes}` : "."}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: "/dashboard/user", // le demandeur peut être RPV ou magasinier — le proxy redirige vers son propre dashboard
        });
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "CLOTURER") {
      if (existing.statut !== "EN_COURS") {
        return NextResponse.json({ error: "Seule une demande en cours peut être clôturée" }, { status: 422 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeInterne.update({ where: { id: commandeId }, data: { statut: "COMPLETE" }, include: INCLUDE });
        await auditLog(tx, userId, "COMMANDE_INTERNE_CLOTUREE", "CommandeInterne", commandeId);
        await notify(tx, [existing.demandeurId], {
          titre: `Demande satisfaite : ${existing.reference}`,
          message: `Votre demande de réapprovisionnement pour "${existing.pointDeVente.nom}" a été traitée.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/user", // le demandeur peut être RPV ou magasinier — le proxy redirige vers son propre dashboard
        });
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /logistique/commandes-internes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

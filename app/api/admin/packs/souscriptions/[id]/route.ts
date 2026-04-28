import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog, notifyAdmins } from "@/lib/notifications";
import { FormuleRevendeur, FrequenceVersement, StatutSouscription } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

function parseId(rawId: string) {
  const id = Number.parseInt(rawId, 10);
  return Number.isNaN(id) ? null : id;
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscriptionId = parseId(id);
    if (!souscriptionId) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      include: {
        pack: { select: { id: true, nom: true, type: true } },
        user: { select: { id: true, nom: true, prenom: true, telephone: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        versements: { orderBy: { createdAt: "desc" } },
        receptions: { orderBy: { createdAt: "desc" } },
        echeances: { orderBy: { numero: "asc" } },
        _count: { select: { versements: true, echeances: true, receptions: true } },
      },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    return NextResponse.json(souscription);
  } catch (error) {
    console.error("GET /api/admin/packs/souscriptions/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscriptionId = parseId(id);
    if (!souscriptionId) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json();
    const { packId, statut, formuleRevendeur, frequenceVersement, notes, dateDebut, dateFin, montantTotal } = body as {
      packId?: number | string;
      statut?: StatutSouscription;
      formuleRevendeur?: FormuleRevendeur | null;
      frequenceVersement?: FrequenceVersement | null;
      notes?: string | null;
      dateDebut?: string | null;
      dateFin?: string | null;
      montantTotal?: number | string;
    };

    if (statut && !Object.values(StatutSouscription).includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    if (formuleRevendeur && !Object.values(FormuleRevendeur).includes(formuleRevendeur)) {
      return NextResponse.json({ error: "Formule revendeur invalide" }, { status: 400 });
    }

    if (frequenceVersement && !Object.values(FrequenceVersement).includes(frequenceVersement)) {
      return NextResponse.json({ error: "Fréquence de versement invalide" }, { status: 400 });
    }

    const existante = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      select: { id: true, packId: true, montantVerse: true, montantTotal: true, dateDebut: true },
    });

    if (!existante) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    const nextMontantTotal = montantTotal !== undefined ? Number(montantTotal) : Number(existante.montantTotal);
    if (Number.isNaN(nextMontantTotal) || nextMontantTotal <= 0) {
      return NextResponse.json({ error: "montantTotal doit être un nombre > 0" }, { status: 400 });
    }

    const montantVerse = Number(existante.montantVerse);
    if (nextMontantTotal < montantVerse) {
      return NextResponse.json(
        { error: "montantTotal ne peut pas être inférieur au montant déjà versé" },
        { status: 400 }
      );
    }

    const nextPackId = packId !== undefined ? Number(packId) : existante.packId;
    if (Number.isNaN(nextPackId) || nextPackId <= 0) {
      return NextResponse.json({ error: "packId invalide" }, { status: 400 });
    }

    const pack = await prisma.pack.findUnique({ where: { id: nextPackId } });
    if (!pack || !pack.actif) {
      return NextResponse.json({ error: "Pack introuvable ou inactif" }, { status: 404 });
    }

    if (formuleRevendeur && pack.type !== "REVENDEUR") {
      return NextResponse.json({ error: "formuleRevendeur autorisée uniquement pour les packs revendeur" }, { status: 400 });
    }
    if (frequenceVersement && pack.type !== "FAMILIAL") {
      return NextResponse.json({ error: "frequenceVersement autorisée uniquement pour les packs familiaux" }, { status: 400 });
    }

    const baseDateDebut = dateDebut ? new Date(dateDebut) : existante.dateDebut;
    const computedDateFin =
      dateFin !== undefined
        ? (dateFin ? new Date(dateFin) : null)
        : pack.dureeJours
          ? new Date(baseDateDebut.getTime() + Number(pack.dureeJours) * 24 * 60 * 60 * 1000)
          : null;

    const adminId = parseInt(session.user.id, 10);
    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim() || "Admin";

    const souscription = await prisma.$transaction(async (tx) => {
      const updated = await tx.souscriptionPack.update({
        where: { id: souscriptionId },
        data: {
          ...(packId !== undefined && { packId: nextPackId }),
          ...(statut && {
            statut,
            dateCloture: statut === "COMPLETE" || statut === "ANNULE" ? new Date() : null,
          }),
          ...(formuleRevendeur !== undefined && { formuleRevendeur: pack.type === "REVENDEUR" ? formuleRevendeur : null }),
          ...(frequenceVersement !== undefined && { frequenceVersement: pack.type === "FAMILIAL" ? frequenceVersement : null }),
          ...(notes !== undefined && { notes }),
          ...(dateDebut ? { dateDebut: new Date(dateDebut) } : {}),
          dateFin: computedDateFin,
          ...(montantTotal !== undefined && {
            montantTotal: nextMontantTotal,
            montantRestant: nextMontantTotal - montantVerse,
          }),
        },
        include: {
          pack: { select: { id: true, nom: true, type: true } },
          user: { select: { id: true, nom: true, prenom: true, telephone: true } },
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      });

      await notifyAdmins(tx, {
        titre: `Souscription modifiée — ${updated.pack.nom}`,
        message: `${adminNom} a modifié la souscription #${updated.id}.`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/packs",
      });
      await auditLog(tx, adminId, "SOUSCRIPTION_PACK_MODIFIEE", "SouscriptionPack", updated.id);

      return updated;
    });

    return NextResponse.json(souscription);
  } catch (error) {
    console.error("PATCH /api/admin/packs/souscriptions/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscriptionId = parseId(id);
    if (!souscriptionId) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const existing = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      select: {
        id: true,
        pack: { select: { nom: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    const adminId = parseInt(session.user.id, 10);
    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim() || "Admin";

    await prisma.$transaction(async (tx) => {
      await tx.receptionProduitPack.deleteMany({ where: { souscriptionId } });
      await tx.echeancePack.deleteMany({ where: { souscriptionId } });
      await tx.versementPack.deleteMany({ where: { souscriptionId } });
      await tx.souscriptionPack.delete({ where: { id: souscriptionId } });

      await notifyAdmins(tx, {
        titre: `Souscription supprimée — #${souscriptionId}`,
        message: `${adminNom} a supprimé la souscription #${souscriptionId} (${existing.pack.nom}).`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/packs",
      });
      await auditLog(tx, adminId, "SOUSCRIPTION_PACK_SUPPRIMEE", "SouscriptionPack", souscriptionId);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/packs/souscriptions/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
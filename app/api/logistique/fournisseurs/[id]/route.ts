import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/logistique/fournisseurs/[id]
 * Fiche fournisseur détaillée + statistiques d'évaluation calculées à la volée
 * (CDC §8 — respect délais / qualité produit) depuis l'historique des réceptions.
 * Prix/litiges/disponibilité non calculables tant que le module RFQ/PO n'existe pas.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);

    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      include: {
        contrats: { orderBy: { createdAt: "desc" } },
        _count: { select: { receptions: true } },
      },
    });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const receptionsValidees = await prisma.receptionApprovisionnement.findMany({
      where: { fournisseurId, statut: "VALIDE", dateReception: { not: null } },
      select: { datePrevisionnelle: true, dateReception: true },
    });
    const aTemps = receptionsValidees.filter((r) => r.dateReception! <= r.datePrevisionnelle).length;
    const tauxRespectDelais = receptionsValidees.length > 0
      ? Math.round((aTemps / receptionsValidees.length) * 100)
      : null;

    const lignesQualite = await prisma.ligneReceptionAppro.findMany({
      where: { reception: { fournisseurId }, etatQualite: { not: null } },
      select: { etatQualite: true },
    });
    const conformes = lignesQualite.filter((l) => l.etatQualite === "BON").length;
    const tauxQualite = lignesQualite.length > 0
      ? Math.round((conformes / lignesQualite.length) * 100)
      : null;

    return NextResponse.json({
      data: fournisseur,
      evaluation: {
        tauxRespectDelais, receptionsAnalysees: receptionsValidees.length,
        tauxQualite, lignesAnalysees: lignesQualite.length,
      },
    });
  } catch (error) {
    console.error("GET /logistique/fournisseurs/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/fournisseurs/[id]
 * Édition de la fiche (tous champs) + bascule actif (désactivation = équivalent
 * suppression douce, un fournisseur reste référencé par ses réceptions/produits).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fournisseurId = Number(id);
    const existing = await prisma.fournisseur.findUnique({ where: { id: fournisseurId } });
    if (!existing) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const body = await req.json();
    const allowed = [
      "nom", "type", "contact", "telephone", "email", "adresse", "notes", "actif",
      "pays", "region", "devise", "banque", "iban", "rccm", "nif", "numeroTva", "noteGlobale",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === "actif") data[key] = Boolean(body[key]);
        else if (key === "noteGlobale") data[key] = body[key] !== null && body[key] !== "" ? Number(body[key]) : null;
        else data[key] = body[key] || null;
      }
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.fournisseur.update({ where: { id: fournisseurId }, data });
      await auditLog(tx, parseInt(session.user.id), "FOURNISSEUR_MODIFIE", "Fournisseur", f.id);
      return f;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/fournisseurs/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

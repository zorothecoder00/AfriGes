import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../route";
import { calculerEvaluationFournisseur } from "@/lib/evaluationFournisseurServer";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/logistique/fournisseurs/[id]
 * Fiche fournisseur détaillée + évaluation automatique (CDC §8 — 5 critères :
 * délais, qualité, prix, disponibilité, litiges). La note globale calculée est
 * repersistée sur `Fournisseur.noteGlobale` à chaque consultation, pour que les
 * vues en liste (dashboard, sélection RFQ) restent à jour sans recalcul lourd.
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
        contrats: { where: { actif: true }, orderBy: { createdAt: "desc" } },
        litiges: { orderBy: { createdAt: "desc" }, include: { creePar: { select: { nom: true, prenom: true } }, resoluPar: { select: { nom: true, prenom: true } } } },
        _count: { select: { receptions: true } },
      },
    });
    if (!fournisseur) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

    const evaluation = await calculerEvaluationFournisseur(fournisseurId);
    const noteGlobaleActuelle = fournisseur.noteGlobale != null ? Number(fournisseur.noteGlobale) : null;
    if (evaluation.noteGlobale !== noteGlobaleActuelle) {
      await prisma.fournisseur.update({ where: { id: fournisseurId }, data: { noteGlobale: evaluation.noteGlobale } });
    }

    return NextResponse.json({ data: { ...fournisseur, noteGlobale: evaluation.noteGlobale }, evaluation });
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
    // noteGlobale n'est plus saisissable manuellement — calculée automatiquement
    // (CDC §8 "évaluation automatique") et persistée à chaque consultation de la fiche.
    const allowed = [
      "nom", "type", "contact", "telephone", "email", "adresse", "notes", "actif",
      "pays", "region", "devise", "banque", "iban", "rccm", "nif", "numeroTva",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === "actif") data[key] = Boolean(body[key]);
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

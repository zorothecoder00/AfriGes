import { NextResponse } from "next/server";
import { Prisma, StatutProduit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { enregistrerChangementPrix } from "@/lib/prixProduit";
import { auditLog } from "@/lib/notifications";
import { buildProduitData, STATUTS_PRODUIT } from "@/lib/catalogueProduit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET    /api/admin/catalogue/produits/[id] — fiche produit complète (Catalogue §12) — admin.
 * PATCH  — édition riche (+ historique de prix si le prix change) — admin.
 * DELETE — archivage logique (statut ARCHIVE), jamais de suppression physique.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const produit = await prisma.produit.findUnique({
    where: { id },
    include: {
      famille: { select: { id: true, nom: true } },
      sousFamille: { select: { id: true, nom: true } },
      categorieProduit: { select: { id: true, nom: true } },
      sousCategorie: { select: { id: true, nom: true } },
      marque: { select: { id: true, nom: true } },
      fournisseurPrincipal: { select: { id: true, nom: true } },
      uniteVente: { select: { id: true, nom: true, symbole: true } },
      uniteAchat: { select: { id: true, nom: true, symbole: true } },
      stocks: { select: { pointDeVenteId: true, quantite: true, quantiteReservee: true, pointDeVente: { select: { nom: true } } } },
      _count: { select: { historiquePrix: true } },
    },
  });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  return NextResponse.json({
    data: {
      ...produit,
      prixUnitaire: Number(produit.prixUnitaire),
      prixAchat: produit.prixAchat != null ? Number(produit.prixAchat) : null,
      poids: produit.poids != null ? Number(produit.poids) : null,
      volume: produit.volume != null ? Number(produit.volume) : null,
    },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const existant = await prisma.produit.findUnique({ where: { id }, select: { id: true, prixUnitaire: true, prixAchat: true } });
  if (!existant) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const data = buildProduitData(body);
  const userId = Number(session.user.id);

  // Prix de vente : optionnel à l'édition (on ne l'écrase que s'il est fourni et valide).
  const prixVente = body.prixUnitaire != null && body.prixUnitaire !== "" ? Number(body.prixUnitaire) : undefined;
  if (prixVente !== undefined && (isNaN(prixVente) || prixVente <= 0)) {
    return NextResponse.json({ message: "Le prix de vente doit être supérieur à 0" }, { status: 400 });
  }

  // Gouvernance des prix (Catalogue §15) : si la validation est obligatoire, un
  // changement de prix de vente/achat doit passer par une demande validée.
  const param = await prisma.parametragePrixAuto.findUnique({ where: { id: 1 }, select: { validationPrixObligatoire: true } });
  if (param?.validationPrixObligatoire) {
    const venteChange = prixVente !== undefined && prixVente !== Number(existant.prixUnitaire);
    const achatActuel = existant.prixAchat != null ? Number(existant.prixAchat) : null;
    const achatChange = data.prixAchat !== undefined && Number(data.prixAchat ?? NaN) !== (achatActuel ?? NaN)
      && !(data.prixAchat == null && achatActuel == null);
    if (venteChange || achatChange) {
      return NextResponse.json(
        { message: "Le changement de prix est soumis à validation : soumettez une demande de changement de prix (onglet Tarification). Les autres champs peuvent être enregistrés sans modifier le prix." },
        { status: 422 },
      );
    }
  }
  const nom = typeof body.nom === "string" && body.nom.trim() ? body.nom.trim() : undefined;
  const motifPrix = typeof body.motifPrix === "string" && body.motifPrix.trim() ? body.motifPrix.trim() : "Modification catalogue";

  try {
    const produit = await prisma.$transaction(async (tx) => {
      const p = await tx.produit.update({
        where: { id },
        data: {
          ...data,
          ...(nom ? { nom } : {}),
          ...(prixVente !== undefined ? { prixUnitaire: new Prisma.Decimal(prixVente) } : {}),
        },
        select: { id: true, nom: true, codeProduit: true, prixUnitaire: true, prixAchat: true },
      });
      // Historique de prix si vente ou achat a changé (le helper détecte la variation réelle).
      await enregistrerChangementPrix(tx, {
        produitId: id,
        nouveauPrixVente: prixVente,
        nouveauPrixAchat: data.prixAchat,
        source: "MANUEL", motif: motifPrix, userId,
      });
      await auditLog(tx, userId, "PRODUIT_MODIFIE_CATALOGUE", "Produit", id);
      return p;
    });
    return NextResponse.json({ data: { ...produit, prixUnitaire: Number(produit.prixUnitaire) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      if (target.includes("codeBarre")) return NextResponse.json({ message: "Ce code-barres est déjà utilisé" }, { status: 409 });
      if (target.includes("reference")) return NextResponse.json({ message: "Cette référence est déjà utilisée" }, { status: 409 });
    }
    console.error("PATCH /api/admin/catalogue/produits/[id]", e);
    return NextResponse.json({ message: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const produit = await prisma.produit.findUnique({ where: { id }, select: { id: true, statut: true } });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  // Archivage logique (jamais de suppression physique — Catalogue : conserver l'historique).
  const url = new URL(req.url);
  const nouveauStatut = (url.searchParams.get("statut") as StatutProduit | null);
  const cible: StatutProduit = STATUTS_PRODUIT.includes(nouveauStatut as StatutProduit) ? (nouveauStatut as StatutProduit) : "ARCHIVE";

  await prisma.$transaction(async (tx) => {
    await tx.produit.update({ where: { id }, data: { statut: cible, actif: cible === "ACTIF" } });
    await auditLog(tx, Number(session.user.id), "PRODUIT_STATUT_CATALOGUE", "Produit", id);
  });
  return NextResponse.json({ data: { id, statut: cible } });
}

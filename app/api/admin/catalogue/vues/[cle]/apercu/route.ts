import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { grillePrixEffective } from "@/lib/tarification";
import { promotionApplicable } from "@/lib/promotionsServer";
import { libelleRemise } from "@/lib/promotions";
import type { ProduitSource } from "@/lib/vuesCatalogue";
import { vueEffective } from "@/lib/vuesCatalogueServer";

type Ctx = { params: Promise<{ cle: string }> };

/**
 * Aperçu d'une vue (Catalogue §22/§24) — admin.
 * Renvoie quelques produits réels sous forme de « sources » complètes ; le
 * configurateur les projette côté client via `projeterProduit` (même moteur que
 * consommeraient les surfaces mobile/web/borne — synchro §24) pour un aperçu
 * live du rendu par rôle.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const cle = (await params).cle;
  const vue = await vueEffective(cle);
  if (!vue) return NextResponse.json({ message: "Rôle de vue inconnu" }, { status: 404 });

  const produits = await prisma.produit.findMany({
    where: { statut: "ACTIF" },
    take: 6,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, nom: true, nomCommercial: true, description: true, codeProduit: true, reference: true,
      codeBarre: true, qrCode: true, prixUnitaire: true, prixAchat: true, imagePrincipaleUrl: true, paysOrigine: true,
      categorieId: true, familleId: true, marqueId: true,
      marque: { select: { nom: true } }, famille: { select: { nom: true } }, categorieProduit: { select: { nom: true } },
      fournisseurPrincipal: { select: { nom: true } },
      stocks: { select: { quantite: true, disponible: true, rayon: true, etagere: true, allee: true } },
    },
  });

  const sources = await Promise.all(produits.map(async (p) => {
    const grille = await grillePrixEffective(p.id, {});
    const promo = await promotionApplicable(
      { id: p.id, categorieId: p.categorieId, familleId: p.familleId, marqueId: p.marqueId },
      {},
    );
    const stock = p.stocks.reduce((s, x) => s + Number(x.quantite), 0);
    const disponible = p.stocks.some((x) => x.disponible);
    const empl = p.stocks.find((x) => x.rayon || x.etagere || x.allee);
    const prixVente = Number(p.prixUnitaire);
    const prixAchat = p.prixAchat != null ? Number(p.prixAchat) : null;

    const source: ProduitSource = {
      id: p.id,
      photo: p.imagePrincipaleUrl,
      nom: p.nom, nomCommercial: p.nomCommercial, description: p.description,
      codeProduit: p.codeProduit, reference: p.reference, codeBarre: p.codeBarre, qrCode: p.qrCode,
      marque: p.marque?.nom ?? null, famille: p.famille?.nom ?? null, categorie: p.categorieProduit?.nom ?? null,
      paysOrigine: p.paysOrigine, fournisseur: p.fournisseurPrincipal?.nom ?? null,
      prixDetail: grille.DETAIL ?? prixVente,
      prixCredit: grille.CREDIT ?? null,
      prixCommunaute: grille.COMMUNAUTE ?? null,
      prixGros: grille.GROS ?? null,
      promo: promo ? libelleRemise(promo) : null,
      prixAchat,
      marge: prixAchat != null ? prixVente - prixAchat : null,
      stock, disponible,
      emplacement: empl ? [empl.rayon, empl.etagere, empl.allee].filter(Boolean).join(" · ") : null,
      pointsFidelite: null,
      historiquePrix: null,
    };
    return source;
  }));

  return NextResponse.json({ data: { vue, sources } });
}

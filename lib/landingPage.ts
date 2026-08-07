import { prisma } from "@/lib/prisma";

/**
 * Landing pages marketing (CDC §44) — page d'atterrissage simple
 * (titre/offre/CTA/formulaire), pas un constructeur visuel : un rendu
 * serveur standard suffit, alimenté par ces quelques champs.
 */

/** Génère un slug unique lisible à partir du titre (retry sur collision). */
export async function genererSlugLandingPage(titre: string): Promise<string> {
  const base = titre
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "offre";

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const existant = await prisma.landingPageMarketing.findUnique({ where: { slug }, select: { id: true } });
    if (!existant) return slug;
  }
  throw new Error("Impossible de générer un slug unique, réessayez");
}

/**
 * Charge une landing page publique par son slug et compte la vue.
 * Renvoie null si absente/désactivée (404 côté appelant).
 */
export async function getLandingPagePublique(slug: string) {
  const lp = await prisma.landingPageMarketing.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, titre: true, description: true, offreTexte: true,
      imageUrl: true, ctaLabel: true, ctaUrl: true, actif: true, campagneId: true,
      produit: { select: { id: true, nom: true, prixUnitaire: true } },
      formulaire: { select: { id: true, nom: true, champs: true, actif: true } },
    },
  });
  if (!lp || !lp.actif) return null;

  await prisma.landingPageMarketing.update({ where: { id: lp.id }, data: { nbVues: { increment: 1 } } });
  return lp;
}

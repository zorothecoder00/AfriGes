import { NextResponse } from "next/server";
import { getLandingPagePublique } from "@/lib/landingPage";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/marketing/lp/[slug] — public, sans auth (CDC §44). */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const lp = await getLandingPagePublique(slug);
  if (!lp) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });

  return NextResponse.json({
    data: {
      titre: lp.titre, description: lp.description, offreTexte: lp.offreTexte,
      imageUrl: lp.imageUrl, ctaLabel: lp.ctaLabel, ctaUrl: lp.ctaUrl,
      produit: lp.produit,
      formulaire: lp.formulaire && lp.formulaire.actif ? { id: lp.formulaire.id, nom: lp.formulaire.nom, champs: lp.formulaire.champs } : null,
    },
  });
}

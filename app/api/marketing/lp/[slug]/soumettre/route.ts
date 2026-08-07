import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { soumettreFormulaire } from "@/lib/formulaireMarketing";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/marketing/lp/[slug]/soumettre — public, sans auth (CDC §44-46).
 * Soumission du formulaire de la landing page : crée/retrouve le Client et
 * trace la source (landing page + éventuel code QR).
 * Body: { donnees: Record<string,unknown>, qr?: string }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;

  const lp = await prisma.landingPageMarketing.findUnique({
    where: { slug },
    select: { id: true, actif: true, campagneId: true, formulaireId: true },
  });
  if (!lp || !lp.actif) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });
  if (!lp.formulaireId) return NextResponse.json({ error: "Cette page n'a pas de formulaire" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.donnees !== "object") return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  let qrCodeId: number | null = null;
  if (typeof body.qr === "string" && body.qr.trim()) {
    const qr = await prisma.qrCodeMarketing.findUnique({ where: { code: body.qr.trim() }, select: { id: true } });
    qrCodeId = qr?.id ?? null;
  }

  try {
    const soumission = await prisma.$transaction((tx) =>
      soumettreFormulaire(tx, {
        formulaireId: lp.formulaireId!, donnees: body.donnees, campagneId: lp.campagneId,
        canal: "LANDING_PAGE", landingPageId: lp.id, qrCodeId,
      }),
    );
    return NextResponse.json({ data: { merci: true, id: soumission.id } }, { status: 201 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "TELEPHONE_REQUIS") return NextResponse.json({ error: "Le numéro de téléphone est requis" }, { status: 400 });
    if (code.startsWith("CHAMP_REQUIS:")) return NextResponse.json({ error: `Champ requis : ${code.split(":")[1]}` }, { status: 400 });
    if (code === "FORMULAIRE_INACTIF") return NextResponse.json({ error: "Ce formulaire n'est plus disponible" }, { status: 400 });
    console.error("POST /api/marketing/lp/[slug]/soumettre", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

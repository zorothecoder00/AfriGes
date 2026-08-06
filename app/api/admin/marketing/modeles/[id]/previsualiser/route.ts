import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { resoudreVariables } from "@/lib/personnalisationMessage";
import { rendererBlocsEmail, type BlocEmail } from "@/lib/emailBuilder";
import { renderEmailLayout } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/marketing/modeles/[id]/previsualiser
 * Body: { clientId }
 * Rend le message pour un client réel — aperçu avant envoi (pas d'envoi effectif).
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const { id } = await params;
  const modele = await prisma.modeleMessage.findUnique({ where: { id: Number(id) }, include: { canal: true } });
  if (!modele) return NextResponse.json({ error: "Modèle introuvable" }, { status: 404 });

  const body = await req.json();
  const clientId = Number(body.clientId);
  if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, nom: true, prenom: true } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  if (modele.canal.code === "EMAIL") {
    const objet = modele.objet ? await resoudreVariables(modele.objet, clientId) : "";
    const corps = modele.contenuBlocs ? await rendererBlocsEmail(modele.contenuBlocs as unknown as BlocEmail[]) : "";
    const html = renderEmailLayout(await resoudreVariables(corps, clientId), objet);
    return NextResponse.json({ data: { type: "EMAIL", objet, html } });
  }

  const texte = await resoudreVariables(modele.contenuTexte ?? "", clientId);
  return NextResponse.json({ data: { type: "TEXTE", texte } });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererGrandLivreClient } from "@/lib/comptabilite/clientAuxiliaire";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/clients/[id]/releve?dateDebut=&dateFin=
 * Relevé client imprimable (CDC Comptabilité §16) : identité + coordonnées du
 * client, période, solde d'ouverture/clôture et mouvements — même moteur que
 * le grand livre auxiliaire (genererGrandLivreClient), présentation dédiée.
 * Sans dateDebut/dateFin : période par défaut = depuis toujours jusqu'à ce jour.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : new Date();

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, nom: true, prenom: true, codeClient: true, telephone: true, adresse: true,
        limiteCredit: true, soldeActuel: true, delaiPaiementJours: true,
      },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const grandLivre = await genererGrandLivreClient(prisma, clientId, { dateDebut, dateFin });

    return NextResponse.json({
      data: {
        client,
        periode: { debut: dateDebut, fin: dateFin },
        ...grandLivre,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

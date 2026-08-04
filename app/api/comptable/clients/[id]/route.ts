import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptable/clients/[id]
 * Identité + conditions du client, pour la fiche client comptable (CDC §16) —
 * équivalent comptable-scopé de /api/admin/clients/[id] (réservé ADMIN).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id: Number(id) },
      select: {
        id: true, nom: true, prenom: true, codeClient: true, telephone: true, adresse: true,
        limiteCredit: true, soldeActuel: true, delaiPaiementJours: true,
        compteAuxiliaire: { select: { numero: true } },
      },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    return NextResponse.json({ data: client });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

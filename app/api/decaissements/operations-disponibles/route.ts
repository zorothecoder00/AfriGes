import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/decaissements/operations-disponibles
 * Sorties de caisse (DECAISSEMENT) qui n'ont pas encore de fiche de décaissement.
 * La fiche vient APRÈS la sortie de caisse : c'est la liste dans laquelle on choisit
 * l'opération à justifier. Comptable/Chef Comptable/Admin : toutes ; sinon : celles
 * dont l'utilisateur est l'opérateur.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const voitTout = !!(await getComptableSession());
    const filtreOperateur = voitTout ? {} : { operateurId: userId };

    const [grandeCaisse, petiteCaisse] = await Promise.all([
      prisma.operationCaisse.findMany({
        where: { type: "DECAISSEMENT", ficheDecaissement: null, ...filtreOperateur },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { session: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } } },
      }),
      prisma.operationCaissePDV.findMany({
        where: { type: "DECAISSEMENT", ficheDecaissement: null, ...filtreOperateur },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { caissePDV: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } } },
      }),
    ]);

    const data = [
      ...grandeCaisse.map((o) => ({
        source: "CAISSE" as const, id: o.id, reference: o.reference, montant: Number(o.montant), motif: o.motif,
        categorie: o.categorie, mode: o.mode, date: o.createdAt, operateurNom: o.operateurNom,
        pointDeVente: o.session.pointDeVente,
      })),
      ...petiteCaisse.map((o) => ({
        source: "CAISSE_PDV" as const, id: o.id, reference: o.reference, montant: Number(o.montant), motif: o.motif,
        categorie: o.categorie, mode: o.mode, date: o.createdAt, operateurNom: o.operateurNom,
        pointDeVente: o.caissePDV.pointDeVente,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /decaissements/operations-disponibles:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

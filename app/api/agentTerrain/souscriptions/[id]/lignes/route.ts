import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  const agent = await getAgentTerrainSession();
  if (agent) return agent;
  const admin = await getAdminSession();
  if (admin) return admin;
  return null;
}

/**
 * GET /api/agentTerrain/souscriptions/[id]/lignes
 * Retourne les lignes produits d'une souscription avec statut de traitement.
 *
 * Pour chaque ligne :
 *  - Si produitId est renseigné → produit.nom est le nom canonique (catalogue)
 *  - Sinon → produitNomSaisi est la saisie libre de l'agent (produit inconnu)
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const souscriptionId = parseInt(id);
    if (isNaN(souscriptionId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      select: {
        id: true,
        client: { select: { id: true, nom: true, prenom: true, pointDeVenteId: true } },
        pack:   { select: { id: true, nom: true, type: true } },
      },
    });
    if (!souscription) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });

    const lignes = await prisma.ligneSouscriptionProduit.findMany({
      where: { souscriptionId },
      orderBy: { createdAt: "asc" },
      include: {
        // produit est renseigné si le produit existe dans le catalogue (produitId != null)
        // sinon null → l'agent a fait une saisie libre
        produit:          { select: { id: true, nom: true, unite: true, prixUnitaire: true, reference: true } },
        produitSubstitut: { select: { id: true, nom: true, unite: true, prixUnitaire: true } },
        traitePar:        { select: { id: true, nom: true, prenom: true } },
        pointDeVente:     { select: { id: true, nom: true, code: true } },
      },
    });

    const stats = {
      total:         lignes.length,
      enAttente:     lignes.filter(l => l.statut === "EN_ATTENTE").length,
      confirmes:     lignes.filter(l => l.statut === "CONFIRME").length,
      indisponibles: lignes.filter(l => l.statut === "INDISPONIBLE").length,
      substitues:    lignes.filter(l => l.statut === "SUBSTITUE").length,
    };

    return NextResponse.json({ souscription, lignes, stats });
  } catch (error) {
    console.error("GET /api/agentTerrain/souscriptions/[id]/lignes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/souscriptions/[id]/lignes
 * Ajoute une ou plusieurs lignes produits à une souscription.
 *
 * Body: { lignes: LigneInput[] }
 *
 * LigneInput:
 *   produitId?        — si l'agent sélectionne un produit existant du catalogue
 *                       → estNouveauProduit = false automatiquement
 *                       → produit.nom sera le nom affiché côté admin
 *   produitNomSaisi   — toujours requis (nom tapé par l'agent, gardé pour traçabilité)
 *   quantite          — obligatoire > 0
 *   quantiteParCycle? — pour packs récurrents
 *   prixEstime?       — estimation agent
 *   categorieSaisie?
 *   uniteSaisie?
 *
 * Si produitId absent → estNouveauProduit = true → l'admin devra créer le produit
 *                        via POST /api/admin/souscriptions/lignes/[id]/creer-produit
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const souscriptionId = parseInt(id);
    if (isNaN(souscriptionId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const lignesInput: Array<{
      produitNomSaisi: string;
      produitId?: number;
      quantite: number;
      quantiteParCycle?: number;
      prixEstime?: number;
      categorieSaisie?: string;
      uniteSaisie?: string;
    }> = body.lignes;

    if (!Array.isArray(lignesInput) || lignesInput.length === 0) {
      return NextResponse.json({ error: "Au moins une ligne est requise" }, { status: 400 });
    }

    for (const l of lignesInput) {
      if (!l.produitNomSaisi?.trim()) {
        return NextResponse.json({ error: "produitNomSaisi est obligatoire pour chaque ligne" }, { status: 400 });
      }
      if (!l.quantite || l.quantite <= 0) {
        return NextResponse.json({ error: `Quantité invalide pour "${l.produitNomSaisi}"` }, { status: 400 });
      }
    }

    // Vérifier que les produitId fournis existent réellement dans le catalogue
    const produitIdsFournis = lignesInput.map(l => l.produitId).filter(Boolean) as number[];
    if (produitIdsFournis.length > 0) {
      const produitsExistants = await prisma.produit.findMany({
        where: { id: { in: produitIdsFournis }, actif: true },
        select: { id: true },
      });
      const idsValides = new Set(produitsExistants.map(p => p.id));
      const invalide = produitIdsFournis.find(pid => !idsValides.has(pid));
      if (invalide) {
        return NextResponse.json({ error: `Produit id=${invalide} introuvable dans le catalogue` }, { status: 400 });
      }
    }

    // Récupérer la souscription pour dénormaliser le PDV du client
    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      select: { id: true, client: { select: { pointDeVenteId: true } } },
    });
    if (!souscription) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });

    const pointDeVenteId = souscription.client?.pointDeVenteId ?? null;

    const created = await prisma.ligneSouscriptionProduit.createMany({
      data: lignesInput.map(l => ({
        souscriptionId,
        pointDeVenteId,
        produitId:         l.produitId ?? null,
        produitNomSaisi:   l.produitNomSaisi.trim(),
        categorieSaisie:   l.categorieSaisie?.trim() ?? null,
        uniteSaisie:       l.uniteSaisie?.trim() ?? null,
        quantite:          l.quantite,
        quantiteParCycle:  l.quantiteParCycle ?? null,
        prixEstime:        l.prixEstime ?? null,
        // Nouveau produit = pas de produitId fourni par l'agent
        estNouveauProduit: !l.produitId,
        statut:            "EN_ATTENTE",
      })),
    });

    return NextResponse.json({ created: created.count }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/souscriptions/[id]/lignes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

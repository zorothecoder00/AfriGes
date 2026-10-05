import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { tariferLigne, type ContexteVente } from "@/lib/venteTarification";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";
import { nouveauJetonConfirmation } from "@/lib/livraisonConfirmation";

/**
 * Devis / Proforma (CDC digitalisation §5.2) — proposition commerciale à un
 * client avant commande ferme. Un seul modèle (DevisProforma.type) pour les
 * deux documents, structurellement identiques (CDC §6 : moteur générique).
 */

export async function getCreateSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (role === "ADMIN" || role === "SUPER_ADMIN" || gRole === "AGENT_TERRAIN" || gRole === "COMMERCIAL") {
    return session;
  }
  return null;
}

export const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true } },
  agent: { select: { id: true, nom: true, prenom: true } },
  client: { select: { id: true, nom: true, prenom: true, telephone: true, adresse: true, segment: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
  devisOrigine: { select: { id: true, reference: true } },
  proformaGenere: { select: { id: true, reference: true } },
};

/** Ligne du catalogue (produitId) ou produit hors catalogue (designation + prixUnitaire indicatif facultatif). */
export interface LigneDevisInput { produitId?: number | null; designation?: string; prixUnitaire?: number; quantite: number; remisePourcent?: number }

/**
 * Contrôle des lignes saisies ; renvoie un message d'erreur ou null.
 * `libreAutorise(designation)` dit si une ligne hors catalogue est acceptée (refusé à l'Admin, qui choisit
 * toujours dans le catalogue, sauf pour conserver une ligne déjà saisie par l'agent).
 */
export function erreurLignesDevis(lignes: LigneDevisInput[], libreAutorise: (designation: string) => boolean): string | null {
  if (!lignes.length) return "Au moins une ligne est requise";
  for (const l of lignes) {
    if (!(Number(l.quantite) > 0)) return "Chaque ligne doit avoir une quantité (>0)";
    if (!l.produitId) {
      const designation = String(l.designation || "").trim();
      if (!designation) return "Produit hors catalogue : désignation obligatoire";
      if (!libreAutorise(designation)) return "Sélectionnez un produit du catalogue pour chaque ligne";
      if (l.prixUnitaire != null && !(Number(l.prixUnitaire) >= 0)) return "Produit hors catalogue : prix indicatif invalide";
    }
  }
  return null;
}

/**
 * Calcule les lignes (moteur de prix pour le catalogue, prix indicatif — 0 = à chiffrer — pour le hors
 * catalogue) et les totaux du document.
 */
export async function calculerLignesDevis(
  tx: Prisma.TransactionClient,
  lignesInput: LigneDevisInput[],
  ctx: ContexteVente,
) {
  const produits = await Promise.all(
    lignesInput.map((l) => l.produitId ? tx.produit.findUnique({
      where: { id: Number(l.produitId) },
      select: { id: true, nom: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true },
    }) : Promise.resolve(null))
  );
  if (lignesInput.some((l, i) => l.produitId && !produits[i])) throw new Error("Produit introuvable");

  const lignes = await Promise.all(lignesInput.map(async (l, i) => {
    const produit = produits[i];
    const quantite = Number(l.quantite);
    const remisePourcent = Math.min(100, Math.max(0, Number(l.remisePourcent) || 0));
    if (!produit) {
      const prixUnitaire = Number(l.prixUnitaire) || 0;
      const montant = Math.round(prixUnitaire * quantite * 100) / 100;
      const remiseMontant = Math.round(montant * remisePourcent / 100 * 100) / 100;
      return { produitId: null as number | null, designationLibre: String(l.designation).trim() as string | null, quantite, prixUnitaire, remisePourcent, remiseMontant, totalLigne: montant - remiseMontant };
    }
    const tarif = await tariferLigne(produit, quantite, ctx);
    const remiseMontant = Math.round(tarif.montant * remisePourcent / 100 * 100) / 100;
    return { produitId: produit.id as number | null, designationLibre: null as string | null, quantite, prixUnitaire: tarif.prixUnitaire, remisePourcent, remiseMontant, totalLigne: tarif.montant - remiseMontant };
  }));

  const totalRemise = lignes.reduce((s, l) => s + l.remiseMontant, 0);
  const totalTTC = lignes.reduce((s, l) => s + l.totalLigne, 0);
  const tva = await resoudreTvaVente(tx);
  const { montantHT: totalHT, montantTVA: totalTVA } = tva ? decomposerTTC(totalTTC, tva.taux) : { montantHT: totalTTC, montantTVA: 0 };
  return { lignes, totalHT, totalRemise, totalTVA, totalTTC };
}

/**
 * GET /api/ventes/devis-proforma
 * Un agent (non admin) ne voit que ses propres devis/proforma ; l'admin voit tout.
 * Query: statut?, type?, agentId?
 */
export async function GET(req: Request) {
  try {
    const session = await getCreateSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const type = searchParams.get("type");
    const agentIdParam = searchParams.get("agentId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (type) where.type = type;
    if (!isAdmin) {
      where.agentId = parseInt(session.user.id);
    } else if (agentIdParam) {
      where.agentId = Number(agentIdParam);
    }

    // Expiration paresseuse (§5.2) — pas de cron dédié dans ce lot.
    await prisma.devisProforma.updateMany({
      where: { statut: "ENVOYE", dateValidite: { lt: new Date() }, ...(isAdmin ? {} : { agentId: parseInt(session.user.id) }) },
      data: { statut: "EXPIRE" },
    });

    const [documents, statsRaw] = await Promise.all([
      prisma.devisProforma.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.devisProforma.groupBy({ by: ["statut"], where: isAdmin ? {} : { agentId: parseInt(session.user.id) }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: documents,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /ventes/devis-proforma:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}


/**
 * POST /api/ventes/devis-proforma
 * Body : { type?, clientId, pointDeVenteId?, dateValidite?, conditions?,
 *   lignes: [{produitId, quantite, remisePourcent?} | {designation, prixUnitaire?, quantite, remisePourcent?}], notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getCreateSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = parseInt(session.user.id);
    const type = body.type === "PROFORMA" ? "PROFORMA" : "DEVIS";

    let pointDeVenteId = body.pointDeVenteId ? Number(body.pointDeVenteId) : null;
    if (!pointDeVenteId) {
      const aff = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true }, select: { pointDeVenteId: true } });
      pointDeVenteId = aff?.pointDeVenteId ?? null;
    }
    if (!pointDeVenteId) return NextResponse.json({ error: "Agence/zone introuvable (aucune affectation active)" }, { status: 400 });

    const clientId = Number(body.clientId);
    if (!clientId) return NextResponse.json({ error: "Client obligatoire" }, { status: 400 });
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, segment: true, telephone: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const lignesInput = (body.lignes ?? []) as LigneDevisInput[];
    const estAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const erreurLignes = erreurLignesDevis(lignesInput, () => !estAdmin);
    if (erreurLignes) return NextResponse.json({ error: erreurLignes }, { status: 400 });

    const dateValidite = body.dateValidite ? new Date(body.dateValidite) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const prefixe = type === "PROFORMA" ? "PRO" : "DEV";
    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.devisProforma.count();
      const annee = new Date().getFullYear();
      const reference = `${prefixe}-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const document = await prisma.$transaction(async (tx) => {
          const { lignes: lignesCalc, totalHT, totalRemise, totalTVA, totalTTC } = await calculerLignesDevis(tx, lignesInput, { pointDeVenteId, clientId, segment: client.segment });

          const d = await tx.devisProforma.create({
            data: {
              reference, type, statut: "BROUILLON",
              agentId: userId, pointDeVenteId, clientId,
              dateValidite, conditions: body.conditions || null,
              totalHT, totalRemise, totalTVA, totalTTC,
              tokenReponse: nouveauJetonConfirmation(),
              notes: body.notes || null,
              lignes: { create: lignesCalc.map((l) => ({ produitId: l.produitId, designationLibre: l.designationLibre, quantite: l.quantite, prixUnitaire: l.prixUnitaire, remisePourcent: l.remisePourcent, remiseMontant: l.remiseMontant, totalLigne: l.totalLigne })) },
            },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "DEVIS_PROFORMA_CREE", "DevisProforma", d.id, { type }, getRequestMeta(req));
          return d;
        });
        return NextResponse.json({ data: document }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /ventes/devis-proforma:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

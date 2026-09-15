import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { tariferLigne } from "@/lib/venteTarification";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";
import { getSeuilRemiseCommandeClient } from "@/lib/parametresDocuments";

/**
 * Bon de Commande Client (CDC digitalisation §3.2) — prise de commande terrain
 * par un agent, jusqu'à la génération automatique du Bon de Sortie de
 * Marchandises. Namespace neutre (agent + Responsable Vente Crédit).
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

/** N'importe quel acteur autorisé à consulter (créateur, RVC, admin) — filtrage fin dans le handler. */
export async function getViewSession() {
  const create = await getCreateSession();
  if (create) return create;
  return getRVCSession();
}

export const INCLUDE = {
  pointDeVente: { select: { id: true, nom: true, code: true } },
  agent: { select: { id: true, nom: true, prenom: true } },
  client: { select: { id: true, nom: true, prenom: true, telephone: true, adresse: true, typeClient: true, segment: true } },
  visaResponsablePar: { select: { id: true, nom: true, prenom: true } },
  bonSortie: { select: { id: true, reference: true, statut: true, dateValidation: true } },
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
};

/**
 * GET /api/ventes/commandes-client
 * Un agent (non admin/RVC) ne voit que ses propres commandes ; le RVC et l'admin voient tout.
 * Query: statut?, agentId?
 */
export async function GET(req: Request) {
  try {
    const session = await getViewSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isRVCOuAdmin = !!(await getRVCSession());

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const agentIdParam = searchParams.get("agentId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (!isRVCOuAdmin) {
      where.agentId = parseInt(session.user.id);
    } else if (agentIdParam) {
      where.agentId = Number(agentIdParam);
    }

    const [commandes, statsRaw] = await Promise.all([
      prisma.commandeClient.findMany({ where, orderBy: { createdAt: "desc" }, include: INCLUDE }),
      prisma.commandeClient.groupBy({ by: ["statut"], where: isRVCOuAdmin ? {} : { agentId: parseInt(session.user.id) }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      data: commandes,
      stats: Object.fromEntries(statsRaw.map((s) => [s.statut, s._count.id])),
    });
  } catch (error) {
    console.error("GET /ventes/commandes-client:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

interface LigneInput { produitId: number; quantite: number; remisePourcent?: number }

/**
 * POST /api/ventes/commandes-client
 * Body : { clientId, pointDeVenteId?, typeClientCommande?, modeReglement?,
 *   dateLivraisonSouhaitee?, lieuLivraison?, lignes: [{produitId, quantite, remisePourcent?}],
 *   signatureClientNom, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getCreateSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const userId = parseInt(session.user.id);

    let pointDeVenteId = body.pointDeVenteId ? Number(body.pointDeVenteId) : null;
    if (!pointDeVenteId) {
      const aff = await prisma.gestionnaireAffectation.findFirst({ where: { userId, actif: true }, select: { pointDeVenteId: true } });
      pointDeVenteId = aff?.pointDeVenteId ?? null;
    }
    if (!pointDeVenteId) {
      return NextResponse.json({ error: "Agence/zone introuvable (aucune affectation active)" }, { status: 400 });
    }

    const clientId = Number(body.clientId);
    if (!clientId) return NextResponse.json({ error: "Client obligatoire (recherche par téléphone)" }, { status: 400 });

    const lignesInput = (body.lignes ?? []) as LigneInput[];
    if (!lignesInput.length) return NextResponse.json({ error: "Au moins une ligne de commande est requise" }, { status: 400 });
    for (const l of lignesInput) {
      if (!l.produitId || !l.quantite || l.quantite <= 0) {
        return NextResponse.json({ error: "Chaque ligne doit avoir produitId et quantite (>0)" }, { status: 400 });
      }
      if (l.remisePourcent != null && (l.remisePourcent < 0 || l.remisePourcent > 100)) {
        return NextResponse.json({ error: "Remise (%) invalide" }, { status: 400 });
      }
    }

    const signatureClientNom = String(body.signatureClientNom || "").trim();
    if (!signatureClientNom) {
      return NextResponse.json({ error: "Signature électronique du client obligatoire (vaut engagement d'achat)" }, { status: 400 });
    }

    const modeReglement = ["COMPTANT", "MOBILE_MONEY", "CREDIT"].includes(body.modeReglement) ? body.modeReglement : "COMPTANT";
    const typeClientCommande = body.typeClientCommande === "REVENDEUR" ? "REVENDEUR" : "PARTICULIER";

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, segment: true, telephone: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    const seuilRemise = await getSeuilRemiseCommandeClient();

    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.commandeClient.count();
      const annee = new Date().getFullYear();
      const reference = `BCC-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const commande = await prisma.$transaction(async (tx) => {
          const produits = await Promise.all(
            lignesInput.map((l) => tx.produit.findUnique({
              where: { id: Number(l.produitId) },
              select: { id: true, nom: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true },
            }))
          );
          if (produits.some((p) => !p)) throw new Error("Produit introuvable");

          const lignesCalc = await Promise.all(lignesInput.map(async (l, i) => {
            const produit = produits[i]!;
            const tarif = await tariferLigne(produit, l.quantite, {
              pointDeVenteId, clientId, segment: client.segment, aCredit: modeReglement === "CREDIT",
            });
            const remisePourcent = Math.min(100, Math.max(0, Number(l.remisePourcent) || 0));
            const remiseMontant = Math.round(tarif.montant * remisePourcent / 100 * 100) / 100;
            const totalLigne = tarif.montant - remiseMontant;
            return { produitId: produit.id, produitNom: produit.nom, quantite: l.quantite, prixUnitaire: tarif.prixUnitaire, remisePourcent, remiseMontant, totalLigne };
          }));

          const totalRemise = lignesCalc.reduce((s, l) => s + l.remiseMontant, 0);
          const totalTTC = lignesCalc.reduce((s, l) => s + l.totalLigne, 0);

          const tva = await resoudreTvaVente(tx);
          const { montantHT: totalHT, montantTVA: totalTVA } = tva ? decomposerTTC(totalTTC, tva.taux) : { montantHT: totalTTC, montantTVA: 0 };

          const visaRequis = totalRemise > seuilRemise || modeReglement === "CREDIT";

          const c = await tx.commandeClient.create({
            data: {
              reference,
              statut: visaRequis ? "EN_VALIDATION" : "EN_PREPARATION",
              agentId: userId,
              pointDeVenteId,
              clientId,
              typeClientCommande,
              modeReglement,
              dateLivraisonSouhaitee: body.dateLivraisonSouhaitee ? new Date(body.dateLivraisonSouhaitee) : null,
              lieuLivraison: body.lieuLivraison || null,
              totalHT, totalRemise, totalTVA, totalTTC,
              signatureClientNom, dateSignatureClient: new Date(),
              notes: body.notes || null,
              lignes: {
                create: lignesCalc.map((l) => ({
                  produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire,
                  remisePourcent: l.remisePourcent, remiseMontant: l.remiseMontant, totalLigne: l.totalLigne,
                })),
              },
            },
            include: INCLUDE,
          });

          await auditLog(tx, userId, "BCC_CREE", "CommandeClient", c.id, { visaRequis }, getRequestMeta(req));

          if (visaRequis) {
            await notifyRoles(tx, ["RESPONSABLE_VENTE_CREDIT"], {
              titre: `Commande client en attente de visa (${reference})`,
              message: `${session.user.prenom} ${session.user.nom} a soumis une commande de ${totalTTC.toLocaleString("fr-FR")} FCFA pour ${client.telephone} (${modeReglement === "CREDIT" ? "vente à crédit" : `remise ${totalRemise.toLocaleString("fr-FR")} FCFA`}) — visa requis.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: `/dashboard/user/responsablesVenteCredit/commandes-client?detail=${c.id}`,
            });
            return c;
          }

          // Génération automatique du Bon de Sortie de Marchandises (CDC §3.2) —
          // reste en BROUILLON, le magasinier atteste/exécute via le workflow BSM existant.
          const refBS = `BS-${Date.now()}-${c.id}`;
          const montantTotalBS = lignesCalc.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
          const bonSortie = await tx.bonSortie.create({
            data: {
              reference: refBS,
              typeSortie: "LIVRAISON_CLIENT",
              statut: "BROUILLON",
              pointDeVenteId,
              motif: `Commande client ${reference}`,
              montantTotal: montantTotalBS,
              creeParId: userId,
              lignes: { create: lignesCalc.map((l) => ({ produitId: l.produitId, quantite: l.quantite, quantiteDemandee: l.quantite, prixUnit: l.prixUnitaire })) },
            },
          });
          const cUpdated = await tx.commandeClient.update({
            where: { id: c.id },
            data: { bonSortieId: bonSortie.id },
            include: INCLUDE,
          });
          await auditLog(tx, userId, "BCC_BSM_GENERE", "CommandeClient", c.id, { bonSortieId: bonSortie.id }, getRequestMeta(req));
          await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
            titre: `Commande client à préparer (${reference})`,
            message: `${session.user.prenom} ${session.user.nom} a validé une commande client. Bon de sortie ${refBS} en attente de préparation.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/magasinier/bons-sortie/${bonSortie.id}`,
          });
          return cUpdated;
        });
        return NextResponse.json({ data: commande }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer une référence unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /ventes/commandes-client:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

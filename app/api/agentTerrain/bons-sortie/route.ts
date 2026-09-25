import { NextResponse } from "next/server";
import { PrioriteNotification, TypeSortieStock } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notify, notifyGestionnaires, notifyAdmins, auditLog } from "@/lib/notifications";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";

/**
 * Types de sortie qu'un agent terrain peut demander (échantillons/dons promotionnels,
 * marchandise utilisée sur le terrain, perte ou casse constatée). LIVRAISON_CLIENT reste
 * générée par la commande client, jamais saisie à la main.
 */
const TYPES_SORTIE_AGENT: TypeSortieStock[] = ["DON", "CONSOMMATION_INTERNE", "PERTE", "CASSE"];

/**
 * GET /api/agentTerrain/bons-sortie
 * Bons de sortie remplis par l'agent connecté (tous statuts).
 */
export async function GET() {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const bons = await prisma.bonSortie.findMany({
      where: { creeParId: parseInt(session.user.id) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        pointDeVente: { select: { id: true, nom: true, code: true } },
        validePar:    { select: { nom: true, prenom: true } },
        visePar:      { select: { nom: true, prenom: true } },
        lignes:       { include: { produit: { select: { id: true, nom: true, reference: true } } } },
      },
    });

    const stats = {
      total:     bons.length,
      enAttente: bons.filter((b) => b.statut === "BROUILLON").length,
      executes:  bons.filter((b) => b.statut === "VALIDE").length,
      annules:   bons.filter((b) => b.statut === "ANNULE").length,
    };

    return NextResponse.json({ data: bons, stats });
  } catch (error) {
    console.error("GET /api/agentTerrain/bons-sortie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/bons-sortie
 * L'agent remplit un bon de sortie de marchandises (CDC digitalisation §3.4) en tant que
 * demandeur. Le bon est créé en BROUILLON, sans mouvement de stock : c'est le magasinier
 * du PDV qui l'exécute (et le visa reste requis au-delà du seuil paramétré).
 * Body: { typeSortie, motif, notes?, lignes: [{ produitId, quantite }] }
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const userId = parseInt(session.user.id);

    const body = await req.json();
    const typeSortie = body.typeSortie as TypeSortieStock;
    const motif = String(body.motif ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;
    const lignesBrutes = Array.isArray(body.lignes) ? body.lignes : [];

    if (!TYPES_SORTIE_AGENT.includes(typeSortie)) {
      return NextResponse.json({ error: `Type de sortie invalide (${TYPES_SORTIE_AGENT.join(", ")})` }, { status: 400 });
    }
    if (!motif) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });

    // Une ligne par produit (quantités cumulées si le produit est saisi deux fois).
    const parProduit = new Map<number, number>();
    for (const l of lignesBrutes as { produitId: unknown; quantite: unknown }[]) {
      const produitId = Number(l.produitId);
      const quantite = Number(l.quantite);
      if (!Number.isInteger(produitId) || produitId <= 0 || !Number.isInteger(quantite) || quantite <= 0) {
        return NextResponse.json({ error: "Chaque ligne doit avoir un produit et une quantité entière positive" }, { status: 400 });
      }
      parProduit.set(produitId, (parProduit.get(produitId) ?? 0) + quantite);
    }
    if (parProduit.size === 0) return NextResponse.json({ error: "Ajoutez au moins un produit" }, { status: 400 });

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId, actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }
    const pointDeVenteId = aff.pointDeVenteId;

    // Contrôle du disponible dès la demande : inutile de soumettre au magasinier une
    // sortie qu'il ne pourra pas exécuter. Le contrôle définitif reste à l'exécution.
    const lignes = [...parProduit.entries()].map(([produitId, quantite]) => ({ produitId, quantite }));
    const produits = await prisma.produit.findMany({
      where: { id: { in: lignes.map((l) => l.produitId) } },
      select: { id: true, nom: true, prixUnitaire: true, stocks: { where: { pointDeVenteId }, select: { quantite: true, quantiteReservee: true } } },
    });
    const produitParId = new Map(produits.map((p) => [p.id, p]));
    for (const l of lignes) {
      const p = produitParId.get(l.produitId);
      if (!p) return NextResponse.json({ error: `Produit ${l.produitId} introuvable` }, { status: 400 });
      const s = p.stocks[0];
      const dispo = (s?.quantite ?? 0) - (s?.quantiteReservee ?? 0);
      if (dispo < l.quantite) {
        return NextResponse.json({ error: `Stock insuffisant pour « ${p.nom} » au point de vente. Disponible : ${dispo}, demandé : ${l.quantite}` }, { status: 400 });
      }
    }

    const montantTotal = lignes.reduce((s, l) => s + l.quantite * Number(produitParId.get(l.produitId)!.prixUnitaire ?? 0), 0);
    const visaRequis = montantTotal > (await getSeuilVisaBonSortie());
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const bon = await prisma.$transaction(async (tx) => {
      const reference = `BS-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const created = await tx.bonSortie.create({
        data: {
          reference,
          typeSortie,
          statut: "BROUILLON",
          pointDeVenteId,
          motif,
          notes,
          montantTotal,
          creeParId: userId,
          lignes: {
            create: lignes.map((l) => ({
              produitId: l.produitId,
              quantite: l.quantite,
              quantiteDemandee: l.quantite,
              prixUnit: produitParId.get(l.produitId)!.prixUnitaire ?? null,
            })),
          },
        },
        include: { pointDeVente: { select: { nom: true } } },
      });

      await auditLog(tx, userId, "BON_SORTIE_DEMANDE_AGENT", "BonSortie", created.id);
      // Même message, lien propre à chaque destinataire : le magasinier exécute depuis son
      // onglet Sorties, le RPV supervise/vise depuis sa page, l'admin depuis Stock › Bons de sortie.
      const payload = {
        titre: `Bon de sortie à exécuter (${reference})`,
        message: `${agentNom} (agent terrain) a rempli un bon de sortie « ${typeSortie} » sur « ${created.pointDeVente.nom} » : ${lignes.length} produit(s), ${montantTotal.toLocaleString("fr-FR")} FCFA. Motif : ${motif}.${visaRequis ? " Visa requis avant exécution." : ""}`,
        priorite: visaRequis || typeSortie === "PERTE" || typeSortie === "CASSE" ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
      };
      await notifyGestionnaires(tx, ["MAGAZINIER"], { ...payload, actionUrl: "/dashboard/user/magasiniers?tab=sorties" });
      await notifyAdmins(tx, { ...payload, actionUrl: "/dashboard/admin/stock/sorties" });
      // RPV et chef d'agence de CETTE agence uniquement (pas tous ceux de l'entreprise).
      const pdv = await tx.pointDeVente.findUnique({ where: { id: pointDeVenteId }, select: { rpvId: true, chefAgenceId: true } });
      if (pdv?.rpvId) await notify(tx, [pdv.rpvId], { ...payload, actionUrl: "/dashboard/user/responsablesPointDeVente/bons-sortie" });
      if (pdv?.chefAgenceId && pdv.chefAgenceId !== pdv.rpvId) await notify(tx, [pdv.chefAgenceId], { ...payload, actionUrl: "/dashboard/user/chefAgence/bons-sortie" });
      return created;
    });

    return NextResponse.json({ data: bon }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/bons-sortie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

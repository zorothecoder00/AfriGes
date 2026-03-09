import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/receptions-packs
 * Liste des réceptions de produits packs (livraisons aux clients).
 * Query: statut, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Number(searchParams.get("limit") || 15));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";
    const search = searchParams.get("search") || "";

    // Filtrer sur les clients du PDV du RPV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      souscription: { client: { pointDeVenteId: pdv.id } },
    };
    if (statut) where.statut = statut;
    if (search) {
      // Combiner le filtre PDV avec la recherche textuelle
      where.souscription = {
        client: { pointDeVenteId: pdv.id },
        OR: [
          { pack:   { nom: { contains: search, mode: "insensitive" } } },
          { client: { OR: [
            { nom:    { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
          ]}},
        ],
      };
    }

    const [receptions, total] = await Promise.all([
      prisma.receptionProduitPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          souscription: {
            include: {
              pack:   { select: { nom: true, type: true } },
              user:   { select: { nom: true, prenom: true, telephone: true } },
              client: { select: { nom: true, prenom: true, telephone: true } },
            },
          },
          lignes: {
            include: { produit: { select: { nom: true } } },
          },
        },
      }),
      prisma.receptionProduitPack.count({ where }),
    ]);

    const stats = await prisma.receptionProduitPack.groupBy({
      by: ["statut"],
      _count: { id: true },
    });

    const statsMap: Record<string, number> = {};
    for (const s of stats) statsMap[s.statut] = s._count.id;

    return NextResponse.json({
      success: true,
      data: receptions.map((r) => ({
        id:                 r.id,
        souscriptionId:     r.souscriptionId,
        statut:             r.statut,
        datePrevisionnelle: r.datePrevisionnelle.toISOString(),
        dateLivraison:      r.dateLivraison?.toISOString() ?? null,
        livreurNom:         r.livreurNom,
        notes:              r.notes,
        createdAt:          r.createdAt.toISOString(),
        souscription: {
          pack:   r.souscription.pack,
          user:   r.souscription.user,
          client: r.souscription.client,
        },
        lignes: r.lignes.map((l) => ({
          id:          l.id,
          quantite:    l.quantite,
          prixUnitaire: l.prixUnitaire.toString(),
          produit:     l.produit,
        })),
      })),
      stats: {
        planifiees: statsMap["PLANIFIEE"] ?? 0,
        livrees:    statsMap["LIVREE"]    ?? 0,
        annulees:   statsMap["ANNULEE"]   ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/receptions-packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/receptions-packs
 * Le RPV planifie une livraison pour un client ayant une souscription éligible.
 * Body: { souscriptionId, datePrevisionnelle, lignes: [{ produitId, quantite }], notes? }
 *
 * Validations :
 *  1. Souscription éligible selon les règles par type de pack
 *  2. Pas de réception PLANIFIEE déjà en attente
 *  3. Stock PDV suffisant pour chaque produit
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });

    const { souscriptionId, datePrevisionnelle, lignes, notes } = await req.json();

    if (!souscriptionId || !datePrevisionnelle || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: "souscriptionId, datePrevisionnelle et au moins une ligne sont requis" }, { status: 400 });
    }

    // 1. Récupérer et valider la souscription
    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: Number(souscriptionId) },
      include: {
        pack:       { select: { nom: true, type: true } },
        client:     { select: { id: true, nom: true, prenom: true, pointDeVenteId: true } },
        receptions: { where: { statut: "LIVREE" }, select: { id: true } },
      },
    });
    if (!souscription)
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    if (souscription.client?.pointDeVenteId !== pdv.id)
      return NextResponse.json({ error: "Ce client n'appartient pas à votre PDV" }, { status: 403 });

    // Vérifier l'éligibilité selon le type de pack
    const { statut, formuleRevendeur, pack } = souscription;
    let eligible = false;
    if (souscription.receptions.length === 0) {
      switch (pack.type) {
        case "ALIMENTAIRE":
          eligible = statut === "COMPLETE"; break;
        case "URGENCE":
          eligible = ["ACTIF", "COMPLETE"].includes(statut); break;
        case "REVENDEUR":
          eligible = formuleRevendeur === "FORMULE_2" || ["ACTIF", "COMPLETE"].includes(statut); break;
        case "FAMILIAL":
        case "EPARGNE_PRODUIT":
          eligible = ["ACTIF", "COMPLETE"].includes(statut); break;
        default:
          eligible = statut === "COMPLETE";
      }
      // EN_ATTENTE seulement pour REVENDEUR F2
      if (statut === "EN_ATTENTE" && !(pack.type === "REVENDEUR" && formuleRevendeur === "FORMULE_2"))
        eligible = false;
    }
    if (!eligible) {
      const msg = souscription.receptions.length > 0
        ? "Ce client a déjà reçu une livraison pour cette souscription"
        : `Souscription non éligible (type : ${pack.type}, statut : ${statut})`;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 2. Pas de PLANIFIEE déjà en cours
    const existing = await prisma.receptionProduitPack.findFirst({
      where: { souscriptionId: Number(souscriptionId), statut: "PLANIFIEE" },
    });
    if (existing)
      return NextResponse.json({ error: `Une livraison est déjà planifiée (#${existing.id}) pour cette souscription` }, { status: 409 });

    // 3. Vérifier stock PDV + récupérer prix pour chaque produit
    type LigneInput = { produitId: number; quantite: number };
    const lignesInput: LigneInput[] = (lignes as LigneInput[]).map((l) => ({
      produitId: Number(l.produitId),
      quantite:  Number(l.quantite),
    }));

    const produitIds = lignesInput.map((l) => l.produitId);
    const [produits, stocksSite] = await Promise.all([
      prisma.produit.findMany({
        where:  { id: { in: produitIds } },
        select: { id: true, nom: true, prixUnitaire: true },
      }),
      prisma.stockSite.findMany({
        where:  { produitId: { in: produitIds }, pointDeVenteId: pdv.id },
        select: { produitId: true, quantite: true },
      }),
    ]);

    const produitMap = new Map(produits.map((p) => [p.id, p]));
    const stockMap   = new Map(stocksSite.map((s) => [s.produitId, s.quantite]));

    for (const l of lignesInput) {
      const produit = produitMap.get(l.produitId);
      if (!produit) return NextResponse.json({ error: `Produit #${l.produitId} introuvable` }, { status: 404 });
      if (l.quantite <= 0) return NextResponse.json({ error: `Quantité invalide pour "${produit.nom}"` }, { status: 400 });
      const stockDispo = stockMap.get(l.produitId) ?? 0;
      if (l.quantite > stockDispo)
        return NextResponse.json({ error: `Stock insuffisant pour "${produit.nom}" : ${stockDispo} dispo., ${l.quantite} demandé(s)` }, { status: 400 });
    }

    const rpvNom    = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim() || "RPV";
    const clientNom = souscription.client ? `${souscription.client.prenom} ${souscription.client.nom}` : "—";
    const montantTotal = lignesInput.reduce((s, l) => s + Number(produitMap.get(l.produitId)!.prixUnitaire) * l.quantite, 0);

    const reception = await prisma.$transaction(async (tx) => {
      const rec = await tx.receptionProduitPack.create({
        data: {
          souscriptionId:     Number(souscriptionId),
          statut:             "PLANIFIEE",
          datePrevisionnelle: new Date(datePrevisionnelle),
          livreurNom:         null,
          notes:              notes ? `[Planifiée par ${rpvNom}] ${notes}` : `Planifiée par ${rpvNom}`,
          lignes: {
            create: lignesInput.map((l) => ({
              produitId:    l.produitId,
              quantite:     l.quantite,
              prixUnitaire: produitMap.get(l.produitId)!.prixUnitaire,
            })),
          },
        },
        include: {
          lignes:       { include: { produit: { select: { nom: true } } } },
          souscription: { include: { pack: { select: { nom: true } }, client: { select: { nom: true, prenom: true } } } },
        },
      });

      await auditLog(tx, userId, "PLANIFICATION_LIVRAISON_PACK_RPV", "ReceptionProduitPack", rec.id);

      await notifyRoles(tx, ["AGENT_TERRAIN"], {
        titre:    `Nouvelle livraison à effectuer — ${pack.nom}`,
        message:  `${rpvNom} a planifié une livraison pour ${clientNom} (pack "${pack.nom}") prévue le ${new Date(datePrevisionnelle).toLocaleDateString("fr-FR")}. Montant : ${montantTotal.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: "/dashboard/user/agentsTerrain",
      });

      return rec;
    });

    return NextResponse.json({ success: true, message: "Livraison planifiée", data: reception }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rpv/receptions-packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";

/**
 * GET /api/caissier/historique-encaissements
 * Historique UNIFIÉ de tous les encaissements du périmètre du caissier :
 *  - Remboursements de crédit (CONFIRME)
 *  - Versements de packs (confirmés)
 *  - Ventes directes encaissées (comptant)
 *  - Opérations de caisse ENCAISSEMENT manuelles (ex. créées par un responsable)
 *
 * Params : ?aujourdHui=true | ?from=YYYY-MM-DD&to=YYYY-MM-DD · ?search= · ?page= · ?limit=
 */
type Item = {
  key: string;
  type: "REMBOURSEMENT_CREDIT" | "VERSEMENT_PACK" | "VENTE_DIRECTE" | "OPERATION_CAISSE";
  typeLabel: string;
  sourceId: number;
  client: string;
  libelle: string;
  reference: string;
  mode: string | null;
  montant: number;
  date: string;
  // Champs éditables
  editable?: boolean;            // remboursement crédit
  numeroJour?: number | null;
  observation?: string | null;
  agentCollecteurId?: number | null;
  montantMax?: number;          // versement pack (plafond de correction)
};

// Opérations de caisse auto-générées par les confirmations (à exclure pour éviter
// le double comptage avec leur source métier).
const MOTIF_AUTO = /^(remboursement|versement|vente)/i;

export async function GET(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.user.id);
    const isAdmin = auth.user.role === "ADMIN" || auth.user.role === "SUPER_ADMIN";
    const pdvId = isAdmin ? null : await getCaissierPdvId(userId);
    if (!isAdmin && !pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const aujourdHui = searchParams.get("aujourdHui") === "true";
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));

    // Bornes de la période
    const now = new Date();
    let gte: Date, lt: Date;
    if (aujourdHui || (!fromStr && !toStr)) {
      gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      lt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      gte = fromStr ? new Date(fromStr) : new Date(2000, 0, 1);
      const to = toStr ? new Date(toStr) : now;
      lt = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
    }
    const periode = { gte, lt };

    const creditScope = pdvId ? { credit: { client: { pointDeVenteId: pdvId } } } : {};
    const souscScope = pdvId ? { souscription: souscriptionPdvWhere(pdvId) } : {};
    const venteScope = pdvId ? { pointDeVenteId: pdvId } : {};
    const opScope = pdvId ? { session: { pointDeVenteId: pdvId } } : {};

    const [remboursements, versements, ventes, operations] = await Promise.all([
      prisma.remboursementCredit.findMany({
        where: { statut: "CONFIRME", dateRemboursement: periode, ...creditScope },
        select: { id: true, montant: true, dateRemboursement: true, modePaiement: true, numeroJour: true, notes: true, agentCollecteurId: true, credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } } },
        take: 1000,
      }),
      prisma.versementPack.findMany({
        where: { statut: { not: "EN_ATTENTE" }, datePaiement: periode, ...souscScope },
        select: { id: true, montant: true, datePaiement: true, type: true, reference: true, notes: true, souscription: { select: { montantTotal: true, pack: { select: { nom: true } }, client: { select: { nom: true, prenom: true } }, user: { select: { nom: true, prenom: true } } } } },
        take: 1000,
      }),
      prisma.venteDirecte.findMany({
        where: { createdAt: periode, statut: { in: ["PAID", "CONFIRMEE", "SORTIE_VALIDEE", "LIVREE"] }, ...venteScope },
        select: { id: true, reference: true, montantTotal: true, montantPaye: true, createdAt: true, modePaiement: true, clientNom: true, client: { select: { nom: true, prenom: true } } },
        take: 1000,
      }),
      prisma.operationCaisse.findMany({
        where: { type: "ENCAISSEMENT", createdAt: periode, ...opScope },
        select: { id: true, montant: true, motif: true, reference: true, mode: true, operateurNom: true, createdAt: true },
        take: 1000,
      }),
    ]);

    const items: Item[] = [];

    for (const r of remboursements) {
      items.push({
        key: `remb-${r.id}`, type: "REMBOURSEMENT_CREDIT", typeLabel: "Remboursement crédit", sourceId: r.id,
        client: `${r.credit.client.prenom} ${r.credit.client.nom}`,
        libelle: `Crédit ${r.credit.reference}`, reference: r.credit.reference,
        mode: r.modePaiement, montant: Number(r.montant), date: r.dateRemboursement.toISOString(),
        editable: true, numeroJour: r.numeroJour, observation: r.notes, agentCollecteurId: r.agentCollecteurId,
      });
    }
    for (const v of versements) {
      const p = v.souscription?.client ?? v.souscription?.user;
      items.push({
        key: `vers-${v.id}`, type: "VERSEMENT_PACK", typeLabel: "Versement pack", sourceId: v.id,
        client: p ? `${p.prenom} ${p.nom}` : "—",
        libelle: v.souscription?.pack?.nom ?? "Pack", reference: v.reference ?? "",
        mode: null, montant: Number(v.montant), date: v.datePaiement.toISOString(),
        observation: v.notes, montantMax: Number(v.souscription?.montantTotal ?? 0),
      });
    }
    for (const v of ventes) {
      items.push({
        key: `vente-${v.id}`, type: "VENTE_DIRECTE", typeLabel: "Vente directe", sourceId: v.id,
        client: v.client ? `${v.client.prenom} ${v.client.nom}` : (v.clientNom ?? "—"),
        libelle: `Vente ${v.reference}`, reference: v.reference,
        mode: v.modePaiement, montant: Number(v.montantPaye) || Number(v.montantTotal), date: v.createdAt.toISOString(),
      });
    }
    for (const o of operations) {
      if (MOTIF_AUTO.test(o.motif)) continue; // exclut les opérations dérivées d'une source
      items.push({
        key: `op-${o.id}`, type: "OPERATION_CAISSE", typeLabel: "Encaissement caisse", sourceId: o.id,
        client: o.operateurNom, libelle: o.motif, reference: o.reference,
        mode: o.mode, montant: Number(o.montant), date: o.createdAt.toISOString(),
      });
    }

    // Recherche plein-texte simple
    const filtres = search
      ? items.filter((i) => i.client.toLowerCase().includes(search) || i.libelle.toLowerCase().includes(search) || i.reference.toLowerCase().includes(search))
      : items;

    // Tri par date décroissante
    filtres.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Statistiques (sur l'ensemble filtré, avant pagination)
    const stats = {
      total: filtres.length,
      montantTotal: filtres.reduce((s, i) => s + i.montant, 0),
      parType: {
        REMBOURSEMENT_CREDIT: filtres.filter((i) => i.type === "REMBOURSEMENT_CREDIT").reduce((s, i) => s + i.montant, 0),
        VERSEMENT_PACK:       filtres.filter((i) => i.type === "VERSEMENT_PACK").reduce((s, i) => s + i.montant, 0),
        VENTE_DIRECTE:        filtres.filter((i) => i.type === "VENTE_DIRECTE").reduce((s, i) => s + i.montant, 0),
        OPERATION_CAISSE:     filtres.filter((i) => i.type === "OPERATION_CAISSE").reduce((s, i) => s + i.montant, 0),
      },
    };

    const totalPages = Math.max(1, Math.ceil(filtres.length / limit));
    const data = filtres.slice((page - 1) * limit, page * limit);

    return NextResponse.json({ data, stats, meta: { total: filtres.length, page, limit, totalPages } });
  } catch (error) {
    console.error("GET /api/caissier/historique-encaissements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCentreCommandementSession } from "@/lib/authCentreCommandement";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";

/**
 * Historique des documents (Centre de commandement) : liste chronologique de tous les documents
 * du CDC accessibles au rôle consultant, filtrée par période et paginée.
 * Périmètre identique à la recherche (Admin = tout ; RPV / Chef d'agence = leurs points de vente ;
 * RVC = national), avec les mêmes liens « Imprimer » / « Ouvrir la fiche ».
 *
 * GET /api/centre-commandement/historique?dateDebut=&dateFin=&type=&page=&limit=
 */

type Lien = { label: string; url: string };
type Ligne = { module: string; type: string; typeId: string; id: number; reference: string; sousLabel: string; statut: string | null; date: string; liens: Lien[] };

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Def {
  id: string;
  label: string;
  roles: string[] | null;   // null = tout rôle autorisé du centre ; [] = admin uniquement
  dateField: string;
  pdv?: (f: { in: number[] }) => any;
  findMany: (a: any) => Promise<any[]>;
  count: (a: any) => Promise<number>;
  include?: any;
  map: (r: any, admin: boolean) => Omit<Ligne, "typeId" | "type">;
}

const DEFS: Def[] = [
  {
    id: "bcc", label: "Bon de commande client", roles: ["AGENT_TERRAIN", "COMMERCIAL", "MAGAZINIER", "RESPONSABLE_VENTE_CREDIT", "RESPONSABLE_POINT_DE_VENTE"], dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }), include: { client: { select: { nom: true, prenom: true } } },
    findMany: (a) => prisma.commandeClient.findMany(a), count: (a) => prisma.commandeClient.count(a),
    map: (c, admin) => ({
      module: "§3.2", id: c.id, reference: c.reference, sousLabel: `${c.client.prenom} ${c.client.nom}`, statut: c.statut, date: c.createdAt.toISOString(),
      liens: [
        { label: "Imprimer", url: `/api/ventes/commandes-client/${c.id}/pdf` },
        { label: "Ouvrir la fiche", url: admin ? `/dashboard/admin/commandes-client?detail=${c.id}` : `/dashboard/user/responsablesVenteCredit/commandes-client?detail=${c.id}` },
      ],
    }),
  },
  {
    id: "bsm", label: "Bon de sortie de marchandises", roles: ["MAGAZINIER"], dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }),
    include: { commandeClient: { select: { client: { select: { nom: true, prenom: true } } } }, bonLivraison: { select: { clientNom: true } } },
    findMany: (a) => prisma.bonSortie.findMany(a), count: (a) => prisma.bonSortie.count(a),
    map: (b, admin) => {
      const client = b.commandeClient ? `${b.commandeClient.client.prenom} ${b.commandeClient.client.nom}` : b.bonLivraison?.clientNom ?? null;
      return {
        module: "§3.4", id: b.id, reference: b.reference, sousLabel: client ? `${client} — ${b.motif}` : b.motif, statut: b.statut, date: b.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/magasinier/bons-sortie/${b.id}/pdf` },
          { label: "Ouvrir la fiche", url: admin ? "/dashboard/admin/stock/sorties" : `/dashboard/user/magasiniers?detail=${b.id}` },
        ],
      };
    },
  },
  {
    id: "bl", label: "Bon de livraison", roles: ["MAGAZINIER"], dateField: "createdAt",
    pdv: (f) => ({ commandeClient: { pointDeVenteId: f } }),
    findMany: (a) => prisma.bonLivraison.findMany(a), count: (a) => prisma.bonLivraison.count(a),
    map: (b, admin) => ({
      module: "§5.2", id: b.id, reference: b.reference, sousLabel: b.clientNom, statut: null, date: b.createdAt.toISOString(),
      liens: admin
        ? [{ label: "Imprimer", url: `/api/bons-livraison/${b.id}/pdf` }, { label: "Ouvrir la fiche", url: "/dashboard/admin/stock/sorties" }]
        : [{ label: "Imprimer", url: `/api/bons-livraison/${b.id}/pdf` }],
    }),
  },
  {
    id: "br", label: "Bon de réception (client)", roles: ["AGENT_TERRAIN"], dateField: "createdAt",
    pdv: (f) => ({ commandeClient: { pointDeVenteId: f } }),
    findMany: (a) => prisma.bonReception.findMany(a), count: (a) => prisma.bonReception.count(a),
    map: (b, admin) => ({
      module: "§3.5", id: b.id, reference: b.reference, sousLabel: b.clientNom, statut: b.statut, date: b.createdAt.toISOString(),
      liens: admin
        ? [{ label: "Imprimer", url: `/api/bons-reception/${b.id}/pdf` }, { label: "Ouvrir la commande liée", url: "/dashboard/admin/commandes-client" }]
        : [{ label: "Imprimer", url: `/api/bons-reception/${b.id}/pdf` }],
    }),
  },
  {
    id: "dev", label: "Devis / Proforma", roles: ["AGENT_TERRAIN", "COMMERCIAL"], dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }), include: { client: { select: { nom: true, prenom: true } } },
    findMany: (a) => prisma.devisProforma.findMany(a), count: (a) => prisma.devisProforma.count(a),
    map: (d, admin) => ({
      module: "§5.2", id: d.id, reference: d.reference, sousLabel: `${d.type === "PROFORMA" ? "Proforma" : "Devis"} — ${d.client.prenom} ${d.client.nom}`, statut: d.statut, date: d.createdAt.toISOString(),
      liens: [
        { label: "Imprimer", url: `/api/ventes/devis-proforma/${d.id}/pdf` },
        { label: "Ouvrir la fiche", url: admin ? "/dashboard/admin/devis-proforma" : `/dashboard/user/agentsTerrain/devis-proforma?detail=${d.id}` },
      ],
    }),
  },
  {
    id: "fd", label: "Fiche de décaissement", roles: null, dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }),
    findMany: (a) => prisma.ficheDecaissement.findMany(a), count: (a) => prisma.ficheDecaissement.count(a),
    map: (fd, admin) => ({
      module: "§3.6", id: fd.id, reference: fd.reference, sousLabel: fd.beneficiaireNom, statut: fd.statut, date: fd.createdAt.toISOString(),
      liens: [
        { label: "Imprimer", url: `/api/decaissements/${fd.id}/pdf` },
        { label: "Ouvrir la fiche", url: admin ? "/dashboard/admin/decaissements" : `/dashboard/user/decaissements?detail=${fd.id}` },
      ],
    }),
  },
  {
    id: "brf", label: "Bordereau de remise de fonds", roles: ["AGENT_TERRAIN", "COMPTABLE", "CHEF_COMPTABLE"], dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }), include: { collecteur: { select: { nom: true, prenom: true } } },
    findMany: (a) => prisma.bordereauRemiseFonds.findMany(a), count: (a) => prisma.bordereauRemiseFonds.count(a),
    map: (b, admin) => ({
      module: "§3.1", id: b.id, reference: b.reference, sousLabel: `${b.collecteur.prenom} ${b.collecteur.nom}`, statut: b.statut, date: b.createdAt.toISOString(),
      liens: [
        { label: "Imprimer", url: `/api/tresorerie/bordereaux-remise/${b.id}/pdf` },
        { label: "Ouvrir la fiche", url: admin ? "/dashboard/admin/bordereaux-remise" : `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${b.id}` },
      ],
    }),
  },
  {
    id: "bcf", label: "Bon de commande fournisseur", roles: ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_ACHATS"], dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }), include: { fournisseur: { select: { nom: true } } },
    findMany: (a) => prisma.bonCommande.findMany(a), count: (a) => prisma.bonCommande.count(a),
    map: (b, admin) => ({
      module: "§3.3", id: b.id, reference: b.reference, sousLabel: b.fournisseur.nom, statut: b.statut, date: b.createdAt.toISOString(),
      liens: [
        { label: "Imprimer", url: `/api/logistique/bons-commande/${b.id}/pdf` },
        { label: "Ouvrir la fiche", url: admin ? `/dashboard/admin/bons-commande-fournisseur?detail=${b.id}` : `/dashboard/user/logistiquesApprovisionnements/bons-commande?detail=${b.id}` },
      ],
    }),
  },
  {
    id: "bci", label: "Bon de commande interne", roles: ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], dateField: "createdAt",
    pdv: (f) => ({ pointDeVenteId: f }),
    include: { demandeur: { select: { nom: true, prenom: true } }, pointDeVente: { select: { nom: true } } },
    findMany: (a) => prisma.commandeInterne.findMany(a), count: (a) => prisma.commandeInterne.count(a),
    map: (c, admin) => ({
      module: "§5.3", id: c.id, reference: c.reference, sousLabel: `${c.pointDeVente.nom} — ${c.demandeur.prenom} ${c.demandeur.nom}`, statut: c.statut, date: c.createdAt.toISOString(),
      liens: [{ label: "Ouvrir la fiche", url: admin ? `/dashboard/admin/commandes-internes?detail=${c.id}` : "/dashboard/user/logistiquesApprovisionnements/commandes-internes" }],
    }),
  },
  {
    id: "fa", label: "Facture fournisseur", roles: [], dateField: "dateFacture",
    include: { fournisseur: { select: { nom: true } } },
    findMany: (a) => prisma.factureAchat.findMany(a), count: (a) => prisma.factureAchat.count(a),
    map: (fa) => ({
      module: "§5.3", id: fa.id, reference: fa.numero, sousLabel: fa.fournisseur.nom, statut: fa.statutRapprochement, date: fa.dateFacture.toISOString(),
      liens: [{ label: "Ouvrir la fiche", url: "/dashboard/admin/factures-fournisseur" }],
    }),
  },
];

export async function GET(req: Request) {
  try {
    const session = await getCentreCommandementSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 20)));
    const typeFiltre = searchParams.get("type") || "";
    const debut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const finBrute = searchParams.get("dateFin") ? new Date(searchParams.get("dateFin")!) : null;
    const fin = finBrute ? new Date(new Date(finBrute).setHours(23, 59, 59, 999)) : null;

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const gRole = session.user.gestionnaireRole ?? null;
    const unscoped = isAdmin || gRole === "RESPONSABLE_VENTE_CREDIT";
    const pdvIds = unscoped ? null : await resolvePdvIdsAutorises(session);
    const pdvFiltre = unscoped ? undefined : { in: pdvIds ?? [] };

    const visibles = DEFS.filter((d) => (typeFiltre ? d.id === typeFiltre : true) && (
      isAdmin || (d.roles === null) || (!!gRole && d.roles.length > 0 && d.roles.includes(gRole))
    ));

    const parType = await Promise.all(visibles.map(async (d) => {
      const where: any = {
        ...(pdvFiltre && d.pdv ? d.pdv(pdvFiltre) : {}),
        ...((debut || fin) ? { [d.dateField]: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } } : {}),
      };
      const [lignes, total] = await Promise.all([
        // page × limit lignes les plus récentes de chaque type suffisent pour extraire la page fusionnée
        d.findMany({ where, orderBy: { [d.dateField]: "desc" }, take: page * limit, ...(d.include ? { include: d.include } : {}) }),
        d.count({ where }),
      ]);
      return { d, lignes, total };
    }));

    const fusion: Ligne[] = parType.flatMap(({ d, lignes }) => lignes.map((r) => ({ ...d.map(r, isAdmin), type: d.label, typeId: d.id })));
    fusion.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = parType.reduce((s, x) => s + x.total, 0);

    return NextResponse.json({
      data: fusion.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      types: DEFS.filter((d) => isAdmin || d.roles === null || (!!gRole && d.roles.length > 0 && d.roles.includes(gRole))).map((d) => ({ id: d.id, label: d.label })),
    });
  } catch (error) {
    console.error("GET /centre-commandement/historique:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

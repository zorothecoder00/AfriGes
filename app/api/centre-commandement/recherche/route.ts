import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCentreCommandementSession } from "@/lib/authCentreCommandement";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";

type Lien = { label: string; url: string };
type Resultat = {
  module: string;
  type: string;
  id: number;
  reference: string;
  sousLabel: string;
  statut: string | null;
  date: string;
  liens: Lien[];
};

const TAKE = 6;

/**
 * Centre de commandement (CDC digitalisation) — recherche transverse sur les
 * principaux documents créés dans le cadre du CDC : Admin/Super Admin voient
 * tout, RPV/Chef d'agence sont scopés à leur(s) point(s) de vente.
 * GET /api/centre-commandement/recherche?q=...
 */
export async function GET(req: Request) {
  try {
    const session = await getCentreCommandementSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });

    const pdvIds = await resolvePdvIdsAutorises(session);
    const isAdmin = pdvIds === null;
    const pdvFiltre = isAdmin ? undefined : { in: pdvIds ?? [] };
    const ci = { contains: q, mode: "insensitive" as const };

    const resultats: Resultat[] = [];

    const [
      bordereaux, commandesClient, bonsCommande, bonsSortie, bonsReception,
      decaissements, devisProforma, bonsLivraison, credits, revendeurs,
      commandesRevendeur, tournees, reclamations, retours, remplacements, incidents,
      facturesAchat,
    ] = await Promise.all([
      prisma.bordereauRemiseFonds.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { collecteur: { OR: [{ nom: ci }, { prenom: ci }] } }],
        },
        include: { collecteur: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.commandeClient.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { client: { OR: [{ nom: ci }, { prenom: ci }, { telephone: ci }] } }],
        },
        include: { client: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.bonCommande.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { fournisseur: { nom: ci } }],
        },
        include: { fournisseur: { select: { nom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.bonSortie.findMany({
        where: { ...(pdvFiltre && { pointDeVenteId: pdvFiltre }), reference: ci },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.bonReception.findMany({
        where: {
          ...(pdvFiltre && { commandeClient: { pointDeVenteId: pdvFiltre } }),
          OR: [{ reference: ci }, { clientNom: ci }, { clientTelephone: ci }],
        },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.ficheDecaissement.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { beneficiaireNom: ci }],
        },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.devisProforma.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { client: { OR: [{ nom: ci }, { prenom: ci }, { telephone: ci }] } }],
        },
        include: { client: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.bonLivraison.findMany({
        where: {
          ...(pdvFiltre && { commandeClient: { pointDeVenteId: pdvFiltre } }),
          OR: [{ reference: ci }, { clientNom: ci }, { clientTelephone: ci }],
        },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.creditClient.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { client: { OR: [{ nom: ci }, { prenom: ci }, { telephone: ci }] } }],
        },
        include: { client: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.profilRevendeur.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ raisonSociale: ci }, { nomCommercial: ci }, { contactNom: ci }, { contactTelephone: ci }],
        },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.commandeRevendeur.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ reference: ci }, { revendeur: { OR: [{ nom: ci }, { prenom: ci }] } }],
        },
        include: {
          revendeur: { select: { nom: true, prenom: true, profilRevendeur: { select: { id: true } } } },
          bonLivraison: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.tourneeLivraison.findMany({
        where: { ...(pdvFiltre && { pointDeVenteId: pdvFiltre }), reference: ci },
        include: { livreur: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.reclamationClient.findMany({
        where: {
          ...(pdvFiltre && { pointDeVenteId: pdvFiltre }),
          OR: [{ numero: ci }, { objet: ci }, { client: { OR: [{ nom: ci }, { prenom: ci }, { telephone: ci }] } }],
        },
        include: { client: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.retourMarchandiseClient.findMany({
        where: { ...(pdvFiltre && { pointDeVenteId: pdvFiltre }), numero: ci },
        include: { reclamation: { select: { id: true, numero: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.remplacementProduit.findMany({
        where: { ...(pdvFiltre && { pointDeVenteId: pdvFiltre }), numero: ci },
        include: { reclamation: { select: { id: true, numero: true } } },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      prisma.incidentCommercial.findMany({
        where: {
          ...(pdvFiltre && { reclamation: { pointDeVenteId: pdvFiltre } }),
          OR: [{ numero: ci }, { lieu: ci }],
        },
        orderBy: { createdAt: "desc" }, take: TAKE,
      }),
      // Facture fournisseur — pas de scope PDV (document comptable global), et
      // hors du périmètre RPV/Chef d'agence : réservé à la recherche admin.
      isAdmin
        ? prisma.factureAchat.findMany({
            where: { OR: [{ numero: ci }, { fournisseur: { nom: ci } }] },
            include: { fournisseur: { select: { nom: true } } },
            orderBy: { dateFacture: "desc" }, take: TAKE,
          })
        : Promise.resolve([]),
    ]);

    for (const b of bordereaux) {
      resultats.push({
        module: "§3.1", type: "Bordereau de remise de fonds", id: b.id, reference: b.reference,
        sousLabel: `${b.collecteur.prenom} ${b.collecteur.nom}`, statut: b.statut, date: b.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/tresorerie/bordereaux-remise/${b.id}/pdf` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/bordereaux-remise" : `/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${b.id}` },
        ],
      });
    }
    for (const c of commandesClient) {
      resultats.push({
        module: "§3.2", type: "Bon de commande client", id: c.id, reference: c.reference,
        sousLabel: `${c.client.prenom} ${c.client.nom}`, statut: c.statut, date: c.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/ventes/commandes-client/${c.id}/pdf` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/commandes-client" : `/dashboard/user/agentsTerrain/commandes-client?detail=${c.id}` },
        ],
      });
    }
    for (const bc of bonsCommande) {
      resultats.push({
        module: "§3.3", type: "Bon de commande fournisseur", id: bc.id, reference: bc.reference,
        sousLabel: bc.fournisseur.nom, statut: bc.statut, date: bc.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/logistique/bons-commande/${bc.id}/pdf` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/bons-commande-fournisseur" : `/dashboard/user/logistiquesApprovisionnements/bons-commande?detail=${bc.id}` },
        ],
      });
    }
    for (const bs of bonsSortie) {
      resultats.push({
        module: "§3.4", type: "Bon de sortie de marchandises", id: bs.id, reference: bs.reference,
        sousLabel: bs.motif, statut: bs.statut, date: bs.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/magasinier/bons-sortie/${bs.id}/pdf` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/stock/sorties" : `/dashboard/user/magasiniers?detail=${bs.id}` },
        ],
      });
    }
    for (const br of bonsReception) {
      resultats.push({
        module: "§3.5", type: "Bon de réception (client)", id: br.id, reference: br.reference,
        sousLabel: br.clientNom, statut: br.statut, date: br.createdAt.toISOString(),
        liens: isAdmin
          ? [{ label: "Imprimer", url: `/api/bons-reception/${br.id}/pdf` }, { label: "Ouvrir la commande liée", url: "/dashboard/admin/commandes-client" }]
          : [{ label: "Imprimer", url: `/api/bons-reception/${br.id}/pdf` }],
      });
    }
    for (const fd of decaissements) {
      resultats.push({
        module: "§3.6", type: "Fiche de décaissement", id: fd.id, reference: fd.reference,
        sousLabel: fd.beneficiaireNom, statut: fd.statut, date: fd.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/decaissements/${fd.id}/pdf` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/decaissements" : `/dashboard/user/decaissements?detail=${fd.id}` },
        ],
      });
    }
    for (const d of devisProforma) {
      resultats.push({
        module: "§5.2", type: d.type === "PROFORMA" ? "Proforma" : "Devis", id: d.id, reference: d.reference,
        sousLabel: `${d.client.prenom} ${d.client.nom}`, statut: d.statut, date: d.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/ventes/devis-proforma/${d.id}/pdf` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/devis-proforma" : `/dashboard/user/agentsTerrain/devis-proforma?detail=${d.id}` },
        ],
      });
    }
    for (const bl of bonsLivraison) {
      resultats.push({
        module: "§5.2", type: "Bon de livraison", id: bl.id, reference: bl.reference,
        sousLabel: bl.clientNom, statut: null, date: bl.createdAt.toISOString(),
        liens: isAdmin
          ? [{ label: "Imprimer", url: `/api/bons-livraison/${bl.id}/pdf` }, { label: "Ouvrir la fiche", url: "/dashboard/admin/stock/sorties" }]
          : [{ label: "Imprimer", url: `/api/bons-livraison/${bl.id}/pdf` }],
      });
    }
    for (const cr of credits) {
      const liens: Lien[] = [
        { label: "Avis d'échéance", url: `/api/admin/credits/${cr.id}/avis-echeance/pdf` },
        { label: "Ouvrir le dossier", url: `/dashboard/admin/credits?detail=${cr.id}` },
      ];
      if (Number(cr.soldeRestant) <= 0) {
        liens.push({ label: "Attestation de solde", url: `/api/admin/credits/${cr.id}/attestation-solde/pdf` });
      }
      resultats.push({
        module: "§5.4", type: "Dossier de crédit", id: cr.id, reference: cr.reference,
        sousLabel: `${cr.client.prenom} ${cr.client.nom}`, statut: cr.statut, date: cr.createdAt.toISOString(),
        liens,
      });
    }
    for (const r of revendeurs) {
      resultats.push({
        module: "§5.6", type: "Compte revendeur", id: r.id, reference: r.raisonSociale,
        sousLabel: r.nomCommercial || r.contactNom || "", statut: r.statut, date: r.createdAt.toISOString(),
        liens: [
          { label: "Fiche d'ouverture", url: `/api/admin/revendeurs/${r.id}/pdf?variante=OUVERTURE` },
          { label: "Carte pro", url: `/api/admin/revendeurs/${r.id}/pdf?variante=CARTE` },
          { label: "Relevé de compte", url: `/api/admin/revendeurs/${r.id}/releve/pdf` },
          { label: "Ouvrir la fiche", url: `/dashboard/admin/revendeurs?detail=${r.id}` },
        ],
      });
    }
    for (const cmr of commandesRevendeur) {
      const profilId = cmr.revendeur.profilRevendeur?.id;
      const liens: Lien[] = [];
      if (profilId) {
        liens.push({ label: "Bon de commande", url: `/api/admin/revendeurs/${profilId}/commandes/${cmr.id}/pdf` });
        if (cmr.bonLivraison) liens.push({ label: "Bon de livraison", url: `/api/admin/revendeurs/${profilId}/commandes/${cmr.id}/bon-livraison/pdf` });
        if (cmr.factureId) liens.push({ label: "Facture", url: `/api/admin/revendeurs/${profilId}/commandes/${cmr.id}/facture/pdf` });
      }
      resultats.push({
        module: "§5.6", type: "Bon de commande revendeur", id: cmr.id, reference: cmr.reference,
        sousLabel: `${cmr.revendeur.prenom} ${cmr.revendeur.nom}`, statut: cmr.statut, date: cmr.createdAt.toISOString(),
        liens,
      });
    }
    for (const t of tournees) {
      resultats.push({
        module: "§5.7", type: "Tournée de livraison", id: t.id, reference: t.reference,
        sousLabel: `${t.livreur.prenom} ${t.livreur.nom}`, statut: t.statut, date: t.createdAt.toISOString(),
        liens: [
          { label: "Fiche de mission", url: `/api/logistique/tournees/${t.id}/pdf?variante=MISSION` },
          { label: "Bordereau de livraison", url: `/api/logistique/tournees/${t.id}/pdf?variante=BORDEREAU` },
          { label: "Ouvrir la fiche", url: isAdmin ? "/dashboard/admin/tournees" : `/dashboard/user/logistiquesApprovisionnements/tournees?tournee=${t.id}` },
        ],
      });
    }
    for (const r of reclamations) {
      resultats.push({
        module: "§5.8", type: "Réclamation client", id: r.id, reference: r.numero,
        sousLabel: `${r.client.prenom} ${r.client.nom} — ${r.objet}`, statut: r.statut, date: r.createdAt.toISOString(),
        liens: [
          { label: "Formulaire", url: `/api/admin/reclamations/${r.id}/pdf` },
          { label: "Fiche de traitement", url: `/api/admin/reclamations/${r.id}/traitement/pdf` },
          { label: "Ouvrir la fiche", url: `/dashboard/admin/reclamations?detail=${r.id}` },
        ],
      });
    }
    for (const ret of retours) {
      resultats.push({
        module: "§5.8", type: "Retour marchandise", id: ret.id, reference: ret.numero,
        sousLabel: `Réclamation ${ret.reclamation.numero}`, statut: ret.statut, date: ret.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/admin/reclamations/${ret.reclamation.id}/retours/${ret.id}/pdf` },
          { label: "Ouvrir la réclamation", url: `/dashboard/admin/reclamations?detail=${ret.reclamation.id}` },
        ],
      });
    }
    for (const rp of remplacements) {
      resultats.push({
        module: "§5.8", type: "Bon de remplacement", id: rp.id, reference: rp.numero,
        sousLabel: `Réclamation ${rp.reclamation.numero}`, statut: rp.statut, date: rp.createdAt.toISOString(),
        liens: [
          { label: "Imprimer", url: `/api/admin/reclamations/${rp.reclamation.id}/remplacements/${rp.id}/pdf` },
          { label: "Ouvrir la réclamation", url: `/dashboard/admin/reclamations?detail=${rp.reclamation.id}` },
        ],
      });
    }
    for (const inc of incidents) {
      resultats.push({
        module: "§5.8", type: "Rapport d'incident", id: inc.id, reference: inc.numero,
        sousLabel: inc.lieu, statut: inc.statut, date: inc.createdAt.toISOString(),
        liens: [{ label: "Imprimer", url: `/api/admin/reclamations/incidents/${inc.id}/pdf` }],
      });
    }
    for (const fa of facturesAchat) {
      resultats.push({
        module: "§5.3", type: "Facture fournisseur", id: fa.id, reference: fa.numero,
        sousLabel: fa.fournisseur.nom, statut: fa.statutRapprochement, date: fa.dateFacture.toISOString(),
        liens: [{ label: "Ouvrir la fiche", url: "/dashboard/admin/factures-fournisseur" }],
      });
    }

    resultats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json({ data: resultats });
  } catch (error) {
    console.error("GET /centre-commandement/recherche:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * Alertes stock automatiques poussées (CDC Approvisionnement §12).
 *
 * Les niveaux (rupture/critique/faible/surstock/casse) et la péremption sont
 * déjà calculés à la volée côté UI (lib/etatStock.ts, lib/lotsFefo.ts) — ce
 * module ajoute la poussée automatique (notification in-app) via un cron
 * quotidien :
 *  - Résumé par site (rupture/faible/surstock/casse + péremption 3 paliers
 *    90/60/30j), avec les produits concernés et une action recommandée simple
 *    ("commander N unités" = écart au stock max, à défaut du seuil de sécurité).
 *  - Rupture agence → suggestion de transfert depuis un autre site en surplus.
 *  - Fournisseur en retard (PO non livré après la date prévue) → notification
 *    Admin/DG, indépendamment des sites.
 * Déduplication quotidienne (une notification par site/fournisseur par jour).
 */

import { prisma } from "@/lib/prisma";
import { notifyRoles, notifyAdmins } from "@/lib/notifications";
import { etatStock } from "@/lib/etatStock";
import { PrioriteNotification } from "@prisma/client";

const ROLES_CIBLES = ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"];
const MAX_PRODUITS_DETAIL = 5; // limite la longueur des messages

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface LigneRupture {
  produitId: number; produitNom: string; quantite: number; actionRecommandee: string;
}
interface ResumeSite {
  pointDeVenteId: number;
  nom: string;
  ruptures: LigneRupture[];
  faibles: number;
  surstocks: number;
  casses: number;
  perime: number;
  bientot30: number;
  bientot60: number;
  bientot90: number;
}

async function dejaAlerteAujourdhui(titre: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: { titre, createdAt: { gte: todayStart() } },
    select: { id: true },
  });
  return !!existing;
}

/** Cherche un autre site avec un surplus du même produit, pour suggérer un transfert. */
function trouverSourceTransfert(
  produitId: number,
  pointDeVenteIdExclu: number,
  stockParProduit: Map<number, { pointDeVenteId: number; nom: string; quantite: number; seuil: number }[]>,
): { nom: string; quantite: number } | null {
  const sites = stockParProduit.get(produitId) ?? [];
  const candidats = sites
    .filter((s) => s.pointDeVenteId !== pointDeVenteIdExclu && s.quantite > s.seuil * 1.5 && s.quantite > 0)
    .sort((a, b) => b.quantite - a.quantite);
  return candidats.length > 0 ? { nom: candidats[0].nom, quantite: candidats[0].quantite } : null;
}

export async function runAlertesStock(): Promise<{ sites: number; notifies: number; fournisseursEnRetard: number }> {
  const now = new Date();
  const [lignesStock, lots, posEnRetard] = await Promise.all([
    prisma.stockSite.findMany({
      where: { disponible: true },
      select: {
        pointDeVenteId: true, produitId: true,
        quantite: true, stockMin: true, stockMax: true, seuilCritique: true,
        alerteStock: true, quantiteEndommagee: true,
        produit: { select: { nom: true } },
        pointDeVente: { select: { id: true, nom: true, actif: true } },
      },
    }),
    prisma.lotProduit.findMany({
      where: { statut: "ACTIF", quantite: { gt: 0 }, dlc: { not: null } },
      select: { pointDeVenteId: true, dlc: true, pointDeVente: { select: { id: true, nom: true, actif: true } } },
    }),
    prisma.bonCommande.findMany({
      where: {
        dateLivraisonPrevue: { lt: now },
        statut: { notIn: ["COMPLETED", "CANCELLED", "DRAFT", "PENDING_APPROVAL"] },
        // statutLivraison nullable : NOT IN exclut les NULL en SQL, donc OR explicite
        // pour couvrir les PO pas encore expédiés (le cas de retard le plus fréquent).
        OR: [{ statutLivraison: null }, { statutLivraison: { notIn: ["LIVREE", "RECEPTIONNEE"] } }],
      },
      select: {
        id: true, reference: true, dateLivraisonPrevue: true,
        fournisseur: { select: { id: true, nom: true } },
        pointDeVente: { select: { nom: true } },
      },
    }),
  ]);

  // Index produit → sites disponibles (pour suggestion de transfert).
  const stockParProduit = new Map<number, { pointDeVenteId: number; nom: string; quantite: number; seuil: number }[]>();
  for (const s of lignesStock) {
    if (!s.pointDeVente?.actif) continue;
    const seuil = s.stockMin ?? s.seuilCritique ?? s.alerteStock ?? 0;
    const arr = stockParProduit.get(s.produitId) ?? [];
    arr.push({ pointDeVenteId: s.pointDeVenteId, nom: s.pointDeVente.nom, quantite: s.quantite, seuil });
    stockParProduit.set(s.produitId, arr);
  }

  const resumes = new Map<number, ResumeSite>();
  const getResume = (id: number, nom: string): ResumeSite => {
    let r = resumes.get(id);
    if (!r) {
      r = { pointDeVenteId: id, nom, ruptures: [], faibles: 0, surstocks: 0, casses: 0, perime: 0, bientot30: 0, bientot60: 0, bientot90: 0 };
      resumes.set(id, r);
    }
    return r;
  };

  for (const s of lignesStock) {
    if (!s.pointDeVente?.actif) continue;
    const r = getResume(s.pointDeVenteId, s.pointDeVente.nom);
    const etat = etatStock({ quantite: s.quantite, seuilCritique: s.seuilCritique, stockMin: s.stockMin, alerteStock: s.alerteStock });
    if (etat.niveau === "RUPTURE" || etat.niveau === "CRITIQUE") {
      const cible = s.stockMax ?? (s.stockMin != null ? s.stockMin * 2 : null) ?? (s.seuilCritique != null ? s.seuilCritique * 3 : 0);
      const aCommander = Math.max(0, Math.round(cible - s.quantite));
      r.ruptures.push({
        produitId: s.produitId, produitNom: s.produit.nom, quantite: s.quantite,
        actionRecommandee: aCommander > 0 ? `commander ${aCommander} unité(s)` : "vérifier le réapprovisionnement",
      });
    } else if (etat.niveau === "FAIBLE") {
      r.faibles++;
    }
    if (s.stockMax != null && s.stockMax > 0 && s.quantite > s.stockMax) r.surstocks++;
    if (s.quantiteEndommagee > 0) r.casses++;
  }

  for (const l of lots) {
    if (!l.pointDeVente?.actif) continue;
    const r = getResume(l.pointDeVenteId, l.pointDeVente.nom);
    const joursRestants = Math.floor((new Date(l.dlc!).getTime() - now.getTime()) / 86_400_000);
    if (joursRestants < 0) r.perime++;
    else if (joursRestants <= 30) r.bientot30++;
    else if (joursRestants <= 60) r.bientot60++;
    else if (joursRestants <= 90) r.bientot90++;
  }

  let notifies = 0;
  for (const r of resumes.values()) {
    const total = r.ruptures.length + r.faibles + r.surstocks + r.casses + r.perime + r.bientot30 + r.bientot60 + r.bientot90;
    if (total === 0) continue;

    const titre = `Alertes stock — ${r.nom}`;
    if (await dejaAlerteAujourdhui(titre)) continue;

    const parts: string[] = [];
    if (r.ruptures.length) {
      const detail = r.ruptures.slice(0, MAX_PRODUITS_DETAIL).map((l) => {
        const source = trouverSourceTransfert(l.produitId, r.pointDeVenteId, stockParProduit);
        const suggestion = source ? ` — transfert possible depuis ${source.nom} (stock: ${source.quantite})` : ` — ${l.actionRecommandee}`;
        return `${l.produitNom} (stock: ${l.quantite})${suggestion}`;
      }).join(" ; ");
      parts.push(`${r.ruptures.length} produit(s) en rupture/critique : ${detail}`);
    }
    if (r.faibles)    parts.push(`${r.faibles} produit(s) en stock faible`);
    if (r.surstocks)  parts.push(`${r.surstocks} produit(s) en surstock`);
    if (r.casses)      parts.push(`${r.casses} produit(s) avec casse/dommage`);
    if (r.perime)      parts.push(`${r.perime} lot(s) périmé(s)`);
    if (r.bientot30)   parts.push(`${r.bientot30} lot(s) périmant sous 30j`);
    if (r.bientot60)   parts.push(`${r.bientot60} lot(s) périmant sous 60j`);
    if (r.bientot90)   parts.push(`${r.bientot90} lot(s) périmant sous 90j`);

    const priorite = (r.ruptures.length > 0 || r.perime > 0 || r.bientot30 > 0) ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL;

    await prisma.$transaction(async (tx) => {
      await notifyRoles(tx, ROLES_CIBLES, {
        titre,
        message: parts.join(" | ") + ".",
        priorite,
        actionUrl: `/dashboard/user/logistiquesApprovisionnements/dashboard`,
      });
    });
    notifies++;
  }

  // ── Fournisseur en retard → notification DG/admin (CDC §12) ────────────
  const parFournisseur = new Map<number, { nom: string; pos: string[] }>();
  for (const po of posEnRetard) {
    if (!po.fournisseur) continue;
    const e = parFournisseur.get(po.fournisseur.id) ?? { nom: po.fournisseur.nom, pos: [] };
    e.pos.push(`${po.reference} (${po.pointDeVente.nom})`);
    parFournisseur.set(po.fournisseur.id, e);
  }
  let fournisseursEnRetard = 0;
  for (const [, f] of parFournisseur) {
    const titre = `Fournisseur en retard — ${f.nom}`;
    if (await dejaAlerteAujourdhui(titre)) continue;
    await prisma.$transaction(async (tx) => {
      await notifyAdmins(tx, {
        titre,
        message: `${f.nom} a ${f.pos.length} bon(s) de commande non livré(s) au-delà de la date prévue : ${f.pos.slice(0, MAX_PRODUITS_DETAIL).join(", ")}.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/user/logistiquesApprovisionnements/bons-commande`,
      });
    });
    fournisseursEnRetard++;
  }

  return { sites: resumes.size, notifies, fournisseursEnRetard };
}

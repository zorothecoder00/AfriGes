import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * Agrégations serveur pour les onglets gouvernance « terrain / audit »
 * (cartographie, activités, risques, clients, performance).
 *
 * Pourquoi cet endpoint : ces pages chargeaient la liste des affectations
 * (`/api/admin/ria/affectations?limit=100|200`) et calculaient leurs stats
 * côté client. Or cette API est plafonnée à 50 lignes → les agrégats étaient
 * à la fois faux (jeu tronqué) et lents (include lourd + calcul d'encours par
 * ligne, payload volumineux). Ici on calcule tout en base sur l'INTÉGRALITÉ des
 * affectations avec un `select` minimal, et on ne renvoie qu'un petit payload :
 * agrégats prêts à afficher + une liste de lignes bornée pour les tableaux.
 */

const ROWS_LIMIT = 300; // borne haute pour les tableaux de détail

type FinRow = { montantFinance: unknown; montantRembourse: unknown; statut: string };
type AffRow = {
  id: number;
  actif: boolean;
  classeRisque: string;
  dateDebut: Date;
  client: {
    nom: string;
    prenom: string;
    telephone: string | null;
    ville: string | null;
    quartier: string | null;
    activite: string | null;
    pointDeVente: { nom: string } | null;
  } | null;
  portefeuille: {
    reference: string;
    profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } };
  };
  financements: FinRow[];
};

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const affectations = (await prisma.affectationClientRIA.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        actif: true,
        classeRisque: true,
        dateDebut: true,
        client: {
          select: {
            nom: true,
            prenom: true,
            telephone: true,
            ville: true,
            quartier: true,
            activite: true,
            pointDeVente: { select: { nom: true } },
          },
        },
        portefeuille: {
          select: {
            reference: true,
            profilRIA: {
              select: {
                gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
              },
            },
          },
        },
        financements: { select: { montantFinance: true, montantRembourse: true, statut: true } },
      },
    })) as unknown as AffRow[];

    const toNum = (v: unknown) => Number(v ?? 0);

    // Alias géographiques attendus par les pages : commune/region/secteur.
    const region  = (a: AffRow) => a.client?.ville ?? null;
    const commune = (a: AffRow) => a.client?.quartier ?? a.client?.ville ?? null;
    const secteur = (a: AffRow) => a.client?.activite ?? null;
    const finSum  = (a: AffRow, k: "montantFinance" | "montantRembourse") =>
      a.financements.reduce((s, f) => s + toNum(f[k]), 0);
    const enRetard = (a: AffRow) => a.financements.some((f) => f.statut === "EN_RETARD");
    const investisseurNom = (a: AffRow) =>
      `${a.portefeuille.profilRIA.gestionnaire.member.prenom} ${a.portefeuille.profilRIA.gestionnaire.member.nom}`;

    const total   = affectations.length;
    const actifs  = affectations.filter((a) => a.actif).length;

    // ── Cartographie / activités : géographie ────────────────────────────────
    const regionMap  = new Map<string, { count: number; actifs: number; montant: number }>();
    const communeMap = new Map<string, { count: number; montant: number }>();
    const secteurMap = new Map<string, number>();

    for (const a of affectations) {
      const m = finSum(a, "montantFinance");

      const rk = region(a) ?? "Inconnue";
      const rg = regionMap.get(rk) ?? { count: 0, actifs: 0, montant: 0 };
      rg.count++; if (a.actif) rg.actifs++; rg.montant += m;
      regionMap.set(rk, rg);

      const ck = commune(a) ?? "Inconnue";
      const cg = communeMap.get(ck) ?? { count: 0, montant: 0 };
      cg.count++; cg.montant += m;
      communeMap.set(ck, cg);

      const sk = secteur(a) ?? "Non renseigné";
      secteurMap.set(sk, (secteurMap.get(sk) ?? 0) + 1);
    }

    const byRegion = Array.from(regionMap, ([label, v]) => ({ label, ...v })).sort((a, b) => b.count - a.count);
    const byCommune = Array.from(communeMap, ([label, v]) => ({ label, ...v })).sort((a, b) => b.count - a.count);
    const bySecteur = Array.from(secteurMap, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    // ── Risques : par classe (enum A→E) ──────────────────────────────────────
    const risqueMap = new Map<string, { count: number; montant: number; recouvre: number }>();
    for (const a of affectations) {
      const g = risqueMap.get(a.classeRisque) ?? { count: 0, montant: 0, recouvre: 0 };
      g.count++;
      g.montant  += finSum(a, "montantFinance");
      g.recouvre += finSum(a, "montantRembourse");
      risqueMap.set(a.classeRisque, g);
    }
    const byRisque = ["A", "B", "C", "D", "E"].map((key) => ({
      key,
      ...(risqueMap.get(key) ?? { count: 0, montant: 0, recouvre: 0 }),
    }));

    // ── Clients/affectations en retard ───────────────────────────────────────
    const retardItems = affectations
      .filter(enRetard)
      .map((a) => ({
        id: a.id,
        nom: a.client ? `${a.client.prenom} ${a.client.nom}` : "—",
        commune: commune(a),
        classeRisque: a.classeRisque,
      }));

    // ── Performance : classement par portefeuille (affectations actives) ──────
    const pfMap = new Map<string, { nom: string; clients: number; montant: number; recouvre: number }>();
    for (const a of affectations) {
      if (!a.actif) continue;
      const key = a.portefeuille.reference;
      const g = pfMap.get(key) ?? { nom: investisseurNom(a), clients: 0, montant: 0, recouvre: 0 };
      g.clients++;
      g.montant  += finSum(a, "montantFinance");
      g.recouvre += finSum(a, "montantRembourse");
      pfMap.set(key, g);
    }
    const portefeuilles = Array.from(pfMap, ([reference, v]) => ({
      reference,
      ...v,
      taux: v.montant > 0 ? (v.recouvre / v.montant) * 100 : 0,
    })).sort((a, b) => b.taux - a.taux);

    // ── Lignes de détail (bornées) pour les tableaux ─────────────────────────
    const rows = affectations.slice(0, ROWS_LIMIT).map((a) => {
      const montant  = finSum(a, "montantFinance");
      const recouvre = finSum(a, "montantRembourse");
      return {
        id: a.id,
        actif: a.actif,
        classeRisque: a.classeRisque,
        dateDebut: a.dateDebut,
        clientNom: a.client?.nom ?? "",
        clientPrenom: a.client?.prenom ?? "",
        telephone: a.client?.telephone ?? null,
        commune: commune(a),
        region: region(a),
        secteur: secteur(a),
        pdv: a.client?.pointDeVente?.nom ?? null,
        portefeuilleRef: a.portefeuille.reference,
        investisseur: investisseurNom(a),
        montant,
        recouvre,
        statuts: Array.from(new Set(a.financements.map((f) => f.statut))),
        enRetard: enRetard(a),
        nbFinancements: a.financements.length,
      };
    });

    return NextResponse.json({
      data: {
        total,
        actifs,
        byRegion,
        byCommune,
        bySecteur,
        byRisque,
        enRetard: { count: retardItems.length, items: retardItems },
        portefeuilles,
        rowsTotal: total,
        rowsTruncated: total > ROWS_LIMIT,
        rows,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/gouvernance/terrain-stats", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

export const runtime = "nodejs";

const MAX_JOURS = 92; // ~3 mois
const JOUR_MS = 86_400_000;

type Source = "SESSION" | "REMBOURSEMENT" | "VERSEMENT_PACK" | "VENTE" | "CARNET";
interface Item {
  id: string; source: Source; date: string; montant: number; mode: string;
  reference: string | null; client: string | null; enAttenteConfirmation?: boolean;
}

const SOURCE_LABEL: Record<Source, string> = {
  SESSION: "Sessions de collecte", REMBOURSEMENT: "Remboursements crédit (hors session)",
  VERSEMENT_PACK: "Versements packs directs", VENTE: "Ventes", CARNET: "Ventes de carnet",
};
const cle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nomClient = (c: { nom: string; prenom: string } | null | undefined) => (c ? `${c.prenom} ${c.nom}`.trim() : null);

/**
 * GET /api/agentTerrain/fonds-collectes?dateDebut=YYYY-MM-DD&dateFin=YYYY-MM-DD
 * L'agent lit lui-même les fonds qu'il a collectés sur une période (3 mois maximum) : encaissements
 * de ses sessions de collecte, remboursements crédit hors session, versements packs directs, ventes et
 * carnets — dédoublonnés — puis ce qu'il a déjà remis via ses bordereaux de remise de fonds.
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const agentId = parseInt(session.user.id);

    const { searchParams } = new URL(req.url);
    const finBrute = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
    const debutBrut = searchParams.get("dateDebut") ? new Date(`${searchParams.get("dateDebut")}T00:00:00`) : new Date(finBrute.getTime() - 29 * JOUR_MS);
    if (isNaN(debutBrut.getTime()) || isNaN(finBrute.getTime()) || debutBrut > finBrute) {
      return NextResponse.json({ error: "Période invalide" }, { status: 400 });
    }
    if ((finBrute.getTime() - debutBrut.getTime()) / JOUR_MS > MAX_JOURS) {
      return NextResponse.json({ error: "La période ne peut pas dépasser 3 mois" }, { status: 400 });
    }
    const debut = debutBrut;
    const finExclue = new Date(finBrute.getTime() + JOUR_MS);

    // ── A. Sessions de collecte (journal de l'agent) ──────────────────────────
    const sessions = await prisma.collecteJournaliere.findMany({
      where: { agentId, statut: { not: "ANNULEE" }, dateCollecte: { gte: debut, lt: finExclue } },
      select: {
        id: true, reference: true, dateCollecte: true,
        lignes: {
          where: { statut: { in: ["COLLECTE", "PARTIEL"] }, type: { in: ["PACK", "CREDIT", "VENTE", "CARNET"] }, montantCollecte: { gt: 0 } },
          select: { id: true, type: true, montantCollecte: true, modePaiement: true, creditId: true, venteDirecteId: true, venteCarnetId: true, client: { select: { nom: true, prenom: true } } },
        },
      },
    });
    const items: Item[] = [];
    const cleCredit = new Set<string>();
    const ventesEnSession = new Set<number>();
    const carnetsEnSession = new Set<number>();
    for (const s of sessions) {
      for (const l of s.lignes) {
        const montant = Number(l.montantCollecte);
        if (l.type === "CREDIT" && l.creditId) cleCredit.add(`${l.creditId}|${montant}|${cle(s.dateCollecte)}`);
        if (l.type === "VENTE" && l.venteDirecteId) ventesEnSession.add(l.venteDirecteId);
        if (l.type === "CARNET" && l.venteCarnetId) carnetsEnSession.add(l.venteCarnetId);
        items.push({ id: `lig-${l.id}`, source: "SESSION", date: s.dateCollecte.toISOString(), montant, mode: l.modePaiement ?? "ESPECES", reference: s.reference, client: nomClient(l.client) });
      }
    }

    // ── B. Remboursements crédit enregistrés à son nom hors session ───────────
    const remboursements = await prisma.remboursementCredit.findMany({
      where: {
        OR: [{ agentCollecteurId: agentId }, { enregistreParId: agentId }],
        statut: { in: ["CONFIRME", "EN_ATTENTE_CAISSIER"] },
        modePaiement: { in: ["ESPECES", "VIREMENT", "CHEQUE", "MOBILE_MONEY"] },
        dateRemboursement: { gte: debut, lt: finExclue },
      },
      select: { id: true, creditId: true, montant: true, dateRemboursement: true, modePaiement: true, statut: true, credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } } },
    });
    for (const r of remboursements) {
      const montant = Number(r.montant);
      if (cleCredit.has(`${r.creditId}|${montant}|${cle(r.dateRemboursement)}`)) continue; // déjà compté via la session
      items.push({ id: `rmb-${r.id}`, source: "REMBOURSEMENT", date: r.dateRemboursement.toISOString(), montant, mode: r.modePaiement, reference: r.credit?.reference ?? null, client: nomClient(r.credit?.client), enAttenteConfirmation: r.statut === "EN_ATTENTE_CAISSIER" });
    }

    // ── C. Versements packs directs (hors sessions) ───────────────────────────
    const versements = await prisma.versementPack.findMany({
      where: { encaisseParId: agentId, statut: "PAYE", type: { in: ["COTISATION_INITIALE", "VERSEMENT_PERIODIQUE"] }, ligneCollecte: { is: null }, datePaiement: { gte: debut, lt: finExclue } },
      select: { id: true, montant: true, datePaiement: true, reference: true, souscription: { select: { client: { select: { nom: true, prenom: true } } } } },
    });
    for (const v of versements) {
      items.push({ id: `vrs-${v.id}`, source: "VERSEMENT_PACK", date: v.datePaiement.toISOString(), montant: Number(v.montant), mode: "NON_PRECISE", reference: v.reference, client: nomClient(v.souscription?.client) });
    }

    // ── D. Ventes directes encaissées (hors crédit / wallet) ──────────────────
    const ventes = await prisma.venteDirecte.findMany({
      where: { vendeurId: agentId, statut: { in: ["PAID", "CONFIRMEE", "SORTIE_VALIDEE", "LIVREE"] }, modePaiement: { in: ["ESPECES", "VIREMENT", "CHEQUE", "MOBILE_MONEY"] }, createdAt: { gte: debut, lt: finExclue } },
      select: { id: true, reference: true, createdAt: true, montantTotal: true, modePaiement: true, clientNom: true },
    });
    for (const v of ventes) {
      if (ventesEnSession.has(v.id)) continue;
      items.push({ id: `vnt-${v.id}`, source: "VENTE", date: v.createdAt.toISOString(), montant: Number(v.montantTotal), mode: v.modePaiement, reference: v.reference, client: v.clientNom ?? null });
    }

    // ── E. Ventes de carnet ───────────────────────────────────────────────────
    const carnets = await prisma.venteCarnet.findMany({
      where: { agentId, dateVente: { gte: debut, lt: finExclue } },
      select: { id: true, reference: true, montant: true, dateVente: true },
    });
    for (const c of carnets) {
      if (carnetsEnSession.has(c.id)) continue;
      items.push({ id: `car-${c.id}`, source: "CARNET", date: c.dateVente.toISOString(), montant: Number(c.montant), mode: "NON_PRECISE", reference: c.reference, client: null });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ── Remis : bordereaux de remise de fonds de la période ───────────────────
    const bordereaux = await prisma.bordereauRemiseFonds.findMany({
      where: { collecteurId: agentId, createdAt: { gte: debut, lt: finExclue } },
      select: { id: true, reference: true, statut: true, createdAt: true, totalBilletageCalcule: true, cotisationsMobileMoney: true, montantVirement: true },
      orderBy: { createdAt: "desc" },
    });
    const bordereauxOut = bordereaux.map((b) => ({
      id: b.id, reference: b.reference, statut: b.statut, date: b.createdAt.toISOString(),
      montant: Number(b.totalBilletageCalcule) + Number(b.cotisationsMobileMoney) + Number(b.montantVirement),
    }));

    // ── Agrégats ──────────────────────────────────────────────────────────────
    const collecte = items.reduce((s, i) => s + i.montant, 0);
    const remis = bordereauxOut.reduce((s, b) => s + b.montant, 0);
    const agreger = (cleFn: (i: Item) => string) => {
      const m = new Map<string, { montant: number; nombre: number }>();
      for (const i of items) { const k = cleFn(i); const a = m.get(k) ?? { montant: 0, nombre: 0 }; a.montant += i.montant; a.nombre += 1; m.set(k, a); }
      return m;
    };
    const parSource = [...agreger((i) => i.source)].map(([k, a]) => ({ source: k, libelle: SOURCE_LABEL[k as Source], ...a })).sort((a, b) => b.montant - a.montant);
    const parMode = [...agreger((i) => i.mode)].map(([mode, a]) => ({ mode, ...a })).sort((a, b) => b.montant - a.montant);
    const parJour = [...agreger((i) => cle(new Date(i.date)))].map(([jour, a]) => ({ jour, ...a })).sort((a, b) => b.jour.localeCompare(a.jour));

    return NextResponse.json({
      data: {
        periode: { debut: cle(debut), fin: cle(finBrute) },
        totaux: { collecte, remis, reste: collecte - remis, nombre: items.length },
        parSource, parMode, parJour,
        lignes: items.slice(0, 500), tronque: items.length > 500,
        bordereaux: bordereauxOut,
      },
    });
  } catch (error) {
    console.error("GET /agentTerrain/fonds-collectes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

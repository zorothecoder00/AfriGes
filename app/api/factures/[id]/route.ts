import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { getCaissierSession } from "@/lib/authCaissier";
import { getRPVSession } from "@/lib/authRPV";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getRVCSession } from "@/lib/authRVC";
import { getChefAgenceSession } from "@/lib/authChefAgence";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  return (
    (await getAdminSession()) ??
    (await getCaissierSession()) ??
    (await getRPVSession()) ??
    (await getAgentTerrainSession()) ??
    (await getRVCSession()) ??
    (await getChefAgenceSession())
  );
}

const INCLUDE_FULL = {
  lignes: true,
  pointDeVente: { select: { nom: true, adresse: true, telephone: true } },
} as const;

/** Échéancier complet (même construction que POST /api/factures). */
async function chargerEcheancier(creditClientId: number | null | undefined) {
  if (!creditClientId) return null;
  const echeances = await prisma.echeanceCredit.findMany({
    where: { creditId: creditClientId },
    orderBy: { numeroEcheance: "asc" },
    select: { numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true, statut: true },
  });
  if (!echeances.length) return null;
  return echeances.map(e => ({
    numeroEcheance: e.numeroEcheance,
    dateEcheance: e.dateEcheance.toISOString(),
    montantDu: e.montantDu.toNumber(),
    montantPaye: e.montantPaye.toNumber(),
    statut: e.statut,
  }));
}

/** Mouvements de compte courant liés aux remboursements de ce crédit (cf. POST /api/factures). */
async function chargerMouvementsCC(creditClientId: number | null | undefined) {
  if (!creditClientId) return null;
  const mouvements = await prisma.remboursementCredit.findMany({
    where: { creditId: creditClientId, compteCourantId: { not: null } },
    orderBy: { dateRemboursement: "asc" },
    select: {
      montant: true, dateRemboursement: true, statut: true,
      compteCourant: { select: { numeroCompte: true, solde: true } },
    },
  });
  if (!mouvements.length) return null;
  return mouvements.map(m => ({
    montant: m.montant.toNumber(),
    date: m.dateRemboursement.toISOString(),
    statut: m.statut,
    numeroCompte: m.compteCourant?.numeroCompte ?? null,
    soldeCompte: m.compteCourant ? m.compteCourant.solde.toNumber() : null,
  }));
}

async function buildResponse(
  f: {
    id: number; numero: string; type: string; statut: string;
    dateEmission: Date; dateEcheance: Date | null;
    clientNom: string; clientTelephone: string | null; clientAdresse: string | null;
    emiseParNom: string; emiseParFonction: string | null;
    pdvNom: string | null; pdvAdresse: string | null; pdvTelephone: string | null;
    montantHT: { toNumber(): number }; montantTVA: { toNumber(): number };
    montantTTC: { toNumber(): number }; montantPaye: { toNumber(): number };
    modePaiement: string | null; notes: string | null; garantie: string | null;
    lignes: { designation: string; unite: string | null; quantite: number; prixUnitaire: { toNumber(): number }; montant: { toNumber(): number } }[];
    pointDeVente: { nom: string; adresse: string | null; telephone: string | null } | null;
    creditClientId: number | null;
  },
  getParam: (k: string) => string
) {
  const echeancier   = f.type === "CREDIT" ? await chargerEcheancier(f.creditClientId) : null;
  const mouvementsCC = f.type === "CREDIT" ? await chargerMouvementsCC(f.creditClientId) : null;
  return {
    id: f.id,
    numero: f.numero,
    type: f.type,
    statut: f.statut,
    dateEmission: f.dateEmission.toISOString(),
    dateEcheance: f.dateEcheance?.toISOString() ?? null,
    clientNom: f.clientNom,
    clientTelephone: f.clientTelephone,
    clientAdresse: f.clientAdresse,
    emiseParNom: f.emiseParNom,
    emiseParFonction: f.emiseParFonction ?? null,
    pdvNom:      f.pdvNom      ?? f.pointDeVente?.nom      ?? null,
    pdvAdresse:  f.pdvAdresse  ?? f.pointDeVente?.adresse  ?? null,
    pdvTelephone: f.pdvTelephone ?? f.pointDeVente?.telephone ?? null,
    montantHT:   f.montantHT.toNumber(),
    montantTVA:  f.montantTVA.toNumber(),
    montantTTC:  f.montantTTC.toNumber(),
    montantPaye: f.montantPaye.toNumber(),
    modePaiement: f.modePaiement,
    notes: f.notes,
    garantie: f.garantie ?? null,
    echeancier,
    mouvementsCC,
    lignes: f.lignes.map(l => ({
      designation:  l.designation,
      unite:        l.unite,
      quantite:     l.quantite,
      prixUnitaire: l.prixUnitaire.toNumber(),
      montant:      l.montant.toNumber(),
    })),
    entreprise: {
      nom:       getParam("APP_NOM")       || "AfriGes",
      adresse:   getParam("APP_ADRESSE")   || "",
      telephone: getParam("APP_TELEPHONE") || "",
    },
  };
}

/** GET /api/factures/[id] — Récupère une facture existante avec toutes ses données */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const factureId = parseInt(id);
    if (isNaN(factureId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const facture = await prisma.factureVente.findUnique({
      where: { id: factureId },
      include: INCLUDE_FULL,
    });
    if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

    const params2 = await prisma.parametre.findMany({
      where: { cle: { in: ["APP_NOM", "APP_ADRESSE", "APP_TELEPHONE"] } },
    });
    const getParam = (cle: string) => params2.find(p => p.cle === cle)?.valeur ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ data: await buildResponse(facture as any, getParam) });
  } catch (error) {
    console.error("GET /api/factures/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/factures/[id]
 * - action "annuler"  : annule la facture (SUPPRESSION_LOGIQUE — Admin/SuperAdmin
 *   uniquement depuis le 2026-09-22 : les autres gestionnaires ont perdu ce droit).
 * - action "modifier" : corrige les champs annexes uniquement — notes,
 *   coordonnées client, garantie — jamais les montants/lignes/statut, qui
 *   restent pilotés par la vente/le crédit source (MODIFICATION — Admin,
 *   Chef Agence, RPV).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const factureId = parseInt(id);
    if (isNaN(factureId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json() as {
      action: string;
      notes?: string | null;
      clientTelephone?: string | null;
      clientAdresse?: string | null;
      garantie?: string | null;
    };

    if (body.action === "modifier") {
      const denied = await requirePermission(session, "factures", "MODIFICATION");
      if (denied) return denied;

      const facture = await prisma.factureVente.findUnique({ where: { id: factureId }, select: { statut: true } });
      if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
      if (facture.statut === "ANNULEE")
        return NextResponse.json({ error: "Facture annulée : document figé, non modifiable" }, { status: 400 });

      const data: { notes?: string | null; clientTelephone?: string | null; clientAdresse?: string | null; garantie?: string | null } = {};
      if (body.notes           !== undefined) data.notes           = body.notes?.trim() || null;
      if (body.clientTelephone !== undefined) data.clientTelephone = body.clientTelephone?.trim() || null;
      if (body.clientAdresse   !== undefined) data.clientAdresse   = body.clientAdresse?.trim() || null;
      if (body.garantie        !== undefined) data.garantie        = body.garantie?.trim() || null;

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.factureVente.update({
          where: { id: factureId },
          data,
          select: { id: true, numero: true, notes: true, clientTelephone: true, clientAdresse: true, garantie: true },
        });
        await tx.auditLog.create({
          data: { userId: Number(session.user.id), action: "MODIFICATION_FACTURE", entite: "FactureVente", entiteId: factureId, details: data },
        });
        return u;
      });

      return NextResponse.json({ data: updated });
    }

    if (body.action === "annuler") {
      const denied = await requirePermission(session, "factures", "SUPPRESSION_LOGIQUE");
      if (denied) return denied;

      const facture = await prisma.factureVente.findUnique({ where: { id: factureId }, select: { statut: true } });
      if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
      if (facture.statut === "ANNULEE")
        return NextResponse.json({ error: "Facture déjà annulée" }, { status: 400 });

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.factureVente.update({
          where: { id: factureId },
          data: { statut: "ANNULEE" },
          select: { id: true, numero: true, statut: true },
        });
        await tx.auditLog.create({
          data: { userId: Number(session.user.id), action: "ANNULATION_FACTURE", entite: "FactureVente", entiteId: factureId },
        });
        return u;
      });

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Action invalide ('annuler' ou 'modifier' attendu)" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/factures/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

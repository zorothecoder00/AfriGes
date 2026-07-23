import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { getCaissierSession } from "@/lib/authCaissier";
import { getRPVSession } from "@/lib/authRPV";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getRVCSession } from "@/lib/authRVC";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

async function getSession() {
  return (
    (await getAdminSession()) ??
    (await getCaissierSession()) ??
    (await getRPVSession()) ??
    (await getAgentTerrainSession()) ??
    (await getRVCSession())
  );
}

const INCLUDE_FULL = {
  lignes: true,
  pointDeVente: { select: { nom: true, adresse: true, telephone: true } },
} as const;

function buildResponse(
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
  },
  getParam: (k: string) => string
) {
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
    return NextResponse.json({ data: buildResponse(facture as any, getParam) });
  } catch (error) {
    console.error("GET /api/factures/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/factures/[id] — Annule une facture */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "factures", "SUPPRESSION_LOGIQUE");
    if (denied) return denied;

    const { id } = await params;
    const factureId = parseInt(id);
    if (isNaN(factureId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json() as { action: string };
    if (body.action !== "annuler")
      return NextResponse.json({ error: "Action invalide (seul 'annuler' est accepté)" }, { status: 400 });

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
  } catch (error) {
    console.error("PATCH /api/factures/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

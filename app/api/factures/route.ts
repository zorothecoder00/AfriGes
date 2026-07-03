import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/authAdmin";
import { getCaissierSession } from "@/lib/authCaissier";
import { getRPVSession } from "@/lib/authRPV";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { getRVCSession } from "@/lib/authRVC";
import { getStatusLabel } from "@/lib/status";

async function getSession() {
  return (
    (await getAdminSession()) ??
    (await getCaissierSession()) ??
    (await getRPVSession()) ??
    (await getAgentTerrainSession()) ??
    (await getRVCSession())
  );
}

/** Génère le prochain numéro de facture : FAC-AAAA-NNNNN */
async function genNumero(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const last = await prisma.factureVente.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { id: "desc" },
    select: { numero: true },
  });
  const lastN = last ? parseInt(last.numero.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastN + 1).padStart(5, "0")}`;
}

/**
 * Crée une FactureVente avec retry automatique sur conflit de numéro (race condition).
 * Tente jusqu'à 5 fois en regénérant un nouveau numéro à chaque conflit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createFactureWithRetry(data: any, include: any) {
  for (let i = 0; i < 5; i++) {
    const numero = await genNumero();
    try {
      return await prisma.factureVente.create({ data: { ...data, numero }, include });
    } catch (e) {
      const isNumeroConflict =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        (() => {
          const raw = (e.meta as { target?: unknown })?.target;
          const str = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
          return str.toLowerCase().includes("numero");
        })();
      if (isNumeroConflict) continue;
      throw e;
    }
  }
  throw new Error("Impossible de générer un numéro de facture unique après plusieurs tentatives");
}

// ─── Types internes ────────────────────────────────────────────────────────────

type FactureRow = {
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
};

function buildResponse(f: FactureRow, getParam: (k: string) => string) {
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
    pdvNom: f.pdvNom ?? f.pointDeVente?.nom ?? null,
    pdvAdresse: f.pdvAdresse ?? f.pointDeVente?.adresse ?? null,
    pdvTelephone: f.pdvTelephone ?? f.pointDeVente?.telephone ?? null,
    montantHT: f.montantHT.toNumber(),
    montantTVA: f.montantTVA.toNumber(),
    montantTTC: f.montantTTC.toNumber(),
    montantPaye: f.montantPaye.toNumber(),
    modePaiement: f.modePaiement,
    notes: f.notes,
    garantie: f.garantie ?? null,
    lignes: f.lignes.map(l => ({
      designation: l.designation,
      unite: l.unite,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire.toNumber(),
      montant: l.montant.toNumber(),
    })),
    entreprise: {
      nom:       getParam("APP_NOM")       || "AfriGes",
      adresse:   getParam("APP_ADRESSE")   || "",
      telephone: getParam("APP_TELEPHONE") || "",
    },
  };
}

const INCLUDE_FULL = {
  lignes: true,
  pointDeVente: { select: { nom: true, adresse: true, telephone: true } },
} as const;

// ─── GET /api/factures ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;
    const type  = searchParams.get("type");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const userId  = parseInt(session.user.id);

    let pdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      pdvId = aff?.pointDeVenteId ?? null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type) where.type = type;
    if (pdvId) where.pointDeVenteId = pdvId;

    const [factures, total] = await Promise.all([
      prisma.factureVente.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, numero: true, type: true, statut: true,
          clientNom: true, montantTTC: true, montantPaye: true,
          dateEmission: true, emiseParNom: true, modePaiement: true,
          venteDirecteId: true, creditClientId: true,
        },
      }),
      prisma.factureVente.count({ where }),
    ]);

    return NextResponse.json({
      data: factures,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/factures:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST /api/factures ────────────────────────────────────────────────────────
/**
 * Génère ou récupère une FactureVente.
 *
 * Corps:
 *  { type: "COMPTANT"|"CREDIT"|"PRO_FORMA",
 *    venteDirecteId?  — source vente directe
 *    creditClientId?  — source crédit client
 *    clientNom?       — requis pour PRO_FORMA
 *    clientTelephone?
 *    lignes?          — requis pour PRO_FORMA : [{ designation, unite?, quantite, prixUnitaire }]
 *    notes?
 *    dateEcheance?    — ISO string
 *  }
 *
 * Idempotent pour venteDirecteId (unique) et creditClientId+type=CREDIT (first match).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json() as {
      type: "COMPTANT" | "CREDIT" | "PRO_FORMA";
      venteDirecteId?: number;
      creditClientId?: number;
      receptionPackId?: number;
      clientNom?: string;
      clientTelephone?: string;
      clientAdresse?: string;
      lignes?: Array<{ designation: string; unite?: string; quantite: number; prixUnitaire: number }>;
      notes?: string;
      dateEcheance?: string;
    };

    if (!body.type) return NextResponse.json({ error: "type requis" }, { status: 400 });

    const userId     = parseInt(session.user.id);
    const emiseParNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
    // Fonction/rôle de l'émetteur dans l'entreprise (snapshot) : rôle gestionnaire
    // s'il existe, sinon rôle User (Administrateur / Super Admin).
    const emiseParFonction = getStatusLabel(session.user.gestionnaireRole ?? session.user.role ?? "") || null;

    const params = await prisma.parametre.findMany({
      where: { cle: { in: ["APP_NOM", "APP_ADRESSE", "APP_TELEPHONE"] } },
    });
    const getParam = (cle: string) => params.find(p => p.cle === cle)?.valeur ?? "";

    // ── Depuis une VenteDirecte ──────────────────────────────────────────────
    if (body.venteDirecteId) {
      // Idempotent
      const existing = await prisma.factureVente.findUnique({
        where: { venteDirecteId: body.venteDirecteId },
        include: INCLUDE_FULL,
      });
      if (existing) return NextResponse.json({ data: buildResponse(existing as unknown as FactureRow, getParam) });

      const vente = await prisma.venteDirecte.findUnique({
        where: { id: body.venteDirecteId },
        include: {
          client:       { select: { nom: true, prenom: true, telephone: true, adresse: true } },
          pointDeVente: { select: { nom: true, adresse: true, telephone: true } },
          lignes:       { include: { produit: { select: { nom: true, unite: true } } } },
        },
      });
      if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });

      const clientNom = vente.client
        ? `${vente.client.prenom} ${vente.client.nom}`
        : vente.clientNom ?? "Client";

      const factureType = vente.modePaiement === "CREDIT" ? "CREDIT" : "COMPTANT";
      const montantTTC = Number(vente.montantTotal);

      const created = await createFactureWithRetry({
          type:           factureType,
          statut:         "EMISE",
          venteDirecteId: body.venteDirecteId,
          creditClientId: vente.creditClientId ?? undefined,
          pointDeVenteId: vente.pointDeVenteId,
          pdvNom:         vente.pointDeVente.nom,
          pdvAdresse:     vente.pointDeVente.adresse,
          pdvTelephone:   vente.pointDeVente.telephone,
          clientId:       vente.clientId ?? undefined,
          clientNom,
          clientTelephone: vente.client?.telephone ?? vente.clientTelephone,
          emiseParId:   userId,
          emiseParNom,
          emiseParFonction,
          montantHT:    montantTTC,
          montantTVA:   0,
          montantTTC,
          montantPaye:  Number(vente.montantPaye),
          modePaiement: vente.modePaiement,
          notes:        vente.notes,
          lignes: {
            create: vente.lignes.map(l => ({
              designation:  l.produitNom ?? l.produit?.nom ?? `Produit #${l.produitId}`,
              unite:        l.produit?.unite ?? null,
              quantite:     l.quantite,
              prixUnitaire: Number(l.prixUnitaire),
              montant:      Number(l.montant),
            })),
          },
        },
        INCLUDE_FULL,
      );

      return NextResponse.json(
        { data: buildResponse(created as unknown as FactureRow, getParam) },
        { status: 201 }
      );
    }

    // ── Depuis un CreditClient ───────────────────────────────────────────────
    if (body.creditClientId && body.type === "CREDIT") {
      const existing = await prisma.factureVente.findFirst({
        where: { creditClientId: body.creditClientId, type: "CREDIT" },
        include: INCLUDE_FULL,
      });
      if (existing) return NextResponse.json({ data: buildResponse(existing as unknown as FactureRow, getParam) });

      const credit = await prisma.creditClient.findUnique({
        where: { id: body.creditClientId },
        include: {
          client: { select: { nom: true, prenom: true, telephone: true, adresse: true } },
          lignes: { include: { produit: { select: { nom: true, unite: true } } } },
        },
      });
      if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });

      // PDV de l'émetteur si pas sur le crédit
      let pdvInfo: { id: number; nom: string; adresse: string | null; telephone: string | null } | null = null;
      if (credit.pointDeVenteId) {
        pdvInfo = await prisma.pointDeVente.findUnique({
          where: { id: credit.pointDeVenteId },
          select: { id: true, nom: true, adresse: true, telephone: true },
        });
      }

      const montantTTC = Number(credit.montantTotal);

      // Lignes produits + itemisation des frais qui composent le montant total
      // (pour que la facture totalise exactement montantTotal, frais de livraison compris).
      const ligneFrais = (designation: string, montant: number) => ({
        designation, unite: null, quantite: 1, prixUnitaire: montant, montant,
      });
      const lignesFacture = [
        ...credit.lignes.map(l => ({
          designation:  l.produitNom,
          unite:        l.produit?.unite ?? null,
          quantite:     l.quantite,
          prixUnitaire: Number(l.prixUnitaire),
          montant:      Number(l.montantLigne),
        })),
        ...(Number(credit.fraisDossier)   > 0 ? [ligneFrais("Frais de dossier",   Number(credit.fraisDossier))]   : []),
        ...(Number(credit.assurance)      > 0 ? [ligneFrais("Assurance",          Number(credit.assurance))]      : []),
        ...(Number(credit.autresFrais)    > 0 ? [ligneFrais("Autres frais",       Number(credit.autresFrais))]    : []),
        ...(Number(credit.fraisLivraison) > 0 ? [ligneFrais("Frais de livraison", Number(credit.fraisLivraison))] : []),
        ...(Number(credit.montantInteret) > 0 ? [ligneFrais("Intérêt",            Number(credit.montantInteret))] : []),
      ];

      const created = await createFactureWithRetry({
          type:           "CREDIT",
          statut:         "EMISE",
          creditClientId: body.creditClientId,
          pointDeVenteId: credit.pointDeVenteId ?? undefined,
          pdvNom:         pdvInfo?.nom,
          pdvAdresse:     pdvInfo?.adresse,
          pdvTelephone:   pdvInfo?.telephone,
          clientId:       credit.clientId,
          clientNom:      `${credit.client.prenom} ${credit.client.nom}`,
          clientTelephone: credit.client.telephone,
          clientAdresse:  credit.client.adresse,
          emiseParId:   userId,
          emiseParNom,
          emiseParFonction,
          montantHT:    montantTTC,
          montantTVA:   0,
          montantTTC,
          montantPaye:  Number(credit.montantRembourse),
          modePaiement: "CREDIT",
          dateEcheance: credit.dateEcheanceFin,
          notes:        credit.observations,
          garantie:     credit.garantie,
          lignes: { create: lignesFacture },
        },
        INCLUDE_FULL,
      );

      return NextResponse.json(
        { data: buildResponse(created as unknown as FactureRow, getParam) },
        { status: 201 }
      );
    }

    // ── Depuis une ReceptionProduitPack (livraison de pack) ──────────────────
    if (body.receptionPackId) {
      const existing = await prisma.factureVente.findFirst({
        where: { receptionPackId: body.receptionPackId },
        include: INCLUDE_FULL,
      });
      if (existing) return NextResponse.json({ data: buildResponse(existing as unknown as FactureRow, getParam) });

      const reception = await prisma.receptionProduitPack.findUnique({
        where: { id: body.receptionPackId },
        include: {
          souscription: {
            include: {
              client: { select: { id: true, nom: true, prenom: true, telephone: true, adresse: true } },
              user:   { select: { nom: true, prenom: true } },
            },
          },
          lignes:       { include: { produit: { select: { nom: true, unite: true } } } },
          pointDeVente: { select: { id: true, nom: true, adresse: true, telephone: true } },
        },
      });
      if (!reception) return NextResponse.json({ error: "Réception introuvable" }, { status: 404 });

      const sClient = reception.souscription.client;
      const sUser   = reception.souscription.user;
      const clientNom = sClient
        ? `${sClient.prenom} ${sClient.nom}`
        : sUser ? `${sUser.prenom} ${sUser.nom}` : "Client";

      const montantTTC = reception.lignes.reduce(
        (s, l) => s + Number(l.prixUnitaire) * l.quantite, 0
      );
      // Versements déjà effectués sur la souscription = montant payé à date
      const montantPaye = Number(reception.souscription.montantVerse);

      const created = await createFactureWithRetry({
          type:            "CREDIT",   // paiement échelonné via versements pack
          statut:          "EMISE",
          receptionPackId: body.receptionPackId,
          pointDeVenteId:  reception.pointDeVenteId ?? undefined,
          pdvNom:          reception.pointDeVente?.nom,
          pdvAdresse:      reception.pointDeVente?.adresse,
          pdvTelephone:    reception.pointDeVente?.telephone,
          clientId:        sClient?.id ?? undefined,
          clientNom,
          clientTelephone: sClient?.telephone ?? null,
          clientAdresse:   sClient?.adresse ?? null,
          emiseParId:      userId,
          emiseParNom,
          emiseParFonction,
          montantHT:       montantTTC,
          montantTVA:      0,
          montantTTC,
          montantPaye,
          dateEcheance:    reception.souscription.dateFin ?? undefined,
          notes:           reception.notes,
          lignes: {
            create: reception.lignes.map(l => ({
              designation:  l.produit.nom,
              unite:        l.produit.unite ?? null,
              quantite:     l.quantite,
              prixUnitaire: Number(l.prixUnitaire),
              montant:      Number(l.prixUnitaire) * l.quantite,
            })),
          },
        },
        INCLUDE_FULL,
      );

      return NextResponse.json(
        { data: buildResponse(created as unknown as FactureRow, getParam) },
        { status: 201 }
      );
    }

    // ── Pro-forma standalone ─────────────────────────────────────────────────
    if (body.type === "PRO_FORMA") {
      if (!body.clientNom?.trim())
        return NextResponse.json({ error: "clientNom requis pour pro-forma" }, { status: 400 });
      if (!body.lignes?.length)
        return NextResponse.json({ error: "lignes requises pour pro-forma" }, { status: 400 });

      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        include: { pointDeVente: { select: { id: true, nom: true, adresse: true, telephone: true } } },
      });

      const montantTTC = body.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

      const created = await createFactureWithRetry({
          type:           "PRO_FORMA",
          statut:         "EMISE",
          pointDeVenteId: aff?.pointDeVente.id ?? undefined,
          pdvNom:         aff?.pointDeVente.nom ?? null,
          pdvAdresse:     aff?.pointDeVente.adresse ?? null,
          pdvTelephone:   aff?.pointDeVente.telephone ?? null,
          clientNom:       body.clientNom.trim(),
          clientTelephone: body.clientTelephone?.trim() ?? null,
          clientAdresse:   body.clientAdresse?.trim() ?? null,
          emiseParId:   userId,
          emiseParNom,
          emiseParFonction,
          montantHT:    montantTTC,
          montantTVA:   0,
          montantTTC,
          montantPaye:  0,
          notes:        body.notes ?? null,
          dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : undefined,
          lignes: {
            create: body.lignes.map(l => ({
              designation:  l.designation,
              unite:        l.unite ?? null,
              quantite:     l.quantite,
              prixUnitaire: l.prixUnitaire,
              montant:      l.quantite * l.prixUnitaire,
            })),
          },
        },
        INCLUDE_FULL,
      );

      return NextResponse.json(
        { data: buildResponse(created as unknown as FactureRow, getParam) },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/factures:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erreur serveur: ${msg}` }, { status: 500 });
  }
}

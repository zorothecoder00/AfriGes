import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { ecritureAcquisitionImmobilisation } from "@/lib/comptabilite/immobilisations";
import { obtenirOuCreerCompteAuxiliaireFournisseur } from "@/lib/comptabilite/auxiliaire";

// Comptes par défaut par catégorie (plan SYSCOHADA de base — CDC §22). Les terrains
// ne se déprécient pas comptablement en pratique ; le compte d'amortissement leur
// est néanmoins requis par le schéma (simplification assumée) mais ne sera jamais
// débité (genererDotationPeriode ignore la catégorie TERRAIN).
const CATEGORIE_COMPTES: Record<string, { actif: string; amort: string }> = {
  TERRAIN: { actif: "211", amort: "281" },
  BATIMENT: { actif: "231", amort: "2831" },
  MATERIEL_MOBILIER: { actif: "244", amort: "2844" },
  MATERIEL_TRANSPORT: { actif: "245", amort: "2845" },
  MATERIEL_INFORMATIQUE: { actif: "248", amort: "2848" },
  AUTRE: { actif: "248", amort: "2848" },
};

async function genererNumeroInventaire(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IMMO-${year}-`;
  const last = await prisma.immobilisation.findFirst({
    where: { numeroInventaire: { startsWith: prefix } },
    orderBy: { id: "desc" },
    select: { numeroInventaire: true },
  });
  const lastN = last ? parseInt(last.numeroInventaire.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastN + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const statut = searchParams.get("statut");
    const categorie = searchParams.get("categorie");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (categorie) where.categorie = categorie;

    const [data, total, agrege] = await Promise.all([
      prisma.immobilisation.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          compte: { select: { numero: true, libelle: true } },
          fournisseur: { select: { nom: true } },
          responsable: { select: { nom: true, prenom: true } },
        },
      }),
      prisma.immobilisation.count({ where }),
      prisma.immobilisation.aggregate({ _sum: { coutAcquisition: true, amortissementCumule: true, valeurNetteComptable: true } }),
    ]);

    return NextResponse.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      totaux: {
        coutAcquisition: Number(agrege._sum.coutAcquisition ?? 0),
        amortissementCumule: Number(agrege._sum.amortissementCumule ?? 0),
        valeurNetteComptable: Number(agrege._sum.valeurNetteComptable ?? 0),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      designation, categorie, fournisseurId, dateAcquisition, dateMiseEnService,
      coutAcquisition, valeurResiduelle, dureeAnnees, localisation, responsableId,
      numeroSerie, notes, modePaiement,
    } = body as {
      designation?: string; categorie?: string; fournisseurId?: number;
      dateAcquisition?: string; dateMiseEnService?: string;
      coutAcquisition?: number; valeurResiduelle?: number; dureeAnnees?: number;
      localisation?: string; responsableId?: number; numeroSerie?: string; notes?: string; modePaiement?: string;
    };

    if (!designation || !categorie || !dateAcquisition || !dateMiseEnService || !coutAcquisition || !dureeAnnees) {
      return NextResponse.json(
        { error: "designation, categorie, dateAcquisition, dateMiseEnService, coutAcquisition et dureeAnnees sont requis" },
        { status: 400 },
      );
    }

    const comptes = CATEGORIE_COMPTES[categorie];
    if (!comptes) return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });

    const [compte, compteAmortissement] = await Promise.all([
      prisma.compteComptable.findUnique({ where: { numero: comptes.actif }, select: { id: true } }),
      prisma.compteComptable.findUnique({ where: { numero: comptes.amort }, select: { id: true } }),
    ]);
    if (!compte || !compteAmortissement) {
      return NextResponse.json(
        { error: `Comptes ${comptes.actif}/${comptes.amort} absents du plan comptable — importez d'abord le plan SYSCOHADA` },
        { status: 422 },
      );
    }

    const userId = Number(session.user.id);
    const numeroInventaire = await genererNumeroInventaire();
    const montant = Number(coutAcquisition);
    const dateAcq = new Date(dateAcquisition);

    const result = await prisma.$transaction(async (tx) => {
      const fournisseurNumero = fournisseurId
        ? await obtenirOuCreerCompteAuxiliaireFournisseur(tx, Number(fournisseurId)).then((c) => c.numero)
        : null;

      const immo = await tx.immobilisation.create({
        data: {
          numeroInventaire,
          designation,
          categorie: categorie as never,
          compteId: compte.id,
          compteAmortissementId: compteAmortissement.id,
          fournisseurId: fournisseurId ? Number(fournisseurId) : null,
          dateAcquisition: dateAcq,
          dateMiseEnService: new Date(dateMiseEnService),
          coutAcquisition: montant,
          valeurResiduelle: valeurResiduelle != null ? Number(valeurResiduelle) : 0,
          dureeAnnees: Number(dureeAnnees),
          valeurNetteComptable: montant,
          localisation: localisation || null,
          responsableId: responsableId ? Number(responsableId) : null,
          numeroSerie: numeroSerie || null,
          notes: notes || null,
          creePar: userId,
        },
      });

      const ecritureId = await ecritureAcquisitionImmobilisation(tx, {
        montant,
        compteNumero: comptes.actif,
        designation,
        reference: numeroInventaire,
        fournisseurNumero,
        modePaiement: modePaiement ?? null,
        userId,
        date: dateAcq,
      });

      if (ecritureId) {
        await tx.immobilisation.update({ where: { id: immo.id }, data: { ecritureAcquisitionId: ecritureId } });
      }

      return immo;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce numéro d'inventaire existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { getSeuilApprobationN2Decaissement } from "@/lib/parametresDocuments";

/**
 * GET /api/decaissements/dashboard?dateDebut=&dateFin=&pointDeVenteId=
 * Tableau de bord Direction/Finance des décaissements (CDC §3.6) : par type de dépense, par service,
 * par agence et par période (mois). Par défaut : année en cours.
 *
 * Montant retenu = montant approuvé, à défaut le montant demandé.
 *  - Décaissé : fiche PAYEE, ou APPROUVEE rattachée à une sortie de caisse (l'argent est déjà sorti).
 *  - En circuit : SOUMISE, ou APPROUVEE non rattachée à une sortie de caisse (à exécuter).
 *  - Rejeté : REJETEE.
 */

type Agg = { montant: number; nombre: number };
const ajouter = (m: Map<string, Agg>, cle: string, montant: number) => {
  const a = m.get(cle) ?? { montant: 0, nombre: 0 };
  a.montant += montant; a.nombre += 1; m.set(cle, a);
};
const trier = (m: Map<string, Agg>) =>
  [...m.entries()].map(([libelle, a]) => ({ libelle, ...a })).sort((x, y) => y.montant - x.montant);

export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const debut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : new Date(now.getFullYear(), 0, 1);
    const finBrute = searchParams.get("dateFin") ? new Date(searchParams.get("dateFin")!) : now;
    const fin = new Date(finBrute); fin.setHours(23, 59, 59, 999);
    const pdvId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : null;

    const [fiches, seuilN2] = await Promise.all([
      prisma.ficheDecaissement.findMany({
        where: { createdAt: { gte: debut, lte: fin }, ...(pdvId ? { pointDeVenteId: pdvId } : {}) },
        select: {
          id: true, statut: true, typeDepense: true, montantDemande: true, montantApprouve: true, createdAt: true,
          dateApprobationN1: true, dateApprobationN2: true, dateExecution: true, approbateurN2Id: true,
          operationCaisseId: true, operationCaissePDVId: true, beneficiaireNom: true,
          pointDeVente: { select: { nom: true } },
          demandeur: { select: { gestionnaire: { select: { profilRH: { select: { service: true, departement: true } } } } } },
        },
      }),
      getSeuilApprobationN2Decaissement(),
    ]);

    const parType = new Map<string, Agg>();
    const parService = new Map<string, Agg>();
    const parAgence = new Map<string, Agg>();
    const parMois = new Map<string, Agg>();
    const parBeneficiaire = new Map<string, Agg>();
    const totaux = { decaisse: 0, enCircuit: 0, rejete: 0 };
    const compte = { decaisse: 0, enCircuit: 0, rejete: 0 };
    let sommeDelaiApprobationH = 0, nbDelaiApprobation = 0;
    let sommeDelaiPaiementH = 0, nbDelaiPaiement = 0;
    let nbN2 = 0;

    for (const f of fiches) {
      const montant = Number(f.montantApprouve ?? f.montantDemande);
      const liee = f.operationCaisseId != null || f.operationCaissePDVId != null;
      const decaisse = f.statut === "PAYEE" || (f.statut === "APPROUVEE" && liee);

      if (f.statut === "REJETEE") { totaux.rejete += montant; compte.rejete++; continue; }
      if (!decaisse) { totaux.enCircuit += montant; compte.enCircuit++; continue; }

      totaux.decaisse += montant; compte.decaisse++;
      ajouter(parType, f.typeDepense, montant);
      const p = f.demandeur.gestionnaire?.profilRH;
      ajouter(parService, p?.service || p?.departement || "Non renseigné", montant);
      ajouter(parAgence, f.pointDeVente?.nom ?? "Sans agence", montant);
      ajouter(parMois, `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, "0")}`, montant);
      ajouter(parBeneficiaire, f.beneficiaireNom, montant);
      if (f.approbateurN2Id != null) nbN2++;
      if (f.dateApprobationN1) { sommeDelaiApprobationH += (f.dateApprobationN1.getTime() - f.createdAt.getTime()) / 3_600_000; nbDelaiApprobation++; }
      if (f.statut === "PAYEE" && f.dateExecution) { sommeDelaiPaiementH += (f.dateExecution.getTime() - f.createdAt.getTime()) / 3_600_000; nbDelaiPaiement++; }
    }

    return NextResponse.json({
      data: {
        periode: { debut: debut.toISOString(), fin: fin.toISOString() },
        seuilN2,
        totaux, compte, nombreFiches: fiches.length,
        nbApprobationsDirection: nbN2,
        delaiMoyenApprobationH: nbDelaiApprobation ? sommeDelaiApprobationH / nbDelaiApprobation : null,
        delaiMoyenPaiementH: nbDelaiPaiement ? sommeDelaiPaiementH / nbDelaiPaiement : null,
        parType: trier(parType),
        parService: trier(parService),
        parAgence: trier(parAgence),
        parMois: [...parMois.entries()].map(([mois, a]) => ({ mois, ...a })).sort((a, b) => a.mois.localeCompare(b.mois)),
        topBeneficiaires: trier(parBeneficiaire).slice(0, 10),
      },
    });
  } catch (error) {
    console.error("GET /decaissements/dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

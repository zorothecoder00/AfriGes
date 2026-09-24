import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { readFile } from "fs/promises";
import path from "path";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBordereauRemiseHtml } from "@/lib/bordereauRemiseHtml";
import { getSeuilVisaCGTBordereauRemise } from "@/lib/parametresDocuments";
import { getSession, estRpvDuPdv } from "../../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/tresorerie/bordereaux-remise/[id]/pdf
 * Bordereau imprimable (PDF) — CDC digitalisation §3.1. Reproduit le formulaire papier AfriSime :
 * A4 paysage, 2 pages coupées chacune en deux colonnes (voir lib/bordereauRemiseHtml.ts).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bordereau = await prisma.bordereauRemiseFonds.findUnique({
      where: { id: Number(id) },
      include: {
        pointDeVente: { select: { nom: true, code: true } },
        collecteur: { select: { id: true, nom: true, prenom: true, telephone: true, adresse: true, gestionnaire: { select: { zone: true } } } },
        tresorier: { select: { nom: true, prenom: true } },
        visaCGTPar: { select: { nom: true, prenom: true } },
        lignesBilletage: true,
      },
    });
    if (!bordereau) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

    // Comptable/admin, collecteur, caissier ou RPV de l'agence de dépôt.
    const userId = parseInt(session.user.id);
    const autorise = !!(await getComptableSession())
      || bordereau.collecteurId === userId
      || (!!(await getCaissierSession()) && (await getCaissierPdvId(userId)) === bordereau.pointDeVenteId)
      || (session.user.gestionnaireRole === "RESPONSABLE_POINT_DE_VENTE" && await estRpvDuPdv(userId, bordereau.pointDeVenteId));
    if (!autorise) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [pieces, seuilVisaCGT] = await Promise.all([
      prisma.pieceJustificative.findMany({
        where: { sourceType: "BORDEREAU_REMISE", sourceId: bordereau.id },
        select: { nature: true },
      }),
      getSeuilVisaCGTBordereauRemise(),
    ]);

    let logoDataUrl: string | null = null;
    try {
      const buf = await readFile(path.join(process.cwd(), "public", "nouveaulogo.jpeg"));
      logoDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch { /* logo facultatif : le bordereau reste valide sans */ }

    const { collecteur } = bordereau;
    // Identité déclarée sur le bordereau (saisie possible pour un tiers), à défaut celle du compte.
    const b = bordereau;
    const html = genBordereauRemiseHtml({
      reference: b.reference, date: b.dateRemise ?? b.createdAt,
      pointDeVente: b.pointDeVente,
      compte: { titulaire: b.compteTitulaire, numero: b.compteNumero, banque: b.compteBanque, guichet: b.compteGuichet },
      collecteur: {
        id: collecteur.id,
        nom: b.deposantNom ?? collecteur.nom, prenom: b.deposantPrenom ?? collecteur.prenom,
        telephone: b.deposantTelephone ?? collecteur.telephone, adresse: b.deposantAdresse ?? collecteur.adresse,
        zone: b.deposantZone ?? collecteur.gestionnaire?.zone ?? null,
      },
      mobileMoneyOperateur: b.mobileMoneyOperateur,
      carnetsAnnexes: b.carnetsAnnexes, fichesPages: [b.fichesPagesDe, b.fichesPagesA], recusNum: [b.recusNumDe, b.recusNumA],
      declarationAcceptee: b.declarationAcceptee, dateSoumission: b.createdAt,
      signatureCollecteur: b.signatureCollecteur, signatureTresorier: b.signatureTresorier, signatureVisaCGT: b.signatureVisaCGT,
      cotisationsEspeces: Number(bordereau.cotisationsEspeces), cotisationsMobileMoney: Number(bordereau.cotisationsMobileMoney),
      mobileMoneyReference: bordereau.mobileMoneyReference,
      remboursements: Number(bordereau.remboursements), ventes: Number(bordereau.ventes), venteCarnet: Number(bordereau.venteCarnet),
      fraisLivraison: Number(bordereau.fraisLivraison),
      montantVirement: Number(bordereau.montantVirement), virementReference: bordereau.virementReference,
      totalEspecesAttendu: Number(bordereau.totalEspecesAttendu),
      lignesBilletage: bordereau.lignesBilletage.map((l) => ({ denomination: l.denomination, nombre: l.nombre, total: Number(l.total) })),
      totalBilletageCalcule: Number(bordereau.totalBilletageCalcule),
      ecartSoumission: Number(bordereau.ecartSoumission), motifEcartSoumission: bordereau.motifEcartSoumission,
      tresorier: bordereau.tresorier,
      montantConfirmeTresorier: bordereau.montantConfirmeTresorier != null ? Number(bordereau.montantConfirmeTresorier) : null,
      dateTraitementTresorier: bordereau.dateTraitementTresorier,
      visaCGTPar: bordereau.visaCGTPar, dateVisaCGT: bordereau.dateVisaCGT,
      naturesPieces: pieces.map((p) => String(p.nature)),
      seuilVisaCGT,
      logoDataUrl,
    });
    const pdf = await htmlToPdf(html, {
      format: "A4", landscape: true, scale: 1,
      margin: { top: "9mm", right: "9mm", bottom: "9mm", left: "9mm" },
    });
    return pdfResponse(pdf, `${bordereau.reference}.pdf`);
  } catch (error) {
    console.error("GET /tresorerie/bordereaux-remise/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}

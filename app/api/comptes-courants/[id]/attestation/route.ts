import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { htmlToPdf, pdfResponse, escapeHtml } from "@/lib/pdf";
import { renderDocumentCC, fcfa, dLong, row } from "@/lib/compteCourantPdf";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};

/**
 * GET /api/comptes-courants/[id]/attestation
 * Attestation de compte PDF (CDC §14) : atteste l'existence du compte, son
 * titulaire, son RIB et le solde à ce jour. Document officiel signé AFRISIME.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      numeroCompte: true, ribComplet: true, codeAgence: true, codeGuichet: true,
      statut: true, solde: true, dateOuverture: true,
      client: { select: { nom: true, prenom: true, telephone: true, codeClient: true, commune: true, ville: true, quartier: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const localisation = [compte.client.quartier, compte.client.ville, compte.client.commune].filter(Boolean).join(", ") || "—";
  const ceJour = dLong(new Date());

  const bodyHtml = `
    <p class="body-text">
      Nous, société <b>AFRISIME</b>, agence ${escapeHtml(compte.codeAgence)}, attestons par la présente que
      <b>${escapeHtml(clientNom)}</b>${compte.client.codeClient ? ` (code client ${escapeHtml(compte.client.codeClient)})` : ""},
      demeurant à ${escapeHtml(localisation)}, est titulaire d'un compte courant ouvert dans nos livres,
      dont les caractéristiques sont les suivantes :
    </p>

    <table class="meta"><tbody>
      ${row("N° de compte", compte.numeroCompte)}
      ${row("RIB", compte.ribComplet)}
      ${row("Agence / Guichet", `${compte.codeAgence} · ${compte.codeGuichet}`)}
      ${row("Date d'ouverture", dLong(compte.dateOuverture))}
      ${row("Statut du compte", STATUT_LABEL[compte.statut] ?? compte.statut)}
      ${row("Téléphone", compte.client.telephone)}
    </tbody></table>

    <div class="amount">
      <div><div class="lbl">Solde disponible au ${escapeHtml(ceJour)}</div></div>
      <div class="big">${fcfa(Number(compte.solde))}</div>
    </div>

    <p class="body-text">
      La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.
    </p>
    <p class="sub">Fait à ${escapeHtml(compte.codeAgence)}, le ${escapeHtml(ceJour)}.</p>`;

  const headerRight = `
    <div class="lbl">Attestation</div>
    <div class="val">${escapeHtml(compte.numeroCompte)}</div>
    <div class="sub">${escapeHtml(ceJour)}</div>`;

  const html = renderDocumentCC({
    title: "Attestation de compte courant",
    headerRight, bodyHtml,
    signatures: ["Cachet & signature", "Pour AFRISIME"],
  });

  const pdf = await htmlToPdf(html, { format: "A4" });
  return pdfResponse(pdf, `attestation-${compte.numeroCompte}.pdf`, "inline");
}

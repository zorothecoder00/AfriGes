import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { htmlToPdf, pdfResponse, escapeHtml } from "@/lib/pdf";
import { renderDocumentCC, fcfa, dLong, row } from "@/lib/compteCourantPdf";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/comptes-courants/[id]/attestation-fermeture
 * Attestation de fermeture PDF (CDC §13) : atteste que le compte est clôturé,
 * son solde nul et sa date de clôture. Réservée aux comptes CLOTURE.
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
      statut: true, solde: true, dateOuverture: true, motifBlocage: true, updatedAt: true,
      client: { select: { nom: true, prenom: true, telephone: true, codeClient: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  if (compte.statut !== "CLOTURE") {
    return NextResponse.json(
      { error: "Le compte n'est pas clôturé : attestation de fermeture indisponible." },
      { status: 422 },
    );
  }

  // Date de clôture = dernier changement de statut journalisé (sinon dernière maj).
  const evtCloture = await prisma.auditLog.findFirst({
    where: { entite: "CompteCourant", entiteId: compteId, action: "CHANGEMENT_STATUT_COMPTE_COURANT" },
    orderBy: { createdAt: "desc" }, select: { createdAt: true },
  });
  const dateCloture = evtCloture?.createdAt ?? compte.updatedAt;

  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const ceJour = dLong(new Date());

  const bodyHtml = `
    <p class="body-text">
      Nous, société <b>AFRISIME</b>, agence ${escapeHtml(compte.codeAgence)}, attestons par la présente que le
      compte courant ci‑dessous, ouvert au nom de <b>${escapeHtml(clientNom)}</b>${compte.client.codeClient ? ` (code client ${escapeHtml(compte.client.codeClient)})` : ""},
      a été <b>définitivement clôturé</b> dans nos livres.
    </p>

    <table class="meta"><tbody>
      ${row("N° de compte", compte.numeroCompte)}
      ${row("RIB", compte.ribComplet)}
      ${row("Agence / Guichet", `${compte.codeAgence} · ${compte.codeGuichet}`)}
      ${row("Date d'ouverture", dLong(compte.dateOuverture))}
      ${row("Date de clôture", dLong(dateCloture))}
      ${row("Solde à la clôture", fcfa(Number(compte.solde)))}
      ${compte.motifBlocage ? row("Motif", compte.motifBlocage) : ""}
      ${row("Téléphone", compte.client.telephone)}
    </tbody></table>

    <div class="amount">
      <div><div class="lbl">Solde à la clôture</div></div>
      <div class="big">${fcfa(Number(compte.solde))}</div>
    </div>

    <p class="body-text">
      Le compte ne peut plus recevoir de dépôt ni supporter de retrait ou de paiement.
      La présente attestation est délivrée pour servir et valoir ce que de droit.
    </p>
    <p class="sub">Fait à ${escapeHtml(compte.codeAgence)}, le ${escapeHtml(ceJour)}.</p>`;

  const headerRight = `
    <div class="lbl">Attestation de fermeture</div>
    <div class="val">${escapeHtml(compte.numeroCompte)}</div>
    <div class="sub">${escapeHtml(ceJour)}</div>`;

  const html = renderDocumentCC({
    title: "Attestation de fermeture de compte",
    headerRight, bodyHtml,
    signatures: ["Cachet & signature", "Pour AFRISIME"],
  });

  const pdf = await htmlToPdf(html, { format: "A4" });
  return pdfResponse(pdf, `attestation-fermeture-${compte.numeroCompte}.pdf`, "inline");
}

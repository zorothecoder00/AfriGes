import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { requirePermission } from "@/lib/permissions";
import { htmlToPdf, pdfResponse, escapeHtml } from "@/lib/pdf";
import { renderDocumentCC, fcfa, dLong, row } from "@/lib/compteCourantPdf";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const NATURE_LABEL: Record<string, string> = {
  DEPOT: "Dépôt", RETRAIT: "Retrait", PAIEMENT_CREDIT: "Paiement crédit",
  PAIEMENT_COMPTANT: "Paiement comptant", CORRECTION: "Correction",
  ANNULATION: "Annulation", TRANSFERT: "Transfert",
};

/**
 * GET /api/comptes-courants/[id]/releve?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Relevé de compte PDF (CDC §14) sur une période : soldes d'ouverture/clôture,
 * grand livre des mouvements validés, synthèse dépôts/retraits/paiements.
 */
export async function GET(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "compte_courant", "EXPORT");
  if (denied) return denied;

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : null;
  const to = toStr ? new Date(`${toStr}T23:59:59.999`) : null;

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      numeroCompte: true, ribComplet: true, codeAgence: true, codeGuichet: true,
      statut: true, solde: true, dateOuverture: true,
      client: { select: { nom: true, prenom: true, telephone: true, codeClient: true, commune: true, ville: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  // Solde d'ouverture = solde après le dernier mouvement validé antérieur à la période.
  let soldeOuverture = 0;
  if (from) {
    const avant = await prisma.mouvementCompteCourant.findFirst({
      where: { compteId, statut: "VALIDE", createdAt: { lt: from } },
      orderBy: { createdAt: "desc" }, select: { soldeApres: true },
    });
    soldeOuverture = Number(avant?.soldeApres ?? 0);
  }

  const mouvements = await prisma.mouvementCompteCourant.findMany({
    where: {
      compteId, statut: "VALIDE",
      ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
    },
    orderBy: { createdAt: "asc" },
    select: { nature: true, montant: true, soldeApres: true, reference: true, observation: true, createdAt: true },
  });

  const soldeCloture = mouvements.length ? Number(mouvements[mouvements.length - 1].soldeApres) : (from ? soldeOuverture : Number(compte.solde));
  let totalCredits = 0, totalDebits = 0;
  for (const m of mouvements) {
    const v = Number(m.montant);
    if (v >= 0) totalCredits += v; else totalDebits += -v;
  }

  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const periodeLbl = from || to
    ? `${from ? dLong(from) : "origine"} → ${to ? dLong(to) : "ce jour"}`
    : "Depuis l'ouverture";

  const ligne = (m: (typeof mouvements)[number]) => {
    const v = Number(m.montant);
    const credit = v >= 0 ? fcfa(v) : "";
    const debit = v < 0 ? fcfa(-v) : "";
    return `<tr>
      <td>${escapeHtml(new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }))}</td>
      <td>${escapeHtml(NATURE_LABEL[m.nature] ?? m.nature)}${m.observation ? `<div style="color:#94a3b8;font-size:10px">${escapeHtml(m.observation)}</div>` : ""}</td>
      <td class="num debit">${escapeHtml(debit)}</td>
      <td class="num credit">${escapeHtml(credit)}</td>
      <td class="num">${escapeHtml(fcfa(Number(m.soldeApres)))}</td>
    </tr>`;
  };

  const corps = mouvements.length
    ? mouvements.map(ligne).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:18px">Aucun mouvement sur la période.</td></tr>`;

  const bodyHtml = `
    <table class="meta"><tbody>
      ${row("Titulaire", clientNom)}
      ${row("Téléphone", compte.client.telephone)}
      ${compte.client.codeClient ? row("Code client", compte.client.codeClient) : ""}
      ${row("N° de compte", compte.numeroCompte)}
      ${row("RIB", compte.ribComplet)}
      ${row("Période", periodeLbl)}
    </tbody></table>

    <div class="grid">
      <div class="card"><div class="lbl">Solde d'ouverture</div><div class="num">${fcfa(soldeOuverture)}</div></div>
      <div class="card"><div class="lbl">Total crédits</div><div class="num" style="color:#047857">+ ${fcfa(totalCredits)}</div></div>
      <div class="card"><div class="lbl">Total débits</div><div class="num" style="color:#ea580c">− ${fcfa(totalDebits)}</div></div>
    </div>

    <table class="ledger"><thead><tr>
      <th>Date</th><th>Nature</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th><th style="text-align:right">Solde</th>
    </tr></thead><tbody>${corps}</tbody></table>

    <div class="amount">
      <div><div class="lbl">Solde de clôture au ${escapeHtml(to ? dLong(to) : dLong(new Date()))}</div></div>
      <div class="big">${fcfa(soldeCloture)}</div>
    </div>`;

  const headerRight = `
    <div class="lbl">Relevé de compte</div>
    <div class="val">${escapeHtml(compte.numeroCompte)}</div>
    <div class="sub">${escapeHtml(periodeLbl)}</div>`;

  const html = renderDocumentCC({
    title: "Relevé de compte courant",
    headerRight, bodyHtml,
    signatures: ["Le client", "Pour AFRISIME"],
  });

  const pdf = await htmlToPdf(html, { format: "A4" });
  return pdfResponse(pdf, `releve-${compte.numeroCompte}.pdf`, "inline");
}

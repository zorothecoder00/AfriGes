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
 * GET /api/comptes-courants/[id]/carnet
 * Carnet / livret de compte PDF (CDC §14) : historique chronologique complet
 * des mouvements validés, façon livret d'épargne, avec solde courant.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "compte_courant", "EXPORT");
  if (denied) return denied;

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      numeroCompte: true, ribComplet: true, codeAgence: true, codeGuichet: true,
      statut: true, solde: true, dateOuverture: true,
      totalDepose: true, totalRetire: true, totalUtilise: true, nbMouvements: true,
      client: { select: { nom: true, prenom: true, telephone: true, codeClient: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const mouvements = await prisma.mouvementCompteCourant.findMany({
    where: { compteId, statut: "VALIDE" },
    orderBy: { createdAt: "asc" },
    select: { nature: true, montant: true, soldeApres: true, modePaiement: true, createdAt: true },
  });

  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;

  const ligne = (m: (typeof mouvements)[number]) => {
    const v = Number(m.montant);
    return `<tr>
      <td>${escapeHtml(new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }))}</td>
      <td>${escapeHtml(NATURE_LABEL[m.nature] ?? m.nature)}${m.modePaiement ? `<span style="color:#94a3b8"> · ${escapeHtml(m.modePaiement)}</span>` : ""}</td>
      <td class="num debit">${v < 0 ? escapeHtml(fcfa(-v)) : ""}</td>
      <td class="num credit">${v >= 0 ? escapeHtml(fcfa(v)) : ""}</td>
      <td class="num">${escapeHtml(fcfa(Number(m.soldeApres)))}</td>
    </tr>`;
  };

  const corps = mouvements.length
    ? mouvements.map(ligne).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:18px">Carnet vierge — aucun mouvement.</td></tr>`;

  const bodyHtml = `
    <table class="meta"><tbody>
      ${row("Titulaire", clientNom)}
      ${compte.client.codeClient ? row("Code client", compte.client.codeClient) : ""}
      ${row("N° de compte", compte.numeroCompte)}
      ${row("RIB", compte.ribComplet)}
      ${row("Ouvert le", dLong(compte.dateOuverture))}
    </tbody></table>

    <div class="grid">
      <div class="card"><div class="lbl">Total déposé</div><div class="num" style="color:#047857">${fcfa(Number(compte.totalDepose))}</div></div>
      <div class="card"><div class="lbl">Total retiré</div><div class="num" style="color:#ea580c">${fcfa(Number(compte.totalRetire))}</div></div>
      <div class="card"><div class="lbl">Total utilisé</div><div class="num" style="color:#2563eb">${fcfa(Number(compte.totalUtilise))}</div></div>
    </div>

    <table class="ledger"><thead><tr>
      <th>Date</th><th>Opération</th><th style="text-align:right">Retrait</th><th style="text-align:right">Dépôt</th><th style="text-align:right">Solde</th>
    </tr></thead><tbody>${corps}</tbody></table>

    <div class="amount">
      <div><div class="lbl">Solde courant · ${escapeHtml(String(compte.nbMouvements))} mouvement(s)</div></div>
      <div class="big">${fcfa(Number(compte.solde))}</div>
    </div>`;

  const headerRight = `
    <div class="lbl">Carnet de compte</div>
    <div class="val">${escapeHtml(compte.numeroCompte)}</div>
    <div class="sub">${escapeHtml(dLong(new Date()))}</div>`;

  const html = renderDocumentCC({ title: "Carnet de compte courant", headerRight, bodyHtml });

  const pdf = await htmlToPdf(html, { format: "A4" });
  return pdfResponse(pdf, `carnet-${compte.numeroCompte}.pdf`, "inline");
}

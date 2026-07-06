import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { htmlToPdf, pdfResponse, escapeHtml } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; mid: string }> };

const NATURE_LABEL: Record<string, string> = {
  DEPOT: "Reçu de dépôt", RETRAIT: "Reçu de retrait",
  PAIEMENT_CREDIT: "Paiement crédit", PAIEMENT_COMPTANT: "Paiement comptant",
  CORRECTION: "Correction", ANNULATION: "Annulation", TRANSFERT: "Transfert",
};

const fcfa = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
const dt = (d: Date) => new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

/**
 * GET /api/comptes-courants/[id]/mouvements/[mid]/recu
 * Reçu PDF d'un mouvement (CDC §13).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, mid } = await params;
  const mouvement = await prisma.mouvementCompteCourant.findFirst({
    where: { id: Number(mid), compteId: Number(id) },
    select: {
      reference: true, nature: true, montant: true, soldeAvant: true, soldeApres: true,
      modePaiement: true, observation: true, createdAt: true,
      user: { select: { nom: true, prenom: true } },
      compte: {
        select: {
          numeroCompte: true, ribComplet: true, codeAgence: true,
          client: { select: { nom: true, prenom: true, telephone: true, codeClient: true } },
        },
      },
    },
  });
  if (!mouvement) return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });

  const c = mouvement.compte;
  const titre = NATURE_LABEL[mouvement.nature] ?? "Reçu d'opération";
  const signe = Number(mouvement.montant) < 0 ? "−" : "+";

  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#64748b">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a">${escapeHtml(v)}</td></tr>`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,"Helvetica Neue",sans-serif;color:#0f172a;padding:28px;max-width:620px;margin:0 auto}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #047857;padding-bottom:12px;margin-bottom:16px}
    .brand{font-size:20px;font-weight:900;color:#047857}
    .sub{font-size:11px;color:#64748b}
    h1{font-size:16px;color:#065f46;margin:14px 0 4px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    .amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;margin:16px 0;display:flex;justify-content:space-between;align-items:center}
    .amount .big{font-size:24px;font-weight:900;color:#047857}
    .sign{display:flex;gap:60px;margin-top:36px}
    .sign div{flex:1;border-top:1px solid #0f172a;padding-top:6px;font-size:11px;color:#64748b;text-align:center}
    .foot{margin-top:26px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#94a3b8;text-align:center}
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">AFRISIME</div>
        <div class="sub">Compte Courant — Portefeuille interne</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#64748b">Référence</div>
        <div style="font-family:monospace;font-weight:700">${escapeHtml(mouvement.reference)}</div>
        <div class="sub">${escapeHtml(dt(mouvement.createdAt))}</div>
      </div>
    </div>

    <h1>${escapeHtml(titre)}</h1>

    <div class="amount">
      <div>
        <div class="sub">Montant</div>
        <div class="big">${signe} ${escapeHtml(fcfa(Math.abs(Number(mouvement.montant))))}</div>
      </div>
      <div style="text-align:right">
        <div class="sub">Nouveau solde</div>
        <div style="font-size:18px;font-weight:800">${escapeHtml(fcfa(Number(mouvement.soldeApres)))}</div>
      </div>
    </div>

    <table>
      ${row("Client", `${c.client.prenom} ${c.client.nom}`)}
      ${row("Téléphone", c.client.telephone)}
      ${c.client.codeClient ? row("Code client", c.client.codeClient) : ""}
      ${row("N° de compte", c.numeroCompte)}
      ${row("RIB", c.ribComplet)}
      ${row("Agence", c.codeAgence)}
      ${mouvement.modePaiement ? row("Mode de paiement", mouvement.modePaiement) : ""}
      ${row("Solde avant", fcfa(Number(mouvement.soldeAvant)))}
      ${row("Solde après", fcfa(Number(mouvement.soldeApres)))}
      ${row("Opérateur", mouvement.user ? `${mouvement.user.prenom} ${mouvement.user.nom}` : "—")}
      ${mouvement.observation ? row("Observation", mouvement.observation) : ""}
    </table>

    <div class="sign">
      <div>Signature client</div>
      <div>Signature caissier</div>
    </div>

    <div class="foot">Document généré le ${escapeHtml(dt(new Date()))} · AFRISIME — reçu à conserver</div>
  </body></html>`;

  const pdf = await htmlToPdf(html, { format: "A4", margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" } });
  return pdfResponse(pdf, `recu-${mouvement.reference}.pdf`, "inline");
}

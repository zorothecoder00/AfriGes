import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { htmlToPdf, pdfResponse, escapeHtml } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

const MOIS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MODE_LABEL: Record<string, string> = {
  VIREMENT:     "Virement bancaire",
  MOBILE_MONEY: "Mobile Money",
  ESPECES:      "Espèces",
  NON_AFFECTE:  "Mode non affecté",
};
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

/**
 * GET /api/admin/rh/paie/ordres-paiement/liste?mode=VIREMENT&mois=&annee=&statut=
 * Génère la liste de paiement (PDF) d'un mode donné (CDC 13.8).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const mode   = searchParams.get("mode") ?? "VIREMENT";
    const mois   = searchParams.get("mois");
    const annee  = searchParams.get("annee");
    const statut = searchParams.get("statut") ?? "EN_PAIEMENT";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { statut };
    if (mois)  where.mois  = Number(mois);
    if (annee) where.annee = Number(annee);
    where.modePaiement = mode === "NON_AFFECTE" ? null : mode;

    const fiches = await prisma.fichePaie.findMany({
      where,
      orderBy: { profilRH: { gestionnaire: { member: { nom: "asc" } } } },
      select: {
        netAPayer: true,
        profilRH: {
          select: {
            matricule: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    const total   = fiches.reduce((s, f) => s + Number(f.netAPayer), 0);
    const periode = mois && annee ? `${MOIS[Number(mois)]} ${annee}` : "Toutes périodes";

    const rows = fiches.map((f, i) => {
      const m = f.profilRH.gestionnaire.member;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:monospace;color:#334155;">${escapeHtml(f.profilRH.matricule)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#0f172a;">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${escapeHtml(f.profilRH.departement ?? "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;text-align:right;color:#0f172a;font-variant-numeric:tabular-nums;">${fmt(Number(f.netAPayer))}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" /><title>Liste ${escapeHtml(MODE_LABEL[mode] ?? mode)}</title></head>
    <body style="font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;margin:0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #7c3aed;padding-bottom:14px;margin-bottom:18px;">
        <div><div style="font-size:22px;font-weight:bold;color:#6d28d9;">AfriGes</div><div style="font-size:11px;color:#64748b;">Gestion RH &amp; Paie</div></div>
        <div style="text-align:right;">
          <div style="font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;">Liste de paiement</div>
          <div style="font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(MODE_LABEL[mode] ?? mode)} · ${escapeHtml(periode)}</div>
          <div style="font-size:11px;color:#94a3b8;">${fiches.length} bénéficiaire(s)</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f5f3ff;">
          <th style="padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6d28d9;">#</th>
          <th style="padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6d28d9;">Matricule</th>
          <th style="padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6d28d9;">Bénéficiaire</th>
          <th style="padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6d28d9;">Département</th>
          <th style="padding:7px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#6d28d9;">Net à payer (FCFA)</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;">Aucune fiche</td></tr>`}</tbody>
        <tfoot><tr style="background:#7c3aed;color:#fff;">
          <td colspan="4" style="padding:10px 8px;font-size:13px;font-weight:bold;text-transform:uppercase;">Total à décaisser</td>
          <td style="padding:10px 8px;font-size:15px;font-weight:bold;text-align:right;font-variant-numeric:tabular-nums;">${fmt(total)} FCFA</td>
        </tr></tfoot>
      </table>
      <table style="width:100%;margin-top:48px;"><tr>
        <td style="width:50%;font-size:11px;color:#64748b;">Préparé par (RH)<br/><br/><br/>______________________</td>
        <td style="width:50%;font-size:11px;color:#64748b;">Approuvé par (Direction / Finance)<br/><br/><br/>______________________</td>
      </tr></table>
      <p style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;">Liste générée le ${new Date().toLocaleDateString("fr-FR")} · Confidentiel · AfriGes RH</p>
    </body></html>`;

    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `liste-paiement-${mode}-${mois ?? "all"}-${annee ?? ""}.pdf`);
  } catch (error) {
    console.error("GET /api/admin/rh/paie/ordres-paiement/liste", error);
    return NextResponse.json({ error: "Erreur lors de la génération de la liste" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { genererRapport, type TypeRapport, type RapportPOPC } from "@/lib/popc/rapportsServer";
import { htmlToPdf, wrapHtmlDocument, pdfResponse, escapeHtml } from "@/lib/pdf";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

export const runtime = "nodejs";
export const maxDuration = 60;

const TYPES: TypeRapport[] = [
  "journalier", "hebdomadaire", "quinzaine", "trentaine", "mensuel", "annuel",
  "comparatif", "rentabilite-agence", "rentabilite-commercial", "rentabilite-superviseur",
  "prevision-collectes", "prevision-clients",
];

/** Construit le HTML imprimable d'un rapport (en-tête société + tableau). */
function rapportToHtml(r: RapportPOPC): string {
  const th = r.colonnes.map((c) =>
    `<th style="text-align:${c.type && c.type !== "text" ? "right" : "left"}">${escapeHtml(c.label)}</th>`).join("");
  const bodyRows = r.lignes.map((ligne) =>
    `<tr>${ligne.map((cell, i) => {
      const align = r.colonnes[i]?.type && r.colonnes[i].type !== "text" ? "right" : "left";
      const val = typeof cell === "number" ? new Intl.NumberFormat("fr-FR").format(cell) : escapeHtml(String(cell));
      return `<td style="text-align:${align}">${val}</td>`;
    }).join("")}</tr>`).join("");
  const totaux = r.totaux
    ? `<tfoot><tr>${r.totaux.map((cell, i) => {
        const align = r.colonnes[i]?.type && r.colonnes[i].type !== "text" ? "right" : "left";
        const val = typeof cell === "number" ? new Intl.NumberFormat("fr-FR").format(cell) : escapeHtml(String(cell));
        return `<td style="text-align:${align}"><strong>${val}</strong></td>`;
      }).join("")}</tr></tfoot>`
    : "";
  const resume = r.resume.length
    ? `<div class="resume">${r.resume.map((x) => `<span><b>${escapeHtml(x.label)}:</b> ${escapeHtml(x.valeur)}</span>`).join("")}</div>`
    : "";

  const body = `
    <div class="entete">
      <div class="soc">${escapeHtml(SOCIETE.nom)}</div>
      <div class="module">Module POPC — Planification & Pilotage des Collectes</div>
    </div>
    <h1>${escapeHtml(r.titre)}</h1>
    <div class="periode">Période : ${escapeHtml(r.periode)} · Généré le ${new Date(r.genereLe).toLocaleString("fr-FR")}</div>
    ${resume}
    <table>
      <thead><tr>${th}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${r.colonnes.length}" style="text-align:center;color:#999">Aucune donnée</td></tr>`}</tbody>
      ${totaux}
    </table>
    <div class="pied">${escapeHtml(SOCIETE_PIED)}</div>
    <style>
      * { font-family: 'Segoe UI', Arial, sans-serif; }
      .entete { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #4338ca; padding-bottom:8px; margin-bottom:14px; }
      .soc { font-size:18px; font-weight:700; color:#4338ca; }
      .module { font-size:11px; color:#666; }
      h1 { font-size:18px; margin:6px 0; color:#1e293b; }
      .periode { font-size:11px; color:#666; margin-bottom:10px; }
      .resume { display:flex; gap:18px; flex-wrap:wrap; background:#eef2ff; padding:10px 14px; border-radius:8px; margin-bottom:14px; font-size:12px; }
      table { width:100%; border-collapse:collapse; font-size:11.5px; }
      th { background:#4338ca; color:#fff; padding:7px 9px; }
      td { padding:6px 9px; border-bottom:1px solid #e2e8f0; }
      tbody tr:nth-child(even) { background:#f8fafc; }
      tfoot td { background:#eef2ff; border-top:2px solid #c7d2fe; }
      .pied { margin-top:20px; font-size:9px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; padding-top:8px; }
    </style>`;
  return wrapHtmlDocument(body, r.titre);
}

/**
 * GET /api/popc/rapports?type=&format=pdf|json&annee=&mois=&date=&pointDeVenteId=
 * Rapports POPC (CDC §13). format=pdf → PDF ; format=json → données (Excel côté client).
 */
export async function GET(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.consulter) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as TypeRapport | null;
  if (!type || !TYPES.includes(type)) {
    return NextResponse.json({ error: "Type de rapport invalide" }, { status: 400 });
  }
  const format = searchParams.get("format") === "pdf" ? "pdf" : "json";
  const now = new Date();
  const annee = Number(searchParams.get("annee")) || now.getFullYear();
  const mois = Number(searchParams.get("mois")) || now.getMonth() + 1;
  const date = searchParams.get("date") || undefined;

  // Scoping agence si le profil est limité à son PDV.
  let pdv = Number(searchParams.get("pointDeVenteId")) || 0;
  if (ctx.capacites.portee === "agence") {
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: ctx.userId, actif: true }, select: { pointDeVenteId: true },
    });
    pdv = aff?.pointDeVenteId ?? 0;
  }

  const rapport = await genererRapport(type, { annee, mois, date, pdv });

  if (format === "pdf") {
    const pdf = await htmlToPdf(rapportToHtml(rapport), { format: "A4", landscape: rapport.colonnes.length > 5 });
    return pdfResponse(pdf, `POPC-${type}-${annee}${String(mois).padStart(2, "0")}.pdf`, "attachment");
  }
  return NextResponse.json({ data: rapport });
}

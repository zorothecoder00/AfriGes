"use client";

// Bouton de génération d'un « Acte de résolution » imprimable (PV formel).
// Disponible dans les 3 portails (admin, responsableRIA, membres de commission) :
// la route /api/membreCommission/resolutions/[id] est accessible à tous ces rôles.
// Au clic, on récupère la résolution + le contexte de sa réunion (commission, date,
// organisateur, présences/quórum) et on ouvre une fenêtre d'impression.

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { commissionLabel } from "@/lib/commissionsRIA";

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
  EN_APPLICATION: "En application",
  APPLIQUEE: "Appliquée",
  EN_PREPARATION: "En préparation",
  SOUMISE: "Soumise au vote",
  ADOPTEE: "Adoptée",
  EXECUTEE: "Exécutée",
};

interface ActeData {
  numero: string;
  titre: string;
  description: string | null;
  statut: string;
  dateEcheance: string | null;
  typeCommission: string;
  createdAt: string;
  reunion: {
    titre: string;
    dateHeure: string;
    lieu: string | null;
    organisateur: { nom: string; prenom: string } | null;
    presences: { present: boolean; procuration: boolean; membre: { role: string; user: { nom: string; prenom: string } } }[];
  } | null;
  responsable: { nom: string; prenom: string } | null;
  plansAction: { titre: string; statut: string; responsable: { nom: string; prenom: string } | null }[];
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateCourt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

function buildHtml(r: ActeData): string {
  const presences = r.reunion?.presences ?? [];
  const presents = presences.filter((p) => p.present).length;
  const quorum = presences.length > 0 ? `${presents} / ${presences.length} membres présents` : "—";
  const organisateur = r.reunion?.organisateur ? `${r.reunion.organisateur.prenom} ${r.reunion.organisateur.nom}` : "—";
  const statut = STATUT_LABEL[r.statut] ?? r.statut;

  const presencesRows = presences.length
    ? presences
        .map(
          (p) => `<tr>
            <td>${esc(p.membre.user.prenom)} ${esc(p.membre.user.nom)}</td>
            <td>${esc(p.membre.role.replace(/_/g, " "))}</td>
            <td class="center">${p.present ? "Présent" : p.procuration ? "Procuration" : "Absent"}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted center">Aucune présence enregistrée</td></tr>`;

  const plansRows = r.plansAction.length
    ? r.plansAction
        .map(
          (p) => `<li>${esc(p.titre)}${p.responsable ? ` — <em>${esc(p.responsable.prenom)} ${esc(p.responsable.nom)}</em>` : ""} <span class="tag">${esc(p.statut.replace(/_/g, " "))}</span></li>`,
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Acte de résolution ${esc(r.numero)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #1e293b; margin: 0; padding: 40px 48px; line-height: 1.5; }
  .doc { max-width: 720px; margin: 0 auto; }
  .head { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
  .head .org { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; }
  .head h1 { font-size: 22px; margin: 8px 0 4px; letter-spacing: 1px; }
  .head .num { font-family: monospace; font-size: 14px; color: #475569; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 13px; margin-bottom: 24px; }
  .meta div { padding: 2px 0; }
  .meta .k { color: #64748b; }
  .meta .v { font-weight: bold; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 22px 0 10px; }
  .titre-res { font-size: 16px; font-weight: bold; margin: 4px 0 8px; }
  .desc { font-size: 13.5px; white-space: pre-line; text-align: justify; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .center { text-align: center; }
  .muted { color: #94a3b8; }
  .tag { font-size: 10.5px; background: #e2e8f0; border-radius: 8px; padding: 1px 6px; }
  ul { margin: 6px 0; padding-left: 20px; font-size: 13px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 56px; }
  .sign .slot { text-align: center; }
  .sign .line { border-top: 1px solid #1e293b; margin-top: 48px; padding-top: 6px; font-size: 12px; color: #475569; }
  .foot { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print { body { padding: 0; } .doc { max-width: none; } @page { margin: 18mm; } }
</style></head>
<body><div class="doc">
  <div class="head">
    <div class="org">Réseau des Investisseurs AfriSime — Gouvernance</div>
    <h1>Acte de Résolution</h1>
    <div class="num">N° ${esc(r.numero)}</div>
  </div>

  <div class="meta">
    <div><span class="k">Commission :</span> <span class="v">${esc(commissionLabel(r.typeCommission))}</span></div>
    <div><span class="k">Statut :</span> <span class="v">${esc(statut)}</span></div>
    <div><span class="k">Réunion :</span> <span class="v">${esc(r.reunion?.titre ?? "—")}</span></div>
    <div><span class="k">Date de réunion :</span> <span class="v">${r.reunion ? esc(dateLong(r.reunion.dateHeure)) : "—"}</span></div>
    <div><span class="k">Lieu :</span> <span class="v">${esc(r.reunion?.lieu ?? "—")}</span></div>
    <div><span class="k">Quórum :</span> <span class="v">${esc(quorum)}</span></div>
    <div><span class="k">Organisateur :</span> <span class="v">${esc(organisateur)}</span></div>
    <div><span class="k">Échéance :</span> <span class="v">${r.dateEcheance ? esc(dateCourt(r.dateEcheance)) : "—"}</span></div>
    <div><span class="k">Responsable :</span> <span class="v">${r.responsable ? `${esc(r.responsable.prenom)} ${esc(r.responsable.nom)}` : "—"}</span></div>
  </div>

  <h2>Objet de la résolution</h2>
  <p class="titre-res">${esc(r.titre)}</p>
  ${r.description ? `<p class="desc">${esc(r.description)}</p>` : `<p class="desc muted">Aucune description.</p>`}

  ${plansRows ? `<h2>Plans d'action associés</h2><ul>${plansRows}</ul>` : ""}

  <h2>Émargement de la réunion</h2>
  <table>
    <thead><tr><th>Membre</th><th>Rôle</th><th class="center">Présence</th></tr></thead>
    <tbody>${presencesRows}</tbody>
  </table>

  <div class="sign">
    <div class="slot"><div class="line">Le Président de la Commission</div></div>
    <div class="slot"><div class="line">Le Rapporteur</div></div>
  </div>

  <div class="foot">Document généré le ${esc(dateCourt(new Date().toISOString()))} — AfriGes / Gouvernance RIA</div>
</div>
</body></html>`;
}

export function ActeResolutionButton({
  resolutionId,
  label = "Acte",
  className,
}: {
  resolutionId: number;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function generer() {
    setLoading(true);
    try {
      const res = await fetch(`/api/membreCommission/resolutions/${resolutionId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Impossible de charger la résolution");
        return;
      }
      const w = window.open("", "_blank", "width=840,height=920");
      if (!w) {
        toast.error("Autorisez les pop-ups pour générer le document");
        return;
      }
      w.document.write(buildHtml(data as ActeData));
      w.document.close();
      setTimeout(() => w.print(), 300);
    } catch {
      toast.error("Erreur réseau lors de la génération");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={generer}
      disabled={loading}
      title="Générer l'acte de résolution (PDF imprimable)"
      className={
        className ??
        "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
      }
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

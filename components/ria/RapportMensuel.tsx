"use client";

import { TrendingUp, Users, AlertCircle, Wallet, BarChart2, XCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FinDetail {
  reference: string; client: string; statut: string;
  montant: number; rembourse: number; encours: number; dateEcheance: string | null;
}
export interface DistribItem {
  montantGenere: number; montantDistribue: number;
  montantReinvesti: number; montantFondSecurite: number;
}
export interface OpItem { date: string; montant: number; motif: string | null }

export interface DonneesRapport {
  periode:         { mois: number; annee: number; label: string };
  portefeuille:    { reference: string; nom: string | null; investisseur: string; numero: string | null };
  capitalInvesti:   number; capitalEngage: number; capitalRecupere: number; capitalDisponible: number;
  rendementMois:   number; gainsRealises: number; gainsTotal: number;
  clientsFinances: number;
  encours: number; montantFinanceTotal: number; montantRecouvreTotal: number; tauxRecouvrement: number;
  retardsNb: number; retardsMontant: number;
  creancesDouteuseNb: number; creancesDouteusesMontant: number;
  creancesPerduseNb: number; creancesPerdusesMontant: number;
  depots: OpItem[]; retraits: OpItem[]; distributions: DistribItem[];
  financementsDetail: FinDetail[];
  genereA: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}
function pct(n: number) { return n.toFixed(2) + " %" }

const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", EN_RETARD: "En retard", DEFAUT: "Défaut", REMBOURSE: "Remboursé", ANNULE: "Annulé",
};
const STATUT_COLOR: Record<string, string> = {
  ACTIF: "text-blue-700", EN_RETARD: "text-orange-700", DEFAUT: "text-red-700",
  REMBOURSE: "text-emerald-700", ANNULE: "text-slate-500",
};

// ── Export Excel (SpreadsheetML natif — aucune dépendance) ─────────────────────

export function exportExcelRapport(d: DonneesRapport) {
  const E = (v: string | number) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (...cells: (string | number)[]) =>
    `<Row>${cells.map((c) => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${E(c)}</Data></Cell>`).join("")}</Row>`;

  const sheet1 = [
    row("RAPPORT MENSUEL RIA — " + d.periode.label),
    row("Portefeuille", d.portefeuille.reference + (d.portefeuille.nom ? " — " + d.portefeuille.nom : "")),
    row("Investisseur", d.portefeuille.investisseur),
    row(""),
    row("MÉTRIQUES FINANCIÈRES", ""),
    row("Capital investi",          d.capitalInvesti),
    row("Capital engagé",           d.capitalEngage),
    row("Capital récupéré",         d.capitalRecupere),
    row("Capital disponible",       d.capitalDisponible),
    row("Gains réalisés (mois)",    d.gainsRealises),
    row("Gains total",              d.gainsTotal),
    row("Rendement du mois (%)",    d.rendementMois),
    row(""),
    row("PORTEFEUILLE CLIENTS", ""),
    row("Clients financés",         d.clientsFinances),
    row("Encours total",            d.encours),
    row("Montant financé total",    d.montantFinanceTotal),
    row("Montant recouvré total",   d.montantRecouvreTotal),
    row("Taux de recouvrement (%)", d.tauxRecouvrement),
    row(""),
    row("RISQUES", ""),
    row("Nb retards actifs",              d.retardsNb),
    row("Montant en retard",              d.retardsMontant),
    row("Créances douteuses (nb)",        d.creancesDouteuseNb),
    row("Créances douteuses (montant)",   d.creancesDouteusesMontant),
    row("Créances perdues (nb)",          d.creancesPerduseNb),
    row("Créances perdues (montant)",     d.creancesPerdusesMontant),
  ].join("\n");

  const sheet2Rows = [
    row("Référence", "Client", "Statut", "Montant financé", "Remboursé", "Encours"),
    ...d.financementsDetail.map((f) =>
      row(f.reference, f.client, STATUT_LABEL[f.statut] ?? f.statut, f.montant, f.rembourse, f.encours)
    ),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Worksheet ss:Name="Synthèse"><Table>${sheet1}</Table></Worksheet>
  <Worksheet ss:Name="Financements"><Table>${sheet2Rows}</Table></Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `rapport-ria-${d.portefeuille.reference}-${d.periode.annee}-${String(d.periode.mois).padStart(2, "0")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Composant rapport partagé (admin + investisseur) ──────────────────────────

export function RapportContent({ d, genereA }: { d: DonneesRapport; genereA: string }) {
  return (
    <div className="rapport-content space-y-6 font-sans text-slate-800">

      {/* En-tête */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rapport Mensuel RIA</h1>
          <p className="text-lg font-semibold text-emerald-700 mt-0.5">{d.periode.label}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p className="font-medium text-slate-700">
            {d.portefeuille.reference}{d.portefeuille.nom ? ` — ${d.portefeuille.nom}` : ""}
          </p>
          <p>Investisseur : <strong>{d.portefeuille.investisseur}</strong></p>
          {d.portefeuille.numero && <p>Dossier {d.portefeuille.numero}</p>}
          <p className="mt-1">
            Généré le {new Date(genereA).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Capital */}
      <section>
        <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-600" /> Capital
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Capital investi",    val: d.capitalInvesti,    color: "border-t-emerald-500" },
            { label: "Capital engagé",     val: d.capitalEngage,     color: "border-t-blue-500" },
            { label: "Capital récupéré",   val: d.capitalRecupere,   color: "border-t-violet-500" },
            { label: "Capital disponible", val: d.capitalDisponible, color: "border-t-cyan-500" },
          ].map((c) => (
            <div key={c.label} className={`bg-slate-50 border border-slate-200 border-t-4 ${c.color} rounded-xl p-4`}>
              <p className="text-xs text-slate-500 mb-1">{c.label}</p>
              <p className="text-lg font-bold text-slate-800">{fmt(c.val)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rendement & Gains */}
      <section>
        <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" /> Rendement & Gains
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Rendement du mois",     val: pct(d.rendementMois) },
            { label: "Gains réalisés (mois)",  val: fmt(d.gainsRealises) },
            { label: "Gains total cumulé",     val: fmt(d.gainsTotal) },
          ].map((c) => (
            <div key={c.label} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-700 mb-1">{c.label}</p>
              <p className="text-xl font-bold text-emerald-800">{c.val}</p>
            </div>
          ))}
        </div>
        {d.distributions.length > 0 && (
          <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Généré</th>
                  <th className="px-3 py-2 text-right">Distribué</th>
                  <th className="px-3 py-2 text-right">Réinvesti</th>
                  <th className="px-3 py-2 text-right">Fonds sécu.</th>
                </tr>
              </thead>
              <tbody>
                {d.distributions.map((dist, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2">{fmt(dist.montantGenere)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-medium">{fmt(dist.montantDistribue)}</td>
                    <td className="px-3 py-2 text-right">{fmt(dist.montantReinvesti)}</td>
                    <td className="px-3 py-2 text-right">{fmt(dist.montantFondSecurite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Portefeuille clients */}
      <section>
        <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" /> Portefeuille Clients
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Clients financés",     val: d.clientsFinances.toString() },
            { label: "Encours total",         val: fmt(d.encours) },
            { label: "Montant financé total", val: fmt(d.montantFinanceTotal) },
            { label: "Taux de recouvrement", val: pct(d.tauxRecouvrement) },
          ].map((c) => (
            <div key={c.label} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-700 mb-1">{c.label}</p>
              <p className="text-lg font-bold text-blue-800">{c.val}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Progression du recouvrement</span>
            <span className="font-medium text-slate-700">
              {fmt(d.montantRecouvreTotal)} / {fmt(d.montantFinanceTotal)}
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${d.tauxRecouvrement >= 80 ? "bg-emerald-500" : d.tauxRecouvrement >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, d.tauxRecouvrement)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Risques */}
      <section>
        <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600" /> Analyse des Risques
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`rounded-xl border p-4 ${d.retardsNb > 0 ? "bg-orange-50 border-orange-300" : "bg-slate-50 border-slate-200"}`}>
            <p className="text-xs text-slate-500 mb-1">Retards actifs</p>
            <p className="text-xl font-bold text-orange-700">{d.retardsNb} financement(s)</p>
            <p className="text-sm font-medium text-orange-600 mt-0.5">{fmt(d.retardsMontant)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${d.creancesDouteuseNb > 0 ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"}`}>
            <p className="text-xs text-slate-500 mb-1">Créances douteuses <span className="text-xs">(retard &gt; 30j)</span></p>
            <p className="text-xl font-bold text-amber-700">{d.creancesDouteuseNb} dossier(s)</p>
            <p className="text-sm font-medium text-amber-600 mt-0.5">{fmt(d.creancesDouteusesMontant)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${d.creancesPerduseNb > 0 ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"}`}>
            <p className="text-xs text-slate-500 mb-1">Créances perdues <span className="text-xs">(défaut)</span></p>
            <p className="text-xl font-bold text-red-700">{d.creancesPerduseNb} dossier(s)</p>
            <p className="text-sm font-medium text-red-600 mt-0.5">{fmt(d.creancesPerdusesMontant)}</p>
          </div>
        </div>
      </section>

      {/* Opérations du mois */}
      {(d.depots.length > 0 || d.retraits.length > 0) && (
        <section>
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-600" /> Opérations du mois
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {d.depots.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <p className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200">
                  Dépôts validés ({d.depots.length})
                </p>
                {d.depots.map((dep, i) => (
                  <div key={i} className="px-3 py-2 flex justify-between border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-500">
                      {new Date(dep.date).toLocaleDateString("fr-FR")}
                      {dep.motif ? ` — ${dep.motif}` : ""}
                    </span>
                    <span className="text-sm font-medium text-emerald-700">{fmt(dep.montant)}</span>
                  </div>
                ))}
              </div>
            )}
            {d.retraits.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <p className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200">
                  Retraits payés ({d.retraits.length})
                </p>
                {d.retraits.map((ret, i) => (
                  <div key={i} className="px-3 py-2 flex justify-between border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-500">
                      {new Date(ret.date).toLocaleDateString("fr-FR")}
                      {ret.motif ? ` — ${ret.motif}` : ""}
                    </span>
                    <span className="text-sm font-medium text-red-700">{fmt(ret.montant)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Détail financements */}
      {d.financementsDetail.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-slate-500" /> Détail des financements actifs
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Réf.</th>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-right">Financé</th>
                  <th className="px-3 py-2 text-right">Remboursé</th>
                  <th className="px-3 py-2 text-right">Encours</th>
                  <th className="px-3 py-2 text-right">Échéance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.financementsDetail.map((f, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-xs font-mono text-slate-600">{f.reference}</td>
                    <td className="px-3 py-2 font-medium">{f.client}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${STATUT_COLOR[f.statut] ?? "text-slate-600"}`}>
                        {STATUT_LABEL[f.statut] ?? f.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmt(f.montant)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{fmt(f.rembourse)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(f.encours)}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">
                      {f.dateEcheance ? new Date(f.dateEcheance).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pied de page (print seulement) */}
      <div className="hidden print:block border-t border-slate-200 pt-4 text-xs text-slate-400 text-center">
        Rapport généré automatiquement par AfriGes —{" "}
        {new Date(genereA).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

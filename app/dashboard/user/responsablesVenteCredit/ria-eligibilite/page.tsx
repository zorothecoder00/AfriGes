"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  RefreshCw, Search, Network, CheckCircle2, XCircle,
  ShieldCheck, Calculator, Trash2, AlertTriangle, Info,
  ShoppingCart, CreditCard, Package,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Eligibilite {
  id: number;
  ancienneteJours: number | null;
  nbAchats: number | null;
  volumeAchats: number | null;
  rotationCommerciale: number | null;
  nbCredits: number | null;
  nbCreditsRetard: number | null;
  volumeCredits: number | null;
  nbPacks: number | null;
  scoreEligibilite: number | null;
  classeRisque: string;
  statut: "EN_ATTENTE" | "ELIGIBLE" | "REFUSE" | "VALIDE" | "RETIRE";
  motifs: string[];
  decisionAuto: boolean;
  dateDecision: string | null;
  identifiePar: { nom: string; prenom: string } | null;
}

interface ClientRow {
  id: number; codeClient: string | null; nom: string; prenom: string; telephone: string;
  activite: string | null; ville: string | null;
  createdAt: string;
  pointDeVente: { nom: string; code: string } | null;
  eligibiliteRIA: Eligibilite | null;
  // Indicateurs live calculés par l'API (sur ventes + crédits + packs)
  niveauRisque: string | null;   // risque recalculé
  solvabilite: number | null;    // solvabilité 0–100 recalculée
  nbVentes: number; nbPacks: number; nbCredits: number; nbCreditsRetard: number; encoursCredit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: unknown) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n ?? 0)));
const ancienneteLabel = (jours: number) => {
  if (jours >= 365) return `${Math.floor(jours / 365)} an${jours >= 730 ? "s" : ""}`;
  if (jours >= 30) return `${Math.floor(jours / 30)} mois`;
  return `${jours} j`;
};

const STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE: "bg-slate-100 text-slate-600 border-slate-200",
  ELIGIBLE:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  REFUSE:     "bg-red-50 text-red-600 border-red-200",
  VALIDE:     "bg-blue-50 text-blue-700 border-blue-200",
  RETIRE:     "bg-amber-50 text-amber-700 border-amber-200",
};
const RISQUE_COLOR: Record<string, string> = {
  FAIBLE: "text-emerald-600", MOYEN: "text-amber-600", ELEVE: "text-orange-600", CRITIQUE: "text-red-600",
};
const CLASSE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800", B: "bg-blue-100 text-blue-800", C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800", E: "bg-red-100 text-red-800",
};

const TABS = ["", "EN_ATTENTE", "ELIGIBLE", "REFUSE", "VALIDE", "RETIRE"] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RiaEligibilitePage() {
  const [statut, setStatut] = useState<string>("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const { data: res, loading, refetch } = useApi<{ data: ClientRow[]; meta: { total: number } }>(
    `/api/rvc/ria/eligibilite?limit=50${statut ? `&statut=${statut}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`
  );
  const clients = res?.data ?? [];

  const evaluer = async (c: ClientRow) => {
    setBusy(c.id);
    try {
      const r = await fetch("/api/rvc/ria/eligibilite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: c.id }),
      });
      const json = await r.json();
      if (r.ok) {
        const st = json.data?.statut;
        st === "ELIGIBLE" ? toast.success("Client ÉLIGIBLE — vous pouvez le valider") : toast.error("Client REFUSÉ — voir les motifs");
        refetch();
      } else toast.error(json.error ?? "Erreur");
    } finally { setBusy(null); }
  };

  const action = async (eligId: number, act: "VALIDER" | "RETIRER") => {
    setBusy(eligId);
    try {
      const r = await fetch(`/api/rvc/ria/eligibilite/${eligId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      const json = await r.json();
      if (r.ok) { toast.success(act === "VALIDER" ? "Client validé pour le RIA" : "Client retiré du vivier"); refetch(); }
      else toast.error(json.error ?? "Erreur");
    } finally { setBusy(null); }
  };

  const counts = {
    valide:   clients.filter((c) => c.eligibiliteRIA?.statut === "VALIDE").length,
    eligible: clients.filter((c) => c.eligibiliteRIA?.statut === "ELIGIBLE").length,
    refuse:   clients.filter((c) => c.eligibiliteRIA?.statut === "REFUSE").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Network className="w-6 h-6 text-emerald-600" /> Sélection des clients à financer (RIA)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Étape 3 — Identifiez les clients finançables par le RIA. Le système valide ou refuse automatiquement selon les critères (ancienneté, historique d&apos;achat, solvabilité, niveau de risque, rotation commerciale).
          </p>
        </div>
        <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Validés (affectables)</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{counts.valide}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Éligibles à confirmer</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{counts.eligible}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Refusés</p>
          <p className="text-xl font-bold text-red-600 mt-1">{counts.refuse}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, code, téléphone…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TABS.map((s) => (
            <button key={s} onClick={() => setStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statut === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s || "Tous"}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Client", "Ancienneté", "Risque", "Solvabilité", "Activité", "Décision", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !clients.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…</td></tr>
              )}
              {!loading && clients.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun client</td></tr>
              )}
              {clients.map((c) => {
                const e = c.eligibiliteRIA;
                const anc = Math.max(0, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000));
                const isBusy = busy === c.id || (e && busy === e.id);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.prenom} {c.nom}</p>
                      <p className="text-xs text-slate-400">{c.codeClient ?? c.telephone}{c.activite ? ` · ${c.activite}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ancienneteLabel(anc)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${RISQUE_COLOR[c.niveauRisque ?? ""] ?? "text-slate-400"}`}>{c.niveauRisque ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.solvabilite != null ? (
                        <span className={`font-semibold ${c.solvabilite >= 60 ? "text-emerald-600" : c.solvabilite >= 40 ? "text-amber-600" : "text-red-600"}`}>
                          {c.solvabilite}/100
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5" title="Ventes directes">
                          <ShoppingCart className="w-3.5 h-3.5 text-slate-400" /> {c.nbVentes} vente{c.nbVentes > 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1.5" title="Crédits accordés">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" /> {c.nbCredits} crédit{c.nbCredits > 1 ? "s" : ""}
                          {c.nbCreditsRetard > 0 && (
                            <span className="text-red-600 font-medium flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> {c.nbCreditsRetard} en retard
                            </span>
                          )}
                        </span>
                        {c.encoursCredit > 0 && (
                          <span className="text-[11px] text-slate-400 pl-5">Encours : {fmt(c.encoursCredit)} FCFA</span>
                        )}
                        <span className="flex items-center gap-1.5" title="Souscriptions packs">
                          <Package className="w-3.5 h-3.5 text-slate-400" /> {c.nbPacks} pack{c.nbPacks > 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {e ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_BADGE[e.statut]}`}>{e.statut}</span>
                            {e.scoreEligibilite != null && (
                              <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${CLASSE_COLOR[e.classeRisque] ?? ""}`}>
                                {e.classeRisque} · {Math.round(e.scoreEligibilite)}
                              </span>
                            )}
                          </div>
                          {e.statut === "REFUSE" && e.motifs.length > 0 && (
                            <ul className="text-[11px] text-red-600 space-y-0.5 max-w-xs">
                              {e.motifs.map((m, i) => (
                                <li key={i} className="flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{m}</li>
                              ))}
                            </ul>
                          )}
                          {e.statut === "VALIDE" && e.identifiePar && (
                            <p className="text-[11px] text-slate-400">par {e.identifiePar.prenom} {e.identifiePar.nom}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Info className="w-3 h-3" /> non évalué</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => evaluer(c)} disabled={isBusy ?? false}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50" title="Évaluer (auto)">
                          <Calculator className="w-3 h-3" /> Évaluer
                        </button>
                        {e?.statut === "ELIGIBLE" && (
                          <button onClick={() => action(e.id, "VALIDER")} disabled={isBusy ?? false}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50" title="Valider pour le RIA">
                            <ShieldCheck className="w-3 h-3" /> Valider
                          </button>
                        )}
                        {e?.statut === "VALIDE" && (
                          <>
                            <span className="text-emerald-600" title="Validé"><CheckCircle2 className="w-4 h-4" /></span>
                            <button onClick={() => action(e.id, "RETIRER")} disabled={isBusy ?? false}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50" title="Retirer du vivier">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {e?.statut === "REFUSE" && <span className="text-red-400" title="Refusé"><XCircle className="w-4 h-4" /></span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Règles : refus auto si client non actif, risque CRITIQUE, ancienneté &lt; 90 j, solvabilité &lt; 50, crédit en retard en cours, ou aucun historique (ni vente, ni crédit, ni pack). Le score combine solvabilité, ancienneté, historique d&apos;achat/packs, comportement crédit et niveau de risque. Seuls les clients <b>VALIDÉS</b> deviennent affectables aux investisseurs par l&apos;admin / responsable RIA.
      </p>
    </div>
  );
}

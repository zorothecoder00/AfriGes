"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { Plus, RefreshCw, CheckCircle, TrendingUp } from "lucide-react";

interface DistributionItem {
  id: number; mois: number; annee: number; statut: string;
  capitalBase: number; tauxGenere: number;
  montantGenere: number; montantDistribue: number; montantReinvesti: number; montantFondSecurite: number;
  datePaiement: string | null; notes: string | null;
  portefeuille: {
    id: number; reference: string; nom: string | null; capitalEngage: number;
    profilRIA: { gestionnaire: { member: { id: number; nom: string; prenom: string } } };
  };
}

interface PortefeuilleOpt {
  id: number; reference: string; nom: string | null; capitalEngage: number;
  profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } };
}

const fmt   = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum = (v: unknown) => Number(v ?? 0);
const MOIS_LABELS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const STATUT_STYLE: Record<string, string> = {
  PLANIFIE:            "bg-amber-50 text-amber-700 border-amber-200",
  EN_ATTENTE_PAIEMENT: "bg-blue-50 text-blue-700 border-blue-200",
  DISTRIBUE:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  REINVESTI:           "bg-violet-50 text-violet-700 border-violet-200",
};

function PlanifierModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: PortefeuilleOpt[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];
  const now = new Date();
  const [form, setForm] = useState({ portefeuilleId: "", mois: String(now.getMonth() + 1), annee: String(now.getFullYear()) });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const [loading, setLoading] = useState(false);
  const { data: cfgRes } = useApi<{ data: { tauxGenere: number; tauxDistribue: number; tauxReinvesti: number; tauxFondSecurite: number } | null }>("/api/admin/ria/config");
  const cfg = cfgRes?.data;
  const pfSelected = pfs.find((p) => p.id === parseInt(form.portefeuilleId));
  const capitalEngage = pfSelected ? toNum(pfSelected.capitalEngage) : 0;
  const preview = cfg && capitalEngage ? {
    genere:    capitalEngage * (toNum(cfg.tauxGenere) / 100),
    distribue: capitalEngage * (toNum(cfg.tauxDistribue) / 100),
    reinvesti: capitalEngage * (toNum(cfg.tauxReinvesti) / 100),
    fondSec:   capitalEngage * (toNum(cfg.tauxFondSecurite) / 100),
  } : null;

  const submit = async () => {
    if (!form.portefeuilleId || !form.mois || !form.annee) { toast.error("Tous les champs sont requis"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ria/distributions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, mois: Number(form.mois), annee: Number(form.annee) }),
      });
      const json = await res.json();
      if (res.ok) { toast.success("Distribution planifiée"); onSuccess(); onClose(); }
      else toast.error(json.error ?? "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Planifier une distribution</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Sélectionner…</option>
              {pfs.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.profilRIA.gestionnaire.member.prenom} {pf.profilRIA.gestionnaire.member.nom} — {pf.nom ?? pf.reference}
                  {" "}(engagé : {fmt(toNum(pf.capitalEngage))} F)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mois *</label>
              <select value={form.mois} onChange={(e) => set("mois", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                {MOIS_LABELS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Année *</label>
              <input type="number" value={form.annee} onChange={(e) => set("annee", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
          </div>
          {preview && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2">Aperçu de la distribution</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Capital engagé (base)</span>
                <span className="font-medium">{fmt(capitalEngage)} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Bénéfice généré ({toNum(cfg?.tauxGenere)}%)</span>
                <span className="font-semibold text-emerald-700">+{fmt(preview.genere)} FCFA</span>
              </div>
              <div className="border-t border-emerald-200 pt-1.5 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>→ Distribué ({toNum(cfg?.tauxDistribue)}%)</span><span>{fmt(preview.distribue)} F</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>→ Réinvesti ({toNum(cfg?.tauxReinvesti)}%)</span><span>{fmt(preview.reinvesti)} F</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>→ Fonds sécurité ({toNum(cfg?.tauxFondSecurite)}%)</span><span>{fmt(preview.fondSec)} F</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Planification…" : "Planifier"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DistributionsPage() {
  const now = new Date();
  const [mois,   setMois]   = useState(String(now.getMonth() + 1));
  const [annee,  setAnnee]  = useState(String(now.getFullYear()));
  const [statut, setStatut] = useState("");
  const [showPlan, setShowPlan] = useState(false);

  const qs = [`limit=100`, mois ? `mois=${mois}` : "", annee ? `annee=${annee}` : "", statut ? `statut=${statut}` : ""].filter(Boolean).join("&");
  const { data: res, loading, refetch } = useApi<{ data: DistributionItem[]; meta: { total: number } }>(
    `/api/admin/ria/distributions?${qs}`
  );
  const distributions = res?.data ?? [];
  const totalGenere    = distributions.reduce((s, d) => s + toNum(d.montantGenere), 0);
  const totalDistribue = distributions.reduce((s, d) => s + toNum(d.montantDistribue), 0);
  const totalPlanifie  = distributions.filter((d) => d.statut === "PLANIFIE").length;

  const traiter = async (id: number) => {
    const r = await fetch(`/api/admin/ria/distributions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TRAITER" }),
    });
    const json = await r.json();
    if (r.ok) { toast.success("Distribution traitée — capital mis à jour"); refetch(); }
    else toast.error(json.error ?? "Erreur");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Distributions de Bénéfices</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {res?.meta.total ?? 0} distribution(s) ·
            Total généré : <span className="font-semibold text-emerald-700">{fmt(totalGenere)} FCFA</span> ·
            Total distribué : <span className="font-semibold text-blue-700">{fmt(totalDistribue)} FCFA</span>
            {totalPlanifie > 0 && <span className="ml-2 text-amber-600 font-semibold">({totalPlanifie} à traiter)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowPlan(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Planifier une distribution
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <select value={mois} onChange={(e) => setMois(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
            <option value="">Tous les mois</option>
            {MOIS_LABELS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} placeholder="Année"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {["", "PLANIFIE", "DISTRIBUE"].map((s) => (
            <button key={s} onClick={() => setStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statut === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {s || "Tous"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Investisseur", "Portefeuille", "Période", "Capital base", "Généré", "Distribué", "Réinvesti", "Fonds séc.", "Statut", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !distributions.length && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
              </td></tr>
            )}
            {!loading && distributions.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                <TrendingUp className="w-6 h-6 inline mb-1" /><br />Aucune distribution sur cette période
              </td></tr>
            )}
            {distributions.map((d) => {
              const inv = d.portefeuille.profilRIA.gestionnaire.member;
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{d.portefeuille.nom ?? d.portefeuille.reference}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{MOIS_LABELS[d.mois]} {d.annee}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt(toNum(d.capitalBase))} F</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">+{fmt(toNum(d.montantGenere))} F</td>
                  <td className="px-4 py-3 text-blue-700">{fmt(toNum(d.montantDistribue))} F</td>
                  <td className="px-4 py-3 text-violet-700">{fmt(toNum(d.montantReinvesti))} F</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(toNum(d.montantFondSecurite))} F</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_STYLE[d.statut] ?? ""}`}>
                      {d.statut.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.statut === "PLANIFIE" && (
                      <button onClick={() => traiter(d.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
                        <CheckCircle className="w-3 h-3" /> Traiter
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPlan && <PlanifierModal onClose={() => setShowPlan(false)} onSuccess={refetch} />}
    </div>
  );
}

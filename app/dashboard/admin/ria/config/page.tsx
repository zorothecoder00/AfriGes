"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { Settings, RefreshCw, CheckCircle, History } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Config {
  id: number; tauxGenere: number; tauxDistribue: number; tauxReinvesti: number; tauxFondSecurite: number;
  actif: boolean; createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toNum = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIAConfigPage() {
  const { data: res, loading, refetch } = useApi<{ data: Config | null; history: Config[] }>("/api/admin/ria/config");
  const current = res?.data;
  const history = res?.history ?? [];

  const [form, setForm] = useState({ tauxGenere: "10", tauxDistribue: "4", tauxReinvesti: "4", tauxFondSecurite: "2" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (current) {
      setForm({
        tauxGenere:       String(toNum(current.tauxGenere)),
        tauxDistribue:    String(toNum(current.tauxDistribue)),
        tauxReinvesti:    String(toNum(current.tauxReinvesti)),
        tauxFondSecurite: String(toNum(current.tauxFondSecurite)),
      });
    }
  }, [current]);

  const totalRepartition = toNum(form.tauxDistribue) + toNum(form.tauxReinvesti) + toNum(form.tauxFondSecurite);
  const isValid = Math.abs(totalRepartition - toNum(form.tauxGenere)) < 0.01;

  const submit = async () => {
    if (!isValid) {
      toast.error(`La somme des répartitions (${totalRepartition}%) doit égaler le taux généré (${form.tauxGenere}%)`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ria/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tauxGenere:       Number(form.tauxGenere),
          tauxDistribue:    Number(form.tauxDistribue),
          tauxReinvesti:    Number(form.tauxReinvesti),
          tauxFondSecurite: Number(form.tauxFondSecurite),
        }),
      });
      const json = await res.json();
      if (res.ok) { toast.success("Configuration mise à jour"); refetch(); }
      else toast.error(json.error ?? "Erreur");
    } finally { setSubmitting(false); }
  };

  if (loading && !current) {
    return (
      <div className="flex items-center justify-center min-h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  const preview = {
    base:    100_000_000,
    genere:  100_000_000 * toNum(form.tauxGenere) / 100,
    distrib: 100_000_000 * toNum(form.tauxDistribue) / 100,
    reinv:   100_000_000 * toNum(form.tauxReinvesti) / 100,
    fond:    100_000_000 * toNum(form.tauxFondSecurite) / 100,
  };
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuration RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Taux de génération et répartition des bénéfices</p>
        </div>
        <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Formulaire de configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl"><Settings className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <h2 className="font-semibold text-slate-900">Taux actifs</h2>
            <p className="text-sm text-slate-500">La modification crée une nouvelle configuration (l&apos;ancienne est conservée)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Taux généré */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Taux de génération mensuel (% du capital engagé)
            </label>
            <div className="flex items-center gap-3">
              <input type="number" min={0} max={100} step={0.5} value={form.tauxGenere} onChange={(e) => set("tauxGenere", e.target.value)}
                className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              <span className="text-slate-500 text-sm">% mensuel sur le capital engagé chez les clients</span>
            </div>
          </div>

          {/* Répartition */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Part distribuée à l&apos;investisseur (%)
            </label>
            <input type="number" min={0} step={0.5} value={form.tauxDistribue} onChange={(e) => set("tauxDistribue", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            <p className="text-xs text-slate-400 mt-1">Versé au capitalDisponible de l&apos;investisseur</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Part réinvestie automatiquement (%)
            </label>
            <input type="number" min={0} step={0.5} value={form.tauxReinvesti} onChange={(e) => set("tauxReinvesti", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            <p className="text-xs text-slate-400 mt-1">Ajouté au capitalInvesti + capitalDisponible</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Fonds de sécurité (%)
            </label>
            <input type="number" min={0} step={0.5} value={form.tauxFondSecurite} onChange={(e) => set("tauxFondSecurite", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            <p className="text-xs text-slate-400 mt-1">Bloqué dans le fonds de réserve</p>
          </div>

          {/* Validation */}
          <div className={`flex items-center gap-2 text-sm font-medium ${isValid ? "text-emerald-700" : "text-red-600"}`}>
            {isValid ? <CheckCircle className="w-4 h-4" /> : <span className="font-bold text-lg">!</span>}
            Répartition : {totalRepartition}% / {form.tauxGenere}%
            {!isValid && <span className="text-xs font-normal">(les parts doivent totaliser {form.tauxGenere}%)</span>}
          </div>
        </div>

        {/* Preview simulation */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Simulation — Capital engagé : 100 000 000 FCFA
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { lbl: "Généré", val: preview.genere, color: "text-emerald-700" },
              { lbl: "Distribué", val: preview.distrib, color: "text-blue-700" },
              { lbl: "Réinvesti", val: preview.reinv, color: "text-violet-700" },
              { lbl: "Fonds séc.", val: preview.fond, color: "text-slate-600" },
            ].map(({ lbl, val, color }) => (
              <div key={lbl}>
                <p className="text-xs text-slate-400">{lbl}</p>
                <p className={`text-sm font-bold ${color}`}>{fmt(val)} F</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={submit} disabled={submitting || !isValid}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? "Enregistrement…" : "Appliquer la configuration"}
          </button>
        </div>
      </div>

      {/* Historique des configurations */}
      {history.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-slate-500" /> Historique des configurations
          </h3>
          <div className="space-y-2">
            {history.map((cfg) => (
              <div key={cfg.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${cfg.actif ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  {cfg.actif && <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>}
                  <span className="text-slate-600">{fmtDate(cfg.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-500 space-x-3">
                  <span>Généré : <strong>{toNum(cfg.tauxGenere)}%</strong></span>
                  <span>Dist. : {toNum(cfg.tauxDistribue)}%</span>
                  <span>Réinv. : {toNum(cfg.tauxReinvesti)}%</span>
                  <span>Fond : {toNum(cfg.tauxFondSecurite)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

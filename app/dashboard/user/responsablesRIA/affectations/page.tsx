"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  RefreshCw, Search, UserCheck, ToggleLeft, ToggleRight,
  Plus, AlertTriangle, PieChart,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AffectationItem {
  id: number; pourcentage: number; montantAlloue: number; classeRisque: string;
  actif: boolean; dateDebut: string; dateFin: string | null;
  encoursActuel: number;
  disponible: number;
  portefeuille: {
    id: number; reference: string; nom: string | null;
    profilRIA: { gestionnaire: { member: { id: number; nom: string; prenom: string } } };
  };
  client: { id: number; nom: string; prenom: string; telephone: string | null; niveauRisque: string | null };
  _count: { financements: number };
}

interface PortefeuilleOpt { id: number; reference: string; nom: string | null; profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } }
interface ClientOpt      { id: number; nom: string; prenom: string; telephone: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const RISQUE_STYLE: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700", B: "bg-blue-50 text-blue-700",
  C: "bg-amber-50 text-amber-700",     D: "bg-orange-50 text-orange-700",
  E: "bg-red-50 text-red-700",
};

// ── Modal création ────────────────────────────────────────────────────────────

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: PortefeuilleOpt[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];

  const [clientSearch, setClientSearch] = useState("");
  const { data: clientRes } = useApi<{ data: ClientOpt[] }>(
    `/api/admin/clients?limit=20&search=${encodeURIComponent(clientSearch)}`
  );
  const clients = clientRes?.data ?? [];

  const [form, setForm] = useState({
    portefeuilleId: "", clientId: "", pourcentage: "", montantAlloue: "", classeRisque: "A",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const [loading, setLoading] = useState(false);

  // % déjà alloués pour le portefeuille sélectionné
  const { data: aff0Res } = useApi<{ data: { pourcentage: number; clientId: number }[] }>(
    form.portefeuilleId
      ? `/api/admin/ria/affectations?portefeuilleId=${form.portefeuilleId}&actif=true&limit=100`
      : null
  );
  const sommeDejAllouee = (aff0Res?.data ?? [])
    .filter((a) => String(a.clientId) !== form.clientId)
    .reduce((s, a) => s + toNum(a.pourcentage), 0);
  const totalAvecNouveau = sommeDejAllouee + (Number(form.pourcentage) || 0);
  const depassement = totalAvecNouveau > 100;

  const submit = async () => {
    if (!form.portefeuilleId || !form.clientId || !form.pourcentage) {
      toast.error("Portefeuille, client et pourcentage sont requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ria/affectations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pourcentage:   Number(form.pourcentage),
          montantAlloue: form.montantAlloue ? Number(form.montantAlloue) : 0,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Affectation créée");
        if (json.warning) toast.warning(json.warning, { duration: 6000 });
        onSuccess(); onClose();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Nouvelle affectation client</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-4">

          {/* Portefeuille + jauge */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille *</label>
            <select value={form.portefeuilleId} onChange={(e) => set("portefeuilleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Sélectionner…</option>
              {pfs.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.profilRIA.gestionnaire.member.prenom} {pf.profilRIA.gestionnaire.member.nom} — {pf.nom ?? pf.reference}
                </option>
              ))}
            </select>

            {form.portefeuilleId && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-slate-500">
                    <PieChart className="w-3 h-3" /> Déjà alloué : <span className="font-semibold text-slate-700">{sommeDejAllouee.toFixed(1)} %</span>
                  </span>
                  <span className={`font-semibold ${depassement ? "text-red-600" : "text-slate-500"}`}>
                    Total : {totalAvecNouveau.toFixed(1)} %
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, sommeDejAllouee)}%` }} />
                  {Number(form.pourcentage) > 0 && (
                    <div className={`h-full transition-all ${depassement ? "bg-red-400" : "bg-blue-400"}`}
                      style={{ width: `${Math.min(100 - Math.min(100, sommeDejAllouee), Number(form.pourcentage))}%` }} />
                  )}
                </div>
                {depassement && (
                  <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Dépassement de {(totalAvecNouveau - 100).toFixed(1)} % — autorisé, le solde reste en capitalDisponible.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rechercher un client *</label>
            <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Nom, prénom…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-1" />
            {clients.length > 0 && (
              <select value={form.clientId} onChange={(e) => set("clientId", e.target.value)} size={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">— choisir —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}{c.telephone ? ` · ${c.telephone}` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {/* Pourcentage + montant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pourcentage (%) *</label>
              <input type="number" min={0} max={200} value={form.pourcentage} onChange={(e) => set("pourcentage", e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent ${depassement ? "border-red-300 focus:ring-red-400" : "border-slate-200 focus:ring-emerald-500"}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Montant alloué (FCFA)</label>
              <input type="number" min={0} value={form.montantAlloue} onChange={(e) => set("montantAlloue", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
          </div>

          {/* Classe risque */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Classe de risque</label>
            <select value={form.classeRisque} onChange={(e) => set("classeRisque", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              {["A", "B", "C", "D", "E"].map((r) => <option key={r} value={r}>Classe {r}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIAAffectationsPage() {
  const [actif, setActif]       = useState("true");
  const [search, setSearch]     = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: res, loading, refetch } = useApi<{ data: AffectationItem[]; meta: { total: number } }>(
    `/api/admin/ria/affectations?limit=50&actif=${actif}`
  );

  const affectations = (res?.data ?? []).filter((a) => {
    if (!search.trim()) return true;
    const q   = search.toLowerCase();
    const inv = a.portefeuille.profilRIA.gestionnaire.member;
    return (
      `${inv.prenom} ${inv.nom}`.toLowerCase().includes(q) ||
      `${a.client.prenom} ${a.client.nom}`.toLowerCase().includes(q) ||
      (a.client.telephone ?? "").includes(q)
    );
  });

  const toggleActif = async (id: number, current: boolean) => {
    const r = await fetch(`/api/admin/ria/affectations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !current }),
    });
    if (r.ok) {
      toast.success(current ? "Affectation désactivée" : "Affectation réactivée");
      refetch();
    } else {
      const j = await r.json();
      toast.error(j.error ?? "Erreur");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Affectations Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {res?.meta.total ?? 0} affectation(s) — répartition investisseur → clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvelle affectation
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {[["true", "Actives"], ["false", "Inactives"], ["", "Toutes"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setActif(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${actif === val ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Investisseur ou client…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm w-56 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Investisseur", "Portefeuille", "Client", "Risque client", "% Alloué", "Ligne de crédit", "Classe", "Depuis", "Statut"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !affectations.length && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
              </td></tr>
            )}
            {!loading && affectations.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                <UserCheck className="w-6 h-6 inline mb-1 opacity-40" /><br />Aucune affectation
              </td></tr>
            )}
            {affectations.map((a) => {
              const inv = a.portefeuille.profilRIA.gestionnaire.member;
              return (
                <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${!a.actif ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{inv.prenom} {inv.nom}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{a.portefeuille.nom ?? a.portefeuille.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{a.client.prenom} {a.client.nom}</p>
                    {a.client.telephone && <p className="text-xs text-slate-400">{a.client.telephone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {a.client.niveauRisque
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{a.client.niveauRisque}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, toNum(a.pourcentage))}%` }} />
                      </div>
                      <span className="font-semibold text-emerald-700">{toNum(a.pourcentage).toFixed(1)} %</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 min-w-[180px]">
                    {toNum(a.montantAlloue) > 0 ? (() => {
                      const pct    = Math.min(100, (a.encoursActuel / toNum(a.montantAlloue)) * 100);
                      const surPct = pct >= 100;
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Limite&nbsp;: <span className="font-semibold text-slate-700">{fmt(toNum(a.montantAlloue))} F</span></span>
                            <span className={surPct ? "text-red-600 font-semibold" : "text-slate-400"}>{pct.toFixed(0)}% utilisé</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${surPct ? "bg-red-500" : pct > 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-blue-600">Encours&nbsp;: <span className="font-semibold">{fmt(a.encoursActuel)} F</span></span>
                            <span className={`font-semibold ${a.disponible <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                              Dispo&nbsp;: {fmt(a.disponible)} F
                            </span>
                          </div>
                        </div>
                      );
                    })() : (
                      <span className="text-xs text-slate-400 italic">Plafond non défini</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISQUE_STYLE[a.classeRisque] ?? "bg-slate-100 text-slate-600"}`}>
                      {a.classeRisque}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {fmtDate(a.dateDebut)}
                    {a.dateFin && <><br /><span className="text-red-400">→ {fmtDate(a.dateFin)}</span></>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActif(a.id, a.actif)} className="text-slate-400 hover:text-emerald-600 transition-colors">
                      {a.actif
                        ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSuccess={refetch} />}
    </div>
  );
}

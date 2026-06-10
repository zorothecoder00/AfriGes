"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Search, AlertTriangle, XCircle, CheckCircle,
  ChevronDown, ChevronUp, TrendingDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancementItem {
  id: number; reference: string; statut: string;
  montantFinance: number; montantRembourse: number; encours: number;
  dateFinancement: string; dateEcheance: string | null; notes: string | null;
  portefeuille: {
    id: number; reference: string; nom: string | null;
    capitalDisponible: number;
    profilRIA: { gestionnaire: { member: { id: number; nom: string; prenom: string } } };
  };
  client: { id: number; nom: string; prenom: string; telephone: string | null };
  creditClient: { id: number; reference: string; statut: string } | null;
  affectation: { id: number; classeRisque: string; pourcentage: number } | null;
  _count: { remboursements: number };
}

interface PortefeuilleOption { id: number; reference: string; nom: string | null; capitalDisponible: number; profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } }
interface ClientOption { id: number; nom: string; prenom: string; telephone: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const STATUT_STYLE: Record<string, string> = {
  ACTIF:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  REMBOURSE: "bg-blue-50 text-blue-700 border-blue-200",
  EN_RETARD: "bg-amber-50 text-amber-700 border-amber-200",
  DEFAUT:    "bg-red-50 text-red-700 border-red-200",
  ANNULE:    "bg-slate-100 text-slate-500 border-slate-200",
};

// ── Modal création financement ─────────────────────────────────────────────────

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: pfRes } = useApi<{ data: PortefeuilleOption[] }>("/api/admin/ria/portefeuilles?actif=true&limit=100");
  const pfs = pfRes?.data ?? [];

  const [clientSearch, setClientSearch] = useState("");
  const { data: clientRes } = useApi<{ data: ClientOption[] }>(`/api/admin/clients?limit=20&search=${encodeURIComponent(clientSearch)}`);
  const clients = clientRes?.data ?? [];

  const [form, setForm] = useState({ portefeuilleId: "", clientId: "", montantFinance: "", creditClientId: "", dateEcheance: "", notes: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const [loading, setLoading] = useState(false);

  const pfSelected = pfs.find((p) => p.id === parseInt(form.portefeuilleId));

  const submit = async () => {
    if (!form.portefeuilleId || !form.clientId || !form.montantFinance) {
      toast.error("Portefeuille, client et montant sont requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ria/financements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, montantFinance: Number(form.montantFinance) }),
      });
      const json = await res.json();
      if (res.ok) { toast.success("Financement créé — capital débité"); onSuccess(); onClose(); }
      else toast.error(json.error ?? "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between">
          <h3 className="font-semibold text-slate-900">Nouveau financement client</h3>
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
                </option>
              ))}
            </select>
            {pfSelected && (
              <p className="text-xs text-emerald-700 mt-1">Disponible : {fmt(toNum(pfSelected.capitalDisponible))} FCFA</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rechercher un client *</label>
            <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Nom, prénom, téléphone…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-1" />
            {clients.length > 0 && (
              <select value={form.clientId} onChange={(e) => set("clientId", e.target.value)} size={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">— choisir —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom} {c.telephone ? `· ${c.telephone}` : ""}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant à financer (FCFA) *</label>
            <input type="number" min={0} value={form.montantFinance} onChange={(e) => set("montantFinance", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Crédit client associé (ID)</label>
              <input type="number" value={form.creditClientId} onChange={(e) => set("creditClientId", e.target.value)}
                placeholder="Optionnel"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;échéance</label>
              <input type="date" value={form.dateEcheance} onChange={(e) => set("dateEcheance", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Création…" : "Créer le financement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ligne financement expandable ──────────────────────────────────────────────

function FinancementRow({ fin, onRefetch }: { fin: FinancementItem; onRefetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [remb, setRemb] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pct = fin.montantFinance > 0 ? (fin.montantRembourse / fin.montantFinance) * 100 : 0;
  const inv = fin.portefeuille.profilRIA.gestionnaire.member;

  const changeStatut = async (action: string) => {
    const r = await fetch(`/api/admin/ria/financements/${fin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await r.json();
    if (r.ok) { toast.success("Statut mis à jour"); onRefetch(); }
    else toast.error(json.error ?? "Erreur");
  };

  const addRemboursement = async () => {
    if (!remb || Number(remb) <= 0) { toast.error("Montant invalide"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/ria/financements/${fin.id}/remboursements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: Number(remb) }),
      });
      const json = await r.json();
      if (r.ok) {
        toast.success(json.estSolde ? "Financement soldé !" : `Remboursement enregistré — encours : ${fmt(json.nouveauEncours)} FCFA`);
        setRemb(""); onRefetch();
      } else toast.error(json.error ?? "Erreur");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <td className="px-4 py-3 font-mono text-xs text-slate-600">{fin.reference}</td>
        <td className="px-4 py-3 font-medium text-slate-900">{inv.prenom} {inv.nom}</td>
        <td className="px-4 py-3 text-slate-600 text-xs">{fin.portefeuille.nom ?? fin.portefeuille.reference}</td>
        <td className="px-4 py-3 font-medium text-slate-800">{fin.client.prenom} {fin.client.nom}</td>
        <td className="px-4 py-3 font-semibold text-blue-700">{fmt(toNum(fin.montantFinance))} F</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs text-slate-600 font-semibold">{fmt(toNum(fin.encours))} F</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_STYLE[fin.statut] ?? ""}`}>
            {fin.statut.replace("_", " ")}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(fin.dateFinancement)}</td>
        <td className="px-4 py-3 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Actions statut */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Actions</p>
                <div className="flex flex-wrap gap-2">
                  {fin.statut === "ACTIF" && (
                    <>
                      <button onClick={() => changeStatut("MARQUER_EN_RETARD")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100">
                        <AlertTriangle className="w-3 h-3" /> En retard
                      </button>
                      <button onClick={() => changeStatut("ANNULER")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                        <XCircle className="w-3 h-3" /> Annuler
                      </button>
                    </>
                  )}
                  {fin.statut === "EN_RETARD" && (
                    <>
                      <button onClick={() => changeStatut("MARQUER_DEFAUT")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                        <XCircle className="w-3 h-3" /> Défaut
                      </button>
                    </>
                  )}
                  {fin.statut !== "REMBOURSE" && fin.statut !== "ANNULE" && (
                    <div className="flex items-center gap-2 mt-2 w-full">
                      <input type="number" min={0} value={remb} onChange={(e) => setRemb(e.target.value)}
                        placeholder="Montant remboursement"
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                      <button onClick={addRemboursement} disabled={submitting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                        <CheckCircle className="w-3 h-3" /> {submitting ? "…" : "Enregistrer remboursement"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Infos */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Détails</p>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium">Montant financé :</span> {fmt(toNum(fin.montantFinance))} FCFA</p>
                  <p><span className="font-medium">Remboursé :</span> {fmt(toNum(fin.montantRembourse))} FCFA ({Math.round(pct)}%)</p>
                  <p><span className="font-medium">Encours :</span> <span className="font-bold text-blue-700">{fmt(toNum(fin.encours))} FCFA</span></p>
                  {fin.dateEcheance && <p><span className="font-medium">Échéance :</span> {fmtDate(fin.dateEcheance)}</p>}
                  {fin.creditClient && <p><span className="font-medium">Crédit lié :</span> {fin.creditClient.reference}</p>}
                  <p><span className="font-medium">Remboursements :</span> {fin._count.remboursements}</p>
                  {fin.notes && <p className="italic text-slate-500">{fin.notes}</p>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancementsPage() {
  const [statut, setStatut] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: res, loading, refetch } = useApi<{ data: FinancementItem[]; meta: { total: number } }>(
    `/api/admin/ria/financements?limit=50${statut ? `&statut=${statut}` : ""}`
  );

  const financements = (res?.data ?? []).filter((f) => {
    if (!search) return true;
    const inv = f.portefeuille.profilRIA.gestionnaire.member;
    return (
      `${inv.prenom} ${inv.nom}`.toLowerCase().includes(search.toLowerCase()) ||
      `${f.client.prenom} ${f.client.nom}`.toLowerCase().includes(search.toLowerCase()) ||
      f.reference.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalEncours = financements.filter((f) => ["ACTIF", "EN_RETARD"].includes(f.statut)).reduce((s, f) => s + toNum(f.encours), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financements RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {res?.meta.total ?? 0} financement(s) · Encours actif : <span className="font-semibold text-blue-700">{fmt(totalEncours)} FCFA</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouveau financement
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {["", "ACTIF", "EN_RETARD", "DEFAUT", "REMBOURSE", "ANNULE"].map((s) => (
            <button key={s} onClick={() => setStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statut === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {s || "Tous"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Investisseur, client, référence…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm w-56 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Référence", "Investisseur", "Portefeuille", "Client", "Montant", "Encours", "Statut", "Date", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !financements.length && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
              </td></tr>
            )}
            {!loading && financements.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                <TrendingDown className="w-6 h-6 inline mb-1" /><br />Aucun financement
              </td></tr>
            )}
            {financements.map((fin) => (
              <FinancementRow key={fin.id} fin={fin} onRefetch={refetch} />
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSuccess={refetch} />}
    </div>
  );
}

"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { toast } from "sonner";
import { FileText, Plus, X, RefreshCw, CheckCircle2, Loader2, Search } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";

/**
 * Facture fournisseur (CDC digitalisation §5.3) — trace le numéro/date de la
 * facture reçue et son rapprochement avec la réception correspondante.
 * Page admin native (même API que le comptable — pas de scope PDV ici).
 */

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm";

interface FournisseurOption { id: number; nom: string; code: string }
interface ReceptionOption { id: number; reference: string; statut: string; createdAt: string }
interface FactureAchatRow {
  id: number; numero: string; dateFacture: string; montantTTC: number;
  statutRapprochement: string; dateRapprochement: string | null;
  fournisseur: { nom: string };
  receptionAppro: { reference: string } | null;
}

const STATUT_BADGE: Record<string, string> = {
  NON_RAPPROCHEE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  RAPPROCHEE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};
const STATUT_LABEL: Record<string, string> = { NON_RAPPROCHEE: "Non rapprochée", RAPPROCHEE: "Rapprochée" };

export default function AdminFacturesAchatPage() {
  const [statutFiltre, setStatutFiltre] = useState("");
  const apiUrl = `/api/comptable/factures-achat${statutFiltre ? `?statut=${statutFiltre}` : ""}`;
  const { data, loading, refetch } = useApi<{ data: FactureAchatRow[] }>(apiUrl);
  const factures = data?.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [fournisseurQuery, setFournisseurQuery] = useState("");
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([]);
  const [fournisseurChoisi, setFournisseurChoisi] = useState<FournisseurOption | null>(null);
  const [receptions, setReceptions] = useState<ReceptionOption[]>([]);
  const [form, setForm] = useState({ numero: "", dateFacture: "", montantTTC: "", receptionApproId: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [rapprochantId, setRapprochantId] = useState<number | null>(null);

  async function rechercherFournisseur(q: string) {
    setFournisseurQuery(q);
    setFournisseurChoisi(null);
    if (q.trim().length < 2) { setFournisseurOptions([]); return; }
    const r = await fetch(`/api/comptable/factures-achat/fournisseurs-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setFournisseurOptions(j.data);
  }

  async function choisirFournisseur(f: FournisseurOption) {
    setFournisseurChoisi(f);
    setFournisseurOptions([]);
    const r = await fetch(`/api/comptable/factures-achat/receptions?fournisseurId=${f.id}`);
    const j = await r.json();
    if (r.ok) setReceptions(j.data);
  }

  function resetForm() {
    setFournisseurQuery(""); setFournisseurOptions([]); setFournisseurChoisi(null); setReceptions([]);
    setForm({ numero: "", dateFacture: "", montantTTC: "", receptionApproId: "", notes: "" });
  }

  async function submitCreate() {
    if (!fournisseurChoisi) { toast.error("Sélectionnez un fournisseur"); return; }
    if (!form.numero.trim() || !form.dateFacture || !form.montantTTC) { toast.error("Numéro, date et montant obligatoires"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/comptable/factures-achat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: form.numero, dateFacture: form.dateFacture, montantTTC: Number(form.montantTTC),
          fournisseurId: fournisseurChoisi.id, receptionApproId: form.receptionApproId || undefined, notes: form.notes || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Facture ${j.data.numero} enregistrée`);
      refetch();
      setShowCreate(false);
      resetForm();
    } catch { toast.error("Erreur réseau"); }
    finally { setCreating(false); }
  }

  async function rapprocher(id: number) {
    setRapprochantId(id);
    try {
      const r = await fetch(`/api/comptable/factures-achat/${id}/rapprocher`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Facture rapprochée");
      refetch();
    } catch { toast.error("Erreur réseau"); }
    finally { setRapprochantId(null); }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <FileText size={22} className="text-primary-600" /> Factures fournisseurs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Suivi et rapprochement</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Toutes</option>
            <option value="NON_RAPPROCHEE">Non rapprochées</option>
            <option value="RAPPROCHEE">Rapprochées</option>
          </select>
          <button onClick={() => refetch()} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> Nouvelle facture
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Chargement…</p>}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-900/40">
              <th className="px-4 py-2 font-medium">N° facture</th>
              <th className="px-4 py-2 font-medium">Fournisseur</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium text-right">Montant TTC</th>
              <th className="px-4 py-2 font-medium">Réception liée</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {factures.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2 font-mono">{f.numero}</td>
                <td className="px-4 py-2">{f.fournisseur.nom}</td>
                <td className="px-4 py-2">{formatDateShort(f.dateFacture)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(f.montantTTC)}</td>
                <td className="px-4 py-2 text-slate-500">{f.receptionAppro?.reference ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[f.statutRapprochement]}`}>{STATUT_LABEL[f.statutRapprochement]}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {f.statutRapprochement === "NON_RAPPROCHEE" && (
                    <button onClick={() => rapprocher(f.id)} disabled={rapprochantId === f.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 ml-auto">
                      {rapprochantId === f.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Rapprocher
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && factures.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Aucune facture fournisseur enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Nouvelle facture fournisseur</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseur *</label>
                {fournisseurChoisi ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm">
                    <span>{fournisseurChoisi.nom} ({fournisseurChoisi.code})</span>
                    <button onClick={() => { setFournisseurChoisi(null); setReceptions([]); }}><X size={14} className="text-slate-400" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={fournisseurQuery} onChange={(e) => rechercherFournisseur(e.target.value)} placeholder="Nom ou code fournisseur…" className={`${inputCls} pl-8`} />
                    {fournisseurOptions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {fournisseurOptions.map((f) => (
                          <button key={f.id} onClick={() => choisirFournisseur(f)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                            {f.nom} ({f.code})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">N° de facture *</label>
                <input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Date de facture *</label>
                  <input type="date" value={form.dateFacture} onChange={(e) => setForm((f) => ({ ...f, dateFacture: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Montant TTC *</label>
                  <input type="number" min={0} value={form.montantTTC} onChange={(e) => setForm((f) => ({ ...f, montantTTC: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {fournisseurChoisi && receptions.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Réception liée (optionnel)</label>
                  <select value={form.receptionApproId} onChange={(e) => setForm((f) => ({ ...f, receptionApproId: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {receptions.map((r) => <option key={r.id} value={r.id}>{r.reference} ({formatDateShort(r.createdAt)})</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Annuler</button>
              <button onClick={submitCreate} disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

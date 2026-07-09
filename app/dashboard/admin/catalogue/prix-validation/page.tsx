"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Loader2, Check, X, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Demande {
  id: number; champ: "VENTE" | "ACHAT"; ancienPrix: number | null; nouveauPrix: number; motif: string;
  agence: string | null; createdAt: string;
  produit: { id: number; nom: string; codeProduit: string | null };
  demandePar: { nom: string; prenom: string };
}

export default function PrixValidationPage() {
  const [rows, setRows] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [valider, setValider] = useState<Demande | null>(null);
  const [rejeter, setRejeter] = useState<Demande | null>(null);
  const [password, setPassword] = useState("");
  const [motifRejet, setMotifRejet] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/catalogue/demandes-prix?statut=EN_ATTENTE");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const approuver = async () => {
    if (!valider) return;
    if (!password) { toast.error("Mot de passe requis"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/demandes-prix/${valider.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROUVER", password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Prix validé et appliqué ✓");
      setValider(null); setPassword(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  const rejeterDemande = async () => {
    if (!rejeter) return;
    if (!motifRejet.trim()) { toast.error("Motif requis"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/demandes-prix/${rejeter.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJETER", motifRejet: motifRejet.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Demande rejetée");
      setRejeter(null); setMotifRejet(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-emerald-600" /> Validation des changements de prix</h2>
          <p className="text-sm text-gray-400">{rows.length} demande(s) en attente. La validation applique le nouveau prix et exige votre mot de passe.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400">Aucune demande en attente.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{d.produit.nom} <span className="text-xs text-gray-400 font-mono">{d.produit.codeProduit ?? ""}</span></p>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">{d.champ === "VENTE" ? "Prix vente" : "Prix achat"}</span>
                      <span className="text-gray-400">{d.ancienPrix != null ? formatCurrency(d.ancienPrix) : "—"}</span>
                      <ArrowRight className="w-4 h-4 text-gray-300" />
                      <span className="font-bold text-emerald-700">{formatCurrency(d.nouveauPrix)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">Motif : {d.motif}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Par {d.demandePar.prenom} {d.demandePar.nom}{d.agence ? ` · ${d.agence}` : ""} · {new Date(d.createdAt).toLocaleString("fr-FR")}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => { setValider(d); setPassword(""); }} title="Valider" className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check className="w-4 h-4" /></button>
                    <button onClick={() => { setRejeter(d); setMotifRejet(""); }} title="Rejeter" className="p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal validation (mot de passe) */}
      {valider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setValider(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-gray-800 mb-1 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Valider le changement</h4>
            <p className="text-xs text-gray-500 mb-4">{valider.produit.nom} · {valider.champ === "VENTE" ? "prix vente" : "prix achat"} → <b>{formatCurrency(valider.nouveauPrix)}</b></p>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Votre mot de passe</span>
              <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && approuver()}
                className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setValider(null)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={approuver} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejet */}
      {rejeter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setRejeter(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><X className="w-5 h-5 text-rose-500" /> Rejeter la demande</h4>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Motif du rejet</span>
              <textarea value={motifRejet} autoFocus onChange={(e) => setMotifRejet(e.target.value)} rows={3}
                className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </label>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRejeter(null)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={rejeterDemande} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Rejeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

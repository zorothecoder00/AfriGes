"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, ShieldAlert, X, Loader2, RefreshCw, CheckCircle2, Wallet, Phone,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

interface RetraitAValider {
  id: number;
  reference: string;
  montant: string | number;
  soldeAvant: string | number;
  soldeApres: string | number;
  modePaiement: string | null;
  observation: string | null;
  createdAt: string;
  agence: string | null;
  user: { id: number; nom: string; prenom: string } | null;
  compte: {
    id: number;
    numeroCompte: string;
    solde: string | number;
    client: { nom: string; prenom: string; telephone: string; codeClient: string | null };
  };
}

const N = (v: string | number) => Number(v ?? 0);
const dt = (d: string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default function RetraitsAValiderPage() {
  const { data: res, loading, refetch } = useApi<{ data: RetraitAValider[] }>("/api/comptes-courants/retraits-en-attente");
  const retraits = res?.data ?? [];

  // Validation (ré-authentification)
  const [val, setVal] = useState<RetraitAValider | null>(null);
  const [password, setPassword] = useState("");
  const [valSaving, setValSaving] = useState(false);
  // Rejet
  const [rej, setRej] = useState<RetraitAValider | null>(null);
  const [motif, setMotif] = useState("");
  const [rejSaving, setRejSaving] = useState(false);

  const submitValider = async () => {
    if (!val) return;
    if (!password) { toast.error("Mot de passe requis"); return; }
    setValSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${val.compte.id}/retraits/${val.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VALIDER", password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Retrait validé ✓");
      setVal(null); setPassword("");
      refetch();
      const mid = j.data?.mouvement?.id;
      if (mid) window.open(`/api/comptes-courants/${val.compte.id}/mouvements/${mid}/recu?print=1`, "_blank");
      if (j.data && j.data.ecritureGeneree === false) {
        toast.warning("Retrait validé, mais écriture comptable non générée (plan comptable à configurer).");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setValSaving(false); }
  };

  const submitRejeter = async () => {
    if (!rej) return;
    if (motif.trim().length < 3) { toast.error("Motif obligatoire"); return; }
    setRejSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${rej.compte.id}/retraits/${rej.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJETER", motif: motif.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Retrait rejeté");
      setRej(null); setMotif("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setRejSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/comptes-courants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Comptes courants
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mt-2">
              <Clock className="w-6 h-6 text-amber-600" /> Retraits à valider
              {retraits.length > 0 && (
                <span className="text-sm bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold">{retraits.length}</span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Demandes de retrait initiées par les caissiers, en attente de votre validation.</p>
          </div>
          <button onClick={refetch}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>

        {loading && !res ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…</div>
        ) : !retraits.length ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm text-center py-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun retrait en attente</p>
            <p className="text-gray-400 text-sm mt-1">Toutes les demandes ont été traitées.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {retraits.map((rt) => (
              <div key={rt.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-orange-700">− {formatCurrency(Math.abs(N(rt.montant)))}</span>
                    <span className="text-xs text-gray-400">→ solde après {formatCurrency(N(rt.soldeApres))}</span>
                  </div>
                  <p className="font-medium text-gray-800 mt-1">{rt.compte.client.prenom} {rt.compte.client.nom}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> {rt.compte.numeroCompte}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {rt.compte.client.telephone}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {dt(rt.createdAt)}
                    {rt.user ? ` · initié par ${rt.user.prenom} ${rt.user.nom}` : ""}
                    {rt.modePaiement ? ` · ${rt.modePaiement}` : ""}
                    {rt.agence ? ` · agence ${rt.agence}` : ""}
                  </p>
                  {rt.observation && <p className="text-[11px] text-gray-400 mt-0.5 italic">{rt.observation}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setPassword(""); setVal(rt); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium">
                    <ShieldAlert className="w-4 h-4" /> Valider
                  </button>
                  <button onClick={() => { setMotif(""); setRej(rt); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium">
                    <X className="w-4 h-4" /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal validation */}
      {val && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-emerald-600" /> Valider le retrait</h3>
              <button onClick={() => setVal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="text-gray-800">{val.compte.client.prenom} {val.compte.client.nom}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Montant</span><span className="font-semibold text-orange-700">− {formatCurrency(Math.abs(N(val.montant)))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Solde après</span><span className="font-medium text-gray-800">{formatCurrency(N(val.soldeApres))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Initié par</span><span className="text-gray-700">{val.user ? `${val.user.prenom} ${val.user.nom}` : "—"}</span></div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Confirmez avec votre mot de passe</span>
                <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitValider(); }}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <p className="text-[11px] text-gray-400">Le débit du compte et l&apos;écriture comptable sont produits à la validation.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setVal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitValider} disabled={valSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {valSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Valider et décaisser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejet */}
      {rej && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><X className="w-4 h-4 text-red-600" /> Rejeter le retrait</h3>
              <button onClick={() => setRej(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Retrait de <span className="font-semibold text-orange-700">{formatCurrency(Math.abs(N(rej.montant)))}</span> — {rej.reference}</p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Motif du rejet <span className="text-red-500">*</span></span>
                <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} autoFocus
                  placeholder="Ex : montant erroné, pièce manquante, solde à vérifier…"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-400" />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRej(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitRejeter} disabled={rejSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {rejSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

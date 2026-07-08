"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, TrendingDown, CreditCard, X, Loader2, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import PayerCreditsModal from "@/components/PayerCreditsModal";

const MODES = ["Espèces", "Mobile Money", "Carte", "Virement"];
const N = (v: string | number) => Number(v ?? 0);

export interface ActionCompte {
  id: number;
  numeroCompte: string;
  statut: string;
  solde: string | number;
  clientNom: string;
}

/**
 * Actions caisse inline pour un compte courant (dépôt, retrait, paiement crédit),
 * avec modals autonomes. Conçu pour être posé directement sur une ligne de liste
 * afin d'éviter le passage par la fiche détail (flux caissier direct).
 * Les appels API et contrôles de sécurité (CDC §9) sont identiques à la fiche.
 */
export default function CompteCourantActions({
  compte,
  onDone,
}: {
  compte: ActionCompte;
  onDone?: () => void;
}) {
  const recuUrl = (mid: number) => `/api/comptes-courants/${compte.id}/mouvements/${mid}/recu`;

  // ── Dépôt ──
  const [depotOpen, setDepotOpen] = useState(false);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Retrait ──
  const [retraitOpen, setRetraitOpen] = useState(false);
  const [retMontant, setRetMontant] = useState("");
  const [retMode, setRetMode] = useState(MODES[0]);
  const [retMotif, setRetMotif] = useState("");
  const [retSaving, setRetSaving] = useState(false);
  const [retVerifPiece, setRetVerifPiece] = useState(false);
  const [retVerifPhoto, setRetVerifPhoto] = useState(false);
  const [retVerifSignature, setRetVerifSignature] = useState(false);
  const retVerifOk = retVerifPiece && retVerifPhoto && retVerifSignature;

  // ── Paiement crédit (délégué au modal partagé multi-crédits) ──
  const [payOpen, setPayOpen] = useState(false);

  const inactif = compte.statut !== "ACTIF";

  const openDepot = () => {
    setMontant(""); setMode(MODES[0]); setReference(""); setObservation("");
    setDepotOpen(true);
  };
  const openRetrait = () => {
    setRetMontant(""); setRetMode(MODES[0]); setRetMotif("");
    setRetVerifPiece(false); setRetVerifPhoto(false); setRetVerifSignature(false);
    setRetraitOpen(true);
  };
  const submitDepot = async () => {
    const m = Number(montant);
    if (!m || m <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compte.id}/depots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: m, modePaiement: mode, reference: reference || undefined, observation: observation || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Dépôt enregistré ✓");
      setDepotOpen(false);
      onDone?.();
      const mid = j.data?.mouvement?.id;
      if (mid) window.open(`${recuUrl(mid)}?print=1`, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  };

  const submitRetrait = async () => {
    const m = Number(retMontant);
    if (!m || m <= 0) { toast.error("Montant invalide"); return; }
    if (!retVerifOk) { toast.error("Validez les 3 contrôles de sécurité"); return; }
    setRetSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compte.id}/retraits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: m, modePaiement: retMode, motif: retMotif || undefined,
          verifPieceIdentite: retVerifPiece, verifPhoto: retVerifPhoto, verifSignature: retVerifSignature,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Demande de retrait envoyée pour validation ✓");
      setRetraitOpen(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setRetSaving(false); }
  };

  if (inactif) {
    return <span className="text-[11px] text-gray-400 italic">Compte {compte.statut.toLowerCase()} · opérations bloquées</span>;
  }

  const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={openDepot} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
          <Plus className="w-3.5 h-3.5" /> Dépôt
        </button>
        <button onClick={openRetrait} className={`${btn} bg-orange-600 hover:bg-orange-700 text-white`}>
          <TrendingDown className="w-3.5 h-3.5" /> Retrait
        </button>
        <button onClick={() => setPayOpen(true)}
          className={`${btn} bg-white border border-blue-200 text-blue-700 hover:bg-blue-50`}>
          <CreditCard className="w-3.5 h-3.5" /> Payer crédit
        </button>
      </div>

      {/* Modal dépôt */}
      {depotOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-600" /> Faire un dépôt</h3>
              <button onClick={() => setDepotOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Compte {compte.numeroCompte} · {compte.clientNom}</p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                <input type="number" min={0} autoFocus value={montant} onChange={(e) => setMontant(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Mode de paiement</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Référence (optionnel)</span>
                <input value={reference} onChange={(e) => setReference(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Observation (optionnel)</span>
                <input value={observation} onChange={(e) => setObservation(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setDepotOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitDepot} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Valider le dépôt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal retrait */}
      {retraitOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-orange-600" /> Demander un retrait</h3>
              <button onClick={() => setRetraitOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                {compte.numeroCompte} · {compte.clientNom} — solde : <span className="font-semibold text-emerald-700">{formatCurrency(N(compte.solde))}</span>
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                <input type="number" min={0} autoFocus value={retMontant} onChange={(e) => setRetMontant(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Mode de décaissement</span>
                <select value={retMode} onChange={(e) => setRetMode(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Motif (optionnel)</span>
                <input value={retMotif} onChange={(e) => setRetMotif(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </label>
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Contrôles de sécurité (obligatoires)
                </p>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={retVerifPiece} onChange={(e) => setRetVerifPiece(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span>Pièce d&apos;identité du client vérifiée</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={retVerifPhoto} onChange={(e) => setRetVerifPhoto(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span>Correspondance de la photo confirmée</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={retVerifSignature} onChange={(e) => setRetVerifSignature(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span>Signature du client recueillie</span>
                </label>
              </div>
              <p className="text-[11px] text-amber-600">Le retrait sera exécuté après validation d&apos;un responsable (Chef d&apos;agence).</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRetraitOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitRetrait} disabled={retSaving || !retVerifOk}
                className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold">
                {retSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />} Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paiement crédit(s) via compte courant — modal partagé multi-crédits */}
      {payOpen && (
        <PayerCreditsModal
          compte={{ id: compte.id, numeroCompte: compte.numeroCompte, solde: compte.solde, clientNom: compte.clientNom }}
          onClose={() => setPayOpen(false)}
          onDone={onDone}
        />
      )}
    </>
  );
}

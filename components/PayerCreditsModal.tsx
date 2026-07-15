"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, CreditCard, Hash, Phone, Calendar, Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

interface CreditPayable {
  creditId: number;
  reference: string;
  soldeRestant: number;
  montantTotal: number;
  montantRembourse: number;
  montantAttendu: number;
  tauxPaye: number;
  dateDebut: string;
  dureeJours: number;
  codeClient: string | null;
  telephone: string;
}

const N = (v: string | number) => Number(v ?? 0);

/**
 * Modal de paiement de crédit(s) depuis un compte courant.
 * Permet de régler PLUSIEURS crédits du client en une opération, en tirant sur le
 * solde du compte. Chaque crédit affiche ses identifiants client, le total, le
 * reste à payer et la date de début des échéances.
 */
export default function PayerCreditsModal({
  compte,
  onClose,
  onDone,
}: {
  compte: { id: number; numeroCompte: string; solde: string | number; clientNom: string };
  onClose: () => void;
  onDone?: () => void;
}) {
  const solde = N(compte.solde);
  const [credits, setCredits] = useState<CreditPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Record<number, { on: boolean; montant: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/comptes-courants/${compte.id}/credits-payables`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        setCredits(j.data ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      } finally { setLoading(false); }
    })();
  }, [compte.id]);

  const totalSelected = useMemo(
    () => Object.entries(sel).reduce((s, [, v]) => s + (v.on ? N(v.montant) : 0), 0),
    [sel],
  );
  const depasse = totalSelected > solde + 0.001;
  const nbSelected = Object.values(sel).filter((v) => v.on && N(v.montant) > 0).length;

  const toggle = (c: CreditPayable) => {
    setSel((prev) => {
      const cur = prev[c.creditId];
      if (cur?.on) return { ...prev, [c.creditId]: { on: false, montant: "" } };
      // Défaut : le reste à payer, plafonné au budget encore disponible sur le compte.
      const dejaAlloue = Object.entries(prev).reduce((s, [k, v]) => s + (v.on && Number(k) !== c.creditId ? N(v.montant) : 0), 0);
      const budget = Math.max(0, solde - dejaAlloue);
      const defaut = Math.min(c.soldeRestant, budget);
      return { ...prev, [c.creditId]: { on: true, montant: String(Math.round(defaut)) } };
    });
  };
  const setMontant = (creditId: number, montant: string) =>
    setSel((prev) => ({ ...prev, [creditId]: { on: true, montant } }));

  const submit = async () => {
    const paiements = credits
      .filter((c) => sel[c.creditId]?.on && N(sel[c.creditId].montant) > 0)
      .map((c) => ({ creditId: c.creditId, montant: N(sel[c.creditId].montant) }));
    if (!paiements.length) { toast.error("Sélectionnez au moins un crédit"); return; }
    if (depasse) { toast.error("Le total dépasse le solde du compte"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compte.id}/paiements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paiements }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      const data = j.data;
      toast.success(`${Number(data.totalApplique).toLocaleString("fr-FR")} FCFA · ${data.count} crédit(s) payé(s) ✓`);
      if (data.ecritureGeneree === false) {
        toast.warning("Paiement enregistré, mais écriture comptable non générée (plan comptable à configurer).");
      }
      onDone?.();
      onClose();
      // Reçu auto pour un paiement unique.
      const paid = (data.results ?? []).filter((x: { mouvement: unknown }) => x.mouvement);
      if (paid.length === 1) {
        window.open(`/api/comptes-courants/${compte.id}/mouvements/${paid[0].mouvement.id}/recu?print=1`, "_blank");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen flex items-start sm:items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl h-[95dvh] sm:h-auto max-h-[95dvh] sm:max-h-[90vh] flex flex-col">
          <div className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-slate-100">
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base sm:text-lg min-w-0"><CreditCard className="w-4 h-4 text-blue-600" /> 
              <span className="truncate">
                Payer des crédits
              </span>
            </h3>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
          </div>

          {/* Bandeau client / solde */}
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold text-slate-800">{compte.clientNom}</span>
              <span className="text-xs text-slate-400 ml-2 font-mono">{compte.numeroCompte}</span>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Solde disponible</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(solde)}</p>
            </div>
          </div>

          {/* Liste des crédits */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des crédits…</div>
            ) : !credits.length ? (
              <div className="text-center py-16 text-gray-400">
                <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Aucun crédit à payer pour ce client.</p>
              </div>
            ) : credits.map((c) => {
              const s = sel[c.creditId];
              const on = !!s?.on;
              const trop = on && N(s.montant) > c.soldeRestant + 0.001;
              return (
                <div key={c.creditId} className={`rounded-xl border p-3 transition-colors ${on ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <input type="checkbox" checked={on} onChange={() => toggle(c)} className="mt-1 w-4 h-4 accent-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="font-mono text-sm font-semibold text-slate-800">{c.reference}</span>
                        <span className="text-[11px] text-slate-500">payé {c.tauxPaye}%</span>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                        {c.codeClient && <span className="inline-flex items-center gap-1"><Hash className="w-3 h-3" />{c.codeClient}</span>}
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.telephone}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />échéances dès le {formatDate(c.dateDebut)}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="text-slate-500">Total <span className="font-semibold text-slate-700">{formatCurrency(c.montantTotal)}</span></span>
                        <span className="text-slate-500">Reste <span className="font-semibold text-red-600">{formatCurrency(c.soldeRestant)}</span></span>
                      </div>

                      {on && (
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="relative w-full sm:flex-1 sm:max-w-[220px]">
                            <input type="number" min={0} value={s.montant} onChange={(e) => setMontant(c.creditId, e.target.value)}
                              className={`w-full px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${trop ? "border-red-300 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500"}`} />
                          </div>
                          <button type="button" onClick={() => setMontant(c.creditId, String(Math.round(Math.min(c.soldeRestant, solde))))}
                            className="text-[11px] text-blue-600 hover:underline">Max ({formatCurrency(Math.min(c.soldeRestant, solde))})</button>
                          {trop && <span className="text-[11px] text-red-600">&gt; reste dû</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pied : total + action */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 sm:px-6 py-4 space-y-3 z-20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Total à prélever · {nbSelected} crédit(s)</span>
              <span className={`text-lg font-bold ${depasse ? "text-red-600" : "text-slate-800"}`}>{formatCurrency(totalSelected)}</span>
            </div>
            {depasse && <p className="text-[11px] text-red-600 text-right">Le total dépasse le solde disponible ({formatCurrency(solde)}).</p>}
            <div className="
              flex
              flex-col-reverse
              sm:flex-row
              gap-2
              sm:justify-end">
              <button onClick={onClose} className=" w-full sm:w-auto px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submit} disabled={saving || depasse || nbSelected === 0}
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Payer {nbSelected > 0 ? formatCurrency(totalSelected) : ""}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

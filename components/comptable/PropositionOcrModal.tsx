"use client";

// Modale de relecture d'une proposition d'imputation OCR (CDC IA/Automatisation §51).
// L'extraction heuristique (lib/ocrFacture.ts) ne fait que PROPOSER des valeurs —
// le comptable les relit, les corrige si besoin, puis choisit explicitement
// "Créer l'écriture (brouillon)" ou "Rejeter". Aucun bouton "valider directement"
// ici : l'écriture créée reste BROUILLON et rejoint le circuit normal de
// validation comptable (onglet Journal des opérations).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, X, Loader2, FileCheck, Ban } from "lucide-react";

export interface PropositionOCR {
  id: number;
  fournisseurDetecte: string | null;
  fournisseurIdMatche: number | null;
  dateDetectee: string | null;
  numeroDetecte: string | null;
  montantHT: number | null;
  montantTVA: number | null;
  montantTTC: number | null;
  compteDebitProbable: string | null;
  compteCreditProbable: string | null;
  compteTvaProbable: string | null;
  journalProbable: string | null;
  sectionAnalytiqueProbableId: number | null;
}

interface JournalOption { code: string; libelle: string; actif: boolean }
interface SectionOption { id: number; code: string; libelle: string; actif: boolean }

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";

export default function PropositionOcrModal({ proposition, onClose, onDone }:
  { proposition: PropositionOCR; onClose: () => void; onDone: () => void }) {
  const [fournisseurNom, setFournisseurNom] = useState(proposition.fournisseurDetecte ?? "");
  const [dateFacture, setDateFacture] = useState(proposition.dateDetectee ?? "");
  const [numero, setNumero] = useState(proposition.numeroDetecte ?? "");
  const [montantHT, setMontantHT] = useState(proposition.montantHT != null ? String(proposition.montantHT) : "");
  const [montantTVA, setMontantTVA] = useState(proposition.montantTVA != null ? String(proposition.montantTVA) : "");
  const [montantTTC, setMontantTTC] = useState(proposition.montantTTC != null ? String(proposition.montantTTC) : "");
  const [compteDebitNumero, setCompteDebitNumero] = useState(proposition.compteDebitProbable ?? "");
  const [compteCreditNumero, setCompteCreditNumero] = useState(proposition.compteCreditProbable ?? "");
  const [compteTvaNumero, setCompteTvaNumero] = useState(proposition.compteTvaProbable ?? "");
  const [journal, setJournal] = useState(proposition.journalProbable ?? "ACHATS");
  const [sectionAnalytiqueId, setSectionAnalytiqueId] = useState(
    proposition.sectionAnalytiqueProbableId != null ? String(proposition.sectionAnalytiqueProbableId) : ""
  );
  const [journaux, setJournaux] = useState<JournalOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [busy, setBusy] = useState<"valider" | "rejeter" | null>(null);

  useEffect(() => {
    fetch("/api/comptable/journaux").then((r) => r.json()).then((j) => setJournaux(j.data ?? [])).catch(() => {});
    fetch("/api/comptable/analytique/sections").then((r) => r.json()).then((j) => setSections(j.data ?? [])).catch(() => {});
  }, []);

  const confirmer = async () => {
    if (!fournisseurNom.trim() || !numero.trim() || !montantTTC || Number(montantTTC) <= 0 || !compteDebitNumero.trim() || !compteCreditNumero.trim()) {
      toast.error("Fournisseur, numéro, montant TTC, compte débit et compte crédit sont requis");
      return;
    }
    setBusy("valider");
    try {
      const r = await fetch(`/api/comptable/ocr/${proposition.id}/valider`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseurNom: fournisseurNom.trim(),
          fournisseurId: proposition.fournisseurIdMatche ?? undefined,
          dateFacture: dateFacture || undefined,
          numero: numero.trim(),
          montantHT: montantHT || undefined,
          montantTVA: montantTVA || undefined,
          montantTTC: Number(montantTTC),
          compteDebitNumero: compteDebitNumero.trim(),
          compteCreditNumero: compteCreditNumero.trim(),
          compteTvaNumero: compteTvaNumero.trim() || undefined,
          journal: journal.trim() || undefined,
          sectionAnalytiqueId: sectionAnalytiqueId || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Écriture créée en brouillon ✓ — à valider dans le Journal des opérations");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(null); }
  };

  const rejeter = async () => {
    setBusy("rejeter");
    try {
      const r = await fetch(`/api/comptable/ocr/${proposition.id}/rejeter`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast("Proposition rejetée — saisissez l'écriture manuellement");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center"><Sparkles size={18} className="text-violet-600" /></div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 text-sm">Proposition d&apos;imputation (reconnaissance auto)</h3>
            <p className="text-xs text-slate-400">Relisez et corrigez avant de créer l&apos;écriture — jamais validée automatiquement</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Fournisseur *</label>
            <input value={fournisseurNom} onChange={(e) => setFournisseurNom(e.target.value)} className={inputCls} />
            {proposition.fournisseurIdMatche == null && (
              <p className="text-[11px] text-amber-600 mt-1">Aucun fournisseur existant identifié — vérifiez l&apos;orthographe.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">N° facture *</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
              <input type="date" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant HT</label>
              <input type="number" value={montantHT} onChange={(e) => setMontantHT(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">TVA</label>
              <input type="number" value={montantTVA} onChange={(e) => setMontantTVA(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">TTC *</label>
              <input type="number" value={montantTTC} onChange={(e) => setMontantTTC(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte débit (probable) *</label>
              <input value={compteDebitNumero} onChange={(e) => setCompteDebitNumero(e.target.value)} placeholder="311" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte crédit (fournisseur) *</label>
              <input value={compteCreditNumero} onChange={(e) => setCompteCreditNumero(e.target.value)} placeholder="401" className={inputCls} />
            </div>
          </div>
          {montantTVA && montantHT && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte TVA déductible (si décomposition HT/TVA)</label>
              <input value={compteTvaNumero} onChange={(e) => setCompteTvaNumero(e.target.value)} placeholder="4452 (optionnel)" className={inputCls} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Journal</label>
              <select value={journal} onChange={(e) => setJournal(e.target.value)} className={inputCls}>
                {journaux.length === 0 && <option value={journal}>{journal}</option>}
                {journaux.map((j) => (
                  <option key={j.code} value={j.code}>{j.libelle} ({j.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Section analytique (probable)</label>
              <select value={sectionAnalytiqueId} onChange={(e) => setSectionAnalytiqueId(e.target.value)} className={inputCls}>
                <option value="">— Aucune —</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.libelle} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={rejeter} disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            {busy === "rejeter" ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Rejeter — saisie manuelle
          </button>
          <button onClick={confirmer} disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {busy === "valider" ? <Loader2 size={15} className="animate-spin" /> : <FileCheck size={15} />} Créer l&apos;écriture (brouillon)
          </button>
        </div>
      </div>
    </div>
  );
}

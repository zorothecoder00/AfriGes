"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, X, Loader2, Stamp, CheckCircle2, Printer, RefreshCw} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PiecesListe } from "@/components/agent-documents/PiecesBordereau";
import NouveauBordereauRemise from "@/components/agent-documents/NouveauBordereauRemise";
import SignaturePad from "@/components/SignaturePad";
import VisaBordereauModal from "@/components/agent-documents/VisaBordereauModal";

/** Bordereau de remise de fonds (CDC digitalisation §3.1) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface Bordereau {
  id: number; reference: string; statut: string;
  cotisationsEspeces: string; cotisationsMobileMoney: string; remboursements: string; ventes: string; venteCarnet: string;
  fraisLivraison: string; montantVirement: string; totalEspecesAttendu: string; totalBilletageCalcule: string;
  ecartSoumission: string; ecartTresorier: string | null; visaCGTParId: number | null;
  depotBancaireReference: string | null;
  pointDeVente: PDV; collecteur: { nom: string; prenom: string }; createdAt: string;
  pieces?: { id: number; nom: string; url: string; nature: string }[];
}
interface BordereauxResponse { data: Bordereau[]; stats: Record<string, number> }

const STATUT_LABEL: Record<string, string> = { SOUMIS: "Soumis", ECART_SIGNALE: "Écart signalé", VALIDE: "Validé", CLOTURE: "Clôturé" };
const STATUT_BADGE: Record<string, string> = {
  SOUMIS: "bg-amber-100 text-amber-700", ECART_SIGNALE: "bg-red-100 text-red-600",
  VALIDE: "bg-blue-100 text-blue-700", CLOTURE: "bg-emerald-100 text-emerald-700",
};

export default function AdminBordereauxRemisePage() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [traiterBordereau, setTraiterBordereau] = useState<Bordereau | null>(null);
  const [cloturerBordereau, setCloturerBordereau] = useState<Bordereau | null>(null);
  const [viserBordereau, setViserBordereau] = useState<Bordereau | null>(null);
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<BordereauxResponse>(`/api/tresorerie/bordereaux-remise?${params}`);
  const bordereaux = data?.data ?? [];

  return (
    <div className="md:p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Bordereaux de remise de fonds</h1>
          <p className="text-sm text-slate-500 mt-1">Remise des fonds terrain à la trésorerie</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" icon={<RefreshCw size={16} />} title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouveau bordereau</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l} {data?.stats?.[k] ? `(${data.stats[k]})` : ""}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {loading && bordereaux.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && bordereaux.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucun bordereau sur ce filtre.</p>}
        {bordereaux.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-800 text-sm">{b.reference}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[b.statut]}`}>{STATUT_LABEL[b.statut] ?? b.statut}</span>
                  {b.visaCGTParId && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Visa CGT</span>}
                </div>
                <p className="text-sm text-slate-600 mt-1">{b.collecteur.prenom} {b.collecteur.nom} — {b.pointDeVente.nom} ({b.pointDeVente.code})</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attendu {formatCurrency(Number(b.totalEspecesAttendu))} · billetage {formatCurrency(Number(b.totalBilletageCalcule))}
                  {Number(b.ecartSoumission) !== 0 && ` · écart ${formatCurrency(Number(b.ecartSoumission))}`}
                  · {formatDateTime(b.createdAt)}
                </p>
                <div className="mt-2"><PiecesListe pieces={b.pieces} /></div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["SOUMIS", "ECART_SIGNALE"].includes(b.statut) && (
                  <button onClick={() => setTraiterBordereau(b)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"><CheckCircle2 size={13} /> Traiter (billetage)</button>
                )}
                {b.statut === "VALIDE" && !b.visaCGTParId && (
                  <button onClick={() => setViserBordereau(b)} className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200"><Stamp size={13} /> Viser CGT</button>
                )}
                {b.statut === "CLOTURE" && !b.depotBancaireReference && (
                  <button onClick={() => setCloturerBordereau(b)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><CheckCircle2 size={13} /> Dépôt bancaire</button>
                )}
                <a href={`/api/tresorerie/bordereaux-remise/${b.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && (
        <NouveauBordereauRemise pdvsDisponibles={pdvData?.data ?? []} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
      {viserBordereau && (
        <VisaBordereauModal id={viserBordereau.id} reference={viserBordereau.reference}
          onClose={() => setViserBordereau(null)} onDone={() => { setViserBordereau(null); refetch(); }} />
      )}
      {traiterBordereau && <FormTraiter bordereau={traiterBordereau} onClose={() => setTraiterBordereau(null)} onDone={() => { setTraiterBordereau(null); refetch(); }} />}
      {cloturerBordereau && <FormCloturer bordereau={cloturerBordereau} onClose={() => setCloturerBordereau(null)} onDone={() => { setCloturerBordereau(null); refetch(); }} />}
    </div>
  );
}

function FormTraiter({ bordereau, onClose, onDone }: { bordereau: Bordereau; onClose: () => void; onDone: () => void }) {
  const [montantConfirmeTresorier, setMontant] = useState(bordereau.totalBilletageCalcule);
  const [motifEcartTresorier, setMotif] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!montantConfirmeTresorier || Number(montantConfirmeTresorier) < 0) { toast.error("Montant invalide"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tresorerie/bordereaux-remise/${bordereau.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TRAITER", montantConfirmeTresorier: Number(montantConfirmeTresorier), motifEcartTresorier: motifEcartTresorier || undefined, signatureTresorier: signature ?? undefined }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      const statut = j.data?.statut as string | undefined;
      toast.success(
        statut === "CLOTURE" ? "Billetage confirmé — écriture comptable générée automatiquement"
        : statut === "VALIDE" ? "Billetage confirmé — en attente du visa Direction"
        : "Écart signalé"
      );
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Traiter — {bordereau.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">Billetage déclaré par le collecteur : {formatCurrency(Number(bordereau.totalBilletageCalcule))}. Comptez contradictoirement et saisissez le montant confirmé.</p>
          <input type="number" min={0} value={montantConfirmeTresorier} onChange={(e) => setMontant(e.target.value)} className={inputCls} placeholder="Montant confirmé *" />
          <textarea value={motifEcartTresorier} onChange={(e) => setMotif(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Motif de l'écart (si montant différent)" />
          <SignaturePad label="Signature du trésorier (facultative — la confirmation vaut signature électronique)" onChange={setSignature} hauteur={120} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormCloturer({ bordereau, onClose, onDone }: { bordereau: Bordereau; onClose: () => void; onDone: () => void }) {
  const [depotBancaireReference, setRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!depotBancaireReference.trim()) { toast.error("Référence de dépôt bancaire obligatoire"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tresorerie/bordereaux-remise/${bordereau.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ENREGISTRER_DEPOT", depotBancaireReference }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Dépôt bancaire enregistré");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Dépôt bancaire — {bordereau.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">L&apos;écriture comptable a déjà été générée automatiquement à la validation. Rattachez ici la référence une fois le dépôt physiquement effectué (rapprochement bancaire, informatif).</p>
          <input value={depotBancaireReference} onChange={(e) => setRef(e.target.value)} className={inputCls} placeholder="Référence de dépôt bancaire *" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

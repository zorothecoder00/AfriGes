"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, X, Loader2, Stamp, CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PiecesUploader, PiecesListe, type PieceBordereauUploadee } from "@/components/agent-documents/PiecesBordereau";

/** Bordereau de remise de fonds (CDC digitalisation §3.1) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";
const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 250, 100, 50, 25, 10];

interface PDV { id: number; nom: string; code: string }
interface Bordereau {
  id: number; reference: string; statut: string;
  cotisationsEspeces: string; cotisationsMobileMoney: string; remboursements: string; ventes: string; venteCarnet: string;
  fraisLivraison: string; montantVirement: string; totalEspecesAttendu: string; totalBilletageCalcule: string;
  ecartSoumission: string; ecartTresorier: string | null; visaCGTParId: number | null;
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

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<BordereauxResponse>(`/api/tresorerie/bordereaux-remise?${params}`);
  const bordereaux = data?.data ?? [];

  async function viserCGT(id: number) {
    try {
      const res = await fetch(`/api/tresorerie/bordereaux-remise/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "VISER_CGT" }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Visa Président CGT apposé");
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bordereaux de remise de fonds</h1>
          <p className="text-sm text-slate-500 mt-1">Remise des fonds terrain à la trésorerie</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
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
                  <button onClick={() => setTraiterBordereau(b)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"><CheckCircle2 size={13} /> Traiter</button>
                )}
                {b.statut === "VALIDE" && !b.visaCGTParId && (
                  <button onClick={() => viserCGT(b.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200"><Stamp size={13} /> Viser CGT</button>
                )}
                {b.statut === "VALIDE" && (
                  <button onClick={() => setCloturerBordereau(b)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><CheckCircle2 size={13} /> Clôturer</button>
                )}
                <a href={`/api/tresorerie/bordereaux-remise/${b.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && <FormBordereau onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
      {traiterBordereau && <FormTraiter bordereau={traiterBordereau} onClose={() => setTraiterBordereau(null)} onDone={() => { setTraiterBordereau(null); refetch(); }} />}
      {cloturerBordereau && <FormCloturer bordereau={cloturerBordereau} onClose={() => setCloturerBordereau(null)} onDone={() => { setCloturerBordereau(null); refetch(); }} />}
    </div>
  );
}

function FormTraiter({ bordereau, onClose, onDone }: { bordereau: Bordereau; onClose: () => void; onDone: () => void }) {
  const [montantConfirmeTresorier, setMontant] = useState(bordereau.totalBilletageCalcule);
  const [motifEcartTresorier, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!montantConfirmeTresorier || Number(montantConfirmeTresorier) < 0) { toast.error("Montant invalide"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tresorerie/bordereaux-remise/${bordereau.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TRAITER", montantConfirmeTresorier: Number(montantConfirmeTresorier), motifEcartTresorier: motifEcartTresorier || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Bordereau traité");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Traiter — {bordereau.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">Billetage déclaré par le collecteur : {formatCurrency(Number(bordereau.totalBilletageCalcule))}. Comptez contradictoirement et saisissez le montant confirmé.</p>
          <input type="number" min={0} value={montantConfirmeTresorier} onChange={(e) => setMontant(e.target.value)} className={inputCls} placeholder="Montant confirmé *" />
          <textarea value={motifEcartTresorier} onChange={(e) => setMotif(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Motif de l'écart (si montant différent)" />
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
        body: JSON.stringify({ action: "CLOTURER", depotBancaireReference }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Bordereau clôturé — écriture comptable générée");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Clôturer — {bordereau.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={depotBancaireReference} onChange={(e) => setRef(e.target.value)} className={inputCls} placeholder="Référence de dépôt bancaire *" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : "Clôturer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormBordereau({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];

  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [cotisationsEspeces, setCotisationsEspeces] = useState("0");
  const [cotisationsMobileMoney, setCotisationsMobileMoney] = useState("0");
  const [mobileMoneyReference, setMobileMoneyReference] = useState("");
  const [remboursements, setRemboursements] = useState("0");
  const [ventes, setVentes] = useState("0");
  const [venteCarnet, setVenteCarnet] = useState("0");
  const [fraisLivraison, setFraisLivraison] = useState("0");
  const [montantVirement, setMontantVirement] = useState("0");
  const [virementReference, setVirementReference] = useState("");
  const [billetage, setBilletage] = useState<Record<number, string>>({});
  const [motifEcartSoumission, setMotifEcartSoumission] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pieces, setPieces] = useState<PieceBordereauUploadee[]>([]);

  const totalEspecesAttendu = [cotisationsEspeces, remboursements, ventes, venteCarnet, fraisLivraison].reduce((s, v) => s + (Number(v) || 0), 0);
  const totalBilletageCalcule = DENOMINATIONS.reduce((s, d) => s + d * (Number(billetage[d]) || 0), 0);
  const ecart = totalBilletageCalcule - totalEspecesAttendu;

  async function submit() {
    if (!pointDeVenteId) { toast.error("Sélectionnez le point de vente"); return; }
    if (Number(cotisationsMobileMoney) > 0 && !mobileMoneyReference.trim()) { toast.error("Référence Mobile Money obligatoire"); return; }
    if (Number(montantVirement) > 0 && !virementReference.trim()) { toast.error("Référence de virement obligatoire"); return; }
    if (Number(montantVirement) > 0 && !pieces.some((p) => p.nature === "RELEVE_BANCAIRE")) { toast.error("Avis de virement obligatoire en pièce jointe"); return; }
    if (Math.abs(ecart) > 0.01 && !motifEcartSoumission.trim()) { toast.error(`Écart de ${ecart.toLocaleString("fr-FR")} FCFA : motif obligatoire`); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tresorerie/bordereaux-remise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointDeVenteId: Number(pointDeVenteId), pieces,
          cotisationsEspeces: Number(cotisationsEspeces), cotisationsMobileMoney: Number(cotisationsMobileMoney), mobileMoneyReference: mobileMoneyReference || undefined,
          remboursements: Number(remboursements), ventes: Number(ventes), venteCarnet: Number(venteCarnet), fraisLivraison: Number(fraisLivraison),
          montantVirement: Number(montantVirement), virementReference: virementReference || undefined,
          lignesBilletage: DENOMINATIONS.filter((d) => Number(billetage[d]) > 0).map((d) => ({ denomination: d, nombre: Number(billetage[d]) })),
          motifEcartSoumission: motifEcartSoumission || undefined, notes: notes || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Bordereau ${j.data.reference} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouveau bordereau de remise de fonds</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente / agence *</label>
            <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
              <option value="">Choisir…</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Récapitulatif des fonds remis</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Cotisations espèces</label><input type="number" min={0} value={cotisationsEspeces} onChange={(e) => setCotisationsEspeces(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Remboursements</label><input type="number" min={0} value={remboursements} onChange={(e) => setRemboursements(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Ventes</label><input type="number" min={0} value={ventes} onChange={(e) => setVentes(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Vente de carnet</label><input type="number" min={0} value={venteCarnet} onChange={(e) => setVenteCarnet(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Frais de livraison</label><input type="number" min={0} value={fraisLivraison} onChange={(e) => setFraisLivraison(e.target.value)} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Cotisations Mobile Money</label><input type="number" min={0} value={cotisationsMobileMoney} onChange={(e) => setCotisationsMobileMoney(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Réf. transaction Mobile Money</label><input value={mobileMoneyReference} onChange={(e) => setMobileMoneyReference(e.target.value)} className={inputCls} /></div>
          </div>
          {Number(cotisationsMobileMoney) > 0 && <PiecesUploader nature="RECU" label="Justificatif Mobile Money" pieces={pieces} onChange={setPieces} />}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Montant viré/déposé (hors billetage)</label><input type="number" min={0} value={montantVirement} onChange={(e) => setMontantVirement(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Référence virement/dépôt</label><input value={virementReference} onChange={(e) => setVirementReference(e.target.value)} className={inputCls} /></div>
          </div>
          {Number(montantVirement) > 0 && <PiecesUploader nature="RELEVE_BANCAIRE" label="Avis de virement" obligatoire pieces={pieces} onChange={setPieces} />}

          <p className="text-xs font-semibold text-slate-500 uppercase pt-2">Billetage (nombre de billets/pièces par dénomination)</p>
          <div className="grid grid-cols-5 gap-2">
            {DENOMINATIONS.map((d) => (
              <div key={d}>
                <label className="text-[11px] text-slate-500 mb-1 block">{d.toLocaleString("fr-FR")} F</label>
                <input type="number" min={0} value={billetage[d] ?? ""} onChange={(e) => setBilletage((prev) => ({ ...prev, [d]: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
              </div>
            ))}
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between">
            <span>Total espèces attendu : <strong>{formatCurrency(totalEspecesAttendu)}</strong></span>
            <span>Total billetage : <strong>{formatCurrency(totalBilletageCalcule)}</strong></span>
            {Math.abs(ecart) > 0.01 && <span className="text-amber-600 font-semibold">Écart : {formatCurrency(ecart)}</span>}
          </div>
          {Math.abs(ecart) > 0.01 && (
            <textarea value={motifEcartSoumission} onChange={(e) => setMotifEcartSoumission(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Motif de l'écart *" />
          )}
          <PiecesUploader nature="PIECE_CAISSE" label="Fiches journalières de collecte scannées" pieces={pieces} onChange={setPieces} />
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, X, Loader2, Search, Stamp, XCircle, Wallet, Printer } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDateTime } from "@/lib/format";

/** Fiche de décaissement (CDC digitalisation §3.6) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface FournisseurOption { id: number; nom: string; code: string }
interface Fiche {
  id: number; reference: string; statut: string; beneficiaireNom: string; motif: string; typeDepense: string;
  montantDemande: string; montantApprouve: string | null; motifRejet: string | null;
  demandeur: { nom: string; prenom: string }; fournisseur: { nom: string } | null;
  bonCommandeFournisseur: { id: number; reference: string } | null;
  createdAt: string;
}
interface FichesResponse { data: Fiche[]; stats: Record<string, number> }

const TYPE_LABEL: Record<string, string> = {
  ACHAT_MARCHANDISES: "Achat marchandises", FOURNITURES: "Fournitures", PAIEMENT_FOURNISSEUR: "Paiement fournisseur",
  AVANCE_CAISSE: "Avance de caisse", FRAIS_FONCTIONNEMENT: "Frais de fonctionnement", TRANSPORT: "Transport", AUTRES: "Autres",
};
const STATUT_LABEL: Record<string, string> = { SOUMISE: "Soumise", APPROUVEE: "Approuvée", PAYEE: "Payée", REJETEE: "Rejetée" };
const STATUT_BADGE: Record<string, string> = {
  SOUMISE: "bg-amber-100 text-amber-700", APPROUVEE: "bg-blue-100 text-blue-700", PAYEE: "bg-emerald-100 text-emerald-700", REJETEE: "bg-red-100 text-red-600",
};

export default function AdminDecaissementsPage() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [rejetFiche, setRejetFiche] = useState<Fiche | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [executerFiche, setExecuterFiche] = useState<Fiche | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<FichesResponse>(`/api/decaissements?${params}`);
  const fiches = data?.data ?? [];

  async function action(id: number, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/decaissements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function rejeter() {
    if (!rejetFiche) return;
    if (!motifRejet.trim()) { toast.error("Motif de rejet obligatoire"); return; }
    await action(rejetFiche.id, { action: "REJETER", motifRejet }, "Fiche rejetée");
    setRejetFiche(null); setMotifRejet("");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fiches de décaissement</h1>
          <p className="text-sm text-slate-500 mt-1">CDC digitalisation §3.6 — sortie de fonds, approbation N1/N2</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle fiche</Button>
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
        {loading && fiches.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && fiches.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune fiche sur ce filtre.</p>}
        {fiches.map((f) => {
          const montant = Number(f.montantApprouve ?? f.montantDemande);
          const enAttenteN1 = f.statut === "SOUMISE" && !f.montantApprouve;
          return (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{f.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[f.statut]}`}>{STATUT_LABEL[f.statut] ?? f.statut}</span>
                    {f.statut === "SOUMISE" && !enAttenteN1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">En attente N2 (Direction)</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{f.beneficiaireNom} — {TYPE_LABEL[f.typeDepense] ?? f.typeDepense}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {f.motif} · {formatCurrency(montant)} · demandé par {f.demandeur.prenom} {f.demandeur.nom} · {formatDateTime(f.createdAt)}
                    {f.bonCommandeFournisseur && ` · lié au ${f.bonCommandeFournisseur.reference}`}
                  </p>
                  {f.motifRejet && <p className="text-xs text-red-600 mt-1">Motif de rejet : {f.motifRejet}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {enAttenteN1 && (
                    <>
                      <button onClick={() => action(f.id, { action: "APPROUVER_N1" }, "Approuvée (N1)")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Approuver N1</button>
                      <button onClick={() => { setRejetFiche(f); setMotifRejet(""); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><XCircle size={13} /> Rejeter</button>
                    </>
                  )}
                  {f.statut === "SOUMISE" && !enAttenteN1 && (
                    <button onClick={() => action(f.id, { action: "APPROUVER_N2" }, "Approuvée (N2 — Direction)")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Approuver N2</button>
                  )}
                  {f.statut === "APPROUVEE" && (
                    <button onClick={() => setExecuterFiche(f)} className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-200"><Wallet size={13} /> Exécuter</button>
                  )}
                  <a href={`/api/decaissements/${f.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {showCreate && <FormFiche onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
      {rejetFiche && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Rejeter la fiche {rejetFiche.reference}</h4>
              <button onClick={() => setRejetFiche(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-5"><textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" /></div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setRejetFiche(null)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={rejeter} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">Rejeter</button>
            </div>
          </div>
        </div>
      )}
      {executerFiche && (
        <FormExecuter fiche={executerFiche} onClose={() => setExecuterFiche(null)} onDone={() => { setExecuterFiche(null); refetch(); }} />
      )}
    </div>
  );
}

function FormExecuter({ fiche, onClose, onDone }: { fiche: Fiche; onClose: () => void; onDone: () => void }) {
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [beneficiaireConfirmationNom, setBeneficiaireConfirmationNom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!referencePaiement.trim()) { toast.error("Référence de paiement obligatoire"); return; }
    if (!beneficiaireConfirmationNom.trim()) { toast.error("Confirmation de réception du bénéficiaire obligatoire"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/decaissements/${fiche.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXECUTER", modePaiement, referencePaiement, beneficiaireConfirmationNom }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Décaissement exécuté");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Exécuter le paiement — {fiche.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={inputCls}>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CHEQUE">Chèque</option>
            <option value="VIREMENT">Virement</option>
          </select>
          <input value={referencePaiement} onChange={(e) => setReferencePaiement(e.target.value)} className={inputCls} placeholder="Référence de paiement *" />
          <input value={beneficiaireConfirmationNom} onChange={(e) => setBeneficiaireConfirmationNom(e.target.value)} className={inputCls} placeholder="Nom du bénéficiaire confirmant réception *" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />} Exécuter
          </button>
        </div>
      </div>
    </div>
  );
}

function FormFiche({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [beneficiaireNom, setBeneficiaireNom] = useState("");
  const [beneficiaireContact, setBeneficiaireContact] = useState("");
  const [motif, setMotif] = useState("");
  const [typeDepense, setTypeDepense] = useState("AUTRES");
  const [montantDemande, setMontantDemande] = useState("");
  const [fournisseurQuery, setFournisseurQuery] = useState("");
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([]);
  const [fournisseur, setFournisseur] = useState<FournisseurOption | null>(null);
  const [piecesJustificatives, setPiecesJustificatives] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requiertPieces = typeDepense === "ACHAT_MARCHANDISES" || typeDepense === "PAIEMENT_FOURNISSEUR";

  async function rechercherFournisseur(q: string) {
    setFournisseurQuery(q);
    if (q.trim().length < 2) { setFournisseurOptions([]); return; }
    const r = await fetch(`/api/logistique/fournisseurs?search=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setFournisseurOptions(j.data);
  }

  async function submit() {
    if (!beneficiaireNom.trim()) { toast.error("Bénéficiaire obligatoire"); return; }
    if (motif.trim().length < 10) { toast.error("Motif obligatoire (10 caractères minimum)"); return; }
    if (!montantDemande || Number(montantDemande) <= 0) { toast.error("Montant invalide"); return; }
    const pieces = piecesJustificatives.split(",").map((s) => s.trim()).filter(Boolean);
    if (requiertPieces && pieces.length === 0) { toast.error("Au moins une pièce justificative est requise pour ce type de dépense"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/decaissements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaireNom, beneficiaireContact: beneficiaireContact || undefined, motif, typeDepense,
          montantDemande: Number(montantDemande), fournisseurId: fournisseur?.id, piecesJustificatives: pieces,
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Fiche ${j.data.reference} créée`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouvelle fiche de décaissement</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Bénéficiaire *</label>
            <input value={beneficiaireNom} onChange={(e) => setBeneficiaireNom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Contact bénéficiaire</label>
            <input value={beneficiaireContact} onChange={(e) => setBeneficiaireContact(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Type de dépense *</label>
              <select value={typeDepense} onChange={(e) => setTypeDepense(e.target.value)} className={inputCls}>
                {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Montant demandé *</label>
              <input type="number" min={1} value={montantDemande} onChange={(e) => setMontantDemande(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Motif * <span className="text-slate-400 font-normal">(10 caractères minimum)</span></label>
            <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          {(typeDepense === "PAIEMENT_FOURNISSEUR" || typeDepense === "ACHAT_MARCHANDISES") && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseur</label>
              {fournisseur ? (
                <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                  <span>{fournisseur.nom}</span><button onClick={() => setFournisseur(null)}><X size={14} className="text-slate-400" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={fournisseurQuery} onChange={(e) => rechercherFournisseur(e.target.value)} placeholder="Nom ou code…" className={`${inputCls} pl-8`} />
                  {fournisseurOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {fournisseurOptions.map((f) => <button key={f.id} onClick={() => { setFournisseur(f); setFournisseurOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{f.nom} ({f.code})</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Pièces justificatives {requiertPieces && "*"} <span className="text-slate-400 font-normal">(séparées par des virgules)</span>
            </label>
            <input value={piecesJustificatives} onChange={(e) => setPiecesJustificatives(e.target.value)} className={inputCls} placeholder="Facture, Bon de commande…" />
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

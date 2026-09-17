"use client";

import { useState } from "react";
import { Plus, X, Loader2, Search, Send, Award, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/format";

/** Demande de cotation / RFQ + tableau comparatif (CDC digitalisation §5.3) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface FournisseurOption { id: number; nom: string; code: string; email?: string | null; noteGlobale?: string | null }
interface Reponse {
  id: number; statut: "EN_ATTENTE" | "RECUE" | "REJETEE" | "RETENUE";
  prixUnitaire: string | null; delaiLivraisonJours: number | null; notes: string | null;
  fournisseur: FournisseurOption;
}
interface Rfq {
  id: number; reference: string; statut: "BROUILLON" | "ENVOYEE" | "REPONSES_RECUES" | "CLOTUREE";
  quantite: number; dateLimiteReponse: string | null; notes: string | null;
  produit: ProduitOption; pointDeVente: PDV | null; fournisseurRetenu: FournisseurOption | null;
  reponses: Reponse[]; createdAt: string;
}
interface RfqResponse { data: Rfq[]; stats: Record<string, number> }

const STATUT_LABEL: Record<string, string> = { BROUILLON: "Brouillon", ENVOYEE: "Envoyée", REPONSES_RECUES: "Réponses reçues", CLOTUREE: "Clôturée" };
const STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600", ENVOYEE: "bg-blue-100 text-blue-700",
  REPONSES_RECUES: "bg-amber-100 text-amber-700", CLOTUREE: "bg-emerald-100 text-emerald-700",
};
const REPONSE_LABEL: Record<string, string> = { EN_ATTENTE: "En attente", RECUE: "Reçue", REJETEE: "Rejetée", RETENUE: "Retenue" };

export default function AdminRfqPage() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<RfqResponse>(`/api/logistique/rfq?${params}`);
  const rfqs = data?.data ?? [];

  async function envoyer(id: number) {
    try {
      const res = await fetch(`/api/logistique/rfq/${id}/envoyer`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`RFQ envoyée (${j.emailsEnvoyes}/${j.totalFournisseurs} email(s))`);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function retenir(rfqId: number, reponseId: number) {
    try {
      const res = await fetch(`/api/logistique/rfq/${rfqId}/retenir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reponseId }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Fournisseur retenu — RFQ clôturée");
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Demandes de cotation (RFQ)</h1>
          <p className="text-sm text-slate-500 mt-1">CDC digitalisation §5.3 — consultation fournisseurs et tableau comparatif</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle RFQ</Button>
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
        {loading && rfqs.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && rfqs.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune RFQ sur ce filtre.</p>}
        {rfqs.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <button className="text-left flex-1 min-w-0" onClick={() => setExpandedId(expanded ? null : r.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{r.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[r.statut]}`}>{STATUT_LABEL[r.statut]}</span>
                    {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{r.produit.nom} ×{r.quantite}{r.pointDeVente && ` — ${r.pointDeVente.nom}`}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.reponses.length} fournisseur(s) consulté(s){r.dateLimiteReponse && ` · réponse avant le ${formatDate(r.dateLimiteReponse)}`}
                    {r.fournisseurRetenu && ` · retenu : ${r.fournisseurRetenu.nom}`}
                  </p>
                </button>
                {r.statut === "BROUILLON" && (
                  <button onClick={() => envoyer(r.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 shrink-0"><Send size={13} /> Envoyer aux fournisseurs</button>
                )}
              </div>

              {expanded && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Tableau comparatif</p>
                  {r.reponses.map((rep) => (
                    <ReponseRow key={rep.id} rfqId={r.id} rfqStatut={r.statut} reponse={rep} onRetenir={() => retenir(r.id, rep.id)} onDone={refetch} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {showCreate && <FormRfq onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function ReponseRow({ rfqId, rfqStatut, reponse, onRetenir, onDone }: { rfqId: number; rfqStatut: string; reponse: Reponse; onRetenir: () => void; onDone: () => void }) {
  const [showSaisie, setShowSaisie] = useState(false);
  const [prixUnitaire, setPrixUnitaire] = useState(reponse.prixUnitaire ?? "");
  const [delaiLivraisonJours, setDelaiLivraisonJours] = useState(reponse.delaiLivraisonJours != null ? String(reponse.delaiLivraisonJours) : "");
  const [notes, setNotes] = useState(reponse.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function saisir() {
    if (!prixUnitaire || Number(prixUnitaire) <= 0 || delaiLivraisonJours === "" || Number(delaiLivraisonJours) < 0) {
      toast.error("Prix (>0) et délai (≥0 jour) obligatoires"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/logistique/rfq/${rfqId}/reponses/${reponse.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prixUnitaire: Number(prixUnitaire), delaiLivraisonJours: Number(delaiLivraisonJours), notes: notes || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Cotation enregistrée");
      setShowSaisie(false);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  async function rejeter() {
    try {
      const res = await fetch(`/api/logistique/rfq/${rfqId}/reponses/${reponse.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "REJETEE" }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Fournisseur écarté");
      onDone();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="p-2.5 border border-slate-100 rounded-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="text-sm font-medium text-slate-700">{reponse.fournisseur.nom}</span>
          <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${reponse.statut === "RETENUE" ? "bg-emerald-100 text-emerald-700" : reponse.statut === "RECUE" ? "bg-blue-100 text-blue-700" : reponse.statut === "REJETEE" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>{REPONSE_LABEL[reponse.statut]}</span>
          {reponse.prixUnitaire && <span className="ml-2 text-xs text-slate-500">{formatCurrency(Number(reponse.prixUnitaire))} · {reponse.delaiLivraisonJours}j</span>}
        </div>
        {reponse.statut !== "RETENUE" && reponse.statut !== "REJETEE" && rfqStatut !== "CLOTUREE" && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowSaisie(true)} className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200">Saisir cotation</button>
            <button onClick={rejeter} className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-medium hover:bg-red-100">Écarter</button>
            {reponse.statut === "RECUE" && (
              <button onClick={onRetenir} className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium hover:bg-emerald-200"><Award size={12} /> Retenir</button>
            )}
          </div>
        )}
      </div>
      {showSaisie && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Cotation — {reponse.fournisseur.nom}</h4>
              <button onClick={() => setShowSaisie(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <input type="number" min={0} step="0.01" value={prixUnitaire} onChange={(e) => setPrixUnitaire(e.target.value)} className={inputCls} placeholder="Prix unitaire *" />
              <input type="number" min={0} value={delaiLivraisonJours} onChange={(e) => setDelaiLivraisonJours(e.target.value)} className={inputCls} placeholder="Délai de livraison (jours) *" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Notes (optionnel)" />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setShowSaisie(false)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={saisir} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormRfq({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];

  const [produitQuery, setProduitQuery] = useState("");
  const [produitOptions, setProduitOptions] = useState<ProduitOption[]>([]);
  const [produit, setProduit] = useState<ProduitOption | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [dateLimiteReponse, setDateLimiteReponse] = useState("");
  const [notes, setNotes] = useState("");
  const [fournisseurQuery, setFournisseurQuery] = useState("");
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([]);
  const [fournisseurs, setFournisseurs] = useState<FournisseurOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function rechercherProduit(q: string) {
    setProduitQuery(q);
    if (q.trim().length < 2) { setProduitOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setProduitOptions(j.data);
  }

  async function rechercherFournisseur(q: string) {
    setFournisseurQuery(q);
    if (q.trim().length < 2) { setFournisseurOptions([]); return; }
    const r = await fetch(`/api/logistique/fournisseurs?search=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setFournisseurOptions(j.data);
  }

  async function submit() {
    if (!produit) { toast.error("Sélectionnez un produit"); return; }
    if (fournisseurs.length === 0) { toast.error("Sélectionnez au moins un fournisseur à consulter"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/logistique/rfq", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produitId: produit.id, quantite: Number(quantite), pointDeVenteId: pointDeVenteId || undefined,
          dateLimiteReponse: dateLimiteReponse || undefined, notes: notes || undefined,
          fournisseurIds: fournisseurs.map((f) => f.id),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`RFQ ${j.data.reference} créée (brouillon)`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouvelle demande de cotation</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Produit *</label>
            {produit ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{produit.nom}</span><button onClick={() => setProduit(null)}><X size={14} className="text-slate-400" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={produitQuery} onChange={(e) => rechercherProduit(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} pl-8`} />
                {produitOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {produitOptions.map((p) => <button key={p.id} onClick={() => { setProduit(p); setProduitOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Quantité *</label><input type="number" min={1} value={quantite} onChange={(e) => setQuantite(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Date limite de réponse</label><input type="date" value={dateLimiteReponse} onChange={(e) => setDateLimiteReponse(e.target.value)} className={inputCls} /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente (optionnel)</label>
            <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseurs à consulter *</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={fournisseurQuery} onChange={(e) => rechercherFournisseur(e.target.value)} placeholder="Nom ou code…" className={`${inputCls} pl-8`} />
              {fournisseurOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {fournisseurOptions.map((f) => (
                    <button key={f.id} onClick={() => { if (!fournisseurs.some((x) => x.id === f.id)) setFournisseurs((prev) => [...prev, f]); setFournisseurOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{f.nom} ({f.code})</button>
                  ))}
                </div>
              )}
            </div>
            {fournisseurs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fournisseurs.map((f) => (
                  <span key={f.id} className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
                    {f.nom} <button onClick={() => setFournisseurs((prev) => prev.filter((x) => x.id !== f.id))}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
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

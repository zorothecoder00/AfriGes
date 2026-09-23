"use client";

import { useState } from "react";
import { Plus, X, Loader2, Search, Stamp, Ban, XCircle, CheckCircle2, RefreshCw} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDateTime } from "@/lib/format";

/** Demande d'achat interne (CDC digitalisation §5.3) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface Demande {
  id: number; reference: string; statut: string; motif: string; notes: string | null; montantEstimatif: string;
  demandeur: { nom: string; prenom: string }; pointDeVente: PDV | null;
  lignes: { id: number; quantite: number; justification: string | null; produit: ProduitOption }[];
  createdAt: string;
}
interface DemandesResponse { data: Demande[]; stats: Record<string, number>; seuilVisaDemandeAchat: number }

const STATUT_LABEL: Record<string, string> = {
  SOUMISE: "Soumise", EN_VALIDATION: "En attente de visa", APPROUVEE: "Approuvée",
  REJETEE: "Rejetée", ANNULEE: "Annulée", CLOTUREE: "Clôturée",
};
const STATUT_BADGE: Record<string, string> = {
  SOUMISE: "bg-slate-100 text-slate-600", EN_VALIDATION: "bg-amber-100 text-amber-700", APPROUVEE: "bg-emerald-100 text-emerald-700",
  REJETEE: "bg-red-100 text-red-600", ANNULEE: "bg-red-100 text-red-600", CLOTUREE: "bg-slate-200 text-slate-600",
};

export default function AdminDemandesAchatPage() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [rejetDemande, setRejetDemande] = useState<Demande | null>(null);
  const [motifRejet, setMotifRejet] = useState("");

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<DemandesResponse>(`/api/logistique/demandes-achat?${params}`);
  const demandes = data?.data ?? [];

  async function action(id: number, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/logistique/demandes-achat/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function rejeter() {
    if (!rejetDemande) return;
    if (!motifRejet.trim()) { toast.error("Motif de rejet obligatoire"); return; }
    await action(rejetDemande.id, { action: "REJETER", motifRejet }, "Demande rejetée");
    setRejetDemande(null); setMotifRejet("");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Demandes d&apos;achat interne</h1>
          <p className="text-sm text-slate-500 mt-1">Formalise un besoin d&apos;achat avant RFQ/bon de commande</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" icon={<RefreshCw size={16} />} title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle demande</Button>
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
        {loading && demandes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && demandes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune demande d&apos;achat sur ce filtre.</p>}
        {demandes.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-800 text-sm">{d.reference}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[d.statut]}`}>{STATUT_LABEL[d.statut] ?? d.statut}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{d.motif}{d.pointDeVente && ` — ${d.pointDeVente.nom} (${d.pointDeVente.code})`}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {d.lignes.length} ligne(s) : {d.lignes.map((l) => `${l.produit.nom} ×${l.quantite}`).join(", ")} · estimé {formatCurrency(Number(d.montantEstimatif))}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Par {d.demandeur.prenom} {d.demandeur.nom} · {formatDateTime(d.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {d.statut === "EN_VALIDATION" && (
                  <>
                    <button onClick={() => action(d.id, { action: "VISER" }, "Demande approuvée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Viser</button>
                    <button onClick={() => { setRejetDemande(d); setMotifRejet(""); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><XCircle size={13} /> Rejeter</button>
                  </>
                )}
                {d.statut === "APPROUVEE" && (
                  <button onClick={() => action(d.id, { action: "CLOTURER" }, "Demande clôturée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"><CheckCircle2 size={13} /> Clôturer</button>
                )}
                {["SOUMISE", "EN_VALIDATION", "APPROUVEE"].includes(d.statut) && (
                  <button onClick={() => action(d.id, { action: "ANNULER" }, "Demande annulée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><Ban size={13} /> Annuler</button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && <FormDemande onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
      {rejetDemande && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Rejeter la demande {rejetDemande.reference}</h4>
              <button onClick={() => setRejetDemande(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-5"><textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" /></div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setRejetDemande(null)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={rejeter} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">Rejeter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormDemande({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [motif, setMotif] = useState("");
  const [notes, setNotes] = useState("");
  const [produitQuery, setProduitQuery] = useState("");
  const [produitOptions, setProduitOptions] = useState<ProduitOption[]>([]);
  const [lignes, setLignes] = useState<{ produit: ProduitOption; quantite: string; justification: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function rechercherProduit(q: string) {
    setProduitQuery(q);
    if (q.trim().length < 2) { setProduitOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setProduitOptions(j.data);
  }

  async function submit() {
    if (!motif.trim()) { toast.error("Motif obligatoire"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/logistique/demandes-achat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motif, pointDeVenteId: pointDeVenteId || undefined, notes: notes || undefined,
          lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: Number(l.quantite), justification: l.justification || undefined })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Demande ${j.data.reference} créée`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouvelle demande d&apos;achat</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Motif *</label>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente (optionnel)</label>
            <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ajouter un produit</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={produitQuery} onChange={(e) => rechercherProduit(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} pl-8`} />
              {produitOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {produitOptions.map((p) => (
                    <button key={p.id} onClick={() => { if (!lignes.some((l) => l.produit.id === p.id)) setLignes((prev) => [...prev, { produit: p, quantite: "1", justification: "" }]); setProduitOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {lignes.map((l) => (
            <div key={l.produit.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
              <span className="text-sm flex-1">{l.produit.nom}</span>
              <input type="number" min={1} value={l.quantite} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, quantite: e.target.value } : x))} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté" />
              <button onClick={() => setLignes((prev) => prev.filter((x) => x.produit.id !== l.produit.id))}><X size={14} className="text-slate-400" /></button>
            </div>
          ))}
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

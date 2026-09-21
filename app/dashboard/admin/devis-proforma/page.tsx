"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, X, Loader2, Search, Send, Repeat, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/format";

/** Devis / Proforma (CDC digitalisation §5.2) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface ClientOption { id: number; nom: string; prenom: string; telephone: string | null; codeClient: string | null }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface Devis {
  id: number; reference: string; type: "DEVIS" | "PROFORMA"; statut: string; totalTTC: string; dateValidite: string;
  client: { nom: string; prenom: string; telephone: string | null };
  pointDeVente: PDV; devisOrigine: { id: number; reference: string } | null; proformaGenere: { id: number; reference: string } | null;
  lignes: { id: number; quantite: number; produit: ProduitOption }[];
  createdAt: string;
}
interface DevisResponse { data: Devis[]; stats: Record<string, number> }

const STATUT_LABEL: Record<string, string> = { BROUILLON: "Brouillon", ENVOYE: "Envoyé", ACCEPTE: "Accepté", REFUSE: "Refusé/Annulé", EXPIRE: "Expiré" };
const STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600", ENVOYE: "bg-blue-100 text-blue-700", ACCEPTE: "bg-emerald-100 text-emerald-700",
  REFUSE: "bg-red-100 text-red-600", EXPIRE: "bg-amber-100 text-amber-700",
};

export default function AdminDevisProformaPage() {
  const [statut, setStatut] = useState("");
  const [type, setType] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (type) params.set("type", type);
  const { data, loading, refetch } = useApi<DevisResponse>(`/api/ventes/devis-proforma?${params}`);
  const documents = data?.data ?? [];

  async function action(id: number, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/ventes/devis-proforma/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devis / Proforma</h1>
          <p className="text-sm text-slate-500 mt-1">Proposition commerciale avant commande ferme</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouveau devis</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Devis et Proforma</option>
            <option value="DEVIS">Devis</option>
            <option value="PROFORMA">Proforma</option>
          </select>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l} {data?.stats?.[k] ? `(${data.stats[k]})` : ""}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {loading && documents.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && documents.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucun document sur ce filtre.</p>}
        {documents.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-800 text-sm">{d.reference}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{d.type === "PROFORMA" ? "Proforma" : "Devis"}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[d.statut]}`}>{STATUT_LABEL[d.statut] ?? d.statut}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{d.client.prenom} {d.client.nom} ({d.client.telephone ?? "—"}) — {d.pointDeVente.nom}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {d.lignes.length} ligne(s) · {formatCurrency(Number(d.totalTTC))} · validité {formatDate(d.dateValidite)}
                  {d.devisOrigine && ` · issu du devis ${d.devisOrigine.reference}`}
                  {d.proformaGenere && ` · converti en ${d.proformaGenere.reference}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {d.statut === "BROUILLON" && (
                  <button onClick={() => action(d.id, { action: "ENVOYER" }, "Document envoyé")} className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200"><Send size={13} /> Envoyer</button>
                )}
                {d.type === "DEVIS" && d.statut === "ACCEPTE" && !d.proformaGenere && (
                  <button onClick={() => action(d.id, { action: "CONVERTIR_PROFORMA" }, "Converti en proforma")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Repeat size={13} /> Convertir en proforma</button>
                )}
                {["BROUILLON", "ENVOYE"].includes(d.statut) && (
                  <button onClick={() => action(d.id, { action: "ANNULER" }, "Document annulé")} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><Ban size={13} /> Annuler</button>
                )}
                <a href={`/api/ventes/devis-proforma/${d.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && <FormDevis onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function FormDevis({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];

  const [type, setType] = useState("DEVIS");
  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [client, setClient] = useState<ClientOption | null>(null);
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [dateValidite, setDateValidite] = useState("");
  const [conditions, setConditions] = useState("");
  const [produitQuery, setProduitQuery] = useState("");
  const [produitOptions, setProduitOptions] = useState<ProduitOption[]>([]);
  const [lignes, setLignes] = useState<{ produit: ProduitOption; quantite: string; remisePourcent: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function rechercherClient(q: string) {
    setClientQuery(q);
    if (q.trim().length < 2) { setClientOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/clients-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setClientOptions(j.data);
  }

  async function rechercherProduit(q: string) {
    setProduitQuery(q);
    if (q.trim().length < 2) { setProduitOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setProduitOptions(j.data);
  }

  async function submit() {
    if (!client) { toast.error("Sélectionnez un client"); return; }
    if (!pointDeVenteId) { toast.error("Sélectionnez le point de vente"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ventes/devis-proforma", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, clientId: client.id, pointDeVenteId: Number(pointDeVenteId), dateValidite: dateValidite || undefined,
          conditions: conditions || undefined, notes: notes || undefined,
          lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: Number(l.quantite), remisePourcent: l.remisePourcent ? Number(l.remisePourcent) : undefined })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`${type === "PROFORMA" ? "Proforma" : "Devis"} ${j.data.reference} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouveau devis / proforma</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="DEVIS">Devis</option>
              <option value="PROFORMA">Proforma</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Client *</label>
            {client ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{client.prenom} {client.nom} — {client.telephone ?? "—"}</span><button onClick={() => setClient(null)}><X size={14} className="text-slate-400" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={clientQuery} onChange={(e) => rechercherClient(e.target.value)} placeholder="Nom, téléphone ou code client…" className={`${inputCls} pl-8`} />
                {clientOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {clientOptions.map((c) => <button key={c.id} onClick={() => { setClient(c); setClientOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.prenom} {c.nom} — {c.telephone ?? "—"}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente *</label>
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date de validité <span className="text-slate-400 font-normal">(15 jours par défaut)</span></label>
              <input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Conditions</label>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ajouter un produit</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={produitQuery} onChange={(e) => rechercherProduit(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} pl-8`} />
              {produitOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {produitOptions.map((p) => (
                    <button key={p.id} onClick={() => { if (!lignes.some((l) => l.produit.id === p.id)) setLignes((prev) => [...prev, { produit: p, quantite: "1", remisePourcent: "" }]); setProduitOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {lignes.map((l) => (
            <div key={l.produit.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
              <span className="text-sm flex-1">{l.produit.nom}</span>
              <input type="number" min={1} value={l.quantite} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, quantite: e.target.value } : x))} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté" />
              <input type="number" min={0} max={100} value={l.remisePourcent} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, remisePourcent: e.target.value } : x))} className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Remise %" />
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

"use client";

import { Suspense, useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, X, Loader2, Search, Stamp, XCircle, Ban, CheckCircle2, Printer, SlidersHorizontal, RefreshCw} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useFocusDetail } from "@/hooks/useFocusDetail";

/** Bon de commande client (CDC digitalisation §3.2) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface ClientOption { id: number; nom: string; prenom: string; telephone: string | null; codeClient: string | null }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface Commande {
  id: number; reference: string; statut: string; typeClientCommande: string; modeReglement: string;
  totalTTC: string; lieuLivraison: string | null; motifRejet: string | null;
  client: { nom: string; prenom: string; telephone: string | null };
  pointDeVente: PDV; agent: { nom: string; prenom: string };
  bonSortie: { id: number; reference: string; statut: string } | null;
  bonLivraison: { id: number; reference: string } | null;
  bonReception: { id: number; reference: string; statut: string } | null;
  lignes: { id: number; quantite: number; prixUnitaire: number | string; remisePourcent: number | string | null; designationLibre: string | null; produit: ProduitOption | null }[];
  latitude: number | null; longitude: number | null; precisionGps: number | null;
  createdAt: string;
}
interface CommandesResponse { data: Commande[]; stats: Record<string, number> }

const STATUT_LABEL: Record<string, string> = {
  SOUMISE: "Soumise", EN_VALIDATION: "À valider", VALIDEE: "Validée", EN_PREPARATION: "En préparation",
  LIVREE: "Livrée", CLOTUREE: "Clôturée", REJETEE: "Rejetée", ANNULEE: "Annulée",
};
const STATUT_BADGE: Record<string, string> = {
  SOUMISE: "bg-slate-100 text-slate-600", EN_VALIDATION: "bg-amber-100 text-amber-700", VALIDEE: "bg-blue-100 text-blue-700",
  EN_PREPARATION: "bg-indigo-100 text-indigo-700", LIVREE: "bg-cyan-100 text-cyan-700", CLOTUREE: "bg-emerald-100 text-emerald-700",
  REJETEE: "bg-red-100 text-red-600", ANNULEE: "bg-red-100 text-red-600",
};

export default function AdminCommandesClientPage() {
  return <Suspense fallback={null}><CommandesClientContenu /></Suspense>;
}

function CommandesClientContenu() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [rejetCommande, setRejetCommande] = useState<Commande | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [ajusterCommande, setAjusterCommande] = useState<Commande | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<CommandesResponse>(`/api/ventes/commandes-client?${params}`);
  const commandes = data?.data ?? [];
  const focusId = useFocusDetail(!loading);

  async function action(id: number, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/ventes/commandes-client/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function rejeter() {
    if (!rejetCommande) return;
    if (!motifRejet.trim()) { toast.error("Motif de rejet obligatoire"); return; }
    await action(rejetCommande.id, { action: "REJETER", motifRejet }, "Commande rejetée");
    setRejetCommande(null); setMotifRejet("");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bons de commande client</h1>
          <p className="text-sm text-slate-500 mt-1">Prise de commande terrain</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" icon={<RefreshCw size={16} />} title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle commande</Button>
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
        {loading && commandes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && commandes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune commande sur ce filtre.</p>}
        {commandes.map((c) => (
          <div key={c.id} id={`doc-${c.id}`} className={focusId === c.id ? "rounded-2xl ring-2 ring-primary-400" : ""}>
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-800 text-sm">{c.reference}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[c.statut]}`}>{STATUT_LABEL[c.statut] ?? c.statut}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.modeReglement}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{c.client.prenom} {c.client.nom} ({c.client.telephone ?? "—"}) — {c.pointDeVente.nom}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {c.lignes.length} ligne(s) · {formatCurrency(Number(c.totalTTC))} · agent {c.agent.prenom} {c.agent.nom} · {formatDateTime(c.createdAt)}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {c.bonSortie && (
                    <a href={`/api/ventes/commandes-client/${c.id}/facture/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"><Printer size={11} /> Facture</a>
                  )}
                  {c.bonLivraison && (
                    <a href={`/api/bons-livraison/${c.bonLivraison.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"><Printer size={11} /> Bon de livraison</a>
                  )}
                  {c.bonReception && (
                    <a href={`/api/bons-reception/${c.bonReception.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"><Printer size={11} /> Bon de réception ({c.bonReception.statut})</a>
                  )}
                </div>
                {c.lignes.some((l) => !l.produit) && (
                  <p className="text-xs text-amber-700 mt-1">Produit(s) hors catalogue : {c.lignes.filter((l) => !l.produit).map((l) => l.designationLibre).join(", ")} — à associer via « Ajuster » avant validation.</p>
                )}
                {c.latitude != null && c.longitude != null && (
                  <a href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary-600 hover:underline mt-1">Position GPS : {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}{c.precisionGps != null ? ` (±${Math.round(c.precisionGps)} m)` : ""}</a>
                )}
                {c.motifRejet && <p className="text-xs text-red-600 mt-1">Motif de rejet : {c.motifRejet}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.statut === "EN_VALIDATION" && (
                  <>
                    <button onClick={() => action(c.id, { action: "VISER" }, "Commande validée — bon de sortie généré, agent notifié")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Valider</button>
                    <button onClick={() => setAjusterCommande(c)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100"><SlidersHorizontal size={13} /> Ajuster</button>
                    <button onClick={() => { setRejetCommande(c); setMotifRejet(""); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><XCircle size={13} /> Rejeter</button>
                  </>
                )}
                {["SOUMISE", "EN_VALIDATION"].includes(c.statut) && (
                  <button onClick={() => action(c.id, { action: "ANNULER" }, "Commande annulée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><Ban size={13} /> Annuler</button>
                )}
                {c.statut === "LIVREE" && (
                  <button onClick={() => action(c.id, { action: "CLOTURER" }, "Commande clôturée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"><CheckCircle2 size={13} /> Clôturer</button>
                )}
                <a href={`/api/ventes/commandes-client/${c.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
              </div>
            </div>
          </Card>
          </div>
        ))}
      </div>

      {showCreate && <FormCommande onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
      {ajusterCommande && <FormAjuster commande={ajusterCommande} onClose={() => setAjusterCommande(null)} onDone={() => { setAjusterCommande(null); refetch(); }} />}
      {rejetCommande && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Rejeter la commande {rejetCommande.reference}</h4>
              <button onClick={() => setRejetCommande(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-5"><textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" /></div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setRejetCommande(null)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={rejeter} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">Rejeter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ajustement par l'admin avant validation : produits, quantités et remises par ligne ; l'agent est notifié.
 * Un produit hors catalogue (saisi par l'agent) se règle ici : on l'associe à un produit du catalogue
 * (sinon la commande ne peut pas être validée) ou on retire la ligne.
 */
type LigneAjust = { produitId: number | null; nom: string; libre: string | null; prixLibre: number; quantite: string; remisePourcent: string };

function FormAjuster({ commande, onClose, onDone }: { commande: Commande; onClose: () => void; onDone: () => void }) {
  const [lignes, setLignes] = useState<LigneAjust[]>(commande.lignes.map((l) => ({
    produitId: l.produit?.id ?? null, nom: l.produit?.nom ?? l.designationLibre ?? "", libre: l.produit ? null : l.designationLibre,
    prixLibre: Number(l.prixUnitaire), quantite: String(l.quantite), remisePourcent: String(Number(l.remisePourcent) || 0),
  })));
  const [submitting, setSubmitting] = useState(false);
  const [rechercheIdx, setRechercheIdx] = useState<number | null>(null);
  const [recherche, setRecherche] = useState("");
  const [options, setOptions] = useState<ProduitOption[]>([]);

  const maj = (i: number, patch: Partial<LigneAjust>) => setLignes((prev) => prev.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  async function chercher(q: string) {
    setRecherche(q);
    if (q.trim().length < 2) { setOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setOptions(j.data);
  }

  async function submit() {
    if (lignes.length === 0) { toast.error("Au moins une ligne est requise"); return; }
    if (lignes.some((l) => !(Number(l.quantite) > 0))) { toast.error("Quantité invalide"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ventes/commandes-client/${commande.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lignes: lignes.map((l) => l.produitId
          ? { produitId: l.produitId, quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 }
          : { designation: l.libre, prixUnitaire: l.prixLibre, quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 }) }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Commande ajustée — agent notifié");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Ajuster {commande.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-500">Modifiez les quantités et remises ; les prix des produits du catalogue sont recalculés par le serveur. La commande reste à valider ensuite.</p>
          {lignes.map((l, i) => (
            <div key={i} className={`rounded-lg ${l.produitId ? "" : "border border-amber-200 bg-amber-50/50 p-2"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm flex-1 truncate">{l.nom}</span>
                <input type="number" min={1} value={l.quantite} onChange={(e) => maj(i, { quantite: e.target.value })} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" title="Quantité" />
                <input type="number" min={0} max={100} value={l.remisePourcent} onChange={(e) => maj(i, { remisePourcent: e.target.value })} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" title="Remise %" />
                {lignes.length > 1 && <button onClick={() => setLignes((prev) => prev.filter((_, k) => k !== i))} title="Retirer la ligne"><X size={14} className="text-slate-400 hover:text-red-500" /></button>}
              </div>
              {!l.produitId && (
                <div className="mt-2 relative">
                  <p className="text-[11px] text-amber-700 mb-1">Hors catalogue (prix indicatif de l&apos;agent : {formatCurrency(l.prixLibre)}) — associer à un produit du catalogue :</p>
                  <input value={rechercheIdx === i ? recherche : ""} onFocus={() => setRechercheIdx(i)} onChange={(e) => { setRechercheIdx(i); chercher(e.target.value); }} placeholder="Rechercher un produit du catalogue…" className={inputCls} />
                  {rechercheIdx === i && options.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {options.map((p) => (
                        <button key={p.id} onClick={() => { maj(i, { produitId: p.id, nom: p.nom, libre: null }); setRechercheIdx(null); setRecherche(""); setOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormCommande({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];

  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [client, setClient] = useState<ClientOption | null>(null);
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [typeClientCommande, setTypeClientCommande] = useState("PARTICULIER");
  const [modeReglement, setModeReglement] = useState("COMPTANT");
  const [lieuLivraison, setLieuLivraison] = useState("");
  const [signatureClientNom, setSignatureClientNom] = useState("");
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
    if (!signatureClientNom.trim()) { toast.error("Signature électronique du client obligatoire"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ventes/commandes-client", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id, pointDeVenteId: Number(pointDeVenteId), typeClientCommande, modeReglement,
          lieuLivraison: lieuLivraison || undefined, signatureClientNom, notes: notes || undefined,
          lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: Number(l.quantite), remisePourcent: l.remisePourcent ? Number(l.remisePourcent) : undefined })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Commande ${j.data.reference} créée`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouveau bon de commande client</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
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
              <label className="text-xs font-medium text-slate-500 mb-1 block">Type de client</label>
              <select value={typeClientCommande} onChange={(e) => setTypeClientCommande(e.target.value)} className={inputCls}>
                <option value="PARTICULIER">Particulier</option>
                <option value="REVENDEUR">Revendeur</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Mode de règlement</label>
              <select value={modeReglement} onChange={(e) => setModeReglement(e.target.value)} className={inputCls}>
                <option value="COMPTANT">Comptant</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CREDIT">À crédit</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Lieu de livraison</label>
              <input value={lieuLivraison} onChange={(e) => setLieuLivraison(e.target.value)} className={inputCls} />
            </div>
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
            <label className="text-xs font-medium text-slate-500 mb-1 block">Signature électronique du client * <span className="text-slate-400 font-normal">(nom saisi vaut engagement d&apos;achat)</span></label>
            <input value={signatureClientNom} onChange={(e) => setSignatureClientNom(e.target.value)} className={inputCls} />
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

"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, X, Loader2, Search, PauseCircle, PlayCircle, CheckCircle2, Send, FileSignature, Boxes, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/format";

/** Dépôt-vente (CDC digitalisation §5.5) — page admin native (conventions, dépôts, état & règlements). */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

type Tab = "conventions" | "depots" | "etat";

interface PDV { id: number; nom: string; code: string }
interface FournisseurOption { id: number; nom: string; code: string }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface Convention {
  id: number; reference: string; statut: "ACTIVE" | "SUSPENDUE" | "TERMINEE"; commissionPourcent: string;
  dateFin: string | null; conditions: string | null; fournisseur: FournisseurOption;
  depots: { id: number; reference: string; statut: string }[]; reglements: { id: number; reference: string; statut: string; montantDu: string }[];
}
interface LigneDepot { id: number; quantiteDeposee: number; prixVenteConvenu: string; quantiteReprise: number; produit: ProduitOption }
interface Depot {
  id: number; reference: string; statut: "BROUILLON" | "EN_STOCK" | "CLOTURE";
  convention: { id: number; reference: string; fournisseur: { nom: string } };
  pointDeVente: PDV; lignes: LigneDepot[];
}
interface EtatConvention {
  conventionId: number; conventionReference: string; fournisseur: { nom: string }; commissionPourcent: number;
  stockEnDepot: { produitNom: string; quantiteRestante: number }[];
  synthese: { montantVentesBrut: number; montantCommission: number; montantDu: number };
}

const STATUT_CONV_LABEL: Record<string, string> = { ACTIVE: "Active", SUSPENDUE: "Suspendue", TERMINEE: "Terminée" };
const STATUT_CONV_BADGE: Record<string, string> = { ACTIVE: "bg-emerald-100 text-emerald-700", SUSPENDUE: "bg-amber-100 text-amber-700", TERMINEE: "bg-slate-200 text-slate-600" };
const STATUT_DEP_LABEL: Record<string, string> = { BROUILLON: "Brouillon", EN_STOCK: "En stock", CLOTURE: "Clôturé" };
const STATUT_DEP_BADGE: Record<string, string> = { BROUILLON: "bg-amber-100 text-amber-700", EN_STOCK: "bg-emerald-100 text-emerald-700", CLOTURE: "bg-slate-200 text-slate-600" };

export default function AdminDepotVentePage() {
  const [tab, setTab] = useState<Tab>("conventions");
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dépôt-vente</h1>
        <p className="text-sm text-slate-500 mt-1">CDC digitalisation §5.5 — conventions, dépôts de marchandises, état et règlements fournisseur</p>
      </div>
      <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 w-fit">
        {([["conventions", "Conventions"], ["depots", "Dépôts de marchandises"], ["etat", "État & règlements"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === k ? "bg-primary-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "conventions" && <OngletConventions />}
      {tab === "depots" && <OngletDepots />}
      {tab === "etat" && <OngletEtat />}
    </div>
  );
}

// ── Conventions ──────────────────────────────────────────────────────────

function OngletConventions() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<{ data: Convention[] }>("/api/logistique/depot-vente/conventions");
  const conventions = data?.data ?? [];

  async function action(id: number, actionName: string, successMsg: string) {
    try {
      const res = await fetch(`/api/logistique/depot-vente/conventions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle convention</Button>
      </div>
      {loading && conventions.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
      {!loading && conventions.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune convention de dépôt-vente.</p>}
      {conventions.map((c) => (
        <Card key={c.id}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-slate-800 text-sm">{c.reference}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_CONV_BADGE[c.statut]}`}>{STATUT_CONV_LABEL[c.statut]}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{c.fournisseur.nom} — commission {c.commissionPourcent}%</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.depots.length} dépôt(s) · {c.reglements.length} règlement(s){c.dateFin && ` · fin le ${formatDate(c.dateFin)}`}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {c.statut === "ACTIVE" && (
                <button onClick={() => action(c.id, "SUSPENDRE", "Convention suspendue")} className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200"><PauseCircle size={13} /> Suspendre</button>
              )}
              {c.statut === "SUSPENDUE" && (
                <button onClick={() => action(c.id, "REACTIVER", "Convention réactivée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><PlayCircle size={13} /> Réactiver</button>
              )}
              {(c.statut === "ACTIVE" || c.statut === "SUSPENDUE") && (
                <button onClick={() => action(c.id, "TERMINER", "Convention terminée")} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"><CheckCircle2 size={13} /> Terminer</button>
              )}
            </div>
          </div>
        </Card>
      ))}
      {showCreate && <FormConvention onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function FormConvention({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [fournisseurQuery, setFournisseurQuery] = useState("");
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([]);
  const [fournisseur, setFournisseur] = useState<FournisseurOption | null>(null);
  const [commissionPourcent, setCommissionPourcent] = useState("10");
  const [dateFin, setDateFin] = useState("");
  const [conditions, setConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function rechercher(q: string) {
    setFournisseurQuery(q);
    if (q.trim().length < 2) { setFournisseurOptions([]); return; }
    const r = await fetch(`/api/logistique/fournisseurs?search=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setFournisseurOptions(j.data);
  }

  async function submit() {
    if (!fournisseur) { toast.error("Sélectionnez un fournisseur"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/logistique/depot-vente/conventions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fournisseurId: fournisseur.id, commissionPourcent: Number(commissionPourcent), dateFin: dateFin || undefined, conditions: conditions || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Convention ${j.data.reference} créée`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h3 className="font-bold text-slate-800">Nouvelle convention</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseur *</label>
            {fournisseur ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{fournisseur.nom}</span><button onClick={() => setFournisseur(null)}><X size={14} className="text-slate-400" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={fournisseurQuery} onChange={(e) => rechercher(e.target.value)} placeholder="Nom ou code…" className={`${inputCls} pl-8`} />
                {fournisseurOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {fournisseurOptions.map((f) => <button key={f.id} onClick={() => { setFournisseur(f); setFournisseurOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{f.nom} ({f.code})</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Commission (%) *</label>
            <input type="number" min={0} max={100} value={commissionPourcent} onChange={(e) => setCommissionPourcent(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Date de fin (optionnel)</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Conditions</label>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dépôts de marchandises ───────────────────────────────────────────────

function OngletDepots() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<{ data: Depot[]; pdvs: PDV[] }>("/api/logistique/depot-vente/depots");
  const { data: convData } = useApi<{ data: Convention[] }>("/api/logistique/depot-vente/conventions?statut=ACTIVE");
  const depots = data?.data ?? [];

  async function constaterEntree(id: number) {
    try {
      const res = await fetch(`/api/logistique/depot-vente/depots/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CONSTATER_ENTREE" }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Entrée en stock constatée");
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouveau dépôt</Button>
      </div>
      {loading && depots.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
      {!loading && depots.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucun dépôt de marchandises.</p>}
      {depots.map((d) => (
        <Card key={d.id}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-slate-800 text-sm">{d.reference}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_DEP_BADGE[d.statut]}`}>{STATUT_DEP_LABEL[d.statut]}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{d.convention.fournisseur.nom} — {d.pointDeVente.nom} ({d.pointDeVente.code})</p>
              <p className="text-xs text-slate-400 mt-0.5">{d.lignes.length} ligne(s) : {d.lignes.map((l) => `${l.produit.nom} ×${l.quantiteDeposee}`).join(", ")}</p>
            </div>
            {d.statut === "BROUILLON" && (
              <button onClick={() => constaterEntree(d.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Boxes size={13} /> Constater l&apos;entrée</button>
            )}
          </div>
        </Card>
      ))}
      {showCreate && (
        <FormDepot pdvs={data?.pdvs ?? []} conventions={convData?.data ?? []} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

function FormDepot({ pdvs, conventions, onClose, onDone }: { pdvs: PDV[]; conventions: Convention[]; onClose: () => void; onDone: () => void }) {
  const [conventionId, setConventionId] = useState("");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [produitQuery, setProduitQuery] = useState("");
  const [produitOptions, setProduitOptions] = useState<ProduitOption[]>([]);
  const [lignes, setLignes] = useState<{ produit: ProduitOption; quantite: string; prixVenteConvenu: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function rechercherProduit(q: string) {
    setProduitQuery(q);
    if (q.trim().length < 2) { setProduitOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setProduitOptions(j.data);
  }

  async function submit() {
    if (!conventionId || !pointDeVenteId) { toast.error("Convention et point de vente obligatoires"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/logistique/depot-vente/depots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conventionId: Number(conventionId), pointDeVenteId: Number(pointDeVenteId),
          lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: Number(l.quantite), prixVenteConvenu: Number(l.prixVenteConvenu) })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Dépôt ${j.data.reference} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0"><h3 className="font-bold text-slate-800">Nouveau dépôt de marchandises</h3><button onClick={onClose}><X size={18} className="text-slate-400" /></button></div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Convention (active) *</label>
              <select value={conventionId} onChange={(e) => setConventionId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {conventions.map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.fournisseur.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente *</label>
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
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
                    <button key={p.id} onClick={() => { if (!lignes.some((l) => l.produit.id === p.id)) setLignes((prev) => [...prev, { produit: p, quantite: "1", prixVenteConvenu: "0" }]); setProduitOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {lignes.map((l) => (
            <div key={l.produit.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
              <span className="text-sm flex-1">{l.produit.nom}</span>
              <input type="number" min={1} value={l.quantite} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, quantite: e.target.value } : x))} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté" />
              <input type="number" min={0} value={l.prixVenteConvenu} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, prixVenteConvenu: e.target.value } : x))} className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Prix de vente" />
              <button onClick={() => setLignes((prev) => prev.filter((x) => x.produit.id !== l.produit.id))}><X size={14} className="text-slate-400" /></button>
            </div>
          ))}
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

// ── État & règlements ────────────────────────────────────────────────────

function OngletEtat() {
  const { data, loading, refetch } = useApi<{ data: EtatConvention[] }>("/api/logistique/depot-vente/etat");
  const { data: reglData, refetch: refetchRegl } = useApi<{ data: { id: number; reference: string; statut: string; montantDu: string; convention: { reference: string; fournisseur: { nom: string } } }[] }>("/api/logistique/depot-vente/reglements");
  const etats = data?.data ?? [];
  const reglements = reglData?.data ?? [];

  async function creerReglement(conventionId: number) {
    try {
      const res = await fetch("/api/logistique/depot-vente/reglements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conventionId }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Règlement ${j.data.reference} généré`);
      refetch(); refetchRegl();
    } catch { toast.error("Erreur réseau"); }
  }

  async function soumettreReglement(id: number) {
    try {
      const res = await fetch(`/api/logistique/depot-vente/reglements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SOUMETTRE" }) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Fiche de décaissement ${j.data.reference} soumise`);
      refetchRegl();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">État par convention</h3>
        {loading && <p className="text-sm text-slate-400">Chargement…</p>}
        {!loading && etats.length === 0 && <p className="text-sm text-slate-400">Aucune donnée.</p>}
        <div className="space-y-3">
          {etats.map((e) => (
            <Card key={e.conventionId}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono font-bold text-slate-800 text-sm">{e.conventionReference} — {e.fournisseur.nom}</p>
                  <p className="text-xs text-slate-500 mt-1">Stock restant : {e.stockEnDepot.map((s) => `${s.produitNom} ×${s.quantiteRestante}`).join(", ") || "—"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ventes brutes {formatCurrency(e.synthese.montantVentesBrut)} · commission {formatCurrency(e.synthese.montantCommission)} · dû au fournisseur <span className="font-semibold text-slate-700">{formatCurrency(e.synthese.montantDu)}</span>
                  </p>
                </div>
                {e.synthese.montantDu > 0 && (
                  <button onClick={() => creerReglement(e.conventionId)} className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-200 shrink-0"><FileSignature size={13} /> Générer un règlement</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Demandes de règlement</h3>
        {reglements.length === 0 && <p className="text-sm text-slate-400">Aucune demande de règlement.</p>}
        <div className="space-y-2">
          {reglements.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 border border-slate-100 rounded-xl bg-white">
              <div>
                <span className="font-mono font-bold text-slate-800 text-sm">{r.reference}</span>
                <span className="text-xs text-slate-500 ml-2">{r.convention.fournisseur.nom} — {formatCurrency(Number(r.montantDu))}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.statut}</span>
                {r.statut === "BROUILLON" && (
                  <button onClick={() => soumettreReglement(r.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium"><Send size={12} /> Soumettre</button>
                )}
                {r.statut === "SOUMIS" && <span title="En attente de paiement — voir Décaissements"><Wallet size={14} className="text-slate-400" /></span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

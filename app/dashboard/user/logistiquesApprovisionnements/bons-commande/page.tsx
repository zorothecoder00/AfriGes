"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";
import {
  ClipboardList, Plus, X, RefreshCw, Save, Send,
  CheckCircle, Ban, XCircle, FileText, PenTool, Truck,
} from "lucide-react";

interface Ligne { id: number; produitId: number; quantite: number; prixUnitaire: number | string; quantiteRecue: number; produit: { id: number; nom: string; codeProduit: string | null } }
interface PersonRef { id: number; nom: string; prenom: string }
interface BonCommande {
  id: number; reference: string; statut: string; statutLivraison: string | null;
  devise: string | null; dateCommande: string; dateLivraisonPrevue: string | null; montantTotal: number | string; montantPaye: number | string;
  notes: string | null;
  fournisseur: { id: number; nom: string; code: string | null; email: string | null };
  pointDeVente: { id: number; nom: string; code: string };
  demandeCotation: { id: number; reference: string } | null;
  creePar: PersonRef; approuvePar: PersonRef | null; envoyePar: PersonRef | null; signePar: PersonRef | null;
  lignes: Ligne[];
  receptions?: { id: number; reference: string; statut: string; dateReception: string | null }[];
}
interface FournisseurRef { id: number; nom: string; email: string | null }
interface PdvRef { id: number; nom: string; code: string }
interface ProduitRef { id: number; nom: string; codeProduit: string | null }

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  DRAFT:               { label: "Brouillon",             badge: "bg-slate-100 text-slate-600" },
  PENDING_APPROVAL:    { label: "En attente d'approbation", badge: "bg-amber-100 text-amber-700" },
  APPROVED:            { label: "Approuvé",               badge: "bg-blue-100 text-blue-700" },
  SENT:                { label: "Envoyé",                 badge: "bg-indigo-100 text-indigo-700" },
  ACKNOWLEDGED:        { label: "Accusé de réception",     badge: "bg-cyan-100 text-cyan-700" },
  PARTIALLY_DELIVERED: { label: "Partiellement livré",     badge: "bg-orange-100 text-orange-700" },
  COMPLETED:           { label: "Complété",                badge: "bg-emerald-100 text-emerald-700" },
  CANCELLED:           { label: "Annulé",                  badge: "bg-red-100 text-red-600" },
};
const LIVRAISON_ETAPES: { key: string; label: string }[] = [
  { key: "PREPARATION", label: "Préparation" }, { key: "EXPEDIEE", label: "Expédiée" },
  { key: "EN_TRANSIT", label: "En transit" }, { key: "DOUANE", label: "Douane" },
  { key: "LIVREE", label: "Livrée" }, { key: "RECEPTIONNEE", label: "Réceptionnée" },
];

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function BonsCommandePage() {
  return (
    <Suspense fallback={null}>
      <BonsCommandePageInner />
    </Suspense>
  );
}

function BonsCommandePageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("");
  const [showCreate, setShowCreate] = useState(searchParams.get("fournisseurId") != null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: BonCommande[]; stats: Record<string, number> }>(`/api/logistique/bons-commande?${params}`);
  const bons = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <RetourApprovisionnement />
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-emerald-600" /> Bons de commande
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Engagement fournisseur, approbation, envoi et suivi de livraison</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouveau bon de commande
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statutFilter === k ? "ring-1 ring-emerald-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
              }`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : bons.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <ClipboardList className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun bon de commande</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {bons.map((b) => {
              const cfg = STATUT_CFG[b.statut] ?? STATUT_CFG.DRAFT;
              return (
                <div key={b.id} onClick={() => setDetailId(b.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{b.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                      {b.statutLivraison && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{LIVRAISON_ETAPES.find((e) => e.key === b.statutLivraison)?.label}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{b.fournisseur.nom} · {b.pointDeVente.nom}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(b.montantTotal).toLocaleString("fr-FR")} {b.devise}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }}
          prefill={{
            fournisseurId: searchParams.get("fournisseurId"),
            produitId: searchParams.get("produitId"),
            produitNom: searchParams.get("produitNom"),
            quantite: searchParams.get("quantite"),
            prixUnitaire: searchParams.get("prixUnitaire"),
            demandeCotationId: searchParams.get("rfqId"),
          }}
        />
      )}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

// ── Création ───────────────────────────────────────────────────────────────────

interface LigneForm { produitId: number | null; produitNom: string; quantite: string; prixUnitaire: string }

function CreateModal({ onClose, onCreated, prefill }: {
  onClose: () => void; onCreated: (id: number) => void;
  prefill: { fournisseurId: string | null; produitId: string | null; produitNom: string | null; quantite: string | null; prixUnitaire: string | null; demandeCotationId: string | null };
}) {
  const [fournisseurId, setFournisseurId] = useState(prefill.fournisseurId ?? "");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>(
    prefill.produitId
      ? [{ produitId: Number(prefill.produitId), produitNom: prefill.produitNom ?? "", quantite: prefill.quantite ?? "1", prixUnitaire: prefill.prixUnitaire ?? "0" }]
      : [{ produitId: null, produitNom: "", quantite: "", prixUnitaire: "" }]
  );
  const [produitSearch, setProduitSearch] = useState("");
  const [ligneEnRecherche, setLigneEnRecherche] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: fournisseursData } = useApi<{ data: FournisseurRef[] }>("/api/logistique/fournisseurs?actif=true");
  const { data: pdvData } = useApi<{ data: PdvRef[] }>("/api/admin/pdv?limit=200");
  const { data: produitsData } = useApi<{ data: ProduitRef[] }>(
    produitSearch.length >= 2 ? `/api/logistique/produits?search=${encodeURIComponent(produitSearch)}&limit=10` : null
  );

  const fournisseurs = fournisseursData?.data ?? [];
  const pdvs = pdvData?.data ?? [];

  const updateLigne = (idx: number, patch: Partial<LigneForm>) => {
    setLignes((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };
  const addLigne = () => setLignes((prev) => [...prev, { produitId: null, produitNom: "", quantite: "", prixUnitaire: "" }]);
  const removeLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  const total = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0);

  const handleSubmit = async () => {
    if (!fournisseurId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (!pointDeVenteId) { toast.error("Sélectionnez un site de livraison"); return; }
    const lignesValides = lignes.filter((l) => l.produitId && Number(l.quantite) > 0 && Number(l.prixUnitaire) >= 0);
    if (lignesValides.length === 0) { toast.error("Ajoutez au moins une ligne valide"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/logistique/bons-commande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseurId: Number(fournisseurId), pointDeVenteId: Number(pointDeVenteId),
          dateLivraisonPrevue: dateLivraisonPrevue || undefined, notes: notes || undefined,
          demandeCotationId: prefill.demandeCotationId || undefined,
          lignes: lignesValides.map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Bon de commande créé"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau bon de commande</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur *">
              <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">— Sélectionner —</option>
                {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </Field>
            <Field label="Site de livraison *">
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">— Sélectionner —</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
            </Field>
          </div>
          <Field label="Date de livraison prévue"><input type="date" value={dateLivraisonPrevue} onChange={(e) => setDateLivraisonPrevue(e.target.value)} className={inputCls} /></Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-xs font-medium text-slate-600">Lignes de commande *</span>
              <button onClick={addLigne} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"><Plus className="w-3.5 h-3.5" /> Ajouter une ligne</button>
            </div>
            <div className="space-y-2">
              {lignes.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    {l.produitId ? (
                      <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                        <span className="truncate">{l.produitNom}</span>
                        <button onClick={() => updateLigne(idx, { produitId: null, produitNom: "" })} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <input placeholder="Rechercher un produit…" onFocus={() => setLigneEnRecherche(idx)}
                          onChange={(e) => { setProduitSearch(e.target.value); setLigneEnRecherche(idx); }} className={inputCls} />
                        {ligneEnRecherche === idx && produitsData?.data && produitsData.data.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {produitsData.data.map((p) => (
                              <button key={p.id} onClick={() => { updateLigne(idx, { produitId: p.id, produitNom: p.nom }); setLigneEnRecherche(null); setProduitSearch(""); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <input type="number" min="1" placeholder="Qté" value={l.quantite} onChange={(e) => updateLigne(idx, { quantite: e.target.value })} className={`${inputCls} w-20`} />
                  <input type="number" min="0" placeholder="P.U." value={l.prixUnitaire} onChange={(e) => updateLigne(idx, { prixUnitaire: e.target.value })} className={`${inputCls} w-28`} />
                  {lignes.length > 1 && (
                    <button onClick={() => removeLigne(idx)} className="text-slate-300 hover:text-red-400 flex-shrink-0"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-semibold text-slate-700 mt-2">Total : {total.toLocaleString("fr-FR")} FCFA</p>
          </div>

          <Field label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-y`} /></Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer en brouillon
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail / workflow ────────────────────────────────────────────────────────────

function DetailModal({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: BonCommande }>(`/api/logistique/bons-commande/${id}`);
  const [busy, setBusy] = useState(false);
  const [montantPaiement, setMontantPaiement] = useState("");
  const b = data?.data;

  const enregistrerPaiement = async () => {
    const montant = Number(montantPaiement);
    if (!montant || montant <= 0) { toast.error("Montant invalide"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/bons-commande/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ENREGISTRER_PAIEMENT", montant }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Paiement enregistré"); setMontantPaiement(""); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const doAction = async (action: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/bons-commande/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const envoyer = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/bons-commande/${id}/envoyer`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success(j.emailEnvoye ? "Bon envoyé par email au fournisseur" : "Bon marqué envoyé (pas d'email fournisseur)"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const majLivraison = async (statutLivraison: string) => {
    const r = await fetch(`/api/logistique/bons-commande/${id}/livraison`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statutLivraison,
        lignes: statutLivraison === "RECEPTIONNEE" ? b?.lignes.map((l) => ({ ligneId: l.id, quantiteRecue: l.quantite })) : undefined,
      }),
    });
    if (r.ok) { toast.success("Suivi livraison mis à jour"); refetch(); onUpdated(); }
    else toast.error("Erreur");
  };

  const etapeLivraisonIdx = b?.statutLivraison ? LIVRAISON_ETAPES.findIndex((e) => e.key === b.statutLivraison) : -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{b?.reference ?? "Chargement…"}</h2>
            {b && <p className="text-xs text-slate-400">{b.fournisseur.nom} · {b.pointDeVente.nom}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {b && (
              <a href={`/api/logistique/bons-commande/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {loading || !b ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[b.statut] ?? STATUT_CFG.DRAFT).badge}`}>{(STATUT_CFG[b.statut] ?? STATUT_CFG.DRAFT).label}</span>
                {b.demandeCotation && <span className="text-xs text-slate-400">Issu de {b.demandeCotation.reference}</span>}
                {b.signePar && <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><PenTool className="w-3 h-3" /> Signé par {b.signePar.prenom} {b.signePar.nom}</span>}
              </div>

              {/* Lignes */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Produit</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">Qté</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">P.U.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {b.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2">{l.produit.nom}</td>
                        <td className="text-center px-3 py-2">{l.quantite}{l.quantiteRecue > 0 ? ` (reçu ${l.quantiteRecue})` : ""}</td>
                        <td className="text-right px-3 py-2">{Number(l.prixUnitaire).toLocaleString("fr-FR")}</td>
                        <td className="text-right px-3 py-2 font-medium">{(l.quantite * Number(l.prixUnitaire)).toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-sm font-bold text-slate-800">Total : {Number(b.montantTotal).toLocaleString("fr-FR")} {b.devise}</p>

              {/* Paiement fournisseur (CDC §14 — factures à payer) */}
              {!["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(b.statut) && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Paiement fournisseur</p>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-500">Payé : <b className="text-slate-800">{Number(b.montantPaye).toLocaleString("fr-FR")}</b> / {Number(b.montantTotal).toLocaleString("fr-FR")} {b.devise}</span>
                    {Number(b.montantTotal) - Number(b.montantPaye) > 0.01 ? (
                      <span className="text-amber-600 font-medium">Solde dû : {(Number(b.montantTotal) - Number(b.montantPaye)).toLocaleString("fr-FR")}</span>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Soldé</span>
                    )}
                  </div>
                  {Number(b.montantTotal) - Number(b.montantPaye) > 0.01 && (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" placeholder="Montant à enregistrer" value={montantPaiement}
                        onChange={(e) => setMontantPaiement(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <button onClick={enregistrerPaiement} disabled={busy}
                        className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap">
                        Enregistrer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Suivi livraison */}
              {["SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED", "COMPLETED"].includes(b.statut) && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Suivi livraison</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {LIVRAISON_ETAPES.map((e, i) => (
                      <button key={e.key} onClick={() => majLivraison(e.key)} disabled={b.statut === "COMPLETED"}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:cursor-default ${
                          i <= etapeLivraisonIdx ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {b.notes && <p className="text-sm text-slate-500 italic border-t border-slate-100 pt-3">{b.notes}</p>}

              {/* Importation (achat international) */}
              <div className="pt-3 border-t border-slate-100">
                <ImportationSection bonId={b.id} />
              </div>
            </>
          )}
        </div>

        {/* Actions workflow */}
        {b && (
          <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-slate-200">
            {b.statut === "DRAFT" && (
              <>
                <button onClick={() => doAction("ANNULER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"><Ban className="w-4 h-4" /> Annuler</button>
                <button onClick={() => doAction("SOUMETTRE")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Send className="w-4 h-4" /> Soumettre pour approbation</button>
              </>
            )}
            {b.statut === "PENDING_APPROVAL" && (
              <>
                <button onClick={() => doAction("REJETER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"><XCircle className="w-4 h-4" /> Rejeter</button>
                <button onClick={() => doAction("APPROUVER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><CheckCircle className="w-4 h-4" /> Approuver</button>
              </>
            )}
            {b.statut === "APPROVED" && (
              <>
                {!b.signePar && (
                  <button onClick={() => doAction("SIGNER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"><PenTool className="w-4 h-4" /> Signer</button>
                )}
                <button onClick={envoyer} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Send className="w-4 h-4" /> Envoyer au fournisseur</button>
              </>
            )}
            {b.statut === "SENT" && (
              <button onClick={() => doAction("ACCUSER_RECEPTION")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"><CheckCircle className="w-4 h-4" /> Accuser réception fournisseur</button>
            )}
            {!["COMPLETED", "CANCELLED", "DRAFT", "PENDING_APPROVAL"].includes(b.statut) && (
              <button onClick={() => doAction("ANNULER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"><Ban className="w-4 h-4" /> Annuler</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Importation (achat international, CDC §9) ──────────────────────────────────

interface EvenementImportation {
  id: number; date: string; statut: string | null; lieu: string | null; commentaire: string | null;
  creePar: { nom: string; prenom: string };
}
interface ImportationData {
  id: number; paysOrigine: string | null; portDepart: string | null; portArrivee: string | null;
  numeroConteneur: string | null; incoterm: string | null;
  transitaire: { id: number; nom: string } | null; transitaireNom: string | null;
  referenceDouane: string | null; dateDedouanement: string | null;
  assurancePolice: string | null; assuranceMontant: number | string | null;
  dateETD: string | null; dateETA: string | null; dateArriveeReelle: string | null;
  notes: string | null;
  evenements: EvenementImportation[];
}

const IMPORT_FIELDS_EMPTY = {
  paysOrigine: "", portDepart: "", portArrivee: "", numeroConteneur: "", incoterm: "",
  transitaireNom: "", referenceDouane: "", assurancePolice: "", assuranceMontant: "",
  dateETD: "", dateETA: "", notes: "",
};

function ImportationSection({ bonId }: { bonId: number }) {
  const { data, loading, refetch } = useApi<{ data: ImportationData | null }>(`/api/logistique/bons-commande/${bonId}/importation`);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(IMPORT_FIELDS_EMPTY);
  const [saving, setSaving] = useState(false);
  const [showEvent, setShowEvent] = useState(false);

  const imp = data?.data ?? null;

  const startEdit = () => {
    if (imp) {
      setForm({
        paysOrigine: imp.paysOrigine ?? "", portDepart: imp.portDepart ?? "", portArrivee: imp.portArrivee ?? "",
        numeroConteneur: imp.numeroConteneur ?? "", incoterm: imp.incoterm ?? "",
        transitaireNom: imp.transitaire?.nom ?? imp.transitaireNom ?? "",
        referenceDouane: imp.referenceDouane ?? "", assurancePolice: imp.assurancePolice ?? "",
        assuranceMontant: imp.assuranceMontant != null ? String(imp.assuranceMontant) : "",
        dateETD: imp.dateETD ? imp.dateETD.slice(0, 10) : "", dateETA: imp.dateETA ? imp.dateETA.slice(0, 10) : "",
        notes: imp.notes ?? "",
      });
    }
    setEditMode(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/bons-commande/${bonId}/importation`, {
        method: imp ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) { toast.success(imp ? "Suivi import mis à jour" : "Suivi import créé"); setEditMode(false); refetch(); }
      else toast.error("Erreur");
    } finally { setSaving(false); }
  };

  if (loading) return null;

  if (!imp && !editMode) {
    return (
      <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
        <Plus className="w-3.5 h-3.5" /> Renseigner un suivi import (achat international)
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Suivi import</p>
        {!editMode && <button onClick={startEdit} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Modifier</button>}
      </div>

      {editMode ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Pays d'origine"><input value={form.paysOrigine} onChange={(e) => setForm((f) => ({ ...f, paysOrigine: e.target.value }))} className={inputCls} /></Field>
            <Field label="Port de départ"><input value={form.portDepart} onChange={(e) => setForm((f) => ({ ...f, portDepart: e.target.value }))} className={inputCls} /></Field>
            <Field label="Port d'arrivée"><input value={form.portArrivee} onChange={(e) => setForm((f) => ({ ...f, portArrivee: e.target.value }))} className={inputCls} /></Field>
            <Field label="N° conteneur"><input value={form.numeroConteneur} onChange={(e) => setForm((f) => ({ ...f, numeroConteneur: e.target.value }))} className={inputCls} /></Field>
            <Field label="Incoterm"><input value={form.incoterm} onChange={(e) => setForm((f) => ({ ...f, incoterm: e.target.value }))} placeholder="FOB, CIF, DDP…" className={inputCls} /></Field>
            <Field label="Transitaire"><input value={form.transitaireNom} onChange={(e) => setForm((f) => ({ ...f, transitaireNom: e.target.value }))} className={inputCls} /></Field>
            <Field label="Réf. douane"><input value={form.referenceDouane} onChange={(e) => setForm((f) => ({ ...f, referenceDouane: e.target.value }))} className={inputCls} /></Field>
            <Field label="N° police d'assurance"><input value={form.assurancePolice} onChange={(e) => setForm((f) => ({ ...f, assurancePolice: e.target.value }))} className={inputCls} /></Field>
            <Field label="Montant assuré"><input type="number" value={form.assuranceMontant} onChange={(e) => setForm((f) => ({ ...f, assuranceMontant: e.target.value }))} className={inputCls} /></Field>
            <Field label="Date ETD"><input type="date" value={form.dateETD} onChange={(e) => setForm((f) => ({ ...f, dateETD: e.target.value }))} className={inputCls} /></Field>
            <Field label="Date ETA"><input type="date" value={form.dateETA} onChange={(e) => setForm((f) => ({ ...f, dateETA: e.target.value }))} className={inputCls} /></Field>
          </div>
          <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={`${inputCls} resize-y`} /></Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
            </button>
          </div>
        </div>
      ) : imp && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-600 mb-3">
            {imp.paysOrigine && <p><span className="text-slate-400">Origine :</span> {imp.paysOrigine}</p>}
            {imp.portDepart && <p><span className="text-slate-400">Départ :</span> {imp.portDepart}</p>}
            {imp.portArrivee && <p><span className="text-slate-400">Arrivée :</span> {imp.portArrivee}</p>}
            {imp.numeroConteneur && <p><span className="text-slate-400">Conteneur :</span> {imp.numeroConteneur}</p>}
            {imp.incoterm && <p><span className="text-slate-400">Incoterm :</span> {imp.incoterm}</p>}
            {(imp.transitaire?.nom || imp.transitaireNom) && <p><span className="text-slate-400">Transitaire :</span> {imp.transitaire?.nom ?? imp.transitaireNom}</p>}
            {imp.referenceDouane && <p><span className="text-slate-400">Réf. douane :</span> {imp.referenceDouane}</p>}
            {imp.dateETD && <p><span className="text-slate-400">ETD :</span> {formatDate(imp.dateETD)}</p>}
            {imp.dateETA && <p><span className="text-slate-400">ETA :</span> {formatDate(imp.dateETA)}</p>}
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Suivi (checkpoints)</p>
            <button onClick={() => setShowEvent(true)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"><Plus className="w-3 h-3" /> Ajouter</button>
          </div>
          {imp.evenements.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun événement enregistré</p>
          ) : (
            <div className="space-y-1.5">
              {imp.evenements.map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-xs">
                  <span className="text-slate-400 flex-shrink-0 w-24">{formatDate(e.date)}</span>
                  <div className="flex-1">
                    <span className="text-slate-700">
                      {e.statut && <span className="font-medium">{LIVRAISON_ETAPES.find((s) => s.key === e.statut)?.label ?? e.statut} — </span>}
                      {e.lieu && `${e.lieu} — `}{e.commentaire}
                    </span>
                    <span className="text-slate-400"> ({e.creePar.prenom} {e.creePar.nom})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showEvent && imp && <EvenementModal bonId={bonId} onClose={() => setShowEvent(false)} onSaved={() => { setShowEvent(false); refetch(); }} />}
    </div>
  );
}

function EvenementModal({ bonId, onClose, onSaved }: { bonId: number; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statut, setStatut] = useState("");
  const [lieu, setLieu] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/bons-commande/${bonId}/importation/evenements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, statut: statut || undefined, lieu: lieu || undefined, commentaire: commentaire || undefined }),
      });
      if (r.ok) { toast.success("Checkpoint ajouté"); onSaved(); }
      else toast.error("Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau checkpoint</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          <Field label="Étape (facultatif)">
            <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">— Aucune —</option>
              {LIVRAISON_ETAPES.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Lieu"><input value={lieu} onChange={(e) => setLieu(e.target.value)} className={inputCls} /></Field>
          <Field label="Commentaire"><textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className={`${inputCls} resize-y`} /></Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

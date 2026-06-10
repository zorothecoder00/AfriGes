"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Package, Plus, CheckCircle, Clock, XCircle,
  RefreshCw, AlertTriangle, User, Layers, Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatutLigne = "EN_ATTENTE" | "CONFIRME" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE";

interface ProduitCatalogue {
  id: number;
  nom: string;
  unite?: string | null;
  prixUnitaire: string;
  reference?: string | null;
}

interface Ligne {
  id: number;
  produitNomSaisi: string;
  quantite: number;
  quantiteParCycle?: number | null;
  prixEstime?: string | null;
  categorieSaisie?: string | null;
  uniteSaisie?: string | null;
  statut: StatutLigne;
  estNouveauProduit: boolean;
  notes?: string | null;
  createdAt: string;
  produit?: ProduitCatalogue | null;
  produitSubstitut?: ProduitCatalogue | null;
  traitePar?: { nom: string; prenom: string } | null;
  pointDeVente?: { nom: string; code: string } | null;
}

interface SouscriptionInfo {
  id: number;
  pack: { id: number; nom: string; type: string };
  client?: { id: number; nom: string; prenom: string; telephone?: string; pointDeVenteId?: number | null } | null;
}

interface LignesResponse {
  souscription: SouscriptionInfo;
  lignes: Ligne[];
  stats: { total: number; enAttente: number; confirmes: number; indisponibles: number; substitues: number };
}

// ─── Statut config ────────────────────────────────────────────────────────────

const STATUT_CFG: Record<StatutLigne, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  EN_ATTENTE:    { label: "En attente",    bg: "bg-amber-100",   text: "text-amber-700",   icon: <Clock size={12} /> },
  CONFIRME:      { label: "Confirmé",      bg: "bg-emerald-100", text: "text-emerald-700", icon: <CheckCircle size={12} /> },
  INDISPONIBLE:  { label: "Indisponible",  bg: "bg-red-100",     text: "text-red-700",     icon: <XCircle size={12} /> },
  SUBSTITUE:     { label: "Substitué",     bg: "bg-blue-100",    text: "text-blue-700",    icon: <RefreshCw size={12} /> },
  ANNULE:        { label: "Annulé",        bg: "bg-slate-100",   text: "text-slate-500",   icon: <XCircle size={12} /> },
};

// ─── Formulaire d'ajout ───────────────────────────────────────────────────────

interface LigneFormState {
  estNouveauProduit: boolean;
  produitId: number | null;
  produitNomSaisi: string;
  quantite: string;
  quantiteParCycle: string;
  prixEstime: string;
  categorieSaisie: string;
  uniteSaisie: string;
}

const FORM_INITIAL: LigneFormState = {
  estNouveauProduit: false,
  produitId: null,
  produitNomSaisi: "",
  quantite: "",
  quantiteParCycle: "",
  prixEstime: "",
  categorieSaisie: "",
  uniteSaisie: "",
};

function AddLigneForm({
  souscriptionId,
  pdvId,
  onAdded,
}: {
  souscriptionId: string;
  pdvId?: number | null;
  onAdded: () => void;
}) {
  const [lignes, setLignes] = useState<LigneFormState[]>([{ ...FORM_INITIAL }]);
  const [submitting, setSubmitting] = useState(false);

  const stockUrl = pdvId
    ? `/api/admin/stock?pdvId=${pdvId}&limit=300`
    : `/api/logistique/produits?limit=300`;
  const { data: catalogData } = useApi<{ data: ProduitCatalogue[] }>(stockUrl);

  const catalogue: ProduitCatalogue[] = (catalogData?.data ?? []).map((item: ProduitCatalogue & { produit?: ProduitCatalogue }) => {
    if (item.produit) return item.produit;
    return item;
  }).filter(p => p.id && p.nom);

  const updateField = (idx: number, field: keyof LigneFormState, value: string | boolean | number | null) => {
    setLignes(l => l.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const l of lignes) {
      if (!l.produitNomSaisi.trim()) { toast.error("Renseignez le nom du produit pour chaque ligne"); return; }
      if (!l.quantite || Number(l.quantite) <= 0) { toast.error(`Quantité invalide pour "${l.produitNomSaisi}"`); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agentTerrain/souscriptions/${souscriptionId}/lignes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lignes: lignes.map(l => ({
            produitId:        l.produitId ?? undefined,
            produitNomSaisi:  l.produitNomSaisi.trim(),
            quantite:         Number(l.quantite),
            quantiteParCycle: l.quantiteParCycle ? Number(l.quantiteParCycle) : undefined,
            prixEstime:       l.prixEstime ? Number(l.prixEstime) : undefined,
            categorieSaisie:  l.categorieSaisie.trim() || undefined,
            uniteSaisie:      l.uniteSaisie.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Erreur"); return; }
      toast.success(`${lignes.length} ligne(s) ajoutée(s)`);
      setLignes([{ ...FORM_INITIAL }]);
      onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Plus size={16} className="text-emerald-600" />
          Ajouter des produits souhaités
        </h3>
        <button type="button"
          onClick={() => setLignes(l => [...l, { ...FORM_INITIAL }])}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
          <Plus size={14} /> Ajouter une ligne
        </button>
      </div>

      <div className="space-y-3">
        {lignes.map((ligne, idx) => (
          <div key={idx} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                <button type="button"
                  onClick={() => { updateField(idx, "estNouveauProduit", false); updateField(idx, "produitId", null); updateField(idx, "produitNomSaisi", ""); }}
                  className={`px-3 py-1.5 transition-colors ${!ligne.estNouveauProduit ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  Du catalogue
                </button>
                <button type="button"
                  onClick={() => { updateField(idx, "estNouveauProduit", true); updateField(idx, "produitId", null); updateField(idx, "produitNomSaisi", ""); }}
                  className={`px-3 py-1.5 transition-colors ${ligne.estNouveauProduit ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  Hors catalogue
                </button>
              </div>
              {lignes.length > 1 && (
                <button type="button"
                  onClick={() => setLignes(l => l.filter((_, i) => i !== idx))}
                  className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {ligne.estNouveauProduit ? "Nom du produit" : "Produit du catalogue"}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                {ligne.estNouveauProduit ? (
                  <input type="text" value={ligne.produitNomSaisi}
                    onChange={e => updateField(idx, "produitNomSaisi", e.target.value)}
                    placeholder="Ex: Huile de palme 5L, Riz long grain…"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none bg-amber-50/30" />
                ) : (
                  <select value={ligne.produitId ?? ""}
                    onChange={e => {
                      const p = catalogue.find(x => x.id === parseInt(e.target.value));
                      if (p) { updateField(idx, "produitId", p.id); updateField(idx, "produitNomSaisi", p.nom); updateField(idx, "uniteSaisie", p.unite ?? ""); }
                      else   { updateField(idx, "produitId", null); updateField(idx, "produitNomSaisi", ""); }
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none bg-white">
                    <option value="">— Choisir un produit —</option>
                    {catalogue.map(p => (
                      <option key={p.id} value={p.id}>{p.nom}{p.unite ? ` (${p.unite})` : ""}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantité <span className="text-red-500">*</span></label>
                <input type="number" min="1" value={ligne.quantite}
                  onChange={e => updateField(idx, "quantite", e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prix estimé (FCFA)</label>
                <input type="number" min="0" value={ligne.prixEstime}
                  onChange={e => updateField(idx, "prixEstime", e.target.value)}
                  placeholder="optionnel"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={submitting}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50">
          {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
          Enregistrer {lignes.length > 1 ? `${lignes.length} lignes` : "la ligne"}
        </button>
      </div>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function LignesSouscriptionPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, loading, refetch } = useApi<LignesResponse>(
    `/api/agentTerrain/souscriptions/${id}/lignes`
  );

  const souscription = data?.souscription;
  const lignes       = data?.lignes ?? [];
  const stats        = data?.stats;

  const clientNom = souscription?.client
    ? `${souscription.client.prenom} ${souscription.client.nom}`
    : "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/10 font-['DM_Sans',sans-serif] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/dashboard/admin/packs"
            className="p-2 hover:bg-white rounded-xl transition-colors mt-0.5 border border-transparent hover:border-slate-200">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">Produits souhaités</h1>
            {souscription && (
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Layers size={13} /> {souscription.pack.nom}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <User size={13} /> {clientNom}
                </span>
              </div>
            )}
          </div>
          {/* Stats rapides */}
          {stats && stats.total > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {stats.enAttente > 0 && (
                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <Clock size={12} /> {stats.enAttente} en attente
                </span>
              )}
              {stats.confirmes > 0 && (
                <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <CheckCircle size={12} /> {stats.confirmes} confirmés
                </span>
              )}
              {stats.indisponibles > 0 && (
                <span className="flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <XCircle size={12} /> {stats.indisponibles} indisponibles
                </span>
              )}
            </div>
          )}
        </div>

        {/* Formulaire d'ajout */}
        <AddLigneForm souscriptionId={id} pdvId={souscription?.client?.pointDeVenteId} onAdded={refetch} />

        {/* Liste des lignes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Package size={16} className="text-slate-400" />
              Lignes enregistrées
              {stats && <span className="text-slate-400 font-normal text-sm">({stats.total})</span>}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lignes.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune ligne — ajoutez les produits souhaités ci-dessus</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lignes.map(ligne => {
                const cfg = STATUT_CFG[ligne.statut];
                const nomAffiche = ligne.produit?.nom ?? ligne.produitNomSaisi;
                return (
                  <div key={ligne.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/60 transition-colors">
                    {/* Icône */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ligne.estNouveauProduit && !ligne.produit ? "bg-amber-100" : "bg-emerald-100"}`}>
                      <Package size={15} className={ligne.estNouveauProduit && !ligne.produit ? "text-amber-600" : "text-emerald-600"} />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{nomAffiche}</span>
                        {ligne.produit && ligne.produitNomSaisi !== ligne.produit.nom && (
                          <span className="text-xs text-slate-400">({ligne.produitNomSaisi})</span>
                        )}
                        {ligne.estNouveauProduit && !ligne.produit && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            Nouveau produit
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                        <span className="font-mono font-medium text-slate-700">
                          {ligne.quantite} {ligne.produit?.unite ?? ligne.uniteSaisie ?? ""}
                        </span>
                        {ligne.quantiteParCycle && (
                          <span className="text-xs">/ cycle : {ligne.quantiteParCycle}</span>
                        )}
                        {ligne.prixEstime && (
                          <span className="text-xs">{formatCurrency(Number(ligne.prixEstime))}</span>
                        )}
                        {ligne.categorieSaisie && (
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{ligne.categorieSaisie}</span>
                        )}
                      </div>

                      {/* Substitut */}
                      {ligne.statut === "SUBSTITUE" && ligne.produitSubstitut && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <RefreshCw size={11} /> Remplacé par : <strong>{ligne.produitSubstitut.nom}</strong>
                        </p>
                      )}

                      {/* Notes */}
                      {ligne.notes && (
                        <p className="text-xs text-slate-400 mt-1 italic">{ligne.notes}</p>
                      )}

                      {/* Traité par */}
                      {ligne.traitePar && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Traité par {ligne.traitePar.prenom} {ligne.traitePar.nom}
                        </p>
                      )}
                    </div>

                    {/* Statut badge */}
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border shrink-0 ${cfg.bg} ${cfg.text} border-current/20`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lien vers tableau de traitement admin */}
        <div className="text-center">
          <Link href="/dashboard/admin/souscriptions/lignes"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors">
            <AlertTriangle size={14} />
            Voir le tableau de traitement admin →
          </Link>
        </div>

      </div>
    </div>
  );
}

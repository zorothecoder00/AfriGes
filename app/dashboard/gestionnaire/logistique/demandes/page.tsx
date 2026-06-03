"use client";

import React, { useState, useCallback } from "react";
import {
  Package, Clock, CheckCircle, XCircle, RefreshCw, Search, Store,
  User, ChevronLeft, ChevronRight, ArrowLeft, Plus, Layers, Sparkles,
} from "lucide-react";
import Link from "next/link";
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
  pointDeVente?: { id: number; nom: string; code: string } | null;
  souscription: {
    id: number;
    pack: { id: number; nom: string; type: string };
    client?: { id: number; nom: string; prenom: string; telephone?: string } | null;
  };
}

interface LignesResponse {
  lignes: Ligne[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { countEnAttente: number; countNouveauxProduits: number };
}

interface PDVOption {
  id: number;
  nom: string;
  code: string;
}

// ─── Config statuts ───────────────────────────────────────────────────────────

const STATUT_TABS: { value: string; label: string }[] = [
  { value: "EN_ATTENTE",   label: "À traiter" },
  { value: "CONFIRME",     label: "Confirmés" },
  { value: "INDISPONIBLE", label: "Indisponibles" },
  { value: "SUBSTITUE",    label: "Substitués" },
  { value: "TOUS",         label: "Tous" },
];

const STATUT_CFG: Record<StatutLigne, { bg: string; text: string; icon: React.ReactNode }> = {
  EN_ATTENTE:   { bg: "bg-amber-100",   text: "text-amber-700",   icon: <Clock size={11} /> },
  CONFIRME:     { bg: "bg-emerald-100", text: "text-emerald-700", icon: <CheckCircle size={11} /> },
  INDISPONIBLE: { bg: "bg-red-100",     text: "text-red-700",     icon: <XCircle size={11} /> },
  SUBSTITUE:    { bg: "bg-blue-100",    text: "text-blue-700",    icon: <RefreshCw size={11} /> },
  ANNULE:       { bg: "bg-slate-100",   text: "text-slate-500",   icon: <XCircle size={11} /> },
};

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        {children}
      </div>
    </div>
  );
}

// ─── Modal Indisponible ───────────────────────────────────────────────────────

function ModalIndisponible({ ligne, onClose, onDone }: { ligne: Ligne; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!notes.trim()) { toast.error("Le motif est obligatoire"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/souscriptions/lignes/${ligne.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "INDISPONIBLE", notes }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Erreur"); return; }
      toast.success("Ligne marquée indisponible");
      onDone();
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-800 mb-1">Marquer indisponible</h3>
      <p className="text-sm text-slate-500 mb-4">
        Produit : <strong className="text-slate-700">{ligne.produitNomSaisi}</strong>
      </p>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Motif <span className="text-red-500">*</span>
      </label>
      <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Ex : Ce produit n'est pas disponible dans ce pack…"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 outline-none resize-none"
      />
      <div className="flex gap-3 mt-5 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
        <button onClick={submit} disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />}
          Confirmer
        </button>
      </div>
    </Overlay>
  );
}

// ─── Modal Confirmer ──────────────────────────────────────────────────────────

function ModalConfirmer({ ligne, onClose, onDone }: { ligne: Ligne; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState(ligne.produitNomSaisi);
  const [results, setResults] = useState<ProduitCatalogue[]>([]);
  const [selected, setSelected] = useState<ProduitCatalogue | null>(ligne.produit ?? null);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchProduit = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    const res = await fetch(`/api/logistique/produits?search=${encodeURIComponent(q)}&limit=10`);
    const d = await res.json();
    setResults(d.data ?? []);
    setShowDrop(true);
  }, []);

  const submit = async () => {
    if (!selected) { toast.error("Sélectionnez un produit du catalogue"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/souscriptions/lignes/${ligne.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "CONFIRME", produitId: selected.id }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Erreur"); return; }
      toast.success("Ligne confirmée");
      onDone();
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-800 mb-1">Confirmer la demande</h3>
      <p className="text-sm text-slate-500 mb-4">
        Demande : <strong className="text-slate-700">{ligne.produitNomSaisi}</strong>
      </p>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Produit catalogue correspondant <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); searchProduit(e.target.value); }}
          placeholder="Chercher dans le catalogue…"
          className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
        />
        {showDrop && results.length > 0 && (
          <ul className="absolute z-30 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-auto">
            {results.map(p => (
              <li key={p.id}>
                <button type="button" onMouseDown={() => { setSelected(p); setSearch(p.nom); setShowDrop(false); }}
                  className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors flex justify-between">
                  <span className="font-medium text-slate-800 text-sm">{p.nom}</span>
                  <span className="text-xs text-slate-400">{p.unite ?? ""} · {formatCurrency(Number(p.prixUnitaire))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
          <CheckCircle size={11} /> {selected.nom} sélectionné
        </p>
      )}
      <div className="flex gap-3 mt-5 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
        <button onClick={submit} disabled={loading || !selected}
          className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          Confirmer
        </button>
      </div>
    </Overlay>
  );
}

// ─── Modal Substituer ─────────────────────────────────────────────────────────

function ModalSubstituer({ ligne, onClose, onDone }: { ligne: Ligne; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProduitCatalogue[]>([]);
  const [selected, setSelected] = useState<ProduitCatalogue | null>(null);
  const [notes, setNotes] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchProduit = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    const res = await fetch(`/api/logistique/produits?search=${encodeURIComponent(q)}&limit=10`);
    const d = await res.json();
    setResults(d.data ?? []);
    setShowDrop(true);
  }, []);

  const submit = async () => {
    if (!selected) { toast.error("Sélectionnez un produit de substitution"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/souscriptions/lignes/${ligne.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "SUBSTITUE", produitSubstitutId: selected.id, notes: notes || undefined }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Erreur"); return; }
      toast.success("Ligne substituée");
      onDone();
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-800 mb-1">Substituer le produit</h3>
      <p className="text-sm text-slate-500 mb-4">
        Remplacer : <strong className="text-slate-700">{ligne.produitNomSaisi}</strong>
      </p>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Produit de substitution <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); searchProduit(e.target.value); }}
          placeholder="Chercher le produit de remplacement…"
          className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
        />
        {showDrop && results.length > 0 && (
          <ul className="absolute z-30 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-auto">
            {results.map(p => (
              <li key={p.id}>
                <button type="button" onMouseDown={() => { setSelected(p); setSearch(p.nom); setShowDrop(false); }}
                  className="w-full px-3 py-2.5 text-left hover:bg-blue-50 flex justify-between">
                  <span className="font-medium text-slate-800 text-sm">{p.nom}</span>
                  <span className="text-xs text-slate-400">{p.unite ?? ""} · {formatCurrency(Number(p.prixUnitaire))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><CheckCircle size={11} /> {selected.nom}</p>}
      <label className="block text-sm font-medium text-slate-700 mt-4 mb-1.5">Remarque (optionnel)</label>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Ex : Rupture de stock, remplacé par équivalent…"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
      />
      <div className="flex gap-3 mt-5 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
        <button onClick={submit} disabled={loading || !selected}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Substituer
        </button>
      </div>
    </Overlay>
  );
}

// ─── Modal Créer produit ──────────────────────────────────────────────────────

function ModalCreerProduit({ ligne, onClose, onDone }: { ligne: Ligne; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    nom: ligne.produitNomSaisi,
    prixUnitaire: "",
    unite: ligne.uniteSaisie ?? "",
    categorie: ligne.categorieSaisie ?? "",
    prixAchat: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.nom.trim()) { toast.error("Nom obligatoire"); return; }
    if (!form.prixUnitaire || Number(form.prixUnitaire) <= 0) { toast.error("Prix de vente obligatoire"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/souscriptions/lignes/${ligne.id}/creer-produit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom:          form.nom.trim(),
          prixUnitaire: Number(form.prixUnitaire),
          unite:        form.unite.trim() || undefined,
          categorie:    form.categorie.trim() || undefined,
          prixAchat:    form.prixAchat ? Number(form.prixAchat) : undefined,
          description:  form.description.trim() || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Erreur"); return; }
      toast.success("Produit créé et ligne confirmée");
      onDone();
    } finally { setLoading(false); }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }));

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
        <Sparkles size={16} className="text-amber-500" /> Créer le produit
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Demande : <strong className="text-slate-700">{ligne.produitNomSaisi}</strong> — le produit sera ajouté au catalogue et la ligne confirmée.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Nom <span className="text-red-500">*</span></label>
          <input type="text" value={form.nom} onChange={f("nom")}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Prix de vente (FCFA) <span className="text-red-500">*</span></label>
          <input type="number" min="0" value={form.prixUnitaire} onChange={f("prixUnitaire")}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Prix d&apos;achat (FCFA)</label>
          <input type="number" min="0" value={form.prixAchat} onChange={f("prixAchat")}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Unité</label>
          <input type="text" value={form.unite} onChange={f("unite")} placeholder="kg, litre…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Catégorie</label>
          <input type="text" value={form.categorie} onChange={f("categorie")}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
        </div>
      </div>
      <div className="flex gap-3 mt-5 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
        <button onClick={submit} disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Créer &amp; confirmer
        </button>
      </div>
    </Overlay>
  );
}

// ─── Ligne row ────────────────────────────────────────────────────────────────

function LigneRow({ ligne, onAction }: {
  ligne: Ligne;
  onAction: (type: "indispo" | "confirmer" | "substituer" | "creer", l: Ligne) => void;
}) {
  const cfg = STATUT_CFG[ligne.statut];
  const nomAffiche = ligne.produit?.nom ?? ligne.produitNomSaisi;
  const clientNom  = ligne.souscription.client
    ? `${ligne.souscription.client.prenom} ${ligne.souscription.client.nom}` : "—";

  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-start gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${ligne.estNouveauProduit && !ligne.produit ? "bg-amber-100" : "bg-emerald-100"}`}>
            <Package size={13} className={ligne.estNouveauProduit && !ligne.produit ? "text-amber-600" : "text-emerald-600"} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{nomAffiche}</p>
            {ligne.produit && ligne.produitNomSaisi !== ligne.produit.nom && (
              <p className="text-xs text-slate-400">Demandé : {ligne.produitNomSaisi}</p>
            )}
            {ligne.estNouveauProduit && !ligne.produit && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                Nouveau — à créer
              </span>
            )}
            {ligne.notes && <p className="text-xs text-slate-400 italic mt-0.5">{ligne.notes}</p>}
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-700">
          <User size={12} className="text-slate-400 shrink-0" /> {clientNom}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{ligne.souscription.pack.nom}</p>
      </td>
      <td className="px-5 py-4">
        {ligne.pointDeVente ? (
          <>
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <Store size={12} className="text-slate-400 shrink-0" /> {ligne.pointDeVente.nom}
            </div>
            <p className="text-xs text-slate-400 font-mono">{ligne.pointDeVente.code}</p>
          </>
        ) : <span className="text-slate-400 text-sm">—</span>}
      </td>
      <td className="px-5 py-4 text-right">
        <span className="font-mono font-semibold text-slate-800">{ligne.quantite}</span>
        <span className="text-xs text-slate-400 ml-1">{ligne.produit?.unite ?? ligne.uniteSaisie ?? ""}</span>
        {ligne.prixEstime && (
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(Number(ligne.prixEstime))}</p>
        )}
      </td>
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
          {cfg.icon} {ligne.statut.replace("_", " ")}
        </span>
        {ligne.statut === "SUBSTITUE" && ligne.produitSubstitut && (
          <p className="text-xs text-blue-600 mt-1">→ {ligne.produitSubstitut.nom}</p>
        )}
      </td>
      <td className="px-5 py-4">
        {ligne.statut === "EN_ATTENTE" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {!ligne.estNouveauProduit || ligne.produit ? (
              <button onClick={() => onAction("confirmer", ligne)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium transition-colors">
                <CheckCircle size={11} /> Confirmer
              </button>
            ) : (
              <button onClick={() => onAction("creer", ligne)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium transition-colors">
                <Sparkles size={11} /> Créer produit
              </button>
            )}
            <button onClick={() => onAction("substituer", ligne)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition-colors">
              <RefreshCw size={11} /> Substituer
            </button>
            <button onClick={() => onAction("indispo", ligne)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium transition-colors">
              <XCircle size={11} /> Indisponible
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function LogistiqueLignesPage() {
  const [filterStatut, setFilterStatut] = useState("EN_ATTENTE");
  const [filterPdvId,  setFilterPdvId]  = useState("");
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [modal, setModal] = useState<{ type: "indispo" | "confirmer" | "substituer" | "creer"; ligne: Ligne } | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20", statut: filterStatut });
  if (filterPdvId) params.set("pdvId", filterPdvId);
  if (search)      params.set("search", search);

  const { data, loading, refetch } = useApi<LignesResponse>(`/api/admin/souscriptions/lignes?${params}`);
  const { data: pdvsData } = useApi<{ pdvs: PDVOption[] }>("/api/logistique/previsions?statut=TOUS");

  const lignes     = data?.lignes ?? [];
  const pagination = data?.pagination;
  const stats      = data?.stats;

  const handleDone = () => { setModal(null); refetch(); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/10 font-['DM_Sans',sans-serif] p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/gestionnaire/logistique"
            className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">Demandes produits — Souscriptions</h1>
            <p className="text-sm text-slate-500">Traitement des produits demandés par les clients lors de leur souscription</p>
          </div>
          {stats && (
            <div className="flex items-center gap-2">
              {stats.countEnAttente > 0 && (
                <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-sm font-semibold">
                  <Clock size={14} /> {stats.countEnAttente} à traiter
                </span>
              )}
              {stats.countNouveauxProduits > 0 && (
                <span className="flex items-center gap-1.5 bg-orange-100 text-orange-700 border border-orange-200 px-4 py-2 rounded-xl text-sm font-semibold">
                  <Sparkles size={14} /> {stats.countNouveauxProduits} nouveaux produits
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {STATUT_TABS.map(tab => (
              <button key={tab.value}
                onClick={() => { setFilterStatut(tab.value); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  filterStatut === tab.value
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Chercher produit ou client…"
                className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 outline-none"
              />
            </div>
            <select value={filterPdvId} onChange={e => { setFilterPdvId(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-slate-300 outline-none bg-white min-w-[180px]">
              <option value="">Tous les PDVs</option>
              {(pdvsData?.pdvs ?? []).map(pdv => (
                <option key={pdv.id} value={String(pdv.id)}>{pdv.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lignes.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune demande</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 text-left">Produit demandé</th>
                      <th className="px-5 py-3 text-left">Client / Pack</th>
                      <th className="px-5 py-3 text-left">PDV</th>
                      <th className="px-5 py-3 text-right">Qté</th>
                      <th className="px-5 py-3 text-left">Statut</th>
                      <th className="px-5 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignes.map(l => (
                      <LigneRow key={l.id} ligne={l} onAction={(type, l) => setModal({ type, ligne: l })} />
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500">{pagination.total} résultat{pagination.total > 1 ? "s" : ""}</p>
                  <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-medium text-slate-700">{page} / {pagination.totalPages}</span>
                    <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                      className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lien vers prévisions */}
        <div className="text-center">
          <Link href="/dashboard/gestionnaire/logistique/previsions"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors">
            <Layers size={14} /> Voir les prévisions logistique →
          </Link>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === "indispo"    && <ModalIndisponible  ligne={modal.ligne} onClose={() => setModal(null)} onDone={handleDone} />}
      {modal?.type === "confirmer"  && <ModalConfirmer     ligne={modal.ligne} onClose={() => setModal(null)} onDone={handleDone} />}
      {modal?.type === "substituer" && <ModalSubstituer    ligne={modal.ligne} onClose={() => setModal(null)} onDone={handleDone} />}
      {modal?.type === "creer"      && <ModalCreerProduit  ligne={modal.ligne} onClose={() => setModal(null)} onDone={handleDone} />}
    </div>
  );
}

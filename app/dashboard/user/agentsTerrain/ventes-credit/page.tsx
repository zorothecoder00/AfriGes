"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  CreditCard, RefreshCw, AlertCircle, Loader2, Package,
  PackageCheck, Clock, CheckCircle, XCircle, Plus, Trash2,
  ChevronDown, ChevronUp, User, Calendar, TrendingDown,
  X, Search, ShoppingCart,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type StatutCredit = "EN_ATTENTE_VALIDATION" | "ACTIF" | "EN_RETARD" | "SOLDE" | "ANNULE";

interface LigneItem {
  id: number;
  produitNom: string | null;
  produitNomSaisi: string | null;
  quantite: number;
  prixUnitaire: number;
  statut: "EN_ATTENTE" | "LIVRE" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE";
  estNouveauProduit: boolean;
}

interface CreditItem {
  id: number;
  reference: string;
  statut: StatutCredit;
  montantTotal: number;
  montantRembourse: number;
  soldeRestant: number;
  montantJournalier: number;
  dateEcheanceFin: string | null;
  createdAt: string;
  client: { id: number; nom: string; prenom: string; telephone: string };
  lignes: LigneItem[];
}

interface CreditsResponse {
  credits: CreditItem[];
  stats: { total: number; enAttente: number; actifs: number; enRetard: number; clos: number };
}

interface ClientPortfolio {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  etat: string;
  limiteCredit: number | null;
  creditDisponible: number;
}

interface ProduitCatalogue {
  id: number;
  nom: string;
  reference: string | null;
  prixVente: number | null;
  unite: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<string, { bg: string; text: string; label: string; border: string }> = {
  EN_ATTENTE_VALIDATION: { bg: "bg-yellow-50",  text: "text-yellow-800", label: "En attente",  border: "border-yellow-200" },
  ACTIF:                 { bg: "bg-green-50",   text: "text-green-800",  label: "Actif",       border: "border-green-200"  },
  EN_RETARD:             { bg: "bg-red-50",     text: "text-red-800",    label: "En retard",   border: "border-red-200"    },
  SOLDE:                  { bg: "bg-gray-50",    text: "text-gray-600",   label: "Clôturé",     border: "border-gray-200"   },
  ANNULE:                { bg: "bg-gray-50",    text: "text-gray-500",   label: "Refusé",      border: "border-gray-100"   },
};

const LIGNE_CFG: Record<string, { label: string; color: string }> = {
  EN_ATTENTE:   { label: "À livrer",     color: "text-orange-600" },
  LIVRE:        { label: "Livré ✓",      color: "text-green-600"  },
  INDISPONIBLE: { label: "Indisponible", color: "text-gray-400"   },
  SUBSTITUE:    { label: "Substitué",    color: "text-blue-600"   },
  ANNULE:       { label: "Annulé",       color: "text-red-500"    },
};

type Filtre = "all" | StatutCredit;

const FILTRES: { id: Filtre; label: string }[] = [
  { id: "all",                   label: "Tous"       },
  { id: "EN_ATTENTE_VALIDATION", label: "En attente" },
  { id: "ACTIF",                 label: "Actifs"     },
  { id: "EN_RETARD",             label: "En retard"  },
  { id: "SOLDE",                  label: "Clôturés"   },
];

// ─── Carte crédit ───────────────────────────────────────────────────────────────

function CreditItemCard({
  credit,
  onLivrerLigne,
  loadingLigneId,
}: {
  credit: CreditItem;
  onLivrerLigne: (creditId: number, ligneId: number) => void;
  loadingLigneId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUT_CFG[credit.statut] ?? STATUT_CFG.SOLDE;
  const progress = credit.montantTotal > 0
    ? Math.min(100, Math.round((credit.montantRembourse / credit.montantTotal) * 100))
    : 0;
  const lignesEnAttente = credit.lignes.filter((l) => l.statut === "EN_ATTENTE");
  const lignesLivrees   = credit.lignes.filter((l) => l.statut === "LIVRE");

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${cfg.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-gray-900 font-mono text-sm">{credit.reference}</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-gray-500">{formatDate(credit.createdAt)}</p>
        </div>
        <p className="text-lg font-bold text-gray-900 flex-shrink-0">{formatCurrency(credit.montantTotal)}</p>
      </div>

      {/* Client */}
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <User size={13} className="text-gray-400 flex-shrink-0" />
        <span className="font-medium">{credit.client.prenom} {credit.client.nom}</span>
        <span className="text-gray-400 text-xs">{credit.client.telephone}</span>
      </div>

      {/* Barre remboursement */}
      {["ACTIF", "EN_RETARD", "SOLDE"].includes(credit.statut) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Remboursé : {formatCurrency(credit.montantRembourse)}</span>
            <span className="font-medium text-gray-700">Solde : {formatCurrency(credit.soldeRestant)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${credit.statut === "EN_RETARD" ? "bg-red-400" : "bg-green-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {credit.dateEcheanceFin && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={11} />
              Échéance : {formatDate(credit.dateEcheanceFin)}
              {credit.montantJournalier > 0 && ` · ${formatCurrency(credit.montantJournalier)}/j`}
            </p>
          )}
        </div>
      )}

      {/* Lignes */}
      {credit.lignes.length > 0 && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {credit.lignes.length} produit{credit.lignes.length > 1 ? "s" : ""}
            {lignesEnAttente.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                {lignesEnAttente.length} à livrer
              </span>
            )}
            {lignesLivrees.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                {lignesLivrees.length} livré{lignesLivrees.length > 1 ? "s" : ""}
              </span>
            )}
          </button>

          {open && (
            <div className="space-y-2">
              {credit.lignes.map((l) => {
                const ls  = LIGNE_CFG[l.statut] ?? { label: l.statut, color: "text-gray-500" };
                const nom = l.produitNom ?? l.produitNomSaisi ?? "—";
                const canLivrer = l.statut === "EN_ATTENTE" && ["ACTIF", "EN_RETARD"].includes(credit.statut);
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {nom}
                        {l.estNouveauProduit && (
                          <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">hors catalogue</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">× {l.quantite} · {formatCurrency(l.prixUnitaire)}/u</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium ${ls.color}`}>{ls.label}</span>
                      {canLivrer && (
                        <button
                          onClick={() => onLivrerLigne(credit.id, l.id)}
                          disabled={loadingLigneId === l.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {loadingLigneId === l.id ? <Loader2 size={11} className="animate-spin" /> : <PackageCheck size={11} />}
                          Livré
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Info statut */}
      {credit.statut === "EN_ATTENTE_VALIDATION" && (
        <div className="flex items-center gap-2 p-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-xs">
          <Clock size={13} />
          En attente de validation par le responsable crédit — les lignes peuvent être modifiées
        </div>
      )}
      {credit.statut === "EN_RETARD" && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <TrendingDown size={13} />
          Crédit en retard — relancer le client pour le remboursement
        </div>
      )}
      {credit.statut === "ANNULE" && (
        <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-xs">
          <XCircle size={13} />
          Demande refusée par le responsable crédit
        </div>
      )}
    </div>
  );
}

// ─── Ligne de produit dans le formulaire de création ─────────────────────────

interface LigneForm {
  key: number;
  type: "catalogue" | "nouveau";
  produitId: number | null;
  produitNom: string;
  quantite: string;
  prixUnitaire: string;
}

function LigneFormRow({
  ligne,
  onChange,
  onRemove,
  canRemove,
}: {
  ligne: LigneForm;
  onChange: (updates: Partial<LigneForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<ProduitCatalogue[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer dropdown au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Recherche produit catalogue
  useEffect(() => {
    if (ligne.type !== "catalogue" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/agentTerrain/produits?search=${encodeURIComponent(searchQuery)}&limit=8`);
        const j = await r.json();
        setSearchResults(j.data ?? []);
        setShowDropdown(true);
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, ligne.type]);

  const selectProduit = (p: ProduitCatalogue) => {
    onChange({
      produitId:    p.id,
      produitNom:   p.nom,
      prixUnitaire: p.prixVente != null ? String(Number(p.prixVente)) : "",
    });
    setSearchQuery(p.nom);
    setShowDropdown(false);
  };

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
      {/* Type toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ type: "catalogue", produitId: null, produitNom: "" })}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            ligne.type === "catalogue" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Catalogue
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: "nouveau", produitId: null, produitNom: "" })}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            ligne.type === "nouveau" ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Nouveau produit
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Produit */}
      {ligne.type === "catalogue" ? (
        <div ref={dropdownRef} className="relative">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) onChange({ produitId: null, produitNom: "" }); }}
              placeholder="Rechercher un produit…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            {searchLoading && <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduit(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm"
                >
                  <p className="font-medium text-gray-800">{p.nom}</p>
                  <p className="text-xs text-gray-400">
                    {p.reference && `Réf: ${p.reference} · `}
                    {p.prixVente != null ? formatCurrency(Number(p.prixVente)) : "Prix non défini"}
                    {p.unite ? ` / ${p.unite}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
          {ligne.produitId && (
            <p className="text-xs text-indigo-600 mt-1">✓ {ligne.produitNom}</p>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={ligne.produitNom}
          onChange={(e) => onChange({ produitNom: e.target.value })}
          placeholder="Nom du nouveau produit à créer…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        />
      )}

      {/* Quantité + Prix */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Quantité *</label>
          <input
            type="number"
            value={ligne.quantite}
            onChange={(e) => onChange({ quantite: e.target.value })}
            min={1}
            placeholder="1"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Prix unitaire (FCFA) *</label>
          <input
            type="number"
            value={ligne.prixUnitaire}
            onChange={(e) => onChange({ prixUnitaire: e.target.value })}
            min={0}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* Sous-total */}
      {ligne.quantite && ligne.prixUnitaire && (
        <p className="text-xs text-right text-gray-500">
          Sous-total : <span className="font-semibold text-gray-700">{formatCurrency(Number(ligne.quantite) * Number(ligne.prixUnitaire))}</span>
        </p>
      )}
    </div>
  );
}

// ─── Modal création ──────────────────────────────────────────────────────────

let keyCounter = 0;
function newLigne(): LigneForm {
  return { key: ++keyCounter, type: "catalogue", produitId: null, produitNom: "", quantite: "1", prixUnitaire: "" };
}

function CreateCreditModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [clientId,     setClientId]     = useState("");
  const [dureeJours,   setDureeJours]   = useState("30");
  const [dateDebut,    setDateDebut]    = useState(new Date().toISOString().slice(0, 10));
  const [garantie,     setGarantie]     = useState("");
  const [observations, setObservations] = useState("");
  const [lignes,       setLignes]       = useState<LigneForm[]>([newLigne()]);
  const [loading,      setLoading]      = useState(false);

  const { data: portData, loading: portLoading } =
    useApi<{ clients: ClientPortfolio[] }>("/api/agentTerrain/portefeuille-credit?filtre=tous");

  const clients = (portData?.clients ?? []).filter((c) => c.etat === "ACTIF");

  const montantTotal = lignes.reduce((s, l) => {
    const q = Number(l.quantite || 0);
    const p = Number(l.prixUnitaire || 0);
    return s + q * p;
  }, 0);

  const updateLigne = (key: number, updates: Partial<LigneForm>) => {
    setLignes((prev) => prev.map((l) => l.key === key ? { ...l, ...updates } : l));
  };
  const removeLigne = (key: number) => setLignes((prev) => prev.filter((l) => l.key !== key));
  const addLigne    = () => setLignes((prev) => [...prev, newLigne()]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    for (const l of lignes) {
      if (l.type === "catalogue" && !l.produitId) { toast.error("Sélectionnez un produit catalogue pour chaque ligne"); return; }
      if (l.type === "nouveau" && !l.produitNom.trim()) { toast.error("Saisissez le nom du nouveau produit"); return; }
      if (!l.quantite || Number(l.quantite) <= 0) { toast.error("Quantité invalide sur une ligne"); return; }
      if (!l.prixUnitaire || Number(l.prixUnitaire) < 0) { toast.error("Prix invalide sur une ligne"); return; }
    }
    if (montantTotal <= 0) { toast.error("Le montant total doit être > 0"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/agentTerrain/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId:    Number(clientId),
          dureeJours:  Number(dureeJours),
          dateDebut,
          garantie:    garantie || undefined,
          observations: observations || undefined,
          lignes: lignes.map((l) => ({
            produitId:      l.type === "catalogue" ? l.produitId ?? undefined : undefined,
            produitNomSaisi: l.produitNom,
            quantite:       Number(l.quantite),
            prixUnitaire:   Number(l.prixUnitaire),
          })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Demande ${json.data?.reference ?? ""} soumise — en attente de validation RVC`);
        onSuccess();
        onClose();
      } else {
        toast.error(json.error ?? "Erreur lors de la création");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <CreditCard size={15} className="text-white" />
            </div>
            <h2 className="font-bold text-gray-900">Nouvelle demande de crédit</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client *</label>
            {portLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-xl">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : clients.length === 0 ? (
              <p className="text-sm text-amber-600 p-3 bg-amber-50 rounded-xl">Aucun client actif dans votre portefeuille.</p>
            ) : (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sélectionner un client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom} — {c.telephone}
                    {c.limiteCredit != null ? ` (dispo : ${formatCurrency(c.creditDisponible)})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Produits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Produits demandés *</label>
              <button
                type="button"
                onClick={addLigne}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <div className="space-y-3">
              {lignes.map((l) => (
                <LigneFormRow
                  key={l.key}
                  ligne={l}
                  onChange={(updates) => updateLigne(l.key, updates)}
                  onRemove={() => removeLigne(l.key)}
                  canRemove={lignes.length > 1}
                />
              ))}
            </div>
            {montantTotal > 0 && (
              <div className="mt-3 flex items-center justify-between px-3 py-2.5 bg-indigo-50 rounded-xl">
                <span className="text-sm text-indigo-700 font-medium">Total demandé</span>
                <span className="text-lg font-bold text-indigo-900">{formatCurrency(montantTotal)}</span>
              </div>
            )}
          </div>

          {/* Durée + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Durée (jours) *</label>
              <input
                type="number"
                value={dureeJours}
                onChange={(e) => setDureeJours(e.target.value)}
                min={1}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {montantTotal > 0 && dureeJours && Number(dureeJours) > 0 && (
                <p className="text-xs text-gray-500 mt-1">≈ {formatCurrency(montantTotal / Number(dureeJours))}/j</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date début *</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Garantie + Observations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Garantie (optionnel)</label>
            <input
              type="text"
              value={garantie}
              onChange={(e) => setGarantie(e.target.value)}
              placeholder="Carte d'identité, terrain…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Observations (optionnel)</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Informations complémentaires…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
            La demande sera soumise au responsable crédit (RVC) qui pourra modifier les lignes avant de valider. Le magasinier ou vous-même pouvez ensuite confirmer la livraison de chaque produit.
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !clientId || lignes.length === 0}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Soumettre la demande
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AgentCreditClientsPage() {
  const [filtre,      setFiltre]      = useState<Filtre>("all");
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [showCreate,  setShowCreate]  = useState(false);
  const [loadingLigne, setLoadingLigne] = useState<number | null>(null);

  const url = filtre === "all"
    ? `/api/agentTerrain/credits?mode=full&_k=${refreshKey}`
    : `/api/agentTerrain/credits?mode=full&statut=${filtre}&_k=${refreshKey}`;

  const { data, loading, error } = useApi<CreditsResponse>(url);
  const credits = data?.credits ?? [];
  const stats   = data?.stats;

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleLivrerLigne = useCallback(async (creditId: number, ligneId: number) => {
    setLoadingLigne(ligneId);
    try {
      const res  = await fetch(`/api/agentTerrain/credits/${creditId}/lignes/${ligneId}`, { method: "PATCH" });
      const json = await res.json();
      if (res.ok) {
        toast.success("Livraison confirmée");
        handleRefresh();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally {
      setLoadingLigne(null);
    }
  }, [handleRefresh]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <DashboardBackButton />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <CreditCard size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Crédits Clients</h1>
                <p className="text-xs text-gray-500">Agent Terrain</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Nouvelle demande
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total",       value: stats.total,     bg: "bg-white",      text: "text-gray-900" },
              { label: "En attente",  value: stats.enAttente, bg: "bg-yellow-50",  text: "text-yellow-700" },
              { label: "Actifs",      value: stats.actifs,    bg: "bg-green-50",   text: "text-green-700" },
              { label: "En retard",   value: stats.enRetard,  bg: "bg-red-50",     text: "text-red-700"   },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 border border-gray-100 text-center`}>
                <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtre === f.id ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {stats && f.id === "EN_ATTENTE_VALIDATION" && stats.enAttente > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  filtre === f.id ? "bg-white text-indigo-600" : "bg-yellow-100 text-yellow-700"
                }`}>{stats.enAttente}</span>
              )}
              {stats && f.id === "EN_RETARD" && stats.enRetard > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  filtre === f.id ? "bg-white text-indigo-600" : "bg-red-100 text-red-700"
                }`}>{stats.enRetard}</span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
          </div>
        )}

        {/* Erreur */}
        {error && !loading && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Vide */}
        {!loading && !error && credits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package size={48} className="mb-3 opacity-30" />
            <p className="text-base font-medium">Aucun crédit</p>
            <p className="text-sm mt-1">Créez une nouvelle demande pour commencer.</p>
          </div>
        )}

        {/* Liste */}
        {!loading && !error && credits.length > 0 && (
          <div className="space-y-4">
            {credits.map((c) => (
              <CreditItemCard
                key={c.id}
                credit={c}
                onLivrerLigne={handleLivrerLigne}
                loadingLigneId={loadingLigne}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCreditModal onClose={() => setShowCreate(false)} onSuccess={handleRefresh} />
      )}
    </div>
  );
}

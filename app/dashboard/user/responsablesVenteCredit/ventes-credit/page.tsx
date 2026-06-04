"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  ShoppingBag, RefreshCw, CheckCircle, XCircle, Clock,
  AlertCircle, Loader2, Package, Eye, Truck, PackageCheck,
  CreditCard, Receipt, FileText, Plus, Trash2, Search,
  X, User, ChevronLeft, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi, useMutation } from "@/hooks/useApi";
import FactureModal from "@/components/FactureModal";
import { formatCurrency, formatDate } from "@/lib/format";

// ─── Types ─────────────────────────────────────────────────────────────────────

type StatutVente =
  | "CREDIT_REQUEST"
  | "CREDIT_APPROUVE"
  | "CREDIT_REFUSE"
  | "CREDIT_EN_LIVRAISON"
  | "CREDIT_LIVRE";

interface LigneResume {
  id: number;
  produitNom: string | null;
  unite: string | null;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  horscatalogue: boolean;
}

interface VenteCredit {
  id: number;
  reference: string;
  statut: StatutVente;
  montantTotal: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vendeur: { id: number; nom: string; prenom: string } | null;
  pointDeVente: { id: number; nom: string } | null;
  client: { id: number | null; nom: string; prenom: string; telephone: string | null } | null;
  clientNom: string | null;
  creditClient: {
    id: number;
    reference: string;
    montantTotal: number;
    montantConsomme: number;
  } | null;
  lignes: LigneResume[];
}

interface ApiResponse {
  data: VenteCredit[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUTS: { id: StatutVente; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "CREDIT_REQUEST",      label: "En attente",   icon: <Clock size={15} />,       color: "text-yellow-600" },
  { id: "CREDIT_APPROUVE",     label: "Approuvés",    icon: <CheckCircle size={15} />, color: "text-blue-600" },
  { id: "CREDIT_EN_LIVRAISON", label: "En livraison", icon: <Truck size={15} />,       color: "text-orange-600" },
  { id: "CREDIT_LIVRE",        label: "Livrés",       icon: <PackageCheck size={15} />, color: "text-green-600" },
  { id: "CREDIT_REFUSE",       label: "Refusés",      icon: <XCircle size={15} />,     color: "text-red-600" },
];

function statutBadge(s: StatutVente) {
  const map: Record<StatutVente, { bg: string; text: string; label: string }> = {
    CREDIT_REQUEST:      { bg: "bg-yellow-100", text: "text-yellow-800", label: "En attente" },
    CREDIT_APPROUVE:     { bg: "bg-blue-100",   text: "text-blue-800",   label: "Approuvé" },
    CREDIT_REFUSE:       { bg: "bg-red-100",    text: "text-red-800",    label: "Refusé" },
    CREDIT_EN_LIVRAISON: { bg: "bg-orange-100", text: "text-orange-800", label: "En livraison" },
    CREDIT_LIVRE:        { bg: "bg-green-100",  text: "text-green-800",  label: "Livré" },
  };
  const s2 = map[s] ?? { bg: "bg-slate-100", text: "text-slate-600", label: s };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s2.bg} ${s2.text}`}>
      {s2.label}
    </span>
  );
}

function clientNom(v: VenteCredit) {
  if (v.client) return `${v.client.prenom} ${v.client.nom}`;
  return v.clientNom ?? "—";
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function RVCVentesCreditPage() {
  const [onglet,        setOnglet]        = useState<StatutVente>("CREDIT_REQUEST");
  const [page,          setPage]          = useState(1);
  const [refreshKey,    setRefreshKey]    = useState(0);
  const [showProForma,  setShowProForma]  = useState(false);
  const [showNewCredit, setShowNewCredit] = useState(false);

  const url = `/api/rvc/ventes?statut=${onglet}&page=${page}&limit=20&_k=${refreshKey}`;
  const { data, loading, error } = useApi<ApiResponse>(url);

  const ventes = data?.data ?? [];
  const meta   = data?.meta;

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOnglet = useCallback((s: StatutVente) => {
    setOnglet(s);
    setPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {showProForma && (
        <FactureModal proFormaMode onClose={() => setShowProForma(false)} />
      )}
      {showNewCredit && (
        <NouveauCreditModal
          onClose={() => setShowNewCredit(false)}
          onCreated={() => { setShowNewCredit(false); handleRefresh(); }}
        />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <DashboardBackButton />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <CreditCard size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Ventes à Crédit</h1>
                <p className="text-xs text-gray-500">Responsable Vente Crédit</p>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Onglets */}
        <div className="flex flex-wrap items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit">
          {STATUTS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleOnglet(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                onglet === s.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {meta ? `${meta.total} vente${meta.total > 1 ? "s" : ""}` : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewCredit(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14} />
              Nouveau crédit
            </button>
            <button
              onClick={() => setShowProForma(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors text-gray-700"
            >
              <FileText size={14} />
              Pro-forma
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Erreur */}
        {error && !loading && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Vide */}
        {!loading && !error && ventes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ShoppingBag size={48} className="mb-3 opacity-30" />
            <p className="text-base font-medium">Aucune vente dans ce statut</p>
          </div>
        )}

        {/* Liste */}
        {!loading && !error && ventes.length > 0 && (
          <div className="space-y-4">
            {ventes.map((v) => (
              <VenteCreditCard key={v.id} vente={v} onRefresh={handleRefresh} />
            ))}

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-600 px-2">Page {meta.page} / {meta.totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Carte vente ────────────────────────────────────────────────────────────────

// ─── Modal Nouveau Crédit RVC ────────────────────────────────────────────────

interface ClientResult {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  codeClient: string | null;
}

interface EligibiliteInfo {
  eligible: boolean;
  raisons: string[];
  alertes: string[];
  tauxUtilisation: number | null;
  creditsActifs: { id: number; reference: string; statut: string; montantTotal: string | number; soldeRestant: string | number }[];
  client: { limiteCredit: string | number | null; soldeActuel: string | number | null };
}

interface ProduitCatalogue {
  id: number;
  nom: string;
  unite: string | null;
  prixUnitaire: number;
  reference: string | null;
  stock: number;
}

interface CreditLigneForm {
  produitId:        number | null;
  produitNom:       string;
  quantite:         number;
  prixUnitaire:     number;
  remise:           number;
  unite:            string;
  stockDisponible:  number;   // Infinity = nouveau produit ou sans stock connu
  creerProduit:     boolean;  // true = sera créé via POST /api/rvc/produits avant soumission
}

// ─── Sous-composant : une ligne de produit ───────────────────────────────────

function LigneRow({
  ligne,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  ligne: CreditLigneForm;
  index: number;
  canRemove: boolean;
  onChange: (i: number, l: CreditLigneForm) => void;
  onRemove: (i: number) => void;
}) {
  const [search,  setSearch]  = useState(ligne.produitId ? ligne.produitNom : "");
  const [results, setResults] = useState<ProduitCatalogue[]>([]);
  const [loading, setLoading] = useState(false);

  // Recherche catalogue (debounce 300 ms) — désactivée si produit déjà choisi
  useEffect(() => {
    if (ligne.produitId || ligne.creerProduit || search.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/rvc/produits?search=${encodeURIComponent(search)}&limit=8`);
        const j = await r.json();
        setResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, ligne.produitId, ligne.creerProduit]);

  const selectFromCatalogue = (p: ProduitCatalogue) => {
    setSearch(p.nom);
    setResults([]);
    onChange(index, {
      ...ligne,
      produitId:       p.id,
      produitNom:      p.nom,
      prixUnitaire:    p.prixUnitaire,
      unite:           p.unite ?? "",
      stockDisponible: p.stock,
      creerProduit:    false,
    });
  };

  const activerNouveauProduit = () => {
    const nom = search.trim();
    setResults([]);
    onChange(index, {
      ...ligne,
      produitId:       null,
      produitNom:      nom,
      creerProduit:    true,
      stockDisponible: Infinity,
    });
  };

  const effacerChoix = () => {
    setSearch("");
    setResults([]);
    onChange(index, {
      ...ligne,
      produitId:       null,
      produitNom:      "",
      creerProduit:    false,
      stockDisponible: Infinity,
      unite:           "",
    });
  };

  const stockWarning =
    ligne.produitId !== null &&
    ligne.stockDisponible !== Infinity &&
    ligne.quantite > ligne.stockDisponible;

  const sousTotal = Math.max(0, ligne.prixUnitaire * ligne.quantite - ligne.remise);

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">

      {/* ── Sélection produit ── */}
      <div className="flex items-start gap-2">
        <div className="flex-1 relative">

          {/* Produit du catalogue sélectionné */}
          {ligne.produitId && (
            <div className="flex items-center justify-between px-3 py-2 bg-white border border-indigo-200 rounded-lg">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate block">{ligne.produitNom}</span>
                <span className={`text-xs font-medium ${ligne.stockDisponible > 0 ? "text-green-600" : "text-red-500"}`}>
                  Stock PDV : {ligne.stockDisponible}
                  {ligne.unite ? ` ${ligne.unite}` : ""}
                </span>
              </div>
              <button onClick={effacerChoix} className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Nouveau produit à créer */}
          {!ligne.produitId && ligne.creerProduit && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-800 truncate">
                  ✦ Nouveau : {ligne.produitNom || "—"}
                </div>
                <button onClick={effacerChoix} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              </div>
              <input
                type="text"
                value={ligne.unite}
                onChange={(e) => onChange(index, { ...ligne, unite: e.target.value })}
                placeholder="Unité (kg, L, sac, boîte…)"
                className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
              />
            </div>
          )}

          {/* Champ de recherche */}
          {!ligne.produitId && !ligne.creerProduit && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); onChange(index, { ...ligne, produitNom: e.target.value, produitId: null }); }}
                placeholder="Rechercher un produit…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {loading && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}

              {/* Dropdown */}
              {(results.length > 0 || (search.trim().length >= 2 && !loading)) && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); selectFromCatalogue(p); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{p.nom}</span>
                        <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                          p.stock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"
                        }`}>
                          {p.stock > 0 ? `${p.stock}${p.unite ? ` ${p.unite}` : ""}` : "Rupture"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.prixUnitaire.toLocaleString("fr-FR")} FCFA{p.unite ? ` / ${p.unite}` : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                    </button>
                  ))}

                  {/* Option : créer ce produit directement */}
                  {search.trim().length >= 2 && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); activerNouveauProduit(); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-amber-50 border-t border-gray-100 flex items-center gap-2 text-amber-700"
                    >
                      <Plus size={13} className="flex-shrink-0" />
                      <span className="text-sm font-medium">Créer &quot;{search.trim()}&quot; dans le catalogue</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {canRemove && (
          <button onClick={() => onRemove(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg mt-0.5 flex-shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── Qté / Prix / Remise ── */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Qté</label>
          <input
            type="number" min="1" value={ligne.quantite}
            onChange={(e) => onChange(index, { ...ligne, quantite: Math.max(1, Number(e.target.value)) })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Prix unit. (FCFA)</label>
          <input
            type="number" min="0" value={ligne.prixUnitaire || ""}
            onChange={(e) => onChange(index, { ...ligne, prixUnitaire: Math.max(0, Number(e.target.value)) })}
            placeholder="0"
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Remise (FCFA)</label>
          <input
            type="number" min="0" value={ligne.remise || ""}
            onChange={(e) => onChange(index, { ...ligne, remise: Math.max(0, Number(e.target.value)) })}
            placeholder="0"
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* Avertissement stock insuffisant */}
      {stockWarning && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle size={11} /> Stock insuffisant ({ligne.stockDisponible} disponible au PDV)
        </p>
      )}

      {/* Sous-total */}
      {(ligne.produitNom.trim() || ligne.creerProduit) && ligne.prixUnitaire > 0 && (
        <p className="text-xs text-right text-indigo-600 font-medium">
          Sous-total : {formatCurrency(sousTotal)}
        </p>
      )}
    </div>
  );
}

function NouveauCreditModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — Client
  const [clientSearch,   setClientSearch]   = useState("");
  const [clientResults,  setClientResults]  = useState<ClientResult[]>([]);
  const [clientLoading,  setClientLoading]  = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [eligibilite,    setEligibilite]    = useState<EligibiliteInfo | null>(null);
  const [eligLoading,    setEligLoading]    = useState(false);

  // Step 2 — Lignes
  const [lignes, setLignes] = useState<CreditLigneForm[]>([
    { produitId: null, produitNom: "", quantite: 1, prixUnitaire: 0, remise: 0, unite: "", stockDisponible: Infinity, creerProduit: false },
  ]);

  // Step 3 — Paramètres
  const [dureeJours,   setDureeJours]   = useState("");
  const [dateDebut,    setDateDebut]    = useState(new Date().toISOString().slice(0, 10));
  const [tauxPenalite, setTauxPenalite] = useState("0");
  const [garantie,     setGarantie]     = useState("");
  const [observations, setObservations] = useState("");

  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [creditCree,       setCreditCree]       = useState<{ reference: string } | null>(null);
  const [ruptures,         setRuptures]         = useState<{ produitNom: string; quantiteDemandee: number; stockDispo: number; manque: number }[]>([]);
  const [commandeInterne,  setCommandeInterne]  = useState<{ id: number; reference: string } | null>(null);

  // Calculs
  const montantTotal = lignes.reduce(
    (s, l) => s + Math.max(0, l.prixUnitaire * l.quantite - l.remise),
    0
  );
  const montantJournalier = dureeJours
    ? +(montantTotal / Number(dureeJours)).toFixed(2)
    : 0;
  const dateFin = (() => {
    if (!dureeJours || !dateDebut) return "";
    const d = new Date(dateDebut);
    d.setDate(d.getDate() + Number(dureeJours));
    return d.toISOString().slice(0, 10);
  })();

  // Recherche client (debounce 350 ms)
  useEffect(() => {
    if (clientSearch.trim().length < 2 || selectedClient) {
      setClientResults([]);
      return;
    }
    setClientLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/rvc/clients?etat=ACTIF&search=${encodeURIComponent(clientSearch)}&limit=10`
        );
        const j = await r.json();
        setClientResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setClientLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [clientSearch, selectedClient]);

  const selectClient = async (c: ClientResult) => {
    setSelectedClient(c);
    setClientResults([]);
    setClientSearch(`${c.prenom} ${c.nom}`);
    setEligLoading(true);
    setEligibilite(null);
    try {
      const r = await fetch(`/api/rvc/clients/${c.id}/eligibilite-credit`);
      const j = await r.json();
      setEligibilite(j);
    } catch { /* ignore */ }
    finally { setEligLoading(false); }
  };

  const resetClient = () => {
    setSelectedClient(null);
    setEligibilite(null);
    setClientSearch("");
    setClientResults([]);
  };


  const lignesValides = lignes.filter(
    (l) => (l.produitNom.trim() || l.creerProduit) && l.prixUnitaire > 0 && l.quantite >= 1
  );

  const handleSubmit = async () => {
    setError("");
    if (!selectedClient || lignesValides.length === 0 || !dureeJours || !dateDebut) {
      setError("Veuillez compléter toutes les étapes");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Créer d'abord les nouveaux produits (sans produitId)
      const lignesResolues = await Promise.all(
        lignesValides.map(async (l) => {
          if (!l.creerProduit) return l;
          const r = await fetch("/api/rvc/produits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nom:          l.produitNom,
              prixUnitaire: l.prixUnitaire,
              unite:        l.unite || undefined,
            }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? `Impossible de créer le produit "${l.produitNom}"`);
          return { ...l, produitId: j.data.id, creerProduit: false };
        })
      );

      // 2. Soumettre le crédit avec tous les produitId résolus
      const r = await fetch("/api/rvc/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId:     selectedClient.id,
          lignes:       lignesResolues.map((l) => ({
            produitId:    l.produitId ?? undefined,
            produitNom:   l.produitNom,
            quantite:     l.quantite,
            prixUnitaire: l.prixUnitaire,
            remise:       l.remise || undefined,
          })),
          dureeJours:   Number(dureeJours),
          dateDebut,
          tauxPenalite: Number(tauxPenalite) || 0,
          garantie:     garantie.trim() || undefined,
          observations: observations.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Erreur lors de la création"); return; }
      // Crédit créé — afficher récapitulatif (et ruptures éventuelles) avant fermeture
      setCreditCree({ reference: j.data.reference });
      setRuptures(j.ruptures ?? []);
      setCommandeInterne(j.commandeInterne ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally { setSubmitting(false); }
  };

  const STEPS = ["Client", "Produits", "Paramètres"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-indigo-600" />
            <h2 className="font-bold text-gray-900">Nouveau crédit client</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center px-6 py-3 border-b border-gray-100 gap-1">
          {STEPS.map((label, i) => {
            const num = (i + 1) as 1 | 2 | 3;
            const active = step === num;
            const done   = step > num;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done   ? "bg-indigo-600 text-white" :
                    active ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500" :
                             "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? "✓" : num}
                  </div>
                  <span className={`text-xs font-medium ${
                    active ? "text-indigo-700" : done ? "text-indigo-500" : "text-gray-400"
                  }`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > num ? "bg-indigo-500" : "bg-gray-200"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Succès (avec ou sans ruptures) ─────────────────────────── */}
          {creditCree && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center py-4 gap-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-1">
                  <CheckCircle size={24} className="text-green-600" />
                </div>
                <p className="font-bold text-gray-900">Crédit créé avec succès</p>
                <p className="text-sm text-gray-500 font-mono">{creditCree.reference}</p>
              </div>

              {ruptures.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-semibold text-amber-800">
                      {ruptures.length} produit(s) en stock insuffisant — logistique notifiée
                    </p>
                  </div>
                  <div className="space-y-1">
                    {ruptures.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                        <span className="font-medium text-gray-800 truncate">{r.produitNom}</span>
                        <div className="flex-shrink-0 text-right ml-3 space-x-2">
                          <span className="text-gray-400">dispo {r.stockDispo}</span>
                          <span className="text-red-600 font-semibold">manque {r.manque}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {commandeInterne ? (
                    <p className="text-xs text-amber-700 font-medium mt-2 flex items-center gap-1">
                      <Package size={11} />
                      Commande interne créée automatiquement :{" "}
                      <span className="font-mono">{commandeInterne.reference}</span>
                      {" "}— logistique &amp; magasinier notifiés.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-1">
                      Logistique &amp; admins notifiés (produits sans référence catalogue non inclus dans la commande).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Étape 1 : Client ───────────────────────────────────────── */}
          {!creditCree && step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rechercher un client actif
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); if (selectedClient) resetClient(); }}
                    placeholder="Nom, prénom, téléphone…"
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                  {clientLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                  {selectedClient && !clientLoading && (
                    <button onClick={resetClient} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown résultats */}
                {clientResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                        <p className="text-xs text-gray-400">
                          {c.telephone}{c.codeClient ? ` · ${c.codeClient}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Client sélectionné + éligibilité */}
              {selectedClient && (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-indigo-500" />
                      <p className="text-sm font-semibold text-indigo-900">
                        {selectedClient.prenom} {selectedClient.nom}
                      </p>
                    </div>
                    <p className="text-xs text-indigo-600">{selectedClient.telephone}</p>
                    {selectedClient.codeClient && (
                      <p className="text-xs text-indigo-400 font-mono">{selectedClient.codeClient}</p>
                    )}
                  </div>

                  {eligLoading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
                      <Loader2 size={14} className="animate-spin" /> Vérification de l&apos;éligibilité…
                    </div>
                  )}

                  {eligibilite && !eligLoading && (
                    <div className={`rounded-xl p-4 border ${
                      eligibilite.eligible
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {eligibilite.eligible
                          ? <CheckCircle size={15} className="text-green-600" />
                          : <AlertCircle size={15} className="text-red-600" />}
                        <span className={`text-sm font-semibold ${eligibilite.eligible ? "text-green-800" : "text-red-800"}`}>
                          {eligibilite.eligible ? "Client éligible au crédit" : "Client non éligible"}
                        </span>
                      </div>
                      {eligibilite.raisons.map((r, i) => (
                        <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                          <span className="flex-shrink-0 mt-0.5">•</span>{r}
                        </p>
                      ))}
                      {eligibilite.alertes.map((a, i) => (
                        <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5 mt-1">
                          <span className="flex-shrink-0 mt-0.5">⚠</span>{a}
                        </p>
                      ))}
                      {eligibilite.tauxUtilisation !== null && (
                        <p className="text-xs text-gray-600 mt-2">
                          Taux d&apos;utilisation crédit : <strong>{eligibilite.tauxUtilisation}%</strong>
                        </p>
                      )}
                      {eligibilite.creditsActifs.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {eligibilite.creditsActifs.length} crédit(s) actif(s) en cours
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Étape 2 : Produits ─────────────────────────────────────── */}
          {!creditCree && step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Recherchez un produit du catalogue ou créez-en un nouveau directement.
              </p>

              {lignes.map((l, i) => (
                <LigneRow
                  key={i}
                  ligne={l}
                  index={i}
                  canRemove={lignes.length > 1}
                  onChange={(idx, updated) =>
                    setLignes((prev) => prev.map((x, j) => (j === idx ? updated : x)))
                  }
                  onRemove={(idx) =>
                    setLignes((prev) => prev.filter((_, j) => j !== idx))
                  }
                />
              ))}

              <button
                onClick={() => setLignes((prev) => [
                  ...prev,
                  { produitId: null, produitNom: "", quantite: 1, prixUnitaire: 0, remise: 0, unite: "", stockDisponible: Infinity, creerProduit: false },
                ])}
                className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 px-2 py-1"
              >
                <Plus size={14} /> Ajouter un article
              </button>

              {montantTotal > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-700">Montant total</span>
                  <span className="text-xl font-bold text-indigo-800">{formatCurrency(montantTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 3 : Paramètres ───────────────────────────────────── */}
          {!creditCree && step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (jours) *</label>
                  <input
                    type="number" min="1" value={dureeJours}
                    onChange={(e) => setDureeJours(e.target.value)}
                    placeholder="ex : 30"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                  <input
                    type="date" value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taux pénalité (%)</label>
                  <input
                    type="number" min="0" step="0.1" value={tauxPenalite}
                    onChange={(e) => setTauxPenalite(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Garantie</label>
                  <input
                    type="text" value={garantie}
                    onChange={(e) => setGarantie(e.target.value)}
                    placeholder="Chèque, acte…"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                  placeholder="Informations complémentaires…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 resize-none"
                />
              </div>

              {/* Récapitulatif */}
              {montantTotal > 0 && dureeJours && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Récapitulatif</p>
                  <div className="space-y-2">
                    {([
                      ["Client",        selectedClient ? `${selectedClient.prenom} ${selectedClient.nom}` : "—"],
                      ["Montant total", formatCurrency(montantTotal)],
                      ["Durée",         `${dureeJours} jour${Number(dureeJours) > 1 ? "s" : ""}`],
                      ["Montant/jour",  formatCurrency(montantJournalier)],
                      ["Date début",    dateDebut ? new Date(dateDebut).toLocaleDateString("fr-FR") : "—"],
                      ["Date fin",      dateFin   ? new Date(dateFin).toLocaleDateString("fr-FR")   : "—"],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold text-gray-800">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
          {creditCree ? (
            <button
              onClick={onCreated}
              className="ml-auto flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
            >
              <CheckCircle size={14} /> Fermer &amp; actualiser
            </button>
          ) : (
            <>
              <button
                onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={14} />
                {step === 1 ? "Annuler" : "Précédent"}
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                  disabled={
                    (step === 1 && !selectedClient) ||
                    (step === 2 && lignesValides.length === 0)
                  }
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !dureeJours || !dateDebut}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting
                    ? <><Loader2 size={14} className="animate-spin" /> Création…</>
                    : <><CheckCircle size={14} /> Créer le crédit</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carte vente ────────────────────────────────────────────────────────────────

function VenteCreditCard({ vente, onRefresh }: { vente: VenteCredit; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [showFacture, setShowFacture] = useState(false);

  const canFacture = ["CREDIT_APPROUVE", "CREDIT_EN_LIVRAISON", "CREDIT_LIVRE"].includes(vente.statut);

  const nbHorsCat = vente.lignes.filter((l) => l.horscatalogue).length;
  const creditDispo = vente.creditClient
    ? vente.creditClient.montantTotal - vente.creditClient.montantConsomme
    : null;

  return (
    <>
      {showFacture && (
        vente.creditClient
          ? <FactureModal creditClientId={vente.creditClient.id} onClose={() => setShowFacture(false)} />
          : <FactureModal venteDirecteId={vente.id} onClose={() => setShowFacture(false)} />
      )}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-900">{vente.reference}</p>
              {statutBadge(vente.statut)}
              {nbHorsCat > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {nbHorsCat} hors catalogue
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {formatDate(vente.createdAt)} · {vente.pointDeVente?.nom ?? "—"}
            </p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(vente.montantTotal)}</p>
        </div>

        {/* Infos client + agent */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Client</p>
            <p className="font-medium text-gray-800 truncate">{clientNom(vente)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Agent</p>
            <p className="font-medium text-gray-800 truncate">
              {vente.vendeur ? `${vente.vendeur.prenom} ${vente.vendeur.nom}` : "—"}
            </p>
          </div>
          {vente.creditClient && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Solde crédit dispo</p>
              <p className={`font-semibold text-sm ${creditDispo !== null && creditDispo >= vente.montantTotal ? "text-green-600" : "text-red-600"}`}>
                {creditDispo !== null ? formatCurrency(creditDispo) : "—"}
              </p>
            </div>
          )}
        </div>

        {/* Lignes (collapse) */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700 mb-3"
        >
          <Package size={13} />
          {open ? "Masquer les lignes" : `Voir les ${vente.lignes.length} article${vente.lignes.length > 1 ? "s" : ""}`}
        </button>

        {open && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mb-3">
            {vente.lignes.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-xs text-gray-700 gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  {l.horscatalogue && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400" title="Hors catalogue" />
                  )}
                  <span className="truncate">{l.produitNom ?? "—"} × {l.quantite}{l.unite ? ` ${l.unite}` : ""}</span>
                </span>
                <span className="font-medium flex-shrink-0">{formatCurrency(l.montant)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/user/responsablesVenteCredit/ventes-credit/${vente.id}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Eye size={14} />
            {vente.statut === "CREDIT_REQUEST" ? "Examiner & modifier" : "Voir le détail"}
          </Link>
          {canFacture && (
            <button
              onClick={() => setShowFacture(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors"
            >
              <Receipt size={14} />
              {vente.creditClient ? "Facture crédit" : "Facture"}
            </button>
          )}
          {vente.notes && (
            <p className="text-xs text-gray-500 italic truncate">Note : {vente.notes}</p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

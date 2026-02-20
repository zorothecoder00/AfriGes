"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Truck, Package, ArrowUpCircle, ArrowDownCircle, Search, ArrowLeft,
  RefreshCw, AlertTriangle, Archive, CheckCircle, ClipboardList,
  Boxes, BarChart3, Plus, X, MapPin, ClipboardCheck, Filter,
  TrendingUp, LucideIcon,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
  updatedAt: string;
}

interface StockResponse {
  data: Produit[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

interface Mouvement {
  id: number;
  type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantite: number;
  motif: string | null;
  reference: string;
  dateMouvement: string;
  produit: { id: number; nom: string; stock: number };
}

interface MouvementsResponse {
  data:  Mouvement[];
  stats: { totalEntrees: number; totalSorties: number; totalAjustements: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

interface ReceptionsResponse {
  data:  Mouvement[];
  stats: { totalReceptions30j: number; totalQuantiteRecue30j: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

interface Responsable {
  id: number;
  nom: string;
  prenom: string;
}

interface AffectationsResponse {
  data:  Mouvement[];
  responsables: Responsable[];
  stats: { totalAffectations30j: number; totalQuantiteAffectee30j: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

type StatutStock = "EN_STOCK" | "STOCK_FAIBLE" | "RUPTURE";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getStatut = (stock: number, alerte: number): StatutStock =>
  stock === 0 ? "RUPTURE" : stock <= alerte ? "STOCK_FAIBLE" : "EN_STOCK";

const statutStyles: Record<StatutStock, { bg: string; text: string; dot: string; label: string }> = {
  EN_STOCK:    { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "En stock" },
  STOCK_FAIBLE:{ bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500",   label: "Stock faible" },
  RUPTURE:     { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500",     label: "Rupture" },
};

const typeMvtStyles: Record<string, { bg: string; text: string; icon: LucideIcon; label: string }> = {
  ENTREE:     { bg: "bg-emerald-100", text: "text-emerald-700", icon: ArrowUpCircle,   label: "Entrée" },
  SORTIE:     { bg: "bg-red-100",     text: "text-red-700",     icon: ArrowDownCircle, label: "Sortie" },
  AJUSTEMENT: { bg: "bg-blue-100",    text: "text-blue-700",    icon: ClipboardCheck,  label: "Ajustement" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({
  label, value, subtitle, icon: Icon, color, lightBg,
}: {
  label: string; value: string; subtitle?: string;
  icon: LucideIcon; color: string; lightBg: string;
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
    <div className={`${lightBg} w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <Icon className={`${color} w-6 h-6`} />
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{label}</h3>
    <p className="text-3xl font-bold text-slate-800">{value}</p>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "reception" | "affectation" | "livraisons" | "journal";

export default function LogistiqueApprovisionnementPage() {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("reception");

  // ── Stock / produits ──────────────────────────────────────────────────────
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stockPage, setStockPage]             = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const stockParams = new URLSearchParams({ page: String(stockPage), limit: "15" });
  if (debouncedSearch) stockParams.set("search", debouncedSearch);
  const { data: stockRes, loading: stockLoading, refetch: refetchStock } =
    useApi<StockResponse>(`/api/logistique/stock?${stockParams}`);

  const produits = stockRes?.data ?? [];
  const stats    = stockRes?.stats;
  const meta     = stockRes?.meta;

  // ── Réceptions ─────────────────────────────────────────────────────────────
  const [livrPage, setLivrPage]           = useState(1);
  const [livrSearch, setLivrSearch]       = useState("");
  const [livrDebounced, setLivrDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLivrDebounced(livrSearch), 350);
    return () => clearTimeout(t);
  }, [livrSearch]);

  const livrParams = new URLSearchParams({ page: String(livrPage), limit: "15" });
  if (livrDebounced) livrParams.set("search", livrDebounced);
  const { data: receptionsRes, refetch: refetchReceptions } =
    useApi<ReceptionsResponse>(`/api/logistique/receptions?${livrParams}`);

  // ── Affectations ──────────────────────────────────────────────────────────
  const [affPage, setAffPage]           = useState(1);
  const [affSearch, setAffSearch]       = useState("");
  const [affDebounced, setAffDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setAffDebounced(affSearch), 350);
    return () => clearTimeout(t);
  }, [affSearch]);

  const affParams = new URLSearchParams({ page: String(affPage), limit: "15" });
  if (affDebounced) affParams.set("search", affDebounced);
  const { data: affectationsRes, refetch: refetchAffectations } =
    useApi<AffectationsResponse>(`/api/logistique/affectations?${affParams}`);

  const responsables = affectationsRes?.responsables ?? [];

  // ── Journal ───────────────────────────────────────────────────────────────
  const [journalPage, setJournalPage]   = useState(1);
  const [journalType, setJournalType]   = useState<"" | "ENTREE" | "SORTIE" | "AJUSTEMENT">("");
  const [journalSearch, setJournalSearch]       = useState("");
  const [journalDebounced, setJournalDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setJournalDebounced(journalSearch), 350);
    return () => clearTimeout(t);
  }, [journalSearch]);

  const journalParams = new URLSearchParams({ page: String(journalPage), limit: "20" });
  if (journalType)     journalParams.set("type",   journalType);
  if (journalDebounced) journalParams.set("search", journalDebounced);
  const { data: journalRes } =
    useApi<MouvementsResponse>(`/api/logistique/mouvements?${journalParams}`);

  // ── Modal Réception ───────────────────────────────────────────────────────
  const [receptionModal, setReceptionModal]   = useState(false);
  const [recProduit, setRecProduit]           = useState<Produit | null>(null);
  const [recForm, setRecForm] = useState({ quantite: "", referenceExterne: "", motif: "" });

  const { mutate: createReception, loading: recLoading } =
    useMutation<unknown, object>("/api/logistique/receptions", "POST", {
      successMessage: "Réception enregistrée avec succès",
    });

  const openReceptionModal = (p: Produit) => {
    setRecProduit(p);
    setRecForm({ quantite: "", referenceExterne: "", motif: "" });
    setReceptionModal(true);
  };

  const closeReceptionModal = () => {
    setReceptionModal(false);
    setRecProduit(null);
  };

  const handleReception = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recProduit) return;
    const result = await createReception({
      produitId:        recProduit.id,
      quantite:         Number(recForm.quantite),
      referenceExterne: recForm.referenceExterne || undefined,
      motif:            recForm.motif || undefined,
    });
    if (result) {
      closeReceptionModal();
      refetchStock();
      refetchReceptions();
    }
  };

  // ── Modal Affectation ─────────────────────────────────────────────────────
  const [affModal, setAffModal]       = useState(false);
  const [affProduit, setAffProduit]   = useState<Produit | null>(null);
  const [affForm, setAffForm] = useState({ quantite: "", pointDeVente: "", notes: "" });
  const [affPdVLibre, setAffPdVLibre] = useState(false); // toggle: dropdown vs texte libre

  const { mutate: createAffectation, loading: affLoading } =
    useMutation<unknown, object>("/api/logistique/affectations", "POST", {
      successMessage: "Affectation enregistrée avec succès",
    });

  const openAffModal = (p: Produit | null) => {
    setAffProduit(p);
    setAffForm({ quantite: "", pointDeVente: "", notes: "" });
    setAffPdVLibre(responsables.length === 0);
    setAffModal(true);
  };

  const closeAffModal = () => {
    setAffModal(false);
    setAffProduit(null);
  };

  const handleAffectation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affProduit) return;
    const result = await createAffectation({
      produitId:   affProduit.id,
      quantite:    Number(affForm.quantite),
      pointDeVente: affForm.pointDeVente,
      notes:       affForm.notes || undefined,
    });
    if (result) {
      closeAffModal();
      refetchStock();
      refetchAffectations();
    }
  };

  const refetchAll = useCallback(() => {
    refetchStock();
    refetchReceptions();
    refetchAffectations();
  }, [refetchStock, refetchReceptions, refetchAffectations]);

  const produitsUrgents = produits.filter(p => {
    const s = getStatut(p.stock, p.alerteStock);
    return s === "RUPTURE" || s === "STOCK_FAIBLE";
  });

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: "reception",  label: "Stock & Réception",   icon: ArrowUpCircle  },
    { key: "affectation",label: "Affectation PdV",     icon: MapPin         },
    { key: "livraisons", label: "Suivi des Livraisons",icon: Truck          },
    { key: "journal",    label: "Journal des Mouvements", icon: ClipboardList },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/20">

      {/* ── Navbar ── */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Logistique & Approvisionnement
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <span className="text-lg">🔔</span>
              </Link>
              <SignOutButton
                redirectTo="/auth/login?logout=success"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Logistique &amp; Approvisionnement</h2>
            <p className="text-slate-500 mt-1">
              Réceptionnez les produits, affectez-les aux points de vente et suivez tous les mouvements.
            </p>
          </div>
          <button
            onClick={refetchAll}
            className="self-start px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Produits en stock"
            value={String(stats?.totalProduits ?? 0)}
            icon={Package}
            color="text-cyan-600"
            lightBg="bg-cyan-50"
          />
          <StatCard
            label="Valeur du stock"
            value={formatCurrency(stats?.valeurTotale ?? 0)}
            icon={BarChart3}
            color="text-emerald-600"
            lightBg="bg-emerald-50"
          />
          <StatCard
            label="Réceptions (30j)"
            value={String(receptionsRes?.stats?.totalReceptions30j ?? 0)}
            subtitle={`${receptionsRes?.stats?.totalQuantiteRecue30j ?? 0} unités reçues`}
            icon={ArrowUpCircle}
            color="text-blue-600"
            lightBg="bg-blue-50"
          />
          <StatCard
            label="Affectations (30j)"
            value={String(affectationsRes?.stats?.totalAffectations30j ?? 0)}
            subtitle={`${affectationsRes?.stats?.totalQuantiteAffectee30j ?? 0} unités allouées`}
            icon={TrendingUp}
            color="text-purple-600"
            lightBg="bg-purple-50"
          />
        </div>

        {/* ── Alertes ruptures / stock faible ── */}
        {(stats?.enRupture ?? 0) + (stats?.stockFaible ?? 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(stats?.enRupture ?? 0) > 0 && (
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-200 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Archive size={26} />
                </div>
                <div>
                  <p className="text-red-100 text-sm font-medium">Ruptures de stock</p>
                  <p className="text-3xl font-bold">{stats?.enRupture} produit{(stats?.enRupture ?? 0) > 1 ? "s" : ""}</p>
                  <p className="text-red-200 text-xs mt-0.5">Approvisionnement urgent requis</p>
                </div>
              </div>
            )}
            {(stats?.stockFaible ?? 0) > 0 && (
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-200 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={26} />
                </div>
                <div>
                  <p className="text-amber-100 text-sm font-medium">Stocks faibles</p>
                  <p className="text-3xl font-bold">{stats?.stockFaible} produit{(stats?.stockFaible ?? 0) > 1 ? "s" : ""}</p>
                  <p className="text-amber-200 text-xs mt-0.5">Réapprovisionnement à planifier</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 grid grid-cols-2 lg:grid-cols-4 gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === key
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={17} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1 – STOCK & RÉCEPTION                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "reception" && (
          <div className="space-y-5">
            {/* Search */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setStockPage(1); }}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle size={18} className="text-cyan-600" />
                  <h3 className="font-bold text-slate-800">État du Stock</h3>
                  {meta && (
                    <span className="bg-cyan-100 text-cyan-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {meta.total}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Cliquez sur «&nbsp;Réceptionner&nbsp;» pour enregistrer une entrée</p>
              </div>

              {stockLoading && !stockRes ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Produit", "Stock actuel", "Seuil alerte", "Niveau", "Statut", "Dernière MAJ", "Actions"].map(h => (
                          <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {produits.map(p => {
                        const s    = getStatut(p.stock, p.alerteStock);
                        const st   = statutStyles[s];
                        const pct  = p.alerteStock > 0
                          ? Math.min(Math.round((p.stock / (p.alerteStock * 2)) * 100), 100)
                          : p.stock > 0 ? 100 : 0;
                        return (
                          <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${s === "RUPTURE" ? "bg-red-50/40" : ""}`}>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800">{p.nom}</p>
                              {p.description && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{p.description}</p>}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xl font-bold ${s === "RUPTURE" ? "text-red-600" : "text-slate-800"}`}>
                                {p.stock}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{p.alerteStock}</td>
                            <td className="px-6 py-4">
                              <div className="w-28">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>{p.stock}</span>
                                  <span className="text-slate-400">/{p.alerteStock * 2 || "∞"}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      s === "EN_STOCK" ? "bg-emerald-500" : s === "STOCK_FAIBLE" ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">{formatDate(p.updatedAt)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openReceptionModal(p)}
                                  className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                >
                                  <ArrowUpCircle size={13} />
                                  Réceptionner
                                </button>
                                <button
                                  onClick={() => { setActiveTab("affectation"); openAffModal(p); }}
                                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                  disabled={p.stock === 0}
                                  title={p.stock === 0 ? "Stock épuisé" : "Affecter à un point de vente"}
                                >
                                  <MapPin size={13} />
                                  Affecter
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {produits.length === 0 && !stockLoading && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            Aucun produit trouvé
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {meta && meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{meta.page}</b> / <b>{meta.totalPages}</b> ({meta.total} produits)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStockPage(p => Math.max(1, p - 1))}
                      disabled={stockPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <span className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium">{stockPage}</span>
                    <button
                      onClick={() => setStockPage(p => Math.min(meta.totalPages, p + 1))}
                      disabled={stockPage >= meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2 – AFFECTATION PdV                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "affectation" && (
          <div className="space-y-6">

            {/* Produits urgents à affecter */}
            {produitsUrgents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-500" size={20} />
                  <h3 className="font-bold text-slate-800">Produits nécessitant un réapprovisionnement prioritaire</h3>
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{produitsUrgents.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produitsUrgents.map(p => {
                    const isRupture = p.stock === 0;
                    return (
                      <div key={p.id} className={`bg-white rounded-xl p-5 border ${isRupture ? "border-red-200" : "border-amber-200"} shadow-sm hover:shadow-md transition-all`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRupture ? "bg-red-100" : "bg-amber-100"}`}>
                              {isRupture ? <Archive size={18} className="text-red-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{p.nom}</p>
                              <p className="text-xs text-slate-500">Stock : {p.stock} / Seuil : {p.alerteStock}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isRupture ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {isRupture ? "Rupture" : "Faible"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                          <span className="font-medium">Prix unit. :</span> {formatCurrency(p.prixUnitaire)}
                        </p>
                        <button
                          onClick={() => openReceptionModal(p)}
                          className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                            isRupture
                              ? "bg-red-50 hover:bg-red-100 text-red-700"
                              : "bg-amber-50 hover:bg-amber-100 text-amber-700"
                          }`}
                        >
                          <Truck size={14} />
                          Réceptionner une livraison
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recherche affectations */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher dans les affectations..."
                    value={affSearch}
                    onChange={e => { setAffSearch(e.target.value); setAffPage(1); }}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Historique des affectations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-purple-600" />
                  <h3 className="font-bold text-slate-800">Affectations aux Points de Vente</h3>
                  {affectationsRes?.meta && (
                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {affectationsRes.meta.total}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openAffModal(null)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={15} />
                  Nouvelle affectation
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Produit", "Quantité", "Destination PdV", "Opérateur / Notes", "Date"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(affectationsRes?.data ?? []).map(m => {
                      const motifParts = (m.motif ?? "").split(" — ");
                      const destination = motifParts[0]?.replace("Affectation PdV : ", "") ?? "-";
                      const rest = motifParts.slice(1).join(" — ");
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-400 font-mono">{m.reference.replace("LOG-AFF-", "AFF-").substring(0, 15)}…</td>
                          <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{m.produit?.nom ?? "-"}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-purple-700 text-lg">{m.quantite}</span>
                            <span className="text-xs text-slate-500 ml-1">unités</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">
                              <MapPin size={11} />
                              {destination}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 max-w-[180px] truncate">{rest || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                        </tr>
                      );
                    })}
                    {(affectationsRes?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          Aucune affectation enregistrée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {affectationsRes?.meta && affectationsRes.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{affectationsRes.meta.page}</b> / <b>{affectationsRes.meta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAffPage(p => Math.max(1, p - 1))} disabled={affPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">Précédent</button>
                    <span className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">{affPage}</span>
                    <button onClick={() => setAffPage(p => Math.min(affectationsRes.meta.totalPages, p + 1))} disabled={affPage >= affectationsRes.meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3 – SUIVI DES LIVRAISONS                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "livraisons" && (
          <div className="space-y-5">
            {/* Stats réceptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <ArrowUpCircle className="text-emerald-600 w-7 h-7" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Livraisons réceptionnées (30j)</p>
                  <p className="text-3xl font-bold text-slate-800">{receptionsRes?.stats?.totalReceptions30j ?? 0}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Boxes className="text-blue-600 w-7 h-7" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Unités reçues (30j)</p>
                  <p className="text-3xl font-bold text-slate-800">{receptionsRes?.stats?.totalQuantiteRecue30j ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Recherche */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par produit, référence, motif..."
                  value={livrSearch}
                  onChange={e => { setLivrSearch(e.target.value); setLivrPage(1); }}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <Truck size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-800">Historique des réceptions</h3>
                {receptionsRes?.meta && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {receptionsRes.meta.total}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence livraison", "Produit", "Qté reçue", "Motif / Fournisseur", "Date réception"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(receptionsRes?.data ?? []).map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            {m.reference.replace("LOG-REC-", "LIV-").substring(0, 18)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{m.produit?.nom ?? "-"}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold text-sm">
                            <ArrowUpCircle size={13} />
                            +{m.quantite}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-[260px]">
                          <p className="truncate">{m.motif ?? "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                      </tr>
                    ))}
                    {(receptionsRes?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          Aucune réception enregistrée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {receptionsRes?.meta && receptionsRes.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{receptionsRes.meta.page}</b> / <b>{receptionsRes.meta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLivrPage(p => Math.max(1, p - 1))} disabled={livrPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Précédent</button>
                    <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">{livrPage}</span>
                    <button onClick={() => setLivrPage(p => Math.min(receptionsRes.meta.totalPages, p + 1))} disabled={livrPage >= receptionsRes.meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4 – JOURNAL DES MOUVEMENTS                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "journal" && (
          <div className="space-y-5">
            {/* Stats 30j */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Entrées (30j)",     value: journalRes?.stats?.totalEntrees     ?? 0, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
                { label: "Sorties (30j)",     value: journalRes?.stats?.totalSorties     ?? 0, color: "text-red-600",     bg: "bg-red-50",     dot: "bg-red-500"     },
                { label: "Ajustements (30j)", value: journalRes?.stats?.totalAjustements ?? 0, color: "text-blue-600",    bg: "bg-blue-50",    dot: "bg-blue-500"    },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${s.dot} shrink-0`} />
                  <div>
                    <p className="text-slate-500 text-xs">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Référence, produit, motif..."
                    value={journalSearch}
                    onChange={e => { setJournalSearch(e.target.value); setJournalPage(1); }}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400 shrink-0" />
                  <select
                    value={journalType}
                    onChange={e => { setJournalType(e.target.value as typeof journalType); setJournalPage(1); }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-slate-700"
                  >
                    <option value="">Tous les types</option>
                    <option value="ENTREE">Entrées</option>
                    <option value="SORTIE">Sorties</option>
                    <option value="AJUSTEMENT">Ajustements</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table journal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <ClipboardList size={18} className="text-cyan-600" />
                <h3 className="font-bold text-slate-800">Journal global des mouvements</h3>
                {journalRes?.meta && (
                  <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {journalRes.meta.total}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Type", "Produit", "Stock actuel", "Quantité", "Motif", "Date"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(journalRes?.data ?? []).map(m => {
                      const ts = typeMvtStyles[m.type] ?? typeMvtStyles.AJUSTEMENT;
                      const Icon = ts.icon;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs text-slate-400">{m.reference.substring(0, 18)}…</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ts.bg} ${ts.text}`}>
                              <Icon size={11} />
                              {ts.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{m.produit?.nom ?? "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{m.produit?.stock ?? "-"} u.</td>
                          <td className="px-6 py-4">
                            <span className={`font-bold text-lg ${m.type === "ENTREE" ? "text-emerald-600" : m.type === "SORTIE" ? "text-red-600" : "text-blue-600"}`}>
                              {m.type === "ENTREE" ? "+" : m.type === "SORTIE" ? "-" : "±"}{m.quantite}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 max-w-[200px]">
                            <p className="truncate">{m.motif ?? "-"}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                        </tr>
                      );
                    })}
                    {(journalRes?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          Aucun mouvement trouvé
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {journalRes?.meta && journalRes.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{journalRes.meta.page}</b> / <b>{journalRes.meta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setJournalPage(p => Math.max(1, p - 1))} disabled={journalPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Précédent</button>
                    <span className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium">{journalPage}</span>
                    <button onClick={() => setJournalPage(p => Math.min(journalRes.meta.totalPages, p + 1))} disabled={journalPage >= journalRes.meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – RÉCEPTION                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {receptionModal && recProduit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                  <ArrowUpCircle className="text-cyan-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Réceptionner du stock</h2>
                  <p className="text-sm text-slate-500">{recProduit.nom}</p>
                </div>
              </div>
              <button onClick={closeReceptionModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Infos produit */}
            <div className="px-6 pt-5">
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Stock actuel</p>
                  <p className="font-bold text-slate-800 text-lg">{recProduit.stock} unités</p>
                </div>
                <div>
                  <p className="text-slate-500">Seuil d&apos;alerte</p>
                  <p className="font-bold text-slate-800 text-lg">{recProduit.alerteStock}</p>
                </div>
                <div>
                  <p className="text-slate-500">Prix unitaire</p>
                  <p className="font-semibold text-slate-700">{formatCurrency(recProduit.prixUnitaire)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Statut</p>
                  {(() => {
                    const s = getStatut(recProduit.stock, recProduit.alerteStock);
                    const st = statutStyles[s];
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleReception} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Quantité reçue <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={recForm.quantite}
                  onChange={e => setRecForm(f => ({ ...f, quantite: e.target.value }))}
                  placeholder="Ex : 50"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
                {recForm.quantite && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Nouveau stock estimé : <b>{recProduit.stock + (Number(recForm.quantite) || 0)} unités</b>
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Référence fournisseur / Bon de livraison
                </label>
                <input
                  type="text"
                  value={recForm.referenceExterne}
                  onChange={e => setRecForm(f => ({ ...f, referenceExterne: e.target.value }))}
                  placeholder="Ex : BL-2024-0042"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Fournisseur / Notes
                </label>
                <input
                  type="text"
                  value={recForm.motif}
                  onChange={e => setRecForm(f => ({ ...f, motif: e.target.value }))}
                  placeholder="Ex : Livraison Fournisseur XYZ"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeReceptionModal}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={recLoading || !recForm.quantite || Number(recForm.quantite) <= 0}
                  className="flex-1 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recLoading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {recLoading ? "Enregistrement..." : "Valider la réception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – AFFECTATION PdV                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {affModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                  <MapPin className="text-purple-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Affecter au point de vente</h2>
                  <p className="text-sm text-slate-500">
                    {affProduit ? affProduit.nom : "Sélectionnez un produit"}
                  </p>
                </div>
              </div>
              <button onClick={closeAffModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Infos produit (visible uniquement si produit sélectionné) */}
            {affProduit && (
              <div className="px-6 pt-5">
                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Stock disponible</p>
                    <p className={`font-bold text-lg ${affProduit.stock === 0 ? "text-red-600" : "text-slate-800"}`}>
                      {affProduit.stock} unités
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Prix unitaire</p>
                    <p className="font-semibold text-slate-700">{formatCurrency(affProduit.prixUnitaire)}</p>
                  </div>
                </div>
                {affProduit.stock === 0 && (
                  <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">Ce produit est en rupture. Effectuez d&apos;abord une réception.</p>
                  </div>
                )}
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleAffectation} className="p-6 space-y-4">

              {/* Sélecteur de produit (visible uniquement si aucun produit pré-sélectionné) */}
              {!affProduit && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Produit à affecter <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value=""
                    onChange={e => {
                      const selected = produits.find(p => p.id === Number(e.target.value));
                      if (selected) {
                        setAffProduit(selected);
                        setAffForm(f => ({ ...f, quantite: "" }));
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                  >
                    <option value="">— Choisir un produit —</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock === 0}>
                        {p.nom} — stock : {p.stock} u.{p.stock === 0 ? " (rupture)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Seuls les produits de la page courante sont listés. Utilisez la recherche dans l&apos;onglet Stock pour en trouver d&apos;autres.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Quantité à affecter <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={affProduit?.stock ?? undefined}
                  required
                  disabled={!affProduit}
                  value={affForm.quantite}
                  onChange={e => setAffForm(f => ({ ...f, quantite: e.target.value }))}
                  placeholder={affProduit ? `Max : ${affProduit.stock}` : "Sélectionnez d'abord un produit"}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm disabled:opacity-50"
                />
                {affProduit && affForm.quantite && Number(affForm.quantite) > 0 && (
                  <p className="text-xs mt-1">
                    {Number(affForm.quantite) > affProduit.stock
                      ? <span className="text-red-600">⚠ Quantité supérieure au stock disponible</span>
                      : <span className="text-slate-500">Stock après affectation : <b>{affProduit.stock - Number(affForm.quantite)} unités</b></span>
                    }
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Point de vente destination <span className="text-red-500">*</span>
                  </label>
                  {responsables.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAffPdVLibre(v => !v)}
                      className="text-xs text-purple-600 hover:text-purple-800 underline"
                    >
                      {affPdVLibre ? "Choisir un responsable" : "Saisie libre"}
                    </button>
                  )}
                </div>

                {!affPdVLibre && responsables.length > 0 ? (
                  <select
                    required
                    value={affForm.pointDeVente}
                    onChange={e => setAffForm(f => ({ ...f, pointDeVente: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                  >
                    <option value="">— Sélectionnez un responsable —</option>
                    {responsables.map(r => (
                      <option key={r.id} value={`${r.prenom} ${r.nom}`}>
                        {r.prenom} {r.nom}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={affForm.pointDeVente}
                    onChange={e => setAffForm(f => ({ ...f, pointDeVente: e.target.value }))}
                    placeholder="Ex : Point de vente Marché Central"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                  />
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Notes / Instructions
                </label>
                <input
                  type="text"
                  value={affForm.notes}
                  onChange={e => setAffForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex : Livraison prioritaire, garder au frais..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeAffModal}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    affLoading ||
                    !affProduit ||
                    !affForm.quantite ||
                    Number(affForm.quantite) <= 0 ||
                    Number(affForm.quantite) > (affProduit?.stock ?? 0) ||
                    !affForm.pointDeVente.trim() ||
                    (affProduit?.stock ?? 0) === 0
                  }
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {affLoading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {affLoading ? "Enregistrement..." : "Confirmer l'affectation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

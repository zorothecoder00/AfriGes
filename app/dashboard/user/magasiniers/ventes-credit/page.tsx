"use client";

import React, { useState, useCallback } from "react";
import {
  PackageCheck, RefreshCw, AlertCircle, Loader2, Package,
  Truck, CheckCircle, ChevronDown, ChevronUp, CreditCard,
  User, AlertTriangle, Banknote,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LigneCredit {
  id: number;
  produitId: number | null;
  produitNom: string | null;
  unite: string | null;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  horscatalogue: boolean;
}

interface VenteLivraison {
  id: number;
  reference: string;
  statut: "CREDIT_EN_LIVRAISON" | "CREDIT_LIVRE";
  montantTotal: number;
  createdAt: string;
  updatedAt: string;
  vendeur: string | null;
  client: { id: number | null; nom: string; telephone: string | null };
  creditClient: {
    id: number;
    reference: string;
    montantTotal: number;
    montantConsomme: number;
  } | null;
  lignes: LigneCredit[];
}

interface ApiResponse {
  aConfirmer: VenteLivraison[];
  livreesRecentes: VenteLivraison[];
  totalAConfirmer: number;
}

// ─── Types crédits RVC ──────────────────────────────────────────────────────────

interface LigneCreditEnAttente {
  id: number;
  produitNom: string;
  quantite: number;
  statut: string;
  estNouveauProduit: boolean;
  unite: string | null;
}

interface CreditRVC {
  id: number;
  reference: string;
  montantTotal: number;
  createdAt: string;
  client: { id: number; nom: string; telephone: string | null } | null;
  creePar: string | null;
  lignesEnAttente: LigneCreditEnAttente[];
}

interface CreditsRVCResponse {
  data: CreditRVC[];
  total: number;
}

// ─── Carte livraison ────────────────────────────────────────────────────────────

function LivraisonCard({
  vente,
  onConfirmer,
  loading,
}: {
  vente: VenteLivraison;
  onConfirmer?: (id: number) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const lignesCatalogue = vente.lignes.filter((l) => !l.horscatalogue);
  const lignesHorsCat   = vente.lignes.filter((l) => l.horscatalogue);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${
      vente.statut === "CREDIT_EN_LIVRAISON" ? "border-orange-200" : "border-gray-100"
    }`}>
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900">{vente.reference}</p>
            {vente.statut === "CREDIT_EN_LIVRAISON" ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                En livraison
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                Livré
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatDate(vente.createdAt)} · Agent : {vente.vendeur ?? "—"}
          </p>
        </div>
        <p className="text-xl font-bold text-gray-900 flex-shrink-0">{formatCurrency(vente.montantTotal)}</p>
      </div>

      {/* Client + crédit */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><User size={11} /> Client</p>
          <p className="font-medium text-gray-800 truncate">{vente.client.nom}</p>
          {vente.client.telephone && <p className="text-xs text-gray-500">{vente.client.telephone}</p>}
        </div>
        {vente.creditClient && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><CreditCard size={11} /> Crédit</p>
            <p className="text-xs font-medium text-gray-700">{vente.creditClient.reference}</p>
            <p className="text-xs text-gray-500">
              {formatCurrency(vente.creditClient.montantConsomme)} / {formatCurrency(vente.creditClient.montantTotal)}
            </p>
          </div>
        )}
      </div>

      {/* Lignes */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {vente.lignes.length} article{vente.lignes.length > 1 ? "s" : ""}
        {lignesHorsCat.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
            {lignesHorsCat.length} hors catalogue
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2">
          {/* Produits catalogue */}
          {lignesCatalogue.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-gray-400 font-medium mb-1">Produits catalogue (à sortir du stock)</p>
              {lignesCatalogue.map((l) => (
                <div key={l.id} className="flex justify-between text-xs text-gray-700">
                  <span>{l.produitNom ?? "—"} × {l.quantite}{l.unite ? ` ${l.unite}` : ""}</span>
                  <span className="font-medium">{formatCurrency(l.montant)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Produits hors catalogue */}
          {lignesHorsCat.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-purple-700 font-medium mb-1 flex items-center gap-1">
                <AlertTriangle size={12} />
                Produits hors catalogue (pas de sortie de stock automatique)
              </p>
              {lignesHorsCat.map((l) => (
                <div key={l.id} className="flex justify-between text-xs text-purple-800">
                  <span>{l.produitNom ?? "—"} × {l.quantite}</span>
                  <span className="font-medium">{formatCurrency(l.montant)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bouton confirmer */}
      {vente.statut === "CREDIT_EN_LIVRAISON" && onConfirmer && (
        <button
          onClick={() => onConfirmer(vente.id)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
          Confirmer la sortie de stock
        </button>
      )}

      {vente.statut === "CREDIT_LIVRE" && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs">
          <CheckCircle size={14} />
          Sortie de stock confirmée le {formatDate(vente.updatedAt)}
        </div>
      )}
    </div>
  );
}

// ─── Carte crédit à livrer ──────────────────────────────────────────────────────

function CreditLivraisonCard({
  credit,
  onLivrer,
  loadingLigneId,
}: {
  credit: CreditRVC;
  onLivrer: (creditId: number, ligneId: number) => void;
  loadingLigneId: number | null;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-3">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900">{credit.reference}</p>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              {credit.lignesEnAttente.length} ligne(s) en attente
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {formatDate(credit.createdAt)}{credit.creePar ? ` · Créé par ${credit.creePar}` : ""}
          </p>
        </div>
        <p className="text-lg font-bold text-gray-900 flex-shrink-0 flex items-center gap-1">
          <Banknote size={15} className="text-indigo-400" />
          {formatCurrency(credit.montantTotal)}
        </p>
      </div>

      {/* Client */}
      {credit.client && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User size={13} className="text-gray-400" />
          <span className="font-medium">{credit.client.nom}</span>
          {credit.client.telephone && <span className="text-gray-400 text-xs">{credit.client.telephone}</span>}
        </div>
      )}

      {/* Lignes */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Produits à livrer ({credit.lignesEnAttente.length})
      </button>

      {open && (
        <div className="space-y-2">
          {credit.lignesEnAttente.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 bg-indigo-50 rounded-xl px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{l.produitNom}</p>
                <p className="text-xs text-gray-500">
                  Quantité : {l.quantite}{l.unite ? ` ${l.unite}` : ""}
                  {l.estNouveauProduit && (
                    <span className="ml-1.5 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs">hors catalogue</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => onLivrer(credit.id, l.id)}
                disabled={loadingLigneId === l.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 shrink-0 transition-colors"
              >
                {loadingLigneId === l.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <PackageCheck size={13} />}
                Livré
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function MagasinierVentesCreditPage() {
  const [onglet,       setOnglet]       = useState<"aConfirmer" | "creditsRVC" | "historique">("aConfirmer");
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [loadingId,    setLoadingId]    = useState<number | null>(null);
  const [loadingLigne, setLoadingLigne] = useState<number | null>(null);

  const url = `/api/magasinier/ventes-credit?_k=${refreshKey}`;
  const { data, loading, error } = useApi<ApiResponse>(url);

  const urlCredits = `/api/magasinier/credits?_k=${refreshKey}`;
  const { data: creditsData, loading: creditsLoading, error: creditsError } = useApi<CreditsRVCResponse>(urlCredits);

  const aConfirmer      = data?.aConfirmer ?? [];
  const livreesRecentes = data?.livreesRecentes ?? [];
  const totalAConfirmer = data?.totalAConfirmer ?? 0;
  const creditsALivrer      = creditsData?.data ?? [];
  const totalCreditsALivrer = creditsData?.total ?? 0;

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleConfirmer = useCallback(async (id: number) => {
    setLoadingId(id);
    try {
      const res  = await fetch(`/api/magasinier/ventes-credit/${id}/confirmer`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        toast.success("Sortie de stock confirmée avec succès");
        handleRefresh();
      } else {
        toast.error(json.error ?? "Erreur lors de la confirmation");
      }
    } finally {
      setLoadingId(null);
    }
  }, [handleRefresh]);

  const handleLivrerLigne = useCallback(async (creditId: number, ligneId: number) => {
    setLoadingLigne(ligneId);
    try {
      const res  = await fetch(`/api/magasinier/credits/${creditId}/lignes/${ligneId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Truck size={16} className="text-white" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-base font-bold text-gray-900">Livraisons Crédit</h1>
                  <p className="text-xs text-gray-500">Magasinier</p>
                </div>
                {(totalAConfirmer + totalCreditsALivrer) > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                    {totalAConfirmer + totalCreditsALivrer}
                  </span>
                )}
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
        {/* Onglets */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 flex-wrap">
          <button
            onClick={() => setOnglet("aConfirmer")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === "aConfirmer" ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Truck size={15} />
            Ventes crédit
            {totalAConfirmer > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                onglet === "aConfirmer" ? "bg-white text-green-600" : "bg-orange-100 text-orange-700"
              }`}>
                {totalAConfirmer}
              </span>
            )}
          </button>
          <button
            onClick={() => setOnglet("creditsRVC")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === "creditsRVC" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <CreditCard size={15} />
            Crédits à livrer
            {totalCreditsALivrer > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                onglet === "creditsRVC" ? "bg-white text-indigo-600" : "bg-indigo-100 text-indigo-700"
              }`}>
                {totalCreditsALivrer}
              </span>
            )}
          </button>
          <button
            onClick={() => setOnglet("historique")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === "historique" ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <PackageCheck size={15} />
            Historique
          </button>
          <button
            onClick={handleRefresh}
            className="ml-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
          >
            <RefreshCw size={14} className={(loading || creditsLoading) ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-green-500" />
          </div>
        )}

        {/* Erreur */}
        {error && !loading && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* À confirmer */}
        {!loading && !error && onglet === "aConfirmer" && (
          <>
            {aConfirmer.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <PackageCheck size={48} className="mb-3 opacity-30" />
                <p className="text-base font-medium">Aucune livraison en attente</p>
                <p className="text-sm mt-1">Toutes les livraisons crédit ont été confirmées.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aConfirmer.map((v) => (
                  <LivraisonCard
                    key={v.id}
                    vente={v}
                    onConfirmer={handleConfirmer}
                    loading={loadingId === v.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Crédits clients à livrer */}
        {onglet === "creditsRVC" && (
          <>
            {creditsLoading && (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-indigo-500" />
              </div>
            )}
            {creditsError && !creditsLoading && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={16} /> {creditsError}
              </div>
            )}
            {!creditsLoading && !creditsError && creditsALivrer.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <PackageCheck size={48} className="mb-3 opacity-30" />
                <p className="text-base font-medium">Aucun crédit en attente de livraison</p>
                <p className="text-sm mt-1">Tous les produits des crédits actifs ont été livrés.</p>
              </div>
            )}
            {!creditsLoading && !creditsError && creditsALivrer.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{totalCreditsALivrer} crédit(s) avec des livraisons en attente</p>
                {creditsALivrer.map((credit) => (
                  <CreditLivraisonCard
                    key={credit.id}
                    credit={credit}
                    onLivrer={handleLivrerLigne}
                    loadingLigneId={loadingLigne}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Historique */}
        {!loading && !error && onglet === "historique" && (
          <>
            {livreesRecentes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Package size={48} className="mb-3 opacity-30" />
                <p className="text-base font-medium">Aucune livraison récente</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{livreesRecentes.length} livraison(s) sur les 30 derniers jours</p>
                {livreesRecentes.map((v) => (
                  <LivraisonCard key={v.id} vente={v} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

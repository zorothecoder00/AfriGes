"use client";

import React, { useState, useCallback } from "react";
import {
  PackageCheck, RefreshCw, AlertCircle, Loader2, Package,
  Truck, ChevronDown, ChevronUp, CreditCard,
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

interface LigneCreditEnAttente {
  id: number;
  produitNom: string;
  quantite: number;
  statut: string;
  estNouveauProduit: boolean;
  unite: string | null;
}

interface CreditALivrer {
  id: number;
  reference: string;
  montantTotal: number;
  createdAt: string;
  client: { id: number; nom: string; telephone: string | null } | null;
  creePar: string | null;
  lignesEnAttente: LigneCreditEnAttente[];
}

interface ApiResponse {
  data: CreditALivrer[];
  total: number;
}

// ─── Carte crédit à livrer ──────────────────────────────────────────────────────

function CreditLivraisonCard({
  credit,
  onLivrer,
  loadingLigneId,
}: {
  credit: CreditALivrer;
  onLivrer: (creditId: number, ligneId: number) => void;
  loadingLigneId: number | null;
}) {
  const [open, setOpen] = useState(true);

  const lignesCatalogue = credit.lignesEnAttente.filter((l) => !l.estNouveauProduit);
  const lignesHorsCat   = credit.lignesEnAttente.filter((l) => l.estNouveauProduit);

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-3">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900">{credit.reference}</p>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              {credit.lignesEnAttente.length} ligne(s) à livrer
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

      {/* Lignes hors catalogue avertissement */}
      {lignesHorsCat.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {lignesHorsCat.length} produit(s) hors catalogue — confirmer la livraison physique manuellement.
          </span>
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
          {/* Produits catalogue */}
          {lignesCatalogue.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">Produits catalogue (sortie de stock)</p>
              {lignesCatalogue.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.produitNom}</p>
                    <p className="text-xs text-gray-500">Qté : {l.quantite}{l.unite ? ` ${l.unite}` : ""}</p>
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

          {/* Produits hors catalogue */}
          {lignesHorsCat.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-amber-700 font-medium">Produits hors catalogue (pas de stock)</p>
              {lignesHorsCat.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2.5 border border-amber-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.produitNom}</p>
                    <p className="text-xs text-gray-500">Qté : {l.quantite}</p>
                  </div>
                  <button
                    onClick={() => onLivrer(credit.id, l.id)}
                    disabled={loadingLigneId === l.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 shrink-0 transition-colors"
                  >
                    {loadingLigneId === l.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <PackageCheck size={13} />}
                    Confirmé
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function MagasinierVentesCreditPage() {
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [loadingLigne, setLoadingLigne] = useState<number | null>(null);

  const url = `/api/magasinier/credits?_k=${refreshKey}`;
  const { data, loading, error } = useApi<ApiResponse>(url);

  const credits        = data?.data ?? [];
  const totalALivrer   = data?.total ?? 0;

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleLivrer = useCallback(async (creditId: number, ligneId: number) => {
    setLoadingLigne(ligneId);
    try {
      const res  = await fetch(`/api/magasinier/credits/${creditId}/lignes/${ligneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
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
                {totalALivrer > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                    {totalALivrer}
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
        {/* En-tête avec refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-500" />
              Crédits à livrer
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Crédits actifs avec des produits en attente de livraison physique
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
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

        {/* Liste des crédits */}
        {!loading && !error && credits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package size={48} className="mb-3 opacity-30" />
            <p className="text-base font-medium">Aucun crédit en attente de livraison</p>
            <p className="text-sm mt-1">Tous les produits des crédits actifs ont été livrés.</p>
          </div>
        )}

        {!loading && !error && credits.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{totalALivrer} crédit(s) avec des livraisons en attente</p>
            {credits.map((credit) => (
              <CreditLivraisonCard
                key={credit.id}
                credit={credit}
                onLivrer={handleLivrer}
                loadingLigneId={loadingLigne}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

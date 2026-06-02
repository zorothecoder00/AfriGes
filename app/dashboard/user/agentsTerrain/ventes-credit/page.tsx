"use client";

import React, { useState, useCallback } from "react";
import {
  CreditCard, RefreshCw, Clock, CheckCircle, XCircle,
  AlertCircle, Loader2, Package, Truck, PackageCheck,
  Navigation, ChevronDown, ChevronUp,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

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
  pointDeVente: { nom: string } | null;
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

interface VentesResponse {
  data: VenteCredit[];
  affectation: { nom: string } | null;
  stats: { total: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ONGLETS: { id: StatutVente; label: string; icon: React.ReactNode }[] = [
  { id: "CREDIT_REQUEST",      label: "En attente",   icon: <Clock size={14} /> },
  { id: "CREDIT_APPROUVE",     label: "À livrer",     icon: <Truck size={14} /> },
  { id: "CREDIT_EN_LIVRAISON", label: "En cours",     icon: <Navigation size={14} /> },
  { id: "CREDIT_LIVRE",        label: "Livrés",       icon: <PackageCheck size={14} /> },
  { id: "CREDIT_REFUSE",       label: "Refusés",      icon: <XCircle size={14} /> },
];

function statutBadge(s: StatutVente) {
  const map: Record<StatutVente, { bg: string; text: string; label: string }> = {
    CREDIT_REQUEST:      { bg: "bg-yellow-100", text: "text-yellow-800", label: "En attente RVC" },
    CREDIT_APPROUVE:     { bg: "bg-blue-100",   text: "text-blue-800",   label: "Approuvé — À livrer" },
    CREDIT_REFUSE:       { bg: "bg-red-100",    text: "text-red-800",    label: "Refusé" },
    CREDIT_EN_LIVRAISON: { bg: "bg-orange-100", text: "text-orange-800", label: "En livraison" },
    CREDIT_LIVRE:        { bg: "bg-green-100",  text: "text-green-800",  label: "Livré ✓" },
  };
  const s2 = map[s];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s2.bg} ${s2.text}`}>
      {s2.label}
    </span>
  );
}

// ─── Carte vente ────────────────────────────────────────────────────────────────

function VenteCreditCard({
  vente,
  onPartirLivrer,
  loading,
}: {
  vente: VenteCredit;
  onPartirLivrer: (id: number) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const nomClient = vente.client ? `${vente.client.prenom} ${vente.client.nom}` : vente.clientNom ?? "—";
  const nbHorsCat = vente.lignes.filter((l) => l.horscatalogue).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900">{vente.reference}</p>
            {statutBadge(vente.statut)}
            {nbHorsCat > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {nbHorsCat} hors catalogue
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{formatDate(vente.createdAt)} · {vente.pointDeVente?.nom ?? "—"}</p>
        </div>
        <p className="text-xl font-bold text-gray-900 flex-shrink-0">{formatCurrency(vente.montantTotal)}</p>
      </div>

      {/* Client */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">Client</p>
          <p className="font-medium text-gray-800">{nomClient}</p>
        </div>
        {vente.creditClient && (
          <div>
            <p className="text-xs text-gray-400">Crédit #{vente.creditClient.reference}</p>
            <p className="text-xs text-gray-600">
              Consommé : {formatCurrency(vente.creditClient.montantConsomme)} / {formatCurrency(vente.creditClient.montantTotal)}
            </p>
          </div>
        )}
      </div>

      {/* Lignes collapse */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {vente.lignes.length} article{vente.lignes.length > 1 ? "s" : ""}
      </button>

      {open && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          {vente.lignes.map((l) => (
            <div key={l.id} className="flex justify-between text-xs text-gray-700">
              <span className="flex items-center gap-1.5">
                {l.horscatalogue && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" title="Hors catalogue" />}
                {l.produitNom ?? "—"} × {l.quantite}{l.unite ? ` ${l.unite}` : ""}
              </span>
              <span className="font-medium">{formatCurrency(l.montant)}</span>
            </div>
          ))}
        </div>
      )}

      {vente.notes && (
        <p className="text-xs text-gray-500 italic">Note : {vente.notes}</p>
      )}

      {/* Action : Partir livrer */}
      {vente.statut === "CREDIT_APPROUVE" && (
        <button
          onClick={() => onPartirLivrer(vente.id)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
          Partir livrer
        </button>
      )}

      {/* Info refus */}
      {vente.statut === "CREDIT_REFUSE" && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <XCircle size={14} />
          Demande refusée par le Responsable Crédit
        </div>
      )}

      {vente.statut === "CREDIT_EN_LIVRAISON" && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-xs">
          <Truck size={14} />
          En route — le magasinier va confirmer la sortie de stock
        </div>
      )}

      {vente.statut === "CREDIT_LIVRE" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs">
          <CheckCircle size={14} />
          Livraison confirmée par le magasinier
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AgentVentesCreditPage() {
  const [onglet,       setOnglet]       = useState<StatutVente>("CREDIT_APPROUVE");
  const [page,         setPage]         = useState(1);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [loadingId,    setLoadingId]    = useState<number | null>(null);

  const url = `/api/agentTerrain/ventes?statut=${onglet}&page=${page}&limit=20&_k=${refreshKey}`;
  const { data, loading, error } = useApi<VentesResponse>(url);

  const ventes = data?.data ?? [];
  const meta   = data?.meta;

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const handleOnglet  = useCallback((s: StatutVente) => { setOnglet(s); setPage(1); }, []);

  const handlePartirLivrer = useCallback(async (id: number) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/agentTerrain/ventes-credit/${id}/partir-livrer`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        toast.success("Livraison lancée — le magasinier a été notifié");
        handleRefresh();
      } else {
        toast.error(json.error ?? "Erreur lors de l'envoi");
      }
    } finally {
      setLoadingId(null);
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <CreditCard size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Mes ventes à crédit</h1>
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
        {/* Onglets */}
        <div className="flex flex-wrap items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => handleOnglet(o.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                onglet === o.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
          <button
            onClick={handleRefresh}
            className="ml-auto p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Hint "À livrer" */}
        {onglet === "CREDIT_APPROUVE" && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
            <Truck size={16} />
            Ces ventes ont été approuvées. Cliquez sur <strong>Partir livrer</strong> pour notifier le magasinier.
          </div>
        )}

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
            <Package size={48} className="mb-3 opacity-30" />
            <p className="text-base font-medium">Aucune vente dans ce statut</p>
          </div>
        )}

        {/* Liste */}
        {!loading && !error && ventes.length > 0 && (
          <div className="space-y-4">
            {ventes.map((v) => (
              <VenteCreditCard
                key={v.id}
                vente={v}
                onPartirLivrer={handlePartirLivrer}
                loading={loadingId === v.id}
              />
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

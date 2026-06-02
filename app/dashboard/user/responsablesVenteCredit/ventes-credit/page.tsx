"use client";

import React, { useState, useCallback } from "react";
import {
  ShoppingBag, RefreshCw, CheckCircle, XCircle, Clock,
  AlertCircle, Loader2, Package, Eye, Truck, PackageCheck,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi } from "@/hooks/useApi";
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
  const [onglet,     setOnglet]     = useState<StatutVente>("CREDIT_REQUEST");
  const [page,       setPage]       = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

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
          <button
            onClick={handleRefresh}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
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

function VenteCreditCard({ vente, onRefresh }: { vente: VenteCredit; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);

  const nbHorsCat = vente.lignes.filter((l) => l.horscatalogue).length;
  const creditDispo = vente.creditClient
    ? vente.creditClient.montantTotal - vente.creditClient.montantConsomme
    : null;

  return (
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
          {vente.notes && (
            <p className="text-xs text-gray-500 italic truncate">Note : {vente.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

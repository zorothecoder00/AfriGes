"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ShoppingCart, Package, User, CreditCard,
  Calendar, AlertTriangle, CheckCircle, XCircle, Trash2,
  ChevronRight, DollarSign, TrendingDown, Wallet,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vente {
  id: number;
  quantite: number;
  prixUnitaire: string;
  createdAt: string;
  produit: {
    id: number;
    nom: string;
    prixUnitaire: string;
    stock: number;
    description?: string | null;
  };
  creditAlimentaire: {
    id: number;
    plafond: string;
    montantUtilise: string;
    montantRestant: string;
    statut: string;
    source: string;
    sourceId: number;
    dateAttribution: string;
    dateExpiration?: string | null;
    member: { id: number; nom: string; prenom: string; email: string } | null;
    client: { id: number; nom: string; prenom: string; telephone: string } | null;
  };
}

interface VenteResponse {
  data: Vente;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statutBadge(statut: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIF:  { label: "Actif",  cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
    EPUISE: { label: "Épuisé", cls: "bg-orange-100  text-orange-700  border border-orange-200"  },
    EXPIRE: { label: "Expiré", cls: "bg-slate-100   text-slate-600   border border-slate-200"   },
  };
  const s = map[statut] ?? { label: statut, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      {statut === "ACTIF"  && <CheckCircle size={12} />}
      {statut === "EPUISE" && <AlertTriangle size={12} />}
      {statut === "EXPIRE" && <XCircle size={12} />}
      {s.label}
    </span>
  );
}

function sourceLabel(source: string) {
  return source === "COTISATION" ? "Cotisation" : "Tontine";
}

function getInitials(nom: string, prenom: string) {
  return `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenteDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: response, loading, error } = useApi<VenteResponse>(`/api/admin/ventes/${id}`);

  const { mutate: deleteVente, loading: deleting } = useMutation(
    `/api/admin/ventes/${id}`,
    "DELETE",
    { successMessage: "Vente annulée avec succès" }
  );

  const handleDelete = async () => {
    const ok = await deleteVente({});
    if (ok) router.push("/dashboard/admin/ventes");
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !response?.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600 font-medium">{error ?? "Vente introuvable"}</p>
          <Link
            href="/dashboard/admin/ventes"
            className="mt-4 inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <ArrowLeft size={16} />
            Retour aux ventes
          </Link>
        </div>
      </div>
    );
  }

  const v = response.data;
  const credit = v.creditAlimentaire;
  const person = credit.member ?? credit.client;
  const personEmail = credit.member?.email ?? null;
  const personTel = credit.client?.telephone ?? null;
  const personSub = personEmail ?? personTel ?? "";
  const nom = person?.nom ?? "Inconnu";
  const prenom = person?.prenom ?? "";
  const montantTotal = v.quantite * Number(v.prixUnitaire);
  const plafond = Number(credit.plafond);
  const utilise = Number(credit.montantUtilise);
  const restant = Number(credit.montantRestant);
  const usagePct = plafond > 0 ? Math.min(100, Math.round((utilise / plafond) * 100)) : 0;
  const creditClientId = credit.client?.id;
  const creditMemberId = credit.member?.id;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin/ventes"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                <Link href="/dashboard/admin/ventes" className="hover:text-emerald-600">Ventes</Link>
                <ChevronRight size={12} />
                <span className="text-slate-800 font-medium">Vente #{v.id}</span>
              </nav>
              <h1 className="text-xl font-bold text-slate-900">Détail de la vente</h1>
            </div>
          </div>

          {/* Annuler la vente */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} />
              Annuler la vente
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 font-medium">Confirmer l&apos;annulation ?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Annulation…" : "Oui, annuler"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Non
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Résumé vente ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ShoppingCart size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Vente #{v.id}</h2>
              <p className="text-xs text-slate-500">{formatDateTime(v.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
            <div className="px-6 py-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Produit</p>
              <p className="font-semibold text-slate-800">{v.produit.nom}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Quantité</p>
              <p className="font-semibold text-slate-800">{v.quantite} unité{v.quantite > 1 ? "s" : ""}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Prix unitaire</p>
              <p className="font-semibold text-slate-800">{formatCurrency(v.prixUnitaire)}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Montant total</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(montantTotal)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Client ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <User size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Client</h2>
            </div>
            <div className="px-6 py-5">
              {person ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md flex-shrink-0">
                    {getInitials(nom, prenom)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900">{prenom} {nom}</p>
                    {personSub && (
                      <p className="text-sm text-slate-500 truncate">{personSub}</p>
                    )}
                    {(creditClientId || creditMemberId) && (
                      <Link
                        href={
                          creditClientId
                            ? `/dashboard/admin/clients/${creditClientId}`
                            : `/dashboard/admin/membres/${creditMemberId}`
                        }
                        className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Voir le profil
                        <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Client introuvable</p>
              )}
            </div>
          </div>

          {/* ── Produit ────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Package size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Produit</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-slate-900">{v.produit.nom}</p>
                  {v.produit.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{v.produit.description}</p>
                  )}
                </div>
                <Link
                  href={`/dashboard/admin/stock/${v.produit.id}`}
                  className="ml-3 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium flex-shrink-0"
                >
                  Voir le stock
                  <ChevronRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500 mb-0.5">Prix catalogue</p>
                  <p className="font-semibold text-slate-800">{formatCurrency(v.produit.prixUnitaire)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500 mb-0.5">Stock actuel</p>
                  <p className={`font-semibold ${v.produit.stock === 0 ? "text-red-600" : "text-slate-800"}`}>
                    {v.produit.stock} unité{v.produit.stock > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Crédit alimentaire ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Crédit alimentaire #{credit.id}</h2>
            </div>
            <Link
              href={`/dashboard/admin/creditsAlimentaires/${credit.id}`}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              Voir le crédit
              <ChevronRight size={12} />
            </Link>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Statut + source */}
            <div className="flex flex-wrap items-center gap-3">
              {statutBadge(credit.statut)}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                {sourceLabel(credit.source)}
              </span>
            </div>

            {/* Barre de consommation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Consommation du crédit</span>
                <span className="text-xs font-semibold text-slate-700">{usagePct}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePct >= 100 ? "bg-red-500" : usagePct >= 80 ? "bg-orange-400" : "bg-emerald-500"
                  }`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>

            {/* Montants */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wallet size={15} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 mb-0.5">Plafond</p>
                  <p className="font-bold text-blue-800">{formatCurrency(credit.plafond)}</p>
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={15} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-orange-600 mb-0.5">Utilisé</p>
                  <p className="font-bold text-orange-800">{formatCurrency(credit.montantUtilise)}</p>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Restant</p>
                  <p className="font-bold text-emerald-800">{formatCurrency(credit.montantRestant)}</p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                <span>
                  Attribué le{" "}
                  <span className="font-medium text-slate-800">{formatDate(credit.dateAttribution)}</span>
                </span>
              </div>
              {credit.dateExpiration && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                  <span>
                    Expire le{" "}
                    <span className="font-medium text-slate-800">{formatDate(credit.dateExpiration)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Impact de cette vente ────────────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={15} />
            Impact de cette vente sur le crédit
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-amber-600 text-xs mb-0.5">Montant débité</p>
              <p className="font-bold text-amber-900">{formatCurrency(montantTotal)}</p>
            </div>
            <div>
              <p className="text-amber-600 text-xs mb-0.5">Avant vente</p>
              <p className="font-bold text-amber-900">
                {formatCurrency(restant + montantTotal)}
              </p>
            </div>
            <div>
              <p className="text-amber-600 text-xs mb-0.5">Après vente</p>
              <p className="font-bold text-amber-900">{formatCurrency(restant)}</p>
            </div>
            <div>
              <p className="text-amber-600 text-xs mb-0.5">Date</p>
              <p className="font-bold text-amber-900">{formatDateTime(v.createdAt)}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

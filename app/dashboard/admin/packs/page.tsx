"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, ArrowLeft, Package, Layers, Users, CheckCircle,
  Clock, AlertTriangle, XCircle, ChevronRight, ChevronDown, ChevronUp,
  Truck, CreditCard, RefreshCw, Edit2, ToggleLeft, ToggleRight, Trash2,
  Calendar, Phone, User, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypePack = "ALIMENTAIRE" | "REVENDEUR" | "FAMILIAL" | "URGENCE" | "EPARGNE_PRODUIT" | "FIDELITE";
type StatutSouscription = "EN_ATTENTE" | "ACTIF" | "SUSPENDU" | "COMPLETE" | "ANNULE";
type StatutEcheance = "EN_ATTENTE" | "PAYE" | "EN_RETARD" | "ANNULE";

interface Pack {
  id: number;
  nom: string;
  type: TypePack;
  description?: string;
  actif: boolean;
  dureeJours?: number;
  frequenceVersement: string;
  montantVersement?: number;
  formuleRevendeur?: string;
  montantCredit?: number;
  montantSeuil?: number;
  bonusPourcentage?: number;
  cyclesBonusTrigger?: number;
  acomptePercent?: number;
  pointsParTranche?: number;
  montantTranche?: number;
  _count?: { souscriptions: number };
}

interface Souscription {
  id: number;
  pack: { nom: string; type: TypePack };
  user?: { nom: string; prenom: string; telephone?: string };
  client?: { nom: string; prenom: string; telephone: string };
  statut: StatutSouscription;
  formuleRevendeur?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  numeroCycle: number;
  dateDebut: string;
  dateFin?: string;
  dateCloture?: string;
  notes?: string;
  enregistrePar?: string;
  _count?: { versements: number; echeances: number; receptions: number };
  echeances?: Echeance[];
}

interface Echeance {
  id: number;
  numero: number;
  montant: number;
  datePrevue: string;
  datePaiement?: string;
  statut: StatutEcheance;
  souscription: {
    id: number;
    pack: { nom: string; type: TypePack };
    client?: { nom: string; prenom: string; telephone: string };
    user?: { nom: string; prenom: string; telephone?: string };
  };
}

interface SouscriptionsData {
  souscriptions: Souscription[];
  stats: { statut: StatutSouscription; _count: number; _sum: { montantVerse: number; montantTotal: number } }[];
}

interface EcheancesData {
  echeances: Echeance[];
  stats: { statut: string; _count: number; _sum: { montant: number } }[];
}

interface ReceptionPack {
  id: number;
  statut: "PLANIFIEE" | "LIVREE" | "ANNULEE";
  datePrevisionnelle?: string;
  livreurNom?: string;
  souscription: {
    id: number;
    montantTotal: number;
    pack: { nom: string; type: TypePack };
    client?: { nom: string; prenom: string; telephone: string };
    user?: { nom: string; prenom: string };
  };
  lignes: { produit: { nom: string }; quantite: number; prixUnitaire: string }[];
}

interface ReceptionsPackResponse {
  receptions: ReceptionPack[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: { totalPlanifiees: number };
}

interface ClientOption {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
}

interface Produit {
  id: number;
  nom: string;
  prixUnitaire: string;
  stock: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PACK_COLORS: Record<TypePack, { bg: string; text: string; border: string; badge: string }> = {
  ALIMENTAIRE:   { bg: "bg-green-50",   text: "text-green-800",   border: "border-green-200",  badge: "bg-green-100 text-green-800" },
  REVENDEUR:     { bg: "bg-blue-50",    text: "text-blue-800",    border: "border-blue-200",   badge: "bg-blue-100 text-blue-800" },
  FAMILIAL:      { bg: "bg-purple-50",  text: "text-purple-800",  border: "border-purple-200", badge: "bg-purple-100 text-purple-800" },
  URGENCE:       { bg: "bg-red-50",     text: "text-red-800",     border: "border-red-200",    badge: "bg-red-100 text-red-800" },
  EPARGNE_PRODUIT: { bg: "bg-amber-50", text: "text-amber-800",   border: "border-amber-200",  badge: "bg-amber-100 text-amber-800" },
  FIDELITE:      { bg: "bg-pink-50",    text: "text-pink-800",    border: "border-pink-200",   badge: "bg-pink-100 text-pink-800" },
};

const PACK_LABELS: Record<TypePack, string> = {
  ALIMENTAIRE: "Alimentaire", REVENDEUR: "Revendeur", FAMILIAL: "Familial",
  URGENCE: "Urgence", EPARGNE_PRODUIT: "Épargne-Produit", FIDELITE: "Fidélité",
};

const STATUT_CFG: Record<StatutSouscription, { label: string; cls: string; icon: React.ReactNode }> = {
  EN_ATTENTE: { label: "En attente", cls: "bg-gray-100 text-gray-700",  icon: <Clock className="w-3 h-3" /> },
  ACTIF:      { label: "Actif",      cls: "bg-blue-100 text-blue-700",  icon: <RefreshCw className="w-3 h-3" /> },
  SUSPENDU:   { label: "Suspendu",   cls: "bg-amber-100 text-amber-700",icon: <AlertTriangle className="w-3 h-3" /> },
  COMPLETE:   { label: "Complet",    cls: "bg-green-100 text-green-700",icon: <CheckCircle className="w-3 h-3" /> },
  ANNULE:     { label: "Annulé",     cls: "bg-red-100 text-red-700",    icon: <XCircle className="w-3 h-3" /> },
};

const ECHEANCE_CFG: Record<StatutEcheance, string> = {
  EN_ATTENTE: "bg-gray-100 text-gray-700",
  PAYE:       "bg-green-100 text-green-700",
  EN_RETARD:  "bg-red-100 text-red-700",
  ANNULE:     "bg-slate-100 text-slate-500",
};

function nom(s: Souscription) {
  return s.client ? `${s.client.prenom} ${s.client.nom}` : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
}
function tel(s: Souscription) { return s.client?.telephone ?? s.user?.telephone ?? "—"; }
function fmtD(d?: string) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }
function pct(v: number, t: number) { return t ? Math.min(100, Math.round((v / t) * 100)) : 0; }
function initials(n: string, p: string) { return `${(p?.[0] ?? "").toUpperCase()}${(n?.[0] ?? "").toUpperCase()}`; }

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "overview" | "modeles" | "souscriptions" | "echeances" | "livraisons";

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PacksAdminPage() {
  const [tab, setTab] = useState<Tab>("souscriptions");

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "souscriptions", label: "Souscriptions",      icon: <Users className="w-4 h-4" /> },
    { id: "echeances",     label: "Versements & Échéances", icon: <CreditCard className="w-4 h-4" /> },
    { id: "livraisons",    label: "Livraisons produits", icon: <Truck className="w-4 h-4" /> },
    { id: "modeles",       label: "Modèles de packs",    icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/10 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-1">Packs clients</h1>
            <p className="text-slate-500">Gérez les souscriptions, versements et livraisons par pack</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-white rounded-2xl border border-slate-200 p-1.5 w-fit shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "souscriptions" && <TabSouscriptions />}
        {tab === "echeances"     && <TabEcheances />}
        {tab === "livraisons"    && <TabLivraisons />}
        {tab === "modeles"       && <TabModeles />}
      </div>
    </div>
  );
}

// ─── TAB: Souscriptions ───────────────────────────────────────────────────────

function TabSouscriptions() {
  const [search, setSearch]     = useState("");
  const [dSearch, setDSearch]   = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterType, setFilterType]     = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [versementTarget, setVersementTarget] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams();
  if (dSearch)      params.set("search", dSearch);
  if (filterStatut) params.set("statut", filterStatut);
  if (filterType)   params.set("type", filterType);

  const { data, loading, refetch } = useApi<SouscriptionsData>(`/api/admin/packs/souscriptions?${params}`);
  const souscriptions = data?.souscriptions ?? [];
  const stats = data?.stats ?? [];

  const totalActifs  = stats.find((s) => s.statut === "ACTIF")?._count ?? 0;
  const totalEnAtt   = stats.find((s) => s.statut === "EN_ATTENTE")?._count ?? 0;
  const totalComplet = stats.find((s) => s.statut === "COMPLETE")?._count ?? 0;
  const totalVerse   = stats.reduce((acc, s) => acc + Number(s._sum?.montantVerse ?? 0), 0);

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Actives", val: totalActifs, cls: "text-blue-600", icon: <RefreshCw className="w-5 h-5" /> },
          { label: "En attente", val: totalEnAtt, cls: "text-amber-600", icon: <Clock className="w-5 h-5" /> },
          { label: "Complètes", val: totalComplet, cls: "text-green-600", icon: <CheckCircle className="w-5 h-5" /> },
          { label: "Total versé", val: formatCurrency(totalVerse), cls: "text-emerald-700", icon: <TrendingUp className="w-5 h-5" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-50 rounded-xl">{s.icon}</div>
              <span className="text-sm text-slate-500">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, prénom, téléphone…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
        <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="">Tous statuts</option>
          {(["EN_ATTENTE","ACTIF","SUSPENDU","COMPLETE","ANNULE"] as StatutSouscription[]).map((s) => (
            <option key={s} value={s}>{STATUT_CFG[s].label}</option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="">Tous types</option>
          {(Object.keys(PACK_LABELS) as TypePack[]).map((t) => (
            <option key={t} value={t}>{PACK_LABELS[t]}</option>
          ))}
        </select>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200"
        >
          <Plus className="w-4 h-4" /> Nouvelle souscription
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Chargement…</p>
          </div>
        ) : souscriptions.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucune souscription trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {souscriptions.map((s) => {
              const cfg = STATUT_CFG[s.statut];
              const colors = PACK_COLORS[s.pack.type];
              const progress = pct(Number(s.montantVerse), Number(s.montantTotal));
              const isExpanded = expanded === s.id;

              return (
                <div key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <div className="px-6 py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {initials(s.client?.nom ?? s.user?.nom ?? "?", s.client?.prenom ?? s.user?.prenom ?? "")}
                    </div>

                    {/* Client + pack */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-slate-800">{nom(s)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {PACK_LABELS[s.pack.type]}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {s.formuleRevendeur && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 font-medium">
                            {s.formuleRevendeur === "FORMULE_1" ? "F1" : "F2"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {tel(s)}</span>
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {s.pack.nom}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtD(s.dateDebut)}</span>
                      </div>
                    </div>

                    {/* Progression */}
                    <div className="w-40 hidden md:block">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{formatCurrency(s.montantVerse)}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progress >= 100 ? "bg-green-500" : progress >= 50 ? "bg-blue-500" : "bg-amber-400"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">/ {formatCurrency(s.montantTotal)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(s.statut === "ACTIF" || s.statut === "EN_ATTENTE") && (
                        <button
                          onClick={() => setVersementTarget(s.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Versement
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : s.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expand: détails */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-slate-400">Restant à payer</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(s.montantRestant)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Échéances en cours</p>
                          <p className="font-semibold text-slate-800">{s._count?.echeances ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Versements effectués</p>
                          <p className="font-semibold text-slate-800">{s._count?.versements ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Livraisons</p>
                          <p className="font-semibold text-slate-800">{s._count?.receptions ?? 0}</p>
                        </div>
                      </div>
                      {s.notes && (
                        <p className="mt-3 text-xs text-slate-500 italic">Note : {s.notes}</p>
                      )}
                      {s.enregistrePar && (
                        <p className="mt-1 text-xs text-slate-400">Enregistré par : {s.enregistrePar}</p>
                      )}
                      {/* Prochaine échéance */}
                      {s.echeances && s.echeances.length > 0 && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                          <p className="text-xs font-semibold text-amber-700 mb-1">Prochaine échéance</p>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Éch. #{s.echeances[0].numero} — {fmtD(s.echeances[0].datePrevue)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ECHEANCE_CFG[s.echeances[0].statut]}`}>
                              {s.echeances[0].statut === "EN_RETARD" ? "En retard" : "À payer"}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800 mt-1">{formatCurrency(s.echeances[0].montant)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ModalNouvelleSouscription
          onClose={() => setShowModal(false)}
          onSuccess={() => refetch()}
        />
      )}
      {versementTarget !== null && (
        <ModalVersement
          souscriptionId={versementTarget}
          onClose={() => setVersementTarget(null)}
          onSuccess={() => { refetch(); }}
        />
      )}
    </>
  );
}

// ─── TAB: Versements & Échéances ──────────────────────────────────────────────

function TabEcheances() {
  const [search, setSearch]   = useState("");
  const [dSearch, setDSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("EN_ATTENTE,EN_RETARD");
  const [versementTarget, setVersementTarget] = useState<{ souscriptionId: number; echeanceId: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ statut: filterStatut });
  if (dSearch) params.set("search", dSearch);

  const { data, loading, refetch } = useApi<EcheancesData>(`/api/admin/packs/echeances?${params}`);
  const echeances = data?.echeances ?? [];

  const retard = echeances.filter((e) => e.statut === "EN_RETARD").length;
  const enAtt  = echeances.filter((e) => e.statut === "EN_ATTENTE").length;

  return (
    <>
      {retard > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-red-700 font-medium text-sm">
            {retard} échéance{retard > 1 ? "s" : ""} en retard — action requise
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher client…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        </div>
        <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="EN_ATTENTE,EN_RETARD">En attente + En retard</option>
          <option value="EN_RETARD">En retard seulement</option>
          <option value="EN_ATTENTE">En attente seulement</option>
          <option value="PAYE">Payées</option>
        </select>
      </div>

      {/* Compteur */}
      <div className="flex gap-4 text-sm text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" /> {retard} en retard
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> {enAtt} à venir
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Chargement…</p>
          </div>
        ) : echeances.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {filterStatut === "PAYE"
                ? "Aucune échéance payée"
                : filterStatut === "EN_RETARD"
                ? "Aucune échéance en retard"
                : filterStatut === "EN_ATTENTE"
                ? "Aucune échéance en attente"
                : "Aucune échéance trouvée"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Client", "Pack", "Éch. N°", "Montant", "Date prévue", "Statut", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {echeances.map((e) => {
                const s = e.souscription;
                const clientNom = s.client ? `${s.client.prenom} ${s.client.nom}` : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
                return (
                  <tr key={e.id} className={`hover:bg-slate-50 transition-colors ${e.statut === "EN_RETARD" ? "bg-red-50/30" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {clientNom.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{clientNom}</p>
                          <p className="text-xs text-slate-400">{s.client?.telephone ?? s.user?.telephone ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PACK_COLORS[s.pack.type].badge}`}>
                        {PACK_LABELS[s.pack.type]}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">{s.pack.nom}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">#{e.numero}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{formatCurrency(e.montant)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{fmtD(e.datePrevue)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ECHEANCE_CFG[e.statut]}`}>
                        {e.statut === "EN_RETARD" && <AlertTriangle className="w-3 h-3" />}
                        {e.statut === "EN_ATTENTE" && <Clock className="w-3 h-3" />}
                        {e.statut === "PAYE" && <CheckCircle className="w-3 h-3" />}
                        {e.statut === "EN_RETARD" ? "En retard" : e.statut === "PAYE" ? "Payée" : e.statut === "ANNULE" ? "Annulée" : "À payer"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {(e.statut === "EN_ATTENTE" || e.statut === "EN_RETARD") && (
                        <button
                          onClick={() => setVersementTarget({ souscriptionId: s.id, echeanceId: e.id })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Payer
                        </button>
                      )}
                      {e.statut === "PAYE" && e.datePaiement && (
                        <span className="text-xs text-slate-400">{fmtD(e.datePaiement)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {versementTarget && (
        <ModalVersement
          souscriptionId={versementTarget.souscriptionId}
          echeanceId={versementTarget.echeanceId}
          onClose={() => setVersementTarget(null)}
          onSuccess={() => { refetch(); setVersementTarget(null); }}
        />
      )}
    </>
  );
}

// ─── TAB: Livraisons produits ─────────────────────────────────────────────────

function TabLivraisons() {
  const [livraisonTarget, setLivraisonTarget] = useState<Souscription | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: sData, loading: loadingS, refetch: refetchS } = useApi<SouscriptionsData>(
    "/api/admin/packs/souscriptions?statut=EN_ATTENTE,ACTIF,COMPLETE"
  );

  const { data: recData, loading: loadingR, refetch: refetchR } = useApi<ReceptionsPackResponse>(
    "/api/admin/packs/receptions?statut=PLANIFIEE&limit=100"
  );

  const { mutate: doCancel } = useMutation<ReceptionPack, object>(
    cancellingId !== null ? `/api/admin/packs/receptions/${cancellingId}` : "",
    "DELETE",
    { successMessage: "Livraison annulée" }
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cancellingId === null) return;
    doCancel({}).then((res) => {
      if (res) { refetchS(); refetchR(); }
      setCancellingId(null);
    });
  }, [cancellingId]);

  const planifiees = recData?.receptions ?? [];
  // Souscriptions qui ont déjà une livraison PLANIFIEE en cours
  const souscriptionsAvecPlanifiees = new Set(planifiees.map((r) => r.souscription.id));

  // Éligibles : selon type/statut ET sans livraison PLANIFIEE en cours
  const aLivrer = (sData?.souscriptions ?? []).filter((s) => {
    if (souscriptionsAvecPlanifiees.has(s.id)) return false;
    if (s.pack.type === "URGENCE" && s.statut === "ACTIF") return true;
    if (s.pack.type === "REVENDEUR" && s.formuleRevendeur === "FORMULE_1" && s.statut === "ACTIF") return true;
    if (s.pack.type === "REVENDEUR" && s.formuleRevendeur === "FORMULE_2") return true;
    return s.statut === "COMPLETE";
  });

  const loading = loadingS || loadingR;
  const handleRefresh = () => { refetchS(); refetchR(); };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Livraisons produits</h2>
          <p className="text-sm text-slate-500 mt-0.5">Planifiez et suivez les livraisons vers les clients</p>
        </div>
        <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* ── Section 1 : Livraisons planifiées (annulables) ── */}
      {planifiees.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-500" />
            Livraisons planifiées
            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">
              {planifiees.length}
            </span>
          </h3>
          <div className="grid gap-3">
            {planifiees.map((rec) => {
              const colors = PACK_COLORS[rec.souscription.pack.type];
              const montant = rec.lignes.reduce((s, l) => s + l.quantite * Number(l.prixUnitaire), 0);
              const clientNomR = rec.souscription.client
                ? `${rec.souscription.client.prenom} ${rec.souscription.client.nom}`
                : rec.souscription.user
                ? `${rec.souscription.user.prenom} ${rec.souscription.user.nom}`
                : "—";
              const clientTelR = rec.souscription.client?.telephone ?? "—";
              return (
                <div key={rec.id} className={`bg-white rounded-2xl border ${colors.border} p-5 shadow-sm flex items-center justify-between gap-4`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-3 ${colors.bg} rounded-xl shrink-0`}>
                      <Truck className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {PACK_LABELS[rec.souscription.pack.type]}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Planifiée
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800">{rec.souscription.pack.nom}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <User className="w-3.5 h-3.5" /> {clientNomR} — {clientTelR}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {rec.lignes.map((l) => `${l.produit.nom} × ${l.quantite}`).join(", ")}
                        {" · "}{formatCurrency(montant)}
                        {rec.datePrevisionnelle && ` · prévu ${fmtD(rec.datePrevisionnelle)}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCancellingId(rec.id)}
                    disabled={cancellingId === rec.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl hover:bg-red-100 text-sm font-medium transition-all shrink-0 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {cancellingId === rec.id ? "Annulation…" : "Annuler"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 2 : Souscriptions à livrer ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          Souscriptions à livrer
        </h3>
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Chargement…</p>
          </div>
        ) : aLivrer.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucune souscription en attente de livraison</p>
            <p className="text-slate-400 text-sm mt-1">Les packs éligibles (soldés, ou URGENCE/Revendeur F1 actifs) apparaîtront ici.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {aLivrer.map((s) => {
              const colors = PACK_COLORS[s.pack.type];
              return (
                <div key={s.id} className={`bg-white rounded-2xl border ${colors.border} p-5 shadow-sm flex items-center justify-between gap-4`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 ${colors.bg} rounded-xl`}>
                      <Package className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {PACK_LABELS[s.pack.type]}
                        </span>
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Livraison en attente
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800">{s.pack.nom}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <User className="w-3.5 h-3.5" /> {nom(s)} — {tel(s)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.statut === "COMPLETE"
                          ? `Soldé le ${fmtD(s.dateCloture)}`
                          : `Actif depuis ${fmtD(s.dateDebut)}`} — {formatCurrency(s.montantTotal)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLivraisonTarget(s)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200 shrink-0"
                  >
                    <Truck className="w-4 h-4" /> Planifier livraison
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {livraisonTarget !== null && (
        <ModalPlanifierLivraison
          souscription={livraisonTarget}
          onClose={() => setLivraisonTarget(null)}
          onSuccess={() => { refetchS(); refetchR(); setLivraisonTarget(null); }}
        />
      )}
    </>
  );
}

// ─── TAB: Modèles de packs ────────────────────────────────────────────────────

function TabModeles() {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Pack | null>(null);
  const [togglePackId, setTogglePackId] = useState<number | null>(null);
  const [toggleActif, setToggleActif] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pack | null>(null);

  const { data: packs, loading, refetch } = useApi<Pack[]>("/api/admin/packs");

  const { mutate: doToggle } = useMutation(
    togglePackId !== null ? `/api/admin/packs/${togglePackId}` : "",
    "PUT"
  );

  const { mutate: doDelete, loading: deleting } = useMutation(
    deleteTarget !== null ? `/api/admin/packs/${deleteTarget.id}` : "",
    "DELETE"
  );

  useEffect(() => {
    if (togglePackId === null) return;
    doToggle({ actif: toggleActif }).then((res) => {
      if (res) refetch();
      setTogglePackId(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePackId]);

  function handleToggle(pack: Pack) {
    setToggleActif(!pack.actif);
    setTogglePackId(pack.id);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    doDelete({}).then((res) => {
      if (res) {
        refetch();
        setDeleteTarget(null);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Modèles de packs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Configurez les types de packs disponibles</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200"
        >
          <Plus className="w-4 h-4" /> Créer un pack
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(packs ?? []).map((pack) => {
            const colors = PACK_COLORS[pack.type];
            return (
              <div key={pack.id} className={`bg-white rounded-2xl border ${colors.border} p-5 shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${colors.badge}`}>
                    {PACK_LABELS[pack.type]}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditTarget(pack)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(pack)}
                      className={`p-1.5 rounded-lg transition-colors ${pack.actif ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}
                      title={pack.actif ? "Désactiver" : "Activer"}
                    >
                      {pack.actif ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(pack)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-800 text-lg mb-1">{pack.nom}</h3>
                {pack.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{pack.description}</p>}

                <div className="space-y-1.5 text-xs text-slate-600">
                  {pack.dureeJours && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Durée</span>
                      <span className="font-medium">{pack.dureeJours} jours</span>
                    </div>
                  )}
                  {pack.montantVersement && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Versement ({pack.frequenceVersement.toLowerCase()})</span>
                      <span className="font-medium">{formatCurrency(pack.montantVersement)}</span>
                    </div>
                  )}
                  {pack.acomptePercent && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Acompte min.</span>
                      <span className="font-medium">{pack.acomptePercent}%</span>
                    </div>
                  )}
                  {pack.bonusPourcentage && pack.cyclesBonusTrigger && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bonus</span>
                      <span className="font-medium">+{pack.bonusPourcentage}% après {pack.cyclesBonusTrigger} cycles</span>
                    </div>
                  )}
                  {pack.montantSeuil && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Seuil</span>
                      <span className="font-medium">{formatCurrency(pack.montantSeuil)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pack.actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {pack.actif ? "Actif" : "Inactif"}
                  </span>
                  <span className="text-xs text-slate-400">{pack._count?.souscriptions ?? 0} souscription(s)</span>
                </div>
              </div>
            );
          })}

          {(packs ?? []).length === 0 && (
            <div className="col-span-3 bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Aucun pack configuré</p>
              <p className="text-slate-400 text-sm mt-1">Créez votre premier pack pour commencer.</p>
            </div>
          )}
        </div>
      )}

      {(showCreate || editTarget) && (
        <ModalCreerPack
          pack={editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(null); }}
          onSuccess={() => { refetch(); setShowCreate(false); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Supprimer ce pack ?</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-2">
              Voulez-vous vraiment supprimer le pack{" "}
              <strong className="text-slate-900">&laquo;{deleteTarget.nom}&raquo;</strong> ?
            </p>
            {(deleteTarget._count?.souscriptions ?? 0) > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Ce pack a <strong>{deleteTarget._count!.souscriptions}</strong> souscription(s).
                La suppression sera bloquée si certaines sont encore actives ou en attente.
              </p>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Modal : Créer / Modifier un pack ─────────────────────────────────────────

function ModalCreerPack({ pack, onClose, onSuccess }: { pack: Pack | null; onClose: () => void; onSuccess: () => void }) {
  const isEdit = !!pack;
  const [form, setForm] = useState({
    nom: pack?.nom ?? "",
    type: pack?.type ?? "ALIMENTAIRE" as TypePack,
    description: pack?.description ?? "",
    dureeJours: pack?.dureeJours ? String(pack.dureeJours) : "",
    frequenceVersement: pack?.frequenceVersement ?? "HEBDOMADAIRE",
    montantVersement: pack?.montantVersement ? String(pack.montantVersement) : "",
    formuleRevendeur: pack?.formuleRevendeur ?? "",
    montantCredit: pack?.montantCredit ? String(pack.montantCredit) : "",
    montantSeuil: pack?.montantSeuil ? String(pack.montantSeuil) : "",
    bonusPourcentage: pack?.bonusPourcentage ? String(pack.bonusPourcentage) : "",
    cyclesBonusTrigger: pack?.cyclesBonusTrigger ? String(pack.cyclesBonusTrigger) : "",
    acomptePercent: pack?.acomptePercent ? String(pack.acomptePercent) : "",
    pointsParTranche: pack?.pointsParTranche ? String(pack.pointsParTranche) : "",
    montantTranche: pack?.montantTranche ? String(pack.montantTranche) : "",
  });

  // Auto-fixer fréquence, durée et acompte selon le type/formule
  useEffect(() => {
    if (form.type === "REVENDEUR") {
      if (form.formuleRevendeur === "FORMULE_1") {
        // F1 : hebdomadaire fixe, acompte 50% obligatoire
        setForm((p) => ({ ...p, frequenceVersement: "HEBDOMADAIRE", acomptePercent: "50" }));
      } else if (form.formuleRevendeur === "FORMULE_2") {
        // F2 : quotidien fixe, 16 jours fixes, acompte non applicable
        setForm((p) => ({ ...p, frequenceVersement: "QUOTIDIEN", dureeJours: "16", acomptePercent: "" }));
      }
    } else if (form.type === "ALIMENTAIRE") {
      setForm((p) => ({ ...p, dureeJours: p.dureeJours === "15" || p.dureeJours === "30" ? p.dureeJours : "" }));
    } else if (form.type === "FAMILIAL") {
      // Cycle 30j fixe, fréquence hebdo/bimensuel, bonus 10% après 3 cycles
      setForm((p) => ({
        ...p,
        dureeJours: "30",
        frequenceVersement: (p.frequenceVersement === "HEBDOMADAIRE" || p.frequenceVersement === "BIMENSUEL")
          ? p.frequenceVersement : "HEBDOMADAIRE",
        bonusPourcentage:    p.bonusPourcentage    || "10",
        cyclesBonusTrigger:  p.cyclesBonusTrigger  || "3",
      }));
    } else if (form.type === "URGENCE") {
      // Acompte 25% fixe, quotidien fixe, durée 7-10j
      setForm((p) => ({
        ...p,
        acomptePercent: "25",
        frequenceVersement: "QUOTIDIEN",
        dureeJours: ["7","8","9","10"].includes(p.dureeJours) ? p.dureeJours : "",
      }));
    }
  }, [form.type, form.formuleRevendeur]);

  // F2 : recalculer le versement quotidien quand le montant crédit change
  useEffect(() => {
    if (form.type === "REVENDEUR" && form.formuleRevendeur === "FORMULE_2" && form.montantCredit) {
      const daily = Math.ceil(parseFloat(form.montantCredit) / 16);
      if (!isNaN(daily)) setForm((p) => ({ ...p, montantVersement: String(daily) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.montantCredit]);

  // ALIMENTAIRE : réinitialiser la fréquence si elle devient incohérente avec la durée
  useEffect(() => {
    if (form.type !== "ALIMENTAIRE") return;
    if (form.dureeJours === "15" && form.frequenceVersement !== "QUOTIDIEN" && form.frequenceVersement !== "HEBDOMADAIRE") {
      setForm((p) => ({ ...p, frequenceVersement: "HEBDOMADAIRE" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dureeJours]);

  const { mutate: create, loading: creating } = useMutation("/api/admin/packs", "POST", { successMessage: "Pack créé !" });
  const { mutate: update, loading: updating } = useMutation(
    pack ? `/api/admin/packs/${pack.id}` : "",
    "PUT",
    { successMessage: "Pack mis à jour !" }
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      dureeJours: form.dureeJours || undefined,
      montantVersement: form.montantVersement || undefined,
      montantCredit: form.montantCredit || undefined,
      montantSeuil: form.montantSeuil || undefined,
      bonusPourcentage: form.bonusPourcentage || undefined,
      cyclesBonusTrigger: form.cyclesBonusTrigger || undefined,
      acomptePercent: form.acomptePercent || undefined,
      formuleRevendeur: form.type === "REVENDEUR" ? form.formuleRevendeur || undefined : undefined,
      pointsParTranche: form.pointsParTranche || undefined,
      montantTranche: form.montantTranche || undefined,
    };

    const ok = isEdit ? await update(payload) : await create(payload);
    if (ok) onSuccess();
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-800 mb-5">
          {isEdit ? "Modifier le pack" : "Créer un pack"}
        </h2>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
              <input required {...f("nom")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : Pack Alimentaire Mensuel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select required {...f("type")} disabled={isEdit}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-slate-50">
                {(Object.keys(PACK_LABELS) as TypePack[]).map((t) => (
                  <option key={t} value={t}>{PACK_LABELS[t]}</option>
                ))}
              </select>
            </div>
            {/* Fréquence : contrainte selon type, cachée pour FIDELITE */}
            {form.type !== "FIDELITE" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fréquence versement</label>
                {form.type === "REVENDEUR" ? (
                  <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-500">
                    {form.formuleRevendeur === "FORMULE_1" ? "Hebdomadaire (tontine) — fixe"
                      : form.formuleRevendeur === "FORMULE_2" ? "Quotidien (remboursement 16j) — fixe"
                      : "Sélectionnez d'abord une formule"}
                  </div>
                ) : form.type === "URGENCE" ? (
                  <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-500">
                    Quotidien — fixe (remboursement journalier)
                  </div>
                ) : form.type === "FAMILIAL" ? (
                  <select {...f("frequenceVersement")}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                    <option value="HEBDOMADAIRE">Hebdomadaire</option>
                    <option value="BIMENSUEL">Bimensuel</option>
                  </select>
                ) : form.type === "ALIMENTAIRE" && !form.dureeJours ? (
                  <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-400">
                    Choisissez d&apos;abord la durée
                  </div>
                ) : (
                  <select {...f("frequenceVersement")}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="QUOTIDIEN">Quotidien</option>
                    <option value="HEBDOMADAIRE">Hebdomadaire</option>
                    {(form.type !== "ALIMENTAIRE" || form.dureeJours === "30") && (
                      <option value="BIMENSUEL">Bimensuel</option>
                    )}
                    {(form.type !== "ALIMENTAIRE" || form.dureeJours === "30") && (
                      <option value="MENSUEL">Mensuel</option>
                    )}
                  </select>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea {...f("description")} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Durée (jours)</label>
              {form.type === "REVENDEUR" && form.formuleRevendeur === "FORMULE_2" ? (
                <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-500">
                  16 jours — fixe (F2)
                </div>
              ) : form.type === "ALIMENTAIRE" ? (
                <select required {...f("dureeJours")}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">— Choisir —</option>
                  <option value="15">15 jours</option>
                  <option value="30">30 jours</option>
                </select>
              ) : form.type === "FAMILIAL" ? (
                <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-500">
                  30 jours — fixe (1 cycle)
                </div>
              ) : form.type === "URGENCE" ? (
                <select required {...f("dureeJours")}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">— Choisir (7 à 10 j) —</option>
                  <option value="7">7 jours</option>
                  <option value="8">8 jours</option>
                  <option value="9">9 jours</option>
                  <option value="10">10 jours</option>
                </select>
              ) : form.type === "FIDELITE" ? (
                <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-400">
                  Sans durée (fidélité par points)
                </div>
              ) : (
                <input type="number" min="1" {...f("dureeJours")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 30" />
              )}
            </div>
            {/* Versement standard :
                - REVENDEUR : géré dans la section F1/F2 ci-dessous
                - URGENCE   : calculé par souscription (75% ÷ nb_jours), pas fixé au pack
                - FAMILIAL  : géré dans la section dédiée ci-dessous
                - FIDELITE  : pas de versement (points) */}
            {form.type !== "REVENDEUR" && form.type !== "URGENCE" && form.type !== "FAMILIAL" && form.type !== "FIDELITE" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {form.type === "EPARGNE_PRODUIT" ? "Épargne périodique (FCFA)" : "Versement standard (FCFA)"}
                </label>
                <input type="number" min="0" {...f("montantVersement")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 5000" />
                {form.type === "EPARGNE_PRODUIT" && (
                  <p className="text-xs text-slate-400 mt-1">Montant que le client met de côté à chaque échéance</p>
                )}
              </div>
            )}
          </div>

          {/* Champs conditionnels — REVENDEUR */}
          {form.type === "REVENDEUR" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              {/* Formule */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Formule *</label>
                <select required {...f("formuleRevendeur")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— Choisir une formule —</option>
                  <option value="FORMULE_1">Formule 1 — 50% upfront + remboursement tontine hebdo</option>
                  <option value="FORMULE_2">Formule 2 — Crédit total, remboursement quotidien 16j</option>
                </select>
              </div>

              {/* Montant du produit (commun F1 et F2) */}
              {form.formuleRevendeur && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix du produit (FCFA) *</label>
                  <input type="number" min="1" required {...f("montantCredit")}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex : 50 000" />
                </div>
              )}

              {/* FORMULE 1 : acompte 50% + tontine hebdo */}
              {form.formuleRevendeur === "FORMULE_1" && (
                <>
                  {form.montantCredit && (
                    <div className="flex items-center gap-3 p-3 bg-blue-100 rounded-xl text-sm text-blue-800">
                      <span className="text-lg">💰</span>
                      <div>
                        <p className="font-semibold">Acompte initial fixe : 50%</p>
                        <p className="text-xs text-blue-600">
                          = {(parseFloat(form.montantCredit) / 2).toLocaleString("fr-FR")} FCFA à verser avant la livraison
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Montant tontine hebdo (FCFA) *
                      {form.montantCredit && (
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          — restant : {(parseFloat(form.montantCredit) / 2).toLocaleString("fr-FR")} FCFA à rembourser
                        </span>
                      )}
                    </label>
                    <input type="number" min="1" required {...f("montantVersement")}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex : 5 000" />
                    {form.montantCredit && form.montantVersement && parseFloat(form.montantVersement) > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Durée estimée : {Math.ceil((parseFloat(form.montantCredit) / 2) / parseFloat(form.montantVersement))} semaine(s)
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* FORMULE 2 : crédit total, remboursement quotidien 16j */}
              {form.formuleRevendeur === "FORMULE_2" && form.montantCredit && (
                <div className="p-3 bg-blue-100 rounded-xl text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Remboursement automatique</p>
                  <p className="text-xs text-blue-600">
                    Durée : <strong>16 jours</strong> — Fréquence : <strong>quotidienne</strong>
                  </p>
                  <p className="text-xs text-blue-600">
                    Versement / jour : <strong>{Math.ceil(parseFloat(form.montantCredit) / 16).toLocaleString("fr-FR")} FCFA</strong>
                    {" "}(arrondi supérieur)
                  </p>
                </div>
              )}
            </div>
          )}

          {form.type === "URGENCE" && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-2">
              <div className="p-3 bg-red-100 rounded-xl text-sm text-red-800">
                <p className="font-semibold mb-1">Conditions d&apos;urgence — fixe</p>
                <p className="text-xs text-red-600">Acompte minimum : <strong>25% du montant total</strong></p>
                <p className="text-xs text-red-600 mt-0.5">Livraison immédiate dès réception de l&apos;acompte</p>
                <p className="text-xs text-red-600 mt-0.5">Remboursement : <strong>quotidien</strong> sur la durée choisie (7–10 jours)</p>
              </div>
            </div>
          )}

          {form.type === "FAMILIAL" && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
              <div className="p-3 bg-purple-100 rounded-xl text-sm text-purple-800">
                <p className="font-semibold mb-1">Règles du cycle</p>
                <p className="text-xs text-purple-600">Durée : <strong>30 jours — fixe</strong></p>
                <p className="text-xs text-purple-600 mt-0.5">Cotisation : <strong>hebdomadaire ou bimensuelle</strong> (sélectionnée ci-dessus)</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl text-sm text-purple-800">
                <p className="font-semibold mb-1">Bonus fidélité — fixe</p>
                <p className="text-xs text-purple-600">
                  <strong>+10% de produits supplémentaires</strong> offerts après <strong>3 cycles complétés</strong>
                </p>
              </div>
              {/* Champ versement standard pour FAMILIAL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant de cotisation (FCFA) *
                </label>
                <input type="number" min="1" required {...f("montantVersement")}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex : 5 000" />
                <p className="text-xs text-slate-400 mt-1">
                  Montant versé à chaque {form.frequenceVersement === "HEBDOMADAIRE" ? "semaine" : "quinzaine"}
                </p>
              </div>
            </div>
          )}

          {form.type === "EPARGNE_PRODUIT" && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <label className="block text-sm font-medium text-slate-700 mb-1">Seuil d&apos;épargne (FCFA)</label>
              <input type="number" min="0" {...f("montantSeuil")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 30000" />
            </div>
          )}

          {form.type === "FIDELITE" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-pink-50 rounded-xl border border-pink-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Points par tranche</label>
                <input type="number" min="1" {...f("pointsParTranche")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Ex : 10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Montant tranche (FCFA)</label>
                <input type="number" min="1" {...f("montantTranche")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Ex : 5000" />
              </div>
              <p className="col-span-2 text-xs text-pink-700 bg-pink-100 rounded-lg px-3 py-2">
                Ex : 10 points tous les 5 000 FCFA d&apos;achat
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={creating || updating} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors">
              {creating || updating ? "Enregistrement…" : isEdit ? "Sauvegarder" : "Créer le pack"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal : Nouvelle souscription (2 étapes) ─────────────────────────────────

function ModalNouvelleSouscription({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [clientSearch, setClientSearch] = useState("");
  const [dClientSearch, setDClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [packId, setPackId] = useState("");
  const [formuleRevendeur, setFormuleRevendeur] = useState("");
  const [frequenceVersement, setFrequenceVersement] = useState("HEBDOMADAIRE");
  const [montantTotal, setMontantTotal] = useState("");
  const [acompte, setAcompte] = useState("");
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDClientSearch(clientSearch), 400);
    return () => clearTimeout(t);
  }, [clientSearch]);

  const { data: clientsData } = useApi<{ data: ClientOption[] }>(
    step === 1 && dClientSearch.length >= 2
      ? `/api/admin/clients?search=${encodeURIComponent(dClientSearch)}&limit=6`
      : null
  );
  const clients = clientsData?.data ?? [];

  const { data: packs } = useApi<Pack[]>("/api/admin/packs");
  const selectedPack = (packs ?? []).find((p) => p.id === parseInt(packId));

  // Pré-remplir montant et formule depuis le pack sélectionné
  useEffect(() => {
    if (!selectedPack) return;
    if (selectedPack.montantCredit) setMontantTotal(String(selectedPack.montantCredit));
    else if (selectedPack.montantVersement) setMontantTotal(String(selectedPack.montantVersement));
    if (selectedPack.acomptePercent && selectedPack.montantCredit) {
      const a = (selectedPack.acomptePercent / 100) * selectedPack.montantCredit;
      setAcompte(String(Math.round(a)));
    }
    // Verrouiller la formule si le pack en définit une
    if (selectedPack.type === "REVENDEUR") {
      setFormuleRevendeur(selectedPack.formuleRevendeur ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  // URGENCE : recalculer l'acompte (25%) quand le montant total change
  useEffect(() => {
    if (selectedPack?.type !== "URGENCE" || !selectedPack.acomptePercent || !montantTotal) return;
    const a = (parseFloat(montantTotal) * selectedPack.acomptePercent) / 100;
    if (!isNaN(a) && a > 0) setAcompte(String(Math.round(a)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montantTotal]);

  const { mutate, loading } = useMutation("/api/admin/packs/souscriptions", "POST", {
    successMessage: "Souscription créée !",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient || !packId || !montantTotal) return;

    const payload: Record<string, unknown> = {
      packId: parseInt(packId),
      clientId: selectedClient.id,
      montantTotal: parseFloat(montantTotal),
      dateDebut,
      notes: notes || undefined,
    };
    if (acompte && parseFloat(acompte) > 0) payload.acompteInitial = parseFloat(acompte);
    if (selectedPack?.type === "REVENDEUR" && formuleRevendeur) payload.formuleRevendeur = formuleRevendeur;
    if (selectedPack?.type === "FAMILIAL") payload.frequenceVersement = frequenceVersement;

    const res = await mutate(payload);
    if (res) { onSuccess(); onClose(); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg transition-colors">×</button>

        <h2 className="text-xl font-bold text-slate-800 mb-1">Nouvelle souscription</h2>
        <p className="text-sm text-slate-500 mb-5">
          {step === 1 ? "Sélectionnez le client" : "Configurez la souscription"}
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[{ n: 1, label: "Client" }, { n: 2, label: "Config" }].map(({ n, label }) => (
            <React.Fragment key={n}>
              <div className={`flex items-center gap-1.5 ${step >= n ? "text-emerald-600" : "text-slate-400"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > n ? "bg-emerald-600 text-white" : step === n ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {step > n ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
              {n < 2 && <ChevronRight className="text-slate-300 w-4 h-4" />}
            </React.Fragment>
          ))}
        </div>

        {/* Étape 1 : Recherche client */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
                placeholder="Nom, prénom ou téléphone…"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            {clients.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {clients.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedClient(c); setStep(2); }}
                    className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors flex items-center justify-between group ${idx < clients.length - 1 ? "border-b border-slate-100" : ""}`}
                  >
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{c.prenom} {c.nom}</p>
                      <p className="text-xs text-slate-500">{c.telephone}</p>
                    </div>
                    <ChevronRight className="text-slate-300 group-hover:text-emerald-500 w-4 h-4 transition-colors" />
                  </button>
                ))}
              </div>
            )}
            {dClientSearch.length >= 2 && clients.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-4">Aucun client trouvé</p>
            )}
            {dClientSearch.length < 2 && (
              <p className="text-center text-slate-400 text-xs py-1">Saisissez au moins 2 caractères</p>
            )}
          </div>
        )}

        {/* Étape 2 : Configuration */}
        {step === 2 && selectedClient && (
          <form onSubmit={submit} className="space-y-4">
            {/* Client affiché */}
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-emerald-500 w-4 h-4 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{selectedClient.prenom} {selectedClient.nom}</p>
                  <p className="text-xs text-slate-500">{selectedClient.telephone}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setStep(1); setSelectedClient(null); }}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline underline-offset-2">
                Changer
              </button>
            </div>

            {/* Pack */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pack *</label>
              <select required value={packId} onChange={(e) => setPackId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="">— Sélectionner —</option>
                {(packs ?? []).filter((p) => p.actif).map((p) => (
                  <option key={p.id} value={p.id}>{p.nom} ({PACK_LABELS[p.type]})</option>
                ))}
              </select>
            </div>

            {selectedPack?.description && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">{selectedPack.description}</div>
            )}

            {/* Formule REVENDEUR */}
            {selectedPack?.type === "REVENDEUR" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Formule *</label>
                {selectedPack.formuleRevendeur ? (
                  // Formule verrouillée par le modèle de pack
                  <div className="p-3 rounded-xl border border-blue-300 bg-blue-50 text-blue-800 text-sm">
                    <p className="font-semibold">
                      {selectedPack.formuleRevendeur === "FORMULE_1" ? "Formule 1" : "Formule 2"}
                    </p>
                    <p className="text-xs mt-0.5 text-blue-600">
                      {selectedPack.formuleRevendeur === "FORMULE_1"
                        ? "50% upfront + tontine hebdo — définie par le pack"
                        : "Crédit total, remb. quotidien 16j — définie par le pack"}
                    </p>
                  </div>
                ) : (
                  // Formule libre (le pack n'en définit pas)
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "FORMULE_1", label: "Formule 1", desc: "50% upfront + tontine hebdo" },
                      { val: "FORMULE_2", label: "Formule 2", desc: "Crédit total, remb. 16j" },
                    ].map((f) => (
                      <button key={f.val} type="button" onClick={() => setFormuleRevendeur(f.val)}
                        className={`p-3 rounded-xl border text-left text-sm transition-colors ${formuleRevendeur === f.val ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        <p className="font-medium">{f.label}</p>
                        <p className="text-xs mt-0.5 opacity-80">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fréquence FAMILIAL */}
            {selectedPack?.type === "FAMILIAL" && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <label className="block text-sm font-medium text-slate-700 mb-1">Fréquence de versement *</label>
                <select value={frequenceVersement} onChange={(e) => setFrequenceVersement(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="HEBDOMADAIRE">Hebdomadaire</option>
                  <option value="BIMENSUEL">Bimensuel</option>
                </select>
                <p className="text-xs text-purple-600 mt-1">Cycles de 30 jours — hebdomadaire ou bimensuel uniquement</p>
              </div>
            )}

            {/* Montants — URGENCE : layout spécial avec récapitulatif */}
            {selectedPack?.type === "URGENCE" ? (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prix du produit (FCFA) *
                  </label>
                  <input type="number" min="1" required value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" placeholder="Ex : 40 000" />
                  <p className="text-xs text-slate-400 mt-1">Montant total du produit que le client souhaite acquérir</p>
                </div>
                {montantTotal && parseFloat(montantTotal) > 0 && selectedPack.acomptePercent && selectedPack.dureeJours && (
                  <div className="p-3 bg-red-100 rounded-xl text-sm text-red-800 space-y-1">
                    <p className="font-semibold">Récapitulatif automatique</p>
                    <div className="flex justify-between text-xs">
                      <span>Acompte à payer maintenant (25%)</span>
                      <span className="font-bold">{Math.round(parseFloat(montantTotal) * 0.25).toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Reste à rembourser (75%)</span>
                      <span className="font-bold">{Math.round(parseFloat(montantTotal) * 0.75).toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Versement/jour ({selectedPack.dureeJours} jours)</span>
                      <span className="font-bold">{Math.ceil((parseFloat(montantTotal) * 0.75) / selectedPack.dureeJours).toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1">Livraison immédiate après encaissement de l&apos;acompte</p>
                  </div>
                )}
                {/* Acompte verrouillé — affiché en lecture seule */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Acompte initial (25% — calculé automatiquement)</label>
                  <div className="w-full border border-red-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 font-semibold">
                    {acompte ? `${parseFloat(acompte).toLocaleString("fr-FR")} FCFA` : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Montant total *</label>
                  <input type="number" min="1" required value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="FCFA" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Acompte initial
                    {selectedPack?.acomptePercent && <span className="ml-1 text-xs text-slate-400">({selectedPack.acomptePercent}% min)</span>}
                  </label>
                  <input type="number" min="0" value={acompte} onChange={(e) => setAcompte(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Observations…" />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">
                Retour
              </button>
              <button type="submit" disabled={loading || !packId || !montantTotal}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors">
                {loading ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Modal : Versement ────────────────────────────────────────────────────────

function ModalVersement({
  souscriptionId,
  echeanceId,
  onClose,
  onSuccess,
}: {
  souscriptionId: number;
  echeanceId?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [montant, setMontant] = useState("");
  const [type, setType]       = useState("VERSEMENT_PERIODIQUE");
  const [notes, setNotes]     = useState("");

  const { mutate, loading } = useMutation(
    `/api/admin/packs/souscriptions/${souscriptionId}/versement`,
    "POST",
    { successMessage: "Versement enregistré !" }
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({ montant: parseFloat(montant), type, notes, echeanceId });
    if (res) { onSuccess(); onClose(); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Enregistrer un versement</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant (FCFA) *</label>
            <input type="number" min="1" required value={montant} onChange={(e) => setMontant(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 5 000" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="VERSEMENT_PERIODIQUE">Versement périodique</option>
              <option value="COTISATION_INITIALE">Acompte / Cotisation initiale</option>
              <option value="REMBOURSEMENT">Remboursement</option>
              <option value="BONUS">Bonus</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">Annuler</button>
            <button type="submit" disabled={loading || !montant} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors">
              {loading ? "Enregistrement…" : "Valider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal : Planifier livraison ──────────────────────────────────────────────

function ModalPlanifierLivraison({
  souscription,
  onClose,
  onSuccess,
}: {
  souscription: Souscription;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [lignes, setLignes] = useState<{ produitId: string; quantite: string; prixUnitaire: string }[]>([
    { produitId: "", quantite: "1", prixUnitaire: "" },
  ]);
  const [datePrevisionnelle, setDatePrevisionnelle] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const { data: stockData } = useApi<{ data: Produit[] }>("/api/admin/stock?limit=200");
  const produits = (stockData?.data ?? []).filter((p) => p.stock > 0);

  const { mutate: planifier, loading: saving } = useMutation(
    `/api/admin/packs/souscriptions/${souscription.id}/livrer`,
    "POST",
    { successMessage: "Livraison planifiée !" }
  );

  const addLigne = useCallback(() =>
    setLignes((l) => [...l, { produitId: "", quantite: "1", prixUnitaire: "" }]),
    []
  );

  const removeLigne = useCallback((i: number) =>
    setLignes((l) => l.filter((_, idx) => idx !== i)),
    []
  );

  const updateLigne = useCallback((i: number, key: string, val: string) => {
    setLignes((l) => l.map((ligne, idx) => {
      if (idx !== i) return ligne;
      const updated = { ...ligne, [key]: val };
      if (key === "produitId") {
        const p = produits.find((pr) => pr.id === parseInt(val));
        if (p) updated.prixUnitaire = String(p.prixUnitaire);
      }
      return updated;
    }));
  }, [produits]);

  // Budget en temps réel
  const montantTotal = Number(souscription.montantTotal);
  const montantLignes = lignes.reduce((sum, l) => {
    const qte = parseInt(l.quantite) || 0;
    const prix = parseFloat(l.prixUnitaire) || 0;
    return sum + qte * prix;
  }, 0);
  const budgetDepasse = montantLignes > montantTotal;
  const budgetPct = montantTotal > 0 ? Math.min(100, Math.round((montantLignes / montantTotal) * 100)) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (budgetDepasse) return;
    const validLignes = lignes
      .filter((l) => l.produitId && l.quantite)
      .map((l) => ({
        produitId: parseInt(l.produitId),
        quantite: parseInt(l.quantite),
        prixUnitaire: parseFloat(l.prixUnitaire),
      }));

    if (validLignes.length === 0) return;

    const res = await planifier({ action: "planifier", lignes: validLignes, datePrevisionnelle, notes });
    if (res) { onSuccess(); onClose(); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-600" /> Planifier une livraison
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Pack <strong>{souscription.pack.nom}</strong> — {PACK_LABELS[souscription.pack.type]}
        </p>

        {/* Budget du pack */}
        <div className={`rounded-xl p-3 mb-4 border ${budgetDepasse ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-slate-600 font-medium">Budget livraison</span>
            <span className={`font-bold ${budgetDepasse ? "text-red-600" : "text-emerald-700"}`}>
              {formatCurrency(montantLignes)} / {formatCurrency(montantTotal)}
            </span>
          </div>
          <div className="h-2 bg-white rounded-full border border-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetDepasse ? "bg-red-500" : budgetPct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          {budgetDepasse && (
            <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Dépassement de {formatCurrency(montantLignes - montantTotal)} — ajustez les quantités ou les prix
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date prévue</label>
            <input type="date" value={datePrevisionnelle} onChange={(e) => setDatePrevisionnelle(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Produits à livrer</label>
              <button type="button" onClick={addLigne} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select value={l.produitId} onChange={(e) => updateLigne(i, "produitId", e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">— Produit —</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <input type="number" min="1" value={l.quantite} onChange={(e) => updateLigne(i, "quantite", e.target.value)}
                      placeholder="Qté" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="w-28">
                    <input type="number" min="0" step="0.01" value={l.prixUnitaire} onChange={(e) => updateLigne(i, "prixUnitaire", e.target.value)}
                      placeholder="Prix" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {lignes.length > 1 && (
                    <button type="button" onClick={() => removeLigne(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">Annuler</button>
            <button type="submit" disabled={saving || budgetDepasse} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium transition-colors">
              {saving ? "Enregistrement…" : "Planifier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, ArrowLeft, Package, Layers, Users, CheckCircle,
  Clock, AlertTriangle, XCircle, ChevronRight, ChevronDown, ChevronUp,
  Truck, CreditCard, RefreshCw, Edit2, ToggleLeft, ToggleRight,
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
            <p className="text-slate-500 font-medium">Aucune échéance en attente</p>
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
                        {e.statut === "EN_RETARD" ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {e.statut === "EN_RETARD" ? "En retard" : "À payer"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setVersementTarget({ souscriptionId: s.id, echeanceId: e.id })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Payer
                      </button>
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
  const [livraisonTarget, setLivraisonTarget] = useState<number | null>(null);

  const { data: sData, loading, refetch } = useApi<SouscriptionsData>(
    "/api/admin/packs/souscriptions?statut=EN_ATTENTE,ACTIF,COMPLETE"
  );

  // Bug #2 + Bug #6: livrables selon le type de pack
  // URGENCE : dès ACTIF (acompte versé)
  // REVENDEUR F1 : dès ACTIF (50% upfront versé)
  // REVENDEUR F2 : dès EN_ATTENTE (crédit total, livraison avant tout remboursement)
  // Autres : uniquement COMPLETE
  const aLivrer = (sData?.souscriptions ?? []).filter((s) => {
    if ((s.receptions?.length ?? 0) > 0) return false;
    if (s.pack.type === "URGENCE" && s.statut === "ACTIF") return true;
    if (s.pack.type === "REVENDEUR" && s.formuleRevendeur === "FORMULE_1" && s.statut === "ACTIF") return true;
    if (s.pack.type === "REVENDEUR" && s.formuleRevendeur === "FORMULE_2") return true;
    return s.statut === "COMPLETE";
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Souscriptions à livrer</h2>
          <p className="text-sm text-slate-500 mt-0.5">Packs en attente de livraison (soldés, URGENCE/Revendeur F1 actifs, ou Revendeur F2)</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Chargement…</p>
        </div>
      ) : completes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucune livraison en attente</p>
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
                  onClick={() => setLivraisonTarget(s.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200 shrink-0"
                >
                  <Truck className="w-4 h-4" /> Planifier livraison
                </button>
              </div>
            );
          })}
        </div>
      )}

      {livraisonTarget !== null && (
        <ModalPlanifierLivraison
          souscriptionId={livraisonTarget}
          onClose={() => setLivraisonTarget(null)}
          onSuccess={() => { refetch(); setLivraisonTarget(null); }}
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

  const { data: packs, loading, refetch } = useApi<Pack[]>("/api/admin/packs");

  const { mutate: doToggle } = useMutation(
    togglePackId !== null ? `/api/admin/packs/${togglePackId}` : "",
    "PUT"
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fréquence versement</label>
              <select {...f("frequenceVersement")}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="QUOTIDIEN">Quotidien</option>
                <option value="HEBDOMADAIRE">Hebdomadaire</option>
                <option value="BIMENSUEL">Bimensuel</option>
                <option value="MENSUEL">Mensuel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea {...f("description")} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Durée (jours)</label>
              <input type="number" min="1" {...f("dureeJours")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Versement standard (FCFA)</label>
              <input type="number" min="0" {...f("montantVersement")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 5000" />
            </div>
          </div>

          {/* Champs conditionnels */}
          {form.type === "REVENDEUR" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Formule par défaut</label>
                <select {...f("formuleRevendeur")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">Non définie</option>
                  <option value="FORMULE_1">Formule 1 — 50% upfront + tontine hebdo</option>
                  <option value="FORMULE_2">Formule 2 — Crédit total, remb. quotidien 16j</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Montant crédit (FCFA)</label>
                <input type="number" min="0" {...f("montantCredit")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 50000" />
              </div>
            </div>
          )}

          {form.type === "URGENCE" && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <label className="block text-sm font-medium text-slate-700 mb-1">Acompte minimum (%)</label>
              <input type="number" min="0" max="100" {...f("acomptePercent")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 25" />
            </div>
          )}

          {form.type === "FAMILIAL" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bonus (%)</label>
                <input type="number" min="0" max="100" {...f("bonusPourcentage")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nb cycles déclencheur</label>
                <input type="number" min="1" {...f("cyclesBonusTrigger")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 3" />
              </div>
            </div>
          )}

          {form.type === "EPARGNE_PRODUIT" && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <label className="block text-sm font-medium text-slate-700 mb-1">Seuil d'épargne (FCFA)</label>
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

  // Pré-remplir montant depuis le pack
  useEffect(() => {
    if (!selectedPack) return;
    if (selectedPack.montantCredit) setMontantTotal(String(selectedPack.montantCredit));
    else if (selectedPack.montantVersement) setMontantTotal(String(selectedPack.montantVersement));
    if (selectedPack.acomptePercent && selectedPack.montantCredit) {
      const a = (selectedPack.acomptePercent / 100) * selectedPack.montantCredit;
      setAcompte(String(Math.round(a)));
    }
    if (selectedPack.type === "REVENDEUR" && selectedPack.formuleRevendeur) {
      setFormuleRevendeur(selectedPack.formuleRevendeur);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

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
              </div>
            )}

            {/* Fréquence FAMILIAL */}
            {selectedPack?.type === "FAMILIAL" && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <label className="block text-sm font-medium text-slate-700 mb-1">Fréquence de versement *</label>
                <select value={frequenceVersement} onChange={(e) => setFrequenceVersement(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="QUOTIDIEN">Quotidien</option>
                  <option value="HEBDOMADAIRE">Hebdomadaire</option>
                  <option value="BIMENSUEL">Bimensuel</option>
                  <option value="MENSUEL">Mensuel</option>
                </select>
              </div>
            )}

            {/* Montants */}
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
  souscriptionId,
  onClose,
  onSuccess,
}: {
  souscriptionId: number;
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
    `/api/admin/packs/souscriptions/${souscriptionId}/livrer`,
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
      // Auto-remplir prix depuis le produit sélectionné
      if (key === "produitId") {
        const p = produits.find((pr) => pr.id === parseInt(val));
        if (p) updated.prixUnitaire = String(p.prixUnitaire);
      }
      return updated;
    }));
  }, [produits]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-600" /> Planifier une livraison
        </h2>

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
                    <input type="number" min="0" value={l.prixUnitaire} onChange={(e) => updateLigne(i, "prixUnitaire", e.target.value)}
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
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium transition-colors">
              {saving ? "Enregistrement…" : "Planifier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

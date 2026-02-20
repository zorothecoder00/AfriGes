"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  TrendingUp, Users, UserCheck, Coins, CreditCard,
  ShoppingCart, Package, MoreVertical, Download, Plus, ChevronDown,
} from 'lucide-react';
import Link from "next/link";
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatNumber } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPoint { date: string; montant: number; }

interface DashboardResponse {
  success: boolean;
  data: {
    membresActifs: number;
    tontinesActives: number;
    creditsEnCours: number;
    achatsCreditAlimentaire: { nombreAchats: number; montantTotal: number };
    evolutionVentes: DayPoint[];
    evolutionCotisations: DayPoint[];
    repartitionCotisations: { enAttente: number; payees: number; expirees: number };
    comparaisons: {
      membres:     { pct: string; positif: boolean };
      cotisations: { pct: string; positif: boolean };
      ventes:      { pct: string; positif: boolean };
      credits:     { pct: string; positif: boolean };
    };
  };
}

// ─── Helpers graphiques ───────────────────────────────────────────────────────

// Dimensions du système de coordonnées du viewBox SVG
const VB_W = 1000;
const VB_H = 200;

/** Construit le path SVG d'une courbe à partir de points normalisés [0..1, 0..1] */
function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * VB_W).toFixed(1)} ${(p.y * VB_H).toFixed(1)}`)
    .join(' ');
}

function buildArea(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const line = buildPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${(last.x * VB_W).toFixed(1)} ${VB_H} L ${(first.x * VB_W).toFixed(1)} ${VB_H} Z`;
}

function normalizePoints(data: DayPoint[]): { x: number; y: number }[] {
  if (data.length === 0) return [];
  const max = Math.max(...data.map(d => d.montant), 1); // au moins 1 pour éviter /0
  return data.map((d, i) => ({
    x: data.length === 1 ? 0.5 : i / (data.length - 1),
    y: 1 - d.montant / max, // SVG: y=0 est en haut → inverser
  }));
}

/** Donut chart : calcule strokeDasharray pour chaque segment */
const CIRCUMFERENCE = 2 * Math.PI * 80; // r = 80

function donutSegments(enAttente: number, payees: number, expirees: number) {
  const total = enAttente + payees + expirees;
  if (total === 0) {
    return [{ len: CIRCUMFERENCE, color: '#e2e8f0', offset: 0, label: 'Aucune cotisation', pct: '—' }];
  }
  const seg = (n: number) => (n / total) * CIRCUMFERENCE;
  return [
    { len: seg(payees),    color: '#10b981', offset: 0,                         label: 'Payées',      pct: `${Math.round((payees    / total) * 100)}%`, count: payees    },
    { len: seg(enAttente), color: '#f59e0b', offset: -seg(payees),               label: 'En attente',  pct: `${Math.round((enAttente / total) * 100)}%`, count: enAttente },
    { len: seg(expirees),  color: '#94a3b8', offset: -(seg(payees)+seg(enAttente)), label: 'Expirées', pct: `${Math.round((expirees  / total) * 100)}%`, count: expirees  },
  ];
}

/** Formate un label de date (YYYY-MM-DD) → "5 jan", "12 jan"… */
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AfriGesDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('30');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // La période est passée dans l'URL → useApi refetch automatiquement quand elle change
  const { data: response, loading, error, refetch } = useApi<DashboardResponse>(
    `/api/admin/dashboard?period=${selectedPeriod}`
  );
  const d = response?.data;

  // ── Données normalisées pour les charts ────────────────────────────────────
  const ventesPoints   = useMemo(() => normalizePoints(d?.evolutionVentes ?? []),       [d]);
  const cotisPoints    = useMemo(() => normalizePoints(d?.evolutionCotisations ?? []),  [d]);
  const donuts         = useMemo(() => {
    const r = d?.repartitionCotisations;
    return r ? donutSegments(r.enAttente, r.payees, r.expirees) : null;
  }, [d]);

  // Max value pour l'axe Y du line chart (affichage)
  const maxVentes = useMemo(() =>
    Math.max(...(d?.evolutionVentes ?? []).map(p => p.montant), 1),
    [d]
  );

  // Labels axe X : premier, milieu, dernier jour
  const xLabels = useMemo(() => {
    const pts = d?.evolutionVentes ?? [];
    if (pts.length === 0) return [];
    const n = pts.length;
    const indices = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];
    return [...new Set(indices)].map(i => ({ i, label: fmtDateShort(pts[i].date), xPct: (i / (n - 1)) * 100 }));
  }, [d]);

  // Labels axe Y
  const yLabels = useMemo(() => {
    const levels = 4;
    return Array.from({ length: levels + 1 }, (_, i) => {
      const val = (maxVentes * i) / levels;
      return { val, yPct: 100 - (i / levels) * 100 };
    });
  }, [maxVentes]);

  // ── Stats cards ────────────────────────────────────────────────────────────
  const stats = [
    {
      id: 1, label: 'Membres actifs',
      value: d ? formatNumber(d.membresActifs) : '—',
      change: d?.comparaisons.membres.pct ?? '…',
      positif: d?.comparaisons.membres.positif ?? true,
      icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-50',
    },
    {
      id: 2, label: 'Tontines actives',
      value: d ? formatNumber(d.tontinesActives) : '—',
      change: d?.comparaisons.credits.pct ?? '…',
      positif: true,
      icon: Coins, color: 'bg-emerald-500', lightBg: 'bg-emerald-50',
    },
    {
      id: 3, label: 'Crédits en cours',
      value: d ? formatNumber(d.creditsEnCours) : '—',
      change: d?.comparaisons.credits.pct ?? '…',
      positif: d?.comparaisons.credits.positif ?? true,
      icon: CreditCard, color: 'bg-amber-500', lightBg: 'bg-amber-50',
    },
    {
      id: 4, label: 'Achats via crédit alimentaire',
      value: d ? formatCurrency(d.achatsCreditAlimentaire.montantTotal) : '—',
      change: d?.comparaisons.ventes.pct ?? '…',
      positif: d?.comparaisons.ventes.positif ?? true,
      icon: ShoppingCart, color: 'bg-purple-500', lightBg: 'bg-purple-50',
    },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement du tableau de bord…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 max-w-md text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 font-medium">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-emerald-50/20">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">AfriGes</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/notifications" className="text-slate-600 hover:text-slate-800">🔔</Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full" />
              <span className="text-sm font-medium text-slate-700">Admin</span>
            </div>
            <SignOutButton
              redirectTo="/auth/login?logout=success"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            />
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-8 py-8 flex gap-6">

        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden sticky top-28">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Principal</h3>
              <nav className="space-y-1">
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium transition-all shadow-md shadow-emerald-200">
                  <TrendingUp size={20} /><span>Tableau de bord</span>
                </button>
                <Link href="/dashboard/admin/membres"      className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Users size={20} /><span>Membres</span></Link>
                <Link href="/dashboard/admin/gestionnaires" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Users size={20} /><span>Gestionnaires</span></Link>
                <Link href="/dashboard/admin/clients"      className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><UserCheck size={20} /><span>Clients</span></Link>
              </nav>
            </div>
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Communauté</h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/tontines"           className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Coins size={20} /><span>Tontines</span></Link>
                <Link href="/dashboard/admin/cotisations"        className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><CreditCard size={20} /><span>Cotisations</span></Link>
                <Link href="/dashboard/admin/creditsAlimentaires" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><CreditCard size={20} /><span>Crédits alimentaires</span></Link>
              </nav>
            </div>
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Commerce</h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/ventes" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><ShoppingCart size={20} /><span>Ventes</span></Link>
                <Link href="/dashboard/admin/stock"  className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Package size={20} /><span>Gestion du stock</span></Link>
              </nav>
            </div>
            <div className="p-4">
              <SignOutButton
                redirectTo="/auth/login?logout=success"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
              />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 space-y-6">

          {/* Titre */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold text-slate-800 mb-2">Tableau de bord</h2>
              <p className="text-slate-500">Vue d&apos;ensemble des activités AfriGes</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
                <Download size={18} />Exporter
              </button>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
                >
                  <Plus size={18} />Nouvelle opération
                  <ChevronDown size={16} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                    <Link href="/dashboard/admin/cotisations"        onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><CreditCard size={18} className="text-blue-500" /><span className="text-sm font-medium text-slate-700">Enregistrer un paiement</span></Link>
                    <Link href="/dashboard/admin/creditsAlimentaires" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><ShoppingCart size={18} className="text-purple-500" /><span className="text-sm font-medium text-slate-700">Nouveau crédit alimentaire</span></Link>
                    <Link href="/dashboard/admin/ventes"             onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><Package size={18} className="text-emerald-500" /><span className="text-sm font-medium text-slate-700">Nouvelle vente</span></Link>
                    <Link href="/dashboard/admin/membres"            onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><Users size={18} className="text-amber-500" /><span className="text-sm font-medium text-slate-700">Ajouter un membre</span></Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-5">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${stat.lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                      <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
                    </div>
                    {stat.change !== '—' && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        stat.positif
                          ? 'text-emerald-600 bg-emerald-50'
                          : 'text-red-500 bg-red-50'
                      }`}>
                        {stat.change}
                      </span>
                    )}
                  </div>
                  <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                  <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-3 gap-5">

            {/* ── Line chart : évolution des ventes ─────────────────────────── */}
            <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Évolution des ventes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Montants journaliers (crédit alimentaire)</p>
                </div>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as '7' | '30' | '90')}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="7">7 derniers jours</option>
                  <option value="30">30 derniers jours</option>
                  <option value="90">90 derniers jours</option>
                </select>
              </div>

              {/* Légende */}
              <div className="flex items-center gap-5 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500">Ventes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-xs text-slate-500">Cotisations payées</span>
                </div>
              </div>

              <div className="relative" style={{ height: 220 }}>
                {ventesPoints.length > 0 ? (
                  <>
                    {/* Labels axe Y — positionnés en HTML pour éviter la distorsion du viewBox */}
                    {yLabels.map((lbl) => (
                      <div
                        key={lbl.yPct}
                        className="absolute left-0 w-9 text-right text-[10px] text-slate-400 leading-none select-none"
                        style={{ top: `${(lbl.yPct / 100) * 190}px`, transform: 'translateY(-50%)' }}
                      >
                        {lbl.val >= 1000 ? `${Math.round(lbl.val / 1000)}k` : Math.round(lbl.val)}
                      </div>
                    ))}

                    {/* Zone SVG — décalée pour laisser la place aux labels Y */}
                    <div className="absolute left-10 right-0 top-0" style={{ height: 190 }}>
                      <svg
                        width="100%" height="100%"
                        viewBox={`0 0 ${VB_W} ${VB_H}`}
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                          </linearGradient>
                          <linearGradient id="cotisLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>

                        {/* Grille horizontale */}
                        {yLabels.map((lbl) => (
                          <line
                            key={lbl.yPct}
                            x1="0" x2={VB_W}
                            y1={(lbl.yPct / 100) * VB_H}
                            y2={(lbl.yPct / 100) * VB_H}
                            stroke="#f1f5f9" strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}

                        {/* Zone de remplissage ventes */}
                        <path d={buildArea(ventesPoints)} fill="url(#areaGrad)" />

                        {/* Courbe cotisations */}
                        {cotisPoints.length > 0 && (
                          <path
                            d={buildPath(cotisPoints)}
                            fill="none" stroke="url(#cotisLineGrad)" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3"
                            opacity="0.7" vectorEffect="non-scaling-stroke"
                          />
                        )}

                        {/* Courbe ventes */}
                        <path
                          d={buildPath(ventesPoints)}
                          fill="none" stroke="url(#lineGrad)" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>

                    {/* Labels axe X — positionnés en HTML */}
                    <div className="absolute left-10 right-0" style={{ top: 195 }}>
                      {xLabels.map(({ label, xPct }) => (
                        <span
                          key={xPct}
                          className="absolute text-[10px] text-slate-400 whitespace-nowrap select-none"
                          style={{ left: `${xPct}%`, transform: 'translateX(-50%)' }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Aucune donnée sur cette période
                  </div>
                )}
              </div>
            </div>

            {/* ── Donut : répartition des cotisations ────────────────────────── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Cotisations</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Répartition par statut</p>
                </div>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className="flex items-center justify-center my-4">
                <div className="relative">
                  <svg width="200" height="200" viewBox="0 0 220 220">
                    {donuts ? (
                      donuts.map((seg, i) => (
                        <circle
                          key={i}
                          cx="110" cy="110" r="80"
                          fill="none"
                          stroke={seg.len > 0 ? seg.color : '#e2e8f0'}
                          strokeWidth="36"
                          strokeDasharray={`${seg.len.toFixed(2)} ${(CIRCUMFERENCE - seg.len).toFixed(2)}`}
                          strokeDashoffset={seg.offset.toFixed(2)}
                          transform="rotate(-90 110 110)"
                          strokeLinecap="butt"
                        />
                      ))
                    ) : (
                      <circle cx="110" cy="110" r="80" fill="none" stroke="#e2e8f0" strokeWidth="36" />
                    )}
                    {/* Centre */}
                    <circle cx="110" cy="110" r="60" fill="white" />
                    {/* Texte centre */}
                    {d && (
                      <>
                        <text x="110" y="106" textAnchor="middle" fill="#1e293b" fontSize="22" fontWeight="bold">
                          {d.repartitionCotisations.payees + d.repartitionCotisations.enAttente + d.repartitionCotisations.expirees}
                        </text>
                        <text x="110" y="122" textAnchor="middle" fill="#94a3b8" fontSize="10">
                          total
                        </text>
                      </>
                    )}
                  </svg>
                </div>
              </div>

              <div className="space-y-2.5">
                {donuts?.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-sm text-slate-600">{seg.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {'count' in seg && (
                        <span className="text-xs text-slate-400">{seg.count as number}</span>
                      )}
                      <span className="text-sm font-semibold text-slate-800">{seg.pct}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

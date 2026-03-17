"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {     
  TrendingUp, Users, UserCheck, Package, Layers,
  ShoppingCart, MoreVertical, Download, Plus, ChevronDown, MessageSquare, Store, Shield,
  Activity, AlertTriangle, CheckCircle, XCircle, Wallet, BarChart2, Truck, RefreshCw,
} from 'lucide-react';
import Link from "next/link"; 
import { useSession } from 'next-auth/react';
import { useT } from '@/contexts/AppSettingsContext';
import NotificationBell from '@/components/NotificationBell';
import SignOutButton from '@/components/SignOutButton';
import MessageModal from '@/components/MessageModal';
import { useApi } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPoint { date: string; montant: number; }

interface ActivityAlerte {
  type: string;
  niveau: 'critique' | 'warning' | 'info';
  message: string;
  detail: string;
}

interface ActivityResponse {
  success: boolean;
  data: {
    activiteJour: {
      versements: number;
      souscriptions: number;
      ventes: number;
      mouvementsStock: number;
    };
    modules: {
      actifs: number;
      inactifs: number;
      total: number;
      liste: { nom: string; key: string; actif: boolean }[];
    };
    alertes: ActivityAlerte[];   
    rapports: {
      caisse:           { sessionsOuvertes: number; versementsMontant: number };
      stock:            { alertes: number };
      ventes:           { count: number; montant: number };
      approvisionnement:{ enAttente: number };
    };
  };
}

interface DashboardResponse {
  success: boolean;
  data: {
    clientsActifs: number;
    souscriptionsActives: number;
    packsTotal: number;
    versementsTotal: { count: number; montant: number };
    evolutionVersements: DayPoint[];
    evolutionSouscriptions: DayPoint[];
    repartitionSouscriptions: { actives: number; completes: number; annulees: number };
    comparaisons: {
      clients:    { pct: string; positif: boolean };
      versements: { pct: string; positif: boolean };
      packs:      { pct: string; positif: boolean };
    };
  };
}

// ─── Helpers graphiques ───────────────────────────────────────────────────────

const VB_W = 1000;
const VB_H = 200;

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * VB_W).toFixed(1)} ${(p.y * VB_H).toFixed(1)}`)
    .join(' ');
}

function buildArea(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const line = buildPath(points);
  const last  = points[points.length - 1];
  const first = points[0];
  return `${line} L ${(last.x * VB_W).toFixed(1)} ${VB_H} L ${(first.x * VB_W).toFixed(1)} ${VB_H} Z`;
}

function normalizePoints(data: DayPoint[]): { x: number; y: number }[] {
  if (data.length === 0) return [];
  const max = Math.max(...data.map(d => d.montant), 1);
  return data.map((d, i) => ({
    x: data.length === 1 ? 0.5 : i / (data.length - 1),
    y: 1 - d.montant / max,
  }));
}

/** Donut chart pour les souscriptions */
const CIRCUMFERENCE = 2 * Math.PI * 80;

function souscSegments(actives: number, completes: number, annulees: number) {
  const total = actives + completes + annulees;
  if (total === 0) {
    return [{ len: CIRCUMFERENCE, color: '#e2e8f0', offset: 0, label: 'Aucune souscription', pct: '—' }];
  }
  const seg = (n: number) => (n / total) * CIRCUMFERENCE;
  return [
    { len: seg(actives),   color: '#10b981', offset: 0,                              label: 'Actives',   pct: `${Math.round((actives   / total) * 100)}%`, count: actives   },
    { len: seg(completes), color: '#6366f1', offset: -seg(actives),                  label: 'Complètes', pct: `${Math.round((completes / total) * 100)}%`, count: completes },
    { len: seg(annulees),  color: '#94a3b8', offset: -(seg(actives)+seg(completes)), label: 'Annulées',  pct: `${Math.round((annulees  / total) * 100)}%`, count: annulees  },
  ];
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AfriGesDashboard() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';
  const t = useT();
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('30');
  const [showMenu, setShowMenu] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { data: response, loading, error, refetch } = useApi<DashboardResponse>(
    `/api/admin/dashboard?period=${selectedPeriod}`
  );
  const d = response?.data;

  const { data: activityResponse, refetch: refetchActivity } = useApi<ActivityResponse>(
    '/api/admin/activity'
  );
  const act = activityResponse?.data;

  const handleExport = () => {
    const points = d?.evolutionVersements ?? [];
    exportToCsv(
      points,
      [
        { label: "Date",    key: "date",    format: (v) => new Date(String(v)).toLocaleDateString("fr-FR") },
        { label: "Montant", key: "montant", format: (v) => formatCurrency(Number(v)) },
      ],
      `dashboard-versements-${selectedPeriod}.csv`
    );
  };

  // ── Données normalisées pour les charts ────────────────────────────────────
  const versementsPoints = useMemo(() => normalizePoints(d?.evolutionVersements ?? []),    [d]);
  const souscPoints      = useMemo(() => normalizePoints(d?.evolutionSouscriptions ?? []), [d]);
  const donuts = useMemo(() => {
    const r = d?.repartitionSouscriptions;
    return r ? souscSegments(r.actives, r.completes, r.annulees) : null;
  }, [d]);

  const maxVersements = useMemo(() =>
    Math.max(...(d?.evolutionVersements ?? []).map(p => p.montant), 1),
    [d]
  );

  const xLabels = useMemo(() => {
    const pts = d?.evolutionVersements ?? [];
    if (pts.length === 0) return [];
    const n = pts.length;
    const indices = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];
    return [...new Set(indices)].map(i => ({ i, label: fmtDateShort(pts[i].date), xPct: (i / (n - 1)) * 100 }));
  }, [d]);

  const yLabels = useMemo(() => {
    const levels = 4;
    return Array.from({ length: levels + 1 }, (_, i) => {
      const val = (maxVersements * i) / levels;
      return { val, yPct: 100 - (i / levels) * 100 };
    });
  }, [maxVersements]);

  // Supprimé : stats cards remplacées par la section activité ci-dessous

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
            <NotificationBell href="/dashboard/admin/notifications" />
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
                  <TrendingUp size={20} /><span>{t('nav_dashboard')}</span>
                </button>
                <Link href="/dashboard/admin/membres"       className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Users size={20} /><span>{t('nav_membres')}</span></Link>
                <Link href="/dashboard/admin/gestionnaires" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Users size={20} /><span>{t('nav_gestionnaires')}</span></Link>
                <Link href="/dashboard/admin/clients"       className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><UserCheck size={20} /><span>{t('nav_clients')}</span></Link>
                <Link href="/dashboard/admin/messages"      className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><MessageSquare size={20} /><span>{t('nav_messages')}</span></Link>
              </nav>
            </div>
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Packs &amp; Ventes</h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/packs" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Layers size={20} /><span>{t('nav_packs')}</span></Link>
              </nav>
            </div>
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Commerce</h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/ventes" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><ShoppingCart size={20} /><span>{t('nav_ventes')}</span></Link>
                <Link href="/dashboard/admin/stock"  className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Package size={20} /><span>{t('nav_stock')}</span></Link>
                <Link href="/dashboard/admin/pdv"    className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"><Store size={20} /><span>{t('nav_pdv')}</span></Link>
              </nav>
            </div>
            {/* Visible pour ADMIN et SUPER_ADMIN */}
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {isSuperAdmin ? 'Super Admin' : 'Administration'}
              </h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/superadmin"
                  className="w-full flex items-center gap-3 px-4 py-3 text-violet-600 hover:bg-violet-50 rounded-xl transition-all font-medium border border-violet-100">
                  <Shield size={20} />
                  <span>{t('nav_superadmin')}</span>
                </Link>
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
              <h2 className="text-4xl font-bold text-slate-800 mb-2">{t('dash_title')}</h2>
              <p className="text-slate-500">{t('dash_subtitle')}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleExport} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
                <Download size={18} />{t('action_export')}
              </button>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
                >
                  <Plus size={18} />{t('action_new_op')}
                  <ChevronDown size={16} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                    <Link href="/dashboard/admin/packs"   onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><Layers size={18} className="text-blue-500" /><span className="text-sm font-medium text-slate-700">Nouvelle souscription pack</span></Link>
                    <Link href="/dashboard/admin/ventes"  onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><Package size={18} className="text-emerald-500" /><span className="text-sm font-medium text-slate-700">Nouvelle vente / livraison</span></Link>
                    <Link href="/dashboard/admin/membres" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"><Users size={18} className="text-amber-500" /><span className="text-sm font-medium text-slate-700">Ajouter un membre</span></Link>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => { setShowMenu(false); setShowMessageModal(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <MessageSquare size={18} className="text-purple-500" />
                      <span className="text-sm font-medium text-slate-700">Envoyer un message</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Activité globale du jour ──────────────────────────────────── */}
          <div className="space-y-4">

            {/* Ligne 1 : opérations du jour + modules + alertes */}
            <div className="grid grid-cols-3 gap-5">

              {/* Activité du jour */}
              <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <Activity size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{t('dash_activity')}</h3>
                      <p className="text-xs text-slate-400">Opérations effectuées aujourd&apos;hui</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { refetch(); refetchActivity(); }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    title="Actualiser"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Versements', value: act?.activiteJour.versements ?? '—', icon: Wallet,      color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Souscriptions', value: act?.activiteJour.souscriptions ?? '—', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Ventes directes', value: act?.activiteJour.ventes ?? '—', icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Mouvements stock', value: act?.activiteJour.mouvementsStock ?? '—', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 rounded-xl">
                        <div className={`${item.bg} p-2 rounded-lg`}>
                          <Icon size={16} className={item.color} />
                        </div>
                        <span className="text-2xl font-bold text-slate-800">{item.value}</span>
                        <span className="text-[10px] text-slate-500 text-center leading-tight">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modules actifs / inactifs */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-violet-50 p-2 rounded-lg">
                    <BarChart2 size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{t('dash_modules')}</h3>
                    <p className="text-xs text-slate-400">{act?.modules.total ?? '—'} modules configurés</p>
                  </div>
                </div>
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{act?.modules.actifs ?? '—'}</p>
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Actifs</p>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-slate-500">{act?.modules.inactifs ?? '—'}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Inactifs</p>
                  </div>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {act?.modules.liste.slice(0, 5).map((m) => (
                    <div key={m.key} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-slate-600 truncate flex-1">{m.nom}</span>
                      {m.actif
                        ? <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                        : <XCircle    size={12} className="text-slate-300 flex-shrink-0" />
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ligne 2 : alertes opérationnelles + rapports rapides */}
            <div className="grid grid-cols-2 gap-5">

              {/* Alertes opérationnelles */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-amber-50 p-2 rounded-lg">
                    <AlertTriangle size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{t('dash_alerts')}</h3>
                    <p className="text-xs text-slate-400">{t('dash_points_attention')}</p>
                  </div>
                </div>
                {!act || act.alertes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <CheckCircle size={28} className="text-emerald-400" />
                    <p className="text-sm text-slate-500">Aucune alerte active</p>
                    <p className="text-xs text-slate-400">Tout fonctionne normalement</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {act.alertes.map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${
                          a.niveau === 'critique' ? 'bg-red-50 border border-red-100' :
                          a.niveau === 'warning'  ? 'bg-amber-50 border border-amber-100' :
                                                    'bg-blue-50 border border-blue-100'
                        }`}
                      >
                        <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${
                          a.niveau === 'critique' ? 'text-red-500' :
                          a.niveau === 'warning'  ? 'text-amber-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <p className={`font-medium text-xs ${
                            a.niveau === 'critique' ? 'text-red-700' :
                            a.niveau === 'warning'  ? 'text-amber-700' : 'text-blue-700'
                          }`}>{a.message}</p>
                          {a.detail && <p className="text-[10px] text-slate-500 mt-0.5">{a.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rapports rapides */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <TrendingUp size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{t('dash_reports')}</h3>
                    <p className="text-xs text-slate-400">{t('dash_indicateurs_jour')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Caisse */}
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wallet size={13} className="text-purple-500" />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('dash_caisse')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{act ? formatCurrency(act.rapports.caisse.versementsMontant) : '—'}</p>
                    <p className="text-[10px] text-slate-400">{act?.rapports.caisse.sessionsOuvertes ?? '—'} session(s) ouverte(s)</p>
                  </div>
                  {/* Stock */}
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Package size={13} className="text-amber-500" />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('dash_stock')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{act?.rapports.stock.alertes ?? '—'} alerte(s)</p>
                    <p className="text-[10px] text-slate-400">Produits sous le seuil</p>
                  </div>
                  {/* Ventes */}
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShoppingCart size={13} className="text-emerald-500" />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('dash_ventes')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{act ? formatCurrency(act.rapports.ventes.montant) : '—'}</p>
                    <p className="text-[10px] text-slate-400">{act?.rapports.ventes.count ?? '—'} vente(s) directe(s)</p>
                  </div>
                  {/* Approvisionnement */}
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Truck size={13} className="text-blue-500" />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('dash_appro')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{act?.rapports.approvisionnement.enAttente ?? '—'} en attente</p>
                    <p className="text-[10px] text-slate-400">{t('dash_receptions_valider')}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-3 gap-5">

            {/* ── Line chart : évolution des versements ─────────────────────── */}
            <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{t('dash_evolution_versements')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t('dash_montants_journaliers')}</p>
                </div>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as '7' | '30' | '90')}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="7">{t('dash_period_7')}</option>
                  <option value="30">{t('dash_period_30')}</option>
                  <option value="90">{t('dash_period_90')}</option>
                </select>
              </div>

              {/* Légende */}
              <div className="flex items-center gap-5 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500">{t('dash_versements_packs')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-xs text-slate-500">{t('dash_souscriptions_creees')}</span>
                </div>
              </div>

              <div className="relative" style={{ height: 220 }}>
                {versementsPoints.length > 0 ? (
                  <>
                    {yLabels.map((lbl) => (
                      <div
                        key={lbl.yPct}
                        className="absolute left-0 w-9 text-right text-[10px] text-slate-400 leading-none select-none"
                        style={{ top: `${(lbl.yPct / 100) * 190}px`, transform: 'translateY(-50%)' }}
                      >
                        {lbl.val >= 1000 ? `${Math.round(lbl.val / 1000)}k` : Math.round(lbl.val)}
                      </div>
                    ))}

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
                          <linearGradient id="souscLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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

                        {/* Zone de remplissage versements */}
                        <path d={buildArea(versementsPoints)} fill="url(#areaGrad)" />

                        {/* Courbe souscriptions */}
                        {souscPoints.length > 0 && (
                          <path
                            d={buildPath(souscPoints)}
                            fill="none" stroke="url(#souscLineGrad)" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3"
                            opacity="0.7" vectorEffect="non-scaling-stroke"
                          />
                        )}

                        {/* Courbe versements */}
                        <path
                          d={buildPath(versementsPoints)}
                          fill="none" stroke="url(#lineGrad)" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>

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

            {/* ── Donut : répartition des souscriptions ────────────────────── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{t('dash_souscriptions')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t("dash_repartition_statut")}</p>
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
                    <circle cx="110" cy="110" r="60" fill="white" />
                    {d && (
                      <>
                        <text x="110" y="106" textAnchor="middle" fill="#1e293b" fontSize="22" fontWeight="bold">
                          {d.repartitionSouscriptions.actives + d.repartitionSouscriptions.completes + d.repartitionSouscriptions.annulees}
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

      {showMessageModal && (
        <MessageModal onClose={() => setShowMessageModal(false)} />
      )}
    </div>
  );
}

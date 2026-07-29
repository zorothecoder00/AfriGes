"use client";

import React, { useMemo } from 'react';
import {
  Users, TrendingDown, TrendingUp, AlertTriangle, RefreshCw,
  Calendar, Wallet, UserCheck, Phone, ChevronRight, BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import KpiCard from '@/components/ui/KpiCard';
import Button from '@/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  kpis: {
    totalClients:     number;
    clientsActifs:    number;
    clientsBloques:   number;
    totalCreances:    number;
    montantTotalDu:   number;
    montantTotal:     number;
    montantVerse:     number;
    tauxRecouvrement: number;
    creancesEnRetard: number;
    montantEnRetard:  number;
    collectesJour:    { nombre: number; montant: number };
    collectesMois:    { nombre: number; montant: number };
  };
  evolutionMensuelle: { label: string; montant: number; nombre: number }[];
  topAgents: {
    agentId:         number;
    nom:             string;
    prenom:          string;
    nbClients:       number;
    nbCollectes:     number;
    montantCollecte: number;
  }[];
  creancesCritiques: {
    id:             number;
    montantRestant: number;
    montantTotal:   number;
    client:         { id: number; nom: string; prenom: string; telephone: string; codeClient: string | null };
    pack:           { nom: string; type: string };
    echeanceRetard: { datePrevue: string; montant: string } | null;
  }[];
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

// Calculé une seule fois au chargement du module — évite les appels impures pendant le rendu
const NOW = Date.now();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClienteleDashboard() {
  const { data, loading, refetch } = useApi<DashboardData>('/api/admin/clientele/dashboard');

  const kpis = data?.kpis;
  const evolution = data?.evolutionMensuelle ?? [];
  const topAgents = data?.topAgents ?? [];
  const creancesAvecMeta = useMemo(() => {
    const items = data?.creancesCritiques ?? [];
    return items.map((c) => ({
      ...c,
      pct: c.montantTotal > 0
        ? Math.round(((c.montantTotal - c.montantRestant) / c.montantTotal) * 100)
        : 0,
      joursRetard: c.echeanceRetard
        ? Math.floor((NOW - new Date(c.echeanceRetard.datePrevue).getTime()) / 86400000)
        : 0,
    }));
  }, [data]);

  const maxEvolution = Math.max(...evolution.map((e) => e.montant), 1);

  const tauxColor =
    (kpis?.tauxRecouvrement ?? 0) >= 80 ? '#10b981'
    : (kpis?.tauxRecouvrement ?? 0) >= 50 ? '#f59e0b'
    : '#ef4444';

  // SVG cercle de progression
  const taux = kpis?.tauxRecouvrement ?? 0;
  const circumference = 2 * Math.PI * 15.9155;
  const dashOffset = circumference * (1 - taux / 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Tableau de bord</h2>
            <p className="text-sm text-slate-500 mt-0.5">Vue d&apos;ensemble en temps réel — ERP · CRM · Recouvrement · Contrôle financier</p>
          </div>
          <Button variant="secondary" icon={<RefreshCw className={loading ? 'animate-spin' : ''} size={16} />} onClick={refetch}>
            Actualiser
          </Button>
        </div>

        {/* ── Ligne 1 : KPIs principaux ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Clients actifs"
            value={kpis?.clientsActifs ?? 0}
            sub={`${kpis?.totalClients ?? 0} total · ${kpis?.clientsBloques ?? 0} bloqué(s)`}
            icon={<Users size={18} />}
            accent="primary"
          />
          <KpiCard
            label="Créances ouvertes"
            value={kpis?.totalCreances ?? 0}
            sub={formatCurrency(kpis?.montantTotalDu ?? 0) + ' restant dû'}
            icon={<TrendingDown size={18} />}
            accent="warning"
          />
          <KpiCard
            label="En retard"
            value={kpis?.creancesEnRetard ?? 0}
            sub={formatCurrency(kpis?.montantEnRetard ?? 0) + ' impayé'}
            icon={<AlertTriangle size={18} />}
            accent="error"
          />
          <KpiCard
            label="Collectes ce mois"
            value={kpis?.collectesMois.nombre ?? 0}
            sub={formatCurrency(kpis?.collectesMois.montant ?? 0) + ' encaissé'}
            icon={<Calendar size={18} />}
            accent="success"
          />
        </div>

        {/* ── Ligne 2 : Taux de recouvrement + Évolution mensuelle ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Taux recouvrement — cercle SVG */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center gap-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Taux de recouvrement global</p>
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9155" fill="none"
                  stroke={tauxColor} strokeWidth="3"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900">{taux}%</span>
                <span className="text-xs text-slate-400">recouvré</span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 gap-2 text-center text-xs text-slate-500">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="font-semibold text-slate-800 text-sm">{formatCurrency(kpis?.montantVerse ?? 0)}</p>
                <p>Versé</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="font-semibold text-slate-800 text-sm">{formatCurrency(kpis?.montantTotal ?? 0)}</p>
                <p>Total packs</p>
              </div>
            </div>
          </div>

          {/* Évolution mensuelle — bar chart CSS */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-slate-700">Versements — 6 derniers mois</p>
              </div>
              <span className="text-xs text-slate-400">{evolution.reduce((s, e) => s + e.nombre, 0)} versements</span>
            </div>
            <div className="flex items-end gap-2 h-36">
              {evolution.map((e) => {
                const h = Math.max(4, Math.round((e.montant / maxEvolution) * 100));
                return (
                  <div key={e.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-500 leading-none">
                      {e.montant > 0 ? fmtCompact(e.montant) : ''}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-blue-500 hover:bg-blue-600 transition-colors cursor-default"
                      style={{ height: `${h}%` }}
                      title={`${e.label} : ${formatCurrency(e.montant)} (${e.nombre} versements)`}
                    />
                    <span className="text-[10px] text-slate-500 leading-none">{e.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Ligne 3 : Collectes du jour + Cards secondaires ───────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            className="col-span-2 lg:col-span-1"
            label="Collectes du jour"
            value={kpis?.collectesJour.montant ?? 0}
            format={formatCurrency}
            sub={`${kpis?.collectesJour.nombre ?? 0} collecte(s) validée(s)`}
            icon={<Calendar size={18} />}
            accent="purple"
          />
          <KpiCard
            label="Montant dû total"
            value={kpis?.montantTotalDu ?? 0}
            format={formatCurrency}
            sub={`${kpis?.totalCreances ?? 0} créance(s) ouverte(s)`}
            icon={<Wallet size={18} />}
            accent="teal"
          />
          <KpiCard
            label="Montant en retard"
            value={kpis?.montantEnRetard ?? 0}
            format={formatCurrency}
            sub={`${kpis?.creancesEnRetard ?? 0} échéance(s) dépassée(s)`}
            icon={<AlertTriangle size={18} />}
            accent="error"
          />
          <KpiCard
            label="Versé ce mois"
            value={kpis?.collectesMois.montant ?? 0}
            format={formatCurrency}
            sub={`${kpis?.collectesMois.nombre ?? 0} opération(s)`}
            icon={<TrendingUp size={18} />}
            accent="success"
          />
        </div>

        {/* ── Ligne 4 : Top agents + Créances critiques ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top agents */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">Top agents de recouvrement</h3>
              </div>
              <span className="text-xs text-slate-400">par montant collecté</span>
            </div>
            {topAgents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">Aucune collecte validée</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {topAgents.map((ag, i) => {
                  const maxM = topAgents[0].montantCollecte || 1;
                  const pct  = Math.round((ag.montantCollecte / maxM) * 100);
                  return (
                    <div key={ag.agentId} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${i === 0 ? 'bg-yellow-100 text-yellow-700'
                          : i === 1 ? 'bg-slate-100 text-slate-600'
                          : i === 2 ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-500'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {ag.prenom} {ag.nom}
                            </p>
                            <p className="text-sm font-semibold text-emerald-700 shrink-0 ml-2">
                              {formatCurrency(ag.montantCollecte)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {ag.nbClients} client(s) · {ag.nbCollectes} collecte(s)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-slate-100">
              <Link href="/dashboard/admin/collectes" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Voir toutes les collectes <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Créances critiques */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-slate-800">Créances critiques</h3>
              </div>
              <span className="text-xs text-slate-400">échéances dépassées · montant desc</span>
            </div>
            {creancesAvecMeta.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">Aucune créance en retard</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {creancesAvecMeta.map((c) => {
                  const { pct, joursRetard } = c;
                  return (
                    <div key={c.id} className="px-5 py-3 hover:bg-red-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {c.client.prenom} {c.client.nom}
                            {c.client.codeClient && (
                              <span className="ml-1.5 text-xs text-slate-400">· {c.client.codeClient}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {c.client.telephone}
                            <span className="mx-1">·</span>
                            <span className="text-slate-500">{c.pack.nom}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-600">{formatCurrency(c.montantRestant)}</p>
                          {joursRetard > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                              +{joursRetard}j
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{pct}% payé</span>
                      </div>
                      {c.echeanceRetard && (
                        <p className="text-xs text-red-500 mt-1">
                          Éch. du {formatDate(c.echeanceRetard.datePrevue)} — {formatCurrency(Number(c.echeanceRetard.montant))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-slate-100">
              <Link href="/dashboard/admin/creances?retard=true" className="text-xs text-red-600 hover:underline flex items-center gap-1">
                Voir toutes les créances en retard <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
      </ClienteleTabBar>
    </div>
  );
}

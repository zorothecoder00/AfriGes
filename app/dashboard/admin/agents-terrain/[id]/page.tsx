'use client';

import React, { useState, useMemo, use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft, Users, MapPin, TrendingUp, Phone, Eye, Map,
  Navigation, RefreshCw, Calendar, CheckCircle, XCircle, Clock,
  Loader2, AlertTriangle,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import type { MapClient, MapVisite } from '@/components/AgentMap';

// Chargement dynamique (Leaflet incompatible avec SSR)
const AgentMap = dynamic(() => import('@/components/AgentMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  ),
});

// ─── Types ─────────────────────────────────────────────────────────────────

interface AgentDetail {
  id: number; memberId: number; actif: boolean; zone: string | null;
  member: {
    id: number; nom: string; prenom: string; email: string;
    telephone: string | null; photo: string | null; etat: string;
    affectationsPDV: { pointDeVente: { id: number; nom: string; code: string } }[];
  };
  stats: {
    nbClients: number; nbCreancesActives: number; montantCreances: number;
    montantCollecteCeMois: number; nbCollectesCeMois: number;
    tauxRecouvrement: number; totalVerse: number; totalPacks: number;
    derniereActivite: string | null;
  };
}

const STATUT_VISITE: Record<string, { label: string; color: string }> = {
  REALISEE:  { label: 'Réalisée',  color: 'bg-emerald-100 text-emerald-700' },
  PLANIFIEE: { label: 'Planifiée', color: 'bg-blue-100 text-blue-700' },
  ANNULEE:   { label: 'Annulée',   color: 'bg-gray-100 text-gray-500' },
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [mapMode, setMapMode]       = useState<'clients' | 'tournee'>('clients');
  const [dateDebut, setDateDebut]   = useState('');
  const [dateFin, setDateFin]       = useState('');

  // ── Données ────────────────────────────────────────────────────────────
  const { data: agentRes, loading: agentLoading } =
    useApi<{ data: AgentDetail[] }>(`/api/admin/agents-terrain?memberId=${id}`);
  const agent = agentRes?.data?.[0] ?? null;

  const { data: clientsRes, loading: clientsLoading } =
    useApi<{ data: MapClient[] }>(`/api/admin/agents-terrain/${id}/clients`);
  const clients = clientsRes?.data ?? [];

  const visitesParams = new URLSearchParams();
  if (dateDebut) visitesParams.set('dateDebut', dateDebut);
  if (dateFin)   visitesParams.set('dateFin',   dateFin);
  const { data: visitesRes, loading: visitesLoading, refetch: refetchVisites } =
    useApi<{ data: MapVisite[] }>(`/api/admin/agents-terrain/${id}/visites?${visitesParams}`);
  const visites = visitesRes?.data ?? [];

  // ── Données carte ──────────────────────────────────────────────────────
  const clientsAvecGps  = useMemo(() => clients.filter((c) => c.latitude != null && c.longitude != null), [clients]);
  const visitesAvecGps  = useMemo(() => visites.filter((v) => v.latitude != null && v.longitude != null), [visites]);

  if (agentLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-gray-600">Agent introuvable</p>
        <Link href="/dashboard/admin/agents-terrain" className="text-emerald-600 hover:underline text-sm">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const s = agent.stats;
  const pdv = agent.member.affectationsPDV?.[0]?.pointDeVente;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/agents-terrain"
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {agent.member.prenom} {agent.member.nom}
            </h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {agent.zone && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5" /> {agent.zone}
                </span>
              )}
              {pdv && (
                <span className="text-sm text-gray-500">· PDV : {pdv.nom}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                agent.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>{agent.actif ? 'Actif' : 'Inactif'}</span>
            </div>
          </div>
          {agent.member.telephone && (
            <a href={`tel:${agent.member.telephone}`}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <Phone className="w-4 h-4 text-emerald-600" />
              {agent.member.telephone}
            </a>
          )}
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Clients affectés', value: s.nbClients, icon: <Users className="w-5 h-5" />, color: 'blue' },
            { label: 'Taux recouvrement', value: `${s.tauxRecouvrement}%`, icon: <TrendingUp className="w-5 h-5" />,
              color: s.tauxRecouvrement >= 80 ? 'emerald' : s.tauxRecouvrement >= 50 ? 'amber' : 'red' },
            { label: 'Collecté ce mois', value: formatCurrency(s.montantCollecteCeMois), icon: <CheckCircle className="w-5 h-5" />, color: 'emerald' },
            { label: 'Créances actives', value: s.nbCreancesActives, icon: <AlertTriangle className="w-5 h-5" />, color: 'amber' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-lg bg-${k.color}-50 flex items-center justify-center text-${k.color}-600 mb-3`}>
                {k.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── Carte ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Barre outils carte */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-800 text-sm">Carte</span>
              <div className="flex bg-gray-100 rounded-lg p-0.5 ml-2">
                <button onClick={() => setMapMode('clients')}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    mapMode === 'clients' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <Users className="w-3 h-3 inline mr-1" />Clients ({clientsAvecGps.length})
                </button>
                <button onClick={() => setMapMode('tournee')}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    mapMode === 'tournee' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <Navigation className="w-3 h-3 inline mr-1" />Tournée ({visitesAvecGps.length})
                </button>
              </div>
            </div>
            {/* Filtres date (mode tournée) */}
            {mapMode === 'tournee' && (
              <div className="flex items-center gap-2">
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <button onClick={() => refetchVisites()}
                  className="p-1.5 hover:bg-gray-100 rounded-lg" title="Actualiser">
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            )}
          </div>

          {/* Carte */}
          <div style={{ height: 420 }}>
            {(clientsLoading || visitesLoading) ? (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <AgentMap clients={clients} visites={visites} mode={mapMode} />
            )}
          </div>

          {/* Légende */}
          <div className="px-5 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
            {mapMode === 'clients' ? (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Client avec GPS
                </span>
                <span>{clients.length - clientsAvecGps.length} client(s) sans coordonnées GPS</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Visite réalisée
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-8 border-t-2 border-dashed border-emerald-500 inline-block" /> Tracé tournée
                </span>
                <span>{visites.length - visitesAvecGps.length} visite(s) sans GPS</span>
              </>
            )}
          </div>
        </div>

        {/* ── Grille inférieure : liste clients + historique visites ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Liste clients */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Clients affectés ({clients.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : clients.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Aucun client affecté</p>
              ) : clients.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.codeClient && <span className="text-xs text-gray-400 font-mono">{c.codeClient}</span>}
                      {c.telephone  && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{c.telephone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.latitude != null
                      ? <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      : <MapPin className="w-3.5 h-3.5 text-gray-200" />}
                    <Link href={`/dashboard/admin/clients/${c.id}`}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historique visites */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-500" /> Visites récentes ({visites.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {visitesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : visites.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Aucune visite enregistrée</p>
              ) : [...visites].reverse().map((v) => (
                <div key={v.id} className="px-5 py-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{v.client.prenom} {v.client.nom}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(v.dateVisite).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                      {v.notes && <p className="text-xs text-gray-500 italic mt-0.5">{v.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {v.latitude != null
                        ? <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        : <MapPin className="w-3.5 h-3.5 text-gray-200" />}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_VISITE[v.statut]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUT_VISITE[v.statut]?.label ?? v.statut}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

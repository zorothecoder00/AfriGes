"use client";

import React, { useState, useCallback } from 'react';
import {
  UserCheck, Search, RefreshCw, Users, Wallet, TrendingUp,
  Phone, MapPin, Calendar, AlertTriangle, ChevronRight, X,
  BarChart2, Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import ClienteleTabBar from '@/components/ClienteleTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentStats {
  nbClients:            number;
  nbCreancesActives:    number;
  montantCreances:      number;
  montantCollecteCeMois:number;
  nbCollectesCeMois:    number;
  tauxRecouvrement:     number;
  totalVerse:           number;
  totalPacks:           number;
  derniereActivite:     string | null;
}

interface Agent {
  id:       number;
  memberId: number;
  actif:    boolean;
  member: {
    id: number; nom: string; prenom: string;
    email: string; telephone: string | null; etat: string;
    affectationsPDV: { pointDeVente: { id: number; nom: string; code: string } }[];
  };
  stats: AgentStats;
}

interface AgentsResponse {
  data: Agent[];
  stats: {
    total: number; actifs: number;
    totalClientsAffectes: number;
    totalCollecteCeMois: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAUX_COLOR = (t: number) =>
  t >= 80 ? 'text-emerald-600' : t >= 50 ? 'text-amber-600' : 'text-red-600';

const TAUX_BG = (t: number) =>
  t >= 80 ? 'bg-emerald-500' : t >= 50 ? 'bg-amber-500' : 'bg-red-500';

function joursDepuis(dateStr: string | null) {
  if (!dateStr) return null;
  const j = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (j === 0) return "Aujourd'hui";
  if (j === 1) return 'Hier';
  return `Il y a ${j}j`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsTerrainPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [actifFilter, setActifFilter] = useState('');
  const [selected,    setSelected]    = useState<Agent | null>(null);

  const query = new URLSearchParams({
    ...(search     && { search }),
    ...(actifFilter && { actif: actifFilter }),
  }).toString();

  const { data: res, loading, refetch } = useApi<AgentsResponse>(
    `/api/admin/agents-terrain?${query}`
  );

  const handleSearch = useCallback(() => setSearch(searchInput), [searchInput]);

  const agents = res?.data ?? [];
  const stats  = res?.stats;

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Supervision agents de terrain</h2>
            <p className="text-sm text-gray-500 mt-0.5">Performance, recouvrement et activité par agent</p>
          </div>
          <button onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Agents actifs',    value: stats?.actifs ?? 0,                     icon: <UserCheck className="w-5 h-5 text-blue-600" />,    bg: 'bg-blue-50',    fmt: 'n' },
            { label: 'Clients affectés', value: stats?.totalClientsAffectes ?? 0,        icon: <Users className="w-5 h-5 text-violet-600" />,       bg: 'bg-violet-50',  fmt: 'n' },
            { label: 'Total agents',     value: stats?.total ?? 0,                       icon: <BarChart2 className="w-5 h-5 text-slate-600" />,    bg: 'bg-slate-50',   fmt: 'n' },
            { label: 'Collecté ce mois', value: formatCurrency(stats?.totalCollecteCeMois ?? 0), icon: <Wallet className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', fmt: 'c' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
              <div className={`${k.bg} p-2.5 rounded-xl shrink-0`}>{k.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`font-bold text-gray-900 ${k.fmt === 'n' ? 'text-2xl' : 'text-lg'}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher un agent…"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleSearch}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Search className="w-4 h-4" />
            </button>
          </div>
          <select value={actifFilter} onChange={(e) => setActifFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
          <span className="text-sm text-gray-400">{agents.length} agent(s)</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <UserCheck className="w-10 h-10 mb-2" />
              <p className="text-sm">Aucun agent de terrain trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Agent</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Clients</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Créances actives</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Collecté ce mois</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Taux recouvrement</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Dernière activité</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agents.map((agent) => {
                    const pdv = agent.member.affectationsPDV[0]?.pointDeVente ?? null;
                    return (
                      <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                        {/* Agent */}
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">
                            {agent.member.prenom} {agent.member.nom}
                          </p>
                          {agent.member.telephone && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <Phone className="w-3 h-3" />{agent.member.telephone}
                            </div>
                          )}
                          {pdv && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <MapPin className="w-3 h-3" />{pdv.nom}
                            </div>
                          )}
                        </td>

                        {/* Nb clients */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-gray-900">{agent.stats.nbClients}</span>
                        </td>

                        {/* Créances */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-bold ${agent.stats.nbCreancesActives > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {agent.stats.nbCreancesActives}
                          </span>
                          {agent.stats.montantCreances > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(agent.stats.montantCreances)}</p>
                          )}
                        </td>

                        {/* Collecté ce mois */}
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-emerald-700">{formatCurrency(agent.stats.montantCollecteCeMois)}</p>
                          <p className="text-xs text-gray-400">{agent.stats.nbCollectesCeMois} collecte(s)</p>
                        </td>

                        {/* Taux recouvrement */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-bold ${TAUX_COLOR(agent.stats.tauxRecouvrement)}`}>
                              {agent.stats.tauxRecouvrement}%
                            </span>
                            <div className="w-20 bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${TAUX_BG(agent.stats.tauxRecouvrement)}`}
                                style={{ width: `${agent.stats.tauxRecouvrement}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Dernière activité */}
                        <td className="px-4 py-3">
                          {agent.stats.derniereActivite ? (
                            <div>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Calendar className="w-3 h-3" />
                                {formatDate(agent.stats.derniereActivite)}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {joursDepuis(agent.stats.derniereActivite)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" /> Aucune collecte
                            </span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                            agent.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {agent.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelected(agent)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            <Eye className="w-3 h-3" /> Détail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal détail agent */}
      {selected && (
        <AgentDetailModal agent={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Modal détail agent ───────────────────────────────────────────────────────

function AgentDetailModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const s = agent.stats;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {agent.member.prenom} {agent.member.nom}
            </h3>
            <p className="text-sm text-gray-500">Agent de terrain · {agent.actif ? 'Actif' : 'Inactif'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="p-6 grid grid-cols-2 gap-3">
          {[
            { label: 'Clients affectés',    value: s.nbClients,                        color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: 'Créances actives',     value: s.nbCreancesActives,                color: 'text-orange-600',  bg: 'bg-orange-50' },
            { label: 'Collecté ce mois',     value: formatCurrency(s.montantCollecteCeMois), color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Taux recouvrement',    value: `${s.tauxRecouvrement}%`,           color: TAUX_COLOR(s.tauxRecouvrement), bg: 'bg-gray-50' },
            { label: 'Montant créances',     value: formatCurrency(s.montantCreances),  color: 'text-red-600',     bg: 'bg-red-50' },
            { label: 'Total versé (packs)',  value: formatCurrency(s.totalVerse),       color: 'text-teal-600',    bg: 'bg-teal-50' },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-xl p-4`}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="px-6 pb-4 text-sm text-gray-600 space-y-1">
          {agent.member.telephone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              {agent.member.telephone}
            </div>
          )}
          {agent.member.affectationsPDV[0] && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              {agent.member.affectationsPDV[0].pointDeVente.nom}
            </div>
          )}
          {s.derniereActivite && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              Dernière collecte : {formatDate(s.derniereActivite)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <Link
            href={`/dashboard/admin/clients?agentTerrainId=${agent.memberId}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            <Users className="w-4 h-4" /> Voir les clients
          </Link>
          <Link
            href={`/dashboard/admin/collectes?agentId=${agent.memberId}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            <TrendingUp className="w-4 h-4" /> Collectes <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

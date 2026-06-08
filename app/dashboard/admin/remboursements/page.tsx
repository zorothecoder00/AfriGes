"use client";

import React, { useState, useCallback } from 'react';
import {
  Search, TrendingUp, Wallet, CheckCircle, Calendar,
  RefreshCw, Filter, Phone, MapPin, Download,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatCurrency } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import { useTagModal } from '@/contexts/TagModalContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Versement {
  id: number;
  montant: string;
  type: string;
  datePaiement: string;
  reference: string | null;
  notes: string | null;
  encaisseParNom: string | null;
  souscription: {
    id: number;
    montantTotal: string;
    montantVerse: string;
    montantRestant: string;
    statut: string;
    pack: { id: number; nom: string; type: string };
    client: {
      id: number; nom: string; prenom: string; telephone: string;
      codeClient: string | null;
      segment: string;
      agentTerrain: { id: number; nom: string; prenom: string } | null;
      pointDeVente: { id: number; nom: string; code: string } | null;
      tags: { tag: { id: number; nom: string; couleur: string } }[];
    };
  };
  ligneCollecte: {
    collecteId: number;
    collecte: { reference: string; dateCollecte: string };
  } | null;
}

interface RemboursementsResponse {
  data: Versement[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: {
    totalVersements: number;
    nombreVersements: number;
    parType: { type: string; montant: number; nombre: number }[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_VERSEMENT_LABELS: Record<string, string> = {
  COTISATION_INITIALE: 'Cotisation initiale',
  VERSEMENT_PERIODIQUE: 'Versement périodique',
  REMBOURSEMENT: 'Remboursement',
  BONUS: 'Bonus',
  AJUSTEMENT: 'Ajustement',
};

const TYPE_VERSEMENT_BADGE: Record<string, string> = {
  COTISATION_INITIALE:  'bg-blue-100 text-blue-700',
  VERSEMENT_PERIODIQUE: 'bg-emerald-100 text-emerald-700',
  REMBOURSEMENT:        'bg-teal-100 text-teal-700',
  BONUS:                'bg-purple-100 text-purple-700',
  AJUSTEMENT:           'bg-amber-100 text-amber-700',
};

const PACK_TYPE_BADGE: Record<string, string> = {
  FAMILIAL:        'bg-purple-100 text-purple-700',
  URGENCE:         'bg-red-100 text-red-700',
  REVENDEUR:       'bg-blue-100 text-blue-700',
  EPARGNE_PRODUIT: 'bg-teal-100 text-teal-700',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemboursementsPage() {
  const tagModal = useTagModal();
  const [page,        setPage]        = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [type,        setType]        = useState('');
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');

  const query = new URLSearchParams({
    page: String(page), limit: '20',
    ...(search    && { search }),
    ...(type      && { type }),
    ...(dateDebut && { dateDebut }),
    ...(dateFin   && { dateFin }),
  }).toString();

  const { data: res, loading, refetch } = useApi<RemboursementsResponse>(
    `/api/admin/remboursements?${query}`
  );

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleExport = () => {
    if (!res?.data.length) return;
    const rows = res.data.map((v) => ({
      Date:       formatDate(v.datePaiement),
      Client:     `${v.souscription.client.prenom} ${v.souscription.client.nom}`,
      Telephone:  v.souscription.client.telephone,
      Pack:       v.souscription.pack.nom,
      Type:       TYPE_VERSEMENT_LABELS[v.type] ?? v.type,
      Montant:    Number(v.montant),
      Agent:      v.souscription.client.agentTerrain
        ? `${v.souscription.client.agentTerrain.prenom} ${v.souscription.client.agentTerrain.nom}`
        : '',
      Collecte:   v.ligneCollecte?.collecte.reference ?? '',
      Reference:  v.reference ?? '',
    }));
    exportToCsv(
      rows,
      [
        { label: 'Date',       key: 'Date' },
        { label: 'Client',     key: 'Client' },
        { label: 'Téléphone',  key: 'Telephone' },
        { label: 'Pack',       key: 'Pack' },
        { label: 'Type',       key: 'Type' },
        { label: 'Montant',    key: 'Montant' },
        { label: 'Agent',      key: 'Agent' },
        { label: 'Collecte',   key: 'Collecte' },
        { label: 'Référence',  key: 'Reference' },
      ],
      `remboursements_${new Date().toISOString().slice(0, 10)}`
    );
  };

  const stats = res?.stats;

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Remboursements</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Suivi de tous les versements sur souscriptions packs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total encaissé"
          value={formatCurrency(stats?.totalVersements ?? 0)}
          icon={<Wallet className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
        />
        <StatCard
          label="Nb de versements"
          value={String(stats?.nombreVersements ?? 0)}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
        />
        {stats?.parType.slice(0, 2).map((s) => (
          <StatCard
            key={s.type}
            label={TYPE_VERSEMENT_LABELS[s.type] ?? s.type}
            value={formatCurrency(s.montant)}
            icon={<CheckCircle className="w-5 h-5 text-purple-600" />}
            bg="bg-purple-50"
          />
        ))}
      </div>

      {/* Répartition par type */}
      {stats?.parType && stats.parType.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Répartition par type</p>
          <div className="flex flex-wrap gap-3">
            {stats.parType.map((s) => (
              <div key={s.type} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_VERSEMENT_BADGE[s.type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {TYPE_VERSEMENT_LABELS[s.type] ?? s.type}
                </span>
                <span className="text-sm font-bold text-gray-800">{formatCurrency(s.montant)}</span>
                <span className="text-xs text-gray-500">({s.nombre})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Nom client, téléphone, code…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSearch} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Search className="w-4 h-4" />
          </button>
        </div>

        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">Tous types</option>
          {Object.entries(TYPE_VERSEMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          {res?.meta.total ?? 0} résultat(s)
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : !res?.data.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Wallet className="w-10 h-10 mb-2" />
            <p className="text-sm">Aucun versement trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Pack</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Progression</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Via collecte</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Encaissé par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {res.data.map((v) => {
                const total   = Number(v.souscription.montantTotal);
                const verse   = Number(v.souscription.montantVerse);
                const pct     = total > 0 ? Math.min(100, Math.round((verse / total) * 100)) : 0;
                const solde   = v.souscription.statut === 'COMPLETE';

                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(v.datePaiement)}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {v.souscription.client.prenom} {v.souscription.client.nom}
                        {v.souscription.client.segment === 'RIA' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 leading-none">★ RIA</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {v.souscription.client.telephone}
                      </div>
                      {v.souscription.client.pointDeVente && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {v.souscription.client.pointDeVente.nom}
                        </div>
                      )}
                      {v.souscription.client.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {v.souscription.client.tags.map(({ tag }) => (
                            <button
                              key={tag.id}
                              onClick={() => tagModal?.openTag(tag)}
                              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white leading-none hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: tag.couleur }}
                            >
                              {tag.nom}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Pack */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{v.souscription.pack.nom}</div>
                      <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${PACK_TYPE_BADGE[v.souscription.pack.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {v.souscription.pack.type}
                      </span>
                    </td>

                    {/* Type versement */}
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${TYPE_VERSEMENT_BADGE[v.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_VERSEMENT_LABELS[v.type] ?? v.type}
                      </span>
                    </td>

                    {/* Montant */}
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {formatCurrency(Number(v.montant))}
                    </td>

                    {/* Progression */}
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{pct}%</span>
                        {solde && <span className="text-emerald-600 font-medium">Soldé</span>}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${solde ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatCurrency(verse)} / {formatCurrency(total)}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-3">
                      {v.souscription.client.agentTerrain ? (
                        <span className="text-xs text-gray-700">
                          {v.souscription.client.agentTerrain.prenom}{' '}
                          {v.souscription.client.agentTerrain.nom}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Via collecte */}
                    <td className="px-4 py-3">
                      {v.ligneCollecte ? (
                        <div>
                          <div className="text-xs font-medium text-blue-700">
                            {v.ligneCollecte.collecte.reference}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(v.ligneCollecte.collecte.dateCollecte)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Direct</span>
                      )}
                    </td>

                    {/* Encaissé par */}
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {v.encaisseParNom ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {res && res.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Page {res.meta.page} / {res.meta.totalPages} — {res.meta.total} versement(s)</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Précédent
            </button>
            <button
              disabled={page === res.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
      </div>{/* end p-6 */}
    </div>
  );
}

function StatCard({ label, value, icon, bg }: {
  label: string; value: string; icon: React.ReactNode; bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`${bg} p-2.5 rounded-lg`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-gray-900 text-lg">{value}</p>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useCallback } from 'react';
import {
  Search, TrendingUp, Wallet, CheckCircle, Calendar,
  RefreshCw, Filter, Phone, MapPin, Download,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatCurrency } from '@/lib/format';
import { exportToXlsx } from '@/lib/exportXlsx';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import { useTagModal } from '@/contexts/TagModalContext';
import Button from '@/components/ui/Button';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import KpiCard from '@/components/ui/KpiCard';
import Pagination from '@/components/ui/Pagination';


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

const TYPE_VERSEMENT_BADGE: Record<string, BadgeVariant> = {
  COTISATION_INITIALE:  'info',
  VERSEMENT_PERIODIQUE: 'success',
  REMBOURSEMENT:        'teal',
  BONUS:                'purple',
  AJUSTEMENT:           'warning',
};

const PACK_TYPE_BADGE: Record<string, BadgeVariant> = {
  FAMILIAL:        'purple',
  URGENCE:         'error',
  REVENDEUR:       'info',
  EPARGNE_PRODUIT: 'teal',
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
      Date:       v.datePaiement ? new Date(v.datePaiement) : null,
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
    exportToXlsx(
      rows,
      [
        { label: 'Date',       key: 'Date', type: 'date' },
        { label: 'Client',     key: 'Client' },
        { label: 'Téléphone',  key: 'Telephone' },
        { label: 'Pack',       key: 'Pack' },
        { label: 'Type',       key: 'Type' },
        { label: 'Montant',    key: 'Montant', type: 'currency' },
        { label: 'Agent',      key: 'Agent' },
        { label: 'Collecte',   key: 'Collecte' },
        { label: 'Référence',  key: 'Reference' },
      ],
      `remboursements_${new Date().toISOString().slice(0, 10)}.xlsx`,
      { sheetName: 'Remboursements' }
    );
  };

  const stats = res?.stats;

  return (
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>
      <div className="p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Remboursements</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Suivi de tous les versements sur souscriptions packs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
            Exporter CSV
          </Button>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={refetch}>
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total encaissé"
          value={stats?.totalVersements ?? 0}
          format={formatCurrency}
          icon={<Wallet size={18} />}
          accent="success"
        />
        <KpiCard
          label="Nb de versements"
          value={stats?.nombreVersements ?? 0}
          icon={<TrendingUp size={18} />}
          accent="primary"
        />
        {stats?.parType.slice(0, 2).map((s) => (
          <KpiCard
            key={s.type}
            label={TYPE_VERSEMENT_LABELS[s.type] ?? s.type}
            value={s.montant}
            format={formatCurrency}
            icon={<CheckCircle size={18} />}
            accent="purple"
          />
        ))}
      </div>

      {/* Répartition par type */}
      {stats?.parType && stats.parType.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Répartition par type</p>
          <div className="flex flex-wrap gap-3">
            {stats.parType.map((s) => (
              <div key={s.type} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <Badge variant={TYPE_VERSEMENT_BADGE[s.type] ?? 'neutral'}>
                  {TYPE_VERSEMENT_LABELS[s.type] ?? s.type}
                </Badge>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(s.montant)}</span>
                <span className="text-xs text-slate-500">({s.nombre})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Nom client, téléphone, code…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button variant="primary" icon={<Search size={16} />} onClick={handleSearch} aria-label="Rechercher" />
        </div>

        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">Tous types</option>
          {Object.entries(TYPE_VERSEMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
          {res?.meta.total ?? 0} résultat(s)
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : !res?.data.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Wallet className="w-10 h-10 mb-2" />
            <p className="text-sm">Aucun versement trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Pack</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Progression</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Agent</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Via collecte</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Encaissé par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {res.data.map((v) => {
                const total   = Number(v.souscription.montantTotal);
                const verse   = Number(v.souscription.montantVerse);
                const pct     = total > 0 ? Math.min(100, Math.round((verse / total) * 100)) : 0;
                const solde   = v.souscription.statut === 'COMPLETE';

                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(v.datePaiement)}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {v.souscription.client.prenom} {v.souscription.client.nom}
                        {v.souscription.client.segment === 'RIA' && (
                          <Badge variant="indigo" className="ml-1.5">★ RIA</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {v.souscription.client.telephone}
                      </div>
                      {v.souscription.client.pointDeVente && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
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
                      <div className="font-medium text-slate-800">{v.souscription.pack.nom}</div>
                      <Badge variant={PACK_TYPE_BADGE[v.souscription.pack.type] ?? 'neutral'} className="mt-0.5">
                        {v.souscription.pack.type}
                      </Badge>
                    </td>

                    {/* Type versement */}
                    <td className="px-4 py-3">
                      <Badge variant={TYPE_VERSEMENT_BADGE[v.type] ?? 'neutral'}>
                        {TYPE_VERSEMENT_LABELS[v.type] ?? v.type}
                      </Badge>
                    </td>

                    {/* Montant */}
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {formatCurrency(Number(v.montant))}
                    </td>

                    {/* Progression */}
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{pct}%</span>
                        {solde && <span className="text-emerald-600 font-medium">Soldé</span>}
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${solde ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatCurrency(verse)} / {formatCurrency(total)}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-3">
                      {v.souscription.client.agentTerrain ? (
                        <span className="text-xs text-slate-700">
                          {v.souscription.client.agentTerrain.prenom}{' '}
                          {v.souscription.client.agentTerrain.nom}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Via collecte */}
                    <td className="px-4 py-3">
                      {v.ligneCollecte ? (
                        <div>
                          <div className="text-xs font-medium text-blue-700">
                            {v.ligneCollecte.collecte.reference}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatDate(v.ligneCollecte.collecte.dateCollecte)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Direct</span>
                      )}
                    </td>

                    {/* Encaissé par */}
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {v.encaisseParNom ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        {res && (
          <Pagination
            page={page}
            totalPages={res.meta.totalPages}
            total={res.meta.total}
            onPageChange={setPage}
            itemLabel="versement(s)"
          />
        )}
      </div>
      </div>{/* end p-6 */}
      </ClienteleTabBar>
    </div>
  );
}

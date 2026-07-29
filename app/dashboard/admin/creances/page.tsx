"use client";

import React, { useState, useCallback } from 'react';
import {
  Search, Clock, CheckCircle, TrendingDown,
  ChevronDown, ChevronUp, Eye, Wallet, Users, Calendar,
  AlertTriangle, Filter, RefreshCw, Phone, MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatCurrency } from '@/lib/format';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import { useTagModal } from '@/contexts/TagModalContext';
import Button from '@/components/ui/Button';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import KpiCard from '@/components/ui/KpiCard';
import Pagination from '@/components/ui/Pagination';


// ─── Types ────────────────────────────────────────────────────────────────────

interface EcheanceProchaine {
  id: number;
  montant: string;
  datePrevue: string;
  statut: string;
}

interface Creance {
  id: number;
  montantTotal: string;
  montantVerse: string;
  montantRestant: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
  enRetard: boolean;
  pack: { id: number; nom: string; type: string };
  client: {
    id: number; nom: string; prenom: string; telephone: string;
    codeClient: string | null; etat: string; segment: string;
    tags?: { tag: { id: number; nom: string; couleur: string } }[];
    agentTerrain: { id: number; nom: string; prenom: string } | null;
    pointDeVente: { id: number; nom: string; code: string } | null;
  };
  echeances: EcheanceProchaine[];
  _count: { versements: number; echeances: number };
}

interface CreancesResponse {
  data: Creance[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: {
    totalCreances: number;
    montantTotalDu: number;
    montantTotalPacks: number;
    montantTotalVerse: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, BadgeVariant> = {
  ACTIF:      'success',
  EN_ATTENTE: 'warning',
  EN_RETARD:  'error',
};

const PACK_TYPE_BADGE: Record<string, BadgeVariant> = {
  FAMILIAL:        'purple',
  URGENCE:         'error',
  REVENDEUR:       'info',
  EPARGNE_PRODUIT: 'teal',
};

function pct(verse: string, total: string) {
  const t = Number(total);
  if (t === 0) return 0;
  return Math.min(100, Math.round((Number(verse) / t) * 100));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreancesPage() {
  const [page,     setPage]     = useState(1);
  const tagModal = useTagModal();
  const [search,   setSearch]   = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statut,   setStatut]   = useState('');
  const [retard,   setRetard]   = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const query = new URLSearchParams({
    page: String(page), limit: '20',
    ...(search  && { search }),
    ...(statut  && { statut }),
    ...(retard  && { retard: 'true' }),
  }).toString();

  const { data: res, loading, refetch } = useApi<CreancesResponse>(
    `/api/admin/creances?${query}`
  );

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const toggleExpand = (id: number) =>
    setExpanded((prev) => (prev === id ? null : id));

  const stats = res?.stats;

  return (
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>
      <div className="p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Créances clients</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Souscriptions packs avec montant restant à percevoir
          </p>
        </div>
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={refetch}>
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total créances"
          value={stats?.totalCreances ?? 0}
          icon={<Users size={18} />}
          accent="primary"
        />
        <KpiCard
          label="Montant dû"
          value={stats?.montantTotalDu ?? 0}
          format={formatCurrency}
          icon={<TrendingDown size={18} />}
          accent="error"
        />
        <KpiCard
          label="Déjà versé"
          value={stats?.montantTotalVerse ?? 0}
          format={formatCurrency}
          icon={<Wallet size={18} />}
          accent="success"
        />
        <KpiCard
          label="Valeur totale packs"
          value={stats?.montantTotalPacks ?? 0}
          format={formatCurrency}
          icon={<CheckCircle size={18} />}
          accent="purple"
        />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Nom, téléphone, code client…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button variant="primary" icon={<Search size={16} />} onClick={handleSearch} aria-label="Rechercher" />
        </div>

        <select
          value={statut}
          onChange={(e) => { setStatut(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous statuts</option>
          <option value="ACTIF">Actif</option>
          <option value="EN_ATTENTE">En attente</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={retard}
            onChange={(e) => { setRetard(e.target.checked); setPage(1); }}
            className="w-4 h-4 text-red-600 rounded"
          />
          <AlertTriangle className="w-4 h-4 text-red-500" />
          En retard seulement
        </label>

        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
          {res?.meta.total ?? 0} résultat(s)
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : !res?.data.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Wallet className="w-10 h-10 mb-2" />
            <p className="text-sm">Aucune créance trouvée</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8" />
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Pack</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Progression</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Restant dû</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Prochaine éch.</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Agent</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Statut</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {res.data.map((c) => {
                const progress = pct(c.montantVerse, c.montantTotal);
                const prochaine = c.echeances[0] ?? null;
                const isExpanded = expanded === c.id;

                return (
                  <React.Fragment key={c.id}>
                    <tr className={`hover:bg-slate-50 transition-colors ${c.enRetard ? 'bg-red-50/40' : ''}`}>
                      {/* Expand */}
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!p-1"
                          onClick={() => toggleExpand(c.id)}
                          aria-label={isExpanded ? 'Réduire' : 'Développer'}
                          icon={isExpanded
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />}
                        />
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {c.client.prenom} {c.client.nom}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {c.client.telephone}
                          {c.client.codeClient && (
                            <span className="ml-1 text-slate-400">· {c.client.codeClient}</span>
                          )}
                        </div>
                        {c.client.pointDeVente && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {c.client.pointDeVente.nom}
                          </div>
                        )}
                        {(c.client.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(c.client.tags ?? []).slice(0, 3).map(({ tag }) => (
                              <button key={tag.id}
                                onClick={() => tagModal?.openTag(tag)}
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: tag.couleur }}
                                title={`Voir tous les clients "${tag.nom}"`}
                              >{tag.nom}</button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Pack */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{c.pack.nom}</div>
                        <Badge variant={PACK_TYPE_BADGE[c.pack.type] ?? 'neutral'} className="mt-0.5">
                          {c.pack.type}
                        </Badge>
                      </td>

                      {/* Progression */}
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{formatCurrency(Number(c.montantVerse))}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          sur {formatCurrency(Number(c.montantTotal))}
                        </div>
                      </td>

                      {/* Restant */}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${c.enRetard ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatCurrency(Number(c.montantRestant))}
                        </span>
                        {c.enRetard && (
                          <div className="flex items-center justify-end gap-1 text-xs text-red-500 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> En retard
                          </div>
                        )}
                      </td>

                      {/* Prochaine échéance */}
                      <td className="px-4 py-3">
                        {prochaine ? (
                          <div>
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <Calendar className="w-3 h-3" />
                              {formatDate(prochaine.datePrevue)}
                            </div>
                            <div className="text-xs font-medium text-slate-800 mt-0.5">
                              {formatCurrency(Number(prochaine.montant))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3">
                        {c.client.agentTerrain ? (
                          <div className="text-xs text-slate-700">
                            {c.client.agentTerrain.prenom} {c.client.agentTerrain.nom}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Non affecté</span>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <Badge variant={STATUT_BADGE[c.statut] ?? 'neutral'}>
                          {c.statut === 'ACTIF' && <CheckCircle className="w-3 h-3" />}
                          {c.statut === 'EN_ATTENTE' && <Clock className="w-3 h-3" />}
                          {c.statut}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/dashboard/admin/clients/${c.client.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          <Eye className="w-3 h-3" /> Fiche
                        </Link>
                      </td>
                    </tr>

                    {/* Ligne expandée */}
                    {isExpanded && (
                      <tr className="bg-blue-50/30">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Détail souscription</p>
                              <div className="space-y-1 text-slate-700">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Depuis :</span>
                                  <span>{formatDate(c.dateDebut)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Versements :</span>
                                  <span>{c._count.versements} paiement(s)</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Échéances totales :</span>
                                  <span>{c._count.echeances}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Client</p>
                              <div className="space-y-1 text-slate-700">
                                <div className="flex gap-1">
                                  <span className="text-slate-500">Tél :</span>
                                  <span>{c.client.telephone}</span>
                                </div>
                                {c.client.pointDeVente && (
                                  <div className="flex gap-1">
                                    <span className="text-slate-500">PDV :</span>
                                    <span>{c.client.pointDeVente.nom}</span>
                                  </div>
                                )}
                                <div className="flex gap-1">
                                  <span className="text-slate-500">État :</span>
                                  <span>{c.client.etat}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-end justify-end gap-2">
                              <Link
                                href={`/dashboard/admin/clients/${c.client.id}`}
                                className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                              >
                                Voir fiche complète
                              </Link>
                              <Link
                                href={`/dashboard/admin/collectes?clientId=${c.client.id}`}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-50"
                              >
                                Collectes client
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
            itemLabel="créances"
          />
        )}
      </div>
      </div>{/* end p-6 */}
      </ClienteleTabBar>
    </div>
  );
}

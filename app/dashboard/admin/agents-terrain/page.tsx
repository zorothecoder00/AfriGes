"use client";

import React, { useState, useCallback } from 'react';
import {
  UserCheck, Search, RefreshCw, Users, Wallet,
  Phone, MapPin, Calendar, AlertTriangle,
  BarChart2, Eye, ArrowRightLeft, CheckCircle2, QrCode, Printer,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import KpiCard from '@/components/ui/KpiCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollecteDetail {
  terrain:        number; // CollecteJournaliere validées
  versements:     number; // VersementPack directs par l'agent
  remboursements: number; // RemboursementCredit enregistrés par l'agent
  ventes:         number; // VenteDirecte réalisées par l'agent
}

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
  collecteDetail:       CollecteDetail;
}

interface Agent {
  id:       number;
  memberId: number;
  actif:    boolean;
  zone:     string | null;
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

  // Transfert portefeuille
  const [transferSource,   setTransferSource]   = useState<Agent | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferLoading,  setTransferLoading]  = useState(false);
  const [transferError,    setTransferError]    = useState('');
  const [transferSuccess,  setTransferSuccess]  = useState('');

  // QR de tournée (accès sans login)
  const [qrAgent,   setQrAgent]   = useState<Agent | null>(null);
  const [qrData,    setQrData]    = useState<{ url: string; qr: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrRegen,   setQrRegen]   = useState(false);

  const openQr = (agent: Agent) => {
    setQrAgent(agent); setQrData(null); setQrLoading(true);
    fetch(`/api/admin/agents-terrain/${agent.memberId}/scan-qr`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Erreur'); setQrData(j.data); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setQrLoading(false));
  };
  const regenererQr = () => {
    if (!qrAgent || !confirm("Régénérer le QR ? L'ancien QR imprimé de cet agent ne fonctionnera plus.")) return;
    setQrRegen(true);
    fetch(`/api/admin/agents-terrain/${qrAgent.memberId}/scan-qr`, { method: 'POST' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Erreur'); setQrData(j.data); toast.success("Nouveau QR généré — l'ancien ne marche plus"); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setQrRegen(false));
  };

  const query = new URLSearchParams({
    ...(search      && { search }),
    ...(actifFilter && { actif: actifFilter }),
  }).toString();

  const { data: res, loading, refetch } = useApi<AgentsResponse>(
    `/api/admin/agents-terrain?${query}`
  );

  const handleSearch = useCallback(() => setSearch(searchInput), [searchInput]);

  const agents = res?.data ?? [];
  const stats  = res?.stats;

  const openTransfer = (agent: Agent) => {
    setTransferSource(agent);
    setTransferTargetId('');
    setTransferError('');
    setTransferSuccess('');
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTargetId) return;
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      const res = await fetch(
        `/api/admin/agents-terrain/${transferSource.memberId}/transferer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versAgentId: Number(transferTargetId) }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur lors du transfert');
      setTransferSuccess(`${json.nbTransferes} client(s) transféré(s) avec succès.`);
      refetch();
    } catch (e: unknown) {
      setTransferError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Supervision agents de terrain</h2>
            <p className="text-sm text-slate-500 mt-0.5">Performance, recouvrement et activité par agent</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin/agents-terrain/qr-planche"
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm">
              <QrCode className="w-4 h-4" /> Imprimer tous les QR
            </Link>
            <Button variant="secondary" icon={<RefreshCw className={loading ? 'animate-spin' : ''} size={16} />} onClick={refetch}>
              Actualiser
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Agents actifs"
            value={stats?.actifs ?? 0}
            icon={<UserCheck size={18} />}
            accent="primary"
          />
          <KpiCard
            label="Clients affectés"
            value={stats?.totalClientsAffectes ?? 0}
            icon={<Users size={18} />}
            accent="purple"
          />
          <KpiCard
            label="Total agents"
            value={stats?.total ?? 0}
            icon={<BarChart2 size={18} />}
            accent="neutral"
          />
          <KpiCard
            label="Collecté ce mois"
            value={stats?.totalCollecteCeMois ?? 0}
            format={formatCurrency}
            icon={<Wallet size={18} />}
            accent="success"
          />
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher un agent…"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button variant="primary" icon={<Search size={16} />} onClick={handleSearch} aria-label="Rechercher" />
          </div>
          <select value={actifFilter} onChange={(e) => setActifFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
          <span className="text-sm text-slate-400">{agents.length} agent(s)</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <UserCheck className="w-10 h-10 mb-2" />
              <p className="text-sm">Aucun agent de terrain trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Agent</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Zone</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Clients</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Créances actives</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Collecté ce mois</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Taux recouvrement</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Dernière activité</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Statut</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map((agent) => {
                    const pdv = agent.member.affectationsPDV[0]?.pointDeVente ?? null;
                    return (
                      <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                        {/* Agent */}
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">
                            {agent.member.prenom} {agent.member.nom}
                          </p>
                          {agent.member.telephone && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Phone className="w-3 h-3" />{agent.member.telephone}
                            </div>
                          )}
                          {pdv && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3" />{pdv.nom}
                            </div>
                          )}
                        </td>

                        {/* Zone */}
                        <td className="px-4 py-3">
                          {agent.zone ? (
                            <Badge variant="indigo">
                              <MapPin className="w-3 h-3" />{agent.zone}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Nb clients */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-slate-900">{agent.stats.nbClients}</span>
                        </td>

                        {/* Créances */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-bold ${agent.stats.nbCreancesActives > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                            {agent.stats.nbCreancesActives}
                          </span>
                          {agent.stats.montantCreances > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(agent.stats.montantCreances)}</p>
                          )}
                        </td>

                        {/* Collecté ce mois — tooltip détail des 4 sources */}
                        <td className="px-4 py-3 text-right">
                          <div className="group relative inline-block w-full">
                            <p className="font-semibold text-emerald-700 cursor-help underline decoration-dotted decoration-emerald-400">
                              {formatCurrency(agent.stats.montantCollecteCeMois)}
                            </p>

                            {/* Tooltip détail */}
                            <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:block w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-left">
                              <p className="text-xs font-semibold text-slate-700 mb-2">Détail — ce mois</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Collectes terrain',       value: agent.stats.collecteDetail.terrain,        color: 'text-blue-600' },
                                  { label: 'Versements packs directs', value: agent.stats.collecteDetail.versements,     color: 'text-violet-600' },
                                  { label: 'Remboursements crédits',  value: agent.stats.collecteDetail.remboursements, color: 'text-orange-600' },
                                  { label: 'Ventes directes',         value: agent.stats.collecteDetail.ventes,         color: 'text-emerald-600' },
                                ].map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-slate-500 truncate">{row.label}</span>
                                    <span className={`text-xs font-semibold shrink-0 ${row.value > 0 ? row.color : 'text-slate-300'}`}>
                                      {formatCurrency(row.value)}
                                    </span>
                                  </div>
                                ))}
                                <div className="border-t border-slate-100 pt-1.5 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-700">Total</span>
                                  <span className="text-xs font-bold text-emerald-700">{formatCurrency(agent.stats.montantCollecteCeMois)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Taux recouvrement */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-bold ${TAUX_COLOR(agent.stats.tauxRecouvrement)}`}>
                              {agent.stats.tauxRecouvrement}%
                            </span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5">
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
                              <div className="flex items-center gap-1 text-xs text-slate-600">
                                <Calendar className="w-3 h-3" />
                                {formatDate(agent.stats.derniereActivite)}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {joursDepuis(agent.stats.derniereActivite)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" /> Aucune collecte
                            </span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3 text-center">
                          <Badge variant={agent.actif ? 'success' : 'neutral'}>
                            {agent.actif ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/dashboard/admin/agents-terrain/${agent.memberId}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              <Eye className="w-3 h-3" /> Détail
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openQr(agent)}
                              title="QR de tournée (accès sans login)"
                              icon={<QrCode className="w-3 h-3" />}
                            >
                              QR
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTransfer(agent)}
                              title="Transférer le portefeuille"
                              icon={<ArrowRightLeft className="w-3 h-3" />}
                            >
                              Transférer
                            </Button>
                          </div>
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

      {/* Modal QR de tournée (accès sans login) */}
      <Modal open={!!qrAgent} onClose={() => setQrAgent(null)} title="QR de tournée" size="sm">
        <div className="-mt-2 mb-4 flex items-center gap-2 text-sm text-slate-500">
          <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
          {qrAgent?.member.prenom} {qrAgent?.member.nom}
        </div>
        <div className="flex flex-col items-center">
          {qrLoading ? (
            <div className="py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
          ) : qrData ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrData.qr} alt="QR de tournée" className="w-52 h-52" />
              <a href={qrData.url} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-blue-600 break-all text-center hover:underline">{qrData.url}</a>
              <p className="text-[11px] text-slate-400 text-center mt-3">
                L&apos;agent scanne ce code pour voir ses objectifs du jour et ses clients à visiter, <strong>sans se connecter</strong>. Ce QR est personnel.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400 py-16">QR indisponible.</p>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => window.print()}
            disabled={!qrData}
            icon={<Printer size={16} />}
          >
            Imprimer
          </Button>
          <Button
            variant="secondary"
            onClick={regenererQr}
            disabled={qrRegen || !qrData}
            loading={qrRegen}
            icon={<RefreshCw size={16} />}
          >
            Régénérer
          </Button>
        </div>
      </Modal>

      {/* Modal transfert portefeuille */}
      <Modal open={!!transferSource} onClose={() => setTransferSource(null)} title="Transférer le portefeuille" size="sm">
        <p className="-mt-2 mb-4 text-sm text-slate-500">
          De <span className="font-medium text-slate-700">{transferSource?.member.prenom} {transferSource?.member.nom}</span>
          {' '}({transferSource?.stats.nbClients} client(s))
        </p>

        <div className="space-y-4">
          {/* Avertissement */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Tous les clients de cet agent seront réaffectés à l&apos;agent sélectionné. L&apos;historique des affectations est conservé.</p>
          </div>

          {/* Sélection agent destination */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Agent destination</label>
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Choisir un agent —</option>
              {agents
                .filter((a) => transferSource && a.memberId !== transferSource.memberId)
                .map((a) => (
                  <option key={a.memberId} value={a.memberId}>
                    {a.member.prenom} {a.member.nom}
                    {a.zone ? ` · ${a.zone}` : ''}
                    {' '}({a.stats.nbClients} clients)
                  </option>
                ))}
            </select>
          </div>

          {/* Feedback */}
          {transferError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{transferError}</p>
          )}
          {transferSuccess && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />{transferSuccess}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setTransferSource(null)}>
            Annuler
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleTransfer}
            disabled={!transferTargetId || transferLoading || !!transferSuccess}
            loading={transferLoading}
            icon={<ArrowRightLeft size={16} />}
          >
            Confirmer le transfert
          </Button>
        </div>
      </Modal>
      </ClienteleTabBar>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import {
  BarChart2, Download, RefreshCw, TrendingUp, TrendingDown,
  Users, Calendar, Wallet, AlertTriangle, UserCheck, FileText, FileSpreadsheet,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useT } from '@/contexts/AppSettingsContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToXlsx, exportRowsToXlsx } from '@/lib/exportXlsx';
import { exportToXls } from '@/lib/exportXls';
import { printToPdf } from '@/lib/exportPdf';
import ClienteleTabBar from '@/components/ClienteleTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecouvrementData {
  global: { nb: number; totalPacks: number; totalVerse: number; totalRestant: number; tauxGlobal: number };
  parTypePack: { type: string; nb: number; total: number; verse: number; restant: number; taux: number }[];
  parAgent:    { agentId: number; nom: string; nb: number; total: number; verse: number; restant: number; taux: number }[];
  parPdv:      { pdvId: number; nom: string; code: string; nb: number; total: number; verse: number; restant: number; taux: number }[];
  evolution:   { label: string; montant: number; nb: number }[];
}

interface CollectesData {
  global:    { nbTotal: number; totalPrevu: number; totalCollecte: number; tauxRealisation: number };
  parStatut: { statut: string; nb: number; montant: number }[];
  parAgent:  { agentId: number; nom: string; nbCollectes: number; montantCollecte: number }[];
  parJour:   { date: string; montant: number; nb: number }[];
}

interface CreancesData {
  global:        { nbCreances: number; totalRestant: number; totalPacks: number; totalVerse: number; tauxRecouvrement: number };
  parAnciennete: { label: string; nb: number; montant: number; color: string }[];
  parAgent:      { agentId: number; nom: string; nb: number; montant: number }[];
  parPdv:        { pdvId: number; nom: string; code: string; nb: number; montant: number }[];
}

interface AgentsData {
  data: {
    agentId: number; nom: string; telephone: string | null; actif: boolean;
    nbClients: number; nbSouscriptions: number;
    totalPacks: number; totalVerse: number; totalRestant: number;
    tauxRecouvrement: number; nbCollectes: number; montantCollecteSession: number;
    caTotal: number; // CA réel = versementPack + remboursementCredit + venteDirecte
  }[];
}

interface ClientsData {
  data: {
    id: number; codeClient: string; nom: string; prenom: string;
    telephone: string; ville: string; quartier: string;
    etat: string; typeClient: string; niveauRisque: string;
    agent: string; pdv: string;
    totalSouscriptions: number; totalCredits: number;
    totalEngagement: number; totalVerse: number; montantRestant: number;
    createdAt: string;
  }[];
  totaux: {
    nbClients: number; totalEngagement: number; totalVerse: number;
    montantRestant: number; nbActifs: number;
  };
}

interface RetardsData {
  data: {
    reference: string; clientNom: string; clientTel: string;
    ville: string; agent: string; pdv: string;
    montantTotal: number; montantRembourse: number; soldeRestant: number;
    tauxRembourse: number; premiereEcheanceRetard: string;
    joursRetard: number; gravite: string;
  }[];
  total: number; montantTotal: number;
  nbCritique: number; nbEleve: number; nbMoyen: number; nbFaible: number;
  moyenneJours: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAUX_BAR = (t: number) =>
  t >= 80 ? 'bg-emerald-500' : t >= 50 ? 'bg-amber-500' : 'bg-red-500';

const ANCIENNETE_COLOR: Record<string, string> = {
  emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  orange:  'bg-orange-500',  red:   'bg-red-500', rose: 'bg-rose-600',
};

const GRAVITE_CLS: Record<string, string> = {
  CRITIQUE: 'bg-red-100 text-red-700',
  ÉLEVÉ:    'bg-orange-100 text-orange-700',
  MOYEN:    'bg-amber-100 text-amber-700',
  FAIBLE:   'bg-green-100 text-green-700',
};

const fc = (v: number) => v.toLocaleString('fr-FR');

function tableHtml(headers: string[], rows: (string | number)[][]): string {
  const th  = headers.map((h) => `<th>${h}</th>`).join('');
  const trs = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function kpisHtml(items: { label: string; value: string }[]): string {
  return `<div class="kpis">${items.map((i) =>
    `<div class="kpi"><div class="kpi-label">${i.label}</div><div class="kpi-value">${i.value}</div></div>`
  ).join('')}</div>`;
}

type TabId = 'recouvrement' | 'collectes' | 'creances' | 'agents' | 'clients' | 'retards';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const t = useT();
  const [tab,       setTab]       = useState<TabId>('recouvrement');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const dateQuery = new URLSearchParams({
    ...(dateDebut && { dateDebut }),
    ...(dateFin   && { dateFin }),
  }).toString();

  const recouv   = useApi<RecouvrementData>(`/api/admin/rapports/recouvrement?${dateQuery}`);
  const collect  = useApi<CollectesData>(`/api/admin/rapports/collectes?${dateQuery}`);
  const creances = useApi<CreancesData>('/api/admin/rapports/creances');
  const agents   = useApi<AgentsData>(`/api/admin/rapports/agents?${dateQuery}`);
  const clients  = useApi<ClientsData>(`/api/admin/rapports/clients?${dateQuery}`);
  const retards  = useApi<RetardsData>('/api/admin/rapports/retards');

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'recouvrement', label: t('rapports_tab_recouvrement'), icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'collectes',    label: t('rapports_tab_collectes'),    icon: <Calendar className="w-4 h-4" /> },
    { id: 'creances',     label: t('rapports_tab_creances'),     icon: <TrendingDown className="w-4 h-4" /> },
    { id: 'agents',       label: t('rapports_tab_agents'),       icon: <UserCheck className="w-4 h-4" /> },
    { id: 'clients',      label: t('rapports_tab_clients'),      icon: <Users className="w-4 h-4" /> },
    { id: 'retards',      label: t('rapports_tab_retards'),      icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  const currentApi = {
    recouvrement: recouv, collectes: collect, creances, agents, clients, retards,
  }[tab];
  const isLoading = currentApi.loading;
  const refetchCurrent = () => currentApi.refetch();

  // ─── Export : Recouvrement (CSV complet, toutes sections) ────────────────

  const exportRecouvrementXlsx = () => {
    const d = recouv.data;
    if (!d) return;
    const pct = (n: number) => `${n}%`;

    // 1re ligne padee a 7 colonnes -> l'auto-largeur couvre toutes les sections.
    const rows: (string | number)[][] = [
      ['RAPPORT RECOUVREMENT', '', '', '', '', '', ''],
      ['Souscriptions', 'Total packs (FCFA)', 'Versé (FCFA)', 'Restant (FCFA)', 'Taux global (%)'],
      [d.global.nb, d.global.totalPacks, d.global.totalVerse, d.global.totalRestant, pct(d.global.tauxGlobal)],
      [],
      ['PAR AGENT'],
      ['Agent', 'Nb souscriptions', 'Total packs', 'Versé', 'Restant', 'Taux (%)'],
      ...d.parAgent.map((r) => [r.nom, r.nb, r.total, r.verse, r.restant, pct(r.taux)]),
      [],
      ['PAR TYPE DE PACK'],
      ['Type', 'Nb', 'Total packs', 'Versé', 'Restant', 'Taux (%)'],
      ...d.parTypePack.map((r) => [r.type, r.nb, r.total, r.verse, r.restant, pct(r.taux)]),
      [],
      ['PAR POINT DE VENTE'],
      ['PDV', 'Code', 'Nb', 'Total packs', 'Versé', 'Restant', 'Taux (%)'],
      ...d.parPdv.map((r) => [r.nom, r.code, r.nb, r.total, r.verse, r.restant, pct(r.taux)]),
      [],
      ['ÉVOLUTION MENSUELLE'],
      ['Mois', 'Nb versements', 'Montant (FCFA)'],
      ...d.evolution.map((e) => [e.label, e.nb, e.montant]),
    ];

    void exportRowsToXlsx(
      rows,
      `rapport-recouvrement-${new Date().toISOString().slice(0, 10)}.xlsx`,
      { sheetName: 'Recouvrement' },
    );
  };

  // ─── Export : Collectes (PDF complet) ────────────────────────────────────

  const exportCollectesPdf = () => {
    const d = collect.data;
    if (!d) return;
    const { global: g } = d;

    printToPdf('Rapport Collectes Journalières', [
      {
        content: kpisHtml([
          { label: 'Total collectes',   value: String(g.nbTotal) },
          { label: 'Montant prévu',     value: `${fc(g.totalPrevu)} FCFA` },
          { label: 'Montant collecté',  value: `${fc(g.totalCollecte)} FCFA` },
          { label: 'Taux réalisation',  value: `${g.tauxRealisation}%` },
        ]),
      },
      {
        heading: 'Répartition par statut',
        content: tableHtml(
          ['Statut', 'Nb sessions', 'Montant collecté (FCFA)'],
          d.parStatut.map((s) => [s.statut, s.nb, fc(s.montant)]),
        ),
      },
      {
        heading: 'Performance par agent',
        content: tableHtml(
          ['Agent', 'Nb collectes', 'Montant collecté (FCFA)'],
          d.parAgent.map((a) => [a.nom, a.nbCollectes, fc(a.montantCollecte)]),
        ),
      },
      {
        heading: 'Évolution quotidienne',
        content: tableHtml(
          ['Date', 'Nb sessions', 'Montant (FCFA)'],
          d.parJour.map((j) => [j.date, j.nb, fc(j.montant)]),
        ),
      },
    ]);
  };

  // ─── Export : Créances (PDF) ──────────────────────────────────────────────

  const exportCreancesPdf = () => {
    const d = creances.data;
    if (!d) return;
    const { global: g } = d;

    printToPdf('Rapport Créances', [
      {
        content: kpisHtml([
          { label: 'Créances ouvertes',    value: String(g.nbCreances) },
          { label: 'Montant dû total',     value: `${fc(g.totalRestant)} FCFA` },
          { label: 'Total versé',          value: `${fc(g.totalVerse)} FCFA` },
          { label: 'Taux recouvrement',    value: `${g.tauxRecouvrement}%` },
        ]),
      },
      {
        heading: 'Répartition par ancienneté du retard',
        content: tableHtml(
          ['Tranche', 'Nb créances', 'Montant restant (FCFA)'],
          d.parAnciennete.map((a) => [a.label, a.nb, fc(a.montant)]),
        ),
      },
      {
        heading: 'Par agent terrain',
        content: tableHtml(
          ['Agent', 'Nb créances', 'Montant restant (FCFA)'],
          d.parAgent.map((a) => [a.nom, a.nb, fc(a.montant)]),
        ),
      },
      {
        heading: 'Par point de vente',
        content: tableHtml(
          ['PDV', 'Code', 'Nb créances', 'Montant restant (FCFA)'],
          d.parPdv.map((p) => [p.nom, p.code, p.nb, fc(p.montant)]),
        ),
      },
    ]);
  };

  // ─── Export : Créances (Excel complet) ────────────────────────────────────

  const exportCreancesXls = () => {
    const d = creances.data;
    if (!d) return;
    exportToXls(
      [
        {
          title: 'Résumé global',
          headers: ['Créances ouvertes', 'Montant dû (FCFA)', 'Total versé (FCFA)', 'Taux recouvrement (%)'],
          rows: [[d.global.nbCreances, d.global.totalRestant, d.global.totalVerse, d.global.tauxRecouvrement]],
        },
        {
          title: 'Par ancienneté du retard',
          headers: ['Tranche', 'Nb créances', 'Montant restant (FCFA)'],
          rows: d.parAnciennete.map((a) => [a.label, a.nb, a.montant]),
        },
        {
          title: 'Par agent terrain',
          headers: ['Agent', 'Nb créances', 'Montant restant (FCFA)'],
          rows: d.parAgent.map((a) => [a.nom, a.nb, a.montant]),
        },
        {
          title: 'Par point de vente',
          headers: ['PDV', 'Code', 'Nb créances', 'Montant restant (FCFA)'],
          rows: d.parPdv.map((p) => [p.nom, p.code, p.nb, p.montant]),
        },
      ],
      `rapport-creances-${new Date().toISOString().slice(0, 10)}.xls`,
    );
  };

  // ─── Export : Agents (PDF complet) ───────────────────────────────────────

  const exportAgentsPdf = () => {
    const d = agents.data;
    if (!d) return;

    printToPdf('Performance des Agents Terrain', [
      {
        content: `<p style="margin-bottom:12px;color:#6b7280">${d.data.length} agents — classement par CA réel (versements + remboursements + ventes)</p>`,
      },
      {
        heading: 'Classement agents par CA',
        content: tableHtml(
          ['#', 'Agent', 'Téléphone', 'Clients', 'Souscriptions', 'Total packs (FCFA)',
           'Versé (FCFA)', 'Restant (FCFA)', 'Taux (%)', 'Sessions collecte',
           'CA réel (FCFA)'],
          d.data.map((a, i) => [
            i + 1, a.nom, a.telephone ?? '—', a.nbClients, a.nbSouscriptions,
            fc(a.totalPacks), fc(a.totalVerse), fc(a.totalRestant),
            `${a.tauxRecouvrement}%`, a.nbCollectes, fc(a.caTotal),
          ]),
        ),
      },
    ]);
  };

  // ─── Export : Clients (PDF) ───────────────────────────────────────────────

  const exportClientsPdf = () => {
    const d = clients.data;
    if (!d) return;
    const { totaux: t } = d;

    printToPdf('Liste des Clients', [
      {
        content: kpisHtml([
          { label: 'Total clients',   value: String(t.nbClients) },
          { label: 'Clients actifs',  value: String(t.nbActifs) },
          { label: 'Engagement total',value: `${fc(t.totalEngagement)} FCFA` },
          { label: 'Total versé',     value: `${fc(t.totalVerse)} FCFA` },
          { label: 'Restant dû',      value: `${fc(t.montantRestant)} FCFA` },
        ]),
      },
      {
        heading: 'Liste détaillée',
        content: tableHtml(
          ['Code', 'Prénom', 'Nom', 'Téléphone', 'Ville', 'Statut',
           'Agent', 'PDV', 'Souscriptions', 'Crédits', 'Restant dû (FCFA)', 'Inscrit le'],
          d.data.map((c) => [
            c.codeClient, c.prenom, c.nom, c.telephone, c.ville || '—', c.etat,
            c.agent, c.pdv, c.totalSouscriptions, c.totalCredits,
            fc(c.montantRestant), c.createdAt,
          ]),
        ),
      },
    ]);
  };

  // ─── Export : Clients (Excel) ─────────────────────────────────────────────

  const exportClientsXls = () => {
    const d = clients.data;
    if (!d) return;
    exportToXls(
      [
        {
          title: 'Résumé',
          headers: ['Total clients', 'Clients actifs', 'Engagement total (FCFA)', 'Total versé (FCFA)', 'Restant dû (FCFA)'],
          rows: [[
            d.totaux.nbClients, d.totaux.nbActifs,
            d.totaux.totalEngagement, d.totaux.totalVerse, d.totaux.montantRestant,
          ]],
        },
        {
          title: 'Liste des clients',
          headers: ['Code', 'Prénom', 'Nom', 'Téléphone', 'Ville', 'Quartier',
                    'Statut', 'Type', 'Risque', 'Agent', 'PDV',
                    'Souscriptions', 'Crédits', 'Engagement (FCFA)',
                    'Versé (FCFA)', 'Restant dû (FCFA)', 'Inscrit le'],
          rows: d.data.map((c) => [
            c.codeClient, c.prenom, c.nom, c.telephone,
            c.ville, c.quartier, c.etat, c.typeClient, c.niveauRisque,
            c.agent, c.pdv,
            c.totalSouscriptions, c.totalCredits,
            c.totalEngagement, c.totalVerse, c.montantRestant, c.createdAt,
          ]),
        },
      ],
      `rapport-clients-${new Date().toISOString().slice(0, 10)}.xls`,
    );
  };

  // ─── Export : Retards (Excel) ─────────────────────────────────────────────

  const exportRetardsXls = () => {
    const d = retards.data;
    if (!d) return;
    exportToXls(
      [
        {
          title: 'Résumé retards',
          headers: ['Total crédits en retard', 'Montant total dû (FCFA)', 'Critiques', 'Élevés', 'Moyens', 'Faibles', 'Moy. jours retard'],
          rows: [[d.total, d.montantTotal, d.nbCritique, d.nbEleve, d.nbMoyen, d.nbFaible, d.moyenneJours]],
        },
        {
          title: 'Détail des retards',
          headers: ['Référence', 'Client', 'Téléphone', 'Ville', 'Agent', 'PDV',
                    'Montant total (FCFA)', 'Remboursé (FCFA)', 'Solde restant (FCFA)',
                    'Taux remb. (%)', '1ère échéance retard', 'Jours retard', 'Gravité'],
          rows: d.data.map((r) => [
            r.reference, r.clientNom, r.clientTel, r.ville, r.agent, r.pdv,
            r.montantTotal, r.montantRembourse, r.soldeRestant,
            `${r.tauxRembourse}%`, r.premiereEcheanceRetard, r.joursRetard, r.gravite,
          ]),
        },
      ],
      `rapport-retards-${new Date().toISOString().slice(0, 10)}.xls`,
    );
  };

  // ─── Boutons export selon l'onglet actif ─────────────────────────────────

  const exportButtons: Record<TabId, React.ReactNode> = {
    recouvrement: (
      <button onClick={exportRecouvrementXlsx}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm">
        <Download className="w-4 h-4" /> Excel
      </button>
    ),
    collectes: (
      <button onClick={exportCollectesPdf}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-sm">
        <FileText className="w-4 h-4" /> PDF
      </button>
    ),
    creances: (
      <div className="flex gap-2">
        <button onClick={exportCreancesPdf}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-sm">
          <FileText className="w-4 h-4" /> PDF
        </button>
        <button onClick={exportCreancesXls}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>
      </div>
    ),
    agents: (
      <button onClick={exportAgentsPdf}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-sm">
        <FileText className="w-4 h-4" /> PDF
      </button>
    ),
    clients: (
      <div className="flex gap-2">
        <button onClick={exportClientsPdf}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-sm">
          <FileText className="w-4 h-4" /> PDF
        </button>
        <button onClick={exportClientsXls}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>
      </div>
    ),
    retards: (
      <button onClick={exportRetardsXls}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm">
        <FileSpreadsheet className="w-4 h-4" /> Excel
      </button>
    ),
  };

  // ─── Export legacy (pour compatibilité si appelé directement) ─────────────
  const exportAgentsCsv = () => {
    exportToXlsx(agents.data?.data ?? [], [
      { label: 'Agent',             key: 'nom' },
      { label: 'Téléphone',         key: 'telephone', format: (v) => String(v ?? '—') },
      { label: 'Actif',             key: 'actif',     format: (v) => (v ? 'Oui' : 'Non') },
      { label: 'Clients',           key: 'nbClients',       type: 'number' },
      { label: 'Souscriptions',     key: 'nbSouscriptions', type: 'number' },
      { label: 'Total packs',       key: 'totalPacks',      type: 'currency' },
      { label: 'Total versé',       key: 'totalVerse',      type: 'currency' },
      { label: 'Total restant',     key: 'totalRestant',    type: 'currency' },
      { label: 'Taux recouvrement', key: 'tauxRecouvrement', format: (v) => `${v}%` },
      { label: 'Sessions collecte', key: 'nbCollectes',     type: 'number' },
      { label: 'CA réel (FCFA)',    key: 'caTotal',          type: 'currency' },
    ], `rapport-agents-${new Date().toISOString().slice(0, 10)}.xlsx`, { sheetName: 'Agents' });
  };
  void exportAgentsCsv; // evite le warning unused

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('rapports_title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('rapports_subtitle_detail')}</p>
          </div>
          <div className="flex items-center gap-2">
            {exportButtons[tab]}
            <button onClick={refetchCurrent}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Onglets + filtres + contenu */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Onglets */}
          <div className="flex border-b border-gray-200 px-4 pt-4 gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Filtres date (sauf créances et retards — snapshots) */}
          {tab !== 'creances' && tab !== 'retards' && (
            <div className="px-6 py-4 flex items-center gap-4 bg-gray-50 border-b border-gray-100 flex-wrap">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t('rapports_period_label')}
              </span>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
              <span className="text-gray-400 text-sm">→</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
              {(dateDebut || dateFin) && (
                <button onClick={() => { setDateDebut(''); setDateFin(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  {t('btn_clear')}
                </button>
              )}
            </div>
          )}

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('rapports_loading')}
              </div>
            ) : (
              <>
                {tab === 'recouvrement' && recouv.data  && <TabRecouvrement data={recouv.data} />}
                {tab === 'collectes'    && collect.data && <TabCollectes    data={collect.data} />}
                {tab === 'creances'     && creances.data && <TabCreances    data={creances.data} />}
                {tab === 'agents'       && agents.data  && <TabAgents       data={agents.data} />}
                {tab === 'clients'      && clients.data && <TabClients      data={clients.data} />}
                {tab === 'retards'      && retards.data && <TabRetards      data={retards.data} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Recouvrement ─────────────────────────────────────────────────────────

function TabRecouvrement({ data }: { data: RecouvrementData }) {
  const t = useT();
  const g = data.global;
  const maxEvo = Math.max(...data.evolution.map((e) => e.montant), 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label={t('rapports_souscriptions')} value={String(g.nb)}              icon={<Wallet className="w-5 h-5 text-blue-600" />}    bg="bg-blue-50" />
        <StatBox label={t('rapports_total_packs')}   value={formatCurrency(g.totalPacks)} icon={<BarChart2 className="w-5 h-5 text-violet-600" />} bg="bg-violet-50" />
        <StatBox label={t('rapports_verse')}         value={formatCurrency(g.totalVerse)} icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
        <StatBox label={t('rapports_taux_global')}   value={`${g.tauxGlobal}%`}        icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
      </div>

      {data.evolution.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">{t('rapports_evo_versements')}</p>
          <div className="flex items-end gap-2 h-28 bg-gray-50 rounded-xl p-4">
            {data.evolution.map((e) => {
              const h = Math.max(4, Math.round((e.montant / maxEvo) * 100));
              return (
                <div key={e.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-gray-400">{e.montant > 0 ? `${Math.round(e.montant / 1000)}K` : ''}</span>
                  <div className="w-full rounded-t bg-blue-500 hover:bg-blue-600" style={{ height: `${h}%` }}
                    title={`${e.label} : ${formatCurrency(e.montant)}`} />
                  <span className="text-[9px] text-gray-400">{e.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankTable
          title={t('rapports_par_agent')} icon={<Users className="w-4 h-4 text-blue-600" />}
          rows={data.parAgent.slice(0, 8)}
          cols={[
            { label: t('rapports_col_agent'), render: (r) => r.nom },
            { label: t('rapports_col_nb'),    render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: t('rapports_col_verse'), render: (r) => formatCurrency(r.verse), cls: 'text-right text-emerald-600 font-semibold' },
            { label: t('rapports_col_taux'),  render: (r) => (
              <div className="flex items-center gap-2">
                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${TAUX_BAR(r.taux)}`} style={{ width: `${r.taux}%` }} />
                </div>
                <span className="text-xs font-bold">{r.taux}%</span>
              </div>
            ) },
          ]}
        />
        <RankTable
          title={t('rapports_par_type')} icon={<BarChart2 className="w-4 h-4 text-violet-600" />}
          rows={data.parTypePack}
          cols={[
            { label: t('rapports_col_type'),  render: (r) => r.type },
            { label: t('rapports_col_nb'),    render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: t('rapports_col_verse'), render: (r) => formatCurrency(r.verse), cls: 'text-right text-emerald-600 font-semibold' },
            { label: t('rapports_col_taux'),  render: (r) => `${r.taux}%`, cls: 'text-right font-bold' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Tab Collectes ────────────────────────────────────────────────────────────

function TabCollectes({ data }: { data: CollectesData }) {
  const t = useT();
  const g = data.global;
  const maxJour = Math.max(...data.parJour.map((j) => j.montant), 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label={t('rapports_total_collectes')}  value={String(g.nbTotal)}           icon={<Calendar className="w-5 h-5 text-teal-600" />}    bg="bg-teal-50" />
        <StatBox label={t('rapports_montant_prevu')}    value={formatCurrency(g.totalPrevu)}  icon={<BarChart2 className="w-5 h-5 text-blue-600" />}   bg="bg-blue-50" />
        <StatBox label={t('rapports_montant_encaisse')} value={formatCurrency(g.totalCollecte)} icon={<Wallet className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
        <StatBox label={t('rapports_taux_realisation')} value={`${g.tauxRealisation}%`}      icon={<TrendingUp className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
      </div>

      <div className="flex flex-wrap gap-3">
        {data.parStatut.map((s) => (
          <div key={s.statut} className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-200">
            <span className="text-sm font-medium text-gray-700">{s.statut}</span>
            <span className="text-lg font-bold text-gray-900">{s.nb}</span>
            <span className="text-sm text-gray-500">{formatCurrency(s.montant)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.parJour.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('rapports_collectes_par_jour')}</p>
            <div className="flex items-end gap-1 h-28 bg-gray-50 rounded-xl p-3 overflow-x-auto">
              {data.parJour.slice(-30).map((j) => {
                const h = Math.max(4, Math.round((j.montant / maxJour) * 100));
                return (
                  <div key={j.date} className="flex-1 min-w-[12px] flex flex-col items-center">
                    <div className="w-full rounded-t bg-teal-500 hover:bg-teal-600" style={{ height: `${h}%` }}
                      title={`${formatDate(j.date)} : ${formatCurrency(j.montant)}`} />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">{t('rapports_30j')}</p>
          </div>
        )}
        <RankTable
          title={t('rapports_par_agent')} icon={<Users className="w-4 h-4 text-teal-600" />}
          rows={data.parAgent.slice(0, 8)}
          cols={[
            { label: t('rapports_col_agent'),    render: (r) => r.nom },
            { label: t('rapports_col_collectes'), render: (r) => String(r.nbCollectes), cls: 'text-right text-gray-600' },
            { label: t('rapports_col_encaisse'),  render: (r) => formatCurrency(r.montantCollecte), cls: 'text-right text-emerald-600 font-semibold' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Tab Créances ─────────────────────────────────────────────────────────────

function TabCreances({ data }: { data: CreancesData }) {
  const t = useT();
  const g = data.global;
  const maxAnc = Math.max(...data.parAnciennete.map((a) => a.montant), 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label={t('rapports_creances_ouvertes')} value={String(g.nbCreances)}       icon={<AlertTriangle className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
        <StatBox label={t('rapports_montant_du')}        value={formatCurrency(g.totalRestant)} icon={<TrendingDown className="w-5 h-5 text-red-600" />}     bg="bg-red-50" />
        <StatBox label={t('rapports_verse_total')}       value={formatCurrency(g.totalVerse)}   icon={<Wallet className="w-5 h-5 text-emerald-600" />}       bg="bg-emerald-50" />
        <StatBox label={t('rapports_taux_recouvrement')} value={`${g.tauxRecouvrement}%`}       icon={<TrendingUp className="w-5 h-5 text-blue-600" />}      bg="bg-blue-50" />
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">{t('rapports_par_anciennete')}</p>
        <div className="space-y-2">
          {data.parAnciennete.map((a) => {
            const pct = maxAnc > 0 ? Math.round((a.montant / maxAnc) * 100) : 0;
            return (
              <div key={a.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-28 shrink-0">{a.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                  <div className={`h-5 rounded-full ${ANCIENNETE_COLOR[a.color]}`} style={{ width: `${pct}%` }} />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-white"
                    style={{ opacity: pct > 15 ? 1 : 0 }}>{a.nb}</span>
                </div>
                <span className="text-xs font-semibold text-gray-700 w-28 text-right shrink-0">
                  {formatCurrency(a.montant)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankTable
          title={t('rapports_par_agent_terrain')} icon={<Users className="w-4 h-4 text-orange-600" />}
          rows={data.parAgent.slice(0, 8)}
          cols={[
            { label: t('rapports_col_agent'),    render: (r) => r.nom },
            { label: t('rapports_col_creances'), render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: t('rapports_col_montant'),  render: (r) => formatCurrency(r.montant), cls: 'text-right text-red-600 font-semibold' },
          ]}
        />
        <RankTable
          title={t('rapports_par_point_vente')} icon={<BarChart2 className="w-4 h-4 text-blue-600" />}
          rows={data.parPdv.slice(0, 8)}
          cols={[
            { label: t('rapports_col_pdv'),      render: (r) => `${r.nom} (${r.code})` },
            { label: t('rapports_col_creances'), render: (r) => String(r.nb), cls: 'text-right text-gray-600' },
            { label: t('rapports_col_montant'),  render: (r) => formatCurrency(r.montant), cls: 'text-right text-red-600 font-semibold' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Tab Agents ───────────────────────────────────────────────────────────────

function TabAgents({ data }: { data: AgentsData }) {
  const t = useT();
  const maxCa = Math.max(...data.data.map((a) => a.caTotal), 1);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {data.data.length} {t('rapports_agents_classement')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_agent')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_clients')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_souscrip')}</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('rapports_col_total_packs')}</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('rapports_col_verse')}</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('rapports_col_restant')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_taux')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_sessions')}</th>
              <th className="text-right px-4 py-3 font-semibold text-blue-700">{t('rapports_col_ca_reel')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.data.map((a, i) => (
              <tr key={a.agentId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700'
                    : i === 1 ? 'bg-gray-200 text-gray-600'
                    : i === 2 ? 'bg-orange-100 text-orange-700'
                    : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{a.nom}</div>
                  {a.telephone && <div className="text-xs text-gray-400">{a.telephone}</div>}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">{a.nbClients}</td>
                <td className="px-4 py-3 text-center text-gray-700">{a.nbSouscriptions}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(a.totalPacks)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(a.totalVerse)}</td>
                <td className="px-4 py-3 text-right text-red-600">{formatCurrency(a.totalRestant)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-16 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${TAUX_BAR(a.tauxRecouvrement)}`} style={{ width: `${a.tauxRecouvrement}%` }} />
                    </div>
                    <span className="text-xs font-bold">{a.tauxRecouvrement}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">{a.nbCollectes}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-20 bg-blue-50 rounded-full h-2 hidden lg:block">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.round((a.caTotal / maxCa) * 100)}%` }}
                      />
                    </div>
                    <span className="font-bold text-blue-700 whitespace-nowrap">
                      {formatCurrency(a.caTotal)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab Clients ──────────────────────────────────────────────────────────────

function TabClients({ data }: { data: ClientsData }) {
  const t = useT();
  const { totaux } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatBox label={t('rapports_total_clients')}    value={String(totaux.nbClients)}          icon={<Users className="w-5 h-5 text-blue-600" />}    bg="bg-blue-50" />
        <StatBox label={t('rapports_clients_actifs')}   value={String(totaux.nbActifs)}           icon={<UserCheck className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
        <StatBox label={t('rapports_engagement_total')} value={formatCurrency(totaux.totalEngagement)} icon={<BarChart2 className="w-5 h-5 text-violet-600" />} bg="bg-violet-50" />
        <StatBox label={t('rapports_total_verse')}      value={formatCurrency(totaux.totalVerse)} icon={<Wallet className="w-5 h-5 text-teal-600" />}    bg="bg-teal-50" />
        <StatBox label={t('rapports_restant_du')}       value={formatCurrency(totaux.montantRestant)} icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_code')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_clients')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_telephone')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_ville')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_statut')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_agent')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_pdv')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_souscrip')}</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('rapports_col_restant_du')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_inscrit_le')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.data.slice(0, 100).map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{c.codeClient}</td>
                <td className="px-4 py-2 font-medium text-gray-900">{c.prenom} {c.nom}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{c.telephone}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{c.ville || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.etat === 'ACTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>{c.etat}</span>
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">{c.agent}</td>
                <td className="px-4 py-2 text-xs text-gray-600">{c.pdv}</td>
                <td className="px-4 py-2 text-center text-gray-700">{c.totalSouscriptions + c.totalCredits}</td>
                <td className="px-4 py-2 text-right font-semibold text-orange-700">
                  {c.montantRestant > 0 ? formatCurrency(c.montantRestant) : '—'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{c.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.data.length > 100 && (
          <p className="text-xs text-gray-400 text-center py-3">
            Affichage limité à 100 lignes — utilisez l&apos;export pour la liste complète ({data.data.length} clients)
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Tab Retards ──────────────────────────────────────────────────────────────

function TabRetards({ data }: { data: RetardsData }) {
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label={t('rapports_credits_retard')}   value={String(data.total)}             icon={<AlertTriangle className="w-5 h-5 text-red-600" />}    bg="bg-red-50" />
        <StatBox label={t('rapports_montant_du_total')} value={formatCurrency(data.montantTotal)} icon={<Wallet className="w-5 h-5 text-orange-600" />}       bg="bg-orange-50" />
        <StatBox label={t('rapports_critiques')}        value={String(data.nbCritique)}        icon={<TrendingDown className="w-5 h-5 text-rose-600" />}    bg="bg-rose-50" />
        <StatBox label={t('rapports_moy_jours_retard')} value={`${data.moyenneJours}j`}        icon={<Calendar className="w-5 h-5 text-amber-600" />}       bg="bg-amber-50" />
      </div>

      {/* Résumé gravité */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Critique', nb: data.nbCritique,  cls: 'bg-red-100 text-red-700 border-red-200' },
          { label: 'Élevé',    nb: data.nbEleve,     cls: 'bg-orange-100 text-orange-700 border-orange-200' },
          { label: 'Moyen',    nb: data.nbMoyen,     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
          { label: 'Faible',   nb: data.nbFaible,    cls: 'bg-green-100 text-green-700 border-green-200' },
        ].map((g) => (
          <div key={g.label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${g.cls}`}>
            {g.label} <span className="text-lg font-bold">{g.nb}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_reference')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_clients')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_telephone')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_agent')}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('rapports_col_pdv')}</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('rapports_col_montant')}</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('rapports_col_solde')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_taux_remb')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_echeance')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_jours')}</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('rapports_col_gravite')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.data.map((r) => (
              <tr key={r.reference} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.reference}</td>
                <td className="px-4 py-2 font-medium text-gray-900">{r.clientNom}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{r.clientTel}</td>
                <td className="px-4 py-2 text-xs text-gray-600">{r.agent}</td>
                <td className="px-4 py-2 text-xs text-gray-600">{r.pdv}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.montantTotal)}</td>
                <td className="px-4 py-2 text-right font-semibold text-red-700">{formatCurrency(r.soldeRestant)}</td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="w-12 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${TAUX_BAR(r.tauxRembourse)}`} style={{ width: `${r.tauxRembourse}%` }} />
                    </div>
                    <span className="text-xs font-bold">{r.tauxRembourse}%</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-center text-xs text-gray-500">{r.premiereEcheanceRetard}</td>
                <td className="px-4 py-2 text-center font-bold text-gray-800">{r.joursRetard}j</td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GRAVITE_CLS[r.gravite] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.gravite}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Composants réutilisables ─────────────────────────────────────────────────

function StatBox({ label, value, icon, bg }: {
  label: string; value: string; icon: React.ReactNode; bg: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`${bg} p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-gray-900 text-lg">{value}</p>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RankTable<T extends Record<string, any>>({ title, icon, rows, cols }: {
  title: string;
  icon:  React.ReactNode;
  rows:  T[];
  cols:  { label: string; render: (r: T) => React.ReactNode; cls?: string }[];
}) {
  const t = useT();
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">{icon}{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{t('rapports_no_data')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{cols.map((c) => <th key={c.label} className="px-3 py-2 font-semibold text-gray-600 text-left">{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {cols.map((c) => <td key={c.label} className={`px-3 py-2 ${c.cls ?? ''}`}>{c.render(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

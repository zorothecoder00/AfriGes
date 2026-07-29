"use client";

import React, { useState, useEffect, startTransition } from 'react';
import {
  RefreshCw, Filter, Calendar, CheckCircle,
  Clock, XCircle, Eye, Phone,
  MapPin, Wallet, TrendingUp,
  Save, Check,
} from 'lucide-react';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate, formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import { useT } from '@/contexts/AppSettingsContext';
import { useTagModal } from '@/contexts/TagModalContext';
import Button from '@/components/ui/Button';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import KpiCard from '@/components/ui/KpiCard';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collecte {
  id: number;
  reference: string;
  dateCollecte: string;
  statut: 'EN_COURS' | 'VALIDEE' | 'ANNULEE';
  montantPrevu: string;
  montantCollecte: string;
  notes: string | null;
  dateValidation: string | null;
  agent: { id: number; nom: string; prenom: string };
  validePar: { id: number; nom: string; prenom: string } | null;
  pointDeVente: { id: number; nom: string; code: string } | null;
  _count: { lignes: number };
}

interface CollectesResponse {
  data: Collecte[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneDetail {
  id: number;
  montantAttendu: string;
  montantCollecte: string;
  statut: 'EN_ATTENTE' | 'COLLECTE' | 'PARTIEL' | 'ECHEC';
  notes: string | null;
  client: { id: number; nom: string; prenom: string; telephone: string; adresse: string | null; quartier: string | null; ville: string | null; codeClient: string | null; segment: string; tags: { tag: { id: number; nom: string; couleur: string } }[] };
  souscription: { id: number; montantTotal: string; montantVerse: string; montantRestant: string; statut: string; pack: { nom: string; type: string } };
  versementPack: { id: number; montant: string; datePaiement: string; reference: string } | null;
}

interface CollecteDetail {
  id: number; reference: string; dateCollecte: string; statut: string;
  montantPrevu: string; montantCollecte: string; notes: string | null;
  agent: { id: number; nom: string; prenom: string };
  validePar: { id: number; nom: string; prenom: string } | null;
  pointDeVente: { id: number; nom: string; code: string } | null;
  lignes: LigneDetail[];
}

interface AgentOption {
  id: number;
  member: { id: number; nom: string; prenom: string };
}

// ─── Constantes ───────────────────────────────────────────────────────────────


const STATUT_VARIANT: Record<string, BadgeVariant> = {
  EN_COURS: 'warning',
  VALIDEE:  'success',
  ANNULEE:  'error',
};

function getStatutBadge(
  t: ReturnType<typeof useT>
): Record<string, { icon: React.ReactNode; label: string }> {
  return {
    EN_COURS: {
      icon: <Clock className="w-3 h-3" />,
      label: t('collecte_en_cours')
    },

    VALIDEE: {
      icon: <CheckCircle className="w-3 h-3" />,
      label: t('collecte_validee')
    },

    ANNULEE: {
      icon: <XCircle className="w-3 h-3" />,
      label: t('collecte_annulee')
    },
  };
}

// Variante Badge pour le statut des lignes de collecte (utilisée en affichage seul)
const LIGNE_STATUT_VARIANT: Record<string, BadgeVariant> = {
  EN_ATTENTE: 'neutral',
  COLLECTE:   'success',
  PARTIEL:    'info',
  ECHEC:      'error',
};

// Le <select> de saisie a besoin de classes de fond (pas un simple badge d'affichage)
const LIGNE_STATUT_SELECT_STYLE: Record<string, string> = {
  EN_ATTENTE: 'bg-slate-100 text-slate-600',
  COLLECTE:   'bg-emerald-100 text-emerald-700',
  PARTIEL:    'bg-blue-100 text-blue-700',
  ECHEC:      'bg-red-100 text-red-700',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectesPage() {
  const t = useT();
  const STATUT_BADGE = getStatutBadge(t);
  const [page,      setPage]      = useState(1);
  const [statut,    setStatut]    = useState('');
  const [agentId,   setAgentId]   = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');

  const [detailId,     setDetailId]     = useState<number | null>(null);
  const [saisieId,     setSaisieId]     = useState<number | null>(null);

  const query = new URLSearchParams({
    page: String(page), limit: '20',
    ...(statut    && { statut }),
    ...(agentId   && { agentId }),
    ...(dateDebut && { dateDebut }),
    ...(dateFin   && { dateFin }),
  }).toString();

  const { data: res, loading, refetch } = useApi<CollectesResponse>(
    `/api/admin/collectes?${query}`,
    undefined,
    { refreshInterval: 30_000 } // rafraîchissement auto toutes les 30 secondes
  );

  const { data: agents } = useApi<{ data: AgentOption[] }>(
    '/api/admin/gestionnaires?role=AGENT_TERRAIN&limit=100'
  );

  // Stats rapides
  const enCours  = res?.data.filter((c) => c.statut === 'EN_COURS').length  ?? 0;
  const validees = res?.data.filter((c) => c.statut === 'VALIDEE').length   ?? 0;
  const totalCollecte = res?.data.reduce(
    (s, c) => s + Number(c.montantCollecte), 0
  ) ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>
      <div className="p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('collecte_title')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t('collecte_subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw className={loading ? 'animate-spin' : ''} size={16} />}
          onClick={refetch}
        >
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t('collecte_en_cours')}    value={enCours}       icon={<Clock size={18} />}       accent="warning" />
        <KpiCard label={t('collecte_validee')}     value={validees}      icon={<CheckCircle size={18} />} accent="success" />
        <KpiCard label={t('collecte_montant_col')} value={totalCollecte} icon={<Wallet size={18} />}      accent="primary" format={formatCurrency} />
        <KpiCard label={t('collecte_total')}       value={res?.meta.total ?? 0} icon={<TrendingUp size={18} />} accent="purple" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={statut}
          onChange={(e) => { setStatut(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">{t('collecte_all_statuts')}</option>
          <option value="EN_COURS">{t('collecte_en_cours')}</option>
          <option value="VALIDEE">{t('collecte_validee')}</option>
          <option value="ANNULEE">{t('collecte_annulee')}</option>
        </select>

        <select
          value={agentId}
          onChange={(e) => { setAgentId(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">{t('collecte_all_agents')}</option>
          {agents?.data.map((a) => (
            <option key={a.id} value={a.id}>
              {a.member.prenom} {a.member.nom}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date" value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date" value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Filter className="w-4 h-4" /> {res?.meta.total ?? 0} session(s)
        </div>
      </div>

      {/* Liste collectes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('collecte_loading')}
          </div>
        ) : !res?.data.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Calendar className="w-10 h-10 mb-2" />
            <p className="text-sm">{t('collecte_none_found')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('label_reference')}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('collecte_col_date')}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('collecte_col_agent')}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('collecte_col_pdv')}</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">{t('collecte_col_prevu')}</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">{t('collecte_col_collecte')}</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">{t('collecte_lignes')}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('col_status')}</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {res.data.map((c) => {
                const badge = STATUT_BADGE[c.statut];
                const taux = Number(c.montantPrevu) > 0
                  ? Math.round((Number(c.montantCollecte) / Number(c.montantPrevu)) * 100)
                  : 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.reference}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(c.dateCollecte)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {c.agent.prenom} {c.agent.nom}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {c.pointDeVente?.nom ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(Number(c.montantPrevu))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(Number(c.montantCollecte))}
                      </span>
                      {Number(c.montantPrevu) > 0 && (
                        <div className="text-xs text-slate-400 mt-0.5">{taux}%</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                        {c._count.lignes}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUT_VARIANT[c.statut] ?? 'neutral'} icon={badge.icon}>
                        {badge.label}
                      </Badge>
                      {c.validePar && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          par {c.validePar.prenom} {c.validePar.nom}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailId(c.id)}
                          title="Voir détail"
                          icon={<Eye className="w-4 h-4" />}
                        />
                        {c.statut === 'EN_COURS' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSaisieId(c.id)}
                            title="Saisir montants collectés"
                            icon={<Save className="w-4 h-4" />}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {res && (
        <Pagination
          page={page}
          totalPages={res.meta.totalPages}
          total={res.meta.total}
          onPageChange={setPage}
        />
      )}

      {detailId && (
        <CollecteDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onValidated={() => { setDetailId(null); refetch(); }}
        />
      )}
      {saisieId && (
        <SaisieCollecteModal
          id={saisieId}
          onClose={() => setSaisieId(null)}
          onSaved={() => { setSaisieId(null); refetch(); }}
        />
      )}
      </div>{/* end p-6 */}
      </ClienteleTabBar>
    </div>
  );
}

// ─── Modal : Saisie terrain ───────────────────────────────────────────────────

function SaisieCollecteModal({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const tagModal = useTagModal();
  const { data: res, loading } = useApi<{ data: CollecteDetail }>(`/api/admin/collectes/${id}`);
  const { mutate: patch, loading: saving } = useMutation(`/api/admin/collectes/${id}`, 'PATCH');
  const { mutate: valider, loading: validating } = useMutation(`/api/admin/collectes/${id}/valider`, 'POST');

  const [lignes, setLignes] = useState<{
    ligneId: number; montantCollecte: number; statut: string; notes: string;
  }[]>([]);

  useEffect(() => {
    if (res?.data.lignes) {
      startTransition(() => {
        setLignes(
          res.data.lignes.map((l) => ({
            ligneId:         l.id,
            montantCollecte: Number(l.montantCollecte),
            statut:          l.statut,
            notes:           l.notes ?? '',
          }))
        );
      });
    }
  }, [res]);

  const updateLigne = (ligneId: number, field: string, value: string | number) =>
    setLignes((prev) => prev.map((l) => l.ligneId === ligneId ? { ...l, [field]: value } : l));

  const handleSave = async () => {
    const result = await patch({ lignes });
    if (result) { toast.success('Saisie sauvegardée'); onSaved(); }
  };

  const handleValider = async () => {
    await patch({ lignes });
    const result = await valider({});
    if (result) { toast.success('Collecte validée — versements générés'); onSaved(); }
  };

  const collecte = res?.data;

  return (
    <Modal open onClose={onClose} title={t('collecte_saisie_title')} size="lg">
      {collecte && (
        <p className="text-sm text-slate-500 -mt-3 mb-4">
          {collecte.reference} · {formatDate(collecte.dateCollecte)} · {collecte.agent.prenom} {collecte.agent.nom}
        </p>
      )}

      <div className="-mx-6 -mt-2">
        <div className="overflow-y-auto max-h-[55vh]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('collecte_loading')}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('label_client')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('collecte_pack_restant')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">{t('collecte_attendu')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">{t('collecte_col_collecte')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('collecte_resultat')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('label_notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collecte?.lignes.map((ligne, i) => {
                  const saisie = lignes[i];
                  if (!saisie) return null;
                  return (
                    <tr key={ligne.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {ligne.client.prenom} {ligne.client.nom}
                          {ligne.client.segment === 'RIA' && (
                            <Badge variant="indigo" className="ml-1.5">★ RIA</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3" /> {ligne.client.telephone}
                        </div>
                        {(ligne.client.quartier || ligne.client.ville) && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {[ligne.client.quartier, ligne.client.ville].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {ligne.client.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ligne.client.tags.map(({ tag }) => (
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
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-700">{ligne.souscription.pack.nom}</div>
                        <div className="text-xs text-red-600 font-semibold mt-0.5">
                          {formatCurrency(Number(ligne.souscription.montantRestant))} restant
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        {formatCurrency(Number(ligne.montantAttendu))}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={Number(ligne.souscription.montantRestant)}
                          value={saisie.montantCollecte}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateLigne(ligne.id, 'montantCollecte', v);
                            // Auto-statut
                            if (v <= 0) updateLigne(ligne.id, 'statut', 'ECHEC');
                            else if (v >= Number(ligne.montantAttendu)) updateLigne(ligne.id, 'statut', 'COLLECTE');
                            else updateLigne(ligne.id, 'statut', 'PARTIEL');
                          }}
                          className="w-28 px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={saisie.statut}
                          onChange={(e) => updateLigne(ligne.id, 'statut', e.target.value)}
                          className={`text-xs px-2 py-1.5 rounded-lg border border-slate-200 font-medium focus:outline-none ${LIGNE_STATUT_SELECT_STYLE[saisie.statut] ?? ''}`}
                        >
                          <option value="EN_ATTENTE">{t('collecte_en_attente')}</option>
                          <option value="COLLECTE">{t('collecte_collecte')}</option>
                          <option value="PARTIEL">{t('collecte_partiel')}</option>
                          <option value="ECHEC">{t('collecte_echec')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={saisie.notes}
                          onChange={(e) => updateLigne(ligne.id, 'notes', e.target.value)}
                          placeholder={t('collecte_notes_ph')}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Total */}
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-700">{t('label_total')}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">
                    {formatCurrency(lignes.reduce((s, l) => s + l.montantCollecte, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 -mx-6 -mb-5 mt-4 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-2xl">
        <Button variant="secondary" onClick={onClose}>{t('btn_close')}</Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleSave}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            {t('btn_save')}
          </Button>
          <Button
            variant="success"
            onClick={handleValider}
            loading={validating}
            disabled={saving}
            icon={<Check className="w-4 h-4" />}
          >
            {t('collecte_valider_et_generer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal : Détail collecte ──────────────────────────────────────────────────

function CollecteDetailModal({
  id, onClose, onValidated,
}: { id: number; onClose: () => void; onValidated: () => void }) {
  const t = useT();
  const tagModal = useTagModal();
  const { data: res, loading } = useApi<{ data: CollecteDetail }>(`/api/admin/collectes/${id}`);
  const { mutate: valider, loading: validating } = useMutation(`/api/admin/collectes/${id}/valider`, 'POST');

  const collecte = res?.data;
  const canValidate = collecte?.statut === 'EN_COURS' &&
    collecte.lignes.some((l) => l.statut === 'COLLECTE' || l.statut === 'PARTIEL');

  const handleValider = async () => {
    const result = await valider({});
    if (result) { toast.success('Collecte validée'); onValidated(); }
  };

  return (
    <Modal open onClose={onClose} title={t('collecte_detail_title')} size="lg">
      {collecte && (
        <p className="text-sm text-slate-500 -mt-3 mb-4">
          {collecte.reference} · {formatDate(collecte.dateCollecte)}
        </p>
      )}

      <div className="space-y-4 max-h-[55vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('collecte_loading')}
          </div>
        ) : collecte ? (
          <>
            {/* Résumé */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{t('label_agent')}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {collecte.agent.prenom} {collecte.agent.nom}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{t('collecte_col_prevu')}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {formatCurrency(Number(collecte.montantPrevu))}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-600">{t('collecte_col_collecte')}</p>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">
                    {formatCurrency(Number(collecte.montantCollecte))}
                  </p>
                </div>
              </div>

              {/* Lignes */}
              <div className="space-y-2">
                {collecte.lignes.map((l) => (
                  <div key={l.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-slate-800 text-sm">
                          {l.client.prenom} {l.client.nom}
                        </span>
                        {l.client.segment === 'RIA' && (
                          <Badge variant="indigo" className="ml-1.5">★ RIA</Badge>
                        )}
                        <span className="ml-2 text-xs text-slate-500">{l.client.telephone}</span>
                        {l.client.tags.length > 0 && (
                          <span className="ml-2 inline-flex flex-wrap gap-1">
                            {l.client.tags.map(({ tag }) => (
                              <button
                                key={tag.id}
                                onClick={() => tagModal?.openTag(tag)}
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white leading-none hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: tag.couleur }}
                              >
                                {tag.nom}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                      <Badge variant={LIGNE_STATUT_VARIANT[l.statut] ?? 'neutral'}>
                        {l.statut}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{l.souscription.pack.nom}</span>
                      <span>
                        {t('collecte_attendu')} : <strong>{formatCurrency(Number(l.montantAttendu))}</strong>
                        {' · '}
                        {t('collecte_col_collecte')} : <strong className="text-emerald-600">{formatCurrency(Number(l.montantCollecte))}</strong>
                      </span>
                    </div>
                    {l.versementPack && (
                      <div className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {t('collecte_versement_genere')} : {l.versementPack.reference}
                      </div>
                    )}
                    {l.notes && (
                      <div className="mt-1 text-xs text-slate-500 italic">{l.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 -mx-6 -mb-5 mt-4 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-2xl">
        <Button variant="secondary" onClick={onClose}>{t('btn_close')}</Button>
        {canValidate && (
          <Button
            variant="success"
            onClick={handleValider}
            loading={validating}
            icon={<Check className="w-4 h-4" />}
          >
            {t('collecte_valider')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

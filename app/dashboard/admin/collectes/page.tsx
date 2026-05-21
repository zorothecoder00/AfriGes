"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus, Search, RefreshCw, Filter, Calendar, CheckCircle,
  Clock, XCircle, Eye, ChevronDown, ChevronUp, Phone,
  MapPin, AlertTriangle, Wallet, Users, TrendingUp, X,
  Save, Check,
} from 'lucide-react';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate, formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import ClienteleTabBar from '@/components/ClienteleTabBar';

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
  client: { id: number; nom: string; prenom: string; telephone: string; adresse: string | null; quartier: string | null; ville: string | null; codeClient: string | null };
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

interface ClientCreance {
  id: number; nom: string; prenom: string; telephone: string; codeClient: string | null;
  agentTerrainId: number | null;
  souscriptionsPacks: {
    id: number; montantTotal: string; montantRestant: string; statut: string;
    pack: { nom: string; type: string };
    echeances: { montant: string; datePrevue: string; statut: string }[];
  }[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  EN_COURS: { cls: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" />, label: 'En cours' },
  VALIDEE:  { cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Validée' },
  ANNULEE:  { cls: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" />, label: 'Annulée' },
};

const LIGNE_STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE: 'bg-gray-100 text-gray-600',
  COLLECTE:   'bg-emerald-100 text-emerald-700',
  PARTIEL:    'bg-blue-100 text-blue-700',
  ECHEC:      'bg-red-100 text-red-700',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectesPage() {
  const [page,      setPage]      = useState(1);
  const [statut,    setStatut]    = useState('');
  const [agentId,   setAgentId]   = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');
  const [expanded,  setExpanded]  = useState<number | null>(null);

  // Modals
  const [showCreate,   setShowCreate]   = useState(false);
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
    `/api/admin/collectes?${query}`
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
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Collectes journalières</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestion des tournées de recouvrement terrain
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Nouvelle collecte
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sessions en cours"  value={String(enCours)}          icon={<Clock className="w-5 h-5 text-amber-600" />}   bg="bg-amber-50" />
        <StatCard label="Validées"            value={String(validees)}         icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
        <StatCard label="Montant collecté"    value={formatCurrency(totalCollecte)} icon={<Wallet className="w-5 h-5 text-blue-600" />}    bg="bg-blue-50" />
        <StatCard label="Total sessions"      value={String(res?.meta.total ?? 0)} icon={<TrendingUp className="w-5 h-5 text-purple-600" />} bg="bg-purple-50" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={statut}
          onChange={(e) => { setStatut(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">Tous statuts</option>
          <option value="EN_COURS">En cours</option>
          <option value="VALIDEE">Validées</option>
          <option value="ANNULEE">Annulées</option>
        </select>

        <select
          value={agentId}
          onChange={(e) => { setAgentId(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">Tous les agents</option>
          {agents?.data.map((a) => (
            <option key={a.id} value={a.id}>
              {a.member.prenom} {a.member.nom}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date" value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date" value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Filter className="w-4 h-4" /> {res?.meta.total ?? 0} session(s)
        </div>
      </div>

      {/* Liste collectes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : !res?.data.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Calendar className="w-10 h-10 mb-2" />
            <p className="text-sm">Aucune collecte trouvée</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Créer la première collecte
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Référence</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">PDV</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Prévu</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Collecté</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Lignes</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {res.data.map((c) => {
                const badge = STATUT_BADGE[c.statut];
                const taux = Number(c.montantPrevu) > 0
                  ? Math.round((Number(c.montantCollecte) / Number(c.montantPrevu)) * 100)
                  : 0;

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.reference}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(c.dateCollecte)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.agent.prenom} {c.agent.nom}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.pointDeVente?.nom ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(Number(c.montantPrevu))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(Number(c.montantCollecte))}
                      </span>
                      {Number(c.montantPrevu) > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">{taux}%</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                        {c._count.lignes}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                        {badge.icon} {badge.label}
                      </span>
                      {c.validePar && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          par {c.validePar.prenom} {c.validePar.nom}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetailId(c.id)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Voir détail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {c.statut === 'EN_COURS' && (
                          <button
                            onClick={() => setSaisieId(c.id)}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Saisir montants collectés"
                          >
                            <Save className="w-4 h-4" />
                          </button>
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
      {res && res.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Page {res.meta.page} / {res.meta.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Précédent
            </button>
            <button disabled={page === res.meta.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateCollecteModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refetch(); }}
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
    </div>
  );
}

// ─── Modal : Créer une collecte ───────────────────────────────────────────────

function CreateCollecteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [agentId,       setAgentIdState]  = useState('');
  const [dateCollecte,  setDateCollecte]  = useState(new Date().toISOString().slice(0, 10));
  const [notes,         setNotes]         = useState('');
  const [lignes,        setLignes]        = useState<{
    clientId: number; clientNom: string; souscriptionId: number; packNom: string;
    montantAttendu: number; montantRestant: number;
  }[]>([]);
  const [clientSearch,  setClientSearch]  = useState('');
  const [clientResults, setClientResults] = useState<ClientCreance[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const { data: agents } = useApi<{ data: AgentOption[] }>(
    '/api/admin/gestionnaires?role=AGENT_TERRAIN&limit=100'
  );

  const { mutate: createCollecte, loading } = useMutation('/api/admin/collectes', 'POST');

  // Rechercher les clients avec créances actives
  const searchClients = useCallback(async () => {
    if (!clientSearch.trim()) return;
    setLoadingSearch(true);
    try {
      const params = new URLSearchParams({
        search: clientSearch, limit: '10',
        ...(agentId && { agentTerrainId: agentId }),
      });
      const res = await fetch(`/api/admin/clients?${params}`);
      const json = await res.json();
      // Filtrer clients avec des souscriptions actives
      const withCreances: ClientCreance[] = (json.data ?? []).filter(
        (c: ClientCreance) => (c.souscriptionsPacks?.length ?? 0) > 0
      );
      setClientResults(withCreances);
    } finally {
      setLoadingSearch(false);
    }
  }, [clientSearch, agentId]);

  const addLigne = (client: ClientCreance, sous: ClientCreance['souscriptionsPacks'][0]) => {
    if (lignes.find((l) => l.souscriptionId === sous.id)) return;
    const prochaine = sous.echeances?.[0];
    setLignes((prev) => [
      ...prev,
      {
        clientId:       client.id,
        clientNom:      `${client.prenom} ${client.nom}`,
        souscriptionId: sous.id,
        packNom:        sous.pack.nom,
        montantAttendu: prochaine ? Number(prochaine.montant) : Number(sous.montantRestant),
        montantRestant: Number(sous.montantRestant),
      },
    ]);
    setClientResults([]);
    setClientSearch('');
  };

  const removeLigne = (souscriptionId: number) =>
    setLignes((prev) => prev.filter((l) => l.souscriptionId !== souscriptionId));

  const handleSubmit = async () => {
    if (!agentId || !dateCollecte || lignes.length === 0) {
      toast.error('Agent, date et au moins une ligne sont requis');
      return;
    }
    const result = await createCollecte({
      agentId: Number(agentId),
      dateCollecte,
      notes,
      lignes: lignes.map((l) => ({
        clientId:       l.clientId,
        souscriptionId: l.souscriptionId,
        montantAttendu: l.montantAttendu,
      })),
    });
    if (result) {
      toast.success('Collecte créée avec succès');
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle collecte journalière</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Agent + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent terrain *</label>
              <select
                value={agentId}
                onChange={(e) => setAgentIdState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un agent</option>
                {agents?.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.member.prenom} {a.member.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de collecte *</label>
              <input
                type="date"
                value={dateCollecte}
                onChange={(e) => setDateCollecte(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Recherche client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ajouter un client à collecter</label>
            <div className="flex gap-2">
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchClients()}
                placeholder="Nom, téléphone, code client…"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={searchClients}
                disabled={loadingSearch}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                {loadingSearch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* Résultats recherche */}
            {clientResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {clientResults.map((client) =>
                  client.souscriptionsPacks?.map((sous) => (
                    <button
                      key={sous.id}
                      onClick={() => addLigne(client, sous)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800 text-sm">
                            {client.prenom} {client.nom}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">{client.telephone}</span>
                        </div>
                        <span className="text-xs text-red-600 font-semibold">
                          {formatCurrency(Number(sous.montantRestant))} dû
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Pack : {sous.pack.nom} · {sous.statut}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lignes ajoutées */}
          {lignes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Clients à collecter ({lignes.length})
              </p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {lignes.map((l) => (
                  <div key={l.souscriptionId} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{l.clientNom}</div>
                      <div className="text-xs text-gray-500">{l.packNom} · Restant : {formatCurrency(l.montantRestant)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={l.montantAttendu}
                        onChange={(e) => setLignes((prev) =>
                          prev.map((x) => x.souscriptionId === l.souscriptionId
                            ? { ...x, montantAttendu: Number(e.target.value) }
                            : x
                          )
                        )}
                        className="w-28 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">FCFA</span>
                      <button
                        onClick={() => removeLigne(l.souscriptionId)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-700">Total prévu</span>
                  <span className="text-sm font-bold text-blue-700">
                    {formatCurrency(lignes.reduce((s, l) => s + l.montantAttendu, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instructions, zone couverte…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || lignes.length === 0}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Créer la collecte
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal : Saisie terrain ───────────────────────────────────────────────────

function SaisieCollecteModal({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const { data: res, loading } = useApi<{ data: CollecteDetail }>(`/api/admin/collectes/${id}`);
  const { mutate: patch, loading: saving } = useMutation(`/api/admin/collectes/${id}`, 'PATCH');
  const { mutate: valider, loading: validating } = useMutation(`/api/admin/collectes/${id}/valider`, 'POST');

  const [lignes, setLignes] = useState<{
    ligneId: number; montantCollecte: number; statut: string; notes: string;
  }[]>([]);

  useEffect(() => {
    if (res?.data.lignes) {
      setLignes(
        res.data.lignes.map((l) => ({
          ligneId:         l.id,
          montantCollecte: Number(l.montantCollecte),
          statut:          l.statut,
          notes:           l.notes ?? '',
        }))
      );
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Saisie terrain</h2>
            {collecte && (
              <p className="text-sm text-gray-500 mt-0.5">
                {collecte.reference} · {formatDate(collecte.dateCollecte)} · {collecte.agent.prenom} {collecte.agent.nom}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Pack / Restant dû</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Attendu</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Collecté</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Résultat</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {collecte?.lignes.map((ligne, i) => {
                  const saisie = lignes[i];
                  if (!saisie) return null;
                  return (
                    <tr key={ligne.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{ligne.client.prenom} {ligne.client.nom}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Phone className="w-3 h-3" /> {ligne.client.telephone}
                        </div>
                        {(ligne.client.quartier || ligne.client.ville) && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {[ligne.client.quartier, ligne.client.ville].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-gray-700">{ligne.souscription.pack.nom}</div>
                        <div className="text-xs text-red-600 font-semibold mt-0.5">
                          {formatCurrency(Number(ligne.souscription.montantRestant))} restant
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">
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
                          className="w-28 px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={saisie.statut}
                          onChange={(e) => updateLigne(ligne.id, 'statut', e.target.value)}
                          className={`text-xs px-2 py-1.5 rounded-lg border border-gray-200 font-medium focus:outline-none ${LIGNE_STATUT_BADGE[saisie.statut] ?? ''}`}
                        >
                          <option value="EN_ATTENTE">En attente</option>
                          <option value="COLLECTE">Collecté</option>
                          <option value="PARTIEL">Partiel</option>
                          <option value="ECHEC">Échec</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={saisie.notes}
                          onChange={(e) => updateLigne(ligne.id, 'notes', e.target.value)}
                          placeholder="Absent, refus…"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Total */}
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">
                    {formatCurrency(lignes.reduce((s, l) => s + l.montantCollecte, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Fermer
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </button>
            <button
              onClick={handleValider}
              disabled={validating || saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Valider et générer versements
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal : Détail collecte ──────────────────────────────────────────────────

function CollecteDetailModal({
  id, onClose, onValidated,
}: { id: number; onClose: () => void; onValidated: () => void }) {
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Détail collecte</h2>
            {collecte && (
              <p className="text-sm text-gray-500 mt-0.5">
                {collecte.reference} · {formatDate(collecte.dateCollecte)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : collecte ? (
            <>
              {/* Résumé */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Agent</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {collecte.agent.prenom} {collecte.agent.nom}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Prévu</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {formatCurrency(Number(collecte.montantPrevu))}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-600">Collecté</p>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">
                    {formatCurrency(Number(collecte.montantCollecte))}
                  </p>
                </div>
              </div>

              {/* Lignes */}
              <div className="space-y-2">
                {collecte.lignes.map((l) => (
                  <div key={l.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-800 text-sm">
                          {l.client.prenom} {l.client.nom}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">{l.client.telephone}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LIGNE_STATUT_BADGE[l.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {l.statut}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{l.souscription.pack.nom}</span>
                      <span>
                        Attendu : <strong>{formatCurrency(Number(l.montantAttendu))}</strong>
                        {' · '}
                        Collecté : <strong className="text-emerald-600">{formatCurrency(Number(l.montantCollecte))}</strong>
                      </span>
                    </div>
                    {l.versementPack && (
                      <div className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Versement généré : {l.versementPack.reference}
                      </div>
                    )}
                    {l.notes && (
                      <div className="mt-1 text-xs text-gray-500 italic">{l.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Fermer
          </button>
          {canValidate && (
            <button
              onClick={handleValider}
              disabled={validating}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Valider la collecte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

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

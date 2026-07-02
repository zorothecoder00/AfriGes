"use client";

import React, { useState, useCallback } from "react";
import {
  Users, Search, RefreshCw, CheckCircle, XCircle, Clock,
  AlertCircle, User, Phone, MapPin, Briefcase,
  Loader2, Eye, Shield, TrendingUp, Wallet, Edit3,
  CreditCard, FileText, Network,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import CongesNavButton from "@/components/CongesNavButton";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import ClientSegmentTags from "@/components/ClientSegmentTags";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import FactureModal from "@/components/FactureModal";
// ─── Types ────────────────────────────────────────────────────────────────────

type EtatClient = "EN_ATTENTE_VALIDATION" | "ACTIF" | "REJETE" | "INACTIF" | "SUSPENDU" | "BLOQUE";

interface ClientRVC {
  id: number;
  codeClient: string | null;
  nom: string;
  prenom: string;
  telephone: string;
  telephoneSecondaire: string | null;
  adresse: string | null;
  quartier: string | null;
  ville: string | null;
  activite: string | null;
  nomCommerce: string | null;
  sexe: string | null;
  numeroCNI: string | null;
  etat: EtatClient;
  typeClient: string | null;
  niveauRisque: string | null;
  limiteCredit: string | null;
  motifRejet: string | null;
  dateValidation: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  scoreSolvabilite: number | null;
  soldeActuel: string | null;
  nbCreditsEnRetard: number;
  segment: string;
  tags: { tag: { id: number; nom: string; couleur: string } }[];
  agentTerrain: { nom: string; prenom: string; telephone: string } | null;
  pointDeVente: { nom: string; code: string } | null;
  validationPar: { nom: string; prenom: string } | null;
  _count: { creditsClients: number; souscriptionsPacks: number };
}

interface ApiResponse {
  data: ClientRVC[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function etatBadge(etat: EtatClient) {
  const map: Record<EtatClient, { bg: string; text: string; label: string }> = {
    EN_ATTENTE_VALIDATION: { bg: "bg-yellow-100", text: "text-yellow-800", label: "En attente" },
    ACTIF:      { bg: "bg-green-100",  text: "text-green-800",  label: "Actif" },
    REJETE:     { bg: "bg-red-100",    text: "text-red-800",    label: "Rejeté" },
    INACTIF:    { bg: "bg-gray-100",   text: "text-gray-700",   label: "Inactif" },
    SUSPENDU:   { bg: "bg-orange-100", text: "text-orange-800", label: "Suspendu" },
    BLOQUE:     { bg: "bg-red-200",    text: "text-red-900",    label: "Bloqué" },
  };
  const s = map[etat] ?? map.INACTIF;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function risqueBadge(niveau: string | null) {
  if (!niveau) return null;
  const map: Record<string, { bg: string; text: string }> = {
    FAIBLE:   { bg: "bg-green-50",  text: "text-green-700" },
    MOYEN:    { bg: "bg-yellow-50", text: "text-yellow-700" },
    ELEVE:    { bg: "bg-orange-50", text: "text-orange-700" },
    CRITIQUE: { bg: "bg-red-50",    text: "text-red-700" },
  };
  const s = map[niveau] ?? { bg: "bg-gray-50", text: "text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>
      {niveau}
    </span>
  );
}

// ─── Jauge score solvabilité ──────────────────────────────────────────────────

function ScoreJauge({ score }: { score: number | null }) {
  const val = score ?? 0;
  const color = val >= 60 ? "bg-green-500" : val >= 30 ? "bg-orange-400" : "bg-red-500";
  const textColor = val >= 60 ? "text-green-700" : val >= 30 ? "text-orange-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, val)}%` }} />
      </div>
      <span className={`text-xs font-bold ${textColor}`}>{val.toFixed(0)}/100</span>
    </div>
  );
}

// ─── Composant Detail Client ──────────────────────────────────────────────────

interface DetailPanelProps {
  client: ClientRVC;
  onClose: () => void;
  onValidated: () => void;
}

function DetailPanel({ client, onClose, onValidated }: DetailPanelProps) {
  const [showActiverForm, setShowActiverForm]     = useState(false);
  const [showRejeterForm, setShowRejeterForm]     = useState(false);
  const [showPlafondForm, setShowPlafondForm]     = useState(false);
  const [limiteCredit, setLimiteCredit]           = useState("");
  const [nouvelleLimite, setNouvelleLimite]       = useState(client.limiteCredit ? String(Number(client.limiteCredit)) : "");
  const [motifRejet, setMotifRejet]               = useState("");

  const { mutate: valider, loading } = useMutation<{ data: ClientRVC }, { action: string; limiteCredit?: number; motifRejet?: string }>(
    `/api/rvc/clients/${client.id}/valider`,
    "POST"
  );

  const { mutate: modifierPlafond, loading: plafondLoading } = useMutation<{ data: ClientRVC }, { limiteCredit: number }>(
    `/api/rvc/clients/${client.id}/limite-credit`,
    "PATCH"
  );

  const handleActiver = useCallback(async () => {
    const result = await valider({
      action: "ACTIVER",
      limiteCredit: limiteCredit ? Number(limiteCredit) : undefined,
    });
    if (result) { onValidated(); onClose(); }
  }, [valider, limiteCredit, onValidated, onClose]);

  const handleRejeter = useCallback(async () => {
    if (!motifRejet.trim()) return;
    const result = await valider({ action: "REJETER", motifRejet: motifRejet.trim() });
    if (result) { onValidated(); onClose(); }
  }, [valider, motifRejet, onValidated, onClose]);

  const handleModifierPlafond = useCallback(async () => {
    const val = Number(nouvelleLimite);
    if (isNaN(val) || val < 0) return;
    const result = await modifierPlafond({ limiteCredit: val });
    if (result) { onValidated(); setShowPlafondForm(false); }
  }, [modifierPlafond, nouvelleLimite, onValidated]);

  const isPending = client.etat === "EN_ATTENTE_VALIDATION";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{client.prenom} {client.nom}</h2>
              <p className="text-sm text-gray-500">{client.codeClient ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {etatBadge(client.etat)}
            <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <XCircle size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Infos personnelles */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Identité</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Téléphone" value={client.telephone} />
              {client.telephoneSecondaire && <InfoRow label="Tél. secondaire" value={client.telephoneSecondaire} />}
              {client.sexe && <InfoRow label="Sexe" value={client.sexe} />}
              {client.numeroCNI && <InfoRow label="N° CNI" value={client.numeroCNI} />}
            </div>
          </section>

          {/* Localisation */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Localisation</h3>
            <div className="grid grid-cols-2 gap-3">
              {client.ville    && <InfoRow label="Ville"    value={client.ville} />}
              {client.quartier && <InfoRow label="Quartier" value={client.quartier} />}
              {client.adresse  && <InfoRow label="Adresse"  value={client.adresse} />}
              {(client.latitude !== null && client.longitude !== null) && (
                <InfoRow
                  label="GPS"
                  value={`${client.latitude?.toFixed(5)}, ${client.longitude?.toFixed(5)}`}
                />
              )}
            </div>
          </section>

          {/* Activité */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Activité</h3>
            <div className="grid grid-cols-2 gap-3">
              {client.activite    && <InfoRow label="Activité"    value={client.activite} />}
              {client.nomCommerce && <InfoRow label="Commerce"    value={client.nomCommerce} />}
              {client.typeClient  && <InfoRow label="Type client" value={client.typeClient} />}
              <InfoRow label="Niveau de risque" value={risqueBadge(client.niveauRisque) ?? "—"} />
            </div>
          </section>

          {/* Agent & PDV */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Enregistrement</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Agent terrain" value={client.agentTerrain ? `${client.agentTerrain.prenom} ${client.agentTerrain.nom}` : "—"} />
              <InfoRow label="Point de vente" value={client.pointDeVente ? `${client.pointDeVente.nom} (${client.pointDeVente.code})` : "—"} />
              <InfoRow label="Date enregistrement" value={formatDate(client.createdAt)} />
              {client.dateValidation && <InfoRow label="Date validation" value={formatDate(client.dateValidation)} />}
              {client.validationPar  && <InfoRow label="Validé par" value={`${client.validationPar.prenom} ${client.validationPar.nom}`} />}
            </div>
          </section>

          {/* Solvabilité */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-500" />
              Solvabilité
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">Score de solvabilité</p>
                <ScoreJauge score={client.scoreSolvabilite} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                    <Wallet size={11} />
                    Dettes en cours
                  </p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {client.soldeActuel && Number(client.soldeActuel) > 0
                      ? `${Number(client.soldeActuel).toLocaleString("fr-FR")} FCFA`
                      : <span className="text-green-600">Aucune dette</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Crédits en retard</p>
                  {client.nbCreditsEnRetard > 0 ? (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                      <AlertCircle size={11} />
                      {client.nbCreditsEnRetard} en retard
                    </span>
                  ) : (
                    <p className="text-sm font-semibold text-green-600 mt-0.5">Aucun</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Engagements existants */}
          {(client._count.creditsClients > 0 || client._count.souscriptionsPacks > 0) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historique</h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Crédits (total)" value={String(client._count.creditsClients)} />
                <InfoRow label="Souscriptions packs" value={String(client._count.souscriptionsPacks)} />
                {client.limiteCredit && <InfoRow label="Plafond crédit actuel" value={`${Number(client.limiteCredit).toLocaleString("fr-FR")} FCFA`} />}
              </div>
            </section>
          )}

          {/* Modifier le plafond crédit — clients ACTIF */}
          {client.etat === "ACTIF" && (
            <section className="border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Shield size={16} className="text-blue-600" />
                  Plafond crédit
                </h3>
                {!showPlafondForm && (
                  <button
                    onClick={() => setShowPlafondForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit3 size={13} />
                    Modifier
                  </button>
                )}
              </div>
              {!showPlafondForm ? (
                <p className="text-sm text-gray-600">
                  Plafond actuel :{" "}
                  <span className="font-semibold text-gray-900">
                    {client.limiteCredit
                      ? `${Number(client.limiteCredit).toLocaleString("fr-FR")} FCFA`
                      : "Non défini"}
                  </span>
                </p>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 font-medium block mb-1">
                      Nouveau plafond crédit (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={nouvelleLimite}
                      onChange={(e) => setNouvelleLimite(e.target.value)}
                      placeholder="Ex : 750000"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleModifierPlafond}
                      disabled={plafondLoading || !nouvelleLimite}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {plafondLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setShowPlafondForm(false)}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Motif rejet si rejeté */}
          {client.etat === "REJETE" && client.motifRejet && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-1">Motif de rejet</p>
              <p className="text-sm text-red-600">{client.motifRejet}</p>
            </div>
          )}

          {/* Actions RVC — seulement si EN_ATTENTE_VALIDATION */}
          {isPending && (
            <section className="border-t border-gray-100 pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Shield size={16} className="text-blue-600" />
                Décision du Responsable Vente Crédit
              </h3>

              {/* Boutons d'action */}
              {!showActiverForm && !showRejeterForm && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowActiverForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={18} />
                    Activer le client
                  </button>
                  <button
                    onClick={() => setShowRejeterForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                  >
                    <XCircle size={18} />
                    Rejeter le client
                  </button>
                </div>
              )}

              {/* Formulaire activation */}
              {showActiverForm && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-green-700">Activation du client</p>
                  <div>
                    <label className="text-xs text-gray-600 font-medium block mb-1">
                      Limite de crédit (FCFA) — optionnel
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={limiteCredit}
                      onChange={(e) => setLimiteCredit(e.target.value)}
                      placeholder="Ex : 500000"
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleActiver}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Confirmer l&apos;activation
                    </button>
                    <button
                      onClick={() => setShowActiverForm(false)}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Formulaire rejet */}
              {showRejeterForm && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">Rejet du client</p>
                  <div>
                    <label className="text-xs text-gray-600 font-medium block mb-1">
                      Motif de rejet <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={motifRejet}
                      onChange={(e) => setMotifRejet(e.target.value)}
                      placeholder="Expliquez la raison du rejet (informations insuffisantes, risque élevé, identité non vérifiable...)"
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRejeter}
                      disabled={loading || !motifRejet.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                      Confirmer le rejet
                    </button>
                    <button
                      onClick={() => setShowRejeterForm(false)}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ─── Carte client ─────────────────────────────────────────────────────────────

function ClientCard({ client, onClick }: { client: ClientRVC; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{client.prenom} {client.nom}</p>
            <p className="text-xs text-gray-500">{client.codeClient ?? "—"}</p>
            <ClientSegmentTags segment={client.segment} tags={client.tags} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {risqueBadge(client.niveauRisque)}
          {etatBadge(client.etat)}
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Phone size={12} className="flex-shrink-0" />
          <span>{client.telephone}</span>
        </div>
        {(client.ville || client.quartier) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="flex-shrink-0" />
            <span>{[client.quartier, client.ville].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {client.activite && (
          <div className="flex items-center gap-1.5">
            <Briefcase size={12} className="flex-shrink-0" />
            <span>{client.activite}{client.nomCommerce ? ` — ${client.nomCommerce}` : ""}</span>
          </div>
        )}
        {client.agentTerrain && (
          <div className="flex items-center gap-1.5">
            <Users size={12} className="flex-shrink-0" />
            <span>Agent : {client.agentTerrain.prenom} {client.agentTerrain.nom}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">{formatDate(client.createdAt)}</span>
        <button className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700">
          <Eye size={12} />
          Voir le dossier
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type OngletEtat = "EN_ATTENTE_VALIDATION" | "ACTIF" | "REJETE";

const ONGLETS: { id: OngletEtat; label: string; icon: React.ReactNode }[] = [
  { id: "EN_ATTENTE_VALIDATION",  label: "Clients en attente", icon: <Clock size={16} /> },
  { id: "ACTIF",                  label: "Clients actifs",     icon: <CheckCircle size={16} /> },
  { id: "REJETE",                 label: "Clients rejetés",    icon: <XCircle size={16} /> },
];

export default function RVCPage() {
  const [onglet,       setOnglet]       = useState<OngletEtat>("EN_ATTENTE_VALIDATION");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [page,         setPage]         = useState(1);
  const [selected,     setSelected]     = useState<ClientRVC | null>(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [showProForma, setShowProForma] = useState(false);

  const clientsUrl = `/api/rvc/clients?etat=${onglet}&page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}&_k=${refreshKey}`;
  const { data, loading, error } = useApi<ApiResponse>(clientsUrl);

  const clients   = data?.data ?? [];
  const meta      = data?.meta;

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOnglet = useCallback((id: OngletEtat) => {
    setOnglet(id);
    setPage(1);
    setSearch("");
    setSearchInput("");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <DashboardBackButton />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Validation Clients</h1>
                <p className="text-xs text-gray-500">Responsable Vente Crédit</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessagesLink />
              <CongesNavButton />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Bannière navigation */}
        <Link
          href="/dashboard/user/responsablesVenteCredit/credits"
          className="flex items-center justify-between w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl px-6 py-4 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="font-bold text-base">Crédits Clients</p>
              <p className="text-indigo-100 text-sm">Créer, valider et suivre tous les dossiers de crédit</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold bg-white/20 px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors shrink-0">
            Ouvrir <span className="ml-1">→</span>
          </div>
        </Link>

        {/* Bannière éligibilité RIA */}
        <Link
          href="/dashboard/user/responsablesVenteCredit/ria-eligibilite"
          className="flex items-center justify-between w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl px-6 py-4 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Network size={20} />
            </div>
            <div>
              <p className="font-bold text-base">Sélection des clients à financer (RIA)</p>
              <p className="text-emerald-100 text-sm">Identifier les clients finançables par le réseau des investisseurs</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold bg-white/20 px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors shrink-0">
            Ouvrir <span className="ml-1">→</span>
          </div>
        </Link>

        {/* Onglets clients */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => handleOnglet(o.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                onglet === o.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>

        {/* Barre de recherche */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Rechercher un client (nom, téléphone, code)…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Rechercher
          </button>
          <button
            onClick={handleRefresh}
            className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
            title="Actualiser"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowProForma(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors shrink-0"
          >
            <FileText size={15} />
            Pro-forma
          </button>
        </div>

        {/* ─── CLIENTS ─── */}
        <>
        {/* Compteur */}
        {data?.meta && (
          <p className="text-sm text-gray-500">
            {data.meta.total} client{data.meta.total > 1 ? "s" : ""}
            {onglet === "EN_ATTENTE_VALIDATION" && " en attente de validation"}
            {onglet === "ACTIF"  && " activé" + (data.meta.total > 1 ? "s" : "")}
            {onglet === "REJETE" && " rejeté" + (data.meta.total > 1 ? "s" : "")}
          </p>
        )}

        {/* État chargement / erreur */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Liste des clients */}
        {!loading && !error && (data?.data ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users size={48} className="mb-3 opacity-40" />
            <p className="text-base font-medium">Aucun client trouvé</p>
            <p className="text-sm mt-1">
              {onglet === "EN_ATTENTE_VALIDATION"
                ? "Tous les clients ont été traités."
                : "Aucun client dans cette catégorie."}
            </p>
          </div>
        )}

        {!loading && !error && (data?.data ?? []).length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.data ?? []).map((c) => (
                <ClientCard key={c.id} client={c} onClick={() => setSelected(c)} />
              ))}
            </div>

            {/* Pagination */}
            {data?.meta && data.meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">Précédent</button>
                <span className="text-sm text-gray-600 px-2">Page {data.meta.page} / {data.meta.totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(data!.meta.totalPages, p + 1))} disabled={page >= data.meta.totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">Suivant</button>
              </div>
            )}
          </>
        )}
        </>
      </div>

      {/* Modal détail client */}
      {selected && (
        <DetailPanel
          client={selected}
          onClose={() => setSelected(null)}
          onValidated={handleRefresh}
        />
      )}

      {/* Modal pro-forma */}
      {showProForma && (
        <FactureModal
          proFormaMode
          searchClientsUrl="/api/rvc/clients?etat=ACTIF"
          searchProduitsUrl="/api/rvc/produits"
          onClose={() => setShowProForma(false)}
        />
      )}
    </div>
  );
}

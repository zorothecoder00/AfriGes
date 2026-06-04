"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Users, Phone, Clock, CheckCircle,
  AlertCircle, Search, RefreshCw,
  Banknote, Calendar, LucideIcon, Layers, Plus,
  Loader2, Truck, Package, ShoppingCart, X, Send, XCircle,
  ClipboardList, CreditCard, Navigation, PlayCircle, ChevronDown, ChevronUp,
  Wallet, TrendingDown, UserPlus, Receipt, FileText,
} from "lucide-react";
import Link from "next/link";      
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi, useMutation } from "@/hooks/useApi";
import FactureModal from "@/components/FactureModal";
import { formatCurrency, formatDate } from "@/lib/format";
import { getStatusStyle, getStatusLabel } from "@/lib/status";
import { useT } from "@/contexts/AppSettingsContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { toast } from 'sonner'; 

// ─── Types ────────────────────────────────────────────────────────────────────

type TypePack = "ALIMENTAIRE" | "REVENDEUR" | "FAMILIAL" | "URGENCE" | "EPARGNE_PRODUIT" | "FIDELITE";

// Collecte du Jour
interface LigneCollecte {
  id: number;
  statut: "EN_ATTENTE" | "COLLECTE" | "PARTIEL" | "ECHEC";
  montantAttendu: string;
  montantCollecte: string;
  client: { id: number; nom: string; prenom: string };
}

interface CollecteSession {
  id: number;
  reference: string;
  statut: "EN_COURS" | "VALIDEE" | "ANNULEE";
  montantPrevu: string;
  montantCollecte: string;
  dateCollecte: string;
  lignes: LigneCollecte[];
}

interface SouscriptionPourCollecte {
  id: number;
  montantTotal: string;
  montantVerse: string;
  montantRestant: string;
  statut: string;
  pack: { nom: string; type: TypePack; frequenceVersement: string };
  echeances: { id: number; montant: string; datePrevue: string; statut: string }[];
}

interface CreditPourCollecte {
  id: number;
  reference: string;
  montantTotal: string;
  montantRembourse: string;
  soldeRestant: string;
  montantJournalier: string;
  dateEcheanceFin: string;
  echeances: { id: number; montantDu: string; dateEcheance: string; statut: string }[];
}

interface ClientCollecte {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  etat: string;
  souscriptionsPacks: SouscriptionPourCollecte[];
  creditsClients: CreditPourCollecte[];
}

interface CollecteJourResponse {
  session: CollecteSession | null;
  clients: ClientCollecte[];
  stats: {
    totalClients: number;
    totalACollecter: number;
    totalCollecteJour: number;
    retardsCritiques: number;
  };
}

// Crédits standalone
interface CreditItem {
  id: number;
  reference: string;
  statut: "ACTIF" | "EN_RETARD";
  montantTotal: string;
  montantRembourse: string;
  soldeRestant: string;
  montantJournalier: string;
  dateEcheanceFin: string;
  client: { id: number; nom: string; prenom: string; telephone: string };
  echeances: { id: number; montantDu: string; montantPaye: string; dateEcheance: string; statut: string }[];
  remboursements: { id: number; montant: string; dateRemboursement: string }[];
}

interface CreditsResponse {
  credits: CreditItem[];
  stats: { total: number; totalSolde: number; enRetard: number };
}

// Cible pour modal encaisser session
interface EncaisserTarget {
  type: "PACK" | "CREDIT";
  souscriptionId?: number;
  creditId?: number;
  label: string;
  clientNom: string;
  montantAttendu: number;
}

interface Echeance {
  id: number;
  numero: number;
  montant: string;
  datePrevue: string;
  statut: "EN_ATTENTE" | "EN_RETARD" | "PAYE" | "ANNULE";
}

interface Souscription {
  id: number;
  statut: "EN_ATTENTE" | "ACTIF" | "COMPLETE" | "SUSPENDU" | "ANNULE";
  montantTotal: string;
  montantVerse: string;
  montantRestant: string;
  numeroCycle: number;
  formuleRevendeur?: string | null;
  dateDebut: string;
  pack: { nom: string; type: TypePack; frequenceVersement: string };
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  user?: { id: number; nom: string; prenom: string; telephone: string } | null;
  echeances: Echeance[];
  _count: { versements: number };
}

interface PacksResponse {
  souscriptions: Souscription[];
  stats: { total: number; totalMontantRestant: number; enRetard: number; expirees: number };
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  quartier: string | null;
  ville: string | null;
  activite: string | null;
  etat: string;
  typeClient: string | null;
  limiteCredit: string | null;
  soldeActuel: string | null;
  niveauRisque: string | null;
  codeClient: string | null;
  createdAt: string;
  _count?: { souscriptionsPacks: number };
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneLivraison {
  id: number;
  quantite: number;
  prixUnitaire: string;
  produit: { nom: string; prixUnitaire: string };
}

interface ReceptionPack {
  id: number;
  statut: "PLANIFIEE" | "LIVREE";
  datePrevisionnelle: string;
  dateLivraison?: string;
  livreurNom?: string;
  notes?: string;
  souscription: {
    id: number;
    pack: { nom: string; type: TypePack };
    client?: { nom: string; prenom: string; telephone: string } | null;
    user?: { nom: string; prenom: string } | null;
  };
  lignes: LigneLivraison[];
}

interface LivraisonsResponse {
  planifiees: ReceptionPack[];
  livreesRecentes: ReceptionPack[];
  stats: { totalPlanifiees: number; totalLivrees: number };
}

interface LigneVente {
  id: number; produitId: number; quantite: number; prixUnitaire: string; montant: string;
  produit: { id: number; nom: string; unite: string | null };
}
interface VenteTerrain {
  id: number; reference: string;
  statut: "BROUILLON" | "CONFIRMEE" | "SORTIE_VALIDEE" | "LIVREE" | "ANNULEE"
        | "PAID" | "CREDIT_REQUEST" | "CREDIT_APPROUVE" | "CREDIT_REFUSE";
  montantTotal: string; montantPaye: string;
  modePaiement: string; notes: string | null;
  clientNom: string | null; clientTelephone: string | null;
  client: { id: number; nom: string; prenom: string; telephone: string } | null;
  lignes: LigneVente[];
  createdAt: string;
}
interface CreditActifClient {
  id: number;
  reference: string;
  statut: string;
  montantTotal: string;
  montantConsomme: string;
}

interface ClientDispo {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  limiteCredit: string | null;
  soldeActuel: string | null;
  creditsClients: CreditActifClient[];
}

interface VentesTerrainResponse {
  data: VenteTerrain[];
  produitsDispo: { id: number; quantite: number; produit: { id: number; nom: string; unite: string | null; prixUnitaire: string } }[];
  clients: ClientDispo[];
  stats: { total: number; montantTotal: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// Portefeuille crédit
interface CreditClientActif {
  id: number;
  reference: string;
  statut: string;
  montantTotal: number;
  montantConsomme: number;
  soldeDisponible: number;
  dateEcheanceFin: string | null;
}

interface ClientCreditProfil {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  etat: string;
  niveauRisque: string | null;
  limiteCredit: number | null;
  soldeActuel: number;
  creditDisponible: number;
  creditsActifs: CreditClientActif[];
}

interface PortefeuilleCreditResponse {
  clients: ClientCreditProfil[];
  stats: {
    totalClients: number;
    avecCredit: number;
    totalPlafond: number;
    totalEngage: number;
    totalDisponible: number;
    alertes: number;
  };
}
interface StockDispoItem {
  id: number; quantite: number;
  produit: { id: number; nom: string; unite: string | null; prixUnitaire: string };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PACK_LABELS: Record<TypePack, string> = {
  ALIMENTAIRE: "Alimentaire", REVENDEUR: "Revendeur", FAMILIAL: "Familial",
  URGENCE: "Urgence", EPARGNE_PRODUIT: "Épargne-Produit", FIDELITE: "Fidélité",
};

const PACK_COLORS: Record<TypePack, { badge: string; border: string }> = {
  ALIMENTAIRE:   { badge: "bg-green-100 text-green-800",  border: "border-green-200" },
  REVENDEUR:     { badge: "bg-blue-100 text-blue-800",    border: "border-blue-200" },
  FAMILIAL:      { badge: "bg-purple-100 text-purple-800",border: "border-purple-200" },
  URGENCE:       { badge: "bg-red-100 text-red-800",      border: "border-red-200" },
  EPARGNE_PRODUIT:{ badge: "bg-amber-100 text-amber-800", border: "border-amber-200" },
  FIDELITE:      { badge: "bg-pink-100 text-pink-800",    border: "border-pink-200" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, subtitle, icon: Icon, color, lightBg }: {
  label: string; value: string; subtitle?: string; icon: LucideIcon; color: string; lightBg: string;
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className={`${lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
    </div>
    <h3 className="text-slate-600 text-sm font-medium mb-1">{label}</h3>
    <p className="text-3xl font-bold text-slate-800">{value}</p>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

// ─── Modal Collecte ───────────────────────────────────────────────────────────

function ModalCollecte({
  souscription,
  onClose,
  onSuccess,
}: {
  souscription: Souscription;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const prochaine = souscription.echeances[0];
  const type = souscription.pack.type;

  const [montant, setMontant] = useState(prochaine ? String(prochaine.montant) : "");
  const [notes, setNotes] = useState("");

  const { mutate, loading } = useMutation(
    `/api/agentTerrain/packs/${souscription.id}/collecte`,
    "POST",
    { successMessage: "Versement collecté !" }
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      montant: parseFloat(montant),
      notes: notes || undefined,
    };
    if (prochaine) payload.echeanceId = prochaine.id;
    const res = await mutate(payload);
    if (res) { onSuccess(); onClose(); }
  }

  const personne = souscription.client
    ? `${souscription.client.prenom} ${souscription.client.nom}`
    : souscription.user
    ? `${souscription.user.prenom} ${souscription.user.nom}`
    : "—";

  const typeInfo: Record<TypePack, string> = {
    ALIMENTAIRE: "Cotisation périodique — produit remis à solde complet",
    REVENDEUR: souscription.formuleRevendeur === "FORMULE_1"
      ? "Remboursement hebdomadaire (F1)"
      : "Remboursement quotidien 16j (F2)",
    FAMILIAL: `Cycle ${souscription.numeroCycle} — panier remis à solde`,
    URGENCE: "Remboursement journalier (7-10j)",
    EPARGNE_PRODUIT: "Épargne progressive",
    FIDELITE: "Points bonus",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800">{t("field_collection")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg transition-colors">×</button>
        </div>

        {/* Info souscription */}
        <div className={`p-4 rounded-xl border ${PACK_COLORS[type].border} bg-opacity-30 mb-5 space-y-2`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PACK_COLORS[type].badge}`}>
              {PACK_LABELS[type]}
            </span>
            <span className="text-sm font-semibold text-slate-800">{souscription.pack.nom}</span>
          </div>
          <p className="text-sm text-slate-600"><span className="font-medium">{t('field_client')} :</span> {personne}</p>
          <p className="text-xs text-slate-500 italic">{typeInfo[type]}</p>
          <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
            <span className="text-slate-500">{t('remaining')}</span>
            <span className="font-bold text-red-600">{formatCurrency(Number(souscription.montantRestant))}</span>
          </div>
          {prochaine && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Échéance #{prochaine.numero}</span>
              <span className={`font-medium ${prochaine.statut === "EN_RETARD" ? "text-red-600" : "text-slate-700"}`}>
                {formatCurrency(Number(prochaine.montant))} — {formatDate(prochaine.datePrevue)}
                {prochaine.statut === "EN_RETARD" && " (EN RETARD)"}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('amount_collected')} *</label>
            <input
              type="number" min="1" max={Number(souscription.montantRestant)} required
              value={montant} onChange={(e) => setMontant(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                montant && parseFloat(montant) > Number(souscription.montantRestant)
                  ? "border-red-400 bg-red-50"
                  : "border-slate-200"
              }`}
              placeholder="Ex : 5000"
            />
            <p className="text-xs text-slate-400 mt-1">
              {t('max_allowed')} : <span className="font-semibold text-slate-600">{formatCurrency(Number(souscription.montantRestant))}</span>
            </p>
            {montant && parseFloat(montant) > Number(souscription.montantRestant) && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                {t('amount_exceeds_remaining')} ({formatCurrency(Number(souscription.montantRestant))})
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes_optional')}</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Observations terrain…"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
              {t('field_cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !montant || parseFloat(montant) <= 0 || parseFloat(montant) > Number(souscription.montantRestant)}
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('saving')}</> : "Confirmer collecte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Encaisser (session collecte) ───────────────────────────────────────

function ModalEncaisserSession({
  target,
  collecteId,
  onClose,
  onSuccess,
}: {
  target: EncaisserTarget;
  collecteId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [montant, setMontant] = useState(String(target.montantAttendu));
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [notes, setNotes] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const { mutate, loading } = useMutation<unknown, object>(
    `/api/agentTerrain/collecteJour/${collecteId}/encaisser`,
    "POST",
    { successMessage: "Encaissement enregistré !" }
  );

  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus("err"); return; }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus("ok"); },
      () => setGpsStatus("err"),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      type: target.type,
      montant: parseFloat(montant),
      modePaiement,
      notes: notes || undefined,
      latitude: coords?.lat ?? undefined,
      longitude: coords?.lng ?? undefined,
    };
    if (target.type === "PACK") payload.souscriptionId = target.souscriptionId;
    else payload.creditId = target.creditId;

    const res = await mutate(payload);
    if (res) { onSuccess(); onClose(); }
  }

  const montantNum = parseFloat(montant) || 0;
  const max = target.montantAttendu;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800">
            {target.type === "PACK" ? "Encaisser versement pack" : "Encaisser remboursement crédit"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg">×</button>
        </div>

        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 mb-5 space-y-1">
          <p className="text-sm font-semibold text-slate-800">{target.clientNom}</p>
          <p className="text-xs text-slate-500">{target.label}</p>
          <p className="text-sm text-teal-700 font-medium">
            Montant attendu : {target.montantAttendu.toLocaleString("fr-FR")} FCFA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant encaissé *</label>
            <input
              type="number" min="1" max={max} required value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                montantNum > max ? "border-red-400 bg-red-50" : "border-slate-200"
              }`}
            />
            {montantNum > max && (
              <p className="text-xs text-red-600 mt-1">Montant supérieur au maximum ({max.toLocaleString("fr-FR")} FCFA)</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mode de paiement</label>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CHEQUE">Chèque</option>
              <option value="VIREMENT">Virement</option>
            </select>
          </div>

          {/* GPS */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Position GPS (anti-fraude)</label>
            {gpsStatus === "idle" && (
              <button type="button" onClick={captureGPS}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                <Navigation size={14} /> Capturer ma position
              </button>
            )}
            {gpsStatus === "loading" && (
              <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Localisation en cours…</p>
            )}
            {gpsStatus === "ok" && coords && (
              <p className="text-xs text-emerald-600 flex items-center gap-2">
                <CheckCircle size={12} /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
            {gpsStatus === "err" && (
              <p className="text-xs text-amber-600">Position non disponible (continuez sans GPS)</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Observations…" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">Annuler</button>
            <button type="submit"
              disabled={loading || !montant || montantNum <= 0 || montantNum > max}
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</> : "Confirmer encaissement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Rembourser crédit (standalone) ─────────────────────────────────────

function ModalRembourserCredit({
  credit,
  onClose,
  onSuccess,
}: {
  credit: CreditItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const prochaine = credit.echeances[0];
  const defaultMontant = prochaine ? String(Number(prochaine.montantDu) - Number(prochaine.montantPaye)) : String(Number(credit.montantJournalier));
  const [montant, setMontant] = useState(defaultMontant);
  const [notes, setNotes] = useState("");
  const max = Number(credit.soldeRestant);

  const { mutate, loading } = useMutation<unknown, object>(
    `/api/agentTerrain/credits/${credit.id}/rembourser`,
    "POST",
    { successMessage: "Remboursement enregistré !" }
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({ montant: parseFloat(montant), notes: notes || undefined });
    if (res) { onSuccess(); onClose(); }
  }

  const montantNum = parseFloat(montant) || 0;
  const clientNom = `${credit.client.prenom} ${credit.client.nom}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800">Remboursement crédit</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg">×</button>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 mb-5 space-y-1">
          <p className="text-sm font-semibold text-slate-800">{clientNom}</p>
          <p className="text-xs font-mono text-slate-500">{credit.reference}</p>
          <div className="flex justify-between text-sm pt-1 border-t border-blue-100">
            <span className="text-slate-500">Solde restant</span>
            <span className="font-bold text-red-600">{formatCurrency(max)}</span>
          </div>
          {prochaine && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Échéance courante ({formatDate(prochaine.dateEcheance)})</span>
              <span className={`font-medium ${prochaine.statut === "EN_RETARD" ? "text-red-600" : "text-slate-600"}`}>
                {formatCurrency(Number(prochaine.montantDu) - Number(prochaine.montantPaye))} FCFA
                {prochaine.statut === "EN_RETARD" && " ⚠"}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant *</label>
            <input
              type="number" min="1" max={max} required value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                montantNum > max ? "border-red-400 bg-red-50" : "border-slate-200"
              }`}
            />
            <p className="text-xs text-slate-400 mt-1">Max : {formatCurrency(max)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Observations…" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">Annuler</button>
            <button type="submit"
              disabled={loading || montantNum <= 0 || montantNum > max}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</> : "Confirmer remboursement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Ajout Client (enrichi) ─────────────────────────────────────────────

const EMPTY_CLIENT_FORM = {
  nom: "", prenom: "", telephone: "",
  sexe: "", dateNaissance: "", telephoneSecondaire: "",
  adresse: "", quartier: "", ville: "", numeroCNI: "",
  activite: "", nomCommerce: "",
  latitude: "", longitude: "",
};

function ModalAddClientRiche({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(EMPTY_CLIENT_FORM);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  const { mutate, loading } = useMutation<unknown, object>(
    "/api/agentTerrain/clients", "POST",
    { successMessage: "Client ajouté !" }
  );

  const handleGeo = () => {
    if (!navigator.geolocation) { setGeoError("Non supporté"); return; }
    setGeoLoading(true); setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }));
        setGeoLoading(false);
      },
      (err) => { setGeoError(err.code === 1 ? "Permission refusée" : "Position indisponible"); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const set = (k: keyof typeof EMPTY_CLIENT_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nom: form.nom, prenom: form.prenom, telephone: form.telephone,
      sexe: form.sexe || undefined,
      dateNaissance: form.dateNaissance || undefined,
      telephoneSecondaire: form.telephoneSecondaire || undefined,
      adresse: form.adresse || undefined,
      quartier: form.quartier || undefined,
      ville: form.ville || undefined,
      numeroCNI: form.numeroCNI || undefined,
      activite: form.activite || undefined,
      nomCommerce: form.nomCommerce || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
    };
    const res = await mutate(payload);
    if (res) { onSuccess(); onClose(); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <UserPlus size={18} className="text-teal-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Nouveau client</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Body scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ─ Identité ─ */}
          <section>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identité</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom <span className="text-red-500">*</span></label>
                <input required value={form.nom} onChange={set("nom")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Nom de famille" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prénom <span className="text-red-500">*</span></label>
                <input required value={form.prenom} onChange={set("prenom")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Prénom" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sexe</label>
                <select value={form.sexe} onChange={set("sexe")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">-- Sélectionner --</option>
                  <option value="MASCULIN">Masculin</option>
                  <option value="FEMININ">Féminin</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date de naissance</label>
                <input type="date" value={form.dateNaissance} onChange={set("dateNaissance")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tél. principal <span className="text-red-500">*</span></label>
                <input required type="tel" value={form.telephone} onChange={set("telephone")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="07XXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tél. secondaire</label>
                <input type="tel" value={form.telephoneSecondaire} onChange={set("telephoneSecondaire")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Optionnel" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">N° CNI / Pièce d&apos;identité</label>
                <input value={form.numeroCNI} onChange={set("numeroCNI")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Numéro de la pièce d'identité" />
              </div>
            </div>
          </section>

          {/* ─ Localisation ─ */}
          <section>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Localisation</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
                <input value={form.adresse} onChange={set("adresse")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Rue, numéro…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quartier</label>
                <input value={form.quartier} onChange={set("quartier")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Quartier" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ville</label>
                <input value={form.ville} onChange={set("ville")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ville" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Navigation size={12} /> Position GPS
                </label>
                {form.latitude && form.longitude ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-700 flex items-center gap-2">
                      <Navigation size={13} /> {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
                    </span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, latitude: "", longitude: "" }))}
                      className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={handleGeo} disabled={geoLoading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    {geoLoading ? <><Loader2 size={14} className="animate-spin" /> Localisation…</> : <><Navigation size={14} /> Obtenir ma position GPS</>}
                  </button>
                )}
                {geoError && <p className="text-xs text-red-500 mt-1">{geoError}</p>}
              </div>
            </div>
          </section>

          {/* ─ Activité & commerce ─ */}
          <section>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Activité & commerce</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Activité / Métier</label>
                <input value={form.activite} onChange={set("activite")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Commerçant, Agriculteur…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom du commerce</label>
                <input value={form.nomCommerce} onChange={set("nomCommerce")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Nom de la boutique" />
              </div>
            </div>
          </section>

          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            Le plafond de crédit est fixé par l&apos;administrateur après la création du client.
          </p>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">Annuler</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</> : "Ajouter le client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Nouveau Crédit (agent terrain) ─────────────────────────────────────

function ModalNouveauCredit({
  client,
  onClose,
  onSuccess,
}: {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const disponible = Number(client.limiteCredit ?? 0) - Number(client.soldeActuel ?? 0);
  const [montant, setMontant] = useState("");
  const [dureeJours, setDureeJours] = useState("30");
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10));
  const [garantie, setGarantie] = useState("");
  const [observations, setObservations] = useState("");

  const { mutate, loading } = useMutation<unknown, object>(
    "/api/agentTerrain/credits", "POST",
    { successMessage: "Demande de crédit soumise ! En attente de validation admin." }
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({
      clientId: client.id,
      montantTotal: parseFloat(montant),
      dureeJours: parseInt(dureeJours),
      dateDebut,
      garantie: garantie || undefined,
      observations: observations || undefined,
    });
    if (res) { onSuccess(); onClose(); }
  }

  const montantNum = parseFloat(montant) || 0;
  const montantJournalier = dureeJours && montantNum > 0
    ? (montantNum / parseInt(dureeJours)).toFixed(0)
    : "—";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800">Demande de crédit</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Info client + plafond */}
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 mb-5 space-y-2">
          <p className="text-sm font-semibold text-slate-800">{client.prenom} {client.nom}</p>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Plafond admin</span>
            <span className="font-semibold text-slate-700">{formatCurrency(Number(client.limiteCredit))}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Solde en cours</span>
            <span className="font-semibold text-orange-600">{formatCurrency(Number(client.soldeActuel ?? 0))}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-blue-100 pt-1">
            <span className="text-slate-500">Disponible</span>
            <span className={`font-bold ${disponible > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(Math.max(0, disponible))}
            </span>
          </div>
        </div>

        {disponible <= 0 ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
            Limite de crédit atteinte. Aucun nouveau crédit possible.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Montant demandé (FCFA) *</label>
              <input type="number" required min="1" max={disponible} value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${montantNum > disponible ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                placeholder={`Max : ${formatCurrency(disponible)}`} />
              {montantNum > disponible && (
                <p className="text-xs text-red-600 mt-1">Dépasse le disponible ({formatCurrency(disponible)})</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Durée (jours) *</label>
                <input type="number" required min="1" value={dureeJours}
                  onChange={(e) => setDureeJours(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paiement/jour</label>
                <div className="w-full border border-slate-100 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-teal-700 font-semibold">
                  {montantJournalier !== "—" ? `${Number(montantJournalier).toLocaleString("fr-FR")} FCFA` : "—"}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de début *</label>
              <input type="date" required value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Garantie (optionnel)</label>
              <input value={garantie} onChange={(e) => setGarantie(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex : Téléphone, moto…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observations (optionnel)</label>
              <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Motif, contexte…" />
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              La demande sera soumise à validation par l&apos;administrateur avant activation.
            </p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">Annuler</button>
              <button type="submit" disabled={loading || montantNum <= 0 || montantNum > disponible}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Envoi…</> : <><Send size={14} /> Soumettre la demande</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Types pour le modal souscription ─────────────────────────────────────────

interface PackTemplate {
  id: number;
  nom: string;
  type: TypePack;
  dureeJours: number | null;
  frequenceVersement: string | null;
  acomptePercent: string | null;
  montantVersement: string | null;
  description: string | null;
}

interface PackTemplatesResponse {
  packs: PackTemplate[];
}

// ─── Modal Nouvelle Souscription ──────────────────────────────────────────────

function ModalNouvelleSouscription({
  clients,
  onClose,
  onSuccess,
}: {
  clients: Client[];
  onClose: () => void;
  onSuccess: (souscriptionId: number) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedPack, setSelectedPack] = useState<PackTemplate | null>(null);
  const [montantTotal, setMontantTotal] = useState("");
  const [acompte, setAcompte] = useState("");
  const [formuleRevendeur, setFormuleRevendeur] = useState("FORMULE_1");
  const [frequenceVersement, setFrequenceVersement] = useState("");
  const [notes, setNotes] = useState("");

  // Étape 3 — produits demandés
  const [createdSouscId, setCreatedSouscId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [newProds, setNewProds] = useState<{ nom: string; quantite: string }[]>([]);
  const [savingLignes, setSavingLignes] = useState(false);

  const { data: templatesResponse, loading: templatesLoading } =
    useApi<PackTemplatesResponse>("/api/agentTerrain/packs/templates");
  const templates = templatesResponse?.packs ?? [];

  // Produits disponibles — chargés uniquement à l'étape 3
  const { data: ventesModalData } = useApi<VentesTerrainResponse>(
    step === 3 ? "/api/agentTerrain/ventes" : null
  );
  const produitsDispoModal = (ventesModalData?.produitsDispo ?? []) as StockDispoItem[];

  const { mutate, loading } = useMutation<{ id: number }, object>(
    "/api/agentTerrain/souscriptions", "POST",
    { successMessage: "Souscription créée — en attente de validation admin." }
  );

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return !q ||
      c.nom.toLowerCase().includes(q) ||
      c.prenom.toLowerCase().includes(q) ||
      c.telephone.includes(q);
  });

  const handleSelectClient = (c: Client) => {
    setSelectedClient(c);
    setStep(2);
  };

  const handleSelectPack = (p: PackTemplate) => {
    setSelectedPack(p);
    setMontantTotal("");
    setAcompte("");
    setFrequenceVersement(p.frequenceVersement ?? "");
  };

  const minAcompte = selectedPack && selectedPack.acomptePercent && montantTotal
    ? Math.ceil(parseFloat(montantTotal) * Number(selectedPack.acomptePercent) / 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !selectedPack) return;
    const res = await mutate({
      packId: selectedPack.id,
      clientId: selectedClient.id,
      montantTotal: parseFloat(montantTotal),
      acompteInitial: acompte ? parseFloat(acompte) : undefined,
      formuleRevendeur: selectedPack.type === "REVENDEUR" ? formuleRevendeur : undefined,
      frequenceVersement: frequenceVersement || undefined,
      notes: notes || undefined,
    });
    if (res && res.id) {
      setCreatedSouscId(res.id);
      setStep(3);
    }
  };

  const submitLignes = async () => {
    if (!createdSouscId) { onSuccess(0); onClose(); return; }
    const lignes: Array<{ produitId?: number; produitNomSaisi: string; quantite: number }> = [];
    for (const id of checkedIds) {
      const item = produitsDispoModal.find(p => p.produit.id === id);
      if (!item) continue;
      const qte = parseInt(quantities[id] || "1");
      if (qte > 0) lignes.push({ produitId: id, produitNomSaisi: item.produit.nom, quantite: qte });
    }
    for (const p of newProds) {
      if (p.nom.trim() && parseInt(p.quantite) > 0)
        lignes.push({ produitNomSaisi: p.nom.trim(), quantite: parseInt(p.quantite) });
    }
    if (lignes.length > 0) {
      setSavingLignes(true);
      try {
        await fetch(`/api/agentTerrain/souscriptions/${createdSouscId}/lignes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lignes }),
        });
      } finally {
        setSavingLignes(false);
      }
    }
    onSuccess(createdSouscId);
    onClose();
  };

  const STEPS = [{ n: 1, label: "Client" }, { n: 2, label: "Pack" }, { n: 3, label: "Produits" }];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <Plus size={18} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Nouvelle souscription</h2>
              <p className="text-xs text-slate-500">
                {step === 1 ? "Étape 1 — Choisir le client"
                  : step === 2 ? `Étape 2 — Pack pour ${selectedClient?.prenom} ${selectedClient?.nom}`
                  : "Étape 3 — Produits souhaités par le client"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
          {STEPS.map(({ n, label }, i) => (
            <React.Fragment key={n}>
              <div className={`flex items-center gap-1.5 ${step >= n ? "text-teal-600" : "text-slate-400"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > n ? "bg-teal-600 text-white" : step === n ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {step > n ? <CheckCircle size={12} /> : n}
                </div>
                <span className="text-xs font-medium">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-1" />}
            </React.Fragment>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* ── Étape 1 : sélection client ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text" placeholder="Rechercher par nom ou téléphone…"
                  value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
                />
              </div>
              {filteredClients.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Aucun client trouvé</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id} type="button"
                      onClick={() => handleSelectClient(c)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                    >
                      <p className="font-semibold text-slate-800 text-sm">{c.prenom} {c.nom}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={11} />{c.telephone}
                        {c.quartier && <><span className="mx-1">·</span>{c.quartier}</>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Étape 2 : pack + montant ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Sélection pack */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Choisir un pack</p>
                {templatesLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {templates.map((p) => {
                      const colors = PACK_COLORS[p.type];
                      return (
                        <button
                          key={p.id} type="button"
                          onClick={() => handleSelectPack(p)}
                          className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                            selectedPack?.id === p.id
                              ? "border-teal-500 bg-teal-50"
                              : "border-slate-200 hover:border-teal-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                              {PACK_LABELS[p.type]}
                            </span>
                            <span className="font-semibold text-slate-800 text-sm">{p.nom}</span>
                          </div>
                          {p.description && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{p.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedPack && (
                <>
                  {/* REVENDEUR : choix formule */}
                  {selectedPack.type === "REVENDEUR" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Formule</label>
                      <select value={formuleRevendeur} onChange={(e) => setFormuleRevendeur(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="FORMULE_1">Formule 1 — Tontine hebdomadaire</option>
                        <option value="FORMULE_2">Formule 2 — Remboursement quotidien 16j</option>
                      </select>
                    </div>
                  )}

                  {/* FAMILIAL : fréquence */}
                  {selectedPack.type === "FAMILIAL" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence de versement</label>
                      <select value={frequenceVersement} onChange={(e) => setFrequenceVersement(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="HEBDOMADAIRE">Hebdomadaire</option>
                        <option value="BIMENSUEL">Bimensuel</option>
                        <option value="MENSUEL">Mensuel</option>
                        <option value="QUOTIDIEN">Quotidien</option>
                      </select>
                    </div>
                  )}

                  {/* Montant total */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Montant total (FCFA) <span className="text-red-500">*</span></label>
                    <input
                      type="number" required min="1" value={montantTotal}
                      onChange={(e) => setMontantTotal(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Ex : 25000"
                    />
                  </div>

                  {/* Acompte */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Acompte initial (FCFA)
                      {minAcompte > 0 && <span className="ml-1 text-amber-600">min : {minAcompte.toLocaleString("fr-FR")}</span>}
                    </label>
                    <input
                      type="number" min={minAcompte || 0} max={montantTotal ? parseFloat(montantTotal) : undefined}
                      value={acompte} onChange={(e) => setAcompte(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="0"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Observations (optionnel)</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Informations utiles pour l'admin…" />
                  </div>

                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    La souscription sera créée <strong>EN ATTENTE</strong> et devra être validée par l&apos;administrateur.
                  </p>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedPack || !montantTotal || parseFloat(montantTotal) <= 0}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</> : <><Package size={14} /> Créer &amp; choisir les produits</>}
                </button>
              </div>
            </form>
          )}

          {/* ── Étape 3 : produits demandés ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-teal-500 w-4 h-4 shrink-0" />
                  <p className="text-sm font-semibold text-slate-800">Souscription créée !</p>
                </div>
                <span className="text-xs text-slate-500">{selectedClient?.prenom} {selectedClient?.nom}</span>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Produits souhaités par le client
                  <span className="text-slate-400 font-normal ml-1">(optionnel — cochez et saisissez les quantités)</span>
                </p>

                {!ventesModalData ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                  </div>
                ) : produitsDispoModal.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">Aucun produit catalogue disponible</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {produitsDispoModal.map(item => {
                      const checked = checkedIds.has(item.produit.id);
                      return (
                        <label key={item.produit.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? "bg-teal-50" : "hover:bg-slate-50"}`}>
                          <input type="checkbox" className="w-4 h-4 accent-teal-600"
                            checked={checked}
                            onChange={e => {
                              setCheckedIds(s => { const n = new Set(s); if (e.target.checked) n.add(item.produit.id); else n.delete(item.produit.id); return n; });
                              if (e.target.checked && !quantities[item.produit.id]) setQuantities(q => ({ ...q, [item.produit.id]: "1" }));
                            }} />
                          <span className="flex-1 text-sm text-slate-800 font-medium">{item.produit.nom}</span>
                          {item.produit.unite && <span className="text-xs text-slate-400">{item.produit.unite}</span>}
                          {item.quantite > 0 && <span className="text-xs text-slate-400">stock : {item.quantite}</span>}
                          {checked && (
                            <input type="number" min="1"
                              value={quantities[item.produit.id] ?? "1"}
                              onChange={e => setQuantities(q => ({ ...q, [item.produit.id]: e.target.value }))}
                              onClick={e => e.preventDefault()}
                              className="w-16 border border-teal-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Produits hors catalogue */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Produits hors catalogue</span>
                  <button type="button"
                    onClick={() => setNewProds(p => [...p, { nom: "", quantite: "1" }])}
                    className="text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1">
                    <Plus size={12} /> Ajouter
                  </button>
                </div>
                {newProds.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input type="text" placeholder="Nom du produit" value={p.nom}
                      onChange={e => setNewProds(arr => arr.map((x, j) => j === i ? { ...x, nom: e.target.value } : x))}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="number" min="1" value={p.quantite}
                      onChange={e => setNewProds(arr => arr.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))}
                      className="w-20 border border-slate-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <button type="button" onClick={() => setNewProds(arr => arr.filter((_, j) => j !== i))}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { onSuccess(createdSouscId!); onClose(); }} disabled={savingLignes}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">
                  Passer
                </button>
                <button type="button" onClick={submitLignes} disabled={savingLignes}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  {savingLignes ? "Enregistrement…"
                    : `Enregistrer${checkedIds.size + newProds.filter(p => p.nom.trim()).length > 0
                        ? ` (${checkedIds.size + newProds.filter(p => p.nom.trim()).length})`
                        : " & terminer"}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type TabKey = "prospects" | "packs" | "livraisons" | "ventes" | "collecteJour" | "credits" | "portefeuilleCredit";

export default function AgentTerrainPage() {
  const t = useT();
  const { isAllowed, allowedPages } = usePageAccess();

  const [searchQuery, setSearchQuery]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab]           = useState<TabKey>("packs");
  const [factureVenteId, setFactureVenteId] = useState<number | null>(null);
  const [factureCreditId, setFactureCreditId] = useState<number | null>(null);
  const [showProForma, setShowProForma]     = useState(false);
  const [clientPage, setClientPage]     = useState(1);
  const [packTypeFilter, setPackTypeFilter] = useState("");
  const [collectTarget, setCollectTarget] = useState<Souscription | null>(null);
  const [addClientModal, setAddClientModal] = useState(false);
  const [nouveauCreditClient, setNouveauCreditClient] = useState<Client | null>(null);
  const [nouvelleSouscriptionModal, setNouvelleSouscriptionModal] = useState(false);
  const [createdSouscriptionId, setCreatedSouscriptionId] = useState<number | null>(null);

  // ── Collecte du Jour ──
  const [encaisserTarget, setEncaisserTarget] = useState<EncaisserTarget | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);

  // ── Crédits ──
  const [rembourserCredit, setRembourserCredit] = useState<CreditItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── API ──
  const clientParams = new URLSearchParams({ page: String(clientPage), limit: "10" });
  if (debouncedSearch && activeTab === "prospects") clientParams.set("search", debouncedSearch);

  const packParams = new URLSearchParams();
  if (debouncedSearch && activeTab === "packs") packParams.set("search", debouncedSearch);
  if (packTypeFilter) packParams.set("type", packTypeFilter);

  const { data: clientsResponse, loading: clientsLoading, refetch: refetchClients } =
    useApi<ClientsResponse>(`/api/agentTerrain/clients?${clientParams}`);
  const { data: packsResponse, loading: packsLoading, refetch: refetchPacks } =
    useApi<PacksResponse>(`/api/agentTerrain/packs?${packParams}`);
  const { data: livraisonsResponse, loading: livraisonsLoading, refetch: refetchLivraisons } =
    useApi<LivraisonsResponse>("/api/agentTerrain/livraisons");
  const { data: collecteJourData, loading: collecteJourLoading, refetch: refetchCollecteJour } =
    useApi<CollecteJourResponse>(activeTab === "collecteJour" ? "/api/agentTerrain/collecteJour" : null);
  const { data: creditsData, loading: creditsLoading, refetch: refetchCredits } =
    useApi<CreditsResponse>(activeTab === "credits" ? "/api/agentTerrain/credits" : null);

  const { mutate: demarrerSession, loading: demarrantSession } = useMutation<unknown, object>(
    "/api/agentTerrain/collecteJour", "POST",
    { successMessage: "Tournée démarrée !" }
  );

  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const { mutate: doConfirm } = useMutation(
    confirmingId !== null ? `/api/agentTerrain/livraisons/${confirmingId}/confirmer` : "",
    "POST",
    { successMessage: "Livraison confirmée !" }
  );

  useEffect(() => {
    if (confirmingId === null) return;
    doConfirm({}).then((res) => {
      if (res) refetchLivraisons();
      setConfirmingId(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingId]);

  // ── Portefeuille crédit ──
  const [portCreditFiltre, setPortCreditFiltre] = useState<"tous" | "avecCredit" | "disponible" | "limite_atteinte">("avecCredit");
  const [portCreditSearch, setPortCreditSearch] = useState("");
  const [portCreditOpen,   setPortCreditOpen]   = useState<number | null>(null);

  const portCreditUrl = `/api/agentTerrain/portefeuille-credit?filtre=${portCreditFiltre}${portCreditSearch ? `&search=${encodeURIComponent(portCreditSearch)}` : ""}`;
  const { data: portCreditData, loading: portCreditLoading, refetch: refetchPortCredit } =
    useApi<PortefeuilleCreditResponse>(activeTab === "portefeuilleCredit" ? portCreditUrl : null);

  // ── Ventes terrain ──
  const [showVenteForm, setShowVenteForm]     = useState(false);
  const [vClientId, setVClientId]             = useState("");
  const [vCreditClientId, setVCreditClientId] = useState("");
  const [vClientNom, setVClientNom]       = useState("");
  const [vClientTel, setVClientTel]       = useState("");
  const [vModePaiement, setVModePaiement] = useState("ESPECES");
  const [vMontantPaye, setVMontantPaye]   = useState("");
  const [vNotes, setVNotes]               = useState("");
  const [vLignes, setVLignes]             = useState<{ produitId: string; quantite: string; prixUnitaire: string }[]>([
    { produitId: "", quantite: "", prixUnitaire: "" },
  ]);

  const cancelVenteIdRef  = useRef<number | null>(null);
  const livrerVenteIdRef  = useRef<number | null>(null);

  const { data: ventesRes, loading: ventesLoading, refetch: refetchVentes } =
    useApi<VentesTerrainResponse>(activeTab === "ventes" ? "/api/agentTerrain/ventes" : null);
  const ventesData      = ventesRes?.data ?? [];
  const produitsDispo   = (ventesRes?.produitsDispo ?? []) as StockDispoItem[];
  const clientsDispo    = ventesRes?.clients ?? [];
  const ventesEnAttente = ventesData.filter(v => v.statut === "BROUILLON" || v.statut === "CREDIT_REQUEST").length;

  const { mutate: submitVente, loading: venteSubmitLoading } =
    useMutation<unknown, object>("/api/agentTerrain/ventes", "POST");

  const { mutate: doCancelVente } = useMutation<unknown, object>(
    () => cancelVenteIdRef.current ? `/api/agentTerrain/ventes/${cancelVenteIdRef.current}` : "",
    "PATCH",
    { successMessage: "Demande annulée." }
  );

  const { mutate: doLivrerVente, loading: livrerLoading } = useMutation<unknown, object>(
    () => livrerVenteIdRef.current ? `/api/agentTerrain/ventes/${livrerVenteIdRef.current}` : "",
    "PATCH",
    { successMessage: "Livraison confirmée !" }
  );

  const handleSubmitVente = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCredit = vModePaiement === "CREDIT";
    if (isCredit && !vClientId) {
      toast.error("Sélectionnez un client enregistré pour une vente à crédit.");
      return;
    }
    const lignesValides = vLignes.filter(l => l.produitId && l.quantite);
    if (!lignesValides.length) return;
    const montantTotal = lignesValides.reduce((s, l) => {
      const prix = Number(produitsDispo.find(p => p.produit.id === Number(l.produitId))?.produit.prixUnitaire ?? 0);
      return s + Number(l.quantite) * prix;
    }, 0);
    const res = await submitVente({
      modePaiement: vModePaiement,
      montantPaye: isCredit ? 0 : (Number(vMontantPaye) || montantTotal),
      clientId: vClientId || undefined,
      creditClientId: (isCredit && vCreditClientId) ? Number(vCreditClientId) : undefined,
      clientNom: !vClientId ? vClientNom || undefined : undefined,
      clientTelephone: !vClientId ? vClientTel || undefined : undefined,
      notes: vNotes || undefined,
      lignes: lignesValides.map(l => ({
        produitId: Number(l.produitId),
        quantite:  Number(l.quantite),
        // prixUnitaire volontairement omis — prix imposé par le catalogue côté serveur
      })),
    });
    if (res) {
      if (isCredit) {
        toast.success("Demande de crédit envoyée au Responsable Crédit !");
      } else {
        toast.success("Vente enregistrée — stock mis à jour !");
      }
      setShowVenteForm(false);
      setVClientId(""); setVCreditClientId(""); setVClientNom(""); setVClientTel("");
      setVMontantPaye(""); setVNotes("");
      setVLignes([{ produitId: "", quantite: "", prixUnitaire: "" }]);
      refetchVentes();
    }
  };

  const handleCancelVente = async (id: number) => {
    cancelVenteIdRef.current = id;
    const res = await doCancelVente({ action: "ANNULER" });
    if (res) refetchVentes();
    cancelVenteIdRef.current = null;
  };

  const handleLivrerVente = async (id: number) => {
    livrerVenteIdRef.current = id;
    const res = await doLivrerVente({ action: "LIVRER" });
    if (res) refetchVentes();
    livrerVenteIdRef.current = null;
  };

  const vMontantCalcule = vLignes.reduce((s, l) => {
    if (!l.produitId || !l.quantite) return s;
    const prix = Number(produitsDispo.find(p => p.produit.id === Number(l.produitId))?.produit.prixUnitaire ?? 0);
    return s + Number(l.quantite) * prix;
  }, 0);

  const clients        = clientsResponse?.data ?? [];
  const clientsMeta    = clientsResponse?.meta;
  const souscriptions  = packsResponse?.souscriptions ?? [];
  const packStats      = packsResponse?.stats;

  const refetchAll = () => {
    refetchClients(); refetchPacks();
    if (activeTab === "collecteJour")      refetchCollecteJour();
    if (activeTab === "credits")           refetchCredits();
    if (activeTab === "portefeuilleCredit") refetchPortCredit();
  };

  // ── Stat cards ──
  const statCards = [
    { label: "Clients", value: String(clientsMeta?.total ?? 0), subtitle: "Portefeuille", icon: Users, color: "text-blue-500", lightBg: "bg-blue-50" },
    { label: "Souscriptions actives", value: String(packStats?.total ?? 0), subtitle: "À collecter", icon: Layers, color: "text-teal-500", lightBg: "bg-teal-50" },
    { label: "Montant restant", value: formatCurrency(packStats?.totalMontantRestant ?? 0), subtitle: "Total packs à collecter", icon: Banknote, color: "text-emerald-500", lightBg: "bg-emerald-50" },
    { label: "Crédits actifs", value: String(creditsData?.stats.total ?? "—"), subtitle: formatCurrency(creditsData?.stats.totalSolde ?? 0) + " restant", icon: CreditCard, color: "text-blue-600", lightBg: "bg-blue-50" },
    { label: "Échéances en retard", value: String(packStats?.enRetard ?? 0), subtitle: "Paiements dépassés", icon: AlertCircle, color: "text-red-500", lightBg: "bg-red-50" },
  ];

  const allTabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: "collecteJour", label: "Collecte du Jour", icon: ClipboardList,
      badge: collecteJourData?.stats.retardsCritiques ?? 0 },
    { key: "credits",     label: "Crédits",           icon: CreditCard,
      badge: creditsData?.stats.enRetard ?? 0 },
    { key: "packs",       label: "Collecte Packs",   icon: Banknote },
    { key: "livraisons",  label: "Livraisons Pack",  icon: Truck,
      badge: livraisonsResponse?.stats.totalPlanifiees ?? 0 },
    { key: "ventes",      label: "Ventes comptant et à crédit", icon: ShoppingCart,
      badge: ventesEnAttente },
    { key: "prospects",        label: "Clients",           icon: Users },
    { key: "portefeuilleCredit", label: "Portefeuille Crédit", icon: Wallet,
      badge: portCreditData?.stats.alertes ?? 0 },
  ];
  const tabs = allTabs.filter((t) => isAllowed(t.key));

  useEffect(() => {
    if (allowedPages && !allowedPages.includes(activeTab)) {
      const first = allTabs.find((t) => allowedPages.includes(t.key));
      if (first) setActiveTab(first.key);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPages]);

  if (clientsLoading && !clientsResponse && !packsResponse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif]">

      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <DashboardBackButton />
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                {t('field_agent')}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <UserPdvBadge />
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      {factureVenteId  && <FactureModal venteDirecteId={factureVenteId}   onClose={() => setFactureVenteId(null)} />}
      {factureCreditId && <FactureModal creditClientId={factureCreditId} onClose={() => setFactureCreditId(null)} />}
      {showProForma    && <FactureModal proFormaMode onClose={() => setShowProForma(false)} />}

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-1">{t("field_dash_title")}</h2>
            <p className="text-slate-500 text-sm">{t('field_dash_subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/user/agentsTerrain/ventes-credit"
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <CreditCard size={16} /> Crédits Clients
            </Link>
            <button onClick={refetchAll} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} /> {t('refresh')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key ? "bg-teal-600 text-white shadow-lg shadow-teal-200" : "text-slate-600 hover:bg-slate-100"
                }`}>
                <Icon size={18} />{tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + filtres */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Rechercher…" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setClientPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
            </div>
            {activeTab === "packs" && (
              <>
                <select value={packTypeFilter} onChange={(e) => setPackTypeFilter(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">{t("field_all_types")}</option>
                  <option value="ALIMENTAIRE">Alimentaire</option>
                  <option value="REVENDEUR">Revendeur</option>
                  <option value="FAMILIAL">Familial</option>
                  <option value="URGENCE">Urgence</option>
                  <option value="EPARGNE_PRODUIT">Épargne-Produit</option>
                </select>
                <button
                  onClick={() => setNouvelleSouscriptionModal(true)}
                  className="px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 flex items-center gap-2 text-sm font-medium shrink-0">
                  <Plus size={16} /> Nouvelle souscription
                </button>
              </>
            )}
            {activeTab === "prospects" && (
              <button onClick={() => setAddClientModal(true)}
                className="px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 flex items-center gap-2 text-sm font-medium">
                <Plus size={16} /> {t("field_add_client")}
              </button>
            )}
          </div>
        </div>

        {/* ── TAB : COLLECTE DU JOUR ── */}
        {activeTab === "collecteJour" && (
          <div className="space-y-5">
            {collecteJourLoading && !collecteJourData ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              </div>
            ) : !collecteJourData?.session ? (
              /* ── Étape 1 : Pas de session ── */
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
                  <h3 className="text-lg font-bold mb-1">Aucune tournée démarrée aujourd&apos;hui</h3>
                  <p className="text-teal-100 text-sm">Démarrez votre session pour commencer les encaissements avec traçabilité GPS.</p>
                </div>
                <div className="p-6">
                  {/* Mini-stats d'aperçu */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-800">{collecteJourData?.stats.totalClients ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-1">Clients</p>
                    </div>
                    <div className="text-center p-4 bg-teal-50 rounded-xl">
                      <p className="text-lg font-bold text-teal-700">
                        {formatCurrency(collecteJourData?.stats.totalACollecter ?? 0)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">À collecter</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-xl">
                      <p className="text-2xl font-bold text-red-600">{collecteJourData?.stats.retardsCritiques ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-1">Retards</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const res = await demarrerSession({});
                      if (res) refetchCollecteJour();
                    }}
                    disabled={demarrantSession}
                    className="w-full py-3.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-200 disabled:opacity-60"
                  >
                    {demarrantSession
                      ? <><Loader2 size={16} className="animate-spin" /> Démarrage…</>
                      : <><PlayCircle size={18} /> Démarrer la tournée du jour</>}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Étape 2 : Session active ── */
              <>
                {/* Barre de progression */}
                {(() => {
                  const s = collecteJourData.session!;
                  const prevu = Number(s.montantPrevu);
                  const collecte = Number(s.montantCollecte);
                  const pct = prevu > 0 ? Math.min(100, Math.round((collecte / prevu) * 100)) : 0;
                  return (
                    <div className="bg-white rounded-2xl border border-teal-200 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-mono text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{s.reference}</span>
                          <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${s.statut === "EN_COURS" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {s.statut === "EN_COURS" ? "En cours" : s.statut === "VALIDEE" ? "Validée" : s.statut}
                          </span>
                        </div>
                        <button onClick={refetchCollecteJour} className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-50">
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                          <p className="text-xs text-slate-500 mb-0.5">Prévu</p>
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(prevu)}</p>
                        </div>
                        <div className="text-center p-3 bg-emerald-50 rounded-xl">
                          <p className="text-xs text-slate-500 mb-0.5">Collecté</p>
                          <p className="text-sm font-bold text-emerald-700">{formatCurrency(collecte)}</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-xl">
                          <p className="text-xs text-slate-500 mb-0.5">Restant</p>
                          <p className="text-sm font-bold text-red-600">{formatCurrency(Math.max(0, prevu - collecte))}</p>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1 text-right">{pct}% collecté</p>
                    </div>
                  );
                })()}

                {/* Liste des clients */}
                <div className="space-y-3">
                  {collecteJourData.clients.length === 0 && (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Aucun client à collecter aujourd&apos;hui</p>
                    </div>
                  )}
                  {collecteJourData.clients.map((client) => {
                    const totalClient = [
                      ...client.souscriptionsPacks.map(s => Number(s.montantRestant)),
                      ...client.creditsClients.map(c => Number(c.soldeRestant)),
                    ].reduce((a, b) => a + b, 0);
                    const hasRetard =
                      client.souscriptionsPacks.some(s => s.echeances[0]?.statut === "EN_RETARD") ||
                      client.creditsClients.some(c => c.echeances[0]?.statut === "EN_RETARD");
                    const isExpanded = expandedClientId === client.id;

                    return (
                      <div key={client.id} className={`bg-white rounded-2xl border ${hasRetard ? "border-red-200" : "border-slate-200"} shadow-sm overflow-hidden`}>
                        {/* Client header */}
                        <button
                          className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                          onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {client.prenom[0]}{client.nom[0]}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{client.prenom} {client.nom}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Phone size={11} />{client.telephone}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {totalClient > 0 ? (
                              <span className={`text-sm font-bold ${hasRetard ? "text-red-600" : "text-teal-700"}`}>
                                {formatCurrency(totalClient)}
                              </span>
                            ) : (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">À jour</span>
                            )}
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </button>

                        {/* Détail expandé */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                            {/* Souscriptions packs */}
                            {client.souscriptionsPacks.map((souscription) => {
                              const prochaine = souscription.echeances[0];
                              const retard = prochaine?.statut === "EN_RETARD";
                              return (
                                <div key={souscription.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl ${retard ? "bg-red-50" : "bg-slate-50"}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${PACK_COLORS[souscription.pack.type].badge}`}>
                                        {PACK_LABELS[souscription.pack.type]}
                                      </span>
                                      <span className="text-xs text-slate-600 truncate">{souscription.pack.nom}</span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      Restant : <span className="font-semibold text-slate-700">{formatCurrency(Number(souscription.montantRestant))}</span>
                                      {prochaine && <span className="ml-1">— Éch. : {formatCurrency(Number(prochaine.montant))} {retard && "⚠"}</span>}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                      href={`/dashboard/user/agentsTerrain/souscriptions/${souscription.id}/lignes`}
                                      className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-xs font-medium flex items-center gap-1 transition-colors"
                                    >
                                      <ClipboardList size={12} /> Produits
                                    </Link>
                                    <button
                                      onClick={() => setEncaisserTarget({
                                        type: "PACK",
                                        souscriptionId: souscription.id,
                                        label: `Pack ${souscription.pack.nom}`,
                                        clientNom: `${client.prenom} ${client.nom}`,
                                        montantAttendu: prochaine ? Number(prochaine.montant) : Number(souscription.montantRestant),
                                      })}
                                      className="px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-xs font-medium flex items-center gap-1"
                                    >
                                      <Banknote size={12} /> Encaisser
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Crédits */}
                            {client.creditsClients.map((credit) => {
                              const prochaine = credit.echeances[0];
                              const retard = prochaine?.statut === "EN_RETARD";
                              return (
                                <div key={credit.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl ${retard ? "bg-red-50" : "bg-blue-50"}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Crédit</span>
                                      <span className="font-mono text-xs text-slate-500 truncate">{credit.reference}</span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      Solde : <span className="font-semibold text-slate-700">{formatCurrency(Number(credit.soldeRestant))}</span>
                                      <span className="ml-1">— {formatCurrency(Number(credit.montantJournalier))}/j {retard && "⚠"}</span>
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setEncaisserTarget({
                                      type: "CREDIT",
                                      creditId: credit.id,
                                      label: `Crédit ${credit.reference}`,
                                      clientNom: `${client.prenom} ${client.nom}`,
                                      montantAttendu: Number(credit.montantJournalier),
                                    })}
                                    className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium flex items-center gap-1"
                                  >
                                    <Wallet size={12} /> Encaisser
                                  </button>
                                </div>
                              );
                            })}

                            {client.souscriptionsPacks.length === 0 && client.creditsClients.length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-2">Aucune dette active</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Résumé lignes collectées */}
                {(collecteJourData.session?.lignes?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600" />
                      <h3 className="font-semibold text-slate-800 text-sm">
                        Encaissements de la session ({collecteJourData.session!.lignes.length})
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {collecteJourData.session!.lignes.map((ligne) => (
                        <div key={ligne.id} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {ligne.client.prenom} {ligne.client.nom}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              ligne.statut === "COLLECTE" ? "bg-emerald-100 text-emerald-700" :
                              ligne.statut === "PARTIEL"  ? "bg-amber-100 text-amber-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>{ligne.statut}</span>
                          </div>
                          <p className="text-sm font-bold text-emerald-700">{formatCurrency(Number(ligne.montantCollecte))}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB : CRÉDITS ── */}
        {activeTab === "credits" && (
          <div className="space-y-5">
            {creditsLoading && !creditsData ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Crédits actifs</p>
                      <p className="text-2xl font-bold text-slate-800">{creditsData?.stats.total ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                      <TrendingDown className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Solde total</p>
                      <p className="text-lg font-bold text-teal-700">{formatCurrency(creditsData?.stats.totalSolde ?? 0)}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-200 flex items-center gap-4">
                    <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">En retard</p>
                      <p className="text-2xl font-bold text-red-600">{creditsData?.stats.enRetard ?? 0}</p>
                    </div>
                  </div>
                </div>

                {/* Liste des crédits */}
                {(creditsData?.credits.length ?? 0) === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                    <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Aucun crédit actif dans votre portefeuille</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {creditsData!.credits.map((credit) => {
                      const prochaine = credit.echeances[0];
                      const retard = credit.statut === "EN_RETARD";
                      const pctRembourse = Number(credit.montantTotal) > 0
                        ? Math.min(100, Math.round((Number(credit.montantRembourse) / Number(credit.montantTotal)) * 100))
                        : 0;
                      return (
                        <div key={credit.id} className={`bg-white rounded-2xl border ${retard ? "border-red-300" : "border-slate-200"} p-5 shadow-sm`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-bold text-slate-800">{credit.client.prenom} {credit.client.nom}</span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Phone size={10} />{credit.client.telephone}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{credit.reference}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${retard ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {retard ? "En retard" : "Actif"}
                                </span>
                              </div>
                              {/* Barre de progression */}
                              <div className="mb-3">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>{formatCurrency(Number(credit.montantRembourse))} remboursé</span>
                                  <span>{formatCurrency(Number(credit.soldeRestant))} restant</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pctRembourse}%` }} />
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{pctRembourse}% remboursé</p>
                              </div>
                              {/* Prochaine échéance */}
                              {prochaine ? (
                                <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${retard ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
                                  {retard ? <AlertCircle size={12} className="text-red-500 shrink-0" /> : <Calendar size={12} className="text-slate-400 shrink-0" />}
                                  <span>
                                    Éch. du {formatDate(prochaine.dateEcheance)} —{" "}
                                    <strong>{formatCurrency(Number(prochaine.montantDu) - Number(prochaine.montantPaye))}</strong>
                                    {retard && <span className="ml-1 font-bold">⚠ EN RETARD</span>}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                                  <CheckCircle size={12} className="shrink-0" />
                                  <span>Échéances à jour</span>
                                </div>
                              )}
                              {/* Derniers remboursements */}
                              {credit.remboursements.length > 0 && (
                                <p className="text-xs text-slate-400 mt-2">
                                  Dernier rembours. : {formatCurrency(Number(credit.remboursements[0].montant))} le {formatDate(credit.remboursements[0].dateRemboursement)}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                              <button
                                onClick={() => setRembourserCredit(credit)}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm"
                              >
                                <Wallet size={15} /> Rembourser
                              </button>
                              <button
                                onClick={() => setFactureCreditId(credit.id)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 text-sm font-medium"
                              >
                                <Receipt size={14} /> Facture
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB : COLLECTE PACKS ── */}
        {activeTab === "packs" && (
          <div className="space-y-3">
            {/* Bannière souscription créée */}
            {createdSouscriptionId && (
              <div className="bg-teal-50 border border-teal-300 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-teal-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-teal-800">Souscription créée — en attente de validation admin</p>
                    <p className="text-xs text-teal-600 mt-0.5">Consultez ou complétez les demandes de produits.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard/user/agentsTerrain/souscriptions/${createdSouscriptionId}/lignes`}
                    className="px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-medium hover:bg-teal-700 flex items-center gap-1">
                    <ClipboardList size={13} /> Voir les produits
                  </Link>
                  <button onClick={() => setCreatedSouscriptionId(null)}
                    className="p-1.5 text-teal-500 hover:text-teal-700"><X size={16} /></button>
                </div>
              </div>
            )}

            {packsLoading && (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              </div>
            )}

            {!packsLoading && souscriptions.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{t('no_active_subscription')}</p>
              </div>
            )}

            {souscriptions.map((s) => {
              const personne = s.client
                ? `${s.client.prenom} ${s.client.nom}`
                : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
              const telephone = s.client?.telephone ?? s.user?.telephone ?? "";
              const prochaine = s.echeances[0];
              const retard = prochaine?.statut === "EN_RETARD";
              const colors = PACK_COLORS[s.pack.type];
              const progression = Number(s.montantTotal) > 0
                ? Math.min(100, Math.round((Number(s.montantVerse) / Number(s.montantTotal)) * 100))
                : 0;

              return (
                <div key={s.id} className={`bg-white rounded-2xl border ${retard ? "border-red-300" : "border-slate-200"} p-5 shadow-sm hover:shadow-md transition-shadow`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Client + pack */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-slate-800">{personne}</span>
                        {telephone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} />{telephone}</span>}
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {PACK_LABELS[s.pack.type]}
                        </span>
                        <span className="text-sm text-slate-600">{s.pack.nom}</span>
                        {s.formuleRevendeur && (
                          <span className="text-xs text-blue-600 font-medium">
                            {s.formuleRevendeur === "FORMULE_1" ? "F1" : "F2"}
                          </span>
                        )}
                        {s.pack.type === "FAMILIAL" && (
                          <span className="text-xs text-purple-600 font-medium">Cycle {s.numeroCycle}</span>
                        )}
                      </div>

                      {/* Barre de progression */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{formatCurrency(Number(s.montantVerse))} {t('paid')}</span>
                          <span>{formatCurrency(Number(s.montantRestant))} {t('remaining_plural')}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progression}%` }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{progression}% {t('paid_status')}</p>
                      </div>

                      {/* Prochaine échéance */}
                      {prochaine ? (
                        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${retard ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
                          {retard ? <AlertCircle size={14} className="text-red-500 shrink-0" /> : <Calendar size={14} className="text-slate-400 shrink-0" />}
                          <span>
                            {t('due_date')} #{prochaine.numero} — <strong>{formatCurrency(Number(prochaine.montant))}</strong>
                            {" "}— {formatDate(prochaine.datePrevue)}
                            {retard && <span className="ml-1 font-bold">⚠ {t('overdue')}</span>}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          <CheckCircle size={14} className="shrink-0" />
                          <span>{t('field_due_up_to_date')}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex flex-col gap-2">
                      <button
                        onClick={() => setCollectTarget(s)}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-colors shadow-sm">
                        <Banknote size={15} /> {t('field_collect')}
                      </button>
                      <Link
                        href={`/dashboard/user/agentsTerrain/souscriptions/${s.id}/lignes`}
                        className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-medium transition-colors text-center justify-center">
                        <ClipboardList size={13} /> Demandes produits
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB : LIVRAISONS PACKS ── */}
        {activeTab === "livraisons" && (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">{t('to_confirm')}</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {livraisonsResponse?.stats.totalPlanifiees ?? 0}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">{t('field_total_delivered')}</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {livraisonsResponse?.stats.totalLivrees ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Livraisons planifiées — à confirmer */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-amber-50 flex items-center gap-2">
                <Truck size={18} className="text-amber-600" />
                <h3 className="font-bold text-slate-800">{t('field_deliveries_to_confirm')}</h3>
                {(livraisonsResponse?.planifiees.length ?? 0) > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {livraisonsResponse!.planifiees.length}
                  </span>
                )}
              </div>

              {livraisonsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
                </div>
              ) : (livraisonsResponse?.planifiees.length ?? 0) === 0 ? (
                <div className="p-12 text-center">
                  <Truck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">{t('field_no_planned_pending_delivery')}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {livraisonsResponse!.planifiees.map((rec) => {
                    const s = rec.souscription;
                    const beneficiaire = s.client
                      ? `${s.client.prenom} ${s.client.nom}`
                      : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
                    const telephone = s.client?.telephone ?? "";
                    const montantTotal = rec.lignes.reduce(
                      (acc, l) => acc + Number(l.prixUnitaire) * l.quantite, 0
                    );
                    const colors = PACK_COLORS[s.pack.type];
                    return (
                      <div key={rec.id} className="p-5 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                                {PACK_LABELS[s.pack.type]}
                              </span>
                              <span className="font-semibold text-slate-800 text-sm">{s.pack.nom}</span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium">{beneficiaire}</p>
                            {telephone && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone size={11} />{telephone}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rec.lignes.map((l) => (
                                <span key={l.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                  {l.produit.nom} × {l.quantite}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">
                              Prévu le {formatDate(rec.datePrevisionnelle)} — {
                                new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(montantTotal)
                              }
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setConfirmingId(rec.id)}
                          disabled={confirmingId === rec.id}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200 shrink-0 disabled:opacity-60"
                        >
                          <CheckCircle size={15} />
                          {confirmingId === rec.id ? "En cours…" : "Confirmer"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historique récent (LIVREE 30j) */}
            {(livraisonsResponse?.livreesRecentes.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50 flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-800">{t('field_recent_confirmed_30d')}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {livraisonsResponse!.livreesRecentes.map((rec) => {
                    const s = rec.souscription;
                    const beneficiaire = s.client
                      ? `${s.client.prenom} ${s.client.nom}`
                      : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
                    const colors = PACK_COLORS[s.pack.type];
                    return (
                      <div key={rec.id} className="px-5 py-3 flex items-center gap-3">
                        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                              {PACK_LABELS[s.pack.type]}
                            </span>
                            <span className="text-sm font-medium text-slate-800 truncate">{s.pack.nom}</span>
                            <span className="text-sm text-slate-500">— {beneficiaire}</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">
                          {rec.dateLivraison ? formatDate(rec.dateLivraison) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB : VENTES TERRAIN ── */}
        {activeTab === "ventes" && (
          <div className="space-y-5">

            {/* En-tête + bouton */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Enregistrez une vente comptant ou soumettez une demande de vente à crédit.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProForma(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-100 text-sm font-medium"
                >
                  <FileText size={15} /> Pro-forma
                </button>
                <button
                  onClick={() => setShowVenteForm(v => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium shadow-lg shadow-teal-200"
                >
                  <Plus size={16} /> Nouvelle vente
                </button>
              </div>
            </div>

            {/* ── Catalogue des produits disponibles (ÉTAPE 3) ── */}
            {produitsDispo.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                  <Package size={16} className="text-teal-600" />
                  <h3 className="font-semibold text-slate-800 text-sm">Catalogue — produits disponibles</h3>
                  <span className="text-xs text-slate-400 ml-auto">Consultation uniquement · Prix fixes</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {produitsDispo.map(item => {
                    const dispo  = item.quantite;
                    const isLow  = dispo > 0 && dispo <= 5;
                    return (
                      <div
                        key={item.produit.id}
                        className={`rounded-xl border p-3 transition-colors ${dispo === 0 ? "border-red-100 bg-red-50/30" : "border-slate-100 hover:border-teal-200 hover:bg-teal-50/20"}`}
                      >
                        <p className="font-semibold text-slate-800 text-sm truncate">{item.produit.nom}</p>
                        {item.produit.unite && <p className="text-xs text-slate-400">{item.produit.unite}</p>}
                        <p className="text-base font-bold text-teal-700 mt-1.5">{formatCurrency(item.produit.prixUnitaire)}</p>
                        <span className={`inline-block mt-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          dispo === 0 ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {dispo === 0 ? "Rupture" : `${dispo} dispo`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Formulaire création vente */}
            {showVenteForm && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-teal-600" />
                    <h3 className="font-bold text-slate-800">Nouvelle vente</h3>
                  </div>
                  <button onClick={() => { setShowVenteForm(false); setVModePaiement("ESPECES"); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmitVente} className="p-5 space-y-4">

                  {/* ── Étape 1 : Choix du mode ── */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Étape 1 — Mode de vente</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => { setVModePaiement("ESPECES"); setVMontantPaye(""); }}
                        className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${vModePaiement !== "CREDIT" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                      >
                        <span className="text-2xl">💵</span>
                        <span>Vente Comptant</span>
                        <span className="text-xs font-normal opacity-70">Payé immédiatement</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVModePaiement("CREDIT"); setVMontantPaye(""); setVClientNom(""); setVClientTel(""); }}
                        className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${vModePaiement === "CREDIT" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                      >
                        <span className="text-2xl">🏦</span>
                        <span>Vente à Crédit</span>
                        <span className="text-xs font-normal opacity-70">Validation RVC requise</span>
                      </button>
                    </div>
                    {vModePaiement === "CREDIT" && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                        La demande sera envoyée au Responsable Crédit. Le stock ne sera pas débité tant que le crédit n&apos;est pas approuvé.
                      </p>
                    )}
                    {vModePaiement !== "CREDIT" && (
                      <div className="flex items-center gap-2 mt-2">
                        <select value={vModePaiement} onChange={e => setVModePaiement(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                          <option value="ESPECES">Espèces</option>
                          <option value="MOBILE_MONEY">Mobile Money</option>
                          <option value="VIREMENT">Virement</option>
                        </select>
                        <span className="text-xs text-slate-400">Précisez le moyen de paiement</span>
                      </div>
                    )}
                  </div>

                  <hr className="border-slate-100" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Étape 2 — Détails de la vente</p>

                  {/* Client */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Client {vModePaiement === "CREDIT" && <span className="text-red-500">* (obligatoire pour un crédit)</span>}
                      </label>
                      <select value={vClientId} onChange={e => { setVClientId(e.target.value); setVClientNom(""); setVClientTel(""); }}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="">— Saisie manuelle —</option>
                        {clientsDispo.map(c => (
                          <option key={c.id} value={c.id}>{c.prenom} {c.nom} ({c.telephone})</option>
                        ))}
                      </select>
                    </div>
                    {/* Afficher info crédit du client sélectionné en mode CRÉDIT */}
                    {vModePaiement === "CREDIT" && vClientId && (() => {
                      const sel = clientsDispo.find(c => String(c.id) === vClientId);
                      if (!sel) return null;
                      const limite = Number(sel.limiteCredit ?? 0);
                      const solde  = Number(sel.soldeActuel  ?? 0);
                      const dispo  = limite - solde;
                      return (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded-lg border ${dispo > 0 ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                            {limite === 0
                              ? "⚠️ Ce client n'a pas de limite de crédit définie."
                              : `Limite : ${limite.toLocaleString("fr-FR")} FCFA — Utilisé : ${solde.toLocaleString("fr-FR")} — Disponible : ${dispo.toLocaleString("fr-FR")} FCFA`}
                          </div>
                          {sel.creditsClients.length > 0 && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Ligne de crédit à utiliser <span className="text-slate-400">(optionnel)</span>
                              </label>
                              <select value={vCreditClientId} onChange={e => setVCreditClientId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                                <option value="">— Aucune ligne spécifique —</option>
                                {sel.creditsClients.map(cc => {
                                  const dispo2 = Number(cc.montantTotal) - Number(cc.montantConsomme);
                                  return (
                                    <option key={cc.id} value={cc.id}>
                                      {cc.reference} · dispo {dispo2.toLocaleString("fr-FR")} FCFA [{cc.statut}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Saisie manuelle uniquement en mode COMPTANT */}
                    {!vClientId && vModePaiement !== "CREDIT" && (
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Nom client" value={vClientNom} onChange={e => setVClientNom(e.target.value)}
                          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        <input placeholder="Téléphone" value={vClientTel} onChange={e => setVClientTel(e.target.value)}
                          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                    )}
                  </div>

                  {/* Produits */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('products')} *</label>
                    <div className="space-y-2">
                      {vLignes.map((l, i) => {
                        const produitSel = produitsDispo.find(p => p.produit.id === Number(l.produitId));
                        return (
                          <div key={i} className="flex gap-2 items-center">
                            <select value={l.produitId}
                              onChange={e => {
                                const p = produitsDispo.find(p => p.produit.id === Number(e.target.value));
                                setVLignes(prev => prev.map((x, j) => j === i ? { ...x, produitId: e.target.value, prixUnitaire: p ? String(p.produit.prixUnitaire) : "" } : x));
                              }}
                              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                              <option value="">Choisir un produit…</option>
                              {produitsDispo.map(p => (
                                <option key={p.produit.id} value={p.produit.id}>
                                  {p.produit.nom} (dispo: {p.quantite})
                                </option>
                              ))}
                            </select>
                            <input type="number" min="1" max={produitSel?.quantite} placeholder="Qté"
                              value={l.quantite} onChange={e => setVLignes(prev => prev.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))}
                              className="w-20 px-2 py-2.5 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            {produitSel && (
                              <span className="w-28 text-center text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-2 py-2.5">
                                {formatCurrency(produitSel.produit.prixUnitaire)}
                              </span>
                            )}
                            {vLignes.length > 1 && (
                              <button type="button" onClick={() => setVLignes(prev => prev.filter((_, j) => j !== i))}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={14} /></button>
                            )}
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => setVLignes(prev => [...prev, { produitId: "", quantite: "", prixUnitaire: "" }])}
                        className="text-xs text-teal-700 hover:underline flex items-center gap-1">
                        <Plus size={12} /> Ajouter un produit
                      </button>
                    </div>
                  </div>

                  {/* Montant payé — comptant uniquement */}
                  {vModePaiement !== "CREDIT" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Montant payé (calculé : <strong>{vMontantCalcule.toLocaleString("fr-FR")} FCFA</strong>)
                      </label>
                      <input type="number" min="0" placeholder={String(vMontantCalcule)}
                        value={vMontantPaye} onChange={e => setVMontantPaye(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  )}
                  {vModePaiement === "CREDIT" && vMontantCalcule > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-amber-700">Montant de la demande de crédit</span>
                      <span className="font-bold text-amber-800 text-base">{vMontantCalcule.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  )}

                  <textarea placeholder="Notes (optionnel)" rows={2} value={vNotes} onChange={e => setVNotes(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowVenteForm(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Annuler</button>
                    <button type="submit" disabled={venteSubmitLoading || vLignes.every(l => !l.produitId)}
                      className={`flex-1 py-2.5 text-white rounded-xl disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2 ${vModePaiement === "CREDIT" ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"}`}>
                      {venteSubmitLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
                        : vModePaiement === "CREDIT"
                          ? <><Send size={14} /> Envoyer au Responsable Crédit</>
                          : <><Send size={14} /> Valider la vente</>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Liste des ventes */}
            {ventesLoading && !ventesRes ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              </div>
            ) : ventesData.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Aucune vente enregistrée pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ventesData.map(v => {
                  const clientNom = v.client
                    ? `${v.client.prenom} ${v.client.nom}`
                    : v.clientNom ?? "Client non précisé";
                  const tel = v.client?.telephone ?? v.clientTelephone;
                  const statutColors: Record<string, string> = {
                    BROUILLON:       "bg-amber-100 text-amber-700",
                    CONFIRMEE:       "bg-blue-100 text-blue-700",
                    SORTIE_VALIDEE:  "bg-violet-100 text-violet-700",
                    LIVREE:          "bg-emerald-100 text-emerald-700",
                    ANNULEE:         "bg-red-100 text-red-700",
                    PAID:            "bg-green-100 text-green-700",
                    CREDIT_REQUEST:  "bg-orange-100 text-orange-700",
                    CREDIT_APPROUVE: "bg-cyan-100 text-cyan-700",
                    CREDIT_REFUSE:   "bg-red-100 text-red-800",
                  };
                  const statutLabels: Record<string, string> = {
                    BROUILLON:       "En attente RPV",
                    CONFIRMEE:       "Approuvée — préparation stock",
                    SORTIE_VALIDEE:  "Stock sorti — à livrer",
                    LIVREE:          "Livrée",
                    ANNULEE:         "Annulée",
                    PAID:            "Payée — stock mis à jour",
                    CREDIT_REQUEST:  "En attente du Responsable Crédit",
                    CREDIT_APPROUVE: "Crédit approuvé",
                    CREDIT_REFUSE:   "Crédit refusé",
                  };
                  return (
                    <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{v.reference}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statutColors[v.statut]}`}>
                              {statutLabels[v.statut]}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800">{clientNom}</p>
                          {tel && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} />{tel}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {v.lignes.map(l => (
                              <span key={l.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                {l.produit.nom} × {l.quantite}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm font-bold text-slate-700 mt-1">
                            {Number(v.montantTotal).toLocaleString("fr-FR")} FCFA — {v.modePaiement}
                          </p>
                        </div>
                        {v.statut === "BROUILLON" && (
                          <button onClick={() => handleCancelVente(v.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 text-xs font-medium shrink-0">
                            <XCircle size={14} /> {t('field_cancel')}
                          </button>
                        )}
                        {v.statut === "CONFIRMEE" && (
                          <span className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-medium shrink-0">
                            <Package size={14} /> {t("field_storekeeper_release_stock")}
                          </span>
                        )}
                        {v.statut === "SORTIE_VALIDEE" && (
                          <button
                            onClick={() => handleLivrerVente(v.id)}
                            disabled={livrerLoading && livrerVenteIdRef.current === v.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white border border-violet-600 rounded-xl hover:bg-violet-700 text-xs font-medium shrink-0 disabled:opacity-60"
                          >
                            {livrerLoading && livrerVenteIdRef.current === v.id
                              ? <><Loader2 size={13} className="animate-spin" /> {t('field_in_progress')}…</>
                              : <><Truck size={13} /> {t('field_confirm_delivery')}</>
                            }
                          </button>
                        )}
                        {v.statut === "LIVREE" && (
                          <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium shrink-0">
                            <CheckCircle size={14} /> {t('field_delivered')}
                          </span>
                        )}
                        {["CONFIRMEE", "SORTIE_VALIDEE", "LIVREE", "PAID"].includes(v.statut) && (
                          <button
                            onClick={() => setFactureVenteId(v.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-xs font-medium shrink-0 transition-colors"
                            title="Générer la facture"
                          >
                            <Receipt size={14} /> Facture
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB : CLIENTS / PROSPECTION ── */}
        {activeTab === "prospects" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_client')}</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_phone')}</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Localisation</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_status')}</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Plafond crédit</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_subscriptions')}</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => {
                    const hasCreditLimit = client.limiteCredit !== null && Number(client.limiteCredit) > 0;
                    const disponible = hasCreditLimit
                      ? Math.max(0, Number(client.limiteCredit) - Number(client.soldeActuel ?? 0))
                      : 0;
                    return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0">
                            {client.prenom?.[0]}{client.nom?.[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{client.prenom} {client.nom}</p>
                            {client.activite && <p className="text-xs text-slate-400">{client.activite}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <Phone size={13} className="inline mr-1 text-slate-400" />{client.telephone}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {[client.quartier, client.ville].filter(Boolean).join(", ") || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(client.etat)}`}>
                          {getStatusLabel(client.etat)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {hasCreditLimit ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-slate-700">{formatCurrency(Number(client.limiteCredit))}</p>
                            <p className={`text-xs ${disponible > 0 ? "text-emerald-600" : "text-red-500"}`}>
                              Dispo : {formatCurrency(disponible)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Non défini</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${(client._count?.souscriptionsPacks ?? 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {client._count?.souscriptionsPacks ?? 0} souscription(s)
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {hasCreditLimit && disponible > 0 && client.etat === "ACTIF" && (
                          <button
                            onClick={() => setNouveauCreditClient(client)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                          >
                            <CreditCard size={12} /> Crédit
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">{t("field_no_client_found")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {clientsMeta && clientsMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">{t('page')} {clientsMeta.page} sur {clientsMeta.totalPages} ({clientsMeta.total} clients)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setClientPage((p) => Math.max(1, p - 1))} disabled={clientPage <= 1}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Précédent</button>
                  <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium text-sm">{clientPage}</span>
                  <button onClick={() => setClientPage((p) => Math.min(clientsMeta.totalPages, p + 1))} disabled={clientPage >= clientsMeta.totalPages}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">{t('field_next')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB : PORTEFEUILLE CRÉDIT ── */}
        {activeTab === "portefeuilleCredit" && (
          <div className="space-y-5">

            {/* En-tête */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Consultez le profil crédit de vos clients et lancez une vente à crédit directement.
              </p>
              <button
                onClick={() => { setActiveTab("ventes"); setShowVenteForm(true); setVModePaiement("CREDIT"); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 text-sm font-medium shadow-lg shadow-amber-200"
              >
                <Plus size={16} /> Nouvelle vente à crédit
              </button>
            </div>

            {/* Stats */}
            {portCreditData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Clients avec crédit", value: String(portCreditData.stats.avecCredit), color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Plafond total", value: formatCurrency(portCreditData.stats.totalPlafond), color: "text-slate-700", bg: "bg-slate-50" },
                  { label: "Engagé", value: formatCurrency(portCreditData.stats.totalEngage), color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Disponible", value: formatCurrency(portCreditData.stats.totalDisponible), color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Alertes (plafond atteint)", value: String(portCreditData.stats.alertes), color: "text-red-600", bg: "bg-red-50" },
                  { label: "Total clients", value: String(portCreditData.stats.totalClients), color: "text-teal-600", bg: "bg-teal-50" },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 border border-slate-100`}>
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Rechercher un client…"
                  value={portCreditSearch}
                  onChange={e => setPortCreditSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {(["tous", "avecCredit", "disponible", "limite_atteinte"] as const).map(f => (
                  <button key={f} onClick={() => setPortCreditFiltre(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${portCreditFiltre === f ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                    {{ tous: "Tous", avecCredit: "Avec crédit", disponible: "Dispo", limite_atteinte: "Limite atteinte" }[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste clients */}
            {portCreditLoading && !portCreditData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-teal-500" size={24} />
              </div>
            ) : (
              <div className="space-y-3">
                {(portCreditData?.clients ?? []).length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 px-6 py-12 text-center text-slate-400 text-sm">
                    Aucun client trouvé pour ce filtre.
                  </div>
                )}
                {(portCreditData?.clients ?? []).map(client => {
                  const isOpen   = portCreditOpen === client.id;
                  const atteinte = client.limiteCredit !== null && client.creditDisponible === 0 && client.soldeActuel > 0;
                  return (
                    <div key={client.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${atteinte ? "border-red-300" : "border-slate-200"}`}>
                      {/* Header carte */}
                      <button
                        className="w-full flex items-center gap-4 px-5 py-4 text-left"
                        onClick={() => setPortCreditOpen(isOpen ? null : client.id)}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${atteinte ? "bg-red-500" : "bg-gradient-to-br from-teal-500 to-emerald-500"}`}>
                          {client.prenom?.[0]}{client.nom?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800">{client.prenom} {client.nom}</p>
                          <p className="text-xs text-slate-400">{client.telephone}</p>
                        </div>
                        {/* Jauges crédit inline */}
                        {client.limiteCredit !== null ? (
                          <div className="hidden sm:flex items-center gap-6 text-xs">
                            <div className="text-center">
                              <p className="text-slate-400">Plafond</p>
                              <p className="font-semibold text-slate-700">{formatCurrency(client.limiteCredit)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Engagé</p>
                              <p className={`font-semibold ${client.soldeActuel > 0 ? "text-amber-600" : "text-slate-400"}`}>{formatCurrency(client.soldeActuel)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Disponible</p>
                              <p className={`font-semibold ${client.creditDisponible > 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(client.creditDisponible)}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="hidden sm:inline text-xs text-slate-300 italic">Pas de limite</span>
                        )}
                        {atteinte && (
                          <span className="shrink-0 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Plafond atteint</span>
                        )}
                        {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                      </button>

                      {/* Détail déplié */}
                      {isOpen && (
                        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                          {/* Jauges mobile */}
                          <div className="sm:hidden grid grid-cols-3 gap-3 text-center text-xs">
                            <div><p className="text-slate-400">Plafond</p><p className="font-bold text-slate-700">{client.limiteCredit !== null ? formatCurrency(client.limiteCredit) : "—"}</p></div>
                            <div><p className="text-slate-400">Engagé</p><p className={`font-bold ${client.soldeActuel > 0 ? "text-amber-600" : "text-slate-400"}`}>{formatCurrency(client.soldeActuel)}</p></div>
                            <div><p className="text-slate-400">Disponible</p><p className={`font-bold ${client.creditDisponible > 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(client.creditDisponible)}</p></div>
                          </div>

                          {/* Barre de progression */}
                          {client.limiteCredit !== null && client.limiteCredit > 0 && (
                            <div>
                              <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Utilisation</span>
                                <span>{Math.round((client.soldeActuel / client.limiteCredit) * 100)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${atteinte ? "bg-red-500" : client.soldeActuel / client.limiteCredit > 0.8 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.min(100, Math.round((client.soldeActuel / client.limiteCredit) * 100))}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Lignes de crédit actives */}
                          {client.creditsActifs.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-2">Lignes de crédit actives</p>
                              <div className="space-y-2">
                                {client.creditsActifs.map(cc => (
                                  <div key={cc.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 text-xs">
                                    <div>
                                      <p className="font-semibold text-slate-700">{cc.reference}</p>
                                      {cc.dateEcheanceFin && (
                                        <p className="text-slate-400">Échéance : {formatDate(cc.dateEcheanceFin)}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-slate-500">Total : <strong>{formatCurrency(cc.montantTotal)}</strong></p>
                                      <p className={`${cc.soldeDisponible > 0 ? "text-emerald-600" : "text-red-500"} font-semibold`}>
                                        Dispo : {formatCurrency(cc.soldeDisponible)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Aucune ligne de crédit formelle active.</p>
                          )}

                          {/* Action */}
                          {client.creditDisponible > 0 && (
                            <button
                              onClick={() => {
                                setActiveTab("ventes");
                                setShowVenteForm(true);
                                setVModePaiement("CREDIT");
                                setVClientId(String(client.id));
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 text-xs font-semibold"
                            >
                              <ShoppingCart size={13} /> Créer une vente à crédit pour ce client
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal collecte packs (ancien onglet) */}
      {collectTarget && (
        <ModalCollecte
          souscription={collectTarget}
          onClose={() => setCollectTarget(null)}
          onSuccess={() => { refetchPacks(); setCollectTarget(null); }}
        />
      )}

      {/* Modal encaisser session */}
      {encaisserTarget && collecteJourData?.session && (
        <ModalEncaisserSession
          target={encaisserTarget}
          collecteId={collecteJourData.session.id}
          onClose={() => setEncaisserTarget(null)}
          onSuccess={() => { refetchCollecteJour(); setEncaisserTarget(null); }}
        />
      )}

      {/* Modal remboursement crédit standalone */}
      {rembourserCredit && (
        <ModalRembourserCredit
          credit={rembourserCredit}
          onClose={() => setRembourserCredit(null)}
          onSuccess={() => { refetchCredits(); setRembourserCredit(null); }}
        />
      )}

      {/* Modal ajout client enrichi */}
      {addClientModal && (
        <ModalAddClientRiche
          onClose={() => setAddClientModal(false)}
          onSuccess={() => { refetchClients(); setAddClientModal(false); }}
        />
      )}

      {/* Modal nouvelle souscription */}
      {nouvelleSouscriptionModal && (
        <ModalNouvelleSouscription
          clients={clients}
          onClose={() => setNouvelleSouscriptionModal(false)}
          onSuccess={(id) => {
            setNouvelleSouscriptionModal(false);
            setCreatedSouscriptionId(id);
            refetchPacks();
          }}
        />
      )}

      {/* Modal nouveau crédit */}
      {nouveauCreditClient && (
        <ModalNouveauCredit
          client={nouveauCreditClient}
          onClose={() => setNouveauCreditClient(null)}
          onSuccess={() => { refetchCredits(); refetchClients(); setNouveauCreditClient(null); }}
        />
      )}
    </div>
  );
}

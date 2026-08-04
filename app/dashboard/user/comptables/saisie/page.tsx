"use client";

// Rubrique "Saisie comptable" → sous-page "Écritures" (clé d'accès "saisie").
// Extrait du bloc activeTab === "saisie" du monolithe (liste + filtres + bloc de
// synchronisation automatique) ; la partie formulaire de création a été déplacée
// vers /saisie/nouvelle pour correspondre au sous-item CDC dédié.
//
// Ajout CDC : le statut A_CONTROLER ("à valider") existe dans l'enum Prisma
// StatutEcriture mais n'était pas exposé comme filtre séparé dans l'ancien
// onglet — on l'ajoute ici avec CLOTURE, en plus de BROUILLON/VALIDE.
// CDC §13 : pas de statut "ANNULE" — une écriture validée ne s'annule jamais
// directement, seule la contrepassation (bouton dédié) est autorisée.

import { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Edit2, PlusCircle, Download, ChevronLeft, ChevronRight,
  RefreshCw, Wallet, TrendingUp, Package, BadgeCheck, Trash2,
  Paperclip, Upload, ExternalLink, X, Printer,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { exportToXlsx } from "@/lib/exportXlsx";
import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

const UploadButton = generateUploadButton<OurFileRouter>();

// ── Types ──────────────────────────────────────────────────────────────────

interface LigneEcritureData {
  id: number; compteId: number; libelle: string;
  debit: number; credit: number; isTva: boolean;
  tauxTva: number | null; montantTva: number | null;
  compte: {
    id: number; numero: string; libelle: string; type: string;
    tiersType: string | null; tiersNom: string | null;
    client: { nom: string; prenom: string } | null;
    fournisseur: { nom: string } | null;
  };
}

function nomTiers(compte: LigneEcritureData["compte"]): string | null {
  if (compte.client) return `${compte.client.prenom} ${compte.client.nom}`;
  if (compte.fournisseur) return compte.fournisseur.nom;
  return compte.tiersNom;
}
interface EcritureComptable {
  id: number; reference: string; date: string; libelle: string;
  journal: string; statut: string; notes: string | null;
  dateValidation: string | null;
  user?: { id: number; nom: string; prenom: string };
  validePar?: { id: number; nom: string; prenom: string } | null;
  lignes: LigneEcritureData[];
}
interface EcrituresResponse {
  data: EcritureComptable[];
  totaux: { debit: number; credit: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface SyncApercu {
  caisse:          { total: number; dejaSyncees: number; aSyncer: number };
  ventes:          { total: number; dejaSyncees: number; aSyncer: number };
  ventes_directes: { total: number; dejaSyncees: number; aSyncer: number };
  achats:          { total: number; dejaSyncees: number; aSyncer: number };
}
interface SyncApercuResponse { apercu: SyncApercu }

interface PieceEntry {
  id: number; nom: string; url: string; uploadthingKey: string; type: string; taille: number;
  nature: string; sourceType: string; sourceId: number; description: string | null; archiverJusquau: string;
  createdAt: string; uploadeUser: { nom: string; prenom: string };
}
interface PiecesResponse { success: boolean; data: PieceEntry[] }

// CDC §14 — nature du document (distincte du type MIME du fichier).
const NATURE_DOCUMENT_LABELS: Record<string, string> = {
  FACTURE: "Facture", RECU: "Reçu", BON_COMMANDE: "Bon de commande",
  BON_LIVRAISON: "Bon de livraison", CONTRAT: "Contrat", RELEVE_BANCAIRE: "Relevé bancaire",
  PIECE_CAISSE: "Pièce de caisse", DOCUMENT_FISCAL: "Document fiscal", AUTRE: "Autre",
};

function formatTaille(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  if (octets >= 1024)        return `${Math.round(octets / 1024)} Ko`;
  return `${octets} o`;
}

const JOURNAL_LABELS: Record<string, string> = {
  CAISSE: "Caisse", BANQUE: "Banque", VENTES: "Ventes",
  ACHATS: "Achats", OD: "Opérations diverses", PAIE: "Paie",
};

const STATUT_ECRITURE_COLORS: Record<string, string> = {
  BROUILLON:   "bg-amber-50 text-amber-700 border-amber-200",
  A_CONTROLER: "bg-blue-50 text-blue-700 border-blue-200",
  VALIDE:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOTURE:     "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUT_FILTRE_OPTIONS = [
  { value: "",            label: "Tous statuts" },
  { value: "BROUILLON",   label: "Brouillon" },
  { value: "A_CONTROLER", label: "À valider" },
  { value: "VALIDE",      label: "Validé" },
  { value: "CLOTURE",     label: "Clôturé" },
];

export default function SaisieEcrituresPage() {
  // ── État filtres écritures ───────────────────────────────────────────
  const [ecrituresPage, setEcrituresPage]       = useState(1);
  const [ecrituresJournal, setEcrituresJournal] = useState("");
  const [ecrituresStatut, setEcrituresStatut]   = useState("");
  const [ecrituresDateMin, setEcrituresDateMin] = useState("");
  const [ecrituresDateMax, setEcrituresDateMax] = useState("");

  const ecrituresUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(ecrituresPage), limit: "30" });
    if (ecrituresJournal) p.set("journal", ecrituresJournal);
    if (ecrituresStatut)  p.set("statut",  ecrituresStatut);
    if (ecrituresDateMin) p.set("dateMin", ecrituresDateMin);
    if (ecrituresDateMax) p.set("dateMax", ecrituresDateMax);
    return `/api/comptable/ecritures?${p.toString()}`;
  }, [ecrituresPage, ecrituresJournal, ecrituresStatut, ecrituresDateMin, ecrituresDateMax]);

  const { data: ecrituresData, loading: ecrituresLoading, refetch: refetchEcritures } =
    useApi<EcrituresResponse>(ecrituresUrl);

  // Ref pour les mutations dynamiques écriture (pattern useMutation)
  const ecritureActionIdRef = useRef<number | null>(null);
  const { mutate: validerEcriture } = useMutation<unknown, object>(
    () => `/api/comptable/ecritures/${ecritureActionIdRef.current}`, "PUT",
    { successMessage: "Écriture validée" }
  );
  const { mutate: supprimerEcriture } = useMutation<unknown, object>(
    () => `/api/comptable/ecritures/${ecritureActionIdRef.current}`, "DELETE",
    { successMessage: "Écriture supprimée" }
  );
  const { mutate: contrepasserEcritureApi } = useMutation<unknown, object>(
    () => `/api/comptable/ecritures/${ecritureActionIdRef.current}/contrepasser`, "POST",
    { successMessage: "Écriture contrepassée" }
  );

  // ── Pièces justificatives (CDC §10 — "Pièce justificative" est un champ de
  // l'écriture elle-même, pas seulement des sources opérationnelles) ────────
  const [piecesModal, setPiecesModal] = useState<{ ecritureId: number; libelle: string } | null>(null);
  const [piecesLocalList, setPiecesLocalList] = useState<PieceEntry[]>([]);
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [piecesSuppLoading, setPiecesSuppLoading] = useState<number | null>(null);
  const [pieceNatureChoisie, setPieceNatureChoisie] = useState("AUTRE");

  const fetchPiecesModal = useCallback(async (ecritureId: number) => {
    setPiecesLoading(true);
    try {
      const res = await fetch(`/api/comptable/pieces?sourceType=ECRITURE_COMPTABLE&sourceId=${ecritureId}`);
      const json: PiecesResponse = await res.json();
      setPiecesLocalList(json.data ?? []);
    } catch {
      setPiecesLocalList([]);
    } finally {
      setPiecesLoading(false);
    }
  }, []);

  function openPiecesModal(ecritureId: number, libelle: string) {
    setPiecesModal({ ecritureId, libelle });
    fetchPiecesModal(ecritureId);
  }

  async function supprimerPiece(pieceId: number) {
    setPiecesSuppLoading(pieceId);
    try {
      await fetch(`/api/comptable/pieces/${pieceId}`, { method: "DELETE" });
      setPiecesLocalList((prev) => prev.filter((p) => p.id !== pieceId));
    } finally {
      setPiecesSuppLoading(null);
    }
  }

  async function handleValider(id: number) {
    ecritureActionIdRef.current = id;
    const res = await validerEcriture({ statut: "VALIDE" });
    if (res) refetchEcritures();
  }
  async function handleSupprimerEcriture(id: number) {
    ecritureActionIdRef.current = id;
    const res = await supprimerEcriture({});
    if (res) refetchEcritures();
  }
  async function handleContrepasserEcriture(id: number) {
    ecritureActionIdRef.current = id;
    const res = await contrepasserEcritureApi({});
    if (res) refetchEcritures();
  }

  // ── Synchronisation automatique des journaux ─────────────────────────
  const [syncDateMin, setSyncDateMin] = useState("");
  const [syncDateMax, setSyncDateMax] = useState("");
  const [syncResult, setSyncResult]   = useState<{ message: string; resultats: Record<string, { created: number; skipped: number }> } | null>(null);
  const [syncing, setSyncing]         = useState<string | null>(null);

  const { data: syncApercuData, refetch: refetchSyncApercu } =
    useApi<SyncApercuResponse>("/api/comptable/sync-journals");

  async function handleSync(action: string) {
    setSyncing(action);
    setSyncResult(null);
    try {
      const res = await fetch("/api/comptable/sync-journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dateMin: syncDateMin || undefined, dateMax: syncDateMax || undefined }),
      });
      const json = await res.json();
      if (res.ok) {
        setSyncResult(json);
        refetchEcritures();
        refetchSyncApercu();
      } else {
        setSyncResult({ message: json.error ?? "Erreur", resultats: {} });
      }
    } finally {
      setSyncing(null);
    }
  }

  return (
    <>
    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">Saisie comptable — Écritures</h1>
        {AIDE_COMPTABLE.saisie && <AideComptable contenu={AIDE_COMPTABLE.saisie} />}
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit2 className="text-violet-600" size={20} /> Écritures comptables
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Double entrée · {ecrituresData?.meta.total ?? "…"} écritures</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-slate-500">Total débit :</span>
            <span className="text-blue-700">{formatCurrency(Number(ecrituresData?.totaux.debit ?? 0))}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">crédit :</span>
            <span className="text-emerald-700">{formatCurrency(Number(ecrituresData?.totaux.credit ?? 0))}</span>
          </div>
          <Link href="/dashboard/user/comptables/saisie/nouvelle"
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
            <PlusCircle size={15} /> Nouvelle écriture
          </Link>
        </div>
      </div>

      {/* Bloc synchronisation automatique */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-5 border border-indigo-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={18} className="text-indigo-600" />
          <h4 className="font-bold text-indigo-900">Alimentation automatique des journaux</h4>
        </div>
        <p className="text-xs text-indigo-700 mb-4">
          Importe les opérations des modules (Caisse, Ventes, Achats) et génère les écritures SYSCOHADA en double entrée.
          Les doublons sont automatiquement ignorés. Les écritures créées sont en <strong>brouillon</strong> — vous devez les valider.
        </p>

        {syncApercuData?.apercu && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { key: "caisse",          label: "Journal Caisse",        color: "bg-amber-100 text-amber-800 border-amber-200" },
              { key: "ventes",          label: "Journal Ventes (packs)", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
              { key: "ventes_directes", label: "Ventes directes",        color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
              { key: "achats",          label: "Journal Achats",         color: "bg-blue-100 text-blue-800 border-blue-200" },
            ].map((j) => {
              const stat = syncApercuData.apercu[j.key as keyof SyncApercu];
              return (
                <div key={j.key} className={`rounded-xl p-3 border ${j.color}`}>
                  <p className="text-xs font-semibold">{j.label}</p>
                  <p className="text-xl font-bold mt-0.5">{stat.aSyncer}</p>
                  <p className="text-xs opacity-70">opérations à importer</p>
                  <p className="text-xs opacity-60 mt-0.5">{stat.dejaSyncees} déjà importées</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-indigo-700 font-medium">Du</label>
            <input type="date" value={syncDateMin} onChange={(e) => setSyncDateMin(e.target.value)}
              className="px-3 py-1.5 border border-indigo-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-indigo-700 font-medium">Au</label>
            <input type="date" value={syncDateMax} onChange={(e) => setSyncDateMax(e.target.value)}
              className="px-3 py-1.5 border border-indigo-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { action: "caisse", label: "Caisse", icon: Wallet,    color: "bg-amber-500 hover:bg-amber-600" },
            { action: "ventes", label: "Ventes", icon: TrendingUp,color: "bg-emerald-600 hover:bg-emerald-700" },
            { action: "achats", label: "Achats", icon: Package,   color: "bg-blue-600 hover:bg-blue-700" },
            { action: "all",    label: "Tout synchroniser", icon: RefreshCw, color: "bg-indigo-600 hover:bg-indigo-700" },
          ].map(({ action, label, icon: Icon, color }) => (
            <button
              key={action}
              onClick={() => handleSync(action)}
              disabled={!!syncing}
              className={`flex items-center gap-2 px-4 py-2 ${color} text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors`}
            >
              {syncing === action
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>

        {syncResult && (
          <div className={`mt-3 rounded-xl p-3 text-sm ${syncResult.resultats && Object.keys(syncResult.resultats).length > 0 ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            <p className="font-semibold">{syncResult.message}</p>
            {syncResult.resultats && Object.entries(syncResult.resultats).map(([k, v]) => (
              <p key={k} className="text-xs mt-1">
                <strong>{k.charAt(0).toUpperCase() + k.slice(1)} :</strong> {v.created} créée(s) · {v.skipped} ignorée(s)
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Filtres écritures */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex gap-3 flex-wrap print:hidden">
        <select value={ecrituresJournal} onChange={(e) => { setEcrituresJournal(e.target.value); setEcrituresPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">Tous les journaux</option>
          {Object.entries(JOURNAL_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={ecrituresStatut} onChange={(e) => { setEcrituresStatut(e.target.value); setEcrituresPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          {STATUT_FILTRE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={ecrituresDateMin} onChange={(e) => { setEcrituresDateMin(e.target.value); setEcrituresPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Du" />
        <input type="date" value={ecrituresDateMax} onChange={(e) => { setEcrituresDateMax(e.target.value); setEcrituresPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Au" />
        <button onClick={() => exportToXlsx(ecrituresData?.data?.flatMap(e => e.lignes.map(l => ({ ref: e.reference, date: e.date.slice(0,10), journal: e.journal, libelle: l.libelle, compte: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }))) ?? [], [{ label: "Référence", key: "ref" }, { label: "Date", key: "date" }, { label: "Journal", key: "journal" }, { label: "Libellé", key: "libelle" }, { label: "Compte", key: "compte" }, { label: "Débit", key: "debit", type: "currency" }, { label: "Crédit", key: "credit", type: "currency" }], "ecritures.xlsx", { sheetName: "Écritures" })}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
          <Download size={14} /> CSV
        </button>
        {/* CDC §35 — "possibilité d'imprimer le journal par période" : imprime
            la liste actuellement filtrée (journal + période déjà sélectionnés
            ci-dessus), écritures et boutons d'action masqués via print:hidden. */}
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
          <Printer size={14} /> Imprimer
        </button>
      </div>

      {/* Liste écritures */}
      <div className="space-y-3">
        {ecrituresLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : (ecrituresData?.data ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/60 shadow-sm">
            <Edit2 size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400">Aucune écriture. Saisissez votre première écriture.</p>
          </div>
        ) : (
          (ecrituresData?.data ?? []).map((e) => {
            const totalD = e.lignes.reduce((s, l) => s + Number(l.debit), 0);
            return (
              <div key={e.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-bold text-violet-700">{e.reference}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUT_ECRITURE_COLORS[e.statut] ?? "bg-slate-100 text-slate-600"}`}>{e.statut}</span>
                    <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full">{JOURNAL_LABELS[e.journal] ?? e.journal}</span>
                    <span className="text-xs text-slate-400">{formatDateShort(e.date)}</span>
                    {e.user && <span className="text-xs text-slate-400" title="Saisie par">{e.user.prenom} {e.user.nom}</span>}
                    {e.validePar && e.dateValidation && (
                      <span className="text-xs text-emerald-600" title="Validée par">
                        ✓ {e.validePar.prenom} {e.validePar.nom} le {formatDateShort(e.dateValidation)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 print:hidden">
                    <button onClick={() => openPiecesModal(e.id, e.libelle)}
                      title="Pièces justificatives"
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                      <Paperclip size={14} />
                    </button>
                    {e.statut === "BROUILLON" && (
                      <>
                        <button onClick={() => handleValider(e.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                          <BadgeCheck size={13} /> Valider
                        </button>
                        <button onClick={() => handleSupprimerEcriture(e.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </>
                    )}
                    {e.statut === "VALIDE" && (
                      // CDC §13 — une écriture validée ne se modifie/annule jamais
                      // directement : seule la contrepassation (écriture inverse
                      // automatique, originale intacte) est autorisée.
                      <button onClick={() => handleContrepasserEcriture(e.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-violet-200 text-violet-600 rounded-lg text-xs font-semibold hover:bg-violet-50"
                        title="Génère l'écriture inverse — l'originale reste intacte">
                        <RefreshCw size={13} /> Contrepasser
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-5 py-2 border-b border-slate-100">
                  <p className="text-sm text-slate-700 font-medium">{e.libelle}</p>
                  {e.notes && <p className="text-xs text-slate-400 italic">{e.notes}</p>}
                </div>
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>
                      <th className="text-left px-5 py-1.5 font-semibold text-slate-500">Compte</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Tiers</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Libellé</th>
                      <th className="text-right px-5 py-1.5 font-semibold text-blue-600">Débit</th>
                      <th className="text-right px-5 py-1.5 font-semibold text-emerald-600">Crédit</th>
                      <th className="text-center px-3 py-1.5 font-semibold text-slate-400">TVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {e.lignes.map((l) => (
                      <tr key={l.id} className={`hover:bg-slate-50 ${l.isTva ? "bg-amber-50/40" : ""}`}>
                        <td className="px-5 py-1.5 font-mono text-slate-700">{l.compte.numero} <span className="text-slate-400 font-sans">{l.compte.libelle}</span></td>
                        <td className="px-3 py-1.5 text-slate-500">{nomTiers(l.compte) ?? "—"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{l.libelle}</td>
                        <td className="px-5 py-1.5 text-right font-medium text-blue-700">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : ""}</td>
                        <td className="px-5 py-1.5 text-right font-medium text-emerald-700">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : ""}</td>
                        <td className="px-3 py-1.5 text-center">{l.isTva && <span className="text-amber-600 font-semibold">TVA {l.tauxTva}%</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-5 py-1.5 font-bold text-slate-600 text-xs">Total</td>
                      <td className="px-5 py-1.5 text-right font-bold text-blue-700">{formatCurrency(totalD)}</td>
                      <td className="px-5 py-1.5 text-right font-bold text-emerald-700">{formatCurrency(e.lignes.reduce((s, l) => s + Number(l.credit), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination écritures */}
      {ecrituresData && ecrituresData.meta.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-200/60">
          <span className="text-xs text-slate-500">Page {ecrituresPage}/{ecrituresData.meta.totalPages} · {ecrituresData.meta.total} écritures</span>
          <div className="flex gap-2">
            <button onClick={() => setEcrituresPage(p => Math.max(1, p - 1))} disabled={ecrituresPage === 1}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button>
            <button onClick={() => setEcrituresPage(p => Math.min(ecrituresData.meta.totalPages, p + 1))} disabled={ecrituresPage === ecrituresData.meta.totalPages}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </main>

    {/* Modal pièces justificatives */}
    {piecesModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
              <Paperclip size={18} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-sm">Pièces justificatives</h3>
              <p className="text-xs text-slate-400 truncate">{piecesModal.libelle}</p>
            </div>
            <button onClick={() => setPiecesModal(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
            {piecesLoading ? (
              <div className="py-6 text-center"><div className="w-7 h-7 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
            ) : piecesLocalList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                Aucune pièce jointe pour cette écriture
              </div>
            ) : (
              piecesLocalList.map((piece) => (
                <div key={piece.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                    {piece.type.includes("pdf") ? "📄" : "🖼️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{piece.nom}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded-full font-medium">{NATURE_DOCUMENT_LABELS[piece.nature] ?? piece.nature}</span>
                      {formatTaille(piece.taille)} · {piece.uploadeUser.prenom} {piece.uploadeUser.nom} · {formatDateShort(piece.createdAt)}
                    </p>
                    {piece.description && <p className="text-xs text-slate-500 italic mt-0.5">{piece.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={piece.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Ouvrir">
                      <ExternalLink size={15} />
                    </a>
                    <button onClick={() => supprimerPiece(piece.id)}
                      disabled={piecesSuppLoading === piece.id}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-40" title="Supprimer">
                      {piecesSuppLoading === piece.id
                        ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Upload size={12} />Ajouter un document (PDF, image ou Excel, max 16 Mo)
            </p>
            <select value={pieceNatureChoisie} onChange={(e) => setPieceNatureChoisie(e.target.value)}
              className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {Object.entries(NATURE_DOCUMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <UploadButton
              endpoint="justificatif"
              onClientUploadComplete={async (res) => {
                for (const file of res) {
                  await fetch("/api/comptable/pieces", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({
                      sourceType:     "ECRITURE_COMPTABLE",
                      sourceId:       piecesModal.ecritureId,
                      nom:            file.name,
                      url:            file.url,
                      uploadthingKey: file.key,
                      type:           file.type ?? "application/octet-stream",
                      taille:         file.size,
                      nature:         pieceNatureChoisie,
                    }),
                  });
                }
                fetchPiecesModal(piecesModal.ecritureId);
              }}
              onUploadError={(err) => console.error("Upload error:", err)}
              appearance={{
                button: "bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors",
                allowedContent: "text-slate-400 text-xs mt-1",
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
}

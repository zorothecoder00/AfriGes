"use client";

// Rubrique "Journaux" (clé d'accès "journal").
// Extrait du bloc activeTab === "journal" du monolithe : vue chronologique des
// flux métier (caisse/ventes/achats/paie...), API /api/comptable/journal
// (+ /api/comptable/journal/valider pour la validation ligne à ligne).
//
// La modale "Pièces justificatives" (avec upload uploadthing) est conservée ici
// car son seul point d'entrée d'origine dans le monolithe était l'icône PJ de
// cette table (le bloc "pieces" séparé — archive globale — n'ouvrait jamais
// cette modale lui-même).
//
// Ajout CDC : la vue "Vue journal" liste maintenant les 10 journaux builtin du
// CDC §9 (CAISSE, BANQUE, VENTES, ACHATS, OD, PAIE, IMMOBILISATIONS, CLOTURE,
// OUVERTURE, REGULARISATION) ainsi que les journaux additionnels actifs
// (/api/comptable/journaux — l'administrateur peut en créer d'autres, CDC §9).
// IMMOBILISATIONS/CLOTURE/OUVERTURE/REGULARISATION et les journaux
// additionnels ne correspondent à aucune "source" métier suivie par
// /api/comptable/journal (qui reflète des événements opérationnels — caisse,
// ventes, achats, paie — pas les journaux comptables au sens strict) : cliquer
// dessus affiche donc une liste vide accompagnée d'une note explicative plutôt
// que de renvoyer des données non pertinentes.

import { useState, useEffect, useMemo, useCallback, type ElementType } from "react";
import {
  Search, X, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  PlusCircle, Save, CheckCircle, AlertCircle, Filter, Plus,
  BookOpen, Wallet, Calendar, TrendingUp, Package, ShoppingBag, BadgeCheck, Users,
  Paperclip, Upload, ExternalLink, Trash2,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort, formatDateTime } from "@/lib/format";
import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { useT } from "@/contexts/AppSettingsContext";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

const UploadButton = generateUploadButton<OurFileRouter>();

// ── Types ──────────────────────────────────────────────────────────────────

interface JournalEntry {
  id:              string;
  sourceId:        number;
  date:            string;
  type:            "ENCAISSEMENT" | "DECAISSEMENT";
  categorie:       string;
  libelle:         string;
  montant:         number;
  reference:       string;
  valide?:         boolean;
  valideParNom?:   string;
  dateValidation?: string;
}
interface JournalResponse {
  success: boolean;
  data: JournalEntry[];
  totaux: { encaissements: number; decaissements: number; activite: number; net: number };
  meta: { total: number; page: number; limit: number; totalPages: number; dateDebut: string; dateFin: string };
}
interface JournalComptableEntry {
  id: number | null; code: string; libelle: string; prefixe: string | null; actif: boolean; builtin: boolean;
}
interface LigneEcritureForm {
  compteId: number | ""; libelle: string; debit: string; credit: string;
  isTva: boolean; tauxTva: string; montantTva: string;
}
interface PieceEntry {
  id: number; nom: string; url: string; uploadthingKey: string; type: string; taille: number;
  nature: string; sourceType: string; sourceId: number; description: string | null; archiverJusquau: string;
  createdAt: string; uploadeUser: { nom: string; prenom: string };
}

// CDC §14 — nature du document (distincte du type MIME du fichier).
const NATURE_DOCUMENT_LABELS: Record<string, string> = {
  FACTURE: "Facture", RECU: "Reçu", BON_COMMANDE: "Bon de commande",
  BON_LIVRAISON: "Bon de livraison", CONTRAT: "Contrat", RELEVE_BANCAIRE: "Relevé bancaire",
  PIECE_CAISSE: "Pièce de caisse", DOCUMENT_FISCAL: "Document fiscal", AUTRE: "Autre",
};
interface PiecesResponse { success: boolean; data: PieceEntry[] }

function parseJournalSource(entryId: string): { sourceType: string; sourceId: number } | null {
  if (entryId.startsWith("VER-"))       return { sourceType: "VERSEMENT_PACK",   sourceId: Number(entryId.replace("VER-", "")) };
  if (entryId.startsWith("APPRO-"))     return { sourceType: "MOUVEMENT_STOCK",   sourceId: Number(entryId.replace("APPRO-", "")) };
  if (entryId.startsWith("OPC-ENC-"))   return { sourceType: "OPERATION_CAISSE",  sourceId: Number(entryId.replace("OPC-ENC-", "")) };
  if (entryId.startsWith("OPC-DEC-"))   return { sourceType: "OPERATION_CAISSE",  sourceId: Number(entryId.replace("OPC-DEC-", "")) };
  if (entryId.startsWith("VD-"))        return { sourceType: "VENTE_DIRECTE",      sourceId: Number(entryId.replace("VD-", "")) };
  if (entryId.startsWith("REMB-CREDIT-")) return { sourceType: "REMBOURSEMENT_CREDIT", sourceId: Number(entryId.replace("REMB-CREDIT-", "")) };
  return null;
}

function formatTaille(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  if (octets >= 1024)        return `${Math.round(octets / 1024)} Ko`;
  return `${octets} o`;
}

const CAT_META: Record<string, { label: string; color: string; bg: string; icon: ElementType }> = {
  COTISATION_INITIALE:  { label: "Acompte initial",        color: "text-blue-600",    bg: "bg-blue-100",    icon: Calendar },
  VERSEMENT_PERIODIQUE: { label: "Versement périodique",   color: "text-emerald-600", bg: "bg-emerald-100", icon: TrendingUp },
  REMBOURSEMENT:        { label: "Remboursement",          color: "text-teal-600",    bg: "bg-teal-100",    icon: CheckCircle },
  VERSEMENT_PACK:       { label: "Bonus / Ajustement",     color: "text-violet-600",  bg: "bg-violet-100",  icon: BookOpen },
  APPROVISIONNEMENT:    { label: "Approvisionnement",      color: "text-orange-600",  bg: "bg-orange-100",  icon: Package },
  CAISSE_ENCAISSEMENT:  { label: "Encaissement caisse",    color: "text-cyan-600",    bg: "bg-cyan-100",    icon: Wallet },
  VENTE_DIRECTE:        { label: "Vente directe",          color: "text-indigo-600",  bg: "bg-indigo-100",  icon: ShoppingBag },
  REMBOURSEMENT_CREDIT: { label: "Remb. crédit client",    color: "text-green-600",   bg: "bg-green-100",   icon: BadgeCheck },
  SALAIRE:              { label: "Salaire",                color: "text-red-600",     bg: "bg-red-100",     icon: Users },
  AVANCE:               { label: "Avance",                 color: "text-rose-600",    bg: "bg-rose-100",    icon: ArrowDownRight },
  FOURNISSEUR:          { label: "Fournisseur",            color: "text-amber-600",   bg: "bg-amber-100",   icon: Package },
  CAISSE_AUTRE:         { label: "Autre décaissement",     color: "text-slate-600",   bg: "bg-slate-100",   icon: Filter },
};

const SANS_OPERATION_CAT = "__AUCUNE_OPERATION__";

const JOURNAL_VIEWS_BUILTIN = [
  { key: "TOUT",   label: "Tout le journal",     type: "TOUS",         cat: "",               source: "" },
  { key: "CAISSE", label: "Journal de Caisse",   type: "TOUS",         cat: "",               source: "caisse" },
  { key: "BANQUE", label: "Journal de Banque",   type: "ENCAISSEMENT", cat: "CAISSE_ENCAISSEMENT", source: "caisse" },
  { key: "VENTES", label: "Journal des Ventes",  type: "ENCAISSEMENT", cat: "",               source: "ventes" },
  { key: "ACHATS", label: "Journal des Achats",  type: "DECAISSEMENT", cat: "APPROVISIONNEMENT", source: "achats" },
  { key: "OD",     label: "Journal OD",          type: "TOUS",         cat: "VERSEMENT_PACK", source: "" },
  { key: "PAIE",   label: "Journal de Paie",     type: "DECAISSEMENT", cat: "SALAIRE",        source: "paie" },
  { key: "IMMOBILISATIONS", label: "Journal des Immobilisations", type: "TOUS", cat: SANS_OPERATION_CAT, source: "" },
  { key: "CLOTURE",         label: "Journal de Clôture",           type: "TOUS", cat: SANS_OPERATION_CAT, source: "" },
  { key: "OUVERTURE",       label: "Journal d'Ouverture",          type: "TOUS", cat: SANS_OPERATION_CAT, source: "" },
  { key: "REGULARISATION",  label: "Journal de Régularisation",    type: "TOUS", cat: SANS_OPERATION_CAT, source: "" },
];

export default function JournauxPage() {
  const t = useT();

  const { data: journauxData } = useApi<{ data: JournalComptableEntry[] }>("/api/comptable/journaux");

  const dynamicViews = useMemo(
    () => (journauxData?.data ?? [])
      .filter((j) => !j.builtin && j.actif)
      .map((j) => ({ key: j.code, label: j.libelle, type: "TOUS", cat: SANS_OPERATION_CAT, source: "" })),
    [journauxData]
  );
  const JOURNAL_VIEWS = useMemo(() => [...JOURNAL_VIEWS_BUILTIN, ...dynamicViews], [dynamicViews]);

  // ── État filtres journal ─────────────────────────────────────────────
  const [journalPage, setJournalPage]           = useState(1);
  const [journalType, setJournalType]           = useState("TOUS");
  const [journalCategorie, setJournalCategorie] = useState("");
  const [journalSearch, setJournalSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch]   = useState("");
  const [journalDateDebut, setJournalDateDebut] = useState("");
  const [journalDateFin, setJournalDateFin]     = useState("");
  const [journalView, setJournalView]           = useState("TOUT");
  const [journalSource, setJournalSource]       = useState("");
  const [showJournalOD, setShowJournalOD]       = useState(false);
  const [journalODForm, setJournalODForm]       = useState({
    date: new Date().toISOString().slice(0, 10),
    libelle: "", journal: "OD", notes: "",
  });
  const [journalODLignes, setJournalODLignes]   = useState<LigneEcritureForm[]>([
    { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
    { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
  ]);

  function selectJournalView(key: string, type: string, cat: string, source: string) {
    setJournalView(key);
    setJournalType(type);
    setJournalCategorie(cat);
    setJournalSource(source);
    setJournalPage(1);
  }

  useEffect(() => {
    const tm = setTimeout(() => { setDebouncedSearch(journalSearch); setJournalPage(1); }, 400);
    return () => clearTimeout(tm);
  }, [journalSearch]);

  const journalUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(journalPage), limit: "20" });
    if (journalType !== "TOUS") p.set("type", journalType);
    if (journalCategorie)       p.set("categorie", journalCategorie);
    if (journalSource)          p.set("source", journalSource);
    if (debouncedSearch)        p.set("search", debouncedSearch);
    if (journalDateDebut)       p.set("dateDebut", journalDateDebut);
    if (journalDateFin)         p.set("dateFin", journalDateFin);
    return `/api/comptable/journal?${p.toString()}`;
  }, [journalPage, journalType, journalCategorie, journalSource, debouncedSearch, journalDateDebut, journalDateFin]);

  const { data: journalData, loading: journalLoading, refetch: refetchJournal } = useApi<JournalResponse>(journalUrl);

  const { mutate: createEcriture, loading: creatingEcriture } = useMutation<unknown, object>(
    "/api/comptable/ecritures", "POST",
    { successMessage: "Écriture enregistrée" }
  );

  async function handleJournalODSubmit() {
    const lignes = journalODLignes
      .filter((l) => l.compteId !== "" && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({
        compteId: Number(l.compteId), libelle: l.libelle || journalODForm.libelle,
        debit: Number(l.debit || 0), credit: Number(l.credit || 0),
        isTva: l.isTva, tauxTva: l.isTva ? Number(l.tauxTva) : null,
        montantTva: l.isTva && l.montantTva ? Number(l.montantTva) : null,
      }));
    const res = await createEcriture({ ...journalODForm, lignes });
    if (res) {
      setShowJournalOD(false);
      setJournalODForm({ date: new Date().toISOString().slice(0, 10), libelle: "", journal: "OD", notes: "" });
      setJournalODLignes([
        { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
        { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
      ]);
    }
  }

  const { mutate: validerEntreeJournal, loading: validatingJournalEntry } = useMutation<unknown, object>(
    "/api/comptable/journal/valider", "POST",
    { successMessage: "Ligne validée" }
  );
  const { mutate: annulerValidationJournal } = useMutation<unknown, object>(
    "/api/comptable/journal/valider", "DELETE",
    { successMessage: "Validation annulée" }
  );

  async function handleValiderEntree(entryId: string) {
    const res = await validerEntreeJournal({ entryId });
    if (res) refetchJournal();
  }
  async function handleAnnulerValidationEntree(entryId: string) {
    const res = await annulerValidationJournal({ entryId });
    if (res) refetchJournal();
  }

  // ── Pièces justificatives (modale ouverte depuis l'icône PJ) ─────────
  const [piecesModal, setPiecesModal] = useState<{ sourceType: string; sourceId: number; libelle: string } | null>(null);
  const [piecesLocalList, setPiecesLocalList] = useState<PieceEntry[]>([]);
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [piecesSuppLoading, setPiecesSuppLoading] = useState<number | null>(null);
  const [pieceNatureChoisie, setPieceNatureChoisie] = useState("AUTRE");

  const fetchPiecesModal = useCallback(async (sourceType: string, sourceId: number) => {
    setPiecesLoading(true);
    try {
      const res = await fetch(`/api/comptable/pieces?sourceType=${sourceType}&sourceId=${sourceId}`);
      const json: PiecesResponse = await res.json();
      setPiecesLocalList(json.data ?? []);
    } catch {
      setPiecesLocalList([]);
    } finally {
      setPiecesLoading(false);
    }
  }, []);

  function openPiecesModal(sourceType: string, sourceId: number, libelle: string) {
    setPiecesModal({ sourceType, sourceId, libelle });
    fetchPiecesModal(sourceType, sourceId);
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

  const showNoteAucuneOperation = journalCategorie === SANS_OPERATION_CAT;

  return (
    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">Journaux</h1>
        {AIDE_COMPTABLE.journal && <AideComptable contenu={AIDE_COMPTABLE.journal} />}
      </div>

      <div className="space-y-4">
        {/* Sélecteur de vue journal */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Vue journal</p>
          <div className="flex gap-2 flex-wrap">
            {JOURNAL_VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => selectJournalView(v.key, v.type, v.cat, v.source)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  journalView === v.key
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {showNoteAucuneOperation && (
            <p className="text-xs text-slate-400 italic mt-3">
              Ce journal ne contient pas d&apos;opération métier suivie dans cette vue chronologique — consultez
              Saisie comptable → Écritures (filtre par journal) pour les écritures qui y sont passées.
            </p>
          )}
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
              />
            </div>

            <select
              value={journalType}
              onChange={(e) => { setJournalView("TOUT"); setJournalType(e.target.value); setJournalPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="TOUS">Tous les types</option>
              <option value="ENCAISSEMENT">Encaissements</option>
              <option value="DECAISSEMENT">Décaissements</option>
            </select>

            <select
              value={journalCategorie}
              onChange={(e) => { setJournalView("TOUT"); setJournalCategorie(e.target.value); setJournalPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Toutes catégories</option>
              {Object.entries(CAT_META).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <input type="date" value={journalDateDebut} onChange={(e) => { setJournalDateDebut(e.target.value); setJournalPage(1); }}
                className="flex-1 px-2 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <input type="date" value={journalDateFin} onChange={(e) => { setJournalDateFin(e.target.value); setJournalPage(1); }}
                className="flex-1 px-2 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {(journalType !== "TOUS" || journalCategorie || debouncedSearch || journalDateDebut || journalDateFin) && (
                <button onClick={() => { setJournalView("TOUT"); setJournalType("TOUS"); setJournalCategorie(""); setJournalSource(""); setJournalSearch(""); setJournalDateDebut(""); setJournalDateFin(""); setJournalPage(1); }}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Totaux du filtre */}
        {journalData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-center gap-3">
              <ArrowUpRight className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-700 font-medium">Encaissements filtrés</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(journalData.totaux.encaissements)}</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-center gap-3">
              <ArrowDownRight className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-700 font-medium">Décaissements filtrés</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(journalData.totaux.decaissements)}</p>
              </div>
            </div>
            <div className={`rounded-xl p-4 border flex items-center gap-3 ${journalData.totaux.net >= 0 ? "bg-slate-50 border-slate-200" : "bg-orange-50 border-orange-200"}`}>
              <Wallet className={`w-5 h-5 flex-shrink-0 ${journalData.totaux.net >= 0 ? "text-slate-600" : "text-orange-600"}`} />
              <div>
                <p className={`text-xs font-medium ${journalData.totaux.net >= 0 ? "text-slate-600" : "text-orange-700"}`}>Solde net filtré</p>
                <p className={`text-lg font-bold ${journalData.totaux.net >= 0 ? "text-slate-800" : "text-orange-700"}`}>
                  {journalData.totaux.net >= 0 ? "+" : ""}{formatCurrency(journalData.totaux.net)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Écriture OD manuelle */}
        {showJournalOD && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                <PlusCircle size={16} className="text-violet-600" /> Nouvelle écriture OD manuelle
              </h4>
              <button onClick={() => setShowJournalOD(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
                <input type="date" value={journalODForm.date} onChange={(e) => setJournalODForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
                <input value={journalODForm.libelle} onChange={(e) => setJournalODForm(p => ({ ...p, libelle: e.target.value }))}
                  placeholder="ex: Régularisation…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Journal *</label>
                <select value={journalODForm.journal} onChange={(e) => setJournalODForm(p => ({ ...p, journal: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {(journauxData?.data ?? []).filter(j => j.actif).map(j => <option key={j.code} value={j.code}>{j.libelle}</option>)}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">N° Compte</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Libellé ligne</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Débit</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Crédit</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {journalODLignes.map((ligne, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input value={String(ligne.compteId)} onChange={(e) => setJournalODLignes(ls => ls.map((l, j) => j === i ? { ...l, compteId: e.target.value as unknown as number | "" } : l))}
                          placeholder="411" className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={ligne.libelle} onChange={(e) => setJournalODLignes(ls => ls.map((l, j) => j === i ? { ...l, libelle: e.target.value } : l))}
                          placeholder="Libellé…" className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={ligne.debit} onChange={(e) => setJournalODLignes(ls => ls.map((l, j) => j === i ? { ...l, debit: e.target.value, credit: e.target.value ? "" : l.credit } : l))}
                          placeholder="0" className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 [appearance:textfield]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={ligne.credit} onChange={(e) => setJournalODLignes(ls => ls.map((l, j) => j === i ? { ...l, credit: e.target.value, debit: e.target.value ? "" : l.debit } : l))}
                          placeholder="0" className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400 [appearance:textfield]" />
                      </td>
                      <td className="px-2 py-2">
                        {journalODLignes.length > 2 && (
                          <button onClick={() => setJournalODLignes(ls => ls.filter((_, j) => j !== i))}
                            className="p-1 text-red-400 hover:bg-red-50 rounded-lg"><X size={13} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-600">TOTAUX</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700">
                      {formatCurrency(journalODLignes.reduce((s, l) => s + Number(l.debit || 0), 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">
                      {formatCurrency(journalODLignes.reduce((s, l) => s + Number(l.credit || 0), 0))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {Math.abs(journalODLignes.reduce((s, l) => s + Number(l.debit || 0), 0) - journalODLignes.reduce((s, l) => s + Number(l.credit || 0), 0)) < 0.01 && journalODLignes.some(l => Number(l.debit) > 0 || Number(l.credit) > 0) ? (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1"><CheckCircle size={12} /> Équilibré</span>
                      ) : (
                        <span className="text-xs text-red-500 font-semibold flex items-center justify-center gap-1"><AlertCircle size={12} /> Non équilibré</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setJournalODLignes(ls => [...ls, { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" }])}
                className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium">
                <Plus size={14} /> Ajouter une ligne
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowJournalOD(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
                <button onClick={handleJournalODSubmit}
                  disabled={creatingEcriture || !journalODForm.libelle || !journalODForm.date}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                  {creatingEcriture ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Enregistrer OD
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table journal */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <BookOpen size={18} className="text-violet-600" />
            <h3 className="font-bold text-slate-800">Journal des Opérations</h3>
            {journalData && <span className="text-xs text-slate-500">{journalData.meta.total} écritures</span>}
            <button
              onClick={() => { setShowJournalOD(true); setJournalODForm({ date: new Date().toISOString().slice(0, 10), libelle: "", journal: "OD", notes: "" }); setJournalODLignes([{ compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" }, { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" }]); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors"
            >
              <PlusCircle size={13} /> Écriture OD
            </button>
          </div>

          {journalLoading ? (
            <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Référence</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Libellé</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Catégorie</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Montant</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">PJ</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Val.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(journalData?.data ?? []).map((entry) => {
                    const meta    = CAT_META[entry.categorie] ?? { label: entry.categorie, color: "text-slate-600", bg: "bg-slate-100", icon: Filter };
                    const CatIcon = meta.icon;
                    const src     = parseJournalSource(entry.id);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(entry.date)}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{entry.reference}</td>
                        <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate" title={entry.libelle}>{entry.libelle}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                            <CatIcon size={11} />{meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            entry.type === "ENCAISSEMENT" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}>
                            {entry.type === "ENCAISSEMENT" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                            {entry.type === "ENCAISSEMENT" ? "Encaiss." : "Décaiss."}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${
                          entry.type === "ENCAISSEMENT" ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {entry.type === "ENCAISSEMENT" ? "+" : "-"}{formatCurrency(entry.montant)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {src ? (
                            <button
                              onClick={() => openPiecesModal(src.sourceType, src.sourceId, entry.libelle)}
                              title="Pièces justificatives"
                              className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                            >
                              <Paperclip size={15} />
                            </button>
                          ) : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {entry.valide ? (
                            <button
                              onClick={() => handleAnnulerValidationEntree(entry.id)}
                              title={`Validé par ${entry.valideParNom ?? ""}${entry.dateValidation ? ` le ${formatDateShort(entry.dateValidation)}` : ""}\nCliquer pour annuler`}
                              className="inline-flex items-center justify-center w-7 h-7 bg-emerald-100 text-emerald-600 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors"
                            >
                              <CheckCircle size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleValiderEntree(entry.id)}
                              disabled={validatingJournalEntry}
                              title="Valider cette ligne"
                              className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 rounded-full transition-colors disabled:opacity-40"
                            >
                              <BadgeCheck size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(journalData?.data ?? []).length === 0 && !journalLoading && (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">{t('text_no_result')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {journalData && journalData.meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page <b>{journalData.meta.page}</b> / <b>{journalData.meta.totalPages}</b> ({journalData.meta.total} écritures)
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setJournalPage((p) => Math.max(1, p - 1))} disabled={journalPage <= 1}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold">{journalPage}</span>
                <button onClick={() => setJournalPage((p) => Math.min(journalData.meta.totalPages, p + 1))} disabled={journalPage >= journalData.meta.totalPages}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
                        sourceType:     piecesModal.sourceType,
                        sourceId:       piecesModal.sourceId,
                        nom:            file.name,
                        url:            file.url,
                        uploadthingKey: file.key,
                        type:           file.type ?? "application/octet-stream",
                        taille:         file.size,
                        nature:         pieceNatureChoisie,
                      }),
                    });
                  }
                  fetchPiecesModal(piecesModal.sourceType, piecesModal.sourceId);
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
    </main>
  );
}

"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Calculator, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ArrowLeft, RefreshCw, Download, Search, ChevronLeft, ChevronRight,
  FileText, BarChart3, BookOpen, Wallet, Package, Calendar,
  AlertCircle, CheckCircle, Filter, X, Users, Lock, LockOpen, Plus,
  Paperclip, Trash2, ExternalLink, Upload,
  BookMarked, Percent, Building2, PlusCircle, Edit2, Save, ShoppingBag,
  ToggleLeft, ToggleRight, ListChecks, BadgeCheck, ChevronsUpDown,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort, formatDateTime } from "@/lib/format";
import { exportToCsv } from "@/lib/exportCsv";
import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

const UploadButton = generateUploadButton<OurFileRouter>();

// ── Types ──────────────────────────────────────────────────────────────────

interface EvolutionPoint { date: string; encaissements: number; decaissements: number; }

interface PieceEntry {
  id:             number;
  nom:            string;
  url:            string;
  uploadthingKey: string;
  type:           string;
  taille:         number;
  sourceType:     string;
  sourceId:       number;
  description:    string | null;
  archiverJusquau: string;
  createdAt:      string;
  uploadeUser:    { nom: string; prenom: string };
}
interface PiecesResponse       { success: boolean; data: PieceEntry[] }
interface PiecesAllResponse    { success: boolean; data: PieceEntry[]; meta: { total: number; page: number; limit: number; totalPages: number } }

// Déduit sourceType et sourceId à partir du format d'id de JournalEntry
function parseJournalSource(entryId: string): { sourceType: string; sourceId: number } | null {
  if (entryId.startsWith("VER-"))       return { sourceType: "VERSEMENT_PACK",   sourceId: Number(entryId.replace("VER-", "")) };
  if (entryId.startsWith("APPRO-"))     return { sourceType: "MOUVEMENT_STOCK",   sourceId: Number(entryId.replace("APPRO-", "")) };
  if (entryId.startsWith("OPC-ENC-"))   return { sourceType: "OPERATION_CAISSE",  sourceId: Number(entryId.replace("OPC-ENC-", "")) };
  if (entryId.startsWith("OPC-DEC-"))   return { sourceType: "OPERATION_CAISSE",  sourceId: Number(entryId.replace("OPC-DEC-", "")) };
  if (entryId.startsWith("VD-"))        return { sourceType: "VENTE_DIRECTE",      sourceId: Number(entryId.replace("VD-", "")) };
  return null;
}

function formatTaille(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  if (octets >= 1024)        return `${Math.round(octets / 1024)} Ko`;
  return `${octets} o`;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  VERSEMENT_PACK:      "Versement pack",
  OPERATION_CAISSE:    "Opération caisse",
  MOUVEMENT_STOCK:     "Mouvement stock",
  CLOTURE_COMPTABLE:   "Clôture comptable",
  VENTE_DIRECTE:       "Vente directe",
};

interface SyntheseResponse {
  success: boolean;
  data: {
    periode: { debut: string; fin: string; jours: number };
    encaissements: {
      versements_packs:     { montant: number; count: number };
      cotisations_init:     { montant: number; count: number };
      versements_peri:      { montant: number; count: number };
      remboursements:       { montant: number; count: number };
      autres:               { montant: number; count: number };
      caisse_encaissements: { montant: number; count: number };
      ventes_directes:      { montant: number; count: number };
      total: number;
    };
    decaissements: {
      approvisionnements: { montant: number; count: number };
      salaires:           { montant: number; count: number };
      avances:            { montant: number; count: number };
      fournisseurs:       { montant: number; count: number };
      autres_caisse:      { montant: number; count: number };
      total: number;
    };
    resultat_net: number;
    taux_utilisation: number;
    evolution: EvolutionPoint[];
    snapshot: {
      stock:                { valeur: number; nombreProduits: number };
      souscriptionsActives: number;
      packs:                number;
      versementsTotal:      number;
    };
  };
}

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

interface ClotureEntry {
  id:         number;
  annee:      number;
  mois:       number;
  notes:      string | null;
  cloturePar: string;
  createdAt:  string;
}
interface CloturesResponse { success: boolean; data: ClotureEntry[] }

interface EtatsFinanciersResponse {
  success: boolean;
  data: {
    annee: number;
    bilan: {
      actif: {
        stock:         { valeur: number; nombreProduits: number };
        creancesPacks: { valeur: number; count: number };
        total: number;
      };
      passif: {
        engagementsPacks: { valeur: number; count: number };
        capitauxPropres:  number;
        total: number;
      };
    };
    compteResultat: {
      produits: { versementsCollectes: number; encaissementsCaisse: number; ventesDirectes: number; total: number };
      charges:  { approvisionnements: number; salaires: number; avances: number; fournisseurs: number; autresCaisse: number; totalCaisse: number; total: number };
      resultatNet: number;
    };
    ratios: {
      tauxRecouvrement: number;
      tauxCompletion:   number;
      margeNette:       number;
      ratioCharges:     number;
    };
  };
}

// ── Types comptabilité générale ────────────────────────────────────────────

interface CompteComptable {
  id: number; numero: string; libelle: string; classe: number;
  type: string; nature: string; sens: string; actif: boolean;
  tiersType: string | null; tiersNom: string | null;
  compteParent?: { numero: string; libelle: string } | null;
}
interface ComptesResponse {
  data: CompteComptable[];
  stats: { classe: number; count: number }[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneEcritureForm {
  compteId: number | ""; libelle: string; debit: string; credit: string;
  isTva: boolean; tauxTva: string; montantTva: string;
}
interface LigneEcritureData {
  id: number; compteId: number; libelle: string;
  debit: number; credit: number; isTva: boolean;
  tauxTva: number | null; montantTva: number | null;
  compte: { id: number; numero: string; libelle: string; type: string };
}
interface EcritureComptable {
  id: number; reference: string; date: string; libelle: string;
  journal: string; statut: string; notes: string | null;
  user?: { id: number; nom: string; prenom: string };
  lignes: LigneEcritureData[];
}
interface EcrituresResponse {
  data: EcritureComptable[];
  totaux: { debit: number; credit: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface DeclarationTVA {
  id: number; periode: string; tvaCollectee: number; tvaDeductible: number;
  tvaDue: number; statut: string; notes: string | null;
  user?: { id: number; nom: string; prenom: string };
}
interface TVAResponse {
  data: DeclarationTVA[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface RapprochementBancaire {
  id: number; periode: string; soldeBancaireReel: number;
  soldeComptable: number; ecart: number; statut: string; notes: string | null;
  user?: { id: number; nom: string; prenom: string };
}
interface RapprochementResponse {
  data: RapprochementBancaire[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const JOURNAL_LABELS: Record<string, string> = {
  CAISSE: "Caisse", BANQUE: "Banque", VENTES: "Ventes",
  ACHATS: "Achats", OD: "Opérations diverses", PAIE: "Paie",
};
const TYPE_COMPTE_LABELS: Record<string, string> = {
  ACTIF: "Actif", PASSIF: "Passif", CHARGES: "Charges",
  PRODUITS: "Produits", TRESORERIE: "Trésorerie",
};
interface SyncApercu {
  caisse:          { total: number; dejaSyncees: number; aSyncer: number };
  ventes:          { total: number; dejaSyncees: number; aSyncer: number };
  ventes_directes: { total: number; dejaSyncees: number; aSyncer: number };
  achats:          { total: number; dejaSyncees: number; aSyncer: number };
}
interface SyncApercuResponse { apercu: SyncApercu }

const STATUT_ECRITURE_COLORS: Record<string, string> = {
  BROUILLON: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDE:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  ANNULE:    "bg-red-50 text-red-600 border-red-200",
};

// ── Helpers chart SVG ─────────────────────────────────────────────────────

const VB_W = 1000;
const VB_H = 180;

function buildLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * VB_W).toFixed(1)} ${(p.y * VB_H).toFixed(1)}`).join(" ");
}

function buildArea(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const line  = buildLine(pts);
  const last  = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${(last.x * VB_W).toFixed(1)} ${VB_H} L ${(first.x * VB_W).toFixed(1)} ${VB_H} Z`;
}

function normalizePoints(data: EvolutionPoint[], key: "encaissements" | "decaissements", max: number) {
  if (data.length === 0 || max === 0) return data.map((_, i) => ({ x: data.length === 1 ? 0.5 : i / (data.length - 1), y: 1 }));
  return data.map((d, i) => ({
    x: data.length === 1 ? 0.5 : i / (data.length - 1),
    y: 1 - d[key] / max,
  }));
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Sub-components ────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, bg, trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color: string; bg: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`${bg} p-2.5 rounded-xl group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-5 h-5`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === "up" ? "bg-emerald-50 text-emerald-600" : trend === "down" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
          }`}>
            {trend === "up" ? <ArrowUpRight className="inline w-3 h-3" /> : trend === "down" ? <ArrowDownRight className="inline w-3 h-3" /> : "—"}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarBreakdown({ label, montant, total, color }: {
  label: string; montant: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((montant / total) * 100) : 0;
  return (
    <div className="py-2.5">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-800 font-bold">{formatCurrency(montant)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-0.5 text-right">{pct}%</p>
    </div>
  );
}

function BilanRow({ label, sub, valeur, type }: {
  label: string; sub?: string; valeur: number; type?: "highlight" | "total";
}) {
  return (
    <div className={`flex justify-between items-center py-3 ${type === "total" ? "border-t-2 border-slate-200 mt-1 pt-4" : "border-b border-slate-100"}`}>
      <div>
        <p className={`${type === "total" ? "font-bold text-slate-800" : "text-slate-600 text-sm"}`}>{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <span className={`font-bold ${type === "total" ? "text-lg text-slate-900" : "text-slate-700"}`}>
        {formatCurrency(valeur)}
      </span>
    </div>
  );
}

const CAT_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  // VersementPack
  COTISATION_INITIALE:  { label: "Acompte initial",        color: "text-blue-600",    bg: "bg-blue-100",    icon: Calendar },
  VERSEMENT_PERIODIQUE: { label: "Versement périodique",   color: "text-emerald-600", bg: "bg-emerald-100", icon: TrendingUp },
  REMBOURSEMENT:        { label: "Remboursement",          color: "text-teal-600",    bg: "bg-teal-100",    icon: CheckCircle },
  VERSEMENT_PACK:       { label: "Bonus / Ajustement",     color: "text-violet-600",  bg: "bg-violet-100",  icon: BookOpen },
  // MouvementStock
  APPROVISIONNEMENT:    { label: "Approvisionnement",      color: "text-orange-600",  bg: "bg-orange-100",  icon: Package },
  // OperationCaisse encaissements
  CAISSE_ENCAISSEMENT:  { label: "Encaissement caisse",    color: "text-cyan-600",    bg: "bg-cyan-100",    icon: Wallet },
  // VenteDirecte
  VENTE_DIRECTE:        { label: "Vente directe",          color: "text-indigo-600",  bg: "bg-indigo-100",  icon: ShoppingBag },
  // OperationCaisse décaissements
  SALAIRE:              { label: "Salaire",                color: "text-red-600",     bg: "bg-red-100",     icon: Users },
  AVANCE:               { label: "Avance",                 color: "text-rose-600",    bg: "bg-rose-100",    icon: ArrowDownRight },
  FOURNISSEUR:          { label: "Fournisseur",            color: "text-amber-600",   bg: "bg-amber-100",   icon: Package },
  CAISSE_AUTRE:         { label: "Autre décaissement",     color: "text-slate-600",   bg: "bg-slate-100",   icon: Filter },
};

// ── Main Page ─────────────────────────────────────────────────────────────

type Period = "7" | "30" | "90" | "365";
type Tab    = "synthese" | "journal" | "tresorerie" | "balance" | "grandlivre" | "etats" | "pieces"
            | "plan" | "saisie" | "tva" | "rapprochement";

export default function ComptablePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30");
  const [activeTab, setActiveTab]           = useState<Tab>("synthese");

  // Journal state
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

  const JOURNAL_VIEWS = [
    { key: "TOUT",   label: "Tout le journal",     type: "TOUS",         cat: "",               source: "" },
    { key: "CAISSE", label: "Journal de Caisse",   type: "TOUS",         cat: "",               source: "caisse" },
    { key: "BANQUE", label: "Journal de Banque",   type: "ENCAISSEMENT", cat: "CAISSE_ENCAISSEMENT", source: "caisse" },
    { key: "VENTES", label: "Journal des Ventes",  type: "ENCAISSEMENT", cat: "",               source: "ventes" },
    { key: "ACHATS", label: "Journal des Achats",  type: "DECAISSEMENT", cat: "APPROVISIONNEMENT", source: "achats" },
    { key: "OD",     label: "Journal OD",          type: "TOUS",         cat: "VERSEMENT_PACK", source: "" },
    { key: "PAIE",   label: "Journal de Paie",     type: "DECAISSEMENT", cat: "SALAIRE",        source: "paie" },
  ];

  function selectJournalView(key: string, type: string, cat: string, source: string) {
    setJournalView(key);
    setJournalType(type);
    setJournalCategorie(cat);
    setJournalSource(source);
    setJournalPage(1);
  }

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(journalSearch); setJournalPage(1); }, 400);
    return () => clearTimeout(t);
  }, [journalSearch]);

  // ── État Plan comptable ──────────────────────────────────────────────
  const [planPage, setPlanPage]             = useState(1);
  const [planSearch, setPlanSearch]         = useState("");
  const [planSearchDebounced, setPlanSearchDebounced] = useState("");
  const [planClasse, setPlanClasse]         = useState("");
  const [planType, setPlanType]             = useState("");
  const [showAddCompte, setShowAddCompte]   = useState(false);
  const [editCompte, setEditCompte]         = useState<CompteComptable | null>(null);
  const [newCompte, setNewCompte]           = useState({ numero: "", libelle: "", classe: "4", type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" });

  useEffect(() => {
    const t = setTimeout(() => { setPlanSearchDebounced(planSearch); setPlanPage(1); }, 400);
    return () => clearTimeout(t);
  }, [planSearch]);

  // ── État Saisie des écritures ────────────────────────────────────────
  const [ecrituresPage, setEcrituresPage]     = useState(1);
  const [ecrituresJournal, setEcrituresJournal] = useState("");
  const [ecrituresStatut, setEcrituresStatut] = useState("");
  const [ecrituresDateMin, setEcrituresDateMin] = useState("");
  const [ecrituresDateMax, setEcrituresDateMax] = useState("");
  const [showSaisie, setShowSaisie]           = useState(false);
  const [editEcriture, setEditEcriture]       = useState<EcritureComptable | null>(null);
  const [saisieForm, setSaisieForm]           = useState({
    date: new Date().toISOString().slice(0, 10),
    libelle: "", journal: "CAISSE", notes: "",
  });
  const [saisieLignes, setSaisieLignes]       = useState<LigneEcritureForm[]>([
    { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
    { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
  ]);

  // ── État TVA ─────────────────────────────────────────────────────────
  const [tvaPage, setTvaPage]               = useState(1);
  const [tvaPeriode, setTvaPeriode]         = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tvaCollecteeInput, setTvaCollecteeInput] = useState("");
  const [tvaDeductibleInput, setTvaDeductibleInput] = useState("");
  const [tvaNotes, setTvaNotes]             = useState("");
  const [tvaCalcResult, setTvaCalcResult]   = useState<{ tvaCollectee: number; tvaDeductible: number; tvaDue: number } | null>(null);

  // ── État Rapprochement ───────────────────────────────────────────────
  const [rapproPage, setRapproPage]         = useState(1);
  const [rapproPeriode, setRapproPeriode]   = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [soldeBancaireInput, setSoldeBancaireInput] = useState("");
  const [rapproNotes, setRapproNotes]       = useState("");

  // ── API calls ─────────────────────────────────────────────────────────

  const { data: synthData, loading: synthLoading, refetch: refetchSynth } =
    useApi<SyntheseResponse>(`/api/comptable/synthese?period=${selectedPeriod}`);

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

  const { data: journalData, loading: journalLoading, refetch: refetchJournal } = useApi<JournalResponse>(
    activeTab === "journal" ? journalUrl : null
  );

  const [etatsAnnee, setEtatsAnnee] = useState(new Date().getFullYear());

  const { data: etatsData, loading: etatsLoading } = useApi<EtatsFinanciersResponse>(
    activeTab === "etats" ? `/api/comptable/etats-financiers?annee=${etatsAnnee}` : null
  );

  const { data: etatsN1Data } = useApi<EtatsFinanciersResponse>(
    activeTab === "etats" ? `/api/comptable/etats-financiers?annee=${etatsAnnee - 1}` : null
  );

  const { data: cloturesData, refetch: refetchClotures } = useApi<CloturesResponse>(
    activeTab === "etats" ? `/api/comptable/clotures?annee=${etatsAnnee}` : null
  );

  const { mutate: creerCloture,  loading: clotureLoading  } = useMutation<CloturesResponse, { annee: number; mois: number; notes?: string }>(
    "/api/comptable/clotures", "POST",
    { successMessage: "Période clôturée avec succès" }
  );
  const { mutate: suppCloture, loading: suppClotureLoading } = useMutation<CloturesResponse, { annee: number; mois: number }>(
    "/api/comptable/clotures", "DELETE",
    { successMessage: "Période déverrouillée" }
  );

  const [clotureModal, setClotureModal] = useState<{ mois: number } | null>(null);
  const [clotureNotes, setClotureNotes] = useState("");

  async function handleCloture(mois: number) {
    await creerCloture({ annee: etatsAnnee, mois, notes: clotureNotes || undefined });
    setClotureModal(null);
    setClotureNotes("");
    refetchClotures();
  }

  async function handleOuverture(mois: number) {
    await suppCloture({ annee: etatsAnnee, mois });
    refetchClotures();
  }

  // ── Pièces justificatives ───────────────────────────────────────────────

  const [piecesModal, setPiecesModal] = useState<{ sourceType: string; sourceId: number; libelle: string } | null>(null);
  const [piecesLocalList, setPiecesLocalList] = useState<PieceEntry[]>([]);
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [piecesSuppLoading, setPiecesSuppLoading] = useState<number | null>(null);

  // Onglet Pièces — filtres
  const [piecesPage, setPiecesPage]             = useState(1);
  const [piecesSearch, setPiecesSearch]         = useState("");
  const [piecesSearchDebounced, setPiecesSearchDebounced] = useState("");
  const [piecesSourceType, setPiecesSourceType] = useState("");
  const [piecesDateDebut, setPiecesDateDebut]   = useState("");
  const [piecesDateFin, setPiecesDateFin]       = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setPiecesSearchDebounced(piecesSearch); setPiecesPage(1); }, 400);
    return () => clearTimeout(t);
  }, [piecesSearch]);

  const piecesAllUrl = useMemo(() => {
    const p = new URLSearchParams({ all: "1", page: String(piecesPage), limit: "20" });
    if (piecesSearchDebounced) p.set("search",     piecesSearchDebounced);
    if (piecesSourceType)      p.set("sourceType", piecesSourceType);
    if (piecesDateDebut)       p.set("dateDebut",  piecesDateDebut);
    if (piecesDateFin)         p.set("dateFin",    piecesDateFin);
    return `/api/comptable/pieces?${p.toString()}`;
  }, [piecesPage, piecesSearchDebounced, piecesSourceType, piecesDateDebut, piecesDateFin]);

  const { data: piecesAllData, loading: piecesAllLoading, refetch: refetchPiecesAll } =
    useApi<PiecesAllResponse>(activeTab === "pieces" ? piecesAllUrl : null);

  // Charger les pièces d'une écriture spécifique (pour le modal)
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
      refetchPiecesAll();
    } finally {
      setPiecesSuppLoading(null);
    }
  }

  const grandLivreUrl = useMemo(() => {
    const p = new URLSearchParams({ grandlivre: "1" });
    if (journalDateDebut) p.set("dateDebut", journalDateDebut);
    if (journalDateFin)   p.set("dateFin",   journalDateFin);
    return `/api/comptable/journal?${p.toString()}`;
  }, [journalDateDebut, journalDateFin]);

  const { data: grandLivreData, loading: grandLivreLoading } = useApi<JournalResponse>(
    activeTab === "grandlivre" ? grandLivreUrl : null
  );

  // ── Plan comptable API ────────────────────────────────────────────────
  const planUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(planPage), limit: "100" });
    if (planSearchDebounced) p.set("search", planSearchDebounced);
    if (planClasse)          p.set("classe", planClasse);
    if (planType)            p.set("type",   planType);
    return `/api/comptable/plan-comptable?${p.toString()}`;
  }, [planPage, planSearchDebounced, planClasse, planType]);

  const { data: planData, loading: planLoading, refetch: refetchPlan } =
    useApi<ComptesResponse>(activeTab === "plan" ? planUrl : null);

  const { mutate: importSyscohada, loading: importLoading } = useMutation<unknown, object>(
    "/api/comptable/plan-comptable", "POST",
    { successMessage: "Plan SYSCOHADA importé avec succès !" }
  );
  const { mutate: createCompte, loading: creatingCompte } = useMutation<unknown, object>(
    "/api/comptable/plan-comptable", "POST",
    { successMessage: "Compte créé" }
  );
  const { mutate: patchCompte, loading: patchingCompte } = useMutation<unknown, object>(
    "/api/comptable/plan-comptable", "PATCH",
    { successMessage: "Compte mis à jour" }
  );

  async function handleImportSyscohada() {
    await importSyscohada({ action: "import_syscohada" });
    refetchPlan();
  }
  async function handleCreateCompte() {
    const res = await createCompte({ ...newCompte, classe: Number(newCompte.classe) });
    if (res) { refetchPlan(); setShowAddCompte(false); setNewCompte({ numero: "", libelle: "", classe: "4", type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" }); }
  }
  async function handleToggleCompte(compte: CompteComptable) {
    await patchCompte({ id: compte.id, actif: !compte.actif });
    refetchPlan();
  }
  async function handleSaveEditCompte() {
    if (!editCompte) return;
    await patchCompte({ id: editCompte.id, libelle: editCompte.libelle, nature: editCompte.nature });
    refetchPlan();
    setEditCompte(null);
  }

  // ── Écritures API ─────────────────────────────────────────────────────
  const ecrituresUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(ecrituresPage), limit: "30" });
    if (ecrituresJournal) p.set("journal", ecrituresJournal);
    if (ecrituresStatut)  p.set("statut",  ecrituresStatut);
    if (ecrituresDateMin) p.set("dateMin", ecrituresDateMin);
    if (ecrituresDateMax) p.set("dateMax", ecrituresDateMax);
    return `/api/comptable/ecritures?${p.toString()}`;
  }, [ecrituresPage, ecrituresJournal, ecrituresStatut, ecrituresDateMin, ecrituresDateMax]);

  const { data: ecrituresData, loading: ecrituresLoading, refetch: refetchEcritures } =
    useApi<EcrituresResponse>(activeTab === "saisie" ? ecrituresUrl : null);

  const { mutate: createEcriture, loading: creatingEcriture } = useMutation<unknown, object>(
    "/api/comptable/ecritures", "POST",
    { successMessage: "Écriture enregistrée" }
  );

  // Ref pour les mutations dynamiques écriture (pattern useMutation)
  const ecritureActionIdRef = useRef<number | null>(null);
  const { mutate: validerEcriture } = useMutation<unknown, object>(
    () => `/api/comptable/ecritures/${ecritureActionIdRef.current}`, "PUT",
    { successMessage: "Écriture validée" }
  );
  const { mutate: annulerEcriture } = useMutation<unknown, object>(
    () => `/api/comptable/ecritures/${ecritureActionIdRef.current}`, "PUT",
    { successMessage: "Écriture annulée" }
  );
  const { mutate: supprimerEcriture } = useMutation<unknown, object>(
    () => `/api/comptable/ecritures/${ecritureActionIdRef.current}`, "DELETE",
    { successMessage: "Écriture supprimée" }
  );

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

  async function handleSaisieSubmit() {
    const lignes = saisieLignes
      .filter((l) => l.compteId !== "" && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({
        compteId: Number(l.compteId), libelle: l.libelle || saisieForm.libelle,
        debit: Number(l.debit || 0), credit: Number(l.credit || 0),
        isTva: l.isTva, tauxTva: l.isTva ? Number(l.tauxTva) : null,
        montantTva: l.isTva && l.montantTva ? Number(l.montantTva) : null,
      }));
    const res = await createEcriture({ ...saisieForm, lignes });
    if (res) {
      refetchEcritures();
      setShowSaisie(false);
      setSaisieForm({ date: new Date().toISOString().slice(0, 10), libelle: "", journal: "CAISSE", notes: "" });
      setSaisieLignes([
        { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
        { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" },
      ]);
    }
  }
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

  async function handleValider(id: number) {
    ecritureActionIdRef.current = id;
    const res = await validerEcriture({ statut: "VALIDE" });
    if (res) refetchEcritures();
  }
  async function handleAnnulerEcriture(id: number) {
    ecritureActionIdRef.current = id;
    const res = await annulerEcriture({ statut: "ANNULE" });
    if (res) refetchEcritures();
  }
  async function handleSupprimerEcriture(id: number) {
    ecritureActionIdRef.current = id;
    const res = await supprimerEcriture({});
    if (res) refetchEcritures();
  }

  // ── TVA API ───────────────────────────────────────────────────────────
  const { data: tvaData, loading: tvaLoading, refetch: refetchTva } =
    useApi<TVAResponse>(activeTab === "tva" ? `/api/comptable/tva?page=${tvaPage}&limit=24` : null);

  const { mutate: calculerTva } = useMutation<{ data: { tvaCollectee: number; tvaDeductible: number; tvaDue: number } }, object>(
    "/api/comptable/tva", "POST"
  );
  const { mutate: enregistrerTva, loading: enregistrantTva } = useMutation<unknown, object>(
    "/api/comptable/tva", "POST",
    { successMessage: "Déclaration TVA enregistrée" }
  );
  const { mutate: validerTva } = useMutation<unknown, object>(
    "/api/comptable/tva", "PATCH",
    { successMessage: "Déclaration validée" }
  );

  async function handleCalculerTva() {
    const res = await calculerTva({ action: "calculer", periode: tvaPeriode }) as { data?: { tvaCollectee: number; tvaDeductible: number; tvaDue: number } } | null;
    if (res?.data) {
      setTvaCalcResult(res.data);
      setTvaCollecteeInput(String(res.data.tvaCollectee));
      setTvaDeductibleInput(String(res.data.tvaDeductible));
    }
  }
  async function handleEnregistrerTva() {
    const res = await enregistrerTva({ periode: tvaPeriode, tvaCollectee: Number(tvaCollecteeInput), tvaDeductible: Number(tvaDeductibleInput), notes: tvaNotes || null });
    if (res) { refetchTva(); setTvaCalcResult(null); setTvaCollecteeInput(""); setTvaDeductibleInput(""); setTvaNotes(""); }
  }

  // ── Rapprochement API ─────────────────────────────────────────────────
  const { data: rapproData, loading: rapproLoading, refetch: refetchRappro } =
    useApi<RapprochementResponse>(activeTab === "rapprochement" ? `/api/comptable/rapprochement?page=${rapproPage}&limit=24` : null);

  const { mutate: enregistrerRappro, loading: enregistrantRappro } = useMutation<unknown, object>(
    "/api/comptable/rapprochement", "POST",
    { successMessage: "Rapprochement enregistré" }
  );

  async function handleEnregistrerRappro() {
    const res = await enregistrerRappro({ periode: rapproPeriode, soldeBancaireReel: Number(soldeBancaireInput), notes: rapproNotes || null });
    if (res) { refetchRappro(); setSoldeBancaireInput(""); setRapproNotes(""); }
  }

  // ── Synchronisation journaux ──────────────────────────────────────────
  const [syncDateMin, setSyncDateMin] = useState("");
  const [syncDateMax, setSyncDateMax] = useState("");
  const [syncResult, setSyncResult]   = useState<{ message: string; resultats: Record<string, { created: number; skipped: number }> } | null>(null);
  const [syncing, setSyncing]         = useState<string | null>(null);

  const { data: syncApercuData, refetch: refetchSyncApercu } =
    useApi<SyncApercuResponse>(activeTab === "saisie" ? "/api/comptable/sync-journals" : null);

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

  const handleExport = () => {
    const entries = journalData?.data ?? [];
    if (entries.length === 0) return;
    exportToCsv(
      entries,
      [
        { label: "Référence",  key: "reference" },
        { label: "Date",       key: "date",      format: (v) => formatDateTime(String(v)) },
        { label: "Type",       key: "type",      format: (v) => v === "ENCAISSEMENT" ? "Encaissement" : "Décaissement" },
        { label: "Catégorie",  key: "categorie" },
        { label: "Libellé",    key: "libelle" },
        { label: "Montant",    key: "montant",   format: (v) => formatCurrency(Number(v)) },
      ],
      `journal-comptable-${selectedPeriod}.csv`
    );
  };

  // ── Computed ──────────────────────────────────────────────────────────

  const sd   = synthData?.data;
  const ed   = etatsData?.data;
  const edN1 = etatsN1Data?.data;

  const globalMax = useMemo(() => {
    if (!sd) return 1;
    return Math.max(...sd.evolution.flatMap((e) => [e.encaissements, e.decaissements]), 1);
  }, [sd]);

  const encaisPoints = useMemo(() => normalizePoints(sd?.evolution ?? [], "encaissements", globalMax), [sd, globalMax]);
  const decaisPoints = useMemo(() => normalizePoints(sd?.evolution ?? [], "decaissements", globalMax), [sd, globalMax]);

  const xLabels = useMemo(() => {
    const pts = sd?.evolution ?? [];
    if (pts.length === 0) return [];
    const n = pts.length;
    const idxs = [...new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1])];
    return idxs.map((i) => ({ xPct: (i / (n - 1)) * 100, label: fmtDateShort(pts[i].date) }));
  }, [sd]);

  const yMax = globalMax;
  const yLabels = useMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      val:  yMax * f,
      yPct: 100 - f * 100,
    })),
    [yMax]
  );

  // ── Loading state ──────────────────────────────────────────────────────

  if (synthLoading && !sd) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement de la comptabilité…</p>
        </div>
      </div>
    );
  }

  const enc  = sd?.encaissements;
  const dec  = sd?.decaissements;
  const snap = sd?.snapshot;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "synthese",       label: "Synthèse",              icon: BarChart3    },
    { key: "plan",           label: "Plan Comptable",        icon: BookMarked   },
    { key: "saisie",         label: "Écritures",             icon: Edit2        },
    { key: "journal",        label: "Journal",               icon: BookOpen     },
    { key: "tresorerie",     label: "Trésorerie",            icon: Wallet       },
    { key: "balance",        label: "Balance",               icon: Calculator   },
    { key: "grandlivre",     label: "Grand Livre",           icon: BookOpen     },
    { key: "tva",            label: "TVA",                   icon: Percent      },
    { key: "rapprochement",  label: "Rapprochement",         icon: Building2    },
    { key: "etats",          label: "États Financiers",      icon: FileText     },
    { key: "pieces",         label: "Pièces justificatives", icon: Paperclip    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20">

      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-800">Comptabilité</h1>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {(["7", "30", "90", "365"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedPeriod === p
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {p === "365" ? "1 an" : `${p}j`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={refetchSynth} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw size={18} />
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm text-sm font-medium">
              <Download size={16} />Exporter
            </button>
            <UserPdvBadge />
            <MessagesLink />
            <NotificationBell href="/dashboard/user/notifications" />
            <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

        {/* ── Header ── */}
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Comptabilité Générale</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Période : {sd ? formatDateShort(sd.periode.debut) : "…"} → {sd ? formatDateShort(sd.periode.fin) : "…"}
          </p>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Encaissements"
            value={enc ? formatCurrency(enc.total) : "…"}
            sub={`${enc?.versements_packs.count ?? 0} versements packs collectés`}
            icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" trend="up"
          />
          <KpiCard
            label="Total Décaissements"
            value={dec ? formatCurrency(dec.total) : "…"}
            sub={`Approvisionnements : ${dec?.approvisionnements.count ?? 0} entrées`}
            icon={TrendingDown} color="text-red-500" bg="bg-red-50" trend="down"
          />
          <KpiCard
            label="Résultat Net"
            value={sd ? formatCurrency(sd.resultat_net) : "…"}
            sub={`Taux utilisation budget : ${sd?.taux_utilisation ?? 0}%`}
            icon={sd && sd.resultat_net >= 0 ? CheckCircle : AlertCircle}
            color={sd && sd.resultat_net >= 0 ? "text-emerald-600" : "text-red-500"}
            bg={sd && sd.resultat_net >= 0 ? "bg-emerald-50" : "bg-red-50"}
            trend={sd && sd.resultat_net >= 0 ? "up" : "down"}
          />
          <KpiCard
            label="Valeur du Stock"
            value={snap ? formatCurrency(snap.stock.valeur) : "…"}
            sub={`${snap?.stock.nombreProduits ?? 0} produits — ${snap?.souscriptionsActives ?? 0} souscriptions actives`}
            icon={Package} color="text-blue-600" bg="bg-blue-50"
          />
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm border border-slate-200/60 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === t.key
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} />{t.label}
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 1 : SYNTHÈSE                                               */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "synthese" && (
          <div className="space-y-5">

            {/* Chart évolution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Évolution Encaissements / Décaissements</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Flux journaliers sur la période</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />Encaissements</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 inline-block rounded border-dashed" />Décaissements</span>
                </div>
              </div>

              <div className="relative" style={{ height: 230 }}>
                {encaisPoints.length > 1 ? (
                  <>
                    {yLabels.map((lbl) => (
                      <div key={lbl.yPct}
                        className="absolute left-0 w-12 text-right text-[10px] text-slate-400 leading-none select-none"
                        style={{ top: `${(lbl.yPct / 100) * 190}px`, transform: "translateY(-50%)" }}
                      >
                        {lbl.val >= 1000000 ? `${Math.round(lbl.val / 1000000)}M` : lbl.val >= 1000 ? `${Math.round(lbl.val / 1000)}k` : Math.round(lbl.val)}
                      </div>
                    ))}

                    <div className="absolute left-14 right-0 top-0" style={{ height: 190 }}>
                      <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="cptEncGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                          </linearGradient>
                          <linearGradient id="cptDecGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
                          </linearGradient>
                        </defs>
                        {yLabels.map((lbl) => (
                          <line key={lbl.yPct} x1="0" x2={VB_W}
                            y1={(lbl.yPct / 100) * VB_H} y2={(lbl.yPct / 100) * VB_H}
                            stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        ))}
                        <path d={buildArea(encaisPoints)} fill="url(#cptEncGrad)" />
                        <path d={buildArea(decaisPoints)} fill="url(#cptDecGrad)" />
                        <path d={buildLine(encaisPoints)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        <path d={buildLine(decaisPoints)} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
                      </svg>
                    </div>

                    <div className="absolute left-14 right-0" style={{ top: 195 }}>
                      {xLabels.map(({ xPct, label }) => (
                        <span key={xPct} className="absolute text-[10px] text-slate-400 whitespace-nowrap select-none"
                          style={{ left: `${xPct}%`, transform: "translateX(-50%)" }}>{label}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Aucune donnée sur cette période
                  </div>
                )}
              </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Encaissements */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="font-bold text-slate-800">Détail Encaissements</h3>
                </div>
                <p className="text-xs text-slate-400 mb-2">Versements packs collectés</p>
                <p className="text-2xl font-bold text-emerald-600 mb-5">{formatCurrency(enc?.total ?? 0)}</p>
                <div className="space-y-1 divide-y divide-slate-100">
                  <BarBreakdown label={`Acomptes initiaux (${enc?.cotisations_init.count ?? 0})`}     montant={enc?.cotisations_init.montant ?? 0}  total={enc?.total ?? 1} color="bg-blue-500" />
                  <BarBreakdown label={`Versements périodiques (${enc?.versements_peri.count ?? 0})`} montant={enc?.versements_peri.montant ?? 0}   total={enc?.total ?? 1} color="bg-emerald-500" />
                  <BarBreakdown label={`Remboursements (${enc?.remboursements.count ?? 0})`}           montant={enc?.remboursements.montant ?? 0}    total={enc?.total ?? 1} color="bg-teal-500" />
                  <BarBreakdown label={`Ventes directes (${enc?.ventes_directes.count ?? 0})`}        montant={enc?.ventes_directes.montant ?? 0}   total={enc?.total ?? 1} color="bg-indigo-500" />
                  <BarBreakdown label={`Bonus / Ajust. (${enc?.autres.count ?? 0})`}                  montant={enc?.autres.montant ?? 0}            total={enc?.total ?? 1} color="bg-violet-500" />
                </div>
              </div>

              {/* Activité Packs */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <h3 className="font-bold text-slate-800">Activité Packs</h3>
                </div>
                <p className="text-xs text-slate-400 mb-2">Versements collectés sur la période</p>
                <p className="text-2xl font-bold text-blue-600 mb-5">{enc?.versements_packs.count ?? 0} versements</p>
                <div className="space-y-0 divide-y divide-slate-100">
                  {[
                    { label: "Acomptes initiaux",   count: enc?.cotisations_init.count ?? 0,  montant: enc?.cotisations_init.montant ?? 0 },
                    { label: "Versements pério.",    count: enc?.versements_peri.count ?? 0,   montant: enc?.versements_peri.montant ?? 0 },
                    { label: "Remboursements",       count: enc?.remboursements.count ?? 0,    montant: enc?.remboursements.montant ?? 0 },
                    { label: "Ventes directes",      count: enc?.ventes_directes.count ?? 0,   montant: enc?.ventes_directes.montant ?? 0 },
                    { label: "Bonus / Ajustements",  count: enc?.autres.count ?? 0,            montant: enc?.autres.montant ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center py-3">
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">{formatCurrency(item.montant)}</p>
                        <p className="text-xs text-slate-400">{item.count} opé.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Décaissements */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <h3 className="font-bold text-slate-800">Détail Décaissements</h3>
                </div>
                <p className="text-2xl font-bold text-red-500 mb-5">{formatCurrency(dec?.total ?? 0)}</p>
                <div className="space-y-1 divide-y divide-slate-100">
                  <BarBreakdown
                    label={`Approvisionnements (${dec?.approvisionnements.count ?? 0})`}
                    montant={dec?.approvisionnements.montant ?? 0}
                    total={dec?.total ?? 1}
                    color="bg-orange-500"
                  />
                </div>

                {/* Résultat net */}
                <div className={`mt-5 p-4 rounded-xl border-2 ${(sd?.resultat_net ?? 0) >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-sm">Résultat Net de la période</span>
                    <span className={`text-xl font-bold ${(sd?.resultat_net ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicateurs snapshot */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Souscriptions actives", value: snap?.souscriptionsActives ?? 0, icon: Users,       color: "text-blue-600",    bg: "bg-blue-50" },
                { label: "Packs disponibles",     value: snap?.packs ?? 0,               icon: BookOpen,    color: "text-violet-600",  bg: "bg-violet-50" },
                { label: "Versements collectés",  value: snap?.versementsTotal ?? 0,     icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Produits en stock",     value: snap?.stock.nombreProduits ?? 0, icon: Package,    color: "text-slate-600",   bg: "bg-slate-100" },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 flex items-center gap-3">
                  <div className={`${item.bg} p-2.5 rounded-xl`}><item.icon className={`${item.color} w-5 h-5`} /></div>
                  <div>
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-xl font-bold text-slate-800">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 2 : JOURNAL DES OPÉRATIONS                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "journal" && (
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
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

                {/* Search */}
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

                {/* Type */}
                <select
                  value={journalType}
                  onChange={(e) => { setJournalView("TOUT"); setJournalType(e.target.value); setJournalPage(1); }}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="TOUS">Tous les types</option>
                  <option value="ENCAISSEMENT">Encaissements</option>
                  <option value="DECAISSEMENT">Décaissements</option>
                </select>

                {/* Catégorie */}
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

                {/* Date range */}
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
                      {Object.entries(JOURNAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                    <button onClick={() => setShowJournalOD(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
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
                        <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">Aucune écriture pour ces filtres</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
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
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 3 : TRÉSORERIE                                             */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "tresorerie" && (
          <div className="space-y-5">

            {/* Résumé trésorerie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ArrowUpRight size={24} /></div>
                  <div>
                    <p className="text-emerald-100 text-xs">Total Encaissements</p>
                    <p className="text-2xl font-bold">{formatCurrency(enc?.total ?? 0)}</p>
                  </div>
                </div>
                <div className="text-xs text-emerald-100 space-y-0.5">
                  <p>Acomptes initiaux : {formatCurrency(enc?.cotisations_init.montant ?? 0)}</p>
                  <p>Versements périodiques : {formatCurrency(enc?.versements_peri.montant ?? 0)}</p>
                  <p>Remboursements : {formatCurrency(enc?.remboursements.montant ?? 0)}</p>
                  <p>Ventes directes : {formatCurrency(enc?.ventes_directes.montant ?? 0)}</p>
                  <p>Encaissements caisse : {formatCurrency(enc?.caisse_encaissements.montant ?? 0)}</p>
                  <p className="opacity-70">Bonus / Ajustements : {formatCurrency(enc?.autres.montant ?? 0)}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ArrowDownRight size={24} /></div>
                  <div>
                    <p className="text-red-100 text-xs">Total Décaissements</p>
                    <p className="text-2xl font-bold">{formatCurrency(dec?.total ?? 0)}</p>
                  </div>
                </div>
                <div className="text-xs text-red-100 space-y-0.5">
                  <p>Approvisionnements : {formatCurrency(dec?.approvisionnements.montant ?? 0)}</p>
                  {(dec?.salaires.montant ?? 0) > 0    && <p>Salaires : {formatCurrency(dec?.salaires.montant ?? 0)}</p>}
                  {(dec?.avances.montant ?? 0) > 0     && <p>Avances : {formatCurrency(dec?.avances.montant ?? 0)}</p>}
                  {(dec?.fournisseurs.montant ?? 0) > 0 && <p>Fournisseurs : {formatCurrency(dec?.fournisseurs.montant ?? 0)}</p>}
                  {(dec?.autres_caisse.montant ?? 0) > 0 && <p className="opacity-70">Autres : {formatCurrency(dec?.autres_caisse.montant ?? 0)}</p>}
                </div>
              </div>

              <div className={`rounded-2xl p-6 text-white shadow-lg ${(sd?.resultat_net ?? 0) >= 0 ? "bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-300" : "bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-200"}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Wallet size={24} /></div>
                  <div>
                    <p className="text-white/80 text-xs">Solde Net de Trésorerie</p>
                    <p className="text-2xl font-bold">{(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}</p>
                  </div>
                </div>
                <p className="text-xs text-white/70">
                  {(sd?.resultat_net ?? 0) >= 0 ? "✓ Trésorerie excédentaire" : "⚠ Trésorerie déficitaire"} sur {selectedPeriod === "365" ? "1 an" : `${selectedPeriod} jours`}
                </p>
                <p className="text-xs text-white/70 mt-1">Taux d&apos;utilisation budget : {sd?.taux_utilisation ?? 0}%</p>
              </div>
            </div>

            {/* Détail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Encaissements par type */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowUpRight size={20} className="text-emerald-600" />Encaissements par type de versement
                </h3>
                {[
                  { label: `Acomptes initiaux (${enc?.cotisations_init.count ?? 0})`,          montant: enc?.cotisations_init.montant ?? 0,           icon: Calendar,     color: "bg-blue-100",    text: "text-blue-600",    bar: "bg-blue-500" },
                  { label: `Versements périodiques (${enc?.versements_peri.count ?? 0})`,       montant: enc?.versements_peri.montant ?? 0,            icon: TrendingUp,   color: "bg-emerald-100", text: "text-emerald-600", bar: "bg-emerald-500" },
                  { label: `Remboursements (${enc?.remboursements.count ?? 0})`,                montant: enc?.remboursements.montant ?? 0,             icon: CheckCircle,  color: "bg-teal-100",    text: "text-teal-600",    bar: "bg-teal-500" },
                  { label: `Ventes directes (${enc?.ventes_directes.count ?? 0})`,             montant: enc?.ventes_directes.montant ?? 0,            icon: ShoppingBag,  color: "bg-indigo-100",  text: "text-indigo-600",  bar: "bg-indigo-500" },
                  { label: `Bonus / Ajust. (${enc?.autres.count ?? 0})`,                       montant: enc?.autres.montant ?? 0,                    icon: BookOpen,     color: "bg-violet-100",  text: "text-violet-600",  bar: "bg-violet-500" },
                  { label: `Encaissements caisse (${enc?.caisse_encaissements.count ?? 0})`,   montant: enc?.caisse_encaissements.montant ?? 0,       icon: Wallet,       color: "bg-cyan-100",    text: "text-cyan-600",    bar: "bg-cyan-500" },
                ].map((item) => {
                  const pct  = (enc?.total ?? 0) > 0 ? Math.round((item.montant / (enc?.total ?? 1)) * 100) : 0;
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                      <div className={`${item.color} p-2 rounded-lg`}>
                        <Icon className={`${item.text} w-4 h-4`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 truncate">{item.label}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${item.bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.montant)}</p>
                        <p className="text-xs text-slate-400">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Décaissements par destination */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowDownRight size={20} className="text-red-600" />Décaissements par destination
                </h3>
                {[
                  { label: `Approvisionnements stock (${dec?.approvisionnements.count ?? 0})`, montant: dec?.approvisionnements.montant ?? 0, icon: Package,        color: "bg-orange-100", text: "text-orange-600", bar: "bg-orange-500" },
                  { label: `Salaires (${dec?.salaires.count ?? 0})`,                           montant: dec?.salaires.montant ?? 0,           icon: Users,          color: "bg-red-100",    text: "text-red-600",    bar: "bg-red-500" },
                  { label: `Avances (${dec?.avances.count ?? 0})`,                             montant: dec?.avances.montant ?? 0,            icon: ArrowDownRight, color: "bg-rose-100",   text: "text-rose-600",   bar: "bg-rose-500" },
                  { label: `Fournisseurs (${dec?.fournisseurs.count ?? 0})`,                   montant: dec?.fournisseurs.montant ?? 0,       icon: Package,        color: "bg-amber-100",  text: "text-amber-600",  bar: "bg-amber-500" },
                  { label: `Autres décaissements (${dec?.autres_caisse.count ?? 0})`,          montant: dec?.autres_caisse.montant ?? 0,      icon: Filter,         color: "bg-slate-100",  text: "text-slate-600",  bar: "bg-slate-400" },
                ].filter((item) => item.montant > 0).map((item) => {
                  const pct  = (dec?.total ?? 0) > 0 ? Math.round((item.montant / (dec?.total ?? 1)) * 100) : 0;
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                      <div className={`${item.color} p-2 rounded-lg`}>
                        <Icon className={`${item.text} w-4 h-4`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 truncate">{item.label}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${item.bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.montant)}</p>
                        <p className="text-xs text-slate-400">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
                {(dec?.total ?? 0) === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">Aucun décaissement sur la période</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 4 : BALANCE COMPTABLE                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "balance" && (
          <div className="space-y-5">
            {/* En-tête */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Calculator size={20} className="text-violet-600" />
                  Balance Comptable — Période {selectedPeriod === "365" ? "1 an" : `${selectedPeriod} jours`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {sd ? `${formatDateShort(sd.periode.debut)} → ${formatDateShort(sd.periode.fin)}` : "…"}
                  &nbsp;·&nbsp;Comptes SYSCOHADA simplifiés
                </p>
              </div>
              <button
                onClick={() => {
                  const rows = [
                    { compte: "701", libelle: "Acomptes initiaux packs",               debit: 0,                                       credit: enc?.cotisations_init.montant ?? 0 },
                    { compte: "702", libelle: "Versements périodiques",                debit: 0,                                       credit: enc?.versements_peri.montant ?? 0 },
                    { compte: "703", libelle: "Remboursements packs",                  debit: 0,                                       credit: enc?.remboursements.montant ?? 0 },
                    { compte: "705", libelle: "Ventes directes de marchandises",       debit: 0,                                       credit: enc?.ventes_directes.montant ?? 0 },
                    { compte: "706", libelle: "Encaissements caisse — produits divers", debit: 0,                                      credit: enc?.caisse_encaissements.montant ?? 0 },
                    { compte: "708", libelle: "Bonus / Ajustements",                   debit: 0,                                       credit: enc?.autres.montant ?? 0 },
                    { compte: "601", libelle: "Approvisionnements — achats stock",    debit: dec?.approvisionnements.montant ?? 0,    credit: 0 },
                    { compte: "641", libelle: "Salaires et traitements",              debit: dec?.salaires.montant ?? 0,              credit: 0 },
                    { compte: "422", libelle: "Avances au personnel",                 debit: dec?.avances.montant ?? 0,               credit: 0 },
                    { compte: "604", libelle: "Paiements fournisseurs",               debit: dec?.fournisseurs.montant ?? 0,          credit: 0 },
                    { compte: "658", libelle: "Autres charges diverses",              debit: dec?.autres_caisse.montant ?? 0,         credit: 0 },
                  ].filter((r) => r.debit > 0 || r.credit > 0);
                  exportToCsv(rows, [
                    { label: "N° Compte", key: "compte" },
                    { label: "Libellé", key: "libelle" },
                    { label: "Débit", key: "debit", format: (v) => formatCurrency(Number(v)) },
                    { label: "Crédit", key: "credit", format: (v) => formatCurrency(Number(v)) },
                  ], `balance-comptable-${selectedPeriod}j.csv`);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
              >
                <Download size={15} />Exporter
              </button>
            </div>

            {/* Table balance */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-24">N° Compte</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Libellé du compte</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Mouvement Débit</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Mouvement Crédit</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {([
                    { compte: "701", libelle: "Acomptes initiaux (souscriptions packs)",    classe: "Classe 7 — Produits", debit: 0, credit: enc?.cotisations_init.montant ?? 0,     count: enc?.cotisations_init.count },
                    { compte: "702", libelle: "Versements périodiques packs",               classe: "Classe 7 — Produits", debit: 0, credit: enc?.versements_peri.montant ?? 0,      count: enc?.versements_peri.count },
                    { compte: "703", libelle: "Remboursements packs",                       classe: "Classe 7 — Produits", debit: 0, credit: enc?.remboursements.montant ?? 0,       count: enc?.remboursements.count },
                    { compte: "705", libelle: "Ventes directes de marchandises",            classe: "Classe 7 — Produits", debit: 0, credit: enc?.ventes_directes.montant ?? 0,      count: enc?.ventes_directes.count },
                    { compte: "706", libelle: "Encaissements caisse — produits divers",    classe: "Classe 7 — Produits", debit: 0, credit: enc?.caisse_encaissements.montant ?? 0, count: enc?.caisse_encaissements.count },
                    { compte: "708", libelle: "Bonus / Ajustements",                        classe: "Classe 7 — Produits", debit: 0, credit: enc?.autres.montant ?? 0,               count: enc?.autres.count },
                    { compte: "601", libelle: "Approvisionnements — achats stock",         classe: "Classe 6 — Charges",  debit: dec?.approvisionnements.montant ?? 0, credit: 0,                                       count: dec?.approvisionnements.count },
                    { compte: "641", libelle: "Salaires et traitements",                   classe: "Classe 6 — Charges",  debit: dec?.salaires.montant ?? 0,           credit: 0,                                       count: dec?.salaires.count },
                    { compte: "422", libelle: "Avances au personnel",                      classe: "Classe 4 — Tiers",    debit: dec?.avances.montant ?? 0,            credit: 0,                                       count: dec?.avances.count },
                    { compte: "604", libelle: "Paiements fournisseurs",                    classe: "Classe 6 — Charges",  debit: dec?.fournisseurs.montant ?? 0,       credit: 0,                                       count: dec?.fournisseurs.count },
                    { compte: "658", libelle: "Autres charges diverses",                   classe: "Classe 6 — Charges",  debit: dec?.autres_caisse.montant ?? 0,      credit: 0,                                       count: dec?.autres_caisse.count },
                  ] as { compte: string; libelle: string; classe: string; debit: number; credit: number; count?: number }[])
                  .filter((row) => row.debit > 0 || row.credit > 0)
                  .map((row) => {
                    const solde = row.credit - row.debit;
                    return (
                      <tr key={row.compte} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-sm font-bold text-violet-700">{row.compte}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-slate-800">{row.libelle}</p>
                          <p className="text-xs text-slate-400">{row.classe}{row.count !== undefined ? ` — ${row.count} opérations` : ""}</p>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-red-600">
                          {row.debit > 0 ? formatCurrency(row.debit) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                          {row.credit > 0 ? formatCurrency(row.credit) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${solde >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {solde >= 0 ? "+" : ""}{formatCurrency(solde)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-5 py-4" colSpan={2}>
                      <span className="font-bold text-slate-800 uppercase text-sm">TOTAUX</span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-red-700 text-base">
                      {formatCurrency(dec?.total ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-700 text-base">
                      {formatCurrency(enc?.total ?? 0)}
                    </td>
                    <td className={`px-5 py-4 text-right font-bold text-base ${(sd?.resultat_net ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Note d'équilibre */}
            <div className={`rounded-2xl p-4 border flex items-start gap-3 ${Math.abs((enc?.total ?? 0) - (dec?.total ?? 0) - (sd?.resultat_net ?? 0)) < 1 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Contrôle de cohérence</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Total Produits (Crédit) : <strong>{formatCurrency(enc?.total ?? 0)}</strong>
                  &nbsp;·&nbsp;Total Charges (Débit) : <strong>{formatCurrency(dec?.total ?? 0)}</strong>
                  &nbsp;·&nbsp;Résultat net : <strong>{formatCurrency(sd?.resultat_net ?? 0)}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 5 : GRAND LIVRE                                            */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "grandlivre" && (
          <div className="space-y-5">
            {/* En-tête + filtre dates */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen size={20} className="text-violet-600" />Grand Livre des Comptes
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Toutes les écritures regroupées par compte</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="date" value={journalDateDebut}
                    onChange={(e) => setJournalDateDebut(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <span className="text-slate-400 text-xs">→</span>
                  <input type="date" value={journalDateFin}
                    onChange={(e) => setJournalDateFin(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
            </div>

            {grandLivreLoading ? (
              <div className="p-16 text-center"><div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
            ) : (
              (() => {
                const entries = grandLivreData?.data ?? [];
                // Group by categorie
                const groups = new Map<string, JournalEntry[]>();
                for (const e of entries) {
                  const list = groups.get(e.categorie) ?? [];
                  list.push(e);
                  groups.set(e.categorie, list);
                }
                const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

                if (sortedGroups.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm border border-slate-200/60">
                      Aucune écriture pour cette période
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    {sortedGroups.map(([cat, catEntries]) => {
                      const meta      = CAT_META[cat] ?? { label: cat, color: "text-slate-600", bg: "bg-slate-100", icon: Filter };
                      const CatIcon   = meta.icon;
                      let runningBal  = 0;
                      const totalDeb  = catEntries.filter((e) => e.type === "DECAISSEMENT").reduce((s, e) => s + e.montant, 0);
                      const totalCred = catEntries.filter((e) => e.type === "ENCAISSEMENT").reduce((s, e) => s + e.montant, 0);

                      return (
                        <div key={cat} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                          {/* Compte header */}
                          <div className={`px-6 py-3 border-b border-slate-200 flex items-center justify-between ${meta.bg}`}>
                            <div className="flex items-center gap-2">
                              <CatIcon size={16} className={meta.color} />
                              <span className={`font-bold ${meta.color}`}>{meta.label}</span>
                              <span className="text-xs text-slate-500 ml-2">{catEntries.length} écritures</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                              <span className="text-red-600">Débit : {formatCurrency(totalDeb)}</span>
                              <span className="text-emerald-600">Crédit : {formatCurrency(totalCred)}</span>
                              <span className={`${(totalCred - totalDeb) >= 0 ? "text-emerald-700" : "text-red-700"} font-bold`}>
                                Solde : {(totalCred - totalDeb) >= 0 ? "+" : ""}{formatCurrency(totalCred - totalDeb)}
                              </span>
                            </div>
                          </div>
                          {/* Écritures */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Référence</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Libellé</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Débit</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Crédit</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Solde cumulé</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {catEntries.map((e) => {
                                  const deb  = e.type === "DECAISSEMENT" ? e.montant : 0;
                                  const cred = e.type === "ENCAISSEMENT" ? e.montant : 0;
                                  runningBal += (cred - deb);
                                  return (
                                    <tr key={e.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDateShort(e.date)}</td>
                                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.reference}</td>
                                      <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={e.libelle}>{e.libelle}</td>
                                      <td className="px-4 py-2 text-right text-red-600">{deb > 0 ? formatCurrency(deb) : <span className="text-slate-200">—</span>}</td>
                                      <td className="px-4 py-2 text-right text-emerald-600">{cred > 0 ? formatCurrency(cred) : <span className="text-slate-200">—</span>}</td>
                                      <td className={`px-4 py-2 text-right font-semibold ${runningBal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {runningBal >= 0 ? "+" : ""}{formatCurrency(runningBal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 6 : ÉTATS FINANCIERS                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "etats" && (
          <div className="space-y-5">

            {/* En-tête + sélecteur d'année */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-violet-600" />États Financiers — Exercice {etatsAnnee}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bilan : snapshot actuel &nbsp;·&nbsp; CPC : 01/01/{etatsAnnee} → 31/12/{etatsAnnee}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setEtatsAnnee((y) => y - 1)}
                  disabled={etatsAnnee <= 2020}
                  className="p-2 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-1.5 bg-violet-600 text-white text-sm font-bold rounded-lg min-w-[64px] text-center">
                  {etatsAnnee}
                </span>
                <button
                  onClick={() => setEtatsAnnee((y) => y + 1)}
                  disabled={etatsAnnee >= new Date().getFullYear()}
                  className="p-2 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {etatsLoading && !ed ? (
              <div className="p-16 text-center"><div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
            ) : ed ? (
              <>
                {/* ── Comparaison N / N-1 ─────────────────────────────────── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="px-6 py-4 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
                    <BarChart3 size={18} className="text-violet-600" />
                    <h3 className="font-bold text-violet-800">
                      Comparaison {etatsAnnee} / {etatsAnnee - 1}
                    </h3>
                    {!edN1 && <span className="ml-auto text-xs text-slate-400 italic">Chargement N-1…</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Indicateur</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-violet-600 uppercase">N ({etatsAnnee})</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">N-1 ({etatsAnnee - 1})</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Évolution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {([
                          { label: "Total Produits",        n: ed.compteResultat.produits.total,   n1: edN1?.compteResultat.produits.total   ?? null, isPct: false },
                          { label: "Total Charges",         n: ed.compteResultat.charges.total,    n1: edN1?.compteResultat.charges.total    ?? null, isPct: false },
                          { label: "Résultat Net",          n: ed.compteResultat.resultatNet,      n1: edN1?.compteResultat.resultatNet      ?? null, isPct: false },
                          { label: "Taux de recouvrement",  n: ed.ratios.tauxRecouvrement,         n1: edN1?.ratios.tauxRecouvrement         ?? null, isPct: true  },
                          { label: "Marge nette",           n: ed.ratios.margeNette,               n1: edN1?.ratios.margeNette               ?? null, isPct: true  },
                          { label: "Ratio charges",         n: ed.ratios.ratioCharges,             n1: edN1?.ratios.ratioCharges             ?? null, isPct: true  },
                        ] as { label: string; n: number; n1: number | null; isPct: boolean }[]).map((row) => {
                          const delta     = row.n1 !== null ? row.n - row.n1 : null;
                          const deltaPct  = (delta !== null && row.n1 !== null && row.n1 !== 0)
                            ? Math.round((delta / Math.abs(row.n1)) * 100)
                            : null;
                          const isPositive = row.label === "Total Charges" || row.label === "Ratio charges"
                            ? (delta ?? 0) <= 0
                            : (delta ?? 0) >= 0;
                          return (
                            <tr key={row.label} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-medium text-slate-700 text-sm">{row.label}</td>
                              <td className="px-5 py-3 text-right font-bold text-slate-800">
                                {row.isPct ? `${row.n}%` : formatCurrency(row.n)}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-400 text-sm">
                                {row.n1 !== null ? (row.isPct ? `${row.n1}%` : formatCurrency(row.n1)) : "—"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {delta !== null ? (
                                  <span className={`inline-flex items-center gap-0.5 font-semibold text-sm ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                    {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {row.isPct
                                      ? `${delta >= 0 ? "+" : ""}${delta}pp`
                                      : `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`}
                                    {deltaPct !== null && <span className="text-xs opacity-60 ml-0.5">({deltaPct > 0 ? "+" : ""}{deltaPct}%)</span>}
                                  </span>
                                ) : <span className="text-slate-300 text-sm">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Bilan ──────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
                      <ArrowUpRight size={18} className="text-emerald-600" />
                      <h3 className="font-bold text-emerald-800">ACTIF — Bilan (snapshot actuel)</h3>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Stock (valeur comptable)" sub={`${ed.bilan.actif.stock.nombreProduits} produits`} valeur={ed.bilan.actif.stock.valeur} />
                      <BilanRow label="Créances packs (à encaisser)" sub={`${ed.bilan.actif.creancesPacks.count} souscriptions ACTIF`} valeur={ed.bilan.actif.creancesPacks.valeur} />
                      <BilanRow label="TOTAL ACTIF" valeur={ed.bilan.actif.total} type="total" />
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
                      <ArrowDownRight size={18} className="text-red-600" />
                      <h3 className="font-bold text-red-800">PASSIF — Bilan (snapshot actuel)</h3>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Engagements packs" sub={`${ed.bilan.passif.engagementsPacks.count} souscriptions actives`} valeur={ed.bilan.passif.engagementsPacks.valeur} />
                      <BilanRow label="Capitaux propres (résiduel)" sub="Actif — Engagements" valeur={ed.bilan.passif.capitauxPropres} />
                      <BilanRow label="TOTAL PASSIF" valeur={ed.bilan.passif.total} type="total" />
                    </div>
                  </div>
                </div>

                {/* ── CPC ────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                      <h3 className="font-bold text-blue-800 flex items-center gap-2"><TrendingUp size={18} />Produits — CPC {etatsAnnee}</h3>
                      <span className="text-xs text-blue-600">01/01/{etatsAnnee} → 31/12/{etatsAnnee}</span>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Versements packs collectés"   valeur={ed.compteResultat.produits.versementsCollectes} />
                      <BilanRow label="Encaissements caisse"          valeur={ed.compteResultat.produits.encaissementsCaisse} />
                      <BilanRow label="Ventes directes"               valeur={ed.compteResultat.produits.ventesDirectes} />
                      <BilanRow label="TOTAL PRODUITS" valeur={ed.compteResultat.produits.total} type="total" />
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                      <h3 className="font-bold text-orange-800 flex items-center gap-2"><TrendingDown size={18} />Charges — CPC {etatsAnnee}</h3>
                      <span className="text-xs text-orange-600">01/01/{etatsAnnee} → 31/12/{etatsAnnee}</span>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Coût des approvisionnements"  valeur={ed.compteResultat.charges.approvisionnements} />
                      {ed.compteResultat.charges.salaires    > 0 && <BilanRow label="Salaires"              valeur={ed.compteResultat.charges.salaires} />}
                      {ed.compteResultat.charges.avances     > 0 && <BilanRow label="Avances"               valeur={ed.compteResultat.charges.avances} />}
                      {ed.compteResultat.charges.fournisseurs > 0 && <BilanRow label="Paiements fournisseurs" valeur={ed.compteResultat.charges.fournisseurs} />}
                      {ed.compteResultat.charges.autresCaisse > 0 && <BilanRow label="Autres décaissements"  valeur={ed.compteResultat.charges.autresCaisse} />}
                      <BilanRow label="TOTAL CHARGES" valeur={ed.compteResultat.charges.total} type="total" />
                    </div>
                    <div className={`mx-6 mb-6 p-4 rounded-xl border-2 ${ed.compteResultat.resultatNet >= 0 ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">Résultat Net {etatsAnnee}</span>
                        <span className={`text-xl font-bold ${ed.compteResultat.resultatNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {ed.compteResultat.resultatNet >= 0 ? "+" : ""}{formatCurrency(ed.compteResultat.resultatNet)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Ratios ─────────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <BarChart3 size={20} className="text-violet-600" />Ratios &amp; Indicateurs — {etatsAnnee}
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Taux de recouvrement", sub: "Versé / Total souscriptions", value: `${ed.ratios.tauxRecouvrement}%`, color: ed.ratios.tauxRecouvrement >= 70 ? "text-emerald-600" : ed.ratios.tauxRecouvrement >= 40 ? "text-amber-600" : "text-red-600", icon: CheckCircle },
                      { label: "Taux de complétion",   sub: "Souscriptions COMPLETE / total", value: `${ed.ratios.tauxCompletion}%`, color: ed.ratios.tauxCompletion >= 60 ? "text-emerald-600" : ed.ratios.tauxCompletion >= 30 ? "text-amber-600" : "text-violet-600", icon: BookOpen },
                      { label: "Marge nette",          sub: "Résultat / Total produits",      value: `${ed.ratios.margeNette}%`,    color: ed.ratios.margeNette >= 20 ? "text-emerald-600" : ed.ratios.margeNette >= 0 ? "text-amber-600" : "text-red-600", icon: TrendingUp },
                      { label: "Ratio charges",        sub: "Charges / Produits",             value: `${ed.ratios.ratioCharges}%`,  color: ed.ratios.ratioCharges <= 70 ? "text-emerald-600" : ed.ratios.ratioCharges <= 90 ? "text-amber-600" : "text-red-600", icon: AlertCircle },
                    ].map((r) => {
                      const Icon = r.icon;
                      return (
                        <div key={r.label} className="bg-slate-50 rounded-xl p-5 text-center border border-slate-200">
                          <Icon className={`${r.color} w-6 h-6 mx-auto mb-2`} />
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{r.label}</p>
                          <p className={`text-3xl font-bold ${r.color}`}>{r.value}</p>
                          <p className="text-xs text-slate-400 mt-1">{r.sub}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Clôtures mensuelles ────────────────────────────────── */}
                {(() => {
                  const moisNoms = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
                  const cloturesMap = new Map<number, ClotureEntry>(
                    (cloturesData?.data ?? []).map((c) => [c.mois, c])
                  );
                  const currentMois = etatsAnnee === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;

                  return (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <Lock size={18} className="text-slate-600" />
                        <h3 className="font-bold text-slate-800">Clôtures Mensuelles — {etatsAnnee}</h3>
                        <span className="ml-auto text-xs text-slate-400">
                          {cloturesMap.size} / {currentMois} mois clôturé{cloturesMap.size > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="p-5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((mois) => {
                          const cloture   = cloturesMap.get(mois);
                          const isPast    = mois <= currentMois;
                          const isFuture  = mois > currentMois;
                          return (
                            <div
                              key={mois}
                              className={`rounded-xl p-3 border text-center transition-all ${
                                cloture
                                  ? "bg-emerald-50 border-emerald-300"
                                  : isFuture
                                  ? "bg-slate-50 border-slate-100 opacity-40"
                                  : "bg-white border-slate-200 hover:border-amber-300"
                              }`}
                            >
                              <div className="flex justify-center mb-1.5">
                                {cloture
                                  ? <Lock size={16} className="text-emerald-600" />
                                  : <LockOpen size={16} className={isFuture ? "text-slate-300" : "text-amber-500"} />
                                }
                              </div>
                              <p className="text-xs font-bold text-slate-700">{moisNoms[mois - 1]}</p>
                              {cloture ? (
                                <>
                                  <p className="text-[10px] text-emerald-600 mt-0.5 leading-tight">{cloture.cloturePar}</p>
                                  <button
                                    onClick={() => openPiecesModal("CLOTURE_COMPTABLE", cloture.id, `Clôture ${moisNoms[mois - 1]} ${etatsAnnee}`)}
                                    className="mt-1 flex items-center justify-center gap-0.5 text-[10px] text-violet-600 hover:text-violet-800 font-semibold mx-auto"
                                  >
                                    <Paperclip size={9} />PJ
                                  </button>
                                  <button
                                    onClick={() => handleOuverture(mois)}
                                    disabled={suppClotureLoading}
                                    className="mt-0.5 text-[10px] text-red-500 hover:underline disabled:opacity-40"
                                  >
                                    Ouvrir
                                  </button>
                                </>
                              ) : isPast ? (
                                <button
                                  onClick={() => { setClotureModal({ mois }); setClotureNotes(""); }}
                                  className="mt-1.5 flex items-center justify-center gap-0.5 text-[10px] text-violet-600 hover:text-violet-800 font-semibold mx-auto"
                                >
                                  <Plus size={10} />Clôturer
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="p-12 text-center text-slate-400">Erreur de chargement des états financiers</div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 7 : PIÈCES JUSTIFICATIVES                                  */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "pieces" && (
          <div className="space-y-5">

            {/* En-tête + filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Paperclip size={20} className="text-violet-600" />Archive des Pièces Justificatives
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Tous les documents attachés aux écritures — archivage 10 ans</p>
                </div>
                {piecesAllData && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {piecesAllData.meta.total} document{piecesAllData.meta.total > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Recherche */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="text" placeholder="Rechercher un fichier…" value={piecesSearch}
                    onChange={(e) => setPiecesSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                </div>

                {/* Type de source */}
                <select value={piecesSourceType} onChange={(e) => { setPiecesSourceType(e.target.value); setPiecesPage(1); }}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Toutes sources</option>
                  {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                {/* Dates */}
                <input type="date" value={piecesDateDebut} onChange={(e) => { setPiecesDateDebut(e.target.value); setPiecesPage(1); }}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <div className="flex gap-2">
                  <input type="date" value={piecesDateFin} onChange={(e) => { setPiecesDateFin(e.target.value); setPiecesPage(1); }}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  {(piecesSearch || piecesSourceType || piecesDateDebut || piecesDateFin) && (
                    <button onClick={() => { setPiecesSearch(""); setPiecesSearchDebounced(""); setPiecesSourceType(""); setPiecesDateDebut(""); setPiecesDateFin(""); setPiecesPage(1); }}
                      className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {piecesAllLoading ? (
                <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date dépôt</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fichier</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Taille</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Déposé par</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Archive jusqu&apos;au</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(piecesAllData?.data ?? []).map((piece) => (
                        <tr key={piece.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDateShort(piece.createdAt)}</td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-slate-800 truncate max-w-xs" title={piece.nom}>{piece.nom}</p>
                            {piece.description && <p className="text-xs text-slate-400 truncate">{piece.description}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-semibold">
                              {SOURCE_TYPE_LABELS[piece.sourceType] ?? piece.sourceType}
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5">#{piece.sourceId}</p>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            {piece.type.includes("pdf") ? "📄 PDF" : piece.type.includes("image") ? "🖼️ Image" : piece.type}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{formatTaille(piece.taille)}</td>
                          <td className="px-5 py-3 text-sm text-slate-600">{piece.uploadeUser.prenom} {piece.uploadeUser.nom}</td>
                          <td className="px-5 py-3 text-xs text-slate-400">{formatDateShort(piece.archiverJusquau)}</td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <a href={piece.url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger">
                                <ExternalLink size={15} />
                              </a>
                              <button onClick={() => supprimerPiece(piece.id)}
                                disabled={piecesSuppLoading === piece.id}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40" title="Supprimer">
                                {piecesSuppLoading === piece.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                                  : <Trash2 size={15} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(piecesAllData?.data ?? []).length === 0 && !piecesAllLoading && (
                        <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">Aucune pièce justificative trouvée</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {piecesAllData && piecesAllData.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">Page <b>{piecesAllData.meta.page}</b> / <b>{piecesAllData.meta.totalPages}</b></p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPiecesPage((p) => Math.max(1, p - 1))} disabled={piecesPage <= 1}
                      className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold">{piecesPage}</span>
                    <button onClick={() => setPiecesPage((p) => Math.min(piecesAllData.meta.totalPages, p + 1))} disabled={piecesPage >= piecesAllData.meta.totalPages}
                      className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modal confirmation clôture ── */}
        {/* ── Modal pièces justificatives ── */}
        {piecesModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">

              {/* Header */}
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

              {/* Liste des fichiers */}
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
                        <p className="text-xs text-slate-400">
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

              {/* Zone upload */}
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Upload size={12} />Ajouter un document (PDF ou image, max 16 Mo)
                </p>
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
                        }),
                      });
                    }
                    fetchPiecesModal(piecesModal.sourceType, piecesModal.sourceId);
                    refetchPiecesAll();
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

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB : PLAN COMPTABLE                                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "plan" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookMarked className="text-violet-600" size={20} /> Plan Comptable SYSCOHADA
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {planData?.meta.total ?? "…"} comptes · {planData?.stats.length ?? 0} classes
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleImportSyscohada}
                  disabled={importLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importLoading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <ListChecks size={15} />}
                  Importer SYSCOHADA
                </button>
                <button
                  onClick={() => setShowAddCompte(!showAddCompte)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"
                >
                  <PlusCircle size={15} /> Nouveau compte
                </button>
              </div>
            </div>

            {/* Formulaire ajout */}
            {showAddCompte && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-violet-600" /> Nouveau compte</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Numéro *</label>
                    <input value={newCompte.numero} onChange={(e) => setNewCompte(p => ({ ...p, numero: e.target.value }))}
                      placeholder="ex: 411" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
                    <input value={newCompte.libelle} onChange={(e) => setNewCompte(p => ({ ...p, libelle: e.target.value }))}
                      placeholder="ex: Clients" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Classe</label>
                    <select value={newCompte.classe} onChange={(e) => setNewCompte(p => ({ ...p, classe: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {[1,2,3,4,5,6,7,8,9].map(c => <option key={c} value={c}>{c} — {["Ressources durables","Actifs immobilisés","Stocks","Comptes de tiers","Trésorerie","Charges","Produits","Comptes spéciaux","Hors bilan"][c-1]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                    <select value={newCompte.type} onChange={(e) => setNewCompte(p => ({ ...p, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {Object.entries(TYPE_COMPTE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Sens</label>
                    <select value={newCompte.sens} onChange={(e) => setNewCompte(p => ({ ...p, sens: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <option value="DEBITEUR">Débiteur</option>
                      <option value="CREDITEUR">Créditeur</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowAddCompte(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
                  <button onClick={handleCreateCompte} disabled={creatingCompte || !newCompte.numero || !newCompte.libelle}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                    {creatingCompte ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Créer
                  </button>
                </div>
              </div>
            )}

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={planSearch} onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Rechercher numéro ou libellé…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <select value={planClasse} onChange={(e) => { setPlanClasse(e.target.value); setPlanPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Toutes les classes</option>
                {[1,2,3,4,5,6,7].map(c => <option key={c} value={c}>Classe {c}</option>)}
              </select>
              <select value={planType} onChange={(e) => { setPlanType(e.target.value); setPlanPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous types</option>
                {Object.entries(TYPE_COMPTE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Tableau plan */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {planLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Numéro</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Libellé</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Classe</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Sens</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(planData?.data ?? []).map((c) => (
                      <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${!c.actif ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 font-mono font-bold text-violet-700">{c.numero}</td>
                        <td className="px-4 py-3 text-slate-800">
                          {editCompte?.id === c.id ? (
                            <input value={editCompte.libelle} onChange={(e) => setEditCompte({ ...editCompte, libelle: e.target.value })}
                              className="w-full px-2 py-1 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                          ) : c.libelle}
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{c.classe}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            c.type === "ACTIF" ? "bg-blue-50 text-blue-700" :
                            c.type === "PASSIF" ? "bg-purple-50 text-purple-700" :
                            c.type === "CHARGES" ? "bg-red-50 text-red-700" :
                            c.type === "PRODUITS" ? "bg-emerald-50 text-emerald-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>{TYPE_COMPTE_LABELS[c.type] ?? c.type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{c.sens === "DEBITEUR" ? "Débiteur" : "Créditeur"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {c.actif ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {editCompte?.id === c.id ? (
                              <>
                                <button onClick={handleSaveEditCompte} disabled={patchingCompte}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={14} /></button>
                                <button onClick={() => setEditCompte(null)}
                                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                              </>
                            ) : (
                              <button onClick={() => setEditCompte(c)}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                            )}
                            <button onClick={() => handleToggleCompte(c)}
                              className={`p-1.5 rounded-lg ${c.actif ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`}
                              title={c.actif ? "Désactiver" : "Activer"}>
                              {c.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(planData?.data ?? []).length === 0 && !planLoading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          <BookMarked size={32} className="mx-auto mb-2 opacity-30" />
                          <p>Aucun compte. Importez le plan SYSCOHADA ou ajoutez des comptes manuellement.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {/* Pagination */}
              {planData && planData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <span className="text-xs text-slate-500">{planData.meta.total} comptes · page {planPage}/{planData.meta.totalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPlanPage(p => Math.max(1, p - 1))} disabled={planPage === 1}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                    <button onClick={() => setPlanPage(p => Math.min(planData.meta.totalPages, p + 1))} disabled={planPage === planData.meta.totalPages}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB : SAISIE DES ÉCRITURES                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "saisie" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Edit2 className="text-violet-600" size={20} /> Saisie des écritures comptables
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
                <button onClick={() => setShowSaisie(!showSaisie)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
                  <PlusCircle size={15} /> Nouvelle écriture
                </button>
              </div>
            </div>

            {/* Formulaire saisie */}
            {showSaisie && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Edit2 size={16} className="text-violet-600" /> Saisie d&apos;écriture</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
                    <input type="date" value={saisieForm.date} onChange={(e) => setSaisieForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
                    <input value={saisieForm.libelle} onChange={(e) => setSaisieForm(p => ({ ...p, libelle: e.target.value }))}
                      placeholder="ex: Règlement fournisseur DUPONT…"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Journal *</label>
                    <select value={saisieForm.journal} onChange={(e) => setSaisieForm(p => ({ ...p, journal: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {Object.entries(JOURNAL_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                {/* Lignes d'écriture */}
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">N° Compte</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Libellé ligne</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Débit</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Crédit</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">TVA</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {saisieLignes.map((ligne, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input value={String(ligne.compteId)} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, compteId: e.target.value as unknown as number | "" } : l))}
                              placeholder="411" className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-400" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={ligne.libelle} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, libelle: e.target.value } : l))}
                              placeholder="Libellé…" className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" value={ligne.debit} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, debit: e.target.value, credit: e.target.value ? "" : l.credit } : l))}
                              placeholder="0" className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 [appearance:textfield]" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" value={ligne.credit} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, credit: e.target.value, debit: e.target.value ? "" : l.debit } : l))}
                              placeholder="0" className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400 [appearance:textfield]" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={ligne.isTva} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, isTva: e.target.checked } : l))}
                              className="w-4 h-4 accent-violet-600 rounded" />
                          </td>
                          <td className="px-2 py-2">
                            {saisieLignes.length > 2 && (
                              <button onClick={() => setSaisieLignes(ls => ls.filter((_, j) => j !== i))}
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
                          {formatCurrency(saisieLignes.reduce((s, l) => s + Number(l.debit || 0), 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">
                          {formatCurrency(saisieLignes.reduce((s, l) => s + Number(l.credit || 0), 0))}
                        </td>
                        <td colSpan={2} className="px-3 py-2 text-center">
                          {Math.abs(saisieLignes.reduce((s, l) => s + Number(l.debit || 0), 0) - saisieLignes.reduce((s, l) => s + Number(l.credit || 0), 0)) < 0.01 && saisieLignes.some(l => Number(l.debit) > 0 || Number(l.credit) > 0) ? (
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
                  <button onClick={() => setSaisieLignes(ls => [...ls, { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "" }])}
                    className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium">
                    <Plus size={14} /> Ajouter une ligne
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setShowSaisie(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
                    <button onClick={handleSaisieSubmit}
                      disabled={creatingEcriture || !saisieForm.libelle || !saisieForm.date}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                      {creatingEcriture ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Bloc synchronisation automatique ── */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-5 border border-indigo-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={18} className="text-indigo-600" />
                <h4 className="font-bold text-indigo-900">Alimentation automatique des journaux</h4>
              </div>
              <p className="text-xs text-indigo-700 mb-4">
                Importe les opérations des modules (Caisse, Ventes, Achats) et génère les écritures SYSCOHADA en double entrée.
                Les doublons sont automatiquement ignorés. Les écritures créées sont en <strong>brouillon</strong> — vous devez les valider.
              </p>

              {/* Aperçu des opérations non encore importées */}
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

              {/* Filtre date optionnel */}
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

              {/* Boutons sync par journal */}
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

              {/* Résultat de la synchronisation */}
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
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex gap-3 flex-wrap">
              <select value={ecrituresJournal} onChange={(e) => { setEcrituresJournal(e.target.value); setEcrituresPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous les journaux</option>
                {Object.entries(JOURNAL_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={ecrituresStatut} onChange={(e) => { setEcrituresStatut(e.target.value); setEcrituresPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous statuts</option>
                <option value="BROUILLON">Brouillon</option>
                <option value="VALIDE">Validé</option>
                <option value="ANNULE">Annulé</option>
              </select>
              <input type="date" value={ecrituresDateMin} onChange={(e) => { setEcrituresDateMin(e.target.value); setEcrituresPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Du" />
              <input type="date" value={ecrituresDateMax} onChange={(e) => { setEcrituresDateMax(e.target.value); setEcrituresPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Au" />
              <button onClick={() => exportToCsv(ecrituresData?.data?.flatMap(e => e.lignes.map(l => ({ ref: e.reference, date: e.date.slice(0,10), journal: e.journal, libelle: l.libelle, compte: l.compte.numero, debit: l.debit, credit: l.credit }))) ?? [], [{ label: "Référence", key: "ref" }, { label: "Date", key: "date" }, { label: "Journal", key: "journal" }, { label: "Libellé", key: "libelle" }, { label: "Compte", key: "compte" }, { label: "Débit", key: "debit" }, { label: "Crédit", key: "credit" }], "ecritures.csv")}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                <Download size={14} /> CSV
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
                          {e.user && <span className="text-xs text-slate-400">{e.user.prenom} {e.user.nom}</span>}
                        </div>
                        <div className="flex items-center gap-1">
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
                            <button onClick={() => handleAnnulerEcriture(e.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50">
                              <X size={13} /> Annuler
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
                              <td className="px-3 py-1.5 text-slate-600">{l.libelle}</td>
                              <td className="px-5 py-1.5 text-right font-medium text-blue-700">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : ""}</td>
                              <td className="px-5 py-1.5 text-right font-medium text-emerald-700">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : ""}</td>
                              <td className="px-3 py-1.5 text-center">{l.isTva && <span className="text-amber-600 font-semibold">TVA {l.tauxTva}%</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                          <tr>
                            <td colSpan={2} className="px-5 py-1.5 font-bold text-slate-600 text-xs">Total</td>
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
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB : TVA                                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "tva" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Percent className="text-violet-600" size={20} /> Déclaration TVA — Taux 18% (Togo)
              </h3>

              {/* Formulaire */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-700 text-sm">Nouvelle déclaration</h4>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Période (mois)</label>
                    <input type="month" value={tvaPeriode} onChange={(e) => setTvaPeriode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <button onClick={handleCalculerTva}
                    className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-200">
                    <ChevronsUpDown size={15} /> Calculer auto depuis les écritures validées
                  </button>
                  {tvaCalcResult && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm space-y-1">
                      <p className="font-semibold text-indigo-800">Résultat du calcul :</p>
                      <p>TVA collectée : <strong>{formatCurrency(tvaCalcResult.tvaCollectee)}</strong></p>
                      <p>TVA déductible : <strong>{formatCurrency(tvaCalcResult.tvaDeductible)}</strong></p>
                      <p className="font-bold text-indigo-900">TVA due : {formatCurrency(tvaCalcResult.tvaDue)}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">TVA collectée (FCFA)</label>
                      <input type="number" min="0" value={tvaCollecteeInput} onChange={(e) => setTvaCollecteeInput(e.target.value)}
                        placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">TVA déductible (FCFA)</label>
                      <input type="number" min="0" value={tvaDeductibleInput} onChange={(e) => setTvaDeductibleInput(e.target.value)}
                        placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                    </div>
                  </div>
                  {tvaCollecteeInput !== "" && tvaDeductibleInput !== "" && (
                    <div className={`rounded-xl p-3 text-sm font-semibold ${Number(tvaCollecteeInput) >= Number(tvaDeductibleInput) ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>
                      TVA nette due : {formatCurrency(Math.max(0, Number(tvaCollecteeInput) - Number(tvaDeductibleInput)))}
                      {Number(tvaDeductibleInput) > Number(tvaCollecteeInput) && (
                        <span className="ml-2 text-xs font-normal text-blue-600">(crédit de TVA : {formatCurrency(Number(tvaDeductibleInput) - Number(tvaCollecteeInput))})</span>
                      )}
                    </div>
                  )}
                  <textarea value={tvaNotes} onChange={(e) => setTvaNotes(e.target.value)}
                    placeholder="Notes…" rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                  <button onClick={handleEnregistrerTva}
                    disabled={enregistrantTva || !tvaPeriode || tvaCollecteeInput === "" || tvaDeductibleInput === ""}
                    className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                    {enregistrantTva ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Enregistrer la déclaration
                  </button>
                </div>

                {/* Historique TVA */}
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm mb-3">Historique des déclarations</h4>
                  {tvaLoading ? (
                    <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
                  ) : (tvaData?.data ?? []).length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">Aucune déclaration enregistrée.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {(tvaData?.data ?? []).map((d) => (
                        <div key={d.id} className="border border-slate-100 rounded-xl p-3 hover:border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-800">{d.periode}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.statut === "SOUMIS" ? "bg-emerald-50 text-emerald-700" : d.statut === "EN_ATTENTE" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{d.statut}</span>
                              {d.statut === "EN_ATTENTE" && (
                                <button onClick={() => validerTva({ id: d.id, statut: "SOUMIS" }).then(() => refetchTva())}
                                  className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Valider</button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                            <div><span className="text-slate-400">Collectée</span><br /><strong className="text-red-600">{formatCurrency(Number(d.tvaCollectee))}</strong></div>
                            <div><span className="text-slate-400">Déductible</span><br /><strong className="text-blue-600">{formatCurrency(Number(d.tvaDeductible))}</strong></div>
                            <div><span className="text-slate-400">Nette due</span><br /><strong className="text-emerald-700">{formatCurrency(Number(d.tvaDue))}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB : RAPPROCHEMENT BANCAIRE                                  */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "rapprochement" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Building2 className="text-violet-600" size={20} /> Rapprochement Bancaire
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formulaire */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-700 text-sm">Nouveau rapprochement</h4>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Période (mois)</label>
                    <input type="month" value={rapproPeriode} onChange={(e) => setRapproPeriode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Solde bancaire réel (relevé de compte)</label>
                    <input type="number" value={soldeBancaireInput} onChange={(e) => setSoldeBancaireInput(e.target.value)}
                      placeholder="ex: 1500000" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                    <p className="text-xs text-slate-400 mt-1">Le solde comptable sera calculé automatiquement depuis les écritures validées du compte 521 (Banque).</p>
                  </div>
                  <textarea value={rapproNotes} onChange={(e) => setRapproNotes(e.target.value)}
                    placeholder="Notes ou observations…" rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                  <button onClick={handleEnregistrerRappro}
                    disabled={enregistrantRappro || !rapproPeriode || soldeBancaireInput === ""}
                    className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                    {enregistrantRappro ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ChevronsUpDown size={15} />} Calculer & Enregistrer
                  </button>
                </div>

                {/* Historique rapprochements */}
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm mb-3">Historique des rapprochements</h4>
                  {rapproLoading ? (
                    <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
                  ) : (rapproData?.data ?? []).length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">Aucun rapprochement enregistré.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {(rapproData?.data ?? []).map((r) => {
                        const rapproche = Math.abs(Number(r.ecart)) < 0.01;
                        return (
                          <div key={r.id} className={`border rounded-xl p-3 hover:border-slate-200 ${rapproche ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-slate-800">{r.periode}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rapproche ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {rapproche ? "Rapproché" : `Écart : ${formatCurrency(Math.abs(Number(r.ecart)))}`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div><span className="text-slate-400">Solde bancaire</span><br /><strong className="text-slate-800">{formatCurrency(Number(r.soldeBancaireReel))}</strong></div>
                              <div><span className="text-slate-400">Solde comptable</span><br /><strong className="text-slate-800">{formatCurrency(Number(r.soldeComptable))}</strong></div>
                              <div><span className="text-slate-400">Écart</span><br /><strong className={rapproche ? "text-emerald-600" : "text-red-600"}>{formatCurrency(Number(r.ecart))}</strong></div>
                            </div>
                            {r.notes && <p className="text-xs text-slate-400 italic mt-1.5">{r.notes}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {rapproData && rapproData.meta.totalPages > 1 && (
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setRapproPage(p => Math.max(1, p - 1))} disabled={rapproPage === 1}
                        className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronLeft size={13} /></button>
                      <button onClick={() => setRapproPage(p => Math.min(rapproData.meta.totalPages, p + 1))} disabled={rapproPage === rapproData.meta.totalPages}
                        className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronRight size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {clotureModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <Lock size={20} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Clôturer la période</h3>
                  <p className="text-xs text-slate-500">
                    {["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][clotureModal.mois - 1]} {etatsAnnee}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                La clôture verrouille cette période. Elle restera modifiable par un comptable autorisé.
              </p>
              <textarea
                value={clotureNotes}
                onChange={(e) => setClotureNotes(e.target.value)}
                placeholder="Notes de clôture (optionnel)…"
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setClotureModal(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleCloture(clotureModal.mois)}
                  disabled={clotureLoading}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clotureLoading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Lock size={15} />
                  }
                  Clôturer
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

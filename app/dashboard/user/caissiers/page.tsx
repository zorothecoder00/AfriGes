"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingCart, Receipt, TrendingUp, Search, ArrowLeft, RefreshCw,
  Plus, X, CheckCircle, Clock, Banknote, Printer, BarChart3,
  Users, Hash, AlertTriangle, AlertCircle, Info, ChevronLeft, ChevronRight,
  Lock, Calendar, FileText, Filter, Layers, Eye, XCircle, Package,
  Wallet, Power, Pause, Play, ArrowDownCircle, ArrowUpCircle,
  ArrowLeftRight, CreditCard, Building2, Send,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

// ============================================================================
// TYPES
// ============================================================================

interface EcheanceRetard {
  id: number; numero: number; montant: number; datePrevue: string;
  packNom: string; packType: string;
  client: { nom: string; prenom: string; telephone: string } | null;
}

interface SessionCaisse {
  id: number; caissierNom: string; caissierId: number;
  fondsCaisse: number; statut: "OUVERTE" | "SUSPENDUE" | "FERMEE";
  dateOuverture: string; dateFermeture: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
}

interface OperationCaisse {
  id: number; sessionId: number;
  type: "ENCAISSEMENT" | "DECAISSEMENT";
  mode: "ESPECES" | "VIREMENT" | "CHEQUE" | null;
  categorie: "SALAIRE" | "AVANCE" | "FOURNISSEUR" | "AUTRE" | null;
  montant: number; motif: string; reference: string;
  operateurNom: string; createdAt: string;
}

interface TransfertCaisse {
  id: number; sessionId: number;
  origine: string; destination: string;
  montant: number; motif: string | null;
  reference: string; operateurNom: string; createdAt: string;
}

interface DashboardData {
  today: { date: string; startOfDay: string };
  sessionActive: {
    id: number; statut: "OUVERTE" | "SUSPENDUE" | "FERMEE";
    fondsCaisse: number; dateOuverture: string; caissierNom: string;
  } | null;
  soldeTempsReel: number;
  operationsJour: { encaissements: number; decaissements: number; transferts: number };
  versements: { total: number; montant: number; nbClients: number };
  stock: {
    total: number; faible: number; rupture: number; valeur: number;
    produitsAlerte: { id: number; nom: string; stock: number; alerteStock: number }[];
  };
  souscriptionsActives: number;
  souscriptionsEnAttente: number;
  echeancesEnRetard: EcheanceRetard[];
  derniereCloture: ClotureCaisse | null;
  alertes: { type: "danger" | "warning" | "info"; message: string }[];
  derniersVersements: {
    id: number; packNom: string; packType: string;
    montant: number; clientNom: string; type: string; heure: string;
  }[];
}
interface DashboardResponse { success: boolean; data: DashboardData }

interface Versement {
  id: number;
  montant: string;
  type: string;
  datePaiement: string;
  notes: string | null;
  encaisseParNom: string | null;
  souscription: {
    id: number;
    statut: string;
    montantTotal: string;
    montantVerse: string;
    montantRestant: string;
    pack:   { id: number; nom: string; type: string };
    client: { id: number; nom: string; prenom: string; telephone: string } | null;
    user:   { id: number; nom: string; prenom: string; telephone: string } | null;
  };
}
interface VersementsResponse {
  success: boolean;
  data: Versement[];
  stats: { totalVentes: number; montantTotal: number; panierMoyen: number; quantiteTotale: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface ClotureCaisse {
  id: number; date: string; caissierNom: string;
  totalVentes: number; montantTotal: number; panierMoyen: number;
  nbClients: number; notes: string | null; createdAt: string;
  fondsCaisse?: number;
  totalEncaissementsAutres?: number;
  totalDecaissements?: number;
  totalTransferts?: number;
  soldeTheorique?: number;
  soldeReel?: number | null;
  ecart?: number | null;
}
interface ClotureData {
  success: boolean;
  jourEnCours: {
    date: string; totalVentes: number; montantTotal: number; panierMoyen: number; nbClients: number;
    dejaClothuree: boolean; clotureDuJour: ClotureCaisse | null;
    bilanParProduit: { nom: string; quantite: number; montant: number }[];
    ventesDetail: { id: number; produit: string; quantite: number; montant: number; clientNom: string; heure: string }[];
    totalEncaissementsAutres: number;
    totalDecaissements: number;
    encaissementsDetail: { id: number; reference: string; montant: number; motif: string; mode: string | null; operateur: string; heure: string }[];
    decaissementsDetail: { id: number; reference: string; montant: number; motif: string; categorie: string | null; operateur: string; heure: string }[];
  };
  historique: {
    data: ClotureCaisse[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
}

interface EcheanceItem {
  id: number; numero: number; montant: string; datePrevue: string; statut: string;
}
interface SouscriptionItem {
  id: number;
  statut: string;
  montantTotal: string;
  montantVerse: string;
  montantRestant: string;
  numeroCycle: number;
  pack: { nom: string; type: string; frequenceVersement: string };
  user:   { nom: string; prenom: string; telephone: string } | null;
  client: { nom: string; prenom: string; telephone: string } | null;
  _count: { versements: number };
  echeances: EcheanceItem[];
}
interface PackItem { id: number; nom: string; type: string }
interface PacksResponse { souscriptions: SouscriptionItem[]; packs: PackItem[] }

interface RecuData {
  success: boolean;
  data: {
    recu: { numero: string; date: string; caissier: string };
    versement: { id: number; montant: number; type: string; typeLabel: string; notes: string | null };
    souscription: { packNom: string; packType: string; montantTotal: number; montantVerse: number; montantRestant: number; statut: string };
    client: { nom: string; telephone?: string };
    entreprise: { nom: string; adresse: string; telephone: string };
  };
}

interface RecuOperationData {
  success: boolean;
  type: "operation";
  data: {
    recu: { numero: string; date: string; caissier: string };
    operation: { montant: number; motif: string; categorieLabel: string; reference: string; type: string };
    entreprise: { nom: string; adresse: string; telephone: string };
  };
}

// ============================================================================
// HELPERS
// ============================================================================

type TabKey = "synthese" | "session" | "encaissement_caisse" | "decaissement" | "transferts" | "packs" | "historique" | "recus" | "cloture";

function alertIcon(type: "danger" | "warning" | "info") {
  if (type === "danger")  return <XCircle      className="w-4 h-4 text-red-500 shrink-0"    />;
  if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return                         <Info          className="w-4 h-4 text-blue-500 shrink-0"  />;
}
function alertBg(type: "danger" | "warning" | "info") {
  if (type === "danger")  return "bg-red-50 border-red-200";
  if (type === "warning") return "bg-amber-50 border-amber-200";
  return "bg-blue-50 border-blue-200";
}

function packTypeBadge(type: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ALIMENTAIRE:     { label: "Alimentaire",     cls: "bg-emerald-100 text-emerald-700" },
    REVENDEUR:       { label: "Revendeur",        cls: "bg-sky-100 text-sky-700"         },
    FAMILIAL:        { label: "Familial",         cls: "bg-violet-100 text-violet-700"   },
    URGENCE:         { label: "Urgence",          cls: "bg-red-100 text-red-700"         },
    EPARGNE_PRODUIT: { label: "Épargne-Produit",  cls: "bg-amber-100 text-amber-700"     },
    FIDELITE:        { label: "Fidélité",         cls: "bg-pink-100 text-pink-700"       },
  };
  const d = map[type] ?? { label: type, cls: "bg-slate-100 text-slate-700" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.cls}`}>{d.label}</span>;
}

function versementTypeLabel(type: string) {
  const m: Record<string, string> = {
    COTISATION_INITIALE:  "Acompte",
    VERSEMENT_PERIODIQUE: "Versement",
    REMBOURSEMENT:        "Remboursement",
    BONUS:                "Bonus",
    AJUSTEMENT:           "Ajustement",
  };
  return m[type] ?? type;
}

function modePaiementLabel(mode: string | null) {
  const m: Record<string, string> = { ESPECES: "Espèces", VIREMENT: "Virement", CHEQUE: "Chèque" };
  return mode ? (m[mode] ?? mode) : "—";
}

function categorieLabel(cat: string | null) {
  const m: Record<string, string> = { SALAIRE: "Salaire", AVANCE: "Avance", FOURNISSEUR: "Fournisseur", AUTRE: "Autre" };
  return cat ? (m[cat] ?? cat) : "—";
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function KpiCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`${bg} p-2.5 rounded-xl group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-5 h-5`} />
        </div>
      </div>
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function TicketRecu({ data, onClose }: { data: RecuData["data"]; onClose: () => void }) {
  const handlePrint = useCallback(() => {
    const win = window.open("", "_blank", "width=400,height=650");
    if (!win) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Reçu ${data.recu.numero}</title>
    <style>
      body{font-family:monospace;font-size:12px;max-width:300px;margin:0 auto;padding:16px}
      .center{text-align:center} .bold{font-weight:bold} .big{font-size:18px}
      .line{border-top:1px dashed #333;margin:8px 0}
      .row{display:flex;justify-content:space-between;margin:3px 0}
      .total{font-size:16px;font-weight:bold}
    </style></head><body>
    <div class="center bold big">${data.entreprise.nom}</div>
    ${data.entreprise.adresse ? `<div class="center">${data.entreprise.adresse}</div>` : ""}
    ${data.entreprise.telephone ? `<div class="center">Tél: ${data.entreprise.telephone}</div>` : ""}
    <div class="line"></div>
    <div class="center bold">REÇU DE VERSEMENT</div>
    <div class="center">${data.recu.numero}</div>
    <div class="center">${new Date(data.recu.date).toLocaleString("fr-FR")}</div>
    <div class="center">Caissier: ${data.recu.caissier}</div>
    <div class="line"></div>
    <div class="row"><span>Client :</span><span class="bold">${data.client.nom}</span></div>
    ${data.client.telephone ? `<div class="row"><span>Tél :</span><span>${data.client.telephone}</span></div>` : ""}
    <div class="line"></div>
    <div class="row"><span>Pack :</span><span class="bold">${data.souscription.packNom}</span></div>
    <div class="row"><span>Type versement :</span><span>${data.versement.typeLabel}</span></div>
    <div class="line"></div>
    <div class="row total"><span>MONTANT VERSÉ</span><span>${data.versement.montant.toLocaleString("fr-FR")} FCFA</span></div>
    <div class="line"></div>
    <div class="row"><span>Total du pack :</span><span>${data.souscription.montantTotal.toLocaleString("fr-FR")} FCFA</span></div>
    <div class="row"><span>Total versé :</span><span>${data.souscription.montantVerse.toLocaleString("fr-FR")} FCFA</span></div>
    <div class="row bold"><span>Reste à verser :</span><span>${data.souscription.montantRestant.toLocaleString("fr-FR")} FCFA</span></div>
    ${data.versement.notes ? `<div class="line"></div><div class="row"><span>Note :</span><span>${data.versement.notes}</span></div>` : ""}
    <div class="line"></div>
    <div class="center">Merci de votre confiance !</div>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [data]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-xl"><Receipt className="text-emerald-600 w-5 h-5" /></div>
            <div>
              <p className="font-bold text-slate-800">Reçu de versement</p>
              <p className="text-xs text-slate-500">{data.recu.numero}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 font-mono text-sm space-y-1">
          <p className="text-center font-bold text-base">{data.entreprise.nom}</p>
          {data.entreprise.adresse && <p className="text-center text-xs text-slate-500">{data.entreprise.adresse}</p>}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="text-center">
            <p className="font-bold">REÇU DE VERSEMENT</p>
            <p className="text-xs text-slate-500">{new Date(data.recu.date).toLocaleString("fr-FR")}</p>
            <p className="text-xs text-slate-500">Caissier : {data.recu.caissier}</p>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between text-xs"><span className="text-slate-500">Client</span><span className="font-semibold">{data.client.nom}</span></div>
          {data.client.telephone && <div className="flex justify-between text-xs"><span className="text-slate-500">Tél</span><span>{data.client.telephone}</span></div>}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between text-xs"><span className="text-slate-500">Pack</span><span className="font-semibold">{data.souscription.packNom}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500">Type</span><span>{data.versement.typeLabel}</span></div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between font-bold text-base">
            <span>MONTANT VERSÉ</span>
            <span className="text-emerald-600">{formatCurrency(data.versement.montant)}</span>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between text-xs"><span className="text-slate-500">Total pack</span><span>{formatCurrency(data.souscription.montantTotal)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500">Total versé</span><span>{formatCurrency(data.souscription.montantVerse)}</span></div>
          <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Reste à payer</span><span className={data.souscription.montantRestant > 0 ? "text-amber-600" : "text-emerald-600"}>{formatCurrency(data.souscription.montantRestant)}</span></div>
          {data.versement.notes && (
            <>
              <div className="border-t border-dashed border-slate-300 my-3" />
              <p className="text-xs text-slate-500">Note : {data.versement.notes}</p>
            </>
          )}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <p className="text-center text-xs text-slate-400">Merci de votre confiance !</p>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-sky-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={16} />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketDecaissement({ data, onClose }: { data: RecuOperationData["data"]; onClose: () => void }) {
  const isDecaissement = data.operation.type === "DECAISSEMENT";
  const titre = isDecaissement ? "REÇU DE DÉCAISSEMENT" : "REÇU D'ENCAISSEMENT";

  const handlePrint = useCallback(() => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Reçu ${data.recu.numero}</title>
    <style>
      body{font-family:monospace;font-size:12px;max-width:300px;margin:0 auto;padding:16px}
      .center{text-align:center} .bold{font-weight:bold} .big{font-size:18px}
      .line{border-top:1px dashed #333;margin:8px 0}
      .row{display:flex;justify-content:space-between;margin:3px 0}
      .total{font-size:16px;font-weight:bold}
    </style></head><body>
    <div class="center bold big">${data.entreprise.nom}</div>
    ${data.entreprise.adresse ? `<div class="center">${data.entreprise.adresse}</div>` : ""}
    ${data.entreprise.telephone ? `<div class="center">Tél: ${data.entreprise.telephone}</div>` : ""}
    <div class="line"></div>
    <div class="center bold">${titre}</div>
    <div class="center">${data.recu.numero}</div>
    <div class="center">${new Date(data.recu.date).toLocaleString("fr-FR")}</div>
    <div class="center">Caissier: ${data.recu.caissier}</div>
    <div class="line"></div>
    <div class="row"><span>Catégorie :</span><span class="bold">${data.operation.categorieLabel}</span></div>
    <div class="row"><span>Motif :</span><span>${data.operation.motif}</span></div>
    <div class="line"></div>
    <div class="row total"><span>MONTANT</span><span>${data.operation.montant.toLocaleString("fr-FR")} FCFA</span></div>
    <div class="line"></div>
    <div class="center">Document officiel de caisse</div>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [data, titre]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-2.5 rounded-xl"><Receipt className="text-red-600 w-5 h-5" /></div>
            <div>
              <p className="font-bold text-slate-800">{isDecaissement ? "Reçu de décaissement" : "Reçu d'encaissement"}</p>
              <p className="text-xs text-slate-500">{data.recu.numero}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 font-mono text-sm space-y-1">
          <p className="text-center font-bold text-base">{data.entreprise.nom}</p>
          {data.entreprise.adresse && <p className="text-center text-xs text-slate-500">{data.entreprise.adresse}</p>}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="text-center">
            <p className="font-bold">{titre}</p>
            <p className="text-xs text-slate-500">{new Date(data.recu.date).toLocaleString("fr-FR")}</p>
            <p className="text-xs text-slate-500">Caissier : {data.recu.caissier}</p>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between text-xs"><span className="text-slate-500">Catégorie</span><span className="font-semibold">{data.operation.categorieLabel}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500">Motif</span><span className="text-right max-w-[160px] truncate">{data.operation.motif}</span></div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between font-bold text-base">
            <span>MONTANT</span>
            <span className="text-red-600">{formatCurrency(data.operation.montant)}</span>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <p className="text-center text-xs text-slate-400">Document officiel de caisse</p>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl text-sm font-semibold hover:from-red-700 hover:to-rose-700 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={16} />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CaissierPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("synthese");

  // ── Recherche / filtres historique ───────────────────────────────────────
  const [searchQuery,      setSearchQuery]      = useState("");
  const [debouncedSearch,  setDebouncedSearch]  = useState("");
  const [dateDebut,        setDateDebut]        = useState("");
  const [dateFin,          setDateFin]          = useState("");
  const [filtreAujourdHui, setFiltreAujourdHui] = useState(true);

  // ── Recherche encaissement ───────────────────────────────────────────────
  const [encaissementSearch, setEncaissementSearch] = useState("");
  const [debouncedEncSearch, setDebouncedEncSearch] = useState("");

  // ── Pagination ───────────────────────────────────────────────────────────
  const [versementsPage, setVersementsPage] = useState(1);
  const [cloturePage,    setCloturePage]    = useState(1);

  // ── Modal états ──────────────────────────────────────────────────────────
  const [versementModal,       setVersementModal]       = useState(false);
  const [versementSouscriptionId, setVersementSouscriptionId] = useState(0);
  const [selectedSouscription, setSelectedSouscription] = useState<SouscriptionItem | null>(null);
  const [versementMontant,     setVersementMontant]     = useState("");
  const [versementNotes,       setVersementNotes]       = useState("");

  const [recuModal,            setRecuModal]            = useState(false);
  const [recuData,             setRecuData]             = useState<RecuData["data"] | null>(null);
  const [recuOpModal,          setRecuOpModal]          = useState(false);
  const [recuOpData,           setRecuOpData]           = useState<RecuOperationData["data"] | null>(null);
  const [notesClotureInput,    setNotesCloture]         = useState("");
  const [soldeReel,         setSoldeReel]    = useState("");

  // ── Session caisse
  const [sessionFondsCaisse, setSessionFondsCaisse] = useState("");
  const [sessionNotes,       setSessionNotes]       = useState("");
  // ── Encaissement financier
  const [opMode,    setOpMode]    = useState<"ESPECES" | "VIREMENT" | "CHEQUE">("ESPECES");
  const [opMontant, setOpMontant] = useState("");
  const [opMotif,   setOpMotif]   = useState("");

  // ── Décaissement
  const [decCategorie, setDecCategorie] = useState<"SALAIRE" | "AVANCE" | "FOURNISSEUR" | "AUTRE">("AUTRE");
  const [decMontant,   setDecMontant]   = useState("");
  const [decMotif,     setDecMotif]     = useState("");

  // ── Transfert
  const [trfOrigine,     setTrfOrigine]     = useState("Caisse principale");
  const [trfDestination, setTrfDestination] = useState("");
  const [trfMontant,     setTrfMontant]     = useState("");
  const [trfMotif,       setTrfMotif]       = useState("");

  // ── Debounce recherche historique ────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Debounce recherche encaissement ─────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEncSearch(encaissementSearch), 350);
    return () => clearTimeout(t);
  }, [encaissementSearch]);

  // ── Build API URLs ───────────────────────────────────────────────────────
  const versementsParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(versementsPage), limit: "15" });
    if (filtreAujourdHui) {
      p.set("aujourdHui", "true");
    } else {
      if (dateDebut) p.set("dateDebut", dateDebut);
      if (dateFin)   p.set("dateFin",   dateFin);
    }
    if (debouncedSearch) p.set("search", debouncedSearch);
    return p.toString();
  }, [versementsPage, filtreAujourdHui, dateDebut, dateFin, debouncedSearch]);

  const clotureParams = useMemo(
    () => new URLSearchParams({ page: String(cloturePage), limit: "8" }).toString(),
    [cloturePage]
  );

  const encaissementParams = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedEncSearch) p.set("search", debouncedEncSearch);
    return p.toString();
  }, [debouncedEncSearch]);

  // ── Fetches ──────────────────────────────────────────────────────────────
  const { data: dashboardRes,  refetch: refetchDashboard  } = useApi<DashboardResponse>("/api/caissier/dashboard");
  const { data: versementsRes, refetch: refetchVersements,
          loading: versementsLoading                        } = useApi<VersementsResponse>(`/api/caissier/versements?${versementsParams}`);
  const { data: clotureRes,    refetch: refetchCloture     } = useApi<ClotureData>(`/api/caissier/cloture?${clotureParams}`);
  const { data: packsRes,      refetch: refetchPacks       } = useApi<PacksResponse>(`/api/caissier/packs?${encaissementParams}`);

  const sessionActiveId = dashboardRes?.data?.sessionActive?.id;
  const operationsUrl = useMemo(
    () => sessionActiveId
      ? `/api/caissier/operations?limit=500&sessionId=${sessionActiveId}`
      : `/api/caissier/operations?limit=500&aujourdHui=true`,
    [sessionActiveId]
  );
  const { data: operationsRes, refetch: refetchOperations  } = useApi<{
    success: boolean;
    data: OperationCaisse[];
    totalsJour: { encaissements: number; decaissements: number };
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>(operationsUrl);

  const { data: transfertsRes, refetch: refetchTransferts  } = useApi<{
    success: boolean;
    data: TransfertCaisse[];
    totalJour: number;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>("/api/caissier/transferts?limit=50");

  // ── Mutations ────────────────────────────────────────────────────────────
  const { mutate: collecterVersement, loading: collectant, error: erreurVersement } =
    useMutation<{ versement: { id: number } }, { montant: number; type: string; notes?: string }>(
      `/api/caissier/packs/${versementSouscriptionId}/versement`,
      "POST",
      { successMessage: "Versement enregistré ✓" }
    );

  const { mutate: cloturerCaisse, loading: cloturant } =
    useMutation<ClotureCaisse, { notes?: string; soldeReel?: number }>(
      "/api/caissier/cloture",
      "POST",
      { successMessage: "Caisse clôturée avec succès ✓" }
    );

  const { mutate: ouvrirSession, loading: ouvrantSession } =
    useMutation<{ success: boolean; data: SessionCaisse }, { fondsCaisse: number; notes?: string }>(
      "/api/caissier/session",
      "POST",
      { successMessage: "Caisse ouverte ✓" }
    );

  const sessionPatchUrl = `/api/caissier/session/${dashboardRes?.data?.sessionActive?.id ?? 0}`;
  const { mutate: changerStatutSession, loading: changingStatut } =
    useMutation<{ success: boolean }, { action: "SUSPENDRE" | "ROUVRIR" }>(
      sessionPatchUrl,
      "PATCH",
      { successMessage: "Statut de session modifié ✓" }
    );

  const { mutate: creerOperation, loading: creantOp } =
    useMutation<{ success: boolean }, { type: string; mode?: string; categorie?: string; montant: number; motif: string }>(
      "/api/caissier/operations",
      "POST",
      { successMessage: "Opération enregistrée ✓" }
    );

  const { mutate: creerTransfert, loading: creantTrf } =
    useMutation<{ success: boolean }, { origine: string; destination: string; montant: number; motif?: string }>(
      "/api/caissier/transferts",
      "POST",
      { successMessage: "Transfert enregistré ✓" }
    );

  // ── Derived data ─────────────────────────────────────────────────────────
  const dashboard    = dashboardRes?.data;
  const sessionActive = dashboard?.sessionActive ?? null;
  const versements   = versementsRes?.data ?? [];
  const versementsStats = versementsRes?.stats;
  const versementsMeta  = versementsRes?.meta;
  const jourEnCours  = clotureRes?.jourEnCours;
  const clotureHisto = clotureRes?.historique;
  const souscriptions = packsRes?.souscriptions ?? [];
  const operations  = operationsRes?.data ?? [];
  const transferts  = transfertsRes?.data ?? [];

  // Calcul solde théorique pour la clôture
  const fondsCaisseInitial  = dashboard?.sessionActive?.fondsCaisse ?? 0;
  const versementsPacks     = jourEnCours?.montantTotal ?? 0;
  const encaissementsAutres = dashboard?.operationsJour?.encaissements ?? 0;
  const decaissementsTotal  = dashboard?.operationsJour?.decaissements ?? 0;
  const transfertsTotal     = dashboard?.operationsJour?.transferts ?? 0;
  const soldeTheorique      = fondsCaisseInitial + versementsPacks + encaissementsAutres - decaissementsTotal - transfertsTotal;
  const ecartCaisse         = soldeReel !== "" ? Number(soldeReel) - soldeTheorique : null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openVersementModal = (souscription: SouscriptionItem) => {
    setVersementSouscriptionId(souscription.id);
    setSelectedSouscription(souscription);
    const echeancesEnRetard = souscription.echeances.filter((e) => e.statut === "EN_RETARD");
    const prochaineEcheance = souscription.echeances.find(
      (e) => e.statut === "EN_ATTENTE" || e.statut === "EN_RETARD"
    );
    if (echeancesEnRetard.length > 1) {
      // Plusieurs retards → pré-remplir avec la somme totale des arrières
      const totalRetard = echeancesEnRetard.reduce((s, e) => s + Number(e.montant), 0);
      setVersementMontant(String(totalRetard));
    } else {
      setVersementMontant(
        prochaineEcheance
          ? String(Number(prochaineEcheance.montant))
          : String(Number(souscription.montantRestant))
      );
    }
    setVersementNotes("");
    setVersementModal(true);
  };

  const handleCollecterVersement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSouscription || !versementMontant) return;
    const montantNum = parseFloat(versementMontant);
    if (isNaN(montantNum) || montantNum <= 0) return;
    const result = await collecterVersement({
      montant: montantNum,
      type: "VERSEMENT_PERIODIQUE",
      notes: versementNotes || undefined,
    });
    if (result) {
      setVersementModal(false);
      setSelectedSouscription(null);
      setVersementMontant("");
      setVersementNotes("");
      refetchDashboard();
      refetchVersements();
      refetchPacks();
      if (result.versement?.id) handleVoirRecu(result.versement.id);
    }
  };

  const handleVoirRecu = useCallback(async (versementId: number) => {
    try {
      const res = await fetch(`/api/caissier/recus?versementId=${versementId}`);
      const json: RecuData = await res.json();
      if (json.success) {
        setRecuData(json.data);
        setRecuModal(true);
      }
    } catch { /* ignore */ }
  }, []);

  const handleVoirRecuOp = useCallback(async (operationId: number) => {
    try {
      const res = await fetch(`/api/caissier/recus?operationId=${operationId}`);
      const json: RecuOperationData = await res.json();
      if (json.success) {
        setRecuOpData(json.data);
        setRecuOpModal(true);
      }
    } catch { /* ignore */ }
  }, []);

  const handleCloturerCaisse = async () => {
    const result = await cloturerCaisse({
      notes: notesClotureInput || undefined,
      soldeReel: soldeReel !== "" ? Number(soldeReel) : undefined,
    });
    if (result) {
      setNotesCloture("");
      setSoldeReel("");
      refetchCloture();
      refetchDashboard();
      refetchOperations();
      refetchTransferts();
    }
  };

  const handleOuvrirSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(sessionFondsCaisse);
    if (isNaN(montant) || montant < 0) return;
    const result = await ouvrirSession({
      fondsCaisse: montant,
      notes: sessionNotes || undefined,
    });
    if (result) {
      setSessionFondsCaisse("");
      setSessionNotes("");
      // Rafraîchir tous les onglets pour qu'ils voient la session nouvellement ouverte
      refetchDashboard();
      refetchCloture();
      refetchPacks();
      refetchVersements();
      refetchOperations();
      refetchTransferts();
    }
  };

  const handleChangerStatut = async (action: "SUSPENDRE" | "ROUVRIR") => {
    if (!sessionActive) return;
    const result = await changerStatutSession({ action });
    if (result) {
      refetchDashboard();
      refetchCloture();
      refetchOperations();
      refetchTransferts();
    }
  };

  const handleEncaisser = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(opMontant);
    if (isNaN(montant) || montant <= 0 || !opMotif.trim()) return;
    const result = await creerOperation({ type: "ENCAISSEMENT", mode: opMode, montant, motif: opMotif.trim() });
    if (result) {
      setOpMontant("");
      setOpMotif("");
      refetchOperations();
      refetchDashboard();
    }
  };

  const handleDecaisser = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(decMontant);
    if (isNaN(montant) || montant <= 0 || !decMotif.trim()) return;
    const result = await creerOperation({ type: "DECAISSEMENT", categorie: decCategorie, montant, motif: decMotif.trim() });
    if (result) {
      setDecMontant("");
      setDecMotif("");
      refetchOperations();
      refetchDashboard();
    }
  };

  const handleTransferer = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(trfMontant);
    if (isNaN(montant) || montant <= 0 || !trfOrigine.trim() || !trfDestination.trim()) return;
    const result = await creerTransfert({
      origine: trfOrigine.trim(),
      destination: trfDestination.trim(),
      montant,
      motif: trfMotif.trim() || undefined,
    });
    if (result) {
      setTrfMontant("");
      setTrfMotif("");
      setTrfDestination("");
      refetchTransferts();
      refetchDashboard();
    }
  };

  const handlePrintRapport = () => {
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    const now = new Date().toLocaleString("fr-FR");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Rapport de clôture</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;max-width:600px;margin:0 auto;padding:24px;color:#1e293b}
      h1{font-size:20px;text-align:center;margin-bottom:4px}
      .sub{text-align:center;color:#64748b;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      td,th{padding:8px 12px;border-bottom:1px solid #e2e8f0}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}
      .total-row td{font-weight:bold;font-size:15px;border-top:2px solid #1e293b;background:#f0fdf4}
      .right{text-align:right}
      .sign{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between}
    </style></head><body>
    <h1>RAPPORT DE CLÔTURE DE CAISSE</h1>
    <div class="sub">Édité le ${now}</div>
    <table>
      <tr><th>Poste</th><th class="right">Montant (FCFA)</th></tr>
      <tr><td>Fonds de caisse initial</td><td class="right">${fondsCaisseInitial.toLocaleString("fr-FR")}</td></tr>
      <tr><td>+ Versements packs collectés</td><td class="right">${versementsPacks.toLocaleString("fr-FR")}</td></tr>
      <tr><td>+ Encaissements financiers</td><td class="right">${encaissementsAutres.toLocaleString("fr-FR")}</td></tr>
      <tr><td>− Décaissements</td><td class="right">${decaissementsTotal.toLocaleString("fr-FR")}</td></tr>
      <tr><td>− Transferts</td><td class="right">${transfertsTotal.toLocaleString("fr-FR")}</td></tr>
      <tr class="total-row"><td>= Solde théorique</td><td class="right">${soldeTheorique.toLocaleString("fr-FR")}</td></tr>
      ${soldeReel !== "" ? `<tr><td>Solde réel compté</td><td class="right">${Number(soldeReel).toLocaleString("fr-FR")}</td></tr>` : ""}
      ${ecartCaisse !== null ? `<tr><td>Écart de caisse</td><td class="right" style="color:${ecartCaisse >= 0 ? "#16a34a" : "#dc2626"}">${ecartCaisse >= 0 ? "+" : ""}${ecartCaisse.toLocaleString("fr-FR")}</td></tr>` : ""}
    </table>
    ${notesClotureInput ? `<p><strong>Notes :</strong> ${notesClotureInput}</p>` : ""}
    <div class="sign">
      <div>Caissier : ____________________</div>
      <div>Signature : ____________________</div>
    </div>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const handlePrintBonTransfert = (t: TransfertCaisse) => {
    const win = window.open("", "_blank", "width=500,height=600");
    if (!win) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Bon de transfert ${t.reference}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;max-width:400px;margin:0 auto;padding:20px}
      h1{font-size:16px;text-align:center;border-bottom:2px solid #1e293b;padding-bottom:8px;margin-bottom:16px}
      .row{display:flex;justify-content:space-between;margin:6px 0}
      .label{color:#64748b} .bold{font-weight:bold}
      .big{font-size:18px;font-weight:bold;color:#059669}
      .line{border-top:1px dashed #cbd5e1;margin:12px 0}
      .sign{display:flex;justify-content:space-between;margin-top:24px;font-size:12px;color:#64748b}
    </style></head><body>
    <h1>BON DE TRANSFERT</h1>
    <div class="row"><span class="label">Référence</span><span class="bold">${t.reference}</span></div>
    <div class="row"><span class="label">Date</span><span>${new Date(t.createdAt).toLocaleString("fr-FR")}</span></div>
    <div class="row"><span class="label">Opérateur</span><span>${t.operateurNom}</span></div>
    <div class="line"></div>
    <div class="row"><span class="label">Origine</span><span class="bold">${t.origine}</span></div>
    <div class="row"><span class="label">Destination</span><span class="bold">${t.destination}</span></div>
    <div class="line"></div>
    <div class="row"><span>MONTANT TRANSFÉRÉ</span><span class="big">${t.montant.toLocaleString("fr-FR")} FCFA</span></div>
    ${t.motif ? `<div class="line"></div><div class="row"><span class="label">Motif</span><span>${t.motif}</span></div>` : ""}
    <div class="sign"><div>Remis par : _______________</div><div>Reçu par : _______________</div></div>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const refetchAll = () => {
    refetchDashboard();
    refetchVersements();
    refetchCloture();
    refetchPacks();
    refetchOperations();
    refetchTransferts();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "synthese",            label: "Synthèse",        icon: BarChart3       },
    { key: "session",             label: "Session",         icon: Power           },
    { key: "encaissement_caisse", label: "Encaissements",   icon: ArrowUpCircle   },
    { key: "decaissement",        label: "Décaissements",   icon: ArrowDownCircle },
    { key: "transferts",          label: "Transferts",      icon: ArrowLeftRight  },
    { key: "packs",               label: "Packs",           icon: Banknote        },
    { key: "historique",          label: "Historique",      icon: Clock           },
    { key: "recus",               label: "Reçus",           icon: Receipt         },
    { key: "cloture",             label: "Clôture",         icon: Lock            },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 font-['DM_Sans',sans-serif]">

      {/* ── Modals ── */}
      {recuModal    && recuData    && <TicketRecu         data={recuData}    onClose={() => setRecuModal(false)} />}
      {recuOpModal  && recuOpData  && <TicketDecaissement data={recuOpData}  onClose={() => setRecuOpModal(false)} />}

      {/* Modal Versement */}
      {versementModal && selectedSouscription && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-3 rounded-xl"><Banknote className="text-emerald-600 w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Encaisser un versement</h2>
                  <p className="text-sm text-slate-500">
                    {selectedSouscription.client
                      ? `${selectedSouscription.client.prenom} ${selectedSouscription.client.nom}`
                      : selectedSouscription.user
                      ? `${selectedSouscription.user.prenom} ${selectedSouscription.user.nom}`
                      : "—"}
                    {" · "}
                    {selectedSouscription.pack.nom}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVersementModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {erreurVersement && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="text-red-500 w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{erreurVersement}</p>
              </div>
            )}

            <form onSubmit={handleCollecterVersement} className="p-6 space-y-4">
              {/* Résumé souscription */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Montant total</span>
                  <span className="font-semibold">{formatCurrency(Number(selectedSouscription.montantTotal))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Déjà versé</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(Number(selectedSouscription.montantVerse))}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-600">Reste à payer</span>
                  <span className="text-amber-600">{formatCurrency(Number(selectedSouscription.montantRestant))}</span>
                </div>
                {selectedSouscription.echeances.length > 0 && (() => {
                  const enRetard = selectedSouscription.echeances.filter((e) => e.statut === "EN_RETARD");
                  const prochaine = selectedSouscription.echeances[0];
                  if (enRetard.length > 1) {
                    const totalRetard = enRetard.reduce((s, e) => s + Number(e.montant), 0);
                    return (
                      <div className="pt-1 border-t border-red-200 bg-red-50 rounded-lg px-2 py-1.5 mt-1">
                        <p className="text-xs text-red-600 font-semibold">
                          ⚠ {enRetard.length} échéances en retard — Total dû : {formatCurrency(totalRetard)}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="pt-1 border-t border-slate-200">
                      <p className="text-xs text-slate-500">
                        Prochaine échéance ({prochaine.statut === "EN_RETARD" ? (
                          <span className="text-red-500 font-medium">EN RETARD</span>
                        ) : (
                          <span>le {formatDate(prochaine.datePrevue)}</span>
                        )}) : {formatCurrency(Number(prochaine.montant))}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Montant */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant versé (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  max={Number(selectedSouscription.montantRestant)}
                  step="1"
                  value={versementMontant}
                  onChange={(e) => setVersementMontant(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                  placeholder="Ex : 5000"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optionnel)</label>
                <input
                  type="text"
                  value={versementNotes}
                  onChange={(e) => setVersementNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                  placeholder="Ex : paiement espèces"
                />
              </div>

              {/* Récapitulatif */}
              {versementMontant && Number(versementMontant) > 0 && (
                <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Montant à encaisser</span>
                  <span className="text-2xl font-bold text-emerald-700">{formatCurrency(Number(versementMontant))}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={collectant}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {collectant ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</>
                ) : (
                  <><CheckCircle size={18} />Valider le versement</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Caisse
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refetchAll}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Actualiser"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={() => setActiveTab("packs")}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm flex items-center gap-2"
              >
                <Plus size={16} />
                Encaisser
              </button>
              <UserPdvBadge />
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton
                redirectTo="/auth/login?logout=success"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Alertes prioritaires ── */}
        {(dashboard?.alertes ?? []).length > 0 && (
          <div className="space-y-2">
            {dashboard!.alertes.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium ${alertBg(a.type)}`}>
                {alertIcon(a.type)}
                <span className="text-slate-700">{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === key
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* ============================================================
            TAB : SYNTHÈSE
        ============================================================ */}
        {activeTab === "synthese" && (
          <div className="space-y-6">
            {/* KPIs */}
            {/* Bandeau session */}
            {sessionActive && (
              <div className={`rounded-2xl p-4 flex items-center justify-between border ${
                sessionActive.statut === "OUVERTE"
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${sessionActive.statut === "OUVERTE" ? "bg-emerald-100" : "bg-amber-100"}`}>
                    <Power className={`w-5 h-5 ${sessionActive.statut === "OUVERTE" ? "text-emerald-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${sessionActive.statut === "OUVERTE" ? "text-emerald-800" : "text-amber-800"}`}>
                      Session {sessionActive.statut === "OUVERTE" ? "ouverte" : "suspendue"} — {sessionActive.caissierNom}
                    </p>
                    <p className="text-xs text-slate-500">
                      Depuis {formatDateTime(sessionActive.dateOuverture)} · Fonds : {formatCurrency(sessionActive.fondsCaisse)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Solde temps réel</p>
                  <p className="text-xl font-bold text-slate-800">{formatCurrency(dashboard?.soldeTempsReel ?? 0)}</p>
                </div>
              </div>
            )}
            {!sessionActive && (
              <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200 flex items-center gap-3">
                <Power className="w-5 h-5 text-slate-400" />
                <p className="text-sm text-slate-500">Aucune session de caisse ouverte — <button onClick={() => setActiveTab("session")} className="text-emerald-600 font-semibold hover:underline">Ouvrir la caisse</button></p>
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard label="Solde temps réel"      value={formatCurrency(dashboard?.soldeTempsReel ?? 0)}      icon={Wallet}       color="text-teal-500"    bg="bg-teal-50"    sub="en caisse" />
              <KpiCard label="Versements du jour"    value={String(dashboard?.versements.total ?? 0)}             icon={Layers}       color="text-sky-500"     bg="bg-sky-50"     sub="aujourd'hui" />
              <KpiCard label="Montant encaissé"      value={formatCurrency(dashboard?.versements.montant ?? 0)}  icon={Banknote}     color="text-emerald-500" bg="bg-emerald-50" sub="total du jour" />
              <KpiCard label="Souscriptions actives" value={String(dashboard?.souscriptionsActives ?? 0)}        icon={TrendingUp}   color="text-violet-500"  bg="bg-violet-50"  />
              <KpiCard label="Clients servis"        value={String(dashboard?.versements.nbClients ?? 0)}        icon={Users}        color="text-pink-500"    bg="bg-pink-50"    sub="aujourd'hui" />
            </div>

            {/* Bandeaux */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
                <p className="text-emerald-100 text-xs mb-1">Total encaissé aujourd&apos;hui</p>
                <p className="text-3xl font-bold">{formatCurrency(dashboard?.versements.montant ?? 0)}</p>
                <p className="text-emerald-200 text-sm mt-2">{dashboard?.versements.total ?? 0} versement(s) collecté(s)</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">État du stock</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Produits disponibles</span>
                  <span className="font-bold text-emerald-600">{(dashboard?.stock.total ?? 0) - (dashboard?.stock.rupture ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Stock faible</span>
                  <span className="font-bold text-amber-500">{dashboard?.stock.faible ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">En rupture</span>
                  <span className="font-bold text-red-500">{dashboard?.stock.rupture ?? 0}</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Souscriptions packs</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Actives</span>
                  <span className="font-bold text-emerald-600">{dashboard?.souscriptionsActives ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">En attente</span>
                  <span className="font-bold text-amber-500">{dashboard?.souscriptionsEnAttente ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Échéances en retard</span>
                  <span className={`font-bold ${(dashboard?.echeancesEnRetard?.length ?? 0) > 0 ? "text-red-500" : "text-slate-400"}`}>
                    {dashboard?.echeancesEnRetard?.length ?? 0}
                  </span>
                </div>
                {dashboard?.derniereCloture && (
                  <div className="mt-2 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">Dernière clôture</p>
                    <p className="text-sm font-semibold text-slate-700">{formatDate(dashboard.derniereCloture.date)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Échéances en retard */}
            {(dashboard?.echeancesEnRetard?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-200">
                <h3 className="font-bold text-red-700 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-500" />
                  Échéances en retard ({dashboard!.echeancesEnRetard.length})
                </h3>
                <div className="space-y-2">
                  {dashboard!.echeancesEnRetard.map((e) => {
                    const person = e.client;
                    return (
                      <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-red-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                            <AlertCircle size={14} className="text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {person ? `${person.prenom} ${person.nom}` : "—"} — {e.packNom}
                            </p>
                            <p className="text-xs text-slate-500">Éch. #{e.numero} · Prévue le {formatDate(e.datePrevue)}</p>
                          </div>
                        </div>
                        <span className="font-bold text-red-600 text-sm shrink-0">{formatCurrency(e.montant)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Derniers versements */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={20} className="text-emerald-600" />
                  Derniers versements collectés
                </h3>
                <button
                  onClick={() => setActiveTab("historique")}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Voir tout →
                </button>
              </div>
              <div className="space-y-2">
                {(dashboard?.derniersVersements ?? []).length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm">Aucun versement collecté aujourd&apos;hui</p>
                )}
                {(dashboard?.derniersVersements ?? []).map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <Banknote size={14} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{v.clientNom} — {v.packNom}</p>
                        <p className="text-xs text-slate-500">{versementTypeLabel(v.type)} · {v.heure}</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm">{formatCurrency(v.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* ============================================================
            TAB : SESSION DE CAISSE
        ============================================================ */}
        {activeTab === "session" && (
          <div className="space-y-6">
            {/* État de la session */}
            {!sessionActive && (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                <div className="max-w-md mx-auto">
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="bg-slate-100 p-4 rounded-2xl mb-4">
                      <Power className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Ouvrir la caisse</h3>
                    <p className="text-slate-500 text-sm mt-1">Saisissez le fonds initial pour démarrer votre session</p>
                  </div>
                  <form onSubmit={handleOuvrirSession} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Fonds de caisse initial (FCFA)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={sessionFondsCaisse}
                        onChange={(e) => setSessionFondsCaisse(e.target.value)}
                        required
                        placeholder="Ex : 50000"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optionnel)</label>
                      <input
                        type="text"
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder="Ex : Ouverture standard"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={ouvrantSession}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {ouvrantSession ? (
                        <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ouverture...</>
                      ) : (
                        <><Power size={18} />Ouvrir la caisse</>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {sessionActive?.statut === "OUVERTE" && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-xl">
                        <Power className="text-emerald-600 w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-emerald-800 text-lg">Session ouverte</p>
                        <p className="text-emerald-700 text-sm">Caissier : {sessionActive.caissierNom}</p>
                        <p className="text-emerald-600 text-xs mt-0.5">Depuis le {formatDateTime(sessionActive.dateOuverture)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-600">Fonds initiaux</p>
                      <p className="text-2xl font-bold text-emerald-800">{formatCurrency(sessionActive.fondsCaisse)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Solde en temps réel</p>
                    <p className="text-4xl font-bold text-slate-800">{formatCurrency(dashboard?.soldeTempsReel ?? 0)}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <div>
                        <p>+ Versements packs</p>
                        <p className="font-semibold text-emerald-600">{formatCurrency(versementsPacks)}</p>
                      </div>
                      <div>
                        <p>+ Encaissements</p>
                        <p className="font-semibold text-emerald-600">{formatCurrency(encaissementsAutres)}</p>
                      </div>
                      <div>
                        <p>− Sorties</p>
                        <p className="font-semibold text-red-500">{formatCurrency(decaissementsTotal + transfertsTotal)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleChangerStatut("SUSPENDRE")}
                      disabled={changingStatut}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Pause size={16} />Suspendre
                    </button>
                    <button
                      onClick={() => setActiveTab("cloture")}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Lock size={16} />Procéder à la clôture
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sessionActive?.statut === "SUSPENDUE" && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-xl">
                      <Pause className="text-amber-600 w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-800 text-lg">Session suspendue</p>
                      <p className="text-amber-700 text-sm">Caissier : {sessionActive.caissierNom}</p>
                      <p className="text-amber-600 text-xs mt-0.5">Ouverte le {formatDateTime(sessionActive.dateOuverture)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleChangerStatut("ROUVRIR")}
                    disabled={changingStatut}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play size={16} />Reprendre la session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB : ENCAISSEMENTS FINANCIERS
        ============================================================ */}
        {activeTab === "encaissement_caisse" && (
          <div className="space-y-6">
            {/* Bandeau total jour */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-lg">
                <p className="text-emerald-100 text-xs mb-1">Total encaissé aujourd&apos;hui</p>
                <p className="text-3xl font-bold">{formatCurrency(operationsRes?.totalsJour?.encaissements ?? 0)}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                <p className="text-xs text-slate-500 mb-1">Nombre d&apos;opérations</p>
                <p className="text-2xl font-bold text-slate-800">{operations.filter(o => o.type === "ENCAISSEMENT").length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                <p className="text-xs text-slate-500 mb-1">Session</p>
                <p className={`text-sm font-semibold ${sessionActive ? "text-emerald-600" : "text-red-500"}`}>
                  {sessionActive ? `${sessionActive.statut}` : "Aucune session"}
                </p>
              </div>
            </div>

            {/* Formulaire */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-5">
                <ArrowUpCircle size={20} className="text-emerald-600" />
                Nouvel encaissement
              </h3>
              {/* Toggle mode */}
              <div className="flex gap-2 mb-5">
                {(["ESPECES", "VIREMENT", "CHEQUE"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setOpMode(m)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      opMode === m
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {m === "ESPECES" && <Banknote size={15} />}
                    {m === "VIREMENT" && <Building2 size={15} />}
                    {m === "CHEQUE" && <CreditCard size={15} />}
                    {modePaiementLabel(m)}
                  </button>
                ))}
              </div>
              <form onSubmit={handleEncaisser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant (FCFA)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={opMontant}
                    onChange={(e) => setOpMontant(e.target.value)}
                    required
                    placeholder="Ex : 10000"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={opMotif}
                      onChange={(e) => setOpMotif(e.target.value)}
                      required
                      placeholder="Ex : Paiement client Dupont"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={creantOp || !sessionActive}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {creantOp ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={16} />}
                      Enregistrer
                    </button>
                  </div>
                </div>
              </form>
              {!sessionActive && (
                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={13} />Ouvrez d&apos;abord une session de caisse
                </p>
              )}
            </div>

            {/* Tableau */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Encaissements du jour</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Mode", "Montant", "Motif", "Opérateur", "Heure"].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {operations.filter(o => o.type === "ENCAISSEMENT").map((op) => (
                      <tr key={op.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{op.reference}</td>
                        <td className="px-5 py-3">
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">{modePaiementLabel(op.mode)}</span>
                        </td>
                        <td className="px-5 py-3 font-bold text-emerald-600">{formatCurrency(op.montant)}</td>
                        <td className="px-5 py-3 text-slate-600">{op.motif}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{op.operateurNom}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{formatDateTime(op.createdAt)}</td>
                      </tr>
                    ))}
                    {operations.filter(o => o.type === "ENCAISSEMENT").length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                          Aucun encaissement enregistré aujourd&apos;hui
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB : DÉCAISSEMENTS
        ============================================================ */}
        {activeTab === "decaissement" && (
          <div className="space-y-6">
            {/* Bandeau */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-red-600 text-white rounded-2xl p-5 shadow-lg">
                <p className="text-red-100 text-xs mb-1">Total décaissé aujourd&apos;hui</p>
                <p className="text-3xl font-bold">{formatCurrency(operationsRes?.totalsJour?.decaissements ?? 0)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3">
                <AlertTriangle className="text-amber-500 w-5 h-5 shrink-0" />
                <p className="text-amber-800 text-sm font-medium">
                  Tout décaissement notifie automatiquement l&apos;administrateur.
                </p>
              </div>
            </div>

            {/* Formulaire */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-5">
                <ArrowDownCircle size={20} className="text-red-500" />
                Nouveau décaissement
              </h3>
              {/* Toggle catégorie */}
              <div className="flex flex-wrap gap-2 mb-5">
                {(["SALAIRE", "AVANCE", "FOURNISSEUR", "AUTRE"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setDecCategorie(c)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      decCategorie === c
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {categorieLabel(c)}
                  </button>
                ))}
              </div>
              <form onSubmit={handleDecaisser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant (FCFA)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={decMontant}
                    onChange={(e) => setDecMontant(e.target.value)}
                    required
                    placeholder="Ex : 5000"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={decMotif}
                      onChange={(e) => setDecMotif(e.target.value)}
                      required
                      placeholder="Ex : Salaire gardien"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={creantOp || !sessionActive}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                      {creantOp ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={16} />}
                      Enregistrer
                    </button>
                  </div>
                </div>
              </form>
              {!sessionActive && (
                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={13} />Ouvrez d&apos;abord une session de caisse
                </p>
              )}
            </div>

            {/* Tableau par catégorie */}
            {(["SALAIRE", "AVANCE", "FOURNISSEUR", "AUTRE"] as const).map((cat) => {
              const catOps = operations.filter(o => o.type === "DECAISSEMENT" && o.categorie === cat);
              if (catOps.length === 0) return null;
              const total = catOps.reduce((s, o) => s + o.montant, 0);
              return (
                <div key={cat} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">{categorieLabel(cat)}</h3>
                    <span className="font-bold text-red-600">{formatCurrency(total)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["Référence", "Montant", "Motif", "Heure", ""].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {catOps.map((op) => (
                          <tr key={op.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-mono text-xs text-slate-500">{op.reference}</td>
                            <td className="px-5 py-3 font-bold text-red-600">{formatCurrency(op.montant)}</td>
                            <td className="px-5 py-3 text-slate-600">{op.motif}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{formatDateTime(op.createdAt)}</td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() => handleVoirRecuOp(op.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Receipt size={12} />
                                Reçu
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {operations.filter(o => o.type === "DECAISSEMENT").length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <ArrowDownCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">Aucun décaissement enregistré aujourd&apos;hui</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB : TRANSFERTS
        ============================================================ */}
        {activeTab === "transferts" && (
          <div className="space-y-6">
            {/* Bandeau */}
            <div className="bg-sky-600 text-white rounded-2xl p-5 shadow-lg">
              <p className="text-sky-100 text-xs mb-1">Total transféré aujourd&apos;hui</p>
              <p className="text-3xl font-bold">{formatCurrency(transfertsRes?.totalJour ?? 0)}</p>
            </div>

            {/* Formulaire */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-5">
                <ArrowLeftRight size={20} className="text-sky-600" />
                Nouveau transfert
              </h3>
              <form onSubmit={handleTransferer} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Origine</label>
                  <input
                    type="text"
                    value={trfOrigine}
                    onChange={(e) => setTrfOrigine(e.target.value)}
                    required
                    placeholder="Ex : Caisse principale"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Destination</label>
                  <input
                    type="text"
                    value={trfDestination}
                    onChange={(e) => setTrfDestination(e.target.value)}
                    required
                    placeholder="Ex : Compte bancaire BNI"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant (FCFA)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={trfMontant}
                    onChange={(e) => setTrfMontant(e.target.value)}
                    required
                    placeholder="Ex : 20000"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif (optionnel)</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={trfMotif}
                      onChange={(e) => setTrfMotif(e.target.value)}
                      placeholder="Ex : Versement banque"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={creantTrf || !sessionActive}
                      className="px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                      {creantTrf ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                      Envoyer
                    </button>
                  </div>
                </div>
              </form>
              {!sessionActive && (
                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={13} />Ouvrez d&apos;abord une session de caisse
                </p>
              )}
            </div>

            {/* Tableau */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Transferts du jour</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Origine → Destination", "Montant", "Motif", "Heure", ""].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transferts.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{t.reference}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-semibold text-slate-800">{t.origine}</p>
                          <p className="text-xs text-slate-400">→ {t.destination}</p>
                        </td>
                        <td className="px-5 py-3 font-bold text-sky-600">{formatCurrency(t.montant)}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{t.motif ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{formatDateTime(t.createdAt)}</td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handlePrintBonTransfert(t)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            title="Imprimer le bon"
                          >
                            <Printer size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {transferts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                          Aucun transfert effectué aujourd&apos;hui
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB : ENCAISSEMENT
        ============================================================ */}
        {activeTab === "packs" && (
          <div className="space-y-6">
            {/* Barre de recherche */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Banknote size={20} className="text-emerald-600" />
                  Souscriptions en cours — Collecte de versements packs
                </h3>
                <span className="text-xs text-slate-400">{souscriptions.length} souscription(s)</span>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par client, pack..."
                  value={encaissementSearch}
                  onChange={(e) => setEncaissementSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                />
              </div>
            </div>

            {/* Échéances en retard — rappel */}
            {(dashboard?.echeancesEnRetard?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-200">
                <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-500" />
                  {dashboard!.echeancesEnRetard.length} échéance(s) en retard
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(() => {
                    const now = new Date();
                    return dashboard!.echeancesEnRetard.slice(0, 6).map((e) => {
                    const joursRetard = Math.floor(
                      (now.getTime() - new Date(e.datePrevue).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    // Trouver la souscription correspondante pour ouvrir le modal
                    const souscription = souscriptions.find(
                      (s) => s.echeances.some((ec) => ec.id === e.id)
                    );
                    return (
                      <div key={e.id} className="bg-red-50 rounded-xl p-4 border border-red-200">
                        <p className="font-semibold text-slate-800 text-sm">
                          {e.client ? `${e.client.prenom} ${e.client.nom}` : `Éch. #${e.id}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{e.packNom} — Éch. #{e.numero}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-red-500 font-medium">{joursRetard} j de retard</span>
                          <span className="text-red-600 font-bold text-sm">{formatCurrency(e.montant)}</span>
                        </div>
                        {souscription && (
                          <button
                            onClick={() => openVersementModal(souscription)}
                            className="mt-2 w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Encaisser →
                          </button>
                        )}
                      </div>
                    );
                  }); })()}
                </div>
              </div>
            )}

            {/* Liste des souscriptions en cours */}
            {souscriptions.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Aucune souscription en cours</p>
                <p className="text-slate-400 text-sm mt-1">Créez une souscription depuis le panneau admin</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {souscriptions.map((s) => {
                  const person = s.client ?? s.user;
                  const pct = Number(s.montantTotal) > 0
                    ? Math.round((Number(s.montantVerse) / Number(s.montantTotal)) * 100)
                    : 0;
                  const prochaine = s.echeances[0];
                  const estEnRetard = prochaine?.statut === "EN_RETARD";

                  return (
                    <div
                      key={s.id}
                      className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-all ${
                        estEnRetard ? "border-red-200" : "border-slate-200"
                      }`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {person ? `${person.prenom} ${person.nom}` : "—"}
                            </p>
                            {person?.telephone && (
                              <p className="text-xs text-slate-400">{person.telephone}</p>
                            )}
                          </div>
                          {packTypeBadge(s.pack.type)}
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-sm font-semibold text-slate-700">{s.pack.nom}</p>
                          {s.statut === "EN_ATTENTE" && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">En attente</span>
                          )}
                        </div>

                        {/* Barre de progression */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>{formatCurrency(Number(s.montantVerse))}</span>
                            <span>{formatCurrency(Number(s.montantTotal))}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-sky-500" : "bg-amber-400"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-1 text-right">{pct}% versé</p>
                        </div>

                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Restant</span>
                          <span className="font-bold text-amber-600">{formatCurrency(Number(s.montantRestant))}</span>
                        </div>

                        {prochaine && (
                          <div className={`mt-2 p-2 rounded-lg text-xs ${
                            estEnRetard ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"
                          }`}>
                            {estEnRetard ? "⚠ " : ""}
                            Éch. #{prochaine.numero} · {formatCurrency(Number(prochaine.montant))}
                            {!estEnRetard && ` · ${formatDate(prochaine.datePrevue)}`}
                            {estEnRetard && " · EN RETARD"}
                          </div>
                        )}
                      </div>
                      <div className="px-5 pb-5">
                        <button
                          onClick={() => openVersementModal(s)}
                          disabled={Number(s.montantRestant) <= 0}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={15} />
                          {Number(s.montantRestant) <= 0 ? "Pack soldé" : "Encaisser versement"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB : HISTORIQUE
        ============================================================ */}
        {activeTab === "historique" && (
          <div className="space-y-4">
            {/* Filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Pack, client..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setVersementsPage(1); }}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setFiltreAujourdHui(!filtreAujourdHui); setVersementsPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    filtreAujourdHui
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Calendar size={15} />
                  Aujourd&apos;hui
                </button>
                {!filtreAujourdHui && (
                  <>
                    <input
                      type="date"
                      value={dateDebut}
                      onChange={(e) => { setDateDebut(e.target.value); setVersementsPage(1); }}
                      className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                    <input
                      type="date"
                      value={dateFin}
                      onChange={(e) => { setDateFin(e.target.value); setVersementsPage(1); }}
                      className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                    {(dateDebut || dateFin) && (
                      <button
                        onClick={() => { setDateDebut(""); setDateFin(""); setVersementsPage(1); }}
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Stats période */}
            {versementsStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Versements",     value: String(versementsStats.totalVentes),            color: "text-sky-600"     },
                  { label: "Total encaissé", value: formatCurrency(versementsStats.montantTotal),    color: "text-emerald-600" },
                  { label: "Moy. versement", value: formatCurrency(versementsStats.panierMoyen),     color: "text-violet-600"  },
                  { label: "Nb total",       value: String(versementsStats.quantiteTotale ?? "—"),   color: "text-amber-600"   },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color} mt-1`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tableau versements */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {versementsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["N°", "Pack", "Client", "Type", "Montant", "Date/Heure", ""].map((h) => (
                            <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {versements.map((v) => {
                          const person = v.souscription.client ?? v.souscription.user;
                          return (
                            <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5 text-xs font-mono text-slate-400 flex items-center gap-1">
                                <Hash size={12} />{v.id}
                              </td>
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-slate-800 text-sm">{v.souscription.pack.nom}</p>
                                <div className="mt-0.5">{packTypeBadge(v.souscription.pack.type)}</div>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-slate-600">
                                {person ? `${person.prenom} ${person.nom}` : "—"}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                  {versementTypeLabel(v.type)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-bold text-emerald-600">{formatCurrency(Number(v.montant))}</td>
                              <td className="px-5 py-3.5 text-xs text-slate-500">{formatDateTime(v.datePaiement)}</td>
                              <td className="px-5 py-3.5">
                                <button
                                  onClick={() => handleVoirRecu(v.id)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Voir le reçu"
                                >
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {versements.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                              Aucun versement trouvé pour cette période
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {versementsMeta && versementsMeta.totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        Page <span className="font-semibold">{versementsMeta.page}</span> / <span className="font-semibold">{versementsMeta.totalPages}</span>
                        <span className="text-slate-400"> ({versementsMeta.total} versements)</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setVersementsPage((p) => Math.max(1, p - 1))}
                          disabled={versementsPage <= 1}
                          className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-sm font-medium">{versementsPage}</span>
                        <button
                          onClick={() => setVersementsPage((p) => Math.min(versementsMeta.totalPages, p + 1))}
                          disabled={versementsPage >= versementsMeta.totalPages}
                          className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Encaissements financiers de la session */}
            {operations.filter(o => o.type === "ENCAISSEMENT").length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ArrowUpCircle size={18} className="text-emerald-600" />
                    Encaissements financiers
                  </h3>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCurrency(operations.filter(o => o.type === "ENCAISSEMENT").reduce((s, o) => s + o.montant, 0))}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Référence", "Motif", "Mode", "Montant", "Date/Heure", ""].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {operations.filter(o => o.type === "ENCAISSEMENT").map((op) => (
                        <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{op.reference}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{op.motif}</td>
                          <td className="px-5 py-3.5">
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">{modePaiementLabel(op.mode)}</span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-600">{formatCurrency(op.montant)}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{formatDateTime(op.createdAt)}</td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => handleVoirRecuOp(op.id)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Voir le reçu"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Décaissements de la session */}
            {operations.filter(o => o.type === "DECAISSEMENT").length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ArrowDownCircle size={18} className="text-red-500" />
                    Décaissements
                  </h3>
                  <span className="text-sm font-bold text-red-600">
                    {formatCurrency(operations.filter(o => o.type === "DECAISSEMENT").reduce((s, o) => s + o.montant, 0))}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Référence", "Catégorie", "Motif", "Montant", "Date/Heure", ""].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {operations.filter(o => o.type === "DECAISSEMENT").map((op) => (
                        <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{op.reference}</td>
                          <td className="px-5 py-3.5">
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">{categorieLabel(op.categorie)}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{op.motif}</td>
                          <td className="px-5 py-3.5 font-bold text-red-600">{formatCurrency(op.montant)}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{formatDateTime(op.createdAt)}</td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => handleVoirRecuOp(op.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Voir le reçu"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB : REÇUS
        ============================================================ */}
        {activeTab === "recus" && (
          <div className="space-y-6">
            {/* Barre de recherche + compteur total */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Receipt size={20} className="text-sky-600" />
                  Reçus de la session
                </h3>
                <div className="flex items-center gap-2">
                  <Filter size={15} className="text-slate-400" />
                  <span className="text-sm text-slate-500">{versements.length + operations.length} reçu(s)</span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher par client, pack, référence ou motif..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                />
              </div>
            </div>

            {/* Versements de packs */}
            {versements.filter((v) => {
              if (!debouncedSearch) return true;
              const q = debouncedSearch.toLowerCase();
              const person = v.souscription.client ?? v.souscription.user;
              const name = person ? `${person.prenom} ${person.nom}`.toLowerCase() : "";
              return name.includes(q) || v.souscription.pack.nom.toLowerCase().includes(q) || String(v.id).includes(q);
            }).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Banknote size={15} />
                  Versements de packs
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {versements
                    .filter((v) => {
                      if (!debouncedSearch) return true;
                      const q = debouncedSearch.toLowerCase();
                      const person = v.souscription.client ?? v.souscription.user;
                      const name = person ? `${person.prenom} ${person.nom}`.toLowerCase() : "";
                      return name.includes(q) || v.souscription.pack.nom.toLowerCase().includes(q) || String(v.id).includes(q);
                    })
                    .map((v) => {
                      const person = v.souscription.client ?? v.souscription.user;
                      return (
                        <div key={v.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <span className="inline-flex items-center gap-1.5 bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold">
                                <Receipt size={11} />
                                VER-{String(v.id).padStart(6, "0")}
                              </span>
                              <span className="text-xs text-slate-400">{formatDateTime(v.datePaiement)}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Client</span>
                                <span className="font-semibold text-slate-800 text-right max-w-[130px] truncate">
                                  {person ? `${person.prenom} ${person.nom}` : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Pack</span>
                                <span className="font-semibold text-slate-800 text-right max-w-[130px] truncate">{v.souscription.pack.nom}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Type</span>
                                <span className="text-slate-600">{versementTypeLabel(v.type)}</span>
                              </div>
                              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between">
                                <span className="text-slate-600 font-medium text-sm">Versé</span>
                                <span className="text-lg font-bold text-emerald-600">{formatCurrency(Number(v.montant))}</span>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5">
                            <button
                              onClick={() => handleVoirRecu(v.id)}
                              className="w-full py-2.5 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-200 hover:border-sky-200"
                            >
                              <Printer size={15} />
                              Voir &amp; imprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Opérations financières (encaissements + décaissements) */}
            {operations.filter((op) => {
              if (!debouncedSearch) return true;
              const q = debouncedSearch.toLowerCase();
              return op.reference.toLowerCase().includes(q) || op.motif.toLowerCase().includes(q);
            }).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard size={15} />
                  Opérations financières
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {operations
                    .filter((op) => {
                      if (!debouncedSearch) return true;
                      const q = debouncedSearch.toLowerCase();
                      return op.reference.toLowerCase().includes(q) || op.motif.toLowerCase().includes(q);
                    })
                    .map((op) => {
                      const isEnc = op.type === "ENCAISSEMENT";
                      return (
                        <div key={op.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isEnc ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                {isEnc ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                                {op.reference}
                              </span>
                              <span className="text-xs text-slate-400">{formatDateTime(op.createdAt)}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Type</span>
                                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${isEnc ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                  {isEnc ? "Encaissement" : "Décaissement"}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">{isEnc ? "Mode" : "Catégorie"}</span>
                                <span className="text-slate-600">{isEnc ? modePaiementLabel(op.mode) : categorieLabel(op.categorie)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Motif</span>
                                <span className="text-slate-700 text-right max-w-[130px] truncate text-xs">{op.motif}</span>
                              </div>
                              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between">
                                <span className="text-slate-600 font-medium text-sm">Montant</span>
                                <span className={`text-lg font-bold ${isEnc ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(op.montant)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 pb-5">
                            <button
                              onClick={() => handleVoirRecuOp(op.id)}
                              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border ${
                                isEnc
                                  ? "bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border-slate-200 hover:border-emerald-200"
                                  : "bg-slate-50 hover:bg-red-50 hover:text-red-700 text-slate-600 border-slate-200 hover:border-red-200"
                              }`}
                            >
                              <Printer size={15} />
                              Voir &amp; imprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* État vide global */}
            {versements.length === 0 && operations.length === 0 && (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200">
                <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400">Aucun reçu pour cette session</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB : CLÔTURE
        ============================================================ */}
        {activeTab === "cloture" && (
          <div className="space-y-6">
            {/* Bilan du jour */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  <FileText size={22} className="text-amber-500" />
                  Bilan de la journée — {formatDate(new Date().toISOString())}
                </h3>
                {jourEnCours?.dejaClothuree && (
                  <span className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">
                    <CheckCircle size={16} />
                    Clôturée
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Versements packs",  value: String(jourEnCours?.totalVentes ?? 0),           color: "text-sky-600"     },
                  { label: "Total versements",   value: formatCurrency(jourEnCours?.montantTotal ?? 0),  color: "text-emerald-600" },
                  { label: "Clients",            value: String(jourEnCours?.nbClients ?? 0),             color: "text-pink-600"    },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
                  <p className="text-xs text-emerald-600 mb-1">Encaissements financiers</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(jourEnCours?.totalEncaissementsAutres ?? 0)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
                  <p className="text-xs text-red-500 mb-1">Décaissements</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(jourEnCours?.totalDecaissements ?? 0)}</p>
                </div>
              </div>

              {/* Bilan par pack */}
              {(jourEnCours?.bilanParProduit ?? []).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                    <Package size={15} />
                    Répartition par pack
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Pack</th>
                          <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Versements</th>
                          <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Montant</th>
                          <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(jourEnCours?.bilanParProduit ?? []).map((b) => {
                          const pct = (jourEnCours?.montantTotal ?? 0) > 0
                            ? Math.round((b.montant / jourEnCours!.montantTotal) * 100) : 0;
                          return (
                            <tr key={b.nom} className="hover:bg-slate-50">
                              <td className="py-2.5 font-medium text-slate-800">{b.nom}</td>
                              <td className="py-2.5 text-right">
                                <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-bold">{b.quantite}</span>
                              </td>
                              <td className="py-2.5 text-right font-bold text-emerald-600">{formatCurrency(b.montant)}</td>
                              <td className="py-2.5 text-right text-slate-500 text-xs">{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Formulaire de clôture inline (si pas encore clôturée) */}
              {!jourEnCours?.dejaClothuree && (
                <div className="border-t border-slate-200 pt-6 space-y-5">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Lock size={18} className="text-amber-500" />
                    Calcul de la clôture
                  </h4>

                  {/* Récapitulatif solde */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Fonds de caisse initial</span>
                      <span className="font-semibold">{formatCurrency(fondsCaisseInitial)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>+ Versements packs collectés</span>
                      <span className="font-semibold">{formatCurrency(versementsPacks)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>+ Encaissements financiers</span>
                      <span className="font-semibold">{formatCurrency(encaissementsAutres)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>− Décaissements</span>
                      <span className="font-semibold">{formatCurrency(decaissementsTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>− Transferts</span>
                      <span className="font-semibold">{formatCurrency(transfertsTotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-slate-300 pt-3 mt-1">
                      <span className="text-slate-800">= Solde théorique</span>
                      <span className="text-emerald-700">{formatCurrency(soldeTheorique)}</span>
                    </div>
                  </div>

                  {/* Solde réel + écart */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Solde réel compté (FCFA)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={soldeReel}
                        onChange={(e) => setSoldeReel(e.target.value)}
                        placeholder="Montant compté physiquement en caisse"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-sm"
                      />
                    </div>
                    {ecartCaisse !== null && (
                      <div className={`rounded-xl p-4 border flex flex-col justify-center ${
                        ecartCaisse === 0
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-red-50 border-red-200"
                      }`}>
                        <p className="text-xs text-slate-500 mb-1">Écart de caisse</p>
                        <p className={`text-2xl font-bold ${ecartCaisse === 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {ecartCaisse >= 0 ? "+" : ""}{formatCurrency(ecartCaisse)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {ecartCaisse === 0 ? "Aucun écart ✓" : ecartCaisse > 0 ? "Excédent de caisse" : "Déficit de caisse"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes / observations</label>
                    <textarea
                      rows={3}
                      value={notesClotureInput}
                      onChange={(e) => setNotesCloture(e.target.value)}
                      placeholder="Ex : Aucun incident. Fond de caisse vérifié."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-sm resize-none"
                    />
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle className="text-red-500 w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-red-700 text-xs font-medium">
                      La clôture est irréversible. Elle fermera la session de caisse en cours.
                    </p>
                  </div>

                  {/* Boutons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handlePrintRapport}
                      className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Printer size={16} />
                      Imprimer le rapport
                    </button>
                    <button
                      onClick={handleCloturerCaisse}
                      disabled={cloturant}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {cloturant ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Clôture en cours...</>
                      ) : (
                        <><Lock size={16} />Valider la clôture</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Note de clôture si déjà clôturée */}
              {jourEnCours?.clotureDuJour && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {jourEnCours.clotureDuJour.soldeTheorique !== undefined && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Solde théorique</p>
                        <p className="font-bold text-slate-800">{formatCurrency(jourEnCours.clotureDuJour.soldeTheorique ?? 0)}</p>
                      </div>
                    )}
                    {jourEnCours.clotureDuJour.soldeReel !== null && jourEnCours.clotureDuJour.soldeReel !== undefined && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Solde réel</p>
                        <p className="font-bold text-slate-800">{formatCurrency(jourEnCours.clotureDuJour.soldeReel)}</p>
                      </div>
                    )}
                    {jourEnCours.clotureDuJour.ecart !== null && jourEnCours.clotureDuJour.ecart !== undefined && (
                      <div className={`rounded-xl p-3 border ${(jourEnCours.clotureDuJour.ecart ?? 0) === 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                        <p className="text-xs text-slate-500">Écart</p>
                        <p className={`font-bold ${(jourEnCours.clotureDuJour.ecart ?? 0) === 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {(jourEnCours.clotureDuJour.ecart ?? 0) >= 0 ? "+" : ""}{formatCurrency(jourEnCours.clotureDuJour.ecart ?? 0)}
                        </p>
                      </div>
                    )}
                  </div>
                  {jourEnCours.clotureDuJour.notes && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Notes du caissier</p>
                      <p className="text-sm text-slate-700">{jourEnCours.clotureDuJour.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Détail des versements du jour */}
            {(jourEnCours?.ventesDetail ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-slate-600" />
                  Détail des {jourEnCours?.totalVentes ?? 0} versement(s) du jour
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {["Heure", "Pack", "Client", "Montant"].map((h) => (
                          <th key={h} className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(jourEnCours?.ventesDetail ?? []).map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{v.heure}</td>
                          <td className="py-2.5 pr-4 font-medium text-slate-800">{v.produit}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{v.clientNom}</td>
                          <td className="py-2.5 font-bold text-emerald-600">{formatCurrency(v.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Détail des encaissements financiers du jour */}
            {(jourEnCours?.encaissementsDetail ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowUpCircle size={20} className="text-emerald-600" />
                  Encaissements financiers du jour
                  <span className="ml-auto text-emerald-600 font-bold">{formatCurrency(jourEnCours?.totalEncaissementsAutres ?? 0)}</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {["Heure", "Référence", "Motif", "Mode", "Montant"].map((h) => (
                          <th key={h} className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(jourEnCours?.encaissementsDetail ?? []).map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{e.heure}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{e.reference}</td>
                          <td className="py-2.5 pr-4 text-slate-700">{e.motif}</td>
                          <td className="py-2.5 pr-4">{modePaiementLabel(e.mode)}</td>
                          <td className="py-2.5 font-bold text-emerald-600">{formatCurrency(e.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Détail des décaissements du jour */}
            {(jourEnCours?.decaissementsDetail ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowDownCircle size={20} className="text-red-500" />
                  Décaissements du jour
                  <span className="ml-auto text-red-600 font-bold">{formatCurrency(jourEnCours?.totalDecaissements ?? 0)}</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {["Heure", "Référence", "Catégorie", "Motif", "Montant"].map((h) => (
                          <th key={h} className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(jourEnCours?.decaissementsDetail ?? []).map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{d.heure}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{d.reference}</td>
                          <td className="py-2.5 pr-4">{categorieLabel(d.categorie)}</td>
                          <td className="py-2.5 pr-4 text-slate-700">{d.motif}</td>
                          <td className="py-2.5 font-bold text-red-600">{formatCurrency(d.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Historique des clôtures */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-slate-600" />
                Historique des clôtures
              </h3>
              {(clotureHisto?.data ?? []).length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Aucune clôture enregistrée</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          {["Date", "Caissier", "Versements", "Total", "S. Théorique", "S. Réel", "Écart", "Notes"].map((h) => (
                            <th key={h} className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(clotureHisto?.data ?? []).map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-4 font-semibold text-slate-800">{formatDate(c.date)}</td>
                            <td className="py-3 pr-4 text-slate-600">{c.caissierNom}</td>
                            <td className="py-3 pr-4">
                              <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-bold">{c.totalVentes}</span>
                            </td>
                            <td className="py-3 pr-4 font-bold text-emerald-600">{formatCurrency(c.montantTotal)}</td>
                            <td className="py-3 pr-4 text-slate-600">{c.soldeTheorique !== undefined ? formatCurrency(c.soldeTheorique) : "—"}</td>
                            <td className="py-3 pr-4 text-slate-600">{c.soldeReel != null ? formatCurrency(c.soldeReel) : "—"}</td>
                            <td className="py-3 pr-4">
                              {c.ecart != null ? (
                                <span className={`font-bold text-xs ${c.ecart === 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {c.ecart >= 0 ? "+" : ""}{formatCurrency(c.ecart)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-3 text-slate-500 text-xs max-w-[120px] truncate">{c.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {clotureHisto && clotureHisto.meta.totalPages > 1 && (
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                      <p className="text-sm text-slate-400">Page {clotureHisto.meta.page} / {clotureHisto.meta.totalPages}</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCloturePage((p) => Math.max(1, p - 1))} disabled={cloturePage <= 1} className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                          <ChevronLeft size={14} />
                        </button>
                        <span className="px-3 py-1 bg-slate-800 text-white rounded-lg text-sm">{cloturePage}</span>
                        <button onClick={() => setCloturePage((p) => Math.min(clotureHisto.meta.totalPages, p + 1))} disabled={cloturePage >= clotureHisto.meta.totalPages} className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

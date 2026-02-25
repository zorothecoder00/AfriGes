"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingCart, Receipt, TrendingUp, Search, ArrowLeft, RefreshCw,
  Plus, X, CheckCircle, Clock, Banknote, Printer, BarChart3,
  Users, Hash, AlertTriangle, AlertCircle, Info, ChevronLeft, ChevronRight,
  Lock, Calendar, FileText, Filter, Layers, Eye, XCircle, Package,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
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

interface DashboardData {
  today: { date: string; startOfDay: string };
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
}
interface ClotureData {
  success: boolean;
  jourEnCours: {
    date: string; totalVentes: number; montantTotal: number; panierMoyen: number; nbClients: number;
    dejaClothuree: boolean; clotureDuJour: ClotureCaisse | null;
    bilanParProduit: { nom: string; quantite: number; montant: number }[];
    ventesDetail: { id: number; produit: string; quantite: number; montant: number; clientNom: string; heure: string }[];
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

// ============================================================================
// HELPERS
// ============================================================================

type TabKey = "synthese" | "encaissement" | "historique" | "recus" | "cloture";

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

  const [clotureModal,         setClotureModal]         = useState(false);
  const [notesClotureInput,    setNotesCloture]         = useState("");

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
    const p = new URLSearchParams({ statut: "ACTIF" });
    if (debouncedEncSearch) p.set("search", debouncedEncSearch);
    return p.toString();
  }, [debouncedEncSearch]);

  // ── Fetches ──────────────────────────────────────────────────────────────
  const { data: dashboardRes,  refetch: refetchDashboard  } = useApi<DashboardResponse>("/api/caissier/dashboard");
  const { data: versementsRes, refetch: refetchVersements,
          loading: versementsLoading                        } = useApi<VersementsResponse>(`/api/caissier/ventes?${versementsParams}`);
  const { data: clotureRes,    refetch: refetchCloture     } = useApi<ClotureData>(`/api/caissier/cloture?${clotureParams}`);
  const { data: packsRes,      refetch: refetchPacks       } = useApi<PacksResponse>(`/api/caissier/packs?${encaissementParams}`);

  // ── Mutations ────────────────────────────────────────────────────────────
  const { mutate: collecterVersement, loading: collectant, error: erreurVersement } =
    useMutation<{ versement: { id: number } }, { montant: number; type: string; notes?: string }>(
      `/api/caissier/packs/${versementSouscriptionId}/versement`,
      "POST",
      { successMessage: "Versement enregistré ✓" }
    );

  const { mutate: cloturerCaisse, loading: cloturant } =
    useMutation<ClotureCaisse, { notes?: string }>(
      "/api/caissier/cloture",
      "POST",
      { successMessage: "Caisse clôturée avec succès ✓" }
    );

  // ── Derived data ─────────────────────────────────────────────────────────
  const dashboard    = dashboardRes?.data;
  const versements   = versementsRes?.data ?? [];
  const versementsStats = versementsRes?.stats;
  const versementsMeta  = versementsRes?.meta;
  const jourEnCours  = clotureRes?.jourEnCours;
  const clotureHisto = clotureRes?.historique;
  const souscriptions = packsRes?.souscriptions ?? [];

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openVersementModal = (souscription: SouscriptionItem) => {
    setVersementSouscriptionId(souscription.id);
    setSelectedSouscription(souscription);
    const prochaineEcheance = souscription.echeances.find(
      (e) => e.statut === "EN_ATTENTE" || e.statut === "EN_RETARD"
    );
    setVersementMontant(
      prochaineEcheance
        ? String(Number(prochaineEcheance.montant))
        : String(Number(souscription.montantRestant))
    );
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

  const handleCloturerCaisse = async () => {
    const result = await cloturerCaisse({ notes: notesClotureInput || undefined });
    if (result) {
      setClotureModal(false);
      setNotesCloture("");
      refetchCloture();
      refetchDashboard();
    }
  };

  const refetchAll = () => {
    refetchDashboard();
    refetchVersements();
    refetchCloture();
    refetchPacks();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "synthese",     label: "Synthèse",     icon: BarChart3    },
    { key: "encaissement", label: "Encaissement", icon: Banknote     },
    { key: "historique",   label: "Historique",   icon: Clock        },
    { key: "recus",        label: "Reçus",        icon: Receipt      },
    { key: "cloture",      label: "Clôture",      icon: Lock         },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 font-['DM_Sans',sans-serif]">

      {/* ── Modals ── */}
      {recuModal && recuData && <TicketRecu data={recuData} onClose={() => setRecuModal(false)} />}

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
                {selectedSouscription.echeances.length > 0 && (
                  <div className="pt-1 border-t border-slate-200">
                    <p className="text-xs text-slate-500">
                      Prochaine échéance ({selectedSouscription.echeances[0].statut === "EN_RETARD" ? (
                        <span className="text-red-500 font-medium">EN RETARD</span>
                      ) : (
                        <span>le {formatDate(selectedSouscription.echeances[0].datePrevue)}</span>
                      )}) : {formatCurrency(Number(selectedSouscription.echeances[0].montant))}
                    </p>
                  </div>
                )}
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

      {/* Modal Clôture */}
      {clotureModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-3 rounded-xl"><Lock className="text-amber-600 w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Clôture de caisse</h2>
                  <p className="text-sm text-slate-500">{formatDate(new Date().toISOString())}</p>
                </div>
              </div>
              <button onClick={() => setClotureModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Versements collectés</span>
                  <span className="font-bold text-slate-800">{jourEnCours?.totalVentes ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total encaissé</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(jourEnCours?.montantTotal ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Versement moyen</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(jourEnCours?.panierMoyen ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Clients servis</span>
                  <span className="font-semibold text-slate-700">{jourEnCours?.nbClients ?? 0}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notes / observations (optionnel)
                </label>
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
                  Cette action est irréversible. La caisse sera marquée comme clôturée pour aujourd&apos;hui.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setClotureModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium text-sm hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCloturerCaisse}
                  disabled={cloturant}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cloturant ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Clôture...</>
                  ) : (
                    <><Lock size={16} />Confirmer la clôture</>
                  )}
                </button>
              </div>
            </div>
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
                onClick={() => setActiveTab("encaissement")}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm flex items-center gap-2"
              >
                <Plus size={16} />
                Encaisser
              </button>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            TAB : ENCAISSEMENT
        ============================================================ */}
        {activeTab === "encaissement" && (
          <div className="space-y-6">
            {/* Barre de recherche */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Banknote size={20} className="text-emerald-600" />
                  Souscriptions actives — Collecte versements
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

            {/* Liste des souscriptions actives */}
            {souscriptions.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Aucune souscription active</p>
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
                        <p className="text-sm font-semibold text-slate-700 mb-3">{s.pack.nom}</p>

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
          </div>
        )}

        {/* ============================================================
            TAB : REÇUS
        ============================================================ */}
        {activeTab === "recus" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Receipt size={20} className="text-sky-600" />
                  Reçus du jour
                </h3>
                <div className="flex items-center gap-2">
                  <Filter size={15} className="text-slate-400" />
                  <span className="text-sm text-slate-500">{versements.length} reçu(s)</span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher par client, pack ou n° reçu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {versements
                .filter((v) => {
                  if (!debouncedSearch) return true;
                  const q = debouncedSearch.toLowerCase();
                  const person = v.souscription.client ?? v.souscription.user;
                  const name = person ? `${person.prenom} ${person.nom}`.toLowerCase() : "";
                  return (
                    name.includes(q) ||
                    v.souscription.pack.nom.toLowerCase().includes(q) ||
                    String(v.id).includes(q)
                  );
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
              {versements.length === 0 && (
                <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200">
                  <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">Aucun reçu pour cette période</p>
                </div>
              )}
            </div>
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
                {jourEnCours?.dejaClothuree ? (
                  <span className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">
                    <CheckCircle size={16} />
                    Clôturée
                  </span>
                ) : (
                  <button
                    onClick={() => setClotureModal(true)}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Lock size={16} />
                    Clôturer la caisse
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Versements",    value: String(jourEnCours?.totalVentes ?? 0),          color: "text-sky-600"     },
                  { label: "Total encaissé", value: formatCurrency(jourEnCours?.montantTotal ?? 0), color: "text-emerald-600" },
                  { label: "Moy. versement", value: formatCurrency(jourEnCours?.panierMoyen ?? 0),  color: "text-violet-600"  },
                  { label: "Clients",        value: String(jourEnCours?.nbClients ?? 0),            color: "text-pink-600"    },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Bilan par pack */}
              {(jourEnCours?.bilanParProduit ?? []).length > 0 && (
                <div>
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

              {/* Note de clôture */}
              {jourEnCours?.clotureDuJour?.notes && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Notes du caissier</p>
                  <p className="text-sm text-slate-700">{jourEnCours.clotureDuJour.notes}</p>
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
                          {["Date", "Caissier", "Versements", "Total encaissé", "Moy.", "Clients", "Notes"].map((h) => (
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
                            <td className="py-3 pr-4 text-slate-600">{formatCurrency(c.panierMoyen)}</td>
                            <td className="py-3 pr-4 text-slate-600">{c.nbClients}</td>
                            <td className="py-3 text-slate-500 text-xs max-w-[150px] truncate">{c.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {clotureHisto && clotureHisto.meta.totalPages > 1 && (
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                      <p className="text-sm text-slate-400">
                        Page {clotureHisto.meta.page} / {clotureHisto.meta.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCloturePage((p) => Math.max(1, p - 1))}
                          disabled={cloturePage <= 1}
                          className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="px-3 py-1 bg-slate-800 text-white rounded-lg text-sm">{cloturePage}</span>
                        <button
                          onClick={() => setCloturePage((p) => Math.min(clotureHisto.meta.totalPages, p + 1))}
                          disabled={cloturePage >= clotureHisto.meta.totalPages}
                          className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
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

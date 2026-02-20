"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingCart, Receipt, TrendingUp, Search, ArrowLeft, RefreshCw,
  Plus, X, CheckCircle, Clock, Package, Banknote, Printer, BarChart3,
  Users, Hash, AlertTriangle, AlertCircle, Info, ChevronLeft, ChevronRight,
  Lock, Calendar, FileText, Filter, Layers, Eye, XCircle,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  today: { date: string; startOfDay: string };
  ventes: { total: number; montant: number; panierMoyen: number; nbClients: number };
  stock: {
    total: number; faible: number; rupture: number; valeur: number;
    produitsAlerte: { id: number; nom: string; stock: number; alerteStock: number }[];
  };
  creditsAlimActifs: number;
  derniereCloture: ClotureCaisse | null;
  alertes: { type: "danger" | "warning" | "info"; message: string }[];
  evolution: { heure: number; count: number; montant: number }[];
  dernieresVentes: {
    id: number; produitNom: string; quantite: number;
    montant: number; clientNom: string; heure: string;
  }[];
}
interface DashboardResponse { success: boolean; data: DashboardData }

interface Produit {
  id: number; nom: string; description: string | null;
  prixUnitaire: string; stock: number; alerteStock: number;
}
interface StockResponse {
  data: Produit[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number | string };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Vente {
  id: number; quantite: number; prixUnitaire: string; createdAt: string;
  produit: { id: number; nom: string; prixUnitaire: string };
  creditAlimentaire: {
    id: number; plafond?: string; montantRestant?: string;
    member?: { id: number; nom: string; prenom: string; email: string } | null;
    client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  } | null;
}
interface VentesResponse {
  success: boolean;
  data: Vente[];
  stats: { totalVentes: number; montantTotal: number; panierMoyen: number; quantiteTotale: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreditAlimentaire {
  id: number; plafond: string; montantUtilise: string; montantRestant: string; statut: string;
  member?: { id: number; nom: string; prenom: string; email: string } | null;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
}
interface CreditsAlimResponse {
  data: CreditAlimentaire[];
  stats: { totalActifs: number; montantTotalRestant: number | string };
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

interface RecuData {
  success: boolean;
  data: {
    recu: { numero: string; date: string; caissier: string };
    vente: { id: number; produitNom: string; produitDesc: string | null; quantite: number; prixUnitaire: number; montantTotal: number };
    client: { nom: string; telephone?: string; email?: string };
    creditAlimentaire: { id: number; plafond: number; montantUtilise: number; montantRestant: number; statut: string } | null;
    entreprise: { nom: string; adresse: string; telephone: string };
  };
}

// ============================================================================
// HELPERS
// ============================================================================

type TabKey = "synthese" | "encaissement" | "historique" | "recus" | "cloture";

function alertIcon(type: "danger" | "warning" | "info") {
  if (type === "danger")  return <XCircle    className="w-4 h-4 text-red-500 shrink-0"    />;
  if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return                         <Info          className="w-4 h-4 text-blue-500 shrink-0"  />;
}
function alertBg(type: "danger" | "warning" | "info") {
  if (type === "danger")  return "bg-red-50 border-red-200";
  if (type === "warning") return "bg-amber-50 border-amber-200";
  return "bg-blue-50 border-blue-200";
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

function EvolutionBar({ data }: { data: { heure: number; count: number; montant: number }[] }) {
  const maxMontant = Math.max(...data.map((d) => d.montant), 1);
  // Afficher uniquement les heures d'activité (6h–22h) pour lisibilité
  const heuresActives = data.filter((d) => d.heure >= 6 && d.heure <= 22);
  return (
    <div className="flex items-end gap-1 h-24">
      {heuresActives.map((d) => {
        const pct = (d.montant / maxMontant) * 100;
        return (
          <div key={d.heure} className="flex-1 flex flex-col items-center gap-1">
            <div className="relative group w-full flex items-end justify-center" style={{ height: "72px" }}>
              {/* Tooltip */}
              {d.count > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  {d.count} vente{d.count > 1 ? "s" : ""}<br />{formatCurrency(d.montant)}
                </div>
              )}
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${
                  d.count > 0 ? "bg-sky-500" : "bg-slate-100"
                }`}
                style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 3)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{d.heure}h</span>
          </div>
        );
      })}
    </div>
  );
}

// Ticket reçu printable
function TicketRecu({ data, onClose }: { data: RecuData["data"]; onClose: () => void }) {
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
    <div class="center bold">REÇU DE CAISSE</div>
    <div class="center">${data.recu.numero}</div>
    <div class="center">${new Date(data.recu.date).toLocaleString("fr-FR")}</div>
    <div class="center">Caissier: ${data.recu.caissier}</div>
    <div class="line"></div>
    <div class="row"><span>Client:</span><span class="bold">${data.client.nom}</span></div>
    ${data.client.telephone ? `<div class="row"><span>Tél:</span><span>${data.client.telephone}</span></div>` : ""}
    <div class="line"></div>
    <div class="row"><span class="bold">${data.vente.produitNom}</span></div>
    <div class="row"><span>${data.vente.quantite} x ${data.vente.prixUnitaire.toLocaleString("fr-FR")} FCFA</span></div>
    <div class="line"></div>
    <div class="row total"><span>TOTAL</span><span>${data.vente.montantTotal.toLocaleString("fr-FR")} FCFA</span></div>
    ${data.creditAlimentaire ? `
    <div class="line"></div>
    <div class="row"><span>Solde crédit alim.:</span><span>${data.creditAlimentaire.montantRestant.toLocaleString("fr-FR")} FCFA</span></div>
    ` : ""}
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
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-xl"><Receipt className="text-emerald-600 w-5 h-5" /></div>
            <div>
              <p className="font-bold text-slate-800">Reçu de caisse</p>
              <p className="text-xs text-slate-500">{data.recu.numero}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        {/* Ticket preview */}
        <div className="p-5 font-mono text-sm space-y-1">
          <p className="text-center font-bold text-base">{data.entreprise.nom}</p>
          {data.entreprise.adresse && <p className="text-center text-xs text-slate-500">{data.entreprise.adresse}</p>}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="text-center">
            <p className="font-bold">REÇU DE CAISSE</p>
            <p className="text-xs text-slate-500">{new Date(data.recu.date).toLocaleString("fr-FR")}</p>
            <p className="text-xs text-slate-500">Caissier : {data.recu.caissier}</p>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between text-xs"><span className="text-slate-500">Client</span><span className="font-semibold">{data.client.nom}</span></div>
          {data.client.telephone && <div className="flex justify-between text-xs"><span className="text-slate-500">Tél</span><span>{data.client.telephone}</span></div>}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <p className="font-semibold">{data.vente.produitNom}</p>
          <div className="flex justify-between text-xs">
            <span>{data.vente.quantite} × {formatCurrency(data.vente.prixUnitaire)}</span>
            <span className="font-bold">{formatCurrency(data.vente.montantTotal)}</span>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span className="text-emerald-600">{formatCurrency(data.vente.montantTotal)}</span>
          </div>
          {data.creditAlimentaire && (
            <>
              <div className="border-t border-dashed border-slate-300 my-3" />
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Solde crédit alim.</span>
                <span className="font-semibold text-sky-600">{formatCurrency(data.creditAlimentaire.montantRestant)}</span>
              </div>
            </>
          )}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <p className="text-center text-xs text-slate-400">Merci de votre confiance !</p>
        </div>
        {/* Actions */}
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

  // ── Recherche / filtres ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin,   setDateFin]   = useState("");
  const [filtreAujourdHui, setFiltreAujourdHui] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Pagination ───────────────────────────────────────────────────────────
  const [ventesPage, setVentesPage]   = useState(1);
  const [cloturePage, setCloturePage] = useState(1);

  // ── Modal états ──────────────────────────────────────────────────────────
  const [venteModal,    setVenteModal]    = useState(false);
  const [recuModal,     setRecuModal]     = useState(false);
  const [clotureModal,  setClotureModal]  = useState(false);
  const [recuData,      setRecuData]      = useState<RecuData["data"] | null>(null);
  const [notesClotureInput, setNotesCloture] = useState("");

  // ── Formulaire nouvelle vente ────────────────────────────────────────────
  const [selectedCreditAlim, setSelectedCreditAlim] = useState("");
  const [selectedProduit,    setSelectedProduit]    = useState("");
  const [venteQte,           setVenteQte]           = useState("1");
  const [catalogSearch,      setCatalogSearch]      = useState("");

  // ── Builds API URLs ──────────────────────────────────────────────────────
  const ventesParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(ventesPage), limit: "15" });
    if (filtreAujourdHui) {
      p.set("aujourdHui", "true");
    } else {
      if (dateDebut) p.set("dateDebut", dateDebut);
      if (dateFin)   p.set("dateFin",   dateFin);
    }
    if (debouncedSearch) p.set("search", debouncedSearch);
    return p.toString();
  }, [ventesPage, filtreAujourdHui, dateDebut, dateFin, debouncedSearch]);

  const clotureParams = useMemo(
    () => new URLSearchParams({ page: String(cloturePage), limit: "8" }).toString(),
    [cloturePage]
  );

  // ── Fetches ──────────────────────────────────────────────────────────────
  const { data: dashboardRes,  refetch: refetchDashboard  } = useApi<DashboardResponse>("/api/caissier/dashboard");
  const { data: ventesRes,     refetch: refetchVentes,
          loading: ventesLoading }                           = useApi<VentesResponse>(`/api/caissier/ventes?${ventesParams}`);
  const { data: stockRes,      refetch: refetchStock       } = useApi<StockResponse>("/api/admin/stock?limit=100");
  const { data: creditsAlimRes }                             = useApi<CreditsAlimResponse>("/api/admin/creditsAlimentaires?statut=ACTIF&limit=200");
  const { data: clotureRes,    refetch: refetchCloture     } = useApi<ClotureData>(`/api/caissier/cloture?${clotureParams}`);

  // ── Mutations ────────────────────────────────────────────────────────────
  const { mutate: enregistrerVente, loading: enregistrant, error: erreurVente } =
    useMutation<Vente, { creditAlimentaireId: number; produitId: number; quantite: number }>(
      "/api/caissier/ventes", "POST", { successMessage: "Vente enregistrée ✓" }
    );

  const { mutate: cloturerCaisse, loading: cloturant } =
    useMutation<ClotureCaisse, { notes?: string }>(
      "/api/caissier/cloture", "POST", { successMessage: "Caisse clôturée avec succès ✓" }
    );

  // ── Derived data ─────────────────────────────────────────────────────────
  const dashboard       = dashboardRes?.data;
  const ventes          = ventesRes?.data ?? [];
  const ventesStats     = ventesRes?.stats;
  const ventesMeta      = ventesRes?.meta;
  const produits        = stockRes?.data ?? [];
  const creditsAlim     = creditsAlimRes?.data ?? [];
  const jourEnCours     = clotureRes?.jourEnCours;
  const clotureHisto    = clotureRes?.historique;

  const produitsDisponibles = produits.filter((p) => p.stock > 0);
  const produitsCatalog     = produitsDisponibles.filter((p) =>
    !catalogSearch || p.nom.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const produitChoisi = produits.find((p) => String(p.id) === selectedProduit);
  const creditChoisi  = creditsAlim.find((c) => String(c.id) === selectedCreditAlim);
  const montantVente  = produitChoisi && venteQte
    ? Number(produitChoisi.prixUnitaire) * Number(venteQte) : 0;
  const soldeRestantApres = creditChoisi
    ? Number(creditChoisi.montantRestant) - montantVente : null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEnregistrerVente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditAlim || !selectedProduit || !venteQte) return;
    const result = await enregistrerVente({
      creditAlimentaireId: Number(selectedCreditAlim),
      produitId:           Number(selectedProduit),
      quantite:            Number(venteQte),
    });
    if (result) {
      setVenteModal(false);
      setSelectedCreditAlim("");
      setSelectedProduit("");
      setVenteQte("1");
      refetchVentes();
      refetchStock();
      refetchDashboard();
      // Afficher le reçu automatiquement
      handleVoirRecu(result.id);
    }
  };

  const handleVoirRecu = useCallback(async (venteId: number) => {
    try {
      const res = await fetch(`/api/caissier/recus?venteId=${venteId}`);
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

  const handleOpenVenteModal = (produitId?: string) => {
    if (produitId) setSelectedProduit(produitId);
    setVenteModal(true);
  };

  const refetchAll = () => {
    refetchDashboard();
    refetchVentes();
    refetchStock();
    refetchCloture();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "synthese",      label: "Synthèse",    icon: BarChart3    },
    { key: "encaissement",  label: "Encaissement", icon: ShoppingCart },
    { key: "historique",    label: "Historique",   icon: Clock        },
    { key: "recus",         label: "Reçus",        icon: Receipt      },
    { key: "cloture",       label: "Clôture",      icon: Lock         },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 font-['DM_Sans',sans-serif]">
      {/* ── Modals ── */}
      {recuModal && recuData && <TicketRecu data={recuData} onClose={() => setRecuModal(false)} />}

      {/* Modal Nouvelle Vente */}
      {venteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-sky-50 p-3 rounded-xl"><ShoppingCart className="text-sky-600 w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Nouvelle vente</h2>
                  <p className="text-sm text-slate-500">Via crédit alimentaire</p>
                </div>
              </div>
              <button onClick={() => setVenteModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            {erreurVente && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="text-red-500 w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{erreurVente}</p>
              </div>
            )}
            <form onSubmit={handleEnregistrerVente} className="p-6 space-y-4">
              {/* Bénéficiaire */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Bénéficiaire (Crédit alimentaire actif)
                </label>
                <select
                  value={selectedCreditAlim}
                  onChange={(e) => setSelectedCreditAlim(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                >
                  <option value="">— Sélectionner un bénéficiaire —</option>
                  {creditsAlim.filter((c) => c.statut === "ACTIF").map((c) => {
                    const person = c.client ?? c.member;
                    const nom = person ? `${person.prenom} ${person.nom}` : `Crédit #${c.id}`;
                    return (
                      <option key={c.id} value={c.id}>
                        {nom} — Solde : {formatCurrency(c.montantRestant)}
                      </option>
                    );
                  })}
                </select>
                {creditChoisi && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{
                          width: `${Math.round((Number(creditChoisi.montantUtilise) / Number(creditChoisi.plafond)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {formatCurrency(creditChoisi.montantRestant)} restant
                    </span>
                  </div>
                )}
              </div>

              {/* Produit */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Produit</label>
                <select
                  value={selectedProduit}
                  onChange={(e) => setSelectedProduit(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                >
                  <option value="">— Sélectionner un produit —</option>
                  {produitsDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} — {formatCurrency(p.prixUnitaire)} · {p.stock} en stock
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantité */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantité</label>
                <input
                  type="number" min="1" max={produitChoisi?.stock ?? 999}
                  value={venteQte} required
                  onChange={(e) => setVenteQte(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                />
              </div>

              {/* Récapitulatif */}
              {montantVente > 0 && (
                <div className={`rounded-xl p-4 border ${
                  soldeRestantApres !== null && soldeRestantApres < 0
                    ? "bg-red-50 border-red-200"
                    : "bg-sky-50 border-sky-200"
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Montant total</span>
                    <span className="text-2xl font-bold text-sky-800">{formatCurrency(montantVente)}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {venteQte} × {formatCurrency(produitChoisi?.prixUnitaire ?? 0)}
                  </p>
                  {soldeRestantApres !== null && (
                    <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                      soldeRestantApres < 0 ? "text-red-600" : "text-emerald-600"
                    }`}>
                      {soldeRestantApres < 0 ? (
                        <><AlertCircle className="w-3.5 h-3.5" />Solde insuffisant</>
                      ) : (
                        <><CheckCircle className="w-3.5 h-3.5" />Solde après : {formatCurrency(soldeRestantApres)}</>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={enregistrant || (soldeRestantApres !== null && soldeRestantApres < 0)}
                className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl hover:from-sky-700 hover:to-indigo-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enregistrant ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</>
                ) : (
                  <><CheckCircle size={18} />Valider l&apos;encaissement</>
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
              {/* Récapitulatif */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Ventes enregistrées</span>
                  <span className="font-bold text-slate-800">{jourEnCours?.totalVentes ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">CA total encaissé</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(jourEnCours?.montantTotal ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Panier moyen</span>
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
                <div className="w-8 h-8 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
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
                onClick={() => handleOpenVenteModal()}
                className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-sky-700 hover:to-indigo-700 transition-all shadow-sm flex items-center gap-2"
              >
                <Plus size={16} />
                Nouvelle vente
              </button>
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
                  ? "bg-sky-600 text-white shadow-lg shadow-sky-200"
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
              <KpiCard label="Ventes du jour"    value={String(dashboard?.ventes.total ?? 0)}                  icon={ShoppingCart} color="text-sky-500"     bg="bg-sky-50"     sub="aujourd'hui" />
              <KpiCard label="CA encaissé"        value={formatCurrency(dashboard?.ventes.montant ?? 0)}        icon={Banknote}     color="text-emerald-500" bg="bg-emerald-50" sub="total du jour" />
              <KpiCard label="Panier moyen"       value={formatCurrency(dashboard?.ventes.panierMoyen ?? 0)}    icon={TrendingUp}   color="text-violet-500"  bg="bg-violet-50"  />
              <KpiCard label="Clients servis"     value={String(dashboard?.ventes.nbClients ?? 0)}              icon={Users}        color="text-pink-500"    bg="bg-pink-50"    sub="distincts" />
            </div>

            {/* Bandeaux stock + crédits alim */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl p-5 text-white shadow-lg shadow-sky-200">
                <p className="text-sky-100 text-xs mb-1">Total encaissé</p>
                <p className="text-3xl font-bold">{formatCurrency(dashboard?.ventes.montant ?? 0)}</p>
                <p className="text-sky-200 text-sm mt-2">{dashboard?.ventes.total ?? 0} transactions</p>
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
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Crédits alim.</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Actifs</span>
                  <span className="font-bold text-sky-600">{dashboard?.creditsAlimActifs ?? 0}</span>
                </div>
                {dashboard?.derniereCloture && (
                  <div className="mt-2 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">Dernière clôture</p>
                    <p className="text-sm font-semibold text-slate-700">{formatDate(dashboard.derniereCloture.date)}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(dashboard.derniereCloture.montantTotal)} · {dashboard.derniereCloture.totalVentes} ventes</p>
                  </div>
                )}
              </div>
            </div>

            {/* Graphique évolution par heure */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 size={20} className="text-sky-600" />
                  Évolution des ventes aujourd&apos;hui (par heure)
                </h3>
                <span className="text-xs text-slate-400">{formatDate(new Date().toISOString())}</span>
              </div>
              <EvolutionBar data={dashboard?.evolution ?? []} />
            </div>

            {/* Dernières ventes */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={20} className="text-sky-600" />
                  Dernières ventes enregistrées
                </h3>
                <button
                  onClick={() => setActiveTab("historique")}
                  className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                >
                  Voir tout →
                </button>
              </div>
              <div className="space-y-2">
                {(dashboard?.dernieresVentes ?? []).length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm">Aucune vente enregistrée aujourd&apos;hui</p>
                )}
                {(dashboard?.dernieresVentes ?? []).map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                        <ShoppingCart size={14} className="text-sky-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{v.produitNom} ×{v.quantite}</p>
                        <p className="text-xs text-slate-500">{v.clientNom} · {v.heure}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-600 text-sm">{formatCurrency(v.montant)}</span>
                      <button
                        onClick={() => handleVoirRecu(v.id)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                        title="Voir le reçu"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
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
            {/* Barre de recherche produit */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Package size={20} className="text-sky-600" />
                  Catalogue — Encaissement rapide
                </h3>
                <span className="text-xs text-slate-400">{produitsDisponibles.length} produit(s) disponible(s)</span>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {produitsCatalog.slice(0, 24).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleOpenVenteModal(String(p.id))}
                    className={`rounded-xl p-4 text-left transition-all group border ${
                      p.stock <= p.alerteStock
                        ? "bg-amber-50 border-amber-200 hover:border-amber-400"
                        : "bg-slate-50 border-slate-200 hover:bg-sky-50 hover:border-sky-300"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                      p.stock <= p.alerteStock ? "bg-amber-100" : "bg-sky-100 group-hover:bg-sky-200"
                    }`}>
                      <Package size={18} className={p.stock <= p.alerteStock ? "text-amber-600" : "text-sky-600"} />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm truncate">{p.nom}</p>
                    <p className="text-sky-600 font-bold text-sm mt-1">{formatCurrency(p.prixUnitaire)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {p.stock <= p.alerteStock && <AlertTriangle size={10} className="text-amber-500" />}
                      <p className="text-xs text-slate-500">{p.stock} en stock</p>
                    </div>
                  </button>
                ))}
                {/* Bouton manuel */}
                <button
                  onClick={() => handleOpenVenteModal()}
                  className="rounded-xl p-4 border-2 border-dashed border-slate-300 hover:border-sky-400 hover:bg-sky-50/50 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-sky-600"
                >
                  <Plus size={20} />
                  <span className="text-xs font-medium">Vente manuelle</span>
                </button>
              </div>
              {produitsDisponibles.length === 0 && (
                <div className="text-center py-10">
                  <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Aucun produit disponible en stock</p>
                </div>
              )}
            </div>

            {/* Encours crédits alim */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Layers size={20} className="text-emerald-600" />
                Crédits alimentaires actifs ({creditsAlim.filter((c) => c.statut === "ACTIF").length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {creditsAlim.filter((c) => c.statut === "ACTIF").slice(0, 9).map((c) => {
                  const person = c.client ?? c.member;
                  const usagePct = Number(c.plafond) > 0
                    ? Math.round((Number(c.montantUtilise) / Number(c.plafond)) * 100) : 0;
                  return (
                    <div key={c.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="font-semibold text-slate-800 text-sm">
                        {person ? `${person.prenom} ${person.nom}` : `Crédit #${c.id}`}
                      </p>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Utilisé</span>
                          <span>{usagePct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${usagePct}%` }} />
                        </div>
                      </div>
                      <p className="text-sky-600 font-bold text-sm mt-2">{formatCurrency(c.montantRestant)} <span className="font-normal text-slate-400 text-xs">restant</span></p>
                    </div>
                  );
                })}
              </div>
              {creditsAlim.filter((c) => c.statut === "ACTIF").length === 0 && (
                <p className="text-center py-6 text-slate-400 text-sm">Aucun crédit alimentaire actif</p>
              )}
            </div>
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
                      placeholder="Produit, client..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setVentesPage(1); }}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setFiltreAujourdHui(!filtreAujourdHui); setVentesPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    filtreAujourdHui
                      ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Calendar size={15} />
                  Aujourd&apos;hui
                </button>
                {!filtreAujourdHui && (
                  <>
                    <div>
                      <input
                        type="date"
                        value={dateDebut}
                        onChange={(e) => { setDateDebut(e.target.value); setVentesPage(1); }}
                        className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={dateFin}
                        onChange={(e) => { setDateFin(e.target.value); setVentesPage(1); }}
                        className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                      />
                    </div>
                    {(dateDebut || dateFin) && (
                      <button
                        onClick={() => { setDateDebut(""); setDateFin(""); setVentesPage(1); }}
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
            {ventesStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Transactions",    value: String(ventesStats.totalVentes),                color: "text-sky-600"     },
                  { label: "CA total",        value: formatCurrency(ventesStats.montantTotal),        color: "text-emerald-600" },
                  { label: "Panier moyen",    value: formatCurrency(ventesStats.panierMoyen),         color: "text-violet-600"  },
                  { label: "Qté totale",      value: String(ventesStats.quantiteTotale ?? "—"),      color: "text-amber-600"   },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color} mt-1`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tableau ventes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {ventesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-3 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["N°", "Produit", "Client", "Qté", "P. Unit.", "Montant", "Date/Heure", ""].map((h) => (
                            <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ventes.map((v) => {
                          const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
                          const montant = Number(v.prixUnitaire) * v.quantite;
                          return (
                            <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5 text-xs font-mono text-slate-400 flex items-center gap-1">
                                <Hash size={12} />{v.id}
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800 text-sm">{v.produit?.nom ?? "—"}</td>
                              <td className="px-5 py-3.5 text-sm text-slate-600">{person ? `${person.prenom} ${person.nom}` : "—"}</td>
                              <td className="px-5 py-3.5">
                                <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-bold">{v.quantite}</span>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-slate-700">{formatCurrency(v.prixUnitaire)}</td>
                              <td className="px-5 py-3.5 font-bold text-emerald-600">{formatCurrency(montant)}</td>
                              <td className="px-5 py-3.5 text-xs text-slate-500">{formatDateTime(v.createdAt)}</td>
                              <td className="px-5 py-3.5">
                                <button
                                  onClick={() => handleVoirRecu(v.id)}
                                  className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                  title="Voir le reçu"
                                >
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {ventes.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                              Aucune vente trouvée pour cette période
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {ventesMeta && ventesMeta.totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        Page <span className="font-semibold">{ventesMeta.page}</span> / <span className="font-semibold">{ventesMeta.totalPages}</span>
                        <span className="text-slate-400"> ({ventesMeta.total} ventes)</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setVentesPage((p) => Math.max(1, p - 1))}
                          disabled={ventesPage <= 1}
                          className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 py-1 bg-sky-600 text-white rounded-lg text-sm font-medium">{ventesPage}</span>
                        <button
                          onClick={() => setVentesPage((p) => Math.min(ventesMeta.totalPages, p + 1))}
                          disabled={ventesPage >= ventesMeta.totalPages}
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
                  <span className="text-sm text-slate-500">{ventes.length} reçu(s)</span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher par client, produit ou n° reçu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ventes.filter((v) => {
                if (!debouncedSearch) return true;
                const q = debouncedSearch.toLowerCase();
                const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
                const name = person ? `${person.prenom} ${person.nom}`.toLowerCase() : "";
                return name.includes(q) || v.produit?.nom.toLowerCase().includes(q) || String(v.id).includes(q);
              }).map((vente) => {
                const person = vente.creditAlimentaire?.client ?? vente.creditAlimentaire?.member;
                const montant = Number(vente.prixUnitaire) * vente.quantite;
                return (
                  <div key={vente.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold">
                          <Receipt size={11} />
                          REC-{String(vente.id).padStart(6, "0")}
                        </span>
                        <span className="text-xs text-slate-400">{formatDateTime(vente.createdAt)}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Client</span>
                          <span className="font-semibold text-slate-800 text-right max-w-[130px] truncate">
                            {person ? `${person.prenom} ${person.nom}` : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Produit</span>
                          <span className="font-semibold text-slate-800">{vente.produit?.nom ?? "—"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Quantité</span>
                          <span className="font-semibold text-slate-800">{vente.quantite}</span>
                        </div>
                        <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between">
                          <span className="text-slate-600 font-medium text-sm">Total</span>
                          <span className="text-lg font-bold text-emerald-600">{formatCurrency(montant)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      <button
                        onClick={() => handleVoirRecu(vente.id)}
                        className="w-full py-2.5 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-200 hover:border-sky-200"
                      >
                        <Printer size={15} />
                        Voir &amp; imprimer
                      </button>
                    </div>
                  </div>
                );
              })}
              {ventes.length === 0 && (
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
                  { label: "Ventes",        value: String(jourEnCours?.totalVentes ?? 0),                    color: "text-sky-600"     },
                  { label: "CA encaissé",   value: formatCurrency(jourEnCours?.montantTotal ?? 0),           color: "text-emerald-600" },
                  { label: "Panier moyen",  value: formatCurrency(jourEnCours?.panierMoyen ?? 0),            color: "text-violet-600"  },
                  { label: "Clients",       value: String(jourEnCours?.nbClients ?? 0),                      color: "text-pink-600"    },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Bilan par produit */}
              {(jourEnCours?.bilanParProduit ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                    <Package size={15} />
                    Répartition par produit
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Produit</th>
                          <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Qté</th>
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

              {/* Note de clôture si déjà clôturée */}
              {jourEnCours?.clotureDuJour?.notes && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Notes du caissier</p>
                  <p className="text-sm text-slate-700">{jourEnCours.clotureDuJour.notes}</p>
                </div>
              )}
            </div>

            {/* Détail des ventes du jour */}
            {(jourEnCours?.ventesDetail ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-slate-600" />
                  Détail des {jourEnCours?.totalVentes ?? 0} vente(s) du jour
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {["Heure", "Produit", "Client", "Qté", "Montant"].map((h) => (
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
                          <td className="py-2.5 pr-4">
                            <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-bold">{v.quantite}</span>
                          </td>
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
                          {["Date", "Caissier", "Ventes", "CA", "Panier moy.", "Clients", "Notes"].map((h) => (
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
                  {/* Pagination historique */}
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

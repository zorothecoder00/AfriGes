"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package, Users, ShoppingCart, TrendingUp, AlertTriangle, Archive,
  Search, Eye, ArrowLeft, RefreshCw, Plus, BarChart3, Clock,
  CheckCircle, XCircle, ChevronLeft, ChevronRight, X, Truck,
  ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Banknote,
  Lock, Hash, Filter, Pencil, Trash2, CalendarDays, Boxes,
  MapPin, FileText, PlayCircle, Info,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

// ============================================================================
// TYPES
// ============================================================================

type TabKey      = "synthese" | "stock" | "livraisons" | "caisse" | "equipe";
type StockSub    = "inventaire" | "journal";
type StatutStock = "EN_STOCK" | "STOCK_FAIBLE" | "RUPTURE";
type TypeLiv     = "RECEPTION" | "EXPEDITION";
type StatutLiv   = "EN_ATTENTE" | "EN_COURS" | "LIVREE" | "ANNULEE";

interface Produit {
  id: number; nom: string; description: string | null;
  prixUnitaire: number; stock: number; alerteStock: number;
  createdAt: string; updatedAt: string;
}
interface ProduitsResponse {
  success: boolean; data: Produit[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Mouvement {
  id: number; produitId: number; type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantite: number; motif: string | null; reference: string; dateMouvement: string;
  produit: { id: number; nom: string; stock: number; prixUnitaire: number | string };
}
interface MouvementsResponse {
  success: boolean; data: Mouvement[];
  stats: {
    entrees30j:     { quantite: number; count: number };
    sorties30j:     { quantite: number; count: number };
    ajustements30j: { quantite: number; count: number };
  };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LivraisonLigne {
  id: number; produitId: number; quantitePrevue: number; quantiteRecue: number | null;
  produit: { id: number; nom: string; stock: number; prixUnitaire: number | string };
}
interface Livraison {
  id: number; reference: string; type: TypeLiv; statut: StatutLiv;
  fournisseurNom: string | null; destinataireNom: string | null;
  datePrevisionnelle: string; dateLivraison: string | null;
  notes: string | null; planifiePar: string;
  lignes: LivraisonLigne[];
  createdAt: string; updatedAt: string;
}
interface LivraisonsResponse {
  success: boolean; data: Livraison[];
  stats: { enAttente: number; enCours: number; livrees: number; annulees: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Vente {
  id: number; quantite: number; prixUnitaire: string; createdAt: string;
  produit: { nom: string };
  creditAlimentaire: {
    member?: { nom: string; prenom: string } | null;
    client?: { nom: string; prenom: string } | null;
  } | null;
}
interface VentesResponse {
  success: boolean; data: Vente[];
  stats: { totalVentes: number; montantTotal: number; panierMoyen: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface ClotureCaisse {
  id: number; date: string; caissierNom: string;
  totalVentes: number; montantTotal: number; panierMoyen: number;
  nbClients: number; notes: string | null;
}
interface ClotureResponse {
  success: boolean;
  jourEnCours: { totalVentes: number; montantTotal: number; panierMoyen: number; dejaClothuree: boolean };
  historique: { data: ClotureCaisse[]; meta: { total: number; totalPages: number; page: number; limit: number } };
}

interface MembreEquipe {
  id: number; role: string; actif: boolean;
  member: { id: number; nom: string; prenom: string; email: string; telephone: string | null; etat: string };
}
interface EquipeResponse {
  success: boolean; data: MembreEquipe[];
  stats: { total: number; actifs: number; parRole: Record<string, { total: number; actifs: number }> };
}

interface DashboardData {
  today: { date: string };
  ventes: {
    total: number; montant: number; panierMoyen: number;
    recentes: { id: number; produitNom: string; quantite: number; montant: number; clientNom: string; heure: string }[];
    evolution: { heure: number; count: number; montant: number }[];
  };
  stock: { total: number; enRupture: number; stockFaible: number; valeurStock: number; alertesProduits: { id: number; nom: string; stock: number; alerteStock: number }[] };
  livraisons: { enAttente: number; enCours: number; prochaines: { id: number; reference: string; type: TypeLiv; statut: StatutLiv; partieNom: string; datePrevisionnelle: string; nbLignes: number }[] };
  derniereCloture: ClotureCaisse | null;
  mouvementsRecents: { id: number; type: string; quantite: number; motif: string | null; dateMouvement: string; produitNom: string }[];
  equipe: Record<string, number>;
}
interface DashboardResponse { success: boolean; data: DashboardData }

// ============================================================================
// HELPERS
// ============================================================================

const statutStock = (stock: number, alerte: number): StatutStock => {
  if (stock === 0) return "RUPTURE";
  if (stock <= alerte) return "STOCK_FAIBLE";
  return "EN_STOCK";
};
const stockStyle = {
  EN_STOCK:    { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500", label: "En stock" },
  STOCK_FAIBLE:{ bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500",   bar: "bg-amber-500",   label: "Stock faible" },
  RUPTURE:     { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500",     bar: "bg-red-500",     label: "Rupture" },
};

const livraisonStyle: Record<StatutLiv, { bg: string; text: string; label: string }> = {
  EN_ATTENTE: { bg: "bg-amber-100",   text: "text-amber-700",   label: "En attente" },
  EN_COURS:   { bg: "bg-blue-100",    text: "text-blue-700",    label: "En cours" },
  LIVREE:     { bg: "bg-emerald-100", text: "text-emerald-700", label: "Livrée" },
  ANNULEE:    { bg: "bg-red-100",     text: "text-red-700",     label: "Annulée" },
};
const livraisonTypeStyle: Record<TypeLiv, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  RECEPTION:  { bg: "bg-sky-100",     text: "text-sky-700",     label: "Réception",  icon: ArrowUpCircle  },
  EXPEDITION: { bg: "bg-violet-100",  text: "text-violet-700",  label: "Expédition", icon: ArrowDownCircle},
};

const roleLabels: Record<string, string> = {
  CAISSIER: "Caissier", COMPTABLE: "Comptable", MAGAZINIER: "Magasinier",
  AGENT_TERRAIN: "Agent terrain", COMMERCIAL: "Commercial",
  RESPONSABLE_VENTE_CREDIT: "Resp. vente crédit", CONTROLEUR_TERRAIN: "Contrôleur terrain",
};
const roleColors: Record<string, string> = {
  CAISSIER: "bg-sky-100 text-sky-700", COMPTABLE: "bg-violet-100 text-violet-700",
  MAGAZINIER: "bg-emerald-100 text-emerald-700", AGENT_TERRAIN: "bg-teal-100 text-teal-700",
  COMMERCIAL: "bg-orange-100 text-orange-700", RESPONSABLE_VENTE_CREDIT: "bg-pink-100 text-pink-700",
  CONTROLEUR_TERRAIN: "bg-indigo-100 text-indigo-700",
};

const mvtStyle = {
  ENTREE:     { bg: "bg-emerald-50",  text: "text-emerald-600", icon: ArrowUpCircle,    label: "Entrée"     },
  SORTIE:     { bg: "bg-red-50",      text: "text-red-600",     icon: ArrowDownCircle,  label: "Sortie"     },
  AJUSTEMENT: { bg: "bg-amber-50",    text: "text-amber-600",   icon: ArrowRightLeft,   label: "Ajustement" },
};

function KpiCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
      <div className={`${bg} p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className={`${color} w-5 h-5`} />
      </div>
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBarChart({ data }: { data: { heure: number; count: number; montant: number }[] }) {
  const max = Math.max(...data.map((d) => d.montant), 1);
  const visible = data.filter((d) => d.heure >= 6 && d.heure <= 21);
  return (
    <div className="flex items-end gap-1 h-20">
      {visible.map((d) => (
        <div key={d.heure} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="relative group w-full flex items-end justify-center" style={{ height: "60px" }}>
            {d.count > 0 && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {d.count}v · {formatCurrency(d.montant)}
              </div>
            )}
            <div
              className={`w-full rounded-t transition-all duration-500 ${d.count > 0 ? "bg-indigo-500" : "bg-slate-100"}`}
              style={{ height: `${Math.max((d.montant / max) * 100, d.count > 0 ? 10 : 3)}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-400">{d.heure}h</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ResponsablePDVPage() {
  const [activeTab,   setActiveTab]   = useState<TabKey>("synthese");
  const [stockSub,    setStockSub]    = useState<StockSub>("inventaire");

  // Filtres
  const [searchProduit,  setSearchProduit]  = useState("");
  const [dSearchProduit, setDSearchProduit] = useState("");
  const [searchMvt,      setSearchMvt]      = useState("");
  const [dSearchMvt,     setDSearchMvt]     = useState("");
  const [searchLiv,      setSearchLiv]      = useState("");
  const [dSearchLiv,     setDSearchLiv]     = useState("");
  const [searchEquipe,   setSearchEquipe]   = useState("");
  const [dSearchEquipe,  setDSearchEquipe]  = useState("");

  const [filtreProduit,  setFiltreProduit]  = useState("");
  const [filtreTypeMvt,  setFiltreTypeMvt]  = useState("");
  const [filtreStatutLiv,setFiltreStatutLiv]= useState("");

  // Pagination
  const [prodPage,    setProdPage]    = useState(1);
  const [mvtPage,     setMvtPage]     = useState(1);
  const [livPage,     setLivPage]     = useState(1);
  const [cloturePage, setCloturePage] = useState(1);

  // Modals
  const [modalProduit,    setModalProduit]    = useState<"create" | "edit" | null>(null);
  const [modalMvt,        setModalMvt]        = useState(false);
  const [modalLivraison,  setModalLivraison]  = useState<"create" | "detail" | "valider" | null>(null);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [selectedLiv,     setSelectedLiv]     = useState<Livraison | null>(null);

  // Forms
  const [fNom, setFNom] = useState(""); const [fPrix, setFPrix] = useState("");
  const [fDesc, setFDesc] = useState(""); const [fAlerte, setFAlerte] = useState("0");
  const [fStock, setFStock] = useState("0");
  const [mvtProdId, setMvtProdId] = useState(""); const [mvtType, setMvtType] = useState<"ENTREE"|"SORTIE"|"AJUSTEMENT">("ENTREE");
  const [mvtQte, setMvtQte] = useState(""); const [mvtMotif, setMvtMotif] = useState("");
  const [livType, setLivType] = useState<TypeLiv>("RECEPTION");
  const [livPartie, setLivPartie] = useState(""); const [livDate, setLivDate] = useState("");
  const [livNotes, setLivNotes] = useState("");
  const [livLignes, setLivLignes] = useState<{ produitId: string; quantitePrevue: string }[]>([{ produitId: "", quantitePrevue: "" }]);
  const [validerLignes, setValiderLignes] = useState<Record<number, string>>({});

  // Debounces
  useEffect(() => { const t = setTimeout(() => setDSearchProduit(searchProduit), 350); return () => clearTimeout(t); }, [searchProduit]);
  useEffect(() => { const t = setTimeout(() => setDSearchMvt(searchMvt),          350); return () => clearTimeout(t); }, [searchMvt]);
  useEffect(() => { const t = setTimeout(() => setDSearchLiv(searchLiv),           350); return () => clearTimeout(t); }, [searchLiv]);
  useEffect(() => { const t = setTimeout(() => setDSearchEquipe(searchEquipe),     350); return () => clearTimeout(t); }, [searchEquipe]);

  // ── API URLs ────────────────────────────────────────────────────────────
  const prodParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(prodPage), limit: "12" });
    if (dSearchProduit) p.set("search", dSearchProduit);
    if (filtreProduit)  p.set("statut", filtreProduit);
    return p.toString();
  }, [prodPage, dSearchProduit, filtreProduit]);

  const mvtParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(mvtPage), limit: "15" });
    if (dSearchMvt) p.set("search", dSearchMvt);
    if (filtreTypeMvt) p.set("type", filtreTypeMvt);
    return p.toString();
  }, [mvtPage, dSearchMvt, filtreTypeMvt]);

  const livParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(livPage), limit: "10" });
    if (dSearchLiv)      p.set("search", dSearchLiv);
    if (filtreStatutLiv) p.set("statut", filtreStatutLiv);
    return p.toString();
  }, [livPage, dSearchLiv, filtreStatutLiv]);

  const clotureParams = useMemo(() =>
    new URLSearchParams({ page: String(cloturePage), limit: "8" }).toString(),
    [cloturePage]
  );

  // ── Fetches ─────────────────────────────────────────────────────────────
  const { data: dashRes,    refetch: refetchDash   } = useApi<DashboardResponse>("/api/rpv/dashboard");
  const { data: produitsRes,refetch: refetchProduits} = useApi<ProduitsResponse>(`/api/rpv/produits?${prodParams}`);
  const { data: mvtRes,     refetch: refetchMvt    } = useApi<MouvementsResponse>(`/api/rpv/mouvements?${mvtParams}`);
  const { data: livRes,     refetch: refetchLiv    } = useApi<LivraisonsResponse>(`/api/rpv/livraisons?${livParams}`);
  const { data: ventesRes,  refetch: refetchVentes } = useApi<VentesResponse>("/api/caissier/ventes?aujourdHui=true&limit=20");
  const { data: clotureRes, refetch: refetchCloture} = useApi<ClotureResponse>(`/api/caissier/cloture?${clotureParams}`);
  const { data: equipeRes,  refetch: refetchEquipe } = useApi<EquipeResponse>(
    `/api/rpv/equipe?${dSearchEquipe ? `search=${dSearchEquipe}` : ""}`
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const { mutate: createProduit, loading: creatingProd } =
    useMutation<Produit, object>("/api/rpv/produits", "POST", { successMessage: "Produit créé ✓" });
  const { mutate: updateProduit, loading: updatingProd } =
    useMutation<Produit, object>(
      selectedProduit ? `/api/rpv/produits/${selectedProduit.id}` : "/api/rpv/produits",
      "PUT",
      { successMessage: "Produit modifié ✓" }
    );
  const { mutate: deleteProduit, loading: deletingProd } =
    useMutation<{ success: boolean }, object>(
      selectedProduit ? `/api/rpv/produits/${selectedProduit.id}` : "/api/rpv/produits",
      "DELETE",
      { successMessage: "Produit supprimé ✓" }
    );
  const { mutate: createMvt, loading: creatingMvt } =
    useMutation<object, object>("/api/rpv/mouvements", "POST", { successMessage: "Mouvement enregistré ✓" });
  const { mutate: createLiv, loading: creatingLiv } =
    useMutation<Livraison, object>("/api/rpv/livraisons", "POST", { successMessage: "Livraison planifiée ✓" });
  const { mutate: patchLiv, loading: patchingLiv } =
    useMutation<Livraison, object>(
      selectedLiv ? `/api/rpv/livraisons/${selectedLiv.id}` : "/api/rpv/livraisons",
      "PATCH",
      { successMessage: "Livraison mise à jour ✓" }
    );

  // ── Derived data ─────────────────────────────────────────────────────────
  const dash     = dashRes?.data;
  const produits = produitsRes?.data ?? [];
  const mvts     = mvtRes?.data ?? [];
  const livs     = livRes?.data ?? [];
  const ventes   = ventesRes?.data ?? [];
  const clotData = clotureRes?.jourEnCours;
  const clotures = clotureRes?.historique.data ?? [];
  const equipe   = equipeRes?.data ?? [];

  const allProduits = produits; // pour les selects des modals
  const produitsActifs = produits.filter((p) => p.stock > 0);

  const refetchAll = useCallback(() => {
    refetchDash(); refetchProduits(); refetchMvt();
    refetchLiv(); refetchVentes(); refetchCloture(); refetchEquipe();
  }, [refetchDash, refetchProduits, refetchMvt, refetchLiv, refetchVentes, refetchCloture, refetchEquipe]);

  // ── Handlers produit ─────────────────────────────────────────────────────
  const openCreateProduit = () => {
    setFNom(""); setFPrix(""); setFDesc(""); setFAlerte("0"); setFStock("0");
    setModalProduit("create");
  };
  const openEditProduit = (p: Produit) => {
    setSelectedProduit(p);
    setFNom(p.nom); setFPrix(String(p.prixUnitaire)); setFDesc(p.description ?? "");
    setFAlerte(String(p.alerteStock)); setFStock("0");
    setModalProduit("edit");
  };
  const handleSaveProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalProduit === "create") {
      const r = await createProduit({ nom: fNom, prixUnitaire: Number(fPrix), description: fDesc || null, stock: Number(fStock), alerteStock: Number(fAlerte) });
      if (r) { setModalProduit(null); refetchProduits(); refetchDash(); }
    } else {
      const r = await updateProduit({ nom: fNom, prixUnitaire: Number(fPrix), description: fDesc || null, alerteStock: Number(fAlerte) });
      if (r) { setModalProduit(null); refetchProduits(); refetchDash(); }
    }
  };
  const handleDeleteProduit = async (p: Produit) => {
    if (!confirm(`Supprimer "${p.nom}" ? Cette action est irréversible.`)) return;
    setSelectedProduit(p);
    const r = await deleteProduit({});
    if (r) { refetchProduits(); refetchDash(); }
  };

  // ── Handlers mouvement ────────────────────────────────────────────────────
  const openMvt = (p?: Produit) => {
    setMvtProdId(p ? String(p.id) : ""); setMvtType("ENTREE"); setMvtQte(""); setMvtMotif("");
    setModalMvt(true);
  };
  const handleSaveMvt = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await createMvt({ produitId: Number(mvtProdId), type: mvtType, quantite: Number(mvtQte), motif: mvtMotif || null });
    if (r) { setModalMvt(false); refetchProduits(); refetchMvt(); refetchDash(); }
  };

  // ── Handlers livraison ────────────────────────────────────────────────────
  const openCreateLiv = () => {
    setLivType("RECEPTION"); setLivPartie(""); setLivDate(""); setLivNotes("");
    setLivLignes([{ produitId: "", quantitePrevue: "" }]);
    setModalLivraison("create");
  };
  const openDetailLiv = (l: Livraison) => { setSelectedLiv(l); setModalLivraison("detail"); };
  const openValiderLiv = (l: Livraison) => {
    setSelectedLiv(l);
    const init: Record<number, string> = {};
    l.lignes.forEach((lg) => { init[lg.id] = String(lg.quantitePrevue); });
    setValiderLignes(init);
    setModalLivraison("valider");
  };

  const handleSaveLiv = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesData = livLignes.filter((l) => l.produitId && l.quantitePrevue).map((l) => ({
      produitId: Number(l.produitId), quantitePrevue: Number(l.quantitePrevue),
    }));
    const data: Record<string, unknown> = {
      type: livType, datePrevisionnelle: new Date(livDate).toISOString(),
      notes: livNotes || null, lignes: lignesData,
    };
    if (livType === "RECEPTION") data.fournisseurNom  = livPartie || null;
    else                          data.destinataireNom = livPartie || null;
    const r = await createLiv(data);
    if (r) { setModalLivraison(null); refetchLiv(); refetchDash(); }
  };

  const handleActionLiv = async (action: "demarrer" | "annuler", l: Livraison) => {
    if (action === "annuler" && !confirm(`Annuler la livraison ${l.reference} ?`)) return;
    setSelectedLiv(l);
    const r = await patchLiv({ action });
    if (r) { refetchLiv(); refetchDash(); }
  };

  const handleValiderLiv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiv) return;
    const lignesPayload = selectedLiv.lignes.map((l) => ({
      ligneId: l.id, quantiteRecue: Number(validerLignes[l.id] ?? l.quantitePrevue),
    }));
    const r = await patchLiv({ action: "valider", lignes: lignesPayload });
    if (r) { setModalLivraison(null); refetchLiv(); refetchProduits(); refetchDash(); }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "synthese",    label: "Synthèse",      icon: BarChart3    },
    { key: "stock",       label: "Stock & Produits",icon: Package      },
    { key: "livraisons",  label: "Livraisons",    icon: Truck        },
    { key: "caisse",      label: "Supervision Caisse",icon: Banknote  },
    { key: "equipe",      label: "Équipe",         icon: Users        },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 font-['DM_Sans',sans-serif]">

      {/* ── Modal Produit (créer / modifier) ── */}
      {modalProduit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-xl"><Package className="text-indigo-600 w-5 h-5" /></div>
                <h2 className="font-bold text-slate-800">{modalProduit === "create" ? "Nouveau produit" : `Modifier — ${selectedProduit?.nom}`}</h2>
              </div>
              <button onClick={() => setModalProduit(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveProduit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom du produit *</label>
                  <input required value={fNom} onChange={(e) => setFNom(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    placeholder="Ex : Riz 5kg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prix unitaire (FCFA) *</label>
                  <input required type="number" min="1" value={fPrix} onChange={(e) => setFPrix(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Seuil alerte stock</label>
                  <input type="number" min="0" value={fAlerte} onChange={(e) => setFAlerte(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                </div>
                {modalProduit === "create" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Stock initial</label>
                    <input type="number" min="0" value={fStock} onChange={(e) => setFStock(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                  </div>
                )}
                <div className={modalProduit === "create" ? "" : "col-span-2"}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <input value={fDesc} onChange={(e) => setFDesc(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    placeholder="Optionnel" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalProduit(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={creatingProd || updatingProd}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {(creatingProd || updatingProd)
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</>
                    : <><CheckCircle size={15} />{modalProduit === "create" ? "Créer" : "Enregistrer"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Mouvement de stock ── */}
      {modalMvt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2.5 rounded-xl"><ArrowRightLeft className="text-emerald-600 w-5 h-5" /></div>
                <h2 className="font-bold text-slate-800">Mouvement de stock</h2>
              </div>
              <button onClick={() => setModalMvt(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveMvt} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Produit *</label>
                <select required value={mvtProdId} onChange={(e) => setMvtProdId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
                  <option value="">— Sélectionner —</option>
                  {produits.map((p) => <option key={p.id} value={p.id}>{p.nom} · Stock: {p.stock}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Type de mouvement *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["ENTREE", "SORTIE", "AJUSTEMENT"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setMvtType(t)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${mvtType === t ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"}`}>
                      {t === "ENTREE" ? "Entrée" : t === "SORTIE" ? "Sortie" : "Ajustement"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantité *</label>
                <input required type="number" min={mvtType === "AJUSTEMENT" ? undefined : "1"} value={mvtQte} onChange={(e) => setMvtQte(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  placeholder={mvtType === "AJUSTEMENT" ? "Négatif pour réduire" : "Ex : 10"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motif</label>
                <input value={mvtMotif} onChange={(e) => setMvtMotif(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  placeholder="Optionnel" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalMvt(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={creatingMvt} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {creatingMvt ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</> : <><CheckCircle size={15} />Valider</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Nouvelle Livraison ── */}
      {modalLivraison === "create" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-sky-50 p-2.5 rounded-xl"><Truck className="text-sky-600 w-5 h-5" /></div>
                <h2 className="font-bold text-slate-800">Planifier une livraison</h2>
              </div>
              <button onClick={() => setModalLivraison(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveLiv} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["RECEPTION", "EXPEDITION"] as TypeLiv[]).map((t) => {
                    const s = livraisonTypeStyle[t];
                    return (
                      <button key={t} type="button" onClick={() => setLivType(t)}
                        className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${livType === t ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        <s.icon size={15} />{s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {livType === "RECEPTION" ? "Fournisseur" : "Destinataire"}
                  </label>
                  <input value={livPartie} onChange={(e) => setLivPartie(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    placeholder="Nom ou société" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date prévisionnelle *</label>
                  <input required type="date" value={livDate} onChange={(e) => setLivDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input value={livNotes} onChange={(e) => setLivNotes(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  placeholder="Instructions, adresse, etc." />
              </div>
              {/* Lignes produits */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Lignes produits *</label>
                  <button type="button" onClick={() => setLivLignes([...livLignes, { produitId: "", quantitePrevue: "" }])}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                    <Plus size={13} /> Ajouter
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {livLignes.map((lg, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={lg.produitId}
                        onChange={(e) => setLivLignes(livLignes.map((x, j) => j === i ? { ...x, produitId: e.target.value } : x))}
                        className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50">
                        <option value="">— Produit —</option>
                        {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                      </select>
                      <input type="number" min="1" placeholder="Qté"
                        value={lg.quantitePrevue}
                        onChange={(e) => setLivLignes(livLignes.map((x, j) => j === i ? { ...x, quantitePrevue: e.target.value } : x))}
                        className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                      {livLignes.length > 1 && (
                        <button type="button" onClick={() => setLivLignes(livLignes.filter((_, j) => j !== i))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalLivraison(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={creatingLiv} className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {creatingLiv ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Planification...</> : <><Truck size={15} />Planifier</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Détail Livraison ── */}
      {modalLivraison === "detail" && selectedLiv && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2.5 rounded-xl"><FileText className="text-slate-600 w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-slate-800">{selectedLiv.reference}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${livraisonStyle[selectedLiv.statut].bg} ${livraisonStyle[selectedLiv.statut].text}`}>
                    {livraisonStyle[selectedLiv.statut].label}
                  </span>
                </div>
              </div>
              <button onClick={() => setModalLivraison(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Type</p>
                  <p className="font-semibold text-slate-800">{livraisonTypeStyle[selectedLiv.type].label}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-0.5">{selectedLiv.type === "RECEPTION" ? "Fournisseur" : "Destinataire"}</p>
                  <p className="font-semibold text-slate-800">{selectedLiv.fournisseurNom ?? selectedLiv.destinataireNom ?? "—"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Date prévue</p>
                  <p className="font-semibold text-slate-800">{formatDate(selectedLiv.datePrevisionnelle)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Planifié par</p>
                  <p className="font-semibold text-slate-800">{selectedLiv.planifiePar}</p>
                </div>
              </div>
              {selectedLiv.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">Notes</p>
                  <p className="text-amber-800">{selectedLiv.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">{selectedLiv.lignes.length} ligne(s) de produits</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedLiv.lignes.map((lg) => (
                    <div key={lg.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                      <p className="font-medium text-slate-800 text-sm">{lg.produit.nom}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Prévu: <span className="font-semibold text-slate-700">{lg.quantitePrevue}</span></span>
                        {lg.quantiteRecue !== null && (
                          <span className="text-emerald-600 font-semibold">Reçu: {lg.quantiteRecue}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                {selectedLiv.statut === "EN_ATTENTE" && (
                  <button onClick={() => { setModalLivraison(null); handleActionLiv("demarrer", selectedLiv); }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                    <PlayCircle size={15} />Démarrer
                  </button>
                )}
                {selectedLiv.statut === "EN_COURS" && (
                  <button onClick={() => openValiderLiv(selectedLiv)}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                    <CheckCircle size={15} />Valider réception
                  </button>
                )}
                {["EN_ATTENTE", "EN_COURS"].includes(selectedLiv.statut) && (
                  <button onClick={() => { setModalLivraison(null); handleActionLiv("annuler", selectedLiv); }}
                    className="py-2.5 px-4 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-1.5">
                    <XCircle size={15} />Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Valider livraison ── */}
      {modalLivraison === "valider" && selectedLiv && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2.5 rounded-xl"><CheckCircle className="text-emerald-600 w-5 h-5" /></div>
                <div>
                  <h2 className="font-bold text-slate-800">Valider la réception</h2>
                  <p className="text-xs text-slate-500">{selectedLiv.reference}</p>
                </div>
              </div>
              <button onClick={() => setModalLivraison(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleValiderLiv} className="p-5 space-y-4">
              <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <Info size={15} className="text-blue-500 shrink-0" />
                Saisissez les quantités réellement reçues. Le stock sera mis à jour automatiquement.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedLiv.lignes.map((lg) => (
                  <div key={lg.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">{lg.produit.nom}</p>
                      <p className="text-xs text-slate-400">Prévu : {lg.quantitePrevue}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Reçu *</label>
                      <input required type="number" min="0"
                        value={validerLignes[lg.id] ?? String(lg.quantitePrevue)}
                        onChange={(e) => setValiderLignes({ ...validerLignes, [lg.id]: e.target.value })}
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalLivraison(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={patchingLiv} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {patchingLiv ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Validation...</> : <><CheckCircle size={15} />Confirmer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Responsable PDV
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refetchAll} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Actualiser">
                <RefreshCw size={18} />
              </button>
              {activeTab === "stock" && stockSub === "inventaire" && (
                <>
                  <button onClick={() => openMvt()} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-sm font-medium transition-colors">
                    <ArrowRightLeft size={15} />Mouvement
                  </button>
                  <button onClick={openCreateProduit} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
                    <Plus size={15} />Nouveau produit
                  </button>
                </>
              )}
              {activeTab === "livraisons" && (
                <button onClick={openCreateLiv} className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
                  <Plus size={15} />Planifier livraison
                </button>
              )}
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Alertes stock urgentes */}
        {(dash?.stock.alertesProduits.filter((p) => p.stock === 0) ?? []).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Archive className="text-red-500 w-5 h-5 shrink-0" />
            <p className="text-red-700 text-sm font-medium">
              <strong>{dash!.stock.alertesProduits.filter((p) => p.stock === 0).length} produit(s) en rupture</strong>
              {" "}— {dash!.stock.alertesProduits.filter((p) => p.stock === 0).map((p) => p.nom).join(", ")}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === key ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-100"
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* =====================================================================
            TAB : SYNTHÈSE
        ===================================================================== */}
        {activeTab === "synthese" && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="CA du jour"          value={formatCurrency(dash?.ventes.montant ?? 0)}                icon={ShoppingCart} color="text-sky-500"     bg="bg-sky-50"    sub={`${dash?.ventes.total ?? 0} ventes`} />
              <KpiCard label="Valeur stock"         value={formatCurrency(dash?.stock.valeurStock ?? 0)}             icon={Boxes}        color="text-indigo-500"  bg="bg-indigo-50" sub={`${dash?.stock.total ?? 0} produits`} />
              <KpiCard label="Livraisons actives"   value={String((dash?.livraisons.enAttente ?? 0) + (dash?.livraisons.enCours ?? 0))} icon={Truck} color="text-sky-500" bg="bg-sky-50" sub="en attente + en cours" />
              <KpiCard label="Alertes stock"        value={String((dash?.stock.enRupture ?? 0) + (dash?.stock.stockFaible ?? 0))}       icon={AlertTriangle} color="text-amber-500" bg="bg-amber-50" sub={`${dash?.stock.enRupture ?? 0} rupture · ${dash?.stock.stockFaible ?? 0} faible`} />
            </div>

            {/* 3 colonnes principales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Ventes du jour + graphique */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-indigo-600" />Ventes par heure</h3>
                    <button onClick={() => setActiveTab("caisse")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Supervision →</button>
                  </div>
                  <MiniBarChart data={dash?.ventes.evolution ?? []} />
                </div>
                {/* Dernières ventes */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Clock size={17} className="text-slate-500" />Dernières ventes</h3>
                  <div className="space-y-2">
                    {(dash?.ventes.recentes ?? []).map((v) => (
                      <div key={v.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center"><ShoppingCart size={13} className="text-sky-600" /></div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{v.produitNom} ×{v.quantite}</p>
                            <p className="text-xs text-slate-400">{v.clientNom} · {v.heure}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{formatCurrency(v.montant)}</span>
                      </div>
                    ))}
                    {!dash?.ventes.recentes.length && <p className="text-center py-6 text-slate-400 text-sm">Aucune vente aujourd&apos;hui</p>}
                  </div>
                </div>
              </div>

              {/* Colonne droite */}
              <div className="space-y-5">
                {/* Alertes produits */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><AlertTriangle size={17} className="text-amber-500" />Alertes stock</h3>
                  <div className="space-y-2">
                    {(dash?.stock.alertesProduits ?? []).slice(0, 6).map((p) => {
                      const s = p.stock === 0 ? "RUPTURE" : "STOCK_FAIBLE";
                      return (
                        <div key={p.id} className="flex items-center justify-between py-1.5">
                          <p className="text-sm font-medium text-slate-700 truncate flex-1">{p.nom}</p>
                          <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${stockStyle[s as StatutStock].bg} ${stockStyle[s as StatutStock].text}`}>{p.stock}</span>
                        </div>
                      );
                    })}
                    {!(dash?.stock.alertesProduits ?? []).length && <p className="text-center py-4 text-slate-400 text-sm">Aucune alerte</p>}
                  </div>
                  <button onClick={() => { setActiveTab("stock"); setFiltreProduit("RUPTURE"); }} className="mt-3 w-full py-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors">
                    Voir le stock complet →
                  </button>
                </div>

                {/* Livraisons prochaines */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Truck size={17} className="text-sky-500" />Livraisons actives</h3>
                  <div className="space-y-2">
                    {(dash?.livraisons.prochaines ?? []).map((l) => {
                      const ts = livraisonTypeStyle[l.type];
                      return (
                        <div key={l.id} className="bg-slate-50 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-slate-500">{l.reference}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${livraisonStyle[l.statut].bg} ${livraisonStyle[l.statut].text}`}>{livraisonStyle[l.statut].label}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ts.icon size={13} className={ts.text} />{l.partieNom}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(l.datePrevisionnelle)} · {l.nbLignes} produit(s)</p>
                        </div>
                      );
                    })}
                    {!(dash?.livraisons.prochaines ?? []).length && <p className="text-center py-4 text-slate-400 text-sm">Aucune livraison active</p>}
                  </div>
                  <button onClick={() => setActiveTab("livraisons")} className="mt-3 w-full py-2 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors">
                    Gérer les livraisons →
                  </button>
                </div>

                {/* Derniers mouvements */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ArrowRightLeft size={17} className="text-slate-500" />Mouvements récents</h3>
                  <div className="space-y-2">
                    {(dash?.mouvementsRecents ?? []).map((m) => {
                      const ms = mvtStyle[m.type as keyof typeof mvtStyle];
                      return (
                        <div key={m.id} className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${ms.bg}`}><ms.icon size={13} className={ms.text} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{m.produitNom}</p>
                            <p className="text-xs text-slate-400">{ms.label} ×{m.quantite}</p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{new Date(m.dateMouvement).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats équipe */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={18} className="text-slate-600" />Composition de l&apos;équipe</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(dash?.equipe ?? {}).filter(([, v]) => v > 0).map(([role, count]) => (
                  <div key={role} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${roleColors[role] ?? "bg-slate-100 text-slate-700"}`}>
                    <span>{count}</span>
                    <span>{roleLabels[role] ?? role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB : STOCK & PRODUITS
        ===================================================================== */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {(["inventaire", "journal"] as StockSub[]).map((s) => (
                <button key={s} onClick={() => setStockSub(s)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${stockSub === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {s === "inventaire" ? "Inventaire" : "Journal mouvements"}
                </button>
              ))}
            </div>

            {/* ── Inventaire ── */}
            {stockSub === "inventaire" && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total produits",  value: String(produitsRes?.stats.totalProduits ?? 0),               color: "text-indigo-600" },
                    { label: "En stock",         value: String((produitsRes?.stats.totalProduits ?? 0) - (produitsRes?.stats.enRupture ?? 0) - (produitsRes?.stats.stockFaible ?? 0)), color: "text-emerald-600" },
                    { label: "Stock faible",     value: String(produitsRes?.stats.stockFaible ?? 0),                 color: "text-amber-600" },
                    { label: "Valeur totale",    value: formatCurrency(produitsRes?.stats.valeurTotale ?? 0),         color: "text-violet-600" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60">
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className={`text-xl font-bold ${s.color} mt-1`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-[180px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input type="text" placeholder="Rechercher un produit..." value={searchProduit}
                      onChange={(e) => { setSearchProduit(e.target.value); setProdPage(1); }}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                  </div>
                  <div className="flex gap-2">
                    {["", "EN_STOCK", "STOCK_FAIBLE", "RUPTURE"].map((f) => (
                      <button key={f} onClick={() => { setFiltreProduit(f); setProdPage(1); }}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filtreProduit === f ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        {f === "" ? "Tous" : f === "EN_STOCK" ? "En stock" : f === "STOCK_FAIBLE" ? "Faible" : "Rupture"}
                      </button>
                    ))}
                  </div>
                  <Filter size={15} className="text-slate-400" />
                </div>

                {/* Table produits */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["Produit", "Stock", "Niveau", "Prix unit.", "Valeur", "Statut", ""].map((h) => (
                            <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {produits.map((p) => {
                          const s  = statutStock(p.stock, p.alerteStock);
                          const st = stockStyle[s];
                          const pct = p.alerteStock > 0 ? Math.min((p.stock / (p.alerteStock * 2)) * 100, 100) : (p.stock > 0 ? 100 : 0);
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-slate-800">{p.nom}</p>
                                {p.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{p.description}</p>}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-slate-800 text-lg">{p.stock}</td>
                              <td className="px-5 py-3.5">
                                <div className="w-24">
                                  <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>0</span><span>Seuil:{p.alerteStock}</span></div>
                                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${st.bar} rounded-full`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{formatCurrency(p.prixUnitaire)}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-800">{formatCurrency(p.stock * p.prixUnitaire)}</td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openMvt(p)} title="Mouvement" className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><ArrowRightLeft size={14} /></button>
                                  <button onClick={() => openEditProduit(p)} title="Modifier" className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                                  <button onClick={() => handleDeleteProduit(p)} disabled={deletingProd} title="Supprimer" className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {produits.length === 0 && (
                          <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">Aucun produit trouvé</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {produitsRes?.meta && produitsRes.meta.totalPages > 1 && (
                    <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-sm text-slate-400">Page {produitsRes.meta.page}/{produitsRes.meta.totalPages} ({produitsRes.meta.total})</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setProdPage((p) => Math.max(1, p - 1))} disabled={prodPage <= 1} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm">{prodPage}</span>
                        <button onClick={() => setProdPage((p) => Math.min(produitsRes.meta.totalPages, p + 1))} disabled={prodPage >= produitsRes.meta.totalPages} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={15} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Journal Mouvements ── */}
            {stockSub === "journal" && (
              <>
                {/* Stats 30j */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Entrées (30j)",     val: mvtRes?.stats.entrees30j,      color: "text-emerald-600", bg: "bg-emerald-50", icon: ArrowUpCircle   },
                    { label: "Sorties (30j)",      val: mvtRes?.stats.sorties30j,      color: "text-red-600",     bg: "bg-red-50",     icon: ArrowDownCircle},
                    { label: "Ajustements (30j)",  val: mvtRes?.stats.ajustements30j,  color: "text-amber-600",   bg: "bg-amber-50",   icon: ArrowRightLeft },
                  ].map(({ label, val, color, bg, icon: Icon }) => (
                    <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 flex items-center gap-3">
                      <div className={`${bg} p-2.5 rounded-xl`}><Icon className={`${color} w-5 h-5`} /></div>
                      <div>
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>{val?.count ?? 0} op. · {val?.quantite ?? 0} u.</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filtres mouvements */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[180px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input type="text" placeholder="Produit, motif, référence..." value={searchMvt}
                      onChange={(e) => { setSearchMvt(e.target.value); setMvtPage(1); }}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                  </div>
                  <div className="flex gap-2">
                    {["", "ENTREE", "SORTIE", "AJUSTEMENT"].map((f) => (
                      <button key={f} onClick={() => { setFiltreTypeMvt(f); setMvtPage(1); }}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filtreTypeMvt === f ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        {f === "" ? "Tous" : f === "ENTREE" ? "Entrées" : f === "SORTIE" ? "Sorties" : "Ajustements"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table mouvements */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["Référence", "Produit", "Type", "Qté", "Motif", "Date"].map((h) => (
                            <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mvts.map((m) => {
                          const ms = mvtStyle[m.type];
                          return (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{m.reference.slice(0, 16)}…</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800">{m.produit.nom}</td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ms.bg} ${ms.text}`}>
                                  <ms.icon size={12} />{ms.label}
                                </span>
                              </td>
                              <td className="px-5 py-3.5"><span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{m.quantite}</span></td>
                              <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[180px] truncate">{m.motif ?? "—"}</td>
                              <td className="px-5 py-3.5 text-xs text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                            </tr>
                          );
                        })}
                        {mvts.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">Aucun mouvement trouvé</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {mvtRes?.meta && mvtRes.meta.totalPages > 1 && (
                    <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-sm text-slate-400">Page {mvtRes.meta.page}/{mvtRes.meta.totalPages}</p>
                      <div className="flex gap-2 items-center">
                        <button onClick={() => setMvtPage((p) => Math.max(1, p - 1))} disabled={mvtPage <= 1} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft size={15} /></button>
                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm">{mvtPage}</span>
                        <button onClick={() => setMvtPage((p) => Math.min(mvtRes.meta.totalPages, p + 1))} disabled={mvtPage >= mvtRes.meta.totalPages} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronRight size={15} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB : LIVRAISONS
        ===================================================================== */}
        {activeTab === "livraisons" && (
          <div className="space-y-4">
            {/* Stats badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "En attente", value: livRes?.stats.enAttente ?? 0, color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   },
                { label: "En cours",   value: livRes?.stats.enCours   ?? 0, color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"    },
                { label: "Livrées",    value: livRes?.stats.livrees    ?? 0, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
                { label: "Annulées",   value: livRes?.stats.annulees   ?? 0, color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
                  <p className="text-xs font-medium text-slate-500 mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Référence, fournisseur..." value={searchLiv}
                  onChange={(e) => { setSearchLiv(e.target.value); setLivPage(1); }}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50" />
              </div>
              <div className="flex gap-2">
                {["", "EN_ATTENTE", "EN_COURS", "LIVREE", "ANNULEE"].map((f) => (
                  <button key={f} onClick={() => { setFiltreStatutLiv(f); setLivPage(1); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filtreStatutLiv === f ? "bg-sky-600 text-white border-sky-600" : "border-slate-200 text-slate-600 hover:border-sky-300"}`}>
                    {f === "" ? "Toutes" : livraisonStyle[f as StatutLiv]?.label ?? f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table livraisons */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Type", "Statut", "Fournisseur / Destin.", "Date prév.", "Lignes", "Planifié par", ""].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {livs.map((l) => {
                      const ts = livraisonTypeStyle[l.type];
                      const ss = livraisonStyle[l.statut];
                      return (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{l.reference}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${ts.bg} ${ts.text}`}>
                              <ts.icon size={11} />{ts.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ss.bg} ${ss.text}`}>{ss.label}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{l.fournisseurNom ?? l.destinataireNom ?? "—"}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">{formatDate(l.datePrevisionnelle)}</td>
                          <td className="px-5 py-3.5"><span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">{l.lignes.length}</span></td>
                          <td className="px-5 py-3.5 text-sm text-slate-500">{l.planifiePar}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openDetailLiv(l)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Détail"><Eye size={14} /></button>
                              {l.statut === "EN_ATTENTE" && (
                                <button onClick={() => handleActionLiv("demarrer", l)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Démarrer"><PlayCircle size={14} /></button>
                              )}
                              {l.statut === "EN_COURS" && (
                                <button onClick={() => openValiderLiv(l)} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Valider"><CheckCircle size={14} /></button>
                              )}
                              {["EN_ATTENTE", "EN_COURS"].includes(l.statut) && (
                                <button onClick={() => handleActionLiv("annuler", l)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Annuler"><XCircle size={14} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {livs.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">Aucune livraison trouvée</td></tr>}
                  </tbody>
                </table>
              </div>
              {livRes?.meta && livRes.meta.totalPages > 1 && (
                <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm text-slate-400">Page {livRes.meta.page}/{livRes.meta.totalPages} ({livRes.meta.total})</p>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => setLivPage((p) => Math.max(1, p - 1))} disabled={livPage <= 1} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft size={15} /></button>
                    <span className="px-3 py-1 bg-sky-600 text-white rounded-lg text-sm">{livPage}</span>
                    <button onClick={() => setLivPage((p) => Math.min(livRes.meta.totalPages, p + 1))} disabled={livPage >= livRes.meta.totalPages} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronRight size={15} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB : SUPERVISION CAISSE
        ===================================================================== */}
        {activeTab === "caisse" && (
          <div className="space-y-5">
            {/* KPIs caisse */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Ventes du jour"   value={String(ventesRes?.stats.totalVentes ?? 0)}             icon={ShoppingCart} color="text-sky-500"     bg="bg-sky-50"     />
              <KpiCard label="CA du jour"        value={formatCurrency(ventesRes?.stats.montantTotal ?? 0)}    icon={Banknote}     color="text-emerald-500" bg="bg-emerald-50" />
              <KpiCard label="Panier moyen"      value={formatCurrency(ventesRes?.stats.panierMoyen ?? 0)}     icon={TrendingUp}   color="text-violet-500"  bg="bg-violet-50"  />
              <KpiCard label="Caisse"            value={clotData?.dejaClothuree ? "Clôturée" : "Ouverte"}      icon={Lock}         color={clotData?.dejaClothuree ? "text-emerald-500" : "text-amber-500"} bg={clotData?.dejaClothuree ? "bg-emerald-50" : "bg-amber-50"} sub={clotData?.dejaClothuree ? "clôture effectuée" : "en activité"} />
            </div>

            {/* 2 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Ventes récentes */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShoppingCart size={17} className="text-sky-600" />Ventes du jour</h3>
                  <span className="text-sm text-slate-400">{ventes.length} enregistrées</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["#", "Produit", "Client", "Qté", "Montant", "Heure"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ventes.slice(0, 15).map((v) => {
                        const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
                        const montant = Number(v.prixUnitaire) * v.quantite;
                        return (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">#{v.id}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-800 text-sm">{v.produit.nom}</td>
                            <td className="px-4 py-2.5 text-sm text-slate-600">{person ? `${person.prenom} ${person.nom}` : "—"}</td>
                            <td className="px-4 py-2.5"><span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">{v.quantite}</span></td>
                            <td className="px-4 py-2.5 font-bold text-emerald-600 text-sm">{formatCurrency(montant)}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                          </tr>
                        );
                      })}
                      {ventes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Aucune vente aujourd&apos;hui</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historique clôtures */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Lock size={17} className="text-amber-500" />Clôtures récentes</h3>
                  <span className="text-sm text-slate-400">{clotureRes?.historique.meta.total ?? 0} total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Date", "Caissier", "Ventes", "CA", "Panier", "Statut"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clotures.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800 text-sm">{formatDate(c.date)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{c.caissierNom}</td>
                          <td className="px-4 py-3"><span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">{c.totalVentes}</span></td>
                          <td className="px-4 py-3 font-bold text-emerald-600 text-sm">{formatCurrency(c.montantTotal)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(c.panierMoyen)}</td>
                          <td className="px-4 py-3"><span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><CheckCircle size={10} />Clôturée</span></td>
                        </tr>
                      ))}
                      {clotures.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Aucune clôture enregistrée</td></tr>}
                    </tbody>
                  </table>
                </div>
                {clotureRes?.historique.meta && clotureRes.historique.meta.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-400">Page {cloturePage}/{clotureRes.historique.meta.totalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setCloturePage((p) => Math.max(1, p - 1))} disabled={cloturePage <= 1} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft size={13} /></button>
                      <button onClick={() => setCloturePage((p) => Math.min(clotureRes.historique.meta.totalPages, p + 1))} disabled={cloturePage >= clotureRes.historique.meta.totalPages} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"><ChevronRight size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB : ÉQUIPE
        ===================================================================== */}
        {activeTab === "equipe" && (
          <div className="space-y-5">
            {/* Stats par rôle */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {Object.entries(equipeRes?.stats.parRole ?? {}).map(([role, s]) => (
                <div key={role} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 text-center">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${roleColors[role] ?? "bg-slate-100 text-slate-700"}`}>{roleLabels[role] ?? role}</span>
                  <p className="text-2xl font-bold text-slate-800">{s.total}</p>
                  <p className="text-xs text-slate-400">{s.actifs} actif(s)</p>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Rechercher un membre de l'équipe..." value={searchEquipe}
                  onChange={(e) => setSearchEquipe(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
              </div>
            </div>

            {/* Table équipe */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Membre", "Rôle", "Contact", "État", ""].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {equipe.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                              {g.member.prenom?.[0]}{g.member.nom?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{g.member.prenom} {g.member.nom}</p>
                              <p className="text-xs text-slate-400">{g.member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[g.role] ?? "bg-slate-100 text-slate-700"}`}>
                            {roleLabels[g.role] ?? g.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{g.member.telephone ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${g.actif && g.member.etat === "ACTIF" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {g.actif && g.member.etat === "ACTIF"
                              ? <><CheckCircle size={11} />Actif</>
                              : <><XCircle size={11} />Inactif</>}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/dashboard/admin/gestionnaires/${g.id}`} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex">
                            <Eye size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {equipe.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">Aucun membre trouvé</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3.5 border-t border-slate-100 text-sm text-slate-400">
                {equipeRes?.stats.total ?? 0} membre(s) · {equipeRes?.stats.actifs ?? 0} actif(s)
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

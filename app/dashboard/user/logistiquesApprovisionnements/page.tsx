"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Truck, Package, ArrowUpCircle, ArrowDownCircle, Search, ArrowLeft,
  RefreshCw, AlertTriangle, Archive, CheckCircle, ClipboardList,
  Boxes, BarChart3, Plus, X, MapPin, ClipboardCheck, Filter,
  TrendingUp, LucideIcon, PlayCircle, ChevronDown, ChevronUp,
  ShieldAlert, Send, Clock, CheckSquare, XCircle, History,
} from "lucide-react";
import Link from "next/link";
import HistoriquePrixProduit from "@/components/HistoriquePrixProduit";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { useT } from "@/contexts/AppSettingsContext";
import { usePageAccess } from "@/hooks/usePageAccess";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  prixAchat?: string | null;
  valeurStock?: number;
  stock: number;
  quantite?: number;
  quantiteReservee?: number;
  quantiteEnTransit?: number;
  quantiteEndommagee?: number;
  stockTheorique?: number;
  alerteStock: number;
  updatedAt: string;
}

interface StockResponse {
  data: Produit[];
  pdvs?: PDVOption[];
  userPdvId?: number | null;
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

interface Mouvement {
  id: number;
  type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantite: number;
  motif: string | null;
  reference: string;
  dateMouvement: string;
  produit: { id: number; nom: string; stock: number };
}

interface MouvementsResponse {
  data:  Mouvement[];
  stats: { totalEntrees: number; totalSorties: number; totalAjustements: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

interface FournisseurOption { id: number; nom: string; telephone: string | null; }
interface ProduitOption { id: number; nom: string; reference: string | null; unite: string | null; prixUnitaire: string; }

interface ReceptionsResponse {
  data:  Mouvement[];
  fournisseurs?: FournisseurOption[];
  produits?: ProduitOption[];
  stats: { totalReceptions30j: number; totalQuantiteRecue30j: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

interface LignePendingReception {
  id: number;
  produitId: number;
  quantiteAttendue: number;
  quantiteRecue: number | null;
  produit: { id: number; nom: string; unite: string | null };
}

interface PendingReceptionAppro {
  id: number;
  reference: string;
  type: "FOURNISSEUR" | "INTERNE";
  statut: string;
  origineNom: string | null;
  notes: string | null;
  datePrevisionnelle: string;
  pointDeVente: { id: number; nom: string; code: string };
  lignes: LignePendingReception[];
}

interface PendingReceptionsResponse {
  data: PendingReceptionAppro[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface PDVOption {
  id: number;
  nom: string;
  code: string;
  type: string
}

interface AffectationsResponse {
  data:  Mouvement[];
  pdvs: PDVOption[];
  sourcePdv?: PDVOption;
  stats: { totalAffectations30j: number; totalQuantiteAffectee30j: number };
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

type TypePack = "ALIMENTAIRE" | "REVENDEUR" | "FAMILIAL" | "URGENCE" | "EPARGNE_PRODUIT" | "FIDELITE";

interface LigneLivraisonPack {
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
  lignes: LigneLivraisonPack[];
}

interface LivraisonsPackResponse {
  planifiees: ReceptionPack[];
  livreesRecentes: ReceptionPack[];
  stats: { totalPlanifiees: number; totalLivrees: number };
}

const PACK_LABELS: Record<TypePack, string> = {
  ALIMENTAIRE: "Alimentaire", REVENDEUR: "Revendeur", FAMILIAL: "Familial",
  URGENCE: "Urgence", EPARGNE_PRODUIT: "Épargne-Produit", FIDELITE: "Fidélité",
};

const PACK_BADGE: Record<TypePack, string> = {
  ALIMENTAIRE:    "bg-green-100 text-green-800",
  REVENDEUR:      "bg-blue-100 text-blue-800",
  FAMILIAL:       "bg-purple-100 text-purple-800",
  URGENCE:        "bg-red-100 text-red-800",
  EPARGNE_PRODUIT:"bg-amber-100 text-amber-800",
  FIDELITE:       "bg-pink-100 text-pink-800",
};

type StatutStock = "EN_STOCK" | "STOCK_FAIBLE" | "RUPTURE";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getStatut = (stock: number, alerte: number): StatutStock =>
  stock === 0 ? "RUPTURE" : stock <= alerte ? "STOCK_FAIBLE" : "EN_STOCK";

const statutStyles: Record<StatutStock, { bg: string; text: string; dot: string; label: string }> = {
  EN_STOCK:    { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "En stock" },
  STOCK_FAIBLE:{ bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500",   label: "Stock faible" },
  RUPTURE:     { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500",     label: "Rupture" },
};

const typeMvtStyles: Record<string, { bg: string; text: string; icon: LucideIcon; label: string }> = {
  ENTREE:     { bg: "bg-emerald-100", text: "text-emerald-700", icon: ArrowUpCircle,   label: "Entrée" },
  SORTIE:     { bg: "bg-red-100",     text: "text-red-700",     icon: ArrowDownCircle, label: "Sortie" },
  AJUSTEMENT: { bg: "bg-blue-100",    text: "text-blue-700",    icon: ClipboardCheck,  label: "Ajustement" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({
  label, value, subtitle, icon: Icon, color, lightBg,
}: {
  label: string; value: string; subtitle?: string;
  icon: LucideIcon; color: string; lightBg: string;
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
    <div className={`${lightBg} w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <Icon className={`${color} w-6 h-6`} />
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{label}</h3>
    <p className="text-3xl font-bold text-slate-800">{value}</p>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "reception" | "affectation" | "livraisons" | "journal" | "anomalies";

export default function LogistiqueApprovisionnementPage() {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  const t = useT();
  const { isAllowed, allowedPages } = usePageAccess();

  const [activeTab, setActiveTab] = useState<Tab>("reception");

  // ── Stock / produits ──────────────────────────────────────────────────────
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stockPage, setStockPage]             = useState(1);
  const [prixHistoProduit, setPrixHistoProduit] = useState<{ id: number; nom: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const stockParams = new URLSearchParams({ page: String(stockPage), limit: "15" });
  if (debouncedSearch) stockParams.set("search", debouncedSearch);
  const { data: stockRes, loading: stockLoading, refetch: refetchStock } =
    useApi<StockResponse>(`/api/logistique/stock?${stockParams}`);

  const produits = stockRes?.data ?? [];
  const stats    = stockRes?.stats;
  const meta     = stockRes?.meta;

  // ── Livraisons RPV (démarrer BROUILLON → EN_COURS) ────────────────────────
  interface LivraisonRpvLigne {
    id: number; produitId: number; quantiteAttendue: number; quantiteRecue: number | null;
    produit: { id: number; nom: string; prixUnitaire: string };
  }
  interface LivraisonRpv {
    id: number; reference: string;
    type: "FOURNISSEUR" | "INTERNE";
    statut: "BROUILLON" | "EN_COURS" | "RECU" | "VALIDE" | "ANNULE";
    datePrevisionnelle: string; dateReception: string | null;
    fournisseurNom: string | null; notes: string | null;
    lignes: LivraisonRpvLigne[];
  }
  interface LivraisonsRpvResponse {
    success: boolean; data: LivraisonRpv[];
    stats: { brouillon: number; enCours: number };
  }

  // ── Transferts entrants (EN_COURS/EXPEDIE vers le PDV de l'utilisateur) ──
  interface LigneTransfert {
    id: number; quantite: number;
    produit: { id: number; nom: string; unite: string | null };
  }
  interface TransfertEntrant {
    id: number; reference: string; statut: string;
    origine: { id: number; nom: string; code: string };
    destination: { id: number; nom: string; code: string };
    creePar: { id: number; nom: string; prenom: string };
    lignes: LigneTransfert[];
    createdAt: string;
    dateExpedition: string | null;
  }
  interface TransfertsEntrantsResponse {
    data: TransfertEntrant[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }

  const { data: livraisonsRpvRes, loading: livraisonsRpvLoading, refetch: refetchLivraisonsRpv } =
    useApi<LivraisonsRpvResponse>("/api/logistique/livraisons-rpv");

  const [demarrantId, setDemarrantId] = useState<number | null>(null);
  const { mutate: doDemarrer, loading: demarrerLoading } = useMutation<unknown, { id: number; action: string }>(
    "/api/logistique/livraisons-rpv",
    "PATCH",
    { successMessage: "Livraison démarrée — le Magasinier peut maintenant valider la réception." }
  );
  const handleDemarrer = async (liv: LivraisonRpv) => {
    setDemarrantId(liv.id);
    const r = await doDemarrer({ id: liv.id, action: "demarrer" });
    if (r) refetchLivraisonsRpv();
    setDemarrantId(null);
  };

  // ── Transferts entrants à confirmer ──────────────────────────────────────
  const { data: transfertsEntrantsRes, loading: transfertsEntrantsLoading, refetch: refetchTransfertsEntrants } =
    useApi<TransfertsEntrantsResponse>("/api/logistique/transferts?entrants=true");
  const transfertsEntrants = transfertsEntrantsRes?.data ?? [];

  const [confirmantTransfertId, setConfirmantTransfertId] = useState<number | null>(null);
  const confirmerTransfertIdRef = useRef<number | null>(null);
  const { mutate: doConfirmerTransfert, loading: confirmTransfertLoading } =
    useMutation<unknown, { action: string }>(
      () => confirmerTransfertIdRef.current ? `/api/logistique/transferts/${confirmerTransfertIdRef.current}` : "",
      "PATCH",
      { successMessage: "Transfert confirmé — stock mis à jour !" }
    );
  const handleConfirmerTransfert = async (id: number) => {
    confirmerTransfertIdRef.current = id;
    setConfirmantTransfertId(id);
    const r = await doConfirmerTransfert({ action: "RECEVOIR" });
    if (r) { refetchTransfertsEntrants(); refetchStock(); }
    setConfirmantTransfertId(null);
    confirmerTransfertIdRef.current = null;
  };

  // ── Livraisons Packs (confirmation) ──────────────────────────────────────
  const { data: livraisonsPackRes, loading: livraisonsPackLoading, refetch: refetchLivraisonsPack } =
    useApi<LivraisonsPackResponse>("/api/logistique/livraisons-packs");

  const [confirmingPackId, setConfirmingPackId] = useState<number | null>(null);

  const { mutate: doConfirmPack } = useMutation(
    confirmingPackId !== null
      ? `/api/logistique/livraisons-packs/${confirmingPackId}/confirmer`
      : "",
    "POST",
    { successMessage: "Livraison pack confirmée !" }
  );

  useEffect(() => {
    if (confirmingPackId === null) return;
    doConfirmPack({}).then((res) => {
      if (res) {
        refetchLivraisonsPack(); // liste des planifiées
        refetchJournal();        // journal des mouvements (tab 4)
        refetchStock();          // stock mis à jour (tab 1)
      }
      setConfirmingPackId(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingPackId]);

  // ── Réceptions ─────────────────────────────────────────────────────────────
  const [livrPage, setLivrPage]           = useState(1);
  const [livrSearch, setLivrSearch]       = useState("");
  const [livrDebounced, setLivrDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLivrDebounced(livrSearch), 350);
    return () => clearTimeout(t);
  }, [livrSearch]);

  const livrParams = new URLSearchParams({ page: String(livrPage), limit: "15" });
  if (livrDebounced) livrParams.set("search", livrDebounced);
  const { data: receptionsRes, refetch: refetchReceptions } =
    useApi<ReceptionsResponse>(`/api/logistique/receptions?${livrParams}`);

  // ── Commandes en transit (EN_COURS INTERNE) à confirmer ──────────────────
  const { data: pendingReceptionsRes, refetch: refetchPending } =
    useApi<PendingReceptionsResponse>("/api/logistique/receptions?statut=EN_COURS&type=INTERNE&limit=50");
  const pendingReceptions = pendingReceptionsRes?.data ?? [];

  const [confirmingReceptionId, setConfirmingReceptionId] = useState<number | null>(null);
  const confirmingReceptionIdRef = useRef<number | null>(null);
  const { mutate: doValiderReception, loading: validatingReception } =
    useMutation<unknown, object>(
      () => confirmingReceptionIdRef.current ? `/api/logistique/receptions/${confirmingReceptionIdRef.current}` : "",
      "PATCH",
      { successMessage: "Réception confirmée — stock mis à jour !" }
    );

  const handleConfirmerReception = async (rec: PendingReceptionAppro) => {
    confirmingReceptionIdRef.current = rec.id;
    setConfirmingReceptionId(rec.id);
    const lignesRecues = rec.lignes.map(l => ({
      ligneId:       l.id,
      quantiteRecue: l.quantiteRecue ?? l.quantiteAttendue,
      etatQualite:   "BON",
    }));
    const result = await doValiderReception({ action: "VALIDER", lignesRecues });
    if (result) {
      refetchPending();
      refetchStock();
      refetchJournal();
    }
    setConfirmingReceptionId(null);
    confirmingReceptionIdRef.current = null;
  };

  // ── Affectations ──────────────────────────────────────────────────────────
  const [affPage, setAffPage]           = useState(1);
  const [affSearch, setAffSearch]       = useState("");
  const [affDebounced, setAffDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setAffDebounced(affSearch), 350);
    return () => clearTimeout(t);
  }, [affSearch]);

  const affParams = new URLSearchParams({ page: String(affPage), limit: "15" });
  if (affDebounced) affParams.set("search", affDebounced);
  const { data: affectationsRes, refetch: refetchAffectations } =
    useApi<AffectationsResponse>(`/api/logistique/affectations?${affParams}`);

  // Tous les PDVs actifs (vient du stock API qui les retourne toujours)
  const allPdvs   = stockRes?.pdvs ?? affectationsRes?.pdvs ?? [];
  const userPdvId = stockRes?.userPdvId ?? null;
  // Pour le modal affectation : destination = tout PDV sauf le sien
  const pdvs = allPdvs.filter(p => p.id !== userPdvId);

  // ── Journal ───────────────────────────────────────────────────────────────
  const [journalPage, setJournalPage]   = useState(1);
  const [journalType, setJournalType]   = useState<"" | "ENTREE" | "SORTIE" | "AJUSTEMENT">("");
  const [journalSearch, setJournalSearch]       = useState("");
  const [journalDebounced, setJournalDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setJournalDebounced(journalSearch), 350);
    return () => clearTimeout(t);
  }, [journalSearch]);

  const journalParams = new URLSearchParams({ page: String(journalPage), limit: "20" });
  if (journalType)     journalParams.set("type",   journalType);
  if (journalDebounced) journalParams.set("search", journalDebounced);
  const { data: journalRes, refetch: refetchJournal } =
    useApi<MouvementsResponse>(`/api/logistique/mouvements?${journalParams}`);

  // ── Modal Réception ───────────────────────────────────────────────────────
  const [receptionModal, setReceptionModal]   = useState(false);
  const [recProduit, setRecProduit]           = useState<Produit | null>(null);
  const [recForm, setRecForm] = useState({ quantite: "", referenceExterne: "", motif: "" });

  const { mutate: createReception, loading: recLoading } =
    useMutation<unknown, object>("/api/logistique/mouvements", "POST", {
      successMessage: "Réception enregistrée — stock mis à jour",
    });

  const openReceptionModal = (p: Produit) => {
    setRecProduit(p);
    setRecForm({ quantite: "", referenceExterne: "", motif: "" });
    setReceptionModal(true);
  };

  const closeReceptionModal = () => {
    setReceptionModal(false);
    setRecProduit(null);
  };

  const handleReception = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recProduit) return;
    const result = await createReception({
      produitId:        recProduit.id,
      quantite:         Number(recForm.quantite),
      referenceExterne: recForm.referenceExterne || undefined,
      motif:            recForm.motif || undefined,
    });
    if (result) {
      closeReceptionModal();
      refetchStock();
      refetchReceptions();
    }
  };

  // ── Modal Affectation ─────────────────────────────────────────────────────
  const [affModal, setAffModal]       = useState(false);
  const [affProduit, setAffProduit]   = useState<Produit | null>(null);
  const [affForm, setAffForm] = useState({ quantite: "", pointDeVenteId: "", notes: "" });

  const { mutate: createAffectation, loading: affLoading } =
    useMutation<unknown, object>("/api/logistique/affectations", "POST", {
      successMessage: "Affectation enregistrée avec succès",
    });

  const openAffModal = (p: Produit | null) => {
    setAffProduit(p);
    setAffForm({ quantite: "", pointDeVenteId: "", notes: "" });
    setAffModal(true);
  };

  const closeAffModal = () => {
    setAffModal(false);
    setAffProduit(null);
  };

  const handleAffectation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affProduit) return;
    const result = await createAffectation({
      produitId:      affProduit.id,
      quantite:       Number(affForm.quantite),
      pointDeVenteId: Number(affForm.pointDeVenteId),
      notes:          affForm.notes || undefined,
    });
    if (result) {
      closeAffModal();
      refetchStock();
      refetchAffectations();
    }
  };

  // ── Modal Création Produit ────────────────────────────────────────────────
  const [createProduitModal, setCreateProduitModal] = useState(false);
  const [cpForm, setCpForm] = useState({
    nom: "", prixAchat: "", prixUnitaire: "", unite: "", alerteStock: "", description: "", reference: "", categorie: "",
  });

  const { mutate: createProduit, loading: cpLoading } =
    useMutation<unknown, object>("/api/logistique/produits", "POST", {
      successMessage: "Produit créé — l'administrateur va valider la stratégie de prix",
    });

  const openCreateProduitModal = () => {
    setCpForm({ nom: "", prixAchat: "", prixUnitaire: "", unite: "", alerteStock: "", description: "", reference: "", categorie: "" });
    setCreateProduitModal(true);
  };

  const handleCreateProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createProduit({
      nom:         cpForm.nom,
      prixUnitaire: Number(cpForm.prixUnitaire),
      prixAchat:   cpForm.prixAchat !== "" ? Number(cpForm.prixAchat) : undefined,
      unite:       cpForm.unite       || undefined,
      alerteStock: cpForm.alerteStock !== "" ? Number(cpForm.alerteStock) : undefined,
      description: cpForm.description || undefined,
      reference:   cpForm.reference   || undefined,
      categorie:   cpForm.categorie   || undefined,
    });
    if (result) {
      setCreateProduitModal(false);
      refetchStock();
    }
  };

  // ── Modal Nouvelle Commande Fournisseur ──────────────────────────────────
  const [commandeModal, setCommandeModal]   = useState(false);
  const [cmdForm, setCmdForm] = useState({
    type: "FOURNISSEUR", pointDeVenteId: "", fournisseurNom: "", datePrevisionnelle: "", notes: "",
  });
  type CmdLigne = { produitId: string; quantiteAttendue: string; prixUnitaire: string };
  const [cmdLignes, setCmdLignes] = useState<CmdLigne[]>([{ produitId: "", quantiteAttendue: "", prixUnitaire: "" }]);

  const { mutate: createCommande, loading: cmdLoading } =
    useMutation<unknown, object>("/api/logistique/receptions", "POST", {
      successMessage: "Commande soumise — en attente d'approbation admin",
    });

  const openCommandeModal = () => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    setCmdForm({ type: "FOURNISSEUR", pointDeVenteId: userPdvId ? String(userPdvId) : "", fournisseurNom: "", datePrevisionnelle: d.toISOString().slice(0, 10), notes: "" });
    setCmdLignes([{ produitId: "", quantiteAttendue: "", prixUnitaire: "" }]);
    setCommandeModal(true);
  };

  const handleCreateCommande = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignes = cmdLignes
      .filter(l => l.produitId && Number(l.quantiteAttendue) > 0)
      .map(l => ({
        produitId: Number(l.produitId),
        quantiteAttendue: Number(l.quantiteAttendue),
        ...(l.prixUnitaire !== "" && { prixUnitaire: Number(l.prixUnitaire) }),
      }));
    if (!lignes.length) return;
    const result = await createCommande({
      type: cmdForm.type,
      pointDeVenteId: Number(cmdForm.pointDeVenteId),
      ...(cmdForm.type === "FOURNISSEUR" && cmdForm.fournisseurNom && { fournisseurNom: cmdForm.fournisseurNom }),
      datePrevisionnelle: cmdForm.datePrevisionnelle,
      ...(cmdForm.notes && { notes: cmdForm.notes }),
      lignes,
    });
    if (result) {
      setCommandeModal(false);
      refetchLivraisonsRpv();
    }
  };

  // ── Anomalies (validation niveau 1) ──────────────────────────────────────
  interface AnomalieValidation {
    id: number; reference: string;
    type: string; quantite: number; description: string;
    statut: string; commentaire: string | null; createdAt: string;
    produit: { id: number; nom: string };
    pointDeVente: { id: number; nom: string; code: string } | null;
    magasinier: { id: number; nom: string; prenom: string };
  }
  interface AnomaliesValidationResponse {
    data: AnomalieValidation[];
    stats: { pendingCount: number };
    meta: { total: number; page: number; limit: number; totalPages: number };
  }

  const [anomaliesPage, setAnomaliesPage]           = useState(1);
  const [anomaliesFilterStatut, setAnomaliesFilterStatut] = useState("EN_ATTENTE");
  const [anomalieMotifModal, setAnomalieMotifModal] = useState<{ id: number; action: "VALIDER" | "REJETER" } | null>(null);
  const [anomalieMotif, setAnomalieMotif]           = useState("");
  const anomalieActionIdRef                         = useRef<number | null>(null);

  const anomaliesQP = new URLSearchParams({ page: String(anomaliesPage), limit: "15" });
  if (anomaliesFilterStatut) anomaliesQP.set("statut", anomaliesFilterStatut);

  const { data: anomaliesValidRes, loading: anomaliesValidLoading, refetch: refetchAnomaliesValid } =
    useApi<AnomaliesValidationResponse>(
      activeTab === "anomalies" ? `/api/logistique/anomalies?${anomaliesQP}` : null
    );

  // Comptage pending (badge onglet) — toujours actif
  const { data: anomaliesBadgeRes } =
    useApi<AnomaliesValidationResponse>("/api/logistique/anomalies?statut=EN_ATTENTE&limit=1");
  const anomaliesPendingCount = anomaliesBadgeRes?.stats?.pendingCount ?? 0;

  const { mutate: doValidateAnomalie, loading: validateAnomalieLoading } =
    useMutation<unknown, { action: string; motif?: string }>(
      () => anomalieActionIdRef.current ? `/api/logistique/anomalies/${anomalieActionIdRef.current}` : "",
      "PATCH",
      { successMessage: "Anomalie traitée avec succès" }
    );

  const handleAnomalieAction = async (id: number, action: "VALIDER" | "REJETER") => {
    setAnomalieMotifModal({ id, action });
    setAnomalieMotif("");
  };

  const confirmAnomalieAction = async () => {
    if (!anomalieMotifModal) return;
    anomalieActionIdRef.current = anomalieMotifModal.id;
    const result = await doValidateAnomalie({
      action: anomalieMotifModal.action,
      ...(anomalieMotif.trim() && { motif: anomalieMotif.trim() }),
    });
    if (result) {
      setAnomalieMotifModal(null);
      setAnomalieMotif("");
      refetchAnomaliesValid();
    }
  };

  // ── Ajustements inventaire (pré-validation niveau 2) ─────────────────────
  interface DemandeAjust {
    id: number; ancienneQuantite: number; nouvelleQuantite: number;
    justification: string; statut: string; commentaireValidation: string | null;
    source: string; createdAt: string;
    produit:      { id: number; nom: string; reference?: string; unite?: string };
    pointDeVente: { id: number; nom: string; code: string };
    demandeur:    { id: number; nom: string; prenom: string };
    validateur:   { id: number; nom: string; prenom: string } | null;
  }
  interface AjustResponse {
    data: DemandeAjust[];
    stats: { pendingCount: number };
    meta: { total: number; page: number; limit: number; totalPages: number };
  }

  const [ajustPage, setAjustPage]                   = useState(1);
  const [ajustFilter, setAjustFilter]               = useState("EN_ATTENTE");
  const [ajustModal, setAjustModal]                 = useState<{ id: number; action: "VALIDER" | "REJETER" } | null>(null);
  const [ajustCommentaire, setAjustCommentaire]     = useState("");
  const [anomaliesSubTab, setAnomaliesSubTab]       = useState<"anomalies" | "ajustements">("anomalies");
  const ajustActionIdRef                            = useRef<number | null>(null);

  const ajustQP = new URLSearchParams({ page: String(ajustPage), limit: "15" });
  if (ajustFilter) ajustQP.set("statut", ajustFilter);

  const { data: ajustRes, loading: ajustLoading, refetch: refetchAjust } =
    useApi<AjustResponse>(
      activeTab === "anomalies" && anomaliesSubTab === "ajustements"
        ? `/api/logistique/ajustements?${ajustQP}`
        : null
    );

  const { data: ajustBadgeRes } =
    useApi<AjustResponse>("/api/logistique/ajustements?statut=EN_ATTENTE&limit=1");
  const ajustPendingCount = ajustBadgeRes?.stats?.pendingCount ?? 0;

  const { mutate: doAjustAction, loading: ajustActionLoading } =
    useMutation<unknown, { action: string; commentaire?: string }>(
      () => ajustActionIdRef.current ? `/api/logistique/ajustements/${ajustActionIdRef.current}` : "",
      "PATCH",
      { successMessage: "Demande traitée avec succès" }
    );

  const handleAjustAction = (id: number, action: "VALIDER" | "REJETER") => {
    setAjustModal({ id, action });
    setAjustCommentaire("");
  };

  const confirmAjustAction = async () => {
    if (!ajustModal) return;
    ajustActionIdRef.current = ajustModal.id;
    const result = await doAjustAction({
      action: ajustModal.action,
      ...(ajustCommentaire.trim() && { commentaire: ajustCommentaire.trim() }),
    });
    if (result) {
      setAjustModal(null);
      setAjustCommentaire("");
      refetchAjust();
    }
  };

  const refetchAll = useCallback(() => {
    refetchStock();
    refetchReceptions();
    refetchAffectations();
    refetchLivraisonsRpv();
    refetchLivraisonsPack();
    refetchTransfertsEntrants();
  }, [refetchStock, refetchReceptions, refetchAffectations, refetchLivraisonsRpv, refetchLivraisonsPack, refetchTransfertsEntrants]);

  const [expandedRpvId, setExpandedRpvId] = useState<number | null>(null);

  const livraisonsRpv = livraisonsRpvRes?.data ?? [];
  // Réceptions d'approvisionnement (BROUILLON = à démarrer, EN_COURS = en attente Magasinier)
  const receptionsEnAttente = livraisonsRpv.filter(l => l.statut === "BROUILLON");
  const receptionsEnCours   = livraisonsRpv.filter(l => l.statut === "EN_COURS");

  const produitsUrgents = produits.filter(p => {
    const s = getStatut(p.stock, p.alerteStock);
    return s === "RUPTURE" || s === "STOCK_FAIBLE";
  });

  const allTabs: { key: Tab; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: "reception",  label: "Stock & Réception",      icon: ArrowUpCircle  },
    { key: "affectation",label: "Affectation PdV",        icon: MapPin         },
    { key: "livraisons", label: "Suivi des Livraisons",   icon: Truck          },
    { key: "journal",    label: "Journal des Mouvements", icon: ClipboardList  },
    { key: "anomalies",  label: "Anomalies & Inventaire",  icon: ShieldAlert, badge: (anomaliesPendingCount + ajustPendingCount) || undefined },
  ];
  const tabs = allTabs.filter((t) => isAllowed(t.key));

  useEffect(() => {
    if (allowedPages && !allowedPages.includes(activeTab)) {
      const first = allTabs.find((t) => allowedPages.includes(t.key));
      if (first) setActiveTab(first.key);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPages]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/20">

      {/* ── Navbar ── */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <DashboardBackButton />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {t("role_logistique_title")}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
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

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Logistique &amp; Approvisionnement</h2>
            <p className="text-slate-500 mt-1">
              Réceptionnez les produits, affectez-les aux points de vente et suivez tous les mouvements.
            </p>
          </div>
          <button
            onClick={refetchAll}
            className="self-start px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Produits en stock"
            value={String(stats?.totalProduits ?? 0)}
            icon={Package}
            color="text-cyan-600"
            lightBg="bg-cyan-50"
          />
          <StatCard
            label="Valeur du stock"
            value={formatCurrency(stats?.valeurTotale ?? 0)}
            icon={BarChart3}
            color="text-emerald-600"
            lightBg="bg-emerald-50"
          />
          <StatCard
            label="Réceptions (30j)"
            value={String(receptionsRes?.stats?.totalReceptions30j ?? 0)}
            subtitle={`${receptionsRes?.stats?.totalQuantiteRecue30j ?? 0} unités reçues`}
            icon={ArrowUpCircle}
            color="text-blue-600"
            lightBg="bg-blue-50"
          />
          <StatCard
            label="Affectations (30j)"
            value={String(affectationsRes?.stats?.totalAffectations30j ?? 0)}
            subtitle={`${affectationsRes?.stats?.totalQuantiteAffectee30j ?? 0} unités allouées`}
            icon={TrendingUp}
            color="text-purple-600"
            lightBg="bg-purple-50"
          />
        </div>

        {/* ── Alertes ruptures / stock faible ── */}
        {(stats?.enRupture ?? 0) + (stats?.stockFaible ?? 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(stats?.enRupture ?? 0) > 0 && (
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-200 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Archive size={26} />
                </div>
                <div>
                  <p className="text-red-100 text-sm font-medium">Ruptures de stock</p>
                  <p className="text-3xl font-bold">{stats?.enRupture} produit{(stats?.enRupture ?? 0) > 1 ? "s" : ""}</p>
                  <p className="text-red-200 text-xs mt-0.5">Approvisionnement urgent requis</p>
                </div>
              </div>
            )}
            {(stats?.stockFaible ?? 0) > 0 && (
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-200 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={26} />
                </div>
                <div>
                  <p className="text-amber-100 text-sm font-medium">Stocks faibles</p>
                  <p className="text-3xl font-bold">{stats?.stockFaible} produit{(stats?.stockFaible ?? 0) > 1 ? "s" : ""}</p>
                  <p className="text-amber-200 text-xs mt-0.5">Réapprovisionnement à planifier</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex flex-wrap gap-1">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex-1 min-w-[110px] ${
                activeTab === key
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={17} />
              <span className="hidden sm:inline">{label}</span>
              {badge ? (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1 – STOCK & RÉCEPTION                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "reception" && (
          <div className="space-y-5">
            {/* Search */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setStockPage(1); }}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
            </div>

            {/* Commandes en transit à confirmer */}
            {pendingReceptions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex items-center gap-2">
                  <Truck size={18} className="text-blue-600" />
                  <h3 className="font-bold text-blue-800">Commandes en transit à confirmer</h3>
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingReceptions.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {pendingReceptions.map(rec => (
                    <div key={rec.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800 text-sm">{rec.reference}</span>
                          <span className="text-xs text-slate-500 font-mono">{rec.pointDeVente.nom}</span>
                          {rec.origineNom && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{rec.origineNom}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {rec.lignes.map(l => (
                            <span key={l.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                              {l.produit.nom} · <b>{l.quantiteAttendue}</b>{l.produit.unite ? ` ${l.produit.unite}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfirmerReception(rec)}
                        disabled={confirmingReceptionId === rec.id || validatingReception}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {confirmingReceptionId === rec.id ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckSquare size={15} />
                        )}
                        Confirmer réception
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle size={18} className="text-cyan-600" />
                  <h3 className="font-bold text-slate-800">État du Stock</h3>
                  {meta && (
                    <span className="bg-cyan-100 text-cyan-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {meta.total}
                    </span>
                  )}
                </div>
                <button
                  onClick={openCreateProduitModal}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-medium text-sm transition-colors"
                >
                  <Plus size={16} />
                  Nouveau produit
                </button>
              </div>

              {stockLoading && !stockRes ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Produit", "Stock actuel", "Seuil alerte", "Niveau", "Valeur stock", "Statut", "Dernière MAJ", "Actions"].map(h => (
                          <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {produits.map(p => {
                        const s    = getStatut(p.stock, p.alerteStock);
                        const st   = statutStyles[s];
                        const pct  = p.alerteStock > 0
                          ? Math.min(Math.round((p.stock / (p.alerteStock * 2)) * 100), 100)
                          : p.stock > 0 ? 100 : 0;
                        return (
                          <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${s === "RUPTURE" ? "bg-red-50/40" : ""}`}>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800">{p.nom}</p>
                              {p.description && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{p.description}</p>}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xl font-bold ${s === "RUPTURE" ? "text-red-600" : "text-emerald-700"}`}>
                                {p.quantite ?? p.stock}
                              </span>
                              <div className="mt-0.5 space-y-0.5">
                                {(p.quantiteReservee ?? 0) > 0 && <p className="text-xs text-amber-600">+{p.quantiteReservee} rés.</p>}
                                {(p.quantiteEnTransit ?? 0) > 0 && <p className="text-xs text-sky-600">+{p.quantiteEnTransit} transit</p>}
                                {(p.quantiteEndommagee ?? 0) > 0 && <p className="text-xs text-red-500">{p.quantiteEndommagee} endom.</p>}
                                {p.stockTheorique !== undefined && <p className="text-xs text-slate-400">Théo. : {p.stockTheorique}</p>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{p.alerteStock}</td>
                            <td className="px-6 py-4">
                              <div className="w-28">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>{p.stock}</span>
                                  <span className="text-slate-400">/{p.alerteStock * 2 || "∞"}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      s === "EN_STOCK" ? "bg-emerald-500" : s === "STOCK_FAIBLE" ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800 text-sm">
                                {formatCurrency(p.valeurStock ?? ((p.quantite ?? p.stock) * Number(p.prixAchat ?? p.prixUnitaire)))}
                              </p>
                              {p.prixAchat && (
                                <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(Number(p.prixAchat))}/u.</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">{formatDate(p.updatedAt)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openReceptionModal(p)}
                                  className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                >
                                  <ArrowUpCircle size={13} />
                                  Réceptionner
                                </button>
                                <button
                                  onClick={() => { setActiveTab("affectation"); openAffModal(p); }}
                                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                  disabled={p.stock === 0}
                                  title={p.stock === 0 ? "Stock épuisé" : "Affecter à un point de vente"}
                                >
                                  <MapPin size={13} />
                                  Affecter
                                </button>
                                <button
                                  onClick={() => setPrixHistoProduit({ id: p.id, nom: p.nom })}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                  title="Historique des prix"
                                >
                                  <History size={13} />
                                  Prix
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {produits.length === 0 && !stockLoading && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            {t('text_no_result')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {meta && meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{meta.page}</b> / <b>{meta.totalPages}</b> ({meta.total} produits)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStockPage(p => Math.max(1, p - 1))}
                      disabled={stockPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {t('btn_prev')}
                    </button>
                    <span className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium">{stockPage}</span>
                    <button
                      onClick={() => setStockPage(p => Math.min(meta.totalPages, p + 1))}
                      disabled={stockPage >= meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {t('btn_next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2 – AFFECTATION PdV                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "affectation" && (
          <div className="space-y-6">

            {/* Produits urgents à affecter */}
            {produitsUrgents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-500" size={20} />
                  <h3 className="font-bold text-slate-800">Produits nécessitant un réapprovisionnement prioritaire</h3>
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{produitsUrgents.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produitsUrgents.map(p => {
                    const isRupture = p.stock === 0;
                    return (
                      <div key={p.id} className={`bg-white rounded-xl p-5 border ${isRupture ? "border-red-200" : "border-amber-200"} shadow-sm hover:shadow-md transition-all`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRupture ? "bg-red-100" : "bg-amber-100"}`}>
                              {isRupture ? <Archive size={18} className="text-red-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{p.nom}</p>
                              <p className="text-xs text-slate-500">Stock : {p.stock} / Seuil : {p.alerteStock}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isRupture ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {isRupture ? "Rupture" : "Faible"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                          <span className="font-medium">Prix de vente :</span> {formatCurrency(p.prixUnitaire)}
                        </p>
                        <button
                          onClick={() => openReceptionModal(p)}
                          className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                            isRupture
                              ? "bg-red-50 hover:bg-red-100 text-red-700"
                              : "bg-amber-50 hover:bg-amber-100 text-amber-700"
                          }`}
                        >
                          <Truck size={14} />
                          Enregistrer un réapprovisionnement
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recherche affectations */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher dans les affectations..."
                    value={affSearch}
                    onChange={e => { setAffSearch(e.target.value); setAffPage(1); }}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Historique des affectations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-purple-600" />
                  <h3 className="font-bold text-slate-800">Affectations aux Points de Vente</h3>
                  {affectationsRes?.meta && (
                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {affectationsRes.meta.total}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openAffModal(null)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={15} />
                  Nouvelle affectation
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Produit", "Quantité", "Destination PdV", "Opérateur / Notes", "Date"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(affectationsRes?.data ?? []).map(m => {
                      const motifParts = (m.motif ?? "").split(" — ");
                      const destination = motifParts[0]?.replace("Affectation PdV : ", "") ?? "-";
                      const rest = motifParts.slice(1).join(" — ");
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-400 font-mono">{m.reference.replace("LOG-AFF-", "AFF-").substring(0, 15)}…</td>
                          <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{m.produit?.nom ?? "-"}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-purple-700 text-lg">{m.quantite}</span>
                            <span className="text-xs text-slate-500 ml-1">unités</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">
                              <MapPin size={11} />
                              {destination}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 max-w-[180px] truncate">{rest || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                        </tr>
                      );
                    })}
                    {(affectationsRes?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          {t('text_no_result')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {affectationsRes?.meta && affectationsRes.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{affectationsRes.meta.page}</b> / <b>{affectationsRes.meta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAffPage(p => Math.max(1, p - 1))} disabled={affPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">{t('btn_prev')}</button>
                    <span className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">{affPage}</span>
                    <button onClick={() => setAffPage(p => Math.min(affectationsRes.meta.totalPages, p + 1))} disabled={affPage >= affectationsRes.meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">{t('btn_next')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3 – SUIVI LOGISTIQUE (RÉCEPTIONS D'APPROVISIONNEMENT + LIVRAISONS)                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "livraisons" && (
          <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-lg">Suivi des approvisionnements</h2>
              <button
                onClick={openCommandeModal}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm transition-colors shadow-sm"
              >
                <Plus size={16} />
                Nouvelle commande fournisseur
              </button>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                <ArrowUpCircle className="text-emerald-600 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-xs text-emerald-700 font-medium">Appros à démarrer</p>
                  <p className="text-2xl font-bold text-emerald-800">{receptionsEnAttente.length}</p>
                </div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
                <PlayCircle className="text-teal-600 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-xs text-teal-700 font-medium">Appros en cours</p>
                  <p className="text-2xl font-bold text-teal-800">{receptionsEnCours.length}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
                <Truck className="text-blue-600 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-xs text-blue-700 font-medium">Transferts à confirmer</p>
                  <p className="text-2xl font-bold text-blue-800">{transfertsEntrants.length}</p>
                </div>
              </div>
            </div>

            {/* ── helper card réutilisable ── */}
            {/* Section Réceptions d'approvisionnement à démarrer */}
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-emerald-200 bg-emerald-50 flex items-center gap-2">
                <ArrowUpCircle size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-800">Réceptions d&apos;approvisionnement — à démarrer</h3>
                {receptionsEnAttente.length > 0 && (
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {receptionsEnAttente.length}
                  </span>
                )}
                {livraisonsRpvLoading && <span className="text-xs text-slate-400 ml-auto">Chargement…</span>}
              </div>
              {receptionsEnAttente.length === 0 && !livraisonsRpvLoading ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Aucune réception d&apos;approvisionnement en attente</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {receptionsEnAttente.map((liv) => (
                    <div key={liv.id} className="p-5 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{liv.reference}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">En attente</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700">Fournisseur : {liv.fournisseurNom ?? "Non précisé"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Prévu le {formatDate(liv.datePrevisionnelle)}
                          {liv.dateReception && <> · <span className="text-emerald-600 font-medium">Reçu le {formatDate(liv.dateReception)}</span></>}
                          {' '}— {liv.lignes.length} produit(s)
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {liv.lignes.map(l => (
                            <span key={l.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                              {l.produit.nom} × {l.quantiteAttendue}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDemarrer(liv)}
                        disabled={demarrerLoading && demarrantId === liv.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200 shrink-0 disabled:opacity-60"
                      >
                        {demarrerLoading && demarrantId === liv.id
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Démarrage…</>
                          : <><PlayCircle size={15} /> Démarrer</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Réceptions en cours — attente Magasinier */}
            {receptionsEnCours.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-teal-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-teal-200 bg-teal-50 flex items-center gap-2">
                  <ArrowUpCircle size={18} className="text-teal-600" />
                  <h3 className="font-bold text-slate-800">Réceptions en cours — attente validation Magasinier</h3>
                  <span className="bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{receptionsEnCours.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {receptionsEnCours.map((liv) => (
                    <div key={liv.id}>
                      <div
                        className="p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50"
                        onClick={() => setExpandedRpvId(expandedRpvId === liv.id ? null : liv.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{liv.reference}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">En cours</span>
                          </div>
                          <p className="text-sm text-slate-700">Fournisseur : {liv.fournisseurNom ?? "—"}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Prévu le {formatDate(liv.datePrevisionnelle)}
                            {liv.dateReception && <> · <span className="text-emerald-600 font-medium">Reçu le {formatDate(liv.dateReception)}</span></>}
                            {' '}— en attente de confirmation par le Magasinier
                          </p>
                        </div>
                        {expandedRpvId === liv.id ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                      </div>
                      {expandedRpvId === liv.id && (
                        <div className="px-5 pb-5 border-t border-slate-100">
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {liv.lignes.map(l => (
                              <span key={l.id} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-lg">
                                {l.produit.nom} — attendu : {l.quantiteAttendue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Transferts entrants à confirmer ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-800">Transferts de stock entrants — à confirmer</h3>
                {transfertsEntrants.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {transfertsEntrants.length}
                  </span>
                )}
                {transfertsEntrantsLoading && <span className="text-xs text-slate-400 ml-auto">Chargement…</span>}
              </div>
              {transfertsEntrants.length === 0 && !transfertsEntrantsLoading ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Aucun transfert en attente de confirmation</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {transfertsEntrants.map((t) => (
                    <div key={t.id} className="p-5 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{t.reference}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{t.statut === "EXPEDIE" ? "Expédié" : "En cours"}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700">Depuis : {t.origine.nom}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Créé par {t.creePar.prenom} {t.creePar.nom} — {t.lignes.length} produit(s)
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {t.lignes.map(l => (
                            <span key={l.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
                              {l.produit.nom} × {l.quantite}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfirmerTransfert(t.id)}
                        disabled={confirmTransfertLoading && confirmantTransfertId === t.id}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium transition-all shadow-md shadow-blue-200 shrink-0 disabled:opacity-60"
                      >
                        {confirmTransfertLoading && confirmantTransfertId === t.id
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirmation…</>
                          : <><CheckCircle size={15} /> Confirmer reçu</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Livraisons Packs à confirmer ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                <Truck size={18} className="text-amber-600" />
                <h3 className="font-bold text-slate-800">Livraisons packs à confirmer</h3>
                {(livraisonsPackRes?.stats.totalPlanifiees ?? 0) > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {livraisonsPackRes!.stats.totalPlanifiees}
                  </span>
                )}
              </div>

              {livraisonsPackLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Chargement…</div>
              ) : (livraisonsPackRes?.planifiees.length ?? 0) === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Aucune livraison pack en attente de confirmation</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {livraisonsPackRes!.planifiees.map((rec) => {
                    const s = rec.souscription;
                    const beneficiaire = s.client
                      ? `${s.client.prenom} ${s.client.nom}`
                      : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
                    const telephone = s.client?.telephone ?? "";
                    const montantTotal = rec.lignes.reduce(
                      (acc, l) => acc + Number(l.prixUnitaire) * l.quantite, 0
                    );
                    return (
                      <div key={rec.id} className="p-5 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PACK_BADGE[s.pack.type]}`}>
                              {PACK_LABELS[s.pack.type]}
                            </span>
                            <span className="font-semibold text-slate-800 text-sm">{s.pack.nom}</span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {beneficiaire}
                            {telephone && <span className="text-slate-400 ml-2 text-xs">{telephone}</span>}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {rec.lignes.map((l) => (
                              <span key={l.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                {l.produit.nom} × {l.quantite}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Prévu le {formatDate(rec.datePrevisionnelle)}
                            {rec.dateLivraison && <> · <span className="text-emerald-600 font-medium">Livré le {formatDate(rec.dateLivraison)}</span></>}
                            {" "}— {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(montantTotal)}
                          </p>
                        </div>
                        <button
                          onClick={() => setConfirmingPackId(rec.id)}
                          disabled={confirmingPackId === rec.id}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200 shrink-0 disabled:opacity-60"
                        >
                          <CheckCircle size={15} />
                          {confirmingPackId === rec.id ? "En cours…" : "Confirmer"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Stats réceptions fournisseurs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <ArrowUpCircle className="text-emerald-600 w-7 h-7" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Approvisionnements réceptionnés (30j)</p>
                  <p className="text-3xl font-bold text-slate-800">{receptionsRes?.stats?.totalReceptions30j ?? 0}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Boxes className="text-blue-600 w-7 h-7" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Unités reçues (30j)</p>
                  <p className="text-3xl font-bold text-slate-800">{receptionsRes?.stats?.totalQuantiteRecue30j ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Recherche */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par produit, référence, motif..."
                  value={livrSearch}
                  onChange={e => { setLivrSearch(e.target.value); setLivrPage(1); }}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <Truck size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-800">Historique des réceptions</h3>
                {receptionsRes?.meta && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {receptionsRes.meta.total}
                  </span>
                )}
              </div>
   
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence approvisionnement", "Produit", "Qté reçue", "Motif / Fournisseur", "Date réception"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(receptionsRes?.data ?? []).map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            {m.reference.replace("LOG-REC-", "LIV-").substring(0, 18)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{m.produit?.nom ?? "-"}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold text-sm">
                            <ArrowUpCircle size={13} />
                            +{m.quantite}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-[260px]">
                          <p className="truncate">{m.motif ?? "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                      </tr>
                    ))}
                    {(receptionsRes?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          {t('text_no_result')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {receptionsRes?.meta && receptionsRes.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{receptionsRes.meta.page}</b> / <b>{receptionsRes.meta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLivrPage(p => Math.max(1, p - 1))} disabled={livrPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">{t('btn_prev')}</button>
                    <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">{livrPage}</span>
                    <button onClick={() => setLivrPage(p => Math.min(receptionsRes.meta.totalPages, p + 1))} disabled={livrPage >= receptionsRes.meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">{t('btn_next')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4 – JOURNAL DES MOUVEMENTS                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "journal" && (
          <div className="space-y-5">
            {/* Stats 30j */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Entrées (30j)",     value: journalRes?.stats?.totalEntrees     ?? 0, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
                { label: "Sorties (30j)",     value: journalRes?.stats?.totalSorties     ?? 0, color: "text-red-600",     bg: "bg-red-50",     dot: "bg-red-500"     },
                { label: "Ajustements (30j)", value: journalRes?.stats?.totalAjustements ?? 0, color: "text-blue-600",    bg: "bg-blue-50",    dot: "bg-blue-500"    },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${s.dot} shrink-0`} />
                  <div>
                    <p className="text-slate-500 text-xs">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Référence, produit, motif..."
                    value={journalSearch}
                    onChange={e => { setJournalSearch(e.target.value); setJournalPage(1); }}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400 shrink-0" />
                  <select
                    value={journalType}
                    onChange={e => { setJournalType(e.target.value as typeof journalType); setJournalPage(1); }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-slate-700"
                  >
                    <option value="">Tous les types</option>
                    <option value="ENTREE">Entrées</option>
                    <option value="SORTIE">Sorties</option>
                    <option value="AJUSTEMENT">Ajustements</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table journal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <ClipboardList size={18} className="text-cyan-600" />
                <h3 className="font-bold text-slate-800">Journal global des mouvements</h3>
                {journalRes?.meta && (
                  <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {journalRes.meta.total}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Référence", "Type", "Produit", "Stock actuel", "Quantité", "Motif", "Date"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(journalRes?.data ?? []).map(m => {
                      const ts = typeMvtStyles[m.type] ?? typeMvtStyles.AJUSTEMENT;
                      const Icon = ts.icon;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs text-slate-400">{m.reference.substring(0, 18)}…</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ts.bg} ${ts.text}`}>
                              <Icon size={11} />
                              {ts.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{m.produit?.nom ?? "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{m.quantite ?? "-"} u.</td>
                          <td className="px-6 py-4">
                            <span className={`font-bold text-lg ${m.type === "ENTREE" ? "text-emerald-600" : m.type === "SORTIE" ? "text-red-600" : "text-blue-600"}`}>
                              {m.type === "ENTREE" ? "+" : m.type === "SORTIE" ? "-" : "±"}{m.quantite}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 max-w-[200px]">
                            <p className="truncate">{m.motif ?? "-"}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(m.dateMouvement)}</td>
                        </tr>
                      );
                    })}
                    {(journalRes?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          {t('text_no_result')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {journalRes?.meta && journalRes.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{journalRes.meta.page}</b> / <b>{journalRes.meta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setJournalPage(p => Math.max(1, p - 1))} disabled={journalPage <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">{t('btn_prev')}</button>
                    <span className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium">{journalPage}</span>
                    <button onClick={() => setJournalPage(p => Math.min(journalRes.meta.totalPages, p + 1))} disabled={journalPage >= journalRes.meta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40">{t('btn_next')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 5 – ANOMALIES STOCK (validation niveau 1)                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "anomalies" && (
          <div className="space-y-5">
            {/* Sous-sélecteur */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              <button
                onClick={() => setAnomaliesSubTab("anomalies")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${anomaliesSubTab === "anomalies" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <ShieldAlert size={15} /> Pertes / Casses / Vols
                {anomaliesPendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{anomaliesPendingCount > 9 ? "9+" : anomaliesPendingCount}</span>}
              </button>
              <button
                onClick={() => setAnomaliesSubTab("ajustements")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${anomaliesSubTab === "ajustements" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <ClipboardCheck size={15} /> Ajustements inventaire
                {ajustPendingCount > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{ajustPendingCount > 9 ? "9+" : ajustPendingCount}</span>}
              </button>
            </div>

            {/* ── Anomalies (perte/casse/vol) ── */}
            {anomaliesSubTab === "anomalies" && (<>
            {/* En-tête */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Validation des anomalies</h3>
                <p className="text-sm text-slate-500">Validez ou rejetez les déclarations des magasiniers avant transmission à l&apos;admin</p>
              </div>
              {anomaliesPendingCount > 0 && (
                <span className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold border border-red-200">
                  {anomaliesPendingCount} en attente
                </span>
              )}
            </div>

            {/* Filtres statut */}
            <div className="flex gap-2 flex-wrap">
              {(["EN_ATTENTE", "TRANSMISE", "TRAITEE", "EN_COURS", ""] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setAnomaliesFilterStatut(s); setAnomaliesPage(1); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    anomaliesFilterStatut === s
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "" ? "Toutes" : s === "EN_ATTENTE" ? "En attente" : s === "TRANSMISE" ? "Transmises (Admin)" : s === "TRAITEE" ? "Traitées" : "Rejetées"}
                </button>
              ))}
            </div>

            {/* Liste */}
            {anomaliesValidLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
              </div>
            ) : (anomaliesValidRes?.data.length ?? 0) === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <ShieldAlert size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucune anomalie trouvée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {anomaliesValidRes!.data.map(anomalie => {
                  const typeColors: Record<string, string> = {
                    PERTE: "bg-red-100 text-red-700", CASSE: "bg-orange-100 text-orange-700",
                    VOL: "bg-rose-100 text-rose-700", DEFECTUEUX: "bg-amber-100 text-amber-700",
                    MANQUANT: "bg-slate-100 text-slate-700", SURPLUS: "bg-blue-100 text-blue-700",
                  };
                  const typeLabels: Record<string, string> = {
                    PERTE: "Perte", CASSE: "Casse", VOL: "Vol",
                    DEFECTUEUX: "Défectueux", MANQUANT: "Manquant", SURPLUS: "Surplus",
                  };
                  const statutColors: Record<string, string> = {
                    EN_ATTENTE: "bg-amber-100 text-amber-700", TRANSMISE: "bg-purple-100 text-purple-700",
                    TRAITEE: "bg-emerald-100 text-emerald-700", EN_COURS: "bg-red-100 text-red-700",
                  };
                  return (
                    <div key={anomalie.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${typeColors[anomalie.type] ?? "bg-slate-100 text-slate-700"}`}>
                              {typeLabels[anomalie.type] ?? anomalie.type}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statutColors[anomalie.statut] ?? "bg-slate-100 text-slate-600"}`}>
                              {anomalie.statut.replace("_", " ")}
                            </span>
                            <span className="text-xs font-mono text-slate-400">{anomalie.reference}</span>
                          </div>
                          <p className="font-semibold text-slate-800">{anomalie.produit.nom}</p>
                          <p className="text-sm text-slate-600 mt-0.5">{anomalie.description}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {anomalie.quantite} unité(s) · PDV : {anomalie.pointDeVente?.nom ?? "—"} · Signalé le {new Date(anomalie.createdAt).toLocaleDateString("fr-FR")} par {anomalie.magasinier.prenom} {anomalie.magasinier.nom}
                          </p>
                          {anomalie.commentaire && (
                            <p className="text-xs mt-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-500 italic">
                              {anomalie.commentaire}
                            </p>
                          )}
                        </div>
                        {anomalie.statut === "EN_ATTENTE" && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              onClick={() => handleAnomalieAction(anomalie.id, "VALIDER")}
                              className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <CheckSquare size={13} /> Valider
                            </button>
                            <button
                              onClick={() => handleAnomalieAction(anomalie.id, "REJETER")}
                              className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <XCircle size={13} /> Rejeter
                            </button>
                          </div>
                        )}
                        {anomalie.statut === "TRANSMISE" && (
                          <span className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-200 flex items-center gap-1 whitespace-nowrap shrink-0">
                            <Clock size={12} /> En attente Admin
                          </span>
                        )}
                        {anomalie.statut === "TRAITEE" && (
                          <span className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200 flex items-center gap-1 whitespace-nowrap shrink-0">
                            <CheckSquare size={12} /> Traité
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination anomalies */}
            {(anomaliesValidRes?.meta.totalPages ?? 0) > 1 && (
              <div className="flex justify-center gap-2">
                <button onClick={() => setAnomaliesPage(p => Math.max(1, p - 1))} disabled={anomaliesPage === 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm disabled:opacity-40">{t("btn_prev")}</button>
                <span className="px-4 py-2 text-sm text-slate-600">{anomaliesPage} / {anomaliesValidRes!.meta.totalPages}</span>
                <button onClick={() => setAnomaliesPage(p => p + 1)} disabled={anomaliesPage >= (anomaliesValidRes?.meta.totalPages ?? 1)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm disabled:opacity-40">{t("btn_next")}</button>
              </div>
            )}
            </>)}

            {/* ── Ajustements inventaire (pré-validation Resp.Appro) ── */}
            {anomaliesSubTab === "ajustements" && (<>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Ajustements d&apos;inventaire</h3>
                  <p className="text-sm text-slate-500">Pré-validez les demandes d&apos;ajustement des magasiniers avant transmission à l&apos;admin</p>
                </div>
                {ajustPendingCount > 0 && (
                  <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold border border-amber-200">
                    {ajustPendingCount} en attente
                  </span>
                )}
              </div>

              {/* Filtres */}
              <div className="flex gap-2 flex-wrap">
                {(["EN_ATTENTE", "PRE_VALIDEE", "APPROUVE", "REJETE", ""] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { setAjustFilter(s); setAjustPage(1); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      ajustFilter === s ? "bg-cyan-600 text-white border-cyan-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {s === "" ? "Toutes" : s === "EN_ATTENTE" ? "En attente" : s === "PRE_VALIDEE" ? "Pré-validées" : s === "APPROUVE" ? "Approuvées" : "Rejetées"}
                  </button>
                ))}
              </div>

              {ajustLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                </div>
              ) : (ajustRes?.data.length ?? 0) === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                  <ClipboardCheck size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Aucune demande d&apos;ajustement</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ajustRes!.data.map(d => {
                    const ecart = d.nouvelleQuantite - d.ancienneQuantite;
                    const statutColors: Record<string, string> = {
                      EN_ATTENTE:  "bg-amber-100 text-amber-700",
                      PRE_VALIDEE: "bg-purple-100 text-purple-700",
                      APPROUVE:    "bg-emerald-100 text-emerald-700",
                      REJETE:      "bg-red-100 text-red-700",
                    };
                    return (
                      <div key={d.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statutColors[d.statut] ?? "bg-slate-100 text-slate-700"}`}>
                                {d.statut === "EN_ATTENTE" ? "En attente" : d.statut === "PRE_VALIDEE" ? "Pré-validée (Admin)" : d.statut === "APPROUVE" ? "Approuvée" : "Rejetée"}
                              </span>
                              <span className="text-xs text-slate-400">{d.source}</span>
                            </div>
                            <p className="font-semibold text-slate-800">{d.produit.nom}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm">
                              <span className="text-slate-500">PDV : {d.pointDeVente.nom}</span>
                              <span className="font-mono text-slate-700">{d.ancienneQuantite} → {d.nouvelleQuantite}</span>
                              <span className={`font-bold font-mono ${ecart > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {ecart > 0 ? "+" : ""}{ecart} {d.produit.unite ?? "u."}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Motif : {d.justification}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Demandé par {d.demandeur.prenom} {d.demandeur.nom} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                            </p>
                            {d.commentaireValidation && (
                              <p className="text-xs mt-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-500 italic">{d.commentaireValidation}</p>
                            )}
                          </div>
                          {d.statut === "EN_ATTENTE" && (
                            <div className="flex flex-col gap-2 shrink-0">
                              <button
                                onClick={() => handleAjustAction(d.id, "VALIDER")}
                                className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <CheckSquare size={13} /> Pré-valider
                              </button>
                              <button
                                onClick={() => handleAjustAction(d.id, "REJETER")}
                                className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <XCircle size={13} /> Rejeter
                              </button>
                            </div>
                          )}
                          {d.statut === "PRE_VALIDEE" && (
                            <span className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-200 flex items-center gap-1 whitespace-nowrap shrink-0">
                              <Clock size={12} /> En attente Admin
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(ajustRes?.meta.totalPages ?? 0) > 1 && (
                <div className="flex justify-center gap-2">
                  <button onClick={() => setAjustPage(p => Math.max(1, p - 1))} disabled={ajustPage === 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm disabled:opacity-40">{t("btn_prev")}</button>
                  <span className="px-4 py-2 text-sm text-slate-600">{ajustPage} / {ajustRes!.meta.totalPages}</span>
                  <button onClick={() => setAjustPage(p => p + 1)} disabled={ajustPage >= (ajustRes?.meta.totalPages ?? 1)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm disabled:opacity-40">{t("btn_next")}</button>
                </div>
              )}
            </>)}
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – HISTORIQUE DES PRIX                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {prixHistoProduit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPrixHistoProduit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-blue-500" /> {prixHistoProduit.nom}
              </h2>
              <button onClick={() => setPrixHistoProduit(null)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <HistoriquePrixProduit produitId={prixHistoProduit.id} />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – VALIDATION / REJET ANOMALIE                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {anomalieMotifModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${anomalieMotifModal.action === "VALIDER" ? "bg-emerald-50" : "bg-red-50"}`}>
                  {anomalieMotifModal.action === "VALIDER"
                    ? <CheckSquare className="text-emerald-600" size={20} />
                    : <XCircle className="text-red-600" size={20} />
                  }
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {anomalieMotifModal.action === "VALIDER" ? "Valider la déclaration" : "Rejeter la déclaration"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {anomalieMotifModal.action === "VALIDER"
                      ? "Sera transmise à l'admin pour validation financière"
                      : "Renvoyée au magasinier pour correction"}
                  </p>
                </div>
              </div>
              <button onClick={() => setAnomalieMotifModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Motif / Commentaire {anomalieMotifModal.action === "REJETER" && <span className="text-slate-400">(recommandé)</span>}
                </label>
                <textarea
                  rows={3}
                  value={anomalieMotif}
                  onChange={e => setAnomalieMotif(e.target.value)}
                  placeholder={anomalieMotifModal.action === "VALIDER" ? "Commentaire optionnel..." : "Expliquez la raison du rejet..."}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setAnomalieMotifModal(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm"
                >
                  {t("btn_cancel")}
                </button>
                <button
                  onClick={confirmAnomalieAction}
                  disabled={validateAnomalieLoading}
                  className={`flex-1 py-2.5 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                    anomalieMotifModal.action === "VALIDER" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {validateAnomalieLoading
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : anomalieMotifModal.action === "VALIDER" ? <><Send size={15} /> Valider &amp; Transmettre</> : <><XCircle size={15} /> Rejeter</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – AJUSTEMENT INVENTAIRE (pré-validation)                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {ajustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ajustModal.action === "VALIDER" ? "bg-emerald-50" : "bg-red-50"}`}>
                  {ajustModal.action === "VALIDER" ? <CheckSquare className="text-emerald-600" size={20} /> : <XCircle className="text-red-600" size={20} />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {ajustModal.action === "VALIDER" ? "Pré-valider l'ajustement" : "Rejeter l'ajustement"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {ajustModal.action === "VALIDER" ? "Sera transmis à l'admin pour approbation finale" : "Renvoyé au magasinier"}
                  </p>
                </div>
              </div>
              <button onClick={() => setAjustModal(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Commentaire</label>
                <textarea
                  rows={3}
                  value={ajustCommentaire}
                  onChange={e => setAjustCommentaire(e.target.value)}
                  placeholder={ajustModal.action === "VALIDER" ? "Commentaire optionnel..." : "Raison du rejet..."}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setAjustModal(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm">
                  {t("btn_cancel")}
                </button>
                <button
                  onClick={confirmAjustAction}
                  disabled={ajustActionLoading}
                  className={`flex-1 py-2.5 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${ajustModal.action === "VALIDER" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {ajustActionLoading
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : ajustModal.action === "VALIDER" ? <><Send size={15} /> Pré-valider &amp; Transmettre</> : <><XCircle size={15} /> Rejeter</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – RÉCEPTION                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {receptionModal && recProduit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                  <ArrowUpCircle className="text-cyan-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Réceptionner du stock</h2>
                  <p className="text-sm text-slate-500">{recProduit.nom}</p>
                </div>
              </div>
              <button onClick={closeReceptionModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Infos produit */}
            <div className="px-6 pt-5">
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Stock actuel</p>
                  <p className="font-bold text-slate-800 text-lg">{recProduit.stock} unités</p>
                </div>
                <div>
                  <p className="text-slate-500">Seuil d&apos;alerte</p>
                  <p className="font-bold text-slate-800 text-lg">{recProduit.alerteStock}</p>
                </div>
                <div>
                  <p className="text-slate-500">Prix de vente</p>
                  <p className="font-semibold text-slate-700">{formatCurrency(recProduit.prixUnitaire)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Statut</p>
                  {(() => {
                    const s = getStatut(recProduit.stock, recProduit.alerteStock);
                    const st = statutStyles[s];
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleReception} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Quantité reçue <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={recForm.quantite}
                  onChange={e => setRecForm(f => ({ ...f, quantite: e.target.value }))}
                  placeholder="Ex : 50"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
                {recForm.quantite && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Nouveau stock estimé : <b>{recProduit.stock + (Number(recForm.quantite) || 0)} unités</b>
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Référence fournisseur / Bon de livraison
                </label>
                <input
                  type="text"
                  value={recForm.referenceExterne}
                  onChange={e => setRecForm(f => ({ ...f, referenceExterne: e.target.value }))}
                  placeholder="Ex : BL-2024-0042"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Fournisseur / Notes
                </label>
                <input
                  type="text"
                  value={recForm.motif}
                  onChange={e => setRecForm(f => ({ ...f, motif: e.target.value }))}
                  placeholder="Ex : Livraison Fournisseur XYZ"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeReceptionModal}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={recLoading || !recForm.quantite || Number(recForm.quantite) <= 0}
                  className="flex-1 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recLoading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {recLoading ? "Enregistrement..." : "Valider la réception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – AFFECTATION PdV                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {affModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                  <MapPin className="text-purple-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Affecter au point de vente</h2>
                  <p className="text-sm text-slate-500">
                    {affProduit ? affProduit.nom : "Sélectionnez un produit"}
                  </p>
                </div>
              </div>
              <button onClick={closeAffModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Infos produit (visible uniquement si produit sélectionné) */}
            {affProduit && (
              <div className="px-6 pt-5">
                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Stock disponible</p>
                    <p className={`font-bold text-lg ${affProduit.stock === 0 ? "text-red-600" : "text-slate-800"}`}>
                      {affProduit.stock} unités
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Prix de vente</p>
                    <p className="font-semibold text-slate-700">{formatCurrency(affProduit.prixUnitaire)}</p>
                  </div>
                </div>
                {affProduit.stock === 0 && (
                  <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">Ce produit est en rupture. Effectuez d&apos;abord un réapprovisionnement.</p>
                  </div>
                )}
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleAffectation} className="p-6 space-y-4">

              {/* Sélecteur de produit (visible uniquement si aucun produit pré-sélectionné) */}
              {!affProduit && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Produit à affecter <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value=""
                    onChange={e => {
                      const selected = produits.find(p => p.id === Number(e.target.value));
                      if (selected) {
                        setAffProduit(selected);
                        setAffForm(f => ({ ...f, quantite: "" }));
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                  >
                    <option value="">— Choisir un produit —</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock === 0}>
                        {p.nom} — stock : {p.stock} u.{p.stock === 0 ? " (rupture)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Seuls les produits de la page courante sont listés. Utilisez la recherche dans l&apos;onglet Stock pour en trouver d&apos;autres.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Quantité à affecter <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={affProduit?.stock ?? undefined}
                  required
                  disabled={!affProduit}
                  value={affForm.quantite}
                  onChange={e => setAffForm(f => ({ ...f, quantite: e.target.value }))}
                  placeholder={affProduit ? `Max : ${affProduit.stock}` : "Sélectionnez d'abord un produit"}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm disabled:opacity-50"
                />
                {affProduit && affForm.quantite && Number(affForm.quantite) > 0 && (
                  <p className="text-xs mt-1">
                    {Number(affForm.quantite) > affProduit.stock
                      ? <span className="text-red-600">⚠ Quantité supérieure au stock disponible</span>
                      : <span className="text-slate-500">Stock après affectation : <b>{affProduit.stock - Number(affForm.quantite)} unités</b></span>
                    }
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Point de vente destination <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={affForm.pointDeVenteId}
                  onChange={e => setAffForm(f => ({ ...f, pointDeVenteId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                >
                  <option value="">— Sélectionnez un point de vente —</option>
                  {pdvs.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nom} ({p.code})
                    </option>
                  ))}
                </select>
                {affectationsRes?.sourcePdv && (
                  <p className="text-xs text-slate-500 mt-1">
                    Source automatique : <b>{affectationsRes.sourcePdv.nom}</b> ({affectationsRes.sourcePdv.code})
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Notes / Instructions
                </label>
                <input
                  type="text"
                  value={affForm.notes}
                  onChange={e => setAffForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex : Livraison prioritaire, garder au frais..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeAffModal}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={  
                    affLoading ||
                    !affProduit ||
                    !affForm.quantite ||
                    Number(affForm.quantite) <= 0 ||
                    Number(affForm.quantite) > (affProduit?.stock ?? 0) ||
                    !affForm.pointDeVenteId ||
                    (affProduit?.stock ?? 0) === 0
                  }
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {affLoading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {affLoading ? "Enregistrement..." : "Confirmer l'affectation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – NOUVELLE COMMANDE FOURNISSEUR                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {commandeModal && (() => {
        const cmdPdvs: PDVOption[] = allPdvs;
        const allProduits: ProduitOption[] = receptionsRes?.produits ?? produits.map(p => ({ id: p.id, nom: p.nom, reference: null, unite: null, prixUnitaire: p.prixUnitaire }));
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-slate-200 flex items-start justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Truck className="text-emerald-600 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Nouvelle commande fournisseur</h2>
                    <p className="text-sm text-slate-500">Validation niveau 2 par l&apos;admin après soumission</p>
                  </div>
                </div>
                <button onClick={() => setCommandeModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleCreateCommande} className="p-6 space-y-5">
                {/* Type + PDV */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Type de commande <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={cmdForm.type}
                      onChange={e => setCmdForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                    >
                      <option value="FOURNISSEUR">Fournisseur externe</option>
                      <option value="INTERNE">Transfert interne</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      PDV destination <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={cmdForm.pointDeVenteId}
                      onChange={e => setCmdForm(f => ({ ...f, pointDeVenteId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                    >
                      <option value="">— Sélectionnez —</option>
                      {cmdPdvs.map(p => (
                        <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fournisseur + Date */}
                <div className="grid grid-cols-2 gap-4">
                  {cmdForm.type === "FOURNISSEUR" && (
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">
                        Nom du fournisseur <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={cmdForm.type === "FOURNISSEUR"}
                        value={cmdForm.fournisseurNom}
                        onChange={e => setCmdForm(f => ({ ...f, fournisseurNom: e.target.value }))}
                        placeholder="Ex : SONIMEX, CFAO..."
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                      />
                    </div>
                  )}
                  <div className={cmdForm.type === "FOURNISSEUR" ? "" : "col-span-2"}>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Date prévisionnelle de livraison <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={cmdForm.datePrevisionnelle}
                      onChange={e => setCmdForm(f => ({ ...f, datePrevisionnelle: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes (optionnel)</label>
                  <textarea
                    rows={2}
                    value={cmdForm.notes}
                    onChange={e => setCmdForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Instructions particulières, conditions de livraison..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm resize-none"
                  />
                </div>

                {/* Lignes produits */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Produits commandés <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setCmdLignes(l => [...l, { produitId: "", quantiteAttendue: "", prixUnitaire: "" }])}
                      className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      <Plus size={14} /> Ajouter un produit
                    </button>
                  </div>
                  <div className="space-y-2">
                    {cmdLignes.map((ligne, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                        <select
                          required
                          value={ligne.produitId}
                          onChange={e => setCmdLignes(ls => ls.map((l, j) => j === i ? { ...l, produitId: e.target.value } : l))}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                        >
                          <option value="">— Produit —</option>
                          {allProduits.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nom}{p.reference ? ` (${p.reference})` : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qté"
                          value={ligne.quantiteAttendue}
                          onChange={e => setCmdLignes(ls => ls.map((l, j) => j === i ? { ...l, quantiteAttendue: e.target.value } : l))}
                          className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm text-center"
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Prix achat"
                          value={ligne.prixUnitaire}
                          onChange={e => setCmdLignes(ls => ls.map((l, j) => j === i ? { ...l, prixUnitaire: e.target.value } : l))}
                          className="w-28 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                        />
                        {cmdLignes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCmdLignes(ls => ls.filter((_, j) => j !== i))}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Le prix d&apos;achat est optionnel — l&apos;admin peut le corriger lors de l&apos;approbation.
                  </p>
                </div>

                {/* Récapitulatif */}
                {cmdLignes.some(l => l.produitId && l.quantiteAttendue) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                    <p className="font-semibold text-emerald-800 mb-1">Récapitulatif</p>
                    {cmdLignes.filter(l => l.produitId && Number(l.quantiteAttendue) > 0).map((l, i) => {
                      const p = allProduits.find(p => p.id === Number(l.produitId));
                      const total = l.prixUnitaire ? Number(l.prixUnitaire) * Number(l.quantiteAttendue) : null;
                      return (
                        <div key={i} className="flex justify-between text-emerald-700">
                          <span>{p?.nom ?? "—"} × {l.quantiteAttendue}</span>
                          {total !== null && <span className="font-medium">{formatCurrency(String(total))}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCommandeModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={cmdLoading || !cmdForm.pointDeVenteId || !cmdForm.datePrevisionnelle || !cmdLignes.some(l => l.produitId && Number(l.quantiteAttendue) > 0)}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cmdLoading ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    {cmdLoading ? "Soumission..." : "Soumettre la commande"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL – CRÉATION PRODUIT                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {createProduitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                  <Package className="text-cyan-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Nouveau produit</h2>
                  <p className="text-sm text-slate-500">L&apos;admin validera la stratégie de prix</p>
                </div>
              </div>
              <button onClick={() => setCreateProduitModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateProduit} className="p-6 space-y-4">
              {/* Nom */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Nom du produit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cpForm.nom}
                  onChange={e => setCpForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex : Riz 50kg"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                />
              </div>

              {/* Prix achat + Prix vente */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Prix d&apos;achat (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cpForm.prixAchat}
                    onChange={e => setCpForm(f => ({ ...f, prixAchat: e.target.value }))}
                    placeholder="Ex : 25000"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">
                    Prix de vente (FCFA) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={cpForm.prixUnitaire}
                    onChange={e => setCpForm(f => ({ ...f, prixUnitaire: e.target.value }))}
                    placeholder="Ex : 28000"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                  />
                </div>
              </div>

              {/* Unité + Stock minimum */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Unité</label>
                  <input
                    type="text"
                    value={cpForm.unite}
                    onChange={e => setCpForm(f => ({ ...f, unite: e.target.value }))}
                    placeholder="Ex : Sac, Carton, Kg"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Stock minimum</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cpForm.alerteStock}
                    onChange={e => setCpForm(f => ({ ...f, alerteStock: e.target.value }))}
                    placeholder="Ex : 20"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                  />
                </div>
              </div>

              {/* Référence + Catégorie */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Référence</label>
                  <input
                    type="text"
                    value={cpForm.reference}
                    onChange={e => setCpForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="Ex : RIZ-50KG"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Catégorie</label>
                  <input
                    type="text"
                    value={cpForm.categorie}
                    onChange={e => setCpForm(f => ({ ...f, categorie: e.target.value }))}
                    placeholder="Ex : Céréales"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={cpForm.description}
                  onChange={e => setCpForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-sm resize-none"
                />
              </div>

              {/* Marge prévisionnelle */}
              {cpForm.prixAchat && cpForm.prixUnitaire && Number(cpForm.prixUnitaire) > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  <p className="text-slate-500">
                    Marge prévisionnelle :{" "}
                    <span className={Number(cpForm.prixUnitaire) > Number(cpForm.prixAchat) ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                      {formatCurrency(String(Number(cpForm.prixUnitaire) - Number(cpForm.prixAchat)))}
                      {" "}({Math.round(((Number(cpForm.prixUnitaire) - Number(cpForm.prixAchat)) / Number(cpForm.prixAchat)) * 100)}%)
                    </span>
                  </p>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCreateProduitModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={cpLoading || !cpForm.nom || !cpForm.prixUnitaire || Number(cpForm.prixUnitaire) <= 0}
                  className="flex-1 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cpLoading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {cpLoading ? "Création..." : "Créer le produit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

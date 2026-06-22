"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard, Search, RefreshCw, Loader2, Plus, X, Eye,
  CheckCircle2, AlertCircle, TrendingDown, Calendar, Banknote,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User,
  PackageCheck, ArrowLeftRight, XCircle, Receipt, Edit3, Trash2,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import FactureModal from "@/components/FactureModal";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LigneCreditDetail {
  id: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montantLigne: number;
  statut: string;
  estNouveauProduit: boolean;
  produitNomSaisi: string | null;
  notes: string | null;
  dateTraitement: string | null;
  produit: { id: number; nom: string } | null;
  produitSubstitut: { id: number; nom: string } | null;
  traitePar: { id: number; nom: string; prenom: string } | null;
}

interface CreditClient {
  id: number;
  reference: string;
  statut: string;
  montantTotal: number;
  montantRembourse: number;
  soldeRestant: number;
  dureeJours: number;
  dateDebut: string;
  dateEcheanceFin: string;
  montantJournalier: number;
  createdAt: string;
  client: { id: number; nom: string; prenom: string; codeClient: string | null; telephone: string };
  creePar: { id: number; nom: string; prenom: string };
  _count: { lignes: number; remboursements: number };
}

interface CreditDetail extends CreditClient {
  validePar: { id: number; nom: string; prenom: string } | null;
  dateValidation: string | null;
  tauxPenalite: number;
  garantie: string | null;
  observations: string | null;
  lignes: LigneCreditDetail[];
  echeances: { id: number; numeroEcheance: number; dateEcheance: string; montantDu: number; montantPaye: number; statut: string }[];
  remboursements: { id: number; montant: number; dateRemboursement: string; modePaiement: string; enregistrePar: { id: number; nom: string; prenom: string } }[];
}

interface CreditsResponse {
  data: CreditClient[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE_VALIDATION: "bg-amber-100 text-amber-700",
  ACTIF:     "bg-emerald-100 text-emerald-700",
  EN_RETARD: "bg-red-100 text-red-700",
  SOLDE:     "bg-gray-100 text-gray-600",
  ANNULE:    "bg-gray-50 text-gray-400",
};
const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE_VALIDATION: "En attente",
  ACTIF:     "Actif",
  EN_RETARD: "En retard",
  SOLDE:     "Soldé",
  ANNULE:    "Annulé",
};

const LIGNE_STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE:   "bg-amber-100 text-amber-700",
  LIVRE:        "bg-emerald-100 text-emerald-700",
  INDISPONIBLE: "bg-orange-100 text-orange-700",
  SUBSTITUE:    "bg-blue-100 text-blue-700",
  ANNULE:       "bg-gray-100 text-gray-500",
};
const LIGNE_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE:   "En attente",
  LIVRE:        "Livré",
  INDISPONIBLE: "Indisponible",
  SUBSTITUE:    "Substitué",
  ANNULE:       "Annulé",
};

// ─── NouveauCreditModal ────────────────────────────────────────────────────────

interface ClientOption { id: number; nom: string; prenom: string; telephone: string }
interface ProduitOption { id: number; nom: string; reference: string; unite: string | null; prixUnitaire: number; quantite: number }
interface EligibiliteResponse {
  eligible: boolean;
  raisons: string[];
  alertes: string[];
  client: { limiteCredit: number | null };
}

function NouveauCreditModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  // ── Données initiales ─────────────────────────────────────────────────────
  const { data: initData, loading: initLoading } = useApi<{ clients: ClientOption[]; produitsDispo: ProduitOption[] }>("/api/rvc/credits/init");
  const clients  = initData?.clients  ?? [];
  const produits = initData?.produitsDispo ?? [];

  // ── Étape 1 : sélection client + éligibilité ─────────────────────────────
  const [clientId,     setClientId]     = useState("");
  const [eligibilite,  setEligibilite]  = useState<EligibiliteResponse | null>(null);
  const [eligLoading,  setEligLoading]  = useState(false);

  // ── Inline : définir limite crédit si absente ─────────────────────────────
  const [showSetLimite, setShowSetLimite] = useState(false);
  const [limiteInput,   setLimiteInput]   = useState("");
  const [limiteLoading, setLimiteLoading] = useState(false);

  // ── Formulaire crédit ─────────────────────────────────────────────────────
  const [dureeJours,   setDureeJours]   = useState("30");
  const [dateDebut,    setDateDebut]    = useState(new Date().toISOString().slice(0, 10));
  const [garantie,     setGarantie]     = useState("");
  const [observations, setObservations] = useState("");
  const [lignes, setLignes] = useState([{ produitId: "", produitNom: "", quantite: "1", prixUnitaire: "", remise: "0" }]);
  const [submitLoading, setSubmitLoading] = useState(false);

  const checkEligibilite = async (cid: string) => {
    if (!cid) { setEligibilite(null); return; }
    setEligLoading(true);
    try {
      const r = await fetch(`/api/rvc/clients/${cid}/eligibilite-credit`);
      const j = await r.json();
      if (r.ok) {
        setEligibilite(j);
        setShowSetLimite(j.client?.limiteCredit === null);
      }
    } finally { setEligLoading(false); }
  };

  const handleSetLimite = async () => {
    if (!clientId || !limiteInput || Number(limiteInput) <= 0) return toast.error("Montant invalide");
    setLimiteLoading(true);
    try {
      const r = await fetch(`/api/rvc/clients/${clientId}/limite-credit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limiteCredit: Number(limiteInput) }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success("Limite de crédit définie");
        setShowSetLimite(false);
        await checkEligibilite(clientId);
      } else {
        toast.error(j.error ?? "Erreur");
      }
    } finally { setLimiteLoading(false); }
  };

  const setLigne = (i: number, field: string, val: string) => {
    setLignes((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      if (field === "produitId" && val) {
        const p = produits.find((p) => p.id === Number(val));
        if (p) { next[i].produitNom = p.nom; next[i].prixUnitaire = String(p.prixUnitaire); }
      }
      return next;
    });
  };

  const montantTotal = lignes.reduce((s, l) => {
    const qte = Number(l.quantite) || 0;
    const pu  = Number(l.prixUnitaire) || 0;
    const rem = Number(l.remise) || 0;
    return s + Math.max(0, qte * pu - rem);
  }, 0);

  const handleSubmit = async () => {
    if (!clientId) return toast.error("Sélectionnez un client");
    if (lignes.some((l) => !l.produitNom.trim())) return toast.error("Nom requis pour chaque produit");
    if (lignes.some((l) => !Number(l.prixUnitaire) || Number(l.prixUnitaire) <= 0)) return toast.error("Prix invalide");
    if (montantTotal <= 0) return toast.error("Montant total invalide");
    setSubmitLoading(true);
    try {
      const r = await fetch("/api/rvc/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId:     Number(clientId),
          dureeJours:   Number(dureeJours),
          dateDebut,
          garantie:     garantie || undefined,
          observations: observations || undefined,
          lignes: lignes.map((l) => ({
            produitId:   l.produitId ? Number(l.produitId) : undefined,
            produitNom:  l.produitNom.trim(),
            quantite:    Number(l.quantite),
            prixUnitaire: Number(l.prixUnitaire),
            remise:      Number(l.remise) || 0,
          })),
        }),
      });
      const j = await r.json();
      if (r.ok) {
        const rupturesMsg = j.ruptures?.length
          ? ` — ${j.ruptures.length} produit(s) en rupture : commande interne créée automatiquement.`
          : "";
        toast.success(`Crédit créé (ACTIF)${rupturesMsg}`);
        onSuccess();
      } else {
        toast.error(j.error ?? "Erreur lors de la création");
      }
    } finally { setSubmitLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900">Nouveau crédit client</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {initLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>}

          {!initLoading && (
            <>
              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Client *</label>
                <select
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setEligibilite(null); setShowSetLimite(false); checkEligibilite(e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Sélectionner un client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.telephone}</option>
                  ))}
                </select>

                {/* Éligibilité */}
                {eligLoading && <p className="mt-2 text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Vérification…</p>}
                {!eligLoading && eligibilite && (
                  <div className={`mt-2 p-3 rounded-xl text-xs space-y-1 ${eligibilite.eligible ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    {eligibilite.raisons.map((r, i) => <p key={i} className="text-red-700">• {r}</p>)}
                    {eligibilite.alertes.map((a, i) => <p key={i} className="text-amber-700">⚠ {a}</p>)}
                    {eligibilite.eligible && !eligibilite.raisons.length && <p className="text-green-700">✓ Client éligible</p>}
                  </div>
                )}

              </div>

              {/* ── Indicateur d'étapes (visible dès qu'un client est sélectionné) */}
              {clientId && (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${showSetLimite ? "text-amber-700" : "text-emerald-600"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${showSetLimite ? "bg-amber-500" : "bg-emerald-500"}`}>1</span>
                    Limite de crédit
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${!showSetLimite ? "text-indigo-700" : "text-gray-400"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${!showSetLimite ? "bg-indigo-600" : "bg-gray-300"}`}>2</span>
                    Détails du crédit
                  </div>
                </div>
              )}

              {/* ── Étape 1 : définir la limite de crédit ─────────────────────── */}
              {showSetLimite && (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Limite de crédit non définie</p>
                      <p className="text-xs text-amber-700 mt-0.5">Ce client n&apos;a pas encore de plafond de crédit. Définissez-en un pour débloquer la création du crédit.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1.5">Plafond de crédit (FCFA) *</label>
                    <div className="flex gap-2">
                      <input
                        type="number" min={1} placeholder="ex. 500 000"
                        value={limiteInput} onChange={(e) => setLimiteInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSetLimite()}
                        className="flex-1 px-3 py-2.5 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                      <button
                        onClick={handleSetLimite} disabled={limiteLoading || !limiteInput || Number(limiteInput) <= 0}
                        className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {limiteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Valider la limite
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-amber-600">Une fois la limite validée, vous pourrez renseigner les détails du crédit.</p>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-amber-300 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-100">
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* ── Étape 2 : formulaire du crédit ────────────────────────────── */}
              {!showSetLimite && clientId && (
                <>
                  {/* Durée + Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Durée (jours) *</label>
                      <input type="number" min={1} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début *</label>
                      <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  {/* Garantie + Observations */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Garantie</label>
                      <input type="text" value={garantie} placeholder="ex. titre foncier…" onChange={(e) => setGarantie(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Observations</label>
                      <input type="text" value={observations} onChange={(e) => setObservations(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  {/* Lignes produits */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Produits *</label>
                      <button onClick={() => setLignes((p) => [...p, { produitId: "", produitNom: "", quantite: "1", prixUnitaire: "", remise: "0" }])}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-3">
                      {lignes.map((l, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <select value={l.produitId} onChange={(e) => setLigne(i, "produitId", e.target.value)}
                              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="">Hors catalogue (saisie libre)</option>
                              {produits.map((p) => (
                                <option key={p.id} value={p.id}>{p.nom} — {p.reference} (dispo: {p.quantite})</option>
                              ))}
                            </select>
                            {lignes.length > 1 && (
                              <button onClick={() => setLignes((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-2">
                              <input type="text" placeholder="Nom du produit *" value={l.produitNom} onChange={(e) => setLigne(i, "produitNom", e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <input type="number" placeholder="Qté" min={1} value={l.quantite} onChange={(e) => setLigne(i, "quantite", e.target.value)}
                              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <input type="number" placeholder="Prix u." min={0} value={l.prixUnitaire} onChange={(e) => setLigne(i, "prixUnitaire", e.target.value)}
                              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                    <span className="text-sm font-semibold text-indigo-800">Montant total</span>
                    <span className="text-lg font-bold text-indigo-900">{formatCurrency(montantTotal)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Annuler
                    </button>
                    <button onClick={handleSubmit} disabled={submitLoading}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      Créer le crédit
                    </button>
                  </div>
                </>
              )}

              {/* Actions si aucun client sélectionné */}
              {!clientId && (
                <div className="flex gap-3 pt-2">
                  <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RVCCreditsPage() {
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statut,      setStatut]      = useState("");
  const [page,        setPage]        = useState(1);
  const LIMIT = 20;

  const [showNouveauCredit, setShowNouveauCredit] = useState(false);

  const [detailCredit,    setDetailCredit]    = useState<CreditDetail | null>(null);
  const [detailLoading,   setDetailLoading]   = useState(false);
  const [showEcheances,   setShowEcheances]   = useState(false);
  const [factureId,       setFactureId]       = useState<number | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Ligne action states
  const [ligneActionOpen,        setLigneActionOpen]        = useState(false);
  const [ligneActionCreditId,    setLigneActionCreditId]    = useState<number | null>(null);
  const [ligneActionLigneId,     setLigneActionLigneId]     = useState<number | null>(null);
  const [ligneActionStatut,      setLigneActionStatut]      = useState("");
  const [ligneActionNotes,       setLigneActionNotes]       = useState("");
  const [ligneActionProduitId,   setLigneActionProduitId]   = useState("");
  const [ligneActionProdSearch,  setLigneActionProdSearch]  = useState("");
  const [ligneActionProdResults, setLigneActionProdResults] = useState<{ id: number; nom: string; reference: string | null }[]>([]);
  const [ligneActionProdLoading, setLigneActionProdLoading] = useState(false);
  const [ligneActionLoading,     setLigneActionLoading]     = useState(false);
  const [ligneActionError,       setLigneActionError]       = useState("");

  // ── Refus d'une demande EN_ATTENTE_VALIDATION ──────────────────────────────
  const [refuserOpen,    setRefuserOpen]    = useState(false);
  const [refuserMotif,   setRefuserMotif]   = useState("");
  const [refuserLoading, setRefuserLoading] = useState(false);

  // ── Encaissement d'un remboursement de crédit ──────────────────────────────
  const [rembOpen,    setRembOpen]    = useState(false);
  const [rembMontant, setRembMontant] = useState("");
  const [rembMode,    setRembMode]    = useState("ESPECES");
  const [rembNotes,   setRembNotes]   = useState("");
  const [rembLoading, setRembLoading] = useState(false);

  // ── Ajout / Modification d'une ligne (EN_ATTENTE_VALIDATION) ──────────────
  type LigneEditResults = { id: number; nom: string; reference: string | null; prixVente: string | null }[];
  const [ligneEditOpen,       setLigneEditOpen]       = useState(false);
  const [ligneEditId,         setLigneEditId]         = useState<number | null>(null); // null = nouvelle ligne
  const [ligneEditType,       setLigneEditType]       = useState<"catalogue" | "nouveau">("catalogue");
  const [ligneEditProdSearch, setLigneEditProdSearch] = useState("");
  const [ligneEditProdResults,setLigneEditProdResults]= useState<LigneEditResults>([]);
  const [ligneEditProdLoading,setLigneEditProdLoading]= useState(false);
  const [ligneEditProdId,     setLigneEditProdId]     = useState("");
  const [ligneEditProdNom,    setLigneEditProdNom]    = useState("");
  const [ligneEditNomSaisi,   setLigneEditNomSaisi]   = useState("");
  const [ligneEditQuantite,   setLigneEditQuantite]   = useState("1");
  const [ligneEditPrix,       setLigneEditPrix]       = useState("");
  const [ligneEditLoading,    setLigneEditLoading]    = useState(false);
  const [ligneEditError,      setLigneEditError]      = useState("");
  const [deletingLigneId,     setDeletingLigneId]     = useState<number | null>(null);

  const query = new URLSearchParams({
    page: String(page), limit: String(LIMIT),
    ...(search && { search }),
    ...(statut && { statut }),
  }).toString();

  const { data: res, loading, refetch } = useApi<CreditsResponse>(`/api/rvc/credits?${query}`);
  const credits = res?.data ?? [];
  const meta    = res?.meta;

  const handleValiderCredit = async (creditId: number) => {
    setValidationLoading(true);
    try {
      const r = await fetch(`/api/admin/credits/${creditId}/valider`, { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        toast.success("Crédit validé — stock réservé, magasinier notifié");
        refetch();
        await openDetail(creditId);
      } else {
        toast.error(j.message ?? "Erreur lors de la validation");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setValidationLoading(false); }
  };

  const handleRefuserCredit = async () => {
    if (!detailCredit) return;
    setRefuserLoading(true);
    try {
      const r = await fetch(`/api/rvc/credits/${detailCredit.id}/refuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif: refuserMotif || undefined }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success("Demande refusée — le demandeur a été notifié");
        setRefuserOpen(false);
        setRefuserMotif("");
        setDetailCredit(null);
        refetch();
      } else {
        toast.error(j.error ?? "Erreur lors du refus");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setRefuserLoading(false); }
  };

  const openEncaisser = () => {
    if (!detailCredit) return;
    setRembMontant(String(Number(detailCredit.soldeRestant)));
    setRembMode("ESPECES");
    setRembNotes("");
    setRembOpen(true);
  };

  const handleEncaisser = async () => {
    if (!detailCredit) return;
    const montant = Number(rembMontant);
    if (!montant || montant <= 0) return toast.error("Montant invalide");
    setRembLoading(true);
    try {
      const r = await fetch(`/api/rvc/credits/${detailCredit.id}/rembourser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant, modePaiement: rembMode, notes: rembNotes || undefined }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success("Encaissement enregistré ✓");
        setRembOpen(false);
        await openDetail(detailCredit.id);
        refetch();
      } else {
        toast.error(j.error ?? "Erreur lors de l'encaissement");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setRembLoading(false); }
  };

  const openLigneEdit = (ligneId: number | null, l?: LigneCreditDetail) => {
    setLigneEditId(ligneId);
    setLigneEditError("");
    setLigneEditProdSearch("");
    setLigneEditProdResults([]);
    if (l) {
      setLigneEditType(l.estNouveauProduit ? "nouveau" : "catalogue");
      setLigneEditProdId(l.produit ? String(l.produit.id) : "");
      setLigneEditProdNom(l.produit?.nom ?? "");
      setLigneEditProdSearch(l.produit?.nom ?? "");
      setLigneEditNomSaisi(l.produitNomSaisi ?? l.produitNom);
      setLigneEditQuantite(String(l.quantite));
      setLigneEditPrix(String(Number(l.prixUnitaire)));
    } else {
      setLigneEditType("catalogue");
      setLigneEditProdId("");
      setLigneEditProdNom("");
      setLigneEditNomSaisi("");
      setLigneEditQuantite("1");
      setLigneEditPrix("");
    }
    setLigneEditOpen(true);
  };

  const handleSaveLigne = async () => {
    if (!detailCredit) return;
    if (ligneEditType === "catalogue" && !ligneEditProdId) { setLigneEditError("Sélectionnez un produit"); return; }
    if (ligneEditType === "nouveau" && !ligneEditNomSaisi.trim()) { setLigneEditError("Saisissez le nom du produit"); return; }
    if (!ligneEditQuantite || Number(ligneEditQuantite) <= 0) { setLigneEditError("Quantité invalide"); return; }
    setLigneEditLoading(true);
    setLigneEditError("");
    try {
      const body = {
        produitId:      ligneEditType === "catalogue" ? Number(ligneEditProdId) : undefined,
        produitNomSaisi: ligneEditType === "nouveau" ? ligneEditNomSaisi : (ligneEditProdNom || ligneEditNomSaisi),
        quantite:       Number(ligneEditQuantite),
        prixUnitaire:   Number(ligneEditPrix || 0),
      };
      const url = ligneEditId
        ? `/api/rvc/credits/${detailCredit.id}/lignes/${ligneEditId}`
        : `/api/rvc/credits/${detailCredit.id}/lignes`;
      const r = await fetch(url, {
        method: ligneEditId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(ligneEditId ? "Ligne modifiée" : "Ligne ajoutée");
        setLigneEditOpen(false);
        await openDetail(detailCredit.id);
        refetch();
      } else {
        setLigneEditError(j.error ?? "Erreur");
      }
    } catch { setLigneEditError("Erreur réseau"); }
    finally { setLigneEditLoading(false); }
  };

  const handleDeleteLigne = async (ligneId: number) => {
    if (!detailCredit) return;
    setDeletingLigneId(ligneId);
    try {
      const r = await fetch(`/api/rvc/credits/${detailCredit.id}/lignes/${ligneId}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok) {
        toast.success("Ligne supprimée");
        await openDetail(detailCredit.id);
        refetch();
      } else {
        toast.error(j.error ?? "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setDeletingLigneId(null); }
  };

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailCredit(null);
    setShowEcheances(false);
    try {
      const r = await fetch(`/api/rvc/credits/${id}`);
      const j = await r.json();
      if (r.ok) setDetailCredit(j.data);
      else toast.error(j.error ?? "Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setDetailLoading(false); }
  };

  const openLigneAction = (creditId: number, ligneId: number, statut: string) => {
    setLigneActionCreditId(creditId);
    setLigneActionLigneId(ligneId);
    setLigneActionStatut(statut);
    setLigneActionNotes("");
    setLigneActionProduitId("");
    setLigneActionProdSearch("");
    setLigneActionProdResults([]);
    setLigneActionError("");
    setLigneActionOpen(true);
  };

  const handleLigneAction = async () => {
    if (!ligneActionCreditId || !ligneActionLigneId) return;
    if (ligneActionStatut === "SUBSTITUE" && !ligneActionProduitId) {
      setLigneActionError("Sélectionnez un produit substitut"); return;
    }
    setLigneActionLoading(true);
    setLigneActionError("");
    try {
      const r = await fetch(`/api/rvc/credits/${ligneActionCreditId}/lignes/${ligneActionLigneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: ligneActionStatut,
          notes: ligneActionNotes || undefined,
          ...(ligneActionStatut === "SUBSTITUE" && { produitSubstitutId: Number(ligneActionProduitId) }),
        }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(`Ligne : ${LIGNE_STATUT_LABEL[ligneActionStatut] ?? ligneActionStatut}`);
        setLigneActionOpen(false);
        if (detailCredit) await openDetail(detailCredit.id);
      } else {
        setLigneActionError(j.error ?? "Erreur");
      }
    } catch { setLigneActionError("Erreur réseau"); }
    finally { setLigneActionLoading(false); }
  };

  // Recherche produit substitut
  useEffect(() => {
    if (ligneActionStatut !== "SUBSTITUE" || ligneActionProdSearch.trim().length < 2) {
      setLigneActionProdResults([]); return;
    }
    setLigneActionProdLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/rvc/produits?search=${encodeURIComponent(ligneActionProdSearch)}&limit=8`);
        const j = await r.json();
        setLigneActionProdResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setLigneActionProdLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [ligneActionProdSearch, ligneActionStatut]);

  // Recherche produit pour édition/ajout de ligne
  useEffect(() => {
    if (ligneEditType !== "catalogue" || ligneEditProdSearch.trim().length < 2) {
      setLigneEditProdResults([]); return;
    }
    setLigneEditProdLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/rvc/produits?search=${encodeURIComponent(ligneEditProdSearch)}&limit=8`);
        const j = await r.json();
        setLigneEditProdResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setLigneEditProdLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [ligneEditProdSearch, ligneEditType]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <DashboardBackButton />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <CreditCard size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Crédits clients</h1>
                <p className="text-xs text-gray-500">Suivi des lignes de crédit</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
                placeholder="Référence, client, téléphone…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <button onClick={() => { setSearch(searchInput); setPage(1); }}
              className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Chercher
            </button>
            {search && (
              <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Tous les statuts</option>
              <option value="EN_ATTENTE_VALIDATION">En attente</option>
              <option value="ACTIF">Actif</option>
              <option value="EN_RETARD">En retard</option>
              <option value="SOLDE">Soldé</option>
              <option value="ANNULE">Annulé</option>
            </select>
            <button
              onClick={() => setShowNouveauCredit(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus size={14} /> Nouveau crédit
            </button>
            <button onClick={refetch} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…
            </div>
          ) : !credits.length ? (
            <div className="text-center py-20">
              <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Aucun crédit</p>
              <p className="text-gray-300 text-sm mt-1">Créez un premier crédit depuis la page Ventes à Crédit</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Référence</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Solde restant</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Fin</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {credits.map((credit) => {
                      const pct = Number(credit.montantTotal) > 0
                        ? Math.min(100, Math.round((Number(credit.montantRembourse) / Number(credit.montantTotal)) * 100))
                        : 0;
                      return (
                        <tr key={credit.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-mono text-xs font-semibold text-gray-700">{credit.reference}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(credit.createdAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-800">{credit.client.prenom} {credit.client.nom}</p>
                            <p className="text-xs text-gray-400">{credit.client.telephone}</p>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <p className="font-semibold text-gray-800">{formatCurrency(Number(credit.montantTotal))}</p>
                            <p className="text-xs text-gray-400">{credit._count.lignes} produit(s)</p>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <p className={`font-bold ${Number(credit.soldeRestant) > 0 && credit.statut !== "SOLDE" ? "text-red-600" : "text-gray-500"}`}>
                              {formatCurrency(Number(credit.soldeRestant))}
                            </p>
                            <div className="w-16 ml-auto mt-1">
                              <div className="w-full bg-gray-100 rounded-full h-1">
                                <div className={`h-1 rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-400"}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-gray-400 text-right mt-0.5">{pct}%</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <p className="text-xs font-medium text-gray-700">{credit.dureeJours}j</p>
                            <p className="text-xs text-gray-400">{formatDate(credit.dateEcheanceFin)}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUT_STYLE[credit.statut] ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUT_LABEL[credit.statut] ?? credit.statut}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openDetail(credit.id)}
                                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Voir le détail">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => setFactureId(credit.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Facture crédit">
                                <Receipt className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 text-sm text-gray-500">
                  <span>{meta.total} crédit(s) · page {meta.page}/{meta.totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-xs">
                      <ChevronLeft className="w-3.5 h-3.5" /> Préc.
                    </button>
                    <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-xs">
                      Suiv. <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Drawer détail ─────────────────────────────────────────────────────── */}
      {(detailCredit || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailCredit(null)} />
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-gray-900">{detailCredit?.reference ?? "…"}</h3>
                  {detailCredit && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUT_STYLE[detailCredit.statut] ?? ""}`}>
                      {STATUT_LABEL[detailCredit.statut] ?? detailCredit.statut}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detailCredit?.statut === "EN_ATTENTE_VALIDATION" && (
                  <>
                    <button
                      onClick={() => handleValiderCredit(detailCredit.id)}
                      disabled={validationLoading}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium"
                    >
                      {validationLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Valider
                    </button>
                    <button
                      onClick={() => { setRefuserMotif(""); setRefuserOpen(true); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Refuser
                    </button>
                  </>
                )}
                {detailCredit && (detailCredit.statut === "ACTIF" || detailCredit.statut === "EN_RETARD") && Number(detailCredit.soldeRestant) > 0 && (
                  <button onClick={openEncaisser}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium">
                    <Banknote className="w-3.5 h-3.5" /> Encaisser
                  </button>
                )}
                {detailCredit && detailCredit.statut !== "EN_ATTENTE_VALIDATION" && (
                  <button onClick={() => setFactureId(detailCredit.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg">
                    <Receipt className="w-3.5 h-3.5" /> Facture
                  </button>
                )}
                <button onClick={() => setDetailCredit(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
              </div>
            ) : detailCredit ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Infos générales */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Montant total",  value: formatCurrency(Number(detailCredit.montantTotal)),     icon: <CreditCard className="w-3.5 h-3.5" /> },
                    { label: "Solde restant",   value: formatCurrency(Number(detailCredit.soldeRestant)),     icon: <TrendingDown className="w-3.5 h-3.5" /> },
                    { label: "Remboursé",       value: formatCurrency(Number(detailCredit.montantRembourse)), icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                    { label: "Montant/jour",    value: formatCurrency(Number(detailCredit.montantJournalier)),icon: <Banknote className="w-3.5 h-3.5" /> },
                    { label: "Début",           value: formatDate(detailCredit.dateDebut),                   icon: <Calendar className="w-3.5 h-3.5" /> },
                    { label: "Fin d'échéance",  value: formatDate(detailCredit.dateEcheanceFin),              icon: <Calendar className="w-3.5 h-3.5" /> },
                  ].map((f) => (
                    <div key={f.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-gray-400 flex items-center gap-1">{f.icon}{f.label}</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Client */}
                <div className="border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />Client
                  </p>
                  <p className="text-sm font-semibold text-gray-800">{detailCredit.client.prenom} {detailCredit.client.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detailCredit.client.telephone}</p>
                  {detailCredit.client.codeClient && <p className="text-xs text-gray-400 font-mono">{detailCredit.client.codeClient}</p>}
                </div>

                {/* Lignes produits */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Produits ({detailCredit.lignes.length})
                    </p>
                    {detailCredit.statut === "EN_ATTENTE_VALIDATION" && (
                      <button
                        onClick={() => openLigneEdit(null)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter
                      </button>
                    )}
                  </div>
                  {detailCredit.lignes.length > 0 ? (
                    <div className="space-y-2">
                      {detailCredit.lignes.map((l) => (
                        <div key={l.id} className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-gray-700 font-medium">{l.produitNom}</span>
                              <span className="text-gray-400 ml-1.5">× {l.quantite}</span>
                              {l.estNouveauProduit && (
                                <span className="ml-1.5 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">nouveau</span>
                              )}
                              {Number(l.prixUnitaire) > 0 && (
                                <span className="ml-1.5 text-xs text-gray-400">{formatCurrency(Number(l.prixUnitaire))}/u</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {detailCredit.statut !== "EN_ATTENTE_VALIDATION" && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LIGNE_STATUT_STYLE[l.statut] ?? "bg-gray-100 text-gray-500"}`}>
                                  {LIGNE_STATUT_LABEL[l.statut] ?? l.statut}
                                </span>
                              )}
                              <span className="font-medium text-gray-800 text-xs">{formatCurrency(Number(l.montantLigne))}</span>
                              {/* Actions EN_ATTENTE_VALIDATION : modifier / supprimer */}
                              {detailCredit.statut === "EN_ATTENTE_VALIDATION" && (
                                <>
                                  <button
                                    onClick={() => openLigneEdit(l.id, l)}
                                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                    title="Modifier"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLigne(l.id)}
                                    disabled={deletingLigneId === l.id}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Supprimer"
                                  >
                                    {deletingLigneId === l.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {l.produitSubstitut && (
                            <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                              <ArrowLeftRight className="w-3 h-3" />
                              Substitué par : <span className="font-medium ml-0.5">{l.produitSubstitut.nom}</span>
                            </div>
                          )}
                          {l.traitePar && (
                            <div className="mt-1 text-xs text-gray-400">
                              Traité par {l.traitePar.prenom} {l.traitePar.nom}
                              {l.dateTraitement && <> · {formatDate(l.dateTraitement)}</>}
                            </div>
                          )}
                          {l.notes && <div className="mt-1 text-xs text-gray-500 italic">{l.notes}</div>}

                          {/* Actions ACTIF/EN_RETARD : livraison */}
                          {detailCredit.statut !== "EN_ATTENTE_VALIDATION" && l.statut === "EN_ATTENTE" && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "LIVRE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg font-medium">
                                <PackageCheck className="w-3 h-3" /> Livré
                              </button>
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "INDISPONIBLE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-medium">
                                <AlertCircle className="w-3 h-3" /> Indisponible
                              </button>
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "SUBSTITUE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium">
                                <ArrowLeftRight className="w-3 h-3" /> Substituer
                              </button>
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "ANNULE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium">
                                <XCircle className="w-3 h-3" /> Annuler
                              </button>
                            </div>
                          )}
                          {detailCredit.statut !== "EN_ATTENTE_VALIDATION" && (l.statut === "INDISPONIBLE" || l.statut === "SUBSTITUE") && (
                            <div className="mt-2">
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "ANNULE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium">
                                <XCircle className="w-3 h-3" /> Annuler
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucune ligne — ajoutez des produits.</p>
                  )}
                </div>

                {/* Échéancier */}
                {detailCredit.echeances.length > 0 && (
                  <div>
                    <button onClick={() => setShowEcheances((v) => !v)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700">
                      <span>Échéancier ({detailCredit.echeances.length} jours)</span>
                      {showEcheances ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showEcheances && (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {detailCredit.echeances.map((e) => {
                          const retard = e.statut !== "PAYE" && new Date(e.dateEcheance) < new Date();
                          return (
                            <div key={e.id} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${retard ? "bg-red-50" : "bg-gray-50"}`}>
                              <span className="text-gray-400 w-8 text-right font-mono">#{e.numeroEcheance}</span>
                              <span className={`flex-1 ${retard ? "text-red-600" : "text-gray-600"}`}>{formatDate(e.dateEcheance)}</span>
                              <span className="font-medium text-gray-700">{formatCurrency(Number(e.montantDu))}</span>
                              <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                                e.statut === "PAYE"       ? "bg-emerald-50 text-emerald-600" :
                                e.statut === "PARTIEL"    ? "bg-blue-50 text-blue-600"       :
                                retard                    ? "bg-red-50 text-red-500"          :
                                                            "bg-amber-50 text-amber-600"
                              }`}>
                                {e.statut === "PAYE" ? "Payé" : e.statut === "PARTIEL" ? "Part." : retard ? "Retard" : "Att."}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Remboursements */}
                {detailCredit.remboursements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Remboursements ({detailCredit.remboursements.length})
                    </p>
                    <div className="space-y-1">
                      {detailCredit.remboursements.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 bg-emerald-50 rounded-lg px-3 py-2 text-xs">
                          <span className="text-gray-500 flex-1">{formatDate(r.dateRemboursement)}</span>
                          <span className="text-gray-400">{r.modePaiement.replace("_", " ")}</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(Number(r.montant))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Modal ligne action ─────────────────────────────────────────────────── */}
      {ligneActionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {ligneActionStatut === "LIVRE"        && <PackageCheck  className="w-5 h-5 text-emerald-600" />}
                {ligneActionStatut === "INDISPONIBLE" && <AlertCircle   className="w-5 h-5 text-orange-500" />}
                {ligneActionStatut === "SUBSTITUE"    && <ArrowLeftRight className="w-5 h-5 text-blue-600" />}
                {ligneActionStatut === "ANNULE"       && <XCircle       className="w-5 h-5 text-red-500" />}
                <h3 className="text-base font-bold text-gray-900">
                  {ligneActionStatut === "LIVRE"        && "Marquer comme livré"}
                  {ligneActionStatut === "INDISPONIBLE" && "Marquer comme indisponible"}
                  {ligneActionStatut === "SUBSTITUE"    && "Substituer le produit"}
                  {ligneActionStatut === "ANNULE"       && "Annuler cette ligne"}
                </h3>
              </div>
              <button onClick={() => setLigneActionOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              {ligneActionError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{ligneActionError}
                </div>
              )}

              {ligneActionStatut === "SUBSTITUE" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Produit de remplacement <span className="text-red-500">*</span>
                  </label>
                  {ligneActionProduitId ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-sm font-medium text-blue-800">
                        {ligneActionProdResults.find(p => String(p.id) === ligneActionProduitId)?.nom ?? `Produit #${ligneActionProduitId}`}
                      </span>
                      <button onClick={() => { setLigneActionProduitId(""); setLigneActionProdSearch(""); setLigneActionProdResults([]); }}
                        className="text-blue-400 hover:text-blue-600 ml-2"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={ligneActionProdSearch}
                        onChange={(e) => setLigneActionProdSearch(e.target.value)}
                        placeholder="Rechercher un produit…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                      {(ligneActionProdLoading || ligneActionProdResults.length > 0) && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {ligneActionProdLoading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400">
                              <Loader2 className="w-4 h-4 animate-spin" /> Recherche…
                            </div>
                          ) : ligneActionProdResults.map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { setLigneActionProduitId(String(p.id)); setLigneActionProdSearch(p.nom); setLigneActionProdResults([]); }}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
                              <span className="font-medium text-gray-800">{p.nom}</span>
                              {p.reference && <span className="ml-2 text-xs text-gray-400 font-mono">{p.reference}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optionnel)</label>
                <textarea rows={2} value={ligneActionNotes} onChange={(e) => setLigneActionNotes(e.target.value)}
                  placeholder="Raison, remarques…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setLigneActionOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleLigneAction}
                disabled={ligneActionLoading || (ligneActionStatut === "SUBSTITUE" && !ligneActionProduitId)}
                className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${
                  ligneActionStatut === "LIVRE"        ? "bg-emerald-600 hover:bg-emerald-700" :
                  ligneActionStatut === "INDISPONIBLE" ? "bg-orange-500 hover:bg-orange-600"  :
                  ligneActionStatut === "SUBSTITUE"    ? "bg-blue-600   hover:bg-blue-700"    :
                                                         "bg-red-500    hover:bg-red-600"
                }`}>
                {ligneActionLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Traitement…</>
                  : <>Confirmer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {factureId !== null && (
        <FactureModal creditClientId={factureId} onClose={() => setFactureId(null)} />
      )}

      {showNouveauCredit && (
        <NouveauCreditModal
          onClose={() => setShowNouveauCredit(false)}
          onSuccess={() => { setShowNouveauCredit(false); refetch(); }}
        />
      )}

      {/* ── Modal refus ────────────────────────────────────────────────────────── */}
      {refuserOpen && detailCredit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-gray-900">Refuser la demande</h3>
              </div>
              <button onClick={() => setRefuserOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                La demande <span className="font-semibold">{detailCredit.reference}</span> sera annulée et le demandeur sera notifié.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motif du refus (optionnel)</label>
                <textarea
                  rows={3}
                  value={refuserMotif}
                  onChange={(e) => setRefuserMotif(e.target.value)}
                  placeholder="Expliquez la raison du refus…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-gray-50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setRefuserOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleRefuserCredit} disabled={refuserLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50">
                {refuserLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal encaissement remboursement ───────────────────────────────────── */}
      {rembOpen && detailCredit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">Encaisser un remboursement</h3>
              </div>
              <button onClick={() => setRembOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Crédit</span>
                <span className="font-semibold text-gray-900">{detailCredit.reference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Client</span>
                <span className="font-medium text-gray-900">{detailCredit.client.prenom} {detailCredit.client.nom}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Solde restant</span>
                <span className="font-semibold text-rose-600">{formatCurrency(Number(detailCredit.soldeRestant))}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Montant à encaisser (FCFA)</label>
                <input
                  type="number" min="1" max={Number(detailCredit.soldeRestant)}
                  value={rembMontant}
                  onChange={(e) => setRembMontant(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                />
                <p className="text-xs text-gray-400 mt-1">Au-delà du solde, le surplus est ignoré (plafonné au solde restant).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mode de paiement</label>
                <select
                  value={rembMode}
                  onChange={(e) => setRembMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="CHEQUE">Chèque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optionnel)</label>
                <textarea
                  rows={2}
                  value={rembNotes}
                  onChange={(e) => setRembNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-gray-50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setRembOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleEncaisser} disabled={rembLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium disabled:opacity-50">
                {rembLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Encaisser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ajout / édition ligne ────────────────────────────────────────── */}
      {ligneEditOpen && detailCredit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {ligneEditId ? "Modifier la ligne" : "Ajouter une ligne"}
              </h3>
              <button onClick={() => setLigneEditOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {ligneEditError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{ligneEditError}
                </div>
              )}

              {/* Type catalogue / nouveau */}
              <div className="flex gap-2">
                {(["catalogue", "nouveau"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setLigneEditType(t); setLigneEditProdId(""); setLigneEditProdNom(""); setLigneEditProdSearch(""); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      ligneEditType === t ? (t === "catalogue" ? "bg-indigo-600 text-white" : "bg-purple-600 text-white") : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t === "catalogue" ? "Catalogue" : "Nouveau produit"}
                  </button>
                ))}
              </div>

              {/* Produit */}
              {ligneEditType === "catalogue" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Produit *</label>
                  {ligneEditProdId ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <span className="text-sm font-medium text-indigo-800">{ligneEditProdNom}</span>
                      <button onClick={() => { setLigneEditProdId(""); setLigneEditProdNom(""); setLigneEditProdSearch(""); }}
                        className="text-indigo-400 hover:text-indigo-600 ml-2"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={ligneEditProdSearch}
                        onChange={(e) => setLigneEditProdSearch(e.target.value)}
                        placeholder="Rechercher…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      />
                      {(ligneEditProdLoading || ligneEditProdResults.length > 0) && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {ligneEditProdLoading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400">
                              <Loader2 className="w-4 h-4 animate-spin" /> Recherche…
                            </div>
                          ) : ligneEditProdResults.map((p) => (
                            <button key={p.id} type="button"
                              onClick={() => {
                                setLigneEditProdId(String(p.id));
                                setLigneEditProdNom(p.nom);
                                setLigneEditProdSearch(p.nom);
                                setLigneEditProdResults([]);
                                if (p.prixVente) setLigneEditPrix(String(Number(p.prixVente)));
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm border-b border-gray-50 last:border-0">
                              <span className="font-medium text-gray-800">{p.nom}</span>
                              {p.reference && <span className="ml-2 text-xs text-gray-400 font-mono">{p.reference}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom du produit *</label>
                  <input type="text" value={ligneEditNomSaisi}
                    onChange={(e) => setLigneEditNomSaisi(e.target.value)}
                    placeholder="Nom du produit à créer…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantité *</label>
                  <input type="number" value={ligneEditQuantite}
                    onChange={(e) => setLigneEditQuantite(e.target.value)}
                    min={1} placeholder="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix unitaire (FCFA)</label>
                  <input type="number" value={ligneEditPrix}
                    onChange={(e) => setLigneEditPrix(e.target.value)}
                    min={0} placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
              </div>

              {ligneEditQuantite && ligneEditPrix && (
                <p className="text-xs text-right text-gray-500">
                  Sous-total : <span className="font-semibold text-gray-700">
                    {formatCurrency(Number(ligneEditQuantite) * Number(ligneEditPrix))}
                  </span>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setLigneEditOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleSaveLigne} disabled={ligneEditLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium disabled:opacity-50">
                {ligneEditLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {ligneEditId ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

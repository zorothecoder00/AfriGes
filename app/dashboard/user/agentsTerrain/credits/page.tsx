"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  CreditCard, RefreshCw, AlertCircle, Loader2, Package,
  Plus, Trash2, ChevronDown, ChevronUp, User, Calendar,
  Clock, CheckCircle, AlertTriangle, X, Search, Receipt,
  PackageCheck, Banknote, FolderTree,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import FactureModal from "@/components/FactureModal";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type StatutCredit = "EN_ATTENTE_VALIDATION" | "ACTIF" | "EN_RETARD" | "SOLDE" | "ANNULE";

interface LigneCreditItem {
  id: number;
  produitNom: string | null;
  produitNomSaisi: string | null;
  quantite: number;
  prixUnitaire: number;
  statut: "EN_ATTENTE" | "LIVRE" | "INDISPONIBLE" | "SUBSTITUE" | "ANNULE";
  estNouveauProduit: boolean;
}

interface CreditItem {
  id: number;
  reference: string;
  statut: StatutCredit;
  montantTotal: number;
  montantRembourse: number;
  soldeRestant: number;
  montantJournalier: number;
  dateEcheanceFin: string;
  createdAt: string;
  client: { id: number; nom: string; prenom: string; telephone: string };
  lignes: LigneCreditItem[];
}

interface CreditsResponse {
  credits: CreditItem[];
  stats: {
    total: number;
    enAttente: number;
    actifs: number;
    enRetard: number;
    clos: number;
  };
}

interface ClientOption {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
}

interface ProduitOption {
  id: number;
  nom: string;
  reference: string;
  unite: string | null;
  prixUnitaire: number;
}

interface NouveauCreditForm {
  clientId: string;
  dureeJours: string;
  dateDebut: string;
  garantie: string;
  observations: string;
  lignes: { produitId: string; produitNomSaisi: string; quantite: string; prixUnitaire: string; remise: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutCredit, { label: string; cls: string }> = {
  EN_ATTENTE_VALIDATION: { label: "En attente",  cls: "bg-amber-100 text-amber-800" },
  ACTIF:                 { label: "Actif",        cls: "bg-green-100 text-green-800" },
  EN_RETARD:             { label: "En retard",    cls: "bg-red-100 text-red-800" },
  SOLDE:                 { label: "Soldé",        cls: "bg-gray-100 text-gray-700" },
  ANNULE:                { label: "Annulé",       cls: "bg-gray-100 text-gray-500" },
};

const LIGNE_STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
  EN_ATTENTE:  { label: "En attente",  cls: "bg-amber-100 text-amber-800" },
  LIVRE:       { label: "Livré",       cls: "bg-green-100 text-green-800" },
  INDISPONIBLE:{ label: "Indisponible",cls: "bg-red-100 text-red-800" },
  SUBSTITUE:   { label: "Substitué",  cls: "bg-blue-100 text-blue-800" },
  ANNULE:      { label: "Annulé",     cls: "bg-gray-100 text-gray-500" },
};

// ─── Carte crédit ───────────────────────────────────────────────────────────────

function CreditCard_({
  credit,
  onFacture,
  onLivrer,
  onRembourser,
  loadingLigneId,
}: {
  credit: CreditItem;
  onFacture: (id: number) => void;
  onLivrer: (creditId: number, ligneId: number) => void;
  onRembourser: (credit: CreditItem) => void;
  loadingLigneId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUT_CONFIG[credit.statut] ?? STATUT_CONFIG.ACTIF;
  const progressPct = credit.montantTotal > 0
    ? Math.round((credit.montantRembourse / credit.montantTotal) * 100)
    : 0;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${
      credit.statut === "EN_RETARD" ? "border-red-200" :
      credit.statut === "EN_ATTENTE_VALIDATION" ? "border-amber-200" :
      "border-gray-100"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-gray-900 text-sm">{credit.reference}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <User size={11} />
            <a href={`/dashboard/user/agentsTerrain/clients/${credit.client.id}`}
              className="text-emerald-600 hover:underline font-medium">
              {credit.client.prenom} {credit.client.nom}
            </a>
            <span className="text-gray-300 mx-1">·</span>
            <span>{credit.client.telephone}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">{formatCurrency(credit.montantTotal)}</p>
          {credit.statut !== "EN_ATTENTE_VALIDATION" && (
            <p className="text-xs text-gray-500">
              Reste : <span className="font-semibold text-red-600">{formatCurrency(credit.soldeRestant)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Infos supplémentaires */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar size={11} className="text-gray-400" />
          <span>Créé le {formatDate(credit.createdAt)}</span>
        </div>
        {credit.statut !== "EN_ATTENTE_VALIDATION" && (
          <div className="flex items-center gap-1">
            <Clock size={11} className="text-gray-400" />
            <span>Échéance : {formatDate(credit.dateEcheanceFin)}</span>
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {credit.statut !== "EN_ATTENTE_VALIDATION" && credit.montantTotal > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Remboursement</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                credit.statut === "EN_RETARD" ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Lignes */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {credit.lignes.length} produit(s)
        {credit.lignes.some((l) => l.statut === "EN_ATTENTE") && (credit.statut === "ACTIF" || credit.statut === "EN_RETARD") && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
            {credit.lignes.filter((l) => l.statut === "EN_ATTENTE").length} à livrer
          </span>
        )}
      </button>

      {open && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          {credit.lignes.map((l) => {
            const ls = LIGNE_STATUT_CONFIG[l.statut] ?? LIGNE_STATUT_CONFIG.EN_ATTENTE;
            const canLivrer = l.statut === "EN_ATTENTE" && (credit.statut === "ACTIF" || credit.statut === "EN_RETARD");
            return (
              <div key={l.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">
                    {l.produitNom ?? l.produitNomSaisi ?? "—"} × {l.quantite}
                    {l.estNouveauProduit && <span className="ml-1 text-purple-600">(hors cat.)</span>}
                  </p>
                </div>
                <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs ${ls.cls}`}>{ls.label}</span>
                {canLivrer && (
                  <button
                    onClick={() => onLivrer(credit.id, l.id)}
                    disabled={loadingLigneId === l.id}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {loadingLigneId === l.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <PackageCheck size={11} />}
                    Livré
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      {(credit.statut === "ACTIF" || credit.statut === "EN_RETARD") && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => onRembourser(credit)}
            className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
          >
            <Banknote size={13} /> Enregistrer remboursement
          </button>
          <span className="text-gray-200">|</span>
          <button
            onClick={() => onFacture(credit.id)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Receipt size={13} /> Facture
          </button>
        </div>
      )}
      {credit.statut === "SOLDE" && (
        <button
          onClick={() => onFacture(credit.id)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium pt-1"
        >
          <Receipt size={13} /> Voir la facture
        </button>
      )}
    </div>
  );
}

// ─── Modal remboursement ────────────────────────────────────────────────────────

function RembourserModal({
  credit,
  onClose,
  onSuccess,
}: {
  credit: CreditItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [montant,       setMontant]       = useState("");
  const [modePaiement,  setModePaiement]  = useState("ESPECES");
  const [notes,         setNotes]         = useState("");
  const [dateCollecte,  setDateCollecte]  = useState(new Date().toISOString().slice(0, 10));
  const [numeroJour,    setNumeroJour]    = useState("");
  const [loading,       setLoading]       = useState(false);

  const solde = credit.soldeRestant;
  // Nombre de jours dérivé (montantJournalier = montantTotal / dureeJours)
  const nbJours = credit.montantJournalier > 0 ? Math.round(credit.montantTotal / credit.montantJournalier) : 0;

  const handleSubmit = async () => {
    const m = parseFloat(montant);
    if (!m || m <= 0) return toast.error("Montant invalide");
    if (m > solde + 0.01) return toast.error(`Montant supérieur au solde restant (${formatCurrency(solde)})`);

    setLoading(true);
    try {
      const res = await fetch(`/api/agentTerrain/credits/${credit.id}/rembourser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: m, modePaiement,
          observation: notes || undefined,
          numeroJour: numeroJour || undefined,
          dateCollecte: dateCollecte || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Remboursement enregistré — en attente de confirmation caissier");
        onSuccess();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Remboursement</h2>
            <p className="text-xs text-gray-500">{credit.reference} — {credit.client.prenom} {credit.client.nom}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Solde info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
            <span className="text-gray-500">Solde restant</span>
            <span className="font-bold text-red-600">{formatCurrency(solde)}</span>
          </div>

          {/* Date de collecte + N° de jour */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de collecte</label>
              <input type="date" value={dateCollecte} onChange={(e) => setDateCollecte(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">N° de jour</label>
              <select value={numeroJour} onChange={(e) => setNumeroJour(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">—</option>
                {Array.from({ length: nbJours }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>Jour {j}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Montant attendu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant attendu</label>
            <input type="text" readOnly value={formatCurrency(credit.montantJournalier)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-500" />
            <p className="text-[11px] text-gray-400 mt-1">Montant journalier indicatif — l&apos;échéance exacte du jour est recalculée à l&apos;enregistrement.</p>
          </div>

          {/* Montant encaissé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant encaissé *</label>
            <input
              type="number" min={1} max={solde} placeholder="0"
              value={montant} onChange={(e) => setMontant(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          {/* Mode paiement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mode de paiement</label>
            <select
              value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
            </select>
          </div>

          {/* Observation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Observation (optionnel)</label>
            <input
              type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Commentaire sur la collecte…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={handleSubmit} disabled={loading}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Banknote size={15} />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal nouvelle demande ─────────────────────────────────────────────────────

function NouveauCreditModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: initData } = useApi<{
    clients: ClientOption[];
    produitsDispo: (ProduitOption & { quantite: number })[];
  }>("/api/agentTerrain/credits/init");

  const [form, setForm] = useState<NouveauCreditForm>({
    clientId: "",
    dureeJours: "30",
    dateDebut: new Date().toISOString().slice(0, 10),
    garantie: "",
    observations: "",
    lignes: [{ produitId: "", produitNomSaisi: "", quantite: "1", prixUnitaire: "", remise: "0" }],
  });
  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const clients  = initData?.clients ?? [];
  const produits = initData?.produitsDispo ?? [];

  const filteredClients = clients.filter((c) =>
    `${c.prenom} ${c.nom} ${c.telephone}`.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const montantTotal = form.lignes.reduce((s, l) => {
    const qte = Number(l.quantite) || 0;
    const pu  = Number(l.prixUnitaire) || 0;
    const rem = Number(l.remise) || 0;
    return s + Math.max(0, qte * pu - rem);
  }, 0);

  const setLigne = (i: number, field: string, val: string) => {
    setForm((f) => {
      const lignes = [...f.lignes];
      lignes[i] = { ...lignes[i], [field]: val };
      if (field === "produitId" && val) {
        const p = produits.find((p) => p.id === Number(val));
        if (p) lignes[i].produitNomSaisi = p.nom;
        if (p) lignes[i].prixUnitaire    = String(p.prixUnitaire);
      }
      return { ...f, lignes };
    });
  };

  const addLigne    = () => setForm((f) => ({ ...f, lignes: [...f.lignes, { produitId: "", produitNomSaisi: "", quantite: "1", prixUnitaire: "", remise: "0" }] }));
  const removeLigne = (i: number) => setForm((f) => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) }));

  const handleSubmit = async () => {
    if (!form.clientId) return toast.error("Sélectionnez un client");
    if (form.lignes.some((l) => !l.produitNomSaisi.trim())) return toast.error("Nom requis pour chaque produit");
    if (form.lignes.some((l) => !Number(l.prixUnitaire) || Number(l.prixUnitaire) <= 0)) return toast.error("Prix unitaire invalide");
    if (montantTotal <= 0) return toast.error("Le montant total doit être > 0");

    setLoading(true);
    try {
      const res = await fetch("/api/agentTerrain/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId:     Number(form.clientId),
          dureeJours:   Number(form.dureeJours),
          dateDebut:    form.dateDebut,
          garantie:     form.garantie || undefined,
          observations: form.observations || undefined,
          lignes: form.lignes.map((l) => ({
            produitId:      l.produitId ? Number(l.produitId) : undefined,
            produitNomSaisi: l.produitNomSaisi.trim(),
            quantite:       Number(l.quantite),
            prixUnitaire:   Number(l.prixUnitaire),
            remise:         Number(l.remise) || 0,
          })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Demande de crédit soumise — en attente de validation RVC");
        onSuccess();
      } else {
        toast.error(json.error ?? "Erreur lors de la soumission");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-900">Nouvelle demande de crédit</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Client *</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Rechercher un client…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              size={4}
            >
              <option value="">-- Sélectionner --</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom} — {c.telephone}
                </option>
              ))}
            </select>
          </div>

          {/* Durée + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Durée (jours) *</label>
              <input
                type="number" min={1} value={form.dureeJours}
                onChange={(e) => setForm((f) => ({ ...f, dureeJours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début *</label>
              <input
                type="date" value={form.dateDebut}
                onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Garantie + Observations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Garantie</label>
              <input
                type="text" value={form.garantie} placeholder="ex. : titre foncier, caution…"
                onChange={(e) => setForm((f) => ({ ...f, garantie: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Observations</label>
              <input
                type="text" value={form.observations}
                onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Lignes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Produits *</label>
              <button onClick={addLigne} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <div className="space-y-3">
              {form.lignes.map((l, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={l.produitId}
                        onChange={(e) => setLigne(i, "produitId", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Hors catalogue (saisie libre)</option>
                        {produits.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nom} — {p.reference} (dispo : {p.quantite})
                          </option>
                        ))}
                      </select>
                    </div>
                    {form.lignes.length > 1 && (
                      <button onClick={() => removeLigne(i)} className="p-1.5 text-red-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text" placeholder="Nom du produit *" value={l.produitNomSaisi}
                        onChange={(e) => setLigne(i, "produitNomSaisi", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <input
                      type="number" placeholder="Qté" min={1} value={l.quantite}
                      onChange={(e) => setLigne(i, "quantite", e.target.value)}
                      className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="number" placeholder="Prix u." min={0} value={l.prixUnitaire}
                      onChange={(e) => setLigne(i, "prixUnitaire", e.target.value)}
                      className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
            <span className="text-sm font-semibold text-indigo-800">Montant total estimé</span>
            <span className="text-lg font-bold text-indigo-900">{formatCurrency(montantTotal)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              Soumettre la demande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

const FILTRES: { key: string; label: string }[] = [
  { key: "all",                  label: "Tous"          },
  { key: "EN_ATTENTE_VALIDATION",label: "En attente"    },
  { key: "ACTIF",                label: "Actifs"        },
  { key: "EN_RETARD",            label: "En retard"     },
  { key: "SOLDE",                label: "Soldés"        },
];

export default function AgentTerrainCreditsPage() {
  const [filtre,        setFiltre]        = useState("all");
  const [refreshKey,    setRefreshKey]    = useState(0);
  const [showModal,     setShowModal]     = useState(false);
  const [factureId,     setFactureId]     = useState<number | null>(null);
  const [rembourserCredit, setRembourserCredit] = useState<CreditItem | null>(null);
  const [loadingLigneId,   setLoadingLigneId]   = useState<number | null>(null);

  const url = `/api/agentTerrain/credits?mode=full${filtre !== "all" ? `&statut=${filtre}` : ""}&_k=${refreshKey}`;
  const { data, loading, error } = useApi<CreditsResponse>(url);

  const credits = data?.credits ?? [];
  const stats   = data?.stats;

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleLivrer = useCallback(async (creditId: number, ligneId: number) => {
    setLoadingLigneId(ligneId);
    try {
      const res  = await fetch(`/api/agentTerrain/credits/${creditId}/lignes/${ligneId}`, { method: "PATCH" });
      const json = await res.json();
      if (res.ok) {
        toast.success("Livraison confirmée");
        handleRefresh();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally {
      setLoadingLigneId(null);
    }
  }, [handleRefresh]);

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
                <h1 className="text-base font-bold text-gray-900">Demandes de crédit</h1>
                <p className="text-xs text-gray-500">Agent de terrain</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="/dashboard/user/agentsTerrain/credits/saisie-rapide"
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50">
                <Banknote size={15} /> Saisie rapide
              </a>
              <a href="/dashboard/user/agentsTerrain/archivage"
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                <FolderTree size={15} /> Archivage
              </a>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Plus size={15} /> Nouvelle demande
              </button>
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total",       value: stats.total,    icon: CreditCard,    cls: "text-gray-700" },
              { label: "En attente",  value: stats.enAttente,icon: Clock,         cls: "text-amber-600" },
              { label: "En retard",   value: stats.enRetard, icon: AlertTriangle, cls: "text-red-600"  },
              { label: "Soldés",      value: stats.clos,     icon: CheckCircle,   cls: "text-green-600"},
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                <Icon size={16} className={`mx-auto mb-1 ${cls}`} />
                <p className={`text-xl font-bold ${cls}`}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto">
          {FILTRES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltre(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filtre === key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={handleRefresh}
            className="ml-auto p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
          </div>
        )}

        {/* Erreur */}
        {error && !loading && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Liste */}
        {!loading && !error && credits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package size={48} className="mb-3 opacity-30" />
            <p className="text-base font-medium">Aucune demande de crédit</p>
            <p className="text-sm mt-1">Cliquez sur &ldquo;Nouvelle demande&rdquo; pour en créer une.</p>
          </div>
        )}

        {!loading && !error && credits.length > 0 && (
          <div className="space-y-4">
            {credits.map((c) => (
              <CreditCard_
                key={c.id}
                credit={c}
                onFacture={setFactureId}
                onLivrer={handleLivrer}
                onRembourser={setRembourserCredit}
                loadingLigneId={loadingLigneId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <NouveauCreditModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); handleRefresh(); }}
        />
      )}
      {factureId !== null && (
        <FactureModal creditClientId={factureId} onClose={() => setFactureId(null)} />
      )}
      {rembourserCredit !== null && (
        <RembourserModal
          credit={rembourserCredit}
          onClose={() => setRembourserCredit(null)}
          onSuccess={() => { setRembourserCredit(null); handleRefresh(); }}
        />
      )}
    </div>
  );
}

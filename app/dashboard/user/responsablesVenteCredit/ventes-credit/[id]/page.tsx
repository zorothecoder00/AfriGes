"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  CheckCircle, XCircle, AlertCircle, Loader2, Package,
  Trash2, Plus, ArrowLeftRight, Send, Edit3, CreditCard,
  User, MapPin, Save, X, AlertTriangle, ChevronLeft,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LigneDetail {
  id: number;
  produitId: number | null;
  produitNom: string | null;
  unite: string | null;
  prixUnitaire: number;
  quantite: number;
  montant: number;
  horscatalogue: boolean;
}

interface ProduitCatalogue {
  id: number;
  nom: string;
  unite: string | null;
  prixUnitaire: number;
  stock: number;
}

interface VenteDetail {
  id: number;
  reference: string;
  statut: string;
  montantTotal: number;
  notes: string | null;
  createdAt: string;
  vendeur: { id: number; nom: string; prenom: string } | null;
  pointDeVente: { id: number; nom: string } | null;
  client: { id: number; nom: string; prenom: string; telephone: string | null } | null;
  clientNom: string | null;
  creditClient: {
    id: number;
    reference: string;
    statut: string;
    montantTotal: number;
    montantConsomme: number;
    soldeDisponible: number;
    dureeJours: number;
    dateDebut: string;
  } | null;
  lignes: LigneDetail[];
}

interface ApiDetailResponse {
  data: VenteDetail;
  produitsCatalogue: ProduitCatalogue[];
  editable: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statutBadge(s: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    CREDIT_REQUEST:      { bg: "bg-yellow-100", text: "text-yellow-800", label: "En attente" },
    CREDIT_APPROUVE:     { bg: "bg-blue-100",   text: "text-blue-800",   label: "Approuvé" },
    CREDIT_REFUSE:       { bg: "bg-red-100",    text: "text-red-800",    label: "Refusé" },
    CREDIT_EN_LIVRAISON: { bg: "bg-orange-100", text: "text-orange-800", label: "En livraison" },
    CREDIT_LIVRE:        { bg: "bg-green-100",  text: "text-green-800",  label: "Livré" },
  };
  const s2 = map[s] ?? { bg: "bg-gray-100", text: "text-gray-700", label: s };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s2.bg} ${s2.text}`}>
      {s2.label}
    </span>
  );
}

// ─── Modal : Ajouter une ligne ─────────────────────────────────────────────────

interface AddLigneModalProps {
  venteId: number;
  produits: ProduitCatalogue[];
  onClose: () => void;
  onAdded: () => void;
}

function AddLigneModal({ venteId, produits, onClose, onAdded }: AddLigneModalProps) {
  const [mode,       setMode]       = useState<"catalogue" | "horsCatalogue">("catalogue");
  const [produitId,  setProduitId]  = useState<string>("");
  const [produitNom, setProduitNom] = useState("");
  const [quantite,   setQuantite]   = useState("1");
  const [prix,       setPrix]       = useState("");
  const [loading,    setLoading]    = useState(false);

  const produitSel = produits.find((p) => p.id === Number(produitId));

  useEffect(() => {
    if (produitSel) setPrix(String(produitSel.prixUnitaire));
  }, [produitSel]);

  const handleAjouter = useCallback(async () => {
    if (mode === "catalogue" && !produitId) return;
    if (mode === "horsCatalogue" && (!produitNom.trim() || !prix)) return;
    setLoading(true);
    try {
      const body = mode === "catalogue"
        ? { produitId: Number(produitId), quantite: Number(quantite), prixUnitaire: prix ? Number(prix) : undefined }
        : { produitNom: produitNom.trim(), quantite: Number(quantite), prixUnitaire: Number(prix) };

      const res  = await fetch(`/api/rvc/ventes-credit/${venteId}/lignes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Ligne ajoutée");
        onAdded();
        onClose();
      } else {
        toast.error(json.error ?? "Erreur lors de l'ajout");
      }
    } finally {
      setLoading(false);
    }
  }, [mode, produitId, produitNom, quantite, prix, venteId, onAdded, onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Plus size={20} className="text-blue-600" />
            Ajouter une ligne
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Toggle mode */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setMode("catalogue")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "catalogue" ? "bg-white shadow text-gray-900" : "text-gray-600"
              }`}
            >
              Produit catalogue
            </button>
            <button
              onClick={() => setMode("horsCatalogue")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "horsCatalogue" ? "bg-white shadow text-gray-900" : "text-gray-600"
              }`}
            >
              Hors catalogue
            </button>
          </div>

          {/* Catalogue */}
          {mode === "catalogue" && (
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Produit <span className="text-red-500">*</span></label>
              <select
                value={produitId}
                onChange={(e) => setProduitId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un produit…</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} — stock : {p.stock}{p.unite ? ` ${p.unite}` : ""} — {formatCurrency(p.prixUnitaire)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hors catalogue */}
          {mode === "horsCatalogue" && (
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Nom du produit <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={produitNom}
                onChange={(e) => setProduitNom(e.target.value)}
                placeholder="Ex : Sac de riz 50kg"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Quantité + Prix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Quantité <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="1"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">
                Prix unitaire (FCFA) {mode === "horsCatalogue" && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                min="0"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                placeholder={mode === "catalogue" ? "Catalogue" : "Obligatoire"}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Total estimé */}
          {quantite && prix && (
            <p className="text-sm font-semibold text-gray-700">
              Total : {formatCurrency(Number(quantite) * Number(prix))}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={handleAjouter}
            disabled={loading || (mode === "catalogue" && !produitId) || (mode === "horsCatalogue" && (!produitNom.trim() || !prix))}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal : Substituer un produit hors-catalogue ──────────────────────────────

interface SubstituerModalProps {
  ligne: LigneDetail;
  produits: ProduitCatalogue[];
  venteId: number;
  onClose: () => void;
  onSubstituted: () => void;
}

function SubstituerModal({ ligne, produits, venteId, onClose, onSubstituted }: SubstituerModalProps) {
  const [produitId, setProduitId] = useState("");
  const [loading,   setLoading]   = useState(false);

  const produitSel = produits.find((p) => p.id === Number(produitId));

  const handleSubmit = useCallback(async () => {
    if (!produitId) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/rvc/ventes-credit/${venteId}/lignes/${ligne.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ produitId: Number(produitId) }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Produit substitué avec succès");
        onSubstituted();
        onClose();
      } else {
        toast.error(json.error ?? "Erreur lors de la substitution");
      }
    } finally {
      setLoading(false);
    }
  }, [produitId, venteId, ligne.id, onSubstituted, onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-blue-600" />
            Substituer le produit
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm">
            <p className="text-xs text-purple-500 font-medium mb-0.5">Produit hors catalogue</p>
            <p className="font-semibold text-purple-800">{ligne.produitNom}</p>
            <p className="text-xs text-purple-600">× {ligne.quantite} · {formatCurrency(ligne.montant)}</p>
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">
              Remplacer par (catalogue) <span className="text-red-500">*</span>
            </label>
            <select
              value={produitId}
              onChange={(e) => setProduitId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner…</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock < ligne.quantite}>
                  {p.nom} — stock : {p.stock}{p.unite ? ` ${p.unite}` : ""}{p.stock < ligne.quantite ? " (insuffisant)" : ""}
                </option>
              ))}
            </select>
          </div>

          {produitSel && (
            <div className="text-sm text-gray-600">
              Prix catalogue : <span className="font-semibold">{formatCurrency(produitSel.prixUnitaire)}</span>
              {" · "}Nouveau total ligne : <span className="font-semibold">{formatCurrency(produitSel.prixUnitaire * ligne.quantite)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !produitId}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
            Substituer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal : Demande de création produit ───────────────────────────────────────

interface DemandeProduitModalProps {
  ligne: LigneDetail;
  venteId: number;
  onClose: () => void;
}

function DemandeProduitModal({ ligne, venteId, onClose }: DemandeProduitModalProps) {
  const [description, setDescription] = useState("");
  const [unite,       setUnite]       = useState("");
  const [prixEstime,  setPrixEstime]  = useState(String(ligne.prixUnitaire));
  const [loading,     setLoading]     = useState(false);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/rvc/ventes-credit/${venteId}/lignes/${ligne.id}/demande-produit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          description: description.trim() || undefined,
          unite:       unite.trim() || undefined,
          prixEstime:  prixEstime ? Number(prixEstime) : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Demande envoyée aux administrateurs");
        onClose();
      } else {
        toast.error(json.error ?? "Erreur lors de l'envoi");
      }
    } finally {
      setLoading(false);
    }
  }, [venteId, ligne.id, description, unite, prixEstime, onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Send size={20} className="text-purple-600" />
            Demande de création produit
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
            <p className="text-xs text-purple-500 font-medium mb-0.5">Produit à créer</p>
            <p className="font-semibold text-purple-800">{ligne.produitNom}</p>
          </div>
          <p className="text-sm text-gray-600">
            Les administrateurs seront notifiés pour créer ce produit dans le catalogue. Une fois créé, vous pourrez substituer cette ligne.
          </p>
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Description (optionnel)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Caractéristiques, marque, conditionnement…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Unité</label>
              <input
                type="text"
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                placeholder="kg, pièce, litre…"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Prix estimé (FCFA)</label>
              <input
                type="number"
                value={prixEstime}
                onChange={(e) => setPrixEstime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ligne éditable ────────────────────────────────────────────────────────────

interface EditableLigneProps {
  ligne: LigneDetail;
  venteId: number;
  produits: ProduitCatalogue[];
  onUpdated: () => void;
  onDelete: () => void;
}

function EditableLigne({ ligne, venteId, produits, onUpdated, onDelete }: EditableLigneProps) {
  const [editMode,    setEditMode]    = useState(false);
  const [quantite,    setQuantite]    = useState(String(ligne.quantite));
  const [prix,        setPrix]        = useState(String(ligne.prixUnitaire));
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [substituerModal, setSubstituerModal] = useState(false);
  const [demandeModal,    setDemandeModal]    = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res  = await fetch(`/api/rvc/ventes-credit/${venteId}/lignes/${ligne.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          quantite:    Number(quantite),
          prixUnitaire: Number(prix),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Ligne mise à jour");
        onUpdated();
        setEditMode(false);
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally {
      setSaving(false);
    }
  }, [venteId, ligne.id, quantite, prix, onUpdated]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/rvc/ventes-credit/${venteId}/lignes/${ligne.id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok) {
        toast.success("Ligne supprimée");
        onDelete();
      } else {
        toast.error(json.error ?? "Erreur lors de la suppression");
      }
    } finally {
      setDeleting(false);
    }
  }, [venteId, ligne.id, onDelete]);

  return (
    <>
      <div className={`border rounded-xl p-4 transition-colors ${
        ligne.horscatalogue
          ? "border-purple-200 bg-purple-50"
          : "border-gray-100 bg-white"
      }`}>
        {/* Ligne info */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {ligne.horscatalogue && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800">
                Hors catalogue
              </span>
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{ligne.produitNom ?? "—"}</p>
              {ligne.unite && <p className="text-xs text-gray-500">{ligne.unite}</p>}
            </div>
          </div>

          {!editMode ? (
            <div className="flex items-center gap-3 flex-shrink-0 text-sm text-right">
              <div>
                <p className="text-gray-500 text-xs">Qté</p>
                <p className="font-semibold">{ligne.quantite}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">P.U.</p>
                <p className="font-semibold">{formatCurrency(ligne.prixUnitaire)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total</p>
                <p className="font-bold text-gray-900">{formatCurrency(ligne.montant)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Qté</p>
                <input
                  type="number" min="1" value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  className="w-16 px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">P.U. FCFA</p>
                <input
                  type="number" min="0" value={prix}
                  onChange={(e) => setPrix(e.target.value)}
                  className="w-24 px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {!editMode ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Edit3 size={12} /> Modifier
              </button>
              {ligne.horscatalogue && (
                <>
                  <button
                    onClick={() => setSubstituerModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <ArrowLeftRight size={12} /> Substituer
                  </button>
                  <button
                    onClick={() => setDemandeModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <Send size={12} /> Demande création
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors ml-auto"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Supprimer
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Enregistrer
              </button>
              <button
                onClick={() => { setEditMode(false); setQuantite(String(ligne.quantite)); setPrix(String(ligne.prixUnitaire)); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                <X size={12} /> Annuler
              </button>
            </>
          )}
        </div>
      </div>

      {substituerModal && (
        <SubstituerModal
          ligne={ligne}
          produits={produits}
          venteId={venteId}
          onClose={() => setSubstituerModal(false)}
          onSubstituted={onUpdated}
        />
      )}
      {demandeModal && (
        <DemandeProduitModal
          ligne={ligne}
          venteId={venteId}
          onClose={() => setDemandeModal(false)}
        />
      )}
    </>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function RVCVenteDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const venteId = Number(params.id);

  const [refreshKey,   setRefreshKey]   = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Approbation / Refus
  const [actionModal,  setActionModal]  = useState<"approuver" | "refuser" | null>(null);
  const [motif,        setMotif]        = useState("");
  const [actioning,    setActioning]    = useState(false);

  const url = `/api/rvc/ventes-credit/${venteId}?_k=${refreshKey}`;
  const { data, loading, error } = useApi<ApiDetailResponse>(url);

  const vente    = data?.data;
  const produits = data?.produitsCatalogue ?? [];
  const editable = data?.editable ?? false;

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleAction = useCallback(async () => {
    if (!actionModal || !vente) return;
    if (actionModal === "refuser" && !motif.trim()) return;
    setActioning(true);
    try {
      const endpoint = actionModal === "approuver"
        ? `/api/rvc/ventes-credit/${venteId}/approuver`
        : `/api/rvc/ventes-credit/${venteId}/refuser`;

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    actionModal === "refuser" ? JSON.stringify({ motif }) : "{}",
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(actionModal === "approuver" ? "Vente approuvée" : "Vente refusée");
        setActionModal(null);
        setMotif("");
        handleRefresh();
      } else {
        toast.error(json.error ?? "Erreur");
      }
    } finally {
      setActioning(false);
    }
  }, [actionModal, motif, venteId, vente, handleRefresh]);

  const nbHorsCat = vente?.lignes.filter((l) => l.horscatalogue).length ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !vente) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-gray-600">{error ?? "Vente introuvable"}</p>
        <Link href="/dashboard/user/responsablesVenteCredit/ventes-credit" className="text-blue-600 hover:underline text-sm">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const nomClient = vente.client
    ? `${vente.client.prenom} ${vente.client.nom}`
    : vente.clientNom ?? "—";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/user/responsablesVenteCredit/ventes-credit"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft size={20} />
              </Link>
              <div>
                <h1 className="text-base font-bold text-gray-900">{vente.reference}</h1>
                <div className="flex items-center gap-2">
                  {statutBadge(vente.statut)}
                  <p className="text-xs text-gray-500">{formatDate(vente.createdAt)}</p>
                </div>
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Infos globales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Client */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1 mb-2">
              <User size={12} /> Client
            </p>
            <p className="font-semibold text-gray-900">{nomClient}</p>
            {vente.client?.telephone && <p className="text-xs text-gray-500">{vente.client.telephone}</p>}
          </div>

          {/* PDV + Agent */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1 mb-2">
              <MapPin size={12} /> Point de vente
            </p>
            <p className="font-semibold text-gray-900">{vente.pointDeVente?.nom ?? "—"}</p>
            {vente.vendeur && (
              <p className="text-xs text-gray-500">Agent : {vente.vendeur.prenom} {vente.vendeur.nom}</p>
            )}
          </div>

          {/* Crédit */}
          {vente.creditClient && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 font-medium flex items-center gap-1 mb-2">
                <CreditCard size={12} /> Crédit client
              </p>
              <p className="text-xs text-gray-500 font-medium">{vente.creditClient.reference}</p>
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-gray-600">Total : <span className="font-semibold">{formatCurrency(vente.creditClient.montantTotal)}</span></p>
                <p className="text-xs text-gray-600">Consommé : <span className="font-semibold">{formatCurrency(vente.creditClient.montantConsomme)}</span></p>
                <p className={`text-xs font-bold ${vente.creditClient.soldeDisponible >= vente.montantTotal ? "text-green-600" : "text-red-600"}`}>
                  Disponible : {formatCurrency(vente.creditClient.soldeDisponible)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alerte hors-catalogue */}
        {nbHorsCat > 0 && editable && (
          <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl">
            <AlertTriangle size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-purple-800">{nbHorsCat} produit{nbHorsCat > 1 ? "s" : ""} hors catalogue</p>
              <p className="text-purple-600">Pour chaque produit hors catalogue, vous pouvez le substituer par un produit existant ou envoyer une demande de création aux administrateurs.</p>
            </div>
          </div>
        )}

        {/* Section lignes */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Package size={18} className="text-blue-500" />
              Articles
              <span className="text-sm font-normal text-gray-500">({vente.lignes.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(vente.montantTotal)}</p>
              {editable && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <Plus size={14} /> Ajouter
                </button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {vente.lignes.length === 0 && (
              <p className="text-center text-gray-400 py-8">Aucune ligne</p>
            )}
            {vente.lignes.map((l) =>
              editable ? (
                <EditableLigne
                  key={l.id}
                  ligne={l}
                  venteId={vente.id}
                  produits={produits}
                  onUpdated={handleRefresh}
                  onDelete={handleRefresh}
                />
              ) : (
                <div key={l.id} className={`border rounded-xl p-4 flex items-center justify-between gap-3 ${
                  l.horscatalogue ? "border-purple-200 bg-purple-50" : "border-gray-100"
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {l.horscatalogue && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800 flex-shrink-0">
                        Hors catalogue
                      </span>
                    )}
                    <span className="font-medium text-gray-900 truncate">{l.produitNom ?? "—"}</span>
                    {l.unite && <span className="text-xs text-gray-500">({l.unite})</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-shrink-0">
                    <span className="text-gray-500">× {l.quantite}</span>
                    <span className="text-gray-500">{formatCurrency(l.prixUnitaire)}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(l.montant)}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Actions approbation */}
        {editable && vente.statut === "CREDIT_REQUEST" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Décision</h3>

            {vente.creditClient && vente.creditClient.soldeDisponible < vente.montantTotal && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle size={16} />
                Solde insuffisant ({formatCurrency(vente.creditClient.soldeDisponible)} disponible vs {formatCurrency(vente.montantTotal)} demandé)
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setActionModal("approuver"); setMotif(""); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                <CheckCircle size={16} /> Approuver
              </button>
              <button
                onClick={() => { setActionModal("refuser"); setMotif(""); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                <XCircle size={16} /> Refuser
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        {vente.notes && (
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium mb-1">Notes de l&apos;agent</p>
            <p className="text-sm text-gray-700">{vente.notes}</p>
          </div>
        )}
      </div>

      {/* Modal ajout ligne */}
      {showAddModal && (
        <AddLigneModal
          venteId={vente.id}
          produits={produits}
          onClose={() => setShowAddModal(false)}
          onAdded={handleRefresh}
        />
      )}

      {/* Modal approbation / refus */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${actionModal === "approuver" ? "bg-green-50" : "bg-red-50"}`}>
                  {actionModal === "approuver"
                    ? <CheckCircle className="text-green-600" size={24} />
                    : <XCircle className="text-red-500" size={24} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {actionModal === "approuver" ? "Approuver la vente" : "Refuser la vente"}
                  </h2>
                  <p className="text-sm text-gray-500">{vente.reference} · {formatCurrency(vente.montantTotal)}</p>
                </div>
              </div>
              <button onClick={() => setActionModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium">{nomClient}</span>
                </div>
                {vente.creditClient && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Solde disponible</span>
                    <span className={`font-semibold ${vente.creditClient.soldeDisponible >= vente.montantTotal ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(vente.creditClient.soldeDisponible)}
                    </span>
                  </div>
                )}
                {nbHorsCat > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Produits hors catalogue</span>
                    <span className="font-medium text-purple-600">{nbHorsCat}</span>
                  </div>
                )}
              </div>

              {actionModal === "refuser" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Motif du refus <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    rows={3}
                    placeholder="Solde insuffisant, produits non disponibles…"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={actioning || (actionModal === "refuser" && !motif.trim())}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors ${
                  actionModal === "approuver" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {actioning ? <Loader2 size={15} className="animate-spin" /> : null}
                {actionModal === "approuver" ? "Confirmer l'approbation" : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

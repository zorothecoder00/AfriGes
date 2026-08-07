"use client";

import { useState } from "react";
import { useMutation } from "@/hooks/useApi";
import { Plus, X, Loader2, Trash2 } from "lucide-react";

interface Regle { champ: string; operateur: string; valeur: string }

const CHAMPS = [
  { value: "SEGMENT", label: "Segment client" }, { value: "TYPE_CLIENT", label: "Type client" },
  { value: "VILLE", label: "Ville" }, { value: "COMMUNE", label: "Commune" }, { value: "QUARTIER", label: "Quartier" },
  { value: "SEXE", label: "Sexe" }, { value: "POINT_DE_VENTE", label: "Point de vente (ID)" },
  { value: "MONTANT_ACHAT_TOTAL", label: "Montant total acheté" }, { value: "FREQUENCE_ACHAT", label: "Fréquence d'achat" },
  { value: "DERNIER_ACHAT_JOURS", label: "Jours depuis dernier achat" }, { value: "PRODUIT_ACHETE", label: "Produit acheté (ID)" },
  { value: "FAMILLE_PRODUIT_ACHETEE", label: "Famille de produit achetée (ID)" }, { value: "STATUT_CREDIT", label: "Statut crédit" },
  { value: "NIVEAU_FIDELITE", label: "Niveau fidélité" }, { value: "TAG", label: "Tag (ID)" },
  { value: "DISTANCE_AGENCE_KM", label: "Distance à une agence (rayon)" },
  { value: "ACTIVITE", label: "Activité (B2B : revendeur, grossiste, hôtel…)" },
  { value: "AGE", label: "Âge (années)" },
  { value: "CANAL", label: "Canal déjà utilisé (code, ex SMS)" },
];
const OPERATEURS = [
  { value: "EGAL", label: "=" }, { value: "DIFFERENT", label: "≠" }, { value: "SUPERIEUR", label: ">" },
  { value: "INFERIEUR", label: "<" }, { value: "SUPERIEUR_EGAL", label: "≥" }, { value: "INFERIEUR_EGAL", label: "≤" },
  { value: "CONTIENT", label: "contient" }, { value: "DEPUIS_JOURS", label: "dans les N derniers jours" },
];

/** Formulaire de création d'audience (règles combinables §11) — partagé entre
 * le dashboard admin et le portail Responsable Marketing. */
export default function NouvelleAudienceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate: creer, loading: creating } = useMutation<{ id: number }, Record<string, unknown>>(
    "/api/admin/marketing/audiences", "POST",
    { successMessage: "Audience créée", invalidate: "/api/admin/marketing/audiences" }
  );
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"STATIQUE" | "DYNAMIQUE">("DYNAMIQUE");
  const [regles, setRegles] = useState<Regle[]>([{ champ: "VILLE", operateur: "EGAL", valeur: "" }]);

  const majRegle = (i: number, patch: Partial<Regle>) =>
    setRegles((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const reglesValides = regles.filter((r) => r.valeur.trim() !== "");
    if (!nom || reglesValides.length === 0) return;
    const res = await creer({ nom, description: description || undefined, type, regles: reglesValides });
    if (res) onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Nouvelle audience</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex : Clients inactifs 60 jours"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={type === "DYNAMIQUE"} onChange={() => setType("DYNAMIQUE")} />
              Dynamique (recalculée automatiquement)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={type === "STATIQUE"} onChange={() => setType("STATIQUE")} />
              Statique (figée à la création)
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Règles (combinées en ET)</p>
            {regles.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={r.champ} onChange={(e) => majRegle(i, { champ: e.target.value })}
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
                  {CHAMPS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select value={r.operateur} onChange={(e) => majRegle(i, { operateur: e.target.value })}
                  className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
                  {OPERATEURS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={r.valeur} onChange={(e) => majRegle(i, { valeur: e.target.value })}
                  placeholder={
                    r.champ === "DISTANCE_AGENCE_KM" ? "pdvId:rayonKm ex 3:10"
                    : r.champ === "AGE" ? "ex 25"
                    : r.champ === "CANAL" ? "ex SMS"
                    : "valeur"
                  }
                  className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                <button onClick={() => setRegles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setRegles((prev) => [...prev, { champ: "VILLE", operateur: "EGAL", valeur: "" }])}
              className="text-xs font-medium text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter une règle
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={creating || !nom} className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

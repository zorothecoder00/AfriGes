"use client";

import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OperationCaisseDispo } from "@/components/FicheDecaissementModal";

/**
 * Liste des sorties de caisse (grande caisse + petite caisse RPV) qui n'ont pas encore de fiche de
 * décaissement : la fiche vient après la sortie, on choisit ici celle à justifier / rattacher.
 * `categorie` restreint la liste (ex. "FOURNISSEUR" pour un paiement fournisseur).
 */

export const CATEGORIE_SORTIE_LABEL: Record<string, string> = {
  SALAIRE: "Salaire", AVANCE: "Avance", FOURNISSEUR: "Fournisseur", CARBURANT: "Carburant", AUTRE: "Autre",
};

export default function SortieCaissePicker({ value, onChange, categorie, montantAttendu, vide }: {
  value: OperationCaisseDispo | null;
  onChange: (o: OperationCaisseDispo) => void;
  categorie?: string;
  /** Si fourni, les sorties d'un autre montant sont grisées (ex. règlement dépôt-vente soldé en une fois). */
  montantAttendu?: number;
  /** Message quand aucune sortie n'est disponible */
  vide?: string;
}) {
  const query = new URLSearchParams({ jours: "0", limit: "100" });
  if (categorie) query.set("categorie", categorie);
  const { data, loading } = useApi<{ data: OperationCaisseDispo[] }>(`/api/decaissements/operations-disponibles?${query}`);
  const operations = data?.data ?? [];

  return (
    <div>
      {loading && <p className="text-xs text-slate-400 py-2">Chargement des sorties de caisse…</p>}
      {!loading && operations.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {vide ?? "Aucune sortie de caisse sans fiche. Enregistrez d'abord la sortie dans la caisse, puis revenez la rattacher."}
        </p>
      )}
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {operations.map((o) => {
          const actif = value?.source === o.source && value.id === o.id;
          const horsMontant = montantAttendu != null && Math.abs(o.montant - montantAttendu) > 0.01;
          return (
            <button key={`${o.source}-${o.id}`} type="button" disabled={horsMontant} onClick={() => onChange(o)}
              title={horsMontant ? "Le montant ne correspond pas au montant attendu" : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${actif ? "border-primary-400 bg-primary-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-slate-700">{o.reference}</span>
                <span className="font-semibold text-slate-800">{formatCurrency(o.montant)}</span>
              </span>
              <span className="block text-slate-500 mt-0.5">
                {o.categorie ? `${CATEGORIE_SORTIE_LABEL[o.categorie] ?? o.categorie} · ` : ""}{o.motif}
              </span>
              <span className="block text-slate-400 mt-0.5">
                {o.source === "CAISSE_PDV" ? "Petite caisse" : "Grande caisse"}{o.pointDeVente ? ` · ${o.pointDeVente.nom}` : ""} · {o.operateurNom} · {formatDateTime(o.date)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

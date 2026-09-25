"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, Stamp, Printer, PackageMinus } from "lucide-react";
import RetourLien from "@/components/RetourLien";

/**
 * Supervision des bons de sortie (CDC digitalisation §3.4) — dont ceux remplis par les agents
 * terrain — partagée par le RPV (son agence) et le chef d'agence (ses agences). Le superviseur
 * vise les bons au-delà du seuil ; l'exécution (avec ajustement des quantités) reste au magasinier.
 */

interface BonSortie {
  id: number; reference: string; typeSortie: string; statut: "BROUILLON" | "VALIDE" | "ANNULE";
  motif: string; commentaireEcart: string | null; montantTotal: string | number | null;
  viseParId: number | null; createdAt: string; dateValidation: string | null;
  creePar: { id: number; nom: string; prenom: string; gestionnaire: { role: string } | null };
  validePar: { nom: string; prenom: string } | null;
  visePar: { nom: string; prenom: string } | null;
  lignes: { id: number; quantite: number; quantiteDemandee: number | null; produit: { id: number; nom: string } }[];
  commandeClient: { reference: string; client: { nom: string; prenom: string } } | null;
  pointDeVente?: { id: number; nom: string; code: string };
}
interface PDV { id: number; nom: string; code: string }

const TYPE_LABEL: Record<string, string> = {
  PERTE: "Perte", CASSE: "Casse", DON: "Don / échantillon", CONSOMMATION_INTERNE: "Usage interne / terrain", LIVRAISON_CLIENT: "Livraison client",
};
const STATUT_CFG: Record<BonSortie["statut"], { label: string; badge: string }> = {
  BROUILLON: { label: "En attente d'exécution", badge: "bg-amber-100 text-amber-700" },
  VALIDE: { label: "Exécuté", badge: "bg-emerald-100 text-emerald-700" },
  ANNULE: { label: "Annulé", badge: "bg-red-100 text-red-700" },
};
const selectCls = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white";

export default function BonsSortieSupervision({ apiUrl, perimetre }: { apiUrl: string; perimetre: "agence" | "agences" }) {
  const [statut, setStatut] = useState("");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [origine, setOrigine] = useState("AGENT_TERRAIN");
  const [visaEnCours, setVisaEnCours] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (origine) params.set("origine", origine);
  if (pointDeVenteId) params.set("pointDeVenteId", pointDeVenteId);
  const { data, loading, refetch } = useApi<{ data: BonSortie[]; pdv?: PDV; pdvs?: PDV[]; seuilVisaBonSortie: number }>(`${apiUrl}?${params}`);
  const pdvs = data?.pdvs ?? [];
  const bons = data?.data ?? [];
  const seuil = data?.seuilVisaBonSortie ?? Infinity;

  async function viser(id: number) {
    setVisaEnCours(id);
    try {
      const r = await fetch(`/api/magasinier/bons-sortie/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "VISER" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Bon de sortie visé"); refetch(); } else toast.error(j.error ?? "Erreur");
    } finally { setVisaEnCours(null); }
  }

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <RetourLien />
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><PackageMinus className="w-6 h-6 text-indigo-600" /> Bons de sortie</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {data?.pdv ? `${data.pdv.nom} — ` : ""}sorties de marchandises de {perimetre === "agence" ? "votre agence" : "vos agences"}, dont celles demandées par les agents terrain. L&apos;exécution revient au magasinier ; vous visez les bons au-delà du seuil.
            </p>
          </div>
          <button onClick={() => refetch()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50" title="Actualiser"><RefreshCw className="w-4 h-4 text-slate-600" /></button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <select value={origine} onChange={(e) => setOrigine(e.target.value)} className={selectCls}>
            <option value="AGENT_TERRAIN">Remplis par les agents terrain</option>
            <option value="">Tous les bons</option>
          </select>
          {pdvs.length > 1 && (
            <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={selectCls}>
              <option value="">Toutes mes agences</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          )}
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={selectCls}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_CFG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </div>

        {loading && !data ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : bons.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <PackageMinus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Aucun bon de sortie sur ce filtre</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bons.map((b) => {
              const montant = Number(b.montantTotal ?? 0);
              const visaAttendu = b.statut === "BROUILLON" && montant > seuil && !b.viseParId;
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm text-slate-900">{b.reference}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_CFG[b.statut].badge}`}>{STATUT_CFG[b.statut].label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{TYPE_LABEL[b.typeSortie] ?? b.typeSortie}</span>
                        {b.creePar.gestionnaire?.role === "AGENT_TERRAIN" && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Agent terrain</span>}
                        {b.visePar && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Visé — {b.visePar.prenom} {b.visePar.nom}</span>}
                        {visaAttendu && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Visa requis</span>}
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{b.motif}</p>
                      {b.commandeClient && <p className="text-xs text-slate-500">Commande {b.commandeClient.reference} — {b.commandeClient.client.prenom} {b.commandeClient.client.nom}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {b.pointDeVente && perimetre === "agences" && `${b.pointDeVente.nom} · `}{montant.toLocaleString("fr-FR")} FCFA · rempli par {b.creePar.prenom} {b.creePar.nom} · {new Date(b.createdAt).toLocaleDateString("fr-FR")}
                        {b.validePar && ` · exécuté par ${b.validePar.prenom} ${b.validePar.nom}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {visaAttendu && (
                        <button onClick={() => viser(b.id)} disabled={visaEnCours === b.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200 disabled:opacity-50">
                          <Stamp className="w-3.5 h-3.5" /> Viser
                        </button>
                      )}
                      <a href={`/api/magasinier/bons-sortie/${b.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer className="w-4 h-4" /></a>
                    </div>
                  </div>
                  <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
                    {b.lignes.map((l) => (
                      <li key={l.id}>• {l.produit.nom} × {l.quantite}
                        {l.quantiteDemandee != null && l.quantiteDemandee !== l.quantite && <span className="text-amber-600"> (demandé : {l.quantiteDemandee})</span>}
                      </li>
                    ))}
                  </ul>
                  {b.commentaireEcart && <p className="text-xs text-amber-600 mt-1">Écart : {b.commentaireEcart}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

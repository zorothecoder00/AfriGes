"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import NouveauBonSortie, { TYPES_SORTIE_AGENT } from "@/components/agent-documents/NouveauBonSortie";
import { useApi } from "@/hooks/useApi";
import { ArrowLeft, PackageMinus, Plus, RefreshCw, Printer } from "lucide-react";

interface BonSortie {
  id: number; reference: string; typeSortie: string; statut: "BROUILLON" | "VALIDE" | "ANNULE";
  motif: string; notes: string | null; commentaireEcart: string | null; montantTotal: number | string | null;
  dateValidation: string | null; createdAt: string;
  pointDeVente: { id: number; nom: string; code: string };
  validePar: { nom: string; prenom: string } | null;
  visePar: { nom: string; prenom: string } | null;
  lignes: { id: number; quantite: number; quantiteDemandee: number | null; produit: { id: number; nom: string; reference: string | null } }[];
}

const STATUT_CFG: Record<BonSortie["statut"], { label: string; badge: string }> = {
  BROUILLON: { label: "En attente du magasinier", badge: "bg-amber-100 text-amber-700" },
  VALIDE: { label: "Exécuté", badge: "bg-emerald-100 text-emerald-700" },
  ANNULE: { label: "Annulé", badge: "bg-red-100 text-red-700" },
};

const libelleType = (t: string) => TYPES_SORTIE_AGENT.find((x) => x.value === t)?.label ?? t;

export default function BonsSortieAgentPage() {
  return (
    <Suspense fallback={null}>
      <BonsSortieAgentPageInner />
    </Suspense>
  );
}

function BonsSortieAgentPageInner() {
  // QR « Modèle » / carte Documents commerciaux : ?nouveau=1 ouvre directement le formulaire.
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(() => searchParams.get("nouveau") !== null);
  const { data, loading, refetch } = useApi<{ data: BonSortie[]; stats: { total: number; enAttente: number; executes: number; annules: number } }>("/api/agentTerrain/bons-sortie");
  const bons = data?.data ?? [];

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/agentsTerrain/documents" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Documents commerciaux</Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PackageMinus className="w-6 h-6 text-indigo-600" /> Bons de sortie
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Sorties de marchandises demandées au magasinier de votre point de vente</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4 text-slate-600" /></button>
            <a href="/api/magasinier/bons-sortie/vierge" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
              <Printer className="w-4 h-4" /> Bon vierge
            </a>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Nouveau
            </button>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "En attente", value: data.stats.enAttente, cls: "bg-amber-500" },
              { label: "Exécutés", value: data.stats.executes, cls: "bg-emerald-600" },
              { label: "Annulés", value: data.stats.annules, cls: "bg-rose-500" },
            ].map((s) => (
              <div key={s.label} className={`${s.cls} rounded-2xl p-4 text-white`}>
                <p className="text-xs text-white/80">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {loading && !data ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : bons.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <PackageMinus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Aucun bon de sortie pour l&apos;instant</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bons.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{b.reference}</p>
                    <p className="text-xs text-slate-500">{libelleType(b.typeSortie)} · {b.pointDeVente.nom} · {new Date(b.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_CFG[b.statut].badge}`}>{STATUT_CFG[b.statut].label}</span>
                    <a href={`/api/magasinier/bons-sortie/${b.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer className="w-4 h-4" /></a>
                  </div>
                </div>
                <p className="text-sm text-slate-700 mt-2">{b.motif}</p>
                <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
                  {b.lignes.map((l) => (
                    <li key={l.id}>• {l.produit.nom} × {l.quantite}
                      {l.quantiteDemandee != null && l.quantiteDemandee !== l.quantite && <span className="text-amber-600"> (demandé : {l.quantiteDemandee})</span>}
                    </li>
                  ))}
                </ul>
                {b.commentaireEcart && <p className="text-xs text-amber-600 mt-1">Écart du magasinier : {b.commentaireEcart}</p>}
                <div className="flex items-center justify-between gap-2 mt-2 text-xs text-slate-500 flex-wrap">
                  <span>{b.montantTotal != null && `Valorisation : ${Number(b.montantTotal).toLocaleString("fr-FR")} FCFA`}</span>
                  {b.statut === "VALIDE" && b.validePar && (
                    <span>Exécuté par {b.validePar.prenom} {b.validePar.nom}{b.dateValidation && ` le ${new Date(b.dateValidation).toLocaleDateString("fr-FR")}`}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <NouveauBonSortie onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

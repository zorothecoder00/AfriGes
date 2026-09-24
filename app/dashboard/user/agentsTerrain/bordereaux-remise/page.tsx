"use client";

import { useState, useEffect, Suspense } from "react";
import { PiecesListe } from "@/components/agent-documents/PiecesBordereau";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import NouveauBordereauRemise from "@/components/agent-documents/NouveauBordereauRemise";
import { useApi } from "@/hooks/useApi";
import { ArrowLeft, Wallet, Plus, X, RefreshCw, FileText, CheckCircle } from "lucide-react";

interface PersonRef { id: number; nom: string; prenom: string }
interface LigneBilletage { id: number; denomination: number; nombre: number; total: number }
interface Bordereau {
  id: number; reference: string; statut: string;
  pointDeVente: { id: number; nom: string; code: string };
  totalEspecesAttendu: number | string; totalBilletageCalcule: number | string; ecartSoumission: number | string; motifEcartSoumission: string | null;
  cotisationsMobileMoney: number | string; montantVirement: number | string;
  tresorier: PersonRef | null; montantConfirmeTresorier: number | string | null; ecartTresorier: number | string | null; motifEcartTresorier: string | null;
  visaCGTPar: PersonRef | null;
  depotBancaireReference: string | null;
  lignesBilletage: LigneBilletage[];
  pieces?: { id: number; nom: string; url: string; nature: string }[];
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMIS: { label: "Soumis", badge: "bg-blue-100 text-blue-700" },
  ECART_SIGNALE: { label: "Écart signalé", badge: "bg-red-100 text-red-700" },
  VALIDE: { label: "Validé", badge: "bg-emerald-100 text-emerald-700" },
  CLOTURE: { label: "Clôturé", badge: "bg-slate-200 text-slate-700" },
};

export default function BordereauxRemisePage() {
  return (
    <Suspense fallback={null}>
      <BordereauxRemisePageInner />
    </Suspense>
  );
}

function BordereauxRemisePageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const detail = searchParams.get("detail");
    if (searchParams.get("nouveau")) setShowCreate(true);
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: Bordereau[]; stats: Record<string, number> }>(`/api/tresorerie/bordereaux-remise?${params}`);
  const bordereaux = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/agentsTerrain" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-teal-600" /> Bordereaux de remise de fonds
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Remise d&apos;espèces collectées au caissier de l&apos;agence, avec billetage</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/dashboard/user/agentsTerrain/fonds-collectes"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
              <Wallet className="w-4 h-4" /> Mes fonds collectés
            </Link>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Nouveau bordereau
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statutFilter === k ? "ring-1 ring-teal-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
              }`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : bordereaux.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <Wallet className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun bordereau</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {bordereaux.map((b) => {
              const cfg = STATUT_CFG[b.statut] ?? STATUT_CFG.SOUMIS;
              return (
                <div key={b.id} onClick={() => setDetailId(b.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{b.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{b.pointDeVente.nom}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(b.totalEspecesAttendu).toLocaleString("fr-FR")} FCFA</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <NouveauBordereauRemise onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }} />
      )}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, loading } = useApi<{ data: Bordereau }>(`/api/tresorerie/bordereaux-remise/${id}`);
  const b = data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{b?.reference ?? "Chargement…"}</h2>
          <div className="flex items-center gap-1">
            {b && <a href={`/api/tresorerie/bordereaux-remise/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {loading || !b ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[b.statut] ?? STATUT_CFG.SOUMIS).badge}`}>{(STATUT_CFG[b.statut] ?? STATUT_CFG.SOUMIS).label}</span>
              <p className="text-sm text-slate-600">Total espèces attendu : <b>{Number(b.totalEspecesAttendu).toLocaleString("fr-FR")} FCFA</b></p>
              <p className="text-sm text-slate-600">Total billetage : <b>{Number(b.totalBilletageCalcule).toLocaleString("fr-FR")} FCFA</b></p>
              <PiecesListe pieces={b.pieces} />
              {Math.abs(Number(b.ecartSoumission)) > 0.01 && <p className="text-sm text-amber-600">Écart déclaré : {Number(b.ecartSoumission).toLocaleString("fr-FR")} FCFA — {b.motifEcartSoumission}</p>}
              {b.tresorier && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Caissier</p>
                  <p className="text-sm text-slate-700 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> {b.tresorier.prenom} {b.tresorier.nom} — confirmé {b.montantConfirmeTresorier != null ? Number(b.montantConfirmeTresorier).toLocaleString("fr-FR") : "—"} FCFA</p>
                  {b.motifEcartTresorier && <p className="text-xs text-red-600 mt-1">Écart : {Number(b.ecartTresorier).toLocaleString("fr-FR")} FCFA — {b.motifEcartTresorier}</p>}
                </div>
              )}
              {b.visaCGTPar && <p className="text-sm text-amber-700">Visa CGT : {b.visaCGTPar.prenom} {b.visaCGTPar.nom}</p>}
              {b.depotBancaireReference && <p className="text-sm text-blue-700">Clôturé — dépôt réf. {b.depotBancaireReference}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

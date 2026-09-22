"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { ArrowLeft, Wallet, RefreshCw, X, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { PiecesListe } from "@/components/agent-documents/PiecesBordereau";

/**
 * Bordereaux de remise de fonds (CDC digitalisation §3.1) — écran caissier.
 *
 * Circuit : l'agent terrain SOUMET un bordereau (billetage déclaré) → le
 * caissier de l'agence de dépôt COMPTE CONTRADICTOIREMENT et confirme
 * (cet écran) → si le montant dépasse le seuil, la Direction vise (Président
 * CGT) ; sinon l'écriture comptable est générée automatiquement et le
 * bordereau passe directement à CLOTURE — aucune étape supplémentaire côté
 * comptable.
 */

interface PersonRef { id: number; nom: string; prenom: string }
interface Bordereau {
  id: number; reference: string; statut: string;
  pointDeVente: { id: number; nom: string; code: string };
  collecteur: PersonRef & { telephone: string | null };
  totalEspecesAttendu: number | string; totalBilletageCalcule: number | string; ecartSoumission: number | string; motifEcartSoumission: string | null;
  cotisationsMobileMoney: number | string; montantVirement: number | string;
  tresorier: PersonRef | null; montantConfirmeTresorier: number | string | null; ecartTresorier: number | string | null; motifEcartTresorier: string | null;
  pieces?: { id: number; nom: string; url: string; nature: string }[];
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMIS: { label: "Soumis — à traiter", badge: "bg-blue-100 text-blue-700" },
  ECART_SIGNALE: { label: "Écart signalé — à retraiter", badge: "bg-red-100 text-red-700" },
  VALIDE: { label: "Validé — en attente visa Direction", badge: "bg-emerald-100 text-emerald-700" },
  CLOTURE: { label: "Clôturé", badge: "bg-slate-200 text-slate-700" },
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

export default function CaissierBordereauxPage() {
  return (
    <Suspense fallback={null}>
      <CaissierBordereauxPageInner />
    </Suspense>
  );
}

function CaissierBordereauxPageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("SOUMIS");
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const detail = searchParams.get("detail");
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: Bordereau[]; stats: Record<string, number> }>(`/api/tresorerie/bordereaux-remise?${params}`);
  const bordereaux = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <Link href="/dashboard/user/caissiers" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-teal-600" /> Bordereaux de remise de fonds
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Comptage contradictoire du billetage remis par les agents terrain de votre point de vente</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statutFilter === k ? "ring-1 ring-teal-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
              }`}>
              {cfg.label.split(" — ")[0]} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : bordereaux.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <Wallet className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun bordereau sur ce filtre</p>
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
                    <p className="text-xs text-slate-400 mt-0.5">{b.collecteur.prenom} {b.collecteur.nom}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(b.totalEspecesAttendu).toLocaleString("fr-FR")} FCFA</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

function DetailModal({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Bordereau }>(`/api/tresorerie/bordereaux-remise/${id}`);
  const [busy, setBusy] = useState(false);
  const [montantConfirme, setMontantConfirme] = useState("");
  const [motifEcartTresorier, setMotifEcartTresorier] = useState("");
  const b = data?.data;

  const traiter = async () => {
    if (!montantConfirme) { toast.error("Montant compté requis"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/tresorerie/bordereaux-remise/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TRAITER", montantConfirmeTresorier: Number(montantConfirme), motifEcartTresorier: motifEcartTresorier || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const nouveauStatut = j.data?.statut as string | undefined;
        toast.success(
          nouveauStatut === "CLOTURE" ? "Billetage confirmé — écriture comptable générée automatiquement"
          : nouveauStatut === "VALIDE" ? "Billetage confirmé — en attente du visa Direction (montant élevé)"
          : "Écart signalé — transmis pour contrôle"
        );
        refetch(); onUpdated();
      } else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">{b?.reference ?? "Chargement…"}</h2>
            {b && <p className="text-xs text-slate-400">{b.collecteur.prenom} {b.collecteur.nom}</p>}
          </div>
          <div className="flex items-center gap-1">
            {b && <a href={`/api/tresorerie/bordereaux-remise/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading || !b ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[b.statut] ?? STATUT_CFG.SOUMIS).badge}`}>{(STATUT_CFG[b.statut] ?? STATUT_CFG.SOUMIS).label}</span>
              <p className="text-sm text-slate-600">Total espèces attendu (déclaré par l&apos;agent) : <b>{Number(b.totalEspecesAttendu).toLocaleString("fr-FR")} FCFA</b></p>
              <p className="text-sm text-slate-600">Total billetage déclaré : <b>{Number(b.totalBilletageCalcule).toLocaleString("fr-FR")} FCFA</b></p>
              <PiecesListe pieces={b.pieces} />
              {Math.abs(Number(b.ecartSoumission)) > 0.01 && (
                <p className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Écart déclaré par l&apos;agent : {Number(b.ecartSoumission).toLocaleString("fr-FR")} FCFA — {b.motifEcartSoumission}</p>
              )}

              {["SOUMIS", "ECART_SIGNALE"].includes(b.statut) && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Comptage contradictoire</p>
                  <p className="text-xs text-slate-500">Recomptez physiquement le billetage remis, puis saisissez le montant réellement compté.</p>
                  <input type="number" min="0" placeholder="Montant compté (FCFA)" value={montantConfirme} onChange={(e) => setMontantConfirme(e.target.value)} className={inputCls} />
                  {montantConfirme && Math.abs(Number(montantConfirme) - Number(b.totalBilletageCalcule)) > 0.01 && (
                    <input placeholder="Motif de l'écart (obligatoire)" value={motifEcartTresorier} onChange={(e) => setMotifEcartTresorier(e.target.value)} className={inputCls} />
                  )}
                  <button onClick={traiter} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" /> Confirmer le comptage
                  </button>
                </div>
              )}

              {b.tresorier && (
                <p className="text-sm text-slate-600">Confirmé par : {b.tresorier.prenom} {b.tresorier.nom} — {b.montantConfirmeTresorier != null ? Number(b.montantConfirmeTresorier).toLocaleString("fr-FR") : "—"} FCFA</p>
              )}
              {b.statut === "VALIDE" && (
                <p className="text-sm text-emerald-700">Billetage confirmé — en attente du visa Président CGT (montant au-dessus du seuil) avant que l&apos;écriture comptable ne soit générée.</p>
              )}
              {b.statut === "CLOTURE" && (
                <p className="text-sm text-slate-700">Circuit terminé — écriture comptable générée automatiquement.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

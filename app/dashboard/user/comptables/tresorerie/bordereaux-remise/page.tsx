"use client";

import { useState, useEffect, Suspense } from "react";
import { PiecesListe } from "@/components/agent-documents/PiecesBordereau";
import VisaBordereauModal from "@/components/agent-documents/VisaBordereauModal";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { ArrowLeft, Wallet, RefreshCw, X, FileText, CheckCircle, AlertTriangle, ShieldCheck, Landmark } from "lucide-react";

interface PersonRef { id: number; nom: string; prenom: string }
interface LigneBilletage { id: number; denomination: number; nombre: number; total: number }
interface Bordereau {
  id: number; reference: string; statut: string;
  pointDeVente: { id: number; nom: string; code: string };
  collecteur: PersonRef & { telephone: string | null };
  totalEspecesAttendu: number | string; totalBilletageCalcule: number | string; ecartSoumission: number | string; motifEcartSoumission: string | null;
  cotisationsMobileMoney: number | string; montantVirement: number | string;
  tresorier: PersonRef | null; montantConfirmeTresorier: number | string | null; ecartTresorier: number | string | null; motifEcartTresorier: string | null;
  visaCGTPar: PersonRef | null;
  pieces?: { id: number; nom: string; url: string; nature: string }[];
  depotBancaireReference: string | null;
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMIS: { label: "Soumis", badge: "bg-blue-100 text-blue-700" },
  ECART_SIGNALE: { label: "Écart signalé", badge: "bg-red-100 text-red-700" },
  VALIDE: { label: "Validé", badge: "bg-emerald-100 text-emerald-700" },
  CLOTURE: { label: "Clôturé", badge: "bg-slate-200 text-slate-700" },
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

export default function TresorerieBordereauxPage() {
  return (
    <Suspense fallback={null}>
      <TresorerieBordereauxPageInner />
    </Suspense>
  );
}

function TresorerieBordereauxPageInner() {
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
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <Link href="/dashboard/user/comptables" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-teal-600" /> Trésorerie — Bordereaux de remise de fonds
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Comptage contradictoire, visa CGT, rapprochement bancaire</p>
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
                    <p className="text-xs text-slate-400 mt-0.5">{b.collecteur.prenom} {b.collecteur.nom} · {b.pointDeVente.nom}</p>
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
  const { data, loading, refetch } = useApi<{ data: Bordereau; seuilVisaCGT: number }>(`/api/tresorerie/bordereaux-remise/${id}`);
  const { data: sessionData } = useSession();
  const role = sessionData?.user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const [busy, setBusy] = useState(false);
  const [showVisa, setShowVisa] = useState(false);
  const [depotRef, setDepotRef] = useState("");
  const b = data?.data;
  const seuil = data?.seuilVisaCGT ?? Infinity;
  const montantTotal = b ? Number(b.totalBilletageCalcule) + Number(b.cotisationsMobileMoney) + Number(b.montantVirement) : 0;
  const visaRequis = montantTotal > seuil;

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/tresorerie/bordereaux-remise/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const enregistrerDepot = () => {
    if (!depotRef.trim()) { toast.error("Référence de dépôt bancaire requise"); return; }
    doAction("ENREGISTRER_DEPOT", { depotBancaireReference: depotRef });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">{b?.reference ?? "Chargement…"}</h2>
            {b && <p className="text-xs text-slate-400">{b.collecteur.prenom} {b.collecteur.nom} · {b.pointDeVente.nom}</p>}
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
              <p className="text-sm text-slate-600">Total espèces attendu (déclaré) : <b>{Number(b.totalEspecesAttendu).toLocaleString("fr-FR")} FCFA</b></p>
              <p className="text-sm text-slate-600">Total billetage : <b>{Number(b.totalBilletageCalcule).toLocaleString("fr-FR")} FCFA</b></p>
              <PiecesListe pieces={b.pieces} />
              {Math.abs(Number(b.ecartSoumission)) > 0.01 && (
                <p className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Écart déclaré par le collecteur : {Number(b.ecartSoumission).toLocaleString("fr-FR")} FCFA — {b.motifEcartSoumission}</p>
              )}

              {["SOUMIS", "ECART_SIGNALE"].includes(b.statut) && (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  En attente de comptage contradictoire par le caissier de &laquo;&nbsp;{b.pointDeVente.nom}&nbsp;&raquo;.
                  {b.statut === "ECART_SIGNALE" && " Un écart a été signalé — à examiner."}
                </p>
              )}

              {b.tresorier && (
                <p className="text-sm text-slate-600">Confirmé par (caissier) : {b.tresorier.prenom} {b.tresorier.nom} — {b.montantConfirmeTresorier != null ? Number(b.montantConfirmeTresorier).toLocaleString("fr-FR") : "—"} FCFA</p>
              )}
              {b.ecartTresorier != null && Math.abs(Number(b.ecartTresorier)) > 0.01 && (
                <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Écart constaté par le caissier : {Number(b.ecartTresorier).toLocaleString("fr-FR")} FCFA — {b.motifEcartTresorier}</p>
              )}

              {b.statut === "VALIDE" && visaRequis && !b.visaCGTPar && isAdmin && (
                <button onClick={() => setShowVisa(true)} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50">
                  <ShieldCheck className="w-4 h-4" /> Viser (Président CGT) — montant &gt; {seuil.toLocaleString("fr-FR")} FCFA
                </button>
              )}
              {b.statut === "VALIDE" && visaRequis && !isAdmin && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Billetage confirmé — en attente du visa Président CGT (montant &gt; {seuil.toLocaleString("fr-FR")} FCFA).</p>
              )}
              {b.visaCGTPar && <p className="text-sm text-amber-700">Visa CGT : {b.visaCGTPar.prenom} {b.visaCGTPar.nom}</p>}

              {b.statut === "CLOTURE" && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Circuit validé — écriture comptable générée automatiquement.</p>
              )}
              {b.statut === "CLOTURE" && !b.depotBancaireReference && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Dépôt bancaire (informatif)</p>
                  <p className="text-xs text-slate-500">L&apos;écriture comptable existe déjà — rattachez ici la référence une fois le dépôt physiquement effectué (rapprochement bancaire).</p>
                  <input placeholder="Référence de dépôt bancaire" value={depotRef} onChange={(e) => setDepotRef(e.target.value)} className={inputCls} />
                  <button onClick={enregistrerDepot} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    <Landmark className="w-4 h-4" /> Enregistrer le dépôt
                  </button>
                </div>
              )}
              {b.depotBancaireReference && <p className="text-sm text-blue-700">Dépôt bancaire réf. {b.depotBancaireReference}</p>}
            </>
          )}
        </div>
      </div>
      {showVisa && b && (
        <VisaBordereauModal id={id} reference={b.reference} onClose={() => setShowVisa(false)}
          onDone={() => { setShowVisa(false); refetch(); onUpdated(); }} />
      )}
    </div>
  );
}

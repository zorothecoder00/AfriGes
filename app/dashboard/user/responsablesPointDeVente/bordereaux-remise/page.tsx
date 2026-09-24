"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, Stamp, Wallet, FileText } from "lucide-react";
import RetourLien from "@/components/RetourLien";
import VisaBordereauModal from "@/components/agent-documents/VisaBordereauModal";
import { PiecesListe } from "@/components/agent-documents/PiecesBordereau";

/**
 * Bordereaux de remise de fonds de l'agence du RPV (CDC digitalisation §3.1).
 * Le RPV est « Président » au même titre que la Direction : il vise les bordereaux dont le
 * montant dépasse le seuil (statut VALIDE = billetage confirmé par le caissier, en attente de
 * visa ; les autres sont clôturés automatiquement), avec signature tracée facultative.
 */

interface Bordereau {
  id: number; reference: string; statut: string;
  pointDeVente: { nom: string; code: string };
  collecteur: { nom: string; prenom: string };
  deposantNom: string | null; deposantPrenom: string | null;
  totalEspecesAttendu: string; totalBilletageCalcule: string; cotisationsMobileMoney: string; montantVirement: string;
  tresorier: { nom: string; prenom: string } | null;
  visaCGTPar: { nom: string; prenom: string } | null;
  pieces?: { id: number; nom: string; url: string; nature: string }[];
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  VALIDE: { label: "À viser", badge: "bg-orange-100 text-orange-700" },
  SOUMIS: { label: "Soumis — comptage caissier", badge: "bg-blue-100 text-blue-700" },
  ECART_SIGNALE: { label: "Écart signalé", badge: "bg-red-100 text-red-700" },
  CLOTURE: { label: "Clôturé", badge: "bg-slate-200 text-slate-700" },
};

export default function RpvBordereauxRemisePage() {
  return (
    <Suspense fallback={null}>
      <RpvBordereauxRemise />
    </Suspense>
  );
}

function RpvBordereauxRemise() {
  const searchParams = useSearchParams();
  const [statut, setStatut] = useState("VALIDE");
  const [aViser, setAViser] = useState<Bordereau | null>(null);
  const { data, loading, refetch } = useApi<{ data: Bordereau[]; stats: Record<string, number> }>(
    `/api/tresorerie/bordereaux-remise${statut ? `?statut=${statut}` : ""}`,
  );
  const bordereaux = data?.data ?? [];
  const stats = data?.stats ?? {};

  // Arrivée depuis la notification « Visa requis » (?detail=<id>) : ouvre directement le visa.
  useEffect(() => {
    const detail = Number(searchParams.get("detail"));
    if (!detail || aViser) return;
    const b = bordereaux.find((x) => x.id === detail);
    if (b && b.statut === "VALIDE") setAViser(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bordereaux]);

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <RetourLien defaultHref="/dashboard/user/responsablesPointDeVente" />
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-1">
            <Wallet className="w-6 h-6 text-teal-600" /> Bordereaux de remise de fonds
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Bordereaux de votre agence — visa du Président pour les montants au-dessus du seuil</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatut(statut === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statut === k ? "ring-1 ring-teal-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"}`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} title="Actualiser" className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading && bordereaux.length === 0 ? (
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
              const total = Number(b.totalBilletageCalcule) + Number(b.cotisationsMobileMoney) + Number(b.montantVirement);
              const deposant = b.deposantNom ? `${b.deposantPrenom ?? ""} ${b.deposantNom}` : `${b.collecteur.prenom} ${b.collecteur.nom}`;
              return (
                <div key={b.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{b.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {deposant} · {b.pointDeVente.nom}
                      {b.tresorier && ` · compté par ${b.tresorier.prenom} ${b.tresorier.nom}`}
                      {b.visaCGTPar && ` · visé par ${b.visaCGTPar.prenom} ${b.visaCGTPar.nom}`}
                    </p>
                    <div className="mt-1"><PiecesListe pieces={b.pieces} /></div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{total.toLocaleString("fr-FR")} FCFA</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {b.statut === "VALIDE" && !b.visaCGTPar && (
                      <button onClick={() => setAViser(b)} className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200">
                        <Stamp className="w-3.5 h-3.5" /> Viser
                      </button>
                    )}
                    <a href={`/api/tresorerie/bordereaux-remise/${b.id}/pdf`} target="_blank" rel="noreferrer" title="Imprimer le bordereau" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                      <FileText className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {aViser && (
        <VisaBordereauModal id={aViser.id} reference={aViser.reference} onClose={() => setAViser(null)}
          onDone={() => { setAViser(null); refetch(); }} />
      )}
    </div>
  );
}

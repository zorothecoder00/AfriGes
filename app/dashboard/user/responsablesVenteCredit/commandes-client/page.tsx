"use client";

import { useState, useEffect, Suspense } from "react";
import RetourLien from "@/components/RetourLien";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { ShoppingCart, RefreshCw, X, FileText, CheckCircle, XCircle } from "lucide-react";

interface PersonRef { id: number; nom: string; prenom: string }
interface Ligne { id: number; produitId: number | null; designationLibre?: string | null; quantite: number; prixUnitaire: number | string; remiseMontant: number | string; totalLigne: number | string; produit: { id: number; nom: string } | null }
interface Commande {
  id: number; reference: string; statut: string;
  pointDeVente: { id: number; nom: string; code: string };
  agent: PersonRef;
  client: { id: number; nom: string; prenom: string; telephone: string };
  modeReglement: string; typeClientCommande: string;
  totalHT: number | string; totalRemise: number | string; totalTTC: number | string;
  visaResponsablePar: PersonRef | null; motifRejet: string | null;
  lignes: Ligne[];
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMISE: { label: "Soumise", badge: "bg-blue-100 text-blue-700" },
  EN_VALIDATION: { label: "En attente de visa", badge: "bg-amber-100 text-amber-700" },
  VALIDEE: { label: "Validée", badge: "bg-cyan-100 text-cyan-700" },
  EN_PREPARATION: { label: "En préparation", badge: "bg-indigo-100 text-indigo-700" },
  LIVREE: { label: "Livrée", badge: "bg-emerald-100 text-emerald-700" },
  CLOTUREE: { label: "Clôturée", badge: "bg-slate-200 text-slate-700" },
  REJETEE: { label: "Rejetée", badge: "bg-red-100 text-red-700" },
  ANNULEE: { label: "Annulée", badge: "bg-red-100 text-red-600" },
};

export default function RVCCommandesClientPage() {
  return (
    <Suspense fallback={null}>
      <RVCCommandesClientPageInner />
    </Suspense>
  );
}

function RVCCommandesClientPageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("EN_VALIDATION");
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const detail = searchParams.get("detail");
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: Commande[]; stats: Record<string, number> }>(`/api/ventes/commandes-client?${params}`);
  const commandes = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <RetourLien defaultHref="/dashboard/user/responsablesVenteCredit" defaultLabel="Retour" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1" />
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-600" /> Commandes client — visa remise/crédit
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Commandes avec remise ou vente à crédit en attente de validation</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statutFilter === k ? "ring-1 ring-emerald-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"}`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : commandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Aucune commande</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {commandes.map((c) => {
              const cfg = STATUT_CFG[c.statut] ?? STATUT_CFG.SOUMISE;
              return (
                <div key={c.id} onClick={() => setDetailId(c.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{c.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{c.agent.prenom} {c.agent.nom} · {c.client.prenom} {c.client.nom} · {c.modeReglement}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(c.totalTTC).toLocaleString("fr-FR")} FCFA</span>
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
  const { data, loading, refetch } = useApi<{ data: Commande }>(`/api/ventes/commandes-client/${id}`);
  const [busy, setBusy] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [showRejet, setShowRejet] = useState(false);
  const c = data?.data;

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/ventes/commandes-client/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); refetch(); onUpdated(); } else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{c?.reference ?? "Chargement…"}</h2>
          <div className="flex items-center gap-1">
            {c && <a href={`/api/ventes/commandes-client/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {loading || !c ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[c.statut] ?? STATUT_CFG.SOUMISE).badge}`}>{(STATUT_CFG[c.statut] ?? STATUT_CFG.SOUMISE).label}</span>
              <p className="text-sm text-slate-600">Agent : {c.agent.prenom} {c.agent.nom} · {c.pointDeVente.nom}</p>
              <p className="text-sm text-slate-600">Client : {c.client.prenom} {c.client.nom} — {c.client.telephone} ({c.typeClientCommande})</p>
              <p className="text-sm text-slate-600">Règlement : <b>{c.modeReglement}</b></p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {c.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2">{l.produit?.nom ?? l.designationLibre}{!l.produit && <span className="ml-2 text-xs text-amber-600">hors catalogue</span>}</td>
                        <td className="text-center px-3 py-2">× {l.quantite}</td>
                        <td className="text-right px-3 py-2">{Number(l.remiseMontant) > 0 ? `-${Number(l.remiseMontant).toLocaleString("fr-FR")}` : "—"}</td>
                        <td className="text-right px-3 py-2 font-medium">{Number(l.totalLigne).toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              <p className="text-right text-sm text-slate-500">Remise totale : {Number(c.totalRemise).toLocaleString("fr-FR")} FCFA</p>
              <p className="text-right text-sm font-bold text-slate-800">Total TTC : {Number(c.totalTTC).toLocaleString("fr-FR")} FCFA</p>
              {c.motifRejet && <p className="text-sm text-red-600">Motif de rejet : {c.motifRejet}</p>}
            </>
          )}
        </div>
        {c && c.statut === "EN_VALIDATION" && (
          <div className="px-6 py-4 border-t border-slate-200 space-y-2">
            {showRejet && (
              <input value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} placeholder="Motif de rejet" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            )}
            <div className="flex justify-end gap-2">
              {showRejet ? (
                <button onClick={() => doAction("REJETER", { motifRejet })} disabled={busy || !motifRejet.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"><XCircle className="w-4 h-4" /> Confirmer le rejet</button>
              ) : (
                <button onClick={() => setShowRejet(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"><XCircle className="w-4 h-4" /> Rejeter</button>
              )}
              <button onClick={() => doAction("VISER")} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"><CheckCircle className="w-4 h-4" /> Viser</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

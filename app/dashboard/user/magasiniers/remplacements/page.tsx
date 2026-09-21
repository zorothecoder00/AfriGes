"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Repeat, RefreshCw, Printer, CheckCircle2, XCircle, Loader2, Truck } from "lucide-react";
import { useApi } from "@/hooks/useApi";

/**
 * "Bon de remplacement" (CDC digitalisation §5.8) — file d'attente du
 * magasinier pour approuver puis livrer les remplacements de produits
 * défectueux demandés par le Service Commercial.
 */

interface RemplacementRow {
  id: number; numero: string; statut: string; quantite: number;
  produitOrigine: { nom: string }; produitRemplacement: { nom: string };
  reclamation: { id: number; numero: string; client: { nom: string; prenom: string } };
}

const STATUT_BADGE: Record<string, string> = {
  DEMANDE: "bg-blue-100 text-blue-700",
  APPROUVE: "bg-amber-100 text-amber-700",
  LIVRE: "bg-emerald-100 text-emerald-700",
  REJETE: "bg-red-100 text-red-600",
};
const STATUT_LABEL: Record<string, string> = { DEMANDE: "Demandé", APPROUVE: "Approuvé", LIVRE: "Livré", REJETE: "Rejeté" };

export default function RemplacementsPage() {
  return (
    <Suspense fallback={null}>
      <RemplacementsPageInner />
    </Suspense>
  );
}

function RemplacementsPageInner() {
  const { data, loading, refetch } = useApi<{ data: RemplacementRow[] }>("/api/magasinier/remplacements");
  const remplacements = data?.data ?? [];

  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejetId, setRejetId] = useState<number | null>(null);
  const [motifRejet, setMotifRejet] = useState("");

  async function agir(id: number, action: "APPROUVER" | "LIVRER" | "REJETER", body?: Record<string, unknown>) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/magasinier/remplacements/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Mise à jour effectuée");
      refetch();
      setRejetId(null); setMotifRejet("");
    } catch { toast.error("Erreur réseau"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Repeat className="text-blue-600" size={22} /> Remplacements produits</h1>
            <p className="text-sm text-slate-500">Approuver puis livrer les remplacements de produits défectueux</p>
          </div>
          <button onClick={() => refetch()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading && <p className="text-sm text-slate-400">Chargement…</p>}

        <div className="space-y-3">
          {remplacements.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 font-mono text-sm">{r.numero}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[r.statut]}`}>{STATUT_LABEL[r.statut]}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Réclamation {r.reclamation.numero} — {r.reclamation.client.prenom} {r.reclamation.client.nom}</p>
                  <p className="text-xs text-slate-600 mt-1.5">{r.quantite} × {r.produitOrigine.nom} → {r.produitRemplacement.nom}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a href={`/api/admin/reclamations/${r.reclamation.id}/remplacements/${r.id}/pdf`} target="_blank" rel="noreferrer" title="Imprimer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><Printer size={15} /></a>
                  {r.statut === "DEMANDE" && (
                    <button onClick={() => agir(r.id, "APPROUVER")} disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                      {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approuver
                    </button>
                  )}
                  {r.statut === "APPROUVE" && (
                    <button onClick={() => agir(r.id, "LIVRER")} disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                      {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />} Livrer
                    </button>
                  )}
                  {(r.statut === "DEMANDE" || r.statut === "APPROUVE") && (
                    <button onClick={() => setRejetId(r.id)} disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-medium disabled:opacity-50">
                      <XCircle size={13} /> Rejeter
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!loading && remplacements.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">Aucun remplacement en attente.</div>
          )}
        </div>
      </div>

      {rejetId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100"><h4 className="font-bold text-slate-800 text-sm">Rejeter le remplacement</h4></div>
            <div className="p-5">
              <textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" placeholder="Motif du rejet *" />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => { setRejetId(null); setMotifRejet(""); }} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={() => agir(rejetId, "REJETER", { motifRejet })} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">Rejeter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

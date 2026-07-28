"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Check, X } from "lucide-react";
import { formatDate } from "@/lib/format";

interface Anomalie {
  id: number; reference: string; type: string; quantite: number;
  description: string; statut: string; commentaire: string | null; createdAt: string;
  pointDeVente: { id: number; nom: string; code: string } | null;
  magasinier: { id: number; nom: string; prenom: string };
}

const TYPE_LABEL: Record<string, string> = {
  MANQUANT: "Manquant", SURPLUS: "Surplus", DEFECTUEUX: "Défectueux",
  PERTE: "Perte", CASSE: "Casse", VOL: "Vol",
};

export default function AnomaliesProduit({ produitId, onStockChanged }: { produitId: number; onStockChanged?: () => void }) {
  const [anomalies, setAnomalies] = useState<Anomalie[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [motifModal, setMotifModal] = useState<{ id: number; action: "APPROUVER" | "REJETER" } | null>(null);
  const [motif, setMotif] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/anomalies?produitId=${produitId}&statut=TRANSMISE`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setAnomalies(j.data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [produitId]);

  useEffect(() => { load(); }, [load]);

  const traiter = async () => {
    if (!motifModal) return;
    setBusyId(motifModal.id);
    try {
      const r = await fetch(`/api/admin/anomalies/${motifModal.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: motifModal.action, ...(motif.trim() && { motif: motif.trim() }) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Décision enregistrée — stock mis à jour");
      setMotifModal(null); setMotif("");
      load();
      if (motifModal.action === "APPROUVER") onStockChanged?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  if (loading) {
    return <div className="bg-white rounded-2xl border border-gray-200 flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;
  }
  if (anomalies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Anomalies en attente de validation</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {anomalies.map((a) => (
          <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {TYPE_LABEL[a.type] ?? a.type} · {a.quantite} unité(s)
                {a.pointDeVente && <span className="text-xs text-gray-400 font-normal"> · {a.pointDeVente.nom}</span>}
              </p>
              <p className="text-xs text-gray-500">{a.description}</p>
              <p className="text-[11px] text-gray-400">{a.magasinier.prenom} {a.magasinier.nom} · {formatDate(a.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setMotifModal({ id: a.id, action: "APPROUVER" })} disabled={busyId === a.id}
                title="Approuver" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setMotifModal({ id: a.id, action: "REJETER" })} disabled={busyId === a.id}
                title="Rejeter" className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {motifModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">
              {motifModal.action === "APPROUVER" ? "Approuver l'anomalie ?" : "Rejeter l'anomalie ?"}
            </h3>
            <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder="Commentaire (optionnel)…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setMotifModal(null); setMotif(""); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
              <button onClick={traiter} disabled={busyId === motifModal.id}
                className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${motifModal.action === "APPROUVER" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                {busyId === motifModal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

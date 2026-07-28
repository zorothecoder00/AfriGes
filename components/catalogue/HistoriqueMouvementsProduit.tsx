"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, History, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/format";

interface Mouvement {
  id: number;
  type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantite: number;
  motif: string | null;
  reference: string;
  dateMouvement: string;
  pointDeVente: { id: number; nom: string } | null;
}

const getMouvementIcon = (type: string) => {
  switch (type) {
    case "ENTREE": return <ArrowUpCircle className="w-5 h-5 text-emerald-500" />;
    case "SORTIE": return <ArrowDownCircle className="w-5 h-5 text-red-500" />;
    default: return <RefreshCw className="w-5 h-5 text-blue-500" />;
  }
};

const getMouvementColor = (type: string) => {
  switch (type) {
    case "ENTREE": return "text-emerald-600";
    case "SORTIE": return "text-red-600";
    default: return "text-blue-600";
  }
};

export default function HistoriqueMouvementsProduit({ produitId }: { produitId: number }) {
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/mouvements`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setMouvements(j.data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [produitId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><History className="w-4 h-4 text-blue-500" /> Historique des mouvements</h3>
        <p className="text-xs text-gray-400">Les 50 derniers mouvements de stock, toutes agences confondues.</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : mouvements.length === 0 ? (
        <div className="py-12 text-center text-gray-400">Aucun mouvement enregistré.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {mouvements.map((m) => (
            <div key={m.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                {getMouvementIcon(m.type)}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {m.type === "ENTREE" ? "Entrée" : m.type === "SORTIE" ? "Sortie" : "Ajustement"}
                    {m.pointDeVente && <span className="text-xs text-gray-400 font-normal"> · {m.pointDeVente.nom}</span>}
                  </p>
                  <p className="text-xs text-gray-500">{m.motif || m.reference}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${getMouvementColor(m.type)}`}>
                  {m.type === "SORTIE" ? "-" : "+"}{m.quantite}
                </p>
                <p className="text-xs text-gray-500">{formatDate(m.dateMouvement)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

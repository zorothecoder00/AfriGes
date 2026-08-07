"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Tag, Plus, Loader2, Pencil, Filter, Power, PowerOff } from "lucide-react";
import { TYPE_REMISE_LABEL, libelleRemise, statutPromotion } from "@/lib/promotions";
import PromotionFormModal from "@/components/catalogue/PromotionFormModal";

/**
 * Surface Marketing sur le moteur de promotions existant (Catalogue §9, CDC
 * §32-34) — pas un nouveau CRUD : consomme /api/admin/catalogue/promotions et
 * réutilise PromotionFormModal. Ajoute la vue "campagne associée" (§32).
 */

interface PromoRow {
  id: number; code: string; nom: string; typeRemise: "POURCENTAGE" | "MONTANT" | "LOT";
  valeur: number; lotAchete: number | null; lotPaye: number | null;
  dateDebut: string; dateFin: string; actif: boolean;
  campagne: { id: number; code: string; nom: string } | null;
}

const STATUT_STYLE: Record<string, string> = {
  EN_COURS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PROGRAMMEE: "bg-blue-100 text-blue-700 border-blue-200",
  EXPIREE: "bg-slate-100 text-slate-400 border-slate-200",
  INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUT_LABEL: Record<string, string> = {
  EN_COURS: "En cours", PROGRAMMEE: "Programmée", EXPIREE: "Expirée", INACTIVE: "Inactive",
};

export default function PromotionsMarketing() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<{ familles: { id: number; nom: string }[]; categories: { id: number; nom: string }[]; marques: { id: number; nom: string }[] } | null>(null);
  const [pdvs, setPdvs] = useState<{ id: number; nom: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/catalogue/promotions");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/catalogue/referentiels").then((r) => r.json()).then((j) => setRefs(j.data)).catch(() => {});
    fetch("/api/admin/pdv?actif=true&limit=100").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {});
  }, []);

  const toggleActif = async (p: PromoRow) => {
    const r = await fetch(`/api/admin/catalogue/promotions/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !p.actif }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success(p.actif ? "Promotion désactivée" : "Promotion activée"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Tag className="w-5 h-5 text-fuchsia-600" /> Promotions</h2>
          <p className="text-sm text-slate-400">{rows.length} promotion(s) — le moteur commercial applique la remise automatiquement à la vente.</p>
        </div>
        <button onClick={() => { setEditId(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouvelle promotion
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400"><Filter className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucune promotion.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Promotion</th>
                  <th className="text-left px-4 py-3 font-semibold">Remise</th>
                  <th className="text-left px-4 py-3 font-semibold">Campagne</th>
                  <th className="text-left px-4 py-3 font-semibold">Période</th>
                  <th className="text-center px-4 py-3 font-semibold">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((p) => {
                  const st = statutPromotion(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{p.nom}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{p.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-fuchsia-700">{libelleRemise(p)}</span>
                        <p className="text-[10px] text-slate-400">{TYPE_REMISE_LABEL[p.typeRemise]}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{p.campagne ? p.campagne.nom : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(p.dateDebut).toLocaleDateString("fr-FR")}<br />→ {new Date(p.dateFin).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLE[st] ?? ""}`}>{STATUT_LABEL[st]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => toggleActif(p)} title={p.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                            {p.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { setEditId(p.id); setModalOpen(true); }} title="Modifier" className="p-1.5 text-slate-400 hover:text-fuchsia-600 rounded-lg hover:bg-fuchsia-50"><Pencil className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <PromotionFormModal
          promotionId={editId}
          refs={refs}
          pdvs={pdvs}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

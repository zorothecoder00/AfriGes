"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Tag, Plus, ArrowLeft, Loader2, Pencil, Trash2, Filter, Power, PowerOff } from "lucide-react";
import { TYPE_REMISE_LABEL, CIBLE_PROMOTION_LABEL, libelleRemise, statutPromotion } from "@/lib/promotions";
import PromotionFormModal from "@/components/catalogue/PromotionFormModal";

interface PromoRow {
  id: number; code: string; nom: string; description: string | null; cible: string;
  typeRemise: "POURCENTAGE" | "MONTANT" | "LOT"; valeur: number; lotAchete: number | null; lotPaye: number | null;
  segment: string | null; dateDebut: string; dateFin: string; actif: boolean; priorite: number;
  produit: { id: number; nom: string; codeProduit: string | null } | null;
  categorie: { id: number; nom: string } | null;
  famille: { id: number; nom: string } | null;
  marque: { id: number; nom: string } | null;
  pointDeVente: { id: number; nom: string } | null;
  client: { id: number; nom: string; prenom: string } | null;
}

const STATUT_STYLE: Record<string, string> = {
  EN_COURS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PROGRAMMEE: "bg-blue-100 text-blue-700 border-blue-200",
  EXPIREE: "bg-gray-100 text-gray-400 border-gray-200",
  INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUT_LABEL: Record<string, string> = {
  EN_COURS: "En cours", PROGRAMMEE: "Programmée", EXPIREE: "Expirée", INACTIVE: "Inactive",
};

function perimetreLabel(p: PromoRow): string {
  switch (p.cible) {
    case "PRODUIT": return p.produit ? p.produit.nom : "Produit";
    case "CATEGORIE": return p.categorie ? `Catégorie : ${p.categorie.nom}` : "Catégorie";
    case "FAMILLE": return p.famille ? `Famille : ${p.famille.nom}` : "Famille";
    case "MARQUE": return p.marque ? `Marque : ${p.marque.nom}` : "Marque";
    case "TOUS": return "Tout le catalogue";
    default: return p.cible;
  }
}

function restrictionsLabel(p: PromoRow): string {
  const parts: string[] = [];
  if (p.pointDeVente) parts.push(p.pointDeVente.nom);
  if (p.segment) parts.push(p.segment === "RIA" ? "Communauté RIA" : "Ordinaire");
  if (p.client) parts.push(`${p.client.prenom} ${p.client.nom}`);
  return parts.length ? parts.join(" · ") : "Tous";
}

interface Ref { id: number; nom: string }
interface Referentiels { familles: Ref[]; categories: Ref[]; marques: Ref[] }

export default function PromotionsPage() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState("");
  const [refs, setRefs] = useState<Referentiels | null>(null);
  const [pdvs, setPdvs] = useState<{ id: number; nom: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statut ? `?statut=${statut}` : "";
      const r = await fetch(`/api/admin/catalogue/promotions${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [statut]);

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

  const supprimer = async (p: PromoRow) => {
    if (!confirm(`Supprimer la promotion « ${p.nom} » ? Cette action est définitive.`)) return;
    const r = await fetch(`/api/admin/catalogue/promotions/${p.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success("Promotion supprimée"); load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Tag className="w-6 h-6 text-blue-600" /> Promotions</h2>
            <p className="text-sm text-gray-400">{rows.length} promotion(s). Remises par produit, catégorie, famille, marque, agence, communauté ou client.</p>
          </div>
          <button onClick={() => { setEditId(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Nouvelle promotion
          </button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <select value={statut} onChange={(e) => setStatut(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes</option>
            {Object.keys(STATUT_LABEL).map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-gray-400"><Filter className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucune promotion.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Promotion</th>
                    <th className="text-left px-4 py-3 font-semibold">Périmètre</th>
                    <th className="text-left px-4 py-3 font-semibold">Remise</th>
                    <th className="text-left px-4 py-3 font-semibold">Restrictions</th>
                    <th className="text-left px-4 py-3 font-semibold">Période</th>
                    <th className="text-center px-4 py-3 font-semibold">Statut</th>
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((p) => {
                    const st = statutPromotion(p);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{p.nom}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{p.code}{p.priorite ? ` · prio ${p.priorite}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 mr-1">{CIBLE_PROMOTION_LABEL[p.cible as keyof typeof CIBLE_PROMOTION_LABEL] ?? p.cible}</span>
                          {perimetreLabel(p)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-blue-700">{libelleRemise(p)}</span>
                          <p className="text-[10px] text-gray-400">{TYPE_REMISE_LABEL[p.typeRemise]}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{restrictionsLabel(p)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(p.dateDebut).toLocaleDateString("fr-FR")}<br />→ {new Date(p.dateFin).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLE[st] ?? ""}`}>{STATUT_LABEL[st]}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => toggleActif(p)} title={p.actif ? "Désactiver" : "Activer"} className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                              {p.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                            <button onClick={() => { setEditId(p.id); setModalOpen(true); }} title="Modifier" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => supprimer(p)} title="Supprimer" className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
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

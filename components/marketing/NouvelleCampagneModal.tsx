"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { Plus, X, Loader2 } from "lucide-react";

interface TypeCampagne { id: number; code: string; libelle: string; actif: boolean }
interface CanalMarketing { id: number; code: string; libelle: string; actif: boolean }
interface Reference {
  pdvs: { id: number; nom: string; code: string }[];
  produits: { id: number; nom: string; familleId: number | null }[];
  familles: { id: number; nom: string }[];
  utilisateurs: { id: number; nom: string; prenom: string }[];
  packs: { id: number; nom: string; type: string }[];
}

const OBJECTIFS = [
  { value: "ACQUISITION", label: "Acquisition" }, { value: "CONVERSION", label: "Conversion" },
  { value: "FIDELISATION", label: "Fidélisation" }, { value: "REACTIVATION", label: "Réactivation" },
  { value: "CROSS_SELLING", label: "Cross-selling" }, { value: "UPSELLING", label: "Upselling" },
  { value: "NOTORIETE", label: "Notoriété" }, { value: "TRAFIC", label: "Trafic" },
];

/** Formulaire de création de campagne (brief marketing §9 inclus) — partagé
 * entre le dashboard admin et le portail Responsable Marketing. */
export default function NouvelleCampagneModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: typesRes } = useApi<{ data: TypeCampagne[] }>("/api/admin/marketing/types-campagne");
  const { data: canauxRes } = useApi<{ data: CanalMarketing[] }>("/api/admin/marketing/canaux");
  const { data: refRes } = useApi<{ data: Reference }>("/api/admin/marketing/reference");
  const { mutate: creer, loading: creating } = useMutation<{ id: number }, Record<string, unknown>>(
    "/api/admin/marketing/campagnes", "POST",
    { successMessage: "Campagne créée en brouillon", invalidate: "/api/admin/marketing/campagnes" }
  );

  const [form, setForm] = useState({
    nom: "", description: "", typeCampagneId: "", responsableId: "",
    dateDebut: "", dateFin: "", budgetPrevu: "", roiCible: "",
    probleme: "", cible: "", message: "", offre: "", zone: "", resultatAttendu: "",
  });
  const [objectifs, setObjectifs] = useState<string[]>([]);
  const [agenceIds, setAgenceIds] = useState<number[]>([]);
  const [canalIds, setCanalIds] = useState<number[]>([]);
  const [produitIds, setProduitIds] = useState<number[]>([]);
  const [packIds, setPackIds] = useState<number[]>([]);

  const toggle = (arr: number[], setArr: (v: number[]) => void, id: number) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const toggleObjectif = (value: string) =>
    setObjectifs((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));

  const submit = async () => {
    if (!form.nom || !form.typeCampagneId || !form.responsableId || !form.dateDebut || !form.dateFin) return;
    const res = await creer({
      nom: form.nom,
      description: form.description || undefined,
      typeCampagneId: Number(form.typeCampagneId),
      responsableId: Number(form.responsableId),
      dateDebut: form.dateDebut,
      dateFin: form.dateFin,
      budgetPrevu: form.budgetPrevu ? Number(form.budgetPrevu) : undefined,
      roiCible: form.roiCible ? Number(form.roiCible) : undefined,
      objectifs,
      agenceIds,
      canalIds,
      produits: [
        ...produitIds.map((produitId) => ({ produitId })),
        ...packIds.map((packId) => ({ packId })),
      ],
      brief: {
        probleme: form.probleme, cible: form.cible, message: form.message,
        offre: form.offre, zone: form.zone, resultatAttendu: form.resultatAttendu,
      },
    });
    if (res) onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Nouvelle campagne</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom de la campagne *</label>
              <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="ex : Pack Famille — Rentrée"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
              <select value={form.typeCampagneId} onChange={(e) => setForm((f) => ({ ...f, typeCampagneId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(typesRes?.data ?? []).filter((t) => t.actif).map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable *</label>
              <select value={form.responsableId} onChange={(e) => setForm((f) => ({ ...f, responsableId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(refRes?.data.utilisateurs ?? []).map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de début *</label>
              <input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin *</label>
              <input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Budget prévu (FCFA)</label>
              <input type="number" value={form.budgetPrevu} onChange={(e) => setForm((f) => ({ ...f, budgetPrevu: e.target.value }))}
                placeholder="ex : 2000000"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Objectif ROI (%) <span className="font-normal text-slate-400">(alerte §77 si non atteint)</span></label>
              <input type="number" value={form.roiCible} onChange={(e) => setForm((f) => ({ ...f, roiCible: e.target.value }))}
                placeholder="ex : 150"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Objectifs</p>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIFS.map((o) => (
                <button key={o.value} type="button" onClick={() => toggleObjectif(o.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    objectifs.includes(o.value) ? "bg-fuchsia-600 border-fuchsia-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Agences ciblées</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(refRes?.data.pdvs ?? []).map((p) => (
                <button key={p.id} type="button" onClick={() => toggle(agenceIds, setAgenceIds, p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    agenceIds.includes(p.id) ? "bg-fuchsia-600 border-fuchsia-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}>{p.nom}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Produits ciblés <span className="font-normal text-slate-400">(alerte automatique si stock insuffisant)</span></p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(refRes?.data.produits ?? []).map((p) => (
                <button key={p.id} type="button" onClick={() => toggle(produitIds, setProduitIds, p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    produitIds.includes(p.id) ? "bg-fuchsia-600 border-fuchsia-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}>{p.nom}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Packs à promouvoir</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(refRes?.data.packs ?? []).length === 0 ? (
                <span className="text-xs text-slate-400">Aucun pack actif</span>
              ) : (refRes?.data.packs ?? []).map((p) => (
                <button key={p.id} type="button" onClick={() => toggle(packIds, setPackIds, p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    packIds.includes(p.id) ? "bg-fuchsia-600 border-fuchsia-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}>{p.nom}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Canaux</p>
            <div className="flex flex-wrap gap-1.5">
              {(canauxRes?.data ?? []).filter((c) => c.actif).map((c) => (
                <button key={c.id} type="button" onClick={() => toggle(canalIds, setCanalIds, c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    canalIds.includes(c.id) ? "bg-fuchsia-600 border-fuchsia-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}>{c.libelle}</button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">Brief marketing</p>
            <div className="grid grid-cols-2 gap-3">
              <textarea value={form.probleme} onChange={(e) => setForm((f) => ({ ...f, probleme: e.target.value }))}
                placeholder="Problème à résoudre" rows={2} className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              <input value={form.cible} onChange={(e) => setForm((f) => ({ ...f, cible: e.target.value }))}
                placeholder="Cible" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                placeholder="Zone" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Message clé" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input value={form.offre} onChange={(e) => setForm((f) => ({ ...f, offre: e.target.value }))}
                placeholder="Offre" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <textarea value={form.resultatAttendu} onChange={(e) => setForm((f) => ({ ...f, resultatAttendu: e.target.value }))}
                placeholder="Résultat attendu" rows={2} className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={creating || !form.nom || !form.typeCampagneId || !form.responsableId}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer en brouillon
          </button>
        </div>
      </div>
    </div>
  );
}

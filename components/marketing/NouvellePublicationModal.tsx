"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { X, Plus, Loader2 } from "lucide-react";

interface CanalMarketing { id: number; code: string; libelle: string; actif: boolean }
interface CampagneOption { id: number; nom: string }
interface AssetOption { id: number; nom: string; url: string; categorie: string }
interface Reference {
  pdvs: { id: number; nom: string }[];
  produits: { id: number; nom: string }[];
  utilisateurs: { id: number; nom: string; prenom: string }[];
}

/** Formulaire de création d'une publication planifiée (calendrier éditorial, CDC §27-28). */
export default function NouvellePublicationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: canauxRes } = useApi<{ data: CanalMarketing[] }>("/api/admin/marketing/canaux");
  const { data: campagnesRes } = useApi<{ data: CampagneOption[] }>("/api/admin/marketing/campagnes");
  const { data: assetsRes } = useApi<{ data: AssetOption[] }>("/api/admin/marketing/assets");
  const { data: refRes } = useApi<{ data: Reference }>("/api/admin/marketing/reference");
  const { mutate: creer, loading: creating } = useMutation<{ id: number }, Record<string, unknown>>(
    "/api/admin/marketing/publications", "POST",
    { successMessage: "Publication créée", invalidate: "/api/admin/marketing/publications" }
  );

  const [form, setForm] = useState({
    texte: "", canalId: "", campagneId: "", pointDeVenteId: "", produitId: "", assetId: "",
    responsableId: "", date: "", heure: "", niveauValidationRequis: "RESPONSABLE_MARKETING",
  });
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async () => {
    if (!form.canalId) return;
    const datePublicationPrevue = form.date
      ? new Date(`${form.date}T${form.heure || "09:00"}:00`).toISOString()
      : undefined;
    const res = await creer({
      texte: form.texte || undefined,
      canalId: Number(form.canalId),
      campagneId: form.campagneId ? Number(form.campagneId) : undefined,
      pointDeVenteId: form.pointDeVenteId ? Number(form.pointDeVenteId) : undefined,
      produitId: form.produitId ? Number(form.produitId) : undefined,
      assetId: form.assetId ? Number(form.assetId) : undefined,
      responsableId: form.responsableId ? Number(form.responsableId) : undefined,
      datePublicationPrevue,
      niveauValidationRequis: form.niveauValidationRequis,
    });
    if (res) onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Nouvelle publication</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Texte</label>
            <textarea value={form.texte} onChange={set("texte")} rows={3} placeholder="Contenu de la publication…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Canal *</label>
              <select value={form.canalId} onChange={set("canalId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(canauxRes?.data ?? []).filter((c) => c.actif).map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Visuel (bibliothèque)</label>
              <select value={form.assetId} onChange={set("assetId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(assetsRes?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Campagne</label>
              <select value={form.campagneId} onChange={set("campagneId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(campagnesRes?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agence</label>
              <select value={form.pointDeVenteId} onChange={set("pointDeVenteId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(refRes?.data.pdvs ?? []).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Produit</label>
              <select value={form.produitId} onChange={set("produitId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {(refRes?.data.produits ?? []).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
              <select value={form.responsableId} onChange={set("responsableId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">Moi-même</option>
                {(refRes?.data.utilisateurs ?? []).map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date prévue</label>
              <input type="date" value={form.date} onChange={set("date")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Heure</label>
              <input type="time" value={form.heure} onChange={set("heure")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Niveau de validation requis</label>
              <select value={form.niveauValidationRequis} onChange={set("niveauValidationRequis")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="RESPONSABLE_MARKETING">Responsable Marketing (standard)</option>
                <option value="DIRECTION">Direction (contenu sensible — 2 paliers)</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={creating || !form.canalId}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

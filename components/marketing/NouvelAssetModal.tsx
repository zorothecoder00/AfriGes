"use client";

import { useState } from "react";
import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { useApi, useMutation } from "@/hooks/useApi";
import { X, Plus, Loader2, CheckCircle2 } from "lucide-react";

const UploadButton = generateUploadButton<OurFileRouter>();

interface CampagneOption { id: number; nom: string; code: string }

const CATEGORIES = [
  ["PHOTO", "Photo"], ["VIDEO", "Vidéo"], ["AFFICHE", "Affiche"], ["LOGO", "Logo"],
  ["FLYER", "Flyer"], ["BROCHURE", "Brochure"], ["CATALOGUE", "Catalogue"],
  ["VIDEO_PROMO", "Vidéo promotionnelle"], ["TEMOIGNAGE", "Témoignage"], ["AUTRE", "Autre"],
] as const;

/** Formulaire d'ajout à la bibliothèque de contenu (CDC §29) — upload via uploadthing. */
export default function NouvelAssetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: campagnesRes } = useApi<{ data: CampagneOption[] }>("/api/admin/marketing/campagnes");
  const { mutate: creer, loading: creating } = useMutation<{ id: number }, Record<string, unknown>>(
    "/api/admin/marketing/assets", "POST",
    { successMessage: "Contenu ajouté à la bibliothèque", invalidate: "/api/admin/marketing/assets" }
  );

  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("PHOTO");
  const [fichier, setFichier] = useState<{ url: string; key?: string; name: string; size: number; type: string } | null>(null);
  const [tagsTexte, setTagsTexte] = useState("");
  const [droitsUtilisation, setDroitsUtilisation] = useState("");
  const [campagneIds, setCampagneIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  const toggleCampagne = (id: number) =>
    setCampagneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!nom || !fichier) return;
    const res = await creer({
      nom, categorie, url: fichier.url, uploadthingKey: fichier.key,
      type: fichier.type, taille: fichier.size,
      tags: tagsTexte.split(",").map((t) => t.trim()).filter(Boolean),
      droitsUtilisation: droitsUtilisation || undefined,
      campagneIds,
    });
    if (res) onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">Ajouter à la bibliothèque</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fichier *</label>
            {fichier ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{fichier.name}</span>
                <button onClick={() => setFichier(null)} className="ml-auto text-emerald-500 hover:text-emerald-700 text-xs font-semibold">Changer</button>
              </div>
            ) : (
              <UploadButton
                endpoint="contenuMarketingMedia"
                onUploadBegin={() => setUploading(true)}
                onClientUploadComplete={(res) => {
                  setUploading(false);
                  const f = res?.[0];
                  if (f) setFichier({ url: f.url, key: f.key, name: f.name, size: f.size, type: f.type });
                }}
                onUploadError={(err) => { setUploading(false); console.error(err); }}
              />
            )}
            {uploading && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Envoi en cours…</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex : Affiche Ramadan 2026"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (séparés par des virgules)</label>
            <input value={tagsTexte} onChange={(e) => setTagsTexte(e.target.value)} placeholder="ex : ramadan, promo, lomé"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Droits d&apos;utilisation</label>
            <input value={droitsUtilisation} onChange={(e) => setDroitsUtilisation(e.target.value)} placeholder="ex : usage interne uniquement, licence libre…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Campagnes associées</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(campagnesRes?.data ?? []).map((c) => (
                <button key={c.id} type="button" onClick={() => toggleCampagne(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    campagneIds.includes(c.id) ? "bg-fuchsia-600 border-fuchsia-600 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}>{c.nom}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={creating || !nom || !fichier}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 font-medium">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

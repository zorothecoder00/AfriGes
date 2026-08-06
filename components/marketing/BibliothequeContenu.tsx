"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Plus, Loader2, Image as ImageIcon, FileText, Video } from "lucide-react";
import NouvelAssetModal from "@/components/marketing/NouvelAssetModal";

interface AssetItem {
  id: number; nom: string; categorie: string; url: string; type: string | null; tags: string[];
  uploadePar: { nom: string; prenom: string }; _count: { publications: number };
}

const CATEGORIE_ICON: Record<string, typeof ImageIcon> = { VIDEO: Video, VIDEO_PROMO: Video };

/** Bibliothèque de contenu (CDC §29) — grille de vignettes + upload. Partagée admin/portail. */
export default function BibliothequeContenu() {
  const { data: res, loading, refetch } = useApi<{ data: AssetItem[] }>("/api/admin/marketing/assets");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Ajouter un contenu
        </button>
      </div>
      {loading && !res ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (res?.data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <ImageIcon className="w-8 h-8 mb-2" /><p>Aucun contenu pour l&apos;instant</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {res!.data.map((a) => {
            const estImage = a.type?.startsWith("image/");
            const Icon = CATEGORIE_ICON[a.categorie] ?? FileText;
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="h-32 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {estImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.nom} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-slate-800 truncate">{a.nom}</p>
                  <p className="text-xs text-slate-400">{a.categorie} · {a._count.publications} publication(s)</p>
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {a.tags.slice(0, 3).map((t) => <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modalOpen && <NouvelAssetModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

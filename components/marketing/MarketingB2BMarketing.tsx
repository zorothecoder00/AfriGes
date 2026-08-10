"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Briefcase, Loader2, Users, ExternalLink } from "lucide-react";
import NouvelleAudienceModal from "@/components/marketing/NouvelleAudienceModal";

/** Marketing B2B (CDC §39-40) — campagnes ciblant revendeurs/grossistes/hôtels/restaurants/entreprises/institutions. */

interface Campagne { id: number; code: string; nom: string; statut: string; dateDebut: string; dateFin: string }

const CIBLES_B2B = ["Revendeurs", "Grossistes", "Hôtels", "Restaurants", "Entreprises", "Institutions", "Associations"];

export default function MarketingB2BMarketing() {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rTypes = await fetch("/api/admin/marketing/types-campagne");
      const jTypes = await rTypes.json();
      const typeB2B = (jTypes.data ?? []).find((t: { code: string }) => t.code === "B2B");
      if (!typeB2B) { setCampagnes([]); return; }
      const r = await fetch(`/api/admin/marketing/campagnes?typeCampagneId=${typeB2B.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setCampagnes(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Briefcase className="w-5 h-5 text-fuchsia-600" /> Marketing B2B</h2>
          <p className="text-sm text-slate-400">Campagnes ciblant les professionnels — pas de fiche client dédiée, l&apos;activité du client fait le tri.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Users className="w-4 h-4 text-fuchsia-500" /> Cibler une audience B2B</h3>
        <p className="text-xs text-slate-500 mb-3">
          Il n&apos;existe pas de type de client dédié pour ces profils — le filtre se fait sur le champ « Activité »
          du client (ex : « revendeur », « grossiste », « hôtel »…), via le générateur d&apos;audiences.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CIBLES_B2B.map((c) => <span key={c} className="text-[11px] px-2 py-1 rounded-full bg-fuchsia-50 text-fuchsia-700">{c}</span>)}
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Users className="w-4 h-4" /> Créer une audience B2B
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Campagnes B2B</h3>
          <Link href="/dashboard/admin/marketing/campagnes" className="text-xs text-fuchsia-600 hover:text-fuchsia-700 inline-flex items-center gap-1">
            Créer une campagne (type B2B) <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : campagnes.length === 0 ? (
            <p className="text-center text-slate-400 py-12 text-sm">Aucune campagne B2B pour l&apos;instant</p>
          ) : campagnes.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{c.nom}</p>
                <p className="text-xs text-slate-400 font-mono">{c.code}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{c.statut}</span>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && <NouvelleAudienceModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); toast.success("Audience B2B créée — visible dans l'onglet Audiences"); }} />}
    </div>
  );
}

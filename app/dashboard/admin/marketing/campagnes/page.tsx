"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Loader2, Megaphone } from "lucide-react";
import NouvelleCampagneModal from "@/components/marketing/NouvelleCampagneModal";

interface CampagneListItem {
  id: number; code: string; nom: string; statut: string; dateDebut: string; dateFin: string;
  responsable: { id: number; nom: string; prenom: string };
  typeCampagne: { libelle: string };
  budget: { montantPrevu: string | number; montantApprouve: string | number } | null;
  agences: { pointDeVente: { id: number; nom: string } }[];
  audience: { nom: string; tailleCalculee: number | null } | null;
}

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon", PLANIFIEE: "Planifiée", APPROUVEE: "Approuvée",
  ACTIVE: "Active", PAUSE: "En pause", TERMINEE: "Terminée", ARCHIVEE: "Archivée",
};
const STATUT_STYLE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600", PLANIFIEE: "bg-blue-100 text-blue-700",
  APPROUVEE: "bg-indigo-100 text-indigo-700", ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSE: "bg-amber-100 text-amber-700", TERMINEE: "bg-slate-200 text-slate-700",
  ARCHIVEE: "bg-slate-100 text-slate-400",
};

export default function CampagnesPage() {
  const [statutFiltre, setStatutFiltre] = useState("");
  const { data: res, loading, refetch } = useApi<{ data: CampagneListItem[] }>(
    `/api/admin/marketing/campagnes${statutFiltre ? `?statut=${statutFiltre}` : ""}`
  );
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campagnes</h2>
          <p className="text-slate-500 text-sm mt-0.5">Campaign Manager — création, suivi, workflow d&apos;approbation.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
            <Plus size={16} /> Nouvelle campagne
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Megaphone className="w-8 h-8 mb-2" />
            <p>Aucune campagne pour l&apos;instant</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Campagne</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Agences</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res!.data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/admin/marketing/campagnes/${c.id}`} className="font-medium text-slate-800 hover:text-fuchsia-700">{c.nom}</Link>
                    <p className="text-xs text-slate-400">{c.code} · {c.responsable.prenom} {c.responsable.nom}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.typeCampagne.libelle}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.agences.length === 0 ? "—" : c.agences.length === 1 ? c.agences[0].pointDeVente.nom : `${c.agences.length} agences`}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {c.budget ? formatCurrency(c.budget.montantPrevu) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUT_STYLE[c.statut]}`}>{STATUT_LABEL[c.statut]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && <NouvelleCampagneModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

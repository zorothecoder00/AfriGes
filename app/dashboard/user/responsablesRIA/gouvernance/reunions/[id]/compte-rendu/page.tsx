"use client";

import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { ChevronLeft, FileText, CheckCircle2, Calendar, User } from "lucide-react";
import { parseActionsCR } from "@/lib/commissionsRIA";
import { ActionsCRView } from "@/components/gouvernance/ActionsCompteRendu";

interface CompteRendu {
  id: number; decisions: string | null; recommandations: string | null;
  actionsDefinies: string | null; observations: string | null;
  dateValidation: string | null;
  validePar: { nom: string; prenom: string } | null;
  reunion: { titre: string; typeCommission: string; dateHeure: string };
}
interface Data { compteRendu: CompteRendu | null }

const SECTION_CONFIG = [
  { key: "decisions",       label: "Décisions prises",      color: "border-blue-400" },
  { key: "recommandations", label: "Recommandations",        color: "border-emerald-400" },
  { key: "actionsDefinies", label: "Actions définies",       color: "border-violet-400" },
  { key: "observations",    label: "Observations & divers",  color: "border-amber-400" },
];

export default function MembreCRPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/reunions/${id}/compte-rendu`
  );

  const cr = data?.compteRendu;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
      </div>

      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">Compte Rendu de Réunion</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !cr ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 bg-white border border-slate-200 rounded-xl">
          <FileText className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm">Compte rendu non encore disponible</p>
          <p className="text-slate-400 text-xs">Il sera publié après validation par l&apos;administrateur</p>
        </div>
      ) : (
        <>
          {/* En-tête */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-lg font-semibold text-slate-800">{cr.reunion.titre}</p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(cr.reunion.dateHeure).toLocaleDateString("fr-FR", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
            {cr.dateValidation && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-sm text-emerald-700">
                  Validé le {new Date(cr.dateValidation).toLocaleDateString("fr-FR")}
                  {cr.validePar && ` par ${cr.validePar.prenom} ${cr.validePar.nom}`}
                </p>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {SECTION_CONFIG.map(s => {
              const val = cr[s.key as keyof CompteRendu] as string | null;
              if (!val) return null;
              return (
                <div key={s.key} className={`bg-white border-l-4 ${s.color} border border-slate-200 rounded-xl p-5`}>
                  <h2 className="text-xs font-semibold text-slate-500 uppercase mb-3">{s.label}</h2>
                  {s.key === "actionsDefinies" ? (
                    <ActionsCRView actions={parseActionsCR(val)} />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-line">{val}</p>
                  )}
                </div>
              );
            })}
          </div>

          {!cr.decisions && !cr.recommandations && !cr.actionsDefinies && !cr.observations && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Le compte rendu a été créé mais aucun contenu n&apos;a encore été saisi.
            </div>
          )}
        </>
      )}
    </div>
  );
}

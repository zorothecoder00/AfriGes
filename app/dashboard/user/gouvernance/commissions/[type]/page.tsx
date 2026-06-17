"use client";

import { use } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { slugToEnum, commissionLabel, roleLabel } from "@/lib/commissionsRIA";
import {
  Shield, Users, Calendar, Gavel, ListChecks, MessageSquare,
  ArrowLeft, AlertTriangle, Pin,
} from "lucide-react";

interface Membre {
  id: number; role: string;
  user: { id: number; nom: string; prenom: string; photo: string | null };
}
interface Reunion { id: number; titre: string; dateHeure: string; statut: string; _count: { resolutions: number } }
interface Resolution { id: number; numero: string; titre: string; statut: string; dateEcheance: string | null }
interface Plan {
  id: number; titre: string; statut: string; progression: number;
  dateEcheance: string | null; priorite: string;
  responsable: { id: number; nom: string; prenom: string } | null;
}
interface Observation {
  id: number; type: string; contenu: string; epingle: boolean; createdAt: string;
  auteur: { id: number; nom: string; prenom: string };
}
interface Data {
  typeCommission: string; monRole: string | null;
  membres: Membre[]; reunions: Reunion[]; resolutions: Resolution[];
  plansAction: Plan[]; observations: Observation[];
}

const STATUT_PLAN: Record<string, string> = {
  A_FAIRE: "bg-slate-100 text-slate-600", NON_DEMARRE: "bg-slate-100 text-slate-600",
  EN_COURS: "bg-blue-100 text-blue-700", EN_RETARD: "bg-rose-100 text-rose-700",
  TERMINE: "bg-emerald-100 text-emerald-700", REALISE: "bg-emerald-100 text-emerald-700",
  ABANDONNE: "bg-slate-100 text-slate-400",
};

function roleBadge(role: string) {
  if (role === "PRESIDENT") return "bg-amber-100 text-amber-700";
  if (role.startsWith("RAPPORTEUR")) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

export default function MaCommissionDetailPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const enumType = slugToEnum(type);
  const { data, loading } = useApi<Data>(enumType ? `/api/membreCommission/commissions/${enumType}` : null);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href="/dashboard/user/gouvernance"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Mes commissions
        </Link>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          {enumType ? commissionLabel(enumType) : "Commission inconnue"}
        </h1>
        {data?.monRole && (
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(data.monRole)}`}>
            Mon rôle : {roleLabel(data.monRole)}
          </span>
        )}
      </div>

      {!enumType ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Commission introuvable</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Accès refusé — vous n&apos;êtes pas membre de cette commission</p>
        </div>
      ) : (
        <>
          {/* Membres */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Membres ({data.membres.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.membres.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {m.user.prenom[0]}{m.user.nom[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.user.prenom} {m.user.nom}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(m.role)}`}>{roleLabel(m.role)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Réunions */}
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Réunions récentes
              </h2>
              {data.reunions.length === 0 ? <p className="text-xs text-slate-400">Aucune réunion</p> : (
                <div className="space-y-2">
                  {data.reunions.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2">
                      <span className="font-medium text-slate-700 truncate">{r.titre}</span>
                      <span className="text-slate-400 shrink-0 ml-2">{new Date(r.dateHeure).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Résolutions */}
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Gavel className="w-4 h-4" /> Résolutions récentes
              </h2>
              {data.resolutions.length === 0 ? <p className="text-xs text-slate-400">Aucune résolution</p> : (
                <div className="space-y-2">
                  {data.resolutions.map(r => (
                    <div key={r.id} className="text-xs border border-slate-100 rounded-lg px-3 py-2">
                      <span className="font-mono text-slate-400">{r.numero}</span>
                      <span className="text-slate-700 ml-2">{r.titre}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Plans d'action */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> Plans d&apos;action
            </h2>
            {data.plansAction.length === 0 ? <p className="text-xs text-slate-400">Aucun plan d&apos;action</p> : (
              <div className="space-y-2">
                {data.plansAction.map(p => (
                  <div key={p.id} className="flex items-center gap-3 text-xs border border-slate-100 rounded-lg px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full ${STATUT_PLAN[p.statut] || "bg-slate-100 text-slate-600"}`}>{p.statut}</span>
                    <span className="text-slate-700 flex-1 truncate">{p.titre}</span>
                    {p.responsable && <span className="text-slate-400 shrink-0">{p.responsable.prenom} {p.responsable.nom}</span>}
                    <span className="text-slate-500 shrink-0 w-10 text-right">{p.progression}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Observations */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Collaboration récente
            </h2>
            {data.observations.length === 0 ? <p className="text-xs text-slate-400">Aucune observation</p> : (
              <div className="space-y-2">
                {data.observations.map(o => (
                  <div key={o.id} className={`text-xs rounded-lg px-3 py-2 border ${o.epingle ? "border-amber-200 bg-amber-50/40" : "border-slate-100"}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {o.epingle && <Pin className="w-3 h-3 text-amber-500" />}
                      <span className="font-medium text-slate-500">{o.type}</span>
                      <span className="text-slate-400">· {o.auteur.prenom} {o.auteur.nom}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-line">{o.contenu}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

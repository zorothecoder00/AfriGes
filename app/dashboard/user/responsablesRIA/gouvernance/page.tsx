"use client";

import { useApi } from "@/hooks/useApi";
import Link from "next/link";
import {
  Shield, Calendar, Gavel, ListChecks, FileText,
  CheckCircle2, ArrowRight, Users,
} from "lucide-react";

interface MaCommission {
  typeCommission: string;
  role: string;
  membres: { id: number; user: { id: number; nom: string; prenom: string } }[];
  prochainReunion: { id: number; titre: string; dateHeure: string } | null;
  plansAssignes: { id: number; titre: string; statut: string }[];
  nbDossiersEnCours: number;
  obsRecentes: { id: number; contenu: string; type: string; createdAt: string }[];
}

interface Data { commissions: MaCommission[] }

const COMM_LABELS: Record<string, string> = {
  FINANCE:            "Commission Finance",
  OPERATIONS_TERRAIN: "Commission Opérations Terrain",
  AUDIT:     "Commission Audit & Contrôle",
  OPTIMISATION:       "Commission Optimisation",
};

const COMM_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  FINANCE:            { bg: "bg-blue-50",    text: "text-blue-700",    bar: "bg-blue-600" },
  OPERATIONS_TERRAIN: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-600" },
  AUDIT:     { bg: "bg-amber-50",   text: "text-amber-700",   bar: "bg-amber-600" },
  OPTIMISATION:       { bg: "bg-violet-50",  text: "text-violet-700",  bar: "bg-violet-600" },
};

const ROLE_LABELS: Record<string, string> = {
  PRESIDENT:    "Président(e)",
  RAPPORTEUR_1: "Rapporteur 1",
  RAPPORTEUR_2: "Rapporteur 2",
  MEMBRE:       "Membre",
};

export default function PortailGouvernancePage() {
  const { data, loading } = useApi<Data>("/api/membreCommission/ma-commission");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" /> Gouvernance — Mes Commissions
          </h1>
          <p className="text-sm text-slate-500">Suivi de mes activités dans les commissions de gouvernance</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.commissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <Shield className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 text-sm">Vous n&apos;êtes membre d&apos;aucune commission de gouvernance</p>
          <p className="text-slate-400 text-xs mt-1">Contactez votre administrateur pour être ajouté</p>
        </div>
      ) : (
        <>
          {/* Liens rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/dashboard/user/responsablesRIA/gouvernance/reunions",     icon: Calendar,    label: "Mes réunions",  color: "text-blue-600 bg-blue-50" },
              { href: "/dashboard/user/responsablesRIA/gouvernance/plans-actions",icon: ListChecks,  label: "Mes plans",     color: "text-teal-600 bg-teal-50" },
              { href: "/dashboard/user/responsablesRIA/gouvernance/dossiers",     icon: FileText,    label: "Dossiers IC",   color: "text-violet-600 bg-violet-50" },
              { href: "/dashboard/user/responsablesRIA/gouvernance/resolutions",  icon: Gavel,       label: "Résolutions",   color: "text-emerald-600 bg-emerald-50" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">{label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 ml-auto" />
              </Link>
            ))}
          </div>

          {/* Mes commissions */}
          <div className="space-y-4">
            {data.commissions.map(c => {
              const clr = COMM_COLORS[c.typeCommission] || { bg: "bg-slate-50", text: "text-slate-700", bar: "bg-slate-600" };
              return (
                <div key={c.typeCommission} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={`px-5 py-3 ${clr.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <h2 className={`font-semibold text-sm ${clr.text}`}>
                        {COMM_LABELS[c.typeCommission] || c.typeCommission}
                      </h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-white/70 ${clr.text} font-medium`}>
                        {ROLE_LABELS[c.role] || c.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5" /> {c.membres.length} membres
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Prochaine réunion */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Prochaine réunion
                      </p>
                      {c.prochainReunion ? (
                        <div className={`p-3 rounded-lg ${clr.bg} border border-transparent`}>
                          <p className="text-xs font-medium text-slate-800 line-clamp-2">{c.prochainReunion.titre}</p>
                          <p className={`text-xs font-semibold mt-1 ${clr.text}`}>
                            {new Date(c.prochainReunion.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                            {" à "}
                            {new Date(c.prochainReunion.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Aucune réunion planifiée</p>
                      )}
                    </div>

                    {/* Activité */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Mon activité</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-slate-600"><ListChecks className="w-3.5 h-3.5" /> Plans assignés</span>
                          <span className={`font-semibold ${c.plansAssignes.length > 0 ? clr.text : "text-slate-400"}`}>{c.plansAssignes.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-slate-600"><FileText className="w-3.5 h-3.5" /> Dossiers en cours</span>
                          <span className={`font-semibold ${c.nbDossiersEnCours > 0 ? clr.text : "text-slate-400"}`}>{c.nbDossiersEnCours}</span>
                        </div>
                      </div>
                    </div>

                    {/* Observations récentes */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Observations récentes
                      </p>
                      {c.obsRecentes.length === 0 ? (
                        <p className="text-xs text-slate-400">Aucune observation</p>
                      ) : (
                        <div className="space-y-1.5">
                          {c.obsRecentes.slice(0, 2).map(o => (
                            <div key={o.id} className="text-xs text-slate-600 bg-slate-50 rounded p-2 line-clamp-2">
                              <span className="text-slate-400 font-medium">{o.type}</span> — {o.contenu}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

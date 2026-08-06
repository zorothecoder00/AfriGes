"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import { useViewAs } from "@/contexts/ViewAsContext";
import { MapPin, ShieldCheck, Clock, LogOut } from "lucide-react";
import { usePointage } from "@/hooks/usePointage";
import PointagePanel, { STATUT_CFG } from "@/components/PointagePanel";

const prettifyRole = (r?: string | null) =>
  r ? r.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null;

interface PDVInfo { id: number; nom: string; code: string }

interface AffectationResponse {
  pdv: PDVInfo | null;
  pdvs: PDVInfo[];
}

/**
 * Badge affiché dans la navbar des dashboards gestionnaires. Pour un compte
 * avec dossier RH (cas courant), c'est désormais le déclencheur du pointage du
 * jour — le nom/prénom/PDV n'y a plus sa place (déjà accessibles via "Mon
 * compte") ; on garde l'ancien badge nom+PDV uniquement en repli pour les
 * comptes sans pointage (viewAs, pas de dossier RH).
 */
export default function UserPdvBadge() {
  const { data: session } = useSession();
  const { viewAs } = useViewAs();
  const { data } = useApi<AffectationResponse>("/api/me/affectation");
  const pointage = usePointage();
  const { open, setOpen, hasProfilRH, pointageToday, peutArrivee, peutDepart } = pointage;

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, setOpen]);

  // En mode viewAs, afficher les infos du gestionnaire ciblé (pas de l'admin connecté)
  const prenom = viewAs?.prenom ?? session?.user?.prenom ?? "";
  const nom    = viewAs?.nom    ?? session?.user?.nom    ?? "";
  const pdvs   = data?.pdvs ?? (data?.pdv ? [data.pdv] : []);
  // Repli quand aucun PDV (ex. compte Admin) : afficher le rôle. Désactivé en
  // mode viewAs, où le rôle en session est celui de l'admin, pas de la cible.
  const roleLabel = !viewAs ? prettifyRole(session?.user?.gestionnaireRole ?? session?.user?.role) : null;

  if (!prenom && !nom) return null;

  // Pointage non pertinent (impersonation, ou compte sans dossier RH) → badge
  // nom/PDV classique, non interactif.
  if (viewAs || hasProfilRH === false) {
    const initiales = `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-xs shrink-0">
          {initiales}
        </div>
        <div className="hidden sm:block leading-tight">
          <p className="text-xs font-semibold text-slate-800 whitespace-nowrap">
            {prenom} {nom.toUpperCase()}
          </p>
          {pdvs.length > 0 ? (
            <p className="text-[10px] text-slate-500 flex items-center gap-0.5">
              <MapPin size={9} className="shrink-0" />
              {pdvs.length === 1 ? pdvs[0].nom : pdvs.map((p) => p.nom).join(" · ")}
            </p>
          ) : roleLabel ? (
            <p className="text-[10px] text-slate-500 flex items-center gap-0.5">
              <ShieldCheck size={9} className="shrink-0" />
              {roleLabel}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 italic">Aucun PDV</p>
          )}
        </div>
      </div>
    );
  }

  // Chargement initial du pointage : garde la place sans flash de contenu.
  if (hasProfilRH === null) {
    return <div className="w-32 h-9 bg-slate-100 rounded-xl animate-pulse" />;
  }

  const statutCfg = pointageToday ? (STATUT_CFG[pointageToday.statut] ?? STATUT_CFG.PRESENT) : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Pointage"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
          peutArrivee
            ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
            : peutDepart
              ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 animate-pulse"
              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
      >
        {peutArrivee ? (
          <><Clock className="w-4 h-4" /> Pointer arrivée</>
        ) : peutDepart ? (
          <><LogOut className="w-4 h-4" /> Pointer départ</>
        ) : (
          <span className={`flex items-center gap-1 ${statutCfg?.color ?? ""}`}>
            {statutCfg?.icon} {statutCfg?.label}
          </span>
        )}
      </button>

      {open && (
        <PointagePanel
          {...pointage}
          onClose={() => setOpen(false)}
          className="absolute right-0 mt-2 w-80 z-[200] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        />
      )}
    </div>
  );
}

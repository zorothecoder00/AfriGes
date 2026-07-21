"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Settings, LogOut, UserCircle2, ChevronDown, Package } from "lucide-react";

const prettifyRole = (r?: string | null) =>
  r ? r.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null;

const initials = (prenom?: string, nom?: string) =>
  `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase() || "?";

/**
 * Avatar flottant (haut-droite) présent sur tous les dashboards.
 * Point d'entrée clair vers les paramètres du compte + déconnexion.
 * `settingsHref` diffère selon l'espace (user vs admin).
 * `catalogueHref` (optionnel) ajoute un accès au catalogue produits en lecture
 * seule — utilisé dans l'espace gestionnaire pour que tous les rôles y accèdent.
 */
export default function AccountMenuButton({ settingsHref, catalogueHref }: { settingsHref: string; catalogueHref?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (status !== "authenticated" || !session?.user) return null;

  const u = session.user;
  const role = prettifyRole(u.gestionnaireRole ?? u.role);

  return (
    <div ref={ref} className="fixed top-3 right-3 z-[190]">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Mon compte"
        className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-lg hover:shadow-xl hover:border-slate-300 transition-all"
      >
        <span className="w-8 h-8 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold ring-1 ring-emerald-200">
          {u.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            initials(u.prenom, u.nom)
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* En-tête identité */}
          <div className="p-4 flex items-center gap-3 border-b border-slate-100">
            <span className="w-11 h-11 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold ring-1 ring-emerald-200 shrink-0">
              {u.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(u.prenom, u.nom)
              )}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{u.prenom} {u.nom}</p>
              {u.email && <p className="text-xs text-slate-400 truncate">{u.email}</p>}
              {role && <p className="text-[11px] text-emerald-600 font-medium truncate mt-0.5">{role}</p>}
            </div>
          </div>

          <div className="p-1.5">
            <Link
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" /> Paramètres du compte
            </Link>
            <Link
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <UserCircle2 className="w-4 h-4 text-slate-400" /> Mon profil &amp; photo
            </Link>
            {catalogueHref && (
              <Link
                href={catalogueHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Package className="w-4 h-4 text-slate-400" /> Catalogue produits
              </Link>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login?logout=success" })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Search, FileText, Printer, ExternalLink, LayoutGrid, Loader2, ArrowLeft, History } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { avecRetour } from "@/components/RetourLien";
import { formatDateTime } from "@/lib/format";
import { CATALOGUE_DOCUMENTS } from "@/lib/centreCommandementCatalogue";
import { inclinerCarte, redresserCarte, teinteCarte, CLASSES_CARTE_3D } from "@/lib/carte3d";

type Lien = { label: string; url: string };
type Resultat = {
  module: string;
  type: string;
  id: number;
  reference: string;
  sousLabel: string;
  statut: string | null;
  date: string;
  liens: Lien[];
};

/**
 * Centre de commandement (CDC digitalisation) — annuaire + recherche
 * transverse des documents. Rendu identique pour Admin/RPV/Chef d'agence/RVC :
 * le contenu (catalogue visible, résultats de recherche, destinations des
 * liens) s'adapte automatiquement au rôle de la session via l'API et
 * `lib/centreCommandementCatalogue.ts` (rolesGestionnaire/pageUrlParRole).
 * Chaque rôle est monté sur sa PROPRE route, sous son propre dashboard (voir
 * app/dashboard/user/{responsablesPointDeVente,chefAgence,responsablesVenteCredit}
 * /centre-commandement/page.tsx), pour ne jamais faire sortir l'utilisateur
 * de son périmètre de navigation (proxy.ts).
 */
export default function CentreCommandement() {
  const { data: session } = useSession();
  // Chaque rôle a sa propre route de centre de commandement : on la transmet aux pages de
  // destination (`?retour=`) pour que leur lien de retour revienne ici.
  const pathname = usePathname();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
  const gestionnaireRole = session?.user?.gestionnaireRole ?? null;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const searchUrl = debounced.length >= 2 ? `/api/centre-commandement/recherche?q=${encodeURIComponent(debounced)}` : null;
  const { data, loading } = useApi<{ data: Resultat[] }>(searchUrl);
  const resultats = data?.data ?? [];

  const catalogueVisible = useMemo(
    () => CATALOGUE_DOCUMENTS.filter((c) => {
      if (c.rolesRestreints && !isAdmin) return false;
      // Admin voit tout ; un gestionnaire ne voit que les documents qui le
      // concernent (évite les cartes qui renvoient vers un dashboard qui ne
      // lui est pas accessible).
      if (isAdmin || !c.rolesGestionnaire) return true;
      return !!gestionnaireRole && c.rolesGestionnaire.includes(gestionnaireRole);
    }),
    [isAdmin, gestionnaireRole]
  );

  const resoudreUrl = (item: (typeof CATALOGUE_DOCUMENTS)[number]) => {
    if (isAdmin) return item.pageUrlAdmin ?? item.pageUrl;
    if (gestionnaireRole && item.pageUrlParRole?.[gestionnaireRole]) {
      return item.pageUrlParRole[gestionnaireRole];
    }
    return item.pageUrl;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Retour au tableau de bord
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <LayoutGrid className="text-indigo-600" size={24} />
          Centre de commandement
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Point d&apos;entrée unique vers tous les documents de gestion : recherchez une référence ou un client,
          ou naviguez par module.
        </p>
        <Link href={`${pathname.replace(/\/$/, "")}/historique`} className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-indigo-600 hover:underline">
          <History size={15} /> Historique des documents
        </Link>
      </div>

      {/* Recherche globale */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une référence, un client, un téléphone… (ex : BRF-2026, REC-2026-000012, Kodjo)"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={18} />}
        </div>

        {debounced.length >= 2 && (
          <div className="mt-4">
            {!loading && resultats.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">Aucun document trouvé pour « {debounced} ».</p>
            )}
            <ul className="divide-y divide-slate-100">
              {resultats.map((r) => (
                <li key={`${r.module}-${r.type}-${r.id}`} className="py-3 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{r.type}</span>
                      {r.statut && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.statut}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      <span className="font-mono">{r.reference}</span>
                      {r.sousLabel && <span className="text-slate-400"> — {r.sousLabel}</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(r.date)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.liens.map((lien) => (
                      <a
                        key={lien.url}
                        href={lien.url.startsWith("/api/") ? lien.url : avecRetour(lien.url, pathname)}
                        target={lien.url.startsWith("/api/") ? "_blank" : undefined}
                        rel={lien.url.startsWith("/api/") ? "noreferrer" : undefined}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        {lien.url.startsWith("/api/") ? <Printer size={13} /> : <ExternalLink size={13} />}
                        {lien.label}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {debounced.length > 0 && debounced.length < 2 && (
          <p className="text-xs text-slate-400 mt-2">Saisissez au moins 2 caractères.</p>
        )}
      </div>

      {/* Annuaire par module */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText size={16} />
          Annuaire par module
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {catalogueVisible.map((item, i) => (
            <Link
              key={item.id}
              href={avecRetour(resoudreUrl(item), pathname)}
              onMouseMove={inclinerCarte}
              onMouseLeave={redresserCarte}
              className={`block rounded-xl p-4 ${CLASSES_CARTE_3D} ${teinteCarte(i)}`}
            >
              <p className="text-sm font-semibold text-white">{item.titre}</p>
              <p className="text-xs text-white/80 mt-1 leading-relaxed">{item.description}</p>
              <p className="text-[11px] text-white/60 mt-2">{item.roles.join(" · ")}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

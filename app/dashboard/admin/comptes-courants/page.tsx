"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Wallet, Search, Plus, Settings, RefreshCw, Loader2, X, ChevronRight, MapPin, Activity, ArrowLeft, Clock, Users,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import ClienteleTabBar from "@/components/ClienteleTabBar";
import CompteCourantActions from "@/components/CompteCourantActions";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";

interface CompteRow {
  id: number;  
  numeroCompte: string;  
  ribComplet: string;
  statut: string;
  typeCompte: string;
  libelle: string | null;
  solde: string | number;
  totalDepose: string | number;
  nbMouvements: number;
  dateOuverture: string;
  derniereOperationAt: string | null;
  client: {
    id: number; nom: string; prenom: string; telephone: string; codeClient: string | null;
    quartier: string | null; ville: string | null; commune: string | null;
    agentTerrain: { nom: string; prenom: string } | null;
    pointDeVente: { nom: string; code: string } | null;
  };
  agentCreateur: { nom: string; prenom: string } | null;
  _count?: { membres: number };
}
interface ComptesResponse {
  data: CompteRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type CCBadgeVariant = "success" | "warning" | "neutral" | "error";

const STATUT_CC_VARIANT: Record<string, CCBadgeVariant> = {
  ACTIF:      "success",
  SUSPENDU:   "warning",
  CLOTURE:    "neutral",
  DECEDE:     "neutral",
  BLACKLIST:  "error",
  FRAUDULEUX: "error",
};
const STATUT_CC_LABEL: Record<string, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};
const TYPE_CC_LABEL: Record<string, string> = {
  INDIVIDUEL: "Individuel", MENAGE: "Ménage", COMMUNAUTE: "Communauté", GROUPEMENT: "Groupement",
};

const N = (v: string | number) => Number(v ?? 0);

export default function ComptesCourantsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const gest = session?.user?.gestionnaireRole;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  // Capacités CC (miroir de authCompteCourant) : pilotent l'affichage des actions.
  const canDeposit = isAdmin || gest === "CHEF_AGENCE" || gest === "CAISSIER";
  const canValidate = isAdmin || gest === "CHEF_AGENCE" || gest === "RESPONSABLE_ECONOMIQUE";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");
  const [typeCompte, setTypeCompte] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const query = new URLSearchParams({
    page: String(page), limit: String(LIMIT),
    ...(search && { search }),
    ...(statut && { statut }),
    ...(typeCompte && { type: typeCompte }),
  }).toString();

  const { data: res, loading, refetch } = useApi<ComptesResponse>(`/api/comptes-courants?${query}`);
  const comptes = res?.data ?? [];
  const meta = res?.meta;

  // File d'attente des retraits à valider (uniquement pour les valideurs).
  const { data: pendingRes } = useApi<{ data: unknown[] }>(
    canValidate ? "/api/comptes-courants/retraits-en-attente" : null
  );
  const nbAValider = pendingRes?.data?.length ?? 0;

  const pageContent = (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-600" /> Comptes Courants
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Portefeuilles internes clients · épargne AfriSime</p>
          </div>
          <div className="flex items-center gap-2">
            {canValidate && (
              <Link href="/dashboard/admin/comptes-courants/a-valider"
                className="relative flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 text-sm font-medium shadow-sm">
                <Clock className="w-4 h-4" /> Retraits à valider
                {nbAValider > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-white text-amber-700 rounded-full text-xs font-bold">
                    {nbAValider}
                  </span>
                )}
              </Link>
            )}
            {isAdmin && (
              <Link href="/dashboard/admin/comptes-courants/tableau-de-bord"
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
                <Activity className="w-4 h-4" /> Tableau de bord
              </Link>
            )}
            {isAdmin && (
              <Link href="/dashboard/admin/comptes-courants/parametres"
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
                <Settings className="w-4 h-4" /> Paramètres
              </Link>
            )}
            {isAdmin && (
              <Link href="/dashboard/admin/comptes-courants/nouveau"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 text-sm font-medium">
                <Plus className="w-4 h-4" /> Nouveau compte
              </Link>
            )}
            <Button
              variant="secondary"
              onClick={refetch}
              icon={<RefreshCw className={loading ? "animate-spin" : ""} size={16} />}
            />
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
                placeholder="N° compte, nom, téléphone, communauté, zone, quartier, code client, agent…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <Button variant="primary" onClick={() => { setSearch(searchInput); setPage(1); }}>
              Chercher
            </Button>
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                icon={<X className="w-4 h-4" />}
              />
            )}
          </div>
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[160px]">
            <option value="">Tous les statuts</option>
            {Object.keys(STATUT_CC_LABEL).map((s) => <option key={s} value={s}>{STATUT_CC_LABEL[s]}</option>)}
          </select>
          <select value={typeCompte} onChange={(e) => { setTypeCompte(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[150px]">
            <option value="">Tous les types</option>
            {Object.keys(TYPE_CC_LABEL).map((t) => <option key={t} value={t}>{TYPE_CC_LABEL[t]}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…
            </div>
          ) : !comptes.length ? (
            <div className="text-center py-20">
              <Wallet className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Aucun compte courant</p>
              <p className="text-slate-300 text-sm mt-1">Ouvrez un premier compte pour un client existant</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">N° compte</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Client</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Localisation</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Solde</th>
                    <th className="text-center px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Mouv.</th>
                    <th className="text-center px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Statut</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Ouvert le</th>
                    {canDeposit && <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">Opérations</th>}
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comptes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="font-mono text-xs font-semibold text-emerald-700 hover:underline">
                          {c.numeroCompte}
                        </Link>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.ribComplet}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800 flex items-center gap-1.5">
                          {c.libelle ?? `${c.client.prenom} ${c.client.nom}`}
                          {c.typeCompte !== "INDIVIDUEL" && (
                            <Badge variant="indigo" bordered icon={<Users className="w-2.5 h-2.5" />}>
                              {TYPE_CC_LABEL[c.typeCompte] ?? c.typeCompte}{c._count?.membres ? ` ·${c._count.membres}` : ""}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.libelle ? `Représentant : ${c.client.prenom} ${c.client.nom}` : `${c.client.telephone}${c.client.codeClient ? ` · ${c.client.codeClient}` : ""}`}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />
                          {[c.client.commune, c.client.ville, c.client.quartier].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(N(c.solde))}</td>
                      <td className="px-5 py-3 text-center text-slate-500">{c.nbMouvements}</td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant={STATUT_CC_VARIANT[c.statut] ?? "neutral"} bordered>
                          {STATUT_CC_LABEL[c.statut] ?? c.statut}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">{formatDate(c.dateOuverture)}</td>
                      {canDeposit && (
                        <td className="px-5 py-3">
                          <CompteCourantActions
                            compte={{
                              id: c.id,
                              numeroCompte: c.numeroCompte,
                              statut: c.statut,
                              solde: c.solde,
                              clientNom: `${c.client.prenom} ${c.client.nom}`,
                            }}
                            onDone={refetch}
                          />
                        </td>
                      )}
                      <td className="px-5 py-3 text-right">
                        <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="text-slate-300 hover:text-emerald-600">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && (
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={setPage}
              itemLabel="compte(s)"
            />
          )}
        </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {isAdmin ? (
        <ClienteleTabBar>{pageContent}</ClienteleTabBar>
      ) : (
        <>
          <div className="bg-white border-b border-slate-200 px-6 py-3">
            <Link href="/dashboard/user" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Mon tableau de bord
            </Link>
          </div>
          {pageContent}
        </>
      )}
    </div>
  );
}

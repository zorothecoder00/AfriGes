"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, RefreshCw, UserPlus, Filter,
  Users, UserCheck, Clock, UserX,
  Building2, Briefcase, ChevronRight,
  Phone, Mail,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import KpiCard from "@/components/ui/KpiCard";
import Pagination from "@/components/ui/Pagination";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollaborateurRow {
  id:                number;
  matricule:         string;
  statut:            string;
  typeContrat:       string | null;
  fonction:          string | null;
  service:           string | null;
  departement:       string | null;
  niveauHierarchique:string | null;
  dateEmbauche:      string | null;
  gestionnaire: {
    id:   number;
    role: string;
    actif:boolean;
    member: {
      id:        number;
      nom:       string;
      prenom:    string;
      email:     string;
      telephone: string | null;
      photo:     string | null;
      affectationsPDV: { pointDeVente: { id: number; nom: string; code: string } }[];
    };
  };
  manager: {
    matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } } | null;
  } | null;
  _count: { documents: number; demandesConge: number; missions: number };
}

interface Response {
  data:  CollaborateurRow[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: { totalActifs: number; totalEnEssai: number; totalInactifs: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, BadgeVariant> = {
  ACTIF:             "success",
  EN_PERIODE_ESSAI:  "info",
  SUSPENDU:          "warning",
  DEMISSIONNAIRE:    "neutral",
  LICENCIE:          "error",
  RETRAITE:          "purple",
  INACTIF:           "neutral",
};

const STATUT_LABEL: Record<string, string> = {
  ACTIF:             "Actif",
  EN_PERIODE_ESSAI:  "Période d'essai",
  SUSPENDU:          "Suspendu",
  DEMISSIONNAIRE:    "Démissionnaire",
  LICENCIE:          "Licencié",
  RETRAITE:          "Retraité",
  INACTIF:           "Inactif",
};

const CONTRAT_BADGE: Record<string, BadgeVariant> = {
  CDI:         "success",
  CDD:         "info",
  STAGE:       "purple",
  CONSULTANT:  "warning",
  PRESTATAIRE: "teal",
  FREELANCE:   "indigo",
};

function avatarColor(statut: string) {
  if (statut === "ACTIF")            return "bg-emerald-500";
  if (statut === "EN_PERIODE_ESSAI") return "bg-primary-500";
  if (statut === "SUSPENDU")         return "bg-amber-400";
  if (statut === "DEMISSIONNAIRE")   return "bg-orange-400";
  if (statut === "LICENCIE")         return "bg-red-500";
  return "bg-slate-400";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollaborateursPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [statut,      setStatut]      = useState("");
  const [typeContrat, setTypeContrat] = useState("");
  const [page,        setPage]        = useState(1);

  const query = new URLSearchParams({
    page:  String(page),
    limit: "20",
    ...(search      && { search }),
    ...(statut      && { statut }),
    ...(typeContrat && { typeContrat }),
  }).toString();

  const { data: res, loading, refetch } = useApi<Response>(
    `/api/admin/rh/collaborateurs?${query}`
  );

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const stats = res?.stats;

  return (
    <div className="p-6 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Collaborateurs</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Dossiers RH — {res?.meta.total ?? 0} collaborateur{(res?.meta.total ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="border border-slate-200 dark:border-slate-700" title="Rafraîchir" />
            <Link
              href="/dashboard/admin/rh/collaborateurs/nouveau"
              className="inline-flex items-center gap-2 rounded-xl font-medium transition-colors px-4 py-2.5 text-sm bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Nouveau dossier
            </Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Actifs" value={stats?.totalActifs ?? 0} icon={<UserCheck size={18} />} accent="success" />
          <KpiCard label="En période d'essai" value={stats?.totalEnEssai ?? 0} icon={<Clock size={18} />} accent="primary" />
          <KpiCard label="Total effectif" value={res?.meta.total ?? 0} icon={<Users size={18} />} accent="neutral" />
          <KpiCard label="Inactifs / partis" value={stats?.totalInactifs ?? 0} icon={<UserX size={18} />} accent="error" />
        </div>

        {/* ── Filtres ── */}
        <Card>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <div className="flex-1">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Nom, prénom, matricule, email…"
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button variant="secondary" icon={<Search className="w-4 h-4" />} onClick={handleSearch} title="Rechercher" />
          </div>

          <select
            value={statut}
            onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={typeContrat}
            onChange={(e) => { setTypeContrat(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          >
            <option value="">Tous les contrats</option>
            {["CDI", "CDD", "STAGE", "CONSULTANT", "PRESTATAIRE", "FREELANCE"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Filter className="w-4 h-4" />
            {res?.meta.total ?? 0} résultat(s)
          </div>
        </div>
        </Card>

        {/* ── Tableau ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : !res?.data.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <Users className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucun collaborateur trouvé</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Collaborateur</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Matricule</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Poste / Service</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Contrat</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">PDV</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Embauche</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Docs</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {res.data.map((c) => {
                  const pdv = c.gestionnaire.member.affectationsPDV[0]?.pointDeVente;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">

                      {/* Collaborateur */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(c.statut)}`}>
                            {c.gestionnaire.member.prenom[0]}{c.gestionnaire.member.nom[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {c.gestionnaire.member.email && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  <Mail className="w-3 h-3" />
                                  {c.gestionnaire.member.email}
                                </span>
                              )}
                              {c.gestionnaire.member.telephone && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  <Phone className="w-3 h-3" />
                                  {c.gestionnaire.member.telephone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Matricule */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{c.matricule}</td>

                      {/* Poste / Service */}
                      <td className="px-4 py-3">
                        {c.fonction && (
                          <div className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            {c.fonction}
                          </div>
                        )}
                        {c.service && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{c.service}</div>
                        )}
                        {c.departement && (
                          <div className="text-xs text-slate-400 dark:text-slate-500">{c.departement}</div>
                        )}
                        {!c.fonction && !c.service && !c.departement && (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Contrat */}
                      <td className="px-4 py-3">
                        {c.typeContrat ? (
                          <Badge variant={CONTRAT_BADGE[c.typeContrat] ?? "neutral"} bordered>
                            {c.typeContrat}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* PDV */}
                      <td className="px-4 py-3">
                        {pdv ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {pdv.nom}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Embauche */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {c.dateEmbauche ? formatDate(c.dateEmbauche) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <Badge variant={STATUT_BADGE[c.statut] ?? "neutral"}>
                          {STATUT_LABEL[c.statut] ?? c.statut}
                        </Badge>
                      </td>

                      {/* Docs */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold">
                          {c._count.documents}
                        </span>
                      </td>

                      {/* Lien dossier */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/rh/collaborateurs/${c.id}`}
                          className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 whitespace-nowrap"
                        >
                          Dossier <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {res && (
          <Pagination
            page={page}
            totalPages={res.meta.totalPages}
            total={res.meta.total}
            onPageChange={setPage}
            itemLabel="collaborateur(s)"
          />
        )}

    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, RefreshCw, UserPlus, Filter,
  Users, UserCheck, Clock, UserX,
  Building2, Briefcase, ChevronRight,
  Phone, Mail, ArrowLeft,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

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

const STATUT_BADGE: Record<string, string> = {
  ACTIF:             "bg-emerald-100 text-emerald-700",
  EN_PERIODE_ESSAI:  "bg-blue-100 text-blue-700",
  SUSPENDU:          "bg-amber-100 text-amber-700",
  DEMISSIONNAIRE:    "bg-orange-100 text-orange-700",
  LICENCIE:          "bg-red-100 text-red-700",
  RETRAITE:          "bg-purple-100 text-purple-700",
  INACTIF:           "bg-gray-100 text-gray-500",
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

const CONTRAT_BADGE: Record<string, string> = {
  CDI:         "bg-emerald-50 text-emerald-700 border border-emerald-200",
  CDD:         "bg-blue-50 text-blue-700 border border-blue-200",
  STAGE:       "bg-purple-50 text-purple-700 border border-purple-200",
  CONSULTANT:  "bg-amber-50 text-amber-700 border border-amber-200",
  PRESTATAIRE: "bg-orange-50 text-orange-700 border border-orange-200",
  FREELANCE:   "bg-pink-50 text-pink-700 border border-pink-200",
};

function avatarColor(statut: string) {
  if (statut === "ACTIF")            return "bg-emerald-500";
  if (statut === "EN_PERIODE_ESSAI") return "bg-blue-500";
  if (statut === "SUSPENDU")         return "bg-amber-400";
  if (statut === "DEMISSIONNAIRE")   return "bg-orange-400";
  if (statut === "LICENCIE")         return "bg-red-500";
  return "bg-gray-400";
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
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Collaborateurs</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Dossiers RH — {res?.meta.total ?? 0} collaborateur{(res?.meta.total ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/dashboard/admin/rh/collaborateurs/nouveau"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            >
              <UserPlus className="w-4 h-4" />
              Nouveau dossier
            </Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Actifs"
            value={stats?.totalActifs ?? 0}
            icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
            bg="bg-emerald-50"
          />
          <StatCard
            label="En période d'essai"
            value={stats?.totalEnEssai ?? 0}
            icon={<Clock className="w-5 h-5 text-blue-600" />}
            bg="bg-blue-50"
          />
          <StatCard
            label="Total effectif"
            value={res?.meta.total ?? 0}
            icon={<Users className="w-5 h-5 text-slate-600" />}
            bg="bg-slate-100"
          />
          <StatCard
            label="Inactifs / partis"
            value={stats?.totalInactifs ?? 0}
            icon={<UserX className="w-5 h-5 text-red-500" />}
            bg="bg-red-50"
          />
        </div>

        {/* ── Filtres ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Nom, prénom, matricule, email…"
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          <select
            value={statut}
            onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={typeContrat}
            onChange={(e) => { setTypeContrat(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
          >
            <option value="">Tous les contrats</option>
            {["CDI", "CDD", "STAGE", "CONSULTANT", "PRESTATAIRE", "FREELANCE"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Filter className="w-4 h-4" />
            {res?.meta.total ?? 0} résultat(s)
          </div>
        </div>

        {/* ── Tableau ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : !res?.data.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucun collaborateur trouvé</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Collaborateur</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Matricule</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Poste / Service</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Contrat</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">PDV</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Embauche</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Docs</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {res.data.map((c) => {
                  const pdv = c.gestionnaire.member.affectationsPDV[0]?.pointDeVente;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">

                      {/* Collaborateur */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(c.statut)}`}>
                            {c.gestionnaire.member.prenom[0]}{c.gestionnaire.member.nom[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {c.gestionnaire.member.email && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <Mail className="w-3 h-3" />
                                  {c.gestionnaire.member.email}
                                </span>
                              )}
                              {c.gestionnaire.member.telephone && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <Phone className="w-3 h-3" />
                                  {c.gestionnaire.member.telephone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Matricule */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.matricule}</td>

                      {/* Poste / Service */}
                      <td className="px-4 py-3">
                        {c.fonction && (
                          <div className="flex items-center gap-1 text-sm text-slate-700">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            {c.fonction}
                          </div>
                        )}
                        {c.service && (
                          <div className="text-xs text-slate-400 mt-0.5">{c.service}</div>
                        )}
                        {c.departement && (
                          <div className="text-xs text-slate-400">{c.departement}</div>
                        )}
                        {!c.fonction && !c.service && !c.departement && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Contrat */}
                      <td className="px-4 py-3">
                        {c.typeContrat ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${CONTRAT_BADGE[c.typeContrat] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.typeContrat}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* PDV */}
                      <td className="px-4 py-3">
                        {pdv ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {pdv.nom}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Embauche */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {c.dateEmbauche ? formatDate(c.dateEmbauche) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[c.statut] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUT_LABEL[c.statut] ?? c.statut}
                        </span>
                      </td>

                      {/* Docs */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                          {c._count.documents}
                        </span>
                      </td>

                      {/* Lien dossier */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/rh/collaborateurs/${c.id}`}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
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
        {res && res.meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Page {res.meta.page} / {res.meta.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Précédent
              </button>
              <button
                disabled={page === res.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, bg }: {
  label: string; value: number; icon: React.ReactNode; bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

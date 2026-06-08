"use client";

import React, { useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import {
  Users, ChevronDown, ChevronRight, Building2, Search, BarChart3, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────── */
interface OrgNode {
  id: number;
  matricule: string;
  fonction: string | null;
  service: string | null;
  departement: string | null;
  niveauHierarchique: number | null;
  statut: string;
  managerId: number | null;
  gestionnaire: {
    id: number;
    member: { id: number; nom: string; prenom: string; photo: string | null } | null;
  } | null;
  _count: { subordonnes: number };
  children: OrgNode[];
}

interface OrgResponse {
  data: OrgNode[];
  flat: OrgNode[];
  statsDept: Record<string, number>;
  total: number;
}

/* ─── Helpers ────────────────────────────────────────────── */
const DEPT_COLORS = [
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "bg-red-100 text-red-700 border-red-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];

function getDeptColor(dept: string, depts: string[]) {
  const idx = depts.indexOf(dept) % DEPT_COLORS.length;
  return DEPT_COLORS[idx < 0 ? 0 : idx];
}

function getInitials(nom: string, prenom: string) {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/* ─── PersonCard ─────────────────────────────────────────── */
function PersonCard({ node, depts, highlight }: { node: OrgNode; depts: string[]; highlight: boolean }) {
  const member = node.gestionnaire?.member;
  const name = member ? `${member.prenom} ${member.nom}` : `Matricule ${node.matricule}`;
  const dept = node.departement ?? "Non défini";
  const color = getDeptColor(dept, depts);

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm p-3 w-48 flex-shrink-0 transition-all ${highlight ? "border-indigo-400 shadow-indigo-100 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-md"}`}>
      {/* Avatar */}
      <div className="flex justify-center mb-2">
        {member?.photo ? (
          <img src={member.photo} alt={name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border ${color}`}>
            {member ? getInitials(member.nom, member.prenom) : "?"}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="text-center">
        <div className="font-semibold text-gray-800 text-xs leading-tight">{name}</div>
        {node.fonction && <div className="text-xs text-gray-500 mt-0.5 truncate" title={node.fonction}>{node.fonction}</div>}
        <div className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs border ${color}`}>
          {dept}
        </div>
        {node._count.subordonnes > 0 && (
          <div className="flex items-center justify-center gap-0.5 mt-1 text-xs text-gray-400">
            <Users size={10} />
            <span>{node._count.subordonnes} subordonné{node._count.subordonnes > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── TreeNode ───────────────────────────────────────────── */
function TreeNode({ node, depts, search, level = 0 }: {
  node: OrgNode;
  depts: string[];
  search: string;
  level?: number;
}) {
  const [collapsed, setCollapsed] = useState(level > 1);
  const hasChildren = node.children && node.children.length > 0;

  const member = node.gestionnaire?.member;
  const name = member ? `${member.prenom} ${member.nom}`.toLowerCase() : node.matricule.toLowerCase();
  const highlight = search.length >= 2 && (name.includes(search.toLowerCase()) || (node.fonction ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col items-center">
      {/* Person + toggle */}
      <div className="relative">
        <PersonCard node={node} depts={depts} highlight={highlight} />
        {hasChildren && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center shadow-sm hover:border-indigo-400 hover:bg-indigo-50 z-10 transition-colors"
          >
            {collapsed ? <ChevronRight size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="mt-6 relative">
          {/* Vertical line from parent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-gray-300" style={{ top: "-24px" }} />
          {/* Horizontal bar */}
          {node.children.length > 1 && (
            <div
              className="absolute top-0 h-0.5 bg-gray-300"
              style={{
                left: `calc(${100 / (2 * node.children.length)}% )`,
                right: `calc(${100 / (2 * node.children.length)}% )`,
              }}
            />
          )}
          <div className="flex gap-6 items-start">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-0.5 h-4 bg-gray-300" />
                <TreeNode node={child} depts={depts} search={search} level={level + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── StatsPanel ─────────────────────────────────────────── */
function StatsPanel({ stats, total, depts }: { stats: Record<string, number>; total: number; depts: string[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-gray-500" />
        <h3 className="font-semibold text-gray-700 text-sm">Répartition par département</h3>
        <span className="ml-auto text-xs text-gray-500">{total} collaborateurs actifs</span>
      </div>
      <div className="space-y-2">
        {Object.entries(stats)
          .sort(([, a], [, b]) => b - a)
          .map(([dept, count]) => {
            const pct = Math.round((count / total) * 100);
            const color = getDeptColor(dept, depts);
            return (
              <div key={dept}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>{dept}</span>
                  <span className="text-xs text-gray-500">{count} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function OrganigrammePage() {
  const [search, setSearch] = useState("");
  const { data, loading } = useApi<OrgResponse>("/api/admin/rh/organigramme");

  const depts = useMemo(
    () => data ? [...new Set((data.flat ?? []).map((n) => n.departement ?? "Non défini"))] : [],
    [data]
  );

  // Flat search: highlight matching nodes across tree
  const matchingIds = useMemo(() => {
    if (!data || search.length < 2) return new Set<number>();
    const q = search.toLowerCase();
    return new Set(
      (data.flat ?? [])
        .filter((n) => {
          const member = n.gestionnaire?.member;
          const name = member ? `${member.prenom} ${member.nom}`.toLowerCase() : n.matricule.toLowerCase();
          return name.includes(q) || (n.fonction ?? "").toLowerCase().includes(q) || (n.departement ?? "").toLowerCase().includes(q);
        })
        .map((n) => n.id)
    );
  }, [data, search]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Organigramme</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {data ? `${data.total} collaborateurs actifs` : "Chargement…"}
            </p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un collaborateur…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white w-64"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-6 p-6 max-w-screen-2xl mx-auto">
        {/* Main tree */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-20 text-gray-400">Chargement de l&apos;organigramme…</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-20 text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>Aucun collaborateur actif</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-8">
              <div className="inline-flex flex-col items-start gap-16 p-6">
                {data.data.map((root) => (
                  <div key={root.id} className="relative">
                    {/* Root label */}
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                        {root.departement ?? "Direction"}
                      </span>
                    </div>
                    <TreeNode node={root} depts={depts} search={search} level={0} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar stats */}
        {data && (
          <div className="w-64 flex-shrink-0 space-y-4">
            <StatsPanel stats={data.statsDept} total={data.total} depts={depts} />
            {/* Legend */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-700 text-sm mb-3">Légende</h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-400 bg-indigo-50" />
                  <span>Résultat de recherche</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-0.5 bg-gray-300" />
                  <span>Lien hiérarchique</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-gray-50 flex items-center justify-center">
                    <ChevronDown size={9} className="text-gray-500" />
                  </div>
                  <span>Réduire / Déplier</span>
                </div>
              </div>
            </div>

            {/* Search results list */}
            {search.length >= 2 && matchingIds.size > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 text-sm mb-3">
                  {matchingIds.size} résultat(s)
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(data.flat ?? [])
                    .filter((n) => matchingIds.has(n.id))
                    .map((n) => {
                      const member = n.gestionnaire?.member;
                      return (
                        <div key={n.id} className="text-xs">
                          <div className="font-medium text-gray-700">
                            {member ? `${member.prenom} ${member.nom}` : n.matricule}
                          </div>
                          {n.fonction && <div className="text-gray-400">{n.fonction}</div>}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

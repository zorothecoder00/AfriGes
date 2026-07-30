"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import {
  Users, ChevronDown, ChevronRight, Building2, Search,
  BarChart3, GitBranch, Layers, MapPin,
  History, ArrowRight, Check, AlertCircle, RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

/* ─── Types ────────────────────────────────────────────────── */
interface PDV { id: number; nom: string; code: string }

interface OrgNode {
  id: number;
  matricule: string;
  fonction: string | null;
  service: string | null;
  departement: string | null;
  niveauHierarchique: string | null;
  statut: string;
  managerId: number | null;
  gestionnaire: {
    id: number;
    member: {
      id: number; nom: string; prenom: string; photo: string | null;
      affectationsPDV: { pointDeVente: PDV }[];
    } | null;
  } | null;
  _count: { subordonnes: number };
  children: OrgNode[];
}

interface OrgResponse {
  data: OrgNode[];
  flat: OrgNode[];
  statsDept: Record<string, number>;
  statsPDV: Record<string, number>;
  total: number;
}

interface HistoriqueItem {
  id: number;
  profilRHId: number;
  ancienManagerId: number | null;
  nouveauManagerId: number | null;
  ancienneFonction: string | null;
  nouvelleFonction: string | null;
  ancienDepartement: string | null;
  nouveauDepartement: string | null;
  motif: string | null;
  createdAt: string;
  profilRH: {
    id: number; matricule: string; fonction: string | null;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } | null } | null;
  };
  ancienManager:  { nom: string; prenom: string } | null;
  nouveauManager: { nom: string; prenom: string } | null;
}

interface HistoriqueResponse {
  data: HistoriqueItem[];
  meta: { total: number; totalPages: number };
}

type View = "hierarchique" | "fonctionnelle" | "geographique";

/* ─── Helpers ───────────────────────────────────────────────── */
const DEPT_COLORS = [
  "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800",
  "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
];

function getDeptColor(dept: string, depts: string[]) {
  const idx = depts.indexOf(dept) % DEPT_COLORS.length;
  return DEPT_COLORS[idx < 0 ? 0 : idx];
}

function getInitials(nom: string, prenom: string) {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

function fullName(node: OrgNode) {
  const m = node.gestionnaire?.member;
  return m ? `${m.prenom} ${m.nom}` : node.matricule;
}

function getPDV(node: OrgNode): string {
  return node.gestionnaire?.member?.affectationsPDV?.[0]?.pointDeVente?.nom ?? "Sans PDV";
}

/* ─── Modal de confirmation réaffectation ──────────────────── */
interface ReaffectModalProps {
  dragged: OrgNode;
  target: OrgNode | null; // null = retirer le manager
  motif: string;
  onMotifChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ReaffectModal({ dragged, target, motif, onMotifChange, onConfirm, onCancel, loading }: ReaffectModalProps) {
  return (
    <Modal open onClose={onCancel} size="sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Confirmer la réaffectation</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cette action modifie la hiérarchie et sera tracée dans l&apos;historique.
            </p>
          </div>
        </div>

        {/* Résumé du changement */}
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 mb-4 text-sm space-y-2">
          <div className="font-medium text-slate-700 dark:text-slate-200">{fullName(dragged)}</div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>Nouveau manager :</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {target ? fullName(target) : <span className="italic">Aucun (racine)</span>}
            </span>
          </div>
        </div>

        {/* Motif */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Motif (optionnel)</label>
          <textarea
            value={motif}
            onChange={(e) => onMotifChange(e.target.value)}
            placeholder="Ex : Restructuration du service commercial…"
            rows={3}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1 justify-center">
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={loading} loading={loading} icon={<Check size={14} />} className="flex-1 justify-center">
            Confirmer
          </Button>
        </div>
    </Modal>
  );
}

/* ─── PersonCard (draggable) ────────────────────────────────── */
interface PersonCardProps {
  node: OrgNode;
  depts: string[];
  highlight: boolean;
  isDragTarget: boolean;
  onDragStart: (node: OrgNode) => void;
  onDrop: (target: OrgNode) => void;
}

function PersonCard({ node, depts, highlight, isDragTarget, onDragStart, onDrop }: PersonCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const member = node.gestionnaire?.member;
  const name = fullName(node);
  const dept = node.departement ?? "Non défini";
  const color = getDeptColor(dept, depts);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(node)}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDrop(node); }}
      className={`bg-white dark:bg-slate-800 rounded-xl border-2 shadow-sm p-3 w-48 flex-shrink-0 cursor-grab active:cursor-grabbing transition-all select-none
        ${highlight   ? "border-indigo-400 dark:border-indigo-600 shadow-indigo-100 dark:shadow-none shadow-md" : ""}
        ${isDragOver  ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 shadow-emerald-100 dark:shadow-none shadow-md scale-105" : ""}
        ${!highlight && !isDragOver ? "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md" : ""}
      `}
    >
      <div className="flex justify-center mb-2">
        {member?.photo ? (
          <Image src={member.photo} alt={name} className="w-12 h-12 rounded-full object-cover" width={48} height={48} />
        ) : (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border ${color}`}>
            {member ? getInitials(member.nom, member.prenom) : "?"}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="font-semibold text-slate-800 text-xs leading-tight">{name}</div>
        {node.fonction && <div className="text-xs text-slate-500 mt-0.5 truncate" title={node.fonction}>{node.fonction}</div>}
        <div className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs border ${color}`}>{dept}</div>
        {node._count.subordonnes > 0 && (
          <div className="flex items-center justify-center gap-0.5 mt-1 text-xs text-slate-400 dark:text-slate-500">
            <Users size={10} />
            <span>{node._count.subordonnes} subordonné{node._count.subordonnes > 1 ? "s" : ""}</span>
          </div>
        )}
        {isDragTarget && (
          <div className="mt-1 text-xs text-amber-500 font-medium">En déplacement…</div>
        )}
      </div>
    </div>
  );
}

/* ─── TreeNode ──────────────────────────────────────────────── */
function TreeNode({
  node, depts, search, level = 0,
  draggedId, onDragStart, onDrop,
}: {
  node: OrgNode; depts: string[]; search: string; level?: number;
  draggedId: number | null;
  onDragStart: (n: OrgNode) => void;
  onDrop: (target: OrgNode) => void;
}) {
  const [collapsed, setCollapsed] = useState(level > 1);
  const hasChildren = node.children && node.children.length > 0;
  const name = fullName(node).toLowerCase();
  const highlight = search.length >= 2 && (
    name.includes(search.toLowerCase()) ||
    (node.fonction ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <PersonCard
          node={node} depts={depts} highlight={highlight}
          isDragTarget={draggedId === node.id}
          onDragStart={onDragStart} onDrop={onDrop}
        />
        {hasChildren && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-sm hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 z-10 transition-colors"
          >
            {collapsed ? <ChevronRight size={12} className="text-slate-500 dark:text-slate-400" /> : <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="mt-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-slate-300 dark:bg-slate-600" style={{ top: "-24px" }} />
          {node.children.length > 1 && (
            <div
              className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600"
              style={{
                left:  `calc(${100 / (2 * node.children.length)}%)`,
                right: `calc(${100 / (2 * node.children.length)}%)`,
              }}
            />
          )}
          <div className="flex gap-6 items-start">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600" />
                <TreeNode
                  node={child} depts={depts} search={search} level={level + 1}
                  draggedId={draggedId} onDragStart={onDragStart} onDrop={onDrop}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Vue Fonctionnelle ─────────────────────────────────────── */
function VueFonctionnelle({ flat, depts }: { flat: OrgNode[]; depts: string[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, OrgNode[]> = {};
    for (const n of flat) {
      const key = n.departement ?? "Non défini";
      if (!map[key]) map[key] = [];
      map[key].push(n);
    }
    return map;
  }, [flat]);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([dept, nodes]) => {
        const color = getDeptColor(dept, depts);
        return (
          <div key={dept} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border mb-4 ${color}`}>
              <Layers size={14} />
              {dept}
              <span className="ml-1 text-xs opacity-70">({nodes.length})</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {nodes.map((n) => {
                const member = n.gestionnaire?.member;
                const name = fullName(n);
                return (
                  <div key={n.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700">
                    {member?.photo ? (
                      <Image src={member.photo} alt={name} className="w-8 h-8 rounded-full object-cover" width={32} height={32} />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${color}`}>
                        {member ? getInitials(member.nom, member.prenom) : "?"}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{name}</div>
                      {n.fonction && <div className="text-xs text-slate-400 dark:text-slate-500">{n.fonction}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Vue Géographique ──────────────────────────────────────── */
function VueGeographique({ flat, depts }: { flat: OrgNode[]; depts: string[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, OrgNode[]> = {};
    for (const n of flat) {
      const key = getPDV(n);
      if (!map[key]) map[key] = [];
      map[key].push(n);
    }
    return map;
  }, [flat]);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([pdv, nodes], i) => {
        const color = DEPT_COLORS[i % DEPT_COLORS.length];
        return (
          <div key={pdv} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border mb-4 ${color}`}>
              <MapPin size={14} />
              {pdv}
              <span className="ml-1 text-xs opacity-70">({nodes.length})</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {nodes.map((n) => {
                const member = n.gestionnaire?.member;
                const name = fullName(n);
                const deptColor = getDeptColor(n.departement ?? "Non défini", depts);
                return (
                  <div key={n.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700">
                    {member?.photo ? (
                      <Image src={member.photo} alt={name} className="w-8 h-8 rounded-full object-cover" width={32} height={32} />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${deptColor}`}>
                        {member ? getInitials(member.nom, member.prenom) : "?"}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{n.departement ?? "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Panel Historique Global ───────────────────────────────── */
function HistoriqueGlobal() {
  const { data, loading } = useApi<HistoriqueResponse>("/api/admin/rh/organigramme/historique?limit=15");

  if (loading) return <div className="text-xs text-slate-400 py-4 text-center">Chargement…</div>;
  if (!data?.data?.length) return <div className="text-xs text-slate-400 py-4 text-center">Aucun mouvement enregistré</div>;

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {data.data.map((h) => {
        const collab = h.profilRH.gestionnaire?.member;
        const name = collab ? `${collab.prenom} ${collab.nom}` : h.profilRH.matricule;
        return (
          <div key={h.id} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 py-1">
            <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{name}</div>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <span>{h.ancienManager ? `${h.ancienManager.prenom} ${h.ancienManager.nom}` : "Racine"}</span>
              <ArrowRight size={10} className="text-slate-400 dark:text-slate-500" />
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                {h.nouveauManager ? `${h.nouveauManager.prenom} ${h.nouveauManager.nom}` : "Racine"}
              </span>
            </div>
            {h.motif && <div className="text-xs text-slate-400 italic mt-0.5">{h.motif}</div>}
            <div className="text-xs text-slate-300 mt-0.5">{formatDate(h.createdAt)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Stats Panel ───────────────────────────────────────────── */
function StatsPanel({ stats, total, depts }: { stats: Record<string, number>; total: number; depts: string[] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-slate-500 dark:text-slate-400" />
        <h3 className="font-semibold text-slate-700 text-sm">Par département</h3>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{total} actifs</span>
      </div>
      <div className="space-y-2">
        {Object.entries(stats).sort(([, a], [, b]) => b - a).map(([dept, count]) => {
          const pct = Math.round((count / total) * 100);
          const color = getDeptColor(dept, depts);
          return (
            <div key={dept}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>{dept}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{count} ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function OrganigrammePage() {
  const [view, setView]   = useState<View>("hierarchique");
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Drag & Drop state
  const [draggedNode, setDraggedNode] = useState<OrgNode | null>(null);
  const [dropTarget, setDropTarget]   = useState<OrgNode | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [motif, setMotif]             = useState("");

  const { data, loading, refetch } = useApi<OrgResponse>("/api/admin/rh/organigramme");
  const { mutate: reaffecter, loading: reaffectLoading } = useMutation<unknown, {
    profilRHId: number; nouveauManagerId: number | null; motif: string;
  }>("/api/admin/rh/organigramme", "PATCH");

  const depts = useMemo(
    () => data ? [...new Set((data.flat ?? []).map((n) => n.departement ?? "Non défini"))] : [],
    [data]
  );

  const matchingIds = useMemo(() => {
    if (!data || search.length < 2) return new Set<number>();
    const q = search.toLowerCase();
    return new Set(
      (data.flat ?? [])
        .filter((n) => {
          const name = fullName(n).toLowerCase();
          return name.includes(q) || (n.fonction ?? "").toLowerCase().includes(q) || (n.departement ?? "").toLowerCase().includes(q);
        })
        .map((n) => n.id)
    );
  }, [data, search]);

  // Drag handlers
  const handleDragStart = useCallback((node: OrgNode) => {
    setDraggedNode(node);
  }, []);

  const handleDrop = useCallback((target: OrgNode) => {
    if (!draggedNode) return;
    if (draggedNode.id === target.id) return;
    setDropTarget(target);
    setShowModal(true);
  }, [draggedNode]);

  const handleConfirm = async () => {
    if (!draggedNode) return;
    const res = await reaffecter({
      profilRHId:      draggedNode.id,
      nouveauManagerId: dropTarget?.id ?? null,
      motif,
    });
    if (res) {
      toast.success("Réaffectation enregistrée");
      refetch();
    } else {
      toast.error("Erreur lors de la réaffectation");
    }
    setShowModal(false);
    setDraggedNode(null);
    setDropTarget(null);
    setMotif("");
  };

  const handleCancel = () => {
    setShowModal(false);
    setDraggedNode(null);
    setDropTarget(null);
    setMotif("");
  };

  const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "hierarchique",  label: "Hiérarchique",  icon: <GitBranch size={14} /> },
    { id: "fonctionnelle", label: "Fonctionnelle",  icon: <Layers size={14} /> },
    { id: "geographique",  label: "Géographique",   icon: <MapPin size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900">
      {/* Modal réaffectation */}
      {showModal && draggedNode && (
        <ReaffectModal
          dragged={draggedNode}
          target={dropTarget}
          motif={motif}
          onMotifChange={setMotif}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={reaffectLoading}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Organigramme</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {data ? `${data.total} collaborateurs actifs` : "Chargement…"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Vue switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-900/40 rounded-xl p-1 gap-1">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      view === v.id
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>

              {/* Historique global toggle */}
              <Button
                variant={showHistory ? "primary" : "secondary"}
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                icon={<History size={14} />}
              >
                Historique
              </Button>

              {/* Recherche */}
              <div className="w-52">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  icon={<Search size={15} />}
                />
              </div>
            </div>
          </div>

          {/* Info D&D (vue hiérarchique seulement) */}
          {view === "hierarchique" && (
            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded" />
              Glissez une carte sur une autre pour modifier la hiérarchie — une confirmation sera demandée.
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6 p-6 max-w-screen-2xl mx-auto">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin" />
              Chargement de l&apos;organigramme…
            </div>
          ) : !data?.flat?.length ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>Aucun collaborateur actif</p>
            </div>
          ) : view === "hierarchique" ? (
            <div className="overflow-x-auto pb-8">
              <div className="inline-flex flex-col items-start gap-16 p-6">
                {data.data.map((root) => (
                  <div key={root.id} className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
                      <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                        {root.departement ?? "Direction"}
                      </span>
                    </div>
                    <TreeNode
                      node={root} depts={depts} search={search} level={0}
                      draggedId={draggedNode?.id ?? null}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : view === "fonctionnelle" ? (
            <VueFonctionnelle flat={data.flat} depts={depts} />
          ) : (
            <VueGeographique flat={data.flat} depts={depts} />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* Stats */}
          {data && <StatsPanel stats={data.statsDept} total={data.total} depts={depts} />}

          {/* Historique global */}
          {showHistory && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-indigo-500 dark:text-indigo-400" />
                <h3 className="font-semibold text-slate-700 text-sm">Mouvements récents</h3>
              </div>
              <HistoriqueGlobal />
            </div>
          )}

          {/* Légende */}
          {view === "hierarchique" && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">Légende</h3>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" />
                  <span>Résultat de recherche</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" />
                  <span>Zone de dépôt valide</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-0.5 bg-slate-300" />
                  <span>Lien hiérarchique</span>
                </div>
              </div>
            </div>
          )}

          {/* Résultats recherche */}
          {search.length >= 2 && matchingIds.size > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">{matchingIds.size} résultat(s)</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(data?.flat ?? []).filter((n) => matchingIds.has(n.id)).map((n) => (
                  <div key={n.id} className="text-xs">
                    <div className="font-medium text-slate-700 dark:text-slate-200">{fullName(n)}</div>
                    {n.fonction && <div className="text-slate-400 dark:text-slate-500">{n.fonction}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

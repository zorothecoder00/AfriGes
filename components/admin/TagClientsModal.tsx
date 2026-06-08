"use client";

import { useContext, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  X, Search, ExternalLink, Phone, Building2, CreditCard,
  ShoppingBag, RefreshCw, User2, AlertTriangle,
} from "lucide-react";
import { TagModalContext } from "@/contexts/TagModalContext";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClientRow {
  id:           number;
  nom:          string;
  prenom:       string;
  codeClient:   string | null;
  telephone:    string | null;
  etat:         string;
  segment:      string;
  typeClient:   string | null;
  limiteCredit: number | string | null;
  soldeActuel:  number | string | null;
  pointDeVente: { id: number; nom: string; code: string } | null;
  agentTerrain: { id: number; nom: string; prenom: string } | null;
  _count:       { souscriptionsPacks: number; ventesDirectes: number };
  tags?:        { tag: { id: number; nom: string; couleur: string } }[];
}

interface ClientsResponse {
  data: ClientRow[];
  meta: { total: number; page: number; totalPages: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase();
}
function etatColor(etat: string) {
  if (etat === "ACTIF")    return "bg-emerald-100 text-emerald-700";
  if (etat === "SUSPENDU") return "bg-amber-100 text-amber-700";
  if (etat === "BLOQUE")   return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-500";
}
function avatarColor(etat: string) {
  if (etat === "BLOQUE")   return "bg-red-500";
  if (etat === "SUSPENDU") return "bg-amber-400";
  if (etat === "INACTIF")  return "bg-gray-400";
  return "bg-emerald-500";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TagClientsModal() {
  const ctx = useContext(TagModalContext);
  const tag = ctx?.activeTag ?? null;

  // search est lié au tagId courant → se "réinitialise" automatiquement quand le tag change
  const [searchState, setSearchState] = useState<{ tagId: number | null; value: string }>(
    { tagId: null, value: "" }
  );
  const [data, setData] = useState<{
    clients: ClientRow[];
    total: number;
    tagId: number | null;
  }>({ clients: [], total: 0, tagId: null });

  // Primitif stable — évite les re-renders inutiles
  const tagId = tag?.id ?? null;

  // Valeurs dérivées — zéro setState synchrone
  const loading = tagId !== null && data.tagId !== tagId;
  const total   = data.tagId === tagId ? data.total : 0;
  // search vaut "" automatiquement quand on change de tag (aucun effet nécessaire)
  const search  = searchState.tagId === tagId ? searchState.value : "";

  // Fetch clients quand le tag change
  useEffect(() => {
    if (tagId === null) return;
    fetch(`/api/admin/clients?tagId=${tagId}&limit=200`)
      .then(r => r.json())
      .then((j: ClientsResponse) => {
        setData({ clients: j.data ?? [], total: j.meta?.total ?? (j.data?.length ?? 0), tagId });
      })
      .catch(() => setData(d => ({ ...d, tagId })));
  }, [tagId]);

  // Client-side search — clients dérivé ici pour éviter une référence [] instable hors memo
  const filtered = useMemo(() => {
    const list = data.tagId === tagId ? data.clients : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
      (c.telephone ?? "").includes(q) ||
      (c.codeClient ?? "").toLowerCase().includes(q) ||
      (c.pointDeVente?.nom ?? "").toLowerCase().includes(q)
    );
  }, [data, tagId, search]);

  if (!tag) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[200] transition-opacity"
        onClick={() => ctx?.closeTag()}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span
                className="px-3 py-1 rounded-full text-sm font-bold text-white shadow-sm"
                style={{ backgroundColor: tag.couleur }}
              >
                {tag.nom}
              </span>
              <span className="text-sm text-slate-500">
                {loading ? "…" : `${total} client${total !== 1 ? "s" : ""}`}
              </span>
            </div>
            <button
              onClick={() => ctx?.closeTag()}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Search ── */}
          <div className="px-6 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearchState({ tagId, value: e.target.value })}
                placeholder="Rechercher par nom, téléphone, code client, PDV…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Chargement…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <User2 className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {search ? "Aucun résultat pour cette recherche" : "Aucun client avec ce tag"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map(client => (
                  <ClientRowItem key={client.id} client={client} tagId={tag.id} onNavigate={() => ctx?.closeTag()} />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-400">
              {filtered.length !== total
                ? `${filtered.length} / ${total} affiché${filtered.length !== 1 ? "s" : ""}`
                : `${total} client${total !== 1 ? "s" : ""} au total`}
            </span>
            <Link
              href={`/dashboard/admin/clients?tagId=${tag.id}`}
              onClick={() => ctx?.closeTag()}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Voir dans la liste clients
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

function ClientRowItem({
  client,
  tagId,
  onNavigate,
}: {
  client: ClientRow;
  tagId: number;
  onNavigate: () => void;
}) {
  const isRIA      = client.segment === "RIA";
  const otherTags  = (client.tags ?? []).filter(t => t.tag.id !== tagId);
  const solde      = client.soldeActuel != null ? Number(client.soldeActuel) : null;
  const hasDebt    = solde !== null && solde > 0;

  return (
    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(client.etat)}`}>
        {initials(client.prenom, client.nom)}
      </div>

      {/* Identité */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {client.prenom} {client.nom}
          </span>
          {isRIA && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 leading-none flex-shrink-0">
              ★ RIA
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none flex-shrink-0 ${etatColor(client.etat)}`}>
            {client.etat === "INACTIF" ? "Archivé" : client.etat.charAt(0) + client.etat.slice(1).toLowerCase()}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {client.codeClient && (
            <span className="text-[11px] text-slate-400 font-mono">{client.codeClient}</span>
          )}
          {client.telephone && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Phone className="w-3 h-3 text-slate-400" />{client.telephone}
            </span>
          )}
          {client.pointDeVente && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Building2 className="w-3 h-3 text-slate-400" />{client.pointDeVente.nom}
            </span>
          )}
          {/* Autres tags */}
          {otherTags.slice(0, 2).map(({ tag }) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white leading-none"
              style={{ backgroundColor: tag.couleur }}
            >
              {tag.nom}
            </span>
          ))}
          {otherTags.length > 2 && (
            <span className="text-[10px] text-slate-400">+{otherTags.length - 2}</span>
          )}
        </div>
      </div>

      {/* Stats financières */}
      <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 text-right">
        {client.typeClient && (
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <CreditCard className="w-3 h-3 text-slate-400" />
            {client.typeClient}
            {client.limiteCredit != null && (
              <span className="text-slate-400 ml-0.5">
                · {Number(client.limiteCredit).toLocaleString("fr-FR")} FCFA
              </span>
            )}
          </span>
        )}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-0.5">
            <ShoppingBag className="w-3 h-3" />
            {client._count.ventesDirectes} vente{client._count.ventesDirectes !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-0.5">
            <CreditCard className="w-3 h-3" />
            {client._count.souscriptionsPacks} souscr.
          </span>
        </div>
        {hasDebt && (
          <span className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {Number(client.soldeActuel).toLocaleString("fr-FR")} FCFA dû
          </span>
        )}
      </div>

      {/* Lien fiche */}
      <Link
        href={`/dashboard/admin/clients/${client.id}`}
        onClick={onNavigate}
        className="flex-shrink-0 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
        title="Voir la fiche complète"
      >
        <ExternalLink className="w-4 h-4" />
      </Link>
    </div>
  );
}

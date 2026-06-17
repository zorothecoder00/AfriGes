"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Search } from "lucide-react";

interface ClientLite {
  id: number; nom: string; prenom: string;
  telephone?: string | null; ville?: string | null; codeClient?: string | null;
}

/**
 * Sélecteur de client par recherche nom/prénom/téléphone.
 * `apiBase` : "/api/admin/clients" (admin) ou "/api/membreCommission/clients" (membre).
 * Les deux renvoient `{ data: ClientLite[] }`.
 */
export function ClientSearchSelect({ apiBase, clientId, nom, onSelect, disabled }: {
  apiBase: string;
  clientId: number;
  nom: string;
  onSelect: (c: { id: number; nom: string }) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);

  const showSearch = !disabled && (editing || !clientId);
  const { data, loading } = useApi<{ data: ClientLite[] }>(
    showSearch && search.trim().length >= 2
      ? `${apiBase}?search=${encodeURIComponent(search.trim())}&limit=8`
      : null
  );
  const results = data?.data ?? [];

  // Lecture seule
  if (disabled) {
    return (
      <div className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 text-slate-700 truncate">
        {clientId ? `${nom || "Client"} (#${clientId})` : "—"}
      </div>
    );
  }

  // Client déjà choisi
  if (!showSearch) {
    return (
      <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1.5">
        <span className="text-sm text-slate-800 truncate flex-1">
          {nom || `Client #${clientId}`} <span className="text-slate-400 text-xs">#{clientId}</span>
        </span>
        <button type="button" onClick={() => { setEditing(true); setSearch(""); }}
          className="text-xs text-violet-600 hover:underline shrink-0">Changer</button>
      </div>
    );
  }

  // Recherche
  return (
    <div className="relative flex-1">
      <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
      <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        placeholder="Rechercher un client…" />
      {search.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-400">Recherche…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Aucun client trouvé</p>
          ) : results.map(c => (
            <button type="button" key={c.id}
              onClick={() => { onSelect({ id: c.id, nom: `${c.prenom} ${c.nom}` }); setEditing(false); setSearch(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 truncate">{c.prenom} {c.nom}</p>
                <p className="text-xs text-slate-400 truncate">
                  {[c.codeClient, c.telephone, c.ville].filter(Boolean).join(" · ") || `#${c.id}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, History, Printer, ExternalLink } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { avecRetour } from "@/components/RetourLien";
import Pagination from "@/components/ui/Pagination";
import { formatDateTime } from "@/lib/format";

/**
 * Historique des documents du Centre de commandement : chronologique, filtré par période et par
 * type, paginé. Rendu identique pour Admin/RPV/Chef d'agence/RVC — l'API adapte le périmètre au rôle.
 */

interface Lien { label: string; url: string }
interface Ligne { module: string; type: string; typeId: string; id: number; reference: string; sousLabel: string; statut: string | null; date: string; liens: Lien[] }
interface Reponse { data: Ligne[]; meta: { total: number; page: number; limit: number; totalPages: number }; types: { id: string; label: string }[] }

const inputCls = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function HistoriqueDocuments() {
  const pathname = usePathname();
  const centre = pathname.replace(/\/historique\/?$/, "");
  const aujourdhui = new Date();
  const [debut, setDebut] = useState(iso(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)));
  const [fin, setFin] = useState(iso(aujourdhui));
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debut) params.set("dateDebut", debut);
  if (fin) params.set("dateFin", fin);
  if (type) params.set("type", type);
  const { data, loading } = useApi<Reponse>(`/api/centre-commandement/historique?${params}`);
  const lignes = data?.data ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <Link href={centre} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Retour au centre de commandement
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><History className="text-indigo-600" size={24} /> Historique des documents</h1>
        <p className="text-sm text-slate-500 mt-1">Tous les documents créés sur la période, du plus récent au plus ancien.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500">Du</span>
        <input type="date" value={debut} max={fin || undefined} onChange={(e) => { setDebut(e.target.value); setPage(1); }} className={inputCls} />
        <span className="text-xs text-slate-500">au</span>
        <input type="date" value={fin} min={debut || undefined} onChange={(e) => { setFin(e.target.value); setPage(1); }} className={inputCls} />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">Tous les documents</option>
          {(data?.types ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {(debut || fin || type) && (
          <button onClick={() => { setDebut(""); setFin(""); setType(""); setPage(1); }} className="text-xs text-slate-500 hover:text-indigo-600 underline">Réinitialiser</button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading && lignes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && lignes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucun document sur cette période.</p>}
        <ul className="divide-y divide-slate-100">
          {lignes.map((l) => (
            <li key={`${l.typeId}-${l.id}`} className="px-5 py-3 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-800 text-sm">{l.reference}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{l.type}</span>
                  {l.statut && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{l.statut}</span>}
                </div>
                <p className="text-sm text-slate-600 mt-0.5 truncate">{l.sousLabel}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(l.date)}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {l.liens.map((lien) => {
                  const api = lien.url.startsWith("/api/");
                  return (
                    <a key={lien.url} href={api ? lien.url : avecRetour(lien.url, pathname)} target={api ? "_blank" : undefined} rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                      {api ? <Printer size={13} /> : <ExternalLink size={13} />} {lien.label}
                    </a>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} itemLabel="documents" />}
      </div>
    </div>
  );
}

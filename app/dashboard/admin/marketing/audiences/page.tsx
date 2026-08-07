"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { Plus, Loader2, Users, RefreshCw, Sparkles, Megaphone } from "lucide-react";
import { toast } from "sonner";
import NouvelleAudienceModal from "@/components/marketing/NouvelleAudienceModal";

interface Regle { champ: string; operateur: string; valeur: string }
interface AudienceItem {
  id: number; nom: string; description: string | null; type: string;
  tailleCalculee: number | null; dateDernierCalcul: string | null;
  regles: Regle[]; creePar: { nom: string; prenom: string };
  _count: { campagnes: number; membres: number };
}
interface SegmentRFMRow {
  segment: string; effectif: number;
  echantillon: { clientId: number; recenceJours: number; frequence: number; montantTotal: number; client: { nom: string; prenom: string; telephone: string } | null }[];
}

const SEGMENT_LABEL: Record<string, string> = {
  CHAMPIONS: "Champions", FIDELES: "Clients fidèles", GROS_ACHETEURS: "Gros acheteurs",
  NOUVEAUX: "Nouveaux clients", A_RISQUE: "Clients à risque", DORMANTS: "Clients dormants", PERDUS: "Clients perdus",
};
const SEGMENT_STYLE: Record<string, string> = {
  CHAMPIONS: "bg-amber-50 border-amber-200 text-amber-700", FIDELES: "bg-emerald-50 border-emerald-200 text-emerald-700",
  GROS_ACHETEURS: "bg-purple-50 border-purple-200 text-purple-700", NOUVEAUX: "bg-blue-50 border-blue-200 text-blue-700",
  A_RISQUE: "bg-orange-50 border-orange-200 text-orange-700", DORMANTS: "bg-slate-100 border-slate-200 text-slate-600",
  PERDUS: "bg-red-50 border-red-200 text-red-600",
};

export default function AudiencesPage() {
  const [vue, setVue] = useState<"liste" | "rfm">("liste");
  const { data: res, loading, refetch } = useApi<{ data: AudienceItem[] }>("/api/admin/marketing/audiences");
  const [modalOpen, setModalOpen] = useState(false);
  const recalculerIdRef = useRef<number | null>(null);
  const { mutate: recalculer } = useMutation<unknown, Record<string, never>>(
    () => `/api/admin/marketing/audiences/${recalculerIdRef.current}/recalculer`, "POST"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Segmentation &amp; Audiences</h2>
          <p className="text-slate-500 text-sm mt-0.5">Construisez des audiences à partir des données CRM existantes — rien n&apos;est dupliqué.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setVue("liste")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${vue === "liste" ? "bg-white shadow-sm" : "text-slate-500"}`}>Audiences</button>
            <button onClick={() => setVue("rfm")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${vue === "rfm" ? "bg-white shadow-sm" : "text-slate-500"}`}>RFM</button>
          </div>
          {vue === "liste" && (
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
              <Plus size={16} /> Nouvelle audience
            </button>
          )}
        </div>
      </div>

      {vue === "liste" ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (res?.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Users className="w-8 h-8 mb-2" /><p>Aucune audience pour l&apos;instant</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Audience</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Taille</th><th className="px-4 py-3 text-right">Campagnes</th><th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {res!.data.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{a.nom}</p>
                      <p className="text-xs text-slate-400">{a.regles.length} règle(s) · par {a.creePar.prenom} {a.creePar.nom}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.type === "STATIQUE" ? "Statique (figée)" : "Dynamique"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{a.tailleCalculee ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{a._count.campagnes}</td>
                    <td className="px-4 py-3 text-right">
                      {a.type === "DYNAMIQUE" && (
                        <button onClick={async () => { recalculerIdRef.current = a.id; if (await recalculer({})) refetch(); }}
                          title="Recalculer" className="p-1.5 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <VueRFM />
      )}

      {modalOpen && <NouvelleAudienceModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

function VueRFM() {
  const { data: res, loading, refetch } = useApi<{ data: { segments: SegmentRFMRow[]; totalClients: number } }>("/api/admin/marketing/audiences/rfm");
  const { mutate: creerReactivation, loading: creantReactivation } = useMutation<{ id: number; taille: number }, Record<string, never>>(
    "/api/admin/marketing/audiences/reactivation", "POST"
  );
  if (loading && !res) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const segments = res?.data.segments ?? [];

  const proposerReactivation = async () => {
    const r = await creerReactivation({});
    if (r) { toast.success(`Audience de réactivation créée (${r.taille} client(s)) — visible dans l'onglet Audiences`); refetch(); }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(["CHAMPIONS", "FIDELES", "GROS_ACHETEURS", "NOUVEAUX", "A_RISQUE", "DORMANTS", "PERDUS"] as const).map((seg) => {
        const row = segments.find((s) => s.segment === seg);
        return (
          <div key={seg} className={`rounded-2xl border p-4 ${SEGMENT_STYLE[seg]}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> {SEGMENT_LABEL[seg]}</p>
              <span className="text-lg font-bold">{row?.effectif ?? 0}</span>
            </div>
            <div className="mt-2 space-y-1">
              {(row?.echantillon ?? []).slice(0, 5).map((m) => (
                <p key={m.clientId} className="text-xs opacity-80 truncate">
                  {m.client ? `${m.client.prenom} ${m.client.nom}` : `Client #${m.clientId}`} — {formatCurrency(m.montantTotal)} · {m.frequence}x
                </p>
              ))}
              {(row?.effectif ?? 0) === 0 && <p className="text-xs opacity-60">Aucun client dans ce segment</p>}
            </div>
            {seg === "A_RISQUE" && (row?.effectif ?? 0) > 0 && (
              <button onClick={proposerReactivation} disabled={creantReactivation}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
                {creantReactivation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
                Créer campagne de réactivation
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

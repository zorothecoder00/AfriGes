"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { Plus, Loader2, Send, CheckCircle2, XCircle, CalendarClock, Megaphone as MegaphoneIcon } from "lucide-react";
import NouvellePublicationModal from "@/components/marketing/NouvellePublicationModal";

interface PublicationItem {
  id: number; texte: string | null; statut: string; datePublicationPrevue: string | null;
  canal: { id: number; libelle: string }; campagne: { id: number; nom: string } | null;
  responsable: { id: number; nom: string; prenom: string };
  asset: { id: number; nom: string; url: string } | null;
}

const STATUT_LABEL: Record<string, string> = {
  IDEE: "Idée", BROUILLON: "Brouillon", EN_REVISION: "En révision",
  VALIDE: "Validé", PROGRAMME: "Programmé", PUBLIE: "Publié", REJETE: "Rejeté",
};
const STATUT_STYLE: Record<string, string> = {
  IDEE: "bg-slate-100 text-slate-500", BROUILLON: "bg-slate-100 text-slate-600",
  EN_REVISION: "bg-amber-100 text-amber-700", VALIDE: "bg-indigo-100 text-indigo-700",
  PROGRAMME: "bg-blue-100 text-blue-700", PUBLIE: "bg-emerald-100 text-emerald-700",
  REJETE: "bg-red-100 text-red-700",
};
const ACTIONS_PAR_STATUT: Record<string, { action: string; label: string; icon: typeof Send; style: string }[]> = {
  BROUILLON: [{ action: "SOUMETTRE", label: "Soumettre pour validation", icon: Send, style: "bg-blue-600 hover:bg-blue-700" }],
  EN_REVISION: [
    { action: "VALIDER", label: "Valider", icon: CheckCircle2, style: "bg-indigo-600 hover:bg-indigo-700" },
    { action: "REJETER", label: "Renvoyer en brouillon", icon: XCircle, style: "bg-red-500 hover:bg-red-600" },
  ],
  VALIDE: [{ action: "PROGRAMMER", label: "Programmer", icon: CalendarClock, style: "bg-blue-600 hover:bg-blue-700" }],
  PROGRAMME: [{ action: "PUBLIER", label: "Marquer comme publié", icon: MegaphoneIcon, style: "bg-emerald-600 hover:bg-emerald-700" }],
};

/** Calendrier éditorial (CDC §27-28, §30-31) — liste filtrable + workflow. Partagé admin/portail. */
export default function CalendrierEditorial() {
  const [statutFiltre, setStatutFiltre] = useState("");
  const { data: res, loading, refetch } = useApi<{ data: PublicationItem[] }>(`/api/admin/marketing/publications${statutFiltre ? `?statut=${statutFiltre}` : ""}`);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const actionIdRef = useRef<number | null>(null);
  const { mutate: agir, loading: agissant } = useMutation<unknown, { action: string }>(
    () => `/api/admin/marketing/publications/${actionIdRef.current}/action`, "POST",
    { invalidate: "/api/admin/marketing/publications" }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouvelle publication
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune publication pour l&apos;instant</p>
        ) : res!.data.map((p) => (
          <div key={p.id}>
            <button onClick={() => setOuvert(ouvert === p.id ? null : p.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{p.texte || <span className="text-slate-400 italic">Sans texte</span>}</p>
                <p className="text-xs text-slate-400">{p.canal.libelle}{p.campagne ? ` · ${p.campagne.nom}` : ""} · {p.responsable.prenom} {p.responsable.nom}
                  {p.datePublicationPrevue ? ` · prévu ${formatDate(p.datePublicationPrevue)}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ml-2 ${STATUT_STYLE[p.statut]}`}>{STATUT_LABEL[p.statut]}</span>
            </button>
            {ouvert === p.id && (
              <div className="px-4 pb-4 bg-slate-50/50 flex gap-2 flex-wrap">
                {(ACTIONS_PAR_STATUT[p.statut] ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">Aucune action disponible pour ce statut.</p>
                ) : (ACTIONS_PAR_STATUT[p.statut] ?? []).map((a) => (
                  <button key={a.action} disabled={agissant}
                    onClick={async () => { actionIdRef.current = p.id; if (await agir({ action: a.action })) refetch(); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-semibold disabled:opacity-50 ${a.style}`}>
                    <a.icon className="w-3.5 h-3.5" /> {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {modalOpen && <NouvellePublicationModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

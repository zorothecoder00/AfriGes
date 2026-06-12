"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText, RefreshCw, Plus, ChevronRight, Calendar, Filter,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

interface RapportItem {
  id: number; portefeuilleId: number; portefeuille: string; investisseur: string;
  mois: number; annee: number; label: string; createdAt: string;
}
interface RapportsData { rapports: RapportItem[]; total: number }

interface PortefeuilleOption { id: number; reference: string; nom: string | null; investisseur: string }
interface PortefeuillesData { portefeuilles: PortefeuilleOption[] }

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const ANNEE_COURANTE = new Date().getFullYear();

export default function RapportsResponsableRIAPage() {
  const [filtreAnnee, setFiltreAnnee] = useState<string>("");
  const [filtrePF,    setFiltrePF]    = useState<string>("");
  const [showModal,   setShowModal]   = useState(false);

  const urlRapports = `/api/admin/ria/rapports${filtreAnnee ? `?annee=${filtreAnnee}` : ""}`;
  const { data, loading, error, refetch } = useApi<RapportsData>(urlRapports);
  const { data: pfData } = useApi<PortefeuillesData>("/api/admin/ria/portefeuilles");

  const liste = useMemo(() => {
    if (!data) return [];
    let l = [...data.rapports];
    if (filtrePF) l = l.filter((r) => String(r.portefeuilleId) === filtrePF);
    return l;
  }, [data, filtrePF]);

  const anneesDisponibles = useMemo(() => {
    if (!data) return [ANNEE_COURANTE];
    const set = new Set(data.rapports.map((r) => r.annee));
    set.add(ANNEE_COURANTE);
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
    </div>
  );
  if (error || !data) return (
    <div className="p-8 text-red-600">Erreur. <button onClick={refetch} className="underline">Réessayer</button></div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rapports Mensuels Investisseurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Générer et consulter les rapports par portefeuille</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Générer un rapport
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
        </div>
        <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Toutes les années</option>
          {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtrePF} onChange={(e) => setFiltrePF(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Tous les portefeuilles</option>
          {(pfData?.portefeuilles ?? []).map((pf) => (
            <option key={pf.id} value={String(pf.id)}>
              {pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}
            </option>
          ))}
        </select>
      </div>

      {liste.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun rapport disponible</p>
          <p className="text-sm text-slate-400 mt-1">Cliquez sur &quot;Générer un rapport&quot; pour créer le premier rapport mensuel.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {liste.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/user/responsablesRIA/rapports/${r.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 group-hover:text-emerald-700">{r.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.portefeuille}</p>
              </div>
              <div className="text-right text-xs text-slate-400 hidden md:block">
                <p className="font-medium text-slate-600">{r.investisseur}</p>
                <p>Généré le {new Date(r.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">{liste.length} rapport(s)</p>

      {showModal && (
        <GenererModal
          portefeuilles={pfData?.portefeuilles ?? []}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}

function GenererModal({
  portefeuilles,
  onClose,
  onSuccess,
}: {
  portefeuilles: PortefeuilleOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const now = new Date();
  const [pfId,  setPfId]  = useState<string>("");
  const [mois,  setMois]  = useState<string>(String(now.getMonth() + 1));
  const [annee, setAnnee] = useState<string>(String(now.getFullYear()));

  const { mutate, loading } = useMutation<{ data: { id: number } }, Record<string, unknown>>(
    "/api/admin/ria/rapports/generer", "POST"
  );

  async function handleGenerer() {
    if (!pfId) { toast.error("Sélectionnez un portefeuille"); return; }
    const res = await mutate({ portefeuilleId: parseInt(pfId), mois: parseInt(mois), annee: parseInt(annee) });
    if (res?.data?.id) {
      toast.success("Rapport généré avec succès");
      onSuccess();
    } else {
      toast.error("Erreur lors de la génération");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">Générer un rapport mensuel</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Portefeuille</label>
            <select value={pfId} onChange={(e) => setPfId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">— Sélectionner —</option>
              {portefeuilles.map((pf) => (
                <option key={pf.id} value={String(pf.id)}>
                  {pf.reference}{pf.nom ? ` — ${pf.nom}` : ""} ({pf.investisseur})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mois</label>
              <select value={mois} onChange={(e) => setMois(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                {MOIS_FR.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Année</label>
              <select value={annee} onChange={(e) => setAnnee(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
                {[ANNEE_COURANTE - 1, ANNEE_COURANTE, ANNEE_COURANTE + 1].map((a) => (
                  <option key={a} value={String(a)}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            Le rapport sera calculé à partir des données actuelles du portefeuille pour la période sélectionnée.
            Si un rapport existe déjà pour ce mois, il sera mis à jour.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={handleGenerer} disabled={loading || !pfId}
            className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            Générer
          </button>
        </div>
      </div>
    </div>
  );
}

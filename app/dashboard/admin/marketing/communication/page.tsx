"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { Plus, Loader2, MessageCircle } from "lucide-react";
import ModeleMessageForm, { type BlocEmailForm } from "@/components/marketing/ModeleMessageForm";

interface CanalMarketing { id: number; code: string; libelle: string; actif: boolean }
interface ModeleItem {
  id: number; nom: string; categorie: string; actif: boolean;
  canal: CanalMarketing; objet: string | null; contenuTexte: string | null; contenuBlocs: BlocEmailForm[] | null;
  creePar: { nom: string; prenom: string }; _count: { envois: number };
}
interface EnvoiItem {
  id: number; destinataire: string; statut: string; dateEnvoi: string; erreur: string | null;
  campagne: { code: string; nom: string } | null; canal: CanalMarketing;
  client: { nom: string; prenom: string }; modeleMessage: { nom: string } | null;
}

const CATEGORIE_LABEL: Record<string, string> = {
  BIENVENUE: "Bienvenue", CONFIRMATION: "Confirmation", PROMOTION: "Promotion", RELANCE: "Relance",
  FIDELISATION: "Fidélisation", ANNIVERSAIRE: "Anniversaire", REACTIVATION: "Réactivation",
  NOUVEAU_PRODUIT: "Nouveau produit", EVENEMENT: "Événement", REMERCIEMENT: "Remerciement",
  ENQUETE_SATISFACTION: "Enquête satisfaction", AUTRE: "Autre",
};
const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: "bg-slate-100 text-slate-600", ENVOYE: "bg-emerald-100 text-emerald-700",
  ECHEC: "bg-red-100 text-red-700", LIVRE: "bg-blue-100 text-blue-700",
  LU: "bg-indigo-100 text-indigo-700", REPONSE: "bg-purple-100 text-purple-700",
};

export default function CommunicationPage() {
  const [tab, setTab] = useState<"modeles" | "journal" | "parametres">("modeles");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Communication</h2>
          <p className="text-slate-500 text-sm mt-0.5">Modèles de message, journal d&apos;envoi, réglages de fréquence.</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1">
          {([["modeles", "Modèles"], ["journal", "Journal"], ["parametres", "Paramètres"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${tab === k ? "bg-white shadow-sm" : "text-slate-500"}`}>{label}</button>
          ))}
        </div>
      </div>
      {tab === "modeles" && <Modeles />}
      {tab === "journal" && <Journal />}
      {tab === "parametres" && <Parametres />}
    </div>
  );
}

function Modeles() {
  const { data: res, loading, refetch } = useApi<{ data: ModeleItem[] }>("/api/admin/marketing/modeles");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouveau modèle
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><MessageCircle className="w-8 h-8 mb-2" /><p>Aucun modèle pour l&apos;instant</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Modèle</th><th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Canal</th><th className="px-4 py-3 text-right">Envois</th><th className="px-4 py-3 text-center">Actif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res!.data.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{m.nom}</p>
                    <p className="text-xs text-slate-400">par {m.creePar.prenom} {m.creePar.nom}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{CATEGORIE_LABEL[m.categorie] ?? m.categorie}</td>
                  <td className="px-4 py-3 text-slate-600">{m.canal.libelle}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{m._count.envois}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${m.actif ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modalOpen && <ModeleMessageForm onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}

function Journal() {
  const [statutFiltre, setStatutFiltre] = useState("");
  const { data: res, loading } = useApi<{ data: EnvoiItem[] }>(`/api/admin/marketing/envois${statutFiltre ? `?statut=${statutFiltre}` : ""}`);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Tous les statuts</option>
          {Object.keys(STATUT_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun envoi pour l&apos;instant</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Client</th><th className="px-4 py-3">Campagne</th>
                <th className="px-4 py-3">Canal</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {res!.data.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{e.client.prenom} {e.client.nom}</p>
                    <p className="text-xs text-slate-400">{e.destinataire}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.campagne?.nom ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.canal.libelle}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(e.dateEnvoi)}</td>
                  <td className="px-4 py-3 text-center">
                    <span title={e.erreur ?? undefined} className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUT_STYLE[e.statut]}`}>{e.statut}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Parametres() {
  const { data: res, loading, refetch } = useApi<{ data: { maxCommunicationsParSemaine: number } }>("/api/admin/marketing/parametrage");
  const [valeur, setValeur] = useState("");
  const { mutate: enregistrer, loading: saving } = useMutation<unknown, { maxCommunicationsParSemaine: number }>(
    "/api/admin/marketing/parametrage", "PATCH", { successMessage: "Réglage enregistré", invalidate: "/api/admin/marketing/parametrage" }
  );

  if (loading && !res) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const actuel = res?.data.maxCommunicationsParSemaine ?? 3;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md">
      <h3 className="font-semibold text-slate-800 mb-1">Frequency capping</h3>
      <p className="text-xs text-slate-400 mb-4">Nombre maximum de communications marketing envoyées à un même client sur 7 jours glissants (CDC §73) — au-delà, l&apos;envoi est automatiquement bloqué.</p>
      <div className="flex items-center gap-2">
        <input type="number" min={1} placeholder={String(actuel)} value={valeur} onChange={(e) => setValeur(e.target.value)}
          className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        <span className="text-sm text-slate-500">communications / semaine / client</span>
      </div>
      <button
        onClick={async () => { const v = Number(valeur); if (v > 0 && (await enregistrer({ maxCommunicationsParSemaine: v }))) { setValeur(""); refetch(); } }}
        disabled={saving || !valeur}
        className="mt-4 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50">
        Enregistrer
      </button>
    </div>
  );
}

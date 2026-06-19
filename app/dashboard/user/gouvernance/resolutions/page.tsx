"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import { commissionLabel, reunionExploitable } from "@/lib/commissionsRIA";
import { Gavel, ListChecks, Calendar, Plus } from "lucide-react";

interface Resolution {
  id: number;
  typeCommission: string;
  numero: string;
  titre: string;
  description: string | null;
  statut: string;
  dateEcheance: string | null;
  reunion: { id: number; titre: string; dateHeure: string } | null;
  responsable: { id: number; nom: string; prenom: string } | null;
  plansAction: { id: number; statut: string; progression: number }[];
}
interface Data { resolutions: Resolution[] }
interface MaCommission { typeCommission: string; role: string }
interface MaCommData { commissions: MaCommission[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  EN_ATTENTE:     { label: "En attente",     color: "bg-slate-100 text-slate-600" },
  EN_PREPARATION: { label: "En préparation", color: "bg-slate-100 text-slate-600" },
  SOUMISE:        { label: "Soumise au vote", color: "bg-blue-100 text-blue-700" },
  APPROUVEE:      { label: "Approuvée",      color: "bg-emerald-100 text-emerald-700" },
  ADOPTEE:        { label: "Adoptée",        color: "bg-emerald-100 text-emerald-700" },
  EN_APPLICATION: { label: "En application", color: "bg-amber-100 text-amber-700" },
  APPLIQUEE:      { label: "Appliquée",      color: "bg-teal-100 text-teal-700" },
  EXECUTEE:       { label: "Exécutée",       color: "bg-teal-100 text-teal-700" },
  REJETEE:        { label: "Rejetée",        color: "bg-rose-100 text-rose-700" },
};

const REDACTEURS = ["PRESIDENT", "RAPPORTEUR_1", "RAPPORTEUR_2"];

// Actions de vote disponibles par statut (réservées au Président)
type ActDef = { action: string; label: string; danger?: boolean };
const ACTIONS_PRESIDENT: Record<string, ActDef[]> = {
  EN_PREPARATION: [{ action: "SOUMETTRE", label: "Soumettre au vote" }],
  SOUMISE: [
    { action: "ADOPTER", label: "Adopter" },
    { action: "REJETER", label: "Rejeter", danger: true },
    { action: "RETOUR_PREPARATION", label: "Renvoyer en préparation" },
  ],
  ADOPTEE: [{ action: "EXECUTER", label: "Marquer exécutée" }],
};

interface ReuLite { id: number; titre: string; dateHeure: string; typeCommission: string; statut: string }

function CreerResolutionModal({ commissions, onClose, onCreated }: {
  commissions: MaCommission[]; onClose: () => void; onCreated: () => void;
}) {
  const { mutate, loading } = useMutation("/api/membreCommission/resolutions", "POST");
  // Réunions des commissions du membre : une résolution doit en émaner (CDC).
  const { data: reuData } = useApi<{ reunions: ReuLite[] }>("/api/membreCommission/reunions");
  const [form, setForm] = useState({
    typeCommission: commissions[0]?.typeCommission ?? "",
    reunionId: "", titre: "", description: "", dateEcheance: "",
  });

  // Réunions de la commission sélectionnée, exploitables uniquement (EN_COURS / TENUE)
  // — une résolution ne peut émaner d'une réunion planifiée, annulée ou reportée.
  const reunions = (reuData?.reunions ?? [])
    .filter(r => r.typeCommission === form.typeCommission && reunionExploitable(r.statut))
    .sort((a, b) => +new Date(b.dateHeure) - +new Date(a.dateHeure));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.typeCommission || !form.titre) { toast.error("Commission et titre requis"); return; }
    if (!form.reunionId) { toast.error("Sélectionnez la réunion dont émane cette résolution"); return; }
    const res = await mutate({ ...form, reunionId: Number(form.reunionId), dateEcheance: form.dateEcheance || null });
    if (res) { toast.success("Résolution créée (en préparation)"); onCreated(); onClose(); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-800">Nouvelle résolution</h2></div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
            <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value, reunionId: "" }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              {commissions.map(c => <option key={c.typeCommission} value={c.typeCommission}>{commissionLabel(c.typeCommission)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Réunion d&apos;origine *</label>
            <select value={form.reunionId} onChange={e => setForm(f => ({ ...f, reunionId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">— Choisir la réunion —</option>
              {reunions.map(r => (
                <option key={r.id} value={r.id}>
                  {r.titre} · {new Date(r.dateHeure).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </option>
              ))}
            </select>
            {reunions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Aucune réunion en cours ou tenue pour cette commission — démarrez d&apos;abord une réunion.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Intitulé de la résolution" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" placeholder="Détails..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
            <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button type="submit" disabled={loading || reunions.length === 0} className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
            {loading ? "Création..." : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MesResolutionsPage() {
  const { data, loading, refetch } = useApi<Data>("/api/membreCommission/resolutions");
  const { data: maComm } = useApi<MaCommData>("/api/membreCommission/ma-commission");
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const resolutions = data?.resolutions ?? [];
  const roleParCommission: Record<string, string> = {};
  (maComm?.commissions ?? []).forEach(c => { roleParCommission[c.typeCommission] = c.role; });
  const commissionsRedaction = (maComm?.commissions ?? []).filter(c => REDACTEURS.includes(c.role));

  async function runAction(r: Resolution, action: string) {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/membreCommission/resolutions/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok) { toast.success("Résolution mise à jour"); refetch(); }
      else toast.error(json.error || "Erreur");
    } finally { setBusy(null); }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-emerald-600" /> Résolutions
          </h1>
          <p className="text-sm text-slate-500">Résolutions des commissions dont je suis membre</p>
        </div>
        {commissionsRedaction.length > 0 && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvelle résolution
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : resolutions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune résolution</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resolutions.map(r => {
            const estPresident = roleParCommission[r.typeCommission] === "PRESIDENT";
            const actions = estPresident ? (ACTIONS_PRESIDENT[r.statut] ?? []) : [];
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-slate-400">{r.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[r.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                        {STATUTS[r.statut]?.label || r.statut}
                      </span>
                      <span className="text-xs text-slate-400">{commissionLabel(r.typeCommission)}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">{r.titre}</h3>
                    {r.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      {r.responsable && <span>Resp. {r.responsable.prenom} {r.responsable.nom}</span>}
                      {r.plansAction.length > 0 && (
                        <span className="flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> {r.plansAction.length} plan(s)</span>
                      )}
                      {r.reunion && (
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {r.reunion.titre}</span>
                      )}
                    </div>
                  </div>
                  {r.dateEcheance && (
                    <p className="text-xs text-slate-400 shrink-0">Échéance {new Date(r.dateEcheance).toLocaleDateString("fr-FR")}</p>
                  )}
                </div>

                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    {actions.map(a => (
                      <button key={a.action} onClick={() => runAction(r, a.action)} disabled={busy === r.id}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 ${
                          a.danger ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreerResolutionModal commissions={commissionsRedaction} onClose={() => setShowModal(false)} onCreated={refetch} />
      )}
    </div>
  );
}

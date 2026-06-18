"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import { commissionLabel } from "@/lib/commissionsRIA";
import { Calendar, MapPin, CheckCircle2, FileText, Users, Plus, ChevronRight } from "lucide-react";

interface Reunion {
  id: number;
  typeCommission: string;
  titre: string;
  dateHeure: string;
  lieu: string | null;
  statut: string;
  organisateur: { nom: string; prenom: string };
  presences: { present: boolean; signatureNumerique: boolean; dateSignature: string | null }[];
  compteRenduStr: { id: number; dateValidation: string | null } | null;
  _count: { resolutions: number };
}
interface Data { reunions: Reunion[] }
interface MaCommission { typeCommission: string; role: string }
interface MaCommData { commissions: MaCommission[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  PLANIFIEE: { label: "Planifiée", color: "bg-blue-100 text-blue-700" },
  EN_COURS:  { label: "En cours",  color: "bg-emerald-100 text-emerald-700" },
  TENUE:     { label: "Tenue",     color: "bg-slate-100 text-slate-600" },
  ANNULEE:   { label: "Annulée",   color: "bg-rose-100 text-rose-700" },
  REPORTEE:  { label: "Reportée",  color: "bg-amber-100 text-amber-700" },
};

const ROLES_PREPARATION = ["PRESIDENT", "RAPPORTEUR_1"];

function CreerReunionModal({ commissions, onClose, onCreated }: {
  commissions: MaCommission[]; onClose: () => void; onCreated: () => void;
}) {
  const { mutate, loading } = useMutation("/api/membreCommission/reunions", "POST");
  const [form, setForm] = useState({
    typeCommission: commissions[0]?.typeCommission ?? "",
    titre: "", dateHeure: "", lieu: "", ordreJour: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.typeCommission || !form.titre || !form.dateHeure) { toast.error("Commission, titre et date/heure requis"); return; }
    const res = await mutate(form);
    if (res) { toast.success("Réunion créée"); onCreated(); onClose(); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-800">Nouvelle réunion</h2></div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
            <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {commissions.map(c => <option key={c.typeCommission} value={c.typeCommission}>{commissionLabel(c.typeCommission)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex. Réunion mensuelle de la commission" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date & heure *</label>
            <input type="datetime-local" value={form.dateHeure} onChange={e => setForm(f => ({ ...f, dateHeure: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lieu</label>
            <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Salle / visioconférence" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ordre du jour</label>
            <textarea rows={3} value={form.ordreJour} onChange={e => setForm(f => ({ ...f, ordreJour: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" placeholder="Points à aborder..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {loading ? "Création..." : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MesReunionsPage() {
  const router = useRouter();
  const { data, loading, refetch } = useApi<Data>("/api/membreCommission/reunions");
  const { data: maComm } = useApi<MaCommData>("/api/membreCommission/ma-commission");
  const [showModal, setShowModal] = useState(false);

  const reunions = data?.reunions ?? [];
  const commissionsPreparation = (maComm?.commissions ?? []).filter(c => ROLES_PREPARATION.includes(c.role));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> Mes réunions
          </h1>
          <p className="text-sm text-slate-500">Réunions des commissions dont je suis membre</p>
        </div>
        {commissionsPreparation.length > 0 && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouvelle réunion
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reunions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune réunion</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reunions.map(r => {
            const maPresence = r.presences[0];
            return (
              <button key={r.id} onClick={() => router.push(`/dashboard/user/gouvernance/reunions/${r.id}`)}
                className="w-full text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[r.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                        {STATUTS[r.statut]?.label || r.statut}
                      </span>
                      <span className="text-xs text-slate-400">{commissionLabel(r.typeCommission)}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">{r.titre}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(r.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {r.lieu && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {r.lieu}</span>}
                      <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {r._count.resolutions} résolutions</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {r.organisateur.prenom} {r.organisateur.nom}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <div className="text-right space-y-1">
                      {maPresence ? (
                        maPresence.signatureNumerique ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Présence signée
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500">À signer</span>
                        )
                      ) : (
                        <span className="text-xs text-slate-300">Pas convoqué</span>
                      )}
                      {r.compteRenduStr?.dateValidation && (
                        <p className="text-xs text-teal-600">Compte rendu validé</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreerReunionModal commissions={commissionsPreparation} onClose={() => setShowModal(false)} onCreated={refetch} />
      )}
    </div>
  );
}

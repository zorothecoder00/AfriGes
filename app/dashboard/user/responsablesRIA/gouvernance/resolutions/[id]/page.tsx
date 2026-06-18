"use client";

import { useParams, useRouter } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { useState } from "react";
import { toast } from "sonner";
import {
  Gavel, ChevronLeft, RefreshCw, Plus, CheckCircle2,
  XCircle, Clock, Circle, PlayCircle, ListChecks, Calendar, User,
} from "lucide-react";

interface Resolution {
  id: number; numero: string; titre: string; description: string | null;
  typeCommission: string; statut: string; dateEcheance: string | null;
  createdAt: string;
  reunion: { id: number; titre: string; dateHeure: string } | null;
  responsable: { id: number; nom: string; prenom: string } | null;
  plansAction: {
    id: number; titre: string; statut: string; priorite: string;
    progression: number; dateEcheance: string | null;
    responsable: { nom: string; prenom: string } | null;
  }[];
}

const STATUT_RES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_ATTENTE:     { label: "En attente",     color: "bg-slate-100 text-slate-600",     icon: <Circle className="w-3.5 h-3.5" /> },
  APPROUVEE:      { label: "Approuvée",      color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  EN_APPLICATION: { label: "En application", color: "bg-blue-100 text-blue-700",       icon: <Clock className="w-3.5 h-3.5" /> },
  APPLIQUEE:      { label: "Appliquée",      color: "bg-teal-100 text-teal-700",       icon: <PlayCircle className="w-3.5 h-3.5" /> },
  REJETEE:        { label: "Rejetée",        color: "bg-rose-100 text-rose-700",       icon: <XCircle className="w-3.5 h-3.5" /> },
};
const STATUT_PLAN: Record<string, { label: string; color: string }> = {
  A_FAIRE:   { label: "À faire",    color: "bg-slate-100 text-slate-600" },
  EN_COURS:  { label: "En cours",   color: "bg-blue-100 text-blue-700" },
  TERMINE:   { label: "Terminé",    color: "bg-emerald-100 text-emerald-700" },
  ABANDONNE: { label: "Abandonné",  color: "bg-rose-100 text-rose-700" },
};
const PRIORITE_COLOR: Record<string, string> = {
  CRITIQUE: "text-rose-600", HAUTE: "text-amber-600", MOYENNE: "text-blue-600", BASSE: "text-slate-400",
};

export default function ResolutionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [refresh, setRefresh] = useState(0);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ titre: "", description: "", priorite: "MOYENNE", dateEcheance: "" });

  const { data: res, loading } = useApi<Resolution>(
    `/api/admin/ria/commissions/gouvernance/resolutions/${id}?_r=${refresh}`
  );
  const { mutate: patchRes } = useMutation(
    `/api/admin/ria/commissions/gouvernance/resolutions/${id}`, "PATCH"
  );
  const { mutate: creerPlan, loading: creating } = useMutation(
    `/api/admin/ria/commissions/gouvernance/plans-actions`, "POST"
  );

  async function changerStatut(statut: string) {
    const r = await patchRes({ statut }) as { id?: number; error?: string } | null;
    if (r?.id) { toast.success("Statut mis à jour"); setRefresh(x => x + 1); }
    else toast.error(r?.error || "Erreur");
  }

  async function changerStatutPlan(planId: number, statut: string) {
    const r = await fetch(`/api/admin/ria/commissions/gouvernance/plans-actions/${planId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    const json = await r.json();
    if (json.id) { toast.success("Statut mis à jour"); setRefresh(x => x + 1); }
    else toast.error(json.error || "Erreur");
  }

  async function soumettrePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!res) return;
    const r = await creerPlan({
      typeCommission: res.typeCommission,
      resolutionId: res.id,
      titre: planForm.titre,
      description: planForm.description,
      priorite: planForm.priorite,
      dateEcheance: planForm.dateEcheance || null,
    }) as { id?: number; error?: string } | null;
    if (r?.id) {
      toast.success("Plan d\'action créé");
      setShowPlanForm(false);
      setPlanForm({ titre: "", description: "", priorite: "MOYENNE", dateEcheance: "" });
      setRefresh(x => x + 1);
    } else toast.error(r?.error || "Erreur");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!res) return (
    <div className="flex flex-col items-center justify-center h-60 gap-3">
      <XCircle className="w-10 h-10 text-slate-300" />
      <p className="text-slate-500">Résolution introuvable</p>
      <button onClick={() => router.back()} className="text-emerald-600 text-sm hover:underline">Retour</button>
    </div>
  );

  const s = STATUT_RES[res.statut] ?? { label: res.statut, color: "bg-slate-100 text-slate-600", icon: null };
  const plans = res.plansAction ?? [];
  const termines = plans.filter(p => p.statut === "TERMINE").length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => router.push("/dashboard/user/responsablesRIA/gouvernance/resolutions")}
          className="flex items-center gap-1 hover:text-emerald-600">
          <ChevronLeft className="w-4 h-4" /> Résolutions
        </button>
        <span>/</span>
        <span className="font-mono text-xs">{res.numero}</span>
        <button onClick={() => setRefresh(r => r + 1)} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* En-tête résolution */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-mono text-slate-400">{res.numero}</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${s.color}`}>
                {s.icon} {s.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">{res.titre}</h1>
            {res.description && (
              <p className="text-sm text-slate-500 mt-1.5">{res.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Créée le</p>
              <p className="font-medium">{new Date(res.createdAt).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
          {res.dateEcheance && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs text-slate-400">Échéance</p>
                <p className={`font-medium ${new Date(res.dateEcheance) < new Date() && res.statut !== "APPLIQUEE" ? "text-rose-600" : ""}`}>
                  {new Date(res.dateEcheance).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          )}
          {res.responsable && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Responsable</p>
                <p className="font-medium">{res.responsable.prenom} {res.responsable.nom}</p>
              </div>
            </div>
          )}
        </div>

        {res.reunion && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Issue de la réunion : <strong>{res.reunion.titre}</strong> ({new Date(res.reunion.dateHeure).toLocaleDateString("fr-FR")})</span>
          </div>
        )}

        {/* Workflow statuts */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Workflow — changer le statut</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUT_RES).map(([val, cfg]) => (
              <button key={val} onClick={() => changerStatut(val)}
                disabled={res.statut === val}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  res.statut === val
                    ? `${cfg.color} border-current cursor-default`
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                }`}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plans d'action */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-violet-500" />
            <h2 className="font-semibold text-slate-800">Plans d&apos;action</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {termines}/{plans.length} réalisés
            </span>
          </div>
          <button onClick={() => setShowPlanForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5" /> Nouveau plan
          </button>
        </div>

        {showPlanForm && (
          <form onSubmit={soumettrePlan} className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 text-sm">Créer un plan d&apos;action</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
              <input value={planForm.titre} onChange={e => setPlanForm(f => ({ ...f, titre: e.target.value }))}
                required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder='Ex. Réduire les impayés de 15%' />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
                <select value={planForm.priorite} onChange={e => setPlanForm(f => ({ ...f, priorite: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="CRITIQUE">Critique</option>
                  <option value="HAUTE">Haute</option>
                  <option value="MOYENNE">Moyenne</option>
                  <option value="BASSE">Basse</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
                <input type="date" value={planForm.dateEcheance} onChange={e => setPlanForm(f => ({ ...f, dateEcheance: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPlanForm(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button type="submit" disabled={creating} className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {creating ? "Création..." : "Créer"}
              </button>
            </div>
          </form>
        )}

        {plans.length === 0 && !showPlanForm ? (
          <div className="flex flex-col items-center justify-center h-28 gap-2 bg-white border border-slate-200 rounded-xl">
            <ListChecks className="w-7 h-7 text-slate-200" />
            <p className="text-slate-400 text-sm">Aucun plan d&apos;action — cliquez sur &quot;Nouveau plan&quot; pour en créer un</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(p => {
              const ps = STATUT_PLAN[p.statut] ?? { label: p.statut, color: "bg-slate-100 text-slate-600" };
              const pct = Math.min(100, Math.max(0, Number(p.progression ?? 0)));
              const isLate = p.dateEcheance && new Date(p.dateEcheance) < new Date() && p.statut !== "TERMINE";
              return (
                <div key={p.id} className={`bg-white border rounded-xl p-5 ${isLate ? "border-rose-200" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-slate-800">{p.titre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ps.color}`}>{ps.label}</span>
                        <span className={`text-xs font-semibold ${PRIORITE_COLOR[p.priorite] ?? "text-slate-400"}`}>{p.priorite}</span>
                      </div>
                      {p.responsable && (
                        <p className="text-xs text-slate-400">Responsable : {p.responsable.prenom} {p.responsable.nom}</p>
                      )}
                    </div>
                    {p.dateEcheance && (
                      <p className={`text-xs flex-shrink-0 ${isLate ? "text-rose-600 font-semibold" : "text-slate-400"}`}>
                        {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}{isLate && " ⚠"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-400" : "bg-violet-400"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(STATUT_PLAN).map(([val, cfg]) => (
                      <button key={val} onClick={() => changerStatutPlan(p.id, val)}
                        disabled={p.statut === val}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          p.statut === val ? `${cfg.color} border-current cursor-default` : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

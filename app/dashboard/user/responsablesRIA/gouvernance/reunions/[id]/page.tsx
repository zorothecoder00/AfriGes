"use client";

import { useParams, useRouter } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar, MapPin, Clock, Users, FileText, CheckCircle2, XCircle,
  ChevronLeft, RefreshCw, Plus, Send, Archive,
  ClipboardList, Gavel, ListChecks,
} from "lucide-react";

/* ─── Types ─── */
interface Presence {
  id: number; present: boolean; procuration: boolean;
  signatureNumerique: boolean; dateSignature: string | null; notes: string | null;
  membre: { id: number; role: string; user: { id: number; nom: string; prenom: string } };
}
interface Resolution {
  id: number; numero: string; titre: string; description: string | null;
  statut: string; dateEcheance: string | null;
  responsable: { id: number; nom: string; prenom: string } | null;
  plansAction: { id: number; statut: string; progression: number }[];
}
interface PlanAction {
  id: number; titre: string; description: string | null;
  statut: string; priorite: string; progression: number;
  dateEcheance: string | null;
  responsable: { id: number; nom: string; prenom: string } | null;
  resolution: { id: number; numero: string; titre: string } | null;
}
interface CompteRendu {
  id: number; decisions: string | null; recommandations: string | null;
  actionsDefinies: string | null; observations: string | null;
  dateValidation: string | null;
  validePar: { id: number; nom: string; prenom: string } | null;
}
interface Reunion {
  id: number; titre: string; typeCommission: string; dateHeure: string;
  lieu: string | null; statut: string; ordreJour: string | null;
  convocationEnvoyee: boolean; type: string;
  organisateur: { id: number; nom: string; prenom: string };
  presences: Presence[];
  resolutions: Resolution[];
  plansAction: PlanAction[];
}

/* ─── Constantes ─── */
const COMM_LABEL: Record<string, string> = {
  FINANCE: "Finance", OPERATIONS_TERRAIN: "Opérations Terrain",
  AUDIT: "Audit & Contrôle", OPTIMISATION: "Optimisation",
};
const STATUT_REUNION: Record<string, { label: string; color: string }> = {
  PLANIFIEE: { label: "Planifiée",  color: "bg-blue-100 text-blue-700" },
  EN_COURS:  { label: "En cours",   color: "bg-emerald-100 text-emerald-700" },
  TENUE:     { label: "Tenue",      color: "bg-slate-100 text-slate-600" },
  ANNULEE:   { label: "Annulée",    color: "bg-rose-100 text-rose-700" },
  REPORTEE:  { label: "Reportée",   color: "bg-amber-100 text-amber-700" },
};
const STATUT_RES: Record<string, { label: string; color: string }> = {
  EN_ATTENTE:     { label: "En attente",     color: "bg-slate-100 text-slate-600" },
  APPROUVEE:      { label: "Approuvée",      color: "bg-emerald-100 text-emerald-700" },
  EN_APPLICATION: { label: "En application", color: "bg-blue-100 text-blue-700" },
  APPLIQUEE:      { label: "Appliquée",      color: "bg-teal-100 text-teal-700" },
  REJETEE:        { label: "Rejetée",        color: "bg-rose-100 text-rose-700" },
};
const STATUT_PLAN: Record<string, { label: string; color: string }> = {
  NON_DEMARRE: { label: "Non démarré", color: "bg-slate-100 text-slate-600" },
  A_FAIRE:     { label: "Non démarré", color: "bg-slate-100 text-slate-600" },
  EN_COURS:    { label: "En cours",    color: "bg-blue-100 text-blue-700" },
  REALISE:     { label: "Réalisé",     color: "bg-emerald-100 text-emerald-700" },
  TERMINE:     { label: "Réalisé",     color: "bg-emerald-100 text-emerald-700" },
  EN_RETARD:   { label: "En retard",   color: "bg-rose-100 text-rose-700" },
  ABANDONNE:   { label: "Abandonné",   color: "bg-slate-100 text-slate-400" },
};
const STATUT_PLAN_BOUTONS = ["NON_DEMARRE", "EN_COURS", "REALISE", "ABANDONNE"] as const;
const PRIORITE_COLOR: Record<string, string> = {
  CRITIQUE: "text-rose-600",
  HAUTE:    "text-amber-600",
  MOYENNE:  "text-blue-600",
  BASSE:    "text-slate-500",
};

/* ─── Onglet Convocation ─── */
function OngletConvocation({ r, onRefresh }: { r: Reunion; onRefresh: () => void }) {
  const { mutate: patcher, loading } = useMutation(`/api/admin/ria/commissions/gouvernance/reunions/${r.id}`, "PATCH");

  async function changerStatut(statut: string) {
    const res = await patcher({ statut }) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Statut mis à jour"); onRefresh(); }
    else toast.error(res?.error || "Erreur");
  }

  const s = STATUT_REUNION[r.statut] ?? { label: r.statut, color: "bg-slate-100 text-slate-600" };

  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{r.titre}</h2>
            <p className="text-sm text-slate-500">{COMM_LABEL[r.typeCommission] ?? r.typeCommission} · {r.type}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium flex-shrink-0 ${s.color}`}>{s.label}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-medium">{new Date(r.dateHeure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(r.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{r.lieu || "Lieu non défini"}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <Users className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <span>Organisé par {r.organisateur.prenom} {r.organisateur.nom}</span>
          </div>
        </div>

        {/* Ordre du jour */}
        {r.ordreJour && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Ordre du jour
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{r.ordreJour}</p>
          </div>
        )}
      </div>

      {/* Actions statut */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Changer le statut</p>
        <div className="flex flex-wrap gap-2">
          {r.statut === "PLANIFIEE" && (
            <>
              <button onClick={() => changerStatut("EN_COURS")} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> Démarrer la réunion
              </button>
              <button onClick={() => changerStatut("ANNULEE")} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-200 disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" /> Annuler
              </button>
              <button onClick={() => changerStatut("REPORTEE")} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-200 disabled:opacity-50">
                <Calendar className="w-3.5 h-3.5" /> Reporter
              </button>
            </>
          )}
          {r.statut === "EN_COURS" && (
            <button onClick={() => changerStatut("TENUE")} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">
              <Archive className="w-3.5 h-3.5" /> Clôturer la réunion
            </button>
          )}
          {(r.statut === "TENUE" || r.statut === "ANNULEE" || r.statut === "REPORTEE") && (
            <p className="text-sm text-slate-400 italic">Réunion {STATUT_REUNION[r.statut]?.label.toLowerCase()} — aucune action disponible</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Onglet Présences ─── */
function OngletPresences({ r, onRefresh }: { r: Reunion; onRefresh: () => void }) {
  const { mutate: patchPresences, loading } = useMutation(
    `/api/admin/ria/commissions/gouvernance/reunions/${r.id}/presences`, "POST"
  );

  async function marquer(membreId: number, present: boolean) {
    const existing = r.presences.find(p => p.membre.id === membreId);
    const res = await patchPresences({
      presencesData: [{ membreId, present, procuration: existing?.procuration ?? false }]
    }) as { success?: boolean; error?: string } | null;
    if (res?.success) { toast.success(present ? "Présence enregistrée" : "Absence enregistrée"); onRefresh(); }
    else toast.error(res?.error || "Erreur");
  }

  const presents = r.presences.filter(p => p.present).length;
  const absents  = r.presences.filter(p => !p.present && !p.signatureNumerique).length;
  const signes   = r.presences.filter(p => p.signatureNumerique).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{presents}</p>
          <p className="text-xs text-emerald-600">Présents</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{absents}</p>
          <p className="text-xs text-rose-600">Absents</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{signes}</p>
          <p className="text-xs text-blue-600">Signatures numériques</p>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Feuille de présence</h3>
        </div>
        {r.presences.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Users className="w-8 h-8 text-slate-200" />
            <p className="text-slate-400 text-sm">Aucune présence enregistrée</p>
            <p className="text-slate-400 text-xs">Les membres doivent être ajoutés à la commission</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {r.presences.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.present ? "bg-emerald-500" : "bg-rose-400"}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {p.membre.user.prenom} {p.membre.user.nom}
                    </p>
                    <p className="text-xs text-slate-400">{p.membre.role.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {p.signatureNumerique ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Signé {p.dateSignature ? new Date(p.dateSignature).toLocaleDateString("fr") : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Non signé</span>
                  )}
                  {p.procuration && (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Procuration</span>
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={() => marquer(p.membre.id, true)} disabled={loading || p.present}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                        p.present ? "bg-emerald-100 text-emerald-700 cursor-default" : "bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
                      }`}>
                      Présent
                    </button>
                    <button onClick={() => marquer(p.membre.id, false)} disabled={loading || (!p.present && !p.signatureNumerique)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                        !p.present && !p.signatureNumerique ? "bg-rose-100 text-rose-700 cursor-default" : "bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700"
                      }`}>
                      Absent
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note signature */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <strong>Signature numérique :</strong> chaque membre peut signer sa présence depuis son portail (Gouvernance → Réunions).
        La signature génère un token cryptographique horodaté.
      </div>
    </div>
  );
}

/* ─── Onglet Compte Rendu ─── */
function OngletCompteRendu({ reunionId }: { reunionId: number }) {
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<{ compteRendu: CompteRendu | null }>(
    `/api/admin/ria/commissions/gouvernance/reunions/${reunionId}/compte-rendu?_r=${refresh}`
  );
  const { mutate: sauvegarder, loading: saving } = useMutation(
    `/api/admin/ria/commissions/gouvernance/reunions/${reunionId}/compte-rendu`, "PUT"
  );

  const cr = data?.compteRendu;
  const [form, setForm] = useState<{
    decisions: string; recommandations: string; actionsDefinies: string; observations: string;
  }>({ decisions: "", recommandations: "", actionsDefinies: "", observations: "" });
  const [loaded, setLoaded] = useState(false);

  if (!loaded && cr !== undefined) {
    setForm({
      decisions:      cr?.decisions      ?? "",
      recommandations:cr?.recommandations ?? "",
      actionsDefinies:cr?.actionsDefinies ?? "",
      observations:   cr?.observations   ?? "",
    });
    setLoaded(true);
  }

  async function save(valider = false) {
    const res = await sauvegarder({ ...form, valider }) as { id?: number; error?: string } | null;
    if (res?.id) {
      toast.success(valider ? "Compte rendu validé" : "Compte rendu sauvegardé");
      setRefresh(r => r + 1);
      setLoaded(false);
    } else toast.error(res?.error || "Erreur");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {cr?.dateValidation && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700">
            Validé le {new Date(cr.dateValidation).toLocaleDateString("fr")} par {cr.validePar?.prenom} {cr.validePar?.nom}
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {[
          { key: "decisions",       label: "Décisions prises",          placeholder: "Listez les décisions adoptées lors de cette réunion..." },
          { key: "recommandations", label: "Recommandations",           placeholder: "Recommandations formulées par la commission..." },
          { key: "actionsDefinies", label: "Actions définies",          placeholder: "Actions à entreprendre suite à cette réunion (responsable, délai)..." },
          { key: "observations",    label: "Observations & divers",     placeholder: "Autres points abordés, observations complémentaires..." },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">{f.label}</label>
            <textarea
              value={form[f.key as keyof typeof form]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              disabled={!!cr?.dateValidation}
              rows={4}
              placeholder={f.placeholder}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        ))}

        {!cr?.dateValidation && (
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => save(false)} disabled={saving}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              {saving ? "Sauvegarde..." : "Sauvegarder (brouillon)"}
            </button>
            <button onClick={() => save(true)} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Valider le compte rendu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Onglet Résolutions ─── */
function OngletResolutions({ r }: { r: Reunion }) {
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh]   = useState(0);
  const { data, loading } = useApi<{ resolutions: Resolution[] }>(
    `/api/admin/ria/commissions/gouvernance/resolutions?typeCommission=${r.typeCommission}&_r=${refresh}`
  );
  const { mutate: creer, loading: creating } = useMutation(
    `/api/admin/ria/commissions/gouvernance/resolutions`, "POST"
  );

  const [form, setForm] = useState({ titre: "", description: "", dateEcheance: "" });

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const res = await creer({
      typeCommission: r.typeCommission,
      reunionId: r.id,
      titre: form.titre,
      description: form.description,
      dateEcheance: form.dateEcheance || null,
    }) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Résolution créée"); setShowForm(false); setRefresh(x => x + 1); setForm({ titre: "", description: "", dateEcheance: "" }); }
    else toast.error(res?.error || "Erreur");
  }

  async function changerStatut(id: number, statut: string) {
    const res = await fetch(`/api/admin/ria/commissions/gouvernance/resolutions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
    });
    const json = await res.json();
    if (json.id) { toast.success("Statut mis à jour"); setRefresh(x => x + 1); }
    else toast.error(json.error || "Erreur");
  }

  const resolutions = data?.resolutions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{resolutions.length} résolution(s) pour cette commission</p>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Nouvelle résolution
        </button>
      </div>

      {showForm && (
        <form onSubmit={soumettre} className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm">Nouvelle résolution</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Titre de la résolution" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Détails de la résolution..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
            <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={creating} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {creating ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : resolutions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 bg-white border border-slate-200 rounded-xl">
          <Gavel className="w-8 h-8 text-slate-200" />
          <p className="text-slate-400 text-sm">Aucune résolution enregistrée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resolutions.map(res => {
            const s = STATUT_RES[res.statut] ?? { label: res.statut, color: "bg-slate-100 text-slate-600" };
            const plans = res.plansAction ?? [];
            const termines = plans.filter(p => p.statut === "TERMINE").length;
            return (
              <div key={res.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{res.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </div>
                    <p className="font-medium text-slate-800">{res.titre}</p>
                    {res.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{res.description}</p>}
                    {res.responsable && (
                      <p className="text-xs text-slate-400 mt-1">Responsable : {res.responsable.prenom} {res.responsable.nom}</p>
                    )}
                    {plans.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">{termines}/{plans.length} plans d&apos;action exécutés</p>
                    )}
                  </div>
                  {res.dateEcheance && (
                    <p className="text-xs text-slate-400 flex-shrink-0">Échéance : {new Date(res.dateEcheance).toLocaleDateString("fr")}</p>
                  )}
                </div>

                {/* Boutons statut */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STATUT_RES).map(([val, cfg]) => (
                    <button key={val} onClick={() => changerStatut(res.id, val)}
                      disabled={res.statut === val}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        res.statut === val ? `${cfg.color} border-current cursor-default` : "border-slate-200 text-slate-500 hover:bg-slate-50"
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
  );
}

/* ─── Onglet Plans d'Action ─── */
function OngletPlansAction({ r }: { r: Reunion }) {
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Tâches issues de cette réunion (CDC : création automatique de tâches après réunion)
  const { data, loading } = useApi<{ plans: PlanAction[] }>(
    `/api/admin/ria/commissions/gouvernance/plans-actions?reunionId=${r.id}&_r=${refresh}`
  );
  const { mutate: creer, loading: creating } = useMutation(
    `/api/admin/ria/commissions/gouvernance/plans-actions`, "POST"
  );

  const membresAssignables = r.presences.map(p => p.membre.user);
  const [form, setForm] = useState({ titre: "", description: "", priorite: "MOYENNE", responsableId: "", dateEcheance: "", progression: "0" });

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const res = await creer({
      typeCommission: r.typeCommission,
      reunionId: r.id,
      titre: form.titre,
      description: form.description,
      priorite: form.priorite,
      responsableId: form.responsableId || null,
      dateEcheance: form.dateEcheance || null,
      progression: Number(form.progression),
    }) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Tâche créée"); setShowForm(false); setRefresh(x => x + 1); setForm({ titre: "", description: "", priorite: "MOYENNE", responsableId: "", dateEcheance: "", progression: "0" }); }
    else toast.error(res?.error || "Erreur");
  }

  async function changerStatut(id: number, statut: string) {
    const res = await fetch(`/api/admin/ria/commissions/gouvernance/plans-actions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
    });
    const json = await res.json();
    if (json.id) { toast.success("Statut mis à jour"); setRefresh(x => x + 1); }
    else toast.error(json.error || "Erreur");
  }

  async function changerProgression(id: number, progression: number) {
    await fetch(`/api/admin/ria/commissions/gouvernance/plans-actions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progression }),
    });
    setRefresh(x => x + 1);
  }

  const plans = data?.plans ?? [];
  const estFini = (s: string) => ["TERMINE", "REALISE", "ABANDONNE"].includes(s);
  const termines = plans.filter(p => p.statut === "TERMINE" || p.statut === "REALISE").length;
  const enRetard = plans.filter(p => p.dateEcheance && new Date(p.dateEcheance) < new Date() && !estFini(p.statut)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm text-slate-500">
          <span>{plans.length} tâche(s) issue(s) de la réunion</span>
          <span className="text-emerald-600">{termines} réalisée(s)</span>
          {enRetard > 0 && <span className="text-rose-600">{enRetard} en retard</span>}
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">
          <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
        </button>
      </div>

      {showForm && (
        <form onSubmit={soumettre} className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm">Nouvelle tâche issue de la réunion</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder='Ex. Réduire les impayés de 15%' />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
              <select value={form.responsableId} onChange={e => setForm(f => ({ ...f, responsableId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">— Non assigné —</option>
                {membresAssignables.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
              <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="CRITIQUE">Critique</option>
                <option value="HAUTE">Haute</option>
                <option value="MOYENNE">Moyenne</option>
                <option value="BASSE">Basse</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
              <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Progression (%)</label>
              <input type="number" min={0} max={100} value={form.progression} onChange={e => setForm(f => ({ ...f, progression: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={creating} className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {creating ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 bg-white border border-slate-200 rounded-xl">
          <ListChecks className="w-8 h-8 text-slate-200" />
          <p className="text-slate-400 text-sm">Aucune tâche définie pour cette réunion</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(p => {
            const pct = Math.min(100, Math.max(0, Number(p.progression ?? 0)));
            const isLate = !!p.dateEcheance && new Date(p.dateEcheance) < new Date() && !estFini(p.statut);
            const s = isLate ? STATUT_PLAN.EN_RETARD : (STATUT_PLAN[p.statut] ?? { label: p.statut, color: "bg-slate-100 text-slate-600" });
            return (
              <div key={p.id} className={`bg-white border rounded-xl p-5 ${isLate ? "border-rose-200" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-slate-800">{p.titre}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                      <span className={`text-xs font-semibold ${PRIORITE_COLOR[p.priorite] ?? "text-slate-500"}`}>{p.priorite}</span>
                    </div>
                    {p.description && <p className="text-sm text-slate-500 line-clamp-2">{p.description}</p>}
                    {p.resolution && (
                      <p className="text-xs text-slate-400 mt-0.5">Lié à {p.resolution.numero} — {p.resolution.titre}</p>
                    )}
                    {p.responsable && (
                      <p className="text-xs text-slate-400">Responsable : {p.responsable.prenom} {p.responsable.nom}</p>
                    )}
                  </div>
                  {p.dateEcheance && (
                    <p className={`text-xs flex-shrink-0 ${isLate ? "text-rose-600 font-semibold" : "text-slate-400"}`}>
                      Échéance : {new Date(p.dateEcheance).toLocaleDateString("fr")}
                      {isLate && " ⚠"}
                    </p>
                  )}
                </div>

                {/* Barre de progression */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-400" : "bg-violet-400"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                </div>

                {/* Contrôles */}
                <div className="flex items-center gap-2 flex-wrap">
                  {STATUT_PLAN_BOUTONS.map(val => {
                    const cfg = STATUT_PLAN[val];
                    return (
                      <button key={val} onClick={() => changerStatut(p.id, val)}
                        disabled={p.statut === val}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          p.statut === val ? `${cfg.color} border-current cursor-default` : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Avancement :</span>
                    <input type="number" min={0} max={100} defaultValue={pct}
                      onBlur={e => changerProgression(p.id, Number(e.target.value))}
                      className="w-14 border border-slate-200 rounded px-2 py-0.5 text-xs text-right" />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ─── */
const TABS = [
  { id: "convocation", label: "Convocation",     icon: Calendar },
  { id: "presences",   label: "Présences",        icon: Users },
  { id: "cr",          label: "Compte Rendu",     icon: FileText },
  { id: "resolutions", label: "Résolutions",      icon: Gavel },
  { id: "plans",       label: "Plans d'action",   icon: ListChecks },
];

export default function ReunionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [tab, setTab]     = useState("convocation");
  const [refresh, setRefresh] = useState(0);

  const { data: reunion, loading } = useApi<Reunion>(
    `/api/admin/ria/commissions/gouvernance/reunions/${id}?_r=${refresh}`
  );

  function onRefresh() { setRefresh(r => r + 1); }

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!reunion) return (
    <div className="flex flex-col items-center justify-center h-60 gap-3">
      <XCircle className="w-10 h-10 text-slate-300" />
      <p className="text-slate-500">Réunion introuvable</p>
      <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">Retour</button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => router.push("/dashboard/user/responsablesRIA/gouvernance/reunions")}
          className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft className="w-4 h-4" /> Réunions
        </button>
        <span>/</span>
        <span className="text-slate-800 font-medium line-clamp-1">{reunion.titre}</span>
        <button onClick={onRefresh} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0.5 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
                {t.id === "presences" && (
                  <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {reunion.presences.length}
                  </span>
                )}
                {t.id === "resolutions" && (
                  <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {reunion.resolutions.length}
                  </span>
                )}
                {t.id === "plans" && reunion.plansAction.length > 0 && (
                  <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {reunion.plansAction.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu onglet */}
      <div>
        {tab === "convocation" && <OngletConvocation r={reunion} onRefresh={onRefresh} />}
        {tab === "presences"   && <OngletPresences   r={reunion} onRefresh={onRefresh} />}
        {tab === "cr"          && <OngletCompteRendu reunionId={reunion.id} />}
        {tab === "resolutions" && <OngletResolutions r={reunion} />}
        {tab === "plans"       && <OngletPlansAction r={reunion} />}
      </div>
    </div>
  );
}

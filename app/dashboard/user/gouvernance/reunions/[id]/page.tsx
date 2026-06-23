"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  commissionLabel, roleLabel, reunionExploitable,
  parseActionsCR, serializeActionsCR, type ActionCR,
} from "@/lib/commissionsRIA";
import { ActionsCREditor, ActionsCRView } from "@/components/gouvernance/ActionsCompteRendu";
import VisioReunion from "@/components/gouvernance/VisioReunion";
import {
  ChevronLeft, Calendar, MapPin, Clock, Users, FileText, CheckCircle2,
  Send, Archive, ClipboardList, PenLine, ShieldCheck, ListChecks, Plus, AlertTriangle, Play,
} from "lucide-react";

interface Presence {
  id: number; present: boolean; signatureNumerique: boolean; dateSignature: string | null;
  membre: { id: number; role: string; user: { id: number; nom: string; prenom: string } };
}
interface CompteRendu {
  id: number; decisions: string | null; recommandations: string | null;
  actionsDefinies: string | null; observations: string | null;
  dateValidation: string | null;
  validePar: { id: number; nom: string; prenom: string } | null;
}
interface Tache {
  id: number; titre: string; description: string | null; statut: string;
  priorite: string; progression: number; dateEcheance: string | null;
  responsable: { id: number; nom: string; prenom: string } | null;
}
interface Reunion {
  id: number; titre: string; typeCommission: string; dateHeure: string;
  lieu: string | null; salleVisio: string | null; lienVisio: string | null;
  statut: string; ordreJour: string | null;
  convocationEnvoyee: boolean; dateConvocation: string | null;
  organisateur: { id: number; nom: string; prenom: string };
  presences: Presence[];
  plansAction: Tache[];
  monRole: string | null;
}

const STATUT_REUNION: Record<string, { label: string; color: string }> = {
  PLANIFIEE: { label: "Planifiée", color: "bg-blue-100 text-blue-700" },
  EN_COURS:  { label: "En cours",  color: "bg-emerald-100 text-emerald-700" },
  TENUE:     { label: "Tenue",     color: "bg-slate-100 text-slate-600" },
  ANNULEE:   { label: "Annulée",   color: "bg-rose-100 text-rose-700" },
  REPORTEE:  { label: "Reportée",  color: "bg-amber-100 text-amber-700" },
};

const CR_CHAMPS = [
  { key: "decisions",       label: "Décisions prises",      ph: "Décisions adoptées lors de cette réunion..." },
  { key: "recommandations", label: "Recommandations",       ph: "Recommandations formulées par la commission..." },
  { key: "actionsDefinies", label: "Actions définies",      ph: "Actions à entreprendre (responsable, délai)..." },
  { key: "observations",    label: "Observations & divers", ph: "Autres points abordés..." },
] as const;

const STATUT_TACHE: Record<string, { label: string; color: string }> = {
  NON_DEMARRE: { label: "Non démarré", color: "bg-slate-100 text-slate-600" },
  A_FAIRE:     { label: "Non démarré", color: "bg-slate-100 text-slate-600" },
  EN_COURS:    { label: "En cours",    color: "bg-blue-100 text-blue-700" },
  REALISE:     { label: "Réalisé",     color: "bg-emerald-100 text-emerald-700" },
  TERMINE:     { label: "Réalisé",     color: "bg-emerald-100 text-emerald-700" },
  EN_RETARD:   { label: "En retard",   color: "bg-rose-100 text-rose-700" },
  ABANDONNE:   { label: "Abandonné",   color: "bg-slate-100 text-slate-400" },
};
const PRIORITES_TACHE = ["BASSE", "MOYENNE", "HAUTE", "CRITIQUE"] as const;
const estTacheTerminee = (s: string) => ["REALISE", "TERMINE", "ABANDONNE"].includes(s);

export default function MembreReunionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session } = useSession();
  const monUserId = session?.user?.id ? parseInt(session.user.id) : null;

  const { data: reunion, loading, refetch } = useApi<Reunion>(`/api/membreCommission/reunions/${id}`);
  const { data: crData, refetch: refetchCr } = useApi<{ compteRendu: CompteRendu | null }>(
    `/api/membreCommission/reunions/${id}/compte-rendu`
  );
  // Résolutions de la commission (pour rattacher une tâche à la résolution dont elle découle)
  const { data: resData } = useApi<{ resolutions: { id: number; numero: string; titre: string; reunion: { id: number } | null }[] }>(
    "/api/membreCommission/resolutions"
  );

  const { mutate: patcher, loading: patching } = useMutation(`/api/membreCommission/reunions/${id}`, "PATCH");
  const { mutate: signer, loading: signing } = useMutation(
    `/api/admin/ria/commissions/gouvernance/reunions/${id}/presences/signer`, "PATCH"
  );
  const { mutate: saveCr, loading: savingCr } = useMutation(`/api/membreCommission/reunions/${id}/compte-rendu`, "PUT");
  const { mutate: creerTache, loading: creatingTache } = useMutation("/api/membreCommission/plans-actions", "POST");

  const [crForm, setCrForm] = useState<Record<string, string> | null>(null);
  const [showTacheForm, setShowTacheForm] = useState(false);
  const [tacheForm, setTacheForm] = useState({ titre: "", responsableId: "", dateEcheance: "", priorite: "MOYENNE", resolutionId: "" });
  const [busyTache, setBusyTache] = useState<number | null>(null);

  if (loading || !reunion) {
    return (
      <div className="p-6 flex items-center justify-center h-60">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = reunion.monRole;
  const estPresident = role === "PRESIDENT" || role === "ADMIN";
  const estRedacteur = role === "PRESIDENT" || role === "RAPPORTEUR_1" || role === "RAPPORTEUR_2" || role === "ADMIN";
  // CDC : attribution/suivi des tâches = Président + Rapporteur 2
  const estSuivi = role === "PRESIDENT" || role === "RAPPORTEUR_2" || role === "ADMIN";
  // Une tâche émane d'une réunion engagée : création possible seulement si EN_COURS / TENUE.
  const peutCreerTache = estSuivi && reunionExploitable(reunion.statut);
  const monNom = session?.user ? `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim() : undefined;
  // Édition visio = préparateurs (Président / Rapporteur 1) et seulement en préparation (cf. garde-fou API).
  const peutEditerVisio = (estPresident || role === "RAPPORTEUR_1") && reunion.statut === "PLANIFIEE";
  const s = STATUT_REUNION[reunion.statut] ?? { label: reunion.statut, color: "bg-slate-100 text-slate-600" };

  // Membres assignables (depuis la feuille de présence de la réunion)
  const membresAssignables = reunion.presences.map(p => p.membre.user);
  const taches = reunion.plansAction ?? [];
  // Résolutions issues de cette réunion (pour rattacher la tâche à sa résolution d'origine)
  const resolutionsReunion = (resData?.resolutions ?? []).filter(r => r.reunion?.id === reunion.id);

  // L'émargement n'est ouvert que pendant la séance (réunion EN_COURS) — cf. garde-fou API.
  const peutSigner = reunion.statut === "EN_COURS";
  const maPresence = reunion.presences.find(p => p.membre.user.id === monUserId);
  const cr = crData?.compteRendu;
  const crValide = !!cr?.dateValidation;
  const form = crForm ?? {
    decisions: cr?.decisions ?? "", recommandations: cr?.recommandations ?? "",
    actionsDefinies: cr?.actionsDefinies ?? "", observations: cr?.observations ?? "",
  };

  async function changerStatut(statut: string) {
    const res = await patcher({ statut });
    if (res) { toast.success("Statut mis à jour"); refetch(); }
  }
  async function envoyerConvocation() {
    const res = await patcher({ convoquer: true });
    if (res) { toast.success("Convocation envoyée — feuille de présence générée"); refetch(); }
  }
  async function signerPresence() {
    const res = await signer({});
    if (res) { toast.success("Présence signée"); refetch(); }
  }
  async function patchVisio(payload: { lienVisio?: string | null; activerVisio?: boolean }) {
    const res = await patcher(payload);
    if (res) { refetch(); return true; }
    toast.error("Erreur lors de la mise à jour de la visio");
    return false;
  }
  async function sauverCr(valider: boolean) {
    const res = await saveCr({ ...form, valider });
    if (res) { toast.success(valider ? "Compte rendu validé" : "Compte rendu enregistré"); setCrForm(null); refetchCr(); }
  }
  async function ajouterTache(e: React.FormEvent) {
    e.preventDefault();
    if (!tacheForm.titre.trim()) { toast.error("L'intitulé de la tâche est requis"); return; }
    const res = await creerTache({
      typeCommission: reunion!.typeCommission,
      reunionId: reunion!.id,
      resolutionId: tacheForm.resolutionId || null,
      titre: tacheForm.titre.trim(),
      responsableId: tacheForm.responsableId || null,
      dateEcheance: tacheForm.dateEcheance || null,
      priorite: tacheForm.priorite,
    });
    if (res) {
      toast.success("Tâche créée");
      setTacheForm({ titre: "", responsableId: "", dateEcheance: "", priorite: "MOYENNE", resolutionId: "" });
      setShowTacheForm(false);
      refetch();
    }
  }
  async function changerStatutTache(t: Tache, statut: string) {
    setBusyTache(t.id);
    try {
      const res = await fetch(`/api/membreCommission/plans-actions/${t.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
      });
      const json = await res.json();
      if (res.ok) { toast.success("Tâche mise à jour"); refetch(); }
      else toast.error(json.error || "Erreur");
    } finally { setBusyTache(null); }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <button onClick={() => router.push("/dashboard/user/gouvernance/reunions")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Retour aux réunions
      </button>

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
              <span className="text-xs text-slate-400">{commissionLabel(reunion.typeCommission)}</span>
              {role && role !== "ADMIN" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{roleLabel(role)}</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-800">{reunion.titre}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                {new Date(reunion.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />
                {new Date(reunion.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              {reunion.lieu && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {reunion.lieu}</span>}
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {reunion.organisateur.prenom} {reunion.organisateur.nom}</span>
            </div>
          </div>
        </div>
        {reunion.ordreJour && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Ordre du jour
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{reunion.ordreJour}</p>
          </div>
        )}
      </div>

      {/* Visioconférence */}
      <VisioReunion
        salle={reunion.salleVisio}
        lienExterne={reunion.lienVisio}
        titre={reunion.titre}
        displayName={monNom}
        editable={peutEditerVisio}
        onPatch={patchVisio}
      />

      {/* Convocation + statut (Président) */}
      {estPresident && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Pilotage (Président)
          </p>
          {reunion.convocationEnvoyee ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> Convocation envoyée
              {reunion.dateConvocation ? ` le ${new Date(reunion.dateConvocation).toLocaleDateString("fr-FR")}` : ""}.
            </div>
          ) : (
            <button onClick={envoyerConvocation} disabled={patching}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> Envoyer la convocation
            </button>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {reunion.statut === "PLANIFIEE" && (
              <>
                <button onClick={() => changerStatut("EN_COURS")} disabled={patching}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" /> Démarrer
                </button>
                <button onClick={() => changerStatut("REPORTEE")} disabled={patching}
                  className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm rounded-lg hover:bg-amber-200 disabled:opacity-50">Reporter</button>
                <button onClick={() => changerStatut("ANNULEE")} disabled={patching}
                  className="px-3 py-1.5 bg-rose-100 text-rose-700 text-sm rounded-lg hover:bg-rose-200 disabled:opacity-50">Annuler</button>
              </>
            )}
            {reunion.statut === "EN_COURS" && (
              <button onClick={() => changerStatut("TENUE")} disabled={patching}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50">
                <Archive className="w-3.5 h-3.5" /> Clôturer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Présences + signature */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Feuille de présence</h3>
          {maPresence && !maPresence.signatureNumerique && peutSigner && (
            <button onClick={signerPresence} disabled={signing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <PenLine className="w-3.5 h-3.5" /> Signer ma présence
            </button>
          )}
          {maPresence && !maPresence.signatureNumerique && !peutSigner && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {reunion.statut === "PLANIFIEE"
                ? "Signature ouverte au démarrage de la séance"
                : "Signature close (séance non en cours)"}
            </span>
          )}
          {maPresence?.signatureNumerique && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vous avez signé
            </span>
          )}
        </div>
        {reunion.presences.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
            Feuille de présence générée à l&apos;envoi de la convocation.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reunion.presences.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${p.present ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.membre.user.prenom} {p.membre.user.nom}</p>
                    <p className="text-xs text-slate-400">{roleLabel(p.membre.role)}</p>
                  </div>
                </div>
                {p.signatureNumerique ? (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Signé {p.dateSignature ? new Date(p.dateSignature).toLocaleDateString("fr-FR") : ""}
                  </span>
                ) : <span className="text-xs text-slate-400">Non signé</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compte rendu */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Compte rendu</h3>
          {crValide && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Validé par {cr?.validePar?.prenom} {cr?.validePar?.nom}
            </span>
          )}
        </div>

        {!estRedacteur && !crValide && (
          <p className="text-sm text-slate-400">La rédaction du compte rendu est réservée au Président et aux Rapporteurs.</p>
        )}

        {(estRedacteur || crValide) && (
          <div className="space-y-4">
            {CR_CHAMPS.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">{f.label}</label>
                {f.key === "actionsDefinies" ? (
                  // Actions structurées (CDC : deviennent des tâches à la validation)
                  crValide || !estRedacteur ? (
                    <ActionsCRView actions={parseActionsCR(form.actionsDefinies)} />
                  ) : (
                    <>
                      <ActionsCREditor
                        actions={parseActionsCR(form.actionsDefinies)}
                        onChange={(a: ActionCR[]) => setCrForm({ ...form, actionsDefinies: serializeActionsCR(a) })}
                        membres={membresAssignables}
                      />
                      <p className="text-xs text-slate-400 mt-1.5">
                        À la validation, chaque action devient automatiquement une tâche.
                      </p>
                    </>
                  )
                ) : crValide || !estRedacteur ? (
                  <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded-lg p-3 min-h-[2.5rem]">
                    {form[f.key] || "—"}
                  </p>
                ) : (
                  <textarea rows={3} value={form[f.key]} placeholder={f.ph}
                    onChange={e => setCrForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
                )}
              </div>
            ))}

            {estRedacteur && !crValide && (
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => sauverCr(false)} disabled={savingCr}
                  className="px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                  {savingCr ? "Enregistrement..." : "Enregistrer (brouillon)"}
                </button>
                {estPresident && (
                  <button onClick={() => sauverCr(true)} disabled={savingCr}
                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valider le compte rendu
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tâches issues de la réunion (CDC) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Tâches issues de la réunion
          </h3>
          {peutCreerTache && !showTacheForm && (
            <button onClick={() => setShowTacheForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700">
              <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
            </button>
          )}
          {estSuivi && !peutCreerTache && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {reunion.statut === "PLANIFIEE"
                ? "Démarrez la séance pour attribuer des tâches"
                : "Séance close — attribution des tâches indisponible"}
            </span>
          )}
        </div>

        {peutCreerTache && showTacheForm && (
          <form onSubmit={ajouterTache} className="bg-slate-50 rounded-lg border border-slate-100 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Action *</label>
              <input value={tacheForm.titre} onChange={e => setTacheForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex. Réduire les impayés de 15 %"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Résolution d&apos;origine</label>
              <select value={tacheForm.resolutionId} onChange={e => setTacheForm(f => ({ ...f, resolutionId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                <option value="">— Aucune (tâche libre de la réunion) —</option>
                {resolutionsReunion.map(r => <option key={r.id} value={r.id}>{r.numero} — {r.titre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
                <select value={tacheForm.responsableId} onChange={e => setTacheForm(f => ({ ...f, responsableId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value="">— Non assigné —</option>
                  {membresAssignables.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
                <input type="date" value={tacheForm.dateEcheance} onChange={e => setTacheForm(f => ({ ...f, dateEcheance: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
                <select value={tacheForm.priorite} onChange={e => setTacheForm(f => ({ ...f, priorite: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  {PRIORITES_TACHE.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowTacheForm(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button type="submit" disabled={creatingTache}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50">
                {creatingTache ? "Création..." : "Créer la tâche"}
              </button>
            </div>
          </form>
        )}

        {taches.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune tâche définie pour cette réunion.</p>
        ) : (
          <div className="space-y-2.5">
            {taches.map(t => {
              const enRetard = !!t.dateEcheance && new Date(t.dateEcheance) < new Date() && !estTacheTerminee(t.statut);
              const meta = enRetard ? STATUT_TACHE.EN_RETARD : (STATUT_TACHE[t.statut] ?? { label: t.statut, color: "bg-slate-100 text-slate-600" });
              return (
                <div key={t.id} className={`rounded-lg border p-3 ${enRetard ? "border-rose-200 bg-rose-50/30" : "border-slate-100"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                        {enRetard && (
                          <span className="text-xs text-rose-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> En retard</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-800">{t.titre}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                        <span>Resp. {t.responsable ? `${t.responsable.prenom} ${t.responsable.nom}` : "—"}</span>
                        {t.dateEcheance && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(t.dateEcheance).toLocaleDateString("fr-FR")}</span>}
                        <span>{t.progression}%</span>
                      </div>
                    </div>
                    {estSuivi && !estTacheTerminee(t.statut) && (
                      <div className="flex gap-1.5 shrink-0">
                        {(t.statut === "NON_DEMARRE" || t.statut === "A_FAIRE") && (
                          <button onClick={() => changerStatutTache(t, "EN_COURS")} disabled={busyTache === t.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">
                            <Play className="w-3 h-3" /> Démarrer
                          </button>
                        )}
                        <button onClick={() => changerStatutTache(t, "REALISE")} disabled={busyTache === t.id}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          <CheckCircle2 className="w-3 h-3" /> Réalisé
                        </button>
                      </div>
                    )}
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

"use client";

import React, { useState } from "react";
import {
  ArrowLeft, RefreshCw, Plus, X, Save, ShieldAlert,
  Stethoscope, BookOpen, AlertTriangle, DoorOpen, Ban,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfilRHRef {
  id: number; matricule: string;
  gestionnaire: { member: { nom: string; prenom: string } };
}

interface Accident {
  id: number; dateAccident: string; heureAccident: string | null; lieu: string;
  circonstances: string; natureLesion: string | null; gravite: string;
  arretTravail: boolean; dureeArretJours: number | null; temoin: string | null;
  documentUrl: string | null; mesuresCorrectives: string | null; notes: string | null;
  statut: string; profilRH: ProfilRHRef;
}
interface AccidentsRes { data: Accident[]; meta: { total: number }; stats: Record<string, number>; statsByGravite: Record<string, number> }

interface Visite {
  id: number; type: string; dateVisite: string; medecin: string | null; lieu: string | null;
  resultatAptitude: string; restrictions: string | null; dateProchaineVisite: string | null;
  documentUrl: string | null; notes: string | null; profilRH: ProfilRHRef;
}
interface VisitesRes { data: Visite[]; meta: { total: number }; stats: Record<string, number> }

interface RegistreEntry {
  id: number; type: string; dateEvenement: string; description: string; lieu: string | null;
  actionsPrises: string | null; documentUrl: string | null; notes: string | null;
}
interface RegistreRes { data: RegistreEntry[]; meta: { total: number }; stats: Record<string, number> }

interface Incident {
  id: number; dateIncident: string; lieu: string; typeIncident: string; description: string;
  personnesImpliquees: string | null; gravite: string; actionsCorrectives: string | null;
  documentUrl: string | null; notes: string | null; statut: string;
}
interface IncidentsRes { data: Incident[]; meta: { total: number }; stats: Record<string, number> }

interface PlanEvac {
  id: number; titre: string; version: number; statut: string; fichierUrl: string | null;
  dateEffet: string | null; pointDeVente: { id: number; nom: string; code: string } | null;
}

interface CollabsRes { data: ProfilRHRef[] }
interface PdvRes { data: { id: number; nom: string; code: string }[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const GRAVITE_CFG: Record<string, { label: string; badge: string }> = {
  LEGER:  { label: "Léger",  badge: "bg-amber-100 text-amber-700" },
  GRAVE:  { label: "Grave",  badge: "bg-orange-100 text-orange-700" },
  MORTEL: { label: "Mortel", badge: "bg-red-100 text-red-700" },
};

const STATUT_AT_CFG: Record<string, { label: string; badge: string }> = {
  DECLARE:        { label: "Déclaré",       badge: "bg-blue-100 text-blue-700" },
  EN_INSTRUCTION: { label: "En instruction",badge: "bg-amber-100 text-amber-700" },
  CLOTURE:        { label: "Clôturé",       badge: "bg-emerald-100 text-emerald-700" },
  ANNULE:         { label: "Annulé",        badge: "bg-slate-100 text-slate-500" },
};

const STATUT_INC_CFG: Record<string, { label: string; badge: string }> = {
  OUVERT:   { label: "Ouvert",   badge: "bg-blue-100 text-blue-700" },
  EN_COURS: { label: "En cours", badge: "bg-amber-100 text-amber-700" },
  CLOTURE:  { label: "Clôturé",  badge: "bg-emerald-100 text-emerald-700" },
  ANNULE:   { label: "Annulé",   badge: "bg-slate-100 text-slate-500" },
};

const RESULTAT_CFG: Record<string, { label: string; badge: string }> = {
  APTE:                { label: "Apte",                 badge: "bg-emerald-100 text-emerald-700" },
  APTE_AVEC_RESERVES:  { label: "Apte avec réserves",   badge: "bg-amber-100 text-amber-700" },
  INAPTE_TEMPORAIRE:   { label: "Inapte temporaire",    badge: "bg-orange-100 text-orange-700" },
  INAPTE_DEFINITIF:    { label: "Inapte définitif",     badge: "bg-red-100 text-red-700" },
};

const TYPE_VISITE_LABEL: Record<string, string> = {
  EMBAUCHE: "Embauche", PERIODIQUE: "Périodique", REPRISE: "Reprise", SPONTANEE: "Spontanée",
};
const TYPE_SST_LABEL: Record<string, string> = {
  INSPECTION: "Inspection", FORMATION_SECURITE: "Formation sécurité",
  PRESQUE_ACCIDENT: "Presque-accident", OBSERVATION: "Observation", AUTRE: "Autre",
};
const TYPE_INCIDENT_LABEL: Record<string, string> = {
  SECURITE: "Sécurité", MATERIEL: "Matériel", ENVIRONNEMENT: "Environnement", AUTRE: "Autre",
};

function CollabName({ p }: { p: ProfilRHRef }) {
  return (
    <span>
      <span className="font-semibold text-slate-800">{p.gestionnaire.member.prenom} {p.gestionnaire.member.nom}</span>
      <span className="text-xs text-slate-400 font-mono ml-2">{p.matricule}</span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SSTPage() {
  const [activeTab, setActiveTab] = useState<"accidents" | "visites" | "registre" | "incidents" | "evacuation">("accidents");

  const TABS = [
    { key: "accidents",  label: "Accidents",         icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { key: "visites",    label: "Visites médicales", icon: <Stethoscope className="w-3.5 h-3.5" /> },
    { key: "registre",   label: "Registre SST",      icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: "incidents",  label: "Incidents",         icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { key: "evacuation", label: "Plans d'évacuation",icon: <DoorOpen className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div>
          <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={15} /> Dashboard RH
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Santé &amp; Sécurité au travail</h1>
          <p className="text-sm text-slate-500 mt-0.5">Accidents, visites médicales, registre SST, incidents, plans d&apos;évacuation</p>
        </div>

        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === key ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {activeTab === "accidents"  && <AccidentsTab />}
        {activeTab === "visites"    && <VisitesTab />}
        {activeTab === "registre"   && <RegistreTab />}
        {activeTab === "incidents"  && <IncidentsTab />}
        {activeTab === "evacuation" && <EvacuationTab />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACCIDENTS
// ════════════════════════════════════════════════════════════════════════════

function AccidentsTab() {
  const [statutFilt, setStatutFilt] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const params = new URLSearchParams({ limit: "50" });
  if (statutFilt) params.set("statut", statutFilt);

  const { data, loading, refetch } = useApi<AccidentsRes>(`/api/admin/rh/sst/accidents?${params}`);
  const accidents = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_AT_CFG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatutFilt(statutFilt === key ? "" : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statutFilt === key ? "ring-1 ring-red-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
              }`}>
              {cfg.label} ({stats[key] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">
            <Plus className="w-4 h-4" /> Déclarer un accident
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
      ) : accidents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <ShieldAlert className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun accident du travail enregistré</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {accidents.map((a) => <AccidentRow key={a.id} accident={a} onRefetch={refetch} />)}
        </div>
      )}

      {showCreate && <CreateAccidentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function AccidentRow({ accident: a, onRefetch }: { accident: Accident; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/sst/accidents/${a.id}`, "PATCH");
  const statutCfg = STATUT_AT_CFG[a.statut] ?? STATUT_AT_CFG.DECLARE;
  const graviteCfg = GRAVITE_CFG[a.gravite] ?? GRAVITE_CFG.LEGER;

  const doAction = async (action: string) => {
    let mesuresCorrectives: string | undefined;
    if (action === "CLOTURER") mesuresCorrectives = window.prompt("Mesures correctives (facultatif) :") ?? undefined;
    const result = await mutate({ action, mesuresCorrectives });
    if (result) { toast.success("Accident mis à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <CollabName p={a.profilRH} />
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${graviteCfg.badge}`}>{graviteCfg.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutCfg.badge}`}>{statutCfg.label}</span>
          {a.arretTravail && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Arrêt {a.dureeArretJours ?? "?"}j</span>}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{formatDate(a.dateAccident)} · {a.lieu}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{a.circonstances}</p>
        {a.mesuresCorrectives && <p className="text-xs text-emerald-600 mt-0.5">Mesures : {a.mesuresCorrectives}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {a.statut === "DECLARE" && (
          <button disabled={loading} onClick={() => doAction("INSTRUIRE")}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">Instruire</button>
        )}
        {["DECLARE", "EN_INSTRUCTION"].includes(a.statut) && (
          <>
            <button disabled={loading} onClick={() => doAction("CLOTURER")}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50">Clôturer</button>
            <button disabled={loading} onClick={() => doAction("ANNULER")}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-50">
              <Ban className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateAccidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/sst/accidents", "POST");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "", dateAccident: "", heureAccident: "", lieu: "", circonstances: "",
    natureLesion: "", gravite: "LEGER", arretTravail: false, dureeArretJours: "", temoin: "",
    documentUrl: "", notes: "",
  });
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.dateAccident || !form.lieu || !form.circonstances) {
      toast.error("Collaborateur, date, lieu et circonstances requis"); return;
    }
    const result = await mutate({
      ...form,
      profilRHId: Number(form.profilRHId),
      dureeArretJours: form.dureeArretJours || undefined,
      heureAccident: form.heureAccident || undefined,
      natureLesion: form.natureLesion || undefined,
      temoin: form.temoin || undefined,
      documentUrl: form.documentUrl || undefined,
      notes: form.notes || undefined,
    });
    if (result) { toast.success("Accident déclaré"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Déclarer un accident du travail</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <Field label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de l'accident *">
              <input type="date" value={form.dateAccident} onChange={(e) => set("dateAccident", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
            <Field label="Heure">
              <input type="time" value={form.heureAccident} onChange={(e) => set("heureAccident", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
          </div>
          <Field label="Lieu *">
            <input value={form.lieu} onChange={(e) => set("lieu", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Circonstances *">
            <textarea value={form.circonstances} onChange={(e) => set("circonstances", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
          <Field label="Nature de la lésion">
            <input value={form.natureLesion} onChange={(e) => set("natureLesion", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gravité">
              <select value={form.gravite} onChange={(e) => set("gravite", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                {Object.entries(GRAVITE_CFG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
              </select>
            </Field>
            <Field label="Témoin">
              <input value={form.temoin} onChange={(e) => set("temoin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.arretTravail} onChange={(e) => set("arretTravail", e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
            <label className="text-sm text-slate-700">Arrêt de travail</label>
            {form.arretTravail && (
              <input type="number" min={1} value={form.dureeArretJours} onChange={(e) => set("dureeArretJours", e.target.value)}
                placeholder="jours" className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-sm" />
            )}
          </div>
          <Field label="Document (déclaration CNSS / rapport)">
            <input value={form.documentUrl} onChange={(e) => set("documentUrl", e.target.value)} placeholder="URL du fichier"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Déclarer
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISITES MÉDICALES
// ════════════════════════════════════════════════════════════════════════════

function VisitesTab() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<VisitesRes>("/api/admin/rh/sst/visites?limit=50");
  const visites = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">
          <Plus className="w-4 h-4" /> Enregistrer une visite
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
      ) : visites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <Stethoscope className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune visite médicale enregistrée</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {visites.map((v) => {
            const cfg = RESULTAT_CFG[v.resultatAptitude] ?? RESULTAT_CFG.APTE;
            return (
              <div key={v.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CollabName p={v.profilRH} />
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{TYPE_VISITE_LABEL[v.type] ?? v.type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(v.dateVisite)}{v.medecin ? ` · Dr ${v.medecin}` : ""}{v.lieu ? ` · ${v.lieu}` : ""}</p>
                  {v.restrictions && <p className="text-xs text-amber-600 mt-0.5">Restrictions : {v.restrictions}</p>}
                  {v.dateProchaineVisite && <p className="text-xs text-slate-400 mt-0.5">Prochaine visite : {formatDate(v.dateProchaineVisite)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateVisiteModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function CreateVisiteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/sst/visites", "POST");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "", type: "PERIODIQUE", dateVisite: "", medecin: "", lieu: "",
    resultatAptitude: "APTE", restrictions: "", dateProchaineVisite: "", documentUrl: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.dateVisite) { toast.error("Collaborateur et date requis"); return; }
    const result = await mutate({
      ...form,
      profilRHId: Number(form.profilRHId),
      medecin: form.medecin || undefined,
      lieu: form.lieu || undefined,
      restrictions: form.restrictions || undefined,
      dateProchaineVisite: form.dateProchaineVisite || undefined,
      documentUrl: form.documentUrl || undefined,
      notes: form.notes || undefined,
    });
    if (result) { toast.success("Visite médicale enregistrée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Enregistrer une visite médicale</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <Field label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type de visite">
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                {Object.entries(TYPE_VISITE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Date de la visite *">
              <input type="date" value={form.dateVisite} onChange={(e) => set("dateVisite", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
            <Field label="Médecin">
              <input value={form.medecin} onChange={(e) => set("medecin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
            <Field label="Lieu">
              <input value={form.lieu} onChange={(e) => set("lieu", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
          </div>
          <Field label="Résultat d'aptitude *">
            <select value={form.resultatAptitude} onChange={(e) => set("resultatAptitude", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              {Object.entries(RESULTAT_CFG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
            </select>
          </Field>
          <Field label="Restrictions">
            <textarea value={form.restrictions} onChange={(e) => set("restrictions", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
          <Field label="Date de la prochaine visite">
            <input type="date" value={form.dateProchaineVisite} onChange={(e) => set("dateProchaineVisite", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Document (certificat scanné)">
            <input value={form.documentUrl} onChange={(e) => set("documentUrl", e.target.value)} placeholder="URL du fichier"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// REGISTRE SST
// ════════════════════════════════════════════════════════════════════════════

function RegistreTab() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<RegistreRes>("/api/admin/rh/sst/registre?limit=50");
  const entries = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">
          <Plus className="w-4 h-4" /> Ajouter une entrée
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <BookOpen className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune entrée dans le registre SST</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {entries.map((e) => (
            <div key={e.id} className="px-5 py-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{TYPE_SST_LABEL[e.type] ?? e.type}</span>
                <span className="text-xs text-slate-400">{formatDate(e.dateEvenement)}{e.lieu ? ` · ${e.lieu}` : ""}</span>
              </div>
              <p className="text-sm text-slate-700 mt-1">{e.description}</p>
              {e.actionsPrises && <p className="text-xs text-emerald-600 mt-0.5">Actions : {e.actionsPrises}</p>}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateRegistreModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function CreateRegistreModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/sst/registre", "POST");
  const [form, setForm] = useState({ type: "INSPECTION", dateEvenement: "", description: "", lieu: "", actionsPrises: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.dateEvenement || !form.description.trim()) { toast.error("Date et description requises"); return; }
    const result = await mutate({ ...form, lieu: form.lieu || undefined, actionsPrises: form.actionsPrises || undefined });
    if (result) { toast.success("Entrée ajoutée au registre"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle entrée — Registre SST</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Type d'événement">
            <select value={form.type} onChange={(e) => set("type", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              {Object.entries(TYPE_SST_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Date *">
            <input type="date" value={form.dateEvenement} onChange={(e) => set("dateEvenement", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Lieu">
            <input value={form.lieu} onChange={(e) => set("lieu", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Description *">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
          <Field label="Actions prises">
            <textarea value={form.actionsPrises} onChange={(e) => set("actionsPrises", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// INCIDENTS
// ════════════════════════════════════════════════════════════════════════════

function IncidentsTab() {
  const [statutFilt, setStatutFilt] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const params = new URLSearchParams({ limit: "50" });
  if (statutFilt) params.set("statut", statutFilt);

  const { data, loading, refetch } = useApi<IncidentsRes>(`/api/admin/rh/sst/incidents?${params}`);
  const incidents = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_INC_CFG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatutFilt(statutFilt === key ? "" : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statutFilt === key ? "ring-1 ring-red-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
              }`}>
              {cfg.label} ({stats[key] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">
            <Plus className="w-4 h-4" /> Signaler un incident
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
      ) : incidents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <AlertTriangle className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun incident signalé</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {incidents.map((i) => <IncidentRow key={i.id} incident={i} onRefetch={refetch} />)}
        </div>
      )}

      {showCreate && <CreateIncidentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function IncidentRow({ incident: i, onRefetch }: { incident: Incident; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/sst/incidents/${i.id}`, "PATCH");
  const statutCfg = STATUT_INC_CFG[i.statut] ?? STATUT_INC_CFG.OUVERT;
  const graviteCfg = GRAVITE_CFG[i.gravite] ?? GRAVITE_CFG.LEGER;

  const doAction = async (action: string) => {
    let actionsCorrectives: string | undefined;
    if (action === "CLOTURER") actionsCorrectives = window.prompt("Actions correctives (facultatif) :") ?? undefined;
    const result = await mutate({ action, actionsCorrectives });
    if (result) { toast.success("Incident mis à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{TYPE_INCIDENT_LABEL[i.typeIncident] ?? i.typeIncident}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${graviteCfg.badge}`}>{graviteCfg.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutCfg.badge}`}>{statutCfg.label}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{formatDate(i.dateIncident)} · {i.lieu}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{i.description}</p>
        {i.actionsCorrectives && <p className="text-xs text-emerald-600 mt-0.5">Actions : {i.actionsCorrectives}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {i.statut === "OUVERT" && (
          <button disabled={loading} onClick={() => doAction("INSTRUIRE")}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">Instruire</button>
        )}
        {["OUVERT", "EN_COURS"].includes(i.statut) && (
          <>
            <button disabled={loading} onClick={() => doAction("CLOTURER")}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50">Clôturer</button>
            <button disabled={loading} onClick={() => doAction("ANNULER")}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-50">
              <Ban className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateIncidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/sst/incidents", "POST");
  const [form, setForm] = useState({
    dateIncident: "", lieu: "", typeIncident: "SECURITE", description: "",
    personnesImpliquees: "", gravite: "LEGER",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.dateIncident || !form.lieu || !form.description.trim()) { toast.error("Date, lieu et description requis"); return; }
    const result = await mutate({ ...form, personnesImpliquees: form.personnesImpliquees || undefined });
    if (result) { toast.success("Incident signalé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Signaler un incident</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <input type="date" value={form.dateIncident} onChange={(e) => set("dateIncident", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
            <Field label="Lieu *">
              <input value={form.lieu} onChange={(e) => set("lieu", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </Field>
            <Field label="Type">
              <select value={form.typeIncident} onChange={(e) => set("typeIncident", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                {Object.entries(TYPE_INCIDENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Gravité">
              <select value={form.gravite} onChange={(e) => set("gravite", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                {Object.entries(GRAVITE_CFG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description *">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
          <Field label="Personnes impliquées">
            <input value={form.personnesImpliquees} onChange={(e) => set("personnesImpliquees", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Signaler
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PLANS D'ÉVACUATION (réutilise documents-strategiques + PLAN_EVACUATION)
// ════════════════════════════════════════════════════════════════════════════

function EvacuationTab() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<{ data: PlanEvac[] }>("/api/admin/rh/documents-strategiques?type=PLAN_EVACUATION");
  const plans = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">
          <Plus className="w-4 h-4" /> Nouveau plan d&apos;évacuation
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <DoorOpen className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun plan d&apos;évacuation enregistré</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{p.titre}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  p.statut === "EN_VIGUEUR" ? "bg-emerald-100 text-emerald-700" : p.statut === "ARCHIVE" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"
                }`}>{p.statut === "EN_VIGUEUR" ? "En vigueur" : p.statut === "ARCHIVE" ? "Archivé" : "Brouillon"}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{p.pointDeVente ? `${p.pointDeVente.nom} (${p.pointDeVente.code})` : "Site non précisé"} · v{p.version}</p>
              {p.dateEffet && <p className="text-xs text-slate-400 mt-0.5">Effet : {formatDate(p.dateEffet)}</p>}
              {p.fichierUrl && (
                <a href={p.fichierUrl} target="_blank" rel="noreferrer" className="text-xs text-red-600 hover:underline mt-2 inline-block">Voir le document</a>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateEvacuationModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function CreateEvacuationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/documents-strategiques", "POST");
  const { data: pdvRes } = useApi<PdvRes>("/api/admin/pdv?limit=200");
  const pdvs = pdvRes?.data ?? [];

  const [form, setForm] = useState({ titre: "", pointDeVenteId: "", fichierUrl: "", dateEffet: "", statut: "BROUILLON" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titre.trim()) { toast.error("Titre requis"); return; }
    const result = await mutate({
      type: "PLAN_EVACUATION",
      titre: form.titre.trim(),
      pointDeVenteId: form.pointDeVenteId || undefined,
      fichierUrl: form.fichierUrl || undefined,
      dateEffet: form.dateEffet || undefined,
      statut: form.statut,
    });
    if (result) { toast.success("Plan d'évacuation créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau plan d&apos;évacuation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Titre *">
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex : Plan d'évacuation — Siège"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Site (facultatif)">
            <select value={form.pointDeVenteId} onChange={(e) => set("pointDeVenteId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">— Aucun (document global) —</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          </Field>
          <Field label="Document (fichier)">
            <input value={form.fichierUrl} onChange={(e) => set("fichierUrl", e.target.value)} placeholder="URL du fichier"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Date d'effet">
            <input type="date" value={form.dateEffet} onChange={(e) => set("dateEffet", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <Field label="Statut">
            <select value={form.statut} onChange={(e) => set("statut", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="BROUILLON">Brouillon</option>
              <option value="EN_VIGUEUR">En vigueur</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

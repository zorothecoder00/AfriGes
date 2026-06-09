"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bell, Save, RefreshCw, CheckCircle,
  Calendar, Star, GraduationCap, FileWarning, FileText,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Preferences {
  canalApp:         boolean;
  canalEmail:       boolean;
  finContrat:       boolean;
  validationConge:  boolean;
  evaluationProg:   boolean;
  formationAsuivre: boolean;
  documentExpirant: boolean;
}

interface PrefResponse { data: Preferences }

// ── Déclencheurs config ────────────────────────────────────────────────────────

const DECLENCHEURS: {
  key:     keyof Omit<Preferences, "canalApp" | "canalEmail">;
  label:   string;
  desc:    string;
  icon:    React.ElementType;
  color:   string;
}[] = [
  {
    key:   "finContrat",
    label: "Fin de contrat",
    desc:  "Alerte J-30 et J-7 avant la fin d'un CDD",
    icon:  FileWarning,
    color: "text-red-600 bg-red-50",
  },
  {
    key:   "validationConge",
    label: "Validation de congé",
    desc:  "Notification immédiate quand votre congé est approuvé ou refusé",
    icon:  Calendar,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key:   "evaluationProg",
    label: "Évaluation programmée",
    desc:  "Rappel J-7 avant le début d'une évaluation de performance",
    icon:  Star,
    color: "text-amber-600 bg-amber-50",
  },
  {
    key:   "formationAsuivre",
    label: "Formation à suivre",
    desc:  "Rappel J-3 avant le début d'une formation à laquelle vous êtes inscrit(e)",
    icon:  GraduationCap,
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    key:   "documentExpirant",
    label: "Document expirant",
    desc:  "Alerte J-30 avant l'expiration d'un document (CNI, passeport…)",
    icon:  FileText,
    color: "text-teal-600 bg-teal-50",
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: Preferences = {
  canalApp:         true,
  canalEmail:       false,
  finContrat:       true,
  validationConge:  true,
  evaluationProg:   true,
  formationAsuivre: true,
  documentExpirant: true,
};

export default function PreferencesNotificationsPage() {
  const { data: res, loading } = useApi<PrefResponse>("/api/me/preferences-notifications-rh");

  if (loading && !res) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return <PreferencesForm initial={res?.data ?? DEFAULT_PREFS} />;
}

function PreferencesForm({ initial }: { initial: Preferences }) {
  const { mutate, loading: saving } = useMutation("/api/me/preferences-notifications-rh", "PUT");
  const [form, setForm] = useState<Preferences>(initial);

  const toggle = useCallback((key: keyof Preferences) =>
    setForm((f) => ({ ...f, [key]: !f[key] })), []);

  const handleSave = async () => {
    const result = await mutate(form);
    if (result) toast.success("Préférences enregistrées");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* En-tête */}
        <div>
          <Link href="/dashboard/user/responsablesRH" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={15} /> Tableau de bord RH
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Préférences de notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configurez quels événements RH vous souhaitez recevoir.</p>
        </div>

        {/* Canaux */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-400" /> Canaux de notification
          </h2>
          <div className="space-y-3">
            <ToggleRow
              label="Notifications in-app"
              desc="Toujours activé — notifications dans l'interface AfriGes"
              checked={true}
              disabled={true}
              onChange={() => {}}
            />
            <ToggleRow
              label="Email"
              desc="Envoi par email (nécessite configuration EMAIL_ENABLED)"
              checked={form.canalEmail}
              onChange={() => toggle("canalEmail")}
            />
          </div>
        </div>

        {/* Déclencheurs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-slate-400" /> Déclencheurs actifs
          </h2>
          <div className="space-y-3">
            {DECLENCHEURS.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.key} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${d.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{d.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
                  </div>
                  <Toggle checked={form[d.key]} onChange={() => toggle(d.key)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Sauvegarder */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Enregistrement…</>
              : <><Save className="w-4 h-4" /> Enregistrer les préférences</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composants ─────────────────────────────────────────────────────────────────

function ToggleRow({ label, desc, checked, onChange, disabled }: {
  label: string; desc: string; checked: boolean;
  onChange: () => void; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border border-slate-100 ${disabled ? "opacity-60" : "hover:border-slate-200"} transition-all`}>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-emerald-500" : "bg-slate-200"
      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`} />
    </button>
  );
}

"use client";

import { use, useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  Briefcase, MapPin, Clock, Calendar, Users, ChevronRight,
  CheckCircle, AlertCircle, Loader2, Upload, FileText,
  Mail, Phone, User, GraduationCap, Sparkles, Building2,
  ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Poste {
  id: number; reference: string; titre: string;
  departement: string | null; service: string | null; lieu: string | null;
  typeContrat: string | null; description: string | null;
  exigences: string | null; competencesRequises: string | null;
  experienceMin: number | null; nbPostes: number;
  salaireMini: number | null; salaireMaxi: number | null;
  dateOuverture: string | null; dateLimite: string | null;
  statut: string;
  _count: { candidatures: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function formatDateFr(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const CONTRACT_LABELS: Record<string, string> = {
  CDI: "CDI", CDD: "CDD", STAGE: "Stage", ALTERNANCE: "Alternance",
  FREELANCE: "Freelance", INTERIM: "Intérim", PRESTATAIRE: "Prestataire",
  CONSULTANT: "Consultant",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PostulerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: res, loading, error } = useApi<{ data: Poste }>(`/api/public/postes/${id}`);
  const poste = res?.data;

  if (loading) return <LoadingScreen />;
  if (error || !poste) return <ErrorScreen message={error ?? "Poste introuvable"} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Bannière top */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">AfriGes</p>
              <p className="text-xs text-slate-400">Offres d&apos;emploi</p>
            </div>
          </div>
          <span className="font-mono text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
            {poste.reference}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Hero poste */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-8">
            <h1 className="text-2xl font-bold text-white mb-2">{poste.titre}</h1>
            <div className="flex flex-wrap items-center gap-3">
              {poste.typeContrat && (
                <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full font-medium">
                  {CONTRACT_LABELS[poste.typeContrat] ?? poste.typeContrat}
                </span>
              )}
              {poste.nbPostes > 1 && (
                <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                  {poste.nbPostes} postes
                </span>
              )}
            </div>
          </div>

          <div className="px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: <MapPin className="w-4 h-4" />,      label: "Lieu",         value: poste.lieu ?? "Non précisé" },
                { icon: <Building2 className="w-4 h-4" />,   label: "Département",  value: poste.departement ?? "—" },
                { icon: <Users className="w-4 h-4" />,       label: "Postes",       value: `${poste.nbPostes} poste${poste.nbPostes > 1 ? "s" : ""}` },
                { icon: <Calendar className="w-4 h-4" />,    label: "Clôture",      value: poste.dateLimite ? formatDateFr(poste.dateLimite)! : "Ouvert" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">{icon}</span>
                  <div>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-semibold text-slate-700">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fourchette salariale */}
            {(poste.salaireMini || poste.salaireMaxi) && (
              <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2">
                <span className="text-xs text-slate-400">Rémunération :</span>
                <span className="font-semibold text-emerald-700 text-sm">
                  {poste.salaireMini ? fmt(poste.salaireMini) : "?"} — {poste.salaireMaxi ? `${fmt(poste.salaireMaxi)} FCFA / mois` : "?"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Détails du poste */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

          {/* Colonne gauche : description */}
          <div className="md:col-span-3 space-y-5">
            {poste.description && (
              <Section icon={<FileText className="w-4 h-4" />} title="Description du poste">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{poste.description}</p>
              </Section>
            )}
            {poste.exigences && (
              <Section icon={<CheckCircle className="w-4 h-4" />} title="Profil recherché">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{poste.exigences}</p>
              </Section>
            )}
          </div>

          {/* Colonne droite : requirements */}
          <div className="md:col-span-2 space-y-4">
            {poste.experienceMin != null && poste.experienceMin > 0 && (
              <InfoChip icon={<Clock className="w-4 h-4 text-blue-500" />}
                label="Expérience minimum"
                value={`${poste.experienceMin} an${poste.experienceMin > 1 ? "s" : ""}`} />
            )}
            {poste.competencesRequises && (
              <Section icon={<Sparkles className="w-4 h-4" />} title="Compétences requises">
                <div className="flex flex-wrap gap-1.5">
                  {poste.competencesRequises.split(",").map((c) => (
                    <span key={c} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-100 font-medium">
                      {c.trim()}
                    </span>
                  ))}
                </div>
              </Section>
            )}
            {poste.dateLimite && (
              <InfoChip icon={<Calendar className="w-4 h-4 text-red-400" />}
                label="Date limite de candidature"
                value={formatDateFr(poste.dateLimite)!} />
            )}
            <InfoChip icon={<Users className="w-4 h-4 text-slate-400" />}
              label="Candidatures reçues"
              value={`${poste._count.candidatures} candidat${poste._count.candidatures !== 1 ? "s" : ""}`} />
          </div>
        </div>

        {/* Formulaire de candidature */}
        <CandidatureForm posteId={poste.id} posteTitre={poste.titre} />
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-white mt-12 py-6">
        <p className="text-center text-xs text-slate-400">
          Propulsé par <span className="font-semibold text-slate-600">AfriGes</span> — Système de gestion RH
        </p>
      </div>
    </div>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
        <span className="text-emerald-500">{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Chargement de l&apos;offre…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-sm">
        <div className="w-14 h-14 mx-auto bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="font-bold text-slate-800 text-lg mb-2">Poste indisponible</h2>
        <p className="text-sm text-slate-500">{message}</p>
        <p className="text-xs text-slate-400 mt-3">Ce poste a peut-être été pourvu ou retiré.</p>
      </div>
    </div>
  );
}

// ── Formulaire de candidature ─────────────────────────────────────────────────

type Step = "form" | "success";

interface FormData {
  prenomCandidat: string;
  nomCandidat: string;
  email: string;
  telephone: string;
  formation: string;
  experienceAnnees: string;
  competences: string;
  cvUrl: string;
  lettreUrl: string;
  notes: string;
}

function CandidatureForm({ posteId, posteTitre }: { posteId: number; posteTitre: string }) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    prenomCandidat: "", nomCandidat: "", email: "", telephone: "",
    formation: "", experienceAnnees: "", competences: "",
    cvUrl: "", lettreUrl: "", notes: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e: Partial<FormData> = {};
    if (!form.prenomCandidat.trim()) e.prenomCandidat = "Requis";
    if (!form.nomCandidat.trim())    e.nomCandidat    = "Requis";
    if (!form.email.trim())          e.email          = "Requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email invalide";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError(null);
    try {
      const r = await fetch(`/api/public/postes/${posteId}/candidatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          experienceAnnees: form.experienceAnnees ? Number(form.experienceAnnees) : null,
        }),
      });
      const json = await r.json();
      if (!r.ok) { setServerError(json.error ?? "Une erreur est survenue"); return; }
      setStep("success");
    } catch {
      setServerError("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success") {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-10 text-center">
        <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="font-bold text-slate-900 text-xl mb-2">Candidature envoyée !</h2>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          Votre candidature pour le poste <strong>{posteTitre}</strong> a bien été reçue.
          Notre équipe RH vous contactera prochainement.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Pensez à vérifier vos spams si vous n&apos;avez pas de retour sous 7 jours.
        </p>
      </div>
    );
  }

  const inputCls = (field: keyof FormData) =>
    `w-full px-4 py-3 border rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
      errors[field] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"
    }`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* En-tête formulaire */}
      <div className="px-8 py-5 border-b border-slate-100 bg-slate-50">
        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <ChevronRight className="w-5 h-5 text-emerald-500" />
          Postuler à cette offre
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Remplissez le formulaire ci-dessous. Les champs * sont obligatoires.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-8 py-7 space-y-6">

        {/* Identité */}
        <Fieldset title="Informations personnelles" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Prénom *" error={errors.prenomCandidat}>
              <input value={form.prenomCandidat} onChange={set("prenomCandidat")}
                placeholder="Jean" className={inputCls("prenomCandidat")} />
            </Field>
            <Field label="Nom *" error={errors.nomCandidat}>
              <input value={form.nomCandidat} onChange={set("nomCandidat")}
                placeholder="Dupont" className={inputCls("nomCandidat")} />
            </Field>
            <Field label="Adresse email *" error={errors.email}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" value={form.email} onChange={set("email")}
                  placeholder="jean.dupont@email.com"
                  className={`${inputCls("email")} pl-10`} />
              </div>
            </Field>
            <Field label="Téléphone" error={errors.telephone}>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={form.telephone} onChange={set("telephone")}
                  placeholder="+229 97 00 00 00"
                  className={`${inputCls("telephone")} pl-10`} />
              </div>
            </Field>
          </div>
        </Fieldset>

        {/* Parcours */}
        <Fieldset title="Formation & Expérience" icon={<GraduationCap className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Formation / Diplôme" error={errors.formation}>
              <input value={form.formation} onChange={set("formation")}
                placeholder="Ex: Bac+3 Comptabilité" className={inputCls("formation")} />
            </Field>
            <Field label="Années d&apos;expérience" error={errors.experienceAnnees}>
              <input type="number" min={0} max={50} value={form.experienceAnnees} onChange={set("experienceAnnees")}
                placeholder="0" className={inputCls("experienceAnnees")} />
            </Field>
            <Field label="Compétences clés" error={errors.competences} className="sm:col-span-2">
              <input value={form.competences} onChange={set("competences")}
                placeholder="Ex: Excel, Gestion de stock, Service client, Permis B…"
                className={inputCls("competences")} />
            </Field>
          </div>
        </Fieldset>

        {/* Documents */}
        <Fieldset title="Documents" icon={<Upload className="w-4 h-4" />}>
          <div className="space-y-4">
            <Field label="Lien vers votre CV" error={errors.cvUrl}
              hint="Partagez un lien Google Drive, Dropbox ou autre service cloud">
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={form.cvUrl} onChange={set("cvUrl")}
                  placeholder="https://drive.google.com/…"
                  className={`${inputCls("cvUrl")} pl-10`} />
              </div>
            </Field>
            <Field label="Lettre de motivation (optionnel)" error={errors.lettreUrl}
              hint="Lien vers votre lettre de motivation si vous en avez une">
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={form.lettreUrl} onChange={set("lettreUrl")}
                  placeholder="https://drive.google.com/…"
                  className={`${inputCls("lettreUrl")} pl-10`} />
              </div>
            </Field>
          </div>
        </Fieldset>

        {/* Message */}
        <Fieldset title="Message (optionnel)" icon={<Sparkles className="w-4 h-4" />}>
          <Field label="Pourquoi ce poste vous intéresse-t-il ?" error={errors.notes}>
            <textarea value={form.notes} onChange={set("notes")} rows={4}
              placeholder="Décrivez en quelques lignes votre motivation et ce qui vous distingue des autres candidats…"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-colors" />
          </Field>
        </Fieldset>

        {/* Erreur serveur */}
        {serverError && (
          <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Bouton submit */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            En soumettant, vous acceptez que vos données soient utilisées dans le cadre de ce recrutement.
          </p>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm flex-shrink-0 ml-4">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
            ) : (
              <><ChevronRight className="w-4 h-4" /> Envoyer ma candidature</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Helpers formulaire ────────────────────────────────────────────────────────

function Fieldset({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 pb-2 border-b border-slate-100">
        <span className="text-emerald-500">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label, hint, error, children, className,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint  && !error && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

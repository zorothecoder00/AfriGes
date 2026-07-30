"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, UserPlus, User, Check,
  Briefcase, Calendar, Building2, ChevronRight,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { useMutation, useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GestionnaireOption {
  id: number;
  role: string;
  member: {
    nom: string;
    prenom: string;
    email: string;
    affectationsPDV: { pointDeVente: { nom: string; code: string } }[];
  };
}

interface FormData {
  gestionnaireId: string;
  typeContrat: string;
  statut: string;
  dateEmbauche: string;
  dateFin: string;
  fonction: string;
  service: string;
  departement: string;
  niveauHierarchique: string;
  dateNaissance: string;
  lieuNaissance: string;
  sexe: string;
  nationalite: string;
  situationMatrimoniale: string;
  nbEnfants: string;
  telephoneSecondaire: string;
  notes: string;
}

const INITIAL_FORM: FormData = {
  gestionnaireId: "",
  typeContrat: "",
  statut: "ACTIF",
  dateEmbauche: "",
  dateFin: "",
  fonction: "",
  service: "",
  departement: "",
  niveauHierarchique: "",
  dateNaissance: "",
  lieuNaissance: "",
  sexe: "",
  nationalite: "",
  situationMatrimoniale: "",
  nbEnfants: "",
  telephoneSecondaire: "",
  notes: "",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NouveauCollaborateurPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  const { data: gestRes, loading: gestLoading } = useApi<{ data: GestionnaireOption[] }>(
    "/api/admin/gestionnaires?sansProfilRH=true&limit=200"
  );
  const gestionnaires = gestRes?.data ?? [];

  const selectedGestionnaire = gestionnaires.find(
    (g) => g.id === Number(form.gestionnaireId)
  ) ?? null;

  const { mutate, loading } = useMutation<{ id: number }, object>(
    "/api/admin/rh/collaborateurs",
    "POST",
    { successMessage: "Dossier RH créé avec succès" }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.gestionnaireId) return;

    const payload: Record<string, unknown> = { gestionnaireId: Number(form.gestionnaireId) };
    if (form.typeContrat)           payload.typeContrat          = form.typeContrat;
    if (form.statut)                payload.statut               = form.statut;
    if (form.dateEmbauche)          payload.dateEmbauche         = form.dateEmbauche;
    if (form.dateFin)               payload.dateFin              = form.dateFin;
    if (form.fonction)              payload.fonction             = form.fonction;
    if (form.service)               payload.service              = form.service;
    if (form.departement)           payload.departement          = form.departement;
    if (form.niveauHierarchique)    payload.niveauHierarchique   = form.niveauHierarchique;
    if (form.dateNaissance)         payload.dateNaissance        = form.dateNaissance;
    if (form.lieuNaissance)         payload.lieuNaissance        = form.lieuNaissance;
    if (form.sexe)                  payload.sexe                 = form.sexe;
    if (form.nationalite)           payload.nationalite          = form.nationalite;
    if (form.situationMatrimoniale) payload.situationMatrimoniale = form.situationMatrimoniale;
    if (form.nbEnfants)             payload.nbEnfants            = Number(form.nbEnfants);
    if (form.telephoneSecondaire)   payload.telephoneSecondaire  = form.telephoneSecondaire;
    if (form.notes)                 payload.notes                = form.notes;

    const result = await mutate(payload);
    if (result) router.push("/dashboard/admin/rh/collaborateurs");
  };

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* ── En-tête ── */}
        <div>
          <Link
            href="/dashboard/admin/rh/collaborateurs"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-3"
          >
            <ArrowLeft size={15} /> Retour aux collaborateurs
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            Nouveau dossier collaborateur
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créez le dossier RH d&apos;un gestionnaire déjà enregistré dans le système.
          </p>
        </div>

        {/* ── Stepper ── */}
        <div className="flex items-center gap-3">
          {[
            { n: 1, label: "Sélection du gestionnaire" },
            { n: 2, label: "Profil RH" },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-3">
              {i > 0 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
              <button
                type="button"
                onClick={() => n < step && setStep(n as 1 | 2)}
                className="flex items-center gap-2 text-sm"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === n ? "bg-primary-600 text-white"
                    : step > n ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"}`}
                >
                  {step > n ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className={step === n ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}>
                  {label}
                </span>
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Étape 1 : Sélection gestionnaire ── */}
          {step === 1 && (
            <Card>
              <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  Sélectionner le gestionnaire
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Seuls les gestionnaires sans dossier RH sont affichés.
                </p>
              </div>

              {gestLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-4">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Chargement…
                </div>
              ) : gestionnaires.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Aucun gestionnaire disponible
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Tous les gestionnaires ont déjà un dossier RH, ou il n&apos;en existe aucun.
                  </p>
                  <Link
                    href="/dashboard/admin/gestionnaires"
                    className="mt-2 text-xs text-primary-600 dark:text-primary-400 underline"
                  >
                    Créer un gestionnaire
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Gestionnaire <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.gestionnaireId}
                      onChange={(e) => set("gestionnaireId", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">-- Sélectionner un gestionnaire --</option>
                      {gestionnaires.map((g) => {
                        const pdv = g.member.affectationsPDV[0]?.pointDeVente;
                        return (
                          <option key={g.id} value={g.id}>
                            {g.member.prenom} {g.member.nom}
                            {" "}({g.role.replace(/_/g, " ")})
                            {pdv ? ` — ${pdv.nom}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Fiche récap du gestionnaire sélectionné */}
                  {selectedGestionnaire && (
                    <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {selectedGestionnaire.member.prenom[0]}{selectedGestionnaire.member.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {selectedGestionnaire.member.prenom} {selectedGestionnaire.member.nom}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{selectedGestionnaire.member.email}</div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                            {selectedGestionnaire.role.replace(/_/g, " ")}
                          </span>
                          {selectedGestionnaire.member.affectationsPDV[0]?.pointDeVente && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {selectedGestionnaire.member.affectationsPDV[0].pointDeVente.nom}
                            </span>
                          )}
                        </div>
                      </div>
                      <Check className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  disabled={!form.gestionnaireId}
                  onClick={() => setStep(2)}
                  icon={<ChevronRight className="w-4 h-4" />}
                  className="flex-row-reverse"
                >
                  Suivant
                </Button>
              </div>
              </div>
            </Card>
          )}

          {/* ── Étape 2 : Profil RH ── */}
          {step === 2 && (
            <>
              {/* Récap gestionnaire */}
              {selectedGestionnaire && (
                <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {selectedGestionnaire.member.prenom[0]}{selectedGestionnaire.member.nom[0]}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {selectedGestionnaire.member.prenom} {selectedGestionnaire.member.nom}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 ml-2">
                      — {selectedGestionnaire.role.replace(/_/g, " ")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="ml-auto text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Modifier
                  </button>
                </div>
              )}

              {/* Contrat & Poste */}
              <Card>
                <div className="space-y-5">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  Contrat & Poste
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Type de contrat</label>
                    <select
                      value={form.typeContrat}
                      onChange={(e) => set("typeContrat", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner…</option>
                      {["CDI", "CDD", "STAGE", "CONSULTANT", "PRESTATAIRE", "FREELANCE"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Statut initial</label>
                    <select
                      value={form.statut}
                      onChange={(e) => set("statut", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="ACTIF">Actif</option>
                      <option value="EN_PERIODE_ESSAI">Période d&apos;essai</option>
                    </select>
                  </div>

                  <Input
                    type="date"
                    label="Date d'embauche"
                    value={form.dateEmbauche}
                    onChange={(e) => set("dateEmbauche", e.target.value)}
                    icon={<Calendar className="w-4 h-4" />}
                  />

                  {(form.typeContrat === "CDD" || form.typeContrat === "STAGE") && (
                    <Input
                      type="date"
                      label="Date de fin"
                      value={form.dateFin}
                      onChange={(e) => set("dateFin", e.target.value)}
                      icon={<Calendar className="w-4 h-4" />}
                    />
                  )}

                  <Input
                    type="text"
                    label="Fonction / Titre du poste"
                    value={form.fonction}
                    onChange={(e) => set("fonction", e.target.value)}
                    placeholder="Ex : Responsable commercial"
                  />

                  <Input
                    type="text"
                    label="Service"
                    value={form.service}
                    onChange={(e) => set("service", e.target.value)}
                    placeholder="Ex : Service commercial"
                  />

                  <Input
                    type="text"
                    label="Département"
                    value={form.departement}
                    onChange={(e) => set("departement", e.target.value)}
                    placeholder="Ex : Direction commerciale"
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Niveau hiérarchique</label>
                    <select
                      value={form.niveauHierarchique}
                      onChange={(e) => set("niveauHierarchique", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner…</option>
                      {[
                        ["DIRECTION",   "Direction"],
                        ["MANAGER",     "Manager"],
                        ["SUPERVISEUR", "Superviseur"],
                        ["AGENT",       "Agent"],
                        ["STAGIAIRE",   "Stagiaire"],
                      ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                </div>
              </Card>

              {/* Informations personnelles */}
              <Card>
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  Informations personnelles
                  <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(optionnel)</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="Date de naissance"
                    value={form.dateNaissance}
                    onChange={(e) => set("dateNaissance", e.target.value)}
                  />

                  <Input
                    type="text"
                    label="Lieu de naissance"
                    value={form.lieuNaissance}
                    onChange={(e) => set("lieuNaissance", e.target.value)}
                    placeholder="Ex : Cotonou"
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Sexe</label>
                    <select
                      value={form.sexe}
                      onChange={(e) => set("sexe", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner…</option>
                      <option value="MASCULIN">Masculin</option>
                      <option value="FEMININ">Féminin</option>
                      <option value="AUTRE">Autre</option>
                    </select>
                  </div>

                  <Input
                    type="text"
                    label="Nationalité"
                    value={form.nationalite}
                    onChange={(e) => set("nationalite", e.target.value)}
                    placeholder="Ex : Béninoise"
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Situation matrimoniale</label>
                    <select
                      value={form.situationMatrimoniale}
                      onChange={(e) => set("situationMatrimoniale", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner…</option>
                      {[
                        ["CELIBATAIRE", "Célibataire"],
                        ["MARIE",       "Marié(e)"],
                        ["DIVORCE",     "Divorcé(e)"],
                        ["VEUF",        "Veuf/Veuve"],
                        ["UNION_LIBRE", "Union libre"],
                      ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  <Input
                    type="number"
                    min="0"
                    label="Nombre d'enfants"
                    value={form.nbEnfants}
                    onChange={(e) => set("nbEnfants", e.target.value)}
                    placeholder="0"
                  />

                  <div className="sm:col-span-2">
                    <Input
                      type="tel"
                      label="Téléphone secondaire"
                      value={form.telephoneSecondaire}
                      onChange={(e) => set("telephoneSecondaire", e.target.value)}
                      placeholder="+229 00 00 00 00"
                    />
                  </div>
                </div>
              </div>
              </Card>

              {/* Notes */}
              <Card>
                <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Notes internes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  placeholder="Informations complémentaires sur ce collaborateur…"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none"
                />
                </div>
              </Card>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                <Button variant="secondary" type="button" onClick={() => setStep(1)} icon={<ArrowLeft className="w-4 h-4" />}>
                  Retour
                </Button>
                <Button type="submit" disabled={loading} loading={loading} icon={<UserPlus className="w-4 h-4" />}>
                  {loading ? "Création…" : "Créer le dossier"}
                </Button>
              </div>
            </>
          )}
        </form>

    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, User, Check, Briefcase, Calendar, Building2, ChevronRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useMutation, useApi } from "@/hooks/useApi";

interface GestionnaireOption {
  id: number; role: string;
  member: { nom: string; prenom: string; email: string; affectationsPDV: { pointDeVente: { nom: string; code: string } }[] };
}

interface FormData {
  gestionnaireId: string; typeContrat: string; statut: string;
  dateEmbauche: string; dateFin: string; fonction: string; service: string;
  departement: string; niveauHierarchique: string; dateNaissance: string;
  lieuNaissance: string; sexe: string; nationalite: string;
  situationMatrimoniale: string; nbEnfants: string; telephoneSecondaire: string; notes: string;
}

const INIT: FormData = {
  gestionnaireId: "", typeContrat: "", statut: "ACTIF",
  dateEmbauche: "", dateFin: "", fonction: "", service: "",
  departement: "", niveauHierarchique: "", dateNaissance: "",
  lieuNaissance: "", sexe: "", nationalite: "",
  situationMatrimoniale: "", nbEnfants: "", telephoneSecondaire: "", notes: "",
};

export default function NouveauCollaborateurRHPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormData>(INIT);

  const { data: gestRes, loading: gestLoading } = useApi<{ data: GestionnaireOption[] }>(
    "/api/admin/gestionnaires?sansProfilRH=true&limit=200"
  );
  const gestionnaires = gestRes?.data ?? [];
  const selected = gestionnaires.find((g) => g.id === Number(form.gestionnaireId)) ?? null;

  const { mutate, loading } = useMutation<{ id: number }, object>(
    "/api/responsableRH/collaborateurs", "POST",
    { successMessage: "Dossier RH créé avec succès" }
  );

  const set = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));

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
    if (result) router.push("/dashboard/user/responsablesRH/collaborateurs");
  };

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <Link href="/dashboard/user/responsablesRH/collaborateurs"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
            <ArrowLeft size={15} /> Retour aux collaborateurs
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-emerald-600" /> Nouveau dossier collaborateur
          </h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-3">
          {[{ n: 1, label: "Gestionnaire" }, { n: 2, label: "Profil RH" }].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-3">
              {i > 0 && <ChevronRight className="w-4 h-4 text-slate-300" />}
              <button type="button" onClick={() => n < step && setStep(n as 1 | 2)} className="flex items-center gap-2 text-sm">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === n ? "bg-emerald-600 text-white" : step > n ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"}`}>
                  {step > n ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className={step === n ? "font-semibold text-slate-800" : "text-slate-400"}>{label}</span>
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" /> Sélectionner le gestionnaire
                </h2>
                <p className="text-sm text-slate-500 mt-1">Seuls les gestionnaires sans dossier RH sont affichés.</p>
              </div>
              {gestLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><RefreshCw className="w-4 h-4 animate-spin" /> Chargement…</div>
              ) : gestionnaires.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <p className="text-sm text-slate-700 font-medium">Aucun gestionnaire disponible</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gestionnaire <span className="text-red-500">*</span></label>
                    <select value={form.gestionnaireId} onChange={(e) => set("gestionnaireId", e.target.value)} className={inputCls}>
                      <option value="">-- Sélectionner un gestionnaire --</option>
                      {gestionnaires.map((g) => {
                        const pdv = g.member.affectationsPDV[0]?.pointDeVente;
                        return (
                          <option key={g.id} value={g.id}>
                            {g.member.prenom} {g.member.nom} ({g.role.replace(/_/g, " ")}){pdv ? ` — ${pdv.nom}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {selected && (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {selected.member.prenom[0]}{selected.member.nom[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{selected.member.prenom} {selected.member.nom}</div>
                        <div className="text-sm text-slate-500">{selected.member.email}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{selected.role.replace(/_/g, " ")}</span>
                          {selected.member.affectationsPDV[0]?.pointDeVente && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />{selected.member.affectationsPDV[0].pointDeVente.nom}
                            </span>
                          )}
                        </div>
                      </div>
                      <Check className="w-5 h-5 text-emerald-600" />
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-end pt-2">
                <button type="button" disabled={!form.gestionnaireId} onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2">
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              {selected && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                    {selected.member.prenom[0]}{selected.member.nom[0]}
                  </div>
                  <span className="font-semibold text-slate-800">{selected.member.prenom} {selected.member.nom}</span>
                  <span className="text-slate-400">— {selected.role.replace(/_/g, " ")}</span>
                  <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-emerald-600 hover:underline">Modifier</button>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" /> Contrat & Poste
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type de contrat</label>
                    <select value={form.typeContrat} onChange={(e) => set("typeContrat", e.target.value)} className={inputCls}>
                      <option value="">Sélectionner…</option>
                      {["CDI","CDD","STAGE","CONSULTANT","PRESTATAIRE","FREELANCE"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Statut initial</label>
                    <select value={form.statut} onChange={(e) => set("statut", e.target.value)} className={inputCls}>
                      <option value="ACTIF">Actif</option>
                      <option value="EN_PERIODE_ESSAI">Période d&apos;essai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date d&apos;embauche</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input type="date" value={form.dateEmbauche} onChange={(e) => set("dateEmbauche", e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  {(form.typeContrat === "CDD" || form.typeContrat === "STAGE") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                  )}
                  {[
                    { key: "fonction", label: "Fonction / Titre", placeholder: "Ex : Responsable commercial" },
                    { key: "service",  label: "Service",          placeholder: "Ex : Service commercial" },
                    { key: "departement", label: "Département",   placeholder: "Ex : Direction commerciale" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                      <input value={form[key as keyof FormData]} onChange={(e) => set(key as keyof FormData, e.target.value)}
                        placeholder={placeholder} className={inputCls} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Niveau hiérarchique</label>
                    <select value={form.niveauHierarchique} onChange={(e) => set("niveauHierarchique", e.target.value)} className={inputCls}>
                      <option value="">Sélectionner…</option>
                      {[["DIRECTION","Direction"],["MANAGER","Manager"],["SUPERVISEUR","Superviseur"],["AGENT","Agent"],["STAGIAIRE","Stagiaire"]].map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" /> Informations personnelles
                  <span className="text-xs font-normal text-slate-400">(optionnel)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date de naissance</label>
                    <input type="date" value={form.dateNaissance} onChange={(e) => set("dateNaissance", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lieu de naissance</label>
                    <input value={form.lieuNaissance} onChange={(e) => set("lieuNaissance", e.target.value)} placeholder="Ex : Cotonou" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sexe</label>
                    <select value={form.sexe} onChange={(e) => set("sexe", e.target.value)} className={inputCls}>
                      <option value="">Sélectionner…</option>
                      <option value="MASCULIN">Masculin</option>
                      <option value="FEMININ">Féminin</option>
                      <option value="AUTRE">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nationalité</label>
                    <input value={form.nationalite} onChange={(e) => set("nationalite", e.target.value)} placeholder="Ex : Béninoise" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Situation matrimoniale</label>
                    <select value={form.situationMatrimoniale} onChange={(e) => set("situationMatrimoniale", e.target.value)} className={inputCls}>
                      <option value="">Sélectionner…</option>
                      {[["CELIBATAIRE","Célibataire"],["MARIE","Marié(e)"],["DIVORCE","Divorcé(e)"],["VEUF","Veuf/Veuve"],["UNION_LIBRE","Union libre"]].map(([v,l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre d&apos;enfants</label>
                    <input type="number" min="0" value={form.nbEnfants} onChange={(e) => set("nbEnfants", e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone secondaire</label>
                    <input type="tel" value={form.telephoneSecondaire} onChange={(e) => set("telephoneSecondaire", e.target.value)} placeholder="+229 00 00 00 00" className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
                <label className="block text-sm font-medium text-slate-700">Notes internes</label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
                  placeholder="Informations complémentaires…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </button>
                <button type="submit" disabled={loading}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</> : <><UserPlus className="w-4 h-4" /> Créer le dossier</>}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Save, User, Briefcase,
  Phone, Mail, Building2, Calendar, FileText,
  CalendarDays, Clock, CheckCircle, XCircle, TrendingDown,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types minimaux ────────────────────────────────────────────────────────────

interface ProfilRH {
  id: number; matricule: string; statut: string; typeContrat: string | null;
  dateEmbauche: string | null; dateFin: string | null;
  fonction: string | null; service: string | null; departement: string | null;
  niveauHierarchique: string | null; dateNaissance: string | null; lieuNaissance: string | null;
  sexe: string | null; nationalite: string | null; situationMatrimoniale: string | null;
  nbEnfants: number; telephoneSecondaire: string | null; notes: string | null;
  gestionnaire: {
    id: number; role: string; actif: boolean;
    member: { id: number; nom: string; prenom: string; email: string; telephone: string | null; photo: string | null; adresse: string | null;
      affectationsPDV: { pointDeVente: { id: number; nom: string; code: string } }[];
    };
  };
  manager: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } | null } | null;
  _count: { documents: number; demandesConge: number; missions: number; evaluations: number; procedures: number; fichesPaie: number; participationsFormation: number; pointages: number; avantages: number };
}

interface DemandeConge {
  id: number; type: string; statut: string; dateDebut: string; dateFin: string;
  nbJours: number; motif: string | null; commentaireRefus: string | null; createdAt: string;
}
interface SoldeConge { type: string; annee: number; totalDroit: number; pris: number; restant: number; reporte: number }

const STATUT_BADGE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700", EN_PERIODE_ESSAI: "bg-blue-100 text-blue-700",
  SUSPENDU: "bg-amber-100 text-amber-700",  DEMISSIONNAIRE: "bg-orange-100 text-orange-700",
  LICENCIE: "bg-red-100 text-red-700",      RETRAITE: "bg-purple-100 text-purple-700",
  INACTIF: "bg-gray-100 text-gray-500",
};
const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", EN_PERIODE_ESSAI: "Période d'essai", SUSPENDU: "Suspendu",
  DEMISSIONNAIRE: "Démissionnaire", LICENCIE: "Licencié", RETRAITE: "Retraité", INACTIF: "Inactif",
};
const TYPE_CONGE_LABEL: Record<string, string> = {
  ANNUEL: "Congé annuel", MALADIE: "Maladie", MATERNITE: "Maternité",
  PATERNITE: "Paternité", SANS_SOLDE: "Sans solde", EXCEPTIONNEL: "Exceptionnel",
};
const STATUT_CONGE_BADGE: Record<string, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-700", VALIDE_MANAGER: "bg-blue-100 text-blue-700",
  VALIDE_RH: "bg-indigo-100 text-indigo-700", APPROUVE: "bg-emerald-100 text-emerald-700",
  REJETE: "bg-red-100 text-red-700",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DossierCollaborateurRHPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<"identite" | "contrat" | "conges" | "pointages">("identite");

  const { data: res, loading, refetch } = useApi<{ data: ProfilRH }>(`/api/responsableRH/collaborateurs/${id}`);
  const profil = res?.data;

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>;
  if (!profil) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-400">
      <p className="text-sm">Collaborateur introuvable</p>
      <Link href="/dashboard/user/responsablesRH/collaborateurs" className="mt-3 text-sm text-emerald-600 hover:underline">Retour à la liste</Link>
    </div>
  );

  const pdv = profil.gestionnaire.member.affectationsPDV[0]?.pointDeVente;
  const TABS = [
    { key: "identite",  label: "Identité",        icon: <User className="w-4 h-4" /> },
    { key: "contrat",   label: "Contrat & Poste",  icon: <Briefcase className="w-4 h-4" /> },
    { key: "conges",    label: `Congés (${profil._count.demandesConge})`, icon: <CalendarDays className="w-4 h-4" /> },
    { key: "pointages", label: "Pointages",        icon: <Clock className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-2">
              <Link href="/dashboard/user/responsablesRH" className="hover:text-slate-600">Dashboard RH</Link>
              <span>/</span>
              <Link href="/dashboard/user/responsablesRH/collaborateurs" className="flex items-center gap-1 hover:text-slate-600">
                <ArrowLeft className="w-3.5 h-3.5" /> Collaborateurs
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                {profil.gestionnaire.member.prenom[0]}{profil.gestionnaire.member.nom[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{profil.gestionnaire.member.prenom} {profil.gestionnaire.member.nom}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-slate-400">{profil.matricule}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[profil.statut] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUT_LABEL[profil.statut] ?? profil.statut}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Chips infos rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Mail className="w-3.5 h-3.5" />,     label: profil.gestionnaire.member.email },
            { icon: <Phone className="w-3.5 h-3.5" />,    label: profil.gestionnaire.member.telephone ?? profil.telephoneSecondaire ?? "—" },
            { icon: <Building2 className="w-3.5 h-3.5" />, label: pdv?.nom ?? "Aucun PDV" },
            { icon: <Briefcase className="w-3.5 h-3.5" />, label: profil.fonction ?? "Fonction non définie" },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 truncate">
              <span className="text-slate-400 flex-shrink-0">{c.icon}</span>
              <span className="truncate">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "identite"  && <IdentiteTab  profil={profil} onSaved={refetch} />}
        {tab === "contrat"   && <ContratTab   profil={profil} onSaved={refetch} />}
        {tab === "conges"    && <CongesTab    profilId={profil.id} />}
        {tab === "pointages" && <PointagesTab profilId={profil.id} />}
      </div>
    </div>
  );
}

// ── Onglet Identité ───────────────────────────────────────────────────────────

function IdentiteTab({ profil, onSaved }: { profil: ProfilRH; onSaved: () => void }) {
  const { mutate, loading } = useMutation(`/api/responsableRH/collaborateurs/${profil.id}`, "PATCH");
  const [form, setForm] = useState({
    dateNaissance:         profil.dateNaissance?.slice(0, 10)  ?? "",
    lieuNaissance:         profil.lieuNaissance         ?? "",
    sexe:                  profil.sexe                  ?? "",
    nationalite:           profil.nationalite            ?? "",
    situationMatrimoniale: profil.situationMatrimoniale  ?? "",
    nbEnfants:             String(profil.nbEnfants       ?? 0),
    telephoneSecondaire:   profil.telephoneSecondaire    ?? "",
    notes:                 profil.notes                  ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = async () => {
    const r = await mutate({
      dateNaissance: form.dateNaissance || null, lieuNaissance: form.lieuNaissance || null,
      sexe: form.sexe || null, nationalite: form.nationalite || null,
      situationMatrimoniale: form.situationMatrimoniale || null, nbEnfants: Number(form.nbEnfants),
      telephoneSecondaire: form.telephoneSecondaire || null, notes: form.notes || null,
    });
    if (r) { toast.success("Identité mise à jour"); onSaved(); }
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Informations personnelles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
        {[
          { label: "Prénom",             value: profil.gestionnaire.member.prenom },
          { label: "Nom",                value: profil.gestionnaire.member.nom },
          { label: "Email",              value: profil.gestionnaire.member.email },
          { label: "Téléphone principal",value: profil.gestionnaire.member.telephone ?? profil.telephoneSecondaire ?? "—" },
        ].map(({ label, value }) => (
          <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Date de naissance</label>
          <input type="date" value={form.dateNaissance} onChange={(e) => set("dateNaissance", e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Lieu de naissance</label>
          <input value={form.lieuNaissance} onChange={(e) => set("lieuNaissance", e.target.value)} placeholder="Ville / pays" className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Sexe</label>
          <select value={form.sexe} onChange={(e) => set("sexe", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">—</option><option value="MASCULIN">Masculin</option><option value="FEMININ">Féminin</option><option value="AUTRE">Autre</option>
          </select></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Nationalité</label>
          <input value={form.nationalite} onChange={(e) => set("nationalite", e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Situation matrimoniale</label>
          <select value={form.situationMatrimoniale} onChange={(e) => set("situationMatrimoniale", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">—</option>
            {[["CELIBATAIRE","Célibataire"],["MARIE","Marié(e)"],["DIVORCE","Divorcé(e)"],["VEUF","Veuf/Veuve"],["UNION_LIBRE","Union libre"]].map(([v,l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Nombre d&apos;enfants</label>
          <input type="number" min={0} value={form.nbEnfants} onChange={(e) => set("nbEnfants", e.target.value)} className={inputCls} /></div>
        <div className="md:col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Téléphone secondaire</label>
          <input value={form.telephoneSecondaire} onChange={(e) => set("telephoneSecondaire", e.target.value)} className={inputCls} /></div>
      </div>
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Notes internes</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" /></div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Onglet Contrat ────────────────────────────────────────────────────────────

function ContratTab({ profil, onSaved }: { profil: ProfilRH; onSaved: () => void }) {
  const { mutate, loading } = useMutation(`/api/responsableRH/collaborateurs/${profil.id}`, "PATCH");
  const [form, setForm] = useState({
    typeContrat: profil.typeContrat ?? "", statut: profil.statut ?? "ACTIF",
    dateEmbauche: profil.dateEmbauche?.slice(0, 10) ?? "", dateFin: profil.dateFin?.slice(0, 10) ?? "",
    fonction: profil.fonction ?? "", service: profil.service ?? "",
    departement: profil.departement ?? "", niveauHierarchique: profil.niveauHierarchique ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = async () => {
    const r = await mutate({
      typeContrat: form.typeContrat || null, statut: form.statut,
      dateEmbauche: form.dateEmbauche || null, dateFin: form.dateFin || null,
      fonction: form.fonction || null, service: form.service || null,
      departement: form.departement || null, niveauHierarchique: form.niveauHierarchique || null,
    });
    if (r) { toast.success("Contrat mis à jour"); onSaved(); }
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Informations contractuelles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Statut RH</label>
          <select value={form.statut} onChange={(e) => set("statut", e.target.value)} className={`${inputCls} bg-white`}>
            {Object.entries({ ACTIF:"Actif", EN_PERIODE_ESSAI:"Période d&apos;essai", SUSPENDU:"Suspendu", DEMISSIONNAIRE:"Démissionnaire", LICENCIE:"Licencié", RETRAITE:"Retraité", INACTIF:"Inactif" }).map(([v,l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Type de contrat</label>
          <select value={form.typeContrat} onChange={(e) => set("typeContrat", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">—</option>
            {["CDI","CDD","STAGE","CONSULTANT","PRESTATAIRE","FREELANCE"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;embauche</label>
          <input type="date" value={form.dateEmbauche} onChange={(e) => set("dateEmbauche", e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Date de fin (CDD)</label>
          <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Fonction / Poste</label>
          <input value={form.fonction} onChange={(e) => set("fonction", e.target.value)} placeholder="Ex: Responsable commercial" className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Service</label>
          <input value={form.service} onChange={(e) => set("service", e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Département</label>
          <input value={form.departement} onChange={(e) => set("departement", e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Niveau hiérarchique</label>
          <select value={form.niveauHierarchique} onChange={(e) => set("niveauHierarchique", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">—</option>
            {[["DIRECTION","Direction"],["MANAGER","Manager"],["SUPERVISEUR","Superviseur"],["AGENT","Agent"],["STAGIAIRE","Stagiaire"]].map(([v,l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select></div>
      </div>
      {profil.manager && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Manager direct</p>
          <p className="text-sm font-semibold text-slate-800">
            {profil.manager.gestionnaire?.member.prenom} {profil.manager.gestionnaire?.member.nom}
            <span className="ml-2 font-mono text-xs text-slate-400">{profil.manager.matricule}</span>
          </p>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Onglet Congés ─────────────────────────────────────────────────────────────

function CongesTab({ profilId }: { profilId: number }) {
  const { data: res, loading, refetch } = useApi<{ data: { soldes: SoldeConge[]; demandes: DemandeConge[]; annee: number } }>(
    `/api/admin/rh/collaborateurs/${profilId}/conges`
  );
  const soldes   = res?.data?.soldes   ?? [];
  const demandes = res?.data?.demandes ?? [];
  const annee    = res?.data?.annee    ?? new Date().getFullYear();

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Soldes {annee}</h2>
          <button onClick={refetch} className="p-1.5 text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {soldes.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Aucune politique de congé configurée</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {soldes.map((s) => {
              const pct = s.totalDroit > 0 ? Math.round((s.pris / s.totalDroit) * 100) : 0;
              return (
                <div key={s.type} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-2">{TYPE_CONGE_LABEL[s.type] ?? s.type}</p>
                  <div className="flex items-end justify-between mb-2">
                    <div><span className="text-2xl font-bold text-slate-900">{s.restant}</span><span className="text-xs text-slate-400 ml-1">j restants</span></div>
                    <div className="text-right text-xs text-slate-400"><p>{s.pris}j pris / {s.totalDroit}j</p></div>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 80 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Historique des demandes</h2>
        </div>
        {demandes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <CalendarDays className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Aucune demande de congé</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {demandes.map((d) => (
              <div key={d.id} className="flex items-start gap-4 px-5 py-3">
                <div className="flex-shrink-0 mt-0.5">
                  {d.statut === "APPROUVE" ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : d.statut === "REJETE" ? <XCircle className="w-4 h-4 text-red-500" />
                    : <Clock className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{TYPE_CONGE_LABEL[d.type] ?? d.type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_CONGE_BADGE[d.statut] ?? "bg-gray-100 text-gray-500"}`}>
                      {d.statut.replace(/_/g, " ")}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400"><TrendingDown className="w-3 h-3" />{d.nbJours}j</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5"><Calendar className="w-3 h-3 inline mr-0.5" />{formatDate(d.dateDebut)} → {formatDate(d.dateFin)}</p>
                  {d.motif && <p className="text-xs text-slate-400 mt-0.5 truncate">{d.motif}</p>}
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{formatDate(d.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet Pointages ──────────────────────────────────────────────────────────

const POINTAGE_CFG: Record<string, { label: string; color: string }> = {
  PRESENT:      { label: "Présent",     color: "bg-emerald-100 text-emerald-700" },
  ABSENT:       { label: "Absent",      color: "bg-red-100 text-red-700"         },
  CONGE:        { label: "Congé",       color: "bg-blue-100 text-blue-700"       },
  MISSION:      { label: "Mission",     color: "bg-indigo-100 text-indigo-700"   },
  MALADIE:      { label: "Maladie",     color: "bg-orange-100 text-orange-700"   },
  DEMI_JOURNEE: { label: "Demi-journée",color: "bg-yellow-100 text-yellow-700"   },
  FERIE:        { label: "Férié",       color: "bg-purple-100 text-purple-700"   },
};

function PointagesTab({ profilId }: { profilId: number }) {
  const now = new Date();
  const [mois,  setMois]  = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());

  const { data: res, loading } = useApi<{ data: { id: number; date: string; statut: string; heuresSupp: number | null }[]; meta: { total: number } }>(
    `/api/admin/rh/pointages?profilRHId=${profilId}&mois=${mois}&annee=${annee}&limit=31`
  );
  const pointages = res?.data ?? [];

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex-1">Pointages</h2>
        <select value={mois} onChange={(e) => setMois(Number(e.target.value))} className="px-2 py-1 border border-slate-200 rounded-lg text-sm bg-white">
          {["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"].map((m, i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className="px-2 py-1 border border-slate-200 rounded-lg text-sm bg-white">
          {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {pointages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Aucun pointage enregistré</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {pointages.map((p) => {
            const cfg = POINTAGE_CFG[p.statut] ?? { label: p.statut, color: "bg-gray-100 text-gray-600" };
            return (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-sm text-slate-600 w-28 flex-shrink-0">{formatDate(p.date)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                {p.heuresSupp != null && p.heuresSupp > 0 && (
                  <span className="text-xs text-indigo-600">+{p.heuresSupp}h sup.</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

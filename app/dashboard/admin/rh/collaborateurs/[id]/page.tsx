"use client";

import { useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Save, Upload,
  User, FileText, Briefcase,
  Phone, Mail, Building2,
  Calendar, FileUp, CheckCircle, X,
  CalendarDays, TrendingDown, Clock, XCircle,
  MapPin, PlayCircle, Flag,
  Download, Archive, ExternalLink,
  Star, AlertTriangle, Shield,
  Banknote, GraduationCap, Gift, ChevronDown,
  History, ArrowRight,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfilRH {
  id:                    number;
  matricule:             string;
  statut:                string;
  typeContrat:           string | null;
  dateEmbauche:          string | null;
  dateFin:               string | null;
  fonction:              string | null;
  service:               string | null;
  departement:           string | null;
  niveauHierarchique:    string | null;
  dateNaissance:         string | null;
  lieuNaissance:         string | null;
  sexe:                  string | null;
  nationalite:           string | null;
  situationMatrimoniale: string | null;
  nbEnfants:             number;
  telephoneSecondaire:   string | null;
  notes:                 string | null;
  managerId:             number | null;
  gestionnaire: {
    id: number; role: string; actif: boolean;
    member: {
      id: number; nom: string; prenom: string;
      email: string; telephone: string | null;
      photo: string | null; adresse: string | null;
      affectationsPDV: { pointDeVente: { id: number; nom: string; code: string } }[];
    };
  };
  manager: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } } | null;
  } | null;
  subordonnes: {
    id: number; matricule: string; fonction: string | null;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } } | null;
  }[];
  documents: DocumentCollab[];
  _count: { documents: number; demandesConge: number; missions: number; evaluations: number; procedures: number; fichesPaie: number; participationsFormation: number; pointages: number; avantages: number };
}

interface SoldeConge {
  type:       string;
  annee:      number;
  totalDroit: number;
  pris:       number;
  restant:    number;
  reporte:    number;
}

interface DemandeConge {
  id:               number;
  type:             string;
  statut:           string;
  dateDebut:        string;
  dateFin:          string;
  nbJours:          number;
  motif:            string | null;
  commentaireRefus: string | null;
  createdAt:        string;
}

interface CongesResponse {
  data: { soldes: SoldeConge[]; demandes: DemandeConge[]; annee: number };
}

interface Mission {
  id:             number;
  reference:      string;
  titre:          string;
  destination:    string | null;
  dateDepart:     string;
  dateRetour:     string | null;
  dateRetourReel: string | null;
  statut:         string;
  rapport:        string | null;
  createdAt:      string;
}

interface MissionsResponse {
  data: Mission[];
  meta: { total: number };
}

interface DocRHGenere {
  id:        number;
  type:      string;
  titre:     string;
  version:   number;
  fileUrl:   string | null;
  notes:     string | null;
  archive:   boolean;
  createdAt: string;
}

interface DocsRHResponse {
  data: DocRHGenere[];
}

interface EvaluationRH {
  id:             number;
  periode:        string;
  annee:          number;
  statut:         string;
  dateDebut:      string | null;
  dateFin:        string | null;
  noteMoyenne:    number | null;
  appreciation:   string | null;
  evaluateur: {
    gestionnaire: { member: { nom: string; prenom: string } } | null;
  } | null;
  criteres: { id: number; libelle: string; note: number; commentaire: string | null }[];
}

interface EvalsResponse {
  data: EvaluationRH[];
  meta: { total: number };
}

interface ProcDisciplinaire {
  id:              number;
  type:            string;
  motif:           string;
  statut:          string;
  dateIncident:    string;
  dateProcedure:   string;
  decision:        string | null;
  dureeSuspension: number | null;
}

interface ProcsResponse {
  data: ProcDisciplinaire[];
  meta: { total: number };
}

interface FichePaie {
  id:          number;
  mois:        number;
  annee:       number;
  statut:      string;
  salaireBase: number;
  totalBrut:   number;
  totalRetenues: number;
  netAPayer:   number;
  dateVirement: string | null;
  composants:  { id: number; libelle: string; montant: number; type: string }[];
}

interface PaieResponse {
  data: FichePaie[];
  meta: { total: number };
}

interface Formation {
  id:          number;
  titre:       string;
  lieu:        string | null;
  formateur:   string | null;
  dateDebut:   string;
  dateFin:     string | null;
  statut:      string;
  dureeHeures: number | null;
  participations: { statut: string; note: number | null; certificatUrl: string | null }[];
}

interface FormationsResponse {
  data: Formation[];
  meta: { total: number };
}

interface Pointage {
  id:     number;
  date:   string;
  statut: string;
  heuresSupp: number | null;
  notes:  string | null;
}

interface PointagesResponse {
  data: Pointage[];
  meta: { total: number };
}

interface AvantageRH {
  id:            number;
  type:          string;
  libelle:       string;
  montantMensuel: number | null;
  dateDebut:     string;
  dateFin:       string | null;
  actif:         boolean;
}

interface RemboursementFrais {
  id:          number;
  type:        string;
  libelle:     string;
  montant:     number;
  statut:      string;
  dateDepense: string;
  justificatifUrl: string | null;
}

interface AvantagesResponse {
  data: AvantageRH[];
}

interface RembsResponse {
  data: RemboursementFrais[];
}

interface DocumentCollab {
  id:        number;
  type:      string;
  nom:       string;
  fileUrl:   string;
  version:   number;
  notes:     string | null;
  createdAt: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, string> = {
  ACTIF:             "bg-emerald-100 text-emerald-700",
  EN_PERIODE_ESSAI:  "bg-blue-100 text-blue-700",
  SUSPENDU:          "bg-amber-100 text-amber-700",
  DEMISSIONNAIRE:    "bg-orange-100 text-orange-700",
  LICENCIE:          "bg-red-100 text-red-700",
  RETRAITE:          "bg-purple-100 text-purple-700",
  INACTIF:           "bg-gray-100 text-gray-500",
};

const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", EN_PERIODE_ESSAI: "Période d'essai", SUSPENDU: "Suspendu",
  DEMISSIONNAIRE: "Démissionnaire", LICENCIE: "Licencié", RETRAITE: "Retraité", INACTIF: "Inactif",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  CNI: "Carte nationale d'identité", PASSEPORT: "Passeport",
  DIPLOME: "Diplôme", CERTIFICAT: "Certificat", CV: "CV",
  ATTESTATION: "Attestation", CONTRAT: "Contrat", PHOTO_IDENTITE: "Photo d'identité", AUTRE: "Autre",
};

const DOC_TYPE_COLOR: Record<string, string> = {
  CNI:           "bg-blue-100 text-blue-700",
  PASSEPORT:     "bg-indigo-100 text-indigo-700",
  DIPLOME:       "bg-emerald-100 text-emerald-700",
  CERTIFICAT:    "bg-teal-100 text-teal-700",
  CV:            "bg-purple-100 text-purple-700",
  ATTESTATION:   "bg-amber-100 text-amber-700",
  CONTRAT:       "bg-rose-100 text-rose-700",
  PHOTO_IDENTITE:"bg-pink-100 text-pink-700",
  AUTRE:         "bg-gray-100 text-gray-600",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DossierCollaborateurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tab, setTab] = useState<"identite" | "contrat" | "documents" | "conges" | "missions" | "docs-rh" | "evaluations" | "disciplinaire" | "paie" | "formations" | "pointages" | "avantages" | "historique">("identite");

  const { data: res, loading, refetch } = useApi<{ data: ProfilRH }>(
    `/api/admin/rh/collaborateurs/${id}`
  );
  const profil = res?.data;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400">
        <p className="text-sm">Collaborateur introuvable</p>
        <Link href="/dashboard/admin/rh/collaborateurs" className="mt-3 text-sm text-emerald-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const pdv = profil.gestionnaire.member.affectationsPDV[0]?.pointDeVente;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">

        {/* ── Breadcrumb + titre ── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-2">
              <Link href="/dashboard/admin/rh" className="hover:text-slate-600 transition-colors">Dashboard RH</Link>
              <span>/</span>
              <Link href="/dashboard/admin/rh/collaborateurs" className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Collaborateurs
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                {profil.gestionnaire.member.prenom[0]}{profil.gestionnaire.member.nom[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {profil.gestionnaire.member.prenom} {profil.gestionnaire.member.nom}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-slate-400">{profil.matricule}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[profil.statut] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUT_LABEL[profil.statut] ?? profil.statut}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={refetch}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── Infos rapides ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoChip icon={<Mail className="w-3.5 h-3.5" />}    label={profil.gestionnaire.member.email} />
          <InfoChip icon={<Phone className="w-3.5 h-3.5" />}   label={profil.gestionnaire.member.telephone ?? "—"} />
          <InfoChip icon={<Building2 className="w-3.5 h-3.5" />} label={pdv?.nom ?? "Aucun PDV"} />
          <InfoChip icon={<Briefcase className="w-3.5 h-3.5" />} label={profil.fonction ?? "Fonction non définie"} />
        </div>

        {/* ── Onglets ── */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {(["identite", "contrat", "documents", "conges", "missions", "docs-rh", "paie", "formations", "pointages", "avantages", "evaluations", "disciplinaire", "historique"] as const).map((t) => {
              const labels: Record<string, string> = { identite: "Identité", contrat: "Contrat & poste", documents: `Documents (${profil._count.documents})`, conges: `Congés (${profil._count.demandesConge})`, missions: `Missions (${profil._count.missions})`, "docs-rh": "Docs RH", paie: `Paie (${profil._count.fichesPaie})`, formations: `Formations (${profil._count.participationsFormation})`, pointages: "Pointages", avantages: `Avantages (${profil._count.avantages})`, evaluations: `Évaluations (${profil._count.evaluations})`, disciplinaire: `Disciplinaire (${profil._count.procedures})`, historique: "Historique de poste" };
              const icons: Record<string, React.ReactNode>  = { identite: <User className="w-4 h-4" />, contrat: <Briefcase className="w-4 h-4" />, documents: <FileText className="w-4 h-4" />, conges: <CalendarDays className="w-4 h-4" />, missions: <MapPin className="w-4 h-4" />, "docs-rh": <Archive className="w-4 h-4" />, paie: <Banknote className="w-4 h-4" />, formations: <GraduationCap className="w-4 h-4" />, pointages: <Clock className="w-4 h-4" />, avantages: <Gift className="w-4 h-4" />, evaluations: <Star className="w-4 h-4" />, disciplinaire: <AlertTriangle className="w-4 h-4" />, historique: <History className="w-4 h-4" /> };
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === t
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {icons[t]} {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Contenu onglets ── */}
        {tab === "identite" && (
          <IdentiteTab profil={profil} onSaved={refetch} />
        )}
        {tab === "contrat" && (
          <ContratTab profil={profil} onSaved={refetch} />
        )}
        {tab === "documents" && (
          <DocumentsTab profilId={profil.id} documents={profil.documents} onSaved={refetch} />
        )}
        {tab === "conges" && (
          <CongesTab profilId={profil.id} />
        )}
        {tab === "missions" && (
          <MissionsTab profilId={profil.id} />
        )}
        {tab === "docs-rh" && (
          <DocsRHTab profilId={profil.id} />
        )}
        {tab === "paie" && (
          <PaieTab profilId={profil.id} />
        )}
        {tab === "formations" && (
          <FormationsTab profilId={profil.id} />
        )}
        {tab === "pointages" && (
          <PointagesTab profilId={profil.id} />
        )}
        {tab === "avantages" && (
          <AvantagesTab profilId={profil.id} />
        )}
        {tab === "evaluations" && (
          <EvaluationsTab profilId={profil.id} />
        )}
        {tab === "disciplinaire" && (
          <DisciplinaireTab profilId={profil.id} />
        )}
        {tab === "historique" && (
          <HistoriquePosteTab profilId={profil.id} />
        )}

      </div>
    </div>
  );
}

// ── Onglet Identité ───────────────────────────────────────────────────────────

function IdentiteTab({ profil, onSaved }: { profil: ProfilRH; onSaved: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/collaborateurs/${profil.id}`, "PATCH");

  const [form, setForm] = useState({
    dateNaissance:         profil.dateNaissance?.slice(0, 10) ?? "",
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
    const result = await mutate({
      dateNaissance:         form.dateNaissance         || null,
      lieuNaissance:         form.lieuNaissance         || null,
      sexe:                  form.sexe                  || null,
      nationalite:           form.nationalite            || null,
      situationMatrimoniale: form.situationMatrimoniale  || null,
      nbEnfants:             Number(form.nbEnfants),
      telephoneSecondaire:   form.telephoneSecondaire    || null,
      notes:                 form.notes                  || null,
    });
    if (result) { toast.success("Identité mise à jour"); onSaved(); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Informations personnelles</h2>

      {/* Données venant du compte User (read-only ici) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
        <ReadField label="Prénom" value={profil.gestionnaire.member.prenom} />
        <ReadField label="Nom"    value={profil.gestionnaire.member.nom} />
        <ReadField label="Email"  value={profil.gestionnaire.member.email} />
        <ReadField label="Téléphone principal" value={profil.gestionnaire.member.telephone ?? "—"} />
        {profil.gestionnaire.member.adresse && (
          <ReadField label="Adresse" value={profil.gestionnaire.member.adresse} />
        )}
      </div>

      {/* Champs éditables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Date de naissance">
          <input type="date" value={form.dateNaissance} onChange={(e) => set("dateNaissance", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Lieu de naissance">
          <input value={form.lieuNaissance} onChange={(e) => set("lieuNaissance", e.target.value)}
            placeholder="Ville / pays"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Sexe">
          <select value={form.sexe} onChange={(e) => set("sexe", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Sélectionner —</option>
            <option value="MASCULIN">Masculin</option>
            <option value="FEMININ">Féminin</option>
            <option value="AUTRE">Autre</option>
          </select>
        </Field>

        <Field label="Nationalité">
          <input value={form.nationalite} onChange={(e) => set("nationalite", e.target.value)}
            placeholder="Ex: Ivoirienne"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Situation matrimoniale">
          <select value={form.situationMatrimoniale} onChange={(e) => set("situationMatrimoniale", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Sélectionner —</option>
            {[["CELIBATAIRE","Célibataire"],["MARIE","Marié(e)"],["DIVORCE","Divorcé(e)"],["VEUF","Veuf/Veuve"],["UNION_LIBRE","Union libre"]].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>

        <Field label="Nombre d'enfants">
          <input type="number" min={0} value={form.nbEnfants} onChange={(e) => set("nbEnfants", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Téléphone secondaire">
          <input value={form.telephoneSecondaire} onChange={(e) => set("telephoneSecondaire", e.target.value)}
            placeholder="+225 XX XX XX XX"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>
      </div>

      <Field label="Notes internes">
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
          placeholder="Notes RH confidentielles…"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
      </Field>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Onglet Contrat ────────────────────────────────────────────────────────────

function ContratTab({ profil, onSaved }: { profil: ProfilRH; onSaved: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/collaborateurs/${profil.id}`, "PATCH");

  const [form, setForm] = useState({
    typeContrat:        profil.typeContrat        ?? "",
    dateEmbauche:       profil.dateEmbauche?.slice(0, 10)  ?? "",
    dateFin:            profil.dateFin?.slice(0, 10)       ?? "",
    fonction:           profil.fonction           ?? "",
    service:            profil.service            ?? "",
    departement:        profil.departement        ?? "",
    niveauHierarchique: profil.niveauHierarchique ?? "",
    statut:             profil.statut             ?? "ACTIF",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const result = await mutate({
      typeContrat:        form.typeContrat        || null,
      dateEmbauche:       form.dateEmbauche       || null,
      dateFin:            form.dateFin            || null,
      fonction:           form.fonction           || null,
      service:            form.service            || null,
      departement:        form.departement        || null,
      niveauHierarchique: form.niveauHierarchique || null,
      statut:             form.statut,
    });
    if (result) { toast.success("Contrat mis à jour"); onSaved(); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Informations contractuelles</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Statut RH">
          <select value={form.statut} onChange={(e) => set("statut", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {Object.entries({ ACTIF:"Actif", EN_PERIODE_ESSAI:"Période d'essai", SUSPENDU:"Suspendu", DEMISSIONNAIRE:"Démissionnaire", LICENCIE:"Licencié", RETRAITE:"Retraité", INACTIF:"Inactif" }).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>

        <Field label="Type de contrat">
          <select value={form.typeContrat} onChange={(e) => set("typeContrat", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Sélectionner —</option>
            {["CDI","CDD","STAGE","CONSULTANT","PRESTATAIRE","FREELANCE"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label="Date d'embauche">
          <input type="date" value={form.dateEmbauche} onChange={(e) => set("dateEmbauche", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Date de fin (CDD)">
          <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Fonction / Poste">
          <input value={form.fonction} onChange={(e) => set("fonction", e.target.value)}
            placeholder="Ex: Responsable commercial"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Service">
          <input value={form.service} onChange={(e) => set("service", e.target.value)}
            placeholder="Ex: Commercial"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Département">
          <input value={form.departement} onChange={(e) => set("departement", e.target.value)}
            placeholder="Ex: Direction commerciale"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </Field>

        <Field label="Niveau hiérarchique">
          <select value={form.niveauHierarchique} onChange={(e) => set("niveauHierarchique", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Sélectionner —</option>
            {[["DIRECTION","Direction"],["MANAGER","Manager"],["SUPERVISEUR","Superviseur"],["AGENT","Agent"],["STAGIAIRE","Stagiaire"]].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Manager direct */}
      {profil.manager && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Manager direct</p>
          <p className="text-sm font-semibold text-slate-800">
            {profil.manager.gestionnaire?.member.prenom} {profil.manager.gestionnaire?.member.nom}
            <span className="ml-2 font-mono text-xs text-slate-400">{profil.manager.matricule}</span>
          </p>
        </div>
      )}

      {/* Subordonnés */}
      {profil.subordonnes.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 mb-2">Subordonnés directs ({profil.subordonnes.length})</p>
          <div className="flex flex-wrap gap-2">
            {profil.subordonnes.map((s) => (
              <Link key={s.id} href={`/dashboard/admin/rh/collaborateurs/${s.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-50">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold">
                  {s.gestionnaire?.member.prenom[0]}{s.gestionnaire?.member.nom[0]}
                </div>
                {s.gestionnaire?.member.prenom} {s.gestionnaire?.member.nom}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Onglet Documents ──────────────────────────────────────────────────────────

function DocumentsTab({
  profilId, documents, onSaved,
}: { profilId: number; documents: DocumentCollab[]; onSaved: () => void }) {
  const { mutate, loading } = useMutation(
    `/api/admin/rh/collaborateurs/${profilId}/documents`, "POST"
  );

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "", nom: "", fileUrl: "", notes: "" });

  const handleAdd = async () => {
    if (!form.type || !form.nom || !form.fileUrl) {
      toast.error("Type, nom et URL du fichier sont obligatoires");
      return;
    }
    const result = await mutate(form);
    if (result) {
      toast.success("Document ajouté");
      setForm({ type: "", nom: "", fileUrl: "", notes: "" });
      setShowForm(false);
      onSaved();
    }
  };

  // Grouper par type
  const grouped = documents.reduce<Record<string, DocumentCollab[]>>((acc, d) => {
    if (!acc[d.type]) acc[d.type] = [];
    acc[d.type].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Bouton ajouter */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          {showForm ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {showForm ? "Annuler" : "Ajouter un document"}
        </button>
      </div>

      {/* Formulaire ajout */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Nouveau document</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Type de document">
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Sélectionner —</option>
                {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Nom du fichier">
              <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="Ex: CNI_Recto_2024"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
            <Field label="URL du fichier" className="md:col-span-2">
              <input value={form.fileUrl} onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder="https://… (URL après upload)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optionnel"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
          </div>
          <div className="flex justify-end">
            <button onClick={handleAdd} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Enregistrer le document
            </button>
          </div>
        </div>
      )}

      {/* Documents groupés par type */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun document dans le dossier</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, docs]) => (
            <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${DOC_TYPE_COLOR[type] ?? "bg-gray-100 text-gray-600"}`}>
                  {DOC_TYPE_LABEL[type] ?? type}
                </span>
                <span className="text-xs text-slate-400">{docs.length} version{docs.length > 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{doc.nom}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">v{doc.version}</span>
                        {doc.version === Math.max(...docs.map((d) => d.version)) && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold flex-shrink-0">
                            <CheckCircle className="w-3 h-3" /> Actuel
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">
                          <Calendar className="w-3 h-3 inline mr-0.5" />
                          {formatDate(doc.createdAt)}
                        </span>
                        {doc.notes && (
                          <span className="text-xs text-slate-400 truncate">{doc.notes}</span>
                        )}
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      <FileText className="w-3.5 h-3.5" /> Ouvrir
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onglet Congés ─────────────────────────────────────────────────────────────

const TYPE_CONGE_LABEL: Record<string, string> = {
  ANNUEL:         "Congé annuel",
  MALADIE:        "Maladie",
  MATERNITE:      "Maternité",
  PATERNITE:      "Paternité",
  SANS_SOLDE:     "Sans solde",
  EXCEPTIONNEL:   "Exceptionnel",
  RECUPERATION:   "Récupération",
};

const STATUT_CONGE_BADGE: Record<string, string> = {
  EN_ATTENTE:    "bg-amber-100 text-amber-700",
  VALIDE_MANAGER:"bg-blue-100 text-blue-700",
  VALIDE_RH:     "bg-indigo-100 text-indigo-700",
  APPROUVE:      "bg-emerald-100 text-emerald-700",
  REJETE:        "bg-red-100 text-red-700",
};

const STATUT_CONGE_LABEL: Record<string, string> = {
  EN_ATTENTE:    "En attente",
  VALIDE_MANAGER:"Validé manager",
  VALIDE_RH:     "Validé RH",
  APPROUVE:      "Approuvé",
  REJETE:        "Rejeté",
};

function CongesTab({ profilId }: { profilId: number }) {
  const { data: res, loading, refetch } = useApi<CongesResponse>(
    `/api/admin/rh/collaborateurs/${profilId}/conges`
  );
  const soldes   = res?.data?.soldes   ?? [];
  const demandes = res?.data?.demandes ?? [];
  const annee    = res?.data?.annee    ?? new Date().getFullYear();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Soldes de l'année ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Soldes {annee}
          </h2>
          <button onClick={refetch} className="p-1.5 text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {soldes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucune politique de congé configurée</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {soldes.map((s) => {
              const pct = s.totalDroit > 0 ? Math.round((s.pris / s.totalDroit) * 100) : 0;
              return (
                <div key={s.type} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    {TYPE_CONGE_LABEL[s.type] ?? s.type}
                  </p>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <span className="text-2xl font-bold text-slate-900">{s.restant}</span>
                      <span className="text-xs text-slate-400 ml-1">j restants</span>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>{s.pris}j pris / {s.totalDroit}j</p>
                      {s.reporte > 0 && <p className="text-indigo-500">+{s.reporte}j reportés</p>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 text-right">{pct}% consommé</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Historique des demandes ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Historique des demandes
          </h2>
        </div>

        {demandes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune demande de congé</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {demandes.map((d) => (
              <div key={d.id} className="flex items-start gap-4 px-5 py-3">
                <div className="flex-shrink-0 mt-0.5">
                  {d.statut === "APPROUVE"
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : d.statut === "REJETE"
                    ? <XCircle className="w-4 h-4 text-red-500" />
                    : <Clock className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">
                      {TYPE_CONGE_LABEL[d.type] ?? d.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_CONGE_BADGE[d.statut] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUT_CONGE_LABEL[d.statut] ?? d.statut}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <TrendingDown className="w-3 h-3" />
                      {d.nbJours}j
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <Calendar className="w-3 h-3 inline mr-0.5" />
                    {formatDate(d.dateDebut)} → {formatDate(d.dateFin)}
                  </p>
                  {d.motif && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{d.motif}</p>
                  )}
                  {d.commentaireRefus && (
                    <p className="text-xs text-red-500 mt-0.5">Motif refus : {d.commentaireRefus}</p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">
                  {formatDate(d.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Onglet Missions ───────────────────────────────────────────────────────────

const MISSION_STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  CREE:     { label: "Créée",    badge: "bg-slate-100 text-slate-600",    icon: <Clock      className="w-3 h-3" /> },
  VALIDE:   { label: "Validée",  badge: "bg-blue-100 text-blue-700",      icon: <CheckCircle className="w-3 h-3" /> },
  EN_COURS: { label: "En cours", badge: "bg-amber-100 text-amber-700",    icon: <PlayCircle  className="w-3 h-3" /> },
  CLOTURE:  { label: "Clôturée", badge: "bg-emerald-100 text-emerald-700",icon: <Flag        className="w-3 h-3" /> },
  ANNULE:   { label: "Annulée",  badge: "bg-red-100 text-red-700",        icon: <XCircle     className="w-3 h-3" /> },
};

function MissionsTab({ profilId }: { profilId: number }) {
  const { data: res, loading } = useApi<MissionsResponse>(
    `/api/admin/rh/missions?collaborateurId=${profilId}&limit=50`
  );
  const missions = res?.data ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Missions ({missions.length})
        </h2>
        <a
          href="/dashboard/admin/rh/missions"
          className="text-xs text-emerald-600 hover:underline"
        >
          Voir toutes les missions →
        </a>
      </div>

      {missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <MapPin className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune mission enregistrée</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {missions.map((m) => {
            const cfg = MISSION_STATUT_CONFIG[m.statut] ?? MISSION_STATUT_CONFIG.CREE;
            return (
              <div key={m.id} className="flex items-start gap-4 px-5 py-3">
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.titre}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {m.destination && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" /> {m.destination}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(m.dateDepart)}
                      {m.dateRetour && ` → ${formatDate(m.dateRetour)}`}
                    </span>
                    <span className="text-xs font-mono text-slate-300">{m.reference}</span>
                  </div>
                  {m.rapport && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{m.rapport}</p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">
                  {formatDate(m.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Onglet Documents RH générés ───────────────────────────────────────────────

const DOC_RH_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  ATTESTATION_TRAVAIL:  { label: "Attestation de travail",  color: "bg-blue-100 text-blue-700"     },
  CERTIFICAT_PRESENCE:  { label: "Certificat de présence",  color: "bg-teal-100 text-teal-700"     },
  DECISION_AFFECTATION: { label: "Décision d'affectation",  color: "bg-indigo-100 text-indigo-700" },
  LETTRE_MISSION:       { label: "Lettre de mission",       color: "bg-amber-100 text-amber-700"   },
  AUTRE:                { label: "Autre",                   color: "bg-gray-100 text-gray-600"     },
};

function DocsRHTab({ profilId }: { profilId: number }) {
  const { mutate: create, loading: creating } = useMutation("/api/admin/rh/documents-rh", "POST");
  const { data: res, loading, refetch } = useApi<DocsRHResponse>(
    `/api/admin/rh/documents-rh?profilRHId=${profilId}&archive=false&limit=50`
  );
  const docs = res?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "", titre: "", fileUrl: "", notes: "" });
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleTypeChange = (v: string) => {
    const defaultTitre = v ? (DOC_RH_TYPE_CONFIG[v]?.label ?? v) : "";
    setForm((f) => ({ ...f, type: v, titre: f.titre || defaultTitre }));
  };

  const handleCreate = async () => {
    if (!form.type || !form.titre) {
      toast.error("Type et titre sont obligatoires");
      return;
    }
    const result = await create({
      profilRHId: profilId,
      type:    form.type,
      titre:   form.titre,
      fileUrl: form.fileUrl || null,
      notes:   form.notes   || null,
    });
    if (result) {
      toast.success("Document créé");
      setForm({ type: "", titre: "", fileUrl: "", notes: "" });
      setShowForm(false);
      refetch();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bouton ajouter */}
      <div className="flex justify-between items-center">
        <a
          href="/dashboard/admin/rh/documents-rh"
          className="text-xs text-emerald-600 hover:underline"
        >
          Voir tous les documents RH →
        </a>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          {showForm ? <X className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          {showForm ? "Annuler" : "Nouveau document"}
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Nouveau document RH généré</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Type de document">
              <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Sélectionner —</option>
                {Object.entries(DOC_RH_TYPE_CONFIG).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Titre">
              <input value={form.titre} onChange={(e) => setF("titre", e.target.value)}
                placeholder="Ex: Attestation de travail — 2026"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
            <Field label="URL du fichier PDF" className="md:col-span-2">
              <div className="relative">
                <input value={form.fileUrl} onChange={(e) => setF("fileUrl", e.target.value)}
                  placeholder="https://… (optionnel, peut être ajouté plus tard)"
                  className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                {form.fileUrl && (
                  <a href={form.fileUrl} target="_blank" rel="noreferrer"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <input value={form.notes} onChange={(e) => setF("notes", e.target.value)}
                placeholder="Optionnel"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Créer le document
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun document RH généré pour ce collaborateur</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const cfg = DOC_RH_TYPE_CONFIG[doc.type] ?? DOC_RH_TYPE_CONFIG.AUTRE;
              return (
                <div key={doc.id} className="flex items-start gap-4 px-5 py-3">
                  <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${cfg.color}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{doc.titre}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-slate-400">v{doc.version}</span>
                      {doc.fileUrl ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle className="w-3 h-3" /> Disponible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <Clock className="w-3 h-3" /> En attente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">
                        <Calendar className="w-3 h-3 inline mr-0.5" />
                        {formatDate(doc.createdAt)}
                      </span>
                      {doc.notes && (
                        <span className="text-xs text-slate-400 truncate">{doc.notes}</span>
                      )}
                    </div>
                  </div>
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet Paie ───────────────────────────────────────────────────────────────

const MOIS_LABEL = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const PAIE_STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-gray-100 text-gray-600",
  VALIDE:    "bg-blue-100 text-blue-700",
  PAYE:      "bg-emerald-100 text-emerald-700",
};
const PAIE_STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon", VALIDE: "Validée", PAYE: "Payée",
};

function PaieTab({ profilId }: { profilId: number }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data: res, loading } = useApi<PaieResponse>(
    `/api/admin/rh/paie?profilRHId=${profilId}&limit=24&orderBy=annee_desc`
  );
  const fiches = res?.data ?? [];

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Fiches de paie ({fiches.length})</h2>
        <a href="/dashboard/admin/rh/paie" className="text-xs text-emerald-600 hover:underline">Gérer la paie →</a>
      </div>
      {fiches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Banknote className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune fiche de paie</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {fiches.map((f) => (
            <div key={f.id}>
              <button
                onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{MOIS_LABEL[(f.mois ?? 1) - 1]} {f.annee}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAIE_STATUT_BADGE[f.statut] ?? "bg-gray-100 text-gray-500"}`}>
                      {PAIE_STATUT_LABEL[f.statut] ?? f.statut}
                    </span>
                  </div>
                  {f.dateVirement && <p className="text-xs text-slate-400 mt-0.5">Viré le {formatDate(f.dateVirement)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{f.netAPayer.toLocaleString("fr-FR")} FCFA</p>
                  <p className="text-xs text-slate-400">Net à payer</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded === f.id ? "rotate-180" : ""}`} />
              </button>
              {expanded === f.id && (
                <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-3 mb-3 pt-3">
                    <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500">Salaire base</p>
                      <p className="text-sm font-semibold text-slate-800">{f.salaireBase.toLocaleString("fr-FR")}</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500">Brut</p>
                      <p className="text-sm font-semibold text-slate-800">{f.totalBrut.toLocaleString("fr-FR")}</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500">Retenues</p>
                      <p className="text-sm font-semibold text-red-600">-{f.totalRetenues.toLocaleString("fr-FR")}</p>
                    </div>
                  </div>
                  {f.composants.length > 0 && (
                    <div className="space-y-1">
                      {f.composants.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{c.libelle}</span>
                          <span className={c.type === "RETENUE" ? "text-red-500 font-medium" : "text-emerald-600 font-medium"}>
                            {c.type === "RETENUE" ? "-" : "+"}{c.montant.toLocaleString("fr-FR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onglet Formations ─────────────────────────────────────────────────────────

const FORMATION_STATUT_BADGE: Record<string, string> = {
  PLANIFIEE: "bg-blue-100 text-blue-700",
  EN_COURS:  "bg-yellow-100 text-yellow-700",
  TERMINEE:  "bg-emerald-100 text-emerald-700",
  ANNULEE:   "bg-gray-100 text-gray-500",
};
const FORMATION_STATUT_LABEL: Record<string, string> = {
  PLANIFIEE: "Planifiée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée",
};
const PARTICIPATION_STATUT_BADGE: Record<string, string> = {
  INSCRIT:  "bg-blue-100 text-blue-700",
  PRESENT:  "bg-emerald-100 text-emerald-700",
  ABSENT:   "bg-red-100 text-red-700",
  CERTIFIE: "bg-purple-100 text-purple-700",
};
const PARTICIPATION_STATUT_LABEL: Record<string, string> = {
  INSCRIT: "Inscrit", PRESENT: "Présent", ABSENT: "Absent", CERTIFIE: "Certifié",
};

function FormationsTab({ profilId }: { profilId: number }) {
  const { data: res, loading } = useApi<FormationsResponse>(
    `/api/admin/rh/formations?profilRHId=${profilId}&limit=50`
  );
  const formations = res?.data ?? [];

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Formations suivies ({formations.length})</h2>
        <a href="/dashboard/admin/rh/formations" className="text-xs text-emerald-600 hover:underline">Gérer les formations →</a>
      </div>
      {formations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <GraduationCap className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune formation enregistrée</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {formations.map((f) => {
            const participation = f.participations[0];
            return (
              <div key={f.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">{f.titre}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FORMATION_STATUT_BADGE[f.statut] ?? "bg-gray-100 text-gray-500"}`}>
                      {FORMATION_STATUT_LABEL[f.statut] ?? f.statut}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {f.lieu && <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin className="w-3 h-3" />{f.lieu}</span>}
                    {f.formateur && <span className="text-xs text-slate-400">Par {f.formateur}</span>}
                    <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="w-3 h-3" />{formatDate(f.dateDebut)}{f.dateFin ? ` → ${formatDate(f.dateFin)}` : ""}</span>
                    {f.dureeHeures && <span className="text-xs text-slate-400">{f.dureeHeures}h</span>}
                  </div>
                </div>
                {participation && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PARTICIPATION_STATUT_BADGE[participation.statut] ?? "bg-gray-100 text-gray-500"}`}>
                      {PARTICIPATION_STATUT_LABEL[participation.statut] ?? participation.statut}
                    </span>
                    {participation.note != null && <StarDisplay value={participation.note} />}
                    {participation.certificatUrl && (
                      <a href={participation.certificatUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                        <ExternalLink className="w-3 h-3" /> Certificat
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Onglet Pointages ──────────────────────────────────────────────────────────

const POINTAGE_STATUT_CONFIG: Record<string, { label: string; color: string; short: string }> = {
  PRESENT:        { label: "Présent",         color: "bg-emerald-100 text-emerald-700", short: "P"  },
  ABSENT:         { label: "Absent",           color: "bg-red-100 text-red-700",        short: "A"  },
  CONGE:          { label: "Congé",            color: "bg-blue-100 text-blue-700",      short: "C"  },
  MISSION:        { label: "Mission",          color: "bg-indigo-100 text-indigo-700",  short: "M"  },
  MALADIE:        { label: "Maladie",          color: "bg-orange-100 text-orange-700",  short: "ML" },
  DEMI_JOURNEE:   { label: "Demi-journée",     color: "bg-yellow-100 text-yellow-700",  short: "DJ" },
  FERIE:          { label: "Férié",            color: "bg-purple-100 text-purple-700",  short: "F"  },
};

function PointagesTab({ profilId }: { profilId: number }) {
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());

  const { data: res, loading } = useApi<PointagesResponse>(
    `/api/admin/rh/pointages?profilRHId=${profilId}&mois=${mois}&annee=${annee}&limit=31`
  );
  const pointages = res?.data ?? [];

  const byDate = Object.fromEntries(pointages.map((p) => [p.date.slice(0, 10), p]));
  const daysInMonth = new Date(annee, mois, 0).getDate();

  function prevMonth() { if (mois === 1) { setMois(12); setAnnee(a => a - 1); } else setMois(m => m - 1); }
  function nextMonth() { if (mois === 12) { setMois(1); setAnnee(a => a + 1); } else setMois(m => m + 1); }

  const stats = Object.entries(POINTAGE_STATUT_CONFIG).map(([k, v]) => ({
    key: k, ...v,
    count: pointages.filter((p) => p.statut === k).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header navigation mois */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-slate-200 text-slate-500">‹</button>
          <h2 className="text-sm font-semibold text-slate-700">
            {MOIS_LABEL[mois - 1]} {annee}
          </h2>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-slate-200 text-slate-500">›</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <>
            {/* Stats bar */}
            {stats.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100">
                {stats.map((s) => (
                  <span key={s.key} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                    {s.short} × {s.count}
                  </span>
                ))}
              </div>
            )}
            {/* Calendrier */}
            <div className="grid grid-cols-7 gap-px bg-slate-100 p-px m-4 rounded-lg overflow-hidden text-center">
              {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d) => (
                <div key={d} className="bg-slate-50 text-xs font-medium text-slate-400 py-1.5">{d}</div>
              ))}
              {/* Offset de début de mois */}
              {Array.from({ length: (new Date(annee, mois - 1, 1).getDay() + 6) % 7 }).map((_, i) => (
                <div key={`e-${i}`} className="bg-white py-2" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateStr = `${annee}-${String(mois).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const p = byDate[dateStr];
                const cfg = p ? POINTAGE_STATUT_CONFIG[p.statut] : null;
                return (
                  <div key={day} className={`bg-white py-2 ${cfg ? cfg.color : ""}`}>
                    <div className="text-xs font-medium">{day}</div>
                    {cfg && <div className="text-[10px] font-bold mt-0.5">{cfg.short}</div>}
                    {p?.heuresSupp ? <div className="text-[9px] text-orange-500">+{p.heuresSupp}h</div> : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="text-right">
        <a href="/dashboard/admin/rh/pointages" className="text-xs text-emerald-600 hover:underline">Gérer les pointages →</a>
      </div>
    </div>
  );
}

// ── Onglet Avantages ──────────────────────────────────────────────────────────

const AVANTAGE_TYPE_LABEL: Record<string, string> = {
  VEHICULE:         "Véhicule",
  LOGEMENT:         "Logement",
  ASSURANCE:        "Assurance",
  TELEPHONE:        "Téléphone",
  REPAS:            "Repas",
  TRANSPORT:        "Transport",
  PRIME_MENSUELLE:  "Prime mensuelle",
  AUTRE:            "Autre",
};

const REMB_TYPE_LABEL: Record<string, string> = {
  DEPLACEMENT: "Déplacement", REPAS: "Repas", HEBERGEMENT: "Hébergement",
  MATERIEL: "Matériel", FORMATION: "Formation", AUTRE: "Autre",
};

const REMB_STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE: "bg-yellow-100 text-yellow-700",
  APPROUVE:   "bg-blue-100 text-blue-700",
  REJETE:     "bg-red-100 text-red-700",
  PAYE:       "bg-emerald-100 text-emerald-700",
};
const REMB_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente", APPROUVE: "Approuvé", REJETE: "Rejeté", PAYE: "Payé",
};

function AvantagesTab({ profilId }: { profilId: number }) {
  const [subTab, setSubTab] = useState<"avantages" | "remboursements">("avantages");

  const { data: avRes, loading: avLoading } = useApi<AvantagesResponse>(
    `/api/admin/rh/avantages?profilRHId=${profilId}&actif=all&limit=50`
  );
  const { data: reRes, loading: reLoading } = useApi<RembsResponse>(
    `/api/admin/rh/remboursements-frais?profilRHId=${profilId}&limit=50`
  );

  const avantages      = avRes?.data ?? [];
  const remboursements = reRes?.data ?? [];

  const actifs  = avantages.filter((a) => a.actif);
  const inactifs = avantages.filter((a) => !a.actif);

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(["avantages", "remboursements"] as const).map((st) => (
          <button
            key={st}
            onClick={() => setSubTab(st)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${subTab === st ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {st === "avantages" ? `Avantages (${avantages.length})` : `Remboursements (${remboursements.length})`}
          </button>
        ))}
      </div>

      {subTab === "avantages" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Avantages</h3>
            <a href="/dashboard/admin/rh/avantages" className="text-xs text-emerald-600 hover:underline">Gérer →</a>
          </div>
          {avLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…</div>
          ) : avantages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Gift className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucun avantage enregistré</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...actifs, ...inactifs].map((a) => (
                <div key={a.id} className={`flex items-center gap-4 px-5 py-3 ${!a.actif ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{a.libelle}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{AVANTAGE_TYPE_LABEL[a.type] ?? a.type}</span>
                      {!a.actif && <span className="text-xs text-slate-400">(inactif)</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Depuis {formatDate(a.dateDebut)}{a.dateFin ? ` → ${formatDate(a.dateFin)}` : ""}
                    </p>
                  </div>
                  {a.montantMensuel != null && (
                    <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                      {a.montantMensuel.toLocaleString("fr-FR")} FCFA/mois
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "remboursements" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Remboursements de frais</h3>
            <a href="/dashboard/admin/rh/avantages" className="text-xs text-emerald-600 hover:underline">Gérer →</a>
          </div>
          {reLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…</div>
          ) : remboursements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucun remboursement</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {remboursements.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{r.libelle}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{REMB_TYPE_LABEL[r.type] ?? r.type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REMB_STATUT_BADGE[r.statut] ?? "bg-gray-100 text-gray-500"}`}>
                        {REMB_STATUT_LABEL[r.statut] ?? r.statut}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Dépense : {formatDate(r.dateDepense)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-700">{r.montant.toLocaleString("fr-FR")} FCFA</span>
                    {r.justificatifUrl && (
                      <a href={r.justificatifUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-700">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Onglet Évaluations ────────────────────────────────────────────────────────

const PERIODE_LABEL: Record<string, string> = {
  ANNUELLE:     "Annuelle",
  SEMESTRIELLE: "Semestrielle",
  TRIMESTRIELLE:"Trimestrielle",
  PROBATOIRE:   "Probatoire",
};

const EVAL_STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-gray-100 text-gray-600",
  EN_COURS:  "bg-blue-100 text-blue-700",
  CLOTURE:   "bg-emerald-100 text-emerald-700",
};

const EVAL_STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_COURS:  "En cours",
  CLOTURE:   "Clôturée",
};

function StarDisplay({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={12} className={s <= value ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
      ))}
    </span>
  );
}

function EvaluationsTab({ profilId }: { profilId: number }) {
  const { data: res, loading } = useApi<EvalsResponse>(
    `/api/admin/rh/evaluations?profilRHId=${profilId}&limit=50`
  );
  const evals = res?.data ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Évaluations ({evals.length})
        </h2>
        <a href="/dashboard/admin/rh/evaluations" className="text-xs text-emerald-600 hover:underline">
          Gérer les évaluations →
        </a>
      </div>

      {evals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Star className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune évaluation enregistrée</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {evals.map((ev) => {
            const evaluateurName = ev.evaluateur?.gestionnaire?.member
              ? `${ev.evaluateur.gestionnaire.member.prenom} ${ev.evaluateur.gestionnaire.member.nom}`
              : null;
            return (
              <div key={ev.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">
                        {PERIODE_LABEL[ev.periode] ?? ev.periode} {ev.annee}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVAL_STATUT_BADGE[ev.statut] ?? "bg-gray-100 text-gray-600"}`}>
                        {EVAL_STATUT_LABEL[ev.statut] ?? ev.statut}
                      </span>
                    </div>
                    {evaluateurName && (
                      <p className="text-xs text-slate-400 mt-0.5">Évaluateur : {evaluateurName}</p>
                    )}
                    {ev.dateDebut && (
                      <p className="text-xs text-slate-400">
                        <Calendar className="w-3 h-3 inline mr-0.5" />
                        {formatDate(ev.dateDebut)}{ev.dateFin ? ` → ${formatDate(ev.dateFin)}` : ""}
                      </p>
                    )}
                  </div>
                  {ev.noteMoyenne != null && (
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StarDisplay value={Math.round(ev.noteMoyenne)} />
                      <span className="text-xs text-slate-400">{ev.noteMoyenne.toFixed(1)} / 5</span>
                    </div>
                  )}
                </div>

                {ev.criteres.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ev.criteres.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-600 truncate mr-2">{c.libelle}</span>
                        <StarDisplay value={c.note} />
                      </div>
                    ))}
                  </div>
                )}

                {ev.appreciation && (
                  <p className="mt-2 text-xs text-slate-500 italic">{ev.appreciation}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Onglet Disciplinaire ───────────────────────────────────────────────────────

const TYPE_SANCTION_LABEL: Record<string, string> = {
  AVERTISSEMENT: "Avertissement",
  BLAME:         "Blâme",
  MISE_A_PIED:   "Mise à pied",
  RETROGRADATION:"Rétrogradation",
  LICENCIEMENT:  "Licenciement",
  AUTRE:         "Autre",
};

const TYPE_SANCTION_COLOR: Record<string, string> = {
  AVERTISSEMENT: "bg-yellow-100 text-yellow-700",
  BLAME:         "bg-orange-100 text-orange-700",
  MISE_A_PIED:   "bg-red-100 text-red-700",
  RETROGRADATION:"bg-purple-100 text-purple-700",
  LICENCIEMENT:  "bg-red-200 text-red-800",
  AUTRE:         "bg-gray-100 text-gray-600",
};

const PROC_STATUT_BADGE: Record<string, string> = {
  OUVERTE:        "bg-blue-100 text-blue-700",
  EN_INSTRUCTION: "bg-yellow-100 text-yellow-700",
  CLOTUREE:       "bg-emerald-100 text-emerald-700",
  ANNULEE:        "bg-gray-100 text-gray-500",
};

const PROC_STATUT_LABEL: Record<string, string> = {
  OUVERTE:        "Ouverte",
  EN_INSTRUCTION: "En instruction",
  CLOTUREE:       "Clôturée",
  ANNULEE:        "Annulée",
};

function DisciplinaireTab({ profilId }: { profilId: number }) {
  const { data: res, loading } = useApi<ProcsResponse>(
    `/api/admin/rh/disciplinaire?profilRHId=${profilId}&limit=50`
  );
  const procs = res?.data ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Procédures disciplinaires ({procs.length})
        </h2>
        <a href="/dashboard/admin/rh/disciplinaire" className="text-xs text-emerald-600 hover:underline">
          Gérer les procédures →
        </a>
      </div>

      {procs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Shield className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune procédure disciplinaire</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {procs.map((p) => (
            <div key={p.id} className="flex items-start gap-4 px-5 py-4">
              <div className="flex-shrink-0 mt-0.5">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_SANCTION_COLOR[p.type] ?? "bg-gray-100 text-gray-600"}`}>
                  {TYPE_SANCTION_LABEL[p.type] ?? p.type}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.motif}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" /> Incident : {formatDate(p.dateIncident)}
                  </span>
                  {p.dureeSuspension && (
                    <span className="text-xs text-slate-400">{p.dureeSuspension}j suspension</span>
                  )}
                </div>
                {p.decision && (
                  <p className="text-xs text-slate-500 mt-1 italic">Décision : {p.decision}</p>
                )}
              </div>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${PROC_STATUT_BADGE[p.statut] ?? "bg-gray-100 text-gray-500"}`}>
                {PROC_STATUT_LABEL[p.statut] ?? p.statut}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onglet Historique de poste ─────────────────────────────────────────────────

interface HistoriquePosteItem {
  id: number;
  ancienManagerId:    number | null;
  nouveauManagerId:   number | null;
  ancienneFonction:   string | null;
  nouvelleFonction:   string | null;
  ancienService:      string | null;
  nouveauService:     string | null;
  ancienDepartement:  string | null;
  nouveauDepartement: string | null;
  motif:              string | null;
  createdAt:          string;
  ancienManager:  { nom: string; prenom: string } | null;
  nouveauManager: { nom: string; prenom: string } | null;
}

function HistoriquePosteTab({ profilId }: { profilId: number }) {
  const { data: res, loading } = useApi<{ data: HistoriquePosteItem[] }>(
    `/api/admin/rh/collaborateurs/${profilId}/historique-poste`
  );
  const items = res?.data ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Historique organisationnel ({items.length})
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <History className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucun mouvement enregistré</p>
          <p className="text-xs mt-1 text-slate-300">Les réaffectations depuis l&apos;organigramme apparaîtront ici</p>
        </div>
      ) : (
        <div className="relative px-5 py-4">
          {/* Ligne verticale de timeline */}
          <div className="absolute left-9 top-4 bottom-4 w-0.5 bg-slate-100" />

          <div className="space-y-6">
            {items.map((item) => {
              const managerChange =
                item.ancienManagerId !== item.nouveauManagerId ||
                (!item.ancienManagerId && item.nouveauManagerId) ||
                (item.ancienManagerId && !item.nouveauManagerId);

              const fonctionChange = item.ancienneFonction !== item.nouvelleFonction;
              const deptChange = item.ancienDepartement !== item.nouveauDepartement;

              return (
                <div key={item.id} className="relative flex gap-4">
                  {/* Point timeline */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 border-2 border-indigo-300 flex items-center justify-center z-10">
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                  </div>

                  <div className="flex-1 pb-2">
                    <div className="text-xs text-slate-400 mb-2">{formatDate(item.createdAt)}</div>

                    <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                      {/* Changement manager */}
                      {managerChange && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 w-20 flex-shrink-0">Manager</span>
                          <span className="text-slate-600">
                            {item.ancienManager
                              ? `${item.ancienManager.prenom} ${item.ancienManager.nom}`
                              : <span className="italic text-slate-400">Aucun</span>}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-indigo-700">
                            {item.nouveauManager
                              ? `${item.nouveauManager.prenom} ${item.nouveauManager.nom}`
                              : <span className="italic text-slate-400">Aucun</span>}
                          </span>
                        </div>
                      )}

                      {/* Changement fonction */}
                      {fonctionChange && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 w-20 flex-shrink-0">Fonction</span>
                          <span className="text-slate-600">{item.ancienneFonction ?? "—"}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-indigo-700">{item.nouvelleFonction ?? "—"}</span>
                        </div>
                      )}

                      {/* Changement département */}
                      {deptChange && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 w-20 flex-shrink-0">Département</span>
                          <span className="text-slate-600">{item.ancienDepartement ?? "—"}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-indigo-700">{item.nouveauDepartement ?? "—"}</span>
                        </div>
                      )}

                      {/* Motif */}
                      {item.motif && (
                        <div className="text-xs text-slate-400 italic border-t border-slate-200 pt-2 mt-2">
                          {item.motif}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function Field({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 truncate">
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span className="truncate text-xs">{label}</span>
    </div>
  );
}

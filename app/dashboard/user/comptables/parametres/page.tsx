"use client";

// Paramètres — Configuration initiale (page par défaut de la rubrique).
// Extrait du bloc activeTab === "configInitiale" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 5187), consommant /api/comptable/configuration-initiale (~ligne 1321), /api/comptable/societes
// (~ligne 1339) et /api/comptable/devises (~ligne 1342). Inclut aussi Sociétés/Devises (CDC §49-50).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDateShort } from "@/lib/format";
import { ListChecks, Save, CheckCircle, AlertCircle, PlusCircle, ToggleLeft, ToggleRight } from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface EtapeConfigEntry {
  cle: string; label: string; complete: boolean; optionnelle: boolean; detail: string; onglet: string;
}
interface ConfigurationInitialeData {
  config: {
    pays: string; devise: string; referentiel: string; typeEntite: string;
    compteAchatDefaut: string | null; compteVenteDefaut: string | null; compteStockDefaut: string | null;
    compteVariationStockDefaut: string | null; compteTvaAchatDefaut: string | null; compteTvaVenteDefaut: string | null;
  };
  etapes: EtapeConfigEntry[];
}
interface SocieteEntry {
  id: number; nom: string; pays: string; deviseFonctionnelleCode: string;
  referentielComptable: string; typeEntite: string; estPrincipale: boolean; actif: boolean;
}
interface DeviseEntry {
  code: string; nom: string; symbole: string; tauxVersFonctionnelle: number | string;
  dateTauxMaj: string; actif: boolean;
}
interface ReferentielEntry {
  id: number; code: string; nom: string; version: string; pays: string;
  dateApplication: string; actif: boolean; notes: string | null;
}

// L'ancien assistant renvoyait vers un onglet du monolithe (setActiveTab) ; on route
// désormais vers la nouvelle sous-page correspondante (layout.tsx niveau 1).
const ONGLET_TO_PATH: Record<string, string> = {
  exercices: "/dashboard/user/comptables/inventaire-cloture/exercices",
  plan: "/dashboard/user/comptables/plan-comptable",
  auxiliaire: "/dashboard/user/comptables/auxiliaire",
  immobilisations: "/dashboard/user/comptables/immobilisations",
  analytique: "/dashboard/user/comptables/analytique",
  cloture: "/dashboard/user/comptables/inventaire-cloture/exercices",
};

export default function ConfigurationInitialePage() {
  const router = useRouter();

  const { data: configInitialeData, refetch: refetchConfigInitiale } = useApi<{ data: ConfigurationInitialeData }>(
    "/api/comptable/configuration-initiale"
  );
  const { mutate: enregistrerConfig, loading: enregistrantConfig } = useMutation<unknown, object>(
    "/api/comptable/configuration-initiale", "PATCH", { successMessage: "Configuration enregistrée" }
  );
  const [configForm, setConfigForm] = useState({
    pays: "", devise: "", referentiel: "", typeEntite: "",
    compteAchatDefaut: "", compteVenteDefaut: "", compteStockDefaut: "", compteVariationStockDefaut: "", compteTvaAchatDefaut: "", compteTvaVenteDefaut: "",
  });
  const [configFormInit, setConfigFormInit] = useState(false);
  useEffect(() => {
    if (configInitialeData?.data.config && !configFormInit) {
      const c = configInitialeData.data.config;
      // Initialisation unique du formulaire depuis les données chargées de façon
      // asynchrone (useApi) — impossible à faire en lazy useState (les données
      // n'existent pas encore au premier rendu). Le flag configFormInit garantit
      // que ça n'écrase jamais une saisie utilisateur en cours.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigForm({
        pays: c.pays, devise: c.devise, referentiel: c.referentiel, typeEntite: c.typeEntite,
        compteAchatDefaut: c.compteAchatDefaut ?? "", compteVenteDefaut: c.compteVenteDefaut ?? "",
        compteStockDefaut: c.compteStockDefaut ?? "", compteVariationStockDefaut: c.compteVariationStockDefaut ?? "",
        compteTvaAchatDefaut: c.compteTvaAchatDefaut ?? "", compteTvaVenteDefaut: c.compteTvaVenteDefaut ?? "",
      });
      setConfigFormInit(true);
    }
  }, [configInitialeData, configFormInit]);
  async function handleEnregistrerConfig() {
    const res = await enregistrerConfig(configForm);
    if (res) refetchConfigInitiale();
  }

  const { data: societesData, refetch: refetchSocietes } = useApi<{ data: SocieteEntry[] }>("/api/comptable/societes");
  const { data: devisesData, refetch: refetchDevises } = useApi<{ data: DeviseEntry[] }>("/api/comptable/devises");
  const [nouvelleSociete, setNouvelleSociete] = useState({ nom: "", pays: "Togo", deviseFonctionnelleCode: "XOF", referentielComptable: "SYSCOHADA révisé" });
  const [nouvelleDevise, setNouvelleDevise] = useState({ code: "", nom: "", symbole: "", tauxVersFonctionnelle: "1" });
  const { mutate: creerSociete } = useMutation<unknown, object>("/api/comptable/societes", "POST", { successMessage: "Société créée" });
  const { mutate: creerDevise } = useMutation<unknown, object>("/api/comptable/devises", "POST", { successMessage: "Devise créée" });
  const societeActionIdRef = useRef<number | null>(null);
  const { mutate: patchSociete } = useMutation<unknown, object>(
    () => `/api/comptable/societes/${societeActionIdRef.current}`, "PATCH"
  );
  const deviseActionCodeRef = useRef<string | null>(null);
  const { mutate: patchDevise } = useMutation<unknown, object>(
    () => `/api/comptable/devises/${deviseActionCodeRef.current}`, "PATCH"
  );

  const { data: referentielsData, refetch: refetchReferentiels } = useApi<{ data: ReferentielEntry[]; referentielActifId: number | null }>("/api/comptable/referentiels");
  const [nouveauReferentiel, setNouveauReferentiel] = useState({ code: "", nom: "", version: "", pays: "Togo", dateApplication: "" });
  const { mutate: creerReferentiel } = useMutation<unknown, object>("/api/comptable/referentiels", "POST", { successMessage: "Référentiel créé" });
  const referentielActionIdRef = useRef<number | null>(null);
  const { mutate: activerReferentiel } = useMutation<unknown, object>(
    () => `/api/comptable/referentiels/${referentielActionIdRef.current}/activer`, "POST"
  );
  async function handleCreerReferentiel() {
    if (!nouveauReferentiel.code.trim() || !nouveauReferentiel.nom.trim() || !nouveauReferentiel.version.trim() || !nouveauReferentiel.dateApplication) return;
    const res = await creerReferentiel(nouveauReferentiel);
    if (res) { refetchReferentiels(); setNouveauReferentiel({ code: "", nom: "", version: "", pays: "Togo", dateApplication: "" }); }
  }
  async function handleActiverReferentiel(r: ReferentielEntry) {
    referentielActionIdRef.current = r.id;
    const res = await activerReferentiel({});
    if (res) refetchReferentiels();
  }

  async function handleCreerSociete() {
    if (!nouvelleSociete.nom.trim()) return;
    const res = await creerSociete(nouvelleSociete);
    if (res) { refetchSocietes(); setNouvelleSociete({ nom: "", pays: "Togo", deviseFonctionnelleCode: "XOF", referentielComptable: "SYSCOHADA révisé" }); }
  }
  async function handleCreerDevise() {
    if (!nouvelleDevise.code.trim() || !nouvelleDevise.nom.trim() || !nouvelleDevise.symbole.trim()) return;
    const res = await creerDevise({ ...nouvelleDevise, tauxVersFonctionnelle: Number(nouvelleDevise.tauxVersFonctionnelle) || 1 });
    if (res) { refetchDevises(); setNouvelleDevise({ code: "", nom: "", symbole: "", tauxVersFonctionnelle: "1" }); }
  }
  async function handleToggleSociete(s: SocieteEntry) {
    societeActionIdRef.current = s.id;
    const res = await patchSociete({ actif: !s.actif });
    if (res) refetchSocietes();
  }
  async function handleToggleDevise(d: DeviseEntry) {
    deviseActionCodeRef.current = d.code;
    const res = await patchDevise({ actif: !d.actif });
    if (res) refetchDevises();
  }
  async function handleTauxDevise(d: DeviseEntry, taux: string) {
    const n = Number(taux);
    if (!Number.isFinite(n) || n <= 0) return;
    deviseActionCodeRef.current = d.code;
    const res = await patchDevise({ tauxVersFonctionnelle: n });
    if (res) refetchDevises();
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ListChecks className="text-emerald-600" size={22} /> Configuration initiale
        </h2>
        {AIDE_COMPTABLE.configInitiale && <AideComptable contenu={AIDE_COMPTABLE.configInitiale} />}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <p className="text-xs text-slate-500 mb-4">
          Assistant de première installation (CDC §60) — pour AfriSime : Togo, XOF, SYSCOHADA révisé, société commerciale.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Pays</label>
            <input value={configForm.pays} onChange={(e) => setConfigForm(p => ({ ...p, pays: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Devise</label>
            <input value={configForm.devise} onChange={(e) => setConfigForm(p => ({ ...p, devise: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Référentiel comptable</label>
            <input value={configForm.referentiel} onChange={(e) => setConfigForm(p => ({ ...p, referentiel: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Type d&apos;entité</label>
            <input value={configForm.typeEntite} onChange={(e) => setConfigForm(p => ({ ...p, typeEntite: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <h4 className="text-sm font-semibold text-slate-700 mb-1 mt-2">Comptes par défaut (CDC §53)</h4>
        <p className="text-xs text-slate-500 mb-3">
          Dernier niveau de la cascade Produit &gt; Catégorie &gt; Famille &gt; Configuration générale — utilisés quand aucun niveau plus précis n&apos;est paramétré.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Compte achat</label>
            <input value={configForm.compteAchatDefaut} placeholder="601" onChange={(e) => setConfigForm(p => ({ ...p, compteAchatDefaut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Compte vente</label>
            <input value={configForm.compteVenteDefaut} placeholder="701" onChange={(e) => setConfigForm(p => ({ ...p, compteVenteDefaut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Compte stock</label>
            <input value={configForm.compteStockDefaut} placeholder="311" onChange={(e) => setConfigForm(p => ({ ...p, compteStockDefaut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Compte variation stock</label>
            <input value={configForm.compteVariationStockDefaut} placeholder="6031" onChange={(e) => setConfigForm(p => ({ ...p, compteVariationStockDefaut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Compte TVA achat</label>
            <input value={configForm.compteTvaAchatDefaut} placeholder="4452" onChange={(e) => setConfigForm(p => ({ ...p, compteTvaAchatDefaut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Compte TVA vente</label>
            <input value={configForm.compteTvaVenteDefaut} placeholder="4431" onChange={(e) => setConfigForm(p => ({ ...p, compteTvaVenteDefaut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <button onClick={handleEnregistrerConfig} disabled={enregistrantConfig}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
          {enregistrantConfig ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Enregistrer
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-800">Progression de la mise en place</h4>
          {configInitialeData && (
            <span className="text-xs font-semibold text-slate-500">
              {configInitialeData.data.etapes.filter(e => e.complete).length}/{configInitialeData.data.etapes.length} étapes
            </span>
          )}
        </div>
        <div className="space-y-2">
          {(configInitialeData?.data.etapes ?? []).map((e) => (
            <div key={e.cle} className={`flex items-center justify-between p-3 rounded-xl border ${e.complete ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
              <div className="flex items-center gap-3">
                {e.complete ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" /> : <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-slate-800">{e.label}{e.optionnelle && <span className="text-xs text-slate-400 ml-1.5">(optionnel)</span>}</p>
                  <p className="text-xs text-slate-400">{e.detail}</p>
                </div>
              </div>
              {!e.complete && ONGLET_TO_PATH[e.onglet] && (
                <button onClick={() => router.push(ONGLET_TO_PATH[e.onglet])}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex-shrink-0">
                  Configurer
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Référentiels comptables versionnés (CDC §77) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <h4 className="font-semibold text-slate-800 mb-1">Référentiels comptables</h4>
        <p className="text-xs text-slate-500 mb-4">
          Historique versionné (CDC §77) : référentiel, version, pays et date d&apos;application. Le versioning des règles et taxes existe déjà à leur niveau (dates de validité) — ce catalogue trace quel référentiel global fait foi, depuis quand.
        </p>
        <div className="space-y-2 mb-4">
          {(referentielsData?.data ?? []).map((r) => {
            const estActif = r.id === referentielsData?.referentielActifId;
            return (
              <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl border ${estActif ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {r.nom} {estActif && <span className="text-xs text-emerald-600 font-semibold ml-1">(actif)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{r.code} · v{r.version} · {r.pays} · en vigueur depuis le {formatDateShort(r.dateApplication)}</p>
                </div>
                {!estActif && (
                  <button onClick={() => handleActiverReferentiel(r)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                    Activer
                  </button>
                )}
              </div>
            );
          })}
          {(referentielsData?.data ?? []).length === 0 && <p className="text-xs text-slate-400 text-center py-4">Aucun référentiel enregistré.</p>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input value={nouveauReferentiel.code} onChange={(e) => setNouveauReferentiel(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="Code" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouveauReferentiel.nom} onChange={(e) => setNouveauReferentiel(p => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouveauReferentiel.version} onChange={(e) => setNouveauReferentiel(p => ({ ...p, version: e.target.value }))} placeholder="Version" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouveauReferentiel.pays} onChange={(e) => setNouveauReferentiel(p => ({ ...p, pays: e.target.value }))} placeholder="Pays" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input type="date" value={nouveauReferentiel.dateApplication} onChange={(e) => setNouveauReferentiel(p => ({ ...p, dateApplication: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={handleCreerReferentiel} className="mt-2 flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <PlusCircle size={15} /> Ajouter le référentiel
        </button>
      </div>

      {/* Sociétés (CDC §50) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <h4 className="font-semibold text-slate-800 mb-1">Sociétés</h4>
        <p className="text-xs text-slate-500 mb-4">
          Architecture prévue pour plusieurs sociétés (CDC §50). AfriSime SARL est aujourd&apos;hui l&apos;unique société active.
        </p>
        <div className="space-y-2 mb-4">
          {(societesData?.data ?? []).map((s) => (
            <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl border ${s.estPrincipale ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {s.nom} {s.estPrincipale && <span className="text-xs text-emerald-600 font-semibold ml-1">(principale)</span>}
                </p>
                <p className="text-xs text-slate-400">{s.pays} · {s.deviseFonctionnelleCode} · {s.referentielComptable}</p>
              </div>
              {!s.estPrincipale && (
                <button onClick={() => handleToggleSociete(s)} className={s.actif ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-50"} title={s.actif ? "Désactiver" : "Activer"}>
                  {s.actif ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={nouvelleSociete.nom} onChange={(e) => setNouvelleSociete(p => ({ ...p, nom: e.target.value }))} placeholder="Nom de la société" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouvelleSociete.pays} onChange={(e) => setNouvelleSociete(p => ({ ...p, pays: e.target.value }))} placeholder="Pays" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouvelleSociete.deviseFonctionnelleCode} onChange={(e) => setNouvelleSociete(p => ({ ...p, deviseFonctionnelleCode: e.target.value.toUpperCase() }))} placeholder="Devise (XOF)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={handleCreerSociete} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <PlusCircle size={15} /> Ajouter
          </button>
        </div>
      </div>

      {/* Devises (CDC §49) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <h4 className="font-semibold text-slate-800 mb-1">Devises</h4>
        <p className="text-xs text-slate-500 mb-4">
          Taux paramétrables (CDC §49) — jamais codés en dur. Les montants des écritures restent en devise fonctionnelle (XOF) ; le taux ci-dessous n&apos;est que la référence de conversion.
        </p>
        <div className="space-y-2 mb-4">
          {(devisesData?.data ?? []).map((d) => (
            <div key={d.code} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{d.code} — {d.nom} ({d.symbole})</p>
                <p className="text-xs text-slate-400">Maj le {formatDateShort(d.dateTauxMaj)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="number" step="0.0001" defaultValue={Number(d.tauxVersFonctionnelle)}
                  onBlur={(e) => { if (Number(e.target.value) !== Number(d.tauxVersFonctionnelle)) handleTauxDevise(d, e.target.value); }}
                  className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button onClick={() => handleToggleDevise(d)} className={d.actif ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-50"} title={d.actif ? "Désactiver" : "Activer"}>
                  {d.actif ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={nouvelleDevise.code} onChange={(e) => setNouvelleDevise(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="Code (EUR)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouvelleDevise.nom} onChange={(e) => setNouvelleDevise(p => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouvelleDevise.symbole} onChange={(e) => setNouvelleDevise(p => ({ ...p, symbole: e.target.value }))} placeholder="Symbole (€)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={nouvelleDevise.tauxVersFonctionnelle} onChange={(e) => setNouvelleDevise(p => ({ ...p, tauxVersFonctionnelle: e.target.value }))} placeholder="Taux vers XOF" type="number" step="0.0001" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={handleCreerDevise} className="mt-2 flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
          <PlusCircle size={15} /> Ajouter la devise
        </button>
      </div>
    </main>
  );
}

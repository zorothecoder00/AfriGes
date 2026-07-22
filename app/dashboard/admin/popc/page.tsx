"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import PopcTabs from "./PopcTabs";
import {
  Target, TrendingUp, Wallet, Users, CalendarDays, BookOpen,
  CheckCircle2, RefreshCw, Save, Lock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface ObjectifPOPC {
  chargesTotales: number; objectifBenefice: number; revenuMinimum: number;
  nbSeiziemes: number; nbTrentiemes: number; nbCarnets: number;
  nbNouveauxCredits: number; nbClientsRecruter: number;
  objectifQuotidien: number; objectifHebdomadaire: number; objectifMensuel: number;
}
interface Parametrage {
  id: number; annee: number; mois: number; pointDeVenteId: number | null; statut: string;
  salaireAgents: number; salaireSuperviseurs: number; salaireControleurs: number; salaireResponsables: number;
  carburant: number; entretienMotos: number; telephone: number; internet: number; loyer: number;
  eau: number; electricite: number; fournitures: number; publicite: number; divers: number;
  objectifBenefice: number; commissionSeizieme: number; commissionTrentaine: number; prixCarnet: number;
  joursOuvrables: number; nombreAgentsTerrain: number; nombreAgences: number;
  partRevenu16: number; partRevenu31: number; partRevenuCarnet: number; creditsParClient: number;
  objectif: ObjectifPOPC | null;
}
interface CollecteLigne {
  date: string; nbSeiziemes: number; valeur16: number; realises16: number;
  nbTrentiemes: number; valeur31: number; realises31: number;
}
interface CollectesResp {
  data: CollecteLigne[];
  meta: { totaux: { seiziemes: number; trentiemes: number; valeurPrevue: number; realises: number; valeurEncaissee: number } };
}

// Champs de charges (§3.1) et commerciaux (§3.2) pilotant le formulaire.
const CHARGES: { key: keyof FormState; label: string }[] = [
  { key: "salaireAgents", label: "Salaire Agents Terrain" },
  { key: "salaireSuperviseurs", label: "Salaire Superviseurs" },
  { key: "salaireControleurs", label: "Salaire Contrôleurs" },
  { key: "salaireResponsables", label: "Salaire Responsables" },
  { key: "carburant", label: "Carburant" },
  { key: "entretienMotos", label: "Entretien motos" },
  { key: "telephone", label: "Téléphone" },
  { key: "internet", label: "Internet" },
  { key: "loyer", label: "Loyer" },
  { key: "eau", label: "Eau" },
  { key: "electricite", label: "Électricité" },
  { key: "fournitures", label: "Fournitures" },
  { key: "publicite", label: "Publicité" },
  { key: "divers", label: "Divers" },
];
const COMMERCIAUX: { key: keyof FormState; label: string; suffix?: string }[] = [
  { key: "objectifBenefice", label: "Objectif de bénéfice du mois", suffix: "FCFA" },
  { key: "commissionSeizieme", label: "Commission minimum du 16ème", suffix: "FCFA" },
  { key: "commissionTrentaine", label: "Commission minimum du 31ème", suffix: "FCFA" },
  { key: "prixCarnet", label: "Prix du carnet", suffix: "FCFA" },
  { key: "joursOuvrables", label: "Nombre de jours ouvrables" },
  { key: "nombreAgentsTerrain", label: "Nombre d'agents terrain" },
  { key: "nombreAgences", label: "Nombre d'agences" },
];
// §3.2 : paramètres pour lesquels la saisie bidirectionnelle Valeur⇄Taux a un sens
// (montants). Le taux est exprimé en % des Charges Totales. Les paramètres de
// dénombrement (jours, agents, agences) n'ont pas de taux.
const TAUX_KEYS = new Set<keyof FormState>([
  "objectifBenefice", "commissionSeizieme", "commissionTrentaine", "prixCarnet",
]);

const HYPOTHESES: { key: keyof FormState; label: string; suffix?: string }[] = [
  { key: "partRevenu16", label: "Part du revenu via 16èmes", suffix: "%" },
  { key: "partRevenu31", label: "Part du revenu via 31èmes", suffix: "%" },
  { key: "partRevenuCarnet", label: "Part du revenu via carnets", suffix: "%" },
  { key: "creditsParClient", label: "Crédits moyens par client" },
];

type FormState = Record<
  | "salaireAgents" | "salaireSuperviseurs" | "salaireControleurs" | "salaireResponsables"
  | "carburant" | "entretienMotos" | "telephone" | "internet" | "loyer" | "eau"
  | "electricite" | "fournitures" | "publicite" | "divers"
  | "objectifBenefice" | "commissionSeizieme" | "commissionTrentaine" | "prixCarnet"
  | "joursOuvrables" | "nombreAgentsTerrain" | "nombreAgences"
  | "partRevenu16" | "partRevenu31" | "partRevenuCarnet" | "creditsParClient",
  string
>;

const CHAMPS_NUM = [...CHARGES, ...COMMERCIAUX, ...HYPOTHESES].map((c) => c.key);

const DEFAUTS: FormState = Object.fromEntries(
  CHAMPS_NUM.map((k) => [k, "0"]),
) as FormState;
DEFAUTS.prixCarnet = "300";
DEFAUTS.joursOuvrables = "26";
DEFAUTS.nombreAgentsTerrain = "1";
DEFAUTS.nombreAgences = "1";
DEFAUTS.partRevenu16 = "50";
DEFAUTS.partRevenu31 = "40";
DEFAUTS.partRevenuCarnet = "10";
DEFAUTS.creditsParClient = "1";

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function POPCPage() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [form, setForm] = useState<FormState>(DEFAUTS);

  const url = `/api/popc/parametrage?annee=${annee}&mois=${mois}`;
  const { data: paramResp, loading, refetch } = useApi<{ data: Parametrage | null }>(url);
  const { data: collectes } = useApi<CollectesResp>(`/api/popc/collectes?annee=${annee}&mois=${mois}`);

  const param = paramResp?.data ?? null;
  const objectif = param?.objectif ?? null;
  const statut = param?.statut ?? "BROUILLON";

  // Hydrate le formulaire depuis le paramétrage chargé.
  useEffect(() => {
    if (param) {
      const next = { ...DEFAUTS };
      for (const k of CHAMPS_NUM) next[k] = String((param as unknown as Record<string, number>)[k] ?? next[k]);
      setForm(next);
    } else {
      setForm(DEFAUTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param?.id, annee, mois]);

  const chargesTotales = useMemo(
    () => CHARGES.reduce((s, c) => s + (Number(form[c.key]) || 0), 0),
    [form],
  );
  const sommeParts = Number(form.partRevenu16) + Number(form.partRevenu31) + Number(form.partRevenuCarnet);

  // Conversion Valeur ⇄ Taux (§3.2). Base = Charges Totales. La valeur reste la
  // donnée persistée ; le taux n'est qu'une aide à la saisie / un affichage.
  const tauxDe = (k: keyof FormState) =>
    chargesTotales > 0 ? ((Number(form[k]) || 0) / chargesTotales) * 100 : 0;
  const fmtTaux = (x: number) => (Number.isFinite(x) ? String(Number(x.toFixed(2))) : "0");
  const setViaTaux = (k: keyof FormState, tauxStr: string) => {
    const taux = Number(tauxStr) || 0;
    const val = chargesTotales > 0 ? (taux / 100) * chargesTotales : 0;
    setField(k, String(Math.round(val * 100) / 100));
  };

  const save = useMutation<{ data: Parametrage }, Record<string, number>>(
    "/api/popc/parametrage", "POST",
    { successMessage: "Paramétrage enregistré et objectifs générés", invalidate: "/api/popc/parametrage" },
  );
  const valider = useMutation<unknown, Record<string, never>>(
    () => `/api/popc/parametrage/${param?.id}/valider`, "POST",
    { successMessage: "Objectifs validés pour le mois", invalidate: "/api/popc/parametrage" },
  );

  const handleSave = async () => {
    const body: Record<string, number> = { annee, mois };
    for (const k of CHAMPS_NUM) body[k] = Number(form[k]) || 0;
    const r = await save.mutate(body);
    if (r) refetch();
  };

  const handleValider = async () => {
    if (!param?.id) return toast.error("Enregistrez d'abord le paramétrage");
    const r = await valider.mutate({});
    if (r) refetch();
  };

  const setField = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PopcTabs />
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" /> Planification des objectifs (POPC)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Charges, objectifs commerciaux et prévision des collectes — {MOIS[mois - 1]} {annee}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mois} onChange={(e) => setMois(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
            {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${statut === "VALIDE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {statut === "VALIDE" ? "Objectifs validés" : "Brouillon"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Paramétrage (§3) ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-500" /> Charges mensuelles (§3.1)
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 text-left">
                  <th className="pb-2 font-medium">Paramètre</th>
                  <th className="pb-2 font-medium text-right w-32">Valeur (FCFA)</th>
                  <th className="pb-2 font-medium text-right w-24">Taux / charges</th>
                </tr>
              </thead>
              <tbody>
                {CHARGES.map((c) => (
                  <tr key={c.key} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600">{c.label}</td>
                    <td className="py-1.5">
                      <input type="number" min={0} value={form[c.key]}
                        onChange={(e) => setField(c.key, e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </td>
                    <td className="py-1.5 text-right text-gray-400 tabular-nums">{fmtTaux(tauxDe(c.key))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-xl">
              <span className="text-sm font-medium text-indigo-900">Charges totales</span>
              <span className="text-lg font-bold text-indigo-700">{fmt(chargesTotales)} FCFA</span>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Paramètres commerciaux (§3.2)
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 text-left">
                  <th className="pb-2 font-medium">Paramètre</th>
                  <th className="pb-2 font-medium text-right w-32">Valeur</th>
                  <th className="pb-2 font-medium text-right w-28">Taux / charges</th>
                </tr>
              </thead>
              <tbody>
                {COMMERCIAUX.map((c) => {
                  const hasTaux = TAUX_KEYS.has(c.key);
                  return (
                    <tr key={c.key} className="border-t border-gray-50">
                      <td className="py-1.5 text-gray-600">{c.label}{c.suffix ? ` (${c.suffix})` : ""}</td>
                      <td className="py-1.5">
                        <input type="number" min={0} value={form[c.key]}
                          onChange={(e) => setField(c.key, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </td>
                      <td className="py-1.5">
                        {hasTaux ? (
                          <input type="number" min={0} value={fmtTaux(tauxDe(c.key))}
                            onChange={(e) => setViaTaux(c.key, e.target.value)}
                            disabled={chargesTotales <= 0}
                            title="% des charges totales — la valeur se calcule automatiquement"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-300" />
                        ) : (
                          <span className="block text-right text-gray-300 pr-2">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              Saisissez la valeur <em>ou</em> le taux (% des charges totales) : l&apos;autre se calcule automatiquement.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-500" /> Hypothèses de planification
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Répartition du revenu-cible entre les sources. Non fixée par le cahier des charges — à calibrer.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {HYPOTHESES.map((c) => (
                <label key={c.key} className="block">
                  <span className="text-xs text-gray-500">{c.label}{c.suffix ? ` (${c.suffix})` : ""}</span>
                  <input type="number" min={0} value={form[c.key]}
                    onChange={(e) => setField(c.key, e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </label>
              ))}
            </div>
            {Math.abs(sommeParts - 100) > 0.01 && (
              <p className="mt-2 text-xs text-amber-600">
                Somme des parts = {sommeParts}% (normalisée automatiquement à 100%).
              </p>
            )}
          </section>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={save.loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl disabled:opacity-50">
              <Save className="w-4 h-4" /> {save.loading ? "Enregistrement…" : "Enregistrer & générer les objectifs"}
            </button>
            <button onClick={handleValider} disabled={valider.loading || !param?.id || statut === "VALIDE"}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> Valider les objectifs
            </button>
          </div>
        </div>

        {/* ── Synthèse générée (§4) ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white shadow-sm">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Target className="w-4 h-4" /> Objectifs générés (§4)
            </h2>
            {loading ? (
              <p className="text-indigo-100 text-sm">Chargement…</p>
            ) : objectif ? (
              <dl className="space-y-2.5 text-sm">
                <Row label="Charges mensuelles" value={`${fmt(objectif.chargesTotales)} FCFA`} />
                <Row label="Objectif de bénéfice" value={`${fmt(objectif.objectifBenefice)} FCFA`} />
                <Row label="Revenu minimum à générer" value={`${fmt(objectif.revenuMinimum)} FCFA`} strong />
                <div className="border-t border-white/20 my-2" />
                <Row label="16èmes à encaisser" value={fmt(objectif.nbSeiziemes)} />
                <Row label="31èmes à encaisser" value={fmt(objectif.nbTrentiemes)} />
                <Row label="Carnets à vendre" value={fmt(objectif.nbCarnets)} />
                <Row label="Nouveaux crédits à livrer" value={fmt(objectif.nbNouveauxCredits)} />
                <Row label="Clients à recruter" value={fmt(objectif.nbClientsRecruter)} />
                <div className="border-t border-white/20 my-2" />
                <Row label="Objectif quotidien" value={`${fmt(objectif.objectifQuotidien)} FCFA`} />
                <Row label="Objectif hebdomadaire" value={`${fmt(objectif.objectifHebdomadaire)} FCFA`} />
                <Row label="Objectif mensuel" value={`${fmt(objectif.objectifMensuel)} FCFA`} strong />
              </dl>
            ) : (
              <p className="text-indigo-100 text-sm">
                Aucun objectif encore généré. Renseignez le paramétrage puis cliquez sur « Enregistrer & générer ».
              </p>
            )}
          </section>

          {/* Aperçu collectes prévisionnelles (§6) */}
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" /> Collectes 16/31 du mois (§6)
            </h2>
            {collectes && collectes.data.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Stat icon={<BookOpen className="w-4 h-4" />} label="16èmes prévus" value={fmt(collectes.meta.totaux.seiziemes)} />
                  <Stat icon={<BookOpen className="w-4 h-4" />} label="31èmes prévus" value={fmt(collectes.meta.totaux.trentiemes)} />
                  <Stat icon={<Wallet className="w-4 h-4" />} label="Valeur prévue" value={`${fmt(collectes.meta.totaux.valeurPrevue)}`} />
                  <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Encaissé" value={`${fmt(collectes.meta.totaux.valeurEncaissee)}`} />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-400 sticky top-0 bg-white">
                      <tr><th className="text-left py-1">Date</th><th className="text-right">16èmes</th><th className="text-right">31èmes</th><th className="text-right">Valeur</th></tr>
                    </thead>
                    <tbody>
                      {collectes.data.map((l) => (
                        <tr key={l.date} className="border-t border-gray-50">
                          <td className="py-1.5 text-gray-700">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                          <td className="text-right text-gray-600">{l.nbSeiziemes} <span className="text-emerald-500">({l.realises16})</span></td>
                          <td className="text-right text-gray-600">{l.nbTrentiemes} <span className="text-emerald-500">({l.realises31})</span></td>
                          <td className="text-right text-gray-700">{fmt(l.valeur16 + l.valeur31)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-400">Entre parenthèses : collectes déjà réalisées (payées).</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                Aucune collecte 16/31 prévue ce mois. Les crédits Quinzaine/Trentaine alimentent ce tableau automatiquement.
              </p>
            )}
          </section>

          {statut === "VALIDE" && (
            <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
              <Lock className="w-3.5 h-3.5" /> Objectifs figés — toute modification du paramétrage régénère la synthèse.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-indigo-100">{label}</dt>
      <dd className={strong ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs">{icon}{label}</div>
      <div className="text-base font-bold text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

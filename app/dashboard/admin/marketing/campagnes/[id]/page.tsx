"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ChevronLeft, Loader2, Send, CheckCircle2, XCircle, Play, Pause,
  RotateCcw, Flag, Archive, AlertTriangle, Wallet,
} from "lucide-react";
import EnvoyerCampagneModal from "@/components/marketing/EnvoyerCampagneModal";

interface CampagneDetail {
  id: number; code: string; nom: string; description: string | null; statut: string;
  portee: string; dateDebut: string; dateFin: string;
  brief: { probleme?: string; cible?: string; message?: string; offre?: string; zone?: string; resultatAttendu?: string } | null;
  responsable: { id: number; nom: string; prenom: string };
  commercial: { id: number; nom: string; prenom: string } | null;
  typeCampagne: { libelle: string };
  objectifs: { objectif: string }[];
  agences: { pointDeVente: { id: number; nom: string; code: string } }[];
  produits: { produit: { id: number; nom: string } | null; famille: { id: number; nom: string } | null; pack: { id: number; nom: string } | null }[];
  canaux: { canal: { id: number; libelle: string } }[];
  audience: { id: number; nom: string; tailleCalculee: number | null } | null;
  budget: { id: number; montantPrevu: number | string; montantApprouve: number | string; montantEngage: number | string; statut: string;
    depenses: { id: number; categorie: string; montant: number | string; date: string; description: string | null }[] } | null;
  ventesAttribuees: { id: number; reference: string; montantTotal: number | string; createdAt: string }[];
  creditsAttribues: { id: number; reference: string; montantTotal: number | string; createdAt: string }[];
  alertesStock: { produitNom: string; pointDeVenteNom: string; quantite: number; seuil: number }[];
  caAttribue: number;
}

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon", PLANIFIEE: "Planifiée", APPROUVEE: "Approuvée",
  ACTIVE: "Active", PAUSE: "En pause", TERMINEE: "Terminée", ARCHIVEE: "Archivée",
};
const STATUT_STYLE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600", PLANIFIEE: "bg-blue-100 text-blue-700",
  APPROUVEE: "bg-indigo-100 text-indigo-700", ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSE: "bg-amber-100 text-amber-700", TERMINEE: "bg-slate-200 text-slate-700",
  ARCHIVEE: "bg-slate-100 text-slate-400",
};

const ACTIONS_PAR_STATUT: Record<string, { action: string; label: string; icon: typeof Send; style: string }[]> = {
  BROUILLON: [{ action: "SOUMETTRE", label: "Soumettre pour approbation", icon: Send, style: "bg-blue-600 hover:bg-blue-700" }],
  PLANIFIEE: [
    { action: "APPROUVER", label: "Approuver", icon: CheckCircle2, style: "bg-indigo-600 hover:bg-indigo-700" },
    { action: "REJETER", label: "Renvoyer en brouillon", icon: XCircle, style: "bg-red-500 hover:bg-red-600" },
  ],
  APPROUVEE: [{ action: "ACTIVER", label: "Activer", icon: Play, style: "bg-emerald-600 hover:bg-emerald-700" }],
  ACTIVE: [
    { action: "METTRE_EN_PAUSE", label: "Mettre en pause", icon: Pause, style: "bg-amber-500 hover:bg-amber-600" },
    { action: "TERMINER", label: "Terminer", icon: Flag, style: "bg-slate-600 hover:bg-slate-700" },
  ],
  PAUSE: [
    { action: "REPRENDRE", label: "Reprendre", icon: RotateCcw, style: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "TERMINER", label: "Terminer", icon: Flag, style: "bg-slate-600 hover:bg-slate-700" },
  ],
  TERMINEE: [{ action: "ARCHIVER", label: "Archiver", icon: Archive, style: "bg-slate-500 hover:bg-slate-600" }],
  ARCHIVEE: [],
};

export default function CampagneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: res, loading, refetch } = useApi<{ data: CampagneDetail }>(`/api/admin/marketing/campagnes/${id}`);
  const { mutate: agir, loading: agissant } = useMutation<unknown, { action: string }>(
    `/api/admin/marketing/campagnes/${id}/action`, "POST",
    { invalidate: [`/api/admin/marketing/campagnes/${id}`, "/api/admin/marketing/campagnes"] }
  );
  const { mutate: agirBudget } = useMutation<unknown, { action: string }>(
    () => `/api/admin/marketing/budgets/${res?.data.budget?.id}/action`, "POST",
    { invalidate: [`/api/admin/marketing/campagnes/${id}`] }
  );
  const [tab, setTab] = useState<"brief" | "audience" | "produits" | "budget" | "ventes">("brief");
  const [envoyerOuvert, setEnvoyerOuvert] = useState(false);

  if (loading && !res) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const c = res?.data;
  if (!c) return <p className="text-slate-400">Campagne introuvable.</p>;

  const actions = ACTIONS_PAR_STATUT[c.statut] ?? [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/marketing/campagnes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Retour aux campagnes
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">{c.nom}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUT_STYLE[c.statut]}`}>{STATUT_LABEL[c.statut]}</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{c.code} · {c.typeCampagne.libelle} · {c.responsable.prenom} {c.responsable.nom}</p>
            <p className="text-xs text-slate-400 mt-1">{formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</p>
          </div>
          <div className="flex items-center gap-2">
            {actions.map((a) => (
              <button key={a.action} disabled={agissant}
                onClick={async () => { if (await agir({ action: a.action })) refetch(); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-semibold disabled:opacity-50 ${a.style}`}>
                <a.icon className="w-3.5 h-3.5" /> {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Budget prévu</p>
            <p className="text-sm font-semibold text-slate-800">{c.budget ? formatCurrency(c.budget.montantPrevu) : "—"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">CA attribué</p>
            <p className="text-sm font-semibold text-emerald-700">{formatCurrency(c.caAttribue)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Audience</p>
            <p className="text-sm font-semibold text-slate-800">{c.audience ? `${c.audience.tailleCalculee ?? "—"} clients` : "—"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Agences ciblées</p>
            <p className="text-sm font-semibold text-slate-800">{c.agences.length}</p>
          </div>
        </div>

        {c.alertesStock.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
            {c.alertesStock.map((a, i) => (
              <p key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Stock insuffisant pour cette campagne : <strong>{a.produitNom}</strong> à {a.pointDeVenteNom} ({a.quantite} restants, seuil {a.seuil})
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {([["brief", "Brief"], ["audience", "Audience"], ["produits", "Produits & canaux"], ["budget", "Budget & dépenses"], ["ventes", "Ventes attribuées"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === k ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "brief" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-2 gap-4 text-sm">
          <Champ label="Problème à résoudre" value={c.brief?.probleme} />
          <Champ label="Cible" value={c.brief?.cible} />
          <Champ label="Zone" value={c.brief?.zone} />
          <Champ label="Message clé" value={c.brief?.message} />
          <Champ label="Offre" value={c.brief?.offre} />
          <Champ label="Résultat attendu" value={c.brief?.resultatAttendu} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Objectifs</p>
            <div className="flex flex-wrap gap-1.5">
              {c.objectifs.length === 0 ? <span className="text-slate-400 text-xs">—</span> : c.objectifs.map((o) => (
                <span key={o.objectif} className="px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 text-xs font-medium">{o.objectif}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "audience" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          {c.audience ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Link href="/dashboard/admin/marketing/audiences" className="text-fuchsia-700 font-medium hover:underline">
                {c.audience.nom} — {c.audience.tailleCalculee ?? "—"} clients
              </Link>
              <button onClick={() => setEnvoyerOuvert(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700">
                <Send className="w-3.5 h-3.5" /> Envoyer à l&apos;audience
              </button>
            </div>
          ) : <p className="text-slate-400 text-sm">Aucune audience associée.</p>}
        </div>
      )}
      {envoyerOuvert && <EnvoyerCampagneModal campagneId={c.id} onClose={() => setEnvoyerOuvert(false)} />}

      {tab === "produits" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Produits ciblés</p>
            <div className="flex flex-wrap gap-1.5">
              {c.produits.length === 0 ? <span className="text-slate-400 text-xs">—</span> : c.produits.map((p, i) => (
                <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.pack ? "bg-fuchsia-50 text-fuchsia-700" : "bg-slate-100 text-slate-700"}`}>
                  {p.produit?.nom ?? p.famille?.nom ?? p.pack?.nom}
                  {p.famille && !p.produit ? " (famille)" : ""}
                  {p.pack ? " (pack)" : ""}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Agences</p>
            <div className="flex flex-wrap gap-1.5">
              {c.agences.map((a) => <span key={a.pointDeVente.id} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{a.pointDeVente.nom}</span>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Canaux</p>
            <div className="flex flex-wrap gap-1.5">
              {c.canaux.map((ca) => <span key={ca.canal.id} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{ca.canal.libelle}</span>)}
            </div>
          </div>
        </div>
      )}

      {tab === "budget" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          {!c.budget ? (
            <p className="text-slate-400 text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> Aucun budget défini pour cette campagne.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-xs text-slate-400">Prévu</p><p className="font-semibold">{formatCurrency(c.budget.montantPrevu)}</p></div>
                  <div><p className="text-xs text-slate-400">Approuvé</p><p className="font-semibold">{formatCurrency(c.budget.montantApprouve)}</p></div>
                  <div><p className="text-xs text-slate-400">Statut</p><p className="font-semibold">{c.budget.statut}</p></div>
                </div>
                {c.budget.statut === "BROUILLON" && (
                  <button onClick={async () => { if (await agirBudget({ action: "DEMANDER" })) refetch(); }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">Demander validation</button>
                )}
                {c.budget.statut === "DEMANDE" && (
                  <div className="flex gap-2">
                    <button onClick={async () => { if (await agirBudget({ action: "APPROUVER" })) refetch(); }}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">Approuver</button>
                    <button onClick={async () => { if (await agirBudget({ action: "REJETER" })) refetch(); }}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600">Rejeter</button>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                  <th className="py-2">Catégorie</th><th className="py-2">Date</th><th className="py-2 text-right">Montant</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {c.budget.depenses.length === 0 ? (
                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aucune dépense enregistrée</td></tr>
                  ) : c.budget.depenses.map((d) => (
                    <tr key={d.id}><td className="py-2">{d.categorie}</td><td className="py-2 text-slate-500">{formatDate(d.date)}</td><td className="py-2 text-right">{formatCurrency(d.montant)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "ventes" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
              <th className="py-2">Référence</th><th className="py-2">Date</th><th className="py-2 text-right">Montant</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {[...c.ventesAttribuees, ...c.creditsAttribues].length === 0 ? (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aucune vente attribuée pour l&apos;instant</td></tr>
              ) : [...c.ventesAttribuees, ...c.creditsAttribues].map((v) => (
                <tr key={v.id}><td className="py-2 font-medium">{v.reference}</td><td className="py-2 text-slate-500">{formatDate(v.createdAt)}</td><td className="py-2 text-right font-semibold">{formatCurrency(v.montantTotal)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Champ({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
      <p className="text-slate-700">{value || <span className="text-slate-300">—</span>}</p>
    </div>
  );
}

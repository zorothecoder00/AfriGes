"use client";

import { use, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, Printer, FileText, Shield, BookOpen, Award, ArrowLeft } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Depot {
  id: number; reference: string; montant: string | number;
  statut: string; createdAt: string;
}
interface Retrait {
  id: number; reference: string; montant: string | number;
  statut: string; createdAt: string;
}
interface Financement {
  id: number; reference: string; montantFinance: string | number;
  statut: string; dateFinancement: string;
  client: { nom: string; prenom: string };
}
interface Portefeuille {
  id: number; reference: string; nom: string | null;
  capitalInvesti: string | number; capitalDisponible: string | number;
  capitalEngage: string | number; capitalRecouvre: string | number;
  beneficesGeneres: string | number; beneficesDistribues: string | number;
  createdAt: string;
  depots:       Depot[];
  retraits:     Retrait[];
  financements: Financement[];
}
interface Membre {
  id: number; nom: string; prenom: string; email: string | null;
  telephone: string | null; adresse: string | null; dateAdhesion: string | null;
}
interface ProfilRIA { portefeuilles: Portefeuille[] }
interface InvestisseurData {
  member: Membre;
  profilRIA: ProfilRIA | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";

const today = new Date().toLocaleDateString("fr-FR");

// ── Document : Contrat d'investissement ───────────────────────────────────────

function Contrat({ inv }: { inv: InvestisseurData }) {
  const m  = inv.member;
  const pf = inv.profilRIA?.portefeuilles?.[0];
  const totalInvesti = inv.profilRIA?.portefeuilles?.reduce(
    (s, p) => s + Number(p.capitalInvesti), 0
  ) ?? 0;

  return (
    <div className="print-doc">
      <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-6 mb-6">
        <div>
          <h1 className="text-xl font-bold text-emerald-700">AfriGes — Réseau des Investisseurs AfriSime</h1>
          <p className="text-slate-500 text-sm mt-1">Contrat d&apos;Adhésion et de Participation</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Date : {today}</p>
          <p>Réf. : CTR-{String(m.id).padStart(5, "0")}</p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="section-title">ENTRE LES PARTIES</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="font-semibold text-slate-700 mb-1">LA SOCIÉTÉ (ci-après « AfriSime »)</p>
            <p className="text-slate-600">AfriGes — AfriSime</p>
            <p className="text-slate-500">Gestionnaire du Réseau des Investisseurs</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <p className="font-semibold text-emerald-700 mb-1">L&apos;INVESTISSEUR</p>
            <p className="text-slate-800 font-bold">{m.prenom} {m.nom}</p>
            {m.email && <p className="text-slate-500 text-xs">{m.email}</p>}
            {m.telephone && <p className="text-slate-500 text-xs">{m.telephone}</p>}
            {m.adresse && <p className="text-slate-500 text-xs">{m.adresse}</p>}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="section-title">OBJET DU CONTRAT</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Le présent contrat régit la participation de l&apos;Investisseur au Réseau des Investisseurs AfriSime (RIA),
          un mécanisme de financement participatif destiné à soutenir les clients de la structure via des crédits
          commerciaux. L&apos;Investisseur apporte des fonds qui sont affectés à des portefeuilles d&apos;investissement
          gérés par AfriSime. Les bénéfices générés par les remboursements de crédit sont partagés selon les modalités
          définies dans la configuration du RIA.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="section-title">SITUATION AU {today.toUpperCase()}</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 text-slate-500">Date d&apos;adhésion</td>
              <td className="py-1.5 text-right font-medium">{fmtDate(m.dateAdhesion)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 text-slate-500">Nombre de portefeuilles</td>
              <td className="py-1.5 text-right font-medium">{inv.profilRIA?.portefeuilles?.length ?? 0}</td>
            </tr>
            {pf && (
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">Portefeuille principal</td>
                <td className="py-1.5 text-right font-medium">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
              </tr>
            )}
            <tr className="border-b border-slate-100">
              <td className="py-1.5 text-slate-500">Capital total investi</td>
              <td className="py-1.5 text-right font-bold text-emerald-700">{fmt(totalInvesti)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="section-title">CONDITIONS GÉNÉRALES</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
          <li>Les fonds investis sont affectés à des portefeuilles de crédits clients sous gestion d&apos;AfriSime.</li>
          <li>Les bénéfices sont calculés mensuellement sur la base du capital investi et des taux en vigueur.</li>
          <li>Les retraits sont soumis à validation et traitement par AfriSime dans un délai de 5 jours ouvrés.</li>
          <li>L&apos;Investisseur est informé de l&apos;état de son portefeuille via des relevés mensuels.</li>
          <li>Toute modification des conditions est notifiée à l&apos;Investisseur avec un préavis de 30 jours.</li>
        </ol>
      </section>

      <div className="grid grid-cols-2 gap-12 mt-12">
        <div>
          <p className="text-sm text-slate-500 mb-8">Pour AfriSime,</p>
          <div className="border-b border-slate-400 mb-1"></div>
          <p className="text-xs text-slate-500">Signature et cachet</p>
        </div>
        <div>
          <p className="text-sm text-slate-500 mb-8">L&apos;Investisseur,</p>
          <div className="border-b border-slate-400 mb-1"></div>
          <p className="text-xs text-slate-500">{m.prenom} {m.nom}</p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-6 text-xs text-slate-400 flex justify-between">
        <span>Contrat RIA — AfriGes v1.0</span>
        <span>Document généré le {today}</span>
      </div>
    </div>
  );
}

// ── Document : Attestation de participation ───────────────────────────────────

function Attestation({ inv }: { inv: InvestisseurData }) {
  const m   = inv.member;
  const pfs = inv.profilRIA?.portefeuilles ?? [];
  const totalInvesti    = pfs.reduce((s, p) => s + Number(p.capitalInvesti), 0);
  const totalDisponible = pfs.reduce((s, p) => s + Number(p.capitalDisponible), 0);

  return (
    <div className="print-doc text-center">
      <div className="border-2 border-emerald-600 rounded-lg p-8 mb-6 relative">
        <div className="absolute top-4 right-4 text-slate-200">
          <Shield className="w-20 h-20" />
        </div>
        <p className="text-xs text-emerald-600 uppercase tracking-widest mb-2">Attestation Officielle</p>
        <h1 className="text-2xl font-bold text-emerald-700 mb-1">ATTESTATION DE PARTICIPATION</h1>
        <p className="text-slate-500 text-sm">Réseau des Investisseurs AfriSime — RIA</p>
      </div>

      <div className="text-left space-y-4 text-sm text-slate-700 leading-relaxed">
        <p>
          AfriGes, gestionnaire du <strong>Réseau des Investisseurs AfriSime (RIA)</strong>, certifie que :
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Investisseur</p>
          <p className="text-xl font-bold text-slate-800">{m.prenom.toUpperCase()} {m.nom.toUpperCase()}</p>
          {m.email && <p className="text-sm text-slate-500 mt-1">{m.email}</p>}
          {m.telephone && <p className="text-sm text-slate-500">{m.telephone}</p>}
        </div>

        <p>
          est membre actif du Réseau des Investisseurs AfriSime depuis le{" "}
          <strong>{fmtDate(m.dateAdhesion)}</strong>.
        </p>

        <p>
          À la date du <strong>{today}</strong>, cette personne détient{" "}
          <strong>{pfs.length} portefeuille{pfs.length !== 1 ? "s" : ""}</strong> avec un capital investi
          de <strong className="text-emerald-700">{fmt(totalInvesti)}</strong> et un capital disponible
          de <strong>{fmt(totalDisponible)}</strong>.
        </p>

        {pfs.length > 0 && (
          <table className="w-full text-xs mt-4 border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Portefeuille</th>
                <th className="px-3 py-2 text-right">Capital investi</th>
                <th className="px-3 py-2 text-right">Bénéfices générés</th>
                <th className="px-3 py-2 text-center">Depuis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pfs.map((pf) => (
                <tr key={pf.id}>
                  <td className="px-3 py-2 font-medium">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmt(Number(pf.capitalInvesti))}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(pf.beneficesGeneres))}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{fmtDate(pf.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-slate-500">
          La présente attestation est délivrée à la demande de l&apos;intéressé(e) pour servir et valoir ce que de droit.
        </p>
      </div>

      <div className="mt-10 text-right">
        <p className="text-sm text-slate-500 mb-1">Fait à __________, le {today}</p>
        <div className="inline-block text-left mt-8">
          <div className="border-b border-slate-400 w-48 mb-1"></div>
          <p className="text-xs text-slate-500">Signature et cachet AfriGes</p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-6 text-xs text-slate-400 flex justify-between">
        <span>ATT-RIA-{String(m.id).padStart(5, "0")}</span>
        <span>Document généré le {today} — usage officiel</span>
      </div>
    </div>
  );
}

// ── Document : Relevé de compte ───────────────────────────────────────────────

function Releve({ inv }: { inv: InvestisseurData }) {
  const m   = inv.member;
  const pfs = inv.profilRIA?.portefeuilles ?? [];

  return (
    <div className="print-doc">
      <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-6 mb-6">
        <div>
          <h1 className="text-xl font-bold text-emerald-700">AfriGes — RIA</h1>
          <p className="text-slate-500 text-sm mt-1">Relevé de Compte Investisseur</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p className="font-bold text-slate-800">{m.prenom} {m.nom}</p>
          {m.email && <p>{m.email}</p>}
          <p>Date : {today}</p>
          <p>Réf. : REL-{String(m.id).padStart(5, "0")}</p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="section-title">RÉSUMÉ GLOBAL</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Capital total investi",  value: pfs.reduce((s, p) => s + Number(p.capitalInvesti), 0),    color: "text-slate-800" },
            { label: "Capital disponible",     value: pfs.reduce((s, p) => s + Number(p.capitalDisponible), 0), color: "text-emerald-700" },
            { label: "Capital engagé",         value: pfs.reduce((s, p) => s + Number(p.capitalEngage), 0),     color: "text-blue-700" },
            { label: "Capital recouvré",       value: pfs.reduce((s, p) => s + Number(p.capitalRecouvre), 0),   color: "text-slate-700" },
            { label: "Bénéfices générés",      value: pfs.reduce((s, p) => s + Number(p.beneficesGeneres), 0),  color: "text-emerald-600" },
            { label: "Bénéfices distribués",   value: pfs.reduce((s, p) => s + Number(p.beneficesDistribues), 0), color: "text-slate-600" },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold ${item.color}`}>{fmt(item.value)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {pfs.map((pf) => (
        <section key={pf.id} className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
            <p className="font-semibold text-slate-800">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</p>
            <p className="text-xs text-slate-500">Depuis {fmtDate(pf.createdAt)}</p>
          </div>
          <div className="p-4">
            <table className="w-full text-xs">
              <tbody>
                {[
                  ["Capital investi",    fmt(Number(pf.capitalInvesti))],
                  ["Capital disponible", fmt(Number(pf.capitalDisponible))],
                  ["Capital engagé",     fmt(Number(pf.capitalEngage))],
                  ["Bénéfices générés",  fmt(Number(pf.beneficesGeneres))],
                ].map(([l, v]) => (
                  <tr key={l} className="border-b border-slate-50">
                    <td className="py-1 text-slate-500">{l}</td>
                    <td className="py-1 text-right font-medium">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pf.depots.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600 mb-1">Derniers dépôts</p>
                <table className="w-full text-xs">
                  <thead className="text-slate-400 uppercase">
                    <tr>
                      <th className="text-left pb-1">Réf.</th>
                      <th className="text-center pb-1">Date</th>
                      <th className="text-right pb-1">Montant</th>
                      <th className="text-center pb-1">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pf.depots.map((d) => (
                      <tr key={d.id} className="border-b border-slate-50">
                        <td className="py-0.5">{d.reference}</td>
                        <td className="py-0.5 text-center text-slate-500">{fmtDate(d.createdAt)}</td>
                        <td className="py-0.5 text-right text-emerald-600">{fmt(Number(d.montant))}</td>
                        <td className="py-0.5 text-center text-slate-500">{d.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pf.retraits.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600 mb-1">Derniers retraits</p>
                <table className="w-full text-xs">
                  <tbody>
                    {pf.retraits.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-0.5">{r.reference}</td>
                        <td className="py-0.5 text-center text-slate-500">{fmtDate(r.createdAt)}</td>
                        <td className="py-0.5 text-right text-red-500">{fmt(Number(r.montant))}</td>
                        <td className="py-0.5 text-center text-slate-500">{r.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pf.financements.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600 mb-1">Financements actifs</p>
                <table className="w-full text-xs">
                  <thead className="text-slate-400 uppercase">
                    <tr>
                      <th className="text-left pb-1">Réf.</th>
                      <th className="text-left pb-1">Client</th>
                      <th className="text-right pb-1">Montant</th>
                      <th className="text-center pb-1">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pf.financements.map((f) => (
                      <tr key={f.id} className="border-b border-slate-50">
                        <td className="py-0.5">{f.reference}</td>
                        <td className="py-0.5 text-slate-600">{f.client.prenom} {f.client.nom}</td>
                        <td className="py-0.5 text-right">{fmt(Number(f.montantFinance))}</td>
                        <td className={`py-0.5 text-center ${f.statut === "EN_RETARD" ? "text-red-500" : "text-blue-500"}`}>{f.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}

      <div className="border-t border-slate-200 pt-4 mt-4 text-xs text-slate-400 flex justify-between">
        <span>REL-RIA-{String(m.id).padStart(5, "0")} — Relevé de compte investisseur</span>
        <span>Document généré le {today} — confidentiel</span>
      </div>
    </div>
  );
}

// ── Document : Convention de partenariat ──────────────────────────────────────

function Convention({ inv }: { inv: InvestisseurData }) {
  const m   = inv.member;
  const pfs = inv.profilRIA?.portefeuilles ?? [];
  const totalInvesti = pfs.reduce((s, p) => s + Number(p.capitalInvesti), 0);

  return (
    <div className="print-doc">
      <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-6 mb-6">
        <div>
          <h1 className="text-xl font-bold text-emerald-700">AfriGes — Réseau des Investisseurs AfriSime</h1>
          <p className="text-slate-500 text-sm mt-1">Convention de Partenariat Financier</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Date : {today}</p>
          <p>Réf. : CVP-{String(m.id).padStart(5, "0")}</p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="section-title">IDENTIFICATION DES PARTIES</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="font-semibold text-slate-700 mb-2">PARTIE A — AfriSime (Opérateur)</p>
            <p className="text-slate-600">AfriGes — AfriSime</p>
            <p className="text-slate-500 text-xs mt-1">Gestionnaire et opérateur du Réseau RIA</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <p className="font-semibold text-emerald-700 mb-2">PARTIE B — Investisseur Partenaire</p>
            <p className="text-slate-800 font-bold">{m.prenom} {m.nom}</p>
            {m.email    && <p className="text-slate-500 text-xs mt-1">{m.email}</p>}
            {m.telephone && <p className="text-slate-500 text-xs">{m.telephone}</p>}
            <p className="text-slate-500 text-xs mt-1">Membre depuis {fmtDate(m.dateAdhesion)}</p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="section-title">CONDITIONS FINANCIÈRES AU {today.toUpperCase()}</h2>
        <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-slate-50">
              <td className="px-4 py-2 text-slate-500">Nombre de portefeuilles actifs</td>
              <td className="px-4 py-2 text-right font-medium">{pfs.length}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-500">Capital total investi</td>
              <td className="px-4 py-2 text-right font-bold text-emerald-700">{fmt(totalInvesti)}</td>
            </tr>
            {pfs.map((pf) => (
              <tr key={pf.id} className="bg-slate-50/50">
                <td className="px-4 py-1.5 text-xs text-slate-400 pl-8">↳ {pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
                <td className="px-4 py-1.5 text-right text-xs text-slate-600">{fmt(Number(pf.capitalInvesti))}</td>
              </tr>
            ))}
            <tr>
              <td className="px-4 py-2 text-slate-500">Bénéfices totaux générés</td>
              <td className="px-4 py-2 text-right font-medium text-violet-700">{fmt(pfs.reduce((s, p) => s + Number(p.beneficesGeneres), 0))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-2 gap-12 mt-10">
        <div>
          <p className="text-sm text-slate-500 mb-1">Pour AfriSime,</p>
          <p className="text-xs text-slate-400 mb-8">Le Directeur Général</p>
          <div className="border-b border-slate-400 mb-1"></div>
          <p className="text-xs text-slate-500">Nom, signature et cachet</p>
        </div>
        <div>
          <p className="text-sm text-slate-500 mb-1">Lu et approuvé,</p>
          <p className="text-xs text-slate-400 mb-8">L&apos;Investisseur Partenaire</p>
          <div className="border-b border-slate-400 mb-1"></div>
          <p className="text-xs text-slate-500">{m.prenom} {m.nom}</p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-6 text-xs text-slate-400 flex justify-between">
        <span>CVP-RIA-{String(m.id).padStart(5, "0")} — Convention de partenariat</span>
        <span>Document généré le {today} — confidentiel</span>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const DOCS = [
  { id: "contrat",     label: "Contrat d'adhésion",       icon: FileText,  desc: "Contrat d'investissement et conditions de participation" },
  { id: "attestation", label: "Attestation",               icon: Shield,    desc: "Attestation officielle de participation au RIA" },
  { id: "releve",      label: "Relevé de compte",          icon: BookOpen,  desc: "État détaillé des portefeuilles, dépôts, retraits et financements" },
  { id: "convention",  label: "Convention de partenariat", icon: Award,     desc: "Convention formalisant le partenariat financier entre AfriSime et l'investisseur" },
];

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [docType, setDocType] = useState("contrat");

  const { data, loading } = useApi<{ data: InvestisseurData }>(`/api/admin/ria/investisseurs/${id}`);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
      </div>
    );
  }

  if (!data?.data) {
    return <div className="p-8 text-red-600">Investisseur introuvable.</div>;
  }

  const inv = data.data;

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="max-w-3xl mx-auto mb-4 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/user/responsablesRIA/investisseurs/${id}`}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Retour à la fiche
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="font-semibold text-slate-700">
              Documents — {inv.member.prenom} {inv.member.nom}
            </h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg"
          >
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {DOCS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onClick={() => setDocType(d.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  docType === d.id
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {DOCS.find((d) => d.id === docType)?.desc}
        </p>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-xl p-10 print:shadow-none print:rounded-none print:p-8">
        {docType === "contrat"     && <Contrat     inv={inv} />}
        {docType === "attestation" && <Attestation inv={inv} />}
        {docType === "releve"      && <Releve      inv={inv} />}
        {docType === "convention"  && <Convention  inv={inv} />}
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
        .section-title {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 4px;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { RefreshCw, Printer, ArrowLeft, Download, Mail } from "lucide-react";
import Link from "next/link";
import { grouperComposantsPaie } from "@/lib/composantsPaie";

// ── Types ────────────────────────────────────────────────────────────────────

interface Composant {
  id: number; type: string; libelle: string; montant: number; isRetenue: boolean;
}

interface FichePaie {
  id: number; mois: number; annee: number;
  salaireBase: number; totalBrut: number; totalRetenues: number; netAPayer: number;
  statut: string; notes: string | null; createdAt: string; modePaiement: string | null;
  composants: Composant[];
  profilRH: {
    id: number; matricule: string; fonction: string | null; departement: string | null;
    dateEmbauche: string | null;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } };
  };
}

// ── Constantes ───────────────────────────────────────────────────────────────

const MOIS_LABELS = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(Math.round(n));

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function BulletinPage() {
  const params = useParams<{ id: string }>();
  const { data: res, loading } = useApi<{ data: FichePaie }>(`/api/admin/rh/paie/${params.id}`);
  const f = res?.data;

  const { mutate: envoyerEmail, loading: envoi } = useMutation<{ message: string }>(
    `/api/admin/rh/paie/${params.id}/envoyer-bulletin`,
    "POST",
    { successMessage: "Bulletin envoyé par email au collaborateur." },
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement du bulletin…
      </div>
    );
  }

  if (!f) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 gap-3">
        <p>Fiche introuvable.</p>
        <Link href="/dashboard/admin/rh/paie" className="text-emerald-600 hover:underline text-sm">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const member  = f.profilRH.gestionnaire.member;
  const { fixe, variable, deductions, totalFixe, totalVariable, totalDeductions } =
    grouperComposantsPaie(f.composants, Number(f.salaireBase));

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">

      {/* Barre d'actions (masquée à l'impression) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link
          href="/dashboard/admin/rh/paie"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à la liste
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/admin/rh/paie/${params.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-600 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50"
          >
            <Download className="w-4 h-4" /> Télécharger PDF
          </a>
          <button
            onClick={() => envoyerEmail({})}
            disabled={envoi}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-60"
          >
            {envoi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {envoi ? "Envoi…" : "Envoyer par email"}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
        </div>
      </div>

      {/* Bulletin */}
      <div className="max-w-2xl mx-auto my-8 print:my-0 bg-white shadow-lg print:shadow-none p-10 print:p-8">

        {/* ── En-tête société ── */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-emerald-600">
          <div>
            <div className="text-2xl font-bold text-emerald-700 tracking-tight">AfriGes</div>
            <div className="text-xs text-slate-500 mt-0.5">Gestion RH & Paie</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-800 uppercase tracking-widest">Bulletin de Paie</div>
            <div className="text-sm text-slate-600 mt-1">
              {MOIS_LABELS[f.mois]} {f.annee}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Fiche n° {f.id}</div>
          </div>
        </div>

        {/* ── Informations employé ── */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Employé</p>
            <p className="text-lg font-bold text-slate-900">{member.prenom} {member.nom}</p>
            <p className="text-sm text-slate-500 mt-0.5">Matricule : <span className="font-mono font-medium text-slate-700">{f.profilRH.matricule}</span></p>
            {f.profilRH.fonction && <p className="text-sm text-slate-500 mt-0.5">Poste : <span className="font-medium text-slate-700">{f.profilRH.fonction}</span></p>}
            {f.profilRH.departement && <p className="text-sm text-slate-500 mt-0.5">Département : <span className="font-medium text-slate-700">{f.profilRH.departement}</span></p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Période</p>
            <p className="text-sm text-slate-700"><span className="font-medium">Période de paie :</span> {MOIS_LABELS[f.mois]} {f.annee}</p>
            {f.profilRH.dateEmbauche && (
              <p className="text-sm text-slate-700 mt-0.5"><span className="font-medium">Date d&apos;embauche :</span> {formatDate(f.profilRH.dateEmbauche)}</p>
            )}
            {f.modePaiement && (
              <p className="text-sm text-slate-700 mt-0.5"><span className="font-medium">Mode de paiement :</span> {f.modePaiement.replace("_", " ")}</p>
            )}
            <p className="text-sm text-slate-700 mt-0.5"><span className="font-medium">Date d&apos;émission :</span> {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* ── Salaire fixe ── */}
        <div className="mb-1">
          <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-t-lg border-t border-x border-slate-200">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Salaire fixe</span>
            <span className="text-xs font-semibold text-slate-500 uppercase">Montant (FCFA)</span>
          </div>
          <div className="border-x border-slate-200 divide-y divide-slate-100">
            <div className="flex justify-between items-center py-2.5 px-3">
              <span className="text-sm font-medium text-slate-700">Salaire de base</span>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">{fmt(f.salaireBase)}</span>
            </div>
            {fixe.map((c, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 px-3">
                <span className="text-sm text-slate-700">{c.libelle}</span>
                <span className="text-sm font-medium text-emerald-700 tabular-nums">+ {fmt(c.montant)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-b-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total salaire fixe</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt(totalFixe)}</span>
          </div>
        </div>

        {/* ── Salaire variable ── */}
        {variable.length > 0 && (
          <div className="mt-4 mb-1">
            <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-t-lg border-t border-x border-slate-200">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Salaire variable</span>
              <span className="text-xs font-semibold text-slate-500 uppercase">Montant (FCFA)</span>
            </div>
            <div className="border-x border-slate-200 divide-y divide-slate-100">
              {variable.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 px-3 hover:bg-emerald-50/30">
                  <span className="text-sm text-slate-700">{c.libelle}</span>
                  <span className="text-sm font-medium text-emerald-700 tabular-nums">+ {fmt(c.montant)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-b-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total salaire variable</span>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">+ {fmt(totalVariable)}</span>
            </div>
          </div>
        )}

        {/* ── Déductions ── */}
        {deductions.length > 0 && (
          <div className="mt-4 mb-1">
            <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-t-lg border-t border-x border-slate-200">
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Déductions</span>
              <span className="text-xs font-semibold text-slate-500 uppercase">Montant (FCFA)</span>
            </div>
            <div className="border-x border-slate-200 divide-y divide-slate-100">
              {deductions.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 px-3 hover:bg-red-50/30">
                  <span className="text-sm text-slate-700">{c.libelle}</span>
                  <span className="text-sm font-medium text-red-600 tabular-nums">- {fmt(c.montant)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-b-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total déductions</span>
              <span className="text-sm font-bold text-red-600 tabular-nums">- {fmt(totalDeductions)}</span>
            </div>
          </div>
        )}

        {/* ── Récapitulatif ── */}
        <div className="mt-6 border border-slate-300 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50 border-b border-slate-200">
            <span className="text-sm text-slate-600">Salaire brut total</span>
            <span className="text-sm font-semibold text-slate-800 tabular-nums">{fmt(f.totalBrut)} FCFA</span>
          </div>
          <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50 border-b border-slate-200">
            <span className="text-sm text-slate-600">Total des retenues</span>
            <span className="text-sm font-semibold text-red-600 tabular-nums">- {fmt(f.totalRetenues)} FCFA</span>
          </div>
          <div className="flex justify-between items-center py-4 px-4 bg-emerald-600">
            <span className="text-base font-bold text-white uppercase tracking-wide">Net à payer</span>
            <span className="text-xl font-bold text-white tabular-nums">{fmt(f.netAPayer)} FCFA</span>
          </div>
        </div>

        {/* ── Notes ── */}
        {f.notes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-medium text-amber-700 mb-0.5">Note</p>
            <p className="text-sm text-amber-800">{f.notes}</p>
          </div>
        )}

        {/* ── Zones de signature ── */}
        <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-8">Signature RH / Direction</p>
            <div className="border-b-2 border-slate-300" />
            <p className="text-xs text-slate-400 mt-1 text-center">Cachet et signature</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-8">Signature de l&apos;employé</p>
            <div className="border-b-2 border-slate-300" />
            <p className="text-xs text-slate-400 mt-1 text-center">Lu et approuvé</p>
          </div>
        </div>

        {/* ── Pied de page ── */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Bulletin généré le {formatDate(new Date().toISOString())} · Confidentiel · AfriGes RH
          </p>
        </div>
      </div>
    </div>
  );
}

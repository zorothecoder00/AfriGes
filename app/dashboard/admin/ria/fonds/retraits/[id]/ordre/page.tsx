"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Retrait {
  id: number; reference: string; montant: number; statut: string;
  motif: string | null; modePaiement: string | null; notes: string | null;
  dateValidation: string | null; datePaiement: string | null; createdAt: string;
  validePar: { nom: string; prenom: string } | null;
  portefeuille: {
    id: number; reference: string; nom: string | null;
    capitalInvesti: number; capitalEngage: number; capitalDisponible: number;
    profilRIA: {
      gestionnaire: { member: { nom: string; prenom: string; email: string | null; telephone: string | null } };
    };
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: unknown) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n ?? 0)));
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

// Conversion simple d'un nombre en lettres (FCFA) — gros ordres de grandeur
function montantEnLettres(n: number): string {
  // approximation lisible : on se limite à l'affichage numérique groupé
  return `${fmt(n)} francs CFA`;
}

const STATUT_BADGE: Record<string, string> = {
  VALIDE: "bg-blue-50 text-blue-700 border-blue-200",
  PAYE:   "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrdrePaiementPage() {
  const params = useParams<{ id: string }>();
  const { data: res, loading } = useApi<{ data: Retrait }>(`/api/admin/ria/fonds/retraits/${params.id}`);
  const r = res?.data;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement de l&apos;ordre de paiement…
      </div>
    );
  }

  if (!r) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 gap-3">
        <p>Retrait introuvable.</p>
        <Link href="/dashboard/admin/ria/fonds" className="text-emerald-600 hover:underline text-sm">Retour aux fonds</Link>
      </div>
    );
  }

  const inv = r.portefeuille.profilRIA.gestionnaire.member;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      {/* Barre d'action — masquée à l'impression */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard/admin/ria/fonds"
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Retour aux fonds
        </Link>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700">
          <Printer className="w-4 h-4" /> Imprimer
        </button>
      </div>

      {/* Document */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-10 print:shadow-none print:border-0 print:rounded-none">
        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">ORDRE DE PAIEMENT</h1>
            <p className="text-sm text-slate-500 mt-1">Réseau des Investisseurs AfriSime (RIA)</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-slate-900">{r.reference}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-xs font-medium ${STATUT_BADGE[r.statut] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
              {r.statut}
            </span>
            <p className="text-xs text-slate-400 mt-1">Émis le {fmtDate(r.dateValidation ?? r.createdAt)}</p>
          </div>
        </div>

        {/* Bénéficiaire */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Bénéficiaire</p>
            <p className="font-semibold text-slate-900">{inv.prenom} {inv.nom}</p>
            {inv.email && <p className="text-sm text-slate-500">{inv.email}</p>}
            {inv.telephone && <p className="text-sm text-slate-500">{inv.telephone}</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Portefeuille</p>
            <p className="font-semibold text-slate-900">{r.portefeuille.nom ?? r.portefeuille.reference}</p>
            <p className="text-sm text-slate-500 font-mono">{r.portefeuille.reference}</p>
          </div>
        </div>

        {/* Montant */}
        <div className="mt-8 rounded-xl bg-rose-50 border border-rose-100 p-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">Montant à payer</p>
          <p className="text-3xl font-bold text-rose-700 mt-1 tabular-nums">{fmt(r.montant)} FCFA</p>
          <p className="text-sm text-rose-500 mt-1 italic">{montantEnLettres(Number(r.montant))}</p>
        </div>

        {/* Détails */}
        <div className="mt-8 space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Mode de paiement</span>
            <span className="font-medium text-slate-900">{r.modePaiement?.replace("_", " ") ?? "—"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Motif</span>
            <span className="font-medium text-slate-900">{r.motif ?? "—"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Date de validation</span>
            <span className="font-medium text-slate-900">{fmtDate(r.dateValidation)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Validé par</span>
            <span className="font-medium text-slate-900">{r.validePar ? `${r.validePar.prenom} ${r.validePar.nom}` : "—"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Date de paiement</span>
            <span className="font-medium text-slate-900">{fmtDate(r.datePaiement)}</span>
          </div>
        </div>

        {/* Situation portefeuille au moment de l'émission */}
        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Situation du portefeuille</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Capital investi</p>
              <p className="font-semibold text-slate-900 tabular-nums">{fmt(r.portefeuille.capitalInvesti)} F</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Fonds engagés</p>
              <p className="font-semibold text-amber-700 tabular-nums">{fmt(r.portefeuille.capitalEngage)} F</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Solde disponible</p>
              <p className="font-semibold text-emerald-700 tabular-nums">{fmt(r.portefeuille.capitalDisponible)} F</p>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-10">
          <div className="text-center">
            <div className="h-16 border-b border-slate-300"></div>
            <p className="text-xs text-slate-500 mt-2">Le Responsable RIA</p>
          </div>
          <div className="text-center">
            <div className="h-16 border-b border-slate-300"></div>
            <p className="text-xs text-slate-500 mt-2">Le Comptable / Caissier</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-300 text-center mt-8">
          Document généré automatiquement — {r.reference} — AfriGes RIA
        </p>
      </div>
    </div>
  );
}

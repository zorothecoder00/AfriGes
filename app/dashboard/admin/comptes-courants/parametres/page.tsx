"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import ClienteleTabBar from "@/components/ClienteleTabBar";

interface Parametrage {
  montantMinOuverture: string | number;
  soldeMinObligatoire: string | number;
  depotMin: string | number;
  depotMax: string | number | null;
  retraitMin: string | number | null;
  retraitMax: string | number | null;
  soldeMaxAutorise: string | number | null;
  autoriserSoldeNegatif: boolean;
  nbRetraitsMaxParMois: number | null;
  dureeInactiviteJours: number;
  codeAgence: string;
  codeGuichet: string;
  compteCaisseNumero: string;
  compteCourantClientNumero: string;
  compteVentesNumero: string;
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ParametrageCCPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/comptes-courants/parametrage");
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        const p = j.data as Parametrage;
        setForm({
          montantMinOuverture: s(p.montantMinOuverture),
          soldeMinObligatoire: s(p.soldeMinObligatoire),
          depotMin: s(p.depotMin),
          depotMax: s(p.depotMax),
          retraitMin: s(p.retraitMin),
          retraitMax: s(p.retraitMax),
          soldeMaxAutorise: s(p.soldeMaxAutorise),
          autoriserSoldeNegatif: !!p.autoriserSoldeNegatif,
          nbRetraitsMaxParMois: s(p.nbRetraitsMaxParMois),
          dureeInactiviteJours: s(p.dureeInactiviteJours),
          codeAgence: s(p.codeAgence),
          codeGuichet: s(p.codeGuichet),
          compteCaisseNumero: s(p.compteCaisseNumero),
          compteCourantClientNumero: s(p.compteCourantClientNumero),
          compteVentesNumero: s(p.compteVentesNumero),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible");
      } finally { setLoading(false); }
    })();
  }, []);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/comptes-courants/parametrage", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Paramétrage enregistré ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard/admin/comptes-courants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux comptes courants
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" /> Paramètres · Comptes Courants
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Montants (FCFA)">
              <Money label="Montant minimum d'ouverture" k="montantMinOuverture" form={form} set={set} />
              <Money label="Solde minimum obligatoire" k="soldeMinObligatoire" form={form} set={set} />
              <Money label="Dépôt minimum" k="depotMin" form={form} set={set} />
              <Money label="Dépôt maximum" k="depotMax" form={form} set={set} placeholder="Illimité" />
              <Money label="Retrait minimum" k="retraitMin" form={form} set={set} placeholder="Illimité" />
              <Money label="Retrait maximum" k="retraitMax" form={form} set={set} placeholder="Illimité" />
              <Money label="Solde maximum autorisé" k="soldeMaxAutorise" form={form} set={set} placeholder="Illimité" />
            </Section>

            <Section title="Règles">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">Autoriser un solde négatif</span>
                <button onClick={() => set("autoriserSoldeNegatif", !form.autoriserSoldeNegatif)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.autoriserSoldeNegatif ? "bg-emerald-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.autoriserSoldeNegatif ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <NumField label="Nombre maximum de retraits par mois" k="nbRetraitsMaxParMois" form={form} set={set} placeholder="Illimité" />
              <NumField label="Durée d'inactivité avant suspension (jours)" k="dureeInactiviteJours" form={form} set={set} />
            </Section>

            <Section title="Identité bancaire (RIB)">
              <TextField label="Code Agence" k="codeAgence" form={form} set={set} />
              <TextField label="Code Guichet" k="codeGuichet" form={form} set={set} />
              <p className="text-xs text-gray-400">
                Ces codes servent à construire le RIB des comptes. Le numéro (12 chiffres, commençant par 12) et la clé de contrôle sont générés automatiquement à l&apos;ouverture.
              </p>
            </Section>

            <Section title="Comptabilité (numéros de compte)">
              <TextField label="Compte Caisse" k="compteCaisseNumero" form={form} set={set} />
              <TextField label="Compte courant client (crédit)" k="compteCourantClientNumero" form={form} set={set} />
              <TextField label="Compte Ventes (contrepartie paiement)" k="compteVentesNumero" form={form} set={set} />
              <p className="text-xs text-gray-400">
                Numéros du plan comptable utilisés pour les écritures automatiques (dépôt : débit Caisse / crédit Compte courant client). Si un numéro est absent du plan comptable, le mouvement est enregistré sans écriture (à régulariser).
              </p>
            </Section>

            <div className="flex justify-end">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-bold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
type FieldProps = { label: string; k: string; form: Record<string, string | boolean>; set: (k: string, v: string) => void; placeholder?: string };
function Money({ label, k, form, set, placeholder }: FieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-600">{label}</label>
      <div className="relative w-48">
        <input type="number" min={0} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)}
          placeholder={placeholder} className="w-full pr-12 pl-3 py-2 border border-gray-200 rounded-lg text-sm text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">FCFA</span>
      </div>
    </div>
  );
}
function NumField({ label, k, form, set, placeholder }: FieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-600">{label}</label>
      <input type="number" min={0} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder} className="w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
}
function TextField({ label, k, form, set }: FieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-600">{label}</label>
      <input value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)}
        className="w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import {
  ArrowLeft, Save, User, Phone, MapPin, Shield,
  AlertCircle, Loader2, Briefcase, Store, Navigation,
  FileText, CreditCard, UserCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: number;
  nom: string; prenom: string; telephone: string; adresse: string | null; etat: string;
  codeClient: string | null;
  sexe: string | null; dateNaissance: string | null;
  telephoneSecondaire: string | null;
  quartier: string | null; ville: string | null;
  photoUrl: string | null; pieceIdentiteUrl: string | null; numeroCNI: string | null;
  activite: string | null; nomCommerce: string | null;
  latitude: number | null; longitude: number | null;
  typeClient: string | null; limiteCredit: string | number | null;
  agentTerrain?: { id: number; nom: string; prenom: string } | null;
}

interface AgentOption {
  id: number;
  member: { id: number; nom: string; prenom: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INPUT = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50";
const SELECT = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 appearance-none";

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide pb-3 border-b border-gray-100">
      <span className="text-emerald-600">{icon}</span>{label}
    </h2>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ClientEdit({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { data: response, loading } = useApi<{ data: Client }>(`/api/admin/clients/${clientId}`);
  const { data: agentsRes } = useApi<{ data: AgentOption[] }>('/api/admin/gestionnaires?role=AGENT_TERRAIN&actif=true&limit=200');
  const { mutate, loading: saving, error: saveError } = useMutation(
    `/api/admin/clients/${clientId}`, 'PATCH', { successMessage: 'Client modifié avec succès' }
  );

  const [form, setForm] = useState({
    // Legacy
    nom: '', prenom: '', telephone: '', adresse: '', etat: 'ACTIF',
    // Identité
    sexe: '', dateNaissance: '', telephoneSecondaire: '', numeroCNI: '',
    // Localisation
    quartier: '', ville: '', latitude: '', longitude: '',
    // Documents
    photoUrl: '', pieceIdentiteUrl: '',
    // Activité
    activite: '', nomCommerce: '',
    // Type & crédit
    typeClient: '', limiteCredit: '',
    // Affectation
    agentTerrainId: '',
  });

  useEffect(() => {
    if (!response?.data) return;
    const c = response.data;
    const timer = setTimeout(() => {
      setForm({
        nom:                 c.nom,
        prenom:              c.prenom,
        telephone:           c.telephone,
        adresse:             c.adresse             ?? '',
        etat:                c.etat,
        sexe:                c.sexe                ?? '',
        dateNaissance:       c.dateNaissance        ? c.dateNaissance.slice(0, 10) : '',
        telephoneSecondaire: c.telephoneSecondaire  ?? '',
        numeroCNI:           c.numeroCNI            ?? '',
        quartier:            c.quartier             ?? '',
        ville:               c.ville                ?? '',
        latitude:            c.latitude             != null ? String(c.latitude)  : '',
        longitude:           c.longitude            != null ? String(c.longitude) : '',
        photoUrl:            c.photoUrl             ?? '',
        pieceIdentiteUrl:    c.pieceIdentiteUrl     ?? '',
        activite:            c.activite             ?? '',
        nomCommerce:         c.nomCommerce          ?? '',
        typeClient:          c.typeClient           ?? '',
        limiteCredit:        c.limiteCredit         != null ? String(c.limiteCredit) : '',
        agentTerrainId:      c.agentTerrain         ? String(c.agentTerrain.id) : '',
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [response]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await mutate({
      nom: form.nom, prenom: form.prenom, telephone: form.telephone,
      adresse:             form.adresse             || null,
      etat:                form.etat,
      sexe:                form.sexe                || null,
      dateNaissance:       form.dateNaissance       || null,
      telephoneSecondaire: form.telephoneSecondaire || null,
      numeroCNI:           form.numeroCNI           || null,
      quartier:            form.quartier            || null,
      ville:               form.ville               || null,
      latitude:            form.latitude            ? Number(form.latitude)  : null,
      longitude:           form.longitude           ? Number(form.longitude) : null,
      photoUrl:            form.photoUrl            || null,
      pieceIdentiteUrl:    form.pieceIdentiteUrl    || null,
      activite:            form.activite            || null,
      nomCommerce:         form.nomCommerce         || null,
      typeClient:          form.typeClient          || null,
      limiteCredit:        form.limiteCredit        ? Number(form.limiteCredit) : null,
      agentTerrainId:      form.agentTerrainId      ? Number(form.agentTerrainId) : null,
    });
    if (result) router.push(`/dashboard/admin/clients/${clientId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const client = response?.data;
  const agents = agentsRes?.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* En-tête */}
        <div className="mb-6 flex items-center gap-4">
          <Link href={`/dashboard/admin/clients/${clientId}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier le client</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {client ? `${client.prenom} ${client.nom}` : '…'}
              {client?.codeClient && <span className="font-mono ml-2">· {client.codeClient}</span>}
            </p>
          </div>
        </div>

        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Erreur</p>
              <p className="text-sm text-red-600 mt-1">{saveError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ─ Identité ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <SectionTitle icon={<User className="w-4 h-4" />} label="Identité" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom <span className="text-red-500">*</span></label>
                <input type="text" required value={form.nom} onChange={set('nom')} className={INPUT} placeholder="Nom" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Prénom <span className="text-red-500">*</span></label>
                <input type="text" required value={form.prenom} onChange={set('prenom')} className={INPUT} placeholder="Prénom" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sexe</label>
                <select value={form.sexe} onChange={set('sexe')} className={SELECT}>
                  <option value="">-- Sélectionner --</option>
                  <option value="MASCULIN">Masculin</option>
                  <option value="FEMININ">Féminin</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de naissance</label>
                <input type="date" value={form.dateNaissance} onChange={set('dateNaissance')} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tél. principal <span className="text-red-500">*</span></label>
                <input type="text" required value={form.telephone} onChange={set('telephone')} className={INPUT} placeholder="07XXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tél. secondaire</label>
                <input type="text" value={form.telephoneSecondaire} onChange={set('telephoneSecondaire')} className={INPUT} placeholder="Optionnel" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">N° CNI</label>
                <input type="text" value={form.numeroCNI} onChange={set('numeroCNI')} className={INPUT} placeholder="Numéro CNI / pièce d'identité" />
              </div>
            </div>
          </div>

          {/* ─ Localisation ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <SectionTitle icon={<MapPin className="w-4 h-4" />} label="Localisation" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Adresse</label>
                <input type="text" value={form.adresse} onChange={set('adresse')} className={INPUT} placeholder="Rue, numéro…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Quartier</label>
                <input type="text" value={form.quartier} onChange={set('quartier')} className={INPUT} placeholder="Quartier" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ville</label>
                <input type="text" value={form.ville} onChange={set('ville')} className={INPUT} placeholder="Ville" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Navigation className="w-3 h-3" />Latitude GPS</label>
                <input type="number" step="any" value={form.latitude} onChange={set('latitude')} className={INPUT} placeholder="Ex : 5.3599517" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Navigation className="w-3 h-3" />Longitude GPS</label>
                <input type="number" step="any" value={form.longitude} onChange={set('longitude')} className={INPUT} placeholder="Ex : -4.0082563" />
              </div>
            </div>
          </div>

          {/* ─ Activité & commerce ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <SectionTitle icon={<Briefcase className="w-4 h-4" />} label="Activité & commerce" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Activité / Métier</label>
                <input type="text" value={form.activite} onChange={set('activite')} className={INPUT} placeholder="Ex : Commerçant, Agriculteur…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom du commerce</label>
                <input type="text" value={form.nomCommerce} onChange={set('nomCommerce')} className={INPUT} placeholder="Nom boutique / entreprise" />
              </div>
            </div>
          </div>

          {/* ─ Documents ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <SectionTitle icon={<FileText className="w-4 h-4" />} label="Documents (URLs)" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Photo client (URL)</label>
                <input type="url" value={form.photoUrl} onChange={set('photoUrl')} className={INPUT} placeholder="https://…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Pièce d'identité (URL)</label>
                <input type="url" value={form.pieceIdentiteUrl} onChange={set('pieceIdentiteUrl')} className={INPUT} placeholder="https://…" />
              </div>
            </div>
          </div>

          {/* ─ Type client & crédit ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <SectionTitle icon={<CreditCard className="w-4 h-4" />} label="Type client & crédit" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Type client</label>
                <select value={form.typeClient} onChange={set('typeClient')} className={SELECT}>
                  <option value="">-- Sélectionner --</option>
                  <option value="COMPTANT">Comptant</option>
                  <option value="CREDIT">Crédit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Limite de crédit (FCFA)</label>
                <input type="number" min={0} value={form.limiteCredit} onChange={set('limiteCredit')}
                  disabled={form.typeClient !== 'CREDIT'}
                  className={INPUT + (form.typeClient !== 'CREDIT' ? ' opacity-40 cursor-not-allowed' : '')}
                  placeholder="0" />
                {form.typeClient !== 'CREDIT' && (
                  <p className="text-xs text-gray-400 mt-1">Disponible uniquement pour les clients Crédit</p>
                )}
              </div>
            </div>
          </div>

          {/* ─ Statut & affectation ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <SectionTitle icon={<Shield className="w-4 h-4" />} label="Statut & affectation" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Statut <span className="text-red-500">*</span></label>
                <select value={form.etat} onChange={set('etat')} className={SELECT}>
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                  <option value="SUSPENDU">Suspendu</option>
                  <option value="BLOQUE">Bloqué</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Un client suspendu ou bloqué ne peut pas bénéficier de nouveaux services</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><UserCheck className="w-3 h-3" />Agent terrain</label>
                <select value={form.agentTerrainId} onChange={set('agentTerrainId')} className={SELECT}>
                  <option value="">-- Aucun agent --</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.member.prenom} {a.member.nom}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-4 pt-2">
            <Link href={`/dashboard/admin/clients/${clientId}`}
              className={`px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm ${saving ? 'pointer-events-none opacity-50' : ''}`}>
              Annuler
            </Link>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement…</> : <><Save className="w-4 h-4" />Enregistrer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

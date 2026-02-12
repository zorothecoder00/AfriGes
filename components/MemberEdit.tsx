'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useApi';

interface MemberFormData {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  role: string;
  etat: string;
  password?: string;
}

interface MemberResponse {
  data: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    adresse?: string;
    role?: string;
    etat: string;
  };
}

export default function EditMember({ memberId }: { memberId: string }) {
  const router = useRouter();
  const { data: response, loading } = useApi<MemberResponse>(`/api/admin/membres/${memberId}`);
  const { mutate, loading: saving, error: saveError } = useMutation(`/api/admin/membres/${memberId}`, 'PATCH');

  const member = response?.data;

  const [formData, setFormData] = useState<MemberFormData>({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    adresse: '',
    role: 'USER',
    etat: 'ACTIF',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!response?.data) return;

    const timeout = setTimeout(() => {
      const m = response.data;
      setFormData({  
        nom: m.nom,    
        prenom: m.prenom,   
        email: m.email,
        telephone: m.telephone || '',
        adresse: m.adresse || '',
        role: m.role || 'USER',
        etat: m.etat, 
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [response]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.nom.trim()) newErrors.nom = 'Le nom est requis';
    if (!formData.prenom.trim()) newErrors.prenom = 'Le prenom est requis';
    if (!formData.email.trim()) newErrors.email = 'L\'email est requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email invalide';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: Record<string, string | undefined> = { ...formData };
    if (!payload.password) delete payload.password;

    const result = await mutate(payload);
    if (result) {
      router.push(`/dashboard/admin/membres/${memberId}`);
    }
  };

  const getInitials = (nom: string, prenom: string) => `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Modifier le membre</h1>
              <p className="text-sm text-gray-600 mt-1">Mettez a jour les informations du membre</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{saveError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Avatar */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  {formData.nom && formData.prenom ? getInitials(formData.nom, formData.prenom) : '?'}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{formData.prenom} {formData.nom}</h3>
                  <p className="text-sm text-gray-600">Membre #{memberId}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Informations personnelles */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">Prenom *</label>
                    <input type="text" id="prenom" name="prenom" value={formData.prenom} onChange={handleChange} className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${errors.prenom ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
                    {errors.prenom && <p className="mt-1 text-sm text-red-600">{errors.prenom}</p>}
                  </div>
                  <div>
                    <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
                    <input type="text" id="nom" name="nom" value={formData.nom} onChange={handleChange} className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${errors.nom ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
                    {errors.nom && <p className="mt-1 text-sm text-red-600">{errors.nom}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">Telephone</label>
                    <input type="tel" id="telephone" name="telephone" value={formData.telephone} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                    <textarea id="adresse" name="adresse" value={formData.adresse} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none" />
                  </div>
                </div>
              </div>

              {/* Compte */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations du compte</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select id="role" name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white">
                      <option value="USER">Utilisateur</option>
                      <option value="ADMIN">Administrateur</option>
                      <option value="SUPER_ADMIN">Super Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="etat" className="block text-sm font-medium text-gray-700 mb-2">Etat du compte</label>
                    <select id="etat" name="etat" value={formData.etat} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white">
                      <option value="ACTIF">Actif</option>
                      <option value="INACTIF">Inactif</option>
                      <option value="SUSPENDU">Suspendu</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Securite */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Securite</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
                    <input type="password" id="password" name="password" value={formData.password || ''} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" placeholder="Laissez vide pour ne pas changer" />
                    <p className="mt-1 text-sm text-gray-500">Minimum 8 caracteres</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

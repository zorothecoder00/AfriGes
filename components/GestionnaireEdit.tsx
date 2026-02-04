'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface GestionnaireEditProps {
  gestionnaireId: string;
}

interface FormData {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  role: 'AGENT' | 'SUPERVISEUR' | 'CAISSIER';
  actif: boolean;
  roleSysteme?: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
}

export default function GestionnaireEdit({ gestionnaireId }: GestionnaireEditProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    role: 'AGENT',
    actif: true,
    roleSysteme: 'USER'
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    // Simuler le chargement des données
    // Remplacer par votre appel API réel
    const fetchGestionnaire = async () => {
      try {
        // const response = await fetch(`/api/gestionnaires/${gestionnaireId}`);
        // const data = await response.json();
        
        // Données simulées pour la démo
        const mockData = {
          prenom: 'Koné',
          nom: 'Aminata',
          email: 'a.kone@afriges.com',
          telephone: '+225 07 XX XX XX XX',
          adresse: 'Abidjan, Cocody',
          role: 'SUPERVISEUR' as const,
          actif: true,
          roleSysteme: 'ADMIN' as const
        };
        
        setFormData(mockData);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        setError('Impossible de charger les données du gestionnaire');
      } finally {
        setLoading(false);
      }
    };

    fetchGestionnaire();
  }, [gestionnaireId]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.prenom.trim()) {
      newErrors.prenom = 'Le prénom est requis';
    }

    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.telephone.trim()) {
      newErrors.telephone = 'Le téléphone est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Simuler la sauvegarde
      // Remplacer par votre appel API réel
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // const response = await fetch(`/api/gestionnaires/${gestionnaireId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // });
      
      // if (!response.ok) throw new Error('Erreur lors de la sauvegarde');
      
      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/admin/gestionnaires/${gestionnaireId}`);
      }, 1500);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setError('Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => 
  {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur du champ quand l'utilisateur commence à taper
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier le gestionnaire</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mettez à jour les informations du gestionnaire
            </p>
          </div>
        </div>

        {/* Messages d'alerte */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Erreur</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">Succès</p>
              <p className="text-sm text-green-600 mt-1">
                Les modifications ont été enregistrées avec succès
              </p>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Informations personnelles
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Prénom */}
              <div>
                <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  id="prenom"   
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => handleChange('prenom', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${
                    errors.prenom ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Entrez le prénom"
                />
                {errors.prenom && (
                  <p className="mt-1 text-sm text-red-600">{errors.prenom}</p>
                )}
              </div>

              {/* Nom */}
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  id="nom"
                  type="text"
                  value={formData.nom}
                  onChange={(e) => handleChange('nom', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${
                    errors.nom ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Entrez le nom"
                />
                {errors.nom && (
                  <p className="mt-1 text-sm text-red-600">{errors.nom}</p>
                )}
              </div>
            </div>
          </div>

          {/* Coordonnées */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Coordonnées
            </h2>
            
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="exemple@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* Téléphone */}
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="telephone"
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => handleChange('telephone', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${
                      errors.telephone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="+225 XX XX XX XX XX"
                  />
                </div>
                {errors.telephone && (
                  <p className="mt-1 text-sm text-red-600">{errors.telephone}</p>
                )}
              </div>

              {/* Adresse */}
              <div>
                <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="adresse"
                    type="text"
                    value={formData.adresse}
                    onChange={(e) => handleChange('adresse', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    placeholder="Ville, Quartier"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rôles et permissions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Rôles et permissions
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rôle gestionnaire */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle gestionnaire <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleChange('role', e.target.value as FormData['role'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                >
                  <option value="AGENT">Agent</option>
                  <option value="SUPERVISEUR">Superviseur</option>
                  <option value="CAISSIER">Caissier</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Définit les responsabilités du gestionnaire
                </p>
              </div>

              {/* Rôle système */}
              <div>
                <label htmlFor="roleSysteme" className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle système
                </label>
                <select
                  id="roleSysteme"
                  value={formData.roleSysteme || 'USER'}
                  onChange={(e) => handleChange('roleSysteme', e.target.value as FormData['roleSysteme'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                >
                  <option value="USER">Utilisateur</option>
                  <option value="ADMIN">Administrateur</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Définit les permissions dans le système
                </p>
              </div>

              {/* Statut */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => handleChange('actif', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Gestionnaire actif
                    </span>
                    <p className="text-xs text-gray-500">
                      Le gestionnaire peut accéder au système et effectuer ses tâches
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Plus,
  X,
  Calendar,
  Euro,
  Users,
  Clock,
  AlertCircle,
  Search
} from 'lucide-react';

// Types basés sur votre schéma Prisma
interface TontineForm {
  nom: string;
  description: string;
  montantCycle: string;
  frequence: 'HEBDOMADAIRE' | 'MENSUEL';
  statut: 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';
  dateDebut: string;
  dateFin: string;
}

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  photo: string | null;
}

interface MembreSelectionne {
  memberId: number;
  ordreTirage: number | null;
  membre: Membre;
}

export default function TontineEdit() {
  const tontineId = 1; // À récupérer depuis les params

  const [formData, setFormData] = useState<TontineForm>({
    nom: "Tontine Solidarité",
    description: "Tontine de solidarité pour les membres actifs de la communauté",
    montantCycle: "250",
    frequence: "MENSUEL",
    statut: "ACTIVE",
    dateDebut: "2024-01-15",
    dateFin: ""
  });

  const [membresSelectionnes, setMembresSelectionnes] = useState<MembreSelectionne[]>([
    {
      memberId: 1,
      ordreTirage: 1,
      membre: {
        id: 1,
        nom: "Kouassi",
        prenom: "Jean",
        email: "jean.kouassi@email.com",
        photo: null
      }
    },
    {
      memberId: 2,
      ordreTirage: 2,
      membre: {
        id: 2,
        nom: "Mensah",
        prenom: "Marie",
        email: "marie.mensah@email.com",
        photo: null
      }
    }
  ]);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [searchMembre, setSearchMembre] = useState('');
  const [saving, setSaving] = useState(false);

  // Liste des membres disponibles (à remplacer par un vrai fetch)
  const membresDisponibles: Membre[] = [
    { id: 3, nom: "Agbodjan", prenom: "Paul", email: "paul.agbodjan@email.com", photo: null },
    { id: 4, nom: "Doe", prenom: "Jane", email: "jane.doe@email.com", photo: null },
    { id: 5, nom: "Smith", prenom: "John", email: "john.smith@email.com", photo: null }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const ajouterMembre = (membre: Membre) => {
    if (membresSelectionnes.some(m => m.memberId === membre.id)) {
      return;
    }

    const prochainOrdre = membresSelectionnes.length > 0
      ? Math.max(...membresSelectionnes.map(m => m.ordreTirage || 0)) + 1
      : 1;

    setMembresSelectionnes(prev => [...prev, {
      memberId: membre.id,
      ordreTirage: prochainOrdre,
      membre
    }]);
    setShowMemberModal(false);
    setSearchMembre('');
  };

  const retirerMembre = (memberId: number) => {
    setMembresSelectionnes(prev => prev.filter(m => m.memberId !== memberId));
  };

  const updateOrdreTirage = (memberId: number, ordre: number) => {
    setMembresSelectionnes(prev =>
      prev.map(m =>
        m.memberId === memberId ? { ...m, ordreTirage: ordre } : m
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Simuler une sauvegarde
    setTimeout(() => {
      setSaving(false);
      // Rediriger vers la page de détails
      // router.push(`/dashboard/admin/tontines/${tontineId}`);
      alert('Tontine mise à jour avec succès!');
    }, 1500);
  };

  const getCategoryColor = (nom: string) => {
    if (nom.toLowerCase().includes('solidarité') || nom.toLowerCase().includes('solidarite')) {
      return 'bg-emerald-500';
    } else if (nom.toLowerCase().includes('entrepreneuriat') || nom.toLowerCase().includes('entrepreneur')) {
      return 'bg-orange-500';
    } else if (nom.toLowerCase().includes('éducation') || nom.toLowerCase().includes('education')) {
      return 'bg-blue-500';
    }
    return 'bg-purple-500';
  };

  const membresFiltres = membresDisponibles.filter(m =>
    !membresSelectionnes.some(ms => ms.memberId === m.id) &&
    (searchMembre === '' ||
      m.nom.toLowerCase().includes(searchMembre.toLowerCase()) ||
      m.prenom.toLowerCase().includes(searchMembre.toLowerCase()) ||
      m.email.toLowerCase().includes(searchMembre.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboard/admin/tontines/${tontineId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gérer la tontine</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Modifiez les informations et gérez les membres
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className={`${getCategoryColor(formData.nom)} text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50`}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulaire principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informations de base */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Informations de base</h3>
                
                <div className="space-y-5">
                  <div>
                    <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de la tontine *
                    </label>
                    <input
                      type="text"
                      id="nom"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      placeholder="Ex: Tontine Solidarité"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                      placeholder="Décrivez l'objectif de cette tontine..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="montantCycle" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Euro className="w-4 h-4" />
                          Montant par cycle *
                        </div>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                        <input
                          type="number"
                          id="montantCycle"
                          name="montantCycle"
                          value={formData.montantCycle}
                          onChange={handleInputChange}
                          required
                          min="0"
                          step="0.01"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                          placeholder="250"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="frequence" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Fréquence *
                        </div>
                      </label>
                      <select
                        id="frequence"
                        name="frequence"
                        value={formData.frequence}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none bg-white"
                      >
                        <option value="MENSUEL">Mensuelle</option>
                        <option value="HEBDOMADAIRE">Hebdomadaire</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="dateDebut" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date de début *
                        </div>
                      </label>
                      <input
                        type="date"
                        id="dateDebut"
                        name="dateDebut"
                        value={formData.dateDebut}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="dateFin" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date de fin
                        </div>
                      </label>
                      <input
                        type="date"
                        id="dateFin"
                        name="dateFin"
                        value={formData.dateFin}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="statut" className="block text-sm font-medium text-gray-700 mb-2">
                      Statut *
                    </label>
                    <select
                      id="statut"
                      name="statut"
                      value={formData.statut}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none bg-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDUE">Suspendue</option>
                      <option value="TERMINEE">Terminée</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Gestion des membres */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    Membres ({membresSelectionnes.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMemberModal(true)}
                    className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un membre
                  </button>
                </div>

                {membresSelectionnes.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Aucun membre ajouté</p>
                    <p className="text-sm text-gray-400 mt-1">Cliquez sur &ldquo;Ajouter un membre&rdquo; pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {membresSelectionnes.map((membre, index) => (
                      <div
                        key={membre.memberId}
                        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {membre.membre.prenom[0]}{membre.membre.nom[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {membre.membre.prenom} {membre.membre.nom}
                          </p>
                          <p className="text-sm text-gray-500">{membre.membre.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Ordre de tirage</label>
                            <input
                              type="number"
                              value={membre.ordreTirage || ''}
                              onChange={(e) => updateOrdreTirage(membre.memberId, parseInt(e.target.value) || 0)}
                              min="1"
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="#"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => retirerMembre(membre.memberId)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Aperçu */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Aperçu</h3>
                
                <div className={`${getCategoryColor(formData.nom)} rounded-xl p-6 text-white mb-6`}>
                  <div className="text-white/80 text-xs font-medium mb-1">
                    {formData.nom.split(' ')[0]}
                  </div>
                  <h4 className="text-xl font-bold mb-4">{formData.nom}</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Membres</span>
                      <span className="font-bold">{membresSelectionnes.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Total</span>
                      <span className="font-bold">
                        €{(parseFloat(formData.montantCycle || '0') * membresSelectionnes.length).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Contribution</p>
                    <p className="text-2xl font-bold text-gray-900">€{formData.montantCycle || '0'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Fréquence</p>
                    <p className="font-medium text-gray-900">
                      {formData.frequence === 'MENSUEL' ? 'Mensuelle' : 'Hebdomadaire'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Statut</p>
                    <p className="font-medium text-gray-900">{formData.statut}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Les modifications seront appliquées immédiatement à tous les membres de la tontine.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Modal d'ajout de membre */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Ajouter un membre</h3>
                <button
                  onClick={() => setShowMemberModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchMembre}
                  onChange={(e) => setSearchMembre(e.target.value)}
                  placeholder="Rechercher un membre..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
              {membresFiltres.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun membre disponible</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {membresFiltres.map((membre) => (
                    <button
                      key={membre.id}
                      type="button"
                      onClick={() => ajouterMembre(membre)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200 text-left"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {membre.prenom[0]}{membre.nom[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {membre.prenom} {membre.nom}
                        </p>
                        <p className="text-sm text-gray-500">{membre.email}</p>
                      </div>
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
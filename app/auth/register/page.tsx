'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    adresse: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validation des mots de passe
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      setIsLoading(false);
      return;
    }

    if (!formData.acceptTerms) {
      setError('Vous devez accepter les conditions d\'utilisation');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom: formData.nom,
          prenom: formData.prenom,
          email: formData.email,
          telephone: formData.telephone || null,
          adresse: formData.adresse || null,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Une erreur est survenue');
      }

      router.push('/auth/login?registered=true');
    } catch (error) {
      if(error instanceof Error){
        setError(error.message)       
      }else{
        setError('Une erreur est survenue lors de l\'inscription');
      }
      console.error('Register error:', error);     
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-600 to-purple-800 px-4 py-8 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:50px_50px] animate-[patternMove_20s_linear_infinite]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-[slideUp_0.6s_ease-out]">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(44,62,80,0.25)] overflow-hidden transition-transform hover:-translate-y-1 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_20%,transparent_70%)] animate-pulse opacity-50" />
            <h1 className="text-4xl font-bold text-white mb-2 relative z-10 font-serif tracking-tight">
              Inscription
            </h1>
            <p className="text-white/85 text-sm relative z-10">
              Créez votre compte en quelques étapes
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-slate-800 mb-2">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nom"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    required
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="prenom" className="block text-sm font-medium text-slate-800 mb-2">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="prenom"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleChange}
                    placeholder="Votre prénom"
                    required
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="votre.email@exemple.com"
                  required
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                />
              </div>

              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-slate-800 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  id="telephone"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  placeholder="+228 XX XX XX XX"
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                />
              </div>

              <div>
                <label htmlFor="adresse" className="block text-sm font-medium text-slate-800 mb-2">
                  Adresse
                </label>
                <input
                  type="text"
                  id="adresse"
                  name="adresse"
                  value={formData.adresse}
                  onChange={handleChange}
                  placeholder="Votre adresse complète"
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-800 mb-2">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    minLength={8}
                    required
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-800 transition-colors"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-800 mb-2">
                  Confirmer le mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    minLength={8}
                    required
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-800 transition-colors"
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  required
                  className="w-4 h-4 mt-1 rounded border-gray-300 text-slate-800 focus:ring-violet-500"
                />
                <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-600">
                  J&apos;accepte les{' '}
                  <Link href="/terms" className="text-red-500 hover:text-red-600 font-medium">
                    conditions d&apos;utilisation
                  </Link>{' '}
                  et la{' '}
                  <Link href="/privacy" className="text-red-500 hover:text-red-600 font-medium">
                    politique de confidentialité
                  </Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(239,68,68,0.3)]"
              >
                {isLoading ? 'Création du compte...' : 'Créer mon compte'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Déjà un compte ?{' '}
                <Link href="/auth/login" className="text-red-500 hover:text-red-600 font-semibold transition-colors">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
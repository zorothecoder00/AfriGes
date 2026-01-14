'use client';  

import { useState, useEffect } from 'react'  
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
     
// Définition du type pour nos erreurs
type Errors = {
  email?: string
  password?: string
  general?: string   
}

export default function LoginPage() {  
  const router = useRouter();
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,  
  });
  const [showPassword, setShowPassword] = useState(false);
  const [infoMessage, setInfoMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({}) // ✅ Typage;

  useEffect(() => {
    if (!searchParams) return;

    const registered = searchParams.get('registered')
    const logout = searchParams.get('logout')

    if (registered === 'success') {
      setInfoMessage('✅ Compte créé avec succès. Veuillez vous connecter.')
    }

    if (logout === 'success') {
      setInfoMessage('✅ Déconnexion réussie.')
    }
  }, [searchParams])

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
    setErrors({}) // ✅ Clear previous errors

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,    
        password: formData.password,
      });

      if (result?.error) {
        setErrors({ general: 'Email ou mot de passe incorrect' })
      } 

      if(result?.ok){
        // Récupération session
        const sessionRes = await fetch('/api/auth/session')
        const sessionData = await sessionRes.json()

        const role = sessionData?.user?.role
        if(role === 'SUPER_ADMIN'){  
          router.push('/dashboard/admin') 
        }else if(role === 'ADMIN'){
          router.push('/dashboard/admin')
        }else if(role === 'USER'){
          router.push('/dashboard/user')
        }else{
          setErrors({ general: 'Rôle non autorisé' })
        }
      }
    } catch (error) {
      setErrors({ general:'Une erreur est survenue. Veuillez réessayer.' });
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'microsoft') => {
    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error(`${provider} login error:`, error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-600 to-purple-800 px-4 py-8 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:50px_50px] animate-[patternMove_20s_linear_infinite]" />
      </div>

      <div className="w-full max-w-sm md:max-w-md mx-auto relative z-10 animate-[slideUp_0.6s_ease-out]">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(44,62,80,0.25)] overflow-hidden transition-transform hover:-translate-y-1 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_20%,transparent_70%)] animate-pulse opacity-50" />
            <h1 className="text-4xl font-bold text-white mb-2 relative z-10 font-serif tracking-tight">
              Bienvenue
            </h1>
            <p className="text-white/85 text-sm relative z-10">
              Connectez-vous à votre compte
            </p>
          </div>

          {infoMessage && (
            <div className="text-green-600 text-sm text-center mb-4">
              {infoMessage}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-8 md:px-8 md:py-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {errors.general}
                </div>
              )}

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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
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
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 transition-all"
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

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="remember"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-violet-500"
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                    Se souvenir de moi
                  </label>
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(239,68,68,0.3)]"
              >
                {isLoading ? 'Connexion en cours...' : 'Se connecter'}
              </button>

              <div className="relative flex items-center my-6">
                <div className="flex-grow border-t border-gray-200" />
                <span className="px-4 text-sm text-gray-500">ou continuer avec</span>
                <div className="flex-grow border-t border-gray-200" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-slate-800 hover:bg-gray-50 hover:-translate-y-0.5 transition-all font-medium text-slate-800"
                >
                  <span>🔍</span> Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('microsoft')}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-slate-800 hover:bg-gray-50 hover:-translate-y-0.5 transition-all font-medium text-slate-800"
                >
                  <span>⊞</span> Microsoft
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Pas encore de compte ?{' '}
                <Link href="/auth/register" className="text-red-500 hover:text-red-600 font-semibold transition-colors">
                  S&apos;inscrire
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
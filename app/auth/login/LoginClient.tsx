'use client';  

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock as LockIcon } from 'lucide-react';
import AfriSimeLogo from '@/components/AfriSimeLogo'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

// Définition du type pour nos erreurs
type Errors = {
  email?: string
  password?: string
  general?: string
}

// Mapping des codes d'erreur (renvoyés par signIn ou via ?error= de NextAuth)
// vers des messages clairs — sans divulguer d'information sensible.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_SUSPENDED:    'Votre compte est suspendu. Veuillez contacter l’administrateur.',
  ACCOUNT_INACTIVE:     'Votre compte n’est pas actif. Veuillez contacter l’administrateur.',
  CredentialsSignin:    'Identifiants invalides. Vérifiez votre email et votre mot de passe.',
  AccessDenied:         'Accès refusé. Vous n’avez pas l’autorisation de vous connecter.',
  OAuthAccountNotLinked:'Cet email est déjà associé à un autre mode de connexion.',
  SessionRequired:      'Vous devez être connecté pour accéder à cette page.',
  GoogleNoAccount:      'Aucun compte AfriGes n’est associé à ce compte Google. Contactez l’administrateur.',
}

function messageErreurAuth(code: string | null | undefined): string {
  if (!code) return 'Une erreur est survenue. Veuillez réessayer.'
  return AUTH_ERROR_MESSAGES[code] ?? 'Identifiants invalides. Vérifiez votre email et votre mot de passe.'
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
  const [infoMessage, setInfoMessage] = useState<{ text: string; warn?: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({}) // ✅ Typage;

  useEffect(() => {
    if (!searchParams) return;

    const registered      = searchParams.get('registered')
    const logout          = searchParams.get('logout')
    const changed         = searchParams.get('changed')
    const sessionExpired  = searchParams.get('sessionExpired')
    const mustChange      = searchParams.get('mustChangePassword')
    const accessDenied    = searchParams.get('accessDenied')
    const error           = searchParams.get('error')

    // Erreur remontée par NextAuth (pages.error = /auth/login) lors d'un flux à
    // redirection (OAuth, accès refusé…) : on l'affiche au lieu de rester muet.
    if (error) {
      setErrors({ general: messageErreurAuth(error) })
      return
    }

    if (registered === 'success') {
      setInfoMessage({ text: 'Compte créé avec succès. Veuillez vous connecter.' })
    } else if (logout === 'success') {
      setInfoMessage({ text: 'Déconnexion réussie.' })
    } else if (changed === 'true') {
      setInfoMessage({ text: 'Mot de passe changé avec succès. Veuillez vous reconnecter.' })
    } else if (sessionExpired === 'true') {
      setInfoMessage({ text: 'Votre session a expiré ou a été révoquée. Veuillez vous reconnecter.', warn: true })
    } else if (mustChange === 'true') {
      setInfoMessage({ text: 'Vous devez changer votre mot de passe avant de continuer.', warn: true })
    } else if (accessDenied === 'true') {
      setInfoMessage({ text: 'Accès refusé : vous n’avez pas les droits nécessaires pour cette page.', warn: true })
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
        setErrors({ general: messageErreurAuth(result.error) })
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
    <div className="h-screen overflow-hidden flex items-center justify-center px-4 relative bg-gradient-to-br from-primary-600 via-primary-700 to-slate-900">

      {/* Halos décoratifs discrets */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary-300/20 blur-3xl" />
      <div className="absolute -bottom-16 left-[5%] w-56 h-56 rounded-full bg-primary-200/15 blur-3xl" />
      <div className="absolute top-[5%] -right-12 w-48 h-48 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="absolute bottom-[20%] right-[3%] w-36 h-36 rounded-full bg-primary-300/15 blur-3xl" />

      {/* Pattern points subtil */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[length:40px_40px]" />

      <div className="w-full max-w-sm md:max-w-md mx-auto relative z-10 animate-[slideUp_0.6s_ease-out]">

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-700 to-primary-600 px-8 py-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_20%,transparent_70%)] opacity-50" />
            <div className="relative z-10 mb-4 flex justify-center">
              <div className="bg-white rounded-2xl px-3 py-2 shadow-lg">
                <AfriSimeLogo className="h-10 w-auto md:h-12" priority />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1 relative z-10 tracking-tight">
              Bienvenue
            </h1>
            <p className="text-white/80 text-sm relative z-10">
              Connectez-vous à votre compte
            </p>
          </div>

          {infoMessage && (
            <div className={`text-sm text-center px-4 py-2 mt-4 mb-2 rounded-lg mx-4 ${infoMessage.warn ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {infoMessage.text}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-6 md:px-8 md:py-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {errors.general}
                </div>
              )}

              <Input
                type="email"
                id="email"
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleChange}
                placeholder="votre.email@exemple.com"
                required
                icon={<Mail size={16} />}
              />

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  label="Mot de passe"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  icon={<LockIcon size={16} />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="remember"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-slate-600">
                    Se souvenir de moi
                  </label>
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <Button type="submit" loading={isLoading} className="w-full" size="lg">
                {isLoading ? 'Connexion en cours...' : 'Se connecter'}
              </Button>

              <div className="relative flex items-center my-6">
                <div className="flex-grow border-t border-slate-200" />
                <span className="px-4 text-sm text-slate-500">ou continuer avec</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => handleSocialLogin('google')}
                className="w-full"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1-.34-2.1c0-.73.13-1.43.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
                  </svg>
                }
              >
                Continuer avec Google
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-500">
                Les comptes sont créés uniquement par l’administrateur.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
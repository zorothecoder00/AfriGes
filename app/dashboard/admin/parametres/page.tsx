import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import AccountSettings from "@/components/settings/AccountSettings";

export const metadata = { title: "Paramètres du compte — AfriGes" };

export default function AdminParametresPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" /> Paramètres du compte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez votre photo, vos coordonnées, votre email et votre mot de passe.
          </p>
        </div>
        <AccountSettings />
      </div>
    </div>
  );
}

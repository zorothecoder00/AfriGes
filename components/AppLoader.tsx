import SidebarLogo from "@/components/SidebarLogo";

/**
 * Écran de chargement plein écran aux couleurs AfriGes : logo qui « respire »
 * + barre de progression indéterminée + message court. Utilisé entre la
 * connexion et l'affichage du tableau de bord (login → aiguillage → dashboard).
 */
export default function AppLoader({ message = "Chargement…" }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 px-6 bg-gradient-to-br from-cream via-cream-100 to-brand-50"
    >
      <div className="rounded-3xl bg-white p-4 sm:p-5 animate-[logoBreath_2.4s_ease-in-out_infinite]">
        <SidebarLogo className="h-28 sm:h-36" priority />
      </div>
      <div className="w-48 sm:w-56 h-1.5 rounded-full bg-brand-100 overflow-hidden">
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-brand-500 to-primary-500 animate-[loaderBar_1.3s_ease-in-out_infinite]" />
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

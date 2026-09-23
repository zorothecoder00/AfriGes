import AppLoader from "@/components/AppLoader";

/** Écran affiché par Next pendant le chargement d'un segment /dashboard (ex. juste après la connexion). */
export default function DashboardLoading() {
  return <AppLoader message="Chargement de votre espace…" />;
}

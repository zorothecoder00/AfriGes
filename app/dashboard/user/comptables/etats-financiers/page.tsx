import { redirect } from "next/navigation";

// Index de la rubrique "États financiers" — pure barre d'onglets (layout.tsx),
// sans contenu propre. Redirige vers le premier onglet pour éviter le 404.
export default function EtatsFinanciersIndexPage() {
  redirect("/dashboard/user/comptables/etats-financiers/balance");
}

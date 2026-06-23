import SaisieRapideRemboursement from "@/components/SaisieRapideRemboursement";

export default function Page() {
  return (
    <SaisieRapideRemboursement
      apiBase="/api/caissier/credits/saisie-rapide"
      collecteursApi="/api/caissier/collecteurs"
      accent="emerald"
      noteConfirmation="Les encaissements sont confirmés immédiatement (comptoir)."
    />
  );
}

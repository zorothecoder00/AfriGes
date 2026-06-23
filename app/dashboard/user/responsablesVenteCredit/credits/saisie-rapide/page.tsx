import SaisieRapideRemboursement from "@/components/SaisieRapideRemboursement";

export default function Page() {
  return (
    <SaisieRapideRemboursement
      apiBase="/api/rvc/credits/saisie-rapide"
      collecteursApi="/api/rvc/collecteurs"
      accent="indigo"
      noteConfirmation="Les encaissements sont confirmés immédiatement."
      backHref="/dashboard/user/responsablesVenteCredit/credits"
    />
  );
}

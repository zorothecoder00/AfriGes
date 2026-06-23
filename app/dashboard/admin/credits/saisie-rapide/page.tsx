import SaisieRapideRemboursement from "@/components/SaisieRapideRemboursement";

export default function Page() {
  return (
    <SaisieRapideRemboursement
      apiBase="/api/admin/credits/saisie-rapide"
      collecteursApi="/api/admin/collecteurs"
      accent="blue"
      noteConfirmation="Les encaissements sont confirmés immédiatement."
    />
  );
}

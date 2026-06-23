import SaisieRapideRemboursement from "@/components/SaisieRapideRemboursement";

export default function Page() {
  return (
    <SaisieRapideRemboursement
      apiBase="/api/agentTerrain/credits/saisie-rapide"
      accent="emerald"
      noteConfirmation="Les encaissements partent en attente de confirmation du caissier."
    />
  );
}

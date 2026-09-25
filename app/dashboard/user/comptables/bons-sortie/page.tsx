import BonsSortieSupervision from "@/components/BonsSortieSupervision";

/** Bons de sortie en consultation pour le comptable (valorisation, comptabilisation) — cf. BonsSortieSupervision. */
export default function BonsSortieComptablePage() {
  return <BonsSortieSupervision apiUrl="/api/comptable/bons-sortie" perimetre="agences" peutViser={false} />;
}

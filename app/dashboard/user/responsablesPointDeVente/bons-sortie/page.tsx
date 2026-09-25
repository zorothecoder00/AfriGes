import BonsSortieSupervision from "@/components/BonsSortieSupervision";

/** Bons de sortie de l'agence du RPV (dont ceux des agents terrain) — cf. BonsSortieSupervision. */
export default function BonsSortieRPVPage() {
  return <BonsSortieSupervision apiUrl="/api/rpv/bons-sortie" perimetre="agence" />;
}

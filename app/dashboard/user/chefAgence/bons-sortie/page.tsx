import BonsSortieSupervision from "@/components/BonsSortieSupervision";

/** Bons de sortie des agences du chef d'agence (dont ceux des agents terrain) — cf. BonsSortieSupervision. */
export default function BonsSortieChefAgencePage() {
  return <BonsSortieSupervision apiUrl="/api/chef-agence/bons-sortie" perimetre="agences" />;
}

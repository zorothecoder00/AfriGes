"use client";

import { use } from "react";
import ReleveCompteFournisseur from "@/components/ReleveCompteFournisseur";

export default function ReleveFournisseurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReleveCompteFournisseur fournisseurId={id} apiBase="/api/logistique/fournisseurs" />;
}

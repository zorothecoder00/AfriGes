"use client";

import { use } from "react";
import ReleveCompteClient from "@/components/ReleveCompteClient";

export default function ReleveClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReleveCompteClient clientId={id} apiBase="/api/agentTerrain/clients" />;
}

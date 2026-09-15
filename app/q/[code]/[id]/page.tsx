// app/q/[code]/[id]/page.tsx
// Point d'entrée des QR "instance" (CDC digitalisation §4) : vérifie l'empreinte
// puis redirige vers l'écran back-office du document. Cette route n'est PAS dans
// le matcher de proxy.ts — l'authentification/rôle est appliquée par la redirection
// elle-même (vers /dashboard/... ou /api/... qui, eux, sont protégés).

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifierHashInstance, type CodeDocumentQr } from "@/lib/documentQr";

type Props = {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{ h?: string }>;
};

const CODES_VALIDES: CodeDocumentQr[] = ["BCF", "BSM", "BRF", "BCC", "FD"];

export default async function VerifierDocumentPage({ params, searchParams }: Props) {
  const { code, id } = await params;
  const { h } = await searchParams;
  const docId = Number(id);

  if (!CODES_VALIDES.includes(code as CodeDocumentQr) || !Number.isInteger(docId) || !h) {
    return <PageErreur message="QR code invalide." />;
  }

  const codeDoc = code as CodeDocumentQr;

  if (codeDoc === "BCF") {
    const bon = await prisma.bonCommande.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!bon || !verifierHashInstance("BCF", bon.id, bon.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de commande valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/logistiquesApprovisionnements/bons-commande?detail=${bon.id}`);
  }

  if (codeDoc === "BSM") {
    const bon = await prisma.bonSortie.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!bon || !verifierHashInstance("BSM", bon.id, bon.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de sortie valide (document falsifié ou introuvable)." />;
    }
    redirect(`/api/magasinier/bons-sortie/${bon.id}/pdf`);
  }

  if (codeDoc === "BRF") {
    const b = await prisma.bordereauRemiseFonds.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!b || !verifierHashInstance("BRF", b.id, b.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bordereau de remise de fonds valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/comptables/tresorerie/bordereaux-remise?detail=${b.id}`);
  }

  if (codeDoc === "BCC") {
    const c = await prisma.commandeClient.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!c || !verifierHashInstance("BCC", c.id, c.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de commande client valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/agentsTerrain/commandes-client?detail=${c.id}`);
  }

  if (codeDoc === "FD") {
    const f = await prisma.ficheDecaissement.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!f || !verifierHashInstance("FD", f.id, f.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucune fiche de décaissement valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/decaissements?detail=${f.id}`);
  }

  return <PageErreur message="QR code invalide." />;
}

function PageErreur({ message }: { message: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#334155" }}>{message}</p>
      </div>
    </div>
  );
}

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

const CODES_VALIDES: CodeDocumentQr[] = [
  "BCF", "BSM", "BRF", "BCC", "FD", "BR", "DEV", "PRO", "BP", "BL",
  "ASF", "ARC", "RRC", "AEC",
  "REV", "BCR", "BLR", "FRV",
  "TRN", "ARL",
  "REC", "RET", "BRM", "INC",
];

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

  if (codeDoc === "BR") {
    const r = await prisma.bonReception.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!r || !verifierHashInstance("BR", r.id, r.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de réception valide (document falsifié ou introuvable)." />;
    }
    redirect(`/api/bons-reception/${r.id}/pdf`);
  }

  if (codeDoc === "DEV" || codeDoc === "PRO") {
    const doc = await prisma.devisProforma.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!doc || !verifierHashInstance(codeDoc, doc.id, doc.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun devis/proforma valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/agentsTerrain/devis-proforma?detail=${doc.id}`);
  }

  if (codeDoc === "BP") {
    const bp = await prisma.bonPreparation.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!bp || !verifierHashInstance("BP", bp.id, bp.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de préparation valide (document falsifié ou introuvable)." />;
    }
    redirect(`/api/magasinier/bons-preparation/${bp.id}/pdf`);
  }

  if (codeDoc === "BL") {
    const bl = await prisma.bonLivraison.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!bl || !verifierHashInstance("BL", bl.id, bl.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de livraison valide (document falsifié ou introuvable)." />;
    }
    redirect(`/api/bons-livraison/${bl.id}/pdf`);
  }

  if (codeDoc === "ASF" || codeDoc === "RRC" || codeDoc === "AEC" || codeDoc === "ARC") {
    // Documents remis au client (quittance, reçu, avis, mise en demeure/visite) —
    // le QR renvoie vers le suivi public du crédit (sans compte), pas vers le
    // back-office interne.
    const c = await prisma.creditClient.findUnique({ where: { id: docId }, select: { id: true, reference: true, createdAt: true } });
    if (!c || !verifierHashInstance(codeDoc, c.id, c.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun document de crédit valide (document falsifié ou introuvable)." />;
    }
    redirect(`/suivi/${c.reference}`);
  }

  if (codeDoc === "REV") {
    const p = await prisma.profilRevendeur.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!p || !verifierHashInstance("REV", p.id, p.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun profil revendeur valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/admin/revendeurs?detail=${p.id}`);
  }

  if (codeDoc === "BCR") {
    const cmd = await prisma.commandeRevendeur.findUnique({ where: { id: docId }, select: { id: true, createdAt: true, revendeurId: true } });
    if (!cmd || !verifierHashInstance("BCR", cmd.id, cmd.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucune commande revendeur valide (document falsifié ou introuvable)." />;
    }
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId: cmd.revendeurId }, select: { id: true } });
    redirect(`/dashboard/admin/revendeurs?detail=${profil?.id ?? ""}`);
  }

  if (codeDoc === "BLR") {
    const bl = await prisma.bonLivraisonRevendeur.findUnique({ where: { id: docId }, select: { id: true, createdAt: true, commandeRevendeur: { select: { revendeurId: true } } } });
    if (!bl || !verifierHashInstance("BLR", bl.id, bl.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de livraison revendeur valide (document falsifié ou introuvable)." />;
    }
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId: bl.commandeRevendeur.revendeurId }, select: { id: true } });
    redirect(`/dashboard/admin/revendeurs?detail=${profil?.id ?? ""}`);
  }

  if (codeDoc === "FRV") {
    const f = await prisma.factureVente.findUnique({ where: { id: docId }, select: { id: true, createdAt: true, revendeurId: true } });
    if (!f || !verifierHashInstance("FRV", f.id, f.createdAt.toISOString(), h) || !f.revendeurId) {
      return <PageErreur message="Ce QR ne correspond à aucune facture revendeur valide (document falsifié ou introuvable)." />;
    }
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId: f.revendeurId }, select: { id: true } });
    redirect(`/dashboard/admin/revendeurs?detail=${profil?.id ?? ""}`);
  }

  if (codeDoc === "TRN") {
    const t = await prisma.tourneeLivraison.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!t || !verifierHashInstance("TRN", t.id, t.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucune tournée de livraison valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/logistiquesApprovisionnements/tournees?tournee=${t.id}`);
  }

  if (codeDoc === "ARL") {
    const a = await prisma.tourneeArret.findUnique({ where: { id: docId }, select: { id: true, createdAt: true, tourneeId: true } });
    if (!a || !verifierHashInstance("ARL", a.id, a.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun arrêt de tournée valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/logistiquesApprovisionnements/tournees?tournee=${a.tourneeId}`);
  }

  if (codeDoc === "REC") {
    const r = await prisma.reclamationClient.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!r || !verifierHashInstance("REC", r.id, r.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucune réclamation valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/admin/reclamations?detail=${r.id}`);
  }

  if (codeDoc === "RET") {
    const ret = await prisma.retourMarchandiseClient.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!ret || !verifierHashInstance("RET", ret.id, ret.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun retour marchandise valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/magasiniers/retours-client?detail=${ret.id}`);
  }

  if (codeDoc === "BRM") {
    const rp = await prisma.remplacementProduit.findUnique({ where: { id: docId }, select: { id: true, createdAt: true } });
    if (!rp || !verifierHashInstance("BRM", rp.id, rp.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun bon de remplacement valide (document falsifié ou introuvable)." />;
    }
    redirect(`/dashboard/user/magasiniers/remplacements?detail=${rp.id}`);
  }

  if (codeDoc === "INC") {
    const inc = await prisma.incidentCommercial.findUnique({ where: { id: docId }, select: { id: true, createdAt: true, reclamationId: true } });
    if (!inc || !verifierHashInstance("INC", inc.id, inc.createdAt.toISOString(), h)) {
      return <PageErreur message="Ce QR ne correspond à aucun rapport d'incident valide (document falsifié ou introuvable)." />;
    }
    redirect(inc.reclamationId ? `/dashboard/admin/reclamations?detail=${inc.reclamationId}` : `/dashboard/admin/reclamations`);
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

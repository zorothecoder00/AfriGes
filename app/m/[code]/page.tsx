// app/m/[code]/page.tsx
// Point d'entrée des QR « Modèle » (CDC digitalisation §4.2/§4.6) : un QR statique par type de
// document. Il ne contient AUCUNE donnée et ne donne aucun accès seul : il ouvre le formulaire
// vierge du document dans AfriGes, après authentification (l'identité et la zone de l'agent
// connecté pré-remplissent le formulaire). Hors session → connexion, puis reprise ici.
// Toute lecture est journalisée (qui, quand, où).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { QR_MODELES } from "@/lib/documentQr";

type Props = { params: Promise<{ code: string }> };

export default async function OuvrirModeleDocumentPage({ params }: Props) {
  const { code } = await params;
  const modele = QR_MODELES.find((m) => m.code === code.toUpperCase());
  if (!modele) return <PageErreur message="QR code invalide." />;

  const session = await getAuthSession();
  const h = await headers();

  // Journalisation de la lecture (qui : compte connecté ou anonyme ; où : IP + appareil).
  await prisma.auditLog
    .create({
      data: {
        userId: session ? Number(session.user.id) : null,
        action: "QR_MODELE_LU",
        entite: modele.code,
        details: { connecte: !!session },
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
        userAgent: h.get("user-agent"),
      },
    })
    .catch(() => { /* la journalisation ne doit jamais bloquer l'ouverture du formulaire */ });

  if (!session) redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/m/${modele.code}`)}`);
  redirect(modele.cible);
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

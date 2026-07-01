import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHDansPerimetre } from "@/lib/authRH";
import { htmlToPdf } from "@/lib/pdf";
import { genBulletinHtml, type BulletinData } from "@/lib/bulletinHtml";
import { sendBulletinPaieEmail } from "@/lib/email";

// Chromium nécessite le runtime Node ; génération PDF potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const MOIS = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/**
 * POST /api/admin/rh/paie/[id]/envoyer-bulletin
 * Génère le bulletin en PDF et l'envoie par email au collaborateur.
 * Accessible aux ADMIN/SUPER_ADMIN et RESPONSABLE_RH.
 *
 * Body optionnel : { email?: string } pour forcer un destinataire.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche = await prisma.fichePaie.findUnique({
      where: { id: Number(id) },
      include: {
        composants: true,
        profilRH: {
          select: {
            matricule: true, fonction: true, departement: true, dateEmbauche: true,
            emailProfessionnel: true,
            gestionnaire: {
              select: {
                member: { select: { nom: true, prenom: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    // Scoping PDV : un RESPONSABLE_RH ne peut envoyer que les fiches de son périmètre.
    if (!(await profilRHDansPerimetre(session, fiche.profilRHId))) {
      return NextResponse.json({ error: "Fiche hors de votre périmètre" }, { status: 403 });
    }

    // Destinataire : email fourni > email User réel > email professionnel
    const body = await req.json().catch(() => ({}));
    const membre = fiche.profilRH.gestionnaire.member;
    const destinataire: string | undefined =
      (typeof body?.email === "string" && body.email.trim()) ||
      membre.email ||
      fiche.profilRH.emailProfessionnel ||
      undefined;

    if (!destinataire) {
      return NextResponse.json(
        { error: "Aucune adresse email disponible pour ce collaborateur" },
        { status: 422 },
      );
    }

    const html = genBulletinHtml(fiche as unknown as BulletinData);
    const pdf = await htmlToPdf(html);
    const periodeLabel = `${MOIS[fiche.mois] ?? ""} ${fiche.annee}`.trim();
    const filename = `bulletin-${fiche.profilRH.matricule}-${fiche.mois}-${fiche.annee}.pdf`;

    const ok = await sendBulletinPaieEmail({
      to: destinataire,
      prenom: membre.prenom,
      nom: membre.nom,
      periodeLabel,
      netAPayer: `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(fiche.netAPayer) || 0))} FCFA`,
      pdf,
      filename,
    });

    if (!ok) {
      return NextResponse.json(
        { error: "L'envoi de l'email a échoué. Vérifiez la configuration email (EMAIL_ENABLED, RESEND_API_KEY)." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, message: `Bulletin envoyé à ${destinataire}.` });
  } catch (error) {
    console.error("POST /api/admin/rh/paie/[id]/envoyer-bulletin", error);
    return NextResponse.json({ error: "Erreur lors de l'envoi du bulletin" }, { status: 500 });
  }
}

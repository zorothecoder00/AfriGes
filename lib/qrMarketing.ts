import { prisma } from "@/lib/prisma";

/**
 * Codes QR marketing (CDC §43) — chaque scan est compté et redirige vers une
 * landing page (ou une URL de secours), pour tracer la source des prospects.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I (lisibilité)

function randomSuffix(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Génère un code QR court et unique (retry sur collision). */
export async function genererCodeQr(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `QR-${randomSuffix()}`;
    const existant = await prisma.qrCodeMarketing.findUnique({ where: { code }, select: { id: true } });
    if (!existant) return code;
  }
  throw new Error("Impossible de générer un code QR unique, réessayez");
}

/**
 * Résout la destination d'un code QR scanné et incrémente son compteur.
 * Renvoie null si le code est inconnu ou désactivé.
 */
export async function resoudreEtIncrementerScan(code: string): Promise<{ url: string } | null> {
  const qr = await prisma.qrCodeMarketing.findUnique({
    where: { code },
    select: {
      id: true, actif: true, destinationUrl: true,
      landingPage: { select: { slug: true, actif: true } },
    },
  });
  if (!qr || !qr.actif) return null;

  await prisma.qrCodeMarketing.update({ where: { id: qr.id }, data: { nbScans: { increment: 1 } } });

  if (qr.landingPage && qr.landingPage.actif) return { url: `/lp/${qr.landingPage.slug}?qr=${code}` };
  if (qr.destinationUrl) return { url: qr.destinationUrl };
  return null;
}

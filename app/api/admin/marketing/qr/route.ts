import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { genererCodeQr } from "@/lib/qrMarketing";

/**
 * Codes QR marketing (CDC §43).
 * GET  — liste des QR (avec nb de scans).
 * POST — crée un QR rattaché à une campagne/opération/événement/landing page.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const qrCodes = await prisma.qrCodeMarketing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        operationTerrain: { select: { id: true, zone: true } },
        evenement: { select: { id: true, nom: true } },
        landingPage: { select: { id: true, slug: true, titre: true } },
      },
    });

    return NextResponse.json({ data: qrCodes });
  } catch (e) {
    console.error("GET /api/admin/marketing/qr", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { campagneId, operationTerrainId, evenementId, landingPageId, destinationUrl } = body;

    if (!landingPageId && !destinationUrl) {
      return NextResponse.json({ error: "Une landing page ou une URL de destination est requise" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const code = await genererCodeQr();
    const qr = await prisma.$transaction(async (tx) => {
      const q = await tx.qrCodeMarketing.create({
        data: {
          code,
          campagneId: campagneId ? Number(campagneId) : null,
          operationTerrainId: operationTerrainId ? Number(operationTerrainId) : null,
          evenementId: evenementId ? Number(evenementId) : null,
          landingPageId: landingPageId ? Number(landingPageId) : null,
          destinationUrl: destinationUrl || null,
          creeParId: userId,
        },
      });
      await auditLog(tx, userId, "QR_MARKETING_CREE", "QrCodeMarketing", q.id);
      return q;
    });

    return NextResponse.json({ data: qr }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/qr", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

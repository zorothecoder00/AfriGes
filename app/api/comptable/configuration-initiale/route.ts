import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { chargerConfigurationInitiale, calculerEtapesConfiguration } from "@/lib/comptabilite/configurationInitiale";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/configuration-initiale
 * Assistant de configuration initiale (CDC §60) : config générale (pays/devise/
 * référentiel/type d'entité) + progression réelle des 8 étapes suivantes.
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [config, etapes] = await Promise.all([
      chargerConfigurationInitiale(prisma),
      calculerEtapesConfiguration(prisma),
    ]);

    return NextResponse.json({ data: { config, etapes } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/comptable/configuration-initiale
 * Body: { pays?, devise?, referentiel?, typeEntite? }
 */
export async function PATCH(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { pays, devise, referentiel, typeEntite } = body;

    await chargerConfigurationInitiale(prisma);
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.configurationComptableInitiale.update({
        where: { id: 1 },
        data: {
          ...(pays !== undefined && { pays }),
          ...(devise !== undefined && { devise }),
          ...(referentiel !== undefined && { referentiel }),
          ...(typeEntite !== undefined && { typeEntite }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_CONFIGURATION_INITIALE", "ConfigurationComptableInitiale", u.id, { pays, devise, referentiel, typeEntite }, meta);
      return u;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { MemberStatus, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { agentDepuisJetonScan, trouverOuCreerSessionDuJour } from "@/lib/collecteSession";
import { auditLog } from "@/lib/notifications";
import { genererCodeClient } from "@/lib/codeClient";

type Ctx = { params: Promise<{ token: string }> };

/**
 * POST /api/agent-scan/[token]/nouveau-client  (PUBLIC — jeton opaque en guise d'authentification)
 * Enregistre un nouveau client trouvé sur le terrain, depuis la page scannée,
 * sans connexion. Même création que POST /api/agentTerrain/clients, rattachée
 * en plus à la session du jour de l'agent.
 * Body: { nom, prenom, telephone, adresse?, quartier?, ville?, commune?, latitude?, longitude? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const agent = await agentDepuisJetonScan(token);
    if (!agent) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    const body = await req.json();
    const {
      nom, prenom, telephone,
      adresse, sexe, dateNaissance, telephoneSecondaire,
      quartier, ville, commune, numeroCNI,
      activite, nomCommerce,
      latitude, longitude,
    } = body;

    if (!nom || !prenom || !telephone) {
      return NextResponse.json({ error: "Champs obligatoires manquants (nom, prenom, telephone)" }, { status: 400 });
    }

    const existing = await prisma.client.findUnique({ where: { telephone } });
    if (existing) {
      return NextResponse.json({ error: "Ce numéro de téléphone est déjà utilisé" }, { status: 400 });
    }

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: agent.id, actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId ?? null;
    const agentNom = `${agent.prenom} ${agent.nom}`;
    const collecte = await trouverOuCreerSessionDuJour(agent.id);

    const client = await prisma.$transaction(async (tx) => {
      const codeClient = await genererCodeClient(tx);
      const created = await tx.client.create({
        data: {
          nom, prenom, telephone,
          codeClient,
          etat: MemberStatus.EN_ATTENTE_VALIDATION,
          adresse: adresse || null,
          sexe: sexe || null,
          dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
          telephoneSecondaire: telephoneSecondaire || null,
          quartier: quartier || null,
          ville: ville || null,
          commune: commune || null,
          numeroCNI: numeroCNI || null,
          activite: activite || null,
          nomCommerce: nomCommerce || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          pointDeVenteId: pdvId,
          agentTerrainId: agent.id,
        },
      });

      await auditLog(tx, agent.id, "CREATION_CLIENT_PROSPECTION_SCAN", "Client", created.id);

      await tx.ligneCollecte.create({
        data: {
          collecteId: collecte.id,
          clientId: created.id,
          type: "NOUVEAU_CLIENT",
          clientNouveauId: created.id,
          montantAttendu: 0,
          montantCollecte: 0,
          statut: "COLLECTE",
        },
      });

      if (pdvId) {
        const rvcsDuPdv = await tx.gestionnaireAffectation.findMany({
          where: {
            pointDeVenteId: pdvId,
            actif: true,
            user: { gestionnaire: { role: "RESPONSABLE_VENTE_CREDIT", actif: true } },
          },
          select: { userId: true },
        });
        if (rvcsDuPdv.length > 0) {
          await tx.notification.createMany({
            data: rvcsDuPdv.map(({ userId }) => ({
              userId,
              titre: "Nouveau client à valider",
              message: `L'agent ${agentNom} a enregistré le client ${prenom} ${nom} (${telephone}) via QR. En attente de validation RVC.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl: "/dashboard/user/responsablesVenteCredit",
            })),
            skipDuplicates: true,
          });
        }
      }

      return created;
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agent-scan/[token]/nouveau-client", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

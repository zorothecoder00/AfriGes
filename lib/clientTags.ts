// lib/clientTags.ts
// Ajout/retrait d'un tag sur un client — extrait de la route
// app/api/admin/clients/[id]/tags/route.ts pour être réutilisé sans duplication
// par le moteur d'automatisation marketing (actions AJOUTER_TAG/RETIRER_TAG).

import { prisma } from "@/lib/prisma";

export class ClientTagError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Attache un tag à un client (upsert silencieux si déjà associé). */
export async function ajouterTagClient(clientId: number, tagId: number): Promise<void> {
  const [client, tag] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, segment: true } }),
    prisma.tag.findUnique({ where: { id: tagId } }),
  ]);

  if (!client) throw new ClientTagError("Client introuvable", 404);
  if (!tag) throw new ClientTagError("Tag introuvable", 404);
  if (!tag.actif) throw new ClientTagError("Ce tag est inactif", 400);

  if (tag.segment && tag.segment !== client.segment) {
    throw new ClientTagError(
      `Ce tag est réservé aux clients "${tag.segment}". Ce client est "${client.segment}".`,
      400
    );
  }

  await prisma.clientTag.upsert({
    where: { clientId_tagId: { clientId, tagId } },
    update: {},
    create: { clientId, tagId },
  });
}

/** Détache un tag d'un client (silencieux si non associé). */
export async function retirerTagClient(clientId: number, tagId: number): Promise<void> {
  await prisma.clientTag.deleteMany({ where: { clientId, tagId } });
}

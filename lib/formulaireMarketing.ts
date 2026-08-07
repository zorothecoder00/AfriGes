import type { Prisma } from "@prisma/client";
import { genererCodeClient } from "@/lib/codeClient";
import type { TxClient } from "@/lib/compteCourant";

/**
 * Form builder marketing (CDC §45-46) — champs dynamiques ({cle,label,type,
 * requis}, cf. FormulaireMarketing.champs). Chaque soumission est convertie
 * en Client dès réception (§85 : pas de table "leads" dupliquant le CRM),
 * la source (campagne/canal/agence/QR/landing page/événement/opération) est
 * tracée sur la SoumissionFormulaire, pas sur le Client.
 */

export interface ChampFormulaire {
  cle: string;
  label: string;
  type: "text" | "tel" | "email" | "select";
  requis: boolean;
  options?: string[];
}

export interface SourceSoumission {
  campagneId?: number | null;
  canal?: string | null;
  pointDeVenteId?: number | null;
  qrCodeId?: number | null;
  landingPageId?: number | null;
  evenementId?: number | null;
  operationTerrainId?: number | null;
}

/**
 * Enregistre une soumission de formulaire : valide les champs requis,
 * crée (ou retrouve, si le téléphone existe déjà) le Client correspondant,
 * et trace la source de l'acquisition.
 */
export async function soumettreFormulaire(
  tx: TxClient,
  opts: { formulaireId: number; donnees: Record<string, unknown> } & SourceSoumission,
) {
  const formulaire = await tx.formulaireMarketing.findUnique({
    where: { id: opts.formulaireId },
    select: { id: true, actif: true, champs: true },
  });
  if (!formulaire) throw new Error("FORMULAIRE_INTROUVABLE");
  if (!formulaire.actif) throw new Error("FORMULAIRE_INACTIF");

  const champs = (formulaire.champs as unknown as ChampFormulaire[] | null) ?? [];
  for (const c of champs) {
    if (c.requis && !String(opts.donnees[c.cle] ?? "").trim()) throw new Error(`CHAMP_REQUIS:${c.label}`);
  }

  const telephone = String(opts.donnees.telephone ?? "").trim();
  if (!telephone) throw new Error("TELEPHONE_REQUIS");

  const nom = String(opts.donnees.nom ?? "").trim() || "Prospect";
  const prenom = String(opts.donnees.prenom ?? "").trim() || "—";
  const email = String(opts.donnees.email ?? "").trim() || null;
  const ville = String(opts.donnees.ville ?? "").trim() || null;

  const existant = await tx.client.findUnique({ where: { telephone }, select: { id: true } });
  const client = existant
    ? await tx.client.findUniqueOrThrow({ where: { id: existant.id } })
    : await tx.client.create({
        data: { nom, prenom, telephone, email, ville, codeClient: await genererCodeClient(tx), soldeActuel: 0 },
      });

  return tx.soumissionFormulaire.create({
    data: {
      formulaireId: opts.formulaireId,
      donnees: opts.donnees as Prisma.InputJsonValue,
      campagneId: opts.campagneId ?? null,
      canal: opts.canal ?? null,
      pointDeVenteId: opts.pointDeVenteId ?? null,
      qrCodeId: opts.qrCodeId ?? null,
      landingPageId: opts.landingPageId ?? null,
      evenementId: opts.evenementId ?? null,
      operationTerrainId: opts.operationTerrainId ?? null,
      clientIdCree: client.id,
    },
    include: { clientCree: { select: { id: true, nom: true, prenom: true } } },
  });
}

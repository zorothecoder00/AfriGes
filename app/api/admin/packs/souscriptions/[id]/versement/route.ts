import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — Enregistre un versement sur une souscription (côté admin).
 * Met à jour montantVerse, montantRestant et le statut de la souscription.
 *
 * Bug #5: Pour FAMILIAL, déclenche le bonus après cyclesBonusTrigger cycles complétés.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const souscriptionId = parseInt(id);
    const body = await req.json();
    const { montant, type, notes, echeanceId } = body;

    if (!montant || parseFloat(montant) <= 0) {
      return NextResponse.json({ error: "Montant obligatoire et > 0" }, { status: 400 });
    }

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: souscriptionId },
      include: { pack: true },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }
    if (souscription.statut === "ANNULE" || souscription.statut === "COMPLETE") {
      return NextResponse.json(
        { error: `Souscription déjà ${souscription.statut.toLowerCase()}` },
        { status: 400 }
      );
    }

    const montantNum = parseFloat(montant);
    const montantRestantActuel = Number(souscription.montantRestant);

    if (montantNum > montantRestantActuel) {
      return NextResponse.json(
        { error: `Montant trop élevé : le restant dû est de ${montantRestantActuel.toLocaleString("fr-FR")} FCFA` },
        { status: 400 }
      );
    }

    const adminNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const nouveauMontantVerse = Number(souscription.montantVerse) + montantNum;
      const nouveauMontantRestant = Number(souscription.montantTotal) - nouveauMontantVerse;
      const estSolde = nouveauMontantRestant <= 0;

      const versement = await tx.versementPack.create({
        data: {
          souscriptionId,
          type: type ?? "VERSEMENT_PERIODIQUE",
          montant: montantNum,
          statut: "PAYE",
          datePaiement: new Date(),
          encaisseParId: parseInt(session.user.id),
          encaisseParNom: adminNom,
          notes,
        },
      });

      // Bug #5: Pour FAMILIAL, incrémenter numeroCycle quand le cycle est complété
      const nouveauCycle =
        estSolde && souscription.pack.type === "FAMILIAL"
          ? souscription.numeroCycle + 1
          : souscription.numeroCycle;

      // Calcul du statut selon le type de pack et les seuils
      let nouveauStatut: string;
      if (estSolde) {
        nouveauStatut = "COMPLETE";
      } else if (
        souscription.pack.type === "REVENDEUR" &&
        souscription.formuleRevendeur === "FORMULE_1"
      ) {
        // F1 : ACTIF uniquement quand 50% du montant total versé
        const seuil50 = Number(souscription.montantTotal) * 0.5;
        nouveauStatut = nouveauMontantVerse >= seuil50 ? "ACTIF" : "EN_ATTENTE";
      } else if (
        souscription.pack.type === "URGENCE" &&
        souscription.pack.acomptePercent
      ) {
        // URGENCE : ACTIF quand l'acompte minimum est atteint
        const seuilAcompte =
          (Number(souscription.montantTotal) * Number(souscription.pack.acomptePercent)) / 100;
        nouveauStatut = nouveauMontantVerse >= seuilAcompte ? "ACTIF" : "EN_ATTENTE";
      } else {
        nouveauStatut = "ACTIF";
      }

      const updatedSouscription = await tx.souscriptionPack.update({
        where: { id: souscriptionId },
        data: {
          montantVerse: nouveauMontantVerse,
          montantRestant: estSolde ? 0 : nouveauMontantRestant,
          statut: nouveauStatut as never,
          dateCloture: estSolde ? new Date() : null,
          numeroCycle: nouveauCycle,
        },
      });

      // Marquer l'échéance si fournie ou auto-chercher la prochaine (EN_ATTENTE ou EN_RETARD)
      if (echeanceId) {
        await tx.echeancePack.update({
          where: { id: parseInt(echeanceId) },
          data: { statut: "PAYE", datePaiement: new Date() },
        });
      } else {
        const prochaine = await tx.echeancePack.findFirst({
          where: { souscriptionId, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { numero: "asc" },
        });
        if (prochaine) {
          await tx.echeancePack.update({
            where: { id: prochaine.id },
            data: { statut: "PAYE", datePaiement: new Date() },
          });
        }
      }

      if (estSolde) {
        await notifyAdmins(tx, {
          titre: `Pack soldé — ${souscription.pack.nom}`,
          message: `La souscription #${souscriptionId} au pack ${souscription.pack.nom} est entièrement soldée (${Number(souscription.montantTotal).toLocaleString("fr-FR")} FCFA).`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/admin/packs",
        });

        // Bug #5: FAMILIAL — vérifier déclenchement du bonus
        if (souscription.pack.type === "FAMILIAL") {
          const { cyclesBonusTrigger, bonusPourcentage } = souscription.pack;

          // nouveauCycle - 1 = nombre de cycles complétés
          // Ex: cyclesBonusTrigger=3 → bonus après 3 cycles complétés (nouveauCycle=4)
          if (
            cyclesBonusTrigger &&
            bonusPourcentage &&
            (nouveauCycle - 1) >= cyclesBonusTrigger &&
            !souscription.bonusObtenu
          ) {
            const bonusMontant = Math.round(
              (Number(souscription.montantTotal) * Number(bonusPourcentage)) / 100
            );

            await tx.versementPack.create({
              data: {
                souscriptionId,
                type: "BONUS",
                montant: bonusMontant,
                statut: "PAYE",
                datePaiement: new Date(),
                encaisseParId: parseInt(session.user.id),
                encaisseParNom: adminNom,
                notes: `Bonus ${bonusPourcentage}% — ${nouveauCycle} cycles complétés`,
              },
            });

            await tx.souscriptionPack.update({
              where: { id: souscriptionId },
              data: { bonusObtenu: true },
            });

            await notifyAdmins(tx, {
              titre: `🎁 Bonus FAMILIAL déclenché — ${souscription.pack.nom}`,
              message: `La souscription #${souscriptionId} a atteint ${nouveauCycle} cycles consécutifs. Bonus de ${bonusPourcentage}% accordé : ${bonusMontant.toLocaleString("fr-FR")} FCFA.`,
              priorite: "HAUTE",
              actionUrl: "/dashboard/admin/packs",
            });
          }
        }

        // Bug #9: EPARGNE_PRODUIT — auto-planifier la livraison du produit cible quand le seuil est atteint
        if (souscription.pack.type === "EPARGNE_PRODUIT" && souscription.pack.montantSeuil) {
          const seuilAtteint = nouveauMontantVerse >= Number(souscription.pack.montantSeuil);
          if (seuilAtteint && souscription.pack.produitCibleId) {
            const produitCible = await tx.produit.findUnique({
              where: { id: souscription.pack.produitCibleId },
              select: { id: true, prixUnitaire: true, nom: true },
            });
            if (produitCible) {
              await tx.receptionProduitPack.create({
                data: {
                  souscriptionId,
                  statut: "PLANIFIEE",
                  datePrevisionnelle: new Date(),
                  livreurNom: adminNom,
                  notes: `Livraison auto — seuil d'épargne atteint (${Number(souscription.pack.montantSeuil).toLocaleString("fr-FR")} FCFA)`,
                  lignes: {
                    create: [{ produitId: produitCible.id, quantite: 1, prixUnitaire: produitCible.prixUnitaire }],
                  },
                },
              });
            }
          }
          if (seuilAtteint) {
            await notifyAdmins(tx, {
              titre: `Seuil atteint — ${souscription.pack.nom}`,
              message: `La souscription #${souscriptionId} a atteint le seuil d'épargne (${Number(souscription.pack.montantSeuil).toLocaleString("fr-FR")} FCFA). Une livraison a été planifiée automatiquement.`,
              priorite: "HAUTE",
              actionUrl: "/dashboard/admin/packs",
            });
          }
        }
      }

      return { versement, souscription: updatedSouscription };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/packs/souscriptions/[id]/versement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

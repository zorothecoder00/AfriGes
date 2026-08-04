import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererReferenceEcriture, periodeClôturée } from "@/lib/comptabilite/moteur";
import { detecterDoublonPotentiel } from "@/lib/comptabilite/detectionDoublons";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const skip    = (page - 1) * limit;
    const journal = searchParams.get("journal");
    const statut  = searchParams.get("statut");
    const search  = ( searchParams.get("search") || "" ).trim();
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(journal && { journal }),
      ...(statut  && { statut }),
      ...(search  && {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { libelle:   { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(dateMin || dateMax
        ? {
            date: {
              ...(dateMin && { gte: new Date(dateMin) }),
              ...(dateMax && { lte: new Date(dateMax + "T23:59:59") }),
            },
          }
        : {}),
    };

    const [ecritures, total] = await Promise.all([
      prisma.ecritureComptable.findMany({
        where,
        include: {
          lignes: {
            include: {
              compte: {
                select: {
                  id: true, numero: true, libelle: true, type: true,
                  tiersType: true, tiersNom: true,
                  client: { select: { nom: true, prenom: true } },
                  fournisseur: { select: { nom: true } },
                },
              },
            },
            orderBy: { id: "asc" },
          },
          user: { select: { id: true, nom: true, prenom: true } },
          validePar: { select: { id: true, nom: true, prenom: true } },
          controlePar: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.ecritureComptable.count({ where }),
    ]);

    // Totaux débit/crédit pour info
    const totaux = await prisma.ligneEcriture.aggregate({
      where: { ecriture: where },
      _sum: { debit: true, credit: true },
    });

    return NextResponse.json({
      data: ecritures,
      totaux: {
        debit:  totaux._sum.debit  ?? 0,
        credit: totaux._sum.credit ?? 0,
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { date, libelle, journal, notes, lignes, devise, tauxChange, derogationJustification, confirmerDoublon } = body;

    // Validations de base
    if (!date || !libelle || !journal) {
      return NextResponse.json({ error: "date, libelle et journal sont obligatoires" }, { status: 400 });
    }

    // CDC §29/§31 — période fermée : interdit sauf "autorisation spéciale"
    // (ADMIN/SUPER_ADMIN uniquement, justification obligatoire, tracée dans
    // les notes de l'écriture). Avant ce contrôle, cette route ne vérifiait
    // JAMAIS la clôture mensuelle (contrairement à creerEcriture côté flux
    // automatiques) — n'importe quel comptable pouvait saisir sur un mois clos.
    const dateEcriture = new Date(date);
    if (await periodeClôturée(prisma, dateEcriture)) {
      const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
      const justification = typeof derogationJustification === "string" ? derogationJustification.trim() : "";
      if (!isAdmin || !justification) {
        return NextResponse.json({
          error: isAdmin
            ? "Période fermée — une justification est obligatoire pour déroger (autorisation spéciale)"
            : "Période fermée — seul un administrateur peut déroger avec justification (autorisation spéciale)",
        }, { status: 403 });
      }
    }
    if (!Array.isArray(lignes) || lignes.length < 2) {
      return NextResponse.json({ error: "Une écriture nécessite au moins 2 lignes" }, { status: 400 });
    }

    // Validation équilibre débit = crédit
    let totalDebit  = 0;
    let totalCredit = 0;
    for (const l of lignes) {
      if (!l.compteId) return NextResponse.json({ error: "Chaque ligne doit avoir un compteId" }, { status: 400 });
      const d = Number(l.debit  || 0);
      const c = Number(l.credit || 0);
      if (d < 0 || c < 0) return NextResponse.json({ error: "Les montants ne peuvent pas être négatifs" }, { status: 400 });
      if (d > 0 && c > 0) return NextResponse.json({ error: "Une ligne ne peut pas avoir débit ET crédit non nuls simultanément" }, { status: 400 });
      totalDebit  += d;
      totalCredit += c;
    }

    // Tolérance d'arrondi 0.01
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({
        error: `L'écriture n'est pas équilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`,
      }, { status: 400 });
    }

    // CDC §42 — détection de doublons potentiels avant validation : journal +
    // date + montant + recoupement référence/libellé. Non bloquant en soi —
    // l'utilisateur doit explicitement confirmer (`confirmerDoublon: true`)
    // pour passer outre, comme pour la dérogation période fermée ci-dessus.
    if (!confirmerDoublon) {
      const doublons = await detecterDoublonPotentiel(prisma, {
        journal, date: dateEcriture, montant: totalDebit, reference: body.reference, libelle,
      });
      if (doublons.length > 0) {
        return NextResponse.json({
          error: "DOUBLON_POTENTIEL",
          message: `Une écriture similaire existe déjà (${doublons.map((d) => d.reference).join(", ")}) — confirmez pour créer quand même.`,
          doublons,
        }, { status: 409 });
      }
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const ecriture = await prisma.$transaction(async (tx) => {
      const reference = await genererReferenceEcriture(tx, journal);
      const e = await tx.ecritureComptable.create({
        data: {
          reference,
          date:    new Date(date),
          libelle,
          journal,
          notes:   derogationJustification?.trim()
            ? `[Dérogation période fermée — CDC §29] ${derogationJustification.trim()}${notes ? ` — ${notes}` : ""}`
            : (notes || null),
          statut:  "BROUILLON" as import("@prisma/client").StatutEcriture,
          userId,
          devise:  devise || "XOF",
          tauxChange: tauxChange != null ? Number(tauxChange) : 1,
          lignes: {
            create: lignes.map((l: {
              compteId: number;
              libelle?: string;
              debit?: number;
              credit?: number;
              isTva?: boolean;
              tauxTva?: number;
              montantTva?: number;
              pointDeVenteId?: number;
            }) => ({
              compteId:   Number(l.compteId),
              libelle:    l.libelle || libelle,
              debit:      Number(l.debit  || 0),
              credit:     Number(l.credit || 0),
              isTva:      Boolean(l.isTva),
              tauxTva:    l.tauxTva    != null ? Number(l.tauxTva)    : null,
              montantTva: l.montantTva != null ? Number(l.montantTva) : null,
              // CDC §48 — imputation multi-PDV disponible en saisie manuelle.
              pointDeVenteId: l.pointDeVenteId != null ? Number(l.pointDeVenteId) : null,
            })),
          },
        },
        include: {
          lignes: {
            include: { compte: { select: { id: true, numero: true, libelle: true } } },
          },
        },
      });
      await auditLog(tx, userId, "CREATION_ECRITURE", "EcritureComptable", e.id, { reference: e.reference, libelle: e.libelle, journal: e.journal }, meta);
      if (derogationJustification?.trim()) {
        await auditLog(tx, userId, "DEROGATION_PERIODE_FERMEE", "EcritureComptable", e.id, { reference: e.reference, justification: derogationJustification.trim() }, meta);
      }
      if (confirmerDoublon) {
        await auditLog(tx, userId, "DOUBLON_CONFIRME", "EcritureComptable", e.id, { reference: e.reference }, meta);
      }
      return e;
    });

    return NextResponse.json({ data: ecriture }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

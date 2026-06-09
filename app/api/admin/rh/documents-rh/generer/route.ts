import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeDocumentRHGenere } from "@prisma/client";

// ── Templates de génération ────────────────────────────────────────────────────

function formatDateFr(date: Date | null | undefined): string {
  if (!date) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function genAttestation(data: CollabData): string {
  const { prenom, nom, matricule, fonction, departement, typeContrat, dateEmbauche, emailPro, aujourd } = data;
  return `
<div style="font-family: 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px;">
  <div style="text-align: center; margin-bottom: 40px;">
    <p style="font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 2px;">AfriGes — Direction des Ressources Humaines</p>
    <h1 style="font-size: 22px; font-weight: bold; text-transform: uppercase; margin: 10px 0;">Attestation de Travail</h1>
    <div style="width: 60px; height: 3px; background: #1a1a1a; margin: 0 auto;"></div>
  </div>
  <p style="line-height: 1.8; text-align: justify;">
    Je soussigné(e), la Direction des Ressources Humaines de la société <strong>AfriGes</strong>,
    atteste par la présente que :
  </p>
  <div style="margin: 24px 0; padding: 20px 28px; background: #f8f8f8; border-left: 4px solid #1a1a1a;">
    <p style="margin: 4px 0;"><strong>Nom et Prénom :</strong> ${prenom} ${nom}</p>
    <p style="margin: 4px 0;"><strong>Matricule :</strong> ${matricule}</p>
    ${fonction ? `<p style="margin: 4px 0;"><strong>Fonction :</strong> ${fonction}</p>` : ""}
    ${departement ? `<p style="margin: 4px 0;"><strong>Département :</strong> ${departement}</p>` : ""}
    ${typeContrat ? `<p style="margin: 4px 0;"><strong>Type de contrat :</strong> ${typeContrat}</p>` : ""}
    ${emailPro ? `<p style="margin: 4px 0;"><strong>Email professionnel :</strong> ${emailPro}</p>` : ""}
  </div>
  <p style="line-height: 1.8; text-align: justify;">
    est employé(e) au sein de notre société${dateEmbauche ? ` depuis le <strong>${formatDateFr(dateEmbauche)}</strong>` : ""},
    et exerce ses fonctions avec sérieux et compétence.
  </p>
  <p style="line-height: 1.8; text-align: justify; margin-top: 12px;">
    La présente attestation est délivrée à la demande de l'intéressé(e)
    pour faire valoir ce que de droit.
  </p>
  <div style="margin-top: 48px; text-align: right;">
    <p style="margin: 0;">Fait le <strong>${formatDateFr(aujourd)}</strong></p>
    <div style="margin-top: 60px;">
      <p style="font-weight: bold; text-transform: uppercase; margin: 0;">La Direction RH</p>
      <p style="font-size: 12px; color: #555;">AfriGes</p>
    </div>
  </div>
  <hr style="margin-top: 48px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 11px; color: #999; text-align: center;">
    Document généré automatiquement · Réf. ${matricule}-ATT-${new Date().getFullYear()}
  </p>
</div>`.trim();
}

function genCertificatPresence(data: CollabData): string {
  const { prenom, nom, matricule, fonction, departement, dateEmbauche, aujourd } = data;
  return `
<div style="font-family: 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px;">
  <div style="text-align: center; margin-bottom: 40px;">
    <p style="font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 2px;">AfriGes — Direction des Ressources Humaines</p>
    <h1 style="font-size: 22px; font-weight: bold; text-transform: uppercase; margin: 10px 0;">Certificat de Présence</h1>
    <div style="width: 60px; height: 3px; background: #1a1a1a; margin: 0 auto;"></div>
  </div>
  <p style="line-height: 1.8; text-align: justify;">
    La Direction des Ressources Humaines de la société <strong>AfriGes</strong>
    certifie que :
  </p>
  <div style="margin: 24px 0; padding: 20px 28px; background: #f8f8f8; border-left: 4px solid #1a1a1a;">
    <p style="margin: 4px 0;"><strong>Nom et Prénom :</strong> ${prenom} ${nom}</p>
    <p style="margin: 4px 0;"><strong>Matricule :</strong> ${matricule}</p>
    ${fonction ? `<p style="margin: 4px 0;"><strong>Poste :</strong> ${fonction}</p>` : ""}
    ${departement ? `<p style="margin: 4px 0;"><strong>Département :</strong> ${departement}</p>` : ""}
  </div>
  <p style="line-height: 1.8; text-align: justify;">
    ${dateEmbauche
      ? `est présent(e) dans nos effectifs depuis le <strong>${formatDateFr(dateEmbauche)}</strong> et occupe actuellement son poste à temps plein.`
      : "est présent(e) dans nos effectifs et occupe actuellement son poste à temps plein."}
  </p>
  <p style="line-height: 1.8; text-align: justify; margin-top: 12px;">
    Ce certificat est établi à la demande de l'intéressé(e) pour servir et valoir ce que de droit.
  </p>
  <div style="margin-top: 48px; text-align: right;">
    <p style="margin: 0;">Fait le <strong>${formatDateFr(aujourd)}</strong></p>
    <div style="margin-top: 60px;">
      <p style="font-weight: bold; text-transform: uppercase; margin: 0;">La Direction RH</p>
      <p style="font-size: 12px; color: #555;">AfriGes</p>
    </div>
  </div>
  <hr style="margin-top: 48px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 11px; color: #999; text-align: center;">
    Document généré automatiquement · Réf. ${matricule}-CERT-${new Date().getFullYear()}
  </p>
</div>`.trim();
}

function genDecisionAffectation(data: CollabData): string {
  const { prenom, nom, matricule, fonction, departement, service, niveauHierarchique, today, aujourd } = data;
  return `
<div style="font-family: 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px;">
  <div style="text-align: center; margin-bottom: 40px;">
    <p style="font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 2px;">AfriGes — Direction des Ressources Humaines</p>
    <h1 style="font-size: 22px; font-weight: bold; text-transform: uppercase; margin: 10px 0;">Décision d'Affectation</h1>
    <p style="font-size: 13px; color: #555;">N° ${matricule}-AFF-${new Date().getFullYear()}</p>
    <div style="width: 60px; height: 3px; background: #1a1a1a; margin: 8px auto 0;"></div>
  </div>
  <p style="line-height: 1.8;">
    La Direction Générale de la société <strong>AfriGes</strong>,
  </p>
  <p style="line-height: 1.8; font-weight: bold; text-transform: uppercase; margin: 0 0 16px;">
    DÉCIDE :
  </p>
  <p style="line-height: 1.8; text-align: justify;">
    <strong>Article 1 :</strong> Monsieur / Madame <strong>${prenom} ${nom}</strong>,
    Matricule <strong>${matricule}</strong>, est affecté(e)
    ${fonction ? `au poste de <strong>${fonction}</strong>` : "au poste défini ci-dessus"}
    ${departement ? ` au sein du département <strong>${departement}</strong>` : ""}
    ${service ? ` — service <strong>${service}</strong>` : ""}.
  </p>
  ${niveauHierarchique ? `<p style="line-height: 1.8;"><strong>Article 2 :</strong> La classification hiérarchique est fixée au niveau <strong>${niveauHierarchique}</strong>.</p>` : ""}
  <p style="line-height: 1.8;">
    <strong>Article ${niveauHierarchique ? "3" : "2"} :</strong>
    La présente décision prend effet à compter du <strong>${formatDateFr(today)}</strong>.
  </p>
  <div style="margin-top: 48px; display: flex; justify-content: space-between;">
    <div>
      <p style="margin: 0; font-weight: bold;">L'Intéressé(e)</p>
      <p style="font-size: 12px; color: #555; margin-top: 4px;">(Lu et approuvé)</p>
      <div style="margin-top: 50px; border-top: 1px solid #aaa; width: 160px;"></div>
      <p style="margin-top: 4px; font-size: 12px;">${prenom} ${nom}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0;">Fait le <strong>${formatDateFr(aujourd)}</strong></p>
      <div style="margin-top: 50px;">
        <p style="font-weight: bold; text-transform: uppercase; margin: 0;">La Direction Générale</p>
        <p style="font-size: 12px; color: #555;">AfriGes</p>
      </div>
    </div>
  </div>
  <hr style="margin-top: 48px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 11px; color: #999; text-align: center;">
    Document officiel · Confidentiel · Réf. ${matricule}-AFF-${new Date().getFullYear()}
  </p>
</div>`.trim();
}

function genLettreMission(data: CollabData & { destination?: string; dateDebutMission?: string; dateFinMission?: string; objet?: string }): string {
  const { prenom, nom, matricule, fonction, departement, aujourd, destination, dateDebutMission, dateFinMission, objet } = data;
  return `
<div style="font-family: 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 40px;">
  <div style="text-align: center; margin-bottom: 40px;">
    <p style="font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 2px;">AfriGes — Direction des Ressources Humaines</p>
    <h1 style="font-size: 22px; font-weight: bold; text-transform: uppercase; margin: 10px 0;">Lettre de Mission</h1>
    <div style="width: 60px; height: 3px; background: #1a1a1a; margin: 0 auto;"></div>
  </div>
  <div style="margin-bottom: 24px;">
    <p style="margin: 2px 0;"><strong>À :</strong> ${prenom} ${nom} (${matricule})</p>
    ${fonction ? `<p style="margin: 2px 0;"><strong>Fonction :</strong> ${fonction}</p>` : ""}
    ${departement ? `<p style="margin: 2px 0;"><strong>Département :</strong> ${departement}</p>` : ""}
    <p style="margin: 8px 0 2px;"><strong>Date :</strong> ${formatDateFr(aujourd)}</p>
    ${objet ? `<p style="margin: 2px 0;"><strong>Objet :</strong> ${objet}</p>` : ""}
  </div>
  <p style="line-height: 1.8;">Monsieur / Madame,</p>
  <p style="line-height: 1.8; text-align: justify;">
    Vous êtes missionné(e) par la Direction Générale d'<strong>AfriGes</strong>
    ${destination ? `à <strong>${destination}</strong>` : "dans le cadre de vos fonctions"}
    ${dateDebutMission ? ` du <strong>${dateDebutMission}</strong>` : ""}
    ${dateFinMission ? ` au <strong>${dateFinMission}</strong>` : ""}.
  </p>
  ${objet ? `<p style="line-height: 1.8; text-align: justify;">L'objet de cette mission est : <em>${objet}</em>.</p>` : ""}
  <p style="line-height: 1.8; text-align: justify;">
    Vous êtes autorisé(e) à engager les dépenses strictement nécessaires à l'accomplissement de cette mission,
    sous réserve de produire les justificatifs correspondants à votre retour.
  </p>
  <p style="line-height: 1.8; text-align: justify;">
    Nous vous demandons de rédiger un rapport de mission dans les cinq (5) jours ouvrables suivant votre retour.
  </p>
  <p style="line-height: 1.8; margin-top: 16px;">Veuillez agréer, Monsieur/Madame, l'expression de notre considération distinguée.</p>
  <div style="margin-top: 48px; text-align: right;">
    <p style="margin: 0;">Fait le <strong>${formatDateFr(aujourd)}</strong></p>
    <div style="margin-top: 60px;">
      <p style="font-weight: bold; text-transform: uppercase; margin: 0;">La Direction Générale</p>
      <p style="font-size: 12px; color: #555;">AfriGes</p>
    </div>
  </div>
  <hr style="margin-top: 48px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 11px; color: #999; text-align: center;">
    Document officiel · Réf. ${matricule}-MISS-${new Date().getFullYear()}
  </p>
</div>`.trim();
}

// ── Types internes ─────────────────────────────────────────────────────────────

interface CollabData {
  prenom: string;
  nom: string;
  matricule: string;
  fonction?: string | null;
  departement?: string | null;
  service?: string | null;
  niveauHierarchique?: string | null;
  typeContrat?: string | null;
  dateEmbauche?: Date | null;
  emailPro?: string | null;
  today: Date;
  aujourd: Date;
  destination?: string;
  dateDebutMission?: string;
  dateFinMission?: string;
  objet?: string;
}

// ── Route ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/rh/documents-rh/generer
 * Body: { profilRHId, type, notes?, destination?, dateDebutMission?, dateFinMission?, objet? }
 * Génère le contenu HTML du document à partir des données du collaborateur.
 * Incrémente automatiquement le numéro de version.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, notes, destination, dateDebutMission, dateFinMission, objet } = body;

    if (!profilRHId || !type) {
      return NextResponse.json({ error: "profilRHId et type sont obligatoires" }, { status: 400 });
    }

    // Récupérer les données complètes du collaborateur
    const profil = await prisma.profilRH.findUnique({
      where: { id: Number(profilRHId) },
      include: {
        gestionnaire: {
          select: { member: { select: { nom: true, prenom: true } } },
        },
      },
    });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const prenom = profil.gestionnaire.member.prenom;
    const nom    = profil.gestionnaire.member.nom;
    const today  = new Date();

    const collabData: CollabData = {
      prenom,
      nom,
      matricule:          profil.matricule,
      fonction:           profil.fonction,
      departement:        profil.departement,
      service:            profil.service,
      niveauHierarchique: profil.niveauHierarchique,
      typeContrat:        profil.typeContrat,
      dateEmbauche:       profil.dateEmbauche,
      emailPro:           profil.emailProfessionnel,
      today,
      aujourd:            today,
      destination,
      dateDebutMission,
      dateFinMission,
      objet,
    };

    // Générer le contenu selon le type
    let contenu: string;
    switch (type as TypeDocumentRHGenere) {
      case "ATTESTATION_TRAVAIL":  contenu = genAttestation(collabData);           break;
      case "CERTIFICAT_PRESENCE":  contenu = genCertificatPresence(collabData);    break;
      case "DECISION_AFFECTATION": contenu = genDecisionAffectation(collabData);   break;
      case "LETTRE_MISSION":       contenu = genLettreMission(collabData);         break;
      default:
        return NextResponse.json({ error: "Type non supporté pour la génération automatique" }, { status: 400 });
    }

    const typeConfig: Record<string, string> = {
      ATTESTATION_TRAVAIL:  "Attestation de travail",
      CERTIFICAT_PRESENCE:  "Certificat de présence",
      DECISION_AFFECTATION: "Décision d'affectation",
      LETTRE_MISSION:       "Lettre de mission",
    };
    const titre = `${typeConfig[type]} — ${prenom} ${nom}`;

    // Versionning
    const lastDoc = await prisma.documentRHGenere.findFirst({
      where:   { profilRHId: Number(profilRHId), type: type as TypeDocumentRHGenere },
      orderBy: { version: "desc" },
      select:  { version: true },
    });
    const version = (lastDoc?.version ?? 0) + 1;

    const doc = await prisma.documentRHGenere.create({
      data: {
        profilRHId: Number(profilRHId),
        type:       type as TypeDocumentRHGenere,
        titre,
        version,
        contenu,
        generePar:  parseInt(session.user.id),
        notes:      notes ?? null,
        archive:    false,
      },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DocumentRHGenere",
        entiteId: doc.id,
        details:  `Génération automatique ${type} v${version} pour ${prenom} ${nom} (${profil.matricule})`,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/documents-rh/generer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { StatutFinancementRIA } from "@prisma/client";

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

// ── Shared HTML helpers ────────────────────────────────────────────────────────

const STYLES = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
  .doc { max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #059669; padding-bottom: 20px; }
  .logo { font-size: 22px; font-weight: 800; color: #059669; letter-spacing: -0.5px; }
  .logo span { color: #1e293b; }
  .header-right { text-align: right; font-size: 10px; color: #64748b; }
  .doc-title { font-size: 18px; font-weight: 700; color: #059669; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .doc-ref { font-size: 11px; color: #64748b; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #059669; border-bottom: 1px solid #d1fae5; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 0.5px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .info-row { display: flex; gap: 8px; }
  .info-label { font-weight: 600; color: #475569; min-width: 140px; }
  .info-value { color: #1e293b; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #f0fdf4; color: #065f46; font-weight: 700; text-align: left; padding: 7px 10px; border-bottom: 2px solid #a7f3d0; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 700; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .badge-warn { background: #fef9c3; color: #854d0e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-label { font-size: 9px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
  .kpi-value { font-size: 15px; font-weight: 700; color: #059669; }
  .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  .terms { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 10px; color: #475569; line-height: 1.6; }
  .signature-zone { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b; }
  .sig-title { font-weight: 600; color: #1e293b; margin-bottom: 20px; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  .progress-bar { background: #e2e8f0; border-radius: 999px; height: 6px; margin-top: 4px; }
  .progress-fill { background: #059669; border-radius: 999px; height: 6px; }
  .total-row td { font-weight: 700; background: #f0fdf4 !important; border-top: 2px solid #a7f3d0; }
  .text-green { color: #059669; font-weight: 600; }
  .text-red { color: #dc2626; font-weight: 600; }
  .text-blue { color: #2563eb; font-weight: 600; }
</style>`;

function header(docTitle: string, ref: string, investisseur: string) {
  return `
  <div class="header">
    <div>
      <div class="logo">Afri<span>Ges</span> <span style="font-size:12px;color:#64748b;font-weight:400">— Réseau des Investisseurs AfriSime</span></div>
      <div style="margin-top:12px;">
        <div class="doc-title">${docTitle}</div>
        <div class="doc-ref">Réf : ${ref} · Généré le ${fmtDate(new Date())}</div>
      </div>
    </div>
    <div class="header-right">
      <div style="font-weight:600;color:#1e293b;">${investisseur}</div>
      <div style="margin-top:4px;">AfriSime / RIA</div>
      <div>contact@afrisime.com</div>
    </div>
  </div>`;
}

function footer(type: string) {
  return `
  <div class="footer">
    <span>Document généré automatiquement par AfriGes — RIA</span>
    <span>${type} · ${new Date().toLocaleString("fr-FR")}</span>
    <span>Page 1/1</span>
  </div>`;
}

// ── Document generators ────────────────────────────────────────────────────────

async function genContratInvestisseur(investisseurId: number, genereParId: number) {
  const inv = await prisma.profilInvestisseurRIA.findUnique({
    where: { id: investisseurId },
    include: {
      gestionnaire: { include: { member: { select: { nom: true, prenom: true, email: true, telephone: true } } } },
      portefeuilles: { where: { actif: true }, select: { id: true, reference: true, nom: true, capitalInvesti: true } },
    },
  });
  if (!inv) throw new Error("Investisseur introuvable");
  const m = inv.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const totalCapital = inv.portefeuilles.reduce((s, p) => s + Number(p.capitalInvesti), 0);

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Contrat d'Investissement", `CONT-${String(investisseurId).padStart(5,"0")}`, nom)}
  <div class="section">
    <div class="section-title">Parties Contractantes</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Nom complet :</span><span class="info-value">${nom}</span></div>
        <div class="info-row"><span class="info-label">N° Investisseur :</span><span class="info-value">${inv.numero ?? "À attribuer"}</span></div>
        <div class="info-row"><span class="info-label">Email :</span><span class="info-value">${m?.email ?? "—"}</span></div>
        <div class="info-row"><span class="info-label">Téléphone :</span><span class="info-value">${m?.telephone ?? "—"}</span></div>
        <div class="info-row"><span class="info-label">Profession :</span><span class="info-value">${inv.profession ?? "—"}</span></div>
        <div class="info-row"><span class="info-label">Pays :</span><span class="info-value">${inv.pays ?? "—"}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Organisme :</span><span class="info-value">AfriSime / Réseau RIA</span></div>
        <div class="info-row"><span class="info-label">Date du contrat :</span><span class="info-value">${fmtDate(new Date())}</span></div>
        <div class="info-row"><span class="info-label">Capital total investi :</span><span class="info-value text-green">${fmt(totalCapital)}</span></div>
        <div class="info-row"><span class="info-label">Nb portefeuilles actifs :</span><span class="info-value">${inv.portefeuilles.length}</span></div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Portefeuilles d'Investissement</div>
    <table><thead><tr><th>Référence</th><th>Nom</th><th class="right">Capital investi</th></tr></thead>
    <tbody>
      ${inv.portefeuilles.map((p) => `<tr><td>${p.reference}</td><td>${p.nom ?? "—"}</td><td class="right">${fmt(Number(p.capitalInvesti))}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="2">TOTAL</td><td class="right">${fmt(totalCapital)}</td></tr>
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Conditions Générales</div>
    <div class="terms">
      <p><strong>Article 1 — Objet du contrat :</strong> Le présent contrat définit les modalités d'investissement de l'Investisseur au sein du Réseau des Investisseurs AfriSime (RIA), géré par AfriGes.</p>
      <p style="margin-top:8px;"><strong>Article 2 — Fonctionnement :</strong> Les fonds investis sont alloués aux clients du réseau sous forme de financements. Les bénéfices générés sont distribués selon les taux convenus, après prélèvement du fonds de sécurité.</p>
      <p style="margin-top:8px;"><strong>Article 3 — Risques :</strong> L'Investisseur reconnaît avoir été informé des risques liés à l'activité d'investissement et de financement, notamment le risque de non-remboursement des clients financés.</p>
      <p style="margin-top:8px;"><strong>Article 4 — Transparence :</strong> L'Investisseur a accès à tout moment à l'état de ses portefeuilles via l'espace dédié AfriGes.</p>
      <p style="margin-top:8px;"><strong>Article 5 — Droit applicable :</strong> Le présent contrat est soumis au droit en vigueur dans le pays de l'organisme gestionnaire.</p>
    </div>
  </div>
  <div class="signature-zone">
    <div class="sig-box"><div class="sig-title">L'Investisseur</div><div>${nom}</div><div style="margin-top:4px;">Date : _______________</div><div style="margin-top:4px;">Signature :</div></div>
    <div class="sig-box"><div class="sig-title">AfriSime / RIA — Responsable</div><div>Nom : _______________</div><div style="margin-top:4px;">Date : _______________</div><div style="margin-top:4px;">Signature &amp; cachet :</div></div>
  </div>
  ${footer("CONTRAT_INVESTISSEUR")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "CONTRAT_INVESTISSEUR", titre: `Contrat Investisseur — ${nom}`, contenu, investisseurId, genereParId },
  });
}

async function genRecuInvestissement(depotId: number, genereParId: number) {
  const depot = await prisma.depotInvestisseur.findUnique({
    where: { id: depotId },
    include: {
      portefeuille: {
        include: {
          profilRIA: { include: { gestionnaire: { include: { member: { select: { nom: true, prenom: true } } } } } },
        },
      },
    },
  });
  if (!depot) throw new Error("Dépôt introuvable");
  const m = depot.portefeuille?.profilRIA?.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const montant = Number(depot.montant);

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Reçu d'Investissement", `RECU-${String(depotId).padStart(6,"0")}`, nom)}
  <div style="background:#f0fdf4;border:2px solid #059669;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
    <div style="font-size:11px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Montant reçu</div>
    <div style="font-size:36px;font-weight:800;color:#059669;margin:8px 0;">${fmt(montant)}</div>
    <div style="font-size:11px;color:#64748b;">Reçu le ${fmtDate(depot.updatedAt)}</div>
  </div>
  <div class="section">
    <div class="section-title">Détail du dépôt</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Investisseur :</span><span class="info-value">${nom}</span></div>
        <div class="info-row"><span class="info-label">Portefeuille :</span><span class="info-value">${depot.portefeuille?.reference ?? "—"}${depot.portefeuille?.nom ? ` — ${depot.portefeuille.nom}` : ""}</span></div>
        <div class="info-row"><span class="info-label">Référence dépôt :</span><span class="info-value">DEP-${String(depotId).padStart(6,"0")}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Statut :</span><span class="info-value"><span class="badge badge-ok">${depot.statut}</span></span></div>
        <div class="info-row"><span class="info-label">Mode de paiement :</span><span class="info-value">${depot.modePaiement ?? "—"}</span></div>
        <div class="info-row"><span class="info-label">Notes :</span><span class="info-value">${depot.notes ?? "—"}</span></div>
      </div>
    </div>
  </div>
  <div style="margin-top:32px;text-align:center;font-size:10px;color:#64748b;">
    <p>Ce reçu atteste de la bonne réception du montant ci-dessus par AfriSime / Réseau RIA.</p>
    <p style="margin-top:8px;">Conservation obligatoire — Document officiel généré par AfriGes</p>
  </div>
  <div class="signature-zone">
    <div class="sig-box"><div class="sig-title">Reçu par</div><div>AfriSime / RIA</div><div style="margin-top:4px;">Signature &amp; cachet :</div></div>
    <div class="sig-box"><div class="sig-title">L'Investisseur</div><div>${nom}</div><div style="margin-top:4px;">Signature :</div></div>
  </div>
  ${footer("RECU_INVESTISSEMENT")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RECU_INVESTISSEMENT", titre: `Reçu — ${nom} — ${fmt(montant)}`, contenu, depotId, portefeuilleId: depot.portefeuilleId, genereParId },
  });
}

async function genAttestationInvestissement(investisseurId: number, genereParId: number) {
  const inv = await prisma.profilInvestisseurRIA.findUnique({
    where: { id: investisseurId },
    include: {
      gestionnaire: { include: { member: { select: { nom: true, prenom: true, email: true, telephone: true } } } },
      portefeuilles: {
        where: { actif: true },
        select: { reference: true, nom: true, capitalInvesti: true, beneficesGeneres: true, capitalDisponible: true },
      },
    },
  });
  if (!inv) throw new Error("Investisseur introuvable");
  const m = inv.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const totalCapital = inv.portefeuilles.reduce((s, p) => s + Number(p.capitalInvesti), 0);
  const totalBenefices = inv.portefeuilles.reduce((s, p) => s + Number(p.beneficesGeneres), 0);

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Attestation d'Investissement", `ATT-${String(investisseurId).padStart(5,"0")}`, nom)}
  <div style="text-align:center;margin:32px 0;padding:24px;background:#f0fdf4;border:2px solid #a7f3d0;border-radius:12px;">
    <div style="font-size:13px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:1px;">AfriSime — Réseau des Investisseurs AfriSime</div>
    <div style="margin-top:16px;font-size:12px;color:#1e293b;line-height:1.7;">
      Atteste que <strong>${nom}</strong><br>
      Numéro d'investisseur : <strong>${inv.numero ?? "EN COURS D'ATTRIBUTION"}</strong><br>
      est membre actif du Réseau des Investisseurs AfriSime (RIA)<br>
      depuis le ${fmtDate(inv.createdAt)}.
    </div>
    <div style="margin-top:16px;font-size:11px;color:#64748b;">Profil : ${inv.profession ?? "—"} · Pays : ${inv.pays ?? "—"}</div>
  </div>
  <div class="section">
    <div class="section-title">Récapitulatif des Investissements</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital investi</div><div class="kpi-value">${fmt(totalCapital)}</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices générés</div><div class="kpi-value text-green">${fmt(totalBenefices)}</div></div>
      <div class="kpi"><div class="kpi-label">Portefeuilles actifs</div><div class="kpi-value">${inv.portefeuilles.length}</div></div>
      <div class="kpi"><div class="kpi-label">Date d'attestation</div><div class="kpi-value" style="font-size:11px;">${new Date().toLocaleDateString("fr-FR")}</div></div>
    </div>
    <table style="margin-top:16px;"><thead><tr><th>Portefeuille</th><th class="right">Capital investi</th><th class="right">Bénéfices</th></tr></thead>
    <tbody>
      ${inv.portefeuilles.map((p) => `<tr><td>${p.reference}${p.nom ? ` — ${p.nom}` : ""}</td><td class="right">${fmt(Number(p.capitalInvesti))}</td><td class="right text-green">${fmt(Number(p.beneficesGeneres))}</td></tr>`).join("")}
    </tbody></table>
  </div>
  <div class="signature-zone" style="margin-top:32px;">
    <div class="sig-box"><div class="sig-title">Le Responsable RIA</div><div>Nom : _______________</div><div style="margin-top:24px;">Signature &amp; cachet officiel :</div></div>
    <div class="sig-box"><div class="sig-title">Date de délivrance</div><div>${fmtDate(new Date())}</div><div style="margin-top:8px;font-size:9px;color:#94a3b8;">Valable pour justification administrative</div></div>
  </div>
  ${footer("ATTESTATION_INVESTISSEMENT")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "ATTESTATION_INVESTISSEMENT", titre: `Attestation Investisseur — ${nom}`, contenu, investisseurId, genereParId },
  });
}

async function genRelevePortefeuille(portefeuilleId: number, genereParId: number) {
  const pf = await prisma.portefeuilleRIA.findUnique({
    where: { id: portefeuilleId },
    include: {
      profilRIA: { include: { gestionnaire: { include: { member: { select: { nom: true, prenom: true } } } } } },
      mouvements: { orderBy: { createdAt: "desc" }, take: 50, select: { type: true, sens: true, montant: true, description: true, createdAt: true } },
      financements: { where: { statut: { in: ["ACTIF","EN_RETARD"] } }, select: { reference: true, statut: true, montantFinance: true, encours: true, dateEcheance: true, client: { select: { nom: true, prenom: true } } } },
    },
  });
  if (!pf) throw new Error("Portefeuille introuvable");
  const m = pf.profilRIA?.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const toN = (v: unknown) => Number(v ?? 0);

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Relevé de Portefeuille", `REL-${String(portefeuilleId).padStart(5,"0")}`, nom)}
  <div class="section">
    <div class="section-title">Identité du Portefeuille</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Référence :</span><span class="info-value">${pf.reference}</span></div>
        <div class="info-row"><span class="info-label">Nom :</span><span class="info-value">${pf.nom ?? "—"}</span></div>
        <div class="info-row"><span class="info-label">Investisseur :</span><span class="info-value">${nom}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Date du relevé :</span><span class="info-value">${fmtDate(new Date())}</span></div>
        <div class="info-row"><span class="info-label">Statut :</span><span class="info-value"><span class="badge ${pf.actif ? "badge-ok" : "badge-danger"}">${pf.actif ? "Actif" : "Inactif"}</span></span></div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Situation des Capitaux</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital investi</div><div class="kpi-value">${fmt(toN(pf.capitalInvesti))}</div></div>
      <div class="kpi"><div class="kpi-label">Capital disponible</div><div class="kpi-value">${fmt(toN(pf.capitalDisponible))}</div></div>
      <div class="kpi"><div class="kpi-label">Capital engagé</div><div class="kpi-value">${fmt(toN(pf.capitalEngage))}</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices générés</div><div class="kpi-value">${fmt(toN(pf.beneficesGeneres))}</div></div>
    </div>
    <div class="kpi-grid" style="margin-top:12px;">
      <div class="kpi"><div class="kpi-label">Capital recouvré</div><div class="kpi-value">${fmt(toN(pf.capitalRecouvre))}</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices distribués</div><div class="kpi-value">${fmt(toN(pf.beneficesDistribues))}</div></div>
      <div class="kpi"><div class="kpi-label">Fonds de sécurité</div><div class="kpi-value">${fmt(toN(pf.fondSecurite))}</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices réinvestis</div><div class="kpi-value">${fmt(toN(pf.beneficesReinvestis))}</div></div>
    </div>
  </div>
  ${pf.financements.length > 0 ? `
  <div class="section">
    <div class="section-title">Financements Actifs / En Retard (${pf.financements.length})</div>
    <table><thead><tr><th>Référence</th><th>Client</th><th>Statut</th><th class="right">Financé</th><th class="right">Encours</th><th>Échéance</th></tr></thead>
    <tbody>
      ${pf.financements.map((f) => `
      <tr>
        <td>${f.reference}</td>
        <td>${f.client.prenom} ${f.client.nom}</td>
        <td><span class="badge ${f.statut === "EN_RETARD" ? "badge-danger" : "badge-ok"}">${f.statut}</span></td>
        <td class="right">${fmt(toN(f.montantFinance))}</td>
        <td class="right text-red">${fmt(toN(f.encours))}</td>
        <td>${f.dateEcheance ? fmtDate(f.dateEcheance) : "—"}</td>
      </tr>`).join("")}
    </tbody></table>
  </div>` : ""}
  ${pf.mouvements.length > 0 ? `
  <div class="section">
    <div class="section-title">Derniers Mouvements (${pf.mouvements.length})</div>
    <table><thead><tr><th>Date</th><th>Type</th><th>Sens</th><th>Description</th><th class="right">Montant</th></tr></thead>
    <tbody>
      ${pf.mouvements.map((mv) => `
      <tr>
        <td>${fmtDate(mv.createdAt)}</td>
        <td>${mv.type}</td>
        <td><span class="badge ${mv.sens === "ENTREE" ? "badge-ok" : "badge-danger"}">${mv.sens}</span></td>
        <td>${mv.description ?? "—"}</td>
        <td class="right ${mv.sens === "ENTREE" ? "text-green" : "text-red"}">${mv.sens === "SORTIE" ? "-" : "+"}${fmt(Number(mv.montant))}</td>
      </tr>`).join("")}
    </tbody></table>
  </div>` : ""}
  ${footer("RELEVE_PORTEFEUILLE")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RELEVE_PORTEFEUILLE", titre: `Relevé de portefeuille — ${pf.reference}${pf.nom ? ` (${pf.nom})` : ""}`, contenu, portefeuilleId, investisseurId: pf.profilRIAId ? undefined : undefined, genereParId },
  });
}

async function genRapportMensuel(portefeuilleId: number, mois: number, annee: number, genereParId: number) {
  const debutMois = new Date(annee, mois - 1, 1);
  const finMois   = new Date(annee, mois, 0, 23, 59, 59, 999);
  const pf = await prisma.portefeuilleRIA.findUnique({
    where: { id: portefeuilleId },
    include: {
      profilRIA: { include: { gestionnaire: { include: { member: { select: { nom: true, prenom: true } } } } } },
      financements: { select: { statut: true, montantFinance: true, montantRembourse: true, encours: true, dateEcheance: true, client: { select: { nom: true, prenom: true } } } },
      depots:      { where: { statut: "VALIDE", updatedAt: { gte: debutMois, lte: finMois } }, select: { montant: true, updatedAt: true, notes: true } },
      retraits:    { where: { statut: "PAYE", updatedAt: { gte: debutMois, lte: finMois } }, select: { montant: true, updatedAt: true, motif: true } },
      distributions: { where: { mois, annee }, select: { montantGenere: true, montantDistribue: true, montantReinvesti: true, montantFondSecurite: true } },
    },
  });
  if (!pf) throw new Error("Portefeuille introuvable");
  const m = pf.profilRIA?.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const toN = (v: unknown) => Number(v ?? 0);
  const label = `${MOIS_FR[mois - 1]} ${annee}`;

  const retards = pf.financements.filter((f) => f.statut === "EN_RETARD");
  const encoursTot = pf.financements.reduce((s, f) => s + toN(f.encours), 0);
  const recouvTot  = pf.financements.reduce((s, f) => s + toN(f.montantRembourse), 0);
  const financeTot = pf.financements.reduce((s, f) => s + toN(f.montantFinance), 0);
  const gains      = pf.distributions.reduce((s, d) => s + toN(d.montantDistribue), 0);
  const capitalInvesti = toN(pf.capitalInvesti);
  const rendement  = capitalInvesti > 0 ? (gains / capitalInvesti * 100).toFixed(2) : "0.00";
  const tauxRec    = financeTot > 0 ? (recouvTot / financeTot * 100).toFixed(1) : "0.0";

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header(`Rapport Mensuel — ${label}`, `RPT-M-${String(portefeuilleId).padStart(4,"0")}-${mois.toString().padStart(2,"0")}-${annee}`, nom)}
  <div class="section">
    <div class="section-title">Portefeuille &amp; Période</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Portefeuille :</span><span class="info-value">${pf.reference}${pf.nom ? ` — ${pf.nom}` : ""}</span></div>
        <div class="info-row"><span class="info-label">Investisseur :</span><span class="info-value">${nom}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Période :</span><span class="info-value">${label}</span></div>
        <div class="info-row"><span class="info-label">Généré le :</span><span class="info-value">${fmtDate(new Date())}</span></div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Indicateurs Clés du Mois</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital investi</div><div class="kpi-value">${fmt(capitalInvesti)}</div></div>
      <div class="kpi"><div class="kpi-label">Gains distribués</div><div class="kpi-value text-green">${fmt(gains)}</div></div>
      <div class="kpi"><div class="kpi-label">Rendement du mois</div><div class="kpi-value">${rendement}%</div></div>
      <div class="kpi"><div class="kpi-label">Taux de recouvrement</div><div class="kpi-value">${tauxRec}%</div></div>
    </div>
  </div>
  ${pf.distributions.length > 0 ? `
  <div class="section">
    <div class="section-title">Distributions du Mois</div>
    <table><thead><tr><th class="right">Générés</th><th class="right">Distribués</th><th class="right">Réinvestis</th><th class="right">Fonds sécurité</th></tr></thead>
    <tbody>
      ${pf.distributions.map((d) => `<tr><td class="right">${fmt(toN(d.montantGenere))}</td><td class="right text-green">${fmt(toN(d.montantDistribue))}</td><td class="right">${fmt(toN(d.montantReinvesti))}</td><td class="right">${fmt(toN(d.montantFondSecurite))}</td></tr>`).join("")}
    </tbody></table>
  </div>` : ""}
  ${pf.depots.length > 0 ? `
  <div class="section">
    <div class="section-title">Dépôts du Mois (${pf.depots.length})</div>
    <table><thead><tr><th>Date</th><th class="right">Montant</th><th>Notes</th></tr></thead>
    <tbody>${pf.depots.map((d) => `<tr><td>${fmtDate(d.updatedAt)}</td><td class="right text-green">${fmt(toN(d.montant))}</td><td>${d.notes ?? "—"}</td></tr>`).join("")}</tbody>
    </table>
  </div>` : ""}
  <div class="section">
    <div class="section-title">Recouvrement</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Total financé :</span><span class="info-value">${fmt(financeTot)}</span></div>
        <div class="info-row"><span class="info-label">Total recouvré :</span><span class="info-value text-green">${fmt(recouvTot)}</span></div>
        <div class="info-row"><span class="info-label">Encours restant :</span><span class="info-value text-red">${fmt(encoursTot)}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Financements actifs :</span><span class="info-value">${pf.financements.filter((f) => f.statut === "ACTIF").length}</span></div>
        <div class="info-row"><span class="info-label">En retard :</span><span class="info-value text-red">${retards.length}</span></div>
      </div>
    </div>
  </div>
  ${footer("RAPPORT_MENSUEL")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RAPPORT_MENSUEL", titre: `Rapport Mensuel — ${pf.reference} — ${label}`, contenu, portefeuilleId, mois, annee, genereParId },
  });
}

async function genRapportAnnuel(portefeuilleId: number, annee: number, genereParId: number) {
  const pf = await prisma.portefeuilleRIA.findUnique({
    where: { id: portefeuilleId },
    include: {
      profilRIA: { include: { gestionnaire: { include: { member: { select: { nom: true, prenom: true } } } } } },
      financements: { select: { statut: true, montantFinance: true, montantRembourse: true, encours: true } },
      distributions: { where: { annee }, select: { mois: true, montantGenere: true, montantDistribue: true, montantReinvesti: true, montantFondSecurite: true } },
    },
  });
  if (!pf) throw new Error("Portefeuille introuvable");
  const m = pf.profilRIA?.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const toN = (v: unknown) => Number(v ?? 0);

  const totalGenere  = pf.distributions.reduce((s, d) => s + toN(d.montantGenere), 0);
  const totalDistrib = pf.distributions.reduce((s, d) => s + toN(d.montantDistribue), 0);
  const totalFonds   = pf.distributions.reduce((s, d) => s + toN(d.montantFondSecurite), 0);
  const capitalInvesti = toN(pf.capitalInvesti);
  const roi = capitalInvesti > 0 ? (totalGenere / capitalInvesti * 100).toFixed(2) : "0.00";
  const distributionsByMois = pf.distributions.sort((a, b) => a.mois - b.mois);

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header(`Rapport Annuel ${annee}`, `RPT-A-${String(portefeuilleId).padStart(4,"0")}-${annee}`, nom)}
  <div class="section">
    <div class="section-title">Synthèse Annuelle ${annee}</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital investi</div><div class="kpi-value">${fmt(capitalInvesti)}</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices générés</div><div class="kpi-value text-green">${fmt(totalGenere)}</div></div>
      <div class="kpi"><div class="kpi-label">ROI annuel</div><div class="kpi-value">${roi}%</div></div>
      <div class="kpi"><div class="kpi-label">Distribués</div><div class="kpi-value">${fmt(totalDistrib)}</div></div>
    </div>
    <div class="kpi-grid" style="margin-top:12px;">
      <div class="kpi"><div class="kpi-label">Fonds de sécurité</div><div class="kpi-value">${fmt(totalFonds)}</div></div>
      <div class="kpi"><div class="kpi-label">Capital disponible</div><div class="kpi-value">${fmt(toN(pf.capitalDisponible))}</div></div>
      <div class="kpi"><div class="kpi-label">Capital engagé</div><div class="kpi-value">${fmt(toN(pf.capitalEngage))}</div></div>
      <div class="kpi"><div class="kpi-label">Capital recouvré</div><div class="kpi-value">${fmt(toN(pf.capitalRecouvre))}</div></div>
    </div>
  </div>
  ${distributionsByMois.length > 0 ? `
  <div class="section">
    <div class="section-title">Évolution Mensuelle des Bénéfices</div>
    <table><thead><tr><th>Mois</th><th class="right">Générés</th><th class="right">Distribués</th><th class="right">Réinvestis</th><th class="right">Fonds sécurité</th></tr></thead>
    <tbody>
      ${distributionsByMois.map((d) => `<tr><td>${MOIS_FR[d.mois - 1]}</td><td class="right">${fmt(toN(d.montantGenere))}</td><td class="right text-green">${fmt(toN(d.montantDistribue))}</td><td class="right">${fmt(toN(d.montantReinvesti))}</td><td class="right">${fmt(toN(d.montantFondSecurite))}</td></tr>`).join("")}
      <tr class="total-row"><td>TOTAL ${annee}</td><td class="right">${fmt(totalGenere)}</td><td class="right">${fmt(totalDistrib)}</td><td class="right">${fmt(pf.distributions.reduce((s,d)=>s+toN(d.montantReinvesti),0))}</td><td class="right">${fmt(totalFonds)}</td></tr>
    </tbody></table>
  </div>` : ""}
  <div class="section">
    <div class="section-title">Bilan Recouvrement</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Financements actifs :</span><span class="info-value">${pf.financements.filter((f) => f.statut === "ACTIF").length}</span></div>
        <div class="info-row"><span class="info-label">En retard :</span><span class="info-value text-red">${pf.financements.filter((f) => f.statut === "EN_RETARD").length}</span></div>
        <div class="info-row"><span class="info-label">En défaut :</span><span class="info-value text-red">${pf.financements.filter((f) => f.statut === "DEFAUT").length}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Total financé :</span><span class="info-value">${fmt(pf.financements.reduce((s,f)=>s+toN(f.montantFinance),0))}</span></div>
        <div class="info-row"><span class="info-label">Total recouvré :</span><span class="info-value text-green">${fmt(pf.financements.reduce((s,f)=>s+toN(f.montantRembourse),0))}</span></div>
        <div class="info-row"><span class="info-label">Encours restant :</span><span class="info-value text-red">${fmt(pf.financements.reduce((s,f)=>s+toN(f.encours),0))}</span></div>
      </div>
    </div>
  </div>
  ${footer("RAPPORT_ANNUEL")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RAPPORT_ANNUEL", titre: `Rapport Annuel ${annee} — ${pf.reference}`, contenu, portefeuilleId, annee, genereParId },
  });
}

async function genRapportRentabilite(portefeuilleId: number, genereParId: number) {
  const pf = await prisma.portefeuilleRIA.findUnique({
    where: { id: portefeuilleId },
    include: {
      profilRIA: { include: { gestionnaire: { include: { member: { select: { nom: true, prenom: true } } } } } },
      distributions: { orderBy: [{ annee: "asc" }, { mois: "asc" }], select: { mois: true, annee: true, montantGenere: true, montantDistribue: true, montantReinvesti: true } },
      financements: { select: { statut: true, montantFinance: true, montantRembourse: true, dateFinancement: true } },
    },
  });
  if (!pf) throw new Error("Portefeuille introuvable");
  const m = pf.profilRIA?.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const toN = (v: unknown) => Number(v ?? 0);
  const capitalInvesti = toN(pf.capitalInvesti);
  const beneficesTotal = toN(pf.beneficesGeneres);
  const roi = capitalInvesti > 0 ? (beneficesTotal / capitalInvesti * 100).toFixed(2) : "0.00";
  const distribTotal = toN(pf.beneficesDistribues);
  const tauxDistrib = beneficesTotal > 0 ? (distribTotal / beneficesTotal * 100).toFixed(1) : "0.0";

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Rapport de Rentabilité", `RPT-R-${String(portefeuilleId).padStart(5,"0")}`, nom)}
  <div class="section">
    <div class="section-title">Indicateurs de Rentabilité</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital investi</div><div class="kpi-value">${fmt(capitalInvesti)}</div></div>
      <div class="kpi"><div class="kpi-label">Total bénéfices</div><div class="kpi-value text-green">${fmt(beneficesTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">ROI global</div><div class="kpi-value">${roi}%</div></div>
      <div class="kpi"><div class="kpi-label">Taux distribution</div><div class="kpi-value">${tauxDistrib}%</div></div>
    </div>
    <div class="kpi-grid" style="margin-top:12px;">
      <div class="kpi"><div class="kpi-label">Bénéfices distribués</div><div class="kpi-value">${fmt(distribTotal)}</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices réinvestis</div><div class="kpi-value">${fmt(toN(pf.beneficesReinvestis))}</div></div>
      <div class="kpi"><div class="kpi-label">Fonds de sécurité</div><div class="kpi-value">${fmt(toN(pf.fondSecurite))}</div></div>
      <div class="kpi"><div class="kpi-label">Capital recouvré</div><div class="kpi-value">${fmt(toN(pf.capitalRecouvre))}</div></div>
    </div>
  </div>
  ${pf.distributions.length > 0 ? `
  <div class="section">
    <div class="section-title">Historique des Distributions</div>
    <table><thead><tr><th>Période</th><th class="right">Générés</th><th class="right">Distribués</th><th class="right">Réinvestis</th><th class="right">Rendement</th></tr></thead>
    <tbody>
      ${pf.distributions.map((d) => {
        const rend = capitalInvesti > 0 ? (toN(d.montantGenere) / capitalInvesti * 100).toFixed(3) : "0.000";
        return `<tr><td>${MOIS_FR[d.mois - 1]} ${d.annee}</td><td class="right">${fmt(toN(d.montantGenere))}</td><td class="right text-green">${fmt(toN(d.montantDistribue))}</td><td class="right">${fmt(toN(d.montantReinvesti))}</td><td class="right">${rend}%</td></tr>`;
      }).join("")}
    </tbody></table>
  </div>` : ""}
  <div class="section">
    <div class="section-title">Performance des Financements</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Nb financements :</span><span class="info-value">${pf.financements.length}</span></div>
        <div class="info-row"><span class="info-label">Actifs :</span><span class="info-value">${pf.financements.filter((f) => f.statut === "ACTIF").length}</span></div>
        <div class="info-row"><span class="info-label">Clôturés :</span><span class="info-value">${pf.financements.filter((f) => f.statut === "REMBOURSE").length}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Total financé :</span><span class="info-value">${fmt(pf.financements.reduce((s,f)=>s+toN(f.montantFinance),0))}</span></div>
        <div class="info-row"><span class="info-label">Total recouvré :</span><span class="info-value text-green">${fmt(pf.financements.reduce((s,f)=>s+toN(f.montantRembourse),0))}</span></div>
      </div>
    </div>
  </div>
  ${footer("RAPPORT_RENTABILITE")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RAPPORT_RENTABILITE", titre: `Rapport Rentabilité — ${pf.reference}${pf.nom ? ` (${pf.nom})` : ""} — ROI ${roi}%`, contenu, portefeuilleId, genereParId },
  });
}

async function genRapportRisque(portefeuilleId: number, genereParId: number) {
  const pf = await prisma.portefeuilleRIA.findUnique({
    where: { id: portefeuilleId },
    include: {
      profilRIA: { include: { gestionnaire: { include: { member: { select: { nom: true, prenom: true } } } } } },
      financements: {
        where: { statut: { not: "ANNULE" } },
        select: { reference: true, statut: true, montantFinance: true, montantRembourse: true, encours: true, dateEcheance: true, client: { select: { nom: true, prenom: true, niveauRisque: true, scoreSolvabilite: true } } },
      },
      affectations: { where: { actif: true }, select: { classeRisque: true, client: { select: { nom: true, prenom: true, scoreSolvabilite: true } } } },
    },
  });
  if (!pf) throw new Error("Portefeuille introuvable");
  const m = pf.profilRIA?.gestionnaire?.member;
  const nom = m ? `${m.prenom} ${m.nom}` : "—";
  const toN = (v: unknown) => Number(v ?? 0);
  const now = new Date();

  const retards = pf.financements.filter((f) => f.statut === "EN_RETARD");
  const defauts = pf.financements.filter((f) => f.statut === "DEFAUT");
  const douteux = retards.filter((f) => {
    if (!f.dateEcheance) return false;
    return Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000) > 30;
  });
  const encoursTot = pf.financements.reduce((s, f) => s + toN(f.encours), 0);
  const financeTot = pf.financements.reduce((s, f) => s + toN(f.montantFinance), 0);
  const tauxDefaut = financeTot > 0 ? ((defauts.reduce((s,f)=>s+toN(f.montantFinance),0) / financeTot) * 100).toFixed(1) : "0.0";

  const classeCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  pf.affectations.forEach((a) => { if (a.classeRisque) classeCount[a.classeRisque] = (classeCount[a.classeRisque] ?? 0) + 1; });

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Rapport de Risque", `RPT-RQ-${String(portefeuilleId).padStart(5,"0")}`, nom)}
  <div class="section">
    <div class="section-title">Indicateurs de Risque</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Financements en retard</div><div class="kpi-value text-red">${retards.length}</div><div class="kpi-sub">${fmt(retards.reduce((s,f)=>s+toN(f.encours),0))}</div></div>
      <div class="kpi"><div class="kpi-label">En défaut</div><div class="kpi-value text-red">${defauts.length}</div><div class="kpi-sub">${fmt(defauts.reduce((s,f)=>s+toN(f.encours),0))}</div></div>
      <div class="kpi"><div class="kpi-label">Créances douteuses (+30j)</div><div class="kpi-value text-red">${douteux.length}</div><div class="kpi-sub">${fmt(douteux.reduce((s,f)=>s+toN(f.encours),0))}</div></div>
      <div class="kpi"><div class="kpi-label">Taux de défaut</div><div class="kpi-value text-red">${tauxDefaut}%</div></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Répartition par Classe de Risque (Clients Affectés)</div>
    <table><thead><tr><th>Classe</th><th>Signification</th><th class="center">Nb clients</th></tr></thead>
    <tbody>
      <tr><td><span class="badge badge-ok">A</span></td><td>Risque très faible</td><td class="center">${classeCount.A}</td></tr>
      <tr><td><span class="badge badge-ok">B</span></td><td>Risque faible</td><td class="center">${classeCount.B}</td></tr>
      <tr><td><span class="badge badge-warn">C</span></td><td>Risque modéré</td><td class="center">${classeCount.C}</td></tr>
      <tr><td><span class="badge badge-danger">D</span></td><td>Risque élevé</td><td class="center">${classeCount.D}</td></tr>
      <tr><td><span class="badge badge-danger">E</span></td><td>Risque critique</td><td class="center">${classeCount.E}</td></tr>
    </tbody></table>
  </div>
  ${retards.length > 0 || defauts.length > 0 ? `
  <div class="section">
    <div class="section-title">Détail des Créances à Risque</div>
    <table><thead><tr><th>Référence</th><th>Client</th><th>Statut</th><th class="right">Encours</th><th>Échéance</th><th class="right">Retard (j)</th></tr></thead>
    <tbody>
      ${[...retards, ...defauts].map((f) => {
        const joursRetard = f.dateEcheance && new Date(f.dateEcheance) < now
          ? Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000)
          : 0;
        return `<tr><td>${f.reference}</td><td>${f.client.prenom} ${f.client.nom}</td><td><span class="badge badge-danger">${f.statut}</span></td><td class="right text-red">${fmt(toN(f.encours))}</td><td>${f.dateEcheance ? fmtDate(f.dateEcheance) : "—"}</td><td class="right">${joursRetard > 0 ? joursRetard : "—"}</td></tr>`;
      }).join("")}
    </tbody></table>
  </div>` : ""}
  <div class="section">
    <div class="section-title">Couverture du Risque</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Fonds de sécurité :</span><span class="info-value text-green">${fmt(toN(pf.fondSecurite))}</span></div>
        <div class="info-row"><span class="info-label">Encours total :</span><span class="info-value">${fmt(encoursTot)}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Taux couverture :</span><span class="info-value">${encoursTot > 0 ? (toN(pf.fondSecurite) / encoursTot * 100).toFixed(1) : "0.0"}%</span></div>
      </div>
    </div>
  </div>
  ${footer("RAPPORT_RISQUE")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RAPPORT_RISQUE", titre: `Rapport de Risque — ${pf.reference}`, contenu, portefeuilleId, genereParId },
  });
}

async function genEtatCreances(portefeuilleId: number | null, genereParId: number) {
  const statutsCreances: StatutFinancementRIA[] = ["ACTIF", "EN_RETARD", "DEFAUT"];
  const where = portefeuilleId
    ? { portefeuilleId, statut: { in: statutsCreances } }
    : { statut: { in: statutsCreances } };

  const fins = await prisma.operationFinancementRIA.findMany({
    where,
    include: {
      portefeuille: { select: { reference: true, nom: true } },
      client: { select: { nom: true, prenom: true, telephone: true, ville: true } },
    },
    orderBy: { statut: "asc" },
  });

  const toN = (v: unknown) => Number(v ?? 0);
  const now = new Date();
  const totalEncours = fins.reduce((s, f) => s + toN(f.encours), 0);
  const totalFinance  = fins.reduce((s, f) => s + toN(f.montantFinance), 0);
  const titre = portefeuilleId ? `État des Créances — PF ${portefeuilleId}` : "État des Créances — Global";

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("État des Créances", `CREA-${portefeuilleId ? String(portefeuilleId).padStart(5,"0") : "GLOBAL"}`, "AfriSime / RIA")}
  <div class="section">
    <div class="section-title">Synthèse</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total financé</div><div class="kpi-value">${fmt(totalFinance)}</div></div>
      <div class="kpi"><div class="kpi-label">Encours total</div><div class="kpi-value text-red">${fmt(totalEncours)}</div></div>
      <div class="kpi"><div class="kpi-label">Nb créances</div><div class="kpi-value">${fins.length}</div></div>
      <div class="kpi"><div class="kpi-label">En retard/défaut</div><div class="kpi-value text-red">${fins.filter((f) => ["EN_RETARD","DEFAUT"].includes(f.statut)).length}</div></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Détail des Créances (${fins.length})</div>
    <table><thead><tr><th>Réf.</th><th>Client</th>${!portefeuilleId ? "<th>Portefeuille</th>" : ""}<th>Statut</th><th class="right">Financé</th><th class="right">Remboursé</th><th class="right">Encours</th><th>Échéance</th><th class="right">Retard (j)</th></tr></thead>
    <tbody>
      ${fins.map((f) => {
        const joursRetard = f.dateEcheance && new Date(f.dateEcheance) < now
          ? Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000)
          : 0;
        const badgeClass = f.statut === "DEFAUT" ? "badge-danger" : f.statut === "EN_RETARD" ? "badge-warn" : "badge-ok";
        return `<tr>
          <td>${f.reference}</td>
          <td>${f.client.prenom} ${f.client.nom}</td>
          ${!portefeuilleId ? `<td>${f.portefeuille?.reference ?? "—"}</td>` : ""}
          <td><span class="badge ${badgeClass}">${f.statut}</span></td>
          <td class="right">${fmt(toN(f.montantFinance))}</td>
          <td class="right text-green">${fmt(toN(f.montantRembourse))}</td>
          <td class="right text-red">${fmt(toN(f.encours))}</td>
          <td>${f.dateEcheance ? fmtDate(f.dateEcheance) : "—"}</td>
          <td class="right ${joursRetard > 0 ? "text-red" : ""}">${joursRetard > 0 ? joursRetard : "—"}</td>
        </tr>`;
      }).join("")}
      <tr class="total-row"><td colspan="${portefeuilleId ? 3 : 4}">TOTAL</td><td class="right">${fmt(totalFinance)}</td><td class="right">${fmt(fins.reduce((s,f)=>s+toN(f.montantRembourse),0))}</td><td class="right">${fmt(totalEncours)}</td><td colspan="2"></td></tr>
    </tbody></table>
  </div>
  ${footer("ETAT_CREANCES")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "ETAT_CREANCES", titre, contenu, portefeuilleId: portefeuilleId ?? undefined, genereParId },
  });
}

async function genRapportFinancier(portefeuilleId: number | null, genereParId: number) {
  const pfWhere = portefeuilleId ? { id: portefeuilleId } : undefined;
  const [pfAgg, nbInv, fins, distrib12m] = await Promise.all([
    prisma.portefeuilleRIA.aggregate({
      _sum: { capitalInvesti: true, capitalDisponible: true, capitalEngage: true, capitalRecouvre: true, beneficesGeneres: true, beneficesDistribues: true, fondSecurite: true },
      where: pfWhere,
    }),
    prisma.profilInvestisseurRIA.count(),
    prisma.operationFinancementRIA.findMany({
      where: portefeuilleId ? { portefeuilleId } : {},
      select: { statut: true, montantFinance: true, montantRembourse: true, encours: true },
    }),
    prisma.distributionBenefice.findMany({
      where: {
        ...(portefeuilleId ? { portefeuilleId } : {}),
        statut: "DISTRIBUE",
        datePaiement: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
      },
      select: { mois: true, annee: true, montantGenere: true, montantDistribue: true },
    }),
  ]);

  const toN = (v: unknown) => Number(v ?? 0);
  const s = pfAgg._sum;
  const capitalTot     = toN(s.capitalInvesti);
  const beneficesTot   = toN(s.beneficesGeneres);
  const distribTot     = toN(s.beneficesDistribues);
  const financeTotal   = fins.reduce((acc, f) => acc + toN(f.montantFinance), 0);
  const recouvreTotal  = fins.reduce((acc, f) => acc + toN(f.montantRembourse), 0);
  const encoursTot     = fins.reduce((acc, f) => acc + toN(f.encours), 0);
  const roi            = capitalTot > 0 ? (beneficesTot / capitalTot * 100).toFixed(2) : "0.00";
  const tauxRec        = financeTotal > 0 ? (recouvreTotal / financeTotal * 100).toFixed(1) : "0.0";
  const retards        = fins.filter((f) => f.statut === "EN_RETARD").length;
  const defauts        = fins.filter((f) => f.statut === "DEFAUT").length;

  const evolutionMap: Record<string, { mois: number; annee: number; genere: number; distribue: number }> = {};
  for (const d of distrib12m) {
    const key = `${d.annee}-${String(d.mois).padStart(2,"0")}`;
    if (!evolutionMap[key]) evolutionMap[key] = { mois: d.mois, annee: d.annee, genere: 0, distribue: 0 };
    evolutionMap[key].genere    += toN(d.montantGenere);
    evolutionMap[key].distribue += toN(d.montantDistribue);
  }
  const evolution = Object.values(evolutionMap).sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);

  const titre = portefeuilleId ? `Rapport Financier — Portefeuille ${portefeuilleId}` : "Rapport Financier Global RIA";

  const contenu = `<!DOCTYPE html><html><head><meta charset="utf-8">${STYLES}</head><body><div class="doc">
  ${header("Rapport Financier & Analytique", portefeuilleId ? `RF-PF-${String(portefeuilleId).padStart(5,"0")}` : `RF-GLOBAL-${new Date().getFullYear()}`, "AfriSime / RIA")}
  <div class="section">
    <div class="section-title">Tableau de Bord Financier</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital total</div><div class="kpi-value">${fmt(capitalTot)}</div><div class="kpi-sub">${nbInv} investisseurs</div></div>
      <div class="kpi"><div class="kpi-label">Bénéfices générés</div><div class="kpi-value text-green">${fmt(beneficesTot)}</div><div class="kpi-sub">ROI : ${roi}%</div></div>
      <div class="kpi"><div class="kpi-label">Distribués</div><div class="kpi-value">${fmt(distribTot)}</div><div class="kpi-sub">${capitalTot > 0 ? (distribTot/capitalTot*100).toFixed(1) : 0}% du capital</div></div>
      <div class="kpi"><div class="kpi-label">Taux recouvrement</div><div class="kpi-value">${tauxRec}%</div><div class="kpi-sub">${fmt(recouvreTotal)} / ${fmt(financeTotal)}</div></div>
    </div>
    <div class="kpi-grid" style="margin-top:12px;">
      <div class="kpi"><div class="kpi-label">Encours total</div><div class="kpi-value">${fmt(encoursTot)}</div></div>
      <div class="kpi"><div class="kpi-label">Fonds de sécurité</div><div class="kpi-value">${fmt(toN(s.fondSecurite))}</div></div>
      <div class="kpi"><div class="kpi-label">En retard</div><div class="kpi-value text-red">${retards}</div></div>
      <div class="kpi"><div class="kpi-label">En défaut</div><div class="kpi-value text-red">${defauts}</div></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Flux de Capital</div>
    <table><thead><tr><th>Catégorie</th><th class="right">Montant</th><th class="right">% du capital</th></tr></thead>
    <tbody>
      <tr><td>Capital investi total</td><td class="right">${fmt(capitalTot)}</td><td class="right">100%</td></tr>
      <tr><td>Capital disponible</td><td class="right">${fmt(toN(s.capitalDisponible))}</td><td class="right">${capitalTot > 0 ? (toN(s.capitalDisponible)/capitalTot*100).toFixed(1) : 0}%</td></tr>
      <tr><td>Capital engagé (encours)</td><td class="right">${fmt(toN(s.capitalEngage))}</td><td class="right">${capitalTot > 0 ? (toN(s.capitalEngage)/capitalTot*100).toFixed(1) : 0}%</td></tr>
      <tr><td>Capital recouvré</td><td class="right text-green">${fmt(toN(s.capitalRecouvre))}</td><td class="right">${capitalTot > 0 ? (toN(s.capitalRecouvre)/capitalTot*100).toFixed(1) : 0}%</td></tr>
      <tr class="total-row"><td>Bénéfices générés</td><td class="right text-green">${fmt(beneficesTot)}</td><td class="right text-green">+${roi}%</td></tr>
    </tbody></table>
  </div>
  ${evolution.length > 0 ? `
  <div class="section">
    <div class="section-title">Évolution des Bénéfices — 12 derniers mois</div>
    <table><thead><tr><th>Période</th><th class="right">Générés</th><th class="right">Distribués</th><th class="right">Taux distrib.</th></tr></thead>
    <tbody>
      ${evolution.map((e) => `<tr><td>${MOIS_FR[e.mois - 1]} ${e.annee}</td><td class="right">${fmt(e.genere)}</td><td class="right text-green">${fmt(e.distribue)}</td><td class="right">${e.genere > 0 ? (e.distribue/e.genere*100).toFixed(0) : 0}%</td></tr>`).join("")}
    </tbody></table>
  </div>` : ""}
  ${footer("RAPPORT_FINANCIER")}
  </div></body></html>`;

  return prisma.documentRIAGenere.create({
    data: { type: "RAPPORT_FINANCIER", titre, contenu, portefeuilleId: portefeuilleId ?? undefined, genereParId },
  });
}

// ── Route handlers ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type  = searchParams.get("type") ?? undefined;
    const pfId  = searchParams.get("portefeuilleId") ? parseInt(searchParams.get("portefeuilleId")!) : undefined;
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

    const docs = await prisma.documentRIAGenere.findMany({
      where: {
        archive: false,
        ...(type ? { type: type as never } : {}),
        ...(pfId  ? { portefeuilleId: pfId } : {}),
      },
      select: {
        id: true, type: true, titre: true, version: true, mois: true, annee: true, createdAt: true,
        investisseurId: true, portefeuilleId: true, depotId: true,
        investisseur: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
        portefeuille: { select: { reference: true, nom: true } },
        generePar: { select: { nom: true, prenom: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: docs, total: docs.length });
  } catch (error) {
    console.error("GET /api/admin/ria/documents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, investisseurId, portefeuilleId, depotId, mois, annee } = body;
    const genereParId = parseInt(session.user.id!);

    let doc;
    switch (type) {
      case "CONTRAT_INVESTISSEUR":
        if (!investisseurId) return NextResponse.json({ error: "investisseurId requis" }, { status: 400 });
        doc = await genContratInvestisseur(parseInt(investisseurId), genereParId);
        break;
      case "RECU_INVESTISSEMENT":
        if (!depotId) return NextResponse.json({ error: "depotId requis" }, { status: 400 });
        doc = await genRecuInvestissement(parseInt(depotId), genereParId);
        break;
      case "ATTESTATION_INVESTISSEMENT":
        if (!investisseurId) return NextResponse.json({ error: "investisseurId requis" }, { status: 400 });
        doc = await genAttestationInvestissement(parseInt(investisseurId), genereParId);
        break;
      case "RELEVE_PORTEFEUILLE":
        if (!portefeuilleId) return NextResponse.json({ error: "portefeuilleId requis" }, { status: 400 });
        doc = await genRelevePortefeuille(parseInt(portefeuilleId), genereParId);
        break;
      case "RAPPORT_MENSUEL":
        if (!portefeuilleId || !mois || !annee) return NextResponse.json({ error: "portefeuilleId, mois, annee requis" }, { status: 400 });
        doc = await genRapportMensuel(parseInt(portefeuilleId), parseInt(mois), parseInt(annee), genereParId);
        break;
      case "RAPPORT_ANNUEL":
        if (!portefeuilleId || !annee) return NextResponse.json({ error: "portefeuilleId et annee requis" }, { status: 400 });
        doc = await genRapportAnnuel(parseInt(portefeuilleId), parseInt(annee), genereParId);
        break;
      case "RAPPORT_RENTABILITE":
        if (!portefeuilleId) return NextResponse.json({ error: "portefeuilleId requis" }, { status: 400 });
        doc = await genRapportRentabilite(parseInt(portefeuilleId), genereParId);
        break;
      case "RAPPORT_RISQUE":
        if (!portefeuilleId) return NextResponse.json({ error: "portefeuilleId requis" }, { status: 400 });
        doc = await genRapportRisque(parseInt(portefeuilleId), genereParId);
        break;
      case "ETAT_CREANCES":
        doc = await genEtatCreances(portefeuilleId ? parseInt(portefeuilleId) : null, genereParId);
        break;
      case "RAPPORT_FINANCIER":
        doc = await genRapportFinancier(portefeuilleId ? parseInt(portefeuilleId) : null, genereParId);
        break;
      default:
        return NextResponse.json({ error: "Type de document invalide" }, { status: 400 });
    }

    return NextResponse.json({ data: { id: doc.id, titre: doc.titre, type: doc.type } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/documents", error);
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// tests/helpers/fixtures.ts
//
// Fixtures minimales pour les 22 tests (CDC §78) — références aléatoires pour
// ne jamais collisionner entre tests (chacun tourne dans sa propre transaction
// annulée, mais les séquences auto-incrémentées sont partagées par la base).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

export async function createTestClient(tx: TxClient, overrides: Partial<Prisma.ClientCreateInput> = {}) {
  const s = suffixeUnique();
  return tx.client.create({
    data: { nom: `ClientTest${s}`, prenom: "Test", telephone: `+22890${s}`.slice(0, 15), ...overrides },
  });
}

export async function createTestFournisseur(tx: TxClient, overrides: Partial<Prisma.FournisseurCreateInput> = {}) {
  const s = suffixeUnique();
  return tx.fournisseur.create({ data: { nom: `FournisseurTest${s}`, ...overrides } });
}

export async function createTestProduit(tx: TxClient, overrides: Partial<Prisma.ProduitCreateInput> = {}) {
  const s = suffixeUnique();
  return tx.produit.create({
    data: { nom: `ProduitTest${s}`, prixUnitaire: 1000, prixAchat: 600, ...overrides },
  });
}

export async function createTestPdv(tx: TxClient, overrides: Partial<Prisma.PointDeVenteCreateInput> = {}) {
  const s = suffixeUnique();
  return tx.pointDeVente.create({ data: { code: `PDVT${s}`, nom: `PDV Test ${s}`, ...overrides } });
}

export async function createTestUser(tx: TxClient, overrides: Partial<Prisma.UserCreateInput> = {}) {
  const s = suffixeUnique();
  return tx.user.create({
    data: { nom: "Test", prenom: "Comptable", email: `test-${s}@afriges.test`, role: "ADMIN", ...overrides },
  });
}

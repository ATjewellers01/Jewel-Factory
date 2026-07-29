import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

// ── Manufacturer-side store management ────────────────────────────────────────

export async function listStoresByManufacturer(manufacturerId: string) {
  const stores = await prisma.store.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, slug: true, email: true,
      // Contact info
      phone: true, ownerName: true, ownerPhone: true,
      // Address
      city: true, addressStreet: true, addressCity: true, addressState: true, addressPincode: true, addressLandmark: true,
      // Status
      isActive: true, registrationStatus: true, createdAt: true,
      // Store management
      extraBranchAllowance: true,
      badgeLabel: true,
      branches: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, addressCity: true, restockPinHash: true, createdAt: true,
          managers: { select: { id: true, name: true } },
        },
      },
    },
  });
  return stores.map(({ branches, ...s }) => ({
    ...s,
    branchCount: branches.length,
    storeManagerCount: branches.reduce((sum, b) => sum + b.managers.length, 0),
    branches: branches.map((b) => ({
      ...b,
      managerCount: b.managers.length,
      hasRestockPin: !!b.restockPinHash,
    })),
  }));
}

export async function listPendingRegistrations() {
  return prisma.store.findMany({
    where: { registrationStatus: 'PENDING' },
    orderBy: { registrationSubmittedAt: 'desc' },
    select: {
      id: true, name: true, slug: true, email: true, city: true,
      ownerName: true, ownerPhone: true,
      addressStreet: true, addressCity: true, addressState: true, addressPincode: true, addressLandmark: true,
      registrationSubmittedAt: true,
    },
  });
}

export async function approveRegistration(manufacturerId: string, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, registrationStatus: 'PENDING' } });
  if (!store) return null;
  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      registrationStatus: 'APPROVED',
      registrationReviewedAt: new Date(),
      manufacturerId,
      isActive: true,
    },
    // Return the fields the approval email needs.
    select: {
      id: true, name: true, slug: true, email: true, registrationStatus: true, logoUrl: true,
      managers: { select: { email: true }, where: { isActive: true } },
    },
  });
  return updated;
}

export async function rejectRegistration(storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, registrationStatus: 'PENDING' } });
  if (!store) return null;
  return prisma.store.update({
    where: { id: storeId },
    data: { registrationStatus: 'REJECTED', registrationReviewedAt: new Date(), isActive: false },
    select: { id: true, name: true, registrationStatus: true },
  });
}

export async function updateStoreByManufacturer(
  manufacturerId: string,
  storeId: string,
  input: { name?: string; email?: string; city?: string; phone?: string; extraBranchAllowance?: number; badgeLabel?: string | null },
) {
  const store = await prisma.store.findFirst({ where: { id: storeId, manufacturerId }, select: { id: true } });
  if (!store) return null;
  return prisma.store.update({
    where: { id: storeId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase().trim() } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.extraBranchAllowance !== undefined ? { extraBranchAllowance: input.extraBranchAllowance } : {}),
      ...(input.badgeLabel !== undefined ? { badgeLabel: input.badgeLabel } : {}),
    },
    select: { id: true, name: true, email: true, city: true, phone: true, extraBranchAllowance: true, badgeLabel: true },
  });
}

// ── Manufacturer's own custom badge labels (e.g. "Gold Customer", "Premium") ──

export async function listRetailerBadgeLabels(manufacturerId: string): Promise<string[]> {
  const m = await prisma.manufacturer.findUnique({ where: { id: manufacturerId }, select: { retailerBadgeLabels: true } });
  return m?.retailerBadgeLabels ?? [];
}

export async function addRetailerBadgeLabel(manufacturerId: string, label: string): Promise<string[]> {
  const m = await prisma.manufacturer.findUnique({ where: { id: manufacturerId }, select: { retailerBadgeLabels: true } });
  const existing = m?.retailerBadgeLabels ?? [];
  if (existing.includes(label)) return existing;
  const updated = [...existing, label];
  await prisma.manufacturer.update({ where: { id: manufacturerId }, data: { retailerBadgeLabels: updated } });
  return updated;
}

export async function removeRetailerBadgeLabel(manufacturerId: string, label: string): Promise<string[]> {
  const m = await prisma.manufacturer.findUnique({ where: { id: manufacturerId }, select: { retailerBadgeLabels: true } });
  const updated = (m?.retailerBadgeLabels ?? []).filter((l) => l !== label);
  await prisma.manufacturer.update({ where: { id: manufacturerId }, data: { retailerBadgeLabels: updated } });
  // Unassign this badge from any retailer currently using it, so a deleted label
  // never lingers as an orphaned badgeLabel value on a store.
  await prisma.store.updateMany({ where: { manufacturerId, badgeLabel: label }, data: { badgeLabel: null } });
  return updated;
}

export async function resetStorePassword(manufacturerId: string, storeId: string, newPassword: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, manufacturerId }, select: { id: true } });
  if (!store) return false;
  const hash = await hashPassword(newPassword);
  await prisma.store.update({ where: { id: storeId }, data: { passwordHash: hash } });
  return true;
}

export async function setStoreActive(manufacturerId: string, storeId: string, isActive: boolean) {
  const store = await prisma.store.findFirst({ where: { id: storeId, manufacturerId }, select: { id: true } });
  if (!store) return null;
  return prisma.store.update({ where: { id: storeId }, data: { isActive }, select: { id: true, isActive: true } });
}

export async function deleteStoreByManufacturer(manufacturerId: string, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, manufacturerId }, select: { id: true } });
  if (!store) return false;
  await prisma.store.delete({ where: { id: storeId } });
  return true;
}

// ── Store-side helpers ────────────────────────────────────────────────────────

export async function updateStoreBranding(
  storeId: string,
  input: { logoUrl?: string | null; tagline?: string | null; websiteUrl?: string | null },
) {
  return prisma.store.update({
    where: { id: storeId },
    data: {
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
    },
    select: { id: true, logoUrl: true, tagline: true, websiteUrl: true },
  });
}

export async function updateStoreProfile(
  storeId: string,
  input: {
    name?: string; city?: string; phone?: string;
    addressStreet?: string; addressCity?: string; addressState?: string;
    addressPincode?: string; addressLandmark?: string;
    ownerName?: string; ownerPhone?: string;
  },
) {
  return prisma.store.update({
    where: { id: storeId },
    data: input,
    select: {
      id: true, name: true, city: true, phone: true,
      addressStreet: true, addressCity: true, addressState: true, addressPincode: true, addressLandmark: true,
      ownerName: true, ownerPhone: true,
    },
  });
}

export function formatStoreAddress(store: {
  addressStreet: string | null; addressLandmark: string | null;
  addressCity: string | null; addressState: string | null; addressPincode: string | null;
}): string {
  return [store.addressStreet, store.addressLandmark, store.addressCity, store.addressState, store.addressPincode]
    .filter(Boolean)
    .join(', ');
}

// ── HO Manager management REMOVED ─────────────────────────────────────────────
// The HO Manager role was removed; the Retailer/owner now does all approvals.
// The `store_managers` table + existing rows remain (referenced by historical
// approvals) but there is no create/list/update/delete path any more.

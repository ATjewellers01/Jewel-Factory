import { prisma } from '@/lib/prisma';

// Write side of the manufacturer "Customer Activity" audit log — called from
// the Retailer (store) and Store Manager (branch-manager) login/logout
// routes. Fire-and-forget by design (never blocks or fails a login/logout):
// callers should not `await` this into their response path in a way that a
// logging failure could turn into a 500 for a real login.

export async function recordRetailerLoginEvent(
  event: 'LOGIN' | 'LOGOUT',
  storeId: string,
  manufacturerId: string | null,
) {
  try {
    await prisma.loginEvent.create({
      data: { userType: 'RETAILER', event, storeId, manufacturerId },
    });
  } catch {
    // Never let audit logging break a login/logout.
  }
}

export async function recordBranchManagerLoginEvent(
  event: 'LOGIN' | 'LOGOUT',
  branchManagerId: string,
  storeId: string,
  branchId: string | null,
  manufacturerId: string | null,
) {
  try {
    await prisma.loginEvent.create({
      data: { userType: 'BRANCH_MANAGER', event, storeId, branchManagerId, branchId, manufacturerId },
    });
  } catch {
    // Never let audit logging break a login/logout.
  }
}

import type { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getO2dOrderStatus } from '@/lib/integrations/o2d';
import { getCustomOrderItemsForManufacturer, advanceCustomOrderStatus } from '@/lib/db/custom-design';
import { advanceB2bOrderItemStatus, advanceKioskOrderItemStatus } from '@/lib/db/orders';

/**
 * O2D's Order.currentStage is a free string driven by its own production
 * pipeline (see orderToDispatch_at_jweller_backend's process.routes.ts) --
 * the tail is linear and reliable to key off directly: "HUID Label" ->
 * "Stock In" (lands on O2D's Receive in Stock page) -> "Delivery" (that
 * page's "Save & Receive" action) -> "COMPLETED" (a literal string, set
 * only when O2D's Delivery page's "Mark Delivered" is submitted with
 * Delivery Status = "Complete"). O2D's own `status` enum column is never
 * actually written by any of this -- confirmed dead for this purpose, do
 * not use it.
 */
export function mapO2dStageToStatus(currentStage: string): OrderStatus {
  if (currentStage === 'COMPLETED') return 'COMPLETED';
  if (currentStage === 'Stock In' || currentStage === 'Delivery') return 'READY_FOR_DELIVERY';
  return 'IN_PROCESS';
}

// Cap per call so one page view can't fan out an unbounded number of
// requests to O2D -- a manufacturer with more than this many active O2D
// orders just gets the rest caught up on their next page view.
const MAX_ORDERS_PER_SYNC = 50;

export type SyncSummary = { checked: number; updated: number; failed: number };

function findSyncCandidates(manufacturerId: string) {
  return prisma.customDesignOrder.findMany({
    where: { manufacturerId, o2dOrderId: { not: null }, status: { not: 'COMPLETED' } },
    select: { id: true, o2dOrderId: true, status: true },
    take: MAX_ORDERS_PER_SYNC,
    orderBy: { updatedAt: 'asc' },
  });
}

/**
 * Check-on-view sync: for every CustomDesignOrder this manufacturer has
 * sent to O2D and hasn't already seen complete, ask O2D for its current
 * stage and, if it maps to a different status than what's stored, advance
 * the linked B2bOrderItem/KioskOrderItem rows (the status Retailer
 * Admin/Store Manager actually see -- CustomDesignOrder.status is
 * manufacturer-side bookkeeping nobody else reads) plus the
 * CustomDesignOrder's own status for consistency.
 *
 * Deliberately never throws -- called from page-load paths that must keep
 * working even if O2D is completely unreachable. Each order's check is
 * independently try/caught so one failure (or one unreachable order)
 * never stops the rest from syncing.
 */
export async function syncO2dStatusesForManufacturer(manufacturerId: string): Promise<SyncSummary> {
  const summary: SyncSummary = { checked: 0, updated: 0, failed: 0 };

  let candidates: Awaited<ReturnType<typeof findSyncCandidates>>;
  try {
    candidates = await findSyncCandidates(manufacturerId);
  } catch {
    // DB itself unreachable/erroring -- return the zeroed summary rather
    // than throw, same "never break the page" guarantee as the per-order path.
    return summary;
  }

  for (const candidate of candidates) {
    if (!candidate.o2dOrderId) continue;
    summary.checked++;
    try {
      const o2dStatus = await getO2dOrderStatus(candidate.o2dOrderId);
      const mapped = mapO2dStageToStatus(o2dStatus.currentStage);
      if (mapped === candidate.status) continue;

      const items = await getCustomOrderItemsForManufacturer(manufacturerId, candidate.id);
      for (const item of items ?? []) {
        // Never overwrite a manual cancellation -- O2D has no concept of
        // "cancelled" to reflect back, so a mismatch here always means
        // "the manufacturer deliberately cancelled this on Jewel Factory's
        // side," not "O2D's stage moved backward."
        if (item.status === 'CANCELLED') continue;
        if (item.sourceKind === 'b2b') {
          await advanceB2bOrderItemStatus(manufacturerId, item.sourceOrderId, item.id, mapped);
        } else {
          await advanceKioskOrderItemStatus(manufacturerId, item.sourceOrderId, item.id, mapped);
        }
      }
      await advanceCustomOrderStatus(manufacturerId, candidate.id, mapped);
      summary.updated++;
    } catch {
      summary.failed++;
    }
  }

  return summary;
}

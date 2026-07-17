/**
 * Order chat — per-order messages between the HO Manager and a branch's Store
 * Manager. One polymorphic table (order_messages) serves all three order kinds.
 *
 * Tenancy: every query is scoped by storeId (the retailer). The caller (guard)
 * supplies the storeId, so HO and Store Manager can only touch their own orders.
 */
import type { OrderKind, MessageSender } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function listOrderMessages(storeId: string, orderKind: OrderKind, orderId: string) {
  return prisma.orderMessage.findMany({
    where: { storeId, orderKind, orderId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, senderName: true, body: true, createdAt: true },
  });
}

export async function addOrderMessage(input: {
  storeId: string;
  branchId?: string | null;
  orderKind: OrderKind;
  orderId: string;
  sender: MessageSender;
  senderName?: string | null;
  body: string;
}) {
  return prisma.orderMessage.create({
    data: {
      storeId: input.storeId,
      branchId: input.branchId ?? null,
      orderKind: input.orderKind,
      orderId: input.orderId,
      sender: input.sender,
      senderName: input.senderName ?? null,
      body: input.body,
    },
    select: { id: true, sender: true, senderName: true, body: true, createdAt: true },
  });
}

/** Unread-ish helper: latest message per order (for list badges). Optional use. */
export async function latestMessageAt(storeId: string, orderKind: OrderKind, orderId: string) {
  const m = await prisma.orderMessage.findFirst({
    where: { storeId, orderKind, orderId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return m?.createdAt ?? null;
}

import { redirect } from 'next/navigation';

// Customised Orders no longer has its own list — it's merged into Order
// History (app/store/b2b-orders/page.tsx) alongside Catalog/Kiosk orders.
// This route only exists so old links/bookmarks land somewhere useful.
export default function StoreCustomDesignsRedirect() {
  redirect('/store/b2b-orders');
}

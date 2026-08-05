'use client';

import { PencilLine } from 'lucide-react';

// This page is intentionally empty for now — the sidebar nav entry stays
// active (per client request, 2026-08-05: "abhi ke liye poori tarah khaali
// rakho, baad mein use karenge"), but the Customised Orders list/data that
// used to render here (merged into app/manufacturer/orders/page.tsx per the
// 2026-08-04 punch list item 7) is deliberately not fetched or shown on this
// route. Re-enable by restoring the previous list implementation when the
// manufacturer starts using this page again.
export default function ManufacturerCustomDesignsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customised Orders</h1>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <PencilLine className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Not in use right now.</p>
      </div>
    </div>
  );
}

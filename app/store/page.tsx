import { redirect } from 'next/navigation';

// Opening the Retailer Admin portal lands on Home — the browsing entry point —
// rather than dropping straight into the full catalogue listing.
export default function StoreEntryPage() {
  redirect('/store/home');
}

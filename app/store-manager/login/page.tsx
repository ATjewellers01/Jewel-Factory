import { StaffLoginForm } from '@/components/auth/StaffLoginForm';

export const metadata = { title: 'Store Manager Login' };

export default function StoreManagerLoginPage() {
  return (
    <StaffLoginForm
      title="Store Manager Login"
      subtitle="Sign in to your store — kiosk, try-on, search & restock."
      loginPath="/api/branch-manager/login"
      redirectTo="/store-manager"
      footerLinks={[{ prompt: 'Retailer or HO Manager?', label: 'Staff portal', href: '/portal' }]}
    />
  );
}

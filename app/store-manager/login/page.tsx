import { PortalLoginScreen } from '@/components/auth/PortalLoginScreen';

export const metadata = { title: 'Retailer User Login' };

export default function StoreManagerLoginPage() {
  return (
    <PortalLoginScreen
      portal="manager"
      loginPath="/api/branch-manager/login"
      redirectTo="/store-manager"
      footerLinks={[{ prompt: 'Retailer Admin account?', label: 'Open Retailer Admin sign in', href: '/store/login' }]}
    />
  );
}

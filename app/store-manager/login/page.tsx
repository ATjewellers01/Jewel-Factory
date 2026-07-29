import { PortalLoginScreen } from '@/components/auth/PortalLoginScreen';

export const metadata = { title: 'Store Manager Login' };

export default function StoreManagerLoginPage() {
  return (
    <PortalLoginScreen
      portal="manager"
      loginPath="/api/branch-manager/login"
      redirectTo="/store-manager"
      footerLinks={[{ prompt: 'Purchase manager account?', label: 'Open purchase manager sign in', href: '/store/login' }]}
    />
  );
}

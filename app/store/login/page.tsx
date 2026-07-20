import { PortalLoginScreen } from '@/components/auth/PortalLoginScreen';

export const metadata = { title: 'Retailer Login' };

export default function StoreLoginPage() {
  return (
    <PortalLoginScreen
      portal="retailer"
      loginPath="/api/store/login"
      redirectTo="/store/dashboard"
      forgotHref="/store/forgot-password"
      footerLinks={[
        { prompt: 'New retailer?', label: 'Register here', href: '/store/register' },
      ]}
    />
  );
}

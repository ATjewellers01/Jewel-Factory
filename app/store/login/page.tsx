import { PortalLoginScreen } from '@/components/auth/PortalLoginScreen';

export const metadata = { title: 'Retailer Admin Login' };

export default function StoreLoginPage() {
  return (
    <PortalLoginScreen
      portal="retailer"
      loginPath="/api/store/login"
      redirectTo="/store/dashboard"
      forgotHref="/store/forgot-password"
      footerLinks={[
        { prompt: 'New Retailer Admin?', label: 'Register here', href: '/store/register' },
      ]}
    />
  );
}

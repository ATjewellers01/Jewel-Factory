import { StaffLoginForm } from '@/components/auth/StaffLoginForm';

export const metadata = { title: 'HO Manager Login' };

export default function ManagerLoginPage() {
  return (
    <StaffLoginForm
      title="HO Manager Login"
      subtitle="Head-Office manager — approve orders & custom requests."
      loginPath="/api/manager/login"
      redirectTo="/store/dashboard"
      forgotHref="/store/manager/forgot-password"
      footerLinks={[
        { prompt: 'Retailer?', label: 'Sign in here', href: '/store/login' },
        { prompt: 'Store Manager?', label: 'Sign in here', href: '/store-manager/login' },
      ]}
    />
  );
}

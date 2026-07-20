import { PortalLoginScreen } from '@/components/auth/PortalLoginScreen';

export function ManufacturerLoginScreen() {
  return (
    <PortalLoginScreen
      portal="manufacturer"
      loginPath="/api/manufacturer/login"
      redirectTo="/manufacturer/dashboard"
    />
  );
}

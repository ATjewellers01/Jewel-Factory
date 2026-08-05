import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata = { title: 'Forgot Password' };

export default function StoreForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      title="Forgot password"
      apiPath="/api/store/forgot-password"
      backHref="/store/login"
    />
  );
}

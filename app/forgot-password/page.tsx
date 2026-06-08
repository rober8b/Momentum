import { ForgotForm } from './ForgotForm';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            command
          </p>
          <h1 className="text-2xl font-semibold">center</h1>
          <p className="text-xs text-muted-foreground mt-2">resetear contraseña</p>
        </div>
        <ForgotForm />
      </div>
    </div>
  );
}

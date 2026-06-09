import { requireUser } from '@/lib/auth';
import { ProfileForm } from '@/components/settings/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">perfil</h1>
        <p className="text-sm text-muted-foreground">
          preferencias de cuenta y configuración del dashboard.
        </p>
      </div>
      <ProfileForm user={user} />
    </div>
  );
}

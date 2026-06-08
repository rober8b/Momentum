import 'server-only';

/**
 * Sends a password reset email.
 * - If RESEND_API_KEY is set → sends via Resend
 * - Otherwise → logs the link to console (log-mode for dev/self-hosted without SMTP)
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
  displayName: string | null;
}): Promise<void> {
  const { to, resetLink, displayName } = params;
  const name = displayName ?? to;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'command-center <noreply@roberb.dev>';

  if (!apiKey) {
    // Log-mode: link visible in server logs / Vercel runtime logs
    console.log(`[password-reset] link para ${to}: ${resetLink}`);
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to,
    subject: 'resetear contraseña — command center',
    html: `
      <p>Hola ${name},</p>
      <p>Recibimos una solicitud para resetear tu contraseña.</p>
      <p>
        <a href="${resetLink}" style="color:#6366f1;font-weight:600;">
          Resetear contraseña →
        </a>
      </p>
      <p style="color:#888;font-size:12px;">
        Este link expira en 1 hora. Si no pediste el reseteo, ignorá este email.
      </p>
    `,
  });
}

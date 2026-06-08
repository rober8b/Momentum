import 'server-only';

async function send(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    console.log(`[email:log-mode] to=${params.to} subject="${params.subject}"`);
    const match = params.html.match(/href="([^"]+)"/);
    if (match) console.log(`[email:log-mode] link: ${match[1]}`);
    return;
  }

  if (!from) {
    throw new Error(
      'EMAIL_FROM env var is required when RESEND_API_KEY is set. ' +
      'Set it to an email address from a domain you control (e.g., noreply@yourdomain.com).',
    );
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
  displayName: string | null;
}): Promise<void> {
  const name = params.displayName ?? params.to;
  await send({
    to: params.to,
    subject: 'resetear contraseña — momentum',
    html: `
      <p>Hola ${name},</p>
      <p>Recibimos una solicitud para resetear tu contraseña.</p>
      <p><a href="${params.resetLink}" style="color:#6366f1;font-weight:600;">Resetear contraseña →</a></p>
      <p style="color:#888;font-size:12px;">Este link expira en 1 hora. Si no pediste el reseteo, ignorá este email.</p>
    `,
  });
}

export async function sendEmailConfirmation(params: {
  to: string;
  confirmLink: string;
  displayName: string;
}): Promise<void> {
  const name = params.displayName || params.to;
  await send({
    to: params.to,
    subject: 'confirmá tu cuenta — momentum',
    html: `
      <p>Hola ${name},</p>
      <p>Gracias por registrarte. Confirmá tu cuenta haciendo click en el link:</p>
      <p><a href="${params.confirmLink}" style="color:#6366f1;font-weight:600;">Confirmar cuenta →</a></p>
      <p style="color:#888;font-size:12px;">Este link expira en 24 horas.</p>
    `,
  });
}

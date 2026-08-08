import { Resend } from 'resend';
import { env } from '../config/env';

const resend = env.email.resendApiKey ? new Resend(env.email.resendApiKey) : null;

interface SendInviteEmailInput {
  toEmail: string;
  fullName: string;
  tempPassword: string;
  role: 'admin' | 'team_lead' | 'staff';
}

const ROLE_LABELS: Record<SendInviteEmailInput['role'], string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  staff: 'Staff',
};

/**
 * Sends the "you've been invited" email with login credentials and an Accept
 * Invite button that lands on the login page. Swallows send failures (logs
 * them) so account creation never fails just because the mailer is down —
 * the caller still has the temp password to hand over manually.
 */
export async function sendInviteEmail(input: SendInviteEmailInput): Promise<void> {
  if (!resend) {
    console.error('RESEND_API_KEY not configured — skipping invite email to', input.toEmail);
    return;
  }

  const loginUrl = `${env.frontendUrl}/login?email=${encodeURIComponent(input.toEmail)}`;
  const roleLabel = ROLE_LABELS[input.role];

  try {
    const { error } = await resend.emails.send({
      from: env.email.from,
      to: input.toEmail,
      replyTo: env.email.replyTo,
      subject: 'You’re invited to Tijarat Developers CRM',
      html: renderInviteEmail({ ...input, roleLabel, loginUrl }),
    });
    if (error) {
      console.error('Failed to send invite email', error);
    }
  } catch (err) {
    console.error('Failed to send invite email', err);
  }
}

function renderInviteEmail(input: {
  fullName: string;
  toEmail: string;
  tempPassword: string;
  roleLabel: string;
  loginUrl: string;
}): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 4px;">Welcome to Tijarat Developers CRM</h1>
      <p style="font-size: 14px; color: #4b5563; margin-top: 0;">
        Hi ${escapeHtml(input.fullName)}, you've been added as <strong>${escapeHtml(input.roleLabel)}</strong>.
        Use the credentials below to sign in.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(input.toEmail)}</p>
        <p style="margin: 0;"><strong>Password:</strong> <code>${escapeHtml(input.tempPassword)}</code></p>
      </div>
      <a href="${input.loginUrl}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px;">
        Accept Invite
      </a>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
        Clicking the button takes you to the sign-in page — enter the email and password above to log in.
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

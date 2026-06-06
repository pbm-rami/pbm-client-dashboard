export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/send-magic-link
 * ================================
 * Generates a signed magic-link token and sends it to the user's email.
 *
 * Security:
 *   - Always returns { sent: true } regardless of whether the email is
 *     registered — prevents email enumeration attacks.
 *   - Token is HMAC-signed (see lib/magic-token.js) and expires in 15 min.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from resend.com (free: 3,000 emails/month)
 *   EMAIL_FROM       — e.g. "Pricing By Mira <noreply@yourdomain.com>"
 *   NEXTAUTH_URL     — e.g. "https://your-app.vercel.app"
 *   NEXTAUTH_SECRET  — used for HMAC signing
 */

import { BigQuery }           from '@google-cloud/bigquery';
import { generateMagicToken } from '@/lib/magic-token';
import { Resend }             from 'resend';

let _bq = null;
function getBQ() {
  if (!_bq) {
    _bq = new BigQuery({
      projectId:   process.env.GCP_PROJECT_ID,
      credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
    });
  }
  return _bq;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = body?.email?.trim()?.toLowerCase();
  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  // ── Look up email in app_clients ─────────────────────────────────────────
  let clientExists = false;
  try {
    const [rows] = await getBQ().query({
      query: `
        SELECT id
        FROM \`pbm-pl-data-bank.mira_app.app_clients\`
        WHERE LOWER(email) = LOWER(@email)
          AND is_active = TRUE
        LIMIT 1
      `,
      params:   { email },
      location: 'US',
    });
    clientExists = rows.length > 0;
  } catch (err) {
    console.error('[send-magic-link] BigQuery error:', err.message);
    // Don't expose the error — return generic sent response
    return Response.json({ sent: true });
  }

  // Always return sent:true — don't reveal whether email is registered
  if (!clientExists) {
    console.log('[send-magic-link] Email not found in app_clients (silent):', email);
    return Response.json({ sent: true });
  }

  // ── Generate token + build login URL ─────────────────────────────────────
  const token    = generateMagicToken(email);
  const baseUrl  = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? '';
  const loginUrl = `${baseUrl}/login?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  // ── Send email via Resend ─────────────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    console.error('[send-magic-link] RESEND_API_KEY is not set');
    return Response.json({ error: 'Email service not configured' }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from   = process.env.EMAIL_FROM || 'Pricing By Mira <noreply@pricingbymira.com>';

  try {
    const { error } = await resend.emails.send({
      from,
      to:      email,
      subject: 'Your sign-in link — PBM Client Portal',
      html:    buildEmailHtml(loginUrl),
    });
    if (error) throw new Error(error.message);
    console.log('[send-magic-link] Email sent to:', email);
  } catch (err) {
    console.error('[send-magic-link] Resend error:', err.message);
    return Response.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
  }

  return Response.json({ sent: true });
}


// ── Email template ──────────────────────────────────────────────────────────
function buildEmailHtml(loginUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to PBM Client Portal</title>
</head>
<body style="margin:0;padding:0;background-color:#212327;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#212327;padding:48px 24px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background-color:#2a2c30;border-radius:16px;overflow:hidden;border:1px solid #383b40;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #383b40;">
              <p style="margin:0 0 8px;color:#e4cf8b;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">
                PRICING BY MIRA
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
                Sign in to your Client Portal
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Click the button below to sign in instantly.
              </p>
              <p style="margin:0 0 32px;color:#64748b;font-size:13px;">
                This link expires in <strong style="color:#cbd5e1;">15 minutes</strong> and can only be used once.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:10px;background-color:#f59e0b;">
                    <a href="${loginUrl}"
                       style="display:inline-block;padding:15px 40px;color:#1c1e22;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                      Sign In to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                If you didn't request this link, you can safely ignore this email.<br>
                Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #383b40;text-align:center;">
              <p style="margin:0;color:#374151;font-size:11px;">
                Powered by Pricing By Mira &nbsp;·&nbsp; Revenue Intelligence
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

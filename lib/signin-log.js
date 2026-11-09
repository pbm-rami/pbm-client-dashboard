/**
 * Minimal append-only sign-in telemetry.
 *
 * Purpose: answer ONE question — does anyone still authenticate with the
 * password (credentials) provider, so it can be retired? See CLAUDE.md
 * issue #14. Review after 2–4 weeks (long enough to cover at least one
 * monthly reporting cycle, since clients may only sign in when reports land).
 *
 * This is deliberately NOT a general audit log: four columns, no IP, no user
 * agent, no session id. If a real audit trail is ever needed, that is a
 * separate design — don't grow this one into it.
 *
 * Writes are fire-and-forget: a logging failure must never block a sign-in,
 * so every error is swallowed after being logged to stdout.
 */

const TABLE = '`pbm-pl-data-bank.mira_app.app_signin_log`';

export async function logSignIn(bigquery, { email, provider, success }) {
  try {
    await bigquery.query({
      query: `
        INSERT INTO ${TABLE} (ts, email, provider, success)
        VALUES (CURRENT_TIMESTAMP(), @email, @provider, @success)
      `,
      params: {
        email:    (email ?? '').trim().toLowerCase() || null,
        provider: provider ?? 'unknown',
        success:  Boolean(success),
      },
      types: { email: 'STRING', provider: 'STRING', success: 'BOOL' },
      location: 'US',
    });
  } catch (err) {
    // Never surface this to the caller — telemetry must not break auth.
    console.error('[signin-log] write failed (ignored):', err.message);
  }
}

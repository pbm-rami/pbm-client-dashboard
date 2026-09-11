/**
 * NextAuth configuration (authOptions)
 *
 * Authentication strategy:
 *   - CredentialsProvider: email + password (plain-text comparison)
 *   - Client registry stored in BigQuery mira_app.app_clients
 *   - JWT carries client_name + client_names → exposed on session.user.*
 *   - All BigQuery queries are filtered by those client name(s)
 *
 * Client scoping (partner sub-access):
 *   client_names ARRAY<STRING> lets one login see several clients. It takes
 *   precedence over the legacy single client_name when non-empty. Note that a
 *   BigQuery ARRAY is never NULL — unset rows read back as an empty array — so
 *   the resolution check is ARRAY_LENGTH/.length, never a null check.
 *   See lib/client.js getClientNames().
 *
 * Password storage — migrating to bcrypt (CLAUDE.md issue #14):
 *   Passwords were historically stored in PLAIN TEXT in app_clients.password.
 *   The old justification in this comment claimed bcrypt was impossible because
 *   dotenv-expand corrupts the $ in "$2b$10$" hashes, and that this file was
 *   gitignored. Both were wrong: passwords live in BigQuery and are read at
 *   runtime by a query, so they never pass through dotenv at all, and this file
 *   is tracked source code.
 *
 *   Migration strategy — hash on next login, additive and non-breaking:
 *     1. password_hash IS NOT NULL  → bcrypt.compare against it (steady state)
 *     2. password_hash IS NULL      → compare the legacy plain-text password;
 *                                     on success, hash it and write it back
 *     3. neither set                → reject
 *   The plain-text `password` column is intentionally RETAINED for now so the
 *   change is reversible. Drop it only once every active password account has
 *   a hash — check with the readiness query in CLAUDE.md issue #14.
 *
 * Client source: BigQuery mira_app.app_clients — managed via /admin/clients
 */

import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider       from 'next-auth/providers/google';
import { BigQuery }         from '@google-cloud/bigquery';
import { verifyMagicToken } from '@/lib/magic-token';
import { logSignIn }       from '@/lib/signin-log';
import bcrypt              from 'bcryptjs';

// Cost factor for new hashes. 10 ≈ 60-100ms per verify on Vercel — high enough
// to be meaningful, low enough not to stall a serverless cold start.
const BCRYPT_ROUNDS = 10;

// Lazy singleton — avoids JSON.parse crash at build time when env isn't available
let _bigquery = null;
function getBigQuery() {
  if (!_bigquery) {
    if (!process.env.GCP_PROJECT_ID) {
      throw new Error('[auth] GCP_PROJECT_ID env var is not set');
    }
    if (!process.env.GCP_SERVICE_ACCOUNT_JSON) {
      throw new Error('[auth] GCP_SERVICE_ACCOUNT_JSON env var is not set');
    }
    let credentials;
    try {
      credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('[auth] GCP_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message);
    }
    _bigquery = new BigQuery({
      projectId:   process.env.GCP_PROJECT_ID,
      credentials,
    });
  }
  return _bigquery;
}

/**
 * Look up a client by email from mira_app.app_clients.
 */
async function getClientByEmail(email) {
  const bigquery = getBigQuery();
  const [rows] = await bigquery.query({
    query: `
      SELECT id, display_name, email, password, password_hash, client_name, client_names, role
      FROM \`pbm-pl-data-bank.mira_app.app_clients\`
      WHERE LOWER(email) = LOWER(@email)
        AND is_active = TRUE
      LIMIT 1
    `,
    params:   { email },
    location: 'US',
  });
  return rows[0] ?? null;
}

/**
 * Verify a submitted password against a client row, migrating it to bcrypt
 * on the way through.
 *
 * Returns true when the password is correct. When it was validated against the
 * legacy plain-text column, a bcrypt hash is written back so subsequent logins
 * take the hashed path. The write-back is best-effort: if it fails the user is
 * still signed in and the next login simply retries the migration.
 */
async function verifyPassword(bigquery, client, submitted) {
  // ── Steady state: a hash exists ────────────────────────────────────────
  if (client.password_hash) {
    try {
      return await bcrypt.compare(submitted, client.password_hash);
    } catch (err) {
      console.error('[auth] bcrypt.compare failed for:', client.email, err.message);
      return false;
    }
  }

  // ── Legacy: plain-text comparison, then migrate ────────────────────────
  if (!client.password) return false;
  if (submitted !== client.password) return false;

  try {
    const hash = await bcrypt.hash(submitted, BCRYPT_ROUNDS);
    await bigquery.query({
      query: `
        UPDATE \`pbm-pl-data-bank.mira_app.app_clients\`
        SET password_hash = @hash, updated_at = CURRENT_TIMESTAMP()
        WHERE id = @id AND password_hash IS NULL
      `,
      params:   { hash, id: client.id },
      location: 'US',
    });
    console.log('[auth] migrated password to bcrypt for:', client.email);
  } catch (err) {
    // Non-fatal: the login succeeds, migration retries next time.
    console.error('[auth] password hash write-back failed for:', client.email, err.message);
  }
  return true;
}

export const authOptions = {
  providers: [
    // ── Google Workspace SSO (staff + admin) ─────────────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    // ── Email + password (external clients — optional fallback) ─────────────
    CredentialsProvider({
      id:   'credentials',
      name: 'Password',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          // Still a password-auth *attempt* — record it (when an email was given)
          // so the usage question in CLAUDE.md issue #14 isn't undercounted by
          // fumbled submits. Skipped entirely when there is no email, to avoid
          // logging malformed/bot requests.
          if (credentials?.email) {
            await logSignIn(getBigQuery(), { email: credentials.email, provider: 'credentials', success: false });
          }
          return null;
        }

        let client;
        try {
          client = await getClientByEmail(credentials.email);
        } catch (err) {
          console.error('[auth] BigQuery error in getClientByEmail:', err.message, err.stack);
          return null;
        }

        if (!client) {
          console.log('[auth] No user found for email:', credentials.email);
          await logSignIn(getBigQuery(), { email: credentials.email, provider: 'credentials', success: false });
          return null;
        }

        if (!client.password && !client.password_hash) {
          console.error('[auth] User has no password set — use Google or magic link:', credentials.email);
          await logSignIn(getBigQuery(), { email: credentials.email, provider: 'credentials', success: false });
          return null;
        }

        const ok = await verifyPassword(getBigQuery(), client, credentials.password);
        if (!ok) {
          console.log('[auth] Password mismatch for:', credentials.email);
          await logSignIn(getBigQuery(), { email: credentials.email, provider: 'credentials', success: false });
          return null;
        }

        await logSignIn(getBigQuery(), { email: credentials.email, provider: 'credentials', success: true });

        return {
          id:           client.id,
          name:         client.display_name,
          email:        client.email,
          client_name:  client.client_name ?? null,
          client_names: client.client_names ?? [],
          role:         client.role || 'client',
        };
      },
    }),

    // ── Magic link (passwordless — primary sign-in method for clients) ────────
    // Flow: /api/auth/send-magic-link sends a signed token via email.
    // User clicks the link → /login?token=xxx&email=yyy → this provider validates it.
    CredentialsProvider({
      id:   'magic-link',
      name: 'Magic Link',
      credentials: {
        email: { label: 'Email', type: 'email' },
        token: { label: 'Token', type: 'text'  },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.token) return null;

        // Verify HMAC signature + expiry (15-minute window)
        const payload = verifyMagicToken(credentials.token);
        if (!payload) {
          console.log('[auth] Magic token invalid or expired for:', credentials.email);
          await logSignIn(getBigQuery(), { email: credentials.email, provider: 'magic-link', success: false });
          return null;
        }
        if (payload.email !== credentials.email.trim().toLowerCase()) {
          console.log('[auth] Magic token email mismatch');
          await logSignIn(getBigQuery(), { email: credentials.email, provider: 'magic-link', success: false });
          return null;
        }

        let client;
        try {
          client = await getClientByEmail(credentials.email);
        } catch (err) {
          console.error('[auth] BigQuery error in magic-link authorize:', err.message);
          return null;
        }

        if (!client) {
          console.log('[auth] Magic link: no active user for email:', credentials.email);
          await logSignIn(getBigQuery(), { email: credentials.email, provider: 'magic-link', success: false });
          return null;
        }

        console.log('[auth] Magic link sign-in approved for:', credentials.email, '— role:', client.role);
        await logSignIn(getBigQuery(), { email: credentials.email, provider: 'magic-link', success: true });
        return {
          id:           client.id,
          name:         client.display_name,
          email:        client.email,
          client_name:  client.client_name ?? null,
          client_names: client.client_names ?? [],
          role:         client.role || 'client',
        };
      },
    }),
  ],

  callbacks: {
    // Block Google sign-ins for emails not in app_clients
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          const client = await getClientByEmail(user.email);
          if (!client) {
            console.log('[auth] Google sign-in blocked — email not in app_clients:', user.email);
            await logSignIn(getBigQuery(), { email: user.email, provider: 'google', success: false });
            return false;
          }
          console.log('[auth] Google sign-in approved for:', user.email, '— role:', client.role);
          await logSignIn(getBigQuery(), { email: user.email, provider: 'google', success: true });
          return true;
        } catch (err) {
          console.error('[auth] Google sign-in BigQuery error:', err.message);
          return false;
        }
      }
      // Credentials provider handles its own validation in authorize()
      return true;
    },

    // Persist client_name, role in the JWT so it survives page refreshes
    async jwt({ token, user, account }) {
      // Google sign-in: fetch role + client_name from BigQuery
      if (account?.provider === 'google') {
        try {
          const client = await getClientByEmail(token.email);
          if (client) {
            token.role         = client.role || 'client';
            token.client_name  = client.client_name ?? null;
            token.client_names = client.client_names ?? [];
            token.display_name = client.display_name || token.name;
            console.log('[auth] Google jwt — role:', token.role, 'for:', token.email);
          }
        } catch (err) {
          console.error('[auth] Google jwt BigQuery error:', err.message);
        }
      }

      // Credentials or magic-link sign-in: user object already has our custom fields
      if (user && (account?.provider === 'credentials' || account?.provider === 'magic-link')) {
        token.client_name  = user.client_name ?? null;
        token.client_names = user.client_names ?? [];
        token.display_name = user.name;
        token.role         = user.role || 'client';
        console.log('[auth] jwt callback — provider:', account.provider, '— role:', token.role, 'for:', user.email);
      }

      return token;
    },

    // Expose client_name, role on the session object read by useSession() and getServerSession()
    async session({ session, token }) {
      if (token) {
        session.user.client_name  = token.client_name ?? null;
        session.user.client_names = token.client_names ?? [];
        session.user.display_name = token.display_name;
        session.user.role         = token.role || 'client';
      }
      return session;
    },
  },

  pages: {
    signIn:  '/login',   // custom login page
    error:   '/login',   // redirect errors back to login with ?error=...
    signOut: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60,   // 8-hour sessions — re-login required daily
  },

  secret: process.env.NEXTAUTH_SECRET,
};

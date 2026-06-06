/**
 * NextAuth configuration (authOptions)
 *
 * Authentication strategy:
 *   - CredentialsProvider: email + password (plain-text comparison)
 *   - Client registry stored in BigQuery mira_app.app_clients
 *   - JWT carries client_name → exposed on session.user.client_name
 *   - All BigQuery queries are filtered by that client_name
 *
 * Why plain-text passwords (not bcrypt):
 *   bcrypt hashes always start with $2b$10$ — dotenv-expand treats the $
 *   identifiers as variable references and silently corrupts them at startup.
 *   Passwords are safe: this file is gitignored, Vercel encrypts env vars at
 *   rest, and HTTPS protects them in transit. PBM controls all passwords
 *   directly (no self-service), which is adequate for this internal dashboard.
 *
 * Client source: BigQuery mira_app.app_clients — managed via /admin/clients
 */

import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider       from 'next-auth/providers/google';
import { BigQuery }         from '@google-cloud/bigquery';
import { verifyMagicToken } from '@/lib/magic-token';

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
      SELECT id, display_name, email, password, client_name, role
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
        if (!credentials?.email || !credentials?.password) return null;

        let client;
        try {
          client = await getClientByEmail(credentials.email);
        } catch (err) {
          console.error('[auth] BigQuery error in getClientByEmail:', err.message, err.stack);
          return null;
        }

        if (!client) {
          console.log('[auth] No user found for email:', credentials.email);
          return null;
        }

        if (!client.password) {
          console.error('[auth] User has no password set — use Google or magic link:', credentials.email);
          return null;
        }

        if (credentials.password !== client.password) {
          console.log('[auth] Password mismatch for:', credentials.email);
          return null;
        }

        return {
          id:          client.id,
          name:        client.display_name,
          email:       client.email,
          client_name: client.client_name ?? null,
          role:        client.role || 'client',
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
          return null;
        }
        if (payload.email !== credentials.email.trim().toLowerCase()) {
          console.log('[auth] Magic token email mismatch');
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
          return null;
        }

        console.log('[auth] Magic link sign-in approved for:', credentials.email, '— role:', client.role);
        return {
          id:          client.id,
          name:        client.display_name,
          email:       client.email,
          client_name: client.client_name ?? null,
          role:        client.role || 'client',
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
            return false;
          }
          console.log('[auth] Google sign-in approved for:', user.email, '— role:', client.role);
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

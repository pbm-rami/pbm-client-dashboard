/**
 * getClientName(session, request?)
 *
 * Returns the BigQuery client_name to filter by.
 *
 * - Regular clients: always their own client_name from the JWT.
 * - Admin users:     can pass ?client=<name> in the request URL to view
 *                    any client's data.  If no ?client= param is given,
 *                    admin sees all data (returns null → no WHERE filter).
 *
 * Falls back to DASHBOARD_CLIENT_NAME env var so Vercel previews still work.
 *
 * Usage in API routes:
 *   import { getClientName, isAdmin } from '@/lib/client';
 *   const clientName = getClientName(session, request);   // Phase 3+
 *   const clientName = getClientName(session);            // Phase 2 compat
 *   const clientName = getClientName();                   // Phase 1 compat
 */
export function getClientName(session, request = null) {
  // Admin and staff: respect ?client= query param if present
  if (canViewAllClients(session) && request) {
    try {
      const url      = new URL(request.url);
      const override = url.searchParams.get('client');
      if (override) return decodeURIComponent(override);
    } catch {
      // request.url was not a valid absolute URL (e.g. during prerender) — ignore
    }
    // No ?client= param → return null so caller can skip WHERE filter
    return null;
  }

  return (
    session?.user?.client_name ||
    process.env.DASHBOARD_CLIENT_NAME ||
    'Emile Sakhel'   // last-resort fallback — never blank for regular clients
  );
}

/**
 * isAdmin(session) → boolean
 * True only for role: "admin" — can manage users, access /admin/clients.
 */
export function isAdmin(session) {
  return session?.user?.role === 'admin';
}

/**
 * canViewAllClients(session) → boolean
 * True for "admin" and "staff" — can see the full /clients grid and
 * drill into any client dashboard, but staff cannot manage users.
 */
export function canViewAllClients(session) {
  const role = session?.user?.role;
  return role === 'admin' || role === 'staff';
}

/**
 * Client-scoping helpers.
 *
 * A login is scoped to one or more BigQuery client_name values:
 *
 *   - `client_names` (ARRAY<STRING>)  — preferred, supports partner sub-access
 *                                       where one login sees several clients.
 *   - `client_name`  (STRING)         — legacy single-client field. Still the
 *                                       source of truth for the ~279 existing
 *                                       single-client logins that have not been
 *                                       migrated (and may never need to be).
 *
 * Resolution order: use `client_names` when it is non-empty, otherwise fall
 * back to `[client_name]`.
 *
 * IMPORTANT — why ARRAY_LENGTH and not a null check:
 *   BigQuery ARRAY columns are never NULL. A row that has never been assigned
 *   any value reads back as an EMPTY array, not NULL. Verified against the live
 *   table: all 295 rows returned ARRAY_LENGTH = 0 and zero returned IS NULL.
 *   An `IS NULL` / `?? ` style check would therefore never fire and every
 *   legacy login would silently resolve to "no clients".
 *
 * Return contract for getClientNames():
 *   null  → apply NO filter (staff/admin see everything)
 *   []    → match NOTHING (blank/unresolvable scope — deliberately fails closed)
 *   [...] → filter to these client_name values
 */

/**
 * getClientNames(session, request?) → string[] | null
 *
 * - Regular clients: the client_name(s) their login is scoped to.
 * - Admin / staff:   `null` (no filter), unless a ?client=<name> override is
 *                    present in the request URL, in which case just that one.
 */
export function getClientNames(session, request = null) {
  // ── Staff and admin: full access, with optional ?client= drill-down ───────
  if (canViewAllClients(session)) {
    if (request) {
      try {
        const override = new URL(request.url).searchParams.get('client');
        if (override) return [decodeURIComponent(override)];
      } catch {
        // request.url was not a valid absolute URL (e.g. during prerender) — ignore
      }
    }
    return null;   // no ?client= → no WHERE filter → all clients
  }

  // ── Multi-client logins (partner sub-access) ─────────────────────────────
  const many = session?.user?.client_names;
  if (Array.isArray(many)) {
    const cleaned = many.map(n => String(n).trim()).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }

  // ── Legacy single-client logins ──────────────────────────────────────────
  const one = session?.user?.client_name;
  if (one && String(one).trim()) return [String(one).trim()];

  // ── No session at all: local dev / Vercel preview convenience ────────────
  // Only applies when there is genuinely no session. A *logged-in* user whose
  // scope is blank must never inherit this — see the fail-closed note below.
  if (!session && process.env.DASHBOARD_CLIENT_NAME) {
    return [process.env.DASHBOARD_CLIENT_NAME];
  }

  // ── Fail closed ──────────────────────────────────────────────────────────
  // Previously this returned a hardcoded 'Emile Sakhel', which meant any login
  // with a blank or unmatched client_name was served ANOTHER CLIENT'S DATA.
  // An empty array scopes the query to nothing instead.
  console.warn('[client] No client scope resolved for session:', session?.user?.email ?? '(none)');
  return [];
}

/**
 * getClientName(session, request?) → string | null
 *
 * Backwards-compatible shim for callers that still expect a single name.
 * Returns the first resolved client_name, or null when unfiltered (staff/admin).
 * Prefer getClientNames() in new code — this cannot represent a multi-client login.
 */
export function getClientName(session, request = null) {
  const names = getClientNames(session, request);
  if (names === null) return null;
  return names[0] ?? null;
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

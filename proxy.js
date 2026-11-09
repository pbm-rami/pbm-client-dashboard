import { withAuth } from 'next-auth/middleware';

/**
 * Route protection:
 * - /login        → public (the sign-in page itself)
 * - /api/auth/*   → public (NextAuth callbacks and CSRF endpoint)
 * - everything else → requires a valid session (redirects to /login if missing)
 *
 * Next.js 16 renamed middleware.js → proxy.js and needs this file to export a
 * function itself (a bare `export { default } from 'next-auth/middleware'`
 * is rejected at build time). Calling withAuth(req, event) is exactly what
 * that re-export did before.
 */
export function proxy(req, event) {
  return withAuth(req, event);
}

export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

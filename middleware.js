export { default } from 'next-auth/middleware';

/**
 * Route protection:
 * - /login        → public (the sign-in page itself)
 * - /api/auth/*   → public (NextAuth callbacks and CSRF endpoint)
 * - everything else → requires a valid session (redirects to /login if missing)
 */
export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

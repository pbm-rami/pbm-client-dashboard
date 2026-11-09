/**
 * Base URL for links the app emails out (e.g. magic sign-in links).
 *
 * NEXTAUTH_URL is set for Production and Preview alike, so on its own a link
 * requested from a preview deployment would open the live site. Previews
 * therefore link back to themselves, using the address Vercel gives the
 * deployment (VERCEL_BRANCH_URL, else VERCEL_URL). Production and local runs
 * keep using NEXTAUTH_URL.
 *
 * Never built from the request's Host header, so a forged header cannot point
 * a sign-in link at another site.
 */
export function appBaseUrl(env = process.env) {
  if (env.VERCEL_ENV === 'preview') {
    const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
    if (host) return `https://${host}`;
  }
  return (env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
}

/**
 * Password hashing shared by sign-in (lib/auth.js) and the admin client routes.
 *
 * Sign-in checks app_clients.password_hash first and only falls back to the
 * legacy plain-text `password` column when no hash exists. So anything that
 * sets a password must write the hash too — otherwise the old hash keeps
 * winning and the new password is silently ignored.
 */
import bcrypt from 'bcryptjs';

// Cost factor for new hashes. 10 ≈ 60-100ms per verify on Vercel — high enough
// to be meaningful, low enough not to stall a serverless cold start.
export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

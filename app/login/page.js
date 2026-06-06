'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn }                        from 'next-auth/react';
import { useRouter, useSearchParams }    from 'next/navigation';

// ── Google 'G' icon ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── Spinner icon ──────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ── Main login form ───────────────────────────────────────────────────────────
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get('callbackUrl') || '/';
  const tokenParam   = searchParams.get('token');
  const emailParam   = searchParams.get('email');
  const errorParam   = searchParams.get('error');

  // UI modes: 'magic' | 'sent' | 'verifying' | 'password' | 'error'
  const [mode,          setMode]          = useState('magic');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [error,         setError]         = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading,  setMagicLoading]  = useState(false);
  const [pwLoading,     setPwLoading]     = useState(false);

  // ── Map NextAuth error codes to user-friendly messages ───────────────────
  useEffect(() => {
    if (!errorParam) return;
    const msgs = {
      CredentialsSignin: 'Incorrect email or password.',
      AccessDenied:      'Your account is not authorised for this portal. Contact your administrator.',
      OAuthAccountNotLinked: 'That Google account is not linked to a portal account. Contact your administrator.',
      Verification:      'Your sign-in link has expired or already been used. Request a new one below.',
    };
    setError(msgs[errorParam] ?? 'Sign-in failed. Please try again.');
    setMode('magic');
  }, [errorParam]);

  // ── Auto sign-in when token + email are in URL ────────────────────────────
  useEffect(() => {
    if (!tokenParam || !emailParam) return;
    setMode('verifying');
    setError('');

    signIn('magic-link', {
      email:       decodeURIComponent(emailParam),
      token:       decodeURIComponent(tokenParam),
      redirect:    false,
      callbackUrl,
    }).then(result => {
      if (result?.ok) {
        router.push(callbackUrl);
      } else {
        setError('This sign-in link is invalid or has expired. Please request a new one.');
        setMode('magic');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send magic link ───────────────────────────────────────────────────────
  async function handleSendLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setMagicLoading(true);

    try {
      const res  = await fetch('/api/auth/send-magic-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send email');
      setMode('sent');
    } catch (err) {
      setError(err.message || 'Could not send email. Please try again.');
    } finally {
      setMagicLoading(false);
    }
  }

  // ── Password sign-in ──────────────────────────────────────────────────────
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setPwLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setPwLoading(false);
    if (result?.ok) {
      router.push(callbackUrl);
    } else {
      setError('Incorrect email or password. Please try again.');
    }
  }

  // ── Verifying state (auto sign-in in progress) ────────────────────────────
  if (mode === 'verifying') {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-2xl p-10 shadow-xl text-center">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-white font-semibold text-base">Signing you in…</p>
        <p className="text-slate-500 text-sm mt-1">Just a moment</p>
      </div>
    );
  }

  // ── Sent state (magic link emailed) ──────────────────────────────────────
  if (mode === 'sent') {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-2xl p-8 shadow-xl text-center">
        {/* Checkmark */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Check your email</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-1">
          We sent a sign-in link to
        </p>
        <p className="text-white font-semibold text-sm mb-5">{email}</p>
        <p className="text-slate-500 text-xs mb-6">
          The link expires in 15 minutes. Check your spam folder if you don't see it.
        </p>
        <button
          onClick={() => { setMode('magic'); setError(''); }}
          className="text-amber-500 hover:text-amber-400 text-sm font-medium transition-colors"
        >
          ← Use a different email
        </button>
      </div>
    );
  }

  // ── Default / password mode ───────────────────────────────────────────────
  return (
    <div className="bg-[#2a2c30] border border-[#383b40] rounded-2xl p-8 shadow-xl">

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      {/* Google SSO */}
      <button
        type="button"
        disabled={googleLoading}
        onClick={() => { setGoogleLoading(true); signIn('google', { callbackUrl }); }}
        className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-800 font-semibold rounded-lg text-sm transition-colors"
      >
        <GoogleIcon />
        {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[#383b40]" />
        <span className="text-slate-600 text-xs">or</span>
        <div className="flex-1 h-px bg-[#383b40]" />
      </div>

      {mode === 'magic' ? (
        /* ── Magic link form ── */
        <form onSubmit={handleSendLink} className="space-y-4">
          <div>
            <label htmlFor="email-magic" className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2">
              Email Address
            </label>
            <input
              id="email-magic"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#e4cf8b] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={magicLoading || !email.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 disabled:cursor-not-allowed text-[#212327] font-bold rounded-lg text-sm transition-colors"
          >
            {magicLoading ? <><Spinner />Sending…</> : '✉️  Email me a sign-in link'}
          </button>
          <p className="text-center">
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); }}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              I have a password →
            </button>
          </p>
        </form>

      ) : (
        /* ── Password form ── */
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="email-pw" className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2">
              Email Address
            </label>
            <input
              id="email-pw"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#e4cf8b] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#e4cf8b] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-[#212327] font-bold rounded-lg text-sm transition-colors"
          >
            {pwLoading ? <><Spinner />Signing in…</> : 'Sign In'}
          </button>
          <p className="text-center">
            <button
              type="button"
              onClick={() => { setMode('magic'); setError(''); }}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              ← Email me a link instead
            </button>
          </p>
        </form>
      )}

    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#212327] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <p className="text-amber-500 text-xs font-semibold tracking-widest mb-2">
            PRICING BY MIRA
          </p>
          <h1 className="text-2xl font-bold text-white">Client Portal</h1>
          <p className="text-slate-400 text-sm mt-1">
            Sign in to view your performance dashboard
          </p>
        </div>

        {/* Suspense required for useSearchParams in Next.js 14 */}
        <Suspense fallback={
          <div className="bg-[#2a2c30] border border-[#383b40] rounded-2xl p-8 shadow-xl text-center text-slate-400 text-sm">
            Loading…
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by Pricing By Mira · Revenue Intelligence
        </p>

      </div>
    </div>
  );
}

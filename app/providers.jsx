'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Client-side provider wrapper.
 * SessionProvider must live in a client component because it uses
 * React context — this wrapper lets us keep layout.js as a server component.
 */
export default function Providers({ children, session }) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}

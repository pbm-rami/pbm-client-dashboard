'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Format helpers
const fmt$ = v => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtPct = v => v == null ? '—' : Number(v).toFixed(1) + '%';

function GoalBar({ pct }) {
  const clamped = Math.min(Math.max(pct ?? 0, 0), 100);
  const color = pct >= 100 ? '#22c55e' : pct >= 85 ? '#f59e0b' : '#ef4444';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>Revenue Goal</span>
        <span style={{ color }}>{fmtPct(pct)}</span>
      </div>
      <div className="h-1.5 bg-[#383b40] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ClientCard({ client, onClick }) {
  const goalColor =
    client.pct_to_goal >= 100 ? 'text-green-400' :
    client.pct_to_goal >= 85  ? 'text-amber-400' : 'text-red-400';

  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-[#2a2c30] border border-[#383b40] rounded-xl p-5 hover:border-amber-500/50 hover:bg-[#2e3035] transition-all group"
    >
      {/* Client name + arrow */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-base leading-tight group-hover:text-amber-400 transition-colors">
            {client.client_name}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {client.active_listings ?? '—'} listings · {client.total_bedrooms ?? '—'} BR
          </p>
        </div>
        <span className="text-slate-600 group-hover:text-amber-500 transition-colors text-lg">→</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-slate-500 text-xs mb-0.5">Revenue</p>
          <p className="text-white font-semibold text-sm">{fmt$(client.total_rental_revenue)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5">Occupancy</p>
          <p className="text-white font-semibold text-sm">{fmtPct(client.avg_occupancy_pct)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5">RevPAR</p>
          <p className="text-white font-semibold text-sm">{fmt$(client.avg_revpar)}</p>
        </div>
      </div>

      <GoalBar pct={client.pct_to_goal} />

      {/* Month badge */}
      <p className="text-slate-600 text-xs mt-3">{client.month_label}</p>
    </button>
  );
}

export default function ClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');

  const role = session?.user?.role;
  const isAdmin = role === 'admin';
  const canView = role === 'admin' || role === 'staff';

  // Guard: only admin and staff can view /clients
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/login'); return; }
    if (status === 'authenticated' && !canView) { router.replace('/'); return; }
  }, [status, session, router]);

  useEffect(() => {
    if (!canView) return;
    async function load() {
      try {
        const res  = await fetch('/api/clients');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load clients');
        setClients(json.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  const filtered = clients.filter(c =>
    c.client_name.toLowerCase().includes(search.toLowerCase())
  );

  if (status === 'loading' || (status === 'authenticated' && !canView)) {
    return (
      <div className="min-h-screen bg-[#212327] flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#212327] text-slate-200">
      {/* Header */}
      <div className="bg-[#1c1e22] border-b border-[#383b40] px-4 sm:px-8 py-4 sm:py-5">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Image src="/logo.png" alt="Pricing By Mira" width={120} height={80} className="mb-2 rounded" style={{ objectFit: 'contain' }} priority />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Client Portfolio</h1>
            <p className="text-slate-400 text-sm mt-1">
              {loading ? 'Loading…' : `${clients.length} active clients`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/clients')}
                className="text-xs text-slate-400 hover:text-amber-400 bg-[#2a2c30] border border-[#383b40] hover:border-amber-500/40 rounded-full px-3 py-1 transition-colors"
              >
                Manage Users
              </button>
            )}
            <span className="text-xs text-slate-500 bg-[#2a2c30] border border-[#383b40] rounded-full px-3 py-1">
              {isAdmin ? '🔐 Admin' : '👁 Staff'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-6">
        {/* Search bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 px-4 py-2.5 bg-[#2a2c30] border border-[#383b40] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-400">Loading client data…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-slate-500 text-center py-24">
            {search ? `No clients matching "${search}"` : 'No clients found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(client => (
              <ClientCard
                key={client.client_name}
                client={client}
                onClick={() => {
                  const slug = encodeURIComponent(client.client_name);
                  router.push(`/clients/${slug}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

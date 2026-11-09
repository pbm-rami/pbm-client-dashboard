'use client';

/**
 * /admin/properties — group listings that are the same physical property
 * (units that can also be booked together as a combined listing), so the
 * dashboard can show one property with one goal. See lib/property-groups.js.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

const inputCls  = 'w-full px-3 py-2 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/60';
const selectCls = inputCls + ' cursor-pointer';
const card      = 'bg-[#2a2c30] border border-[#383b40] rounded-xl p-4 sm:p-5';
const btn       = 'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-amber-500 hover:bg-amber-400 text-black`;
const btnQuiet   = `${btn} bg-[#212327] border border-[#383b40] text-slate-300 hover:bg-[#32353a]`;

function RoleBadge({ role, unitsCovered }) {
  return role === 'combined'
    ? <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">Combined · books {unitsCovered} units</span>
    : <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-500/15 text-slate-300 border border-slate-500/30">Unit</span>;
}

function MemberList({ members }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {members.map(m => (
        <li key={m.listing_id} className="flex flex-wrap items-center gap-2 text-sm">
          <RoleBadge role={m.member_role} unitsCovered={m.units_covered} />
          <span className="text-white">{m.listing_name ?? m.listing_id}</span>
          {m.bedroom_count != null && <span className="text-slate-500 text-xs">{m.bedroom_count} BR</span>}
        </li>
      ))}
    </ul>
  );
}

// Manual form / editor. `initial` is a saved group or a suggestion (or null).
function GroupForm({ client, listings, initial, tableReady, onCancel, onSaved }) {
  const [name, setName]   = useState(initial?.property_name ?? '');
  const [roles, setRoles] = useState(() => Object.fromEntries((initial?.members ?? []).map(m => [m.listing_id, m.member_role])));
  const [covered, setCovered] = useState(() => Object.fromEntries((initial?.members ?? []).filter(m => m.member_role === 'combined').map(m => [m.listing_id, m.units_covered])));
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const unitCount = Object.values(roles).filter(r => r === 'unit').length;
  const chosen    = listings.filter(l => roles[l.listing_id]);
  const visible   = listings.filter(l => roles[l.listing_id] || l.listing_name.toLowerCase().includes(filter.toLowerCase()));

  function setRole(id, role) {
    setRoles(r => { const next = { ...r }; if (role) next[id] = role; else delete next[id]; return next; });
    if (role === 'combined' && !covered[id]) setCovered(c => ({ ...c, [id]: Math.max(2, unitCount) }));
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const members = chosen.map(l => ({
        listing_id: l.listing_id,
        member_role: roles[l.listing_id],
        units_covered: roles[l.listing_id] === 'combined' ? Number(covered[l.listing_id]) : null,
      }));
      const res  = await fetch('/api/admin/property-groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: initial?.property_id, client_name: client, property_name: name, members }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${card} border-amber-500/40`}>
      <p className="text-amber-500 text-xs font-semibold tracking-widest mb-3">{initial?.property_id ? 'EDIT PROPERTY' : 'NEW PROPERTY'}</p>
      <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">Property name</label>
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Harbor 101 & 102" />

      <div className="flex flex-wrap items-end justify-between gap-3 mt-4 mb-2">
        <p className="text-xs text-slate-400">
          Mark each <b className="text-slate-200">unit</b> (a physical unit) and each <b className="text-slate-200">combined</b> listing
          (books several units at once). Put the revenue goal on whichever listings PriceLabs has it on; the property goal is their total.
        </p>
        <input className={`${inputCls} sm:max-w-[220px]`} value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter listings…" />
      </div>

      <div className="max-h-72 overflow-y-auto border border-[#383b40] rounded-lg divide-y divide-[#383b40]">
        {visible.map(l => (
          <div key={l.listing_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <select className={`${selectCls} !w-auto !py-1`} value={roles[l.listing_id] ?? ''} onChange={e => setRole(l.listing_id, e.target.value)}>
              <option value="">Not in property</option>
              <option value="unit">Unit</option>
              <option value="combined">Combined</option>
            </select>
            {roles[l.listing_id] === 'combined' && (
              <label className="flex items-center gap-1 text-xs text-slate-400">
                books
                <input type="number" min={2} max={Math.max(2, unitCount)} className={`${inputCls} !w-16 !py-1`}
                  value={covered[l.listing_id] ?? 2} onChange={e => setCovered(c => ({ ...c, [l.listing_id]: e.target.value }))} />
                units
              </label>
            )}
            <span className="text-white">{l.listing_name}</span>
            <span className="text-slate-500 text-xs">{l.bedroom_count ?? '—'} BR{l.listing_status && l.listing_status !== 'Live' ? ` · ${l.listing_status}` : ''}</span>
          </div>
        ))}
        {visible.length === 0 && <p className="px-3 py-4 text-slate-500 text-sm">No listings match.</p>}
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button className={btnPrimary} onClick={save} disabled={saving || !tableReady}>{saving ? 'Saving…' : 'Save property'}</button>
        <button className={btnQuiet} onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary for the static build.
export default function AdminPropertiesPage() {
  return <Suspense fallback={null}><AdminProperties /></Suspense>;
}

function AdminProperties() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clientNames, setClientNames] = useState([]);
  const [client, setClient]   = useState(searchParams.get('client') ?? '');
  const [data, setData]       = useState(null);   // { table_ready, groups, suggestions, listings }
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [editing, setEditing] = useState(null);   // null | 'new' | group | suggestion
  const [busy, setBusy]       = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/login'); return; }
    if (session?.user?.role !== 'admin') { router.replace('/'); return; }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role !== 'admin') return;
    fetch('/api/admin/client-names').then(r => r.json()).then(j => setClientNames(j.data || [])).catch(() => {});
  }, [session]);

  const load = useCallback(async () => {
    if (!client) { setData(null); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/admin/property-groups?client=${encodeURIComponent(client)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { if (session?.user?.role === 'admin') load(); }, [session, load]);

  function pickClient(name) {
    setClient(name); setEditing(null);
    router.replace(name ? `/admin/properties?client=${encodeURIComponent(name)}` : '/admin/properties');
  }

  async function confirmSuggestion(s) {
    setBusy(s.key); setError('');
    try {
      const res = await fetch('/api/admin/property-groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: client, property_name: s.property_name, members: s.members }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  async function ungroup(g) {
    if (!window.confirm(`Ungroup "${g.property_name}"? Its listings will show on their own again. No listing data changes.`)) return;
    setBusy(g.property_id); setError('');
    try {
      const res = await fetch(`/api/admin/property-groups/${encodeURIComponent(g.property_id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Ungroup failed');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin')) {
    return <div className="min-h-screen bg-[#212327] flex items-center justify-center"><div className="text-slate-400">Loading…</div></div>;
  }

  const tableReady = data?.table_ready ?? true;

  return (
    <div className="min-h-screen bg-[#212327] text-slate-200">
      <div className="bg-[#1c1e22] border-b border-[#383b40] px-4 sm:px-8 py-4 sm:py-5">
        <div className="max-w-screen-xl mx-auto">
          <button onClick={() => router.push('/admin/clients')} className="text-amber-500 text-xs font-semibold tracking-widest mb-2 hover:text-amber-400">← USER MANAGEMENT</button>
          <p className="text-amber-500 text-xs font-semibold tracking-widest mb-1">PRICING BY MIRA</p>
          <h1 className="text-2xl font-bold text-white">Combined Properties</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Group units that can also be booked together, so the dashboard shows one property:
            revenue and goal added up, and occupancy counted per unit instead of per listing.
          </p>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <select className={`${selectCls} sm:max-w-sm`} value={client} onChange={e => pickClient(e.target.value)}>
            <option value="">Choose a client…</option>
            {clientNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {client && !editing && (
            <button className={btnQuiet} onClick={() => setEditing('new')} disabled={!data}>+ Add property by hand</button>
          )}
        </div>

        {!tableReady && (
          <div className="bg-amber-900/20 border border-amber-700/50 text-amber-300 rounded-lg px-4 py-3 text-sm">
            Properties can’t be saved yet: the <code>mira_app.app_property_groups</code> table hasn’t been created
            (see <code>sql/app_property_groups.sql</code>). Suggestions below are a preview.
          </div>
        )}
        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>}
        {loading && <p className="text-slate-400">Loading…</p>}

        {data && editing && (
          <GroupForm
            key={editing === 'new' ? 'new' : (editing.property_id ?? editing.key)}
            client={client}
            listings={data.listings}
            initial={editing === 'new' ? null : editing}
            tableReady={tableReady}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        )}

        {data && !loading && (
          <>
            <section>
              <h2 className="text-white font-semibold mb-3">Properties <span className="text-slate-500 font-normal">({data.groups.length})</span></h2>
              {data.groups.length === 0 && <p className="text-slate-500 text-sm">None yet for {client}.</p>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.groups.map(g => (
                  <div key={g.property_id} className={card}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-white font-semibold">{g.property_name}</p>
                      <div className="flex gap-2 shrink-0">
                        <button className={btnQuiet} onClick={() => setEditing(g)} disabled={!!busy}>Edit</button>
                        <button className={btnQuiet} onClick={() => ungroup(g)} disabled={!!busy}>{busy === g.property_id ? '…' : 'Ungroup'}</button>
                      </div>
                    </div>
                    <MemberList members={g.members} />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-white font-semibold mb-1">Suggested from listing names <span className="text-slate-500 font-normal">({data.suggestions.length})</span></h2>
              <p className="text-slate-500 text-sm mb-3">Check each one before confirming. Names alone can be wrong.</p>
              {data.suggestions.length === 0 && <p className="text-slate-500 text-sm">No suggestions. Use “Add property by hand” for groups the names don’t reveal.</p>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.suggestions.map(s => (
                  <div key={s.key} className={card}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-white font-semibold">{s.property_name}</p>
                      <div className="flex gap-2 shrink-0">
                        <button className={btnQuiet} onClick={() => setEditing(s)} disabled={!!busy}>Adjust</button>
                        <button className={btnPrimary} onClick={() => confirmSuggestion(s)} disabled={!!busy || !tableReady}>{busy === s.key ? 'Saving…' : 'Confirm'}</button>
                      </div>
                    </div>
                    <MemberList members={s.members} />
                    <ul className="mt-3 space-y-1">
                      {s.checks.map(c => (
                        <li key={c.listing_name} className={`text-xs ${c.bedrooms_match ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {c.bedrooms_match ? '✓' : '⚠'} {c.listing_name}: {c.combined_bedrooms ?? '—'} BR vs units {c.unit_bedrooms} BR
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

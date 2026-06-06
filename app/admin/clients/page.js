'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return v; }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color }) {
  const colors = {
    green:  'bg-emerald-900/40 text-emerald-400 border border-emerald-800/60',
    red:    'bg-red-900/40 text-red-400 border border-red-800/60',
    amber:  'bg-amber-900/40 text-amber-400 border border-amber-800/60',
    blue:   'bg-blue-900/40 text-blue-400 border border-blue-800/60',
    slate:  'bg-slate-800/60 text-slate-400 border border-slate-700/60',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colors[color] ?? colors.slate}`}>
      {children}
    </span>
  );
}

function FormField({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/60';
const selectCls = inputCls + ' cursor-pointer';

// ── Modal ────────────────────────────────────────────────────────────────────

function ClientModal({ mode, client, clientNames, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const empty = {
    display_name: '',
    email:        '',
    password:     '',
    client_name:  '',
    role:         'client',
    is_active:    true,
  };

  const [form, setForm]       = useState(isEdit ? { ...empty, ...client, password: '' } : empty);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const url    = isEdit ? `/api/admin/clients/${client.id}` : '/api/admin/clients';
      const method = isEdit ? 'PUT' : 'POST';

      // For edits, only include password in the payload when the field is non-empty
      const body = { ...form };
      if (isEdit && !body.password) delete body.password;

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-[#1c1e22] border border-[#383b40] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#383b40]">
          <h2 className="text-white font-semibold text-base">
            {isEdit ? `Edit — ${client.display_name}` : 'Add New User'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Display Name">
              <input
                type="text"
                className={inputCls}
                value={form.display_name}
                onChange={e => set('display_name', e.target.value)}
                placeholder="Emile Sakhel"
                required
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="client@example.com"
                required
              />
            </FormField>
          </div>

          <FormField
            label="Password"
            hint={isEdit
              ? 'Leave blank to keep current. Clear it to remove password access.'
              : 'Optional — client can sign in with Google or a magic email link instead.'}
          >
            <input
              type="text"
              className={inputCls}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={isEdit ? '(unchanged)' : 'Leave blank to use Google / magic link'}
              autoComplete="off"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="BigQuery Client Name">
              <select className={selectCls} value={form.client_name ?? ''} onChange={e => set('client_name', e.target.value)}>
                <option value="">— None (Admin) —</option>
                {clientNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Role">
              <select className={selectCls} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="client">client — sees own dashboard only</option>
                <option value="staff">staff — views all clients, read-only</option>
                <option value="admin">admin — full access + user management</option>
              </select>
            </FormField>
          </div>

          {isEdit && (
            <FormField label="Status">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                  onClick={() => set('is_active', !form.is_active)}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-slate-300">{form.is_active ? 'Active' : 'Inactive'}</span>
              </label>
            </FormField>
          )}

          {error && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#383b40]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [clients, setClients]         = useState([]);
  const [clientNames, setClientNames] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [modal, setModal]             = useState(null);  // null | { mode, client? }
  const [togglingId, setTogglingId]   = useState(null);

  // Guard: admins only
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/login'); return; }
    if (session?.user?.role !== 'admin') { router.replace('/'); return; }
  }, [status, session, router]);

  const loadClients = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/clients');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setClients(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.role !== 'admin') return;
    loadClients();
    fetch('/api/admin/client-names')
      .then(r => r.json())
      .then(j => setClientNames(j.data || []))
      .catch(() => {});
  }, [session, loadClients]);

  async function handleToggleActive(client) {
    setTogglingId(client.id);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: !client.is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await loadClients();
    } catch (e) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved() {
    setModal(null);
    loadClients();
  }

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-[#212327] flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  const activeCount   = clients.filter(c => c.is_active).length;
  const inactiveCount = clients.length - activeCount;

  return (
    <div className="min-h-screen bg-[#212327] text-slate-200">
      {/* Header */}
      <div className="bg-[#1c1e22] border-b border-[#383b40] px-4 sm:px-8 py-4 sm:py-5">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/clients')}
              className="text-amber-500 text-xs font-semibold tracking-widest mb-2 hover:text-amber-400 flex items-center gap-1"
            >
              ← ALL CLIENTS
            </button>
            <p className="text-amber-500 text-xs font-semibold tracking-widest mb-1">PRICING BY MIRA</p>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-slate-400 text-sm mt-1">
              {loading ? 'Loading…' : `${activeCount} active · ${inactiveCount} inactive`}
            </p>
          </div>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="self-start sm:self-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-400">Loading client data…</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-24 text-slate-500">
            No clients yet. Add your first client above.
          </div>
        ) : (
          <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#383b40]">
                  {['Name', 'Email', 'BigQuery Client', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 tracking-wider uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#383b40]">
                {clients.map(client => (
                  <tr key={client.id} className={`hover:bg-[#2e3035] transition-colors ${!client.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-white">{client.display_name}</td>
                    <td className="px-4 py-3 text-slate-300">{client.email}</td>
                    <td className="px-4 py-3 text-slate-300">{client.client_name || <span className="text-slate-600 italic">None</span>}</td>
                    <td className="px-4 py-3">
                      <Badge color={client.role === 'admin' ? 'amber' : client.role === 'staff' ? 'blue' : 'slate'}>
                        {client.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={client.is_active ? 'green' : 'red'}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(client.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModal({ mode: 'edit', client })}
                          className="px-3 py-1 text-xs bg-[#383b40] hover:bg-[#44474d] text-slate-300 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(client)}
                          disabled={togglingId === client.id}
                          className={`px-3 py-1 text-xs rounded-lg transition-colors disabled:opacity-50 ${
                            client.is_active
                              ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400'
                              : 'bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400'
                          }`}
                        >
                          {togglingId === client.id ? '…' : client.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ClientModal
          mode={modal.mode}
          client={modal.client}
          clientNames={clientNames}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

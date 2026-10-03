// Operator console → Security: restrict platform-admin access to allowlisted
// public IPs. Enforced by the API (hms-backend middleware/adminIpGate.js) on the
// platform login/refresh, every /platform request, every platform-admin token
// and every impersonation session — and on the admin.mednote.in site itself.

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ShieldCheck, ShieldAlert, Plus, Trash2, MapPin, LifeBuoy } from 'lucide-react';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';

function serverError(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const isLoopbackIp = (ip) => ip === '::1' || /^127\./.test(ip || '') || /^::ffff:127\./.test(ip || '');

function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600',
      )}
    >
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

const sameList = (a, b) =>
  JSON.stringify(a.map((e) => [e.cidr, e.label || ''])) === JSON.stringify(b.map((e) => [e.cidr, e.label || '']));

function AllowlistEditor({ data, onSaved }) {
  const { isSuperAdmin } = useAuth();
  const [entries, setEntries] = useState(data.entries);
  const [cidr, setCidr] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const dirty = !sameList(entries, data.entries);
  const onServer = isLoopbackIp(data.yourIp);
  const myIpListed = entries.some((e) => e.cidr === data.yourIp);

  const save = async (payload) => {
    setSaving(true);
    try {
      const res = await api.put(endpoints.security.ipAllowlist, payload);
      const updated = res.data?.data;
      onSaved(updated);
      toast.success(updated?.enabled ? 'Saved — the console is restricted to these IPs' : 'Saved');
    } catch (err) {
      toast.error(serverError(err, 'Could not save'), { duration: 7000 });
    } finally {
      setSaving(false);
    }
  };

  const add = (value, name) => {
    const v = String(value || '').trim();
    if (!v) return;
    if (entries.some((e) => e.cidr === v)) { toast('Already in the list'); return; }
    setEntries((list) => [...list, { cidr: v, label: String(name || '').trim() || null }]);
    setCidr('');
    setLabel('');
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Card className={clsx('p-5', data.enabled && 'border-emerald-300 dark:border-emerald-500/40')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              data.enabled ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-amber-100 dark:bg-amber-500/20',
            )}>
              {data.enabled
                ? <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                : <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-300" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Restrict console to allowed IPs</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                When on, the operator login, this console (including admin.mednote.in itself) and
                "Login as Hospital" sessions only work from the IPs below. Changes apply within 10 seconds.
                Hospital staff, patients and the mobile apps are not affected.
              </p>
            </div>
          </div>
          <Switch
            label="Restrict console to allowed IPs"
            checked={data.enabled}
            disabled={!isSuperAdmin || saving || dirty}
            onChange={(v) => save({ enabled: v })}
          />
        </div>
        {dirty && <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">Save the list below before switching this on or off.</p>}
        {data.bypassed && (
          <p className="text-xs text-red-700 dark:text-red-300 mt-3">
            SUPER_ADMIN_IP_ALLOWLIST_BYPASS is set on the server — the allowlist is NOT being enforced.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Allowed IPs</h2>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5" /> Your IP right now:
            <span className="font-mono text-gray-900 dark:text-slate-100">{data.yourIp || 'unknown'}</span>
            {onServer
              ? <Badge color="info">on the server — always allowed</Badge>
              : myIpListed ? <Badge color="success">listed</Badge> : <Badge color="warning">not listed</Badge>}
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">No IPs yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 mb-4">
            {entries.map((e) => (
              <div key={e.cidr} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-gray-900 dark:text-slate-100 break-all">
                    {e.cidr}
                    {e.cidr === data.yourIp && <span className="ml-2 font-sans text-xs text-emerald-700 dark:text-emerald-300">you</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {e.label || 'No label'}
                    {e.addedAt ? ` · added ${formatWhen(e.addedAt)}${e.addedBy ? ` by ${e.addedBy}` : ''}` : ' · not saved yet'}
                  </p>
                </div>
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${e.cidr}`}
                    onClick={() => setEntries((list) => list.filter((x) => x.cidr !== e.cidr))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isSuperAdmin ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Input
                label="IP or CIDR range"
                placeholder="103.124.10.6 or 103.124.10.0/24"
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(cidr, label); }}
              />
              <Input
                label="Label"
                placeholder="Office broadband"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(cidr, label); }}
              />
              <Button variant="secondary" icon={Plus} onClick={() => add(cidr, label)}>Add</Button>
            </div>
            {!myIpListed && !onServer && data.yourIp && (
              <Button size="sm" variant="ghost" className="mt-2" icon={Plus} onClick={() => add(data.yourIp, 'Added from console')}>
                Add my current IP ({data.yourIp})
              </Button>
            )}

            <div className="flex justify-end gap-2 mt-5">
              {dirty && <Button variant="secondary" onClick={() => setEntries(data.entries)}>Discard</Button>}
              <Button disabled={!dirty} loading={saving} onClick={() => save({ entries })}>Save list</Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 dark:text-slate-400">Only a super admin can change this list.</p>
        )}
      </Card>

      <Card className="p-5 text-sm text-gray-600 dark:text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy className="w-4 h-4 text-gray-500 dark:text-slate-400" />
          <p className="font-semibold text-gray-900 dark:text-slate-100">If you get locked out</p>
        </div>
        <p>Home and mobile IPs change. The list can't be saved without your own IP, but if your IP changes later:</p>
        <p>
          • On the server, set <code className="font-mono text-xs">SUPER_ADMIN_IP_ALLOWLIST_EXTRA=&lt;new ip&gt;</code> (or{' '}
          <code className="font-mono text-xs">SUPER_ADMIN_IP_ALLOWLIST_BYPASS=true</code>) in the API's environment and restart{' '}
          <code className="font-mono text-xs">mednote-api</code>, then fix the list here.
        </p>
        <p>
          • Requests made from the server itself are always allowed — e.g. an SSH tunnel to the API port:{' '}
          <code className="font-mono text-xs">ssh -L 7099:127.0.0.1:7007 &lt;server&gt;</code>, then call the API on localhost:7099.
        </p>
        {data.extraFromEnv?.length > 0 && (
          <p>• Also allowed by the server's environment: <span className="font-mono">{data.extraFromEnv.join(', ')}</span></p>
        )}
      </Card>
    </div>
  );
}

export default function SecurityPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(endpoints.security.ipAllowlist)
      .then((res) => { if (!cancelled) setData(res.data?.data); })
      .catch((err) => { if (!cancelled) setError(serverError(err, 'Failed to load the IP allowlist')); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <Card className="p-5 text-sm text-red-600 dark:text-red-300 max-w-3xl">{error}</Card>;
  }
  if (!data) {
    return <div className="py-16 flex justify-center"><Spinner size="md" /></div>;
  }
  // Remount on every server response so the draft list resets to what was saved.
  return <AllowlistEditor key={JSON.stringify(data)} data={data} onSaved={setData} />;
}

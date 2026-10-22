// Payments & invoicing for MedNote's OWN fees (not the hospitals' patient
// payments): the Razorpay keys hospitals pay us through from Plan & Billing,
// and the orgnest Invoicing API that raises the GST invoice for every online
// payment. Backend: /platform/integrations (services/platform/integrations.service.js,
// orgnestInvoicing.service.js). Secrets are write-only — the API only ever
// says whether one is set.
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Receipt, PlugZap, RefreshCw, Copy, Check, Eye, EyeOff, KeyRound, BellRing, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { formatCurrency } from '../../utils/formatters';

const serverError = (err, fallback) => err?.response?.data?.message || fallback;

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
    </label>
  );
}

// Password-style input with reveal and copy, and optionally a Generate button.
// Razorpay never issues the webhook secret — it is whatever string the
// merchant types into the webhook form — so it can be minted here: generate,
// copy it across to the Razorpay dashboard, then save. 32 random bytes as hex.
function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function SecretField({ label, value, onChange, disabled, generate, hint, className = '' }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const mint = () => {
    onChange(randomSecret());
    setShow(true);
  };
  return (
    <div className={className}>
      <p className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</p>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            className={show ? 'font-mono text-xs' : ''}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" icon={show ? EyeOff : Eye} title={show ? 'Hide' : 'Show'} aria-label={show ? 'Hide secret' : 'Show secret'} onClick={() => setShow((s) => !s)} />
        <Button type="button" variant="secondary" size="sm" icon={copied ? Check : Copy} title="Copy" aria-label="Copy secret" disabled={!value} onClick={copy} />
        {generate && !disabled && (
          <Button type="button" variant="secondary" size="sm" icon={KeyRound} onClick={mint}>Generate</Button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs text-gray-800 dark:text-slate-200">{value}</code>
        <Button type="button" variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </div>
  );
}

export function PaymentsCard({ canEdit }) {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({ enabled: false, keyId: '', keySecret: '', webhookSecret: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(endpoints.integrations.get)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || res.data;
        setCfg(data);
        setForm({ enabled: Boolean(data.razorpay?.enabled), keyId: data.razorpay?.keyId || '', keySecret: '', webhookSecret: '' });
      })
      .catch((err) => { if (!cancelled) toast.error(serverError(err, 'Failed to load payment settings')); });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(endpoints.integrations.update, { razorpay: form });
      const data = res.data?.data || res.data;
      setCfg(data);
      setForm((f) => ({ ...f, keySecret: '', webhookSecret: '' }));
      toast.success('Razorpay settings saved');
    } catch (err) {
      toast.error(serverError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const body = form.keyId && form.keySecret ? { keyId: form.keyId, keySecret: form.keySecret } : {};
      const res = await api.post(endpoints.integrations.testRazorpay, body);
      toast.success(res.data?.message || 'Razorpay keys work');
    } catch (err) {
      toast.error(serverError(err, 'Razorpay rejected the keys'), { duration: 8000 });
    } finally {
      setTesting(false);
    }
  };

  const rz = cfg?.razorpay;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Online payments (Razorpay)</h2>
        </div>
        {rz && (rz.enabled && rz.configured ? <Badge color="success">{rz.mode === 'live' ? 'Live' : 'Test mode'}</Badge>
          : rz.configured ? <Badge color="warning">Configured, off</Badge> : <Badge>Not set up</Badge>)}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Hospitals pay for MedNote from Settings → Plan &amp; Billing through these keys — your own Razorpay account, not a hospital's.
        Register the webhook below in the Razorpay dashboard with the events <code>payment.captured</code> and <code>order.paid</code>.
        {rz?.fromEnv && ' Currently read from the server environment; saving here takes over.'}
      </p>
      {!cfg ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="space-y-4">
          <Toggle label="Accept online payments" checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} disabled={!canEdit} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Key ID" placeholder="rzp_live_…" value={form.keyId} onChange={(e) => setForm((f) => ({ ...f, keyId: e.target.value }))} disabled={!canEdit} />
            <SecretField
              label={`Key secret${rz.hasKeySecret ? ' (saved — leave blank to keep)' : ''}`}
              value={form.keySecret}
              onChange={(v) => setForm((f) => ({ ...f, keySecret: v }))}
              disabled={!canEdit}
            />
            <SecretField
              label={`Webhook secret${rz.hasWebhookSecret ? ' (saved — leave blank to keep)' : ''}`}
              value={form.webhookSecret}
              onChange={(v) => setForm((f) => ({ ...f, webhookSecret: v }))}
              disabled={!canEdit}
              generate
              hint="Razorpay doesn't issue this — you choose it. Generate one, paste the same value into the webhook's Secret field in the Razorpay dashboard, then save here."
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2"><CopyField label="Webhook URL" value={rz.webhookUrl} /></div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" icon={PlugZap} loading={testing} onClick={test} disabled={!form.keyId && !rz.configured}>Test keys</Button>
              <Button type="button" loading={saving} onClick={save}>Save Razorpay settings</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function OrgnestInvoicingCard({ canEdit }) {
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ enabled: false, baseUrl: '', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [raising, setRaising] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(7);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(endpoints.integrations.get), api.get(endpoints.integrations.orgnestStatus)])
      .then(([c, s]) => {
        if (cancelled) return;
        const data = c.data?.data || c.data;
        setCfg(data);
        setStatus(s.data?.data || s.data);
        setForm({ enabled: Boolean(data.orgnest?.enabled), baseUrl: data.orgnest?.baseUrl || '', apiKey: '' });
      })
      .catch((err) => { if (!cancelled) toast.error(serverError(err, 'Failed to load orgnest settings')); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(endpoints.integrations.update, { orgnest: form });
      setCfg(res.data?.data || res.data);
      setForm((f) => ({ ...f, apiKey: '' }));
      toast.success('Orgnest invoicing settings saved');
      load();
    } catch (err) {
      toast.error(serverError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const body = form.apiKey ? { baseUrl: form.baseUrl, apiKey: form.apiKey } : {};
      const res = await api.post(endpoints.integrations.testOrgnest, body);
      const ping = res.data?.data || {};
      const problems = Array.isArray(ping.problems) && ping.problems.length ? ` — ${ping.problems.join(' ')}` : '';
      toast[problems ? 'error' : 'success'](`${res.data?.message || 'Connected'}${ping.businessUnit?.name ? ` · ${ping.businessUnit.name}` : ''}${problems}`, { duration: problems ? 10000 : 5000 });
    } catch (err) {
      toast.error(serverError(err, 'Could not reach orgnest'), { duration: 8000 });
    } finally {
      setTesting(false);
    }
  };

  const raise = async () => {
    setRaising(true);
    try {
      const res = await api.post(endpoints.integrations.orgnestRaise, { lookbackDays: Number(lookbackDays) || 7 });
      const r = res.data?.data || {};
      if (r.skipped) toast(r.skipped);
      else {
        const failed = r.errors ? r.errors.length : 0;
        toast[failed ? 'error' : 'success'](`${r.raised} raised${failed ? `, ${failed} failed` : ''} of ${r.checked} waiting`);
      }
      load();
    } catch (err) {
      toast.error(serverError(err, 'Could not raise invoices'));
    } finally {
      setRaising(false);
    }
  };

  const og = cfg?.orgnest;
  const stats = status?.last90Days || { raised: 0, waiting: 0, failing: 0 };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Orgnest invoicing</h2>
        </div>
        {og && (og.enabled && og.configured ? <Badge color="success">On</Badge> : og.configured ? <Badge color="warning">Configured, off</Badge> : <Badge>Not set up</Badge>)}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Every payment — collected online or recorded by hand on a hospital&apos;s ledger — is invoiced in orgnest as it is paid; orgnest
        numbers the GST invoice, emails it to the hospital and keeps the PDF, the same arrangement as Hisabe and Rupit. Create the key in
        orgnest → Settings → Invoicing API (bound to the Oadbox business unit and the MedNote project, with this API server&apos;s address
        allowed). A charge given an invoice number by hand counts as invoiced elsewhere and is left alone.
        {og && !og.enabled && ' While it is off, MedNote numbers and renders its own invoice using the Invoice / GST identity above.'}
      </p>
      {!cfg ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="space-y-4">
          <Toggle label="Raise invoices in orgnest" checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} disabled={!canEdit} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="orgnest address" placeholder="https://api.orgnest.co" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} disabled={!canEdit} />
            <Input label={`Invoicing API key${og.hasApiKey ? ` (saved ${og.apiKeyHint} — leave blank to keep)` : ''}`} type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} disabled={!canEdit} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[['Raised', stats.raised, 'text-emerald-700 dark:text-emerald-300'], ['Waiting', stats.waiting, 'text-gray-900 dark:text-slate-100'], ['Failing', stats.failing, stats.failing ? 'text-red-600 dark:text-red-300' : 'text-gray-900 dark:text-slate-100']].map(([label, n, cls]) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">{label} · 90 days</p>
                <p className={`text-xl font-semibold ${cls}`}>{n}</p>
              </div>
            ))}
          </div>

          {status?.failing?.length > 0 && (
            <div className="space-y-2">
              {status.failing.map((f) => (
                <div key={f.chargeId} className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2 font-medium text-gray-900 dark:text-slate-100">
                    <span>{f.hospital} — {f.description}</span>
                    <span>{formatCurrency(f.total)} · {dayjs(f.paidAt).format('DD MMM YYYY')} · {f.attempts} attempt{f.attempts === 1 ? '' : 's'}</span>
                  </div>
                  <p className="text-red-700 dark:text-red-300 mt-1">{f.error}</p>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                <div className="w-32">
                  <Input label="Look back (days)" type="number" min="1" max="400" value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} />
                </div>
                <Button type="button" variant="secondary" icon={RefreshCw} loading={raising} disabled={!og.enabled} onClick={raise}>Raise missing invoices</Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" icon={PlugZap} loading={testing} onClick={test} disabled={!form.apiKey && !og.configured}>Test connection</Button>
                <Button type="button" loading={saving} onClick={save}>Save orgnest settings</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Push notifications to the MedNote mobile app (Firebase Cloud Messaging).
// The service-account key stays on the server (write-only here, encrypted at
// rest); the app config below is public and the app downloads it at startup
// from /public/push-config, so changing project needs no app release.
const FIREBASE_APP_FIELDS = [
  ['projectId', 'Project ID'],
  ['messagingSenderId', 'Sender ID (project number)'],
  ['storageBucket', 'Storage bucket'],
  ['androidAppId', 'Android app ID'],
  ['androidApiKey', 'Android API key'],
  ['iosAppId', 'iOS app ID'],
  ['iosApiKey', 'iOS API key'],
  ['iosBundleId', 'iOS bundle ID'],
];

export function FirebasePushCard({ canEdit }) {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState(null);
  const [serviceAccount, setServiceAccount] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback((data) => {
    const fb = data.firebase || {};
    setCfg(fb);
    const next = { enabled: Boolean(fb.enabled) };
    FIREBASE_APP_FIELDS.forEach(([k]) => { next[k] = fb[k] || ''; });
    setForm(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get(endpoints.integrations.get)
      .then((res) => { if (!cancelled) load(res.data?.data || res.data); })
      .catch((err) => { if (!cancelled) toast.error(serverError(err, 'Failed to load push settings')); });
    return () => { cancelled = true; };
  }, [load]);

  const readFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(setServiceAccount).catch(() => toast.error('Could not read that file'));
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, ...(serviceAccount.trim() ? { serviceAccount: serviceAccount.trim() } : {}) };
      const res = await api.put(endpoints.integrations.update, { firebase: body });
      load(res.data?.data || res.data);
      setServiceAccount('');
      toast.success('Push notification settings saved');
    } catch (err) {
      toast.error(serverError(err, 'Failed to save'), { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.post(endpoints.integrations.testFirebase, serviceAccount.trim() ? { serviceAccount: serviceAccount.trim() } : {});
      toast.success(res.data?.message || 'Firebase accepted the key');
    } catch (err) {
      toast.error(serverError(err, 'Firebase rejected the key'), { duration: 8000 });
    } finally {
      setTesting(false);
    }
  };

  const clearKey = async () => {
    if (!window.confirm('Remove the saved service-account key? Push notifications stop until a new key is saved.')) return;
    setSaving(true);
    try {
      const res = await api.put(endpoints.integrations.update, { firebase: { serviceAccount: null } });
      load(res.data?.data || res.data);
      toast.success('Service-account key removed');
    } catch (err) {
      toast.error(serverError(err, 'Failed to remove the key'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
            <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-300" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Push notifications (Firebase)</h2>
        </div>
        {cfg && (cfg.enabled && cfg.configured ? <Badge color="success">On</Badge>
          : cfg.configured ? <Badge color="warning">Configured, off</Badge> : <Badge>Not set up</Badge>)}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Sends notifications to the MedNote mobile app for every hospital. The service-account key never leaves the server;
        the app settings below are public and the app picks them up when it starts.
        {cfg?.fromEnv && ' The key is currently read from the server environment; saving one here takes over.'}
      </p>
      {!form ? (
        <div className="py-10 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="space-y-4">
          <Toggle label="Send push notifications" checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} disabled={!canEdit} />

          <div>
            <p className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Service-account key</p>
            {cfg.hasServiceAccount ? (
              <p className="text-xs text-gray-600 dark:text-slate-300 mb-2">
                Saved: <code>{cfg.serviceAccountEmail}</code> (project <code>{cfg.serviceAccountProject}</code>). Paste or upload a new one to replace it.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                Firebase console → Project settings → Service accounts → Generate new private key. Paste the JSON or upload the file.
              </p>
            )}
            <textarea
              rows={4}
              spellCheck={false}
              autoComplete="off"
              placeholder={'{ "type": "service_account", ... }'}
              value={serviceAccount}
              onChange={(e) => setServiceAccount(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {canEdit && (
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Upload JSON file
                  <input type="file" accept="application/json,.json" className="hidden" onChange={readFile} />
                </label>
                {cfg.hasServiceAccount && !cfg.fromEnv && (
                  <button type="button" onClick={clearKey} className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    Remove saved key
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Mobile app settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIREBASE_APP_FIELDS.map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  disabled={!canEdit}
                  spellCheck={false}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              From the Firebase console → Project settings → Your apps (google-services.json / GoogleService-Info.plist).
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" icon={PlugZap} loading={testing} onClick={test} disabled={!serviceAccount.trim() && !cfg.hasServiceAccount}>Test key</Button>
              <Button type="button" loading={saving} onClick={save}>Save push settings</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

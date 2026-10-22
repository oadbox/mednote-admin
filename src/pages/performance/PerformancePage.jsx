// Performance — "the client says MedNote is slow; is it us or their internet?"
//
// Fed by GET /platform/performance/summary (hms-backend perfMonitor.service):
//   - live: p50/p95 of the API process right now (every request)
//   - client samples: slow / failed calls reported by the hospital app, each
//     blamed on network or server by which side ate more of the wait
//   - server samples: requests where the API itself was slow
import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import clsx from 'clsx';
import { RefreshCw, Server, WifiLow, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

dayjs.extend(relativeTime);

const RANGES = [
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '24 hours' },
  { hours: 24 * 7, label: '7 days' },
  { hours: 24 * 30, label: '30 days' },
];

const VERDICT = {
  server: { color: 'danger', label: 'Server slow' },
  network: { color: 'warning', label: 'Their internet' },
  minor: { color: 'gray', label: 'Occasional' },
  ok: { color: 'success', label: 'OK' },
};

const ms = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

function Tile({ label, value, hint, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900 dark:text-slate-100',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    green: 'text-emerald-600 dark:text-emerald-400',
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </Card>
  );
}

function Table({ columns, rows, empty, onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            {columns.map((c) => <th key={c.key} className={clsx('px-3 py-2 font-medium whitespace-nowrap', c.right && 'text-right')}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr
              key={r.id || `${r.hospitalId}-${r.route}-${i}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={clsx('border-b border-slate-100 dark:border-slate-800 last:border-0', onRowClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50')}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-3 py-2 text-slate-700 dark:text-slate-200', c.right && 'text-right tabular-nums')}>
                  {c.cell ? c.cell(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Diagnosis({ data }) {
  const t = data.totals;
  let tone = 'green';
  let Icon = CheckCircle2;
  let title = 'No widespread problem';
  let detail = 'The API is responding normally. Individual complaints are most likely the hospital\'s own connection — check their row below.';
  if (data.live.p95Ms != null && data.live.p95Ms > 2000) {
    tone = 'red'; Icon = AlertTriangle;
    title = 'The API is slow right now';
    detail = `95% of requests in the last ${data.live.sampleSize} took up to ${ms(data.live.p95Ms)}. Check the server (CPU, memory, database) and the slow endpoints below.`;
  } else if (t.hospitalsWithServerSlow >= 3) {
    tone = 'red'; Icon = AlertTriangle;
    title = `Server slowness at ${t.hospitalsWithServerSlow} hospitals`;
    detail = 'Slow API responses are spread across several hospitals — this points to the app or database, not anyone\'s internet. See the slow endpoints below.';
  } else if (t.serverBlamed > t.networkBlamed && t.serverBlamed >= 5) {
    tone = 'amber'; Icon = Server;
    title = 'Most slow reports are on the server side';
    detail = 'Hospitals are waiting mainly on the API. Look at the slow endpoints for the cause.';
  } else if (t.networkBlamed >= 5) {
    tone = 'amber'; Icon = WifiLow;
    title = 'Most slow reports are network-side';
    detail = 'The API answered quickly; the time went on the hospitals\' connections.';
  }
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
    red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
  };
  return (
    <div className={clsx('flex gap-3 rounded-xl border px-4 py-3', tones[tone])}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [hours, setHours] = useState(24);
  const [hospital, setHospital] = useState(null); // { id, name }
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(endpoints.performance.summary, { params: { hours, hospitalId: hospital?.id || undefined } });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load performance data');
    } finally {
      setLoading(false);
    }
  }, [hours, hospital]);

  useEffect(() => { load(); }, [load]);

  const hospitalColumns = [
    { key: 'hospitalName', header: 'Hospital', cell: (r) => <span className="font-medium">{r.hospitalName}</span> },
    { key: 'verdict', header: 'Likely cause', cell: (r) => <Badge color={VERDICT[r.verdict]?.color}>{VERDICT[r.verdict]?.label}</Badge> },
    { key: 'networkBlamed', header: 'Network-slow', right: true },
    { key: 'serverBlamed', header: 'Server-slow (seen)', right: true },
    { key: 'serverSlow', header: 'Server-slow (logged)', right: true },
    { key: 'failed', header: 'Timeouts / failed', right: true },
    { key: 'medianNetworkMs', header: 'Median network', right: true, cell: (r) => ms(r.medianNetworkMs) },
    { key: 'medianServerMs', header: 'Median server', right: true, cell: (r) => ms(r.medianServerMs) },
    { key: 'connType', header: 'Connection', cell: (r) => (r.connType ? r.connType.toUpperCase() : '—') },
    { key: 'lastAt', header: 'Last', cell: (r) => <span className="text-slate-500 whitespace-nowrap">{dayjs(r.lastAt).fromNow()}</span> },
  ];

  const routeColumns = [
    { key: 'route', header: 'Endpoint', cell: (r) => <span className="font-mono text-xs">{r.method} {r.route}</span> },
    { key: 'count', header: 'Slow hits', right: true },
    { key: 'hospitals', header: 'Hospitals', right: true },
    { key: 'p50Ms', header: 'Median', right: true, cell: (r) => ms(r.p50Ms) },
    { key: 'p95Ms', header: 'p95', right: true, cell: (r) => ms(r.p95Ms) },
    { key: 'maxMs', header: 'Max', right: true, cell: (r) => ms(r.maxMs) },
  ];

  const recentColumns = [
    { key: 'createdAt', header: 'When', cell: (r) => <span className="whitespace-nowrap text-slate-500">{dayjs(r.createdAt).format('MMM D, h:mm:ss A')}</span> },
    { key: 'hospitalName', header: 'Hospital', cell: (r) => r.hospitalName || '—' },
    { key: 'blame', header: 'Cause', cell: (r) => <Badge color={r.blame === 'server' ? 'danger' : 'warning'}>{r.blame === 'server' ? 'Server' : 'Network'}</Badge> },
    { key: 'kind', header: 'Type', cell: (r) => <span className="text-xs">{r.source === 'server' ? 'API log' : 'Browser'} · {r.kind.replace('_', ' ')}</span> },
    { key: 'route', header: 'Endpoint', cell: (r) => <span className="font-mono text-xs">{r.method} {r.route}</span> },
    { key: 'totalMs', header: 'Total', right: true, cell: (r) => ms(r.totalMs) },
    { key: 'serverMs', header: 'Server', right: true, cell: (r) => ms(r.serverMs) },
    { key: 'networkMs', header: 'Network', right: true, cell: (r) => ms(r.networkMs) },
    { key: 'connType', header: 'Conn.', cell: (r) => (r.connType ? r.connType.toUpperCase() : '—') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-gray-600 dark:text-slate-400">
          Is it MedNote or the hospital's internet? Slow requests, split into server time and network time.
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.hours}
                type="button"
                onClick={() => setHours(r.hours)}
                className={clsx('px-3 py-1.5 text-sm rounded-md', hours === r.hours
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Refresh">
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {hospital && (
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200 px-3 py-1 text-sm">
          Showing {hospital.name}
          <button type="button" onClick={() => setHospital(null)} aria-label="Show all hospitals"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {data && (
        <>
          <Diagnosis data={data} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile
              label="API right now (p95)"
              value={ms(data.live.p95Ms)}
              hint={`median ${ms(data.live.p50Ms)} · last ${data.live.sampleSize} requests`}
              tone={data.live.p95Ms > 2000 ? 'red' : data.live.p95Ms > 800 ? 'amber' : 'green'}
            />
            <Tile
              label="API last hour"
              value={data.live.lastHour.requests.toLocaleString()}
              hint={`${data.live.lastHour.slow} over ${ms(data.live.slowThresholdMs)} · ${data.live.lastHour.errors} errors`}
              tone={data.live.lastHour.errors > 0 ? 'amber' : 'slate'}
            />
            <Tile
              label="Slow — their internet"
              value={data.totals.networkBlamed}
              hint={`${data.totals.failed} timeouts / failed requests`}
              tone={data.totals.networkBlamed ? 'amber' : 'slate'}
            />
            <Tile
              label="Slow — our server"
              value={data.totals.serverSlow}
              hint={`logged by the API · ${data.totals.serverBlamed} seen by browsers`}
              tone={data.totals.serverSlow ? 'red' : 'slate'}
            />
          </div>

          {!hospital && (
            <Card className="p-0">
              <div className="px-4 pt-4 pb-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">By hospital</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Click a hospital to see only its requests.</p>
              </div>
              <Table
                columns={hospitalColumns}
                rows={data.hospitals}
                empty="No slow requests in this period."
                onRowClick={(r) => r.hospitalId && setHospital({ id: r.hospitalId, name: r.hospitalName })}
              />
            </Card>
          )}

          <Card className="p-0">
            <div className="px-4 pt-4 pb-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Slow endpoints</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Requests where the API itself took over {ms(data.live.slowThresholdMs)}. These are ours to fix.</p>
            </div>
            <Table columns={routeColumns} rows={data.routes} empty="No slow API requests in this period." />
          </Card>

          <Card className="p-0">
            <div className="px-4 pt-4 pb-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent slow requests</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Latest 100. Network = total wait − server time.</p>
            </div>
            <Table columns={recentColumns} rows={data.recent} empty="Nothing recorded yet." />
          </Card>
        </>
      )}
    </div>
  );
}

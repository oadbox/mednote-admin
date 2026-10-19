import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, CalendarDays, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import endpoints from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import DatePicker from '../../components/ui/DatePicker';
import { BarGradient, CustomTooltip } from '../../components/charts/ChartPrimitives';
import { CHART_COLORS, ANIM, AXIS_TICK, GRID_STROKE, useGradientId } from '../../components/charts/chartConfig';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatters';
import {
  CHARGE_STATUS_COLOR, CHARGE_STATUSES, typeLabel, statusLabel, sourceLabel, typeOptions, paidViaLabel,
} from '../../utils/charges';

const fmt = (d) => (d ? dayjs(d).format('MMM D, YYYY') : '—');
const monthLabel = (m) => dayjs(`${m}-01`).format('MMM YY');

// Platform revenue: every charge across every hospital, and what has actually
// been collected. The per-hospital ledger lives on the hospital page; this is
// the rollup — what came in this month, what is still owed, and by whom.
// Ported from hisabe's Billing page. Backend: /platform/charges/revenue.
export default function RevenueLedger() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const gradId = useGradientId('revenue-bar');

  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byMonth, setByMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [basis, setBasis] = useState('charged');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sweeping, setSweeping] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get(endpoints.charges.overview);
      setOverview(res.data?.data || null);
    } catch {
      setOverview(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoints.charges.revenue, {
        params: {
          page, limit: pageSize, basis,
          search: search || undefined,
          status: status || undefined,
          type: type || undefined,
          from: from ? `${from}T00:00:00.000Z` : undefined,
          to: to ? `${to}T23:59:59.999Z` : undefined,
        },
      });
      const d = res.data?.data || {};
      setRows(d.items || []);
      setSummary(d.summary || null);
      setByMonth(d.byMonth || []);
      const pag = res.data?.pagination || {};
      setTotalPages(pag.totalPages || 1);
      setTotalItems(pag.total ?? (d.items || []).length);
    } catch {
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, basis, search, status, type, from, to]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { load(); }, [load]);

  // Any filter change invalidates the page the user was on.
  const filter = (set) => (v) => { set(v); setPage(1); };

  // The same sweep the daily job runs. It is here because scheduled jobs only
  // fire while the server is up — without a manual trigger, a stopped server
  // means renewals quietly stop being raised.
  const runSweep = async () => {
    setSweeping(true);
    try {
      const res = await api.post(endpoints.charges.runRenewals);
      const r = res.data?.data || {};
      const parts = [
        r.raised ? `${r.raised} renewal${r.raised === 1 ? '' : 's'} raised` : '',
        r.comped ? `${r.comped} comped term${r.comped === 1 ? '' : 's'} rolled forward` : '',
        r.failed ? `${r.failed} failed` : '',
      ].filter(Boolean);
      if (parts.length) toast.success(parts.join(', '));
      else toast(`Nothing due — no renewal falls inside the next ${overview?.renewalLeadDays ?? 7} days`);
      loadOverview();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not run the renewal sweep');
    } finally {
      setSweeping(false);
    }
  };

  const columns = [
    {
      header: 'Charged',
      accessor: 'chargedAt',
      cell: (row) => <span className="whitespace-nowrap">{fmt(row.chargedAt)}</span>,
    },
    {
      header: 'Hospital',
      accessor: 'hospital',
      cell: (row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-slate-100">{row.hospital?.name || '—'}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{row.hospital?.email || ''}</p>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'type',
      cell: (row) => <span className="whitespace-nowrap">{typeLabel(row.type)}</span>,
    },
    {
      header: 'Description',
      accessor: 'description',
      cell: (row) => {
        const src = sourceLabel(row.metadata?.source);
        return (
          <div className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <span>{row.description}</span>
              {src && <Badge color="info">{src}</Badge>}
            </div>
            {row.periodStart && row.periodEnd && (
              <p className="text-xs text-gray-500 dark:text-slate-400">{fmt(row.periodStart)} → {fmt(row.periodEnd)}</p>
            )}
            {row.invoiceNumber && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {row.invoiceId
                  ? <Link to={`/invoices/${row.invoiceId}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">Inv {row.invoiceNumber}</Link>
                  : <>Inv {row.invoiceNumber}{row.metadata?.orgnest?.invoiceNumber ? <span className="text-gray-400"> (orgnest)</span> : null}</>}
              </p>
            )}
          </div>
        );
      },
    },
    {
      header: 'Amount',
      accessor: 'total',
      cell: (row) => (
        <div className="text-right whitespace-nowrap tabular-nums">
          <p className="font-medium text-gray-900 dark:text-slate-100">{formatCurrency(row.total)}</p>
          {row.taxAmount > 0 && (
            <p className="text-xs text-gray-500 dark:text-slate-400">incl. {formatCurrency(row.taxAmount)} GST</p>
          )}
          {row.status === 'pending' && row.amountPaid > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{formatCurrency(row.balance)} due</p>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => (
        <Badge color={row.overdue ? 'danger' : CHARGE_STATUS_COLOR[row.status]}>
          {row.overdue ? 'Overdue' : statusLabel(row.status)}
        </Badge>
      ),
    },
    {
      header: 'Paid on',
      accessor: 'paidAt',
      cell: (row) => (
        <div className="whitespace-nowrap">
          {row.paidAt ? fmt(row.paidAt) : '—'}
          {row.paidAt && paidViaLabel(row) && (
            <p className="text-xs text-gray-500 dark:text-slate-400">{paidViaLabel(row)}</p>
          )}
          {!row.paidAt && row.dueAt && row.status === 'pending' && (
            <p className="text-xs text-gray-500 dark:text-slate-400">due {fmt(row.dueAt)}</p>
          )}
        </div>
      ),
    },
  ];

  const peak = Math.max(1, ...byMonth.map((m) => m.collected));
  const chartData = byMonth.map((m) => ({ month: monthLabel(m.month), collected: m.collected }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-base text-gray-600 dark:text-slate-400">
          Product revenue actually recorded — subscriptions, setup fees and every other charge, across all hospitals.
        </p>
        {isSuperAdmin && (
          <Button variant="secondary" icon={RefreshCw} loading={sweeping} onClick={runSweep}>
            Raise due renewals
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Collected this month" value={formatCurrency(overview?.collectedThisMonth || 0)} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
        <StatCard icon={CalendarDays} label="Collected this year" value={formatCurrency(overview?.collectedThisYear || 0)} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard icon={IndianRupee} label="All time" value={formatCurrency(overview?.collectedAllTime || 0)} iconBg="bg-violet-100" iconColor="text-violet-600" />
        <StatCard
          icon={AlertCircle}
          label="Outstanding"
          value={formatCurrency(overview?.outstanding || 0)}
          change={overview?.overdueCount ? `${overview.overdueCount} overdue · ${formatCurrency(overview.overdue)}` : (overview?.outstandingCount ? `${overview.outstandingCount} unpaid` : '')}
          changeType={overview?.overdueCount ? 'negative' : 'neutral'}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          onClick={() => { filter(setStatus)('pending'); }}
        />
      </div>

      {chartData.length > 1 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Collected by month</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs><BarGradient id={gradId} color={CHART_COLORS.emerald} /></defs>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, peak]} tickFormatter={(v) => formatCurrency(v)} width={80} />
                <Tooltip content={<CustomTooltip valueFormatter={(v) => formatCurrency(v)} />} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
                <Bar dataKey="collected" name="Collected" fill={`url(#${gradId})`} radius={[6, 6, 0, 0]} animationDuration={ANIM.barDuration} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {summary?.byType?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.byType.map((t) => (
            <Card key={t.type} className="px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">{typeLabel(t.type)}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(t.collected)}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                of {formatCurrency(t.billed)} billed · {t.count} {t.count === 1 ? 'charge' : 'charges'}
                {t.outstanding > 0 && <> · <span className="text-amber-600 dark:text-amber-400">{formatCurrency(t.outstanding)} due</span></>}
              </p>
            </Card>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => row.hospitalId && navigate(`/hospitals/${row.hospitalId}`)}
        searchable
        searchValue={search}
        onSearch={filter(setSearch)}
        searchPlaceholder="Search hospital, description, invoice or reference..."
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={totalItems}
        emptyIllustration="invoices"
        emptyTitle="No charges recorded"
        emptyMessage="Record a fee or raise a renewal from a hospital's Billing ledger card."
        headerActions={(
          <div className="flex flex-wrap items-end gap-2">
            <Select
              options={[{ value: 'charged', label: 'By charge date' }, { value: 'paid', label: 'By payment date' }, { value: 'due', label: 'By due date' }]}
              value={basis}
              onChange={filter(setBasis)}
              className="w-44"
            />
            <DatePicker value={from} onChange={filter(setFrom)} placeholder="From" className="w-36" />
            <DatePicker value={to} onChange={filter(setTo)} placeholder="To" className="w-36" />
            <Select
              options={[{ value: '', label: 'All statuses' }, ...CHARGE_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]}
              value={status}
              onChange={filter(setStatus)}
              className="w-36"
            />
            <Select
              options={[{ value: '', label: 'All types' }, ...typeOptions()]}
              value={type}
              onChange={filter(setType)}
              className="w-40"
            />
          </div>
        )}
      />

      {summary && (
        <p className="text-sm text-gray-500 dark:text-slate-400 -mt-2">
          For this filter: billed <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(summary.billed)}</span>
          {' · '}collected <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.collected)}</span>
          {summary.outstanding > 0 && <>{' · '}outstanding <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(summary.outstanding)}</span></>}
          {summary.waived > 0 && <>{' · '}waived {formatCurrency(summary.waived)}</>}
        </p>
      )}
    </div>
  );
}
